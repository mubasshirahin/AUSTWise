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
  checkClassReminders,
  checkDeadlineReminders,
} from '../utils/notificationService';
import { deadlines } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import {
  isPushSupported,
  getExistingPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  fetchPushStatus,
  showTestPushNotification,
} from '../utils/webPush';

const POLL_INTERVAL_MS = 60 * 1000;
const SYNC_INTERVAL_MS = 20 * 1000;

export function useNotifications(routine, weekDays) {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState(() => getPermissionStatus());
  const [settings, setSettings] = useState(() => loadSettings());
  const intervalRef = useRef(null);
  const syncIntervalRef = useRef(null);

  const [pushBusy, setPushBusy] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(null);
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

  const runChecks = useCallback(() => {
    const current = loadSettings();
    if (!current.enabled || getPermissionStatus() !== 'granted') return;

    if (current.notifyClass && routine) {
      checkClassReminders(routine, weekDays || [], 30);
    }
    if (current.notifyDeadline) {
      checkDeadlineReminders(deadlines, 12);
    }
  }, [routine, weekDays]);

  useEffect(() => {
    if (settings.enabled && permission === 'granted') {
      runChecks();
      intervalRef.current = setInterval(runChecks, POLL_INTERVAL_MS);
    }
    return () => clearInterval(intervalRef.current);
  }, [settings.enabled, permission, runChecks]);

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
    if (!pushSupported || !isAuthenticated) return;
    try {
      const [local, status] = await Promise.all([
        getExistingPushSubscription(),
        fetchPushStatus(),
      ]);
      // Require both sides: a local subscription the server forgot (or vice
      // versa) is not a working push setup.
      const subscribed = Boolean(local && status.subscribed);
      setPushSubscribed(subscribed);
      setPushConfigured(status.configured !== false);
      try {
        const key = 'aust-push-reminders-handoff';
        if (subscribed) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
      } catch { /* best effort */ }
    } catch {
      setPushConfigured(false);
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
      error: pushError,
      refresh: refreshPushState,
      enable: enablePush,
      disable: disablePush,
    },
  };
}
