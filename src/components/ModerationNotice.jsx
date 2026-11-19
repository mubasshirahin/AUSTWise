import { useEffect, useState } from 'react';
import { ShieldAlert, Ban } from 'lucide-react';
import { onRealtimeMessage } from '../utils/liveStore';
import './ModerationNotice.css';

/**
 * Site-wide gali warning / temp-ban notice. Listens to:
 *  - any fetch that returns 422 { profanity } or 403 { tempBanned }
 *  - the `moderation` realtime message (chat / Shadow Chat)
 */

const EVENT = 'aust-moderation';
export const emitModeration = (detail) => window.dispatchEvent(new CustomEvent(EVENT, { detail }));

let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await orig(...args);
    if (res.status === 422 || res.status === 403) {
      res.clone().json().then((data) => {
        if (data?.profanity) emitModeration({ level: data.level, banUntil: data.banUntil });
        else if (data?.tempBanned) emitModeration({ level: 'banned', banUntil: data.banUntil });
      }).catch(() => {});
    }
    return res;
  };
}

function formatLeft(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(m, 1)}m`;
}

export default function ModerationNotice() {
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    patchFetch();
    const onEvt = (e) => setNotice(e.detail);
    window.addEventListener(EVENT, onEvt);
    const off = onRealtimeMessage('moderation', (p) => emitModeration(p));
    return () => { window.removeEventListener(EVENT, onEvt); off?.(); };
  }, []);

  const banned = notice?.banUntil > now;
  useEffect(() => {
    if (!banned) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [banned]);

  if (!notice) return null;

  if (banned) {
    return (
      <div className="mod-overlay" role="alertdialog" aria-modal="true">
        <div className="mod-card">
          <span className="mod-icon mod-icon--ban"><Ban size={20} /></span>
          <h2 className="mod-title">Account temporarily banned</h2>
          <p className="mod-text">
            Because of abusive language, you can't post, comment or send messages until <strong>{new Date(notice.banUntil).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
          </p>
          <p className="mod-meta">Time left: {formatLeft(notice.banUntil - now)}</p>
        </div>
      </div>
    );
  }

  const isWarning = notice.level === 'warning';
  return (
    <div className="mod-overlay" role="alertdialog" aria-modal="true" onClick={() => setNotice(null)}>
      <div className="mod-card" onClick={(e) => e.stopPropagation()}>
        <span className="mod-icon"><ShieldAlert size={20} /></span>
        <h2 className="mod-title">{isWarning ? 'Warning: abusive language is not allowed' : 'Abusive language is not allowed'}</h2>
        <p className="mod-text">
          {isWarning
            ? 'Your message was not posted. Next time you will be banned for 2 days, then 10 days.'
            : 'Your message was not sent. Please keep your language clean.'}
        </p>
        <button type="button" className="mod-btn" onClick={() => setNotice(null)}>Got it</button>
      </div>
    </div>
  );
}
