import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isNotificationSupported,
  getPermissionStatus,
  requestPermission,
  loadSettings,
  saveSettings,
  saveSettingsToServer,
  hydrateSettingsFromServer,
  SETTINGS_STORAGE_KEY,
} from '../utils/notificationService';
import { useAuth } from '../context/AuthContext';
import {
  isPushSupported,
  getExistingPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  fetchPushStatus,
  showTestPushNotification,
} from '../utils/webPush';

const SYNC_INTERVAL_MS = 20 * 1000;

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState(() => getPermissionStatus());
  const [settings, setSettings] = useState(() => loadSettings());
  const syncIntervalRef = useRef(null);

  const [pushBusy, setPushBusy] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(null);
  const [pushStatusFailed, setPushStatusFailed] = useState(false);
  const [pushError, setPushError] = useState('');

  const supported = isNotificationSupported();
  const pushSupported = isPushSupported();

  // Pull the account's server-side prefs so changes made on other devices
  // (e.g. the laptop) show up here without a manual refresh.
  const syncFromServer = useCallback(async () => {
    if (!isAuthenticated) return;
    const merged = await hydrateSettingsFromServer();
    if (merged) setSettings(merged);
  }, [isAuthenticated]);

  useEffect(() => {
    // Defer the initial pull a tick so the first render stays with the
    // localStorage cache, then hydrate from the server right after.
    const initialSync = setTimeout(syncFromServer, 0);
    syncIntervalRef.current = setInterval(syncFromServer, SYNC_INTERVAL_MS);

    // Re-sync when the tab regains focus / becomes visible again (mobile
    // browsers throttle background timers, so this is what catches a change
    // made on another device right after unlocking the phone).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncFromServer();
    };
    const onFocus = () => syncFromServer();
    // Another tab on the same browser wrote settings — pick them up instantly.
    const onStorage = (e) => {
      if (e.key === SETTINGS_STORAGE_KEY) setSettings(loadSettings());
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      clearTimeout(initialSync);
      clearInterval(syncIntervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [syncFromServer]);

  // Class and deadline reminders run app-wide from useReminderChecks.

  const enable = useCallback(async () => {
    if (!supported) return 'unsupported';
    const result = await requestPermission();
    setPermission(result);
    if (result === 'granted') {
      const next = { ...loadSettings(), enabled: true };
      saveSettings(next);
      setSettings(next);
      saveSettingsToServer(next);
    }
    return result;
  }, [supported]);

  const prepareBrowserChannel = useCallback(async (enableReminders = false) => {
    if (!supported) return 'unsupported';
    const result = await requestPermission();
    setPermission(result);
    if (result !== 'granted') return result;

    // Confirm the browser accepts a real notification before saving the
    // toggle. Mobile browsers reject `new Notification()`, so go through the
    // service worker whenever one is available.
    try {
      if (pushSupported) {
        await showTestPushNotification();
      } else {
        const probe = new Notification('AUSTWise notification check', {
          body: 'Browser notifications are ready.',
          silent: true,
          tag: 'austwise-notification-check',
        });
        probe.close();
      }
    } catch {
      return 'unavailable';
    }

    if (enableReminders) {
      const next = { ...loadSettings(), enabled: true };
      saveSettings(next);
      setSettings(next);
      saveSettingsToServer(next);
    }
    return 'granted';
  }, [supported, pushSupported]);

  const disable = useCallback(() => {
    const next = { ...loadSettings(), enabled: false };
    saveSettings(next);
    setSettings(next);
    saveSettingsToServer(next);
  }, []);

  const updateSetting = useCallback((key, value) => {
    const next = { ...loadSettings(), [key]: value };
    saveSettings(next);
    setSettings(next);
    saveSettingsToServer(next);
  }, []);

  // ── Web Push (service-worker based, works on mobile) ────────────────────
  const refreshPushState = useCallback(async () => {
    if (!pushSupported || !isAuthenticated) return { configured: null, subscribed: false };
    setPushStatusFailed(false);
    try {
      const [local, status] = await Promise.all([
        getExistingPushSubscription(),
        fetchPushStatus(),
      ]);
      // Require both sides: a local subscription the server forgot (or vice
      // versa) is not a working push setup.
      const subscribed = Boolean(local && status.subscribed);
      const configured = status.configured !== false;
      setPushSubscribed(subscribed);
      setPushConfigured(configured);
      try {
        const key = 'aust-push-reminders-handoff';
        if (subscribed) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
      } catch { /* best effort */ }
      return { configured, subscribed };
    } catch (e) {
      // A failed status check is NOT proof the server is unconfigured. Keep
      // `configured` unknown so the UI can offer a retry instead of silently
      // disabling push for the rest of the session.
      setPushConfigured(null);
      setPushStatusFailed(true);
      setPushError(e?.message || 'Could not check push status.');
      return { configured: null, subscribed: false };
    }
  }, [pushSupported, isAuthenticated]);

  const enablePush = useCallback(async () => {
    if (!isAuthenticated) return 'auth_required';
    setPushBusy(true);
    setPushError('');
    try {
      if (Notification.permission !== 'granted') {
        const result = await requestPermission();
        if (result !== 'granted') {
          setPushError(result === 'denied'
            ? 'Notifications are blocked in your browser settings.'
            : 'Notification permission was not granted.');
          return result;
        }
        setPermission(result);
      }
      await subscribeToPush();
      await refreshPushState();
      return 'subscribed';
    } catch (e) {
      setPushError(e?.message || 'Could not enable push notifications.');
      return 'error';
    } finally {
      setPushBusy(false);
    }
  }, [isAuthenticated, refreshPushState]);

  const disablePush = useCallback(async () => {
    setPushBusy(true);
    setPushError('');
    try {
      await unsubscribeFromPush();
      await refreshPushState();
    } catch (e) {
      setPushError(e?.message || 'Could not disable push notifications.');
    } finally {
      setPushBusy(false);
    }
  }, [refreshPushState]);

  useEffect(() => {
    // Defer a tick so the initial render isn't followed by a synchronous
    // state update (and so SW registration has a chance to start).
    const timer = setTimeout(refreshPushState, 0);
    return () => clearTimeout(timer);
  }, [refreshPushState]);

  return {
    supported, permission, settings, enable, prepareBrowserChannel, disable, updateSetting,
    push: {
      supported: pushSupported,
      busy: pushBusy,
      subscribed: pushSubscribed,
      configured: pushConfigured,
      statusFailed: pushStatusFailed,
      error: pushError,
      refresh: refreshPushState,
      enable: enablePush,
      disable: disablePush,
    },
  };
}
