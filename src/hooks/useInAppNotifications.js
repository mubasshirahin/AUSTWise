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
  addNotification,
} from '../utils/inAppNotifications';
import { loadSharedSync } from '../utils/storageService';
import { getAllRoleApplications } from '../utils/authStorage';
import { onRealtimeMessage } from '../utils/liveStore';

const POLL_MS = 5000;

/**
 * Cheap change-detector for the notification list. `loadNotifications()`
 * returns a brand-new array on every call, so setting it unconditionally made
 * the navbar re-render every 5s forever even when nothing had changed.
 */
function notificationsSignature(list) {
  let sig = '';
  for (const n of list) sig += `${n.id}:${n.read ? 1 : 0}|`;
  return sig;
}

export function useInAppNotifications(user) {
  const [notifications, setNotifications] = useState(() => loadNotifications());
  const [unread, setUnread] = useState(() => getUnreadCount());
  const seededRef = useRef(null);

  const isAdmin = Boolean(
    user &&
    (user.role === 'admin' ||
      user.role === 'moderator' ||
      (Array.isArray(user.roles) && user.roles.some((r) => r === 'admin' || r === 'moderator')))
  );

  const addRoleReviewNotification = useCallback((application) => {
    if (!application?.id || !['approved', 'rejected'].includes(application.status)) return;
    const approved = application.status === 'approved';
    const roleLabel = application.appliedRole === 'cr'
      ? 'Class Representative (CR)'
      : 'Student Representative (SR)';
    addNotification({
      id: `role-review-${application.id}-${application.status}`,
      title: approved ? 'Application approved' : 'Application rejected',
      body: approved
        ? `Your application was approved. You are now the ${roleLabel}.`
        : `Your application for ${roleLabel} was rejected. You can re-apply when a slot opens up.`,
      type: 'info',
      category: 'applications',
      icon: approved ? 'CheckCircle2' : 'XCircle',
      path: '/settings',
      timestamp: application.reviewedAt ? new Date(application.reviewedAt).getTime() : Date.now(),
      read: false,
      priority: approved ? 'high' : 'medium',
    });
    const items = loadNotifications();
    setNotifications(items);
    setUnread(getUnreadCount());
  }, []);

  // Deliver admin decisions immediately to the applicant's notification bell.
  useEffect(() => {
    if (!user?.id || user?.isGuest || isAdmin) return undefined;
    return onRealtimeMessage('role-review', (payload) => {
      addRoleReviewNotification({
        id: payload?.applicationId || payload?.id,
        appliedRole: payload?.appliedRole,
        status: payload?.status,
        reviewedAt: payload?.reviewedAt,
      });
    });
  }, [user?.id, user?.isGuest, isAdmin, addRoleReviewNotification]);

  // Reconcile decisions made while the applicant was offline, using the
  // server's application record as the durable source of truth.
  useEffect(() => {
    if (!user?.id || user?.isGuest || isAdmin) return undefined;
    let cancelled = false;
    const syncMyRoleReviews = async () => {
      try {
        const res = await fetch('/api/role-applications/mine', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.applications)) {
          data.applications.forEach(addRoleReviewNotification);
        }
      } catch { /* offline; realtime will deliver the next decision */ }
    };
    syncMyRoleReviews();
    const interval = setInterval(syncMyRoleReviews, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id, user?.isGuest, isAdmin, addRoleReviewNotification]);

  const runSeed = useCallback(() => {
    try {
      const storedNotices = loadSharedSync('aust-notices');
      if (storedNotices) seedFromNotices(storedNotices, user);
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
  }, [isAdmin, user?.id, user?.department, user?.semester, user?.section, user?.labSection]);

  // Refresh the visible list when the active account changes. Notification
  // storage is user-scoped, so one account must never inherit another's bell.
  useEffect(() => {
    const seedKey = [user?.id || 'guest', isAdmin, user?.department, user?.semester, user?.section, user?.labSection].join('|');
    if (seededRef.current === seedKey) return;
    seededRef.current = seedKey;
    setNotifications(loadNotifications());
    setUnread(getUnreadCount());
    runSeed();
  }, [runSeed, user?.id, user?.department, user?.semester, user?.section, user?.labSection, isAdmin]);

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
        setNotifications((prev) => (notificationsSignature(prev) === notificationsSignature(items) ? prev : items));
        const nextUnread = getUnreadCount();
        setUnread((prev) => (prev === nextUnread ? prev : nextUnread));
      } finally {
        running = false;
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, [seedRoleAppsFromServer, user?.id]);

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
