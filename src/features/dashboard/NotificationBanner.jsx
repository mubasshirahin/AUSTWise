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
    <div
      className="animate-fadeIn notif-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: 'color-mix(in srgb, var(--accent-blue) 6%, var(--bg-card))',
        border: '1px solid color-mix(in srgb, var(--accent-blue) 20%, var(--border-primary))',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '4px',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: 'var(--accent-blue-glow)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <BellRing size={18} style={{ color: 'var(--accent-blue)' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
          Never miss a class or deadline
        </p>
        <p className="notif-banner-helper" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Enable browser alerts — your browser will ask for <strong>notification permission</strong>, used only to alert you before your next class starts and when assignments are due.
        </p>
      </div>

      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleEnable}
          disabled={enabling}
          style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
        >
          {enabling ? 'Requesting…' : <>Enable <ArrowRight size={12} /></>}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/settings')}
          style={{ fontSize: '11px', padding: '6px 8px' }}
          title="Open notification settings"
        >
          Settings
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleDismiss}
          style={{ width: '28px', height: '28px', padding: 0 }}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
