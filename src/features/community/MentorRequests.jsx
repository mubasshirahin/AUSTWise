import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, X, UserCheck, Trash2, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listMentorRequests,
  addMentorRequest,
  deleteMentorRequest,
  formatPostedDate,
  getUserInitials,
  getBatchNoFromUser,
} from '../../utils/marketplaceStorage';
import { sendMessage } from '../../utils/messageStorage';
import { sanitizeUserInput, MAX_TITLE_LENGTH, MAX_SHORT_TEXT_LENGTH } from '../../utils/sanitize';
import ConfirmDialog from '../marketplace/ConfirmDialog';

const defaultForm = {
  topic: '',
  description: '',
  contact: '',
};

export default function MentorRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(() => listMentorRequests());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm, requesterName: user?.name || '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = () => setRequests(listMentorRequests());

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      addMentorRequest({
        topic: sanitizeUserInput(form.topic, MAX_TITLE_LENGTH),
        description: sanitizeUserInput(form.description, MAX_SHORT_TEXT_LENGTH),
        contact: sanitizeUserInput(form.contact, MAX_TITLE_LENGTH),
        requesterName: sanitizeUserInput(form.requesterName, MAX_TITLE_LENGTH),
        batch: getBatchNoFromUser(user),
        department: user?.department || '',
      });
      setShowForm(false);
      setForm({ ...defaultForm, requesterName: user?.name || '' });
      refresh();
      setMessage('Mentor request published. Someone will respond soon.');
    } catch (submitError) {
      setError(submitError.message || 'Could not publish request.');
    }
  };

  const navigate = useNavigate();

  const handleRespondAsMentor = (req) => {
    if (user?.isGuest) {
      setError('Please login to respond as a mentor.');
      return;
    }
    try {
      sendMessage(
        user.id,
        req.contributorId,
        `📚 Mentor Request: I can help you with "${req.topic}"! Let's connect.`
      );
      setMessage('Mentor request sent to your inbox. Continue the conversation there.');
      setTimeout(() => navigate(`/messages?peer=${req.contributorId}`), 800);
    } catch (err) {
      setError(err.message || 'Could not send message.');
    }
  };

  const handleDelete = (req) => {
    const isOwner = req.contributorId === user?.id;
    const isAdmin = user?.role === 'admin';
    if (!isOwner && !isAdmin) return;
    setDeleteTarget(req);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMentorRequest(deleteTarget.id, user?.id, user?.role);
    refresh();
    setMessage('Request removed.');
    setDeleteTarget(null);
  };

  return (
    <div className="mentor-page">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <MessageSquarePlus size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <div className="schedule-title">Find a Mentor</div>
            <span className="schedule-subtitle">Need help with a topic? Post what you need and mentors will respond.</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((open) => !open)}>
            {showForm ? <X size={14} /> : <MessageSquarePlus size={14} />}
            {showForm ? 'Cancel' : 'Post Request'}
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {message && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
          {message}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="grid-2" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Your name
              <input id="mentor-requester-name" name="requesterName" className="input" value={form.requesterName} onChange={(e) => setForm((c) => ({ ...c, requesterName: e.target.value }))} maxLength={MAX_TITLE_LENGTH} required />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Topic you need help with
              <input id="mentor-topic" name="topic" className="input" value={form.topic} onChange={(e) => setForm((c) => ({ ...c, topic: e.target.value }))} maxLength={MAX_TITLE_LENGTH} placeholder="e.g., CP, Web Dev, ML, DBMS..." required />
            </label>
          </div>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Description (optional)
            <textarea id="mentor-description" name="description" className="input" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} maxLength={MAX_SHORT_TEXT_LENGTH} placeholder="Describe what you need help with..." rows={2} />
          </label>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Your contact (for mentors to reach you)
            <input id="mentor-contact" name="contact" className="input" value={form.contact} onChange={(e) => setForm((c) => ({ ...c, contact: e.target.value }))} maxLength={MAX_TITLE_LENGTH} placeholder="Phone / Telegram / Email" required />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
            Publish Request
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px' }}>
          <MessageSquarePlus size={36} />
          <h3>No mentor requests yet</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            Be the first to ask for help. Mentors are here to guide you.
          </p>
        </div>
      ) : (
        <div className="mentor-request-grid">
          {requests.map((req) => {
            // Density by mentor response count — 0 → emerald · 1 → cyan · 2 → amber · 3+ → rose
            const responseCount = (req.responses || []).length;
            const densityClass = responseCount >= 3 ? 'is-rose' : responseCount === 2 ? 'is-amber' : responseCount === 1 ? 'is-cyan' : 'is-emerald';
            return (
            <div key={req.id} className={`community-cell mentor-req-card ${densityClass}`}>
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div className="flex gap-3 items-start">
                    <div className="avatar sm" style={{ width: '36px', height: '36px' }}>
                      {getUserInitials(req.requesterName)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {req.requesterName}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                          • Batch {req.batch} • {req.department}
                        </span>
                      </h3>
                      <div className="mentor-req-topic">
                        <UserCheck size={12} />
                        {req.topic}
                      </div>
                      {req.description && (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '600px' }}>
                          {req.description}
                        </p>
                      )}
                      <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                        Posted {formatPostedDate(req.postedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mentor-req-head-right">
                    {responseCount > 0 && (
                      <span className={`sv-count${responseCount >= 3 ? ' hot' : ''}`} title={`${responseCount} response${responseCount !== 1 ? 's' : ''}`}>
                        {responseCount}
                      </span>
                    )}
                    {(user?.role === 'admin' || req.contributorId === user?.id) && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(req)} style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

              {req.responses && req.responses.length > 0 && (
                <div style={{ marginTop: '12px', marginLeft: '48px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-secondary)', paddingTop: '10px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Responses ({req.responses.length})
                  </p>
                  {req.responses.map((res) => (
                    <div key={res.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {res.responderName} <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>• Batch {res.responderBatch}</span>
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{formatPostedDate(res.postedAt)}</span>
                      </div>
                      <p style={{ marginTop: '4px' }}>{res.message}</p>
                      {res.contact && (
                        <p style={{ fontSize: '10px', color: 'var(--accent-amber)', marginTop: '4px', fontWeight: 'bold' }}>
                          Contact: {res.contact}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '10px', marginLeft: '48px', fontSize: '10px' }}
                onClick={() => handleRespondAsMentor(req)}
              >
                <Mail size={12} /> Respond as Mentor
              </button>
            </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.topic}
        message={`Are you sure you want to delete "${deleteTarget?.topic}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
