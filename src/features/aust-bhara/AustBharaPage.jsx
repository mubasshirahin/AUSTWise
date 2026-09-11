import { useState } from 'react';
import { Banknote, CreditCard, Receipt, Info, X, PencilLine } from 'lucide-react';
import '../campus/SemesterViewWidget.css';
import './AustBharaPage.css';

const PILL_META = [
  { id: 'semester', label: 'Semester Fees', icon: CreditCard, hint: 'Briefly bhenge bolo — e.g., Tuition 60k + Lab 5k + Library 1k (optional)' },
  { id: 'exam', label: 'Exam Fees', icon: Banknote, hint: 'Briefly bhenge bolo — e.g., Form fill-up 2k + Center fee 500 (optional)' },
  { id: 'history', label: 'Payment History', icon: Receipt, hint: 'Briefly bhenge bolo — e.g., Last paid 12 Jan via bKash TRX ... (optional)' },
];

export default function AustBharaPage() {
  const [activePill, setActivePill] = useState(null);
  const [details, setDetails] = useState({ semester: '', exam: '', history: '' });

  const togglePill = (id) => setActivePill((prev) => (prev === id ? null : id));

  return (
    <div className="glass-card-static schedule-widget sv-widget bhara-widget animate-fadeInUp">

      {/* ── Masthead — aligned like Cover Page (1fr auto 1fr, center stats) ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile bhara-icon-tile">
            <Banknote size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">Bhara Koto</div>
            <span className="schedule-subtitle">
              Semester fees, tuition &amp; AUST-related payments
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value bhara-cs-badge">Soon</span>
              <span className="schedule-stat-label">Status</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          {/* placeholder — no actions yet */}
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Coming Soon body ── */}
      <div className="sv-empty">
        <Receipt size={38} className="sv-empty-icon" />
        <h3>Fee Tracker — Coming Soon</h3>
        <p>
          View semester-wise fee breakdowns, track payment deadlines, and get reminders before
          due dates. All your AUST payment history in one clean dashboard.
        </p>
        <div className="bhara-feature-pills">
          {PILL_META.map((p) => {
            const Icon = p.icon;
            const isActive = activePill === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`bhara-pill${isActive ? ' bhara-pill-active' : ''}`}
                onClick={() => togglePill(p.id)}
                aria-expanded={isActive}
                aria-controls={`bhara-details-${p.id}`}
              >
                <Icon size={14} /> {p.label}
              </button>
            );
          })}
        </div>

        {/* ── Details writing option — OVERLAY (not niche) — appears on pill click, optional, briefly bhenge bujhai ── */}
        {activePill && (
          <div className="bhara-details-overlay" onClick={() => setActivePill(null)}>
            <div id={`bhara-details-${activePill}`} className="bhara-details-panel animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
              <div className="bhara-details-head">
                <span className="bhara-details-title">
                  <PencilLine size={13} /> {PILL_META.find((x) => x.id === activePill)?.label} — Details (optional)
                </span>
                <button type="button" className="bhara-details-close" onClick={() => setActivePill(null)} aria-label="Close details">
                  <X size={12} />
                </button>
              </div>
              <p className="bhara-details-hint">
                <Info size={11} /> {PILL_META.find((x) => x.id === activePill)?.hint}
              </p>
              <textarea
                className="input bhara-details-input"
                rows={3}
                placeholder="Briefly bhenge bhenge likho — e.g., point akare, optional..."
                value={details[activePill] || ''}
                onChange={(e) => setDetails((prev) => ({ ...prev, [activePill]: e.target.value }))}
                autoFocus
              />
              <div className="bhara-details-actions">
                <span className="bhara-details-count">{(details[activePill] || '').length} chars • optional</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDetails((prev) => ({ ...prev, [activePill]: '' }))}
                >
                  Clear
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setActivePill(null)}>
                  Done
                </button>
              </div>
              {(details[activePill] || '').trim() && (
                <div className="bhara-details-preview">
                  <span className="bhara-details-preview-label">Preview:</span>
                  <p>{details[activePill]}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
