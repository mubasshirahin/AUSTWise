import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, GraduationCap, UserPlus } from 'lucide-react';

export default function AcademicManagementPanel({ compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [invite, setInvite] = useState({ email: '', role: 'alumni' });
  const [inviteLink, setInviteLink] = useState('');
  useEffect(() => {
    fetch('/api/admin/academic/accounts', { credentials: 'same-origin' })
      .then(response => response.json())
      .then(data => { if (data.success) setPendingAccounts(data.users || []); })
      .catch(() => {});
  }, []);

  const advanceAll = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/admin/academic/advance-all', { method: 'POST', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not move students to the next semester.');
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const approveAccount = async userId => {
    setError('');
    try {
      const response = await fetch('/api/admin/academic/accounts/review', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, approved: true }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not approve account.');
      setPendingAccounts(accounts => accounts.filter(account => account.id !== userId));
    } catch (err) { setError(err.message); }
  };
  const sendInvite = async event => {
    event.preventDefault(); setError(''); setInviteLink('');
    try {
      const response = await fetch('/api/invites', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invite) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not send invitation.');
      setInviteLink(data.inviteLink || ''); setInvite(current => ({ ...current, email: '' }));
    } catch (err) { setError(err.message); }
  };
  const card = { background: 'var(--surface-elevated, var(--bg-secondary))', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20 };

  if (compact) return <section className="admin-semester-action">
    <div><span className="admin-section-kicker">ACADEMIC OPERATIONS</span><h2>Semester transition</h2><p>Advance all active student records by one semester. Final-year students follow the alumni transfer flow.</p></div>
    <button className="btn btn-primary" onClick={advanceAll} disabled={busy} style={{ minHeight: 46, whiteSpace: 'nowrap' }}>{busy ? 'Moving students…' : 'Move to Next Semester'} <ArrowRight size={17} /></button>
    {error && <p role="alert" className="admin-semester-message is-error">{error}</p>}
    {result && <div role="status" className="admin-semester-message"><CheckCircle2 size={17} /> {result.advanced} advanced{result.graduated ? ` · ${result.graduated} graduated` : ''}{result.blocked ? ` · ${result.blocked} graduation transfers need a personal Gmail` : ''}{result.skipped ? ` · ${result.skipped} skipped due to invalid semester data` : ''}{result.outcomes.some(row => row.outcome === 'GRADUATED' && !row.emailSent) ? ' · A welcome/reset email could not be sent' : ''}</div>}
  </section>;

  return <section style={{ display: 'grid', gap: 20 }}>
    <header style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
      <GraduationCap size={28} color="var(--accent-blue)" />
      <div><h2 style={{ margin: 0 }}>Academic management</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>Advance the student body together and manage faculty or alumni access.</p></div>
    </header>

    <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
      <div><h3 style={{ margin: '0 0 6px' }}>Move to Next Semester</h3><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Move every current student ahead by one semester.</p></div>
      <button className="btn btn-primary" onClick={advanceAll} disabled={busy} style={{ minHeight: 46 }}>
        {busy ? 'Moving students…' : 'Move to Next Semester'} <ArrowRight size={17} />
      </button>
    </div>

    {error && <p role="alert" style={{ color: 'var(--accent-rose)' }}>{error}</p>}
    {result && <div role="status" style={{ ...card, borderColor: 'var(--accent-emerald)' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0 }}><CheckCircle2 size={19} /> Semester move complete</h3>
      <p>{result.advanced} students advanced{result.graduated ? ` · ${result.graduated} graduated into Alumni` : ''}.</p>
      {result.blocked > 0 && <p style={{ color: 'var(--accent-amber)' }}>{result.blocked} graduating students need a usable personal Gmail before transfer.</p>}
      {result.outcomes.some(row => row.outcome === 'GRADUATED' && !row.emailSent) && <p style={{ color: 'var(--accent-rose)' }}>A graduate’s password reset email could not be sent. Check the mail configuration and contact them.</p>}
      {result.skipped > 0 && <p style={{ color: 'var(--accent-amber)' }}>{result.skipped} accounts had an invalid semester and were skipped.</p>}
    </div>}

    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Pending faculty and alumni accounts <span style={{ color: 'var(--accent-rose)' }}>{pendingAccounts.length}</span></h3>
      {pendingAccounts.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No accounts are waiting for approval.</p> : pendingAccounts.map(account => <div key={account.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-color)' }}><div><strong>{account.name}</strong><div style={{ color: 'var(--text-secondary)' }}>{account.email} · {account.role}</div></div><button className="btn btn-primary" onClick={() => approveAccount(account.id)}>Approve account</button></div>)}
    </div>

    <form onSubmit={sendInvite} style={card}>
      <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 0 }}><UserPlus size={18} /> Invite a faculty member or alumnus</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><label style={{ flex: '1 1 220px' }}>Personal email<input required type="email" value={invite.email} onChange={event => setInvite({ ...invite, email: event.target.value })} style={{ display: 'block', width: '100%', minHeight: 42, marginTop: 5 }} /></label><label>Role<select value={invite.role} onChange={event => setInvite({ ...invite, role: event.target.value })} style={{ display: 'block', minHeight: 42, marginTop: 5, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}><option value="alumni">Alumni</option><option value="faculty">Faculty</option></select></label><button className="btn btn-secondary" style={{ alignSelf: 'end' }}>Send invitation</button></div>
      {inviteLink && <p role="status">Invitation sent. <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(inviteLink)}>Copy invite link</button></p>}
    </form>
  </section>;
}
