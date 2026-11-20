import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, MessageSquare, Send } from 'lucide-react';
import './InfoPage.css';
import './TermsPage.css';
import './FeedbackPage.css';
import LandingNav from '../features/landing/LandingNav';

const CONTACT_EMAIL = 'austwise59@gmail.com';
const TYPES = ['Idea', 'Bug', 'Other'];

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [type, setType] = useState('Idea');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const form = new FormData(e.currentTarget);
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          type,
          name: form.get('name'),
          email: form.get('email'),
          message: form.get('message'),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) throw new Error('Too many messages. Please wait a few minutes and try again.');
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not send feedback. Please try again.');
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not send feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="tos-widget fb-widget">
        <header className="tos-head">
          <div className="tos-head-title">
            <div className="tos-head-tile" aria-hidden="true"><MessageSquare size={20} strokeWidth={2.1} /></div>
            <div className="tos-head-text">
              <span className="tos-head-overline">Support</span>
              <h1 className="tos-head-name">Feedback</h1>
              <span className="tos-head-subtitle">Ideas, bugs or anything else</span>
            </div>
          </div>
          <button type="button" className="tos-back" onClick={() => navigate('/')}>
            <ArrowLeft size={13} /> Home
          </button>
        </header>

        <div className="tos-card">
          {submitted ? (
            <div className="fb-done">
              <span className="fb-done-icon"><Check size={18} /></span>
              <h2>Thank you!</h2>
              <p>Your feedback has been received. We'll get back to you if needed.</p>
              <button type="button" className="tos-back" onClick={() => navigate('/')}>
                <ArrowLeft size={13} /> Home
              </button>
            </div>
          ) : (
            <form className="fb-form" onSubmit={handleSubmit}>
              <div className="fb-field">
                <span className="fb-label">Type</span>
                <div className="fb-types" role="radiogroup" aria-label="Feedback type">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={type === t}
                      className={`fb-type${type === t ? ' is-on' : ''}`}
                      onClick={() => setType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fb-row">
                <label className="fb-field">
                  <span className="fb-label">Name <em>(optional)</em></span>
                  <input className="fb-input" name="name" type="text" placeholder="Your name" maxLength={100} autoComplete="name" />
                </label>
                <label className="fb-field">
                  <span className="fb-label">Email <em>(optional)</em></span>
                  <input className="fb-input" name="email" type="email" placeholder="you@email.com" maxLength={200} autoComplete="email" />
                </label>
              </div>

              <label className="fb-field">
                <span className="fb-label">Message</span>
                <textarea className="fb-input" name="message" required minLength={3} maxLength={4000} rows={6} placeholder="Tell us what's on your mind..." />
              </label>

              {error && <p className="fb-error" role="alert">{error}</p>}

              <div className="fb-actions">
                <button type="submit" className="fb-submit" disabled={sending}>
                  <Send size={13} /> {sending ? 'Sending...' : 'Send feedback'}
                </button>
                <span className="fb-alt">or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></span>
              </div>
            </form>
          )}
        </div>
      </div>
      <div className="tos-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
