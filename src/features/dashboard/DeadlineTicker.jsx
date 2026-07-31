import { useState, useEffect } from 'react';
import { Hourglass, AlertTriangle, CalendarRange, Zap, Timer } from 'lucide-react';
import { deadlines } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';

export default function DeadlineTicker() {
  const { user } = useAuth();

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes hourglass-sand {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .deadline-hourglass svg { animation: hourglass-sand 4s ease-in-out infinite alternate; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const [timers, setTimers] = useState([]);
  const [calendarTasks, setCalendarTasks] = useState([]);

  // Get user's batch group (A1, A2, B1, B2, C1, C2)
  const userBatchGroup = (() => {
    if (user?.section && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(user.section.toUpperCase())) {
      return user.section.toUpperCase();
    }
    if (user?.labSection && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(user.labSection.toUpperCase())) {
      return user.labSection.toUpperCase();
    }
    if (user?.batchNo) {
      const batchNo = parseInt(user.batchNo);
      const batchGroupIndex = (batchNo - 52) % 6;
      const groups = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      return groups[batchGroupIndex >= 0 ? batchGroupIndex : 0];
    }
    return 'A1';
  })();

  useEffect(() => {
    // Load deadlines from localStorage or use empty array
    const stored = localStorage.getItem('aust-deadlines');
    const loadedDeadlines = stored ? JSON.parse(stored) : [...deadlines];
    setTimers(loadedDeadlines);

    // Load calendar tasks from localStorage
    const storedTasks = localStorage.getItem('aust-week-tasks');
    if (storedTasks) {
      setCalendarTasks(JSON.parse(storedTasks));
    }
  }, []);

  // Combine manual deadlines with calendar tasks for user's batch
  const combinedDeadlines = (() => {
    // Convert calendar tasks to deadline format (only for user's batch)
    const taskDeadlines = calendarTasks
      .filter(task => task.batchGroup === userBatchGroup)
      .filter(task => {
        const taskDate = new Date(task.date);
        if (task.time) {
          const [hours, minutes] = task.time.split(':');
          taskDate.setHours(parseInt(hours), parseInt(minutes), 0);
        } else {
          taskDate.setHours(23, 59, 59);
        }
        return taskDate.getTime() > Date.now(); // Only future tasks
      })
      .map(task => {
        const taskDate = new Date(task.date);
        if (task.time) {
          const [hours, minutes] = task.time.split(':');
          taskDate.setHours(parseInt(hours), parseInt(minutes), 0);
        } else {
          taskDate.setHours(23, 59, 59);
        }
        return {
          id: `task-${task.id}`,
          title: task.title,
          course: task.courseCode || task.courseName || 'General',
          dueDate: taskDate,
          type: 'Quiz',
          priority: 'medium',
          color: 'var(--accent-cyan)',
          fromCalendar: true,
          batchGroup: task.batchGroup
        };
      });

    // Combine with manual deadlines
    return [...timers, ...taskDeadlines];
  })();

  // State for live countdown display
  const [displayDeadlines, setDisplayDeadlines] = useState([]);

  useEffect(() => {
    if (combinedDeadlines.length === 0) {
      setDisplayDeadlines([]);
      return undefined;
    }

    const calculateTimeRemaining = () => {
      const updated = combinedDeadlines.map(dl => {
        const diff = dl.dueDate.getTime() - Date.now();
        
        if (diff <= 0) {
          return { ...dl, formatted: 'Passed', urgent: false };
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);

        let formatted = '';
        if (days > 0) formatted += `${days}d `;
        formatted += `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;

        const urgent = diff < 48 * 60 * 60 * 1000; // less than 48 hours

        return { ...dl, formatted, urgent };
      });

      // Sort by nearest deadline
      updated.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      setDisplayDeadlines(updated.slice(0, 4)); // Show top 4
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [combinedDeadlines.length, calendarTasks.length, timers.length]);

  const hasUrgent = displayDeadlines.some(dl => dl.urgent);

  return (
    <div className="glass-card-static deadline-ticker premium-card animate-fadeInUp">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'var(--accent-rose-glow)', color: 'var(--accent-rose)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Timer size={18} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasUrgent && (
            <div className="deadline-urgent-badge">
              <Zap size={12} />
              <span>URGENT</span>
            </div>
          )}
          <CalendarRange size={16} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayDeadlines.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <Hourglass size={20} style={{ opacity: 0.25 }} />
            <p style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>No upcoming deadlines</p>
          </div>
        ) : displayDeadlines.map(dl => {
          return (
            <div 
              key={dl.id}
              className="flex justify-between items-center p-3 premium-list-item"
              style={{
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid ${dl.urgent ? 'var(--accent-rose)' : dl.color}`,
                animation: dl.urgent ? 'countdownPulse 2s infinite' : 'none',
                transition: 'background 0.18s ease, transform 0.18s ease',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span style={{ fontSize: '10px', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)' }}>{dl.course}</span>
                  {dl.crGroup && (
                    <span className="badge badge-emerald" style={{ fontSize: '8px', padding: '1px 4px' }}>
                      {dl.crGroup}
                    </span>
                  )}
                  {dl.fromCalendar && (
                    <span className="badge badge-cyan" style={{ fontSize: '8px', padding: '1px 4px' }}>
                      {dl.batchGroup}
                    </span>
                  )}
                </div>
                <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dl.title}
                </h4>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span 
                  style={{ 
                    fontFamily: 'monospace', 
                    fontSize: 'var(--fs-sm)', 
                    fontWeight: 'var(--fw-semibold)',
                    color: dl.urgent ? 'var(--accent-rose)' : 'var(--text-primary)'
                  }}
                >
                  {dl.formatted}
                </span>
                {dl.urgent && (
                  <div className="flex items-center justify-end gap-1 text-rose mt-1" style={{ color: 'var(--accent-rose)', fontSize: '8px', fontWeight: 'bold' }}>
                    <AlertTriangle size={10} />
                    <span>URGENT</span>
                  </div>
                )}
                {dl.fromCalendar && (
                  <div style={{ fontSize: '8px', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                    Calendar
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
