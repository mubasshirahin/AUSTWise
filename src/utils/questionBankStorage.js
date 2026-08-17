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

function loadUserQuestions() {
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

function saveUserQuestions(items) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    throw new Error(
      'Could not save this paper. Your browser storage may be full — try a smaller file or remove old uploads.',
    );
  }
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

  await saveQuestionPaperFile(entry.id, fileData);
  const nextItems = [entry, ...loadUserQuestions()];
  saveUserQuestions(nextItems);
  return entry;
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
