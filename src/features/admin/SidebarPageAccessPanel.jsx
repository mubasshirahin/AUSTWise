import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import RoleAccessControlCard from './RoleAccessControlCard';
import { MANAGED_FEATURES } from './FeatureAccessPanel';

export const ADMIN_PAGE_CONFIG = {
  '/analytics': { label: 'GradeLab', featurePage: 'analytics' },
  '/daily-life': { label: 'Daily Life', featurePage: 'daily life' },
  '/campus': { label: 'InsideAUST', featurePage: 'insideaust' },
  '/vault': { label: 'Resource Vault', featurePage: 'vault' },
  '/notebook': { label: 'Notebook', featurePage: 'notebook' },
  '/community': { label: 'Community', featurePage: 'community' },
  '/messages': { label: 'ConnectBox', featurePage: 'messages' },
  '/productivity': { label: 'Productivity', featurePage: 'productivity' },
  '/marketplace': { label: 'Marketplace', featurePage: 'marketplace' },
  '/chill-zone': { label: 'DownTime', featurePage: 'chill zone' },
  '/shadow': { label: 'Shadow', featurePage: 'shadow' },
  '/settings': { label: 'Settings', featurePage: 'settings' },
  '/question-bank-analyzer': { label: 'Question Bank Analyzer', featurePage: 'question bank analyzer' },
};

function ChildFeature({ feature, parentEnabled }) {
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
      <span style={{ flex: 1, minWidth: '120px', fontSize: '12px', fontWeight: 650 }}>{feature.label}</span>
      <button type="button" disabled={!parentEnabled} onClick={() => setShowRoles((value) => !value)} aria-expanded={showRoles} className="btn btn-secondary btn-sm" style={{ minHeight: '34px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {showRoles ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Role access
      </button>
      <button type="button" disabled={!parentEnabled || loading || saving} onClick={toggle} aria-pressed={enabled} className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`} style={{ minHeight: '34px', minWidth: '92px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
        {loading || saving ? <LoaderCircle size={13} className="animate-spin" /> : enabled ? <><Eye size={13} /> On</> : <><EyeOff size={13} /> Off</>}
      </button>
    </div>
    {saveError && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: '0 10px 9px' }}>{saveError}</p>}
    {showRoles && parentEnabled && <div style={{ padding: '0 9px 9px' }}><RoleAccessControlCard pageKey={feature.key} label={feature.label} hideStats /></div>}
  </div>;
}

export function SidebarPageAccessHeader({ pageKey }) {
  const page = ADMIN_PAGE_CONFIG[pageKey];
  if (!page) return null;
  return <header style={{ marginBottom: '18px' }}>
    <h1 style={{ margin: 0, fontSize: '24px', lineHeight: 1.2, fontWeight: 750, color: 'var(--text-primary)' }}>{page.label}</h1>
    <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Manage {page.label} access and feature visibility.</p>
  </header>;
}

export default function SidebarPageAccessPanel({ pageKey, featureKey, part = 'both' }) {
  const page = ADMIN_PAGE_CONFIG[pageKey];
  const { config, loading, save } = useRoleAccess(pageKey);
  const [showRoles, setShowRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const enabled = config.enabled !== false;
  const allChildren = page?.featurePage
    ? MANAGED_FEATURES.filter((feature) => feature.page.toLowerCase() === page.featurePage)
    : [];
  const children = featureKey ? allChildren.filter((feature) => feature.key === featureKey) : allChildren;

  const toggle = async () => {
    setSaving(true);
    setSaveError('');
    const ok = await save({ ...config, enabled: !enabled });
    if (!ok) setSaveError('Could not save. Check your connection and try again.');
    setSaving(false);
  };

  if (!page) return null;

  const parentControl = <section className="glass-card-static" style={{ padding: '16px', border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
        <LockKeyhole size={17} style={{ color: 'var(--accent-cyan)' }} />
        <div style={{ flex: 1, minWidth: '160px' }}>
          <h2 style={{ fontSize: '15px', margin: 0 }}>{page.label} Access</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '3px 0 0' }}>Parent access for this page and its feature boxes.</p>
        </div>
        <button type="button" onClick={() => setShowRoles((value) => !value)} aria-expanded={showRoles} className="btn btn-secondary btn-sm" style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          {showRoles ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Parent role access
        </button>
        <button type="button" disabled={loading || saving} onClick={toggle} aria-pressed={enabled} className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-rose'}`} style={{ minHeight: '38px', minWidth: '112px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
          {loading || saving ? <LoaderCircle size={14} className="animate-spin" /> : enabled ? <><Eye size={14} /> Turn off</> : <><EyeOff size={14} /> Turn on</>}
        </button>
      </div>
      {saveError && <p role="alert" style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: '8px 0 0' }}>{saveError}</p>}
      {showRoles && <div style={{ marginTop: '12px' }}><RoleAccessControlCard pageKey={pageKey} label={`${page.label} Access`} hideStats /></div>}
  </section>;

  const childControl = <section className="glass-card-static" style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--border-primary)', opacity: enabled ? 1 : 0.58 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
      <strong style={{ fontSize: '12px' }}>{featureKey ? (children[0]?.label || page.label) : page.label} child access</strong>
      <span style={{ color: enabled ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: '11px', fontWeight: 700 }}>{enabled ? 'Parent on' : 'Parent off · children locked'}</span>
    </div>
    <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: 1.45, margin: '0 0 9px' }}>Set access for the selected page section.</p>
    {children.length > 0 ? <div style={{ display: 'grid', gap: '7px' }}>{children.map((feature) => <ChildFeature key={feature.key} feature={feature} parentEnabled={enabled} />)}</div> : (
      <div style={{ padding: '12px', borderRadius: '9px', background: 'var(--bg-input)', color: 'var(--text-tertiary)', fontSize: '12px' }}>This page has page-level access controls. No separate feature boxes are configured yet.</div>
    )}
  </section>;

  if (part === 'parent') return parentControl;
  if (part === 'child') return childControl;
  return <>{parentControl}{childControl}</>;
}
