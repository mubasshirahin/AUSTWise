import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck, LayoutGrid, Route, Workflow, Users, FlaskConical, Bug, Rocket, ExternalLink,
  ChevronLeft, ChevronRight, Check, X, Minus, MessageSquare, Play, Square, Download, Upload,
  RotateCcw, MoreVertical, Search, Plus, Trash2, Pencil, Copy, CheckCircle2, XCircle, AlertCircle,
  MinusCircle, Loader2, Terminal, ShieldCheck, ChevronDown, Shield, LayoutDashboard, Home,
  BarChart3, MapPin, BookOpen, FileSearch, Zap, ShoppingBag, Coffee, Moon, Settings, Crown,
  Globe, Link2, Layers,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import '../../daily-life/DailyMasthead.css';
import './QAChecklistPage.css';
import useQaState from './useQaState';
import {
  GROUPS, ITEM_KINDS, PAGE_TYPES, PER_PAGE_BASICS, USER_FLOWS, MATRIX_ROLES, MATRIX_ROWS, GO_LIVE,
  withCustom,
} from './qaData';
import { AUTO_TESTS, CLI_COMMANDS, DEVICES, IS_DEV, closeProbe } from './qaAutoTests';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tour', label: 'Page tour', icon: Route },
  { id: 'flows', label: 'User flows', icon: Workflow },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'auto', label: 'Auto tests', icon: FlaskConical },
  { id: 'bugs', label: 'Bugs', icon: Bug },
  { id: 'golive', label: 'Go-live', icon: Rocket },
];

// Same icons as the app sidebar, so each tour section reads like its nav link.
const GROUP_ICONS = {
  start: ClipboardCheck, public: Globe, admin: Shield, dashboard: LayoutDashboard, dailylife: Home,
  gradelab: BarChart3, insideaust: MapPin, vault: BookOpen, qbank: FileSearch, community: Users,
  connectbox: MessageSquare, productivity: Zap, marketplace: ShoppingBag, downtime: Coffee,
  shadow: Moon, settings: Settings, plans: Crown, designdocs: Workflow, hidden: Link2, cross: Layers,
};

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const BUG_STATUS = ['Open', 'In progress', 'Fixed', "Won't fix"];
const nowMs = () => Date.now();
const isOpenBug = (b) => b.status === 'Open' || b.status === 'In progress';

// ── keys + progress ─────────────────────────────────────────────────────────

const basicKey = (pageId, i) => `${pageId}:basic:${i}`;
const flowKey = (flowId, i) => `${flowId}:${i}`;
const goKey = (id) => `go:${id}`;

function pageKeys(p) {
  const keys = p.items.map((i) => i.id);
  if (!p.noBasics) PER_PAGE_BASICS.forEach((_, i) => keys.push(basicKey(p.id, i)));
  return keys;
}

function tally(keys, marks) {
  let pass = 0; let fail = 0; let na = 0;
  keys.forEach((k) => {
    if (marks[k] === 'pass') pass += 1;
    else if (marks[k] === 'fail') fail += 1;
    else if (marks[k] === 'na') na += 1;
  });
  const total = keys.length;
  const doneCount = pass + na;
  return { pass, fail, na, total, done: doneCount, left: total - doneCount - fail, pct: total ? Math.round((doneCount / total) * 100) : 0 };
}

const plain = (text) => text.replace(/\*\*|`/g, '');

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'ekhoni';
  if (s < 3600) return `${Math.round(s / 60)} min age`;
  if (s < 86400) return `${Math.round(s / 3600)} ghonta age`;
  return new Date(ts).toLocaleDateString();
}

// `code` and **bold** only — rendered as elements, never as HTML.
function Rich({ text }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function StatusIcon({ status, size = 14 }) {
  if (status === 'pass') return <CheckCircle2 size={size} className="qa-ic is-pass" />;
  if (status === 'fail') return <XCircle size={size} className="qa-ic is-fail" />;
  if (status === 'warn') return <AlertCircle size={size} className="qa-ic is-warn" />;
  if (status === 'running') return <Loader2 size={size} className="qa-ic is-run qa-spin" />;
  return <MinusCircle size={size} className="qa-ic is-skip" />;
}

function Bar({ pct, bad }) {
  return <span className="qa-bar"><i style={{ width: `${pct}%`, background: bad ? 'var(--accent-rose)' : 'var(--accent-amber)' }} /></span>;
}

// ── one checklist row ───────────────────────────────────────────────────────

function ItemRow({ id, text, mark, note, onMark, onNote, onBug, onEdit, onDelete }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const set = (value) => onMark(id, mark === value ? null : value);
  const showNote = noteOpen || (mark === 'fail' && !note && noteOpen !== false);
  return (
    <div className={`qa-item is-${mark || 'open'}`}>
      <button type="button" className="qa-check" aria-pressed={mark === 'pass'} aria-label={mark === 'pass' ? 'Pass untick' : 'Pass'} onClick={() => set('pass')}>
        {mark === 'pass' && <Check size={13} strokeWidth={3} />}
        {mark === 'na' && <Minus size={13} strokeWidth={3} />}
        {mark === 'fail' && <X size={13} strokeWidth={3} />}
      </button>
      <div className="qa-item-body">
        <span className="qa-item-text"><Rich text={text} /></span>
        {note && !noteOpen && <button type="button" className="qa-item-note" onClick={() => setNoteOpen(true)}>{note}</button>}
      </div>
      <div className="qa-item-acts">
        <button type="button" title="Fail" aria-label="Fail" data-on={mark === 'fail' || undefined} className="is-fail" onClick={() => { set('fail'); if (mark !== 'fail') setNoteOpen(true); }}><X size={13} /></button>
        <button type="button" title="N/A (ei page e lage na)" aria-label="Not applicable" data-on={mark === 'na' || undefined} onClick={() => set('na')}><Minus size={13} /></button>
        <button type="button" title="Note" aria-label="Note" data-on={noteOpen || undefined} onClick={() => setNoteOpen((o) => !o)}><MessageSquare size={12} /></button>
        {onBug && <button type="button" title="Bug log e tolo" aria-label="Add to bug log" onClick={() => onBug(id, text)}><Bug size={12} /></button>}
        {onEdit && <button type="button" title="Edit" aria-label="Edit item" onClick={onEdit}><Pencil size={12} /></button>}
        {onDelete && <button type="button" title="Delete" aria-label="Delete item" className="is-fail" onClick={onDelete}><Trash2 size={12} /></button>}
      </div>
      {showNote && (
        <textarea
          className="input qa-note-input"
          placeholder="Ki dekhla? (bug hole steps likho)"
          value={note || ''}
          autoFocus
          onChange={(e) => onNote(id, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setNoteOpen(false); }}
        />
      )}
    </div>
  );
}

// ── admin add / edit panels ─────────────────────────────────────────────────

function CustomItemForm({ title, initial, onSave, onCancel }) {
  const [kind, setKind] = useState(initial?.kind || 'flow');
  const [text, setText] = useState(initial?.text || '');
  const save = () => { if (text.trim()) onSave({ kind, text: text.trim().slice(0, 400) }); };
  return (
    <div className="qa-pop qa-custom-form" role="group" aria-label={title}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
      <span className="qa-pop-title">{initial ? <Pencil size={11} /> : <Plus size={11} />} {title}</span>
      <div className="qa-pop-row">
        <select className="input qa-pop-input is-kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Item type">
          {Object.entries(ITEM_KINDS).map(([id, k]) => <option key={id} value={id}>{k.label}</option>)}
        </select>
        <input className="input qa-pop-input is-title is-text" placeholder="Ki check korte hobe? (`code`, **bold** chole)" value={text} autoFocus
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      </div>
      <div className="qa-pop-actions">
        <button type="button" className="qa-btn is-primary is-small" disabled={!text.trim()} onClick={save}><Check size={12} /> {initial ? 'Save' : 'Add'}</button>
        <button type="button" className="qa-btn is-small is-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function CustomPageForm({ groupId, onSave, onCancel }) {
  const [group, setGroup] = useState(groupId);
  const [type, setType] = useState('tab');
  const [title, setTitle] = useState('');
  const [route, setRoute] = useState('');
  const save = () => {
    if (!title.trim()) return;
    const r = route.trim();
    onSave({ group, type, title: title.trim().slice(0, 80), route: r ? (r.startsWith('/') ? r : `/${r}`).slice(0, 200) : null });
  };
  return (
    <div className="qa-pop qa-custom-form" role="group" aria-label="Add page"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
      <span className="qa-pop-title"><Plus size={11} /> Notun page / tab</span>
      <input className="input qa-pop-input is-title" placeholder="Nam (e.g. Exam Planner)" value={title} autoFocus
        onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      <div className="qa-pop-row">
        <select className="input qa-pop-input" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Section">
          {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <select className="input qa-pop-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="tab">Tab</option>
          <option value="page">Onno page</option>
        </select>
      </div>
      <input className="input qa-pop-input" placeholder="Route (optional, e.g. /daily-life?tab=exam)" value={route}
        onChange={(e) => setRoute(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      <div className="qa-pop-actions">
        <button type="button" className="qa-btn is-primary is-small" disabled={!title.trim()} onClick={save}><Check size={12} /> Add</button>
        <button type="button" className="qa-btn is-small is-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── main page ───────────────────────────────────────────────────────────────

export default function QAChecklistPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth() || {};
  const isAdmin = !!hasRole?.('admin');
  const { state, update, replace, sync } = useQaState();
  const pages = useMemo(() => withCustom(state.custom), [state.custom]);
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const pageId = pages.some((p) => p.id === params.get('page')) ? params.get('page') : pages[0].id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const menuRef = useRef(null);
  const fileRef = useRef(null);

  const go = (nextTab, extra = {}) => {
    const next = new URLSearchParams(params);
    next.set('tab', nextTab);
    Object.entries(extra).forEach(([k, v]) => next.set(k, v));
    setParams(next, { replace: false });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => () => closeProbe(), []);

  const { marks, notes, matrix, bugs, auto } = state;

  const mark = (id, value) => update((s) => {
    const nextMarks = { ...s.marks };
    if (value) nextMarks[id] = value; else delete nextMarks[id];
    return { ...s, marks: nextMarks };
  });
  const setNote = (id, value) => update((s) => {
    const nextNotes = { ...s.notes };
    if (value) nextNotes[id] = value; else delete nextNotes[id];
    return { ...s, notes: nextNotes };
  });
  const addBug = (bug) => update((s) => ({ ...s, bugs: [...s.bugs, { id: `bug-${Date.now()}`, status: 'Open', severity: 'Medium', createdAt: Date.now(), ...bug }] }));

  // ── admin's own checklist additions ───────────────────────────────────────
  const withCustomState = (s, fn) => {
    const cur = { pages: [], items: [], ...(s.custom || {}) };
    return { ...s, custom: fn(cur) };
  };
  const dropKeys = (obj, keys) => {
    const next = { ...obj };
    keys.forEach((k) => delete next[k]);
    return next;
  };
  const customApi = isAdmin ? {
    addItem: (pgId, data) => update((s) => withCustomState(s, (c) => ({
      ...c, items: [...c.items, { id: `c-${Date.now().toString(36)}`, pageId: pgId, ...data, createdAt: Date.now() }],
    }))),
    editItem: (id, data) => update((s) => withCustomState(s, (c) => ({
      ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
    }))),
    removeItem: (id) => update((s) => ({
      ...withCustomState(s, (c) => ({ ...c, items: c.items.filter((i) => i.id !== id) })),
      marks: dropKeys(s.marks, [id]),
      notes: dropKeys(s.notes, [id]),
    })),
    addPage: (data) => {
      const id = `cp-${Date.now().toString(36)}`;
      update((s) => withCustomState(s, (c) => ({ ...c, pages: [...c.pages, { id, ...data, createdAt: Date.now() }] })));
      go('tour', { page: id });
    },
    removePage: (pg) => {
      if (!window.confirm(`"${pg.title}" page ar er shob custom item delete korbe?`)) return;
      update((s) => {
        const itemIds = (s.custom?.items || []).filter((i) => i.pageId === pg.id).map((i) => i.id);
        const keys = [...itemIds, ...PER_PAGE_BASICS.map((_, i) => basicKey(pg.id, i))];
        return {
          ...withCustomState(s, (c) => ({ pages: c.pages.filter((p) => p.id !== pg.id), items: c.items.filter((i) => i.pageId !== pg.id) })),
          marks: dropKeys(s.marks, keys),
          notes: dropKeys(s.notes, keys),
        };
      });
      go('tour', { page: pages[0].id });
    },
  } : null;

  // ── derived numbers ───────────────────────────────────────────────────────
  const pageStats = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, tally(pageKeys(p), marks)])), [pages, marks]);
  const allPageKeys = useMemo(() => pages.flatMap(pageKeys), [pages]);
  const flowKeys = useMemo(() => USER_FLOWS.flatMap((f) => f.steps.map((_, i) => flowKey(f.id, i))), []);
  const manual = useMemo(() => tally([...allPageKeys, ...flowKeys], marks), [allPageKeys, flowKeys, marks]);
  const goStats = useMemo(() => tally(GO_LIVE.map((g) => goKey(g.id)), marks), [marks]);
  const autoRuns = AUTO_TESTS.map((t) => auto[t.id]).filter(Boolean);
  const autoPass = autoRuns.filter((r) => r.status === 'pass').length;
  const autoFail = autoRuns.filter((r) => r.status === 'fail').length;
  const openBugs = bugs.filter(isOpenBug);
  const blockerBugs = openBugs.filter((b) => b.severity === 'Critical' || b.severity === 'High');
  const mismatches = MATRIX_ROWS.reduce((n, row) => n + MATRIX_ROLES.filter((r, i) => {
    const got = matrix[`${row.id}:${r.id}`];
    return got && row.expect[i] && got !== row.expect[i];
  }).length, 0);

  const smokeByRoute = useMemo(() => {
    const map = {};
    (auto.smoke?.items || []).forEach((i) => { map[i.label.split('?')[0]] = i; });
    return map;
  }, [auto.smoke]);

  const bugFromItem = (p) => (id, text) => {
    addBug({ title: plain(text).slice(0, 140), page: p.route || p.title, steps: notes[id] || '', itemId: id });
    mark(id, 'fail');
    setToast('Bug log e add hoyeche');
  };

  // ── export / import ───────────────────────────────────────────────────────
  const download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const sym = (m) => (m === 'pass' ? '[x]' : m === 'na' ? '[-]' : m === 'fail' ? '[!]' : '[ ]');

  const exportMarkdown = () => {
    const L = [`# AUSTWise QA report — ${new Date().toLocaleString()}`, '',
      `- Manual: **${manual.pct}%** (${manual.pass} pass, ${manual.fail} fail, ${manual.na} n/a, ${manual.left} left)`,
      `- Auto tests: ${autoPass}/${AUTO_TESTS.length} pass, ${autoFail} fail`,
      `- Bugs open: ${openBugs.length} (${blockerBugs.length} critical/high)`,
      `- Go-live: ${goStats.done}/${goStats.total}`, '', '`[x]` pass · `[!]` fail · `[-]` n/a · `[ ]` baki', ''];
    GROUPS.forEach((g) => {
      const inGroup = pages.filter((p) => p.group === g.id);
      if (!inGroup.length) return;
      L.push(`## ${g.label}`, '');
      inGroup.forEach((p) => {
        const type = p.type === 'page' && !g.sidebar ? '' : `${p.type === 'tab' ? 'Tab' : p.type === 'main' ? 'Main' : 'Page'}: `;
        L.push(`### ${type}${p.title}${p.route ? ` (\`${p.route}\`)` : ''} — ${pageStats[p.id].pct}%`);
        p.items.forEach((i) => {
          L.push(`- ${sym(marks[i.id])} ${ITEM_KINDS[i.kind].label}${i.custom ? ' (custom)' : ''}: ${i.text}`);
          if (notes[i.id]) L.push(`  - Note: ${notes[i.id].replace(/\n/g, ' ')}`);
        });
        if (!p.noBasics) L.push(`- Basics: ${PER_PAGE_BASICS.map((b, i) => `${sym(marks[basicKey(p.id, i)])} ${b}`).join(' · ')}`);
        L.push('');
      });
    });
    L.push('## User flows', '');
    USER_FLOWS.forEach((f) => { L.push(`### ${f.title} (${f.role})`); f.steps.forEach((s, i) => L.push(`- ${sym(marks[flowKey(f.id, i)])} ${s}`)); L.push(''); });
    L.push('## Role matrix', '', `| | ${MATRIX_ROLES.map((r) => r.label).join(' | ')} |`, `|---|${MATRIX_ROLES.map(() => '---').join('|')}|`);
    MATRIX_ROWS.forEach((row) => L.push(`| ${row.label} | ${MATRIX_ROLES.map((r, i) => {
      const got = matrix[`${row.id}:${r.id}`]; const exp = row.expect[i];
      const show = got === 'y' ? '✅' : got === 'n' ? '❌' : '·';
      return exp && got && exp !== got ? `${show} (exp ${exp === 'y' ? '✅' : '❌'})` : show;
    }).join(' | ')} |`));
    L.push('', '## Auto tests', '');
    AUTO_TESTS.forEach((t) => {
      const r = auto[t.id];
      L.push(`### ${t.title}: ${r ? r.status.toUpperCase() : 'not run'}${r ? ` — ${r.detail} (${new Date(r.at).toLocaleString()})` : ''}`);
      (r?.items || []).filter((i) => i.status === 'fail' || i.status === 'warn').forEach((i) => L.push(`- ${i.status}: ${i.label} — ${i.detail}`));
      L.push('');
    });
    L.push('## Bugs', '', '| # | Severity | Status | Title | Page | Role | Device | Steps | Expected | Actual |', '|---|---|---|---|---|---|---|---|---|---|');
    const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    bugs.forEach((b, i) => L.push(`| ${i + 1} | ${b.severity} | ${b.status} | ${cell(b.title)} | ${cell(b.page)} | ${cell(b.role)} | ${cell(b.device)} | ${cell(b.steps)} | ${cell(b.expected)} | ${cell(b.actual)} |`));
    L.push('', '## Go-live', '');
    GO_LIVE.forEach((g) => L.push(`- ${sym(marks[goKey(g.id)])} ${g.text}`));
    download(`austwise-qa-report-${stamp()}.md`, `${L.join('\n')}\n`, 'text/markdown');
    setMenuOpen(false);
  };

  const exportJson = () => { download(`austwise-qa-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json'); setMenuOpen(false); };
  const importJson = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== 'object' || !data.marks) throw new Error('bad');
      replace(data);
      setToast('Import hoyeche');
    } catch {
      setToast('Ei file ta QA export na');
    }
  };
  const resetAll = () => {
    setMenuOpen(false);
    if (window.confirm('Shob tick, note, role matrix, auto result ar bug log muche jabe. Sure?')) {
      replace({});
      setToast('Reset hoyeche');
    }
  };

  const syncLabel = { loading: 'Loading…', local: 'Ei browser e saved', saving: 'Saving…', synced: 'Saved to account', offline: 'Offline — ei browser e saved', blocked: 'Note e blocked shobdo — sync hoyni' }[sync];

  return (
    <div className="glass-card-static qa-widget animate-fadeInUp">
      <header className="dl-head has-actions">
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><ClipboardCheck size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">Admin · Release</span>
            <h2 className="dl-head-name">QA Checklist</h2>
            <span className="dl-head-subtitle">Production er age protita page, flow ar role er final tour</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Manual</dt><dd>{manual.pct}%</dd></div>
          <div className={`dl-head-stat${autoFail ? ' is-alert' : ''}`}><dt>Auto</dt><dd>{autoRuns.length ? `${autoPass}/${AUTO_TESTS.length}` : '—'}</dd></div>
          <div className={`dl-head-stat${openBugs.length ? ' is-alert' : ''}`}><dt>Open bugs</dt><dd>{openBugs.length}</dd></div>
          <div className="dl-head-stat"><dt>Go-live</dt><dd>{goStats.done}/{goStats.total}</dd></div>
        </dl>
        <div className="dl-head-actions" ref={menuRef}>
          <button type="button" className="dl-head-menu-btn" aria-label="QA options" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <MoreVertical size={17} />
          </button>
          {menuOpen && (
            <div className="qa-menu" role="menu">
              <button type="button" role="menuitem" className="qa-menu-item" onClick={exportMarkdown}><Download size={14} /> Report download (.md)</button>
              <button type="button" role="menuitem" className="qa-menu-item" onClick={exportJson}><Download size={14} /> Backup (.json)</button>
              <button type="button" role="menuitem" className="qa-menu-item" onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}><Upload size={14} /> Backup import</button>
              <div className="qa-menu-sep" />
              <button type="button" role="menuitem" className="qa-menu-item is-danger" onClick={resetAll}><RotateCcw size={14} /> Reset everything</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} />
        </div>
      </header>

      <div className="qa-toolbar">
        <nav className="qa-tabs" aria-label="QA sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`qa-tab${tab === id ? ' is-active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
              <Icon size={13} /> {label}
              {id === 'bugs' && openBugs.length > 0 && <span className="qa-tab-count">{openBugs.length}</span>}
            </button>
          ))}
        </nav>
        <span className={`qa-sync is-${sync}`}>{syncLabel}</span>
      </div>

      {tab === 'overview' && (
        <Overview
          pages={pages} manual={manual} pageStats={pageStats} marks={marks} notes={notes} auto={auto}
          openBugs={openBugs} goStats={goStats} go={go}
        />
      )}
      {tab === 'tour' && (
        <Tour
          pages={pages} pageId={pageId} pageStats={pageStats} marks={marks} notes={notes}
          onMark={mark} onNote={setNote} bugFromItem={bugFromItem} smokeByRoute={smokeByRoute}
          go={go} customApi={customApi}
        />
      )}
      {tab === 'flows' && <Flows marks={marks} notes={notes} onMark={mark} onNote={setNote} addBug={(t, role) => { addBug({ title: t, role }); setToast('Bug log e add hoyeche'); }} />}
      {tab === 'roles' && <Roles matrix={matrix} mismatches={mismatches} update={update} navigate={navigate} />}
      {tab === 'auto' && <AutoTests auto={auto} update={update} />}
      {tab === 'bugs' && <Bugs bugs={bugs} update={update} />}
      {tab === 'golive' && (
        <GoLive
          marks={marks} notes={notes} onMark={mark} onNote={setNote} manual={manual}
          autoRuns={autoRuns.length} autoFail={autoFail} blockerBugs={blockerBugs.length}
          mismatches={mismatches} go={go}
        />
      )}

      {toast && <div className="qa-toast" role="status">{toast}</div>}
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

function Overview({ pages, manual, pageStats, marks, notes, auto, openBugs, goStats, go }) {
  const next = pages.find((p) => pageStats[p.id].left > 0);
  const fails = [];
  pages.forEach((p) => p.items.forEach((i) => { if (marks[i.id] === 'fail') fails.push({ page: p, text: i.text, note: notes[i.id] }); }));
  const autoFails = AUTO_TESTS.filter((t) => auto[t.id]?.status === 'fail');

  return (
    <div className="qa-overview">
      <section className="qa-card qa-hero">
        <div className="qa-hero-main">
          <span className="qa-label">Manual tour</span>
          <span className="qa-hero-value">{manual.pct}%</span>
          <span className="qa-hero-sub">{manual.pass} pass · {manual.fail} fail · {manual.na} n/a · {manual.left} baki</span>
        </div>
        <Bar pct={manual.pct} />
        <div className="qa-hero-actions">
          {next
            ? <button type="button" className="qa-btn is-primary" onClick={() => go('tour', { page: next.id })}><Play size={13} /> {manual.done ? 'Continue tour' : 'Start final tour'}: {next.title}</button>
            : <span className="qa-done-note"><CheckCircle2 size={14} /> Shob page dekha shesh</span>}
          <button type="button" className="qa-btn" onClick={() => go('auto')}><FlaskConical size={13} /> Auto tests</button>
        </div>
      </section>

      <div className="qa-overview-grid">
        <section className="qa-card">
          <h3 className="qa-card-title is-ruled"><Route size={14} /> Area onujayi progress</h3>
          <div className="qa-area-list">
            {GROUPS.map((g) => {
              const inGroup = pages.filter((p) => p.group === g.id);
              if (!inGroup.length) return null;
              const Icon = GROUP_ICONS[g.id] || Route;
              const tabs = inGroup.filter((p) => p.type === 'tab').length;
              const t = inGroup.reduce((acc, p) => {
                const s = pageStats[p.id];
                return { done: acc.done + s.done, total: acc.total + s.total, fail: acc.fail + s.fail };
              }, { done: 0, total: 0, fail: 0 });
              const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
              return (
                <button key={g.id} type="button" className="qa-area" onClick={() => go('tour', { page: (inGroup.find((p) => pageStats[p.id].left > 0) || inGroup[0]).id })}>
                  <span className="qa-area-name"><Icon size={13} className="qa-area-icon" /> {g.label}</span>
                  <span className="qa-area-meta">{tabs ? `${tabs} tab · ${inGroup.length - tabs} page` : `${inGroup.length} page`}{t.fail ? <em> · {t.fail} fail</em> : null}</span>
                  <Bar pct={pct} bad={t.fail > 0} />
                  <span className="qa-area-pct">{pct}%</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="qa-rail">
          <section className="qa-card">
            <h3 className="qa-card-title is-ruled"><ShieldCheck size={14} /> Kivabe korbe</h3>
            <ol className="qa-steps">
              <li><strong>Auto tests</strong> chalao — crash, API lock, theme, redirect nije nije dhora pore.</li>
              <li><strong>Page tour</strong> e protita page khule item gula try koro: thik hole ✓, bhanga hole ✗, na lagle –.</li>
              <li><strong>User flows</strong> ar <strong>Roles</strong> duita browser e alada account diye koro.</li>
              <li>Bhanga jinish <strong>Bugs</strong> e jay. Fix hole abar test kore Fixed dao.</li>
              <li><strong>Go-live</strong> shob green hole production e deploy.</li>
            </ol>
          </section>

          <section className="qa-card">
            <h3 className="qa-card-title is-ruled"><XCircle size={14} /> Fail list</h3>
            {fails.length === 0 && autoFails.length === 0 ? (
              <div className="qa-empty"><span className="qa-empty-icon"><CheckCircle2 size={16} /></span><p className="qa-empty-hint">Ekhono kono fail nai.</p></div>
            ) : (
              <div className="qa-fail-list">
                {autoFails.map((t) => (
                  <button key={t.id} type="button" className="qa-fail-row" onClick={() => go('auto')}>
                    <XCircle size={13} /><span><strong>Auto:</strong> {t.title}</span>
                  </button>
                ))}
                {fails.slice(0, 12).map((f) => (
                  <button key={`${f.page.id}-${f.text}`} type="button" className="qa-fail-row" onClick={() => go('tour', { page: f.page.id })}>
                    <XCircle size={13} /><span><strong>{f.page.title}:</strong> {plain(f.text)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="qa-rail-foot">
              <button type="button" className="qa-link" onClick={() => go('bugs')}>{openBugs.length} open bug</button>
              <button type="button" className="qa-link" onClick={() => go('golive')}>Go-live {goStats.done}/{goStats.total}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Page tour ───────────────────────────────────────────────────────────────

function Tour({ pages, pageId, pageStats, marks, notes, onMark, onNote, bugFromItem, smokeByRoute, go, customApi }) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  // null | `new:<pageId>` | custom item id | 'page'
  const [editing, setEditing] = useState(null);
  const index = pages.findIndex((pg) => pg.id === pageId);
  const p = pages[index];
  const stats = pageStats[p.id];
  const group = GROUPS.find((g) => g.id === p.group);
  const openRoute = p.openRoute || p.route;
  const smoke = p.route ? smokeByRoute[p.route] : null;
  const q = query.trim().toLowerCase();
  const visible = pages.filter((pg) => !q || `${pg.title} ${pg.route || ''} ${pg.items.map((i) => i.text).join(' ')}`.toLowerCase().includes(q));
  const prev = pages[index - 1];
  const next = pages[index + 1];
  const kinds = Object.keys(ITEM_KINDS).filter((k) => p.items.some((i) => i.kind === k));
  const where = group.sidebar ? `${group.label} › ${PAGE_TYPES[p.type].label}` : group.label;

  const openAs = (role) => {
    if (!openRoute || !role) return;
    const url = new URL(openRoute, window.location.origin);
    url.searchParams.set('mockRole', role);
    window.open(`${url.pathname}${url.search}`, '_blank', 'noopener');
  };

  const pageRow = (pg) => {
    const s = pageStats[pg.id];
    return (
      <button key={pg.id} type="button" className={`qa-page-row${pg.type === 'tab' ? ' is-tab' : ''}${pg.id === p.id ? ' is-active' : ''}`} onClick={() => go('tour', { page: pg.id })}>
        <span className={`qa-dot ${s.fail ? 'is-fail' : s.left === 0 ? 'is-done' : s.done ? 'is-part' : ''}`} />
        <span className="qa-page-name">{pg.title}</span>
        <span className="qa-page-count">{s.done}/{s.total}</span>
      </button>
    );
  };

  return (
    <div className="qa-tour">
      <aside className="qa-card qa-tour-rail" aria-label="Pages">
        <label className="qa-search">
          <Search size={13} />
          <input className="input" type="search" placeholder="Page ba item khujo…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="qa-page-list">
          {GROUPS.map((g) => {
            const inGroup = visible.filter((pg) => pg.group === g.id);
            if (!inGroup.length) return null;
            const Icon = GROUP_ICONS[g.id] || Route;
            const expanded = q ? true : (openGroups[g.id] ?? g.id === p.group);
            const t = inGroup.reduce((acc, pg) => ({ done: acc.done + pageStats[pg.id].done, total: acc.total + pageStats[pg.id].total, fail: acc.fail + pageStats[pg.id].fail }), { done: 0, total: 0, fail: 0 });
            const byType = (type) => inGroup.filter((pg) => pg.type === type);
            const tabs = byType('tab');
            const others = byType('page');
            return (
              <div key={g.id} className={`qa-page-group${expanded ? ' is-open' : ''}`}>
                <button type="button" className={`qa-group-head${g.id === p.group ? ' is-current' : ''}`} aria-expanded={expanded}
                  onClick={() => setOpenGroups((o) => ({ ...o, [g.id]: !expanded }))}>
                  <Icon size={13} className="qa-group-icon" />
                  <span className="qa-group-name">{g.label}</span>
                  <span className={`qa-page-count${t.fail ? ' is-fail' : ''}`}>{t.done}/{t.total}</span>
                  <ChevronDown size={13} className="qa-group-chev" />
                </button>
                {expanded && (
                  <div className="qa-group-body">
                    {byType('main').map(pageRow)}
                    {tabs.length > 0 && g.sidebar && <span className="qa-sub-label">{PAGE_TYPES.tab.label}</span>}
                    {tabs.map(pageRow)}
                    {others.length > 0 && g.sidebar && <span className="qa-sub-label">{PAGE_TYPES.page.label}</span>}
                    {others.map(pageRow)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="qa-card qa-tour-main">
        <select className="input qa-page-select" value={p.id} onChange={(e) => go('tour', { page: e.target.value })} aria-label="Page">
          {GROUPS.map((g) => {
            const inGroup = pages.filter((pg) => pg.group === g.id);
            if (!inGroup.length) return null;
            return (
              <optgroup key={g.id} label={g.label}>
                {inGroup.map((pg) => (
                  <option key={pg.id} value={pg.id}>{pg.type === 'tab' ? '· ' : ''}{pg.title} ({pageStats[pg.id].done}/{pageStats[pg.id].total})</option>
                ))}
              </optgroup>
            );
          })}
        </select>

        <div className="qa-context">
          <div className="qa-context-top">
            <span className="qa-label">{where} · {index + 1}/{pages.length}</span>
            <div className="qa-head-actions">
              {p.custom && <span className="qa-chip">Custom</span>}
              {stats.fail > 0 && <span className="qa-chip is-fail">{stats.fail} fail</span>}
              {p.custom && customApi && (
                <button type="button" className="qa-icon-btn is-danger" aria-label="Delete page" title="Page delete" onClick={() => customApi.removePage(p)}><Trash2 size={13} /></button>
              )}
            </div>
          </div>
          <h3 className="qa-context-title">{p.title}</h3>
          <div className="qa-context-meta">
            {p.route && <code className="qa-route">{p.route}</code>}
            {openRoute && (
              <a className="qa-btn is-small" href={openRoute} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Open page</a>
            )}
            {openRoute && IS_DEV && (
              <select className="input qa-role-select" value="" onChange={(e) => openAs(e.target.value)} aria-label="Open as role">
                <option value="">Open as role…</option>
                {MATRIX_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            )}
          </div>
          <div className="qa-context-bar"><Bar pct={stats.pct} bad={stats.fail > 0} /><span>{stats.pct}%</span></div>
          {smoke && (
            <p className={`qa-auto-line is-${smoke.status}`}><StatusIcon status={smoke.status} size={13} /> Auto smoke: {smoke.detail}</p>
          )}
        </div>

        {!p.noBasics && (
          <div className="qa-basics">
            <span className="qa-label">Protita page e</span>
            <div className="qa-basic-chips">
              {PER_PAGE_BASICS.map((b, i) => {
                const key = basicKey(p.id, i);
                const m = marks[key];
                return (
                  <button key={key} type="button" className={`qa-basic is-${m || 'open'}`} aria-pressed={m === 'pass'}
                    onClick={() => onMark(key, m === 'pass' ? 'fail' : m === 'fail' ? null : 'pass')}
                    title="Click: pass → fail → khali">
                    {m === 'pass' ? <Check size={11} strokeWidth={3} /> : m === 'fail' ? <X size={11} strokeWidth={3} /> : <span className="qa-basic-ring" />} {b}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {kinds.map((k) => (
          <div key={k} className="qa-kind">
            <div className="qa-kind-head"><span className={`qa-kind-tag is-${k}`}>{ITEM_KINDS[k].label}</span><span className="qa-kind-hint">{ITEM_KINDS[k].hint}</span></div>
            <div className="qa-items">
              {p.items.filter((i) => i.kind === k).map((i) => (editing === i.id && customApi ? (
                <CustomItemForm key={i.id} title="Item edit" initial={i}
                  onSave={(data) => { customApi.editItem(i.id, data); setEditing(null); }} onCancel={() => setEditing(null)} />
              ) : (
                <ItemRow key={i.id} id={i.id} text={i.text} mark={marks[i.id]} note={notes[i.id]} onMark={onMark} onNote={onNote} onBug={bugFromItem(p)}
                  onEdit={i.custom && customApi ? () => setEditing(i.id) : undefined}
                  onDelete={i.custom && customApi ? () => { if (window.confirm('Ei custom item delete korbe?')) customApi.removeItem(i.id); } : undefined} />
              )))}
            </div>
          </div>
        ))}

        {!p.items.length && (
          <div className="qa-empty">
            <span className="qa-empty-icon"><ClipboardCheck size={16} /></span>
            <p className="qa-empty-hint">Ei page e ekhono kono checklist item nai.</p>
          </div>
        )}

        {customApi && editing === `new:${p.id}` && (
          <CustomItemForm title={`Item add · ${p.title}`} onSave={(data) => { customApi.addItem(p.id, data); setEditing(null); }} onCancel={() => setEditing(null)} />
        )}
        {customApi && editing === 'page' && (
          <CustomPageForm groupId={p.group} onSave={(data) => { customApi.addPage(data); setEditing(null); }} onCancel={() => setEditing(null)} />
        )}
        {customApi && editing !== `new:${p.id}` && editing !== 'page' && (
          <div className="qa-add-row">
            <button type="button" className="qa-btn is-small" onClick={() => setEditing(`new:${p.id}`)}><Plus size={12} /> Checklist item add</button>
            <button type="button" className="qa-btn is-small is-ghost" onClick={() => setEditing('page')}><Plus size={12} /> {group.label} e page / tab add</button>
          </div>
        )}

        <div className="qa-tour-nav">
          <button type="button" className="qa-btn" disabled={!prev} onClick={() => prev && go('tour', { page: prev.id })}><ChevronLeft size={14} /> {prev ? prev.title : 'Prothom'}</button>
          <button type="button" className="qa-btn is-primary" disabled={!next} onClick={() => next && go('tour', { page: next.id })}>{next ? next.title : 'Shesh'} <ChevronRight size={14} /></button>
        </div>
      </section>
    </div>
  );
}

// ── User flows ──────────────────────────────────────────────────────────────

function Flows({ marks, notes, onMark, onNote, addBug }) {
  return (
    <div className="qa-flows">
      {USER_FLOWS.map((f) => {
        const s = tally(f.steps.map((_, i) => flowKey(f.id, i)), marks);
        const role = MATRIX_ROLES.find((r) => r.id === f.role);
        return (
          <section key={f.id} className="qa-card qa-flow">
            <div className="qa-card-title is-ruled qa-flow-head">
              <Workflow size={14} />
              <span className="qa-flow-title">{f.title}</span>
              <span className="qa-chip">{role?.label || f.role}</span>
            </div>
            <div className="qa-context-bar"><Bar pct={s.pct} bad={s.fail > 0} /><span>{s.done}/{s.total}</span></div>
            <ol className="qa-flow-steps">
              {f.steps.map((step, i) => (
                <li key={step}>
                  <span className="qa-step-num">{String(i + 1).padStart(2, '0')}</span>
                  <ItemRow id={flowKey(f.id, i)} text={step} mark={marks[flowKey(f.id, i)]} note={notes[flowKey(f.id, i)]} onMark={onMark} onNote={onNote}
                    onBug={(id) => { onMark(id, 'fail'); addBug(`${f.title}: ${plain(step)}`, role?.label); }} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

// ── Roles ───────────────────────────────────────────────────────────────────

function Roles({ matrix, mismatches, update, navigate }) {
  const cycle = (key) => update((s) => {
    const cur = s.matrix[key];
    const nextVal = cur === 'y' ? 'n' : cur === 'n' ? null : 'y';
    const m = { ...s.matrix };
    if (nextVal) m[key] = nextVal; else delete m[key];
    return { ...s, matrix: m };
  });
  const filled = Object.keys(matrix).length;
  const total = MATRIX_ROWS.length * MATRIX_ROLES.length;

  return (
    <div className="qa-roles">
      <section className="qa-card">
        <div className="qa-card-head-row">
          <h3 className="qa-card-title"><Users size={14} /> Ke ki korte pare</h3>
          <div className="qa-head-actions">
            <span className={`qa-chip${mismatches ? ' is-fail' : ''}`}>{mismatches} mismatch</span>
            <span className="qa-chip">{filled}/{total} checked</span>
            <button type="button" className="qa-btn is-small" onClick={() => navigate('/admin-panel/role-preview')}><ExternalLink size={12} /> Role preview</button>
          </div>
        </div>
        <p className="qa-prose">
          Protita role er account diye (ba dev e <code>?mockRole=</code> diye) kajta kore dekho, tarpor cell e click: <strong>✓ parlo</strong> → <strong>✗ parlo na</strong> → khali.
          Choto lekha "exp" holo code onujayi ja howa uchit; mile na gele cell lal hoy.
        </p>
        <div className="qa-matrix-wrap">
          <table className="qa-matrix">
            <thead>
              <tr><th scope="col">Kaj</th>{MATRIX_ROLES.map((r) => <th key={r.id} scope="col">{r.label}</th>)}</tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr key={row.id}>
                  <th scope="row"><Rich text={row.label} /></th>
                  {MATRIX_ROLES.map((r, i) => {
                    const key = `${row.id}:${r.id}`;
                    const got = matrix[key];
                    const exp = row.expect[i];
                    const bad = got && exp && got !== exp;
                    return (
                      <td key={key}>
                        <button type="button" className={`qa-cell${got ? ` is-${got}` : ''}${bad ? ' is-bad' : ''}`} onClick={() => cycle(key)}
                          aria-label={`${row.label} — ${r.label}: ${got === 'y' ? 'parlo' : got === 'n' ? 'parlo na' : 'check kora hoyni'}`}>
                          {got === 'y' ? <Check size={13} strokeWidth={3} /> : got === 'n' ? <X size={13} strokeWidth={3} /> : <span className="qa-cell-dot" />}
                          {exp && <span className="qa-cell-exp">exp {exp === 'y' ? '✓' : '✗'}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="qa-card">
        <h3 className="qa-card-title is-ruled"><ShieldCheck size={14} /> Role er data flow</h3>
        <ul className="qa-bullets">
          <li>Role change er por user <strong>refresh</strong> dilei notun permission (sidebar, page, button) apply hoy.</li>
          <li>UI te button lukano holeo <strong>API o block</strong> kore — DevTools → Network theke request copy kore onno role er cookie diye pathao, 401/403 ashbe.</li>
          <li>Access rules (admin → Platform) e kono role er jonno page hide korle oi role er <strong>sidebar + page</strong> duitai lock.</li>
          <li>Banned account kono write korte pare na; temp ban shesh hole abar pare.</li>
          <li>Production e <code>?mockRole=</code> kaj kore na (Auto tests → Role guard production e chalao).</li>
        </ul>
      </section>
    </div>
  );
}

// ── Auto tests ──────────────────────────────────────────────────────────────

function AutoTests({ auto, update }) {
  const [device, setDevice] = useState('desktop');
  const [running, setRunning] = useState(null);
  const [progress, setProgress] = useState(null);
  const [open, setOpen] = useState({});
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [copied, setCopied] = useState('');
  const stopRef = useRef(false);

  const runOne = async (t) => {
    setRunning(t.id);
    setProgress(null);
    let result;
    try {
      result = await t.run({
        device,
        shouldStop: () => stopRef.current,
        onProgress: (doneCount, total, label) => setProgress({ done: doneCount, total, label }),
      });
    } catch (error) {
      result = { status: 'fail', detail: error.message, items: [] };
    }
    const saved = { ...result, at: nowMs(), device: t.usesProbe ? device : undefined };
    update((s) => ({ ...s, auto: { ...s.auto, [t.id]: saved } }));
    if (result.status !== 'pass') setOpen((o) => ({ ...o, [t.id]: true }));
    return saved;
  };

  const runAll = async () => {
    stopRef.current = false;
    for (const t of AUTO_TESTS) {
      if (stopRef.current) break;
      await runOne(t);
    }
    closeProbe();
    setRunning(null);
    setProgress(null);
  };

  const runSingle = async (t) => {
    stopRef.current = false;
    await runOne(t);
    if (t.usesProbe) closeProbe();
    setRunning(null);
    setProgress(null);
  };

  const stop = () => { stopRef.current = true; };
  const copy = async (cmd) => {
    try { await navigator.clipboard.writeText(cmd); setCopied(cmd); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  const ran = AUTO_TESTS.filter((t) => auto[t.id]);

  return (
    <div className="qa-auto">
      <section className="qa-card qa-auto-bar">
        <div className="qa-auto-bar-row">
          {running
            ? <button type="button" className="qa-btn is-danger" onClick={stop}><Square size={12} /> Stop</button>
            : <button type="button" className="qa-btn is-primary" onClick={runAll}><Play size={13} /> Run all tests</button>}
          <div className="qa-seg" role="radiogroup" aria-label="Device size for page tests">
            {Object.entries(DEVICES).map(([id, d]) => (
              <button key={id} type="button" role="radio" aria-checked={device === id} className={device === id ? 'is-active' : ''} disabled={!!running} onClick={() => setDevice(id)}>{d.label}</button>
            ))}
          </div>
          <label className="qa-toggle"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Shudhu problem dekhao</label>
        </div>
        <p className="qa-prose">
          Shob test shudhu <strong>porhe</strong> (GET + page visit), kichu likhe na ba delete kore na. {IS_DEV
            ? ' Page test gula lukano ekta frame e chole (ei page er ?mockRole= shoho). Ekhon dev build: final run production URL e abar chalao.'
            : ' Page test er jonno ekta choto window khulbe — bondho korbe na, test shesh hole nije bondho hobe.'}
        </p>
        {running && progress && (
          <div className="qa-run-line"><Loader2 size={13} className="qa-spin" /> {AUTO_TESTS.find((t) => t.id === running)?.title}: {progress.done}/{progress.total}{progress.label ? ` · ${progress.label}` : ''}</div>
        )}
        {!running && ran.length > 0 && (
          <div className="qa-run-line is-muted">Shesh run: {timeAgo(Math.max(...ran.map((t) => auto[t.id].at)))}</div>
        )}
      </section>

      <div className="qa-test-list">
        {AUTO_TESTS.map((t) => {
          const r = auto[t.id];
          const status = running === t.id ? 'running' : r?.status;
          const items = (r?.items || []).filter((i) => !onlyProblems || i.status === 'fail' || i.status === 'warn');
          const isOpen = open[t.id];
          return (
            <section key={t.id} className={`qa-card qa-test is-${status || 'new'}`}>
              <div className="qa-test-head">
                <StatusIcon status={status} size={16} />
                <div className="qa-test-text">
                  <span className="qa-test-title">{t.title}</span>
                  <span className="qa-test-why">{t.why}</span>
                </div>
                <div className="qa-test-side">
                  {r && <span className="qa-test-meta">{r.detail}{r.device ? ` · ${DEVICES[r.device]?.label}` : ''} · {timeAgo(r.at)}</span>}
                  <button type="button" className="qa-btn is-small" disabled={!!running} onClick={() => runSingle(t)}><Play size={11} /> Run</button>
                  {r?.items?.length > 0 && (
                    <button type="button" className="qa-icon-btn" aria-expanded={!!isOpen} aria-label="Details" onClick={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))}>
                      <ChevronRight size={14} className={isOpen ? 'qa-rot' : ''} />
                    </button>
                  )}
                </div>
              </div>
              {isOpen && r && (
                <div className="qa-test-body">
                  {r.note && <p className="qa-test-note">{r.note}</p>}
                  {items.length === 0
                    ? <p className="qa-test-note">Kono problem nai.</p>
                    : (
                      <ul className="qa-result-list">
                        {items.map((i) => (
                          <li key={`${i.label}-${i.detail}`} className={`is-${i.status}`}>
                            <StatusIcon status={i.status} size={13} />
                            <span className="qa-result-label">{i.label}</span>
                            <span className="qa-result-detail">{i.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="qa-card">
        <h3 className="qa-card-title is-ruled"><Terminal size={14} /> Terminal er test (Playwright)</h3>
        <p className="qa-prose">Logged-out user, protita role er real account, 3 device screenshot ar 27 theme — eigula terminal theke chole. Setup: <code>docs/qa/AUTOMATION.md</code>.</p>
        <div className="qa-cli-list">
          {CLI_COMMANDS.map((c) => (
            <div key={c.cmd} className="qa-cli">
              <span className="qa-cli-label">{c.label}</span>
              <code className="qa-cli-cmd">{c.cmd}</code>
              <button type="button" className="qa-icon-btn" aria-label={`Copy ${c.cmd}`} onClick={() => copy(c.cmd)}>{copied === c.cmd ? <Check size={13} /> : <Copy size={13} />}</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Bugs ────────────────────────────────────────────────────────────────────

const emptyBug = { title: '', page: '', role: '', device: '', severity: 'Medium', steps: '', expected: '', actual: '', status: 'Open' };

function BugForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...emptyBug, ...initial });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => { if (form.title.trim()) onSave({ ...form, title: form.title.trim() }); };
  return (
    <div className="qa-pop qa-bug-form" role="group" aria-label={initial?.id ? 'Edit bug' : 'Add bug'}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
      <span className="qa-pop-title"><Bug size={11} /> {initial?.id ? 'Bug edit' : 'Notun bug'}</span>
      <input className="input qa-pop-input is-title" placeholder="Ki bhanga? (e.g. Marketplace e chobi upload hoy na)" value={form.title} onChange={set('title')} autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      <div className="qa-pop-row">
        <input className="input qa-pop-input" placeholder="Page / route" value={form.page} onChange={set('page')} />
        <input className="input qa-pop-input" placeholder="Role" value={form.role} onChange={set('role')} />
        <input className="input qa-pop-input" placeholder="Device / browser / theme" value={form.device} onChange={set('device')} />
        <select className="input qa-pop-input" value={form.severity} onChange={set('severity')} aria-label="Severity">
          {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <textarea className="input qa-pop-input is-area" placeholder="Steps: 1. … 2. …" value={form.steps} onChange={set('steps')} />
      <div className="qa-pop-row">
        <textarea className="input qa-pop-input is-area" placeholder="Ki howa uchit chilo" value={form.expected} onChange={set('expected')} />
        <textarea className="input qa-pop-input is-area" placeholder="Ki holo" value={form.actual} onChange={set('actual')} />
      </div>
      <div className="qa-pop-actions">
        <button type="button" className="qa-btn is-primary is-small" disabled={!form.title.trim()} onClick={save}><Check size={12} /> Save</button>
        <button type="button" className="qa-btn is-small is-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Bugs({ bugs, update }) {
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(null); // null | 'new' | bug id
  const list = bugs
    .filter((b) => (filter === 'open' ? isOpenBug(b) : filter === 'closed' ? !isOpenBug(b) : true))
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || (b.createdAt || 0) - (a.createdAt || 0));
  const counts = { open: bugs.filter(isOpenBug).length, closed: bugs.filter((b) => !isOpenBug(b)).length, all: bugs.length };

  const saveBug = (data) => {
    update((s) => {
      if (data.id && s.bugs.some((b) => b.id === data.id)) return { ...s, bugs: s.bugs.map((b) => (b.id === data.id ? { ...b, ...data } : b)) };
      return { ...s, bugs: [...s.bugs, { ...data, id: `bug-${Date.now()}`, createdAt: Date.now() }] };
    });
    setEditing(null);
  };
  const setStatus = (id, status) => update((s) => ({ ...s, bugs: s.bugs.map((b) => (b.id === id ? { ...b, status } : b)) }));
  const remove = (b) => {
    if (window.confirm(`"${b.title}" delete korbe?`)) update((s) => ({ ...s, bugs: s.bugs.filter((x) => x.id !== b.id) }));
  };

  return (
    <section className="qa-card qa-bugs">
      <div className="qa-card-head-row">
        <div className="qa-seg" role="radiogroup" aria-label="Bug filter">
          {[['open', 'Open'], ['closed', 'Fixed / closed'], ['all', 'All']].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label} {counts[id]}</button>
          ))}
        </div>
        <button type="button" className="qa-btn is-primary is-small" onClick={() => setEditing('new')}><Plus size={13} /> Add bug</button>
      </div>

      {editing === 'new' && <BugForm initial={{}} onSave={saveBug} onCancel={() => setEditing(null)} />}

      {list.length === 0 && editing !== 'new' ? (
        <div className="qa-empty">
          <span className="qa-empty-icon"><Bug size={16} /></span>
          <p className="qa-empty-hint">{filter === 'open' ? 'Kono open bug nai.' : 'Ekhane kichu nai.'} Tour e kono item er <Bug size={11} /> chaple bug ekhane chole ashe.</p>
          <button type="button" className="qa-empty-action" onClick={() => setEditing('new')}><Plus size={13} /> Add bug</button>
        </div>
      ) : (
        <div className="qa-bug-list">
          {list.map((b) => (editing === b.id ? (
            <BugForm key={b.id} initial={b} onSave={saveBug} onCancel={() => setEditing(null)} />
          ) : (
            <article key={b.id} className={`qa-bug${isOpenBug(b) ? '' : ' is-closed'}`}>
              <span className={`qa-sev is-${b.severity.toLowerCase()}`}>{b.severity}</span>
              <div className="qa-bug-body">
                <span className="qa-bug-title">{b.title}</span>
                <span className="qa-bug-meta">{[b.page, b.role, b.device].filter(Boolean).join(' · ') || 'Page/role likha nai'}</span>
                {(b.steps || b.actual) && <span className="qa-bug-steps">{b.actual || b.steps}</span>}
              </div>
              <div className="qa-bug-side">
                <select className="input qa-bug-status" value={b.status} onChange={(e) => setStatus(b.id, e.target.value)} aria-label="Status">
                  {BUG_STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button type="button" className="qa-icon-btn" aria-label="Edit bug" onClick={() => setEditing(b.id)}><Pencil size={13} /></button>
                <button type="button" className="qa-icon-btn is-danger" aria-label="Delete bug" onClick={() => remove(b)}><Trash2 size={13} /></button>
              </div>
            </article>
          )))}
        </div>
      )}
    </section>
  );
}

// ── Go-live ─────────────────────────────────────────────────────────────────

function GoLive({ marks, notes, onMark, onNote, manual, autoRuns, autoFail, blockerBugs, mismatches, go }) {
  const gates = [
    { label: 'Manual tour', ok: manual.left === 0 && manual.fail === 0, detail: `${manual.pct}% · ${manual.fail} fail · ${manual.left} baki`, tab: 'tour' },
    { label: 'Auto tests', ok: autoRuns === AUTO_TESTS.length && autoFail === 0, detail: autoRuns ? `${autoRuns}/${AUTO_TESTS.length} run · ${autoFail} fail` : 'Ekhono chalano hoyni', tab: 'auto' },
    { label: 'Critical / High bug', ok: blockerBugs === 0, detail: `${blockerBugs} open`, tab: 'bugs' },
    { label: 'Role matrix', ok: mismatches === 0, detail: `${mismatches} mismatch`, tab: 'roles' },
  ];
  const ready = gates.every((g) => g.ok);
  return (
    <div className="qa-golive">
      <section className="qa-card">
        <div className="qa-card-head-row">
          <h3 className="qa-card-title"><Rocket size={14} /> Production e deya jabe?</h3>
          <span className={`qa-chip ${ready ? 'is-pass' : 'is-fail'}`}>{ready ? 'Ready' : 'Ekhono na'}</span>
        </div>
        <div className="qa-gates">
          {gates.map((g) => (
            <button key={g.label} type="button" className="qa-gate" onClick={() => go(g.tab)}>
              <StatusIcon status={g.ok ? 'pass' : 'fail'} size={15} />
              <span className="qa-gate-label">{g.label}</span>
              <span className="qa-gate-detail">{g.detail}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="qa-card">
        <h3 className="qa-card-title is-ruled"><ClipboardCheck size={14} /> Release checklist</h3>
        <div className="qa-items">
          {GO_LIVE.map((g) => (
            <ItemRow key={g.id} id={goKey(g.id)} text={g.text} mark={marks[goKey(g.id)]} note={notes[goKey(g.id)]} onMark={onMark} onNote={onNote} />
          ))}
        </div>
      </section>
    </div>
  );
}
