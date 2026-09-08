import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, ShieldX, Eye, EyeOff, Users, Check, X, FileText, RotateCcw, GripVertical } from 'lucide-react';

const ALL_ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'alumni', label: 'Alumni' },
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

const STORAGE_BASE = 'aust-role-access-v2';
const DEFAULT_FEATURE_HIDDEN = ['admin', 'moderator'];
const DEFAULT_STATS_ALLOWED = ['admin', 'moderator'];

function getPageKey(explicit) {
  if (explicit) return `${STORAGE_BASE}:${explicit}`;
  try {
    return `${STORAGE_BASE}:${window.location.pathname}${window.location.search}`;
  } catch { return STORAGE_BASE; }
}

function loadConfig(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.featureHidden) || !Array.isArray(parsed.statsAllowed)) return null;
    return parsed;
  } catch { return null; }
}

function labelFor(id) {
  return ALL_ROLES.find(r => r.id === id)?.label || id;
}

/**
 * RoleAccessControlCard — interactive drag & drop, PER-PAGE isolated.
 * - pageKey diye prottek page er config alada localStorage key e save hoy
 * - Pill ek box theke arek box e move korle sudhu oi page er role change hoy, onno page e affect kore na
 * - Real-time sync sudhu same pageKey er card gulor moddhe
 */
export default function RoleAccessControlCard({ pageKey, storageKey }) {
  const effectiveKey = storageKey || getPageKey(pageKey);
  const [featureHidden, setFeatureHidden] = useState(DEFAULT_FEATURE_HIDDEN);
  const [statsAllowed, setStatsAllowed] = useState(DEFAULT_STATS_ALLOWED);
  const [dragged, setDragged] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [selected, setSelected] = useState(null);

  // Load from storage + server — per-page isolated, reload when pageKey changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try server first (source of truth)
      try {
        const res = await fetch(`/api/role-access?key=${encodeURIComponent(effectiveKey.replace(`${STORAGE_BASE}:`, ''))}`, { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.success && Array.isArray(data.featureHidden) && Array.isArray(data.statsAllowed)) {
          setFeatureHidden(data.featureHidden);
          setStatsAllowed(data.statsAllowed);
          try { localStorage.setItem(effectiveKey, JSON.stringify({ featureHidden: data.featureHidden, statsAllowed: data.statsAllowed })); } catch {}
          return;
        }
      } catch {}
      // Fallback to localStorage
      const cfg = loadConfig(effectiveKey);
      if (!cancelled && cfg) {
        setFeatureHidden(cfg.featureHidden);
        setStatsAllowed(cfg.statsAllowed);
      } else if (!cancelled) {
        setFeatureHidden(DEFAULT_FEATURE_HIDDEN);
        setStatsAllowed(DEFAULT_STATS_ALLOWED);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveKey]);

  // Persist + broadcast — per-page (local + server)
  const persist = useCallback((fh, sa) => {
    try {
      localStorage.setItem(effectiveKey, JSON.stringify({ featureHidden: fh, statsAllowed: sa }));
      window.dispatchEvent(new CustomEvent('role-access-updated', { detail: { featureHidden: fh, statsAllowed: sa, key: effectiveKey, pageKey: effectiveKey } }));
    } catch {}
    // Server persist (admin only) — real enforcement
    fetch('/api/admin/role-access', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageKey: effectiveKey.replace(`${STORAGE_BASE}:`, ''), featureHidden: fh, statsAllowed: sa }),
    }).catch(() => {});
  }, [effectiveKey]);

  // Listen for updates — only for same pageKey (local + WS)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === effectiveKey && e.newValue) {
        try {
          const p = JSON.parse(e.newValue);
          if (p.featureHidden) setFeatureHidden(p.featureHidden);
          if (p.statsAllowed) setStatsAllowed(p.statsAllowed);
        } catch {}
      }
    };
    const onCustom = (e) => {
      if (e.detail?.key !== effectiveKey) return;
      if (e.detail?.featureHidden) setFeatureHidden(e.detail.featureHidden);
      if (e.detail?.statsAllowed) setStatsAllowed(e.detail.statsAllowed);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('role-access-updated', onCustom);
    // WS real-time from server
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'role-access' && data.payload?.pageKey) {
            const k = `${STORAGE_BASE}:${data.payload.pageKey}`;
            if (k === effectiveKey) {
              setFeatureHidden(data.payload.featureHidden);
              setStatsAllowed(data.payload.statsAllowed);
              try { localStorage.setItem(k, JSON.stringify({ featureHidden: data.payload.featureHidden, statsAllowed: data.payload.statsAllowed })); } catch {}
            }
          }
        } catch {}
      };
    } catch {}
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('role-access-updated', onCustom);
      if (ws) try { ws.close(); } catch {}
    };
  }, [effectiveKey]);

  const featureCanUse = ALL_ROLES.filter(r => !featureHidden.includes(r.id)).map(r => r.id);
  const statsHidden = ALL_ROLES.filter(r => !statsAllowed.includes(r.id)).map(r => r.id);

  const handleDrop = (target) => {
    if (!dragged) return;
    const { roleId, source } = dragged;
    if (source === target) { setDragged(null); setDragOver(null); return; }
    let newFH = [...featureHidden];
    let newSA = [...statsAllowed];

    // Feature row
    if (source === 'featureCanUse' && target === 'featureHidden') {
      newFH = [...newFH, roleId];
    } else if (source === 'featureHidden' && target === 'featureCanUse') {
      newFH = newFH.filter(id => id !== roleId);
    } else if (source === 'statsAllowed' && target === 'statsHidden') {
      newSA = newSA.filter(id => id !== roleId);
    } else if (source === 'statsHidden' && target === 'statsAllowed') {
      newSA = [...newSA, roleId];
    } else if (source === 'all' && target === 'featureHidden') {
      if (!newFH.includes(roleId)) newFH = [...newFH, roleId];
    } else if (source === 'all' && target === 'featureCanUse') {
      newFH = newFH.filter(id => id !== roleId);
    } else if (source === 'all' && target === 'statsAllowed') {
      if (!newSA.includes(roleId)) newSA = [...newSA, roleId];
    } else if (source === 'all' && target === 'statsHidden') {
      newSA = newSA.filter(id => id !== roleId);
    } else {
      // Cross-row moves: allow any pill to be dropped into any box, interpret as move to that box's set
      if (target === 'featureHidden' && !newFH.includes(roleId)) newFH = [...newFH, roleId];
      if (target === 'featureCanUse') newFH = newFH.filter(id => id !== roleId);
      if (target === 'statsAllowed' && !newSA.includes(roleId)) newSA = [...newSA, roleId];
      if (target === 'statsHidden') newSA = newSA.filter(id => id !== roleId);
    }

    setFeatureHidden(newFH);
    setStatsAllowed(newSA);
    persist(newFH, newSA);
    setDragged(null);
    setDragOver(null);
  };

  const handleReset = () => {
    setFeatureHidden(DEFAULT_FEATURE_HIDDEN);
    setStatsAllowed(DEFAULT_STATS_ALLOWED);
    persist(DEFAULT_FEATURE_HIDDEN, DEFAULT_STATS_ALLOWED);
  };

  const moveDirect = (roleId, source, target) => {
    let newFH = [...featureHidden];
    let newSA = [...statsAllowed];
    if (source === 'featureCanUse' && target === 'featureHidden') newFH = [...newFH, roleId];
    else if (source === 'featureHidden' && target === 'featureCanUse') newFH = newFH.filter(id => id !== roleId);
    else if (source === 'statsAllowed' && target === 'statsHidden') newSA = newSA.filter(id => id !== roleId);
    else if (source === 'statsHidden' && target === 'statsAllowed') newSA = [...newSA, roleId];
    else {
      if (target === 'featureHidden' && !newFH.includes(roleId)) newFH = [...newFH, roleId];
      if (target === 'featureCanUse') newFH = newFH.filter(id => id !== roleId);
      if (target === 'statsAllowed' && !newSA.includes(roleId)) newSA = [...newSA, roleId];
      if (target === 'statsHidden') newSA = newSA.filter(id => id !== roleId);
    }
    setFeatureHidden(newFH);
    setStatsAllowed(newSA);
    persist(newFH, newSA);
  };

  const Pill = ({ roleId, source, color }) => {
    const label = labelFor(roleId);
    const isDragging = dragged?.roleId === roleId && dragged?.source === source;
    const isSelected = selected?.roleId === roleId && selected?.source === source;
    return (
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', roleId);
          e.dataTransfer.effectAllowed = 'move';
          setDragged({ roleId, source });
          setSelected(null);
        }}
        onDragEnd={() => { setDragged(null); setDragOver(null); }}
        onClick={(e) => {
          e.stopPropagation();
          // Click = select pill, next click on target box will place it instantly
          // If already selected, deselect. If click same pill again, quick toggle to opposite in same row
          if (isSelected) {
            setSelected(null);
            return;
          }
          // Select this pill
          setSelected({ roleId, source });
          // For single-click instant toggle (fast): also allow double-click feel — if user clicks pill, instantly move to opposite in same row
          // To keep both behaviors, we do NOT auto-move here; user must click target box.
          // But for convenience, if user clicks pill and not box, we keep it selected (highlighted) until box click.
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          // Double click = instant opposite move
          if (source === 'featureCanUse') moveDirect(roleId, source, 'featureHidden');
          else if (source === 'featureHidden') moveDirect(roleId, source, 'featureCanUse');
          else if (source === 'statsAllowed') moveDirect(roleId, source, 'statsHidden');
          else if (source === 'statsHidden') moveDirect(roleId, source, 'statsAllowed');
          setSelected(null);
        }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          opacity: isDragging ? 0.4 : 1,
          transform: isSelected ? 'scale(1.05)' : isDragging ? 'scale(0.95)' : 'scale(1)',
          transition: 'all 0.12s',
          border: isSelected ? '2px solid var(--accent-blue)' : '1px solid transparent',
          boxShadow: isSelected ? '0 0 0 2px var(--accent-blue-glow)' : 'none',
          ...color,
        }}
        title="Click to select — then click target box to place instantly (double-click for quick toggle)"
      >
        <GripVertical size={10} style={{ opacity: 0.5 }} />
        {label}
      </span>
    );
  };

  const DropBox = ({ id, isOver, children, style }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(id); }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => { e.preventDefault(); handleDrop(id); }}
      onClick={() => {
        // Click on box: if a pill is selected, drop it here instantly
        if (selected) {
          const { roleId, source } = selected;
          if (source !== id) moveDirect(roleId, source, id);
          setSelected(null);
          setDragged(null);
          setDragOver(null);
        }
      }}
      style={{
        minHeight: '56px',
        borderRadius: '10px',
        padding: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignContent: 'flex-start',
        transition: 'all 0.12s',
        cursor: selected ? 'copy' : 'default',
        ...style,
        ...(isOver ? { transform: 'scale(1.01)', boxShadow: '0 0 0 2px var(--accent-blue) inset' } : {}),
        ...(selected ? { boxShadow: '0 0 0 1px var(--accent-blue) inset' } : {}),
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="glass-card" style={{ padding: '16px', marginTop: '20px', border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Role Access Control — Drag & Drop</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Pill drag kore ek box theke arek box e nin — real-time sob page e update • Server: <code style={{ fontSize: '10px', background: 'var(--bg-input)', padding: '1px 4px', borderRadius: '4px' }}>requireRole('admin','moderator')</code>
            {' '}<span style={{ opacity: 0.7 }}>• server/middleware.mjs:66</span>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 10px', borderRadius: '999px' }}
          title="Reset to default (admin/moderator only)"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* ── Feature Page Access ── */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <FileText size={12} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)' }}>
            Feature Page — Cover Generator
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>drag between Can Use ↔ Hidden</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: dragOver === 'featureCanUse' ? 'var(--accent-blue-glow)' : 'var(--accent-blue-glow, rgba(59,130,246,0.08))', border: `1px solid ${dragOver === 'featureCanUse' ? 'var(--accent-blue)' : 'var(--accent-blue)'}`, borderRadius: '10px', padding: '10px', opacity: dragOver === 'featureCanUse' ? 1 : 0.95 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-blue)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Eye size={12} /> <Check size={12} /> Can Use Feature ({featureCanUse.length})
            </div>
            <DropBox id="featureCanUse" isOver={dragOver === 'featureCanUse'} style={{ background: 'transparent', border: '1px dashed transparent' }}>
              {featureCanUse.map(id => (
                <Pill key={id} roleId={id} source="featureCanUse" color={{ background: 'var(--accent-blue)', color: '#fff' }} />
              ))}
              {featureCanUse.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px' }}>Empty — drag here</span>}
            </DropBox>
            <div style={{ fontSize: '10px', color: 'var(--accent-blue)', opacity: 0.85, marginTop: '6px' }}>Era cover form + live preview + PDF/PNG export use korte pare</div>
          </div>
          <div style={{ background: dragOver === 'featureHidden' ? 'var(--bg-card)' : 'var(--bg-input)', border: `1px dashed ${dragOver === 'featureHidden' ? 'var(--accent-blue)' : 'var(--border-primary)'}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-tertiary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <EyeOff size={12} /> <X size={10} /> Feature Hidden ({featureHidden.length}) — Admin View
            </div>
            <DropBox id="featureHidden" isOver={dragOver === 'featureHidden'} style={{ background: 'transparent', border: '1px dashed transparent' }}>
              {featureHidden.map(id => (
                <Pill key={id} roleId={id} source="featureHidden" color={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-tertiary)' }} />
              ))}
              {featureHidden.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px' }}>Empty — drag here</span>}
            </DropBox>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>Era feature er bodole admin stats (6 cards) dekhe</div>
          </div>
        </div>
      </div>

      {/* ── Admin Stats Access ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', opacity: 0.95 }}>
        <div style={{ background: dragOver === 'statsAllowed' ? 'var(--accent-emerald-glow)' : 'var(--accent-emerald-glow)', border: `1px solid ${dragOver === 'statsAllowed' ? 'var(--accent-emerald)' : 'var(--accent-emerald)'}`, borderRadius: '10px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShieldCheck size={14} /> <Eye size={12} /> Stats Access ({statsAllowed.length}) — Admin Only
          </div>
          <DropBox id="statsAllowed" isOver={dragOver === 'statsAllowed'} style={{ background: 'transparent', border: '1px dashed transparent' }}>
            {statsAllowed.map(id => (
              <Pill key={id} roleId={id} source="statsAllowed" color={{ background: 'var(--accent-emerald)', color: '#fff' }} />
            ))}
            {statsAllowed.length === 0 && <span style={{ fontSize: '11px', color: 'var(--accent-emerald)', padding: '4px' }}>Empty — drag here</span>}
          </DropBox>
          <div style={{ fontSize: '10px', color: 'var(--accent-emerald)', opacity: 0.8, marginTop: '6px' }}>Shudhu ei roles — requireRole(...)</div>
        </div>
        <div style={{ background: dragOver === 'statsHidden' ? 'var(--accent-rose-glow)' : 'var(--accent-rose-glow)', border: `1px solid ${dragOver === 'statsHidden' ? 'var(--accent-rose)' : 'var(--accent-rose)'}`, borderRadius: '10px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-rose)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShieldX size={14} /> <EyeOff size={12} /> Stats Hidden ({statsHidden.length})
          </div>
          <DropBox id="statsHidden" isOver={dragOver === 'statsHidden'} style={{ background: 'transparent', border: '1px dashed transparent' }}>
            {statsHidden.map(id => (
              <Pill key={id} roleId={id} source="statsHidden" color={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)' }} />
            ))}
            {statsHidden.length === 0 && <span style={{ fontSize: '11px', color: 'var(--accent-rose)', padding: '4px' }}>Empty — drag here</span>}
          </DropBox>
          <div style={{ fontSize: '10px', color: 'var(--accent-rose)', opacity: 0.8, marginTop: '6px' }}>Era stats dekte pare na — public /api/cover-stats only</div>
        </div>
      </div>

      <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px dashed var(--border-primary)', fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Logic:</strong> <code>isAdmin = hasRole(...statsAllowed)</code> →{' '}
        <code>isAdmin ? &lt;Stats 6 cards&gt; : &lt;Cover Form&gt;</code>. Real-time: pill move korle <code>localStorage:{effectiveKey}</code> update hoy, sudhu oi page e sync hoy (per-page isolated). CoverPageGeneratorPage eo ei config read kore gate change kore.
      </div>
    </div>
  );
}
