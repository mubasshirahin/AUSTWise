import { useState } from 'react';
import { Target, Plus } from 'lucide-react';

// ── Sub-navigation ───────────────────────────────────────────────────────────

export function LpSubnav({ view, onChange }) {
  const views = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'goals',     label: 'Goals' },
    { id: 'habits',    label: 'Habits' },
    { id: 'timeline',  label: 'Timeline' },
    { id: 'ledger',    label: 'Ledger' },
  ];
  return (
    <div className="lp-subnav" role="tablist" aria-label="Life Planner sections">
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          className={`lp-subnav-btn${view === v.id ? ' active' : ''}`}
          onClick={() => onChange(v.id)}
        >
          {v.label}
        </button>
      ))}
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

export function LpStartEmpty({ onStart, onExample }) {
  return (
    <div className="lp-empty">
      <Target size={44} />
      <h4>Start your plan</h4>
      <p>Break your goals into phases, tasks and steps — then track habits and money alongside them.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onStart}>
          <Plus size={14} style={{ marginRight: 4 }} /> New Goal
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onExample}>
          Load example plan
        </button>
      </div>
    </div>
  );
}

// ── Small modal shell ────────────────────────────────────────────────────────

export function LpModal({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal glass-card-static"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: wide ? '640px' : '420px', width: '92%', padding: 'var(--sp-5)', margin: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 'bold' }}>{title}</h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────────────────────────────

export function LpConfirm({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <LpModal title={title} onClose={onCancel}>
      <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </LpModal>
  );
}

// ── useConfirm hook helper ───────────────────────────────────────────────────

export function useConfirmState() {
  return useState(null); // { title, message, confirmLabel, onConfirm }
}
