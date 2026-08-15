import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2, Edit3, X, Save, Check, Download } from 'lucide-react';
import { loadTemplates, saveTemplates, addTemplate, updateTemplate, deleteTemplate } from '../../utils/routineTemplates';
import { getAutoColorForCourse } from '../../utils/autoColorPalette';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import RoomAutocomplete from '../../components/RoomAutocomplete';
import TeacherAutocomplete from '../../components/TeacherAutocomplete';

export default function RoutineTemplatesPanel() {
  const [templates, setTemplates] = useState([]);
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

  // Editor state for adding/editing classes
  const [editingClass, setEditingClass] = useState(null);

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

  const handleCreateTemplate = () => {
    setEditorForm({
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
    setEditingTemplate(null);
    setEditingClass(null);
    setShowEditor(true);
  };

  const handleEditTemplate = (template) => {
    setEditorForm({ ...template });
    setEditingTemplate(template);
    setEditingClass(null);
    setShowEditor(true);
  };

  const handleSaveTemplate = () => {
    if (!editorForm.name.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, editorForm);
    } else {
      addTemplate(editorForm);
    }
    
    refreshTemplates();
    setShowEditor(false);
    setEditingTemplate(null);
    setEditingClass(null);
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
      refreshTemplates();
    }
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingTemplate(null);
    setEditingClass(null);
  };

  // Class editing functions
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

  const openAddClass = (day, slotIdx) => {
    const start = slotBoundaries[slotIdx] || '08:00';
    const end = slotBoundaries[slotIdx + 1] || '08:50';
    const startFormatted = start.replace(':', ' - ').replace(' - ', ' - ').substring(0, 5);
    const endFormatted = end.substring(0, 5);
    
    // Format time for display
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
      // Remove old class
      newRoutine[editingClass.originalDay] = (newRoutine[editingClass.originalDay] || []).filter(
        cls => cls.id !== cleanClass.id
      );
      // Add updated class to new day
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

  // Template List View with Table Format
  if (showEditor) {
    return (
      <div className="glass-card-static">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Click on empty cells to add classes. Click on existing classes to edit.
            </p>
          </div>
          <button className="btn btn-icon" onClick={handleCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Template Info */}
        <div className="grid-4" style={{ gap: '12px', marginBottom: '20px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="input-label">Template Name *</label>
            <input
              type="text"
              value={editorForm.name}
              onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
              className="input"
              placeholder="e.g., CSE 1st Semester - Spring 2025"
            />
          </div>
          <div>
            <label className="input-label">Semester</label>
            <select
              value={editorForm.semester}
              onChange={(e) => setEditorForm({ ...editorForm, semester: e.target.value })}
              className="input"
            >
              <option value="1-1">1-1 (1st Sem)</option>
              <option value="1-2">1-2 (2nd Sem)</option>
              <option value="2-1">2-1 (3rd Sem)</option>
              <option value="2-2">2-2 (4th Sem)</option>
              <option value="3-1">3-1 (5th Sem)</option>
              <option value="3-2">3-2 (6th Sem)</option>
              <option value="4-1">4-1 (7th Sem)</option>
              <option value="4-2">4-2 (8th Sem)</option>
            </select>
          </div>
          <div>
            <label className="input-label">Department</label>
            <select
              value={editorForm.department}
              onChange={(e) => setEditorForm({ ...editorForm, department: e.target.value })}
              className="input"
            >
              <option value="CSE">CSE</option>
              <option value="EEE">EEE</option>
              <option value="ME">ME</option>
              <option value="CE">CE</option>
              <option value="IPE">IPE</option>
              <option value="BECM">BECM</option>
            </select>
          </div>
          <div>
            <label className="input-label">Year</label>
            <input
              type="text"
              value={editorForm.year}
              onChange={(e) => setEditorForm({ ...editorForm, year: e.target.value })}
              className="input"
              placeholder="2025"
            />
          </div>
        </div>

        {/* Routine Table */}
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', tableLayout: 'fixed', border: '1px solid var(--border-primary)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-primary)' }}>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', borderRight: '1px solid var(--border-primary)', minWidth: '80px' }}>Day</th>
                {timeSlots.map((slot) => (
                  <th key={slot.label} style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'var(--fw-semibold)', borderRight: '1px solid var(--border-primary)', fontSize: 'var(--fs-xs)' }}>
                    {slot.display}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekDays.map((day) => {
                const dayClasses = editorForm.routine[day] || [];
                const scheduledCells = dayClasses
                  .map((cls) => ({ ...cls, ...getSlotDetails(cls.time) }))
                  .filter((cls) => cls.startIdx < timeSlots.length)
                  .sort((a, b) => a.startIdx - b.startIdx);

                let nextClassIdx = 0;

                return (
                  <tr key={day} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ fontWeight: 'bold', background: 'var(--bg-input)', borderRight: '1px solid var(--border-primary)', color: 'var(--text-primary)', textTransform: 'uppercase', padding: '8px' }}>
                      {day.substring(0, 3)}
                    </td>

                    {timeSlots.map((_, idx) => {
                      const cls = scheduledCells[nextClassIdx];
                      if (cls && cls.startIdx === idx) {
                        nextClassIdx += 1;

                        return (
                          <td
                            key={`${day}-${cls.id}`}
                            colSpan={cls.colSpan}
                            onClick={() => openEditClass(day, cls)}
                            style={{
                              borderRight: '1px solid var(--border-primary)',
                              verticalAlign: 'middle',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <div style={{ background: `${cls.color}18`, border: `1px solid ${cls.color}40`, borderLeft: `4px solid ${cls.color}`, borderRadius: '4px', padding: '4px' }}>
                              <div style={{ fontWeight: 'bold', color: cls.color, fontSize: '10px' }}>{cls.course}</div>
                              <div style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls.name}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '9px' }}>{cls.room}</div>
                            </div>
                          </td>
                        );
                      }

                      const isCoveredByPrevious = scheduledCells.some((item) => idx > item.startIdx && idx < item.startIdx + item.colSpan);
                      if (isCoveredByPrevious) return null;

                      return (
                        <td
                          key={`${day}-empty-${idx}`}
                          onClick={() => openAddClass(day, idx)}
                          style={{
                            borderRight: '1px solid var(--border-secondary)',
                            background: 'rgba(255,255,255,0.01)',
                            cursor: 'pointer',
                            padding: '4px',
                            minHeight: '40px',
                          }}
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

        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={handleSaveTemplate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Save size={16} /> {editingTemplate ? 'Update Template' : 'Create Template'}
          </button>
          <button className="btn btn-secondary flex-1" onClick={handleCancel}>Cancel</button>
        </div>

        {/* Edit Class Modal - Inside Editor */}
        {editingClass && (
          <div className="modal-overlay" onClick={() => setEditingClass(null)}>
            <form className="modal routine-edit-modal" onSubmit={saveClass} onClick={(e) => e.stopPropagation()}>
              <div className="routine-edit-header">
                <div>
                  <h3>{editingClass.mode === 'add' ? 'Add Class' : 'Edit Class'}</h3>
                  <p>{editingClass.day}</p>
                </div>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => setEditingClass(null)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

            <div className="routine-edit-body">
              <div className="routine-edit-grid">
                <label>
                  Type
                  <select className="input" value={editingClass.form.type} onChange={(e) => handleClassTypeChange(e.target.value)}>
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab</option>
                  </select>
                </label>
                <label>
                  Course Code
                  <CourseAutocomplete
                    value={editingClass.form.course}
                    placeholder="Type course code (e.g., CSE1101)..."
                    type="code"
                    onCourseSelect={(course) => {
                      if (course) {
                        if (course.partialUpdate) {
                          updateClassForm('course', course.code);
                        } else {
                          updateClassForm('course', course.code);
                          updateClassForm('name', course.name);
                          updateClassForm('color', getAutoColorForCourse(course.code, editingClass.form.type));
                        }
                      }
                    }}
                  />
                </label>
                <label className="routine-edit-wide">
                  Course Name
                  <CourseAutocomplete
                    value={editingClass.form.name}
                    placeholder="Type course name (e.g., Data Structures)..."
                    type="name"
                    onCourseSelect={(course) => {
                      if (course) {
                        if (course.partialUpdate) {
                          updateClassForm('name', course.name);
                        } else {
                          updateClassForm('name', course.name);
                          updateClassForm('course', course.code);
                        }
                      }
                    }}
                  />
                </label>
                <label>
                  Room
                  <RoomAutocomplete
                    value={editingClass.form.room}
                    placeholder="e.g. 7A03 — choose a room or type your own..."
                    onRoomSelect={(room) => updateClassForm('room', room)}
                  />
                </label>
                <label className="routine-edit-wide">
                  Teacher
                  <TeacherAutocomplete
                    value={editingClass.form.teacher}
                    placeholder="Type teacher name (e.g. Dr. Rahman)..."
                    onTeacherSelect={(teacher) => updateClassForm('teacher', teacher)}
                  />
                </label>
              </div>
            </div>

              <div className="routine-edit-actions">
                {editingClass.mode === 'edit' && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={deleteClass}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <div className="routine-edit-spacer" />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingClass(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Template List View
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold' }}>Routine Templates ({templates.length})</h3>
        <button className="btn btn-primary btn-sm" onClick={handleCreateTemplate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Create Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="glass-card-static" style={{ padding: '40px', textAlign: 'center' }}>
          <CalendarDays size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.5, marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>No routine templates created yet.</p>
          <button className="btn btn-primary btn-sm" onClick={handleCreateTemplate} style={{ marginTop: '12px' }}>
            Create First Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {templates.map(template => (
            <div key={template.id} className="glass-card-static" style={{ position: 'relative' }}>
              {/* Template Header */}
              <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>{template.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{template.department}</span>
                    <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>Sem {template.semester}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{template.year}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEditTemplate(template)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                    style={{ color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>

              {/* Routine Table */}
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
          ))}
        </div>
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="modal-overlay" onClick={() => setEditingClass(null)}>
          <form className="modal routine-edit-modal" onSubmit={saveClass} onClick={(e) => e.stopPropagation()}>
            <div className="routine-edit-header">
              <div>
                <h3>{editingClass.mode === 'add' ? 'Add Class' : 'Edit Class'}</h3>
                <p>{editingClass.day}</p>
              </div>
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => setEditingClass(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="routine-edit-body">
              <div className="routine-edit-grid">
                <label>
                  Course Code
                  <input className="input" value={editingClass.form.course} onChange={(e) => updateClassForm('course', e.target.value)} placeholder="e.g., CSE1101" />
                </label>
                <label className="routine-edit-wide">
                  Course Name
                  <input className="input" value={editingClass.form.name} onChange={(e) => updateClassForm('name', e.target.value)} placeholder="e.g., Data Structures" />
                </label>
                <label>
                  Time
                  <input className="input" value={editingClass.form.time} onChange={(e) => updateClassForm('time', e.target.value)} placeholder="08:00 - 08:50" />
                </label>
                <label>
                  Room
                  <RoomAutocomplete
                    value={editingClass.form.room}
                    placeholder="e.g. 7A03 — choose a room or type your own..."
                    onRoomSelect={(room) => updateClassForm('room', room)}
                  />
                </label>
                <label className="routine-edit-wide">
                  Teacher
                  <TeacherAutocomplete
                    value={editingClass.form.teacher}
                    placeholder="Type teacher name (e.g. Dr. Rahman)..."
                    onTeacherSelect={(teacher) => updateClassForm('teacher', teacher)}
                  />
                </label>
              </div>
            </div>

            <div className="routine-edit-actions">
              {editingClass.mode === 'edit' && (
                <button type="button" className="btn btn-danger btn-sm" onClick={deleteClass}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <div className="routine-edit-spacer" />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingClass(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}