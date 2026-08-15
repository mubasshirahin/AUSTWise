import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  seedFromNotices,
  seedFromDeadlines,
  seedFromTasks,
  seedFromRoleApplications,
  clearAllNotifications,
  showNativeNotification,
} from '../utils/inAppNotifications';
import { getAllRoleApplications } from '../utils/authStorage';

const POLL_MS = 5000;

export function useInAppNotifications(user) {
  const [notifications, setNotifications] = useState(() => loadNotifications());
  const [unread, setUnread] = useState(() => getUnreadCount());
  const seededRef = useRef(false);

  const isAdmin = Boolean(
    user &&
    (user.role === 'admin' ||
      user.role === 'moderator' ||
      (Array.isArray(user.roles) && user.roles.some((r) => r === 'admin' || r === 'moderator')))
  );

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

    // Admin only: surface pending CR/SR applications already mirrored locally
    // (offline/same-device fallback — the server fetch below is authoritative).
    if (isAdmin) {
      try {
        seedFromRoleApplications(getAllRoleApplications());
      } catch { /* ignore */ }
    }

    setNotifications(loadNotifications());
    setUnread(getUnreadCount());
  }, [isAdmin]);

  // Admin only: fetch applications from the server so submissions made on
  // another device reach the admin's bell (and native popup) automatically.
  const seedRoleAppsFromServer = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/role-applications', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.applications)) {
        seedFromRoleApplications(data.applications);
      }
    } catch { /* offline — skip */ }
  }, [isAdmin]);

  // Seed once on mount
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    runSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSeed]);

  // Poll for external changes + fire native notifications for new items.
  // First load establishes a baseline so pre-existing/seeded items don't spam.
  useEffect(() => {
    let baseline = null;
    let running = false;

    const check = async () => {
      if (running) return;
      running = true;
      try {
        // Pull fresh role applications (admin) before snapshotting, so a new
        // submission lands in the baseline or fires a native popup on the next
        // tick — never on the admin's own mount.
        await seedRoleAppsFromServer();
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
      } finally {
        running = false;
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, [seedRoleAppsFromServer]);

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
