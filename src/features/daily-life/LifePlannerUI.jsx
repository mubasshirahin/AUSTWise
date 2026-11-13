import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Target, Flag, CalendarDays, LayoutDashboard, BookOpen, Network, CalendarRange, Sparkles, X } from 'lucide-react';

// ── Date input — always shows dd/mm/yy, stores ISO (yyyy-mm-dd) ──────────────

/** ISO date key → dd/mm/yy display string. */
function isoToDmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

/** dd/mm/yy (or dd/mm/yyyy) display string → ISO date key, or null if invalid. */
function dmyToIso(text) {
  let s = String(text || '').trim();
  if (/^\d{6}$/.test(s)) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
  else if (/^\d{8}$/.test(s)) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
  const m = /^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/**
 * Drop-in replacement for `<input type="date">` that renders dd/mm/yy instead of
 * the browser-locale format (mm/dd/yyyy). Typing accepts 21/08/26 or 21/08/2026;
 * the calendar button opens the native picker. `value`/`onChange` stay ISO keys.
 */
export function LpDateInput({
  value, onChange, className = 'input', style, title, required, autoFocus,
  id, name, placeholder = 'dd/mm/yy', 'aria-label': ariaLabel,
}) {
  const [text, setText] = useState(() => isoToDmy(value));
  const focusedRef = useRef(false);
  const nativeRef = useRef(null);

  useEffect(() => {
    if (!focusedRef.current) setText(isoToDmy(value));
  }, [value]);

  const commit = (raw) => {
    const next = String(raw || '').trim();
    if (!next) { setText(''); onChange(''); return; }
    const iso = dmyToIso(next);
    if (iso) { setText(isoToDmy(iso)); onChange(iso); }
    else setText(isoToDmy(value)); // invalid → revert to last good value
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };

  return (
    <span className="lp-date-input" style={style}>
      <input
        id={id}
        name={name}
        type="text"
        className={className}
        value={text}
        placeholder={placeholder}
        title={title}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={(e) => { focusedRef.current = false; commit(e.target.value); }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const trimmed = raw.trim();
          if (!trimmed) { onChange(''); return; }
          const iso = dmyToIso(trimmed);
          if (iso) onChange(iso);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); e.currentTarget.blur(); }
        }}
      />
      <button type="button" className="lp-date-pick" onClick={openPicker} tabIndex={-1} aria-label="Open calendar">
        <CalendarDays size={13} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="lp-date-native"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setText(isoToDmy(e.target.value)); }}
      />
    </span>
  );
}

// ── Sub-navigation ───────────────────────────────────────────────────────────

export function LpSubnav({ view, onChange }) {
  const views = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'goals',     label: 'Milestones', icon: Flag },
    { id: 'courses',   label: 'Courses',   icon: BookOpen },
    { id: 'mindmap',   label: 'Mindmap',   icon: Network },
    { id: 'timeline',  label: 'Timeline',  icon: CalendarRange },
    { id: 'automate',  label: 'Automate',  icon: Sparkles },
  ];
  return (
    <div className="lp-subnav" role="tablist" aria-label="Life Planner sections">
      {views.map((v) => {
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={`lp-subnav-btn${view === v.id ? ' active' : ''}`}
            onClick={() => onChange(v.id)}
          >
            <Icon size={14} strokeWidth={2.1} aria-hidden="true" />
            <span>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Progress ring ────────────────────────────────────────────────────────────

export function LpRing({ pct, size = 96, color = 'var(--accent-amber)', label }) {
  return (
    <div
      className="lp-ring"
      style={{ '--pct': Math.max(0, Math.min(100, pct)), '--ring': color, width: size, height: size }}
      role="img"
      aria-label={`${label || 'Progress'}: ${pct}%`}
    >
      <span className="lp-ring-value">{pct}%</span>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

export function LpBar({ pct, color }) {
  return (
    <div className="lp-progress-track">
      <div
        className="lp-progress-fill"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color || undefined }}
      />
    </div>
  );
}

// ── Type badges ──────────────────────────────────────────────────────────────

export function LpTypeBadges({ types }) {
  return (types || []).map((t) => (
    <span key={t} className={`lp-badge ${t === 'goal' ? 'lp-badge-amber' : t === 'milestone' ? 'lp-badge-purple' : 'lp-badge-emerald'}`}>
      {t === 'goal' ? 'Goal' : t === 'milestone' ? 'Milestone' : 'Habit'}
    </span>
  ));
}

// ── Stat card ────────────────────────────────────────────────────────────────

export function LpStat({ icon, tone = '', value, label }) {
  return (
    <div className="lp-stat">
      <span className={`lp-stat-icon ${tone}`}>{icon}</span>
      <div>
        <div className="lp-stat-value">{value}</div>
        <div className="lp-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function LpEmpty({ icon: Icon = Target, title, hint, action }) {
  return (
    <div className="lp-empty">
      <Icon size={40} />
      <h4>{title}</h4>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

// ── Small modal shell ────────────────────────────────────────────────────────

export function LpModal({ title, onClose, children, wide = false }) {
  // Portalled to <body> so the overlay covers the whole viewport instead of the
  // (transformed) page; the .lp-widget wrapper keeps the planner's scoped styles.
  return createPortal(
    <div className="lp-widget lp-modal-portal">
    <div className="modal-overlay lp-modal-overlay" onClick={onClose}>
      <div
        className={`modal lp-modal${wide ? ' is-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="lp-modal-head">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label="Close">
            <X size={12} />
          </button>
        </div>
        {children}
      </div>
    </div>
    </div>,
    document.body,
  );
}

// ── Confirm dialog ───────────────────────────────────────────────────────────

export function LpConfirm({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <LpModal title={title} onClose={onCancel}>
      <p className="lp-modal-text">{message}</p>
      <div className="lp-modal-actions">
        <button type="button" className="btn btn-danger btn-sm" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </LpModal>
  );
}

// ── useConfirm hook helper ───────────────────────────────────────────────────

export function useConfirmState() {
  return useState(null); // { title, message, confirmLabel, onConfirm }
}
