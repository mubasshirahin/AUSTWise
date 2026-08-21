import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, ShieldCheck, Wifi } from 'lucide-react';
import { onLiveChange, getLiveStoreStatus } from '../../utils/liveStore';

const EXAM_SHARED_PREFIX = 'aust-exam-schedule:';
const PROBE_KEY = `${EXAM_SHARED_PREFIX}__flow-probe__`;
const EDITOR_ROLES = ['admin', 'moderator', 'cr', 'sr'];
const slotKeyOf = (u) => `${u?.department || ''}|${u?.yearSemester || ''}|${u?.section || ''}|${u?.labSection || ''}`;
const safeJson = (text) => { try { return JSON.parse(text); } catch { return null; } };

function Result({ status, children }) {
  const map = {
    pass: { cls: 'badge-emerald', Icon: CheckCircle2 },
    fail: { cls: 'badge-rose', Icon: XCircle },
    warn: { cls: 'badge-amber', Icon: AlertTriangle },
  };
  const { cls, Icon } = map[status] || map.warn;
  return (
    <span className={`badge ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <Icon size={12} /> {children}
    </span>
  );
}

export default function ExamFlowTracker({ user, canEdit }) {
  const [rows, setRows] = useState([]);
  const [crGroups, setCrGroups] = useState(null);
  const [probe, setProbe] = useState(null); // { writeMs, deleteMs, readMs }
  const [live, setLive] = useState(getLiveStoreStatus());
  const [lastEventAt, setLastEventAt] = useState(null);
  const [running, setRunning] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Real-time channel heartbeat + remote change feed
  useEffect(() => {
    const t = setInterval(() => setLive(getLiveStoreStatus()), 3000);
    const off = onLiveChange((key, isLocal) => {
      if (!isLocal && String(key).startsWith(EXAM_SHARED_PREFIX)) {
        setLastEventAt(new Date());
        setLive(getLiveStoreStatus());
      }
    });
    return () => { clearInterval(t); off(); };
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    const checks = [];

    // 1. Role policy gate (client UI)
    const expectedEdit = EDITOR_ROLES.includes(user?.role);
    checks.push({
      name: 'Role detection & UI access',
      detail: `Signed in as "${user?.role || 'unknown'}" → expected ${expectedEdit ? 'edit' : 'view-only'} access`,
      status: canEdit === expectedEdit ? 'pass' : 'fail',
    });

    // 2. Server read probe — everyone must be able to READ the shared schedule
    const readKey = encodeURIComponent(`${EXAM_SHARED_PREFIX}${slotKeyOf(user)}`);
    let readMs = null;
    try {
      const t0 = performance.now();
      const data = await fetch(`/api/store/shared/${readKey}`, { credentials: 'same-origin' }).then((r) => r.json());
      readMs = Math.round(performance.now() - t0);
      checks.push({
        name: 'Shared schedule read access',
        detail: data?.success ? `Section schedule fetched in ${readMs}ms (${data.value ? Object.keys(data.value).filter((k) => k !== '_meta').length : 0} courses)` : 'No schedule published yet for your section slot',
        status: data?.success ? 'pass' : 'warn',
      });
    } catch {
      checks.push({ name: 'Shared schedule read access', detail: 'Request failed', status: 'fail' });
    }

    // 3. Server write-enforcement probe (harmless key, cleaned up after)
    let writeMs = null;
    try {
      const t0 = performance.now();
      const res = await fetch(`/api/store/shared/${encodeURIComponent(PROBE_KEY)}`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { probe: true } }),
      });
      writeMs = Math.round(performance.now() - t0);
      if (canEdit && res.ok) {
        checks.push({
          name: 'Server write permission (live probe)',
          detail: `Editor write accepted in ${writeMs}ms · student writes are rejected with 403 by the server rule`,
          status: 'pass',
        });
      } else if (!canEdit && res.status === 403) {
        checks.push({ name: 'Server write permission (live probe)', detail: 'View-only correctly enforced server-side (403)', status: 'pass' });
      } else {
        checks.push({ name: 'Server write permission (live probe)', detail: `Unexpected response HTTP ${res.status}`, status: 'fail' });
      }
      await fetch(`/api/store/shared/${encodeURIComponent(PROBE_KEY)}`, { method: 'DELETE', credentials: 'same-origin' });
    } catch {
      checks.push({ name: 'Server write permission (live probe)', detail: 'Probe failed to reach server', status: 'fail' });
    }

    // 4. CR coverage — every section slot needs exactly the right people
    try {
      const usersData = await fetch('/api/admin/users', { credentials: 'same-origin' }).then((r) => r.text()).then(safeJson);
      if (usersData?.success) {
        const accounts = usersData.users || [];
        const crs = accounts.filter((u) => u.role === 'cr');
        const students = accounts.filter((u) => u.role === 'student');
        const slots = new Map();
        for (const c of crs) {
          const k = slotKeyOf(c);
          if (!slots.has(k)) slots.set(k, { crs: [], students: 0 });
          slots.get(k).crs.push(c);
        }
        for (const s of students) {
          const k = slotKeyOf(s);
          if (!slots.has(k)) slots.set(k, { crs: [], students: 0 });
          slots.get(k).students += 1;
        }
        const groupList = [...slots.entries()].map(([key, v]) => ({ key, ...v }));
        setCrGroups(groupList);
        const noCr = groupList.filter((g) => g.crs.length === 0).length;
        checks.push({
          name: 'CR edit-option coverage',
          detail: `${crs.length} CRs have update rights across ${groupList.length} section groups · ${noCr === 0 ? 'every student group has a CR' : `${noCr} group(s) have NO CR — nobody can update their exams`}`,
          status: crs.length > 0 && noCr === 0 ? 'pass' : crs.length > 0 ? 'warn' : 'fail',
        });

        // 5. Student view-only population
        const coveredStudents = students.filter((s) => slots.has(slotKeyOf(s)) && slots.get(slotKeyOf(s)).crs.length > 0).length;
        checks.push({
          name: 'Student view-only propagation',
          detail: `${coveredStudents}/${students.length} students are grouped under a CR and receive the shared schedule read-only`,
          status: students.length === 0 ? 'warn' : coveredStudents === students.length ? 'pass' : 'warn',
        });
      } else {
        checks.push({ name: 'CR edit-option coverage', detail: 'Could not load user directory', status: 'warn' });
      }
    } catch {
      checks.push({ name: 'CR edit-option coverage', detail: 'User directory unreachable', status: 'warn' });
    }

    setRows(checks);
    setRunning(false);
  }, [user, canEdit]);

  useEffect(() => { runChecks(); }, [runChecks]);

  const overall = useMemo(() => {
    if (rows.some((r) => r.status === 'fail')) return 'fail';
    if (rows.length === 0 || rows.some((r) => r.status === 'warn')) return 'warn';
    return 'pass';
  }, [rows]);

  return (
    <div className="exam-flow-tracker">
      <div className="exam-flow-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={15} style={{ color: 'var(--accent-blue)' }} />
          <strong style={{ fontSize: 'var(--fs-sm)' }}>System Flow Tracker</strong>
          <Result status={overall}>
            {overall === 'pass' ? 'All systems working' : overall === 'warn' ? 'Working with warnings' : 'Failure detected'}
          </Result>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={runChecks} disabled={running}>
          <RefreshCw size={13} className={running ? 'spin' : ''} /> Re-run checks
        </button>
      </div>

      <div className="exam-flow-live">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Wifi size={12} /> Real-time channel:
          <span className={`badge ${live.connected ? 'badge-emerald' : 'badge-amber'}`}>
            {live.state}
          </span>
        </span>
        <span>
          Last shared-schedule event:{' '}
          {lastEventAt ? lastEventAt.toLocaleTimeString() : 'none yet this session'}
        </span>
      </div>

      <ul className="exam-flow-checks">
        {rows.map((r) => (
          <li key={r.name}>
            <Result status={r.status} />
            <div>
              <strong>{r.name}</strong>
              <span>{r.detail}</span>
            </div>
          </li>
        ))}
        {rows.length === 0 && running && <li style={{ color: 'var(--text-tertiary)' }}>Running live checks…</li>}
      </ul>

      {crGroups && (
        <details className="exam-flow-groups">
          <summary>Section-by-section CR coverage ({crGroups.length} groups)</summary>
          <div className="exam-flow-group-grid">
            {crGroups.sort((a, b) => a.key.localeCompare(b.key)).map((g) => (
              <div key={g.key} className={`exam-flow-group ${g.crs.length === 0 ? 'problem' : ''}`}>
                <span className="exam-flow-group-key">{g.key.split('|').filter(Boolean).join(' · ') || 'no profile info'}</span>
                {g.crs.length > 0 ? (
                  <span className="badge badge-emerald">
                    <ShieldCheck size={11} /> {g.crs.map((c) => c.name).join(', ')} can edit
                  </span>
                ) : (
                  <span className="badge badge-rose"><AlertTriangle size={11} /> No CR</span>
                )}
                <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{g.students} viewer{g.students === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
