import { useState } from 'react';
import { Shield, ShieldCheck, ShieldX, Eye, EyeOff, Check, X, RotateCcw, GripVertical, Loader2, AlertTriangle } from 'lucide-react';
import { useRoleAccess } from '../../hooks/useRoleAccess';

const ALL_ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'alumni_with_carry', label: 'Alumni with Carry' },
  { id: 'readd', label: 'Re-add' },
  { id: 'cr', label: 'CR' },
  { id: 'sr', label: 'SR' },
  { id: 'senior', label: 'Senior' },
  { id: 'vp', label: 'VP' },
  { id: 'gs', label: 'GS' },
  { id: 'bus_coordinator', label: 'Bus Coordinator' },
  { id: 'guest', label: 'Guest' },
  { id: 'clubs_representative', label: 'Clubs Representative' },
  { id: 'help_desk', label: 'Help Desk' },
  { id: 'banned', label: 'Banned' },
  { id: 'moderator', label: 'Moderator' },
  { id: 'admin', label: 'Admin' },
];

const DEFAULT_STATS_ALLOWED = ['admin', 'moderator'];

function labelFor(id) {
  return ALL_ROLES.find((r) => r.id === id)?.label || id;
}

// ── Presentational pieces declared at module scope (never re-created during
//    render, so React never remounts them and lint stays happy) ──

function RolePill({ roleId, color, isDragging, isSelected, onDragStart, onDragEnd, onClick, onDoubleClick }) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title="Drag to a box, or click then click the target box (double-click for a quick toggle)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'grab',
        userSelect: 'none',
        opacity: isDragging ? 0.4 : 1,
        transform: isSelected ? 'scale(1.05)' : isDragging ? 'scale(0.95)' : 'scale(1)',
        transition: 'all 0.12s',
        border: isSelected ? '2px solid var(--accent-blue)' : '1px solid transparent',
        boxShadow: isSelected ? '0 0 0 2px var(--accent-blue-glow)' : 'none',
        ...color,
      }}
    >
      <GripVertical size={10} style={{ opacity: 0.5 }} />
      {labelFor(roleId)}
    </span>
  );
}

function DropBox({ isOver, isArmed, onDragOver, onDragLeave, onDrop, onClick, style, children }) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      style={{
        minHeight: '56px',
        borderRadius: '10px',
        padding: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignContent: 'flex-start',
        transition: 'all 0.12s',
        cursor: isArmed ? 'copy' : 'default',
        ...style,
        ...(isOver ? { transform: 'scale(1.01)', boxShadow: '0 0 0 2px var(--accent-blue) inset' } : {}),
        ...(isArmed ? { boxShadow: '0 0 0 1px var(--accent-blue) inset' } : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * RoleAccessControlCard — drag & drop role access for ONE page.
 *
 * The card, the page gate (MastheadAccessControl) and every other device all
 * read/write the SAME config through `useRoleAccess`, so a drop here is live
 * everywhere: locally, in other tabs, and on other devices (server broadcast).
 *
 *   - "Who can open this page"        → featureHidden (Blocked list)
 *   - "Who sees the admin/stats view" → statsAllowed
 *   - Drag a pill to another box, or click a pill once then click the target
 *     box (works on touch where native drag is unavailable).
 */
export default function RoleAccessControlCard({ pageKey, label, hideStats = false }) {
  const { config, loading, save, key } = useRoleAccess(pageKey);
  const featureHidden = config.featureHidden || [];
  const statsAllowed = config.statsAllowed || DEFAULT_STATS_ALLOWED;

  const [dragged, setDragged] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error

  const featureCanUse = ALL_ROLES.filter((r) => !featureHidden.includes(r.id)).map((r) => r.id);
  const statsHidden = ALL_ROLES.filter((r) => !statsAllowed.includes(r.id)).map((r) => r.id);

  const commit = async (nextFH, nextSA) => {
    setDragged(null);
    setDragOver(null);
    setSelected(null);
    setStatus('saving');
    const ok = await save({ featureHidden: nextFH, statsAllowed: nextSA });
    setStatus(ok ? 'saved' : 'error');
    if (ok) setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800);
  };

  // A pill dropped on a box is interpreted as "put it in that box". The target
  // box decides which dimension changes (page access vs stats view), so
  // cross-row moves work too.
  const computeMove = (roleId, target) => {
    let newFH = featureHidden;
    let newSA = statsAllowed;
    if (target === 'featureHidden') {
      if (!newFH.includes(roleId)) newFH = [...newFH, roleId];
    } else if (target === 'featureCanUse') {
      newFH = newFH.filter((id) => id !== roleId);
    } else if (target === 'statsAllowed') {
      if (!newSA.includes(roleId)) newSA = [...newSA, roleId];
    } else if (target === 'statsHidden') {
      newSA = newSA.filter((id) => id !== roleId);
    }
    return { fh: newFH, sa: newSA };
  };

  const handleDrop = (target) => {
    if (!dragged) return;
    const { roleId, source } = dragged;
    if (source === target) { setDragged(null); setDragOver(null); return; }
    const { fh, sa } = computeMove(roleId, target);
    commit(fh, sa);
  };

  const moveDirect = (roleId, source, target) => {
    if (source === target) return;
    const { fh, sa } = computeMove(roleId, target);
    commit(fh, sa);
  };

  const handleReset = () => commit([], DEFAULT_STATS_ALLOWED);

  const boxHandlers = (id) => ({
    onDragOver: (e) => { e.preventDefault(); setDragOver(id); },
    onDragLeave: () => setDragOver((cur) => (cur === id ? null : cur)),
    onDrop: (e) => { e.preventDefault(); handleDrop(id); },
    onClick: () => {
      if (selected && selected.source !== id) moveDirect(selected.roleId, selected.source, id);
      if (selected) { setSelected(null); setDragged(null); setDragOver(null); }
    },
  });

  const pillHandlers = (roleId, source) => ({
    onDragStart: (e) => {
      try {
        e.dataTransfer.setData('text/plain', roleId);
        e.dataTransfer.effectAllowed = 'move';
      } catch { /* some browsers restrict dataTransfer */ }
      setDragged({ roleId, source });
      setSelected(null);
    },
    onDragEnd: () => { setDragged(null); setDragOver(null); },
    onClick: (e) => {
      e.stopPropagation();
      setSelected((cur) => (cur?.roleId === roleId && cur?.source === source ? null : { roleId, source }));
    },
    onDoubleClick: (e) => {
      e.stopPropagation();
      if (source === 'featureCanUse') moveDirect(roleId, source, 'featureHidden');
      else if (source === 'featureHidden') moveDirect(roleId, source, 'featureCanUse');
      else if (source === 'statsAllowed') moveDirect(roleId, source, 'statsHidden');
      else if (source === 'statsHidden') moveDirect(roleId, source, 'statsAllowed');
    },
  });

  const statusBadge = status === 'saving'
    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}><Loader2 size={12} className="animate-spin" /> Saving…</span>
    : status === 'saved'
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)' }}><Check size={12} /> Saved · live everywhere</span>
      : status === 'error'
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)' }}><AlertTriangle size={12} /> Save failed — retry</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>Changes apply instantly for every user</span>;

  return (
    <div className="glass-card" style={{ padding: '16px', marginTop: '20px', border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Role Access — {label || key}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {statusBadge}
          </div>
        </div>
        <button
          onClick={handleReset}
          className="btn btn-secondary btn-sm"
          disabled={loading || status === 'saving'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 10px', borderRadius: '999px' }}
          title="Reset — nobody blocked, admins/moderators see stats"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* ── Page access ── */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <Shield size={12} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)' }}>
            Page access
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>drag between Can open ↔ Blocked</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'var(--accent-blue-glow, rgba(59,130,246,0.08))', border: '1px solid var(--accent-blue)', borderRadius: '10px', padding: '10px', opacity: dragOver === 'featureCanUse' ? 1 : 0.95 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-blue)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Eye size={12} /> <Check size={12} /> Can open this page ({featureCanUse.length})
            </div>
            <DropBox isOver={dragOver === 'featureCanUse'} isArmed={!!selected} style={{ background: 'transparent', border: '1px dashed transparent' }} {...boxHandlers('featureCanUse')}>
              {featureCanUse.map((id) => (
                <RolePill key={id} roleId={id} color={{ background: 'var(--accent-blue)', color: '#fff' }}
                  isDragging={dragged?.roleId === id && dragged?.source === 'featureCanUse'}
                  isSelected={selected?.roleId === id && selected?.source === 'featureCanUse'}
                  {...pillHandlers(id, 'featureCanUse')} />
              ))}
              {featureCanUse.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px' }}>Empty — drag here</span>}
            </DropBox>
            <div style={{ fontSize: '10px', color: 'var(--accent-blue)', opacity: 0.85, marginTop: '6px' }}>These roles can open {key} and use everything on it.</div>
          </div>
          <div style={{ background: 'var(--bg-input)', border: `1px dashed ${dragOver === 'featureHidden' ? 'var(--accent-blue)' : 'var(--border-primary)'}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-tertiary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <EyeOff size={12} /> <X size={10} /> Blocked ({featureHidden.length})
            </div>
            <DropBox isOver={dragOver === 'featureHidden'} isArmed={!!selected} style={{ background: 'transparent', border: '1px dashed transparent' }} {...boxHandlers('featureHidden')}>
              {featureHidden.map((id) => (
                <RolePill key={id} roleId={id} color={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-tertiary)' }}
                  isDragging={dragged?.roleId === id && dragged?.source === 'featureHidden'}
                  isSelected={selected?.roleId === id && selected?.source === 'featureHidden'}
                  {...pillHandlers(id, 'featureHidden')} />
              ))}
              {featureHidden.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px' }}>Empty — nobody blocked</span>}
            </DropBox>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>These roles get &ldquo;You don&apos;t have access&rdquo; on {key}.</div>
          </div>
        </div>
      </div>

      {/* ── Stats / admin view ── */}
      {!hideStats && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', opacity: 0.95 }}>
        <div style={{ background: 'var(--accent-emerald-glow)', border: '1px solid var(--accent-emerald)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShieldCheck size={14} /> <Eye size={12} /> Stats view allowed ({statsAllowed.length})
          </div>
          <DropBox isOver={dragOver === 'statsAllowed'} isArmed={!!selected} style={{ background: 'transparent', border: '1px dashed transparent' }} {...boxHandlers('statsAllowed')}>
            {statsAllowed.map((id) => (
              <RolePill key={id} roleId={id} color={{ background: 'var(--accent-emerald)', color: '#fff' }}
                isDragging={dragged?.roleId === id && dragged?.source === 'statsAllowed'}
                isSelected={selected?.roleId === id && selected?.source === 'statsAllowed'}
                {...pillHandlers(id, 'statsAllowed')} />
            ))}
            {statsAllowed.length === 0 && <span style={{ fontSize: '11px', color: 'var(--accent-emerald)', padding: '4px' }}>Empty — drag here</span>}
          </DropBox>
          <div style={{ fontSize: '10px', color: 'var(--accent-emerald)', opacity: 0.8, marginTop: '6px' }}>These roles see the admin/stats view instead of the normal one.</div>
        </div>
        <div style={{ background: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: '10px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-rose)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShieldX size={14} /> <EyeOff size={12} /> Stats view hidden ({statsHidden.length})
          </div>
          <DropBox isOver={dragOver === 'statsHidden'} isArmed={!!selected} style={{ background: 'transparent', border: '1px dashed transparent' }} {...boxHandlers('statsHidden')}>
            {statsHidden.map((id) => (
              <RolePill key={id} roleId={id} color={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)' }}
                isDragging={dragged?.roleId === id && dragged?.source === 'statsHidden'}
                isSelected={selected?.roleId === id && selected?.source === 'statsHidden'}
                {...pillHandlers(id, 'statsHidden')} />
            ))}
            {statsHidden.length === 0 && <span style={{ fontSize: '11px', color: 'var(--accent-rose)', padding: '4px' }}>Empty — drag here</span>}
          </DropBox>
          <div style={{ fontSize: '10px', color: 'var(--accent-rose)', opacity: 0.8, marginTop: '6px' }}>These roles see the normal page, not the stats view.</div>
        </div>
      </div>}

      <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px dashed var(--border-primary)', fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Live:</strong> a drop is saved to the server and broadcast over the shared WebSocket — every connected user&apos;s page updates immediately, no refresh. Admins &amp; moderators are never blocked (safety).
      </div>
    </div>
  );
}
