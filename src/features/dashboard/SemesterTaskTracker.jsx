import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Search, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertTriangle, Users, ListChecks } from 'lucide-react';

// A CR slot is identified by the same (dept | year-semester | section | lab)
// key the server uses when storing shared routines.
const crSlotKey = (u) => `${u.department || ''}|${u.yearSemester || ''}|${u.section || ''}|${u.labSection || ''}`;
const isDevUserId = (u) => String(u.id || '').startsWith('DEV-');
const safeJson = (text) => {
  try { return JSON.parse(text); } catch { return null; }
};

export default function SemesterTaskTracker() {
  const [users, setUsers] = useState([]);
  const [taskRows, setTaskRows] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const [statusSearch, setStatusSearch] = useState('');
  const [statusDept, setStatusDept] = useState('all');
  const [statusSem, setStatusSem] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(new Set());

  const fetchTracker = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [usersData, tasksData] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'same-origin' }).then((r) => r.text()).then(safeJson),
        fetch('/api/admin/semester-tasks', { credentials: 'same-origin' }).then((r) => r.text()).then(safeJson),
      ]);
      if (!usersData || !usersData.success || !tasksData || !tasksData.success) {
        throw new Error('Failed to load semester task status. The server may need a restart for this tracker.');
      }
      setUsers(usersData.users || []);
      setTaskRows(tasksData.rows || []);
    } catch (e) {
      setStatusError(e.message || 'Failed to load semester task status.');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracker();
  }, [fetchTracker, statusRefreshKey]);

  const crUsers = useMemo(() => users.filter((u) => u.role === 'cr'), [users]);
  const studentUsers = useMemo(() => users.filter((u) => u.role === 'student'), [users]);

  // CR id → task count (authoritative from the admin endpoint)
  const taskCountByCr = useMemo(() => {
    const map = new Map();
    for (const row of taskRows) map.set(row.id, row.taskCount || 0);
    return map;
  }, [taskRows]);

  const rows = useMemo(() => {
    const bySlot = new Map();
    for (const u of crUsers) {
      const key = crSlotKey(u);
      if (!bySlot.has(key)) bySlot.set(key, { key, crs: [], students: [] });
      bySlot.get(key).crs.push(u);
    }
    for (const s of studentUsers) {
      const key = crSlotKey(s);
      if (!bySlot.has(key)) bySlot.set(key, { key, crs: [], students: [] });
      bySlot.get(key).students.push(s);
    }
    return [...bySlot.values()]
      .map(({ key, crs, students }) => {
        const realCr = crs.find((u) => !isDevUserId(u)) || crs[0] || null;
        const studentList = (students || []).sort((a, b) => a.name.localeCompare(b.name));
        const [department, yearSemester, section, labSection] = key.split('|');
        return {
          key,
          department,
          yearSemester,
          section,
          labSection,
          cr: realCr,
          taskCount: realCr ? (taskCountByCr.get(realCr.id) || 0) : 0,
          studentCount: studentList.length,
          studentList,
          missingCr: !realCr,
          orphan: !!realCr && studentList.length === 0,
        };
      })
      .sort(
        (a, b) =>
          a.yearSemester.localeCompare(b.yearSemester) ||
          a.department.localeCompare(b.department) ||
          a.section.localeCompare(b.section) ||
          a.labSection.localeCompare(b.labSection)
      );
  }, [crUsers, studentUsers, taskCountByCr]);

  const deptOptions = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows]
  );
  const semOptions = useMemo(
    () => [...new Set(rows.map((r) => r.yearSemester).filter(Boolean))].sort(),
    [rows]
  );

  const hasTasksCount = rows.filter((r) => r.taskCount > 0).length;
  const missingCrCount = rows.filter((r) => r.missingCr).length;
  const orphanCount = rows.filter((r) => r.orphan).length;

  const filteredRows = useMemo(() => {
    const q = statusSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusDept !== 'all' && r.department !== statusDept) return false;
      if (statusSem !== 'all' && r.yearSemester !== statusSem) return false;
      if (statusFilter === 'added' && r.taskCount === 0) return false;
      if (statusFilter === 'none' && r.taskCount > 0) return false;
      if (statusFilter === 'problems' && !r.missingCr && !r.orphan && r.taskCount === 0) return false;
      if (q) {
        const haystack = [
          r.cr && r.cr.name,
          r.department,
          r.yearSemester,
          r.section,
          r.labSection,
          r.cr && r.cr.awid,
          ...r.studentList.map((s) => s.name),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusSearch, statusDept, statusSem, statusFilter]);

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="glass-card-static" style={{ padding: '18px' }}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Semester Task Tracker{' '}
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
              ({rows.length} sections/lab groups)
            </span>
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Has every CR added their semester-view tasks? See the task count per CR and the students under each of them.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setStatusRefreshKey((k) => k + 1)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <span className="badge badge-blue">Total {rows.length}</span>
        <span className="badge badge-emerald">Tasks added {hasTasksCount}</span>
        <span className="badge badge-rose">No tasks {rows.length - hasTasksCount}</span>
        {missingCrCount > 0 && <span className="badge badge-rose" title="Slots that have students but no CR">No CR {missingCrCount}</span>}
        {orphanCount > 0 && <span className="badge badge-amber" title="CRs that have no students under them">No members {orphanCount}</span>}
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <div style={{ position: 'relative', maxWidth: '280px', width: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="input"
            placeholder="Search CR or student name, dept, section…"
            value={statusSearch}
            onChange={(e) => setStatusSearch(e.target.value)}
            style={{ paddingLeft: '30px' }}
          />
        </div>
        <select className="input" value={statusDept} onChange={(e) => setStatusDept(e.target.value)} style={{ maxWidth: '150px' }}>
          <option value="all">All Departments</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input" value={statusSem} onChange={(e) => setStatusSem(e.target.value)} style={{ maxWidth: '170px' }}>
          <option value="all">All Semesters</option>
          {semOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: '150px' }}>
          <option value="all">All statuses</option>
          <option value="added">Tasks added</option>
          <option value="none">No tasks</option>
          <option value="problems">Problems only</option>
        </select>
      </div>

      {statusLoading ? (
        <p style={{ color: 'var(--text-tertiary)' }}>Loading semester task status…</p>
      ) : statusError ? (
        <p style={{ color: 'var(--accent-rose)' }}>{statusError}</p>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-primary)' }}>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Semester</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Dept</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Sec</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Lab</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>CR</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Tasks</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Students</th>
                <th style={{ padding: '8px', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Nothing matches your filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => {
                  const showGroup = i === 0 || filteredRows[i - 1].yearSemester !== r.yearSemester;
                  const isOpen = expanded.has(r.key);
                  return (
                    <Fragment key={r.key}>
                      {showGroup && (
                        <tr style={{ background: 'var(--bg-input)' }}>
                          <td colSpan="8" style={{ padding: '6px 8px', fontWeight: 'bold', color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)' }}>
                            {r.yearSemester}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: '1px solid var(--border-secondary)', background: r.missingCr || r.orphan ? 'var(--accent-rose-glow)' : undefined }}>
                        <td style={{ padding: '8px', color: 'var(--text-tertiary)' }}>{r.yearSemester}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.department}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.section}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.labSection}</td>
                        <td style={{ padding: '8px' }}>
                          {r.missingCr ? (
                            <span style={{ color: 'var(--accent-rose)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> No CR
                            </span>
                          ) : (
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{r.cr.name}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px', color: r.taskCount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ListChecks size={12} /> {r.taskCount}
                          </span>
                        </td>
                        <td style={{ padding: '8px' }}>
                          {r.studentCount === 0 ? (
                            <span style={{ color: 'var(--accent-amber)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={12} /> 0
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleExpand(r.key)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                color: 'var(--accent-blue)', fontWeight: 'bold', fontSize: 'inherit',
                              }}
                            >
                              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              {r.studentCount} students
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          {r.taskCount > 0 ? (
                            <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Added
                            </span>
                          ) : (
                            <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <XCircle size={12} /> Not added
                            </span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: '1px solid var(--border-secondary)', background: 'var(--bg-input)' }}>
                          <td colSpan="8" style={{ padding: '8px 12px' }}>
                            {r.studentList.length === 0 ? (
                              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No students under this CR.</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {r.studentList.map((s) => (
                                  <span key={s.id} className="badge badge-blue" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}