import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import { normalizeAccentColor } from '../../utils/colorPalette';
import {
  TrendingUp, AlertTriangle, ShieldAlert, ShieldCheck,
  Info, BookOpen, Trash2, ChevronDown, Clock, MapPin, CheckCircle2, XCircle
} from 'lucide-react';
import { setUserStorageItem, getUserStorageKey } from '../../utils/authStorage';
import { getCalculatedAttendanceDates, getSemesterStartDate } from '../../utils/semesterDates';
import { apiFetch, getWebSocketUrl } from '../../utils/api';

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

function AttendanceRing({ percentage, size = 52, strokeWidth = 4, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(percentage, 100) / 100);
  const center = size / 2;
  const isLow = percentage < MIN_ATTENDANCE;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--bg-card)" strokeWidth={strokeWidth} />
      <circle
        cx={center} cy={center} r={radius} fill="none"
        stroke={isLow ? 'var(--accent-amber)' : color || 'var(--accent-emerald)'}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
      />
      <text
        x={center} y={center + 1} textAnchor="middle" dominantBaseline="central"
        fill={isLow ? 'var(--accent-amber)' : 'var(--text-primary)'}
        fontSize={size * 0.26} fontWeight="700" fontFamily="system-ui, sans-serif"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {Math.round(percentage)}%
      </text>
    </svg>
  );
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

  // ---------- Telegram sync ----------
  const loadTelegramAttendance = useCallback(async () => {
    if (!telegramChatId) return;
    setLoadingTelegram(true);
    try {
      const response = await apiFetch(`/api/telegram/attendance?chatId=${encodeURIComponent(telegramChatId)}`);
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
        ws = new WebSocket(getWebSocketUrl());

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

  const resetAttendance = (courseKey) => {
    setAttendanceData(prev => { const n = { ...prev }; delete n[courseKey]; return n; });
    // also clear session marks for this course
    setSessionMarks(prev => {
      const n = { ...prev };
      Object.keys(n).forEach(id => { if (id.startsWith(courseKey + '::')) delete n[id]; });
      return n;
    });
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

  // ---------- Premium toggle button styles ----------
  const ToggleBtn = ({ sessionId, courseKey, currentStatus, targetStatus, label, icon: Icon, activeColor, activeBg, mutedColor }) => {
    const isActive = currentStatus === targetStatus;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setSessionStatus(sessionId, courseKey, targetStatus); }}
        title={isActive ? `Clear ${label}` : `Mark ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '6px',
          border: `1px solid ${isActive ? activeColor : 'rgba(255,255,255,0.08)'}`,
          background: isActive ? activeBg : 'rgba(255,255,255,0.03)',
          color: isActive ? activeColor : mutedColor || 'var(--text-tertiary)',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: isActive ? '700' : '500',
          letterSpacing: '0.01em',
          transition: 'all 0.2s ease',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          outline: 'none',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.borderColor = activeColor + '66';
            e.currentTarget.style.background = activeBg;
            e.currentTarget.style.color = activeColor;
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.color = mutedColor || 'var(--text-tertiary)';
          }
        }}
      >
        <Icon size={11} style={{ flexShrink: 0 }} />
        {label}
      </button>
    );
  };

  if (Object.keys(courseStats).length === 0) return null;

  return (
    <div className="att-tracker-wrap glass-card-static animate-fadeInUp">
      <div className="att-header-row">
        <div className="att-header-left">
          <div className="att-header-icon" style={{ background: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="att-header-title">Attendance Tracker</div>
            <div className="att-header-sub">
              {isEnabled
                ? `${SEMESTER_WEEKS}-week semester · ${Object.keys(courseStats).length} courses`
                : 'Track your attendance across the semester'}
            </div>
          </div>
        </div>
        <div className="att-header-actions">
          <button className="att-guide-btn" onClick={() => setShowGuide(!showGuide)} title="Attendance guide">
            <Info size={15} />
          </button>
          <button
            className="att-guide-btn"
            onClick={clearAllData}
            title="Reset all attendance data"
            style={{ color: 'var(--accent-rose)' }}
          >
            <Trash2 size={15} />
          </button>
          <button
            className="att-toggle-btn"
            onClick={() => setIsEnabled(!isEnabled)}
            aria-label={isEnabled ? 'Disable tracking' : 'Enable tracking'}
          >
            <div className={`att-toggle-track${isEnabled ? ' active' : ''}`}>
              <div className="att-toggle-thumb" />
            </div>
          </button>
        </div>
      </div>

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
          <p style={{ marginTop: '8px', fontSize: '10px', opacity: 0.8 }}>
            Tip: Click each class session below to mark Present / Absent.
            The aggregate updates automatically.
          </p>
        </div>
      )}

      {isEnabled ? (
        <>
          <div className="att-hero-box">
            <div className="att-hero-body">
              <div className="att-hero-label">Overall Attendance</div>
              <div className="att-hero-value"
                style={{
                  color: overallStats.average >= MIN_ATTENDANCE ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                }}
              >
                {overallStats.average}%
                {overallStats.average >= MIN_ATTENDANCE
                  ? <ShieldCheck size={18} style={{ marginLeft: 6 }} />
                  : <ShieldAlert  size={18} style={{ marginLeft: 6 }} />
                }
              </div>
            </div>

            {/* Premium Analytics Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '10px',
            }}>
              {[
                {
                  label: 'Present',
                  value: overallStats.totalAttended,
                  icon: CheckCircle2,
                  color: 'var(--accent-emerald)',
                  glow: 'rgba(52,211,153,0.12)',
                  border: 'rgba(52,211,153,0.2)',
                },
                {
                  label: 'Absent',
                  value: overallStats.totalAbsent,
                  icon: XCircle,
                  color: 'var(--accent-rose)',
                  glow: 'rgba(251,113,133,0.12)',
                  border: 'rgba(251,113,133,0.2)',
                },
                {
                  label: 'Total Classes',
                  value: overallStats.totalClasses,
                  icon: BookOpen,
                  color: 'var(--accent-cyan)',
                  glow: 'rgba(6,182,212,0.12)',
                  border: 'rgba(6,182,212,0.2)',
                },
              ].map(stat => (
                <div key={stat.label} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: stat.glow,
                  border: `1px solid ${stat.border}`,
                  backdropFilter: 'blur(8px)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <stat.icon size={12} style={{ color: stat.color }} />
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                      {stat.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: stat.color,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="att-hero-bar-wrap">
              <div className="att-hero-bar-bg">
                <div className="att-hero-bar-fill"
                  style={{
                    width: `${Math.min(overallStats.average, 100)}%`,
                    background: overallStats.average >= MIN_ATTENDANCE ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                  }}
                />
              </div>
              <span className="att-hero-bar-label">{MIN_ATTENDANCE}% minimum · {overallStats.totalAttended}/{overallStats.totalClasses} attended</span>
            </div>
          </div>

          <div className="att-course-grid">
            {Object.values(courseStats).map((stat) => {
              const localAtt = attendanceData[stat.fullKey]?.attended || 0;

              // Count absent marks from sessionMarks for this course
              const coursePrefix = stat.fullKey + '::';
              const absentMarks = Object.entries(sessionMarks)
                .filter(([id, status]) => id.startsWith(coursePrefix) && status === 'absent')
                .length;
              const totalLocalMarks = Object.keys(sessionMarks)
                .filter(id => id.startsWith(coursePrefix))
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
              const accentColor  = normalizeAccentColor(stat.color);

              const neededTotal  = Math.ceil(stat.totalSemesterClasses * (MIN_ATTENDANCE / 100));
              const canMissThis  = Math.max(0, stat.totalSemesterClasses - neededTotal - absent);

              const isExpanded   = expandedCourseKey === stat.fullKey;

              return (
                <div key={stat.fullKey} className={`att-course-card${isDanger ? ' att-course-danger' : ''}${isExpanded ? ' att-course-expanded' : ''}`}>
                  <div
                    className="att-course-row"
                    onClick={() => setExpandedCourseKey(prev => prev === stat.fullKey ? null : stat.fullKey)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="att-course-info">
                      <div className="att-course-code" style={{ color: accentColor }}>
                        {stat.course}
                        {stat.part && <span className="att-course-part">Part {stat.part}</span>}
                        <ChevronDown size={14} style={{
                          marginLeft: 'auto',
                          transition: 'transform 0.2s ease',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          opacity: 0.5,
                        }} />
                      </div>
                      <div className="att-course-sub">
                        <span className="att-course-stat att-course-stat-att" title="Present">{attended}</span>
                        <span className="att-course-stat-sep">/</span>
                        <span className="att-course-stat att-course-stat-mis" title="Absent">{absent}</span>
                        <span className="att-course-stat-sep">/</span>
                        <span className="att-course-stat att-course-stat-umr" title="Unmarked">{unmarked}</span>
                        <span className="att-course-stat-hint">present/absent/unmk</span>
                      </div>
                    </div>
                    <button
                      className="att-course-reset"
                      onClick={(e) => { e.stopPropagation(); resetAttendance(stat.fullKey); }}
                      title="Reset attendance"
                    >&times;</button>
                  </div>

                  <div className="att-course-buffer">
                    <span className="att-buffer-label">
                      You can miss <strong>{canMissThis}</strong> more class{canMissThis !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  <MiniSegBar attended={attended} missed={absent} unmarked={unmarked} total={stat.totalSemesterClasses} />

                  {isExpanded && courseInstances.length > 0 && (
                    <div className="att-course-instances">
                      <div className="att-instances-header">
                        <Clock size={12} />
                        {courseInstances.length} class sessions · {SEMESTER_WEEKS}-week semester
                        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.65 }}>
                          Tap a row to mark Present / Absent
                        </span>
                      </div>
                      <div className="att-instances-list">
                        {courseInstances.map((inst) => {
                          const mark = sessionMarks[inst.id];
                          const isPresentMark = mark === 'present';
                          const isAbsentMark  = mark === 'absent';

                          return (
                            <div
                              key={inst.id}
                              className="att-instance-row"
                              style={{
                                background: isPresentMark
                                  ? 'rgba(52,211,153,0.04)'
                                  : isAbsentMark
                                  ? 'rgba(251,113,133,0.04)'
                                  : undefined,
                                transition: 'background 0.2s ease',
                              }}
                            >
                              <span className="att-instance-date">
                                {inst.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="att-instance-day">{inst.dayName.substring(0, 3)}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                {inst.label}
                              </span>
                              <span className="att-instance-time">
                                {inst.time || '—'}
                              </span>
                              <span className="att-instance-room">
                                <MapPin size={9} /> {inst.room || '—'}
                              </span>
                              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <ToggleBtn
                                  sessionId={inst.id}
                                  courseKey={stat.fullKey}
                                  currentStatus={mark}
                                  targetStatus="present"
                                  label="Present"
                                  icon={CheckCircle2}
                                  activeColor="var(--accent-emerald)"
                                  activeBg="rgba(52,211,153,0.12)"
                                  mutedColor="var(--text-tertiary)"
                                />
                                <ToggleBtn
                                  sessionId={inst.id}
                                  courseKey={stat.fullKey}
                                  currentStatus={mark}
                                  targetStatus="absent"
                                  label="Absent"
                                  icon={XCircle}
                                  activeColor="var(--accent-rose)"
                                  activeBg="rgba(251,113,133,0.12)"
                                  mutedColor="var(--text-tertiary)"
                                />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
            Toggle the switch above to start tracking {Object.keys(courseStats).length} courses
            across {SEMESTER_WEEKS} weeks and see how many classes you can miss.
          </div>
        </div>
      )}
    </div>
  );
}
