import { useMemo, useState, useEffect } from 'react';
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
  Gauge, Percent, BookOpen, CalendarDays, Zap, AlertTriangle, Calendar,
  Flame, X, Trophy, Medal, Award, Star, Target, Sparkles, Sun, BarChart3,
} from 'lucide-react';
import { getUserStorageItemWithGuestFallback, getCurrentUserId } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';
import './DashboardPage.css';
import './dashboard-premium.css';
import './dashboard-tokens.css';

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
    if (streak === 1) return '1 Day · on fire!';
    if (streak < 30) return `${streak} Days · on fire!`;
    return `${streak} Days · legendary!`;
  };

  const getStreakColor = () => {
    if (streak === 0) return 'var(--text-tertiary)';
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
                const colors = ['var(--accent-amber)', 'var(--text-secondary)', 'var(--text-secondary)'];
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

// All modules share the single theme accent — the tab icons read one color,
// matching the widget box header icons.
const focusModes = [
  { id: 'stats', label: 'Quick Stats', icon: BarChart3, desc: 'CGPA & metrics', color: 'amber' },
  { id: 'routine', label: 'Routine', icon: CalendarDays, desc: 'Weekly timetable', color: 'amber' },
  { id: 'calendar', label: 'Semester View', icon: Calendar, desc: '14-week view', color: 'amber' },
  { id: 'exams', label: 'Zero Hour', icon: BookOpen, desc: 'Quiz, Mid & Final', color: 'amber' },
  { id: 'attendance', label: 'Attendance', icon: Percent, desc: 'Semester progress', color: 'amber' },
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

function useAnimatedValue(target, duration = 900, forceDecimals = false) {
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
      setDisplay(forceDecimals || !isInt ? current.toFixed(2) : String(Math.round(current)));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration, forceDecimals]);

  return display;
}

function QuickStats() {
  const [userResults, setUserResults] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const userId = getCurrentUserId();
    setIsGuest(!userId);
    const stored = getUserStorageItemWithGuestFallback(storageKeyType);
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
        semestersCompleted: 0,
      };
    }

    const completedSems = userResults.filter((r) => r.cgpa !== null);
    const currentCgpa = completedSems.at(-1)?.cgpa ?? null;
    const creditsCompleted = completedSems.reduce((total, sem) => {
      return total + sem.courses.reduce((sum, c) => (c.point !== null ? sum + (Number(c.credit) || 0) : sum), 0);
    }, 0);

    return {
      currentCgpa,
      avgAttendance: avgAttendance !== null ? avgAttendance : '—',
      upcomingDeadlines: pending,
      creditsCompleted,
      semestersCompleted: completedSems.length,
    };
  }, [userResults, isGuest]);

  const animatedCgpa = useAnimatedValue(stats.currentCgpa);
  const animatedCredits = useAnimatedValue(stats.creditsCompleted, 900, true);
  const animatedDeadlines = useAnimatedValue(stats.upcomingDeadlines);

  const hasCgpa = stats.currentCgpa !== null && stats.currentCgpa !== undefined;
  const hasAttendance = stats.avgAttendance !== '—';

  const items = [
    {
      code: 'CGPA',
      label: 'Current CGPA',
      icon: Gauge,
      tone: 'blue',
      value: hasCgpa ? animatedCgpa : '0.00',
      placeholder: !hasCgpa,
      // Risk tier: 0 great, 1 good, 2 okay, 3 poor.
      count: !hasCgpa ? 0 : (stats.currentCgpa >= 3.5 ? 0 : stats.currentCgpa >= 3.0 ? 1 : stats.currentCgpa >= 2.5 ? 2 : 3),
      trend: hasCgpa ? (stats.currentCgpa >= 3.0 ? 'up' : stats.currentCgpa >= 2.5 ? 'stable' : 'down') : null,
    },
    {
      code: 'ATT',
      label: 'Avg. Attendance',
      icon: Percent,
      tone: 'emerald',
      value: hasAttendance ? `${stats.avgAttendance}%` : '—',
      placeholder: !hasAttendance,
      // Risk tier: 0 fine, 1 slipping, 2 risky, 3 critical (75% minimum).
      count: !hasAttendance ? 0 : (stats.avgAttendance >= 75 ? 0 : stats.avgAttendance >= 70 ? 1 : stats.avgAttendance >= 65 ? 2 : 3),
      trend: null,
    },
    {
      code: 'DL',
      label: 'Pending Deadlines',
      icon: Calendar,
      tone: 'amber',
      value: animatedDeadlines,
      placeholder: false,
      count: stats.upcomingDeadlines,
      trend: null,
    },
    {
      code: 'CR',
      label: 'Credits Completed',
      icon: Award,
      tone: 'purple',
      value: animatedCredits,
      placeholder: !hasCgpa,
      count: hasCgpa ? stats.semestersCompleted : 0,
      trend: null,
    },
  ];

  // Shared stat-cell renderer — used identically for every metric cell.
  const renderStatCell = (item, idx) => {
    const isActive = idx === 0 && hasCgpa;
    const Icon = item.icon;
    return (
      <div
        key={item.code}
        className={`schedule-day-card quick-stat-cell${isActive ? ' today' : ''}${item.placeholder ? ' placeholder' : ''}`}
        style={{
          animationDelay: `${idx * 70}ms`,
        }}
      >
        <div className="quick-stat-top">
          <span className={`quick-stat-icon tone-${item.tone}`}>
            <Icon size={14} />
          </span>
          <span className="quick-stat-name">{item.label}</span>
        </div>
        <div className="quick-stat-value-row">
          <span
            className={`quick-stat-value${item.placeholder ? ' placeholder' : ''}`}
            style={{ animationDelay: `${idx * 70 + 140}ms` }}
          >
            {item.value}
          </span>
          {item.trend && (
            <span className={`quick-stat-trend trend-${item.trend}`}>
              {item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card-static schedule-widget quick-stats-widget animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <BarChart3 size={20} />
          </div>
          <div>
            <span className="schedule-overline">Semester Overview</span>
            <p className="schedule-title">Quick Stats</p>
            <span className="schedule-subtitle">CGPA · attendance · deadlines · credits</span>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      <div className="quick-stats-grid">
        {items.map(renderStatCell)}
      </div>
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

      <div className="glass-card-static das-tabs-card">
        <GliderTabs
          tabs={focusModes}
          activeTab={focusMode}
          onChange={handleFocusChange}
          variant="dashboard"
        />
      </div>

      {isVisible('stats') && (
        <section className="dash-section-group">
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
          <div className="dash-section">
            <WeeklyPlanner />
          </div>
        </section>
      )}

      {isVisible('calendar') && (
        <section className="dash-section-group">
          <div className="dash-section">
            <WeekSchedule />
          </div>
        </section>
      )}

      <div className="dashboard-grid">
        {isVisible('exams') && (
          <section className="dash-section-group" style={{ gridColumn: '1 / -1' }}>
            <div className="dash-section">
              <ExamTracker />
            </div>
          </section>
        )}
        <div className="dashboard-main-col">
          {isVisible('routine_day') && (
            <section className="dash-section-group">
              <div className="dash-section">
                <RoutineCard />
              </div>
            </section>
          )}
          {isVisible('attendance') && (
            <section className="dash-section-group">
              <div className="dash-section">
                <RoutineAttendanceTracker />
              </div>
            </section>
          )}
          {isVisible('notices') && (
            <section className="dash-section-group">
              <div className="dash-section">
                <NoticeBoard />
              </div>
            </section>
          )}
        </div>

        <div className="dashboard-side-col">
          {isVisible('deadlines') && (
            <section className="dash-section-group">
              <div className="dash-section">
                <DeadlineTicker />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
