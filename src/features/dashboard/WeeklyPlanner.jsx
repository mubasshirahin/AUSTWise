import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X, Download, Check, RotateCcw, FileDown, Share2, Search, Loader2, MoreVertical, Moon, Image as ImageIcon, CalendarDays, Building2, GraduationCap } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { getCourseColor } from '../../utils/colorPalette';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import RoomAutocomplete from '../../components/RoomAutocomplete';
import TeacherAutocomplete from '../../components/TeacherAutocomplete';
import { getAutoColorForCourse } from '../../utils/autoColorPalette';
import brandMark from '../../assets/austwise-icon-final.svg';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import { userStore } from '../../utils/storageService';

const isGeneratedRoutineFixture = (routine) => String(routine?.id || '').startsWith('dev-rt-');

export default function WeeklyPlanner() {
  const { user } = useAuth();
  const { routine, weekDays, isLoading, updateRoutineClass, addRoutineClass, deleteRoutineClass, replaceRoutine } = useRoutine();
  const [editing, setEditing] = useState(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [ramadanMode, setRamadanMode] = useState(() => {
    const stored = localStorage.getItem('aust-ramadan-mode');
    return stored === 'true';
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [activeDay, setActiveDay] = useState(null);
  const ActiveDayRef = useRef(null);
  ActiveDayRef.current = activeDay;
  const exportRef = useRef(null);

  // ── Pinch-to-zoom for routine grid on mobile ──
  const tableWrapRef = useRef(null);
  const [gridScale, setGridScale] = useState(1);
  const pinchRef = useRef({ initialDist: 0, initialScale: 1 });
  const lastTapRef = useRef(0);



  const getDistance = useCallback((touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchRef.current = {
        initialDist: getDistance(e.touches),
        initialScale: gridScale,
      };
    }
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        e.preventDefault();
        setGridScale(prev => prev === 1 ? 1.8 : 1);
      }
      lastTapRef.current = now;
    }
  }, [gridScale, getDistance]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches);
      const ratio = dist / pinchRef.current.initialDist;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 0.8), 3);
      setGridScale(newScale);
    }
  }, [getDistance]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.initialDist = 0;
  }, []);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const zoomVars = gridScale > 1 ? {
    '--cell-pad': `${3 * gridScale}px`,
    '--cell-min-h': `${Math.min(Math.max(gridScale * 30, 30), 80)}px`,
    '--code-size': `${Math.min(Math.max(7 * gridScale, 7), 14)}px`,
  } : {};

  // ── Shared routine (CR publishing) ──
  // One CR slot per (dept × semester × section × lab group). A-D sections × 2
  // lab groups × 8 sems × 8 depts = 512. The badge shows this only as a
  // fallback; the server /api/routines/shared/stats returns the live total.
  const CR_TOTAL_SLOTS = 512;
  const isCR = !!(user && (user.role === 'cr' || (typeof user.hasRole === 'function' && user.hasRole('cr'))));
  const isFaculty = !!(user && (user.role === 'faculty' || (typeof user.hasRole === 'function' && user.hasRole('faculty'))));
  const [sharedRoutines, setSharedRoutines] = useState([]);
  const [sharedRoutinesReady, setSharedRoutinesReady] = useState(false);
  const [sharedStats, setSharedStats] = useState({ shared: 0, total: CR_TOTAL_SLOTS });
  const [sharedLoading, setSharedLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState(null);
  // ── Load Routine overlay filters ──
  const [loadSearch, setLoadSearch] = useState('');
  const [loadDept, setLoadDept] = useState('all');
  const [loadSem, setLoadSem] = useState('all');
  const [loadError, setLoadError] = useState('');
  const [loadedSharedRoutine, setLoadedSharedRoutine] = useState(null);

  useEffect(() => {
    localStorage.setItem('aust-ramadan-mode', ramadanMode);
  }, [ramadanMode]);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      // Clicking outside the routine grid clears the day highlight.
      if (ActiveDayRef.current && tableWrapRef.current && !tableWrapRef.current.contains(e.target)) {
        setActiveDay(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keep the shared-routine counter fresh on the toolbar, and (for CRs) load
  // the published list so the masthead Share button reflects the live state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/routines/shared/stats', { credentials: 'same-origin' });
        const data = await res.json();
        if (!cancelled && data.stats) setSharedStats(data.stats);
      } catch { /* server not reachable — keep defaults */ }
      if (!cancelled && isCR) {
        try {
          const listRes = await fetch('/api/routines/shared', { credentials: 'same-origin' });
          const listData = await listRes.json();
          if (!cancelled && listData.routines) {
            setSharedRoutines(listData.routines.filter((routine) => !isGeneratedRoutineFixture(routine)));
            setSharedRoutinesReady(true);
          }
        } catch { /* keep empty list */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (showLoadModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showLoadModal]);


  // Time slot columns — same grid always, just the labels change for Ramadan
  const timeSlots = [
    { label: '08:00 AM - 08:50 AM', display: '08:00-08:50' },
    { label: '08:50 AM - 09:40 AM', display: '08:50-09:40' },
    { label: '09:40 AM - 10:30 AM', display: '09:40-10:30' },
    { label: '10:30 AM - 11:20 AM', display: '10:30-11:20' },
    { label: '11:20 AM - 12:10 PM', display: '11:20-12:10' },
    { label: '12:10 PM - 01:00 PM', display: '12:10-01:00' },
    { label: '01:00 PM - 01:50 PM', display: '01:00-01:50' },
    { label: '01:50 PM - 02:40 PM', display: '01:50-02:40' },
    { label: '02:40 PM - 03:30 PM', display: '02:40-03:30' },
    { label: '03:30 PM - 04:20 PM', display: '03:30-04:20' },
    { label: '04:20 PM - 05:10 PM', display: '04:20-05:10' },
    { label: '05:10 PM - 06:00 PM', display: '05:10-06:00' },
  ];

  // Ramadan display labels — same 12 columns, just 40-min names
  const ramadanDisplays = [
    '08:00-08:40', '08:40-09:20', '09:20-10:00', '10:00-10:40',
    '10:40-11:20', '11:20-12:00', '12:00-12:40', '12:40-01:20',
    '01:20-02:00', '02:00-02:40', '02:40-03:20', '03:20-04:00',
  ];

  const slotBoundaries = [
    '08:00', '08:50', '09:40', '10:30', '11:20', '12:10',
    '13:00', '13:50', '14:40', '15:30', '16:20', '17:10', '18:00',
  ];

  const normalizeTime = (value) => {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3]?.toLowerCase();

    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    if (!period && hour >= 1 && hour <= 6) hour += 12;

    return `${String(hour).padStart(2, '0')}:${minute}`;
  };

  // Calculate end time based on start time and number of periods
  const calculateEndTime = (startTime, periods) => {
    const start = normalizeTime(startTime.trim());
    if (!start) return '08:50';
    
    const startIdx = slotBoundaries.indexOf(start);
    if (startIdx === -1) return '08:50';
    
    const endIdx = Math.min(startIdx + periods, slotBoundaries.length - 1);
    return slotBoundaries[endIdx];
  };

  const emptyForm = {
    course: '',
    name: '',
    type: 'Theory',
    time: '08:00 - 08:50',
    room: '',
    teacher: 'TBA',
    color: getAutoColorForCourse('', 'Theory'),
    biWeekly: false,
    weekGroup: 'first',
    part: null,
    splitParts: false,
  };

  const getSlotDetails = (timeStr) => {
    const [rawStart, rawEnd] = timeStr.split('-');
    const start = normalizeTime(rawStart || '');
    const end = normalizeTime(rawEnd || '');

    let startIdx = slotBoundaries.indexOf(start);
    let endIdx = slotBoundaries.indexOf(end);

    // Some default/demo classes start between official AUST slot boundaries.
    // Place them in the nearest visible table slot instead of dropping them.
    // Guard off-grid (e.g. 06:00) — clamp instead of snapping to 08:00 silently.
    if (startIdx === -1 && start) {
      const found = slotBoundaries.findIndex((slot) => slot > start);
      if (found === -1) { // after last slot → clamp to last-1
        startIdx = slotBoundaries.length - 2;
      } else if (found === 0) { // before first slot (e.g. 06:00)
        startIdx = 0;
      } else {
        startIdx = found - 1;
      }
    }
    if (endIdx === -1 && end) {
      const foundEnd = slotBoundaries.findIndex((slot) => slot >= end);
      if (foundEnd === -1) endIdx = slotBoundaries.length - 1;
      else endIdx = foundEnd;
    }

    if (startIdx < 0) startIdx = 0;
    if (startIdx >= slotBoundaries.length - 1) startIdx = slotBoundaries.length - 2;
    if (endIdx <= startIdx) endIdx = startIdx + 1;
    if (endIdx >= slotBoundaries.length) endIdx = slotBoundaries.length - 1;

    const colSpan = Math.min(timeSlots.length - startIdx, Math.max(1, endIdx - startIdx));

    return { startIdx, colSpan };
  };

  // ── On first load, scroll the (horizontally scrolling) grid to the earliest
  // class start so phone users don't have to swipe past empty morning slots.
  // Runs once per mount; with no classes the grid stays where it is.
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (didAutoScrollRef.current || isLoading) return;
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    let earliest = Infinity;
    weekDays.forEach((day) => {
      (routine[day] || []).forEach((cls) => {
        if (cls?.time) earliest = Math.min(earliest, getSlotDetails(cls.time).startIdx);
      });
    });
    if (!Number.isFinite(earliest)) return;
    didAutoScrollRef.current = true;
    if (earliest <= 0 || wrap.scrollWidth <= wrap.clientWidth) return;
    const heads = wrap.querySelectorAll('thead th');
    const target = heads[earliest + 1]; // +1 skips the "Time/Day" column
    if (!target) return;
    const stickyW = heads[0]?.offsetWidth || 0;
    wrap.scrollLeft = Math.max(0, target.offsetLeft - stickyW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, routine, weekDays]);

  const openAddModal = (day = weekDays[0] || 'Sunday', slotIdx = 0) => {
    const start = slotBoundaries[slotIdx] || '08:00';
    const end = slotBoundaries[slotIdx + 1] || '08:50';

    setEditing({
      mode: 'add',
      day,
      form: {
        ...emptyForm,
        time: `${start} - ${end}`,
      },
    });
  };

  const openEditModal = (day, cls) => {
    setEditing({
      mode: 'edit',
      originalDay: day,
      day,
      form: {
        ...cls,
        splitParts: cls.part ? true : false,
      },
    });
  };

  const updateForm = (field, value) => {
    setEditing((current) => ({
      ...current,
      form: {
        ...current.form,
        [field]: value,
      },
    }));
  };

  const saveEdit = (event) => {
    event.preventDefault();

    const cleanClass = {
      ...editing.form,
      splitParts: undefined,
      course: editing.form.course.trim() || 'Untitled',
      name: editing.form.name.trim() || 'Class',
      room: editing.form.room.trim() || 'TBA',
      teacher: editing.form.teacher.trim() || 'TBA',
      time: editing.form.time.trim() || '08:00 - 08:50',
    };

    if (editing.mode === 'add') {
      addRoutineClass(editing.day, cleanClass);
    } else {
      updateRoutineClass(editing.originalDay, { ...cleanClass, day: editing.day });
    }

    setEditing(null);
  };

  const removeClass = () => {
    deleteRoutineClass(editing.originalDay, editing.form.id);
    setEditing(null);
  };

  const sharedApi = async (path, options = {}) => {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.success === false) throw new Error(data.error || 'The server could not complete the routine request.');
    return data;
  };

  const refreshSharedRoutines = async () => {
      const [sharedRes, statsRes] = await Promise.all([
        sharedApi('/api/routines/shared'),
        sharedApi('/api/routines/shared/stats'),
      ]);
      if (!sharedRes.success || !statsRes.success) throw new Error('Server could not load shared routines.');
      const publishedRoutines = (sharedRes.routines || []).filter((routine) => !isGeneratedRoutineFixture(routine));
      setSharedRoutines(publishedRoutines);
      setSharedRoutinesReady(true);
      setSharedStats({ ...(statsRes.stats || { total: CR_TOTAL_SLOTS }), shared: publishedRoutines.length });
      setLoadError('');
      return publishedRoutines;
  };

  const openLoadModal = async () => {
    if (isFaculty) return;
    setSelectedTemplate(null);
    setLoadSearch('');
    setLoadDept('all');
    setLoadSem('all');
    setShowLoadModal(true);
    setLoadError('');
    setSharedLoading(true);
    try { await refreshSharedRoutines(); }
    catch (e) { setLoadError(e.message || 'Could not load routines from the server.'); }
    setSharedLoading(false);
  };

  const mySlotKey = user && (user.department || user.yearSemester || user.section || user.labSection)
    ? `${user.department || ''}|${user.yearSemester || ''}|${user.section || ''}|${user.labSection || ''}`
    : null;
  const myShared = mySlotKey ? sharedRoutines.find(r => `${r.department || ''}|${r.yearSemester || ''}|${r.section || ''}|${r.labSection || ''}` === mySlotKey) : null;
  const liveShareRef = useRef({ id: '', snapshot: '' });
  const unshareRequestedRef = useRef(false);
  const routineSnapshot = JSON.stringify({ routine, weekDays });

  const handleShareRoutine = async () => {
    if (shareBusy) return;
    unshareRequestedRef.current = false;
    setShareBusy(true);
    setShareMsg(null);
    try {
      const data = await sharedApi('/api/routines/shared', {
        method: 'POST',
        body: JSON.stringify({ routine, weekDays }),
      });
      liveShareRef.current = { id: data.routine?.id || '', snapshot: routineSnapshot };
      // Tell any open Free Rooms page to recompute availability right away.
      window.dispatchEvent(new Event('routine-updated'));
      await refreshSharedRoutines();
    } catch (e) {
      setShareMsg(e.message || 'Sharing failed — try again');
    } finally {
      setShareBusy(false);
    }
  };

  const handleUnshareRoutine = async () => {
    if (shareBusy) return;
    unshareRequestedRef.current = true;
    setShareBusy(true);
    setShareMsg(null);
    try {
      await sharedApi('/api/routines/shared', { method: 'DELETE' });
      window.dispatchEvent(new Event('routine-updated'));
      await refreshSharedRoutines();
    } catch (e) {
      unshareRequestedRef.current = false;
      setShareMsg(e.message || 'Failed to remove — try again');
    } finally {
      setShareBusy(false);
    }
  };

  const handleLoadTemplate = async () => {
    if (selectedTemplate) {
      try {
        // Re-fetch the selected record so a stale modal cannot load an old copy.
        const latestData = await sharedApi('/api/routines/shared');
        if (!latestData.success) throw new Error('Could not verify the selected routine on the server.');
        const latest = (latestData.routines || []).find((item) => item.id === selectedTemplate.id);
        if (!latest) throw new Error('This routine is no longer shared. Refresh the list and try again.');
        await replaceRoutine(latest.routine, latest.weekDays);
        if (latest.crId && user?.id) {
          const saved = await userStore.set(`aust-loaded-shared-routine:${user.id}`, latest.crId);
          if (!saved) throw new Error('Routine loaded, but its live sync could not be saved to your account.');
        }
        setLoadedSharedRoutine(latest);
        setShowLoadModal(false);
        setSelectedTemplate(null);
      } catch (e) {
        setLoadError(e.message || 'Could not load this routine from the server.');
      }
    }
  };

  const syncLoadedSharedRoutine = async ({ action, crId } = {}) => {
    if (!user?.id || !crId) return;
    const sourceKey = `aust-loaded-shared-routine:${user.id}`;
    if (await userStore.get(sourceKey) !== crId) return;
    if (action === 'delete') {
      await userStore.del(sourceKey);
      setLoadedSharedRoutine((current) => current?.crId === crId ? null : current);
      return;
    }
    try {
      const data = await sharedApi('/api/routines/shared');
      const latest = (data.routines || []).find(item => item.crId === crId);
      if (!latest) {
        await userStore.del(sourceKey);
        setLoadedSharedRoutine((current) => current?.crId === crId ? null : current);
        return;
      }
      await replaceRoutine(latest.routine, latest.weekDays);
      setLoadedSharedRoutine(latest);
      window.dispatchEvent(new Event('routine-updated'));
    } catch (error) {
      console.warn('Could not sync loaded shared routine:', error.message);
    }
  };

  useWebSocket(user?.id || null, { onRoutineShared: syncLoadedSharedRoutine });

  // Catch up after the user was offline while the CR published changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const crId = await userStore.get(`aust-loaded-shared-routine:${user.id}`);
      if (!cancelled && crId) syncLoadedSharedRoutine({ action: 'publish', crId });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Once a CR has published, persist every later grid edit automatically.
  // A short debounce combines rapid edits into one live update.
  useEffect(() => {
    if (!isCR || !myShared || !sharedRoutinesReady || isLoading || unshareRequestedRef.current) return undefined;
    const currentId = myShared.id || '';
    if (liveShareRef.current.id !== currentId) {
      const publishedSnapshot = JSON.stringify({ routine: myShared.routine, weekDays: myShared.weekDays });
      liveShareRef.current = { id: currentId, snapshot: publishedSnapshot };
    }
    if (liveShareRef.current.snapshot === routineSnapshot) return undefined;
    const snapshot = routineSnapshot;
    const timer = setTimeout(async () => {
      try {
        const data = await sharedApi('/api/routines/shared', {
          method: 'POST',
          body: JSON.stringify({ routine, weekDays }),
        });
        liveShareRef.current = { id: data.routine?.id || currentId, snapshot };
        window.dispatchEvent(new Event('routine-updated'));
      } catch (error) {
        setShareMsg(error.message || 'Could not update the shared routine.');
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineSnapshot, myShared?.id, isCR, sharedRoutinesReady, isLoading]);

  const handleLoadDeptChange = (value) => {
    setLoadDept(value);
  };

  // Filter shared routines for the load overlay
  const filteredShared = sharedRoutines.filter(r => {
    if (loadDept !== 'all' && r.department !== loadDept) return false;
    if (loadSem !== 'all' && r.yearSemester !== loadSem) return false;
    const q = loadSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = [r.department, r.yearSemester, r.section, r.labSection, r.crName].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const sharedSems = [...new Set(sharedRoutines.map(r => r.yearSemester).filter(Boolean))].sort();

  const deptOptions = [...new Set(sharedRoutines.map(r => r.department).filter(Boolean))].sort();

  // ── Export: drawn from routine data (see routineExport.js) ──
  const [exporting, setExporting] = useState(null); // 'pdf' | 'jpg' | null
  const runExport = async (kind) => {
    if (exporting) return;
    setExporting(kind);
    try {
      const { exportRoutinePDF, exportRoutineJPG } = await import('./routineExport');
      const opts = {
        routine,
        weekDays,
        getSlotDetails,
        slotLabels: ramadanMode ? ramadanDisplays : timeSlots.map((s) => s.display),
        meta: { dept: user?.department || '', sem: user?.yearSemester || user?.semester || '' },
        logoUrl: brandMark,
      };
      await (kind === 'pdf' ? exportRoutinePDF(opts) : exportRoutineJPG(opts));
    } catch (error) {
      console.error('Routine export failed', error);
      setShareMsg('Export failed — please try again.');
      setTimeout(() => setShareMsg(null), 3000);
    } finally {
      setExporting(null);
    }
  };

   return (
     <div className="glass-card-static schedule-widget weekly-planner animate-fadeInUp">
       {/* ── Masthead (Semester View / Quick Stats design language) ── */}
       <div className="schedule-masthead weekly-masthead">
          <div className="schedule-title-block">
            <div className="schedule-icon-tile">
              <CalendarDays size={20} />
            </div>
            <div>
              <span className="schedule-overline">Dashboard</span>
              <p className="schedule-title">Routine Grid</p>
              <span className="schedule-subtitle">{isFaculty ? 'Add your classes by clicking an empty time slot' : 'Tap a class to edit'}</span>
            </div>
          </div>

          <div className="schedule-actions">
            {!isFaculty && <button
              className="btn btn-sm load-routine-btn"
              onClick={openLoadModal}
              title="Load a routine shared by a CR"
            >
              <Download size={14} />
              <span>Load Routine</span>
            </button>}
            {isCR && (
             <button
               className={`btn btn-sm cr-publish-btn${myShared ? ' is-shared' : ''}`}
               disabled={shareBusy}
               onClick={() => { if (myShared) handleUnshareRoutine(); else handleShareRoutine(); }}
               title={myShared
                 ? 'Your routine is live. Edits sync automatically for students who loaded it. Click to unshare.'
                 : 'Publish your routine — it automatically appears in Load Routine and Free Rooms for everyone.'}
             >
               {shareBusy ? <Loader2 size={14} className="spin" /> : myShared ? <Check size={14} /> : <Share2 size={14} />}
               <span>{myShared ? 'Shared ✓' : 'Share Routine'}</span>
             </button>
           )}
           {shareMsg && (
             <div className="weekly-share-msg" style={{
               position: 'absolute', right: '4px', top: 'calc(100% + 6px)',
               fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)',
               background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
               border: '1px solid var(--border-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 5,
             }}>
               {shareMsg}
             </div>
           )}
         </div>
           <div className="export-dropdown weekly-more-dropdown" ref={exportRef}>
              <button className="schedule-nav-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Routine options" aria-haspopup="true">
               <MoreVertical size={18} />
             </button>
             {showMenu && (
               <div className="export-menu routine-more-menu">
                 <button className="export-menu-item" disabled={!!exporting} onClick={() => { runExport('pdf'); setShowMenu(false); }}>
                   {exporting === 'pdf' ? <Loader2 size={14} className="spin" /> : <FileDown size={14} />} Export as PDF
                 </button>
                 <button className="export-menu-item" disabled={!!exporting} onClick={() => { runExport('jpg'); setShowMenu(false); }}>
                   {exporting === 'jpg' ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />} Export as JPG
                 </button>

                 <div className="export-menu-sep" />

                 <button className="export-menu-item" onClick={() => { setConfirmReset(true); setShowMenu(false); }}>
                   <RotateCcw size={14} /> Reset schedule
                 </button>

                 <button className="export-menu-item menu-ramadan" onClick={() => setRamadanMode(!ramadanMode)} title={ramadanMode ? 'Switch to normal schedule' : 'Switch to Ramadan schedule'}>
                   <span className="menu-ramadan-label"><Moon size={14} /> Ramadan mode</span>
                   <div className={`ramadan-toggle-track${ramadanMode ? ' active' : ''}`}>
                     {ramadanMode ? <span className="ramadan-toggle-icon">🕌</span> : <div className="ramadan-toggle-thumb" />}
                   </div>
                 </button>


               </div>
             )}
           </div>
       </div>

       <div className="schedule-dotted-divider" />

        {loadedSharedRoutine && (
          <div role="status" className="loaded-routine-banner" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 12px', margin: '0 0 10px', borderRadius: '10px',
            color: 'var(--text-secondary)', background: 'var(--accent-blue-glow)',
            border: '1px solid var(--border-primary)', fontSize: 'var(--fs-xs)',
          }}>
            <Share2 size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span
              className="loaded-routine-text"
              title={`Loaded routine shared by ${loadedSharedRoutine.crName || 'CR'} · ${loadedSharedRoutine.department} ${loadedSharedRoutine.yearSemester} · Section ${loadedSharedRoutine.section} · Lab ${loadedSharedRoutine.labSection}`}
            >
              Loaded routine shared by <strong style={{ color: 'var(--text-primary)' }}>{loadedSharedRoutine.crName || 'CR'}</strong>
              {' · '}{loadedSharedRoutine.department} {loadedSharedRoutine.yearSemester}
              {' · Section '}{loadedSharedRoutine.section} · Lab {loadedSharedRoutine.labSection}
            </span>
          </div>
        )}

        {gridScale !== 1 && (
          <div className="zoom-indicator" onClick={() => setGridScale(1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{Math.round(gridScale * 100)}% — tap to reset</span>
          </div>
        )}

        {isLoading ? (
          <div className="routine-skeleton" style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'12px 0' }}>
            {[0,1,2].map(i => (
              <div key={i} className="schedule-day-card skeleton-row" style={{ display:'flex', gap:'12px', alignItems:'center', padding:'14px', animationDelay:`${i*80}ms` }}>
                <div className="skeleton-line" style={{ width:'60px', height:'14px' }} />
                <div style={{ flex:1, display:'flex', gap:'8px' }}>
                  {[0,1,2,3].map(j => <div key={j} className="skeleton-line" style={{ flex:1, height:'36px' }} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="weekly-table-wrap" ref={tableWrapRef} style={zoomVars}>
        <table className="weekly-table">
          <thead>
            <tr>
              <th className="weekly-day-head">Time/Day</th>
              {timeSlots.map((slot, i) => (
                <th key={slot.label} className="weekly-time-head">
                  {ramadanMode ? ramadanDisplays[i] : slot.display}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekDays.map((day) => {
              const dayClasses = routine[day] || [];
              
              const scheduledCells = dayClasses
                .map((cls) => ({ ...cls, ...getSlotDetails(cls.time) }))
                .filter((cls) => cls.startIdx < timeSlots.length)
                .sort((a, b) => a.startIdx - b.startIdx);

              return (
                <tr key={day} className={activeDay === day ? 'day-row-active' : undefined}>
                  <td
                    className="weekly-day-cell"
                    title={activeDay === day ? 'Click again to deselect day' : `Highlight ${day}`}
                    onClick={() => setActiveDay(activeDay === day ? null : day)}
                  >
                    {day.substring(0, 3)}
                  </td>

                  {/* Render columns, skipping spanned ones */}
                  {timeSlots.map((_, idx) => {
                    const isCoveredByPrevious = scheduledCells.some((item) => idx > item.startIdx && idx < item.startIdx + item.colSpan);
                    if (isCoveredByPrevious) return null;

                    const classesAtIdx = scheduledCells.filter((c) => c.startIdx === idx);
                    if (classesAtIdx.length > 0) {
                      const colSpan = classesAtIdx[0].colSpan;
                      const isBiWeekly = classesAtIdx.some((c) => c.biWeekly);

                      if (isBiWeekly) {
                        const firstCls = classesAtIdx.find((c) => c.weekGroup === 'first');
                        const secondCls = classesAtIdx.find((c) => c.weekGroup === 'second');
                        const baseColor = getCourseColor((firstCls || secondCls)?.course || '');

                        return (
                          <td
                            key={`${day}-bw-${idx}`}
                            colSpan={colSpan}
                            className="weekly-class-cell"
                          >
                            <div
                              className="weekly-class-block"
                              style={{
                                background: 'var(--bg-input)',
                                borderLeft: `3px solid ${baseColor}`,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: 0,
                                gap: 0,
                              }}
                            >
                              {firstCls ? (
                                <div
                                  onClick={() => openEditModal(day, firstCls)}
                                  style={{
                                    padding: '6px 6px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '1px' }}>
                                    <span style={{ color: baseColor, fontWeight: 'var(--fw-bold)', fontSize: '10px' }}>{firstCls.course}</span>
                                    {firstCls.part && (
                                      <span style={{
                                        fontSize: '7px', fontWeight: 'bold',
                                        color: firstCls.part === 'A' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                        background: firstCls.part === 'A' ? 'color-mix(in srgb, var(--accent-emerald) 25%, transparent)' : 'color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                                        padding: '1px 4px', borderRadius: '3px',
                                      }}>
                                        P{firstCls.part}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '7px', fontWeight: 'var(--fw-bold)', color: 'var(--accent-amber)', whiteSpace: 'nowrap' }}>Week 1</span>
                                  </div>
                                  <div style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', fontSize: '9px', lineHeight: '1.35', textAlign: 'center' }}>
                                    {firstCls.name.split('(')[0].trim()}
                                  </div>
                                  <div className="weekly-room" style={{ color: 'var(--text-tertiary)', fontSize: '8px', lineHeight: '1.35' }}>
                                    {firstCls.room}
                                  </div>
                                  <div className="weekly-teacher" style={{ color: 'var(--text-tertiary)', fontSize: '8px', lineHeight: '1.35', opacity: 0.8 }}>
                                    {firstCls.teacher}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    const start = slotBoundaries[idx] || '08:00';
                                    const end = slotBoundaries[idx + colSpan] || calculateEndTime(start, colSpan);
                                    setEditing({
                                      mode: 'add',
                                      day,
                                      form: {
                                        ...emptyForm,
                                        type: 'Lab',
                                        time: `${start} - ${end}`,
                                        biWeekly: true,
                                        weekGroup: 'first',
                                        color: secondCls?.color || getAutoColorForCourse('', 'Lab'),
                                      },
                                    });
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    color: 'var(--text-tertiary)',
                                    fontSize: '10px',
                                  }}
                                >
                                  <span style={{ fontSize: '7px', fontWeight: 'var(--fw-bold)', color: 'var(--accent-amber)', whiteSpace: 'nowrap', flexShrink: 0, width: '32px' }}>Week 1</span>
                                  <div style={{ flex: 1, textAlign: 'center' }}>+</div>
                                  <span style={{ width: '32px', flexShrink: 0 }} />
                                </div>
                              )}

                              {secondCls ? (
                                <div className="weekly-biweekly-divider" style={{ borderTop: '1px solid var(--border-secondary)' }}>
                                  <div
                                    onClick={() => openEditModal(day, secondCls)}
                                    style={{
                                      padding: '6px 6px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '1px' }}>
                                    <span style={{ color: getCourseColor(secondCls.course), fontWeight: 'var(--fw-bold)', fontSize: '10px' }}>{secondCls.course}</span>
                                    {secondCls.part && (
                                      <span style={{
                                        fontSize: '7px', fontWeight: 'bold',
                                        color: secondCls.part === 'A' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                        background: secondCls.part === 'A' ? 'color-mix(in srgb, var(--accent-emerald) 25%, transparent)' : 'color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                                        padding: '1px 4px', borderRadius: '3px',
                                      }}>
                                        P{secondCls.part}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '7px', fontWeight: 'var(--fw-bold)', color: 'var(--accent-amber)', whiteSpace: 'nowrap' }}>Week 2</span>
                                  </div>
                                   <div style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', fontSize: '9px', lineHeight: '1.35', textAlign: 'center' }}>
                                     {secondCls.name.split('(')[0].trim()}
                                   </div>
                                   <div className="weekly-room" style={{ color: 'var(--text-tertiary)', fontSize: '8px', lineHeight: '1.35' }}>
                                     {secondCls.room}
                                   </div>
                                   <div className="weekly-teacher" style={{ color: 'var(--text-tertiary)', fontSize: '8px', lineHeight: '1.35', opacity: 0.8 }}>
                                     {secondCls.teacher}
                                   </div>
                                </div>
                              </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    const start = slotBoundaries[idx] || '08:00';
                                    const end = slotBoundaries[idx + colSpan] || calculateEndTime(start, colSpan);
                                    setEditing({
                                      mode: 'add',
                                      day,
                                      form: {
                                        ...emptyForm,
                                        type: 'Lab',
                                        time: `${start} - ${end}`,
                                        biWeekly: true,
                                        weekGroup: 'second',
                                        color: firstCls?.color || getAutoColorForCourse('', 'Lab'),
                                      },
                                    });
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    color: 'var(--text-tertiary)',
                                    fontSize: '10px',
                                  }}
                                >
                                  <span style={{ fontSize: '7px', fontWeight: 'var(--fw-bold)', color: 'var(--accent-amber)', whiteSpace: 'nowrap', flexShrink: 0, width: '32px' }}>Week 2</span>
                                  <div style={{ flex: 1, textAlign: 'center' }}>+</div>
                                  <span style={{ width: '32px', flexShrink: 0 }} />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Normal (non-bi-weekly): single or multiple stacked
                      if (classesAtIdx.length === 1) {
                        const cls = classesAtIdx[0];
                        const accentColor = getCourseColor(cls.course);
                        return (
                          <td 
                            key={`${day}-${cls.id}`}
                            colSpan={colSpan}
                            className="weekly-class-cell"
                            onClick={() => openEditModal(day, cls)}
                          >
                            <div 
                              className="weekly-class-block"
                              style={{
                                background: 'var(--bg-input)',
                                borderLeft: `3px solid ${accentColor}`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                textAlign: 'center'
                              }}
                            >
                              <div className="weekly-course-code" style={{ color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                {cls.course}
                                {cls.part && (
                                  <span style={{
                                    fontSize: '7px', fontWeight: 'bold',
                                    color: cls.part === 'A' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                    background: cls.part === 'A' ? 'color-mix(in srgb, var(--accent-emerald) 25%, transparent)' : 'color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                                    padding: '1px 4px', borderRadius: '3px',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    P{cls.part}
                                  </span>
                                )}
                              </div>
                               <div className="weekly-course-name" style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', lineHeight: '1.35' }}>
                                 {cls.name.split('(')[0].trim()}
                               </div>
                               <div className="weekly-room" style={{ color: 'var(--text-tertiary)', lineHeight: '1.35' }}>
                                 {cls.room}
                               </div>
                               <div className="weekly-teacher" style={{ color: 'var(--text-tertiary)', fontSize: '8px', lineHeight: '1.35', opacity: 0.8 }}>
                                 {cls.teacher}
                               </div>
                            </div>
                          </td>
                        );
                      }

                      return (
                          <td 
                            key={`${day}-${idx}`}
                            colSpan={colSpan}
                            className="weekly-class-cell"
                            style={{ padding: '2px' }}
                          >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {classesAtIdx.map((cls) => {
                              const clr = getCourseColor(cls.course);
                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => openEditModal(day, cls)}
                                  style={{
                                    background: 'var(--bg-input)',
                                    borderLeft: `3px solid ${clr}`,
                                    borderRadius: '4px',
                                    padding: '3px 6px',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                  }}
                                >
                                  <span style={{ fontWeight: 'bold', color: clr, fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    {cls.course}
                                    {cls.part && (
                                      <span style={{
                                        fontSize: '7px', fontWeight: 'bold',
                                        color: cls.part === 'A' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                        background: cls.part === 'A' ? 'color-mix(in srgb, var(--accent-emerald) 25%, transparent)' : 'color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                                        padding: '1px 3px', borderRadius: '3px',
                                      }}>
                                        P{cls.part}
                                      </span>
                                    )}
                                  </span>
                                   <div className="weekly-teacher" style={{ color: 'var(--text-tertiary)', fontSize: '8px', lineHeight: '1.35', opacity: 0.8 }}>
                                     {cls.teacher}
                                   </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td 
                        key={`${day}-empty-${idx}`} 
                        className="weekly-empty-cell"
                        onClick={() => openAddModal(day, idx)}
                      >
                        <div />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        )}

      {/* Load Routine Modal */}
      {!isFaculty && showLoadModal && createPortal(
        <div className="modal-overlay lr-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal lr-modal" role="dialog" aria-modal="true" aria-label="Load routine" onClick={(e) => e.stopPropagation()}>
            <div className="lr-head">
              <span className="lr-title"><Download size={13} /> Load Routine</span>
              <button type="button" className="lr-close" onClick={() => setShowLoadModal(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            <div className="lr-summary">
              <span className="lr-badge">CRs shared: <strong>{sharedStats.shared} / {sharedStats.total}</strong></span>
              <span className="lr-badge is-accent">Showing {filteredShared.length}</span>
            </div>

            <div className="lr-filters">
              <label className="lr-field lr-field-search">
                <Search size={13} />
                <input
                  className="input"
                  value={loadSearch}
                  onChange={e => setLoadSearch(e.target.value)}
                  placeholder="Search dept, section, lab or CR"
                  aria-label="Search shared routines"
                />
              </label>
              <label className="lr-field">
                <Building2 size={13} />
                <select className="input" value={loadDept} onChange={e => handleLoadDeptChange(e.target.value)} aria-label="Department">
                  <option value="all">All depts</option>
                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="lr-field">
                <GraduationCap size={13} />
                <select className="input" value={loadSem} onChange={e => setLoadSem(e.target.value)} aria-label="Semester">
                  <option value="all">All semesters</option>
                  {sharedSems.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            <div className="lr-list-head">Shared by CRs</div>

            <div className="lr-body">
              {loadError && <div role="alert" className="lr-error">{loadError}</div>}
              {sharedLoading ? (
                <div className="lr-empty">
                  <span className="lr-empty-icon"><Loader2 size={15} className="spin" /></span>
                  <p className="lr-empty-hint">Loading shared routines…</p>
                </div>
              ) : filteredShared.length === 0 ? (
                <div className="lr-empty">
                  <span className="lr-empty-icon"><Share2 size={15} /></span>
                  <p className="lr-empty-hint">
                    {loadError ? 'The shared routine list is unavailable.' : sharedRoutines.length === 0 ? 'No CR has shared a routine yet.' : 'No routines match your search.'}
                  </p>
                </div>
              ) : (
                <div className="lr-list" role="radiogroup" aria-label="Shared routines">
                  {filteredShared.map(routine => {
                    const isSelected = selectedTemplate?.id === routine.id;
                    const isMine = mySlotKey === `${routine.department || ''}|${routine.yearSemester || ''}|${routine.section || ''}|${routine.labSection || ''}`;
                    const meta = [
                      routine.department,
                      routine.yearSemester,
                      routine.section && `Sec ${routine.section}`,
                      routine.labSection && `Lab ${routine.labSection}`,
                    ].filter(Boolean).join(' · ');
                    return (
                      <button
                        type="button"
                        key={routine.id}
                        role="radio"
                        aria-checked={isSelected}
                        className={`lr-row${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setSelectedTemplate(routine)}
                      >
                        <span className="lr-radio" aria-hidden="true">{isSelected && <Check size={10} strokeWidth={3} />}</span>
                        <span className="lr-row-body">
                          <span className="lr-row-name">
                            <span className="lr-row-name-text">{routine.crName || 'CR'}</span>
                            {isMine && <span className="lr-mine">Yours</span>}
                          </span>
                          <span className="lr-row-meta">{meta}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lr-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLoadTemplate}
                disabled={!selectedTemplate || !!loadError}
              >
                <Download size={13} /> Load routine
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowLoadModal(false)}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {editing && createPortal(
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <form className="modal routine-edit-modal" onSubmit={saveEdit} onClick={(event) => event.stopPropagation()}>
            <div className="routine-edit-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>{editing.mode === 'add' ? 'Add Class' : 'Edit Class'}</h3>
                {editing.form.part && (
                  <span style={{
                    fontSize: '9px', fontWeight: 'bold',
                    color: editing.form.part === 'A' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                    background: editing.form.part === 'A' ? 'color-mix(in srgb, var(--accent-emerald) 25%, transparent)' : 'color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                    padding: '2px 8px', borderRadius: '4px',
                  }}>
                    Part {editing.form.part}
                  </span>
                )}
              </div>
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => setEditing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="routine-edit-body">
              <div className="routine-edit-grid">
              <div className="routine-edit-type-row">
                <div className="type-toggle" role="radiogroup">
                  {['Theory', 'Lab'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`type-toggle-btn${editing.form.type === t ? ' active' : ''}`}
                      onClick={() => {
                        const periods = t === 'Lab' ? 3 : 1;
                        const timeParts = editing.form.time.split(' - ');
                        const start = timeParts[0] || '08:00';
                        const newEnd = calculateEndTime(start, periods);
                        updateForm('time', `${start} - ${newEnd}`);
                        updateForm('type', t);
                        updateForm('color', getAutoColorForCourse(editing.form.course, t));
                        if (t !== 'Theory') {
                          updateForm('part', null);
                        }
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <label>
                Course Code
                <CourseAutocomplete
                  value={editing.form.course}
                  placeholder="Type course code (e.g., CSE1101)..."
                  type="code"
                  department={user?.department}
                  onCourseSelect={(course) => {
                    if (course) {
                      if (course.partialUpdate) {
                        updateForm('course', course.code);
                      } else {
                        updateForm('course', course.code);
                        updateForm('name', course.name);
                        updateForm('color', getAutoColorForCourse(course.code, editing.form.type));
                      }
                    }
                  }}
                />
              </label>
              <label>
                Course Name
                <CourseAutocomplete
                  value={editing.form.name}
                  placeholder="Type course name (e.g., Data Structures)..."
                  type="name"
                  department={user?.department}
                  onCourseSelect={(course) => {
                    if (course) {
                      if (course.partialUpdate) {
                        updateForm('name', course.name);
                      } else {
                        updateForm('name', course.name);
                        updateForm('course', course.code);
                      }
                    }
                  }}
                />
              </label>
              <label>
                Room
                <RoomAutocomplete
                  value={editing.form.room}
                  placeholder="e.g. 7A03 — choose a room or type your own..."
                  onRoomSelect={(room) => updateForm('room', room)}
                />
              </label>
              <label>
                Teacher
                <TeacherAutocomplete
                  value={editing.form.teacher}
                  placeholder="Type teacher name (e.g. Dr. Rahman)..."
                  onTeacherSelect={(teacher) => updateForm('teacher', teacher)}
                />
              </label>

              {/* 🧩 Split into parts — at the bottom, same position as Lab's bi-weekly */}
              {editing.form.type === 'Theory' && (
                <>
                  <div className="routine-edit-type-row">
                    <label className="biweekly-label">
                      <input
                        type="checkbox"
                        checked={editing.form.splitParts}
                        onChange={(e) => {
                          updateForm('splitParts', e.target.checked);
                          if (!e.target.checked) updateForm('part', null);
                        }}
                      />
                      <span>Split into Parts</span>
                    </label>
                  </div>
                  {editing.form.splitParts && (
                    <div className="routine-edit-type-row">
                      <div className="week-split-box">
                        <div
                          className={`week-split-option${editing.form.part === 'A' ? ' active' : ''}`}
                          onClick={() => updateForm('part', 'A')}
                        >
                          Part A
                        </div>
                        <div className="week-split-divider" />
                        <div
                          className={`week-split-option${editing.form.part === 'B' ? ' active' : ''}`}
                          onClick={() => updateForm('part', 'B')}
                        >
                          Part B
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {editing.form.type === 'Lab' && (
                <>
                  <div className="routine-edit-type-row">
                    <label className="biweekly-label">
                      <input
                        type="checkbox"
                        checked={editing.form.biWeekly}
                        onChange={(e) => updateForm('biWeekly', e.target.checked)}
                      />
                      <span>0.75 credit (bi-weekly)</span>
                    </label>
                  </div>
                  {editing.form.biWeekly && (
                    <div className="routine-edit-type-row">
                      <div className="week-split-box">
                        <div
                          className={`week-split-option${editing.form.weekGroup === 'first' ? ' active' : ''}`}
                          onClick={() => updateForm('weekGroup', 'first')}
                        >
                          1st Week
                        </div>
                        <div className="week-split-divider" />
                        <div
                          className={`week-split-option${editing.form.weekGroup === 'second' ? ' active' : ''}`}
                          onClick={() => updateForm('weekGroup', 'second')}
                        >
                          2nd Week
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>

            <div className="routine-edit-actions">
              {editing.mode === 'edit' && (
                <button type="button" className="btn btn-danger btn-sm" onClick={removeClass}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <div className="routine-edit-spacer" />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {confirmReset && createPortal(
        <div className="modal-overlay" onClick={() => setConfirmReset(false)}>
          <form className="modal routine-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-body">
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>Reset Routine?</h3>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setConfirmReset(false)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                This will remove all classes from your schedule. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                const emptyRoutine = { Sunday: [], Monday: [], Tuesday: [], Wednesday: [], Thursday: [] };
                replaceRoutine(emptyRoutine, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
                setConfirmReset(false);
              }}>Reset</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
