import { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle, ArrowBigUp, ArrowBigDown, Hash, Send,
  RefreshCw, CornerDownRight, Ghost, Share2, MoreHorizontal, Trash2, Edit3,
} from 'lucide-react';
import {
  getShadowIdentity, regenerateShadowNickname, shadowInitials,
} from '../../utils/shadowName';
import SharePostCard from './SharePostCard';
import './AustedditPage.css';
import '../../components/PageHero.css';

const POSTS_KEY = 'aust-buzz-posts';
const VOTES_KEY = 'aust-buzz-votes'; // { [postOrCommentId]: 1 | -1 }

const CHANNELS = [
  { id: 'general',    label: 'General' },
  { id: 'academic',   label: 'Academic' },
  { id: 'confession', label: 'Confession' },
  { id: 'campus',     label: 'Campus' },
  { id: 'memes',      label: 'Memes' },
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
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [activeChannel, setActiveChannel] = useState('all');
  const [sort, setSort] = useState('hot'); // hot | new
  const [openComments, setOpenComments] = useState({}); // { [postId]: true }
  const [commentDrafts, setCommentDrafts] = useState({}); // { [postId]: string }
  const [sharePost, setSharePost] = useState(null);   // post currently being shared
  const [openPostMenu, setOpenPostMenu] = useState(null); // post id with options menu open
  const [editingPostId, setEditingPostId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', body: '', channel: 'general' });
  const [popCounts, setPopCounts] = useState({});     // { [id]: n } — replays the score-pop animation

  useEffect(() => { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); }, [posts]);
  useEffect(() => { localStorage.setItem(VOTES_KEY, JSON.stringify(votes)); }, [votes]);

  useEffect(() => {
    const closeMenu = () => setOpenPostMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  // Refresh relative timestamps periodically.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const handleRegenerate = () => setIdentity(regenerateShadowNickname());

  const handleStartEdit = (post) => {
    if (post.authorId !== identity.id) return;
    setEditDraft({
      title: post.title || '',
      body: post.body || '',
      channel: post.channel || 'general',
    });
    setEditingPostId(post.id);
    setOpenPostMenu(null);
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditDraft({ title: '', body: '', channel: 'general' });
  };

  const handleSaveEdit = (event, postId) => {
    event.preventDefault();
    const nextTitle = editDraft.title.trim();
    const nextBody = editDraft.body.trim();
    if (!nextTitle && !nextBody) return;

    setPosts((prev) => prev.map((post) => (
      post.id === postId
        ? { ...post, title: nextTitle, body: nextBody, channel: editDraft.channel }
        : post
    )));
    handleCancelEdit();
  };

  const handleDeletePost = (post) => {
    if (post.authorId !== identity.id) return;
    if (!window.confirm('Delete this post? This action cannot be undone.')) return;

    setPosts((prev) => prev.filter((item) => item.id !== post.id));
    setVotes((prev) => {
      const next = { ...prev };
      delete next[post.id];
      post.comments.forEach((comment) => delete next[comment.id]);
      return next;
    });
    setOpenComments((prev) => {
      const next = { ...prev };
      delete next[post.id];
      return next;
    });
    setCommentDrafts((prev) => {
      const next = { ...prev };
      delete next[post.id];
      return next;
    });
    setOpenPostMenu(null);
  };

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
    setIsComposerExpanded(false);
  };

  const handleCancelPost = () => {
    setTitle('');
    setBody('');
    setIsComposerExpanded(false);
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
    // Bump the pop counter so the score's CSS animation replays on remount.
    setPopCounts((prev) => ({ ...prev, [targetId]: (prev[targetId] || 0) + 1 }));
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
    const list = activeChannel === 'all'
      ? [...posts]
      : posts.filter((p) => p.channel === activeChannel);

    const toTimestamp = (value) => {
      const numericValue = Number(value);
      if (value !== null && value !== '' && Number.isFinite(numericValue)) return numericValue;
      return new Date(value).getTime() || 0;
    };

    list.sort((a, b) => {
      const timeA = toTimestamp(a.timestamp);
      const timeB = toTimestamp(b.timestamp);

      if (sort === 'hot') {
        const scoreA = Number(a.score) || 0;
        const scoreB = Number(b.score) || 0;
        return scoreB - scoreA || timeB - timeA;
      }

      return timeB - timeA;
    });

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
      {!isComposerExpanded ? (
        <button
          type="button"
          className="buzz-composer buzz-composer-mini"
          onClick={() => setIsComposerExpanded(true)}
          aria-label="Write a new anonymous post"
        >
          <span className="buzz-mini-avatar">{shadowInitials(identity.nickname)}</span>
          <span className="buzz-mini-prompt">What’s on your mind, {identity.nickname}?</span>
          <Send size={16} className="buzz-mini-send" aria-hidden="true" />
        </button>
      ) : (
        <form className="buzz-composer" onSubmit={handleCreatePost}>
          <div className="buzz-channel-row">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`buzz-channel-chip ${channel === c.id ? 'active' : ''}`}
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
            <div className="buzz-composer-actions">
              <button type="button" className="buzz-cancel-btn" onClick={handleCancelPost}>
                Cancel
              </button>
              <button type="submit" className="buzz-post-btn" disabled={!title.trim() && !body.trim()}>
                Post <Send size={13} />
              </button>
            </div>
          </div>
        </form>
      )}

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
              {post.authorId === identity.id && (
                <div className="buzz-post-menu-wrap" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className={`buzz-post-menu-btn ${openPostMenu === post.id ? 'active' : ''}`}
                    onClick={() => setOpenPostMenu((current) => current === post.id ? null : post.id)}
                    aria-label="Post options"
                    aria-haspopup="menu"
                    aria-expanded={openPostMenu === post.id}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {openPostMenu === post.id && (
                    <div className="buzz-post-menu" role="menu">
                      <button
                        type="button"
                        className="buzz-post-menu-item"
                        onClick={() => handleStartEdit(post)}
                        role="menuitem"
                      >
                        <Edit3 size={14} /> Edit post
                      </button>
                      <button
                        type="button"
                        className="buzz-post-menu-item danger"
                        onClick={() => handleDeletePost(post)}
                        role="menuitem"
                      >
                        <Trash2 size={14} /> Delete post
                      </button>
                    </div>
                  )}
                </div>
              )}

              {editingPostId === post.id ? (
                <form className="buzz-post-main buzz-edit-form" onSubmit={(event) => handleSaveEdit(event, post.id)}>
                  <div className="buzz-channel-row">
                    {CHANNELS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`buzz-channel-chip ${editDraft.channel === c.id ? 'active' : ''}`}
                        onClick={() => setEditDraft((prev) => ({ ...prev, channel: c.id }))}
                      >
                        <Hash size={12} /> {c.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="buzz-title-input"
                    placeholder="Title"
                    value={editDraft.title}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, title: event.target.value }))}
                    maxLength={160}
                  />
                  <textarea
                    className="buzz-body-input"
                    placeholder="Share your thoughts anonymously…"
                    value={editDraft.body}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, body: event.target.value }))}
                    rows={4}
                    maxLength={2000}
                  />
                  <div className="buzz-composer-actions buzz-edit-actions">
                    <button type="button" className="buzz-cancel-btn" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="buzz-post-btn"
                      disabled={!editDraft.title.trim() && !editDraft.body.trim()}
                    >
                      Save <Send size={13} />
                    </button>
                  </div>
                </form>
              ) : (
                /* Post content */
                <div className="buzz-post-main">
                <div className="buzz-post-meta">
                  <div className="buzz-post-byline">
                    <span className="buzz-post-author">{post.author}</span>
                    <span className="buzz-post-dot">·</span>
                    <span className="buzz-post-time">{getTimeAgo(post.timestamp)}</span>
                  </div>
                  <span className="buzz-post-channel">
                    <Hash size={11} /> {meta.label}
                  </span>
                </div>
                {post.title && <h3 className="buzz-post-title">{post.title}</h3>}
                {post.body && <p className="buzz-post-body">{post.body}</p>}

                {/* Action row — comment, share, votes on one line */}
                <div className="buzz-post-actions">
                  <div className="buzz-post-actions-left">
                    <button className="buzz-comment-toggle" onClick={() => toggleComments(post.id)}>
                      <MessageCircle size={14} /> {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
                    </button>
                    <button
                      className="buzz-share-toggle"
                      onClick={() => setSharePost(post)}
                      title="Generate a shareable post card"
                    >
                      <Share2 size={14} /> Share
                    </button>
                  </div>

                  {/* Vote rail — aligned to the right */}
                  <div className="buzz-votes">
                    <button
                      key={`${post.id}-up-${popCounts[post.id] || 0}`}
                      className={`buzz-vote-btn up ${myVote === 1 ? 'active' : ''}${popCounts[post.id] ? ' pop' : ''}`}
                      onClick={() => votePost(post.id, 1)}
                      aria-label="Upvote"
                    >
                      <ArrowBigUp size={18} />
                    </button>
                    <span
                      key={`${post.id}-score-${popCounts[post.id] || 0}`}
                      className={`buzz-score ${myVote === 1 ? 'up' : myVote === -1 ? 'down' : ''}${popCounts[post.id] ? ' pop' : ''}`}
                    >
                      {post.score}
                    </span>
                    <button
                      key={`${post.id}-down-${popCounts[post.id] || 0}`}
                      className={`buzz-vote-btn down ${myVote === -1 ? 'active' : ''}${popCounts[post.id] ? ' pop' : ''}`}
                      onClick={() => votePost(post.id, -1)}
                      aria-label="Downvote"
                    >
                      <ArrowBigDown size={18} />
                    </button>
                  </div>
                </div>

                {/* Comments — list first, then the reply box */}
                {open && (
                  <div className="buzz-comments">
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
                                    key={`${c.id}-up-${popCounts[c.id] || 0}`}
                                    className={`buzz-cvote up ${cVote === 1 ? 'active' : ''}${popCounts[c.id] ? ' pop' : ''}`}
                                    onClick={() => voteComment(post.id, c.id, 1)}
                                    aria-label="Upvote comment"
                                  >
                                    <ArrowBigUp size={15} />
                                  </button>
                                  <span
                                    key={`${c.id}-score-${popCounts[c.id] || 0}`}
                                    className={`buzz-cscore${popCounts[c.id] ? ' pop' : ''}`}
                                  >
                                    {c.score}
                                  </span>
                                  <button
                                    key={`${c.id}-down-${popCounts[c.id] || 0}`}
                                    className={`buzz-cvote down ${cVote === -1 ? 'active' : ''}${popCounts[c.id] ? ' pop' : ''}`}
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

                    {/* Reply box pinned at the bottom of the thread */}
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
                  </div>
                )}
              </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Shareable post card modal */}
      {sharePost && (
        <SharePostCard
          post={sharePost}
          timeAgo={getTimeAgo(sharePost.timestamp)}
          onClose={() => setSharePost(null)}
        />
      )}
    </div>
  );
}
