import { useEffect, useRef, useCallback } from 'react';
import { useRoutine } from '../context/RoutineContext';
import {
  loadSettings,
  getPermissionStatus,
  checkClassReminders,
  checkDeadlineReminders,
  hydrateSettingsFromServer,
} from '../utils/notificationService';
import { deadlines } from '../data/mockData';

const POLL_MS = 60 * 1000;
const SYNC_MS = 20 * 1000;

export default function NotificationRunner() {
  const { routine, weekDays } = useRoutine();
  const intervalRef = useRef(null);
  const syncRef = useRef(null);

  const runChecks = useCallback(() => {
    const settings = loadSettings();
    if (!settings.enabled || getPermissionStatus() !== 'granted') return;
    if (settings.notifyClass) checkClassReminders(routine, weekDays, settings.classReminderMins);
    if (settings.notifyDeadline) checkDeadlineReminders(deadlines, settings.deadlineReminderHours);
  }, [routine, weekDays]);

  // Cross-device sync: pull the account's server-side prefs every few
  // seconds and on tab focus/visibility, so a change made on another device
  // (laptop vs phone) shows up here in near real time.
  const syncFromServer = useCallback(async () => {
    await hydrateSettingsFromServer();
  }, []);

  useEffect(() => {
    runChecks();
    intervalRef.current = setInterval(runChecks, POLL_MS);

    syncFromServer();
    syncRef.current = setInterval(syncFromServer, SYNC_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncFromServer();
    };
    const onFocus = () => syncFromServer();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(syncRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [runChecks, syncFromServer]);

  return null;
}
