import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import RoleAccessControlCard from './RoleAccessControlCard';

const FEATURE_LABELS = {
  cgpagraph: 'CGPA Calculator',
  semestertracker: 'Semester Wise',
  heatmap: 'Dept Heatmap',
  bestworst: 'Best & Worst',
  prereqs: 'Prerequisites',
};

function FeatureControl({ feature, parentEnabled }) {
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

  return <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border-primary)', borderRadius: '10px', background: 'var(--bg-input)', opacity: parentEnabled ? 1 : 0.58 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <strong style={{ flex: 1, minWidth: '120px', fontSize: '12px' }}>{feature.label}</strong>
      <button type="button" disabled={!parentEnabled} onClick={() => setShowRoles((value) => !value)} aria-expanded={showRoles} className="btn btn-secondary btn-sm" style={{ minHeight: '34px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {showRoles ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Role access
      </button>
      <button type="button" disabled={!parentEnabled || loading || saving} onClick={toggle} aria-pressed={enabled} className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`} style={{ minHeight: '34px', minWidth: '92px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
        {loading || saving ? <LoaderCircle size={13} className="animate-spin" /> : enabled ? <><Eye size={13} /> On</> : <><EyeOff size={13} /> Off</>}
      </button>
    </div>
    {saveError && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: '8px 0 0' }}>{saveError}</p>}
    {showRoles && parentEnabled && <RoleAccessControlCard pageKey={feature.key} label={feature.label} hideStats />}
  </div>;
}

export default function AnalyticsAccessPanel({ activeTab }) {
  const { config, loading, save } = useRoleAccess('/analytics');
  const [showRoles, setShowRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const enabled = config.enabled !== false;
  const feature = { key: `feature:analytics:${activeTab}`, label: FEATURE_LABELS[activeTab] || FEATURE_LABELS.cgpagraph };

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
        <h2 style={{ fontSize: '15px', margin: 0 }}>GradeLab Access</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '3px 0 0' }}>Parent access for GradeLab and its selected feature.</p>
      </div>
      <button type="button" onClick={() => setShowRoles((value) => !value)} aria-expanded={showRoles} className="btn btn-secondary btn-sm" style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {showRoles ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Parent role access
      </button>
      <button type="button" disabled={loading || saving} onClick={toggle} aria-pressed={enabled} className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-rose'}`} style={{ minHeight: '38px', minWidth: '112px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
        {loading || saving ? <LoaderCircle size={14} className="animate-spin" /> : enabled ? <><Eye size={14} /> Turn off</> : <><EyeOff size={14} /> Turn on</>}
      </button>
    </div>
    {saveError && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: '8px 0 0' }}>{saveError}</p>}
    {showRoles && <div style={{ marginTop: '12px' }}><RoleAccessControlCard pageKey="/analytics" label="GradeLab Access" hideStats /></div>}
    <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: 1.45, margin: '12px 0 0' }}>A role needs access to GradeLab and to the individual feature. Parent access takes priority and locks the child control when off.</p>
    <FeatureControl feature={feature} parentEnabled={enabled} />
  </section>;
}
