import { useState, useEffect } from 'react';
import { Percent, Users, CalendarDays, AlertTriangle } from 'lucide-react';

export default function AdminAttendancePanel() {
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, avg: 0 });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 3000);
    (async () => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2500);
        const res = await fetch('/api/admin/attendance', { credentials: 'same-origin', signal: controller.signal });
        clearTimeout(t);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled && data.success && Array.isArray(data.records)) {
          setRecords(data.records.slice(0, 50));
          const total = data.records.length;
          const present = data.records.filter(r => (r.Attended ?? r.attended) === true || (r.Attended ?? r.attended) === 1 || (r.Attended ?? r.attended) === '1').length;
          const absent = total - present;
          const avg = total > 0 ? Math.round((present / total) * 100) : 0;
          setStats({ total, present, absent, avg });
          setError(null);
        }
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') {
          setError(e.message || 'Failed to load attendance');
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-card-static">
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Percent size={16} style={{ color: 'var(--accent-emerald)' }} /> Attendance — Admin Overview
        </h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Telegram attendance records (all users) — auto-synced via bot. Admin can monitor overall presence.
        </p>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)', fontSize: 'var(--fs-xs)', marginBottom: '12px' }}>
            {error} — check server logs or login as admin/moderator
          </div>
        )}
        {loading && (
          <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '8px' }}>Loading attendance…</div>
        )}
        <div className="grid-4 mb-4" style={{ gap: '12px' }}>
              <div className="glass-card stat-card">
                <div className="flex justify-between items-center">
                  <span className="stat-label" style={{ fontSize: '10px' }}>Total Records</span>
                  <CalendarDays size={14} style={{ color: 'var(--accent-blue)' }} />
                </div>
                <span className="stat-value" style={{ fontSize: '22px' }}>{stats?.total ?? 0}</span>
                <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>all time</span>
              </div>
              <div className="glass-card stat-card">
                <div className="flex justify-between items-center">
                  <span className="stat-label" style={{ fontSize: '10px' }}>Present</span>
                  <Users size={14} style={{ color: 'var(--accent-emerald)' }} />
                </div>
                <span className="stat-value" style={{ fontSize: '22px', color: 'var(--accent-emerald)' }}>{stats?.present ?? 0}</span>
                <span className="stat-change positive">{stats?.avg ?? 0}% avg</span>
              </div>
              <div className="glass-card stat-card">
                <div className="flex justify-between items-center">
                  <span className="stat-label" style={{ fontSize: '10px' }}>Absent</span>
                  <AlertTriangle size={14} style={{ color: 'var(--accent-rose)' }} />
                </div>
                <span className="stat-value" style={{ fontSize: '22px', color: 'var(--accent-rose)' }}>{stats?.absent ?? 0}</span>
                <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>missed</span>
              </div>
              <div className="glass-card stat-card">
                <div className="flex justify-between items-center">
                  <span className="stat-label" style={{ fontSize: '10px' }}>Avg Attendance</span>
                  <Percent size={14} style={{ color: 'var(--accent-amber)' }} />
                </div>
                <span className="stat-value" style={{ fontSize: '22px' }}>{stats?.avg ?? 0}%</span>
                <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>{(stats?.avg ?? 0) >= 75 ? 'healthy' : 'at risk'}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
              <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', marginBottom: '8px' }}>Recent Records (last 50)</h4>
              {records.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
                  No attendance records yet. Telegram bot will populate this when students respond.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                  {records.map((r, i) => {
                    const course = r.CourseCode || r.courseCode || r.course || '—';
                    const date = (r.RecordDate || r.recordDate || '').split('T')[0] || '—';
                    const attended = (r.Attended ?? r.attended) === true || (r.Attended ?? r.attended) === 1;
                    const student = r.ChatId || r.chatId || r.studentId || `Record #${i+1}`;
                    return (
                      <div key={i} className="flex justify-between items-center p-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-xs)' }}>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${attended ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{attended ? 'Present' : 'Absent'}</span>
                          <span style={{ fontWeight: 'bold' }}>{course}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>{date}</span>
                        </div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{String(student).slice(0, 24)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
      </div>
    </div>
  );
}
