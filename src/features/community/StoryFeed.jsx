import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Lightbulb, Smile, Heart, Flame } from 'lucide-react';
import { getShadowIdentity } from '../../utils/shadowName';

const STORAGE_KEY = 'austwise_posts';
const REACTIONS_KEY = 'austwise_reactions';
const VISITOR_KEY = 'austwise_visitor_id';

const getVisitorId = () => {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};

const categoryMeta = {
  confession: { Icon: MessageSquare, color: '#a855f7', label: 'Confession' },
  funny:      { Icon: Smile, color: '#f59e0b', label: 'Funny' },
  helpful:    { Icon: Lightbulb, color: '#10b981', label: 'Helpful' },
  appreciation: { Icon: Heart, color: '#f43f5e', label: 'Appreciation' },
};

const reactionIcons = { laugh: Smile, heart: Heart, fire: Flame };

const getTimeAgo = (timestamp) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

export default function StoryFeed() {
  const visitorId = getVisitorId();

  const [posts, setPosts] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [userReactions, setUserReactions] = useState(() => {
    try {
      const stored = localStorage.getItem(REACTIONS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const [newPostContent, setNewPostContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('confession');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(userReactions));
  }, [userReactions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosts(prev => prev.map(p => ({
        ...p,
        time: getTimeAgo(p.timestamp),
      })));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filterCategories = ['All', ...Object.keys(categoryMeta)];
  const postCategories = Object.keys(categoryMeta);

  const filteredPosts = activeFilter === 'All'
    ? posts
    : posts.filter(p => p.category === activeFilter);

  const handlePostSubmit = (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    const newPost = {
      id: Date.now() + Math.random(),
      content: newPostContent.trim(),
      category: selectedCategory,
      author: getShadowIdentity().nickname,
      reactions: { laugh: 0, heart: 0, fire: 0 },
      timestamp: Date.now(),
      time: 'Just now',
      comments: 0,
    };

    setPosts([newPost, ...posts]);
    setNewPostContent('');
  };

  const handleReact = (postId, reactionType) => {
    const key = `${postId}-${reactionType}`;
    const userSet = userReactions[visitorId] || [];
    const hasReacted = userSet.includes(key);

    setUserReactions(prev => ({
      ...prev,
      [visitorId]: hasReacted
        ? userSet.filter(k => k !== key)
        : [...userSet, key],
    }));

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        reactions: {
          ...p.reactions,
          [reactionType]: p.reactions[reactionType] + (hasReacted ? -1 : 1),
        },
      };
    }));
  };

  return (
    <div className="glass-card-static story-feed-container animate-fadeInUp">
      {/* Create post form */}
      <form onSubmit={handlePostSubmit} className="story-feed-form">
        <div className="story-feed-form-header">
          <span className="form-header-icon"><MessageSquare size={16} /></span>
          <span>Share something anonymously</span>
        </div>

        {/* Category selector */}
        <div className="story-feed-category-row">
          {postCategories.map(cat => {
            const meta = categoryMeta[cat];
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className="story-feed-category-btn"
                style={{
                  borderColor: active ? meta.color : undefined,
                  background: active ? meta.color + '20' : undefined,
                  color: active ? meta.color : undefined,
                }}
              >
                <meta.Icon size={14} /> {meta.label}
              </button>
            );
          })}
        </div>

        <textarea
          placeholder="What's on your mind?"
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          rows="3"
          className="story-feed-textarea"
        />
        <div className="story-feed-form-footer">
          <span className="story-feed-form-hint">Keep reports civil. Posts are anonymous.</span>
          <button type="submit" className="btn btn-primary btn-sm story-feed-form-submit">
            Post <Send size={12} />
          </button>
        </div>
      </form>

      {/* Category filters */}
      <div className="story-feed-filters">
        {filterCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`tag story-feed-filter-btn ${activeFilter === cat ? 'active' : ''}`}
          >
            {cat === 'All' ? 'All' : (() => { const CIcon = categoryMeta[cat].Icon; return <><CIcon size={12} /> {cat}</>; })()}
          </button>
        ))}
      </div>

      {/* Post feed list */}
      <div className="story-feed-list">
        {filteredPosts.length === 0 && (
          <div className="story-feed-empty">
            <div className="story-feed-empty-icon"><MessageSquare size={24} /></div>
            <h4>No posts yet</h4>
            <p>
              {activeFilter === 'All'
                ? 'Be the first to share something!'
                : `No ${activeFilter} posts yet. Be the first to share one!`}
            </p>
          </div>
        )}
        {filteredPosts.map(post => {
          const meta = categoryMeta[post.category] || categoryMeta.confession;
          return (
            <div key={post.id} className="story-feed-post animate-fadeIn">
              {/* Shine overlay */}
              <div className="post-shine" aria-hidden="true" />
              <div className="story-feed-post-header">
                <span
                  className="story-feed-post-category"
                  style={{
                    background: meta.color + '20',
                    color: meta.color,
                  }}
                >
                  <meta.Icon size={12} /> {post.category}
                </span>
                <span className="story-feed-post-author">{post.author || 'Anonymous'}</span>
                <span className="story-feed-post-time">{post.time}</span>
              </div>

              <p className="story-feed-post-content">{post.content}</p>

              <div className="story-feed-post-footer">
                <div className="story-feed-reactions">
                  {Object.entries(reactionIcons).map(([type, IconComponent]) => {
                    const hasReacted = (userReactions[visitorId] || []).includes(`${post.id}-${type}`);
                    return (
                      <button
                        key={type}
                        onClick={() => handleReact(post.id, type)}
                        className="story-feed-reaction-btn"
                        style={{
                          background: hasReacted ? meta.color + '20' : undefined,
                          color: hasReacted ? meta.color : undefined,
                          fontWeight: hasReacted ? 600 : undefined,
                        }}
                      >
                        <IconComponent size={14} /> {post.reactions[type]}
                      </button>
                    );
                  })}
                </div>

                <span className="story-feed-comment-count">
                  <MessageSquare size={12} /> {post.comments}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
