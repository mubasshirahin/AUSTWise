import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clipboard, RefreshCw, ShieldCheck, X } from 'lucide-react';
import './AdminPanelPage.css';

export default function AccessRequestsPanel() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [inviteLinks, setInviteLinks] = useState({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/access-requests', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load access requests.');
      setRequests(data.requests || []);
    } catch (e) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const review = async (request, status) => {
    setBusyId(request.id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/access-requests/review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Could not ${status} this request.`);
      setRequests((current) => current.map((item) => item.id === request.id ? data.request : item));
      if (data.inviteLink) setInviteLinks((current) => ({ ...current, [request.id]: data.inviteLink }));
      setMessage(status !== 'approved'
        ? 'Request rejected.'
        : data.grantedAccount
          ? 'Approved. The account is ready; the applicant can sign in with the requested email and password.'
          : 'Approved. The applicant can sign in with the requested email and password.');
      setMessageType('success');
    } catch (e) {
      setMessage(e.message);
      setMessageType('error');
    } finally {
      setBusyId('');
    }
  };

  const visible = requests.filter((item) => filter === 'all' || item.status === filter);
  return (
    <main className="admin-panel-container stagger-children animate-fadeIn">
      <header className="admin-control-header">
        <div className="admin-control-brand"><span className="admin-control-mark"><ShieldCheck size={19} /></span><div><p className="admin-control-eyebrow">AUSTWISE · PEOPLE</p><h1>Access requests</h1></div></div>
        <div className="admin-control-header-actions">
          <button className="admin-quiet-action" onClick={() => navigate('/admin')}><ArrowLeft size={15} /> Admin workspace</button>
        <button className="btn btn-secondary btn-sm" onClick={loadRequests} disabled={loading}><RefreshCw size={14} /> Refresh</button>
        </div>
      </header>
      <p style={{ margin: '-4px 2px 4px', color: 'var(--text-secondary)', fontSize: 12 }}>Review faculty and alumni requests, then share the generated invitation link when needed.</p>
      <section className="glass-card-static" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        {['pending', 'approved', 'rejected', 'all'].map((value) => <button key={value} className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 12 }}>{visible.length} request{visible.length === 1 ? '' : 's'}</span>
      </section>
      {message && <p className={`auth-message ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}
      {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading requests…</p> : visible.length === 0 ? <section className="glass-card-static" style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>No {filter === 'all' ? '' : `${filter} `}access requests.</section> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visible.map((request) => (
            <article key={request.id} className="glass-card-static" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ color: 'var(--text-primary)', fontSize: 16 }}>{request.name}</strong><span className="badge badge-blue">{request.role}</span><span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{request.status}</span></div>
                  <p style={{ color: 'var(--text-secondary)', margin: '8px 0 4px' }}>{request.email}</p>
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>{request.department}{request.designation ? ` · ${request.designation}` : ''}{request.batch ? ` · ${request.batch}` : ''}{request.graduationYear ? ` · graduated ${request.graduationYear}` : ''}{request.company ? ` · ${request.company}` : ''}</p>
                  {request.previousEmail && <p style={{ color: 'var(--text-tertiary)', margin: '6px 0 0', fontSize: 12 }}>Former AUST account: {request.previousEmail}</p>}
                  <p style={{ color: 'var(--text-tertiary)', margin: '8px 0 0', fontSize: 11 }}>Submitted {new Date(request.createdAt).toLocaleString()}</p>
                </div>
                {request.status === 'pending' && <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary btn-sm" disabled={busyId === request.id} onClick={() => review(request, 'approved')}><Check size={14} /> Approve</button><button className="btn btn-secondary btn-sm" disabled={busyId === request.id} onClick={() => review(request, 'rejected')}><X size={14} /> Reject</button></div>}
              </div>
              {inviteLinks[request.id] && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><code style={{ flex: '1 1 300px', overflowWrap: 'anywhere', color: 'var(--text-primary)', fontSize: 12 }}>{inviteLinks[request.id]}</code><button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(inviteLinks[request.id])}><Clipboard size={14} /> Copy invite link</button></div>}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
