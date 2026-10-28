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

const POLL_INTERVAL_MS = 60 * 1000;
const SYNC_INTERVAL_MS = 20 * 1000;

export function useNotifications(routine, weekDays) {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState(() => getPermissionStatus());
  const [settings, setSettings] = useState(() => loadSettings());
  const intervalRef = useRef(null);
  const syncIntervalRef = useRef(null);

  const supported = isNotificationSupported();

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

    // Confirm the browser accepts a real notification before saving the toggle.
    try {
      const probe = new Notification('AUSTWise notification check', {
        body: 'Browser notifications are ready.',
        silent: true,
        tag: 'austwise-notification-check',
      });
      probe.close();
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
  }, [supported]);

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

  return { supported, permission, settings, enable, prepareBrowserChannel, disable, updateSetting };
}
