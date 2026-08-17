import { useState } from 'react';
import { CalendarDays, Download, Building2, Check } from 'lucide-react';
import { loadTemplates, mergeTemplatesToRoutine } from '../../utils/routineTemplates';
import { useRoutine } from '../../context/RoutineContext';
import './DashboardPage.css';

export default function RoutineTemplatesPage() {
  const { replaceRoutine } = useRoutine();
  const [templates] = useState(() => loadTemplates());
  const [selectedDept, setSelectedDept] = useState('all');

  const departments = [...new Set(templates.map(t => t.department).filter(Boolean))].sort();
  const visibleTemplates = selectedDept === 'all'
    ? templates
    : templates.filter(t => t.department === selectedDept);

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

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