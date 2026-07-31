import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isNotificationSupported,
  getPermissionStatus,
  requestPermission,
  loadSettings,
  saveSettings,
  checkClassReminders,
  checkDeadlineReminders,
} from '../utils/notificationService';
import { deadlines } from '../data/mockData';

const POLL_INTERVAL_MS = 60 * 1000;

export function useNotifications(routine, weekDays) {
  const [permission, setPermission] = useState(() => getPermissionStatus());
  const [settings, setSettings] = useState(() => loadSettings());
  const intervalRef = useRef(null);

  const supported = isNotificationSupported();

  const runChecks = useCallback(() => {
    const current = loadSettings();
    if (!current.enabled || getPermissionStatus() !== 'granted') return;

    if (current.notifyClass && routine) {
      checkClassReminders(routine, weekDays || [], current.classReminderMins);
    }
    if (current.notifyDeadline) {
      checkDeadlineReminders(deadlines, current.deadlineReminderHours);
    }
  }, [routine, weekDays]);

  useEffect(() => {
    if (settings.enabled && permission === 'granted') {
      runChecks();
      intervalRef.current = setInterval(runChecks, POLL_INTERVAL_MS);
    }
    return () => clearInterval(intervalRef.current);
  }, [settings.enabled, permission, runChecks]);

  const requestBrowserPermission = useCallback(async () => {
    if (!supported) return 'unsupported';
    const result = await requestPermission();
    setPermission(result);
    return result;
  }, [supported]);

  const enable = useCallback(async () => {
    const result = await requestBrowserPermission();
    if (result === 'granted') {
      const next = { ...loadSettings(), enabled: true };
      saveSettings(next);
      setSettings(next);
    }
    return result;
  }, [requestBrowserPermission]);

  const disable = useCallback(() => {
    const next = { ...loadSettings(), enabled: false };
    saveSettings(next);
    setSettings(next);
  }, []);

  const updateSetting = useCallback((key, value) => {
    const next = { ...loadSettings(), [key]: value };
    saveSettings(next);
    setSettings(next);
  }, []);

  return { supported, permission, settings, enable, requestBrowserPermission, disable, updateSetting };
}
