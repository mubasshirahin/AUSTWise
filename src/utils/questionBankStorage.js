import { ALL_EXAM_TYPES } from '../features/vault/vaultExamTypes';
import { getCurrentUserId, getAccountById, accountToUser } from './authStorage';
import { getSellerLabel } from './marketplaceStorage';
import {
  deleteQuestionPaperFile,
  getQuestionPaperFile,
  saveQuestionPaperFile,
} from './questionBankFileStorage';

const VALID_EXAM_TYPES = ALL_EXAM_TYPES;

const storageKey = 'aust-question-bank-user-v2';
const legacyStorageKey = 'aust-question-bank-user-v1';
export const MAX_QUESTION_PAPER_BYTES = 8 * 1024 * 1024;

function formatMaxFileSize(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

async function loadFileDataAsBytes(fileData) {
  const raw = String(fileData || '').trim();
  if (!raw) return null;
  const response = await fetch(raw);
  return new Uint8Array(await response.arrayBuffer());
}

function isPdfBytes(bytes) {
  if (!bytes || bytes.length < 4) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function isUserUploadedPaper(item) {
  return Boolean(item?.isUserUpload);
}

function paperHasStoredFile(item) {
  return Boolean(item?.hasFile || item?.fileData);
}

// Server-backed question bank. localStorage/indexedDB stay as the offline
// cache: reads try the API first, fall back to local copies when the server
// is unreachable; writes push to the API and mirror locally.
let _serverPapers = null; // full list from the API, cached per session
let _serverFetchStarted = false;

async function fetchServerPapers() {
  if (_serverPapers) return _serverPapers;
  try {
    const res = await fetch('/api/question-papers', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('api');
    const data = await res.json();
    if (data?.success && Array.isArray(data.papers)) {
      _serverPapers = data.papers;
      _serverFetchStarted = true;
      return data.papers;
    }
  } catch { /* ignore */ }
  return null;
}

function loadLocalQuestions() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isUserUploadedPaper) : [];
    }

    const legacyRaw = localStorage.getItem(legacyStorageKey);
    if (!legacyRaw) return [];

    const legacyItems = JSON.parse(legacyRaw);
    const userItems = Array.isArray(legacyItems) ? legacyItems.filter(isUserUploadedPaper) : [];
    localStorage.removeItem(legacyStorageKey);
    if (userItems.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(userItems));
    }
    return userItems;
  } catch {
    return [];
  }
}

/** Synchronous read for the UI — returns the current local cache. Fresh
 *  server data is pulled in the background by refreshQuestionBank(). */
function loadUserQuestions() {
  return loadLocalQuestions();
}

/** Pull the latest papers from the server and merge into local cache. */
export async function refreshQuestionBank() {
  const server = await fetchServerPapers();
  if (!server) return loadLocalQuestions();
  try { localStorage.setItem(storageKey, JSON.stringify(server)); } catch { /* ignore */ }
  return server;
}

function saveUserQuestions(items) {
  try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* ignore */ }
}

async function resolvePaperFileData(item) {
  if (!item) return '';

  if (item.fileData) {
    await saveQuestionPaperFile(item.id, item.fileData).catch(() => {});
    return item.fileData;
  }

  return getQuestionPaperFile(item.id);
}

async function migrateInlineFileToIndexedDb(item) {
  if (!item?.id || !item.fileData) return item;

  await saveQuestionPaperFile(item.id, item.fileData);
  const { fileData: _fileData, ...rest } = item;
  return { ...rest, hasFile: true };
}

export function getAllQuestionBankItems() {
  return loadUserQuestions();
}

export function getQuestionBankSummaries() {
  return loadUserQuestions().map(({ fileData, ...summary }) => ({
    ...summary,
    hasFile: paperHasStoredFile({ ...summary, fileData }),
  }));
}

export async function getPaperForViewing(paperId) {
  const item = loadUserQuestions().find((entry) => entry.id === paperId);
  if (!item || !paperHasStoredFile(item)) {
    throw new Error('Question paper not found.');
  }

  const fileData = await resolvePaperFileData(item);
  if (!fileData) {
    throw new Error('Paper file is missing. Upload it again.');
  }

  return { ...item, fileData };
}

/** @deprecated Use getPaperForViewing */
export const getProtectedPaperForViewing = getPaperForViewing;

export async function addQuestionPaper(payload) {
  const type = String(payload.type || '').trim();
  const paperNo = Number(payload.paperNo ?? payload.questions);
  const fileData = String(payload.fileData || '').trim();
  const fileName = String(payload.fileName || '').trim();
  const fileType = payload.fileType || 'pdf';

  if (!VALID_EXAM_TYPES.includes(type)) {
    throw new Error('Select a valid exam type.');
  }
  if (!Number.isFinite(paperNo) || paperNo < 1) {
    throw new Error('Enter a valid number (e.g. 1 for Online 1).');
  }
  if (!fileData || !fileName) {
    throw new Error('Upload a PDF or image of the question paper.');
  }

  if (fileType === 'pdf') {
    const bytes = await loadFileDataAsBytes(fileData);
    if (!isPdfBytes(bytes)) {
      throw new Error('That file is not a valid PDF. Choose another file.');
    }
  }

  const account = getAccountById(getCurrentUserId() || '');
  const profile = account ? accountToUser(account) : null;
  const entry = {
    id: `user-${crypto.randomUUID()}`,
    isUserUpload: true,
    contributorId: profile?.id || 'guest',
    contributorName: getSellerLabel(profile),
    department: payload.department,
    yearSem: payload.yearSem,
    course: payload.course,
    name: payload.name,
    type,
    year: payload.year,
    semester: payload.semester,
    paperNo: Math.round(paperNo),
    solved: Boolean(payload.solved),
    fileName,
    fileType,
    hasFile: true,
    uploadedAt: new Date().toISOString(),
  };

  // Push to the server first (file included), keeping local copies as fallback.
  try {
    const res = await fetch('/api/question-papers', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData,
        fileName,
        fileType: fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
        department: entry.department,
        yearSem: entry.yearSem,
        course: entry.course,
        name: entry.name,
        type,
        year: entry.year,
        semester: entry.semester,
        paperNo: entry.paperNo,
        solved: entry.solved,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Server rejected the upload.');
    }
    // Server is authoritative — refresh the local cache from it.
    const serverEntry = data.paper;
    await saveQuestionPaperFile(serverEntry.id, fileData);
    const nextItems = [serverEntry, ...loadUserQuestions().filter((item) => item.id !== serverEntry.id)];
    saveUserQuestions(nextItems);
    return serverEntry;
  } catch {
    // Offline / server down — keep the local-only copy.
    await saveQuestionPaperFile(entry.id, fileData);
    const nextItems = [entry, ...loadUserQuestions()];
    saveUserQuestions(nextItems);
    return entry;
  }
}

export async function deleteQuestionPaper(id, userId, isAdmin = false) {
  const items = loadUserQuestions();
  const target = items.find((item) => item.id === id);
  if (!target) throw new Error('Question paper not found.');
  if (!isAdmin && target.contributorId !== userId) {
    throw new Error('You can only delete your own uploads.');
  }

  await deleteQuestionPaperFile(id).catch(() => {});
  const nextItems = items.filter((item) => item.id !== id);
  saveUserQuestions(nextItems);
  // Best-effort server delete.
  try {
    await fetch('/api/question-papers/' + encodeURIComponent(id), {
      method: 'DELETE',
      credentials: 'same-origin',
    });
  } catch { /* offline — local delete stands */ }
}

export async function readQuestionPaperFile(file, maxBytes = MAX_QUESTION_PAPER_BYTES) {
  if (!file) throw new Error('Choose a file to upload.');
  if (file.size > maxBytes) {
    throw new Error(`File must be under ${formatMaxFileSize(maxBytes)}.`);
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Upload a PDF, JPG, PNG, or WEBP file.');
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'application/pdf') {
    const bytes = await loadFileDataAsBytes(dataUrl);
    if (!isPdfBytes(bytes)) {
      throw new Error('That file is not a valid PDF. Choose another file.');
    }
  }

  return {
    fileData: dataUrl,
    fileName: file.name,
    fileType: file.type === 'application/pdf' ? 'pdf' : 'image',
  };
}

export async function migrateQuestionBankFilesToIndexedDb() {
  const items = loadUserQuestions();
  let changed = false;

  const migrated = await Promise.all(
    items.map(async (item) => {
      if (!item.fileData) return item;
      changed = true;
      return migrateInlineFileToIndexedDb(item);
    }),
  );

  if (changed) {
    saveUserQuestions(migrated);
  }
}
