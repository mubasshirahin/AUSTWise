import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AlumniTransferPrompt() {
  const { user, saveUserProfile } = useAuth();
  const [email, setEmail] = useState(user?.personalEmail || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const semester = user?.currentSemester || user?.yearSemester?.match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i)?.slice(1).join('.') || '';
  const max = user?.maxSemester || (user?.department === 'ARCH' ? '5.2' : '4.2');
  if (user?.role !== 'student' || semester !== max || user.personalEmail) return null;
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await saveUserProfile({ personalEmail: email.trim().toLowerCase() }); }
    catch (err) { setError(err.message || 'Could not save your personal email.'); }
    finally { setSaving(false); }
  };
  return <form onSubmit={submit} style={{ margin: '0 0 18px', padding: 18, borderRadius: 14, border: '1px solid var(--accent-amber)', background: 'var(--accent-amber-glow)', display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Mail size={20} color="var(--accent-amber)" /><div><strong>Please provide your Personal Gmail for Alumni Network Transfer</strong><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Your AUST account will transfer to this address after graduation.</div></div></div>
    <label htmlFor="alumni-personal-email">Personal Gmail address</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><input id="alumni-personal-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@gmail.com" style={{ minHeight: 44, flex: '1 1 240px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} /><button className="btn btn-primary" disabled={saving}><ShieldCheck size={16} /> {saving ? 'Saving…' : 'Save Gmail'}</button></div>
    {error && <span role="alert" style={{ color: 'var(--accent-rose)' }}>{error}</span>}
  </form>;
}
