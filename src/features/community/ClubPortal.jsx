import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Target, Users, Search, PlusCircle, CheckCircle, X,
  Calendar, Award, User, ExternalLink, ChevronDown, ChevronUp,
  Code, Trophy, Bot, Music, Palette, Camera, Heart, Gamepad2,
  BookOpen, Leaf, Briefcase, MessageCircle, Shield,
  Star, Sparkles, TrendingUp, Clock, Hash,
} from 'lucide-react';
import { clubsData } from '../../data/mockData';

const clubIcons = {
  code: Code,
  trophy: Trophy,
  bot: Bot,
  music: Music,
  palette: Palette,
  camera: Camera,
  dove: Heart,
  gamepad: Gamepad2,
  book: BookOpen,
  leaf: Leaf,
  briefcase: Briefcase,
  heart: Heart,
  message: MessageCircle,
  shield: Shield,
};

export default function ClubPortal() {
  const [clubs, setClubs] = useState(clubsData);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClub, setExpandedClub] = useState(null);
  const searchRef = useRef(null);

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleJoinToggle = (clubId) => {
    setClubs(prev => prev.map(c => {
      if (c.id === clubId) {
        return { ...c, joined: !c.joined, members: c.joined ? c.members - 1 : c.members + 1 };
      }
      return c;
    }));
  };

  const filteredClubs = useMemo(() => {
    let result = [...clubs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.acronym.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.focus.some(f => f.toLowerCase().includes(q))
      );
    }

    return result;
  }, [clubs, searchQuery]);

  const stats = useMemo(() => ({
    total: clubs.length,
    totalMembers: clubs.reduce((sum, c) => sum + c.members, 0),
    joinedCount: clubs.filter(c => c.joined).length,
    joinedMembers: clubs.filter(c => c.joined).reduce((sum, c) => sum + c.members, 0),
  }), [clubs]);

  const toggleExpand = (id) => {
    setExpandedClub(prev => prev === id ? null : id);
  };

  const getIconComponent = (iconName) => {
    const Icon = clubIcons[iconName] || Target;
    return Icon;
  };

  return (
    <div className="clubs-page">
      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="clubs-header-icon">
            <Target size={24} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <h2 className="clubs-header-title">Clubs Hub</h2>
            <p className="clubs-header-subtitle">
              Explore {clubs.length} active AUST student clubs — discover your passion, connect with peers, and build your campus life
            </p>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{stats.total}</span>
              <span className="schedule-stat-label">Clubs</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{stats.totalMembers.toLocaleString()}</span>
              <span className="schedule-stat-label">Members</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value schedule-stat-joined">{stats.joinedCount}</span>
              <span className="schedule-stat-label">Joined</span>
            </div>
            {stats.joinedCount > 0 && (
              <div className="schedule-stat">
                <span className="schedule-stat-value">{stats.joinedMembers.toLocaleString()}</span>
                <span className="schedule-stat-label">Network Reach</span>
              </div>
            )}
          </div>
        </div>

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* ── Controls Bar ── */}
      <div className="clubs-controls">
        <div className="clubs-search">
          <Search size={16} />
          <input
            ref={searchRef}
            type="text"
            className="clubs-search-input"
            placeholder="Search clubs by name, keyword, or focus area..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clubs-search-clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
          <kbd className="clubs-search-kbd">Ctrl+K</kbd>
        </div>


      </div>

      {/* ── Clubs Grid ── */}
      {filteredClubs.length === 0 ? (
        <div className="clubs-empty">
          <div className="clubs-empty-icon">
            <Search size={32} />
          </div>
          <h3>No clubs found</h3>
          <p>
            {searchQuery
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'No clubs match your search.'}
          </p>
          {searchQuery && (
            <button className="btn btn-primary" onClick={() => { setSearchQuery(''); }}>
              <X size={16} /> Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="clubs-grid stagger-children">
          {filteredClubs.map((club, idx) => {
            const Icon = getIconComponent(club.icon);
            const isExpanded = expandedClub === club.id;

            // "Load" indicator: a club's reach is the number of social links.
            // 0 → emerald · 1 → cyan · 2 → amber · 3+ → rose (matches sv-cell density).
            const socialCount = Object.values(club.socialLinks || {}).filter(Boolean).length;
            const densityClass = socialCount >= 3 ? 'is-rose' : socialCount === 2 ? 'is-amber' : socialCount === 1 ? 'is-cyan' : 'is-emerald';

            return (
              <div
                key={club.id}
                className={`clubs-card animate-fadeInUp ${club.joined ? 'clubs-card-joined' : ''} ${densityClass}`}
                style={{ animationDelay: `${(idx % 6) * 60}ms` }}
              >
                {/* Top accent bar is hidden in CSS — density lives on the left border */}
                <div className="clubs-card-accent" />

                <div className="clubs-card-body">
                  {/* Logo + header */}
                  <div className="clubs-card-head">
                    <div className="clubs-card-logo" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                      <Icon size={22} />
                    </div>
                    <div className="clubs-card-head-text">
                      <h3 className="clubs-card-name">{club.name}</h3>
                      <span className="clubs-card-acronym">{club.acronym}</span>
                    </div>
                    <span className="clubs-card-badge">
                      {club.members.toLocaleString()}
                      <Users size={12} />
                    </span>
                  </div>

                  {/* Description */}
                  <p className="clubs-card-desc">
                    {isExpanded ? club.description : `${club.description.slice(0, 100)}...`}
                  </p>
                  {club.description.length > 100 && (
                    <button className="clubs-card-expand" onClick={() => toggleExpand(club.id)}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}

                  {/* Focus tags */}
                  <div className="clubs-card-focus">
                    {club.focus.map(f => (
                      <span key={f} className="clubs-card-tag">{f}</span>
                    ))}
                  </div>

                  {/* Details (collapsible on mobile, always visible on desktop) */}
                  <div className={`clubs-card-details ${isExpanded ? 'expanded' : ''}`}>
                    <div className="clubs-card-detail">
                      <Calendar size={13} />
                      <span><strong>Meeting:</strong> {club.meetingDay}</span>
                    </div>
                    <div className="clubs-card-detail">
                      <Clock size={13} />
                      <span><strong>Next:</strong> {club.nextEvent}</span>
                    </div>
                    <div className="clubs-card-detail">
                      <User size={13} />
                      <span><strong>Advisor:</strong> {club.advisor}</span>
                    </div>
                    <div className="clubs-card-detail">
                      <Award size={13} />
                      <span><strong>Since:</strong> {club.founded}</span>
                    </div>
                  </div>

                  {/* Achievement preview */}
                  {club.achievements && club.achievements.length > 0 && (
                    <div className="clubs-card-achievements">
                      <Sparkles size={12} />
                      <span>{club.achievements[0]}</span>
                    </div>
                  )}
                </div>

                {/* Action footer */}
                <div className="clubs-card-footer">
                  <div className="clubs-card-social">
                    {club.socialLinks?.facebook && (
                      <a href={club.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="clubs-social-link" title="Facebook">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {club.socialLinks?.discord && (
                      <a href={club.socialLinks.discord} target="_blank" rel="noopener noreferrer" className="clubs-social-link" title="Discord">
                        <MessageCircle size={13} />
                      </a>
                    )}
                    {club.socialLinks?.linkedin && (
                      <a href={club.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="clubs-social-link" title="LinkedIn">
                        <Briefcase size={13} />
                      </a>
                    )}
                  </div>
                  <button
                    className={`clubs-join-btn ${club.joined ? 'joined' : ''}`}
                    onClick={() => handleJoinToggle(club.id)}
                  >
                    {club.joined ? (
                      <><CheckCircle size={15} /> Joined</>
                    ) : (
                      <><PlusCircle size={15} /> Join</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
