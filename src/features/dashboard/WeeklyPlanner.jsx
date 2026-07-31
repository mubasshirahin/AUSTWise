import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, X, Download, Eye, Check, RotateCcw, FileDown, ChevronDown, Share2, Users, Search, Star, BookOpen, Upload } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { ocrImportedRoutine, ocrImportedWeekDays } from '../../context/RoutineContext';
import { normalizeAccentColor, getCourseColor } from '../../utils/colorPalette';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { findCourseByCode, findCourseByName } from '../../data/courses';
import { getAutoColorForCourse } from '../../utils/autoColorPalette';
import { loadTemplates } from '../../utils/routineTemplates';
import { loadSharedRoutines, shareRoutine, hasSharedRoutine, unshareRoutine, shareRoutineToServer } from '../../utils/sharedRoutines';
import { getCurrentUserId, getAccountById } from '../../utils/authStorage';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logoUrl from '../../assets/logo-silver.png';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';

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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [sharedRoutineList, setSharedRoutineList] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [secFilter, setSecFilter] = useState('');
  const [labFilter, setLabFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCRoutines, setShowCRoutines] = useState(false);
  const exportRef = useRef(null);
  const routineImageRef = useRef(null);
  const [routineImportStatus, setRoutineImportStatus] = useState('');
  const [routineImporting, setRoutineImporting] = useState(false);

  // Check if current user is CR
  const currentUserId = getCurrentUserId();
  const currentAccount = currentUserId ? getAccountById(currentUserId) : null;
  const isCR = currentAccount?.role === 'cr';
  const alreadyShared = currentUserId ? hasSharedRoutine(currentUserId) : false;

  // Count classes in current routine
  const hasClasses = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    for (const day of days) {
      if ((routine[day] || []).length > 0) return true;
    }
    return false;
  }, [routine]);

  useEffect(() => {
    localStorage.setItem('aust-ramadan-mode', ramadanMode);
  }, [ramadanMode]);

  useEffect(() => {
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

  const formatTimeForDisplay = (time24) => {
    const [hour, minute] = time24.split(':');
    const hourNum = parseInt(hour, 10);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
    return `${String(hour12).padStart(2, '0')}:${minute} ${ampm}`;
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

  // Import routine from an image via the backend extraction endpoint.
  // The extracted routine is saved through replaceRoutine() into RoutineContext,
  // which is exactly what RoutineCard / WeekSchedule read from.
  const handleImportRoutineImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRoutineImportStatus('Please choose an image file (PNG/JPG).');
      return;
    }

    setRoutineImporting(true);
    setRoutineImportStatus('Extracting routine from image…');
    try {
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the image file.'));
        reader.readAsDataURL(file);
      });

      const res = await apiFetch('/api/extract-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Routine extraction failed.');
      if (!data.routine || Object.keys(data.routine).length === 0) {
        throw new Error(data.error || 'No routine detected in the image.');
      }

      // Feed the extracted routine into RoutineContext so RoutineCard picks it up.
      replaceRoutine(data.routine, data.weekDays || weekDays);
      setRoutineImportStatus('✓ Routine imported successfully.');
      setShowLoadModal(false);
    } catch (err) {
      setRoutineImportStatus(err.message || 'Routine extraction failed. Please try again.');
    } finally {
      setRoutineImporting(false);
    }
  };

  const openLoadModal = () => {
    setRoutineImportStatus('');
    const templates = loadTemplates();
    setAvailableTemplates(templates);
    setSharedRoutineList(loadSharedRoutines());
    setSelectedTemplate(null);
    setDeptFilter('');
    setSemFilter('');
    setSecFilter('');
    setLabFilter('');
    setSearchQuery('');
    setShowCRoutines(false);
    setShowLoadModal(true);
  };

  const handleLoadTemplate = () => {
    if (selectedTemplate) {
      replaceRoutine(selectedTemplate.routine, selectedTemplate.weekDays);
      setShowLoadModal(false);
      setSelectedTemplate(null);
    }
  };

  const handleShareRoutine = async () => {
    if (!currentAccount || !hasClasses) return;
    // Save to localStorage + server (best-effort) for cross-device access
    await shareRoutineToServer(
      {
        id: currentAccount.id,
        name: currentAccount.name || currentAccount.email,
        email: currentAccount.email,
        department: currentAccount.department || '',
        semester: currentAccount.semester || '',
        section: currentAccount.section || '',
        labSection: currentAccount.labSection || '',
      },
      { routine, weekDays }
    );
    // Refresh shared routine list in case load modal is opened next
    setSharedRoutineList(loadSharedRoutines());
    setShowShareConfirm(false);
  };

  const handleUnshareRoutine = () => {
    if (!currentUserId) return;
    unshareRoutine(currentUserId);
    setSharedRoutineList(loadSharedRoutines());
    setShowShareConfirm(false);
  };

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
     <div className="glass-card-static weekly-planner animate-fadeInUp">      <div className="dash-header-three mb-4">

       {/* Left: Export Dropdown */}
       <div className="dash-header-left">
         <div className="export-dropdown" ref={exportRef}>
           <button className="btn btn-secondary btn-sm" onClick={() => setShowExportMenu(!showExportMenu)} aria-label="Export schedule" aria-haspopup="true">
             <FileDown size={14} /> Export <ChevronDown size={12} />
           </button>
           {showExportMenu && (
             <div className="export-menu">
               <button className="export-menu-item" onClick={() => { downloadSchedulePDF(); setShowExportMenu(false); }}>
                 <FileDown size={14} /> Export as PDF
               </button>
               <button className="export-menu-item" onClick={() => { downloadScheduleImage(); setShowExportMenu(false); }}>
                 <FileDown size={14} /> Export as Image
               </button>
             </div>
           )}
         </div>
       </div>

       {/* Middle: 🌙 Ramadan Toggle Switch */}
       <div className="dash-header-center">
         <div className="ramadan-toggle" onClick={() => setRamadanMode(!ramadanMode)} title={ramadanMode ? 'Switch to normal schedule' : 'Switch to Ramadan schedule'}>
           <span className="ramadan-toggle-label">Ramadan</span>
           <div className={`ramadan-toggle-track${ramadanMode ? ' active' : ''}`}>
             {ramadanMode ? (
               <span className="ramadan-toggle-icon">🕌</span>
             ) : (
               <div className="ramadan-toggle-thumb" />
             )}
           </div>
         </div>
       </div>

       {/* Right: Share, Reset, Load Routine */}
       <div className="dash-header-right">
         {/* Share Routine — for CRs only */}
         {isCR && (
           <button
             className={`btn btn-sm ${alreadyShared ? 'btn-secondary' : 'btn-ghost'}`}
             onClick={() => setShowShareConfirm(true)}
             title={alreadyShared ? 'Update your shared routine' : 'Share your routine with classmates'}
             style={{ opacity: hasClasses ? 1 : 0.5 }}
             disabled={!hasClasses}
           >
             <Share2 size={14} /> {alreadyShared ? 'Shared ✓' : 'Share'}
           </button>
         )}

         {/* 🔄 Icon-only Reset */}
         <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmReset(true)} title="Reset schedule">
           <RotateCcw size={14} />
         </button>

         {/* Load Routine — the primary action */}
         <button className="btn btn-primary btn-sm" onClick={openLoadModal}>
           <Download size={14} /> Load Routine
         </button>
       </div>
     </div>

      <div className="weekly-table-wrap">
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

              let nextClassIdx = 0;

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
                        nextClassIdx += classesAtIdx.length;
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
                      nextClassIdx += classesAtIdx.length;
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

      {/* Load Routine Modal — with shared routines & filtering */}
      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 94vw)', height: 'min(500px, 80vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 'none', maxHeight: 'none', margin: 0, animation: 'none' }}>
            <div className="flex justify-between items-center" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', margin: 0 }}>Load Routine</h3>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {showCRoutines
                    ? 'Browse routines shared by CRs — click to load'
                    : 'Select a pre-defined routine template to load'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`btn btn-sm ${showCRoutines ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => {
                    setShowCRoutines(!showCRoutines);
                    setSelectedTemplate(null);
                    setSearchQuery('');
                    setDeptFilter('');
                    setSemFilter('');
                    setSecFilter('');
                    setLabFilter('');
                  }}
                  title={showCRoutines ? 'Show admin templates' : 'Show CR-shared routines'}
                  style={{ fontSize: '11px', gap: '4px' }}
                >
                  {showCRoutines ? <BookOpen size={13} /> : <Users size={13} />}
                  {showCRoutines ? 'Templates' : 'CR Routines'}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => routineImageRef.current?.click()}
                  disabled={routineImporting}
                  title="Upload an image of your routine — we'll extract it with AI"
                  style={{ fontSize: '11px', gap: '4px' }}
                >
                  <Upload size={13} />
                  {routineImporting ? 'Extracting…' : 'Import Image'}
                </button>
                <input
                  ref={routineImageRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImportRoutineImage}
                />
                <button className="btn btn-icon" onClick={() => setShowLoadModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Import status message */}
            {routineImportStatus && (
              <div style={{ padding: '6px 0', fontSize: '11px', color: routineImportStatus.startsWith('✓') ? 'var(--accent-emerald)' : 'var(--accent-rose)', borderBottom: '1px solid var(--border-primary)' }}>
                {routineImportStatus}
              </div>
            )}

            {/* Filter bar — only show for CR routines */}
            {showCRoutines && (
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <select
                    value={deptFilter}
                    onChange={(e) => { setDeptFilter(e.target.value); setSemFilter(''); setSecFilter(''); setLabFilter(''); }}
                    style={{ flex: '1', minWidth: '80px', fontSize: '11px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">All Depts</option>
                    {[...new Set(sharedRoutineList.filter(r => r.department).map(r => r.department))].sort().map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={semFilter}
                    onChange={(e) => { setSemFilter(e.target.value); setSecFilter(''); setLabFilter(''); }}
                    disabled={!deptFilter}
                    style={{ flex: '1', minWidth: '70px', fontSize: '11px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">All Sems</option>
                    {deptFilter && [...new Set(sharedRoutineList.filter(r => r.department === deptFilter && r.semester).map(r => r.semester))].sort().map(s => (
                      <option key={s} value={s}>Sem {s}</option>
                    ))}
                  </select>
                  <select
                    value={secFilter}
                    onChange={(e) => { setSecFilter(e.target.value); setLabFilter(''); }}
                    disabled={!semFilter}
                    style={{ flex: '1', minWidth: '60px', fontSize: '11px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">All Sec</option>
                    {['A', 'B', 'C'].map(s => (
                      <option key={s} value={s}>Sec {s}</option>
                    ))}
                  </select>
                  <select
                    value={labFilter}
                    onChange={(e) => setLabFilter(e.target.value)}
                    disabled={!secFilter}
                    style={{ flex: '1', minWidth: '60px', fontSize: '11px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">All Lab</option>
                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => (
                      <option key={l} value={l}>Lab {l}</option>
                    ))}
                  </select>
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search by name, dept, or section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', fontSize: '11px', padding: '6px 8px 6px 28px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, margin: '8px 0' }}>
              {showCRoutines ? (
                <>
                  {sharedRoutineList.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      <Users size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>No CR routines shared yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sharedRoutineList
                        .filter(r => {
                          if (deptFilter && r.department !== deptFilter) return false;
                          if (semFilter && String(r.semester) !== semFilter) return false;
                          if (secFilter && r.section !== secFilter) return false;
                          if (labFilter && r.labSection !== labFilter) return false;
                          if (searchQuery) {
                            const q = searchQuery.toLowerCase();
                            if (!(r.studentName || '').toLowerCase().includes(q) &&
                                !(r.department || '').toLowerCase().includes(q) &&
                                !(r.section || '').toLowerCase().includes(q)) return false;
                          }
                          return true;
                        })
                        .map((sr) => {
                          const isSelected = selectedTemplate?.id === 'shared-' + (sr.studentId || sr.id);
                          const classCount = Object.values(sr.routine || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                          return (
                            <div
                              key={'shared-' + (sr.studentId || sr.id)}
                              onClick={() => setSelectedTemplate({
                                id: 'shared-' + (sr.studentId || sr.id),
                                type: 'shared',
                                routine: sr.routine,
                                weekDays: sr.weekDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
                                name: sr.studentName + ' (' + (sr.department || '') + ' Sem ' + (sr.semester || '') + ')',
                                studentName: sr.studentName,
                                department: sr.department,
                                semester: sr.semester,
                                section: sr.section,
                                labSection: sr.labSection,
                              })}
                              style={{
                                padding: '10px 12px',
                                background: isSelected ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                                border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Star size={12} style={{ color: 'var(--accent-amber)' }} />
                                    {sr.studentName || 'CR'}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                                    <span className="badge badge-blue" style={{ fontSize: '8px', padding: '1px 5px' }}>{sr.department || '—'}</span>
                                    <span className="badge badge-purple" style={{ fontSize: '8px', padding: '1px 5px' }}>Sem {sr.semester || '—'}</span>
                                    {sr.section && <span className="badge badge-amber" style={{ fontSize: '8px', padding: '1px 5px' }}>Sec {sr.section}</span>}
                                    {sr.labSection && <span className="badge badge-cyan" style={{ fontSize: '8px', padding: '1px 5px' }}>Lab {sr.labSection}</span>}
                                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{classCount} classes</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isSelected && (
                                    <Check size={16} style={{ color: 'var(--accent-emerald)' }} />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {sharedRoutineList.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {sharedRoutineList.filter(r => {
                            if (deptFilter && r.department !== deptFilter) return false;
                            if (semFilter && String(r.semester) !== semFilter) return false;
                            if (secFilter && r.section !== secFilter) return false;
                            if (labFilter && r.labSection !== labFilter) return false;
                            if (searchQuery) {
                              const q = searchQuery.toLowerCase();
                              if (!(r.studentName || '').toLowerCase().includes(q) &&
                                  !(r.department || '').toLowerCase().includes(q) &&
                                  !(r.section || '').toLowerCase().includes(q)) return false;
                            }
                            return true;
                          }).length} routine(s) shown
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {availableTemplates.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>No routine templates available.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {availableTemplates.map(template => (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplate({
                            ...template,
                            type: 'template',
                          })}
                          style={{
                            padding: '10px 12px',
                            background: selectedTemplate?.id === template.id && selectedTemplate?.type === 'template' ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                            border: `1px solid ${selectedTemplate?.id === template.id && selectedTemplate?.type === 'template' ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0 }}>{template.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="badge badge-blue" style={{ fontSize: '8px', padding: '1px 5px' }}>{template.department}</span>
                                <span className="badge badge-purple" style={{ fontSize: '8px', padding: '1px 5px' }}>Sem {template.semester}</span>
                                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{template.year}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedTemplate?.id === template.id && selectedTemplate?.type === 'template' && (
                                <Check size={16} style={{ color: 'var(--accent-emerald)' }} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
                <Download size={16} /> {selectedTemplate?.type === 'shared' ? `Load ${selectedTemplate.studentName}'s Routine` : 'Load Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Routine Confirm Dialog */}
      {showShareConfirm && (
        <div className="modal-overlay" onClick={() => setShowShareConfirm(false)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ width: 'min(400px, 90vw)', maxWidth: 'none', margin: 0, animation: 'none' }}>
            <div className="flex justify-between items-center" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-primary)' }}>
              <div>
                <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>
                  {alreadyShared ? 'Update Shared Routine?' : 'Share Your Routine?'}
                </h3>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {alreadyShared
                    ? 'Your routine is already shared. Update it with your current schedule?'
                    : 'Share your routine as CR so classmates can find and load it.'}
                </p>
              </div>
              <button className="btn btn-icon" onClick={() => setShowShareConfirm(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Preview info */}
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Your routine will appear as:
              </div>
              <div style={{
                padding: '10px 12px',
                background: 'var(--accent-blue-glow)',
                border: '1px solid var(--accent-blue)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Star size={12} style={{ color: 'var(--accent-amber)' }} />
                  <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>{currentAccount?.name || currentAccount?.email || 'You'}</span>
                </div>
                <div className="flex items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                  <span className="badge badge-blue" style={{ fontSize: '8px', padding: '1px 5px' }}>{currentAccount?.department || '—'}</span>
                  <span className="badge badge-purple" style={{ fontSize: '8px', padding: '1px 5px' }}>Sem {currentAccount?.semester || '—'}</span>
                  {currentAccount?.section && <span className="badge badge-amber" style={{ fontSize: '8px', padding: '1px 5px' }}>Sec {currentAccount.section}</span>}
                  {currentAccount?.labSection && <span className="badge badge-cyan" style={{ fontSize: '8px', padding: '1px 5px' }}>Lab {currentAccount.labSection}</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-2" style={{ paddingTop: '12px' }}>
              <button className="btn btn-secondary flex-1" onClick={() => setShowShareConfirm(false)}>Cancel</button>
              {alreadyShared && (
                <button className="btn btn-danger btn-sm" onClick={handleUnshareRoutine} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Trash2 size={14} /> Remove Share
                </button>
              )}
              <button
                className="btn btn-primary flex-1"
                onClick={handleShareRoutine}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Share2 size={14} /> {alreadyShared ? 'Update Share' : 'Share Routine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
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
                <input className="input" value={editing.form.room} onChange={(event) => updateForm('room', event.target.value)} />
              </label>
              <label>
                Teacher
                <input className="input" value={editing.form.teacher} onChange={(event) => updateForm('teacher', event.target.value)} />
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
        </div>
      )}

      {confirmReset && (
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
        </div>
      )}
    </div>
  );
}
