import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import {
  Percent, AlertTriangle,
  Info, BookOpen, Trash2, Clock, MapPin, CheckCircle2, XCircle,
  MoreVertical, Activity, Check,
} from 'lucide-react';
import { setUserStorageItem, getUserStorageKey } from '../../utils/authStorage';
import { getCalculatedAttendanceDates, getSemesterStartDate } from '../../utils/semesterDates';
import './attendance-widget.css';

const SEMESTER_WEEKS = 14;
const MIN_ATTENDANCE = 75;

const storageKeyTypes = {
  enabled: 'routineAttendanceEnabled',
  // Legacy aggregate counts (attended integer per course key)
  data: 'routineAttendanceData',
  // Per-session Present/Absent map: { [sessionId]: 'present' | 'absent' }
  sessions: 'routineAttendanceSessions',
};

function loadInitialState() {
  try {
    const enabledKey = getUserStorageKey(storageKeyTypes.enabled);
    const dataKey    = getUserStorageKey(storageKeyTypes.data);
    const sessionsKey = getUserStorageKey(storageKeyTypes.sessions);
    return {
      isEnabled:      enabledKey    ? localStorage.getItem(enabledKey) === 'true' : false,
      attendanceData: dataKey       ? JSON.parse(localStorage.getItem(dataKey)    || '{}') : {},
      sessionMarks:   sessionsKey   ? JSON.parse(localStorage.getItem(sessionsKey) || '{}') : {},
    };
  } catch {
    return { isEnabled: false, attendanceData: {}, sessionMarks: {} };
  }
}

function loadTelegramChatId() { return localStorage.getItem('telegram_chat_id') || ''; }
function loadIsTelegramRegistered() { return localStorage.getItem('telegram_is_registered') === 'true'; }

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

  const initial = useMemo(() => loadInitialState(), []);
  const [isEnabled,      setIsEnabled]      = useState(initial.isEnabled);
  const [attendanceData, setAttendanceData] = useState(initial.attendanceData);
  // sessionMarks: { [sessionId]: 'present' | 'absent' }
  const [sessionMarks,   setSessionMarks]   = useState(initial.sessionMarks);

  const [telegramChatId]       = useState(loadTelegramChatId);
  const [isTelegramRegistered] = useState(loadIsTelegramRegistered);
  const [telegramAttendance,   setTelegramAttendance] = useState({});
  const [loadingTelegram,      setLoadingTelegram]    = useState(false);

  const [showGuide,         setShowGuide]         = useState(false);
  const [expandedCourseKey, setExpandedCourseKey] = useState(null);
  const [showMenu,          setShowMenu]          = useState(false);
  const [inView,            setInView]            = useState(false);
  const menuRef = useRef(null);
  const widgetRef = useRef(null);

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

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ---------- Telegram sync ----------
  const loadTelegramAttendance = useCallback(async () => {
    if (!telegramChatId) return;
    setLoadingTelegram(true);
    try {
      const response = await fetch(`/api/telegram/attendance?chatId=${encodeURIComponent(telegramChatId)}`);
      const result   = await response.json();
      if (result.success && result.records) {
        const telegramData = {};
        result.records.forEach(record => {
          // Handle both PascalCase (MSSQL) and camelCase column naming
          const courseKey = record.CourseCode || record.course;
          const isAttended = record.Attended !== undefined ? record.Attended : record.attended;
          if (!courseKey) return;
          if (!telegramData[courseKey]) telegramData[courseKey] = { attended: 0, total: 0 };
          telegramData[courseKey].total++;
          if (isAttended) telegramData[courseKey].attended++;
        });
        setTelegramAttendance(telegramData);
      }
    } catch (error) {
      console.error('Failed to load Telegram attendance:', error);
    } finally { setLoadingTelegram(false); }
  }, [telegramChatId]);

  useEffect(() => {
    if (isTelegramRegistered && telegramChatId && isEnabled) {
      loadTelegramAttendance();
      const id = setInterval(loadTelegramAttendance, 15000);
      return () => clearInterval(id);
    }
  }, [isTelegramRegistered, telegramChatId, isEnabled, loadTelegramAttendance]);

  // ── Real-time WebSocket listener for attendance-sync ──
  useEffect(() => {
    if (!isEnabled) return;
    let ws = null;
    let reconnectTimer = null;

    function connect() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
          console.log('📡 Attendance sync WS connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'attendance-sync' && telegramChatId) {
              // Reload Telegram attendance data on sync
              loadTelegramAttendance();
            }
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
  }, [isEnabled, loadTelegramAttendance, telegramChatId]);

  // ---------- Persistence ----------
  useEffect(() => { setUserStorageItem(storageKeyTypes.enabled,  isEnabled);      }, [isEnabled]);
  useEffect(() => { setUserStorageItem(storageKeyTypes.data,     attendanceData);  }, [attendanceData]);
  useEffect(() => { setUserStorageItem(storageKeyTypes.sessions, sessionMarks);    }, [sessionMarks]);

  // ---------- Clear all ----------
  const clearAllData = () => {
    [storageKeyTypes.enabled, storageKeyTypes.data, storageKeyTypes.sessions].forEach(type => {
      const key = getUserStorageKey(type);
      if (key) localStorage.removeItem(key);
    });
    setAttendanceData({});
    setSessionMarks({});
    setIsEnabled(false);
  };

  // ---------- Course structure ----------
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
            classesPerWeek: 0,
            totalSemesterClasses: 0,
            time: cls.startTime && cls.endTime ? `${cls.startTime}–${cls.endTime}` : cls.startTime || '',
            room: cls.room || '',
          };
        }
        stats[courseKey].classDays.push(day);
        stats[courseKey].classesPerWeek += cls.biWeekly ? 0.5 : 1;
      });
    });
    const semStart = getSemesterStartDate();
    Object.values(stats).forEach(stat => {
      const sessions = getCalculatedAttendanceDates(semStart, stat.classDays, { biWeekly: stat.biWeekly });
      stat.totalSemesterClasses = sessions.length;
    });
    return stats;
  }, [routine, weekDays]);

  // ---------- Dynamic date generation ----------
  // Generates all class session dates for the expanded course using the semester start date.
  const courseInstances = useMemo(() => {
    if (!expandedCourseKey) return [];
    const stat = courseStats[expandedCourseKey];
    if (!stat) return [];

    const semStart = getSemesterStartDate();
    return getCalculatedAttendanceDates(semStart, stat.classDays, { biWeekly: stat.biWeekly })
      .map(session => ({
        ...session,
        // Namespace id by courseKey to avoid collisions across courses
        id: `${expandedCourseKey}::${session.id}`,
        time: stat.time,
        room: stat.room,
      }));
  }, [expandedCourseKey, courseStats]);

  // ---------- Per-session mark (direct set, no cycle) ----------
  const setSessionStatus = useCallback((sessionId, courseKey, newStatus) => {
    setSessionMarks(prev => {
      const current = prev[sessionId];
      // If clicking the same status, clear it; otherwise set the new status
      const next = current === newStatus ? undefined : newStatus;
      const updated = { ...prev };
      if (next === undefined) delete updated[sessionId]; else updated[sessionId] = next;

      // Recompute aggregate attended count for this course
      const coursePrefix = courseKey + '::';
      const attended = Object.entries(updated)
        .filter(([id, status]) => id.startsWith(coursePrefix) && status === 'present')
        .length;

      setAttendanceData(prevData => ({
        ...prevData,
        [courseKey]: { ...(prevData[courseKey] || {}), attended },
      }));

      return updated;
    });
  }, []);

  // ---------- Stats ----------
  const overallStats = useMemo(() => {
    let totalAttended = 0;
    let totalAbsent   = 0;
    let totalClasses  = 0;
    let warningCount  = 0;
    let totalCanMiss  = 0;

    Object.values(courseStats).forEach(stat => {
      const localAtt = attendanceData[stat.fullKey]?.attended || 0;

      // Count actual absent marks from sessionMarks
      const coursePrefix = stat.fullKey + '::';
      const absentMarks = Object.entries(sessionMarks)
        .filter(([id, status]) => id.startsWith(coursePrefix) && status === 'absent')
        .length;

      const telegramData = telegramAttendance[stat.fullKey] || telegramAttendance[stat.course];
      const telegramAtt  = typeof telegramData === 'object' ? (telegramData.attended || 0) : 0;
      const telegramTot  = typeof telegramData === 'object' ? (telegramData.total    || 0) : 0;
      const telegramAbs  = telegramTot - telegramAtt;

      const attended = Math.max(localAtt, telegramAtt);
      const absent   = Math.max(absentMarks, telegramAbs);

      totalAttended += attended;
      totalAbsent   += absent;
      totalClasses  += stat.totalSemesterClasses;

      const needed  = Math.ceil(stat.totalSemesterClasses * (MIN_ATTENDANCE / 100));
      const canMiss = Math.max(0, stat.totalSemesterClasses - needed - absent);

      if (stat.totalSemesterClasses > 0 &&
          ((attended / stat.totalSemesterClasses) * 100) < MIN_ATTENDANCE) {
        warningCount++;
      }
      totalCanMiss += canMiss;
    });

    const average = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
    return {
      average: parseFloat(average.toFixed(1)),
      totalAttended,
      totalAbsent,
      totalClasses,
      warningCount,
      totalCanMiss,
    };
  }, [courseStats, attendanceData, sessionMarks, telegramAttendance]);

  useEffect(() => { try { localStorage.setItem('aust-attendance-overall-average', String(overallStats.average)); } catch {} }, [overallStats.average]);

  // ---------- Present / Absent toggle buttons ----------
  const ToggleBtn = ({ sessionId, courseKey, currentStatus, targetStatus, label, icon: Icon }) => {
    const isActive = currentStatus === targetStatus;
    return (
      <button
        className={`att-toggle-pill ${targetStatus}${isActive ? ' active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setSessionStatus(sessionId, courseKey, targetStatus); }}
        title={isActive ? `Clear ${label}` : `Mark ${label}`}
      >
        <Icon size={11} style={{ flexShrink: 0 }} />
        {label}
      </button>
    );
  };

  if (Object.keys(courseStats).length === 0) return null;

  const courseList = Object.values(courseStats);

  // Shared course-cell renderer — used identically for every course cell.
  const renderCourseCell = (stat, idx) => {
    const localAtt = attendanceData[stat.fullKey]?.attended || 0;

    // Count absent marks from sessionMarks for this course
    const coursePrefix = stat.fullKey + '::';
    const absentMarks = Object.entries(sessionMarks)
      .filter(([id, status]) => id.startsWith(coursePrefix) && status === 'absent')
      .length;

    const telegramData = telegramAttendance[stat.fullKey] || telegramAttendance[stat.course];
    const telegramAtt  = typeof telegramData === 'object' ? (telegramData.attended || 0) : 0;
    const telegramTot  = typeof telegramData === 'object' ? (telegramData.total    || 0) : 0;
    const telegramAbs  = telegramTot - telegramAtt;

    const attended     = Math.max(localAtt, telegramAtt);
    const absent       = Math.max(absentMarks, telegramAbs);
    const totalMarked  = attended + absent;
    const unmarked     = Math.max(0, stat.totalSemesterClasses - totalMarked);
    const percentage   = stat.totalSemesterClasses > 0
      ? ((attended / stat.totalSemesterClasses) * 100) : 0;
    const isDanger     = percentage < MIN_ATTENDANCE;

    const neededTotal  = Math.ceil(stat.totalSemesterClasses * (MIN_ATTENDANCE / 100));
    const canMissThis  = Math.max(0, stat.totalSemesterClasses - neededTotal - absent);

    const isExpanded   = expandedCourseKey === stat.fullKey;

    return (
      <div
        key={stat.fullKey}
        className={[
          'schedule-day-card',
          'att-cell',
          isExpanded ? 'today' : '',
          isDanger ? 'att-cell-danger' : '',
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
            className={`att-cell-pct${isDanger ? ' danger' : ''}`}
            style={{ color: isDanger ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}
          >
            {Math.round(percentage)}%
          </span>
        </div>

        <div className="att-cell-name">{stat.name}</div>

        {isExpanded && (
          <div className="att-cell-expanded">
            <div className="schedule-task-list">
              <div className="att-cell-stats">
                <span className="att-cell-stat att-cell-stat-att">{attended}</span>
                <span className="att-cell-sep">/</span>
                <span className="att-cell-stat att-cell-stat-mis">{absent}</span>
                <span className="att-cell-sep">/</span>
                <span className="att-cell-stat att-cell-stat-umr">{unmarked}</span>
              </div>
              <div className="att-cell-buffer">
                You can miss <strong>{canMissThis}</strong> more class{canMissThis !== 1 ? 'es' : ''}
              </div>
            </div>

            <MiniSegBar attended={attended} missed={absent} unmarked={unmarked} total={stat.totalSemesterClasses} />

            {courseInstances.length > 0 && (
              <div className="att-course-instances">
                <div className="att-instances-header">
                  <Clock size={12} />
                  {courseInstances.length} class sessions · {SEMESTER_WEEKS}-week semester
                  <span className="att-instances-hint">Tap a row to mark Present / Absent</span>
                </div>
                <div className="att-instances-list">
                  {courseInstances.map((inst, instIdx) => {
                    const mark = sessionMarks[inst.id];
                    return (
                      <div
                        key={inst.id}
                        className={`att-instance-row${mark ? ` state-${mark}` : ''}`}
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
                            courseKey={stat.fullKey}
                            currentStatus={mark}
                            targetStatus="present"
                            label="Present"
                            icon={CheckCircle2}
                          />
                          <ToggleBtn
                            sessionId={inst.id}
                            courseKey={stat.fullKey}
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
            <span className="schedule-overline">Semester Progress</span>
            <p className="schedule-title">Attendance Tracker</p>
            <span className="schedule-subtitle">
              {isEnabled
                ? `${SEMESTER_WEEKS}-week semester · ${courseList.length} courses`
                : 'Track your attendance across the semester'}
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
              <span className="schedule-stat-label">overall</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{overallStats.totalCanMiss}</span>
              <span className="schedule-stat-label">can miss</span>
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

        <div className="schedule-actions">
          <div className="export-dropdown" ref={menuRef}>
            <button className="schedule-nav-btn" onClick={() => setShowMenu(!showMenu)} aria-label="More options" aria-haspopup="true">
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <div className="export-menu">
                <button
                  className={`export-menu-item${isEnabled ? ' menu-active' : ''}`}
                  onClick={() => { setIsEnabled(v => !v); setShowMenu(false); }}
                >
                  <Activity size={14} /> Tracking enabled {isEnabled && <Check size={14} className="menu-check" />}
                </button>
                <button
                  className={`export-menu-item${showGuide ? ' menu-active' : ''}`}
                  onClick={() => { setShowGuide(v => !v); setShowMenu(false); }}
                >
                  <Info size={14} /> Attendance guide {showGuide && <Check size={14} className="menu-check" />}
                </button>
                <div className="export-menu-sep" />
                <button className="export-menu-item" onClick={() => { clearAllData(); setShowMenu(false); }}>
                  <Trash2 size={14} /> Reset all data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {showGuide && (
        <div className="att-guide-panel">
          <div className="att-guide-title">
            <AlertTriangle size={14} /> Why 75% Attendance?
          </div>
          <p>
            AUST requires a <strong>minimum 75% attendance</strong> in each course to sit for semester exams.
            Falling below means you may be <strong>restricted from appearing</strong>.
          </p>
          <div className="att-guide-stats">
            <div className="att-guide-stat">
              <span className="att-guide-stat-val">75%</span>
              <span className="att-guide-stat-lbl">Minimum required</span>
            </div>
            <div className="att-guide-stat">
              <span className="att-guide-stat-val">{overallStats.totalCanMiss}</span>
              <span className="att-guide-stat-lbl">Classes you can still miss</span>
            </div>
            <div className="att-guide-stat">
              <span className="att-guide-stat-val">{overallStats.warningCount}</span>
              <span className="att-guide-stat-lbl">Course(s) at risk</span>
            </div>
          </div>
          <p className="att-guide-tip">
            Tip: Click each class session below to mark Present / Absent.
            The aggregate updates automatically.
          </p>
        </div>
      )}

      {isEnabled ? (
        <>
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
              {overallStats.average}% · {MIN_ATTENDANCE}% minimum · {overallStats.totalAttended}/{overallStats.totalClasses} attended
            </span>
          </div>

          <div className="attendance-grid">
            {courseList.map(renderCourseCell)}
          </div>

          {loadingTelegram && (
            <div className="att-telegram-syncing">Syncing with Telegram...</div>
          )}
        </>
      ) : (
        <div className="att-disabled">
          <div className="att-disabled-icon">
            <BookOpen size={28} />
          </div>
          <div className="att-disabled-title">Attendance tracking is off</div>
          <div className="att-disabled-desc">
            Open the ⋮ menu above to start tracking {courseList.length} courses
            across {SEMESTER_WEEKS} weeks and see how many classes you can miss.
          </div>
        </div>
      )}
    </div>
  );
}
