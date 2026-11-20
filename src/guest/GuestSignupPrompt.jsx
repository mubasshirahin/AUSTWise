import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Lock, X } from 'lucide-react';
import { GUEST_BLOCKED_EVENT } from './guestSandbox';
import './GuestSignupPrompt.css';

// Shown when a guest tries to change anything (add a class, post, save...).
// Guest visits are a view-only demo; real actions need an AUST account.
// Desktop: small centred card. Mobile: bottom sheet.
export default function GuestSignupPrompt() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onBlocked = () => setOpen(true);
    window.addEventListener(GUEST_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(GUEST_BLOCKED_EVENT, onBlocked);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="gsp-overlay guest-signup-modal" onClick={() => setOpen(false)}>
      <div
        className="gsp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gsp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="gsp-handle" aria-hidden="true" />
        <div className="gsp-head">
          <span className="gsp-icon"><Lock size={13} /></span>
          <h3 id="gsp-title" className="gsp-title">Sign up to continue</h3>
          <button type="button" className="gsp-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <p className="gsp-text">This is a demo. Create an AUST account to add, edit or post.</p>
        <div className="gsp-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Not now</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setOpen(false); navigate('/login'); }}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
