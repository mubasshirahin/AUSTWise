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

function AvatarImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt="" onError={() => setFailed(true)} />;
  return <span>{getUserInitials(name)}</span>;
}

function ResponseList({ responses, emptyText }) {
  if (!responses?.length) {
    return emptyText ? <p className="mentor-card-empty">{emptyText}</p> : null;
  }
  return (
    <div className="mentor-card-responses">
      {responses.map((res) => (
        <div key={res.id} className="mentor-card-response">
          <div className="mentor-card-response-head">
            <span className="mentor-card-response-name">
              {res.responderName} <span>· Batch {res.responderBatch}</span>
            </span>
            <span className="mentor-card-response-date">{formatPostedDate(res.postedAt)}</span>
          </div>
          <p>{res.message}</p>
          {res.contact && <p className="mentor-card-response-contact">Contact: {res.contact}</p>}
        </div>
      ))}
    </div>
  );
}

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
              <article key={req.id} className="community-cell mentor-req-card">
                <div className="mentor-card-body">
                  <span className="mentor-req-topic"><UserCheck size={12} /> {req.topic}</span>
                  {req.description && <p className="mentor-card-desc">{req.description}</p>}
                </div>
                <ResponseList
                  responses={req.responses}
                  emptyText="No responses yet — mentors will see your post in the Feed."
                />
                <footer className="mentor-card-foot">
                  <span className="mentor-card-count">Posted {formatPostedDate(req.postedAt)}</span>
                  <span className="mentor-card-count">{req.responses?.length || 0} response{req.responses?.length === 1 ? '' : 's'}</span>
                </footer>
              </article>
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
            const responseCount = (req.responses || []).length;
            const canDelete = user?.role === 'admin' || req.contributorId === user?.id;
            const isResponding = respondTarget?.id === req.id;
            return (
            <article key={req.id} className="community-cell mentor-req-card">
              <header className="mentor-card-head">
                <button
                  type="button"
                  className="mentor-card-avatar"
                  onClick={() => navigate(`/members/${req.contributorId}`)}
                  title={`View ${req.requesterName}'s profile / ID`}
                  aria-label={`View ${req.requesterName}'s profile`}
                >
                  <AvatarImage src={req.avatar} name={req.requesterName} />
                </button>
                <div className="mentor-card-who">
                  <h3 className="mentor-card-name">{req.requesterName}</h3>
                  <p className="mentor-card-meta">Batch {req.batch} · {req.department} · {formatPostedDate(req.postedAt)}</p>
                </div>
                {canDelete && (
                  <button type="button" className="mentor-card-icon-btn" onClick={() => handleDelete(req)} title="Delete request" aria-label="Delete request">
                    <Trash2 size={14} />
                  </button>
                )}
              </header>

              <div className="mentor-card-body">
                <span className="mentor-req-topic"><UserCheck size={12} /> {req.topic}</span>
                {req.description && <p className="mentor-card-desc">{req.description}</p>}
              </div>

              <ResponseList responses={req.responses} />

              <footer className="mentor-card-foot">
                <span className="mentor-card-count">{responseCount} {responseCount === 1 ? 'response' : 'responses'}</span>
                {req.contributorId !== user?.id && !isResponding && (
                  <button type="button" className="mentor-card-respond" onClick={() => handleRespondAsMentor(req)}>
                    <Mail size={12} /> Respond as Mentor
                  </button>
                )}
              </footer>

              {isResponding && (
                <form onSubmit={handleRespondSubmit} className="mentor-card-form">
                  <label>
                    Your response *
                    <textarea className="input" value={respondForm.message} onChange={(e) => setRespondForm((c) => ({ ...c, message: e.target.value }))} placeholder="How can you help? (also sent as a DM)" rows={2} required autoFocus />
                  </label>
                  <label>
                    Contact (optional)
                    <input className="input" value={respondForm.contact} onChange={(e) => setRespondForm((c) => ({ ...c, contact: e.target.value }))} placeholder="Phone / Telegram / Email" />
                  </label>
                  <div className="mentor-card-form-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRespondTarget(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm"><Mail size={12} /> Send Response</button>
                  </div>
                </form>
              )}
            </article>
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
