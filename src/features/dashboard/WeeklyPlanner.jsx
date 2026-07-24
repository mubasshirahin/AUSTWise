import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X, Download, Eye, Check, RotateCcw, FileDown, ChevronDown } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { ocrImportedRoutine, ocrImportedWeekDays } from '../../context/RoutineContext';
import { normalizeAccentColor, getCourseColor } from '../../utils/colorPalette';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { findCourseByCode, findCourseByName } from '../../data/courses';
import { getAutoColorForCourse } from '../../utils/autoColorPalette';
import { loadTemplates } from '../../utils/routineTemplates';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

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

  const openLoadModal = () => {
    const templates = loadTemplates();
    setAvailableTemplates(templates);
    setSelectedTemplate(null);
    setShowLoadModal(true);
  };

  const handleLoadTemplate = () => {
    if (selectedTemplate) {
      replaceRoutine(selectedTemplate.routine, selectedTemplate.weekDays);
      setShowLoadModal(false);
      setSelectedTemplate(null);
    }
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

       {/* Right: 🔄 Reset + Load Routine */}
       <div className="dash-header-right">
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

      {/* Load Routine Modal */}
      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 92vw)', height: 'min(400px, 70vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 'none', maxHeight: 'none', margin: 0, animation: 'none' }}>
            <div className="flex justify-between items-center" style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', margin: 0 }}>Load Routine Template</h3>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>Select a pre-defined routine template to load</p>
              </div>
              <button className="btn btn-icon" onClick={() => setShowLoadModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, margin: '12px 0' }}>
              {availableTemplates.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <p>No routine templates available.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {availableTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      style={{
                        padding: '12px',
                        background: selectedTemplate?.id === template.id ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                        border: `1px solid ${selectedTemplate?.id === template.id ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0 }}>{template.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{template.department}</span>
                            <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>Sem {template.semester}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{template.year}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedTemplate?.id === template.id && (
                            <Check size={18} style={{ color: 'var(--accent-emerald)' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
                <Download size={16} /> Load Template
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
