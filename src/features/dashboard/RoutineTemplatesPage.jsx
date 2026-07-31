import { useState, useEffect, useMemo } from 'react';
import { useRoutine } from '../../context/RoutineContext';
import { loadTemplates } from '../../utils/routineTemplates';
import { loadSharedRoutines } from '../../utils/sharedRoutines';
import { getAllAccounts } from '../../utils/authStorage';
import {
  CalendarDays, Download, Search, Users, MapPin, Clock,
  BookOpen, GraduationCap, ChevronDown, ChevronRight,
  Star, Layers, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import './DashboardPage.css';

const DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
const SECTIONS = ['A', 'B', 'C'];
const LAB_SECTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function countClasses(routine) {
  if (!routine) return 0;
  let count = 0;
  for (const day of WEEKDAYS) count += (routine[day] || []).length;
  return count;
}

function getUniqueRooms(routine) {
  const rooms = new Set();
  if (!routine) return rooms;
  for (const day of WEEKDAYS)
    for (const cls of (routine[day] || []))
      if (cls.room) rooms.add(cls.room);
  return rooms;
}

function getDaysWithClasses(routine) {
  if (!routine) return 0;
  return WEEKDAYS.filter(d => (routine[d] || []).length > 0).length;
}

function formatSemester(sem) {
  if (!sem) return '';
  const s = String(sem);
  if (s.includes('-')) return s;
  const n = parseInt(s, 10);
  if (isNaN(n)) return s;
  return `${Math.ceil(n / 2)}-${n % 2 === 1 ? '1' : '2'}`;
}

export default function RoutineTemplatesPage() {
  const { replaceRoutine } = useRoutine();
  const [templates, setTemplates] = useState([]);
  const [sharedRoutines, setSharedRoutines] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [secFilter, setSecFilter] = useState('');
  const [labFilter, setLabFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => {
    setTemplates(loadTemplates());
    setSharedRoutines(loadSharedRoutines());
    setAllAccounts(getAllAccounts().filter(a => a.id !== 'guest'));
    setLoading(false);
  }, []);

  const crStats = useMemo(() => {
    const crs = allAccounts.filter(a => a.role === 'cr');
    const byDept = {};
    for (const cr of crs) {
      const d = cr.department || 'Unknown';
      if (!byDept[d]) byDept[d] = { total: 0, shared: 0 };
      byDept[d].total++;
    }
    for (const sr of sharedRoutines) {
      const d = sr.department || 'Unknown';
      if (!byDept[d]) byDept[d] = { total: 0, shared: 0 };
      byDept[d].shared++;
    }
    return { total: crs.length, shared: sharedRoutines.length, byDept };
  }, [allAccounts, sharedRoutines]);

  const mergedRoutines = useMemo(() => {
    const adminItems = templates.filter(t => t && t.routine).map(t => ({
      id: t.id, type: 'template', name: t.name || 'Routine Template',
      source: 'Admin Template', department: t.department || '',
      semester: t.semester || '', section: t.section || '', labSection: t.labSection || '',
      routine: t.routine, weekDays: t.weekDays || WEEKDAYS,
      studentName: '', studentId: '',
    }));
    const sharedItems = sharedRoutines.filter(r => r && r.routine).map(r => ({
      id: 'shared-' + (r.studentId || r.id), type: 'shared',
      name: r.studentName ? r.studentName + ' (' + (r.department || '') + ' Sem ' + (r.semester || '') + ')' : 'CR Routine',
      source: 'CR Shared', department: r.department || '',
      semester: String(r.semester || ''), section: r.section || '', labSection: r.labSection || '',
      routine: r.routine, weekDays: r.weekDays || WEEKDAYS,
      studentName: r.studentName || 'CR', studentId: r.studentId || '',
    }));
    const all = [...adminItems, ...sharedItems];
    return all.filter(item => {
      if (deptFilter && item.department !== deptFilter) return false;
      if (semFilter && item.semester !== semFilter) return false;
      if (secFilter && item.section !== secFilter) return false;
      if (labFilter && item.labSection !== labFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) &&
            !item.department.toLowerCase().includes(q) &&
            !item.studentName.toLowerCase().includes(q) &&
            ![...getUniqueRooms(item.routine)].some(r => r.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [templates, sharedRoutines, deptFilter, semFilter, secFilter, labFilter, searchQuery]);

  const handleLoadRoutine = (item) => replaceRoutine(item.routine, item.weekDays);

  const resetFilters = () => { setDeptFilter(''); setSemFilter(''); setSecFilter(''); setLabFilter(''); setSearchQuery(''); };

  const hasActiveFilters = deptFilter || semFilter || secFilter || labFilter || searchQuery;
  const totalCount = templates.length + sharedRoutines.length;

  if (loading) return (
    <div className="dashboard-page animate-fadeIn">
      <div className="page-loading"><span>Loading routines...</span></div>
    </div>
  );

  return (
    <div className="dashboard-page animate-fadeIn">
      <div className="dashboard-header-section">
        <h1 className="page-title"><CalendarDays size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Routine Templates</h1>
        <p className="page-description">Browse admin templates and CR-shared routines. Filter by department, semester, section, or lab group.</p>
      </div>

      <div className="rt-stats-bar">
        <div className="rt-stat"><Users size={14} /><span><strong>{crStats.total}</strong> CRs registered</span></div>
        <div className="rt-stat-divider" />
        <div className="rt-stat"><Layers size={14} /><span><strong>{crStats.shared}</strong> routines shared</span></div>
        <div className="rt-stat-divider" />
        <div className="rt-stat"><GraduationCap size={14} /><span><strong>{totalCount}</strong> total routines</span></div>
        <div className="rt-stat-divider" />
        <div className="rt-stat"><CheckCircle2 size={14} /><span><strong>{mergedRoutines.length}</strong> after filter</span></div>
        <div className="rt-dept-chips">
          {DEPARTMENTS.filter(d => crStats.byDept[d]).map(d => (
            <button key={d} className={'rt-dept-chip' + (deptFilter === d ? ' active' : '') + (crStats.byDept[d]?.shared > 0 ? ' has-data' : '')}
              onClick={() => setDeptFilter(deptFilter === d ? '' : d)}
              title={d + ': ' + (crStats.byDept[d]?.shared || 0) + '/' + (crStats.byDept[d]?.total || 0) + ' shared'}>
              <span className="rt-dept-label">{d}</span>
              <span className="rt-dept-count">{crStats.byDept[d]?.shared || 0}/{crStats.byDept[d]?.total || 0}</span>
            </button>
          ))}
        </div>
        {crStats.total === 0 && (
          <div className="rt-stats-warning"><AlertCircle size={12} /><span>No CR accounts registered. Use Dev Console (Ctrl+Shift+D) to generate test batches.</span></div>
        )}
      </div>

      <div className="rt-filter-bar">
        <div className="rt-filter-selects">
          <div className="rt-filter-field"><label>Dept</label>
            <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setSemFilter(''); setSecFilter(''); setLabFilter(''); }}>
              <option value="">All Depts</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="rt-filter-field"><label>Semester</label>
            <select value={semFilter} onChange={e => { setSemFilter(e.target.value); setSecFilter(''); setLabFilter(''); }} disabled={!deptFilter}>
              <option value="">All Sems</option>
              {deptFilter && [...new Set(mergedRoutines.filter(r => r.department === deptFilter && r.semester).map(r => r.semester))].sort().map(s =>
                <option key={s} value={s}>Sem {formatSemester(s)}</option>
              )}
            </select>
          </div>
          <div className="rt-filter-field"><label>Section</label>
            <select value={secFilter} onChange={e => { setSecFilter(e.target.value); setLabFilter(''); }} disabled={!semFilter}>
              <option value="">All Sections</option>
              {SECTIONS.map(s => <option key={s} value={s}>Sec {s}</option>)}
            </select>
          </div>
          <div className="rt-filter-field"><label>Lab</label>
            <select value={labFilter} onChange={e => setLabFilter(e.target.value)} disabled={!secFilter}>
              <option value="">All Labs</option>
              {LAB_SECTIONS.map(l => <option key={l} value={l}>Lab {l}</option>)}
            </select>
          </div>
        </div>
        <div className="rt-search-wrap">
          <Search size={13} className="rt-search-icon" />
          <input className="rt-search-input" type="text" placeholder="Search name, dept, room..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {hasActiveFilters && <button className="rt-reset-btn" onClick={resetFilters}><RefreshCw size={12} /> Reset</button>}
      </div>

      {mergedRoutines.length === 0 ? (
        <div className="glass-card-static" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <CalendarDays size={56} style={{ color: 'var(--text-tertiary)', opacity: 0.4, marginBottom: 16 }} />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: '0 0 8px' }}>{hasActiveFilters ? 'No matching routines' : 'No routines available'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', maxWidth: 420, margin: '0 auto' }}>
            {hasActiveFilters ? 'Try adjusting your filters or search query.' : 'No admin templates or CR-shared routines exist yet.'}
          </p>
          {hasActiveFilters && <button className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ marginTop: 16 }}>Clear Filters</button>}
        </div>
      ) : (
        <div className="rt-cards">
          {mergedRoutines.map((item, idx) => {
            const classCount = countClasses(item.routine);
            const uniqueRooms = getUniqueRooms(item.routine);
            const activeDays = getDaysWithClasses(item.routine);
            const isExpanded = expandedCard === idx;
            return (
              <div key={item.id + '-' + idx} className={'rt-card' + (isExpanded ? ' expanded' : '')}>
                <div className="rt-card-header">
                  <div className="rt-card-icon">{item.type === 'template' ? <BookOpen size={18} /> : <Star size={18} />}</div>
                  <div className="rt-card-info">
                    <div className="rt-card-title">{item.name}</div>
                    <div className="rt-card-meta">
                      {item.department && <span className="badge badge-blue" style={{fontSize:9,padding:'1px 6px'}}>{item.department}</span>}
                      {item.semester && <span className="badge badge-purple" style={{fontSize:9,padding:'1px 6px'}}>Sem {formatSemester(item.semester)}</span>}
                      {item.section && <span className="badge badge-amber" style={{fontSize:9,padding:'1px 6px'}}>Sec {item.section}</span>}
                      {item.labSection && <span className="badge badge-cyan" style={{fontSize:9,padding:'1px 6px'}}>Lab {item.labSection}</span>}
                      <span className="rt-card-source">{item.source}</span>
                      {item.studentName && <span className="rt-card-cr">by {item.studentName}</span>}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm rt-load-btn" onClick={() => handleLoadRoutine(item)} title="Load this routine">
                    <Download size={13} /> Load
                  </button>
                </div>
                <div className="rt-card-stats">
                  <span><CalendarDays size={11} /> {activeDays}/5 days</span>
                  <span><BookOpen size={11} /> {classCount} classes</span>
                  <span><MapPin size={11} /> {uniqueRooms.size} rooms</span>
                </div>
                <button className="rt-expand-btn" onClick={() => setExpandedCard(isExpanded ? null : idx)}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {isExpanded ? 'Hide details' : 'View details'}
                </button>
                {isExpanded && (
                  <div className="rt-routine-preview">
                    <table className="rt-routine-table">
                      <thead><tr><th>Day</th><th>Course</th><th>Time</th><th>Room</th><th>Type</th></tr></thead>
                      <tbody>
                        {WEEKDAYS.map(day => {
                          const dc = item.routine[day] || [];
                          if (dc.length === 0) return (
                            <tr key={day} className="rt-empty-row">
                              <td className="rt-day-cell">{day.slice(0,3)}</td>
                              <td colSpan={4} className="rt-empty-cell">No classes</td>
                            </tr>
                          );
                          return dc.map((cls, ci) => (
                            <tr key={day + '-' + ci}>
                              {ci === 0 && <td className="rt-day-cell" rowSpan={dc.length}>{day.slice(0,3)}</td>}
                              <td><div className="rt-course-code">{cls.course || cls.name}</div>{cls.name && cls.name !== cls.course && <div className="rt-course-name">{cls.name}</div>}</td>
                              <td className="rt-time-cell">{cls.time}</td>
                              <td className="rt-room-cell">{cls.room || '—'}</td>
                              <td>{cls.type && <span className={'rt-type-badge ' + cls.type}>{cls.type}</span>}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rt-legend">
        <span className="rt-legend-item"><BookOpen size={12} /> Admin Template</span>
        <span className="rt-legend-item"><Star size={12} /> CR Shared Routine</span>
        <span className="rt-legend-item" style={{ color: 'var(--text-tertiary)' }}>
          <Clock size={12} /> {mergedRoutines.length} routine{mergedRoutines.length !== 1 ? 's' : ''} shown
        </span>
      </div>
    </div>
  );
}