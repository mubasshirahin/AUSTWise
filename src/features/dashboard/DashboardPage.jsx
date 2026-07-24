import { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RoutineCard from './RoutineCard';
import ExamTracker from './ExamTracker';
import DeadlineTicker from './DeadlineTicker';
import NoticeBoard from './NoticeBoard';
import WeeklyPlanner from './WeeklyPlanner';
import WeekSchedule from './WeekSchedule';
import NotificationBanner from './NotificationBanner';
import RoutineAttendanceTracker from './RoutineAttendanceTracker';
import GliderTabs from '../../components/GliderTabs';
import { leaderboardData } from '../../data/mockData';
import {
  TrendingUp, Gauge, Percent, BookOpen,
  CalendarDays, Zap, AlertTriangle, Calendar,
  Hourglass, BellRing, Flame, X, Trophy, Medal, Award, Star, Target, Sparkles, Sun, BarChart3, UserCheck,
} from 'lucide-react';
import { getUserStorageItem, getCurrentUserId } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';
import './DashboardPage.css';
import './dashboard-premium.css';

const FOCUS_SECTIONS = {
  stats: ['stats', 'routine_day', 'deadlines', 'notices', 'notif'],
  routine: ['routine'],
  calendar: ['calendar'],
  exams: ['exams'],
  attendance: ['attendance'],
};

const storageKeyType = 'semesterResults';

/* ─── Study Streak Widget ─── */
function StudyStreak() {
  const [streak, setStreak] = useState(0);
  const [displayStreak, setDisplayStreak] = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aust-study-streak');
      const today = new Date().toDateString();

      if (stored) {
        const data = JSON.parse(stored);
        const lastActive = data.lastActive;

        if (lastActive === today) {
          setStreak(data.count || 0);
          setDisplayStreak(data.count || 0);
        } else {
          const lastDate = new Date(lastActive);
          const todayDate = new Date();
          const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            const newCount = (data.count || 0) + 1;
            setStreak(newCount);
            setDisplayStreak(data.count || 0);
            localStorage.setItem('aust-study-streak', JSON.stringify({ count: newCount, lastActive: today }));
            setJustUpdated(true);
          } else if (diffDays > 1) {
            setStreak(1);
            setDisplayStreak(1);
            localStorage.setItem('aust-study-streak', JSON.stringify({ count: 1, lastActive: today }));
            setJustUpdated(true);
          }
        }
      } else {
        setStreak(1);
        setDisplayStreak(1);
        localStorage.setItem('aust-study-streak', JSON.stringify({ count: 1, lastActive: today }));
        setJustUpdated(true);
      }
    } catch {}
  }, []);

  /* Animate displayStreak → streak */
  useEffect(() => {
    if (displayStreak === streak) return;
    const duration = 1200;
    const start = performance.now();
    const from = displayStreak;
    const to = streak;
    const raf = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayStreak(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [streak]);

  const getStreakMessage = () => {
    if (streak === 0) return 'Start your streak today!';
    if (streak === 1) return '1 day streak — keep going!';
    if (streak < 7) return `${streak} days — building momentum!`;
    if (streak < 30) return `${streak} days — on fire!`;
    return `${streak} days — legendary!`;
  };

  const getStreakColor = () => {
    if (streak === 0) return 'var(--text-tertiary)';
    if (streak < 3) return 'var(--accent-amber)';
    if (streak < 7) return 'var(--accent-orange)';
    if (streak < 30) return 'var(--accent-rose)';
    return 'var(--accent-amber)';
  };

  /* ─── Leaderboard modal ─── */
  const { myRank, rankList } = useMemo(() => {
    const joinedAt = user?.createdAt || new Date().toISOString();

    const allEntries = [...leaderboardData, {
      id: 'me', name: user?.name || 'You', dept: user?.department || '',
      streak, joinedAt,
    }];

    allEntries.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return new Date(a.joinedAt || '2020-01-01') - new Date(b.joinedAt || '2020-01-01');
    });

    const myIdx = allEntries.findIndex(e => e.id === 'me');
    const rank = myIdx !== -1 ? myIdx + 1 : null;
    const top100 = allEntries.slice(0, 100);

    return { myRank: rank, rankList: top100 };
  }, [user, streak]);

  const topThree = rankList.slice(0, 3);

  return (
    <>
      <div
        className={`study-streak-widget${justUpdated ? ' streak-updated' : ''}`}
        onClick={() => setShowLeaderboard(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setShowLeaderboard(true); }}
        title="Click to see leaderboard"
      >
        <div className="streak-flame" style={{ color: getStreakColor() }}>
          <Flame size={22} />
        </div>
        <div className="streak-info">
          <span className="streak-count" style={{ color: getStreakColor() }}>{displayStreak}</span>
          <span className="streak-label">{getStreakMessage()}</span>
        </div>
      </div>

      {showLeaderboard && createPortal(
        <div className="modal-overlay leaderboard-overlay" onClick={() => setShowLeaderboard(false)}>
          <div className="modal glass-card-static leaderboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leaderboard-header">
              <div className="leaderboard-header-left">
                <div className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                  <Award size={18} />
                </div>
                <div>
                  <h3>Streak Leaderboard</h3>
                  <p>Top 100 students by study streak</p>
                </div>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowLeaderboard(false)}>
                <X size={18} />
              </button>
            </div>

            {/* ─── Top 3 Podium ─── */}
            <div className="leaderboard-podium">
              {topThree.map((entry, i) => {
                const icons = [<Trophy size={16} />, <Medal size={16} />, <Star size={16} />];
                const colors = ['var(--accent-amber)', 'var(--text-secondary)', 'var(--accent-orange)'];
                return (
                  <div key={entry.id} className={`podium-item podium-${i + 1}`}>
                    <div className="podium-icon" style={{ color: colors[i] }}>{icons[i]}</div>
                    <div className="podium-name">{entry.name}</div>
                    <div className="podium-dept">{entry.dept}</div>
                    <div className="podium-streak" style={{ color: colors[i] }}>
                      <Zap size={12} /> {entry.streak}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Rank List ─── */}
            <div className="leaderboard-list">
              {rankList.map((entry, i) => (
                <div key={entry.id} className={`leaderboard-row${entry.name === user?.name ? ' leaderboard-row-me' : ''}`}>
                  <span className="leaderboard-rank">#{i + 1}</span>
                  <div className="leaderboard-row-info">
                    <span className="leaderboard-row-name">{entry.name}</span>
                    <span className="leaderboard-row-dept">{entry.dept}</span>
                  </div>
                  <span className="leaderboard-row-streak">
                    <Sparkles size={11} /> {entry.streak}
                  </span>
                </div>
              ))}
            </div>

            {/* ─── My Position ─── */}
            <div className="leaderboard-my-rank">
              <div className="leaderboard-my-rank-content">
                <Sun size={16} style={{ color: getStreakColor() }} />
                <div>
                  <span className="leaderboard-my-rank-label">My Streak</span>
                  <span className="leaderboard-my-rank-value" style={{ color: getStreakColor() }}>{streak} days</span>
                </div>
              </div>
              <div className="leaderboard-my-rank-divider" />
              <div className="leaderboard-my-rank-content">
                <Target size={16} style={{ color: 'var(--accent-amber)' }} />
                <div>
                  <span className="leaderboard-my-rank-label">My Rank</span>
                  <span className="leaderboard-my-rank-value" style={{ color: 'var(--accent-amber)' }}>
                    {myRank ? `#${myRank}` : 'Not ranked'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const focusModes = [
  { id: 'stats', label: 'Quick Stats', icon: Gauge, desc: 'CGPA & metrics', color: 'blue' },
  { id: 'routine', label: 'Routine', icon: CalendarDays, desc: 'Weekly timetable', color: 'cyan' },
  { id: 'calendar', label: 'Semester View', icon: Calendar, desc: '14-week view', color: 'purple' },
  { id: 'exams', label: 'Zero Hour', icon: BookOpen, desc: 'Quiz, Mid & Final', color: 'amber' },
  { id: 'attendance', label: 'Attendance', icon: Percent, desc: 'Semester progress', color: 'emerald' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good morning', period: 'morning' };
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', period: 'afternoon' };
  if (hour >= 17 && hour < 20) return { text: 'Good evening', period: 'evening' };
  return { text: 'Good night', period: 'night' };
}

function getGreetingMeta(period) {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const subtitles = {
    morning: 'Rise and shine — your schedule is ready for today.',
    afternoon: 'Keep the momentum going. You\'re doing great.',
    evening: 'Wind down — here\'s your evening overview.',
    night: 'Rest up — here\'s a quick look before tomorrow.',
  };
  return { day, date, subtitle: subtitles[period] };
}

/* ─── Sunrise SVG ─── */
function SunriseIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Horizon line */}
      <path d="M22 22H2" />
      {/* Sun disk glow */}
      <circle cx="12" cy="18" r="5" fill="currentColor" opacity="0.1" />
      {/* Sun rising (half above horizon) */}
      <path d="M7 18a5 5 0 0 1 10 0" fill="currentColor" fillOpacity="0.15" />
      {/* Rays going UPWARD */}
      <path d="M12 2v4" />
      <path d="M5 9l2 2" />
      <path d="M19 9l-2 2" />
      {/* Upward-pointing peak */}
      <path d="M9 4l3-3 3 3" />
    </svg>
  );
}

/* ─── Sun SVG ─── */
function SunIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2" />
      <path d="M12 1v2M12 21v2M1 12h2M21 12h2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

/* ─── Sunset SVG ─── */
function SunsetIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M22 22H2" />
      <path d="M12 2v7" />
      <path d="M4.93 13.93l1.41-1.41" />
      <path d="M17.66 13.93l-1.41-1.41" />
      <path d="M18 18h2" />
      <path d="M4 18h2" />
      <circle cx="12" cy="14" r="2" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

/* ─── Moon SVG ─── */
function MoonIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" opacity="0.12" />
      <circle cx="9" cy="8" r="0.8" fill="currentColor" opacity="0.6" />
      <circle cx="17" cy="16" r="0.8" fill="currentColor" opacity="0.6" />
      <circle cx="7" cy="13" r="0.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

const PERIOD_ICONS = {
  morning: <SunriseIcon />,
  afternoon: <SunIcon />,
  evening: <SunsetIcon />,
  night: <MoonIcon />,
};

function useAnimatedValue(target, duration = 900) {
  const [display, setDisplay] = useState('—');

  useEffect(() => {
    if (target === null || target === '—' || target === undefined) {
      setDisplay('—');
      return;
    }

    const num = typeof target === 'number' ? target : parseFloat(target);
    if (Number.isNaN(num)) {
      setDisplay(String(target));
      return;
    }

    const isInt = Number.isInteger(num);
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const current = num * eased;
      setDisplay(isInt ? String(Math.round(current)) : current.toFixed(2));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return display;
}

function RunningClock({ size = 18 }) {
  useEffect(() => {
    if (document.getElementById('rc-style')) return;
    const style = document.createElement('style');
    style.id = 'rc-style';
    style.textContent = `
      @keyframes rc-min { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      @keyframes rc-hour { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      .rc-min { animation: rc-min 60s linear infinite; transform-origin: 50% 50%; }
      .rc-hour { animation: rc-hour 3600s linear infinite; transform-origin: 50% 50%; }
    `;
    document.head.appendChild(style);
  }, []);

  const s = size;
  const cx = s / 2, cy = s / 2, r = s / 2 - 1;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={cx} cy={cy} r={r} />
      <line className="rc-hour" x1={cx} y1={cy} x2={cx} y2={cy - r * 0.5} stroke="currentColor" strokeWidth="1.5" />
      <line className="rc-min" x1={cx} y1={cy} x2={cx} y2={cy - r * 0.75} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function FlippingBook({ size = 18 }) {
  useEffect(() => {
    if (document.getElementById('fb-style')) return;
    const s = document.createElement('style');
    s.id = 'fb-style';
    s.textContent = `
      @keyframes fb-mv {
        0%,100%{transform:translateX(0);opacity:.7}
        25%{transform:translateX(-3px);opacity:.3}
        50%{transform:translateX(-6px);opacity:0}
        75%{transform:translateX(0);opacity:.7}
      }
      .fb1{animation:fb-mv 2.4s ease-in-out infinite}
      .fb2{animation:fb-mv 2.4s ease-in-out .8s infinite}
      .fb3{animation:fb-mv 2.4s ease-in-out 1.6s infinite}
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M12 2v20" opacity="0.15" />
      <path className="fb1" d="M16 5v14" opacity="0.6" />
      <path className="fb2" d="M17 6v12" opacity="0.4" strokeWidth="1" />
      <path className="fb3" d="M15 6v12" opacity="0.4" strokeWidth="1" />
    </svg>
  );
}

function QuickStats() {
  const [userResults, setUserResults] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const userId = getCurrentUserId();
    setIsGuest(!userId);
    const stored = getUserStorageItem(storageKeyType);
    setUserResults(stored);
  }, []);

  const stats = useMemo(() => {
    const stored = localStorage.getItem('aust-deadlines');
    const allDeadlines = stored ? (() => { try { return JSON.parse(stored); } catch { return []; } })() : [];
    const storedTasks = localStorage.getItem('aust-week-tasks');
    const allTasks = storedTasks ? (() => { try { return JSON.parse(storedTasks); } catch { return []; } })() : [];
    const now = Date.now();
    const pendingDeadlines = allDeadlines.filter((d) => {
      const due = d.dueDate ? new Date(d.dueDate).getTime() : 0;
      return due > now;
    }).length;
    const pendingTasks = allTasks.filter((t) => {
      if (!t.date) return false;
      const taskDate = new Date(t.date);
      if (t.time) {
        const [h, m] = t.time.split(':');
        taskDate.setHours(parseInt(h), parseInt(m), 0);
      } else {
        taskDate.setHours(23, 59, 59);
      }
      return taskDate.getTime() > now;
    }).length;
    const pending = pendingDeadlines + pendingTasks;

    let avgAttendance = null;
    try {
      const v = localStorage.getItem('aust-attendance-overall-average');
      if (v) { avgAttendance = parseFloat(v); if (isNaN(avgAttendance)) avgAttendance = null; }
    } catch {}

    if (isGuest || !userResults) {
      return {
        currentCgpa: null,
        avgAttendance: avgAttendance !== null ? avgAttendance : '—',
        upcomingDeadlines: pending,
        creditsCompleted: 0,
      };
    }

    const completedSems = userResults.filter((r) => r.cgpa !== null);
    const currentCgpa = completedSems.at(-1)?.cgpa ?? null;
    const creditsCompleted = completedSems.reduce((total, sem) => {
      return total + sem.courses.reduce((sum, c) => (c.point !== null ? sum + (Number(c.credit) || 0) : sum), 0);
    }, 0);

    return { currentCgpa, avgAttendance: avgAttendance !== null ? avgAttendance : '—', upcomingDeadlines: pending, creditsCompleted };
  }, [userResults, isGuest]);

  const animatedCgpa = useAnimatedValue(stats.currentCgpa);
  const animatedCredits = useAnimatedValue(stats.creditsCompleted);
  const animatedDeadlines = useAnimatedValue(stats.upcomingDeadlines);

  const hasCgpa = stats.currentCgpa !== null && stats.currentCgpa !== undefined;
  const hasAttendance = stats.avgAttendance !== '—';

  const items = [
    {
      label: 'Current CGPA',
      value: hasCgpa ? animatedCgpa : '0.00',
      placeholder: !hasCgpa,
      icon: BarChart3,
      color: 'var(--accent-blue)',
      bg: 'var(--accent-blue-glow)',
      accent: 'blue',
      trend: hasCgpa ? (stats.currentCgpa >= 3.0 ? 'up' : stats.currentCgpa >= 2.5 ? 'stable' : 'down') : null,
    },
    {
      label: 'Avg. Attendance',
      value: hasAttendance ? `${stats.avgAttendance}%` : '—',
      placeholder: !hasAttendance,
      icon: UserCheck,
      color: 'var(--accent-emerald)',
      bg: 'var(--accent-emerald-glow)',
      accent: 'emerald',
      trend: null,
    },
    {
      label: 'Pending Deadlines',
      value: animatedDeadlines,
      icon: RunningClock,
      color: stats.upcomingDeadlines > 3 ? 'var(--accent-rose)' : 'var(--accent-amber)',
      bg: stats.upcomingDeadlines > 3 ? 'var(--accent-rose-glow)' : 'var(--accent-amber-glow)',
      accent: stats.upcomingDeadlines > 3 ? 'rose' : 'amber',
      trend: null,
    },
    {
      label: 'Credits Completed',
      value: animatedCredits,
      icon: FlippingBook,
      color: 'var(--accent-purple)',
      bg: 'var(--accent-purple-glow)',
      accent: 'purple',
      trend: null,
    },
  ];

  return (
    <div className="dashboard-quick-stats stagger-children">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={`quick-stat-card glass-card-static quick-stat-${item.accent} animate-fadeInUp`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="quick-stat-icon" style={{ background: item.bg, color: item.color, position: 'relative' }}>
              <Icon size={18} />
            </div>
            <div className="quick-stat-body">
              <div className="quick-stat-value-row">
                <span className={`quick-stat-value${item.placeholder ? ' placeholder' : ''}`} style={{ color: item.color }}>{item.value}</span>
                {item.trend && (
                  <span className={`quick-stat-trend trend-${item.trend}`}>
                    {item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}
                  </span>
                )}
              </div>
              <span className="quick-stat-label">{item.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [focusMode, setFocusMode] = useState(() => {
    try {
      const stored = localStorage.getItem('aust-dashboard-focus');
      if (stored && FOCUS_SECTIONS[stored]) return stored;
    } catch {}
    return 'stats';
  });
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const handleFocusChange = (mode) => {
    setFocusMode(mode);
    try { localStorage.setItem('aust-dashboard-focus', mode); } catch {}
  };

  const profileIncomplete = user && (!user.department || !user.batch || !user.section || !user.yearSemester);

  const isVisible = (key) => FOCUS_SECTIONS[focusMode].includes(key);

  const greeting = useMemo(() => getGreeting(), []);
  const greetingMeta = useMemo(() => getGreetingMeta(greeting.period), [greeting.period]);

  return (
    <div className={`dashboard-page dashboard-focus-${focusMode} animate-fadeIn`}>

      <header className="dash-hero" data-period={greeting.period}>
        <div className="dash-hero-content">
          <div className="dash-hero-eyebrow">
            <span className="dash-hero-period-icon">
              {PERIOD_ICONS[greeting.period]}
            </span>
            <span className="dash-hero-date-label">
              {greetingMeta.day} · {greetingMeta.date}
            </span>
          </div>
          <div className="dash-hero-title-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="dash-hero-title">
                {greeting.text},
                <br />
                <span className="dash-hero-name">{firstName}</span>
              </h1>
              <p className="dash-hero-subtitle">
                {greetingMeta.subtitle}
              </p>
            </div>
            <div className="dash-hero-widgets">
              <StudyStreak />
            </div>
          </div>
        </div>
      </header>

      {profileIncomplete && (
        <div className="dash-profile-warning animate-fadeIn">
          <AlertTriangle size={16} />
          <span>Your profile is incomplete. <a href="/settings">Complete it here</a> to unlock all features.</span>
        </div>
      )}

      <GliderTabs
        tabs={focusModes}
        activeTab={focusMode}
        onChange={handleFocusChange}
        variant="dashboard"
      />

      {isVisible('stats') && (
        <section className="dash-section-group">
          <div className="section-header">
            <h2 className="section-title">
              <span className="icon" style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)' }}>
                <Gauge size={16} />
              </span>
              Quick Statistics
            </h2>
          </div>
          <div className="dash-section">
            <QuickStats />
          </div>
        </section>
      )}

      {isVisible('notif') && (
        <div className="dash-section">
          <NotificationBanner />
        </div>
      )}

      {isVisible('routine') && (
        <section className="dash-section-group">
          <div className="section-header">
            <h2 className="section-title">
              <span className="icon" style={{ background: 'var(--accent-cyan-glow)', color: 'var(--accent-cyan)' }}>
                <CalendarDays size={16} />
              </span>
              Weekly Timetable
            </h2>
            <p className="section-subtitle">Traditional AUST timetable — 50 min per slot (SUN-THU)</p>
          </div>
          <div className="dash-section">
            <WeeklyPlanner />
          </div>
        </section>
      )}

      {isVisible('calendar') && (
        <section className="dash-section-group">
          <div className="section-header">
            <h2 className="section-title">
              <span className="icon" style={{ background: 'var(--accent-purple-glow)', color: 'var(--accent-purple)' }}>
                <Calendar size={16} />
              </span>
              <span>Semester View</span>
            </h2>
          </div>
          <div className="dash-section">
            <WeekSchedule />
          </div>
        </section>
      )}

      <div className="dashboard-grid">
        {isVisible('exams') && (
          <section className="dash-section-group" style={{ gridColumn: '1 / -1' }}>
            <div className="section-header">
              <h2 className="section-title">
                <span className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                  <BookOpen size={16} />
                </span>
                Zero Hour
              </h2>
              <p className="section-subtitle">Quiz, Mid &amp; Final exam dates &amp; syllabus</p>
            </div>
            <div className="dash-section">
              <ExamTracker />
            </div>
          </section>
        )}
        <div className="dashboard-main-col">
          {isVisible('routine_day') && (
            <section className="dash-section-group">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="icon" style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)' }}>
                    <CalendarDays size={16} />
                  </span>
                  Daily Flow
                </h2>
                <p className="section-subtitle">Stay productive and attend class or study</p>
              </div>
              <div className="dash-section">
                <RoutineCard />
              </div>
            </section>
          )}
          {isVisible('attendance') && (
            <section className="dash-section-group">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="icon" style={{ background: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)' }}>
                    <Percent size={16} />
                  </span>
                  Attendance Progress
                </h2>
              </div>
              <div className="dash-section">
                <RoutineAttendanceTracker />
              </div>
            </section>
          )}
        </div>

        <div className="dashboard-side-col">
          {isVisible('deadlines') && (
            <section className="dash-section-group">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="icon" style={{ background: 'var(--accent-rose-glow)', color: 'var(--accent-rose)' }}>
                    <Hourglass size={16} />
                  </span>
                  Deadlines
                </h2>
              </div>
              <div className="dash-section">
                <DeadlineTicker />
              </div>
            </section>
          )}
          {isVisible('notices') && (
            <section className="dash-section-group">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="icon" style={{ background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
                    <BellRing size={16} />
                  </span>
                  Notice Board
                </h2>
              </div>
              <div className="dash-section">
                <NoticeBoard />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
