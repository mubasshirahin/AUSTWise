import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'accessFlow.json');

async function readStore() {
  try {
    const value = JSON.parse(await readFile(storePath, 'utf8'));
    return { requests: Array.isArray(value.requests) ? value.requests : [], invitations: Array.isArray(value.invitations) ? value.invitations : [] };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[AccessFlow] Could not read store:', error.message);
    return { requests: [], invitations: [] };
  }
}

async function writeStore(store) {
  const tempPath = `${storePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8');
  await rename(tempPath, storePath);
}

export async function listAccessRequests() {
  return (await readStore()).requests;
}

export async function addAccessRequest(payload) {
  const store = await readStore();
  const email = String(payload.email || '').trim().toLowerCase();
  const role = String(payload.role || '').trim().toLowerCase();
  const duplicate = store.requests.find((item) => item.email === email && item.role === role && item.status === 'pending');
  if (duplicate) return { duplicate: true, request: duplicate };
  const request = {
    id: `AR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: String(payload.name || '').trim(),
    email,
    passwordHash: String(payload.passwordHash || ''),
    role,
    department: String(payload.department || '').trim(),
    designation: String(payload.designation || '').trim(),
    batch: String(payload.batch || '').trim(),
    graduationYear: String(payload.graduationYear || '').trim(),
    company: String(payload.company || '').trim(),
    previousEmail: String(payload.previousEmail || '').trim().toLowerCase(),
    note: String(payload.note || '').trim().slice(0, 1000),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  store.requests.unshift(request);
  await writeStore(store);
  return { duplicate: false, request };
}

export async function reviewAccessRequest(id, status, reviewedBy, invite = null) {
  const store = await readStore();
  const request = store.requests.find((item) => item.id === id);
  if (!request || request.status !== 'pending') return null;
  request.status = status;
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = reviewedBy || 'Admin';
  if (invite) {
    store.invitations.unshift(invite);
    request.invitationId = invite.id;
  }
  // The applicant's password is only needed while this request is pending.
  // Remove its bcrypt hash as soon as the request has been decided.
  delete request.passwordHash;
  await writeStore(store);
  return request;
}

export async function addInvitation(invitation) {
  const store = await readStore();
  const active = store.invitations.find((item) => item.email === invitation.email && item.status === 'pending' && new Date(item.expiresAt) > new Date());
  if (active) return { duplicate: true, invitation: active };
  store.invitations.unshift(invitation);
  await writeStore(store);
  return { duplicate: false, invitation };
}

export async function listInvitations() {
  return (await readStore()).invitations;
}

export async function removeInvitation(id) {
  const store = await readStore();
  const previousCount = store.invitations.length;
  store.invitations = store.invitations.filter((item) => item.id !== id);
  if (store.invitations.length === previousCount) return false;
  await writeStore(store);
  return true;
}

export async function findInvitationByHash(tokenHash) {
  const store = await readStore();
  return store.invitations.find((item) => item.tokenHash === tokenHash) || null;
}

export async function updateInvitation(id, patch) {
  const store = await readStore();
  const invitation = store.invitations.find((item) => item.id === id);
  if (!invitation) return null;
  Object.assign(invitation, patch);
  await writeStore(store);
  return invitation;
}
