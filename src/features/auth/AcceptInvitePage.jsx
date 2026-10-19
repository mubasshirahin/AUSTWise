import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginDirect } = useAuth();
  const token = searchParams.get('token') || '';
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const departments = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'This invitation is not valid.');
        if (!cancelled) setInvite(data);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    const profile = {
      department: String(form.get('department') || ''),
      designation: String(form.get('designation') || ''),
      batch: String(form.get('batch') || ''),
      graduationYear: String(form.get('graduationYear') || ''),
      company: String(form.get('company') || ''),
    };
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password, profile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not create your account.');
      setCreated(true);
      try {
        await loginDirect(data.user);
        navigate('/', { replace: true });
      } catch {
        setError('Your account was created, but automatic sign-in failed. Continue to login with the invited email and password you chose.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'var(--bg-primary)' }}>
      <section className="glass-card-static" style={{ width: 'min(100%, 480px)', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-cyan)', marginBottom: '14px' }}><ShieldCheck size={22} /><span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>AUSTWise invitation</span></div>
        {loading ? <p style={{ color: 'var(--text-secondary)' }}>Checking invitation…</p> : created ? (
          <>
            <CheckCircle2 size={32} style={{ color: 'var(--accent-emerald)' }} />
            <h1 style={{ color: 'var(--text-primary)', fontSize: '22px' }}>Account created</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{error || `Your ${invite?.role} account for ${invite?.email} is ready. Signing you in now…`}</p>
            {error && <Link className="btn btn-primary" to="/login" style={{ display: 'inline-flex', marginTop: '12px' }}>Go to login</Link>}
          </>
        ) : error ? (
          <><h1 style={{ color: 'var(--text-primary)', fontSize: '22px' }}>Invitation unavailable</h1><p role="alert" style={{ color: 'var(--accent-rose)' }}>{error}</p><Link to="/login" className="btn btn-secondary">Back to login</Link></>
        ) : (
          <>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', margin: '0 0 6px' }}>Complete your account</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 18px' }}>Invited as <strong>{invite?.role}</strong> at <strong>{invite?.email}</strong>. Complete your profile and choose a password to create your account and sign in.</p>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
              <label className="auth-field">Full name<input className="input" name="name" autoComplete="name" required /></label>
              <label className="auth-field">Department<select className="input" name="department" defaultValue={invite?.profile?.department || ''} required><option value="" disabled>Select department</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
              {invite?.role === 'faculty' && <label className="auth-field">Designation<input className="input" name="designation" defaultValue={invite?.profile?.designation || ''} required /></label>}
              {invite?.role === 'alumni' && <><label className="auth-field">Batch name &amp; number<input className="input" name="batch" defaultValue={invite?.profile?.batch || ''} required /></label><label className="auth-field">Graduation year<input className="input" name="graduationYear" defaultValue={invite?.profile?.graduationYear || ''} /></label><label className="auth-field">Company (optional)<input className="input" name="company" defaultValue={invite?.profile?.company || ''} /></label></>}
              <label className="auth-field">Password<input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
              <label className="auth-field">Confirm password<input className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required /></label>
              {error && <p role="alert" style={{ color: 'var(--accent-rose)', margin: 0 }}>{error}</p>}
              <button className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating account…' : 'Accept invitation'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
