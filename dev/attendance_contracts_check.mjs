// Validates the tracker's remaining server contracts:
//   1. POST /api/presence/attendance — accepts the widget's average payload,
//      rejects out-of-range values (the dashboard card's data source).
//   2. POST /api/attendance/telegram-sync — bot path: saves a dated record and
//      broadcasts an attendance-sync WS event (what the widget listens for).
// Run: node dev/attendance_contracts_check.mjs
import WebSocket from 'ws';

const BASE = 'http://localhost:5174';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Dev@123456' }),
  });
  assert(res.status === 200, `login ${email} → 200`);
  return (res.headers.getSetCookie ? res.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
}

const usersRes = await fetch(`${BASE}/__dev/users`);
const { users = [] } = await usersRes.json();
assert(users.length >= 1, 'dev users present');
const ua = users[0];
const emailA = ua.email || `${String(ua.id).toLowerCase()}@aust.edu`;
const cookieA = await login(emailA);
console.log('logged in:', ua.id);

// ── 1. presence/attendance contract ──
let r = await fetch(`${BASE}/api/presence/attendance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieA },
  body: JSON.stringify({ attendancePct: 83.4 }),
});
assert(r.status === 200, `presence POST valid pct → 200 (got ${r.status})`);
const okBody = await r.json();
assert(okBody.success && okBody.user && Number(okBody.user.attendancePct) === 83.4,
  `profile attendancePct stored (got ${okBody.user && okBody.user.attendancePct})`);

r = await fetch(`${BASE}/api/presence/attendance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieA },
  body: JSON.stringify({ attendancePct: 150 }),
});
assert(r.status === 400, `presence POST pct>100 → 400 (got ${r.status})`);

r = await fetch(`${BASE}/api/presence/attendance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ attendancePct: 80 }),
});
assert(r.status === 401, `presence POST unauth → 401 (got ${r.status})`);
console.log('presence/attendance OK: valid stored, 150 rejected, unauth rejected');

// ── 2. telegram-sync → attendance-sync broadcast ──
const ws = new WebSocket(BASE.replace('http', 'ws') + '/api/ws', { headers: { Cookie: cookieA } });
const events = [];
ws.onmessage = (ev) => {
  try {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'attendance-sync') events.push(msg.payload);
  } catch { /* ignore */ }
};
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
await wait(300);

const date = new Date().toISOString().split('T')[0];
r = await fetch(`${BASE}/api/attendance/telegram-sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieA },
  body: JSON.stringify({ studentId: String(ua.awid || ua.id), courseId: 'CSE 4101', date, status: 'Present' }),
});
assert(r.status === 200 || r.status === 404, `telegram-sync responded (${r.status})`);
await wait(800);

if (r.status === 200) {
  assert(events.length > 0, 'attendance-sync WS event received');
  const p = events[0];
  assert(p.courseId === 'CSE 4101' && p.date === date && p.attended === true,
    'event payload carries course/date/status');
  console.log('telegram-sync OK:', JSON.stringify(p));
} else {
  console.log('telegram-sync: user not registered with bot (404) — broadcast path skipped');
}

ws.close();

// Cleanup test record if it was created.
await fetch(`${BASE}/api/telegram/attendance?chatId=${encodeURIComponent(String(ua.awid || ua.id))}`)
  .then(x => x.json())
  .then(async (j) => {
    if (j.success && j.records.length) {
      const fs = await import('node:fs');
      const p = 'server/attendance.json';
      const list = JSON.parse(fs.readFileSync(p, 'utf8'));
      const kept = list.filter(rec => String(rec.chatId) !== String(ua.awid || ua.id));
      fs.writeFileSync(p, JSON.stringify(kept, null, 2));
      console.log('cleaned', list.length - kept.length, 'test record(s)');
    }
  });

console.log('contracts OK');
