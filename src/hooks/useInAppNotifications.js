import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  seedFromNotices,
  seedFromDeadlines,
  seedFromTasks,
  clearAllNotifications,
  showNativeNotification,
} from '../utils/inAppNotifications';

const POLL_MS = 5000;

export function useInAppNotifications() {
  const [notifications, setNotifications] = useState(() => loadNotifications());
  const [unread, setUnread] = useState(() => getUnreadCount());
  const seededRef = useRef(false);

  const runSeed = useCallback(() => {
    try {
      const storedNotices = localStorage.getItem('aust-notices');
      if (storedNotices) seedFromNotices(JSON.parse(storedNotices));
    } catch { /* ignore */ }

    try {
      const storedDeadlines = localStorage.getItem('aust-deadlines');
      if (storedDeadlines) seedFromDeadlines(JSON.parse(storedDeadlines));
    } catch { /* ignore */ }

    try {
      const storedTasks = localStorage.getItem('aust-week-tasks');
      if (storedTasks) seedFromTasks(JSON.parse(storedTasks));
    } catch { /* ignore */ }

    setNotifications(loadNotifications());
    setUnread(getUnreadCount());
  }, []);

  // Seed once on mount
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    runSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for external changes + fire native notifications for new items.
  // First load establishes a baseline so pre-existing/seeded items don't spam.
  useEffect(() => {
    let baseline = null;

    const check = () => {
      const items = loadNotifications();
      if (baseline === null) {
        baseline = new Set(items.map((n) => n.id));
      } else {
        items.forEach((n) => {
          if (!baseline.has(n.id)) showNativeNotification(n);
        });
        baseline = new Set(items.map((n) => n.id));
      }
      setNotifications(items);
      setUnread(getUnreadCount());
    };

    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = useCallback((id) => {
    markAsRead(id);
    setNotifications(loadNotifications());
    setUnread(getUnreadCount());
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
    setNotifications(loadNotifications());
    setUnread(getUnreadCount());
  }, []);

  const handleClearAll = useCallback(() => {
    clearAllNotifications();
    setNotifications([]);
    setUnread(0);
  }, []);

  /** Re-seed from localStorage data sources (call after data changes) */
  const reseed = useCallback(() => {
    runSeed();
  }, [runSeed]);

  return {
    notifications,
    unread,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    clearAll: handleClearAll,
    reseed,
  };
}
