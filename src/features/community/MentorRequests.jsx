import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, X, Send, UserCheck, Trash2, Mail } from 'lucide-react';
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
    <div className="glass-card-static animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'var(--accent-amber-glow)', color: 'var(--accent-amber)', padding: '6px', borderRadius: '8px' }}>
            <MessageSquarePlus size={18} />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Find a Mentor</h2>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              Need help with a topic? Post what you need and mentors will respond.
            </p>
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((open) => !open)}>
          {showForm ? <X size={14} /> : <MessageSquarePlus size={14} />}
          {showForm ? 'Cancel' : 'Post Request'}
        </button>
      </div>

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
              <input className="input" value={form.requesterName} onChange={(e) => setForm((c) => ({ ...c, requesterName: e.target.value }))} maxLength={MAX_TITLE_LENGTH} required />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Topic you need help with
              <input className="input" value={form.topic} onChange={(e) => setForm((c) => ({ ...c, topic: e.target.value }))} maxLength={MAX_TITLE_LENGTH} placeholder="e.g., CP, Web Dev, ML, DBMS..." required />
            </label>
          </div>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Description (optional)
            <textarea className="input" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} maxLength={MAX_SHORT_TEXT_LENGTH} placeholder="Describe what you need help with..." rows={2} />
          </label>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Your contact (for mentors to reach you)
            <input className="input" value={form.contact} onChange={(e) => setForm((c) => ({ ...c, contact: e.target.value }))} maxLength={MAX_TITLE_LENGTH} placeholder="Phone / Telegram / Email" required />
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
          {requests.map((req) => (
            <div key={req.id} className="glass-card-static" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)', fontSize: '11px', fontWeight: 'bold' }}>
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
                  {(user?.role === 'admin' || req.contributorId === user?.id) && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(req)} style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
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
                        <p style={{ fontSize: '10px', color: 'var(--accent-blue)', marginTop: '4px', fontWeight: 'bold' }}>
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
          ))}
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
