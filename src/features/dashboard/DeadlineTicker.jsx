import { useState, useEffect, useMemo } from 'react';
import { Hourglass, AlertTriangle, Timer } from 'lucide-react';
import { deadlines } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';

export default function DeadlineTicker() {
  const { user } = useAuth();
  // Get user's batch group (A1, A2, B1, B2, C1, C2, D1, D2)
  const userBatchGroup = (() => {
    if (user?.section && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].includes(user.section.toUpperCase())) {
      return user.section.toUpperCase();
    }
    if (user?.labSection && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].includes(user.labSection.toUpperCase())) {
      return user.labSection.toUpperCase();
    }
    if (user?.batchNo) {
      const batchNo = parseInt(user.batchNo);
      const batchGroupIndex = (batchNo - 52) % 8;
      const groups = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
      return groups[batchGroupIndex >= 0 ? batchGroupIndex : 0];
    }
    return 'A1';
  })();

  const [timers] = useState(() => {
    // Load deadlines from localStorage or use empty array
    const stored = localStorage.getItem('aust-deadlines');
    return stored ? JSON.parse(stored) : [...deadlines];
  });
  const [calendarTasks] = useState(() => {
    const stored = localStorage.getItem('aust-week-tasks');
    return stored ? JSON.parse(stored) : [];
  });

  // Combine manual deadlines with calendar tasks for user's batch.
  // Note: past-task filtering happens inside the countdown effect (where the
  // current time is available) so this derivation stays pure for render.
  const combinedDeadlines = useMemo(() => {
    // Convert calendar tasks to deadline format (only for user's batch)
    const taskDeadlines = calendarTasks
      .filter(task => task.batchGroup === userBatchGroup)
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
  }, [timers, calendarTasks, userBatchGroup]);

  // State for live countdown display
  const [displayDeadlines, setDisplayDeadlines] = useState([]);

  useEffect(() => {
    if (combinedDeadlines.length === 0) return undefined;

    const calculateTimeRemaining = () => {
      const nowTs = Date.now();
      const updated = combinedDeadlines
        .filter(dl => dl.dueDate.getTime() > nowTs) // Only future tasks
        .map(dl => {
          const diff = dl.dueDate.getTime() - nowTs;

          if (diff <= 0) {
            return { ...dl, formatted: 'Passed', urgent: false };
          }

          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          const secs = Math.floor((diff / 1000) % 60);

          // Cleaner countdown text — rounded days when possible, otherwise h/m.
          const formatted =
            days > 0 ? `${days} Day${days > 1 ? 's' : ''} Left`
              : hours > 0 ? `${hours}h ${mins}m Left`
                : mins > 0 ? `${mins}m Left`
                  : `${secs}s Left`;

          // Semantic priority: < 3 days = HIGH (danger), < 7 days = MEDIUM (warning).
          const priority = diff < 3 * 24 * 60 * 60 * 1000 ? 'high' : diff < 7 * 24 * 60 * 60 * 1000 ? 'medium' : 'low';
          const urgent = diff < 48 * 60 * 60 * 1000; // less than 48 hours

          return { ...dl, formatted, urgent, priority };
        });

      // Sort by nearest deadline
      updated.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      setDisplayDeadlines(updated.slice(0, 4)); // Show top 4
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [combinedDeadlines]);

  return (
    <div className="glass-card-static schedule-widget deadline-widget animate-fadeInUp">

      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Hourglass size={20} />
          </div>
          <div>
            <span className="schedule-overline">Live Countdown</span>
            <p className="schedule-title">Deadlines</p>
            <span className="schedule-subtitle">
              {displayDeadlines.length} upcoming · nearest first
            </span>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      <div className="deadline-list">
        {displayDeadlines.length === 0 ? (
          <div className="schedule-empty" style={{ padding: '2px 0 12px' }}>
            <Hourglass size={16} style={{ opacity: 0.3 }} />
            No upcoming deadlines
          </div>
        ) : displayDeadlines.map((dl, idx) => {
          return (
            <div
              key={dl.id}
              className={`schedule-day-card deadline-row${dl.urgent ? ' urgent' : ''}`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="deadline-timeline" />
              <div className="deadline-row-body">
                <div className="schedule-day-top">
                  <div className="schedule-day-num-wrap">
                    <div className="deadline-course">
                      {dl.course}
                    </div>
                  </div>
                  <div className="schedule-day-badges">
                    {dl.crGroup && <span className="deadline-tag cr">{dl.crGroup}</span>}
                    {dl.fromCalendar && <span className="deadline-tag cal">{dl.batchGroup}</span>}
                    {dl.priority === 'high' && (
                      <span className="deadline-tag prio-high"><AlertTriangle size={10} /> HIGH</span>
                    )}
                    {dl.priority === 'medium' && (
                      <span className="deadline-tag prio-medium">MEDIUM</span>
                    )}
                    {dl.urgent && (
                      <span className="deadline-tag urgent">URGENT</span>
                    )}
                  </div>
                </div>
                <div className="deadline-title">{dl.title}</div>
                <div className="deadline-meta">
                  <span className="deadline-countdown">
                    <Timer size={11} /> {dl.formatted}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
