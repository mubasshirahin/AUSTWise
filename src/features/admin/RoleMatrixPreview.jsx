import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PanelsTopLeft, RefreshCw } from 'lucide-react';

const PREVIEW_ROLES = [
  { id: 'faculty', label: 'Faculty' },
  { id: 'student', label: 'Student' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'alumni_with_carry', label: 'Alumni with Carry' },
  { id: 'readd', label: 'Re-add' },
  { id: 'admin', label: 'Admin' },
];

const SUGGESTED_PATHS = ['/analytics', '/campus', '/', '/daily-life', '/settings'];

function buildPreviewUrl(targetPath, role) {
  const trimmedPath = targetPath.trim();
  const safePath = trimmedPath.startsWith('/') && !trimmedPath.startsWith('//') ? trimmedPath : '/analytics';
  const url = new URL(safePath, window.location.origin);
  if (url.origin !== window.location.origin) return '/analytics?mockRole=' + encodeURIComponent(role);
  url.searchParams.set('mockRole', role);
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function RoleMatrixPreview() {
  const navigate = useNavigate();
  const [targetPath, setTargetPath] = useState('/analytics');
  const [refreshAll, setRefreshAll] = useState(0);
  const [refreshByRole, setRefreshByRole] = useState({});

  const urls = useMemo(() => Object.fromEntries(
    PREVIEW_ROLES.map((role) => [role.id, buildPreviewUrl(targetPath, role.id)]),
  ), [targetPath]);

  const refreshOne = (roleId) => setRefreshByRole((current) => ({
    ...current,
    [roleId]: (current[roleId] || 0) + 1,
  }));

  return (
    <main style={{ maxWidth: '1600px', margin: '0 auto', padding: 'clamp(14px, 2.5vw, 28px)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
        <span style={{ width: '42px', height: '42px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'var(--accent-cyan-glow)', color: 'var(--accent-cyan)', flex: '0 0 auto' }}>
          <PanelsTopLeft size={21} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--text-primary)' }}>Live Role Access Preview</h1>
          <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Compare how each role sees a page. Mock roles are enabled only in development builds.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')} style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={15} /> Admin Panel
        </button>
      </header>

      <section className="glass-card-static" aria-label="Preview controls" style={{ padding: '14px', marginBottom: '14px', display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: '6px', flex: '1 1 280px', maxWidth: '520px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 650 }}>
          Target page path
          <input
            type="text"
            className="input"
            list="role-preview-paths"
            value={targetPath}
            onChange={(event) => setTargetPath(event.target.value)}
            onBlur={() => setTargetPath((path) => path.trim().startsWith('/') && !path.trim().startsWith('//') ? path.trim() : '/analytics')}
            placeholder="/analytics"
            aria-label="Target page path"
          />
          <datalist id="role-preview-paths">{SUGGESTED_PATHS.map((path) => <option value={path} key={path} />)}</datalist>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setRefreshAll((count) => count + 1)} style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <RefreshCw size={15} /> Refresh All
        </button>
        <span style={{ flexBasis: '100%', color: 'var(--text-tertiary)', fontSize: '11px' }}>Each preview runs in its own iframe. Changes to saved role-access settings appear when you refresh that preview.</span>
      </section>

      <section aria-label="Role previews" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '14px', alignItems: 'start' }}>
        {PREVIEW_ROLES.map((role) => (
          <article key={role.id} className="glass-card-static" style={{ minWidth: 0, overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px', padding: '8px 11px', borderBottom: '1px solid var(--border-primary)' }}>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>{role.label}</span>
              <code style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{role.id}</code>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => refreshOne(role.id)} aria-label={`Refresh ${role.label} preview`} title={`Refresh ${role.label} preview`} style={{ minWidth: '36px', minHeight: '34px', display: 'grid', placeItems: 'center', padding: '6px' }}>
                <RefreshCw size={14} />
              </button>
            </div>
            <iframe
              key={`${role.id}-${refreshAll}-${refreshByRole[role.id] || 0}`}
              src={urls[role.id]}
              title={`${role.label} role preview`}
              loading="lazy"
              style={{ display: 'block', width: '100%', height: 'min(68vh, 620px)', minHeight: '420px', border: 0, background: 'var(--bg-primary)' }}
            />
          </article>
        ))}
      </section>
    </main>
  );
}
