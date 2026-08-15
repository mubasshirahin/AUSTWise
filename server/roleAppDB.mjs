/**
 * Role application store (CR/SR) — JSON file database.
 *
 * The role application flow used to live entirely in the browser's
 * localStorage, which meant applications never reached the admin on a
 * different device and the notification was shown to the applicant instead
 * of the admin. Persisting them server-side lets the admin reliably see every
 * application and be notified (bell + native popup) the moment one arrives.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'roleApplications.json');

export async function listRoleApplications() {
  try {
    const raw = await readFile(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getRoleApplicationsByUser(userId) {
  const all = await listRoleApplications();
  return all.filter((a) => a.userId === userId);
}

export async function createRoleApplication(app) {
  const all = await listRoleApplications();
  all.push(app);
  await writeFile(DB_PATH, JSON.stringify(all, null, 2));
  return app;
}

export async function updateRoleApplication(id, patch) {
  const all = await listRoleApplications();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeFile(DB_PATH, JSON.stringify(all, null, 2));
  return all[idx];
}