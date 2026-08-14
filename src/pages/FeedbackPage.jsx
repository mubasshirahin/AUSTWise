import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block">
          <div className="info-page-title-row">
            <h1>Feedback</h1>
            <button className="info-page-back" onClick={() => navigate('/')}>← Back to Home</button>
          </div>
          <p className="info-page-subtitle">We would love to hear from you. Share your thoughts, ideas, or report an issue.</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <h2>Thank you!</h2>
            <p>Your feedback has been received. We will review it and get back to you if needed.</p>
            <button className="info-page-back" onClick={() => navigate('/')} style={{ marginTop: 24 }}>← Back to Home</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>Name (optional)</label>
              <input type="text" placeholder="Your name" style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-primary)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit',
              }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>Email (optional)</label>
              <input type="email" placeholder="your@email.com" style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-primary)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit',
              }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>Message *</label>
              <textarea required rows={6} placeholder="Tell us what is on your mind..." style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-primary)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.86rem', fontFamily: 'inherit', resize: 'vertical',
              }} />
            </div>
            <button type="submit" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 600,
              color: '#fff', background: 'var(--accent-blue)', border: 'none', borderRadius: 8, padding: '10px 24px',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s',
            }}>Submit Feedback</button>
          </form>
        )}
      </div>
      <div className="info-page-footer">&copy; {new Date().getFullYear()} AUSTWise. All rights reserved.</div>
    </div>
  );
}
