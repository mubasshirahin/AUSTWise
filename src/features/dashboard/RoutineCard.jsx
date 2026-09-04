import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, User, ChevronLeft, ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { useRoutine } from '../../context/RoutineContext';
import { normalizeAccentColor } from '../../utils/colorPalette';

// Parse time string like "08:00 - 08:50" or "08:00 AM - 08:50 AM" to minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  
  // Extract start time from the time range
  const parts = timeStr.split('-');
  const timePart = parts[0].trim();
  
  // Try to parse as 12-hour format first (e.g., "08:00 AM")
  const match12 = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    
    return hour * 60 + minute;
  }
  
  // Try 24-hour format (e.g., "08:00")
  const match24 = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    return hour * 60 + minute;
  }
  
  return null;
}

// Get end time from time string like "08:00 - 08:50"
function parseEndTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  
  const parts = timeStr.split('-');
  if (parts.length < 2) return null;
  
  const timePart = parts[1].trim();
  
  // Try to parse as 12-hour format first (e.g., "08:50 AM")
  const match12 = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    
    return hour * 60 + minute;
  }
  
  // Try 24-hour format (e.g., "08:50")
  const match24 = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    return hour * 60 + minute;
  }
  
  return null;
}

export default function RoutineCard() {
  const { routine, weekDays, isLoading } = useRoutine();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(weekDays[0] || 'Saturday');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time aligned to the next minute edge (no 59s drift)
  useEffect(() => {
    let timer;
    const schedule = () => {
      const now = new Date();
      const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      timer = setTimeout(() => {
        setCurrentTime(new Date());
        timer = setInterval(() => setCurrentTime(new Date()), 60000);
      }, msToNextMinute);
    };
    schedule();
    return () => clearTimeout(timer) || clearInterval(timer);
  }, []);

  useEffect(() => {
    if (weekDays && weekDays.length > 0 && !weekDays.includes(selectedDay)) {
      setSelectedDay(weekDays[0]);
    }
  }, [weekDays, selectedDay]);

  const goPrev = () => {
    const i = (weekDays.indexOf(selectedDay) - 1 + weekDays.length) % weekDays.length;
    setSelectedDay(weekDays[i]);
  };
  const goNext = () => {
    const i = (weekDays.indexOf(selectedDay) + 1) % weekDays.length;
    setSelectedDay(weekDays[i]);
  };

  const classesForDay = useMemo(() => {
    return routine[selectedDay] || [];
  }, [selectedDay, routine]);

  // Calculate which class is "NOW" and which is "NEXT" based on actual time
  const { nowIndex, nextIndex } = useMemo(() => {
    let nowIdx = -1;
    let nextIdx = -1;

    // Only show NOW/NEXT when viewing the actual current weekday (locale-aware)
    const todayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    if (selectedDay !== todayName) {
      return { nowIndex: -1, nextIndex: -1 };
    }
    
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    // Find the class that is currently ongoing or about to start (within 1 hour)
    for (let i = 0; i < classesForDay.length; i++) {
      const cls = classesForDay[i];
      const startMinutes = parseTimeToMinutes(cls.time);
      const endMinutes = parseEndTimeToMinutes(cls.time);
      
      if (startMinutes === null || endMinutes === null) continue;
      
      // Check if class is currently ongoing
      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        nowIdx = i;
        // Next class is the one after this
        if (i + 1 < classesForDay.length) {
          nextIdx = i + 1;
        }
        break;
      }
      
      // Check if class is upcoming (hasn't started yet but will start today)
      if (currentMinutes < startMinutes && nowIdx === -1) {
        // Check if we're within 1 hour of the class start
        if (startMinutes - currentMinutes <= 60) {
          // If the previous class has already ended, this is "NOW" (upcoming within 1 hour)
          if (i === 0) {
            // First class of the day, within 1 hour
            nowIdx = i;
            if (i + 1 < classesForDay.length) {
              nextIdx = i + 1;
            }
            break;
          } else {
            // Check if previous class has ended
            const prevEnd = parseEndTimeToMinutes(classesForDay[i - 1].time);
            if (prevEnd === null || currentMinutes > prevEnd) {
              nowIdx = i;
              if (i + 1 < classesForDay.length) {
                nextIdx = i + 1;
              }
              break;
            }
          }
        } else {
          // This is a future class, mark as next if no next found yet
          if (nextIdx === -1) {
            nextIdx = i;
          }
        }
      }
    }
    
    // If no "NOW" class found but we have a "NEXT", check if we should show NEXT
    // If all classes for today have ended, don't show NOW or NEXT
    if (nowIdx === -1 && nextIdx !== -1) {
      // Check if the next class is still in the future
      const nextClass = classesForDay[nextIdx];
      const nextStart = parseTimeToMinutes(nextClass.time);
      if (nextStart !== null && currentMinutes > nextStart + 60) {
        // The next class start time has passed by more than an hour, hide it
        nextIdx = -1;
      }
    }
    
    return { nowIndex: nowIdx, nextIndex: nextIdx };
  }, [selectedDay, weekDays, classesForDay, currentTime]);

  return (
    <div className="glass-card-static schedule-widget routine-widget animate-fadeInUp">

      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <CalendarDays size={20} />
          </div>
          <div>
            <span className="schedule-overline">Today's Schedule</span>
            <p className="schedule-title">Daily Flow</p>
            <span className="schedule-subtitle">
              {selectedDay}
            </span>
          </div>
          <div className="schedule-stat">
            <span className="schedule-stat-value">{classesForDay.length}</span>
            <span className="schedule-stat-label">classes</span>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="schedule-week-nav">
            <button className="schedule-nav-btn" onClick={goPrev} aria-label="Previous day">
              <ChevronLeft size={20} />
            </button>
            <div className="schedule-week-pill">
              <span className="schedule-week-pill-value">{selectedDay}</span>
            </div>
            <button className="schedule-nav-btn" onClick={goNext} aria-label="Next day">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      <div className="routine-list">
        {isLoading ? (
          <div className="routine-skeleton">
            {[0,1,2].map(i => (
              <div key={i} className="schedule-day-card routine-class-row skeleton-row" style={{ animationDelay: `${i*80}ms` }}>
                <div className="skeleton-line skeleton-line--short" />
                <div className="skeleton-line skeleton-line--mid" />
                <div className="skeleton-line skeleton-line--full" />
              </div>
            ))}
          </div>
        ) : classesForDay.length === 0 ? (
          <div className="schedule-empty" style={{ padding: '28px 0', display:'flex', flexDirection:'column', gap:'12px', alignItems:'center' }}>
            <span>No classes scheduled for {selectedDay}</span>
            <button className="btn btn-sm" onClick={() => navigate('/?tab=routine')} style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
              <Plus size={14} /> Add in Weekly Planner
            </button>
            <span style={{ fontSize:'11px', color:'var(--text-tertiary)' }}>Or load a shared routine via <b>Load Routine</b> in Weekly Planner</span>
          </div>
        ) : (
          classesForDay.map((cls, idx) => {
            const isNow = idx === nowIndex;
            const isNext = idx === nextIndex;
            const accentColor = normalizeAccentColor(cls.color);
            const hasValidTime = parseTimeToMinutes(cls.time) !== null && parseEndTimeToMinutes(cls.time) !== null;

            return (
              <div
                key={cls.id}
                className="schedule-day-card routine-class-row"
                style={{
                  borderLeft: `2px solid ${accentColor}`,
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                <div className="schedule-day-top">
                  <div className="schedule-day-num-wrap">
                    <div className="routine-class-code">
                      {cls.course}
                      {cls.biWeekly && <span className="routine-biweekly">*</span>}
                    </div>
                  </div>
                  <div className="schedule-day-badges">
                    {isNow && <span className="routine-status-badge now">NOW</span>}
                    {isNext && <span className="routine-status-badge next">NEXT</span>}
                  </div>
                </div>
                <div className="routine-class-name">
                  <span className="routine-class-name-text">{cls.name}</span>
                  <span className={`routine-type-badge ${cls.type === 'Lab' ? 'lab' : 'theory'}`}>{cls.type}</span>
                </div>
                <div className="routine-class-meta">
                  <span>
                    <Clock size={11} /> {cls.time}
                    {!hasValidTime && <AlertTriangle size={11} style={{ marginLeft: 4, color: 'var(--accent-amber)' }} title="Invalid time format" />}
                  </span>
                  <span><MapPin size={11} /> Room {cls.room}</span>
                  <span><User size={11} /> {cls.teacher}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
