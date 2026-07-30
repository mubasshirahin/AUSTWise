import { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle, ArrowBigUp, ArrowBigDown, Hash, Send,
  RefreshCw, CornerDownRight, Ghost,
} from 'lucide-react';
import {
  getShadowIdentity, regenerateShadowNickname, shadowInitials,
} from '../../utils/shadowName';
import './AustedditPage.css';
import '../../components/PageHero.css';

const POSTS_KEY = 'aust-buzz-posts';
const VOTES_KEY = 'aust-buzz-votes'; // { [postOrCommentId]: 1 | -1 }

const CHANNELS = [
  { id: 'general',    label: 'General',    color: '#f59e0b' },
  { id: 'academic',   label: 'Academic',   color: '#3b82f6' },
  { id: 'confession', label: 'Confession', color: '#a855f7' },
  { id: 'campus',     label: 'Campus',     color: '#10b981' },
  { id: 'memes',      label: 'Memes',      color: '#f43f5e' },
];

const channelMeta = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[0];

function getTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const loadPosts = () => {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const loadVotes = () => {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export default function AustedditPage() {
  const [identity, setIdentity] = useState(getShadowIdentity);
  const [posts, setPosts] = useState(loadPosts);
  const [votes, setVotes] = useState(loadVotes);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('general');
  const [activeChannel, setActiveChannel] = useState('all');
  const [sort, setSort] = useState('hot'); // hot | new
  const [openComments, setOpenComments] = useState({}); // { [postId]: true }
  const [commentDrafts, setCommentDrafts] = useState({}); // { [postId]: string }

  useEffect(() => { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); }, [posts]);
  useEffect(() => { localStorage.setItem(VOTES_KEY, JSON.stringify(votes)); }, [votes]);

  // Refresh relative timestamps periodically.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const handleRegenerate = () => setIdentity(regenerateShadowNickname());

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    const post = {
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      body: body.trim(),
      channel,
      authorId: identity.id,
      author: identity.nickname,
      score: 1,             // author's implicit upvote
      timestamp: Date.now(),
      comments: [],
    };
    // Author auto-upvotes their own post.
    setVotes((prev) => ({ ...prev, [post.id]: 1 }));
    setPosts((prev) => [post, ...prev]);
    setTitle('');
    setBody('');
  };

  // Applies a vote (+1/-1) to a post or a comment, toggling if the same vote is repeated.
  const applyVote = (targetId, dir, updater) => {
    const current = votes[targetId] || 0;
    const next = current === dir ? 0 : dir;
    const delta = next - current;
    setVotes((prev) => {
      const copy = { ...prev };
      if (next === 0) delete copy[targetId];
      else copy[targetId] = next;
      return copy;
    });
    updater(delta);
  };

  const votePost = (postId, dir) => {
    applyVote(postId, dir, (delta) =>
      setPosts((prev) => prev.map((p) =>
        p.id === postId ? { ...p, score: p.score + delta } : p)));
  };

  const voteComment = (postId, commentId, dir) => {
    applyVote(commentId, dir, (delta) =>
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: p.comments.map((c) =>
            c.id === commentId ? { ...c, score: c.score + delta } : c),
        };
      })));
  };

  const toggleComments = (postId) =>
    setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }));

  const submitComment = (postId) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    const comment = {
      id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      authorId: identity.id,
      author: identity.nickname,
      score: 1,
      timestamp: Date.now(),
    };
    setVotes((prev) => ({ ...prev, [comment.id]: 1 }));
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, comments: [...p.comments, comment] } : p));
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const visiblePosts = useMemo(() => {
    let list = activeChannel === 'all'
      ? posts
      : posts.filter((p) => p.channel === activeChannel);
    list = [...list];
    if (sort === 'hot') list.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
    else list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [posts, activeChannel, sort]);

  return (
    <div className="aed-page animate-fadeIn">
      {/* ── Identity bar ── */}
      <div className="buzz-identity">
        <div className="buzz-identity-left">
          <div className="buzz-avatar">{shadowInitials(identity.nickname)}</div>
          <div className="buzz-identity-info">
            <span className="buzz-identity-label"><Ghost size={11} /> Posting as</span>
            <span className="buzz-identity-name">{identity.nickname}</span>
          </div>
        </div>
        <button type="button" className="buzz-regen-btn" onClick={handleRegenerate} title="Get a new nickname">
          <RefreshCw size={13} /> New name
        </button>
      </div>

      {/* ── Composer ── */}
      <form className="buzz-composer" onSubmit={handleCreatePost}>
        <div className="buzz-channel-row">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`buzz-channel-chip ${channel === c.id ? 'active' : ''}`}
              style={channel === c.id ? { borderColor: c.color, background: c.color + '20', color: c.color } : undefined}
              onClick={() => setChannel(c.id)}
            >
              <Hash size={12} /> {c.label}
            </button>
          ))}
        </div>
        <input
          className="buzz-title-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
        />
        <textarea
          className="buzz-body-input"
          placeholder="Share your thoughts anonymously…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
        />
        <div className="buzz-composer-footer">
          <span className="buzz-composer-hint">Keep it civil. Everyone's anonymous.</span>
          <button type="submit" className="buzz-post-btn" disabled={!title.trim() && !body.trim()}>
            Post <Send size={13} />
          </button>
        </div>
      </form>

      {/* ── Filter / sort bar ── */}
      <div className="buzz-toolbar">
        <div className="buzz-filters">
          <button
            className={`buzz-filter ${activeChannel === 'all' ? 'active' : ''}`}
            onClick={() => setActiveChannel('all')}
          >
            All
          </button>
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              className={`buzz-filter ${activeChannel === c.id ? 'active' : ''}`}
              onClick={() => setActiveChannel(c.id)}
            >
              <Hash size={11} /> {c.label}
            </button>
          ))}
        </div>
        <div className="buzz-sort">
          <button className={sort === 'hot' ? 'active' : ''} onClick={() => setSort('hot')}>Hot</button>
          <button className={sort === 'new' ? 'active' : ''} onClick={() => setSort('new')}>New</button>
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="buzz-feed">
        {visiblePosts.length === 0 && (
          <div className="buzz-empty">
            <MessageCircle size={26} />
            <h4>No buzz yet</h4>
            <p>Be the first to post in this channel.</p>
          </div>
        )}

        {visiblePosts.map((post) => {
          const meta = channelMeta(post.channel);
          const myVote = votes[post.id] || 0;
          const open = !!openComments[post.id];
          return (
            <article key={post.id} className="buzz-post">
              {/* Vote rail */}
              <div className="buzz-votes">
                <button
                  className={`buzz-vote-btn up ${myVote === 1 ? 'active' : ''}`}
                  onClick={() => votePost(post.id, 1)}
                  aria-label="Upvote"
                >
                  <ArrowBigUp size={20} />
                </button>
                <span className={`buzz-score ${myVote === 1 ? 'up' : myVote === -1 ? 'down' : ''}`}>
                  {post.score}
                </span>
                <button
                  className={`buzz-vote-btn down ${myVote === -1 ? 'active' : ''}`}
                  onClick={() => votePost(post.id, -1)}
                  aria-label="Downvote"
                >
                  <ArrowBigDown size={20} />
                </button>
              </div>

              {/* Post content */}
              <div className="buzz-post-main">
                <div className="buzz-post-meta">
                  <span className="buzz-post-channel" style={{ background: meta.color + '20', color: meta.color }}>
                    <Hash size={11} /> {meta.label}
                  </span>
                  <span className="buzz-post-author">{post.author}</span>
                  <span className="buzz-post-dot">·</span>
                  <span className="buzz-post-time">{getTimeAgo(post.timestamp)}</span>
                </div>
                {post.title && <h3 className="buzz-post-title">{post.title}</h3>}
                {post.body && <p className="buzz-post-body">{post.body}</p>}

                <div className="buzz-post-actions">
                  <button className="buzz-comment-toggle" onClick={() => toggleComments(post.id)}>
                    <MessageCircle size={14} /> {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
                  </button>
                </div>

                {/* Comments */}
                {open && (
                  <div className="buzz-comments">
                    <div className="buzz-comment-form">
                      <input
                        className="buzz-comment-input"
                        placeholder={`Comment as ${identity.nickname}…`}
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitComment(post.id); } }}
                        maxLength={1000}
                      />
                      <button
                        className="buzz-comment-send"
                        onClick={() => submitComment(post.id)}
                        disabled={!(commentDrafts[post.id] || '').trim()}
                      >
                        <Send size={13} />
                      </button>
                    </div>

                    {post.comments.length === 0 ? (
                      <p className="buzz-no-comments">No comments yet — start the thread.</p>
                    ) : (
                      [...post.comments]
                        .sort((a, b) => b.score - a.score || a.timestamp - b.timestamp)
                        .map((c) => {
                          const cVote = votes[c.id] || 0;
                          return (
                            <div key={c.id} className="buzz-comment">
                              <CornerDownRight size={13} className="buzz-comment-branch" />
                              <div className="buzz-comment-body">
                                <div className="buzz-comment-meta">
                                  <span className="buzz-comment-author">{c.author}</span>
                                  <span className="buzz-post-dot">·</span>
                                  <span className="buzz-comment-time">{getTimeAgo(c.timestamp)}</span>
                                </div>
                                <p className="buzz-comment-text">{c.text}</p>
                                <div className="buzz-comment-votes">
                                  <button
                                    className={`buzz-cvote up ${cVote === 1 ? 'active' : ''}`}
                                    onClick={() => voteComment(post.id, c.id, 1)}
                                    aria-label="Upvote comment"
                                  >
                                    <ArrowBigUp size={15} />
                                  </button>
                                  <span className="buzz-cscore">{c.score}</span>
                                  <button
                                    className={`buzz-cvote down ${cVote === -1 ? 'active' : ''}`}
                                    onClick={() => voteComment(post.id, c.id, -1)}
                                    aria-label="Downvote comment"
                                  >
                                    <ArrowBigDown size={15} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
