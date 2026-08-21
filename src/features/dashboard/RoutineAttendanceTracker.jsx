import { useState, useMemo, useEffect, useRef } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import {
  Percent, Clock, MapPin, CheckCircle2, XCircle,
} from 'lucide-react';
import { useLiveValue } from '../../utils/liveStore';
import { getCalculatedAttendanceDates, getSemesterStartDate } from '../../utils/semesterDates';
import './attendance-widget.css';

const SEMESTER_WEEKS = 14;
const MIN_ATTENDANCE = 75;

// Server-side (bare) keys — synced across all of the user's devices.
const liveKeys = {
  sessions: 'aust-user-routine-attendance-sessions',
  overallAverage: 'aust-attendance-overall-average',
};

function loadTelegramChatId() { return localStorage.getItem('telegram_chat_id') || ''; }
function loadIsTelegramRegistered() { return localStorage.getItem('telegram_is_registered') === 'true'; }

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function MiniSegBar({ attended, missed, unmarked, total }) {
  const aPct = total > 0 ? (attended / total) * 100 : 0;
  const mPct = total > 0 ? (missed  / total) * 100 : 0;
  const uPct = total > 0 ? (unmarked / total) * 100 : 0;
  return (
    <div className="att-minibar">
      <div className="att-minibar-seg" style={{ width: `${aPct}%`, background: 'var(--accent-emerald)' }} title="Attended" />
      <div className="att-minibar-seg" style={{ width: `${mPct}%`, background: 'var(--accent-rose)' }}    title="Missed" />
      <div className="att-minibar-seg" style={{ width: `${uPct}%`, background: 'var(--text-tertiary)' }}  title="Unmarked" />
    </div>
  );
}

export default function RoutineAttendanceTracker() {
  const { routine, weekDays } = useRoutine();

  // Fully personal, server-synced attendance. sessionMarks maps
  // "<courseKey>::<day>-w<week>-<date>" → 'present' | 'absent'.
  // liveStore persists it on every change and re-fetches it when another
  // device edits it, so every device converges without a refresh.
  const [sessionMarks, setSessionMarks] = useLiveValue('user', liveKeys.sessions, {});
  const [, setOverallAverage] = useLiveValue('user', liveKeys.overallAverage, null);

  const [telegramChatId]       = useState(loadTelegramChatId);
  const [isTelegramRegistered] = useState(loadIsTelegramRegistered);
  const [telegramRecords,      setTelegramRecords]     = useState([]);
  const [expandedCourseKey,    setExpandedCourseKey]   = useState(null);
  const [inView,               setInView]              = useState(false);
  const widgetRef = useRef(null);

  const isTelegramSync = isTelegramRegistered && !!telegramChatId;

  // Play the entrance animation only when the widget scrolls into view.
  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    const fallback = setTimeout(() => setInView(true), 1200);
    return () => { observer.disconnect(); clearTimeout(fallback); };
  }, []);

  // ---------- Telegram auto-marks ----------
  const loadTelegramAttendance = async () => {
    if (!telegramChatId) return;
    try {
      const response = await fetch(`/api/telegram/attendance?chatId=${encodeURIComponent(telegramChatId)}`);
      const result   = await response.json();
      if (result.success && Array.isArray(result.records)) setTelegramRecords(result.records);
    } catch (error) {
      console.error('Failed to load Telegram attendance:', error);
    }
  };

  useEffect(() => {
    if (!isTelegramSync) return;
    loadTelegramAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTelegramSync, telegramChatId]);

  // ── Real-time WebSocket listener: the Telegram bot broadcasts an
  //    attendance-sync event every time the user answers a prompt, so the
  //    bot's marks land here instantly (no polling). ──
  useEffect(() => {
    if (!isTelegramSync) return;
    let ws = null;
    let reconnectTimer = null;

    function connect() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'attendance-sync') loadTelegramAttendance();
          } catch { /* ignore */ }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => { ws.close(); };
      } catch { /* ignore */ }
    }

    connect();

    return () => {
      if (ws) {
        ws.onclose = null; // prevent reconnect
        ws.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTelegramSync, telegramChatId]);

  // ---------- Course structure (auto-imported from the personal routine) ----------
  const courseStats = useMemo(() => {
    const stats = {};
    weekDays.forEach(day => {
      (routine[day] || []).forEach(cls => {
        const courseKey = cls.part ? `${cls.course}-${cls.part}` : cls.course;
        if (!stats[courseKey]) {
          stats[courseKey] = {
            course: cls.course,
            fullKey: courseKey,
            name: cls.name,
            part: cls.part || null,
            color: cls.color,
            classDays: [],
            biWeekly: cls.biWeekly || false,
            time: cls.startTime && cls.endTime ? `${cls.startTime}–${cls.endTime}` : cls.startTime || '',
            room: cls.room || '',
            instances: [],
          };
        }
        stats[courseKey].classDays.push(day);
      });
    });

    // Every class day of the whole semester, pre-computed per course.
    const semStart = getSemesterStartDate();
    Object.values(stats).forEach(stat => {
      stat.instances = getCalculatedAttendanceDates(semStart, stat.classDays, { biWeekly: stat.biWeekly })
        .map(session => ({
          ...session,
          // Namespace id by courseKey to avoid collisions across courses
          id: `${stat.fullKey}::${session.id}`,
          time: stat.time,
          room: stat.room,
        }));
      stat.totalSemesterClasses = stat.instances.length;
    });
    return stats;
  }, [routine, weekDays]);

  // Telegram bot records → session marks overlay, matched by course + date.
  const telegramMarks = useMemo(() => {
    if (!telegramRecords.length) return {};
    const idByDate = {};
    Object.values(courseStats).forEach(stat => {
      stat.instances.forEach(inst => { idByDate[`${String(stat.fullKey).toUpperCase()}|${toISODate(inst.date)}`] = inst.id; });
    });
    const marks = {};
    telegramRecords.forEach(rec => {
      const courseKey = rec.CourseCode || rec.courseCode || rec.course;
      const dateStr   = String(rec.RecordDate || rec.recordDate || '').split('T')[0];
      const attended  = rec.Attended !== undefined ? rec.Attended : rec.attended;
      if (!courseKey || !dateStr) return;
      const id = idByDate[`${String(courseKey).toUpperCase()}|${dateStr}`];
      if (id) marks[id] = attended ? 'present' : 'absent';
    });
    return marks;
  }, [telegramRecords, courseStats]);

  // Effective mark for a session: manual mark wins, else the Telegram bot's.
  const markFor = (inst) => sessionMarks[inst.id] ?? telegramMarks[inst.id] ?? null;

  // ---------- Per-course stats ----------
  const courseView = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Object.values(courseStats).map(stat => {
      let present = 0, absent = 0, held = 0;
      stat.instances.forEach(inst => {
        if (inst.date > today) return; // future classes don't count yet
        held++;
        const m = markFor(inst);
        if (m === 'present') present++;
        else if (m === 'absent') absent++;
      });
      // Clamp against stray marks on dates that are no longer in the list
      // (e.g. routine changed mid-semester) so pct can never exceed 100.
      const attended = Math.min(present, held);
      const realAbsent = Math.min(absent, Math.max(0, held - attended));
      const pct        = held > 0 ? (attended / held) * 100 : 0;
      const needed     = Math.ceil(stat.totalSemesterClasses * (MIN_ATTENDANCE / 100));
      const canMiss    = Math.max(0, stat.totalSemesterClasses - needed - realAbsent);
      return {
        ...stat,
        attended,
        absent: realAbsent,
        unmarked: stat.totalSemesterClasses - attended - realAbsent,
        held,
        pct,
        canMiss,
        danger: held > 0 && pct < MIN_ATTENDANCE,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseStats, sessionMarks, telegramMarks]);

  // ---------- Overall stats ----------
  const overallStats = useMemo(() => {
    let totalAttended = 0, totalAbsent = 0, totalHeld = 0, warningCount = 0;
    courseView.forEach(c => {
      totalAttended += c.attended;
      totalAbsent   += c.absent;
      totalHeld     += c.held;
      if (c.danger) warningCount++;
    });
    const average = totalHeld > 0 ? (totalAttended / totalHeld) * 100 : 0;
    return {
      average: parseFloat(average.toFixed(1)),
      totalAttended,
      totalAbsent,
      totalHeld,
      warningCount,
      marked: totalAttended + totalAbsent,
    };
  }, [courseView]);

  // Publish the semester average so the dashboard's Avg. Attendance card
  // picks it up live (it reads the same liveStore key).
  useEffect(() => {
    try { setOverallAverage(overallStats.marked > 0 ? String(overallStats.average) : null); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallStats.average, overallStats.marked]);

  // ── Server sync ──
  // Push the computed overall attendance % to the server so the Active
  // Members popup can reveal a real value when "Show my attendance" is on.
  const syncedAverageRef = useRef(null);
  useEffect(() => {
    if (overallStats.marked === 0 || overallStats.totalHeld === 0) return;
    if (syncedAverageRef.current === overallStats.average) return;
    fetch('/api/presence/attendance', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendancePct: overallStats.average }),
    }).then((res) => {
      // Only remember a successful sync so failures get retried later.
      if (res.ok) syncedAverageRef.current = overallStats.average;
    }).catch(() => {});
  }, [overallStats.average, overallStats.marked, overallStats.totalHeld]);

  // ---------- Direct mark (tap Present/Absent on any class row) ----------
  const setSessionStatus = (sessionId, newStatus) => {
    setSessionMarks(prev => {
      const updated = { ...prev };
      // Clicking the active status clears the mark; otherwise set it.
      if (updated[sessionId] === newStatus) delete updated[sessionId];
      else updated[sessionId] = newStatus;
      return updated;
    });
  };

  // ---------- Present / Absent toggle buttons ----------
  const ToggleBtn = ({ sessionId, currentStatus, targetStatus, label, icon: Icon }) => {
    const isActive = currentStatus === targetStatus;
    return (
      <button
        className={`att-toggle-pill ${targetStatus}${isActive ? ' active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setSessionStatus(sessionId, targetStatus);
        }}
        title={isActive ? `Clear ${label}` : `Mark ${label}`}
      >
        <Icon size={11} style={{ flexShrink: 0 }} />
        {label}
      </button>
    );
  };

  if (Object.keys(courseStats).length === 0) return null;

  // Shared course-cell renderer — used identically for every course cell.
  const renderCourseCell = (stat, idx) => {
    const isExpanded = expandedCourseKey === stat.fullKey;

    return (
      <div
        key={stat.fullKey}
        className={[
          'schedule-day-card',
          'att-cell',
          isExpanded ? 'today' : '',
          stat.danger ? 'att-cell-danger' : '',
        ].filter(Boolean).join(' ')}
        style={{
          animationDelay: `${0.05 + idx * 0.06}s`,
        }}
        onClick={() => setExpandedCourseKey(prev => prev === stat.fullKey ? null : stat.fullKey)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedCourseKey(prev => prev === stat.fullKey ? null : stat.fullKey); }}
      >
        <div className="schedule-day-top">
          <div className="schedule-day-num-wrap">
            <div className="att-cell-code" style={{ color: 'var(--accent-blue)' }}>
              {stat.course}
              {stat.part && <span className="att-cell-part">Part {stat.part}</span>}
            </div>
          </div>
        </div>

        <div className="att-cell-pct-row">
          <span
            className={`att-cell-pct${stat.danger ? ' danger' : ''}`}
            style={{ color: stat.danger ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}
          >
            {Math.round(stat.pct)}%
          </span>
        </div>

        <div className="att-cell-name">{stat.name}</div>

        {isExpanded && (
          <div className="att-cell-expanded">
            <div className="schedule-task-list">
              <div className="att-cell-stats">
                <span className="att-cell-stat att-cell-stat-att">{stat.attended}</span>
                <span className="att-cell-sep">/</span>
                <span className="att-cell-stat att-cell-stat-mis">{stat.absent}</span>
                <span className="att-cell-sep">/</span>
                <span className="att-cell-stat att-cell-stat-umr">{stat.unmarked}</span>
              </div>
              <div className="att-cell-buffer">
                You can miss <strong>{stat.canMiss}</strong> more class{stat.canMiss !== 1 ? 'es' : ''}
              </div>
            </div>

            <MiniSegBar attended={stat.attended} missed={stat.absent} unmarked={stat.unmarked} total={stat.totalSemesterClasses} />

            {stat.instances.length > 0 && (
              <div className="att-course-instances">
                <div className="att-instances-header">
                  <Clock size={12} />
                  {stat.instances.length} class sessions · {SEMESTER_WEEKS}-week semester
                  <span className="att-instances-hint">tap Present / Absent to mark</span>
                </div>
                <div className="att-instances-list">
                  {stat.instances.map((inst, instIdx) => {
                    const mark = markFor(inst);
                    const isToday = toISODate(inst.date) === toISODate(new Date());
                    return (
                      <div
                        key={inst.id}
                        className={`att-instance-row${mark ? ` state-${mark}` : ''}${isToday ? ' is-today' : ''}`}
                        style={{ animationDelay: `${0.02 + instIdx * 0.03}s` }}
                      >
                        <span className="att-instance-date">
                          {inst.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="att-instance-day">{inst.dayName.substring(0, 3)}</span>
                        <span className="att-instance-label">{inst.label}</span>
                        <span className="att-instance-time">{inst.time || '—'}</span>
                        <span className="att-instance-room">
                          <MapPin size={9} /> {inst.room || '—'}
                        </span>
                        <span className="att-instance-spacer">
                          <ToggleBtn
                            sessionId={inst.id}
                            currentStatus={mark}
                            targetStatus="present"
                            label="Present"
                            icon={CheckCircle2}
                          />
                          <ToggleBtn
                            sessionId={inst.id}
                            currentStatus={mark}
                            targetStatus="absent"
                            label="Absent"
                            icon={XCircle}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`glass-card-static schedule-widget attendance-widget attendance-tracker-widget animate-fadeInUp${inView ? ' att-drop-active' : ''}`} ref={widgetRef}>
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Percent size={20} />
          </div>
          <div>
            <span className="schedule-overline">Dashboard</span>
            <p className="schedule-title">Attendance Tracker</p>
            <span className="schedule-subtitle">
              {`${SEMESTER_WEEKS}-week semester · ${courseView.length} courses · synced to your account`}
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span
                className="schedule-stat-value"
                style={{ color: overallStats.average >= MIN_ATTENDANCE ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}
              >
                {overallStats.average}%
              </span>
              <span className="schedule-stat-label">avg this sem</span>
            </div>
            <div className="schedule-stat">
              <span
                className="schedule-stat-value"
                style={{ color: overallStats.warningCount > 0 ? 'var(--accent-rose)' : undefined }}
              >
                {overallStats.warningCount}
              </span>
              <span className="schedule-stat-label">at risk</span>
            </div>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      <div className="att-overall-strip">
        <div className="att-overall-bar">
          <div className="att-overall-fill"
            style={{
              width: `${Math.min(overallStats.average, 100)}%`,
              background: overallStats.average >= MIN_ATTENDANCE ? 'var(--accent-emerald)' : 'var(--accent-amber)'
            }}
          />
        </div>
        <span className="att-overall-label">
          {overallStats.average}% · {MIN_ATTENDANCE}% minimum · {overallStats.totalAttended}/{overallStats.totalHeld} held attended
        </span>
      </div>

      <div className="attendance-grid">
        {courseView.map(renderCourseCell)}
      </div>

      {isTelegramSync && (
        <div className="att-telegram-syncing">Telegram auto-marking connected — bot answers appear here instantly</div>
      )}

      {/* ─── Workflow explainer ─── */}
      <details className="att-flow-info">
        <summary>How this attendance tracker works</summary>
        <ul>
          <li><strong>Courses:</strong> auto-imported from your personal routine — nothing to set up.</li>
          <li><strong>Semester list:</strong> tap a course to see every class day of the {SEMESTER_WEEKS}-week semester (mid-term break excluded).</li>
          <li><strong>Manual update:</strong> hit Present / Absent on any class row — tap again to clear.</li>
          <li><strong>Auto update:</strong> answer the 9 PM Telegram prompt; the bot's marks appear here instantly.</li>
          <li><strong>Realtime sync:</strong> marks are stored server-side against your account, so your phone and every other device update live — no refresh needed.</li>
          <li><strong>Average:</strong> semester average (attended ÷ classes held) feeds the dashboard's Avg. Attendance card automatically.</li>
        </ul>
      </details>
    </div>
  );
}
