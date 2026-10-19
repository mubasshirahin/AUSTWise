import { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import RoleAccessControlCard from './RoleAccessControlCard';
import { useRoleAccess } from '../../hooks/useRoleAccess';

export const MANAGED_FEATURES = [
  { key: 'feature:dashboard:at-a-glance', label: 'At a glance', page: 'Dashboard' },
  { key: 'feature:dashboard:daily-flow', label: 'Daily Flow', page: 'Dashboard' },
  { key: 'feature:dashboard:weekly-planner', label: 'Routine Grid', page: 'Dashboard' },
  { key: 'feature:dashboard:semester-view', label: 'Semester View · 14-Weeks View', page: 'Dashboard' },
  { key: 'feature:dashboard:zero-hour', label: 'Zero Hour', page: 'Dashboard' },
  { key: 'feature:dashboard:attendance', label: 'Attendance Tracker', page: 'Dashboard' },
  { key: 'feature:dashboard:notices', label: 'Notice Board', page: 'Dashboard' },
  { key: 'feature:dashboard:deadlines', label: 'Deadlines', page: 'Dashboard' },
  { key: 'feature:dashboard:notifications', label: 'Notifications', page: 'Dashboard' },
  { key: 'feature:daily-life:cover-page', label: 'Cover Page', page: 'Daily Life' },
  { key: 'feature:daily-life:bhara-koto', label: 'Bhara Koto', page: 'Daily Life' },
  { key: 'feature:daily-life:money-tracker', label: 'TakaGeloKoi', page: 'Daily Life' },
  { key: 'feature:daily-life:mess-meal', label: 'Mess Meal', page: 'Daily Life' },
  { key: 'feature:daily-life:life-planner', label: 'Life Planner', page: 'Daily Life' },
  { key: 'feature:daily-life:digital-footprint', label: 'Footprint', page: 'Daily Life' },
  { key: 'feature:daily-life:password-manager', label: 'Passwords', page: 'Daily Life' },
  { key: 'feature:question-bank-analyzer:main', label: 'Question Bank Analyzer', page: 'Question Bank' },
  { key: 'feature:notebook:main', label: 'My Notes', page: 'notebook' },
  { key: 'feature:messages:main', label: 'All Chats', page: 'messages' },
  { key: 'feature:campus:floor-map', label: 'Floor Map', page: 'InsideAUST' },
  { key: 'feature:campus:library-pulse', label: 'Library Pulse', page: 'InsideAUST' },
  { key: 'feature:campus:canteen-menu', label: 'Canteen Menu', page: 'InsideAUST' },
  { key: 'feature:campus:bus-tracker', label: 'Bus Tracker', page: 'InsideAUST' },
  { key: 'feature:campus:free-rooms', label: 'Free Rooms', page: 'InsideAUST' },
  ...[
    ['analytics', 'CGPA Calculator', 'cgpagraph'], ['analytics', 'Semester Wise', 'semestertracker'], ['analytics', 'Dept Heatmap', 'heatmap'], ['analytics', 'Best & Worst', 'bestworst'], ['analytics', 'Prerequisites', 'prereqs'],
    ['community', 'Alumni Directory', 'alumni'], ['community', 'Clubs Hub', 'clubs'], ['community', 'Student Directory', 'students'], ['community', 'Faculty Directory', 'faculty'], ['community', 'Mentor Requests', 'mentorRequests'],
    ['marketplace', 'AW Market', 'exchange'], ['marketplace', 'ToLet Mama', 'tolet'], ['marketplace', 'Lost & Found', 'lost'],
    ['chill-zone', 'Organizing Area', 'organizing'], ['chill-zone', 'Media Tracker', 'media'], ['chill-zone', 'Rumour or Real', 'rumour'], ['chill-zone', 'Trivia', 'trivia'], ['chill-zone', 'Gaming Zone', 'gaming'],
    ['productivity', 'Study Time', 'study-room'], ['productivity', 'Cheat Sheets', 'cheatsheets'], ['productivity', 'Code Pulse', 'cp-hub'], ['productivity', 'Workspace', 'workspace'],
    ['vault', 'Batch Drive', 'batch-drive'], ['vault', 'Carbon Vault', 'carbon-vault'],
    ['settings', 'Identity', 'profile'], ['settings', 'My Orbits', 'orbits'], ['settings', 'UI', 'theme'], ['settings', 'Configure', 'notifications'], ['settings', 'Credits', 'about'],
    ['shadow', 'Course Reviews', 'reviews'], ['shadow', 'Shadow Chat', 'chat'], ['shadow', 'Buzz', 'buzz'], ['shadow', 'Roast CV', 'roast-cv'],
  ].map(([page, label, tab]) => ({ key: `feature:${page}:${tab}`, label, page: page.replace('-', ' ') })),
];

function FeatureRow({ feature }) {
  const { config, loading, save } = useRoleAccess(feature.key);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const enabled = config.enabled !== false;
  const toggle = async () => {
    setBusy(true);
    await save({ ...config, enabled: !enabled });
    setBusy(false);
  };

  return <div style={{ border: '1px solid var(--border-primary)', borderRadius: '10px', background: 'var(--bg-card)', overflow: 'hidden' }}>
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px' }}>
      <button type="button" aria-label={`Configure roles for ${feature.label}`} aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ background: 'none', border: 0, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px', cursor: 'pointer' }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span style={{ fontSize: '11px' }}>Roles</span></button>
      <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: '13px' }}>{feature.label}</strong><small style={{ color: 'var(--text-tertiary)' }}>{feature.page} · {loading ? 'Loading…' : enabled ? 'On' : 'Off'}</small></span>
      <button type="button" disabled={loading || busy} aria-label={`${enabled ? 'Turn off' : 'Turn on'} ${feature.label}`} aria-pressed={enabled} onClick={toggle} className={`btn btn-sm ${enabled ? 'btn-secondary' : 'btn-primary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: '84px', justifyContent: 'center' }}>
        {enabled ? <><Eye size={13} /> On</> : <><EyeOff size={13} /> Turn on</>}
      </button>
    </div>
    {open && <div style={{ padding: '0 10px 10px' }}><RoleAccessControlCard pageKey={feature.key} label={feature.label} /></div>}
  </div>;
}

export default function FeatureAccessPanel() {
  const [query, setQuery] = useState('');
  const managed = MANAGED_FEATURES;
  const groups = [...new Set(managed.map((feature) => feature.page))];
  const match = (feature) => `${feature.label} ${feature.page}`.toLowerCase().includes(query.toLowerCase());

  return <section className="glass-card-static" style={{ padding: '20px', marginBottom: '20px' }}>
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ fontSize: '16px', margin: 0 }}>Feature box access</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '5px 0 10px' }}>Each box has its own On/Off switch and role access. Expand a box to choose which roles can see it.</p>
      <input aria-label="Search feature boxes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search feature boxes" style={{ width: '100%', maxWidth: '340px', padding: '9px 11px', border: '1px solid var(--border-primary)', borderRadius: '9px', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
    </div>
    <div style={{ display: 'grid', gap: '16px' }}>
      {groups.map((group) => {
        const features = managed.filter((feature) => feature.page === group && match(feature));
        if (!features.length) return null;
        return <div key={group}><h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{group}</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>{features.map((feature) => <FeatureRow key={feature.key} feature={feature} />)}</div></div>;
      })}
    </div>
  </section>;
}
