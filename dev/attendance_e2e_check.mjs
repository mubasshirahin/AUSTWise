// End-to-end validation of the attendance tracker's server paths:
//   1. authenticated store PUT/GET roundtrip (liveStore's exact endpoints)
//   2. per-user isolation (another account can't read the first user's marks)
//   3. WebSocket store-change broadcast on write (the realtime path)
// Run: node dev/attendance_e2e_check.mjs
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
  const cookies = (res.headers.getSetCookie ? res.headers.getSetCookie() : [])
    .map(c => c.split(';')[0]);
  return cookies.join('; ');
}

// Pick two distinct dev users.
const usersRes = await fetch(`${BASE}/__dev/users`);
const { users = [] } = await usersRes.json();
assert(users.length >= 2, 'at least 2 dev users');
const [ua, ub] = users;
const emailA = ua.email || `${String(ua.id).toLowerCase()}@aust.edu`;
const emailB = ub.email || `${String(ub.id).toLowerCase()}@aust.edu`;

const cookieA = await login(emailA);
const cookieB = await login(emailB);
console.log('logged in:', ua.id, '+', ub.id);

// ── 1. Authenticated store roundtrip ──
const KEY = 'aust-user-routine-attendance-sessions';
const MARKS = { 'CSE 4101::Sunday-w2-2026-08-02': 'present', 'CSE 4101::Tuesday-w2-2026-08-04': 'absent' };

let r = await fetch(`${BASE}/api/store/user/${KEY}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Cookie: cookieA },
  body: JSON.stringify({ value: MARKS }),
});
assert(r.status === 200, `store PUT → 200 (got ${r.status})`);

r = await fetch(`${BASE}/api/store/user/${KEY}`, { headers: { Cookie: cookieA } });
const got = await r.json();
assert(got.success && got.value && got.value['CSE 4101::Sunday-w2-2026-08-02'] === 'present',
  'store GET returns written marks');
console.log('store roundtrip OK:', Object.keys(got.value).length, 'marks');

// ── 2. Per-user isolation ──
r = await fetch(`${BASE}/api/store/user/${KEY}`, { headers: { Cookie: cookieB } });
const other = await r.json();
assert(other.success && (!other.value || Object.keys(other.value).length === 0),
  "user B cannot see user A's marks");
console.log('isolation OK: user B sees', other.value ? Object.keys(other.value).length : 0, 'marks');

// ── 3. WebSocket store-change broadcast ──
// Connect as user B (their liveStore would be subscribed to their own id);
// the broadcast for user A's write must reach only user A's sockets.
const wsWrites = [];
import WebSocket from 'ws';
function openSocket(cookie, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace('http', 'ws') + '/api/ws', {
      // Non-browser clients (no Origin) must present a valid session cookie.
      headers: { Cookie: cookie },
    });
    ws.onopen = () => {
      // The browser client subscribes with its userId; derive from token payload.
      try {
        const token = cookie.split(';').find(c => c.trim().startsWith('aust_token=')).trim().slice('aust_token='.length);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        ws.send(JSON.stringify({ type: 'subscribe', payload: { userId: payload.id } }));
      } catch (e) { /* keep raw socket */ }
      resolve(ws);
    };
    ws.onerror = reject;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'store-change') wsWrites.push({ label, key: msg.payload?.key });
      } catch { /* ignore */ }
    };
  });
}

const wsA = await openSocket(cookieA, 'A');
const wsB = await openSocket(cookieB, 'B');
await wait(300);

await fetch(`${BASE}/api/store/user/${KEY}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Cookie: cookieA },
  body: JSON.stringify({ value: { ...MARKS, 'CSE 4101::Thursday-w3-2026-08-09': 'present' } }),
});
await wait(800);

const aGot = wsWrites.filter(w => w.label === 'A' && w.key === KEY);
const bGot = wsWrites.filter(w => w.label === 'B' && w.key === KEY);
assert(aGot.length > 0, 'user A socket received store-change for their own write');
assert(bGot.length === 0, "user B socket did NOT receive user A's change");
console.log('websocket OK: A got', aGot.length, 'event(s), B got', bGot.length);

wsA.close(); wsB.close();

// Cleanup: delete the test key.
await fetch(`${BASE}/api/store/user/${KEY}`, {
  method: 'DELETE',
  headers: { Cookie: cookieA },
});
console.log('attendance e2e OK');
