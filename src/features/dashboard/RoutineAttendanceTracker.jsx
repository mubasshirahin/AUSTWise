import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import {
  Percent, Clock, MapPin, CheckCircle2, XCircle, Eye, PenLine,
  ShieldCheck, TriangleAlert, ChevronDown,
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

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function panelIdFor(key) {
  return `att-panel-${String(key).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

/**
 * Segmented meter — attended / absent / unmarked with a tick marking the
 * 75% requirement, so the target stays readable without parsing numbers.
 */
function SegmentedMeter({
  attended, absent, unmarked, total, threshold = MIN_ATTENDANCE, className = '',
}) {
  const safeTotal = Math.max(total, attended + absent + unmarked, 1);
  const width = (v) => `${(v / safeTotal) * 100}%`;
  return (
    <div className={`att-seg-meter ${className}`.trim()}>
      <div
        className="att-seg-track"
        role="img"
        aria-label={`${attended} attended, ${absent} absent, ${unmarked} unmarked of ${safeTotal} classes held`}
      >
        <span className="att-seg-fill is-present" style={{ width: width(attended) }} />
        <span className="att-seg-fill is-absent" style={{ width: width(absent) }} />
        <span className="att-seg-fill is-unmarked" style={{ width: width(unmarked) }} />
        {threshold != null && (
          <span className="att-seg-target" style={{ left: `${threshold}%` }} aria-hidden="true" />
        )}
      </div>
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
  // Semester start set by the CR in Semester View (WeekSchedule writes this
  // shared key). Falls back to the legacy local value / today inside courseStats.
  const [sharedSemStart] = useLiveValue('shared', 'semester-start-date', null);

  const [telegramChatId]       = useState(loadTelegramChatId);
  const [isTelegramRegistered] = useState(loadIsTelegramRegistered);
  const [telegramRecords,      setTelegramRecords]     = useState([]);
  const [expandedCourseKey,    setExpandedCourseKey]   = useState(null);
  const [editMode,             setEditMode]            = useState(false); // view by default
  const [inView,               setInView]              = useState(false);
  const widgetRef = useRef(null);

  const today = useMemo(() => startOfToday(), []);
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
    // Prefer the CR-published shared start date; fall back to the legacy
    // local setting, then today.
    const semStart = sharedSemStart
      ? new Date(`${sharedSemStart}T00:00:00`)
      : getSemesterStartDate();
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
  }, [routine, weekDays, sharedSemStart]);

  // Telegram bot records → session marks overlay, matched by course + date.
  const telegramMarks = useMemo(() => {
    if (!telegramRecords.length) return {};
    const idByDate = {};
    Object.values(courseStats).forEach(stat => {
      // Use base course (without part) for Telegram match — bot stores CSE101 not CSE101-A
      const base = String(stat.course || stat.fullKey).split('-')[0].toUpperCase();
      stat.instances.forEach(inst => {
        idByDate[`${base}|${toISODate(inst.date)}`] = inst.id;
        // Also map fullKey for exact match
        idByDate[`${String(stat.fullKey).toUpperCase()}|${toISODate(inst.date)}`] = inst.id;
      });
    });
    const marks = {};
    telegramRecords.forEach(rec => {
      const courseKey = rec.CourseCode || rec.courseCode || rec.course;
      const dateStr   = String(rec.RecordDate || rec.recordDate || '').split('T')[0];
      const attended  = rec.Attended !== undefined ? rec.Attended : rec.attended;
      if (!courseKey || !dateStr) return;
      const baseKey = String(courseKey).split('-')[0].toUpperCase();
      const id = idByDate[`${baseKey}|${dateStr}`] || idByDate[`${String(courseKey).toUpperCase()}|${dateStr}`];
      if (id) marks[id] = attended ? 'present' : 'absent';
    });
    return marks;
  }, [telegramRecords, courseStats]);

  // Effective mark for a session: manual mark wins, else the Telegram bot's.
  const markFor = (inst) => sessionMarks[inst.id] ?? telegramMarks[inst.id] ?? null;

  // ---------- Per-course stats ----------
  const courseView = useMemo(() => {
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
      unmarked: Math.max(0, totalHeld - totalAttended - totalAbsent),
      warningCount,
      marked: totalAttended + totalAbsent,
    };
  }, [courseView]);

  // Publish the semester average so the dashboard's Avg. Attendance card
  // picks it up live (it reads the same liveStore key).
  useEffect(() => {
    // Nothing held yet (empty routine, semester not started, routine still
    // loading) means there is no meaningful average to publish. Skipping the
    // write prevents a temporary load failure from wiping a valid stored value.
    if (overallStats.totalHeld === 0) return;
    try { setOverallAverage(overallStats.marked > 0 ? String(overallStats.average) : null); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallStats.average, overallStats.marked, overallStats.totalHeld]);

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

  if (Object.keys(courseStats).length === 0) {
    return (
      <div className="glass-card-static schedule-widget attendance-widget attendance-tracker-widget animate-fadeInUp">
        <div className="schedule-masthead att-masthead">
          <div className="schedule-title-block att-masthead-title">
            <div className="schedule-icon-tile"><Percent size={18} /></div>
            <div className="att-masthead-text">
              <span className="schedule-overline">Dashboard</span>
              <p className="schedule-title">Attendance Tracker</p>
              <span className="schedule-subtitle">Add a routine to start tracking</span>
            </div>
          </div>
        </div>
        <div className="att-empty">
          <span className="att-empty-icon"><Percent size={22} aria-hidden="true" /></span>
          <p className="att-empty-title">No courses found</p>
          <span className="att-empty-desc">Add courses to your Routine Grid first</span>
          <button className="btn btn-sm att-empty-cta" onClick={() => { window.location.href = '/dashboard/routine'; }}>
            Go to Routine Grid
          </button>
        </div>
      </div>
    );
  }

  // ---------- Course row (accordion) ----------
  const renderCourseRow = (stat, idx) => {
    const isExpanded = expandedCourseKey === stat.fullKey;
    const panelId = panelIdFor(stat.fullKey);
    const pctValue = Math.round(stat.pct);
    const state = stat.held === 0 ? 'idle' : stat.danger ? 'danger' : 'ok';

    return (
      <li
        key={stat.fullKey}
        className={`att-row${isExpanded ? ' is-open' : ''}${state === 'danger' ? ' is-danger' : ''}`}
        style={{ animationDelay: `${0.04 + idx * 0.05}s` }}
      >
        <button
          type="button"
          className="att-row-head"
          onClick={() => setExpandedCourseKey(prev => (prev === stat.fullKey ? null : stat.fullKey))}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? panelId : undefined}
        >
          <span className="att-row-ident">
            <span className="att-row-code">
              {stat.course}
              {stat.part && <span className="att-row-part">Part {stat.part}</span>}
            </span>
            <span className="att-row-name">{stat.name}</span>
          </span>

          <span className="att-row-gauge" aria-hidden="true">
            <span className="att-row-gauge-track">
              <span
                className={`att-row-gauge-fill is-${state}`}
                style={{ width: `${Math.min(pctValue, 100)}%` }}
              />
              <span className="att-row-gauge-target" />
            </span>
          </span>

          <span className="att-row-metric">
            <span className={`att-row-pct is-${state}`}>{pctValue}%</span>
            <span className="att-row-count">{stat.attended}/{stat.held}</span>
          </span>

          <ChevronDown className="att-row-caret" size={15} aria-hidden="true" />
        </button>

        {isExpanded && (
          <div className="att-row-panel" id={panelId}>
            <div className="att-panel-summary">
              <div className="att-panel-counts">
                <span className="att-count is-present"><strong>{stat.attended}</strong> attended</span>
                <span className="att-count is-absent"><strong>{stat.absent}</strong> absent</span>
                <span className="att-count is-unmarked"><strong>{stat.unmarked}</strong> unmarked</span>
              </div>
              <span className={`att-panel-buffer${stat.canMiss === 0 ? ' is-warn' : ''}`}>
                {stat.canMiss > 0
                  ? <>Can miss <strong>{stat.canMiss}</strong> more class{stat.canMiss === 1 ? '' : 'es'}</>
                  : <>No buffer left — attend the next class</>}
              </span>
            </div>

            <SegmentedMeter
              className="is-compact"
              attended={stat.attended}
              absent={stat.absent}
              unmarked={stat.unmarked}
              total={stat.totalSemesterClasses}
            />

            {stat.instances.length > 0 && (
              <div className="att-sessions">
                <div className="att-sessions-head">
                  <Clock size={12} aria-hidden="true" />
                  <span>{stat.instances.length} sessions</span>
                  <span className="att-sessions-hint">
                    {editMode ? 'Tap to mark' : 'Switch to Edit to mark'}
                  </span>
                </div>

                <ul className="att-session-list">
                  {stat.instances.map((inst, instIdx) => {
                    const mark = markFor(inst);
                    const isToday = toISODate(inst.date) === toISODate(today);
                    const isFuture = inst.date > today;
                    // Show a week divider when the academic week changes, and
                    // a "Mid Break / Mid-Term — no classes" marker in the gap.
                    const prev = instIdx > 0 ? stat.instances[instIdx - 1] : null;
                    const newWeek = !prev || prev.weekNum !== inst.weekNum;
                    const crossedGap = prev && inst.weekNum - prev.weekNum === 1 && inst.weekNum === 8;
                    const dateText = inst.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const markLabel = `${stat.course} on ${dateText}`;
                    return (
                      <Fragment key={inst.id}>
                        {newWeek && (
                          <>
                            {crossedGap && (
                              <li className="att-week-gap">Mid Break · Mid-Term — no classes</li>
                            )}
                            <li className="att-week-divider">Week {inst.weekNum}</li>
                          </>
                        )}
                        <li
                          className={`att-session${mark ? ` is-${mark}` : ''}${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}`}
                          style={{ animationDelay: `${0.02 + instIdx * 0.03}s` }}
                        >
                          <span className="att-session-date">{dateText}</span>
                          <span className="att-session-day">{inst.dayName.substring(0, 3)}</span>
                          <span className="att-session-time">{inst.time || '—'}</span>
                          <span className="att-session-room">
                            <MapPin size={10} aria-hidden="true" />
                            {inst.room || '—'}
                          </span>
                          <span className="att-mark-group" role="group" aria-label={`Attendance for ${markLabel}`}>
                            <button
                              type="button"
                              className={`att-mark-btn is-present${mark === 'present' ? ' is-active' : ''}`}
                              onClick={() => setSessionStatus(inst.id, 'present')}
                              disabled={!editMode}
                              aria-pressed={mark === 'present'}
                              aria-label={`Mark ${markLabel} present`}
                              title={editMode ? (mark === 'present' ? 'Clear present' : 'Mark present') : 'Switch to Edit mode to mark'}
                            >
                              <CheckCircle2 size={13} aria-hidden="true" />
                              <span className="att-mark-text">Present</span>
                            </button>
                            <button
                              type="button"
                              className={`att-mark-btn is-absent${mark === 'absent' ? ' is-active' : ''}`}
                              onClick={() => setSessionStatus(inst.id, 'absent')}
                              disabled={!editMode}
                              aria-pressed={mark === 'absent'}
                              aria-label={`Mark ${markLabel} absent`}
                              title={editMode ? (mark === 'absent' ? 'Clear absent' : 'Mark absent') : 'Switch to Edit mode to mark'}
                            >
                              <XCircle size={13} aria-hidden="true" />
                              <span className="att-mark-text">Absent</span>
                            </button>
                          </span>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  const courseCount = courseView.length;

  return (
    <div
      className={`glass-card-static schedule-widget attendance-widget attendance-tracker-widget animate-fadeInUp${inView ? ' att-drop-active' : ''}`}
      ref={widgetRef}
    >
      <div className="schedule-masthead att-masthead">
        <div className="schedule-title-block att-masthead-title">
          <div className="schedule-icon-tile">
            <Percent size={18} aria-hidden="true" />
          </div>
          <div className="att-masthead-text">
            <span className="schedule-overline">Dashboard</span>
            <p className="schedule-title">Attendance Tracker</p>
            <span className="schedule-subtitle">
              {`${SEMESTER_WEEKS}-week semester · ${courseCount} course${courseCount === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        <div className="schedule-actions att-masthead-actions">
          <div className="att-mode-switch" role="group" aria-label="Attendance editing mode">
            <button
              type="button"
              className={`att-mode-btn${!editMode ? ' is-active' : ''}`}
              onClick={() => setEditMode(false)}
              aria-pressed={!editMode}
              aria-label="View only"
              title="View only"
            >
              <Eye size={13} aria-hidden="true" />
              <span className="att-mode-label">View</span>
            </button>
            <button
              type="button"
              className={`att-mode-btn${editMode ? ' is-active' : ''}`}
              onClick={() => setEditMode(true)}
              aria-pressed={editMode}
              aria-label="Edit attendance"
              title="Mark attendance"
            >
              <PenLine size={13} aria-hidden="true" />
              <span className="att-mode-label">Edit</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Semester summary meter ─── */}
      <section className="att-meter" aria-label="Semester attendance summary">
        <div className="att-meter-head">
          <div className="att-meter-headings">
            <span className="att-overline">Semester average</span>
            <span className="att-meter-sub">
              {overallStats.totalAttended} of {overallStats.totalHeld} held classes attended
            </span>
          </div>
          <div className="att-meter-readout">
            <span className={`att-meter-value ${overallStats.average >= MIN_ATTENDANCE ? 'is-ok' : 'is-warn'}`}>
              {overallStats.average}%
            </span>
            {overallStats.warningCount > 0 ? (
              <span className="att-status-chip is-danger">
                <TriangleAlert size={11} aria-hidden="true" />
                {overallStats.warningCount} at risk
              </span>
            ) : (
              <span className="att-status-chip is-ok">
                <ShieldCheck size={11} aria-hidden="true" />
                On track
              </span>
            )}
          </div>
        </div>

        <SegmentedMeter
          attended={overallStats.totalAttended}
          absent={overallStats.totalAbsent}
          unmarked={overallStats.unmarked}
          total={overallStats.totalHeld}
        />

        <div className="att-meter-foot">
          <span className="att-legend"><i className="att-dot is-present" aria-hidden="true" />{overallStats.totalAttended} attended</span>
          <span className="att-legend"><i className="att-dot is-absent" aria-hidden="true" />{overallStats.totalAbsent} absent</span>
          <span className="att-legend"><i className="att-dot is-unmarked" aria-hidden="true" />{overallStats.unmarked} unmarked</span>
          <span className="att-meter-target-note">{MIN_ATTENDANCE}% minimum</span>
        </div>
      </section>

      {/* ─── Course list ─── */}
      <ul className="att-course-list">
        {courseView.map(renderCourseRow)}
      </ul>

      {!sharedSemStart && (
        <p className="att-note">
          Semester start date not set — the list starts from today. An admin can set it in Semester View.
        </p>
      )}

      {isTelegramSync && (
        <p className="att-note is-sync">
          Telegram auto-marking connected — bot answers appear here instantly
        </p>
      )}
    </div>
  );
}
