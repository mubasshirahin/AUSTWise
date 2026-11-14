import { useState } from 'react';
import { BellRing, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  isNotificationSupported,
  getPermissionStatus,
  loadSettings,
  requestPermission,
  saveSettings,
  saveSettingsToServer,
} from '../../utils/notificationService';

const DISMISSED_KEY = 'aust-notif-banner-dismissed';

export default function NotificationBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try { return Boolean(localStorage.getItem(DISMISSED_KEY)); } catch { return false; }
  });
  const [enabling, setEnabling] = useState(false);
  const [done, setDone] = useState(() => {
    const settings = loadSettings();
    return settings.enabled && getPermissionStatus() === 'granted';
  });

  if (!isNotificationSupported()) return null;
  if (getPermissionStatus() === 'denied') return null;
  if (dismissed || done) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const handleEnable = async () => {
    setEnabling(true);
    const result = await requestPermission();
    if (result === 'granted') {
      const next = { enabled: true, notifyClass: true, notifyDeadline: true };
      saveSettings(next);
      // Push to the account so other devices see the same prefs.
      saveSettingsToServer(next);
      setDone(true);
    } else {
      handleDismiss();
    }
    setEnabling(false);
  };

  return (
    <div className="animate-fadeIn notif-banner">
      <div className="notif-banner-icon">
        <BellRing size={18} />
      </div>

      <div className="notif-banner-text">
        <p className="notif-banner-title">Never miss a class or deadline</p>
        <p className="notif-banner-helper">
          Enable browser alerts — your browser will ask for <strong>notification permission</strong>, used only to alert you before your next class starts and when assignments are due.
        </p>
      </div>

      <div className="notif-banner-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleEnable}
          disabled={enabling}
        >
          {enabling ? 'Requesting…' : <>Enable <ArrowRight size={12} /></>}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/settings')}
          title="Open notification settings"
        >
          Settings
        </button>
      </div>

      <button
        className="btn btn-ghost btn-icon notif-banner-close"
        onClick={handleDismiss}
        title="Dismiss"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
