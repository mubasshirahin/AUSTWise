import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X, Download, Check, RotateCcw, FileDown, Share2, Search, Loader2, MoreVertical, Moon, Image as ImageIcon, CalendarDays, Building2, GraduationCap } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { getCourseColor } from '../../utils/colorPalette';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import RoomAutocomplete from '../../components/RoomAutocomplete';
import TeacherAutocomplete from '../../components/TeacherAutocomplete';
import { getAutoColorForCourse } from '../../utils/autoColorPalette';
import { loadTemplates, mergeTemplatesToRoutine } from '../../utils/routineTemplates';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import logoUrl from '../../assets/logo-silver.png';
import { useAuth } from '../../context/AuthContext';

export default function WeeklyPlanner() {
  const { user } = useAuth();
  const { routine, weekDays, updateRoutineClass, addRoutineClass, deleteRoutineClass, replaceRoutine } = useRoutine();
  const [editing, setEditing] = useState(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [ramadanMode, setRamadanMode] = useState(() => {
    const stored = localStorage.getItem('aust-ramadan-mode');
    return stored === 'true';
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const exportRef = useRef(null);

  // ── Pinch-to-zoom for routine grid on mobile ──
  const tableWrapRef = useRef(null);
  const [gridScale, setGridScale] = useState(1);
  const pinchRef = useRef({ initialDist: 0, initialScale: 1 });

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
  }, [gridScale, getDistance]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches);
      const ratio = dist / pinchRef.current.initialDist;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 0.5), 3);
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

  // ── Shared routine (CR publishing) ──
  // One CR slot per (dept × semester × section × lab group). A-D sections × 2
  // lab groups × 8 sems × 8 depts = 512. The badge shows this only as a
  // fallback; the server /api/routines/shared/stats returns the live total.
  const CR_TOTAL_SLOTS = 512;
  const CR_DEPTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
  const isCR = !!(user && (user.role === 'cr' || (typeof user.hasRole === 'function' && user.hasRole('cr'))));
  const [sharedRoutines, setSharedRoutines] = useState([]);
  const [sharedStats, setSharedStats] = useState({ shared: 0, total: CR_TOTAL_SLOTS });
  const [sharedLoading, setSharedLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState(null);
  // ── Load Routine overlay filters ──
  const [loadSearch, setLoadSearch] = useState('');
  const [loadDept, setLoadDept] = useState('all');
  const [loadSem, setLoadSem] = useState('all');

  useEffect(() => {
    localStorage.setItem('aust-ramadan-mode', ramadanMode);
  }, [ramadanMode]);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowMenu(false);
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
          if (!cancelled && listData.routines) setSharedRoutines(listData.routines);
        } catch { /* keep empty list */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [availableTemplates, setAvailableTemplates] = useState([]);

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
    if (startIdx === -1 && start) {
      startIdx = slotBoundaries.findIndex((slot) => slot > start) - 1;
    }
    if (endIdx === -1 && end) {
      endIdx = slotBoundaries.findIndex((slot) => slot >= end);
    }

    if (startIdx < 0) startIdx = 0;
    if (endIdx <= startIdx) endIdx = startIdx + 1;

    const colSpan = Math.min(timeSlots.length - startIdx, Math.max(1, endIdx - startIdx));

    return { startIdx, colSpan };
  };

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
    return data;
  };

  const refreshSharedRoutines = async () => {
    try {
      const [sharedRes, statsRes] = await Promise.all([
        sharedApi('/api/routines/shared'),
        sharedApi('/api/routines/shared/stats'),
      ]);
      setSharedRoutines(sharedRes.routines || []);
      setSharedStats(statsRes.stats || { shared: 0, total: CR_TOTAL_SLOTS });
    } catch (e) {
      console.warn('Failed to load shared routines:', e.message);
      setSharedRoutines([]);
      setSharedStats({ shared: 0, total: CR_TOTAL_SLOTS });
    }
  };

  const openLoadModal = async () => {
    setSelectedTemplate(null);
    setLoadSearch('');
    setLoadDept('all');
    setLoadSem('all');
    setAvailableTemplates(loadTemplates());
    setShowLoadModal(true);
    setSharedLoading(true);
    await refreshSharedRoutines();
    setSharedLoading(false);
  };

  const mySlotKey = user && (user.department || user.yearSemester || user.section || user.labSection)
    ? `${user.department || ''}|${user.yearSemester || ''}|${user.section || ''}|${user.labSection || ''}`
    : null;
  const myShared = mySlotKey ? sharedRoutines.find(r => `${r.department || ''}|${r.yearSemester || ''}|${r.section || ''}|${r.labSection || ''}` === mySlotKey) : null;

  const handleShareRoutine = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    setShareMsg(null);
    try {
      await sharedApi('/api/routines/shared', {
        method: 'POST',
        body: JSON.stringify({ routine, weekDays }),
      });
      setShareMsg('Routine shared ✓');
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
    setShareBusy(true);
    setShareMsg(null);
    try {
      await sharedApi('/api/routines/shared', { method: 'DELETE' });
      setShareMsg('Routine removed from load list');
      window.dispatchEvent(new Event('routine-updated'));
      await refreshSharedRoutines();
    } catch (e) {
      setShareMsg(e.message || 'Failed to remove — try again');
    } finally {
      setShareBusy(false);
    }
  };

  const handleLoadTemplate = () => {
    if (selectedTemplate) {
      replaceRoutine(selectedTemplate.routine, selectedTemplate.weekDays);
      setShowLoadModal(false);
      setSelectedTemplate(null);
    }
  };

  // Load every semester template for a department in one go — merged into the
  // weekly schedule. No more semester-by-semester loading. The modal stays open
  // so the user SEES the single combined card with its Loaded ✓ badge.
  const loadTemplatesAtOnce = (templates) => {
    const merged = mergeTemplatesToRoutine(templates);
    if (!merged) return;
    replaceRoutine(merged.routine, merged.weekDays);
    setSelectedTemplate(null);
  };

  // Selecting a department auto-loads all of its semester templates at once.
  const handleLoadDeptChange = (value) => {
    setLoadDept(value);
    if (value !== 'all') {
      const deptTemplates = availableTemplates.filter(t => t.department === value);
      // Only auto-load when the department actually has template classes —
      // avoids wiping the user's routine with blank days.
      const hasClasses = deptTemplates.some(t =>
        Object.values(t.routine || {}).some(day => Array.isArray(day) && day.length > 0)
      );
      if (hasClasses) {
        loadTemplatesAtOnce(deptTemplates);
      }
    }
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

  // Admin templates grouped by department — one combined card per dept,
  // so a department never shows as separate per-semester entries.
  const deptGroups = [...new Set(availableTemplates.map(t => t.department).filter(Boolean))].sort();
  const visibleGroups = loadDept === 'all' ? deptGroups : deptGroups.filter(d => d === loadDept);

  // Dropdown options come from the actual templates (plus the CR depts used for
  // shared routines) — never a hardcoded list, so admin-created departments
  // always match what the user can pick.
  const deptOptions = [...new Set([...CR_DEPTS, ...deptGroups])].sort();

  const downloadSchedulePDF = async () => {
    const tableWrap = document.querySelector('.weekly-table-wrap');
    if (!tableWrap) return;

    const root = document.documentElement;
    const cs = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    const bg = cs('--bg-primary');
    const textPri = cs('--text-primary');
    const textSec = cs('--text-secondary');
    const textTer = cs('--text-tertiary');

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0; width: fit-content; max-width: 1200px;
      background: ${bg};
      font-family: system-ui, -apple-system, sans-serif;
      padding-bottom: 10px;
    `;

    // ─── Brand Header ───
    const ord = (n) => n + ({1:'st',2:'nd',3:'rd'}[n]||'th');
    const fmtSem = (s) => {
      const m = (s||'').match(/Year\s*(\d+)\s*-\s*Semester\s*(\d+)/i);
      return m ? `${ord(+m[1])} Year, ${+m[2]}${['th','st','nd','rd'][+m[2]]||'th'} Sem` : s;
    };
    const semStr = user?.yearSemester || user?.semester || '';
    const deptStr = user?.department || '';

    const brandBar = document.createElement('div');
    brandBar.style.cssText = `
      padding: 4px 8px;
    `;
    brandBar.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 6px;">
          <img src="${logoUrl}" alt="AUSTWise" style="width: 28px; height: 28px; object-fit: contain; flex-shrink: 0;" />
          <div style="display: flex; flex-direction: column; justify-content: center; margin-top: -14px;">
            <div style="font-size: 16px; font-weight: 800; color: ${textPri}; letter-spacing: -0.01em; line-height: 1.1;">
              AUSTWise
            </div>
            <div style="font-size: 8px; color: ${textTer}; letter-spacing: 0.06em; margin-top: 0; text-transform: uppercase;">
              Your Academic Companion
            </div>
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

    // ─── Cloned Table ───
    const clone = tableWrap.cloneNode(true);
    clone.style.cssText = `overflow: visible; border-radius: 8px; padding: 0;`;
    clone.style.margin = '6px 8px 0';
    container.appendChild(clone);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: bg || '#ffffff',
        logging: false,
        width: container.scrollWidth,
        height: container.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const maxW = 290;
      const imgW = maxW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageW = imgW + 8;
      const pageH = imgH + 4;

      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: [pageW, pageH] });

      // Fill PDF page with theme background
      const hex = bg.replace('#', '');
      if (hex.length >= 6) {
        pdf.setFillColor(
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16)
        );
        pdf.rect(0, 0, pageW, pageH, 'F');
      }

      pdf.addImage(imgData, 'PNG', 4, 2, imgW, imgH);

      pdf.save('AUST-Student-Helper-Schedule.pdf');
    } finally {
      document.body.removeChild(container);
    }
  };

  const downloadScheduleImage = async () => {
    const tableWrap = document.querySelector('.weekly-table-wrap');
    if (!tableWrap) return;

    const root = document.documentElement;
    const cs = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    const bg = cs('--bg-primary');

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
    const textPri = cs('--text-primary');
    const textSec = cs('--text-secondary');
    const textTer = cs('--text-tertiary');

    const brandBar = document.createElement('div');
    brandBar.style.cssText = `padding: 4px 8px;`;
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

    const clone = tableWrap.cloneNode(true);
    clone.style.cssText = `overflow: visible; border-radius: 8px; padding: 0;`;
    clone.style.margin = '6px 8px 0';
    container.appendChild(clone);

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2.5, useCORS: true, backgroundColor: bg || '#ffffff',
        logging: false, width: container.scrollWidth, height: container.scrollHeight,
      });

      const link = document.createElement('a');
      link.download = 'AUST-Student-Helper-Schedule.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      document.body.removeChild(container);
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
              <span className="schedule-subtitle">Tap a class to edit</span>
            </div>
          </div>

          <div className="schedule-actions">
            <button
              className="btn btn-sm load-routine-btn"
              onClick={openLoadModal}
              title="Load a routine shared by a CR or an admin template"
            >
              <Download size={14} />
              <span>Load Routine</span>
            </button>
            {isCR && (
             <button
               className={`btn btn-sm cr-publish-btn${myShared ? ' is-shared' : ''}`}
               disabled={shareBusy}
               onClick={() => { if (myShared) handleUnshareRoutine(); else handleShareRoutine(); }}
               title={myShared
                 ? 'Your routine is live — every student can load it and Free Rooms shows your rooms as busy. Click to remove.'
                 : 'Publish your routine — it automatically appears in Load Routine and Free Rooms for everyone.'}
             >
               {shareBusy ? <Loader2 size={14} className="spin" /> : myShared ? <Check size={14} /> : <Share2 size={14} />}
               <span>{myShared ? 'Routine Live ✓' : 'Share Routine'}</span>
             </button>
           )}
           <div className="export-dropdown" ref={exportRef}>
              <button className="schedule-nav-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Routine options" aria-haspopup="true">
               <MoreVertical size={18} />
             </button>
             {showMenu && (
               <div className="export-menu routine-more-menu">
                 <button className="export-menu-item" onClick={() => { downloadSchedulePDF(); setShowMenu(false); }}>
                   <FileDown size={14} /> Export as PDF
                 </button>
                 <button className="export-menu-item" onClick={() => { downloadScheduleImage(); setShowMenu(false); }}>
                   <ImageIcon size={14} /> Export as Image
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
       </div>

       <div className="schedule-dotted-divider" />

        {gridScale !== 1 && (
          <div className="zoom-indicator" onClick={() => setGridScale(1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{Math.round(gridScale * 100)}% — tap to reset</span>
          </div>
        )}

        <div className="weekly-table-wrap" ref={tableWrapRef}>
        <div style={{ transform: `scale(${gridScale})`, transformOrigin: 'top center', transition: 'transform 0.1s ease' }}>
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
                <tr key={day}>
                  <td className="weekly-day-cell">
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
                        const firstCls = classesAtIdx.find((c) => c.weekGroup === 'first') || classesAtIdx[0];
                        const secondCls = classesAtIdx.find((c) => c.weekGroup === 'second');
                        const baseColor = getCourseColor(firstCls.course);

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
                                        color: firstCls.color,
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
      </div>

      {/* Load Routine Modal */}
      {showLoadModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px, 94vw)', height: 'auto', maxHeight: 'calc(100vh - clamp(64px, 14vh, 144px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 'none', margin: 'auto', animation: 'none' }}>
            <div className="flex justify-between items-center" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', margin: 0, color: '#fff' }}>Load Routine</h3>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Routines shared by CRs — select one to load
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-purple" style={{ fontSize: '10px', padding: '4px 10px' }}>
                  {sharedStats.shared} / {sharedStats.total} CRs shared
                </span>
                <button className="btn btn-icon" onClick={() => setShowLoadModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search / filter bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 0 14px', flexShrink: 0 }}>
              <div className="load-filter load-filter-search">
                <Search size={14} />
                <input
                  className="input"
                  value={loadSearch}
                  onChange={e => setLoadSearch(e.target.value)}
                  placeholder="Search by dept, section, lab group or CR name…"
                />
              </div>
              <div className="load-filter-row">
                <div className="load-filter">
                  <Building2 size={14} />
                  <select className="input" value={loadDept} onChange={e => handleLoadDeptChange(e.target.value)}>
                    <option value="all">All departments</option>
                    {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="load-filter">
                  <GraduationCap size={14} />
                  <select className="input" value={loadSem} onChange={e => setLoadSem(e.target.value)}>
                    <option value="all">All semesters</option>
                    {sharedSems.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, margin: '6px 0 16px' }}>
              {sharedLoading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <Loader2 size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                  <p>Loading shared routines…</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredShared.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      <p>{sharedRoutines.length === 0 ? 'No CR has shared a routine yet.' : 'No routines match your search.'}</p>
                    </div>
                  )}
                  {filteredShared.length > 0 && (
                    <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '0 0 2px' }}>
                      Routines shared by CRs
                    </div>
                  )}
                  {filteredShared.map(routine => {
                    const isSelected = selectedTemplate?.id === routine.id;
                    const isMine = mySlotKey === `${routine.department || ''}|${routine.yearSemester || ''}|${routine.section || ''}|${routine.labSection || ''}`;
                    return (
                      <div
                        key={routine.id}
                        onClick={() => setSelectedTemplate(routine)}
                        style={{
                          padding: '12px',
                          background: isSelected ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                          border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {routine.crName || 'CR'}
                              {isMine && <span className="badge badge-emerald" style={{ fontSize: '8px', padding: '1px 4px' }}>Yours</span>}
                            </h4>
                            <div className="flex items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                              <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{routine.department}</span>
                              <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>{routine.yearSemester}</span>
                              <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>Sec {routine.section}</span>
                              <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>Lab {routine.labSection}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <Check size={18} style={{ color: 'var(--accent-emerald)' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {visibleGroups.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
                        Admin templates — full department schedules
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {visibleGroups.map(dept => {
                          const groupTemplates = availableTemplates.filter(t => t.department === dept);
                          const merged = mergeTemplatesToRoutine(groupTemplates);
                          const totalClasses = merged
                            ? Object.values(merged.routine).reduce((sum, day) => sum + (Array.isArray(day) ? day.length : 0), 0)
                            : 0;
                          const semCount = groupTemplates.length;
                          return (
                            <div
                              key={dept}
                              onClick={() => handleLoadDeptChange(dept)}
                              title={`Load the whole ${dept} schedule (${semCount} semester template${semCount !== 1 ? 's' : ''} combined)`}
                              style={{
                                padding: '12px',
                                background: loadDept === dept ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                                border: `1px solid ${loadDept === dept ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {dept} — Full Schedule
                                    <span className="badge badge-emerald" style={{ fontSize: '8px', padding: '1px 4px' }}>All semesters</span>
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                                    <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{dept}</span>
                                    <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>{semCount} semester{semCount !== 1 ? 's' : ''} combined</span>
                                    <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{totalClasses} classes</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {loadDept === dept && (totalClasses > 0 ? (
                                    <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Check size={12} /> Loaded ✓
                                    </span>
                                  ) : (
                                    <span className="badge badge-purple" style={{ fontSize: '10px', padding: '4px 10px' }}>No classes yet</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2" style={{ paddingTop: '12px', borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <button className="btn btn-secondary flex-1" onClick={() => setShowLoadModal(false)}>Cancel</button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleLoadTemplate}
                disabled={!selectedTemplate}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: selectedTemplate ? 1 : 0.5 }}
              >
                <Download size={16} /> Load Routine
              </button>
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
                <h3 style={{ color: '#fff' }}>{editing.mode === 'add' ? 'Add Class' : 'Edit Class'}</h3>
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
