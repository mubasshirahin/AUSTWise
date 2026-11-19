import { useRef, useCallback, useEffect, useState } from 'react';
import {
  isNotificationSupported,
  getPermissionStatus,
  requestPermission,
} from '../utils/notificationService';
import { addNotification, makeNotifId, showNativeNotification } from '../utils/inAppNotifications';

const STORAGE_KEY = 'aust-msg-notif-enabled';

/**
 * Hook for showing notifications when new messages arrive while the app
 * is in the background (different tab, minimized, or phone screen off).
 *
 * @param {string|null} userId - Current user's ID
 */
export default function useMessageNotifications(_userId) {
  const [permission, setPermission] = useState(() => getPermissionStatus());
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch { return true; }
  });
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Track whether the app is backgrounded
  const isHiddenRef = useRef(document.visibilityState === 'hidden');

  useEffect(() => {
    const handleVisibility = () => {
      isHiddenRef.current = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  /**
   * Notify the user about a new message.
   * Shows a browser notification when backgrounded, always adds an in-app notification.
   *
   * @param {object} msg - { fromId, fromName, text, timestamp }
   */
  const notifyNewMessage = useCallback(({ fromId, fromName, text, timestamp }) => {
    if (!fromId || !fromName || !text) return;
    if (!enabledRef.current) return;

    const preview = text.length > 120 ? text.slice(0, 117) + '...' : text;

    const item = {
      id: makeNotifId('msg'),
      title: `💬 ${fromName}`,
      body: preview,
      type: 'info',
      category: 'messages',
      icon: 'MessageCircle',
      path: `/messages?peer=${fromId}`,
      timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
      read: false,
      priority: 'high',
    };

    // Always add an in-app (bell) notification
    addNotification(item);

    // Pop it on the device right away when the app is in the background.
    // showNativeNotification records the id, so the bell's poll won't repeat
    // it, and it stays quiet when the server already pushed it here.
    if (!isHiddenRef.current) return;
    if (getPermissionStatus() !== 'granted') return;
    showNativeNotification(item);
  }, []);

  /** Toggle message notifications on/off */
  const toggleEnabled = useCallback(() => {
    const next = !enabledRef.current;
    setEnabled(next);
    try { localStorage.setItem(STORAGE_KEY, next.toString()); } catch {}
  }, []);

  /** Request browser notification permission */
  const requestMsgPermission = useCallback(async () => {
    const result = await requestPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    permission,
    enabled,
    notifyNewMessage,
    toggleEnabled,
    requestPermission: requestMsgPermission,
    supported: isNotificationSupported(),
  };
}
