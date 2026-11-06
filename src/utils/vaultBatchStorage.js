import { liveLoad, liveSave } from './liveStorage';

// Shared across CR/SR of the same dept/batch (server-guarded; see dev.mjs).
// A batch is identified by its full label ("Quanta 52"), never by the number
// alone — `Quanta 52` and `Encrypt 52` are different batches.
// Shape: { [dept]: { [yearSem]: [ { id, batchName, batchNo, batch, driveUrl,
//                                  updatedById, updatedBy, updatedAt } ],
//                     reactions: { [batchId]: { [userId]: 1 } } } }
const STORE_KEY = 'aust-batch-drives';

function getStore() {
  return liveLoad('shared', STORE_KEY, {});
}
function saveStore(store) {
  liveSave('shared', STORE_KEY, store);
}
function deptBucket(store, department) {
  const dept = department || 'CSE';
  if (!store[dept]) store[dept] = {};
  return store[dept];
}

/** Canonical batch label — a batch is "Quanta 52", not just "52". */
export function normalizeBatchLabel(batchName, batchNo) {
  const name = String(batchName || '').trim();
  const no = String(batchNo || '').trim();
  return [name, no].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Best available label for a user / directory member / stored batch entry.
 * Prefers name + number ("Quanta 52"), falls back to the legacy `batch` field.
 */
export function batchLabelOf(entity) {
  if (!entity) return '';
  const name = String(entity.batchName || '').trim();
  const no = String(entity.batchNo || '').trim();
  if (name && name !== no) return normalizeBatchLabel(name, no);
  if (name && name === no) return name;
  // No name stored separately — the legacy `batch` field may still hold the
  // full "Quanta 52" label; otherwise fall back to the number.
  const raw = String(entity.batch || '').trim();
  if (/[^\d\s]/.test(raw)) return raw;
  return normalizeBatchLabel(name, no) || raw;
}

/**
 * A batch is identified by its full label, not its number: `Quanta 52` and
 * `Encrypt 52` are different batches. Legacy entries that only stored a number
 * still match by number so existing links keep working.
 */
export function sameBatch(a, b) {
  const left = batchLabelOf(a);
  const right = batchLabelOf(b);
  if (left && right && left.toLowerCase() === right.toLowerCase()) return true;
  // Compare numbers only when at least one side has no name part.
  const aHasName = /[^\d\s]/.test(left);
  const bHasName = /[^\d\s]/.test(right);
  if (aHasName && bHasName) return false;
  const aNo = String(a?.batchNo || '').trim();
  const bNo = String(b?.batchNo || '').trim();
  return Boolean(aNo) && aNo === bNo;
}

export function getBatchConfigs(department, yearSem) {
  const bucket = getStore()[department] || {};
  return bucket[yearSem] || [];
}

export function addBatchConfig(department, yearSem, batch) {
  const store = getStore();
  const bucket = deptBucket(store, department);
  const list = bucket[yearSem] || [];
  const entry = {
    id: 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    updatedAt: new Date().toISOString(),
    ...batch,
  };
  list.push(entry);
  bucket[yearSem] = list;
  saveStore(store);
  return entry;
}

export function deleteBatchConfig(department, yearSem, batchId) {
  const store = getStore();
  const bucket = store[department];
  if (!bucket) return;
  bucket[yearSem] = (bucket[yearSem] || []).filter(b => b.id !== batchId);
  saveStore(store);
}

export function updateBatchDriveUrl(department, yearSem, batchId, driveUrl) {
  const store = getStore();
  const bucket = store[department];
  if (!bucket) return;
  const list = bucket[yearSem] || [];
  const idx = list.findIndex(b => b.id === batchId);
  if (idx !== -1) {
    list[idx].driveUrl = driveUrl;
    list[idx].updatedAt = new Date().toISOString();
    bucket[yearSem] = list;
    saveStore(store);
  }
}

/**
 * CR/SR page: set (or replace) the Drive link for one semester of their batch.
 * Every CR/SR of the same department + batch writes to the same shared list, so
 * whoever saves last owns the link — the previous one is replaced, not stacked.
 */
export function upsertBatchDrive(department, yearSem, { batchNo, batchName, driveUrl, userId, userName }) {
  const store = getStore();
  const bucket = deptBucket(store, department);
  const list = bucket[yearSem] || [];
  const idx = list.findIndex((b) => sameBatch(b, { batchName, batchNo }));
  const stamp = {
    batchName: String(batchName || '').trim(),
    batchNo: String(batchNo || '').trim(),
    batch: normalizeBatchLabel(batchName, batchNo),
    driveUrl,
    updatedAt: new Date().toISOString(),
    updatedById: userId || '',
    updatedBy: userName || '',
  };
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...stamp };
  } else {
    list.push({
      id: 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      ...stamp,
    });
  }
  bucket[yearSem] = list;
  saveStore(store);
  return list;
}

/** Clear a semester's link (the batch card disappears from the student view). */
export function removeBatchDrive(department, yearSem, batchNo, userId, userName, batchName = '') {
  const store = getStore();
  const bucket = store[department];
  if (!bucket) return;
  bucket[yearSem] = (bucket[yearSem] || []).map((b) => (
    sameBatch(b, { batchName, batchNo })
      ? {
        ...b,
        driveUrl: '',
        updatedAt: new Date().toISOString(),
        updatedById: userId || '',
        updatedBy: userName || '',
      }
      : b
  ));
  saveStore(store);
}

// 🔥 reactions — students toggle, counts shown on cards
export function getDriveReactions(department, batchId) {
  const bucket = getStore()[department] || {};
  return bucket.reactions?.[batchId] || {};
}
export function toggleDriveReaction(department, batchId, userId) {
  if (!userId) return {};
  const store = getStore();
  const bucket = deptBucket(store, department);
  bucket.reactions = bucket.reactions || {};
  bucket.reactions[batchId] = bucket.reactions[batchId] || {};
  if (bucket.reactions[batchId][userId]) delete bucket.reactions[batchId][userId];
  else bucket.reactions[batchId][userId] = 1;
  saveStore(store);
  return bucket.reactions[batchId];
}
export function getDriveReactionCount(department, batchId) {
  return Object.keys(getDriveReactions(department, batchId)).length;
}
