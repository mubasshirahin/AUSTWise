import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Password could not be updated.');
      setMessage(data.message);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <main style={{ maxWidth: 440, margin: '10vh auto', padding: 24 }}><form onSubmit={submit} className="glass-card-static" style={{ display: 'grid', gap: 14, padding: 24 }}><KeyRound size={28} color="var(--accent-blue)" /><h1 style={{ margin: 0 }}>Set your alumni password</h1><label htmlFor="new-password">New password</label><input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /><button className="btn btn-primary" disabled={busy || !token}>{busy ? 'Updating…' : 'Update password'}</button>{error && <p role="alert" style={{ color: 'var(--accent-rose)' }}>{error}</p>}{message && <p role="status">{message} <Link to="/login">Sign in</Link></p>}{!token && <p role="alert">This password reset link is missing its token.</p>}</form></main>;
}
