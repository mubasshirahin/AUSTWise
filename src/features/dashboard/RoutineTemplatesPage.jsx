import { useState, useEffect } from 'react';
import { CalendarDays, Download, Building2, Check } from 'lucide-react';
import { loadTemplates, mergeTemplatesToRoutine } from '../../utils/routineTemplates';
import { getAutoColorForCourse } from '../../utils/autoColorPalette';
import { useRoutine } from '../../context/RoutineContext';
import './DashboardPage.css';

export default function RoutineTemplatesPage() {
  const { replaceRoutine } = useRoutine();
  const [templates, setTemplates] = useState([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorForm, setEditorForm] = useState({
    name: '',
    semester: '1-1',
    department: 'CSE',
    year: new Date().getFullYear().toString(),
    routine: {
      Sunday: [],
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
    },
    weekDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  });
  const [editingClass, setEditingClass] = useState(null);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const departments = [...new Set(templates.map(t => t.department).filter(Boolean))].sort();
  const visibleTemplates = selectedDept === 'all'
    ? templates
    : templates.filter(t => t.department === selectedDept);

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

  const slotBoundaries = [
    '08:00', '08:50', '09:40', '10:30', '11:20', '12:10',
    '13:00', '13:50', '14:40', '15:30', '16:20', '17:10', '18:00',
  ];

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

  useEffect(() => {
    refreshTemplates();
  }, []);

  const refreshTemplates = () => {
    const loaded = loadTemplates();
    setTemplates(loaded);
  };

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

  const getSlotDetails = (timeStr) => {
    const [rawStart, rawEnd] = timeStr.split('-');
    const start = normalizeTime(rawStart || '');
    const end = normalizeTime(rawEnd || '');
    let startIdx = slotBoundaries.indexOf(start);
    let endIdx = slotBoundaries.indexOf(end);
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

  const openAddClass = (day, slotIdx) => {
    const start = slotBoundaries[slotIdx] || '08:00';
    const end = slotBoundaries[slotIdx + 1] || '08:50';
    const startTime = formatTimeForDisplay(start);
    const endTime = formatTimeForDisplay(end);
    
    setEditingClass({
      mode: 'add',
      day,
      form: {
        id: Date.now(),
        course: '',
        name: '',
        type: 'Theory',
        time: `${startTime} - ${endTime}`,
        room: '',
        teacher: '',
        color: getAutoColorForCourse('', 'Theory'),
      },
    });
  };

  const openEditClass = (day, cls) => {
    setEditingClass({
      mode: 'edit',
      originalDay: day,
      day,
      form: { ...cls },
    });
  };

  const updateClassForm = (field, value) => {
    setEditingClass((current) => ({
      ...current,
      form: {
        ...current.form,
        [field]: value,
      },
    }));
  };

  const handleClassTypeChange = (newType) => {
    const periods = newType === 'Lab' ? 3 : 1;
    const timeParts = editingClass.form.time.split(' - ');
    const start = timeParts[0] || '08:00';
    const newEnd = calculateEndTime(start, periods);
    updateClassForm('time', `${start} - ${newEnd}`);
    updateClassForm('type', newType);
    updateClassForm('color', getAutoColorForCourse(editingClass.form.course, newType));
  };

  const saveClass = (event) => {
    event.preventDefault();
    const cleanClass = {
      ...editingClass.form,
      course: editingClass.form.course.trim() || 'Untitled',
      name: editingClass.form.name.trim() || 'Class',
      room: editingClass.form.room.trim() || 'TBA',
      teacher: editingClass.form.teacher.trim() || 'TBA',
      time: editingClass.form.time.trim() || '08:00 - 08:50',
    };

    const newRoutine = { ...editorForm.routine };
    
    if (editingClass.mode === 'add') {
      newRoutine[editingClass.day] = [...(newRoutine[editingClass.day] || []), cleanClass];
    } else {
      newRoutine[editingClass.originalDay] = (newRoutine[editingClass.originalDay] || []).filter(
        cls => cls.id !== cleanClass.id
      );
      const targetDay = cleanClass.day || editingClass.originalDay;
      newRoutine[targetDay] = [...(newRoutine[targetDay] || []), cleanClass];
    }

    setEditorForm({ ...editorForm, routine: newRoutine });
    setEditingClass(null);
  };

  const deleteClass = () => {
    if (editingClass.mode === 'edit') {
      const newRoutine = { ...editorForm.routine };
      newRoutine[editingClass.originalDay] = (newRoutine[editingClass.originalDay] || []).filter(
        cls => cls.id !== editingClass.form.id
      );
      setEditorForm({ ...editorForm, routine: newRoutine });
    }
    setEditingClass(null);
  };

  // Load a single template straight into the routine (fixes the old dead event).
  // Only meaningful in the "All departments" view — once a dept is chosen, its
  // whole set is auto-loaded and this button is disabled to avoid wiping it.
  const handleLoadTemplate = (template) => {
    if (!template || !template.routine) return;
    replaceRoutine(template.routine, template.weekDays || weekDays);
  };

  // Load every semester template for a department in one go — merged into the
  // weekly schedule. No more semester-by-semester loading.
  const loadDeptTemplatesAtOnce = (deptTemplates) => {
    const merged = mergeTemplatesToRoutine(deptTemplates);
    if (!merged) return;
    replaceRoutine(merged.routine, merged.weekDays);
  };

  // Selecting a department auto-loads all of its semester templates at once.
  const handleDeptChange = (value) => {
    setSelectedDept(value);
    if (value !== 'all') {
      const deptTemplates = templates.filter(t => t.department === value);
      // Only auto-load when the department actually has template classes —
      // avoids wiping the user's routine with blank days.
      const hasClasses = deptTemplates.some(t =>
        Object.values(t.routine || {}).some(day => Array.isArray(day) && day.length > 0)
      );
      if (hasClasses) {
        loadDeptTemplatesAtOnce(deptTemplates);
      }
    }
  };

  // Merged full-department schedule (all semesters combined into one card).
  const mergedDept = selectedDept !== 'all'
    ? mergeTemplatesToRoutine(visibleTemplates)
    : null;
  const mergedTotalClasses = mergedDept
    ? Object.values(mergedDept.routine).reduce((sum, day) => sum + (Array.isArray(day) ? day.length : 0), 0)
    : 0;

  return (
    <div className="dashboard-page animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="dashboard-header-section" style={{ flexShrink: 0 }}>
        <h1 className="page-title">Routine Templates</h1>
        <p className="page-description">Pick a department — all of its semester routines load into your schedule at once.</p>

        {departments.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
            <div className="load-filter">
              <Building2 size={14} />
              <select className="input" value={selectedDept} onChange={e => handleDeptChange(e.target.value)}>
                <option value="all">All departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {selectedDept !== 'all' && (
              <span className="badge badge-blue" style={{ fontSize: '10px', padding: '4px 10px' }}>
                Showing {visibleTemplates.length} template{visibleTemplates.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {templates.length === 0 ? (
          <div className="glass-card-static" style={{ padding: '60px', textAlign: 'center' }}>
            <CalendarDays size={64} style={{ color: 'var(--text-tertiary)', opacity: 0.5, marginBottom: '20px' }} />
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: '0 0 8px' }}>No Templates Available</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No routine templates have been created yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
            {selectedDept !== 'all' && mergedDept ? (
              /* ── Combined department card: all semesters merged into one view ── */
              <div key={`merged-${selectedDept}`} className="glass-card-static">
                <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>{selectedDept} — Full Schedule</h3>
                    <div className="flex items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                      <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{selectedDept}</span>
                      <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>{visibleTemplates.length} semester{visibleTemplates.length !== 1 ? 's' : ''} combined</span>
                      <span className="badge badge-emerald" style={{ fontSize: '9px', padding: '1px 4px' }}>{mergedTotalClasses} classes</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Whole 4/5 year course loaded together</span>
                    </div>
                  </div>
                  {mergedTotalClasses > 0 ? (
                    <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Loaded ✓
                    </span>
                  ) : (
                    <span className="badge badge-purple" style={{ fontSize: '10px', padding: '4px 10px' }}>No classes yet</span>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-primary)' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'left', minWidth: '80px' }}>Day</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Course</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Time</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Room</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Teacher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedDept.weekDays.map(day => {
                        const dayClasses = mergedDept.routine[day] || [];
                        return dayClasses.length > 0 ? dayClasses.map((cls, idx) => (
                          <tr key={`${selectedDept}-${day}-${idx}`} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            {idx === 0 && (
                              <td rowSpan={dayClasses.length} style={{ padding: '8px', fontWeight: 'bold', color: 'var(--accent-blue)', textAlign: 'left', verticalAlign: 'top', borderRight: '1px solid var(--border-secondary)' }}>
                                {day}
                              </td>
                            )}
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>{cls.course}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{cls.name}</div>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{cls.time}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{cls.room}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{cls.teacher}</td>
                          </tr>
                        )) : (
                          <tr key={`${selectedDept}-${day}-empty`} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--text-tertiary)', textAlign: 'left' }}>{day}</td>
                            <td colSpan="4" style={{ padding: '8px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No classes</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              visibleTemplates.map(template => (
              <div key={template.id} className="glass-card-static">
                <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>{template.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{template.department}</span>
                      <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>Sem {template.semester}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{template.year}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleLoadTemplate(template)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} /> Load This Routine
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-primary)' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'left', minWidth: '80px' }}>Day</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Course</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Time</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Room</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Teacher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekDays.map(day => {
                        const dayClasses = template.routine[day] || [];
                        return dayClasses.length > 0 ? dayClasses.map((cls, idx) => (
                          <tr key={`${template.id}-${day}-${idx}`} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            {idx === 0 && (
                              <td rowSpan={dayClasses.length} style={{ padding: '8px', fontWeight: 'bold', color: 'var(--accent-blue)', textAlign: 'left', verticalAlign: 'top', borderRight: '1px solid var(--border-secondary)' }}>
                                {day}
                              </td>
                            )}
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>{cls.course}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{cls.name}</div>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{cls.time}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{cls.room}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{cls.teacher}</td>
                          </tr>
                        )) : (
                          <tr key={`${template.id}-${day}-empty`} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--text-tertiary)', textAlign: 'left' }}>{day}</td>
                            <td colSpan="4" style={{ padding: '8px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No classes</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}