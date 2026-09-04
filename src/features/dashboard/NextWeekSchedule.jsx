import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Plus } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { getUserBatchGroup } from '../../utils/getUserBatchGroup';

export default function NextWeekSchedule() {
  const { routine, weekDays } = useRoutine();
  const { user } = useAuth();
  const [upcomingDates, setUpcomingDates] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [, setSelectedDay] = useState(null);
  const [newDeadline, setNewDeadline] = useState({
    title: '',
    course: '',
    dueDate: '',
    dueTime: '',
    type: '',
    customType: '',
    priority: 'medium'
  });

  // Check if user can add tasks (admin, CR, SR only)
  const canAddTask = user?.role === 'admin' || user?.role === 'cr' || user?.role === 'sr';

  // Get CR group info
  const crGroup = (() => {
    if (user?.role === 'cr') {
      return user?.section ? `Section ${user.section}` : user?.batch ? `Batch ${user.batch}` : '';
    }
    return '';
  })();

  const userBatchGroup = getUserBatchGroup(user);
      const groups = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
      return groups[batchGroupIndex >= 0 ? batchGroupIndex : 0];
    }
    return 'A1';
  })();

  // Calculate next 7 days from today
  useEffect(() => {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    setUpcomingDates(dates);
  }, []);

  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (date) => {
    return date.getDate();
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Load deadlines — live-synced across devices
  const [deadlines, setDeadlines] = useLiveValue('user', 'aust-deadlines', []);

  const saveDeadlines = (updatedDeadlines) => setDeadlines(updatedDeadlines);

  const handleAddDeadline = (e) => {
    e.preventDefault();
    if (!newDeadline.title.trim() || !newDeadline.dueDate) return;

    // Combine date and time
    let dueDateTime;
    if (newDeadline.dueDate && newDeadline.dueTime) {
      dueDateTime = new Date(`${newDeadline.dueDate}T${newDeadline.dueTime}`);
    } else if (newDeadline.dueDate) {
      dueDateTime = new Date(newDeadline.dueDate);
      dueDateTime.setHours(23, 59, 59);
    } else {
      return;
    }

    const typeLabel = newDeadline.type === 'Manual' ? (newDeadline.customType || 'Manual') : newDeadline.type;

    const deadline = {
      id: Date.now(),
      title: newDeadline.title.trim(),
      course: newDeadline.course.trim() || 'General',
      dueDate: dueDateTime,
      type: typeLabel,
      priority: newDeadline.priority,
      batchGroup: userBatchGroup,
      crGroup: crGroup || undefined,
      color: newDeadline.priority === 'high' ? '#f0554a' : newDeadline.priority === 'medium' ? '#f5a623' : '#9a9aa0'
    };

    const updated = [...deadlines, deadline];
    saveDeadlines(updated);
    setNewDeadline({ title: '', course: '', dueDate: '', dueTime: '', type: '', customType: '', priority: 'medium' });
    setShowAddModal(false);
  };

  const getDeadlinesForDate = (date) => {
    const key = date.toISOString().split('T')[0];
    return deadlines.filter(dl => {
      const d = dl.dueDate instanceof Date ? dl.dueDate : new Date(dl.dueDate);
      const deadlineDate = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
      return deadlineDate === key && dl.batchGroup === userBatchGroup;
    });
  };

  return (
    <div className="glass-card-static animate-fadeInUp">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)', padding: '6px', borderRadius: '8px' }}>
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="section-title" style={{ fontSize: 'var(--fs-md)', margin: 0 }}>Upcoming Schedule</h3>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Next 7 days schedule preview</p>
            {userBatchGroup && (
              <span style={{ fontSize: '8px', color: 'var(--accent-amber)', background: 'var(--accent-amber-glow)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                {userBatchGroup}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {upcomingDates.map((date, idx) => {
          const dayClasses = routine[weekDays[idx]] || [];
          const dayDeadlines = getDeadlinesForDate(date);

          return (
            <div
              key={idx}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: `1px solid ${dayClasses.length > 0 ? 'var(--border-primary)' : 'var(--border-secondary)'}`,
                opacity: dayClasses.length > 0 ? 1 : 0.6
              }}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: isToday(date) ? 'var(--accent-blue-glow)' : 'var(--bg-secondary)',
                      border: isToday(date) ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: isToday(date) ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                      {getDayNumber(date)}
                    </span>
                    <span style={{ fontSize: '7px', color: 'var(--text-tertiary)' }}>
                      {getMonthName(date)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {getDayName(date)}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                      ({dayClasses.length} classes)
                    </span>
                  </div>
                </div>
                {canAddTask && (
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setSelectedDay(date);
                      setNewDeadline({ ...newDeadline, dueDate: date.toISOString().split('T')[0] });
                      setShowAddModal(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '10px' }}
                  >
                    <Plus size={12} /> Add to Deadline
                  </button>
                )}
              </div>

              {dayClasses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dayClasses.map((cls, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        background: `${cls.color}10`,
                        borderLeft: `3px solid ${cls.color}`,
                        borderRadius: '4px'
                      }}
                    >
                      <Clock size={12} style={{ color: cls.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: cls.color }}>{cls.course}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '6px' }}>{cls.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{cls.time}</span>
                        {cls.room && cls.room !== 'TBA' && (
                          <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <MapPin size={10} /> {cls.room}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', fontStyle: 'italic' }}>
                  No classes scheduled
                </div>
              )}

              {/* Deadlines for this day */}
              {dayDeadlines.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-secondary)' }}>
                  {dayDeadlines.map(dl => (
                    <div key={dl.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: `${dl.color}10`, borderRadius: '4px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 'bold', color: dl.color }}>{dl.type}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', flex: 1 }}>{dl.title}</span>
                      {dl.batchGroup && (
                        <span style={{ fontSize: '7px', color: 'var(--accent-amber)', background: 'var(--accent-amber-glow)', padding: '1px 4px', borderRadius: '2px', fontWeight: 'bold' }}>
                          {dl.batchGroup}
                        </span>
                      )}
                      {dl.crGroup && (
                        <span style={{ fontSize: '7px', color: 'var(--accent-emerald)', background: 'var(--accent-emerald-glow)', padding: '1px 4px', borderRadius: '2px' }}>
                          {dl.crGroup}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Deadline Modal */}
      {showAddModal && canAddTask && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: '0 0 4px' }}>Add to Deadline</h3>
            {crGroup && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', marginBottom: '16px', fontWeight: 'bold' }}>
                Posting as CR of {crGroup}
              </p>
            )}
            <form onSubmit={handleAddDeadline} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Course</label>
                <input
                  type="text"
                  value={newDeadline.course}
                  onChange={(e) => setNewDeadline({ ...newDeadline, course: e.target.value })}
                  className="input"
                  placeholder="e.g., CSE1101"
                />
              </div>
              <div>
                <label className="input-label">Deadline Type *</label>
                <select
                  value={newDeadline.type}
                  onChange={(e) => setNewDeadline({ ...newDeadline, type: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select type...</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Online">Online</option>
                  <option value="Lab Report">Lab Report</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Viva">Viva</option>
                  <option value="Project Submission">Project Submission</option>
                  <option value="Mid">Mid</option>
                  <option value="Semester Final">Semester Final</option>
                  <option value="Manual">Manual (Custom)</option>
                </select>
              </div>
              {newDeadline.type === 'Manual' && (
                <div>
                  <label className="input-label">Custom Type</label>
                  <input
                    type="text"
                    value={newDeadline.customType}
                    onChange={(e) => setNewDeadline({ ...newDeadline, customType: e.target.value })}
                    className="input"
                    placeholder="Enter custom type..."
                  />
                </div>
              )}
              <div>
                <label className="input-label">Title / Description *</label>
                <input
                  type="text"
                  value={newDeadline.title}
                  onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
                  className="input"
                  placeholder="e.g., Assignment 1 Submission"
                  required
                />
              </div>
              <div className="grid-2" style={{ gap: '10px' }}>
                <div>
                  <label className="input-label">Date *</label>
                  <input
                    type="date"
                    value={newDeadline.dueDate}
                    onChange={(e) => setNewDeadline({ ...newDeadline, dueDate: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Time</label>
                  <input
                    type="time"
                    value={newDeadline.dueTime}
                    onChange={(e) => setNewDeadline({ ...newDeadline, dueTime: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="input-label">Priority</label>
                <select
                  value={newDeadline.priority}
                  onChange={(e) => setNewDeadline({ ...newDeadline, priority: e.target.value })}
                  className="input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary flex-1">Add to Deadline</button>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}