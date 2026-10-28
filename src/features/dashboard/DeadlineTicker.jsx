import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hourglass, AlertTriangle, Timer, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useUpcomingDeadlines from './useUpcomingDeadlines';

export default function DeadlineTicker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAddTask = user?.role === 'admin' || user?.role === 'cr';

  // Shared with the "At a glance" card so both show the same number.
  const { manualDeadlines, taskDeadlines, upcoming } = useUpcomingDeadlines();

  const combinedDeadlines = useMemo(
    () => [...manualDeadlines, ...taskDeadlines],
    [manualDeadlines, taskDeadlines],
  );

  // State for live countdown display
  const [displayDeadlines, setDisplayDeadlines] = useState([]);

  useEffect(() => {
    if (combinedDeadlines.length === 0) { setDisplayDeadlines([]); return undefined; }
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
    // Pause 1s tick when tab hidden
    if (typeof document !== 'undefined' && document.hidden) {
      const onVis = () => { if (!document.hidden) calculateTimeRemaining(); };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }
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
              {upcoming.length} upcoming · nearest first
            </span>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      <div className="deadline-list">
        {displayDeadlines.length === 0 ? (
          <div className="schedule-empty" style={{ padding: '12px 0', display:'flex', flexDirection:'column', gap:'10px', alignItems:'center' }}>
            <Hourglass size={16} style={{ opacity: 0.3 }} />
            <span>No upcoming deadlines</span>
            {canAddTask ? (
              <button className="btn btn-sm" onClick={() => navigate('/dashboard/semester-view')} style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                <CalendarDays size={14} /> Add in Semester View
              </button>
            ) : (
              <span style={{ fontSize:'11px', color:'var(--text-tertiary)' }}>Ask your CR to add tasks</span>
            )}
          </div>
        ) : displayDeadlines.map((dl, idx) => {
          return (
            <div
              key={dl.id}
              className={`schedule-day-card deadline-row${dl.urgent ? ' urgent' : ''}`}
              style={{ animationDelay: `${idx * 60}ms`, cursor: dl.fromCalendar ? 'pointer' : undefined }}
              role={dl.fromCalendar ? 'button' : undefined}
              tabIndex={dl.fromCalendar ? 0 : undefined}
              onClick={dl.fromCalendar ? () => navigate(`/dashboard/semester-view?date=${encodeURIComponent(dl.taskDate)}&task=${encodeURIComponent(dl.taskId)}`) : undefined}
              onKeyDown={dl.fromCalendar ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/dashboard/semester-view?date=${encodeURIComponent(dl.taskDate)}&task=${encodeURIComponent(dl.taskId)}`);
                }
              } : undefined}
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
