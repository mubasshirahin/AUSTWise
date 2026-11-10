import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, X, UserCheck, Trash2, Mail, LayoutGrid, Inbox, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listMentorRequests,
  addMentorRequest,
  addMentorResponse,
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
};

export default function MentorRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(() => listMentorRequests());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm, requesterName: user?.name || '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [section, setSection] = useState('feed'); // 'feed' | 'mine'
  const [respondTarget, setRespondTarget] = useState(null);
  const [respondForm, setRespondForm] = useState({ message: '', contact: '' });
  const [sortBy, setSortBy] = useState('recent'); // 'recent' (default) | 'responses'

  const myRequests = requests.filter((r) => r.contributorId === user?.id);

  // Feed order — Most Recent by default, or Least Responses first
  const sortedRequests = [...requests].sort((a, b) => {
    if (sortBy === 'responses') {
      const byResponses = (a.responses?.length || 0) - (b.responses?.length || 0);
      if (byResponses !== 0) return byResponses;
    }
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });

  const refresh = () => setRequests(listMentorRequests());

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      addMentorRequest({
        contributorId: user?.id,
        topic: sanitizeUserInput(form.topic, MAX_TITLE_LENGTH),
        description: sanitizeUserInput(form.description, MAX_SHORT_TEXT_LENGTH),
        requesterName: sanitizeUserInput(form.requesterName, MAX_TITLE_LENGTH),
        avatar: user?.avatar || null,
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
    if (req.contributorId === user?.id) {
      setError('You cannot respond to your own post.');
      return;
    }
    setRespondTarget((prev) => (prev?.id === req.id ? null : req));
    setRespondForm({ message: '', contact: '' });
    setError('');
    setMessage('');
  };

  const handleRespondSubmit = (event) => {
    event.preventDefault();
    if (!respondTarget) return;
    if (respondTarget.contributorId === user?.id) {
      setError('You cannot respond to your own post.');
      return;
    }
    const msg = sanitizeUserInput(respondForm.message, MAX_SHORT_TEXT_LENGTH);
    if (!msg) {
      setError('Write a response message first.');
      return;
    }
    try {
      // Save on the request (shows in the owner's "My Responses" section)
      addMentorResponse(respondTarget.id, {
        contributorId: user?.id,
        message: msg,
        contact: sanitizeUserInput(respondForm.contact, MAX_TITLE_LENGTH),
        responderName: user?.name || 'Anonymous',
        responderBatch: getBatchNoFromUser(user),
      });
      // Also DM the requester so they can chat directly
      sendMessage(user.id, respondTarget.contributorId, `📚 Mentor Request (${respondTarget.topic}): ${msg}`);
      setRespondTarget(null);
      refresh();
      setMessage('Response sent. The requester will see it in their inbox and My Responses.');
    } catch (err) {
      setError(err.message || 'Could not send response.');
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
            <span className="schedule-subtitle">Need help with a topic?</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <button
            type="button"
            className={`btn mentor-post-btn ${showForm ? 'is-open' : ''}`}
            onClick={() => setShowForm((open) => !open)}
            aria-expanded={showForm}
          >
            {showForm ? <X size={14} /> : <MessageSquarePlus size={14} />}
            <span>{showForm ? 'Cancel' : 'Post Request'}</span>
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

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
          <button type="submit" className="btn btn-primary btn-sm mentor-publish-btn" style={{ alignSelf: 'flex-start' }}>
            <Send size={13} /> Publish Request
          </button>
        </form>
      )}

      {/* ── Sections: Feed (all) | My Responses (own posts) ── */}
      <div className="mentor-tabs-row" role="tablist" aria-label="Mentor sections">
        <button type="button" role="tab" aria-selected={section === 'feed'} className={`btn btn-sm ${section === 'feed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection('feed')} style={{ gap: 6 }}>
          <LayoutGrid size={13} /> Feed · {requests.length}
        </button>
        <button type="button" role="tab" aria-selected={section === 'mine'} className={`btn btn-sm ${section === 'mine' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection('mine')} style={{ gap: 6 }}>
          <Inbox size={13} /> My Responses · {myRequests.reduce((n, r) => n + (r.responses?.length || 0), 0)}
        </button>
        {section === 'feed' && (
          <select
            className="input mentor-tabs-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort feed"
          >
            <option value="recent">Most Recent</option>
            <option value="responses">Least Responses</option>
          </select>
        )}
      </div>

      {section === 'mine' ? (
        myRequests.length === 0 ? (
          <div className="empty-state" style={{ padding: '28px' }}>
            <Inbox size={36} />
            <h3>No posts yet</h3>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              Post a mentor request and responses from mentors will show up here.
            </p>
          </div>
        ) : (
          <div className="mentor-request-grid">
            {myRequests.map((req) => (
              <div key={req.id} className="community-cell mentor-req-card">
                <div className="mentor-req-topic" style={{ display: 'inline-flex' }}>
                  <UserCheck size={12} /> {req.topic}
                </div>
                {req.description && (
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '8px' }}>{req.description}</p>
                )}
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  Posted {formatPostedDate(req.postedAt)} · {req.responses?.length || 0} response{req.responses?.length === 1 ? '' : 's'}
                </p>
                {req.responses?.length > 0 ? (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-secondary)', paddingTop: '10px' }}>
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
                          <p style={{ fontSize: '10px', color: 'var(--accent-amber)', marginTop: '4px', fontWeight: 'bold' }}>Contact: {res.contact}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '10px' }}>No responses yet — mentors will see your post in the Feed.</p>
                )}
              </div>
            ))}
          </div>
        )
      ) : requests.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px' }}>
          <MessageSquarePlus size={36} />
          <h3>No mentor requests yet</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            Be the first to ask for help. Mentors are here to guide you.
          </p>
        </div>
      ) : (
        <div className="mentor-request-grid">
          {sortedRequests.map((req) => {
            // Density by mentor response count — 0 → emerald · 1 → cyan · 2 → amber · 3+ → rose
            const responseCount = (req.responses || []).length;
            const densityClass = responseCount >= 3 ? 'is-rose' : responseCount === 2 ? 'is-amber' : responseCount === 1 ? 'is-cyan' : 'is-emerald';
            return (
            <div key={req.id} className={`community-cell mentor-req-card ${densityClass}`}>
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div className="flex gap-3 items-start">
                    <button
                      type="button"
                      className="avatar sm"
                      style={{ width: '36px', height: '36px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => navigate(`/members/${req.contributorId}`)}
                      title={`View ${req.requesterName}'s profile / ID`}
                      aria-label={`View ${req.requesterName}'s profile`}
                    >
                      {req.avatar ? <img src={req.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : getUserInitials(req.requesterName)}
                    </button>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {req.requesterName}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                          • Batch {req.batch} • {req.department}
                        </span>
                      </h3>
                      <p style={{ display: 'inline-block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5, padding: '4px 10px', border: '1px dotted var(--border-primary)', borderRadius: '8px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Topics:</strong> {req.topic}
                      </p>
                      {req.description && (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '600px', lineHeight: 1.5 }}>
                          {req.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mentor-req-head-right">
                    {(user?.role === 'admin' || req.contributorId === user?.id) && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(req)} style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  <span>Posted {formatPostedDate(req.postedAt)}</span>
                  <span style={{ fontSize: '9px', letterSpacing: '0.04em' }}>{responseCount} {responseCount === 1 ? 'response' : 'responses'}</span>
                </p>

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

              {req.contributorId !== user?.id && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '10px', marginLeft: '48px', fontSize: '10px' }}
                  onClick={() => handleRespondAsMentor(req)}
                >
                  <Mail size={12} /> Respond as Mentor
                </button>
              )}
              {respondTarget?.id === req.id && (
                <form onSubmit={handleRespondSubmit} style={{ marginTop: '10px', marginLeft: '48px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                  <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    Your response *
                    <textarea className="input" value={respondForm.message} onChange={(e) => setRespondForm((c) => ({ ...c, message: e.target.value }))} placeholder="How can you help? (also sent as a DM)" rows={2} required autoFocus />
                  </label>
                  <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    Contact (optional)
                    <input className="input" value={respondForm.contact} onChange={(e) => setRespondForm((c) => ({ ...c, contact: e.target.value }))} placeholder="Phone / Telegram / Email" />
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRespondTarget(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm"><Mail size={12} /> Send Response</button>
                  </div>
                </form>
              )}
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
