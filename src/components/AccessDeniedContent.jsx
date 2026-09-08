import { ShieldOff } from 'lucide-react';

// Rendered inside a page's content box when the viewer's role is in that
// page's "Feature Hidden" list. The hero box and glider tabs above stay
// visible — matching the Dashboard / Grade Lab behaviour where only the
// content area is gated.
export default function AccessDeniedContent({ role }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        minHeight: '220px',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'var(--accent-rose-glow)',
          color: 'var(--accent-rose)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ShieldOff size={20} />
      </div>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-rose)' }}>
        You don&apos;t have access
      </h3>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.6 }}>
        Your role <code>{role || 'guest'}</code> is currently in &ldquo;Feature Hidden&rdquo; for this page.
        Ask an admin to move your pill to &ldquo;Can Use&rdquo; to regain access.
      </p>
    </div>
  );
}
