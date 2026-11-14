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
  makeNotifId,
  noticeScopeMatchesUser,
} from '../utils/inAppNotifications';
import { loadSharedSync, loadSharedAsync } from '../utils/storageService';
import { getAllRoleApplications } from '../utils/authStorage';
import { onRealtimeMessage } from '../utils/liveStore';

const POLL_MS = 5000;
const CRSR_NOTICES_KEY = 'aust-cr-sr-notices';

// CR/SR notices live in their own store. Skip the viewer's own posts —
// nobody should be notified about a notice they wrote.
function withoutOwnNotices(list, userId) {
  return Array.isArray(list) ? list.filter((n) => !(userId && n.postedBy === userId)) : [];
}

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

  // Live: a CR/SR just posted. Listening here (navbar, every page) rather than
  // in the dashboard's NoticeBoard means the bell updates wherever the user is.
  useEffect(() => {
    if (!user?.id || user?.isGuest) return undefined;
    return onRealtimeMessage('notice-new', (p) => {
      if (!p?.title) return;
      if (p.postedById && p.postedById === user.id) return;
      if (!noticeScopeMatchesUser(p.scope, user)) return;
      addNotification({
        // Same id the store-based seed uses, so the two never duplicate.
        id: p.noticeId ? `notice-${p.noticeId}` : makeNotifId('notice'),
        title: p.title,
        body: (p.content || `Posted by ${p.postedByName || 'CR/SR'}`).slice(0, 120),
        type: 'notice',
        icon: 'BellRing',
        path: '/',
        timestamp: Date.now(),
        read: false,
        priority: p.pinned ? 'high' : 'medium',
        actorName: p.postedByName || '',
        avatar: p.postedByAvatar || null,
      });
      setNotifications(loadNotifications());
      setUnread(getUnreadCount());
    });
  }, [user?.id, user?.isGuest, user?.department, user?.semester, user?.section, user?.labSection]);

  // Gaming Zone pushes: squads pinging for players, event reminders and
  // changes, being removed from a room, and moderation actions.
  useEffect(() => {
    if (!user?.id || user?.isGuest) return undefined;
    const push = (item) => {
      addNotification({ type: 'info', category: 'gaming', timestamp: Date.now(), read: false, priority: 'medium', ...item });
      setNotifications(loadNotifications());
      setUnread(getUnreadCount());
    };
    const offs = [
      onRealtimeMessage('gz-lfg-ping', (p) => {
        if (!p?.roomId) return;
        push({
          id: `gz-ping-${p.roomId}-${Math.floor(Date.now() / 600000)}`,
          title: `${p.game?.name || 'A squad'} needs ${p.missing} more`,
          body: `${p.from?.name || 'Someone'}: "${p.title}"`.slice(0, 120),
          icon: 'BellRing',
          path: `/gaming/room/${p.roomId}`,
          priority: 'high',
        });
      }),
      onRealtimeMessage('gz-event-reminder', (p) => {
        if (!p?.eventId) return;
        push({ id: `gz-remind-${p.eventId}`, title: `${p.title} starts soon`, body: 'Check in and join the event chat.', icon: 'Clock', path: `/gaming/event/${p.eventId}`, priority: 'high' });
      }),
      onRealtimeMessage('gz-event-update', (p) => {
        if (!p?.eventId) return;
        const what = p.status === 'cancelled' ? 'was cancelled' : p.status === 'live' ? 'is live' : 'was updated';
        push({ id: `gz-event-${p.eventId}-${p.status}-${p.startsAt || ''}`, title: `${p.title} ${what}`, body: 'Open the event for details.', icon: 'CalendarCheck', path: `/gaming/event/${p.eventId}` });
      }),
      onRealtimeMessage('gz-kicked', (p) => {
        if (!p?.roomId) return;
        push({ id: makeNotifId('gz-kick'), title: p.banned ? 'Removed and blocked from a room' : 'Removed from a room', body: p.title || '', icon: 'AlertTriangle', path: '/gaming?view=rooms' });
      }),
      onRealtimeMessage('gz-sanction', (p) => {
        if (!p?.type) return;
        const label = p.type === 'zone_ban' ? 'Gaming Zone suspension' : p.type === 'room_ban' ? 'Room ban' : 'Mute';
        push({ id: makeNotifId('gz-sanction'), title: p.revoked ? `${label} lifted` : `${label} applied`, body: p.revoked ? 'You can take part again.' : (p.reason || ''), icon: 'AlertTriangle', path: '/gaming', priority: 'high' });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [user?.id, user?.isGuest]);

  // Catch-up: notices posted while this user was offline / socket dropped.
  useEffect(() => {
    if (!user?.id || user?.isGuest) return undefined;
    let cancelled = false;
    const sync = async () => {
      try {
        const list = await loadSharedAsync(CRSR_NOTICES_KEY, []);
        if (cancelled) return;
        seedFromNotices(withoutOwnNotices(list, user.id), user);
        setNotifications(loadNotifications());
        setUnread(getUnreadCount());
      } catch { /* offline — try again next tick */ }
    };
    sync();
    const interval = setInterval(sync, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id, user?.isGuest, user?.department, user?.semester, user?.section, user?.labSection]);

  const runSeed = useCallback(() => {
    try {
      const storedNotices = loadSharedSync('aust-notices');
      if (storedNotices) seedFromNotices(storedNotices, user);
    } catch { /* ignore */ }

    try {
      const crsr = loadSharedSync(CRSR_NOTICES_KEY);
      if (crsr) seedFromNotices(withoutOwnNotices(crsr, user?.id), user);
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
  }, [isAdmin, user]);

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
