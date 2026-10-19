import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import RoleAccessControlCard from './RoleAccessControlCard';

const CHILD_FEATURES = [
  { key: 'feature:dashboard:at-a-glance', label: 'At a glance · Quick Stats' },
  { key: 'feature:dashboard:daily-flow', label: 'Daily Flow' },
  { key: 'feature:dashboard:notices', label: 'Notice Board' },
  { key: 'feature:dashboard:deadlines', label: 'Deadlines' },
];

const CHILD_FEATURES_BY_TAB = {
  stats: CHILD_FEATURES,
  routine: [{ key: 'feature:dashboard:weekly-planner', label: 'Routine Grid' }],
  calendar: [{ key: 'feature:dashboard:semester-view', label: 'Semester View · 14-Weeks View' }],
  exams: [{ key: 'feature:dashboard:zero-hour', label: 'Zero Hour' }],
  attendance: [{ key: 'feature:dashboard:attendance', label: 'Attendance Tracker' }],
};

function ChildAccessRow({ feature, parentEnabled }) {
  const { config, loading, save } = useRoleAccess(feature.key);
  const [showRoles, setShowRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const enabled = config.enabled !== false;
  const toggle = async () => {
    setSaving(true);
    setSaveError('');
    const ok = await save({ ...config, enabled: !enabled });
    if (!ok) setSaveError('Could not save. Check your connection and try again.');
    setSaving(false);
  };

  return <div style={{ border: '1px solid var(--border-primary)', borderRadius: '9px', background: 'var(--bg-card)', overflow: 'hidden', opacity: parentEnabled ? 1 : 0.58 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '9px 10px' }}>
      <span style={{ flex: 1, minWidth: '110px', fontSize: '12px', fontWeight: 650 }}>{feature.label}</span>
      <button type="button" disabled={!parentEnabled} onClick={() => setShowRoles((value) => !value)} aria-expanded={showRoles} className="btn btn-secondary btn-sm" style={{ minHeight: '34px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {showRoles ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Role access
      </button>
      <button type="button" disabled={!parentEnabled || loading || saving} onClick={toggle} aria-pressed={enabled} aria-label={`${enabled ? 'Turn off' : 'Turn on'} ${feature.label}`} className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`} style={{ minHeight: '34px', minWidth: '92px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
        {loading || saving ? <LoaderCircle size={13} className="animate-spin" /> : enabled ? <><Eye size={13} /> On</> : <><EyeOff size={13} /> Off</>}
      </button>
    </div>
    {saveError && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: '0 10px 9px' }}>{saveError}</p>}
    {showRoles && parentEnabled && <div style={{ padding: '0 9px 9px' }}><RoleAccessControlCard pageKey={feature.key} label={feature.label} hideStats /></div>}
  </div>;
}

export function DashboardParentAccessPanel() {
  const { config, loading, save } = useRoleAccess('/');
  const [showRoles, setShowRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const enabled = config.enabled !== false;
  const toggle = async () => {
    setSaving(true);
    setSaveError('');
    const ok = await save({ ...config, enabled: !enabled });
    if (!ok) setSaveError('Could not save. Check your connection and try again.');
    setSaving(false);
  };

  return <section className="glass-card-static" style={{ padding: '16px', border: '1px solid var(--border-primary)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
      <LockKeyhole size={17} style={{ color: 'var(--accent-cyan)' }} />
      <div style={{ flex: 1, minWidth: '160px' }}>
        <h2 style={{ fontSize: '15px', margin: 0 }}>Dashboard Access</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '3px 0 0' }}>Parent access for the dashboard and its individual boxes.</p>
      </div>
      <button type="button" onClick={() => setShowRoles((value) => !value)} aria-expanded={showRoles} className="btn btn-secondary btn-sm" style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {showRoles ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Parent role access
      </button>
      <button type="button" disabled={loading || saving} onClick={toggle} aria-pressed={enabled} className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-rose'}`} style={{ minHeight: '38px', minWidth: '112px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
        {loading || saving ? <LoaderCircle size={14} className="animate-spin" /> : enabled ? <><Eye size={14} /> Turn off</> : <><EyeOff size={14} /> Turn on</>}
      </button>
    </div>
    {saveError && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: '8px 0 0' }}>{saveError}</p>}
    {showRoles && <div style={{ marginTop: '12px' }}><RoleAccessControlCard pageKey="/" label="Dashboard Access" hideStats /></div>}

  </section>;
}

export function DashboardChildAccessPanel({ focusMode = 'stats' }) {
  const { config: parentConfig } = useRoleAccess('/');
  const parentEnabled = parentConfig.enabled !== false;
  const childFeatures = CHILD_FEATURES_BY_TAB[focusMode] || CHILD_FEATURES;

  return <section className="glass-card-static" style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--border-primary)', opacity: parentEnabled ? 1 : 0.58 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '9px' }}>
      <strong style={{ fontSize: '12px' }}>{focusMode === 'stats' ? 'Quick Stats' : focusMode === 'routine' ? 'Routine' : focusMode === 'calendar' ? 'Semester View' : focusMode === 'exams' ? 'Zero Hour' : 'Attendance'} child access</strong>
      <span style={{ color: parentEnabled ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: '11px', fontWeight: 700 }}>{parentEnabled ? 'Parent on' : 'Parent off · children locked'}</span>
    </div>
    <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: 1.45, margin: '0 0 9px' }}>Set access for the selected Dashboard section.</p>
    <div style={{ display: 'grid', gap: '7px' }}>
      {childFeatures.map((feature) => <ChildAccessRow key={feature.key} feature={feature} parentEnabled={parentEnabled} />)}
    </div>
  </section>;
}

export default function DashboardAccessPanel({ focusMode = 'stats' }) {
  return <>
    <DashboardParentAccessPanel />
    <DashboardChildAccessPanel focusMode={focusMode} />
  </>;
}
