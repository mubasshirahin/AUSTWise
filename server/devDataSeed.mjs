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

/** Remove old generated routine fixtures and don't create fake shared routines. */
export async function seedDevSharedRoutines() {
  const existing = await readJson('shared_routines.json');
  const kept = existing.filter((r) => !String(r.id || '').startsWith('dev-rt-'));
  if (kept.length !== existing.length) await writeJson('shared_routines.json', kept);
  return 0;
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
