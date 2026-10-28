import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, FileDown, MoreVertical, Check } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { getUserBatchGroup } from '../../utils/getUserBatchGroup';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { findCourseByCode } from '../../data/courses';
import brandMark from '../../assets/austwise-icon-final.svg';

export default function WeekSchedule() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTaskId = searchParams.get('task');
  const [viewMode, setViewMode] = useState(() => {
    const v = searchParams.get('view');
    if (v && ['daily','weekly','monthly'].includes(v)) return v;
    return 'weekly';
  });
  const viewWasChangedByUserRef = useRef(false);
  useEffect(() => {
    try { localStorage.setItem('aust-semester-view', viewMode); } catch {}
    // A mount or dashboard-tab change must never navigate using a stale
    // search-param setter. Only a deliberate Day/Week/Month selection writes
    // the view into the URL.
    if (!viewWasChangedByUserRef.current) return;
    viewWasChangedByUserRef.current = false;
    const v = searchParams.get('view');
    if (v !== viewMode) {
      const next = new URLSearchParams(searchParams);
      next.set('view', viewMode);
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);
  const changeViewMode = (nextView) => {
    viewWasChangedByUserRef.current = true;
    setViewMode(nextView);
  };
  const [semesterStart, setSemesterStart] = useLiveValue(
    'shared', 'semester-start-date', new Date().toISOString().split('T')[0]
  );
  // Always open on today's date. The currently scrolled week is transient UI
  // state, so a refresh returns the user to the current week.
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [, setSelectedDay] = useState(null);
  const [newTask, setNewTask] = useState({
    courseCode: '',
    courseName: '',
    title: '',
    syllabus: '',
    date: '',
    time: ''
  });

  // State for viewing task details
  const [selectedTask, setSelectedTask] = useState(null);

  // Batch filter for calendar view
  const [batchFilter, setBatchFilter] = useState('all');

  // Available batch groups (A1, A2, B1, B2, C1, C2, D1, D2)
  const batchGroups = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];

  // Tasks can be added by admins and CRs; SRs have view-only access here.
  const canAddTask = user?.role === 'admin' || user?.role === 'cr';

  // Only admins may change the semester start date; everyone else can view it.
  const canManageStartDate = user?.role === 'admin';

  // Local draft of the start date before the admin/CR saves it.
  const [startDraft, setStartDraft] = useState(null);
  const [startSaved, setStartSaved] = useState(false);

  // Get CR group info
  const crGroup = (() => {
    if (user?.role === 'cr') {
      return user?.section ? `Section ${user.section}` : user?.batch ? `Batch ${user.batch}` : '';
    }
    return '';
  })();

  const userBatchGroup = getUserBatchGroup(user);

  // Save semester start date (shared value — admin only)
  const saveSemesterStart = (date) => {
    if (!canManageStartDate) return;
    setSemesterStart(date);
    setCurrentDate(new Date(date + 'T00:00:00'));
  };

  // Handle course code selection
  const handleCourseCodeSelect = (course) => {
    if (course) {
      const courseData = findCourseByCode(course.code, user?.department);
      setNewTask({
        ...newTask,
        courseCode: course.code,
        courseName: courseData ? courseData.name : (course.name || '')
      });
    } else {
      setNewTask({
        ...newTask,
        courseCode: '',
        courseName: ''
      });
    }
  };

  const getWeekDates = useCallback((refDate) => {
    const startOfWeek = new Date(refDate);
    startOfWeek.setDate(refDate.getDate() - ((refDate.getDay() - 5 + 7) % 7));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate, getWeekDates]);

  const monthDates = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() - 5 + 7) % 7;
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [currentDate]);

  const getWeekNumForDate = (date) => {
    // Normalize both Fridays to midnight so diff is always exact 7-day multiples
    const toFriday = (d) => {
      const f = new Date(d);
      f.setDate(d.getDate() - ((d.getDay() - 5 + 7) % 7));
      f.setHours(0, 0, 0, 0);
      return f;
    };
    const diff = toFriday(date).getTime() - toFriday(new Date(semesterStart)).getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  };

  const getCurrentWeekNum = () => getWeekNumForDate(currentDate);

  const getWeekLabel = () => {
    const raw = Math.max(1, Math.min(17, getCurrentWeekNum()));
    if (raw <= 7) return `Week ${raw}`;
    if (raw === 8) return 'Mid Break';
    if (raw === 9) return 'Mid Exam';
    if (raw <= 16) return `Week ${raw - 2}`;
    return 'Post-Semester';
  };

  const stepSchedulePeriod = (direction) => {
    const date = new Date(currentDate);
    if (viewMode === 'daily') date.setDate(date.getDate() + direction);
    else if (viewMode === 'monthly') date.setMonth(date.getMonth() + direction);
    else if ((direction < 0 && canGoPrev()) || (direction > 0 && canGoNext())) {
      date.setDate(date.getDate() + direction * 7);
    }
    setCurrentDate(date);
  };

  // Forward scroll stops at the 17-week semester window, but never earlier
  // than the real current week. During the post-semester break "now" sits past
  // week 17, so without this the next-week arrow dies one step after it.
  const canGoNext = () => {
    const todayWeek = getWeekNumForDate(new Date());
    const maxWeek = Number.isFinite(todayWeek) ? Math.max(17, todayWeek) : 17;
    return getCurrentWeekNum() < maxWeek;
  };
  const canGoPrev = () => getCurrentWeekNum() > 1;

  // Load tasks from localStorage — now live-synced across devices
  const [tasks, setTasks] = useLiveValue('user', 'aust-week-tasks', []);

  // CR-published tasks are shared by cohort and lab group. Every member of the
  // same department/semester reads all eight groups in Semester View.
  const sharedTaskPrefix = user?.department && user?.semester
    ? `aust-semester-tasks:${String(user.department).trim().toUpperCase()}:${user.semester}`
    : '';
  const [tasksA1, setTasksA1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:A1` : null, []);
  const [tasksA2, setTasksA2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:A2` : null, []);
  const [tasksB1, setTasksB1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:B1` : null, []);
  const [tasksB2, setTasksB2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:B2` : null, []);
  const [tasksC1, setTasksC1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:C1` : null, []);
  const [tasksC2, setTasksC2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:C2` : null, []);
  const [tasksD1, setTasksD1] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:D1` : null, []);
  const [tasksD2, setTasksD2] = useLiveValue('shared', sharedTaskPrefix ? `${sharedTaskPrefix}:D2` : null, []);
  const sharedTaskStores = {
    A1: [tasksA1, setTasksA1], A2: [tasksA2, setTasksA2],
    B1: [tasksB1, setTasksB1], B2: [tasksB2, setTasksB2],
    C1: [tasksC1, setTasksC1], C2: [tasksC2, setTasksC2],
    D1: [tasksD1, setTasksD1], D2: [tasksD2, setTasksD2],
  };
  const sharedSemesterTasks = useMemo(() => batchGroups.flatMap((group) =>
    (sharedTaskStores[group][0] || []).map((task) => ({ ...task, batchGroup: group, isSharedSemesterTask: true }))
  ), [tasksA1, tasksA2, tasksB1, tasksB2, tasksC1, tasksC2, tasksD1, tasksD2]);
  const semesterTasks = useMemo(() => [...tasks, ...sharedSemesterTasks], [tasks, sharedSemesterTasks]);

  useEffect(() => {
    if (!requestedTaskId) return;
    const task = semesterTasks.find((item) => String(item.id) === requestedTaskId);
    if (task) setSelectedTask(task);
  }, [requestedTaskId, semesterTasks]);

  const saveTasks = (updatedTasks) => setTasks(updatedTasks);

  const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getTasksForDate = (date) => {
    const key = formatDateKey(date);
    let filteredTasks = semesterTasks.filter(task => task.date === key);
    
    if (batchFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.batchGroup === batchFilter);
    }
    
    return filteredTasks;
  };

  // Day-cell density: neutral → primary accent as the day gets busier.
  // No rotating palette — calm days are neutral, busy days are the amber accent.
  const getDayDensityColor = (count) => {
    if (count >= 2) return 'var(--accent-amber)';
    if (count === 1) return 'var(--text-secondary)';
    return 'var(--text-tertiary)';
  };

  // Shared day-cell renderer — used identically by Day, Week and Month views.
  const renderDayCard = (date, opts = {}) => {
    const { limit } = opts;
    if (isInitialLoading) {
      return (
        <div key={formatDateKey(date)} className="schedule-day-card skeleton-row">
          <div className="skeleton-line skeleton-line--short" style={{ width:'40%', height:'10px' }} />
          <div className="skeleton-line skeleton-line--full" style={{ height:'24px', marginTop:'8px' }} />
        </div>
      );
    }
    const dayTasks = getTasksForDate(date);
    const visibleTasks = limit ? dayTasks.slice(0, limit) : dayTasks;
    const densityColor = getDayDensityColor(dayTasks.length);
    if (isBeforeSemesterStart(date)) {
      return (
        <div key={formatDateKey(date)} className="schedule-day-card before-semester">
          <div className="schedule-empty">{getDayNumber(date)}</div>
        </div>
      );
    }
    return (
      <div key={formatDateKey(date)} className={`schedule-day-card${isToday(date) ? ' today' : ''}`}>
        <div className="schedule-day-top">
          <div className="schedule-day-num-wrap">
            <div className={`schedule-day-num${isToday(date) ? ' today' : ''}`}>{getDayNumber(date)} <span className="schedule-day-month">{getMonthName(date)}</span></div>
          </div>
          <div className="schedule-day-badges">
            {dayTasks.length > 0 && <span className={`schedule-day-count${dayTasks.length >= 3 ? ' hot' : ''}`}>{dayTasks.length}</span>}
          </div>
        </div>
        <div className="schedule-task-list">
          {visibleTasks.map(task => (
            <div key={task.id} onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
              className="schedule-task-item"
              style={{ background: `${getTypeColor(task.type)}15`, borderLeft: `2px solid ${densityColor}` }}>
              {task.batchGroup && <span className="schedule-task-batch">{task.batchGroup}</span>}
              <div className="schedule-task-info">
                {task.courseCode && <span className="schedule-task-code" style={{ color: densityColor }}>{task.courseCode}</span>}
                <span className="schedule-task-title">{task.title}</span>
              </div>
            </div>
          ))}
          {limit && dayTasks.length > limit && (
            <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', textAlign: 'center' }}>+{dayTasks.length - limit} more</div>
          )}
          {dayTasks.length === 0 && (
            <div className="schedule-empty" style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'center' }}>
              <span>Clear</span>
              {canAddTask && <span style={{ fontSize:'10px', color:'var(--text-tertiary)' }}>Tap + Add Task</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Human-friendly semester string, e.g. "Year 3 - Semester 1" → "3rd Year, 1 Sem"
  const fmtSem = (s) => {
    const m = (s || '').match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
    if (!m) return s;
    const ord = +m[1] === 1 ? '1st' : +m[1] === 2 ? '2nd' : +m[1] === 3 ? '3rd' : `${m[1]}th`;
    return `${ord} Year, ${m[2]} Sem`;
  };

  // Week stats for the current visible range — memoized via weekDates
  const weekTaskCount = useMemo(() => weekDates.reduce((sum, d) => sum + getTasksForDate(d).length, 0), [weekDates, tasks, sharedSemesterTasks, batchFilter]);
  const weekDaysWithTasks = useMemo(() => weekDates.filter(d => getTasksForDate(d).length > 0).length, [weekDates, tasks, sharedSemesterTasks, batchFilter]);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.date) return;

    const task = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      courseCode: newTask.courseCode.trim(),
      courseName: newTask.courseName.trim(),
      title: newTask.title.trim(),
      syllabus: newTask.syllabus.trim(),
      date: newTask.date,
      time: newTask.time || '',
      batchGroup: userBatchGroup,
      crGroup: crGroup || undefined,
      createdByName: user?.role === 'cr' ? user.name : undefined,
      crSection: user?.role === 'cr' ? user.section : undefined,
      crLabGroup: user?.role === 'cr' ? userBatchGroup : undefined,
      createdAt: new Date().toISOString()
    };

    if (user?.role === 'cr') {
      const [, setGroupTasks] = sharedTaskStores[userBatchGroup] || [];
      if (setGroupTasks) {
        void setGroupTasks((current) => [...(Array.isArray(current) ? current : []), {
          ...task,
          isSharedSemesterTask: true,
          createdBy: user.id,
        }]);
      }
    } else {
      saveTasks([...tasks, task]);
    }
    setNewTask({ 
      courseCode: '', 
      courseName: '', 
      title: '', 
      syllabus: '', 
      date: '', 
      time: ''
    });
    setShowAddModal(false);
  };

  const handleDeleteTask = (taskId) => {
    const target = semesterTasks.find((task) => task.id === taskId);
    if (target?.isSharedSemesterTask) {
      if (target.createdBy !== user?.id && user?.role !== 'admin') return;
      const [, setGroupTasks] = sharedTaskStores[target.batchGroup] || [];
      if (setGroupTasks) void setGroupTasks((current) => current.filter((task) => task.id !== taskId));
      return;
    }
    saveTasks(tasks.filter(task => task.id !== taskId));
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if a date is before semester start
  const isBeforeSemesterStart = (date) => {
    const startDate = new Date(semesterStart);
    startDate.setHours(0, 0, 0, 0);
    return date < startDate;
  };

  const getDayNumber = (date) => {
    return date.getDate();
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  // Task type is a CATEGORY, not a semantic state — so it always resolves to
  // the single primary accent (amber) for a consistent schedule. No more
  // blue/purple/rose/emerald/cyan rotating by type.
  const getTypeColor = () => 'var(--accent-amber)';

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setIsInitialLoading(false), 700); return () => clearTimeout(t); }, []);
  const exportRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target) && menuRef.current && !menuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const scheduleRef = useRef(null);

  const downloadSchedulePDF = useCallback(async () => {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas-pro'), import('jspdf')
    ]);
    const el = scheduleRef.current;
    if (!el) return;

    const root = document.documentElement;
    const cs = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const bg = cs('--bg-primary');
    const textPri = cs('--text-primary');
    const textSec = cs('--text-secondary');
    const textTer = cs('--text-tertiary');
    const logoUrl = brandMark;

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0; width: fit-content; max-width: 1200px;
      background: ${bg};
      font-family: system-ui, -apple-system, sans-serif;
      padding-bottom: 10px;
    `;

    const ord = (n) => n + ({1:'st',2:'nd',3:'rd'}[n]||'th');
    const fmtSem = (s) => {
      const m = (s||'').match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
      return m ? `${ord(+m[1])} Year, ${+m[2]}${['th','st','nd','rd'][+m[2]]||'th'} Sem` : s;
    };
    const semStr = user?.yearSemester || user?.semester || '';
    const deptStr = user?.department || '';

    const brandBar = document.createElement('div');
    brandBar.style.cssText = 'padding: 4px 8px;';
    brandBar.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <img src="${logoUrl}" alt="AUSTWise" style="width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;" />
          <div style="display: flex; flex-direction: column; justify-content: center; margin-top: -14px;">
            <div style="font-size: 16px; font-weight: 800; color: ${textPri}; letter-spacing: -0.01em; line-height: 1.1;">AUSTWise</div>
            <div style="font-size: 8px; color: ${textTer}; letter-spacing: 0.06em; text-transform: uppercase;">Your Academic Companion</div>
          </div>
        </div>
        ${(deptStr || semStr) ? `<div style="font-size: 12px; color: ${textSec}; font-weight: 600; text-align: center; line-height: 1.5;">
          ${deptStr ? `<div>${deptStr}</div>` : ''}
          ${semStr ? `<div>${fmtSem(semStr)}</div>` : ''}
        </div>` : ''}
        <div style="text-align: right;">
          <div style="font-size: 8px; color: ${textTer}; text-transform: uppercase; letter-spacing: 0.06em;">Generated</div>
          <div style="font-size: 11px; color: ${textPri}; font-weight: 700; margin-top: 1px;">
            ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    `;
    container.appendChild(brandBar);

    const isMonthly = viewMode === 'monthly';
    const clone = el.cloneNode(true);
    clone.style.cssText = `overflow: visible; border-radius: ${isMonthly ? 0 : 8}px; padding: 0;`;
    clone.style.margin = '6px 8px 0';
    container.appendChild(clone);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: isMonthly ? 3 : 2.5, useCORS: true, backgroundColor: bg || '#ffffff',
        logging: false, width: container.scrollWidth, height: container.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgW = isMonthly ? canvas.width * 0.2646 : 290;
      const imgH = isMonthly ? canvas.height * 0.2646 : (canvas.height * imgW) / canvas.width;
      const pageW = imgW + 8;
      const pageH = imgH + 4;

      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: [pageW, pageH] });
      const hex = bg.replace('#', '');
      if (hex.length >= 6) {
        pdf.setFillColor(parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16));
        pdf.rect(0, 0, pageW, pageH, 'F');
      }
      pdf.addImage(imgData, 'PNG', 4, 2, imgW, imgH);
      pdf.save('AUST-14Week-Schedule.pdf');
    } finally {
      document.body.removeChild(container);
    }
  }, [user, viewMode]);

  const downloadScheduleImage = useCallback(async () => {
    const { default: html2canvas } = await import('html2canvas-pro');
    const el = scheduleRef.current;
    if (!el) return;

    const root = document.documentElement;
    const cs = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const bg = cs('--bg-primary');
    const textPri = cs('--text-primary');
    const textSec = cs('--text-secondary');
    const textTer = cs('--text-tertiary');
    const logoUrl = brandMark;

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0; width: fit-content; max-width: 1200px;
      background: ${bg};
      font-family: system-ui, -apple-system, sans-serif;
      padding-bottom: 10px;
    `;

    const ord = (n) => n + ({1:'st',2:'nd',3:'rd'}[n]||'th');
    const fmtSem = (s) => {
      const m = (s||'').match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
      return m ? `${ord(+m[1])} Year, ${+m[2]}${['th','st','nd','rd'][+m[2]]||'th'} Sem` : s;
    };
    const semStr = user?.yearSemester || user?.semester || '';
    const deptStr = user?.department || '';

    const brandBar = document.createElement('div');
    brandBar.style.cssText = 'padding: 4px 8px;';
    brandBar.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <img src="${logoUrl}" alt="AUSTWise" style="width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;" />
          <div style="display: flex; flex-direction: column; justify-content: center; margin-top: -14px;">
            <div style="font-size: 16px; font-weight: 800; color: ${textPri}; letter-spacing: -0.01em; line-height: 1.1;">AUSTWise</div>
            <div style="font-size: 8px; color: ${textTer}; letter-spacing: 0.06em; text-transform: uppercase;">Your Academic Companion</div>
          </div>
        </div>
        ${(deptStr || semStr) ? `<div style="font-size: 12px; color: ${textSec}; font-weight: 600; text-align: center; line-height: 1.5;">
          ${deptStr ? `<div>${deptStr}</div>` : ''}
          ${semStr ? `<div>${fmtSem(semStr)}</div>` : ''}
        </div>` : ''}
        <div style="text-align: right;">
          <div style="font-size: 8px; color: ${textTer}; text-transform: uppercase; letter-spacing: 0.06em;">Generated</div>
          <div style="font-size: 11px; color: ${textPri}; font-weight: 700; margin-top: 1px;">
            ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    `;
    container.appendChild(brandBar);

    const isMonthly = viewMode === 'monthly';
    const clone = el.cloneNode(true);
    clone.style.cssText = `overflow: visible; border-radius: ${isMonthly ? 0 : 8}px; padding: 0;`;
    clone.style.margin = '6px 8px 0';
    container.appendChild(clone);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: isMonthly ? 3 : 2.5, useCORS: true, backgroundColor: bg || '#ffffff',
        logging: false, width: container.scrollWidth, height: container.scrollHeight,
      });

      const link = document.createElement('a');
      link.download = 'AUST-14Week-Schedule.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      document.body.removeChild(container);
    }
  }, [user, viewMode]);

  return (
    <div className="glass-card-static schedule-widget week-schedule-widget animate-fadeInUp" style={{ minHeight: '680px' }}>

      <div className="schedule-fixed-header">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Calendar size={30} />
          </div>
          <div>
            <span className="schedule-overline">Dashboard</span>
            <p className="schedule-title">14-Weeks View</p>
            <span className="schedule-subtitle">
              {user?.department || 'AUST'}
              {user?.yearSemester ? ` · ${fmtSem(user.yearSemester)}` : ''}
            </span>
          </div>
        </div>
        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{weekTaskCount}</span>
              <span className="schedule-stat-label">tasks</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{weekDaysWithTasks}</span>
              <span className="schedule-stat-label">busy days</span>
            </div>
          </div>
        </div>
        <div className="schedule-actions">
          <div className="schedule-week-nav" role="group" aria-label="Change schedule period">
            <button
              type="button"
              className="schedule-nav-btn"
              aria-label={viewMode === 'weekly' ? 'Previous week' : viewMode === 'monthly' ? 'Previous month' : 'Previous day'}
              disabled={viewMode === 'weekly' && !canGoPrev()}
              onClick={() => stepSchedulePeriod(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="schedule-week-pill">
              <span className="schedule-week-pill-value">
                {viewMode === 'daily'
                  ? currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                  : viewMode === 'monthly'
                    ? currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : getWeekLabel()}
              </span>
            </div>
            <button
              type="button"
              className="schedule-nav-btn"
              aria-label={viewMode === 'weekly' ? 'Next week' : viewMode === 'monthly' ? 'Next month' : 'Next day'}
              disabled={viewMode === 'weekly' && !canGoNext()}
              onClick={() => stepSchedulePeriod(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="export-dropdown" ref={exportRef}>
            <button className="schedule-nav-btn" ref={menuBtnRef} onClick={() => {
              if (!showExportMenu && menuBtnRef.current) {
                const rect = menuBtnRef.current.getBoundingClientRect();
                setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
              }
              setShowExportMenu(!showExportMenu);
            }} aria-label="More options" aria-haspopup="true">
              <MoreVertical size={18} />
            </button>
            {showExportMenu && createPortal(
              <div ref={menuRef} className="export-menu routine-more-menu" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 99999 }}>
                <button
                  className={`export-menu-item${viewMode === 'daily' ? ' menu-active' : ''}`}
                  onClick={() => { setCurrentDate(new Date()); changeViewMode('daily'); setShowExportMenu(false); }}
                >
                  <CalendarDays size={14} /> Day View {viewMode === 'daily' && <Check size={14} className="menu-check" />}
                </button>
                <button
                  className={`export-menu-item${viewMode === 'weekly' ? ' menu-active' : ''}`}
                  onClick={() => { changeViewMode('weekly'); setShowExportMenu(false); }}
                >
                  <CalendarRange size={14} /> Week View {viewMode === 'weekly' && <Check size={14} className="menu-check" />}
                </button>
                <button
                  className={`export-menu-item${viewMode === 'monthly' ? ' menu-active' : ''}`}
                  onClick={() => {
                    const d = new Date(currentDate);
                    d.setDate(15);
                    setCurrentDate(d);
                    changeViewMode('monthly');
                    setShowExportMenu(false);
                  }}
                >
                  <Calendar size={14} /> Month View {viewMode === 'monthly' && <Check size={14} className="menu-check" />}
                </button>
                <div className="export-menu-sep" />
                <button className="export-menu-item" onClick={() => { downloadSchedulePDF(); setShowExportMenu(false); }}>
                  <FileDown size={14} /> Export as PDF
                </button>
                <button className="export-menu-item" onClick={() => { downloadScheduleImage(); setShowExportMenu(false); }}>
                  <FileDown size={14} /> Export as Image
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* Semester Start Date box */}
      <div className="schedule-semester-box" style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        background: 'var(--accent-blue-glow)',
        border: '1px solid color-mix(in srgb, var(--accent-blue) 18%, transparent)',
        borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '12px',
      }}>
        <span style={{ fontSize: '16px' }}>📅</span>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Semester Start Date
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            {semesterStart
              ? new Date(semesterStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              : 'Not set yet'}
            {' · '}
            {getWeekLabel()}
          </div>
        </div>
        {canManageStartDate ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="input"
              value={startDraft ?? semesterStart}
              onChange={(e) => setStartDraft(e.target.value)}
              style={{ maxWidth: '150px', fontSize: '11px', padding: '4px 6px' }}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={startDraft == null || startDraft === semesterStart}
              onClick={() => { saveSemesterStart(startDraft); setStartDraft(null); setStartSaved(true); setTimeout(() => setStartSaved(false), 2000); }}
              style={{ fontSize: 'var(--fs-xs)' }}
            >
              {startSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        ) : (
          <span className="badge badge-blue" style={{ fontSize: '10px' }}>Set by admin · view only</span>
        )}
      </div>
      </div>{/* end schedule-fixed-header */}

      <div className="schedule-scroll-body" ref={scheduleRef}>
      {viewMode === 'daily' ? (() => {
        const date = currentDate;
        return (
          <div className={`schedule-daily-view${isToday(date) ? ' today' : ''}`}>
            <div className="schedule-daily-header">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                <span className={`schedule-daily-dayname${isToday(date) ? ' today' : ''}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'long' })}
                </span>
                <span className="schedule-daily-date">
                  {date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {isToday(date) && (
                <span className="schedule-daily-badge">TODAY</span>
              )}
            </div>
            <div className="schedule-daily-grid">
              {renderDayCard(date)}
            </div>
            {canAddTask && (
              <button className="schedule-add-btn" onClick={(e) => { e.stopPropagation(); setSelectedDay(date); setNewTask({ ...newTask, date: formatDateKey(date) }); setShowAddModal(true); }}>
                + Add Task
              </button>
            )}
          </div>
        );
      })() : viewMode === 'monthly' ? (
        <>
          <div className="schedule-month-grid schedule-days-row" style={{ marginBottom: '12px' }}>
            {['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((day, i) => (
              <div key={day} className={`schedule-month-header${i < 2 ? ' weekend' : ''}`}>{day}</div>
            ))}
          </div>
          <div className="schedule-month-grid">
            {monthDates.map((date, idx) => {
              if (!date) return <div key={`pad-${idx}`} />;
              return renderDayCard(date, { limit: 5 });
            })}
          </div>
        </>
      ) : (
        <>
          <div className="schedule-week-scroll">
            <div className="schedule-grid schedule-days-row" style={{ marginBottom: '12px' }}>
              {['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((day, i) => (
                <div key={day} className={`schedule-day-header${i < 2 ? ' weekend' : ''}`}>{day}</div>
              ))}
            </div>
            <div className="schedule-grid">
              {weekDates.map(date => renderDayCard(date))}
            </div>
          </div>
        </>
      )}

      {canAddTask && viewMode !== 'daily' && (
        <button className="schedule-add-btn" onClick={() => {
          const d = currentDate;
          setSelectedDay(d);
          setNewTask({ ...newTask, date: formatDateKey(d) });
          setShowAddModal(true);
        }}>
          + Add Task
        </button>
      )}

      </div>{/* end schedule-scroll-body */}

      {/* Batch Filter */}
      <div className="schedule-footer">
      <div className="schedule-filter-bar">
        <span className="schedule-filter-label">Filter:</span>
        <button
          className={`schedule-filter-btn${batchFilter === 'all' ? ' active-all' : ''}`}
          onClick={() => setBatchFilter('all')}
        >
          All
        </button>
        {batchGroups.map(bg => (
          <button
            key={bg}
            className={`schedule-filter-btn${batchFilter === bg ? ' active-batch' : ''}`}
            onClick={() => setBatchFilter(bg)}
          >
            {bg}
          </button>
        ))}
        {batchFilter !== 'all' && (
          <span className="schedule-filter-hint">
            (Showing {batchFilter} only)
          </span>
        )}
      </div>
      <p className="schedule-filter-note">
        Shared CR tasks from all lab groups appear here; Deadline shows only your lab group’s tasks.
      </p>
      </div>{/* end schedule-footer */}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal glass-card-static task-detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%', padding: 'var(--sp-5)', margin: 0 }}>
            <div className="flex justify-between items-start" style={{ marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>{selectedTask.title}</h3>
                {selectedTask.courseName && (
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', margin: '4px 0 0' }}>{selectedTask.courseName}</p>
                )}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedTask(null)} style={{ flexShrink: 0 }}>
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedTask.courseCode && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', minWidth: '60px' }}>Course:</span>
                  <span className="badge badge-cyan" style={{ fontWeight: 'bold' }}>{selectedTask.courseCode}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', minWidth: '60px' }}>Date:</span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>{selectedTask.date}</span>
              </div>
              {selectedTask.time && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', minWidth: '60px' }}>Time:</span>
                  <span style={{ fontSize: 'var(--fs-sm)' }}>{selectedTask.time}</span>
                </div>
              )}
              {selectedTask.syllabus && (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Syllabus:</span>
                  <div className="input" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', padding: 'var(--sp-3)', cursor: 'default', opacity: 0.9 }}>
                    {selectedTask.syllabus}
                  </div>
                </div>
              )}
              {selectedTask.crGroup && (
                <>
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', minWidth: '60px' }}>Posted by:</span>
                    <span className="badge badge-emerald">{selectedTask.createdByName || selectedTask.crName || 'CR'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                      {selectedTask.crSection ? `Section ${selectedTask.crSection}` : selectedTask.crGroup}
                      {(selectedTask.crLabGroup || selectedTask.batchGroup) ? ` · Lab ${selectedTask.crLabGroup || selectedTask.batchGroup}` : ''}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-2" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-secondary)' }}>
              {(selectedTask.isSharedSemesterTask
                ? (selectedTask.createdBy === user?.id || user?.role === 'admin')
                : canAddTask) && (
                <button className="btn btn-danger btn-sm flex-1" onClick={() => { handleDeleteTask(selectedTask.id); setSelectedTask(null); }}>
                  Delete Task
                </button>
              )}
              <button className="btn btn-secondary btn-sm flex-1" onClick={() => setSelectedTask(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && canAddTask && (
        <div className="modal-overlay add-task-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal glass-card-static add-task-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '280px', width: '85%', padding: '6px 10px 4px', boxSizing: 'border-box' }}>
            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {user?.role === 'cr' && (
                <p style={{ margin: '2px 0 6px', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.45 }}>
                  Shared with all lab groups in {user.department}, semester {user.semester}. It appears in Deadline for {userBatchGroup} only.
                </p>
              )}
              <div>
                <CourseAutocomplete
                  value={newTask.courseCode}
                  onCourseSelect={handleCourseCodeSelect}
                  placeholder="Code (e.g. CSE1101)"
                  type="code"
                  department={user?.department}
                />
              </div>
              <input id="week-task-course-name" name="courseName" type="text" value={newTask.courseName} onChange={(e) => setNewTask({ ...newTask, courseName: e.target.value })} className="input" placeholder="Course name" disabled style={{ opacity: newTask.courseName ? 1 : 0.6, width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '4px 6px' }} />
              <input id="week-task-title" name="title" type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="input" placeholder="Title (e.g. Quiz 1)" required style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '4px 6px' }} />
              <div style={{ display: 'flex', gap: '4px' }}>
                <input id="week-task-date" name="date" type="date" value={newTask.date} onChange={(e) => setNewTask({ ...newTask, date: e.target.value })} className="input" required style={{ flex: 1, fontSize: '11px', padding: '4px 6px', minWidth: 0, boxSizing: 'border-box' }} />
                <input id="week-task-time" name="time" type="time" value={newTask.time} onChange={(e) => setNewTask({ ...newTask, time: e.target.value })} className="input" style={{ flex: 1, fontSize: '11px', padding: '4px 6px', minWidth: 0, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: '11px', padding: '3px 8px', minHeight: '24px' }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, fontSize: '11px', padding: '3px 8px', minHeight: '24px' }}>Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
