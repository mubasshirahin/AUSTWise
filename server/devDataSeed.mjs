/**
 * Seeds realistic "internal data" for the dev users created by seedDevUsers():
 *
 *  1. Shared routines  — every CR (one per dept × semester × section × lab
 *     group) publishes a class routine for their exact slot, so switching into
 *     any student in that lab group shows the routine CRs share with them.
 *  2. Messages         — a few DMs between each section's CR/SR and their lab
 *     mates, so the messaging feature has conversations to look at.
 *
 * Re-runs REPLACE the previous dev-seeded records (ids starting with `dev-` /
 * crIds starting with `DEV-`) and never touch real user data.
 */
import { readJson, writeJson } from './jsonDB.mjs';
import { readUsers } from './userStore.mjs';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const TIME_SLOTS = ['08:00 - 08:50', '09:00 - 09:50', '10:00 - 10:50', '11:00 - 11:50', '12:00 - 12:50', '14:00 - 14:50', '15:00 - 15:50'];
const ROOMS = ['2A03', '2A04', '2A05', '2A06', '2A07', '3A01', '3A02', '4B01', '5A01', '6B02'];
const TEACHERS = [
  'Prof. A. Rahman', 'Dr. S. Karim', 'Mr. M. Hasan', 'Ms. F. Jahan',
  'Dr. T. Chowdhury', 'Prof. K. Islam', 'Mr. R. Hossain', 'Dr. N. Akter',
  'Mr. J. Ahmed', 'Dr. L. Sultana',
];
const FOUNDATION = ['MATH', 'PHY', 'ENG', 'HUM', 'EEE'];

/** Deterministic PRNG (same seed → same data on every run). */
function seeded(seedStr) {
  let x = seedStr.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 2147483647 || 1;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function courseCodes(dept, sem) {
  const codes = [];
  for (let i = 1; i <= 6; i += 1) codes.push(`${dept}${sem}${String(i).padStart(2, '0')}`);
  for (let i = 0; i < FOUNDATION.length; i += 1) codes.push(`${FOUNDATION[i]}${sem}${String(i + 1).padStart(2, '0')}`);
  return codes;
}

function buildRoutine(dept, sem, section, lab) {
  const rand = seeded(`routine-${dept}-${sem}-${section}-${lab}`);
  const codes = courseCodes(dept, Number(sem));
  const routine = {};
  DAYS.forEach((day, dayIdx) => {
    const classCount = 2 + (dayIdx % 2); // 2-3 classes a day
    const classes = [];
    for (let c = 0; c < classCount; c += 1) {
      classes.push({
        id: `dev-${dept}-${sem}-${section}${lab}-${day}-${c}`,
        time: TIME_SLOTS[(dayIdx * 2 + c) % TIME_SLOTS.length],
        course: codes[(dayIdx + c) % codes.length],
        teacher: TEACHERS[Math.floor(rand() * TEACHERS.length)],
        room: ROOMS[Math.floor(rand() * ROOMS.length)],
        type: c % 3 === 0 ? 'Lab' : 'Theory',
      });
    }
    routine[day] = classes;
  });
  return routine;
}

/** One shared routine per CR slot (dept × yearSemester × section × lab). */
export async function seedDevSharedRoutines() {
  const users = await readUsers();
  const crs = users.filter((u) => u.id && String(u.id).startsWith('DEV-') && u.role === 'cr');
  const now = new Date().toISOString();
  const routines = crs.map((cr) => ({
    id: `dev-rt-${cr.id}`,
    crId: cr.id,
    crName: cr.name,
    department: cr.department,
    yearSemester: cr.yearSemester,
    section: cr.section,
    labSection: cr.labSection,
    routine: JSON.stringify(buildRoutine(cr.department, cr.semester, cr.section, cr.labSection)),
    weekDays: JSON.stringify(DAYS),
    createdAt: now,
    updatedAt: now,
  }));

  const existing = await readJson('shared_routines.json');
  const kept = existing.filter((r) => !(r.crId && String(r.crId).startsWith('DEV-')));
  await writeJson('shared_routines.json', [...kept, ...routines]);
  return routines.length;
}

const MESSAGE_SCRIPTS = [
  ['cr', 's2', 'Hey! The new class routine is out — load it from the Routine tab 👍'],
  ['s2', 'cr', 'Got it, thanks CR! Looks good.'],
  ['sr', 'cr', 'Send me the attendance sheet by Sunday evening.'],
  ['cr', 'sr', 'On it, will send tonight.'],
  ['cr', 's3', 'Lab {LAB} viva tomorrow — bring your ID and the lab copy.'],
];

/** A handful of DMs per section: CR ↔ lab mates and SR ↔ CR. */
export async function seedDevMessages() {
  const users = await readUsers();
  const devUsers = users.filter((u) => u.id && String(u.id).startsWith('DEV-'));
  const sections = new Map(); // `${dept}|${sem}|${section}` -> { dept, sem, section, lab, cr, s2, s3, sr }

  for (const u of devUsers) {
    if (u.role !== 'student' && u.role !== 'cr' && u.role !== 'sr') continue;
    if (!u.section || !u.semester) continue;
    const key = `${u.department}|${u.semester}|${u.section}`;
    if (!sections.has(key)) sections.set(key, { dept: u.department, sem: u.semester, section: u.section, lab: u.labSection || '', cr: null, s2: null, s3: null, sr: null });
    const entry = sections.get(key);
    if (u.role === 'sr') entry.sr = u;
    else if (u.role === 'cr' && u.labSection) {
      if (!entry.cr) entry.cr = u;
    } else if (u.role === 'student') {
      const n = Number(String(u.email).match(/-(\d+)@/)?.[1] || 0);
      if (n === 2) entry.s2 = u;
      if (n === 3) entry.s3 = u;
    }
  }

  const messages = [];
  let counter = 1;
  const push = (from, to, text) => {
    if (!from || !to) return;
    messages.push({
      id: `dev-msg-${String(counter++).padStart(5, '0')}`,
      conversationId: [from.id, to.id].sort().join('|'),
      fromId: from.id,
      toId: to.id,
      text,
      timestamp: new Date(Date.now() - counter * 3600 * 1000).toISOString(),
      read: false,
      deleted: false,
      edited: false,
      editedAt: null,
      replyTo: null,
    });
  };

  for (const sec of sections.values()) {
    for (const [fromKey, toKey, text] of MESSAGE_SCRIPTS) {
      push(sec[fromKey], sec[toKey], text.replace('{LAB}', sec.lab));
    }
  }

  const existing = await readJson('messages.json');
  const kept = existing.filter(
    (m) => !(String(m.id || '').startsWith('dev-msg-') || (m.fromId && String(m.fromId).startsWith('DEV-')))
  );
  await writeJson('messages.json', [...kept, ...messages]);
  return messages.length;
}

/** Seed all dev "internal data". Returns per-collection counts. */
export async function seedDevData() {
  const routines = await seedDevSharedRoutines();
  const messages = await seedDevMessages();
  return { sharedRoutines: routines, messages };
}
