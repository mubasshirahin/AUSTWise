/**
 * QBA attachments — storage for the files a student attaches to a question.
 *
 * A file belongs to ONE question (and to one box: "real question" or
 * "answer"), so it is keyed by:
 *   `${courseKey}::${topic}::${questionIndex}`
 * (the index is the question's original position inside its topic, so it
 * survives merging and unmerging similar questions). The record itself stores
 * `kind: 'question' | 'answer'` so the two boxes stay separate.
 *
 * Most files are pictures, but PDFs, PPT/PPTX and Word documents are stored
 * byte-for-byte too. Pictures are resized; other files are kept as-is and are
 * shown/printed as a named attachment.
 *
 * The bytes live in IndexedDB — never in localStorage, they are far too big
 * for that. The same records are mirrored to the per-user server store as soon
 * as they are attached or removed, so the files come back on another device.
 *
 * Everything here is client-side and offline-first: the server is a mirror,
 * never a requirement.
 */

import { buildQuestionVersions } from './previewAnalytics';

const DB_NAME = 'aust-qba-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const COURSE_INDEX = 'courseKey';

/** Server store key prefix — one key per course. */
export const SERVER_STORE_PREFIX = 'aust-qba-images-v1';

/** Last time this course's picture list was known to match the server. */
const SYNC_TIME_PREFIX = 'aust-qba-image-sync:';

export function readImageSyncTime(courseKey) {
  try {
    return localStorage.getItem(`${SYNC_TIME_PREFIX}${courseKey}`) || '';
  } catch {
    return '';
  }
}

export function markImageSyncTime(courseKey, isoString = new Date().toISOString()) {
  try {
    localStorage.setItem(`${SYNC_TIME_PREFIX}${courseKey}`, isoString);
    return isoString;
  } catch {
    return '';
  }
}

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;
/** Non-picture files are kept as-is. This is a safety cap, not a count cap. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.svg'];

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
};

function extensionOf(name) {
  const value = String(name || '').toLowerCase();
  const dot = value.lastIndexOf('.');
  return dot >= 0 ? value.slice(dot) : '';
}

/** A useful MIME type even on Windows, where file.type is often empty. */
export function inferMimeType(name) {
  return MIME_BY_EXTENSION[extensionOf(name)] || 'application/octet-stream';
}

export function isImageMime(mime, name = '') {
  const type = String(mime || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.includes(extensionOf(name));
}

/* ── IndexedDB ─────────────────────────────────────────────────────────────── */

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot store pictures (IndexedDB is unavailable).'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex(COURSE_INDEX, COURSE_INDEX, { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the picture storage.'));
  });
}

function runStore(mode, runner) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result;
        try {
          result = runner(store);
        } catch (err) {
          reject(err);
          return;
        }

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Picture storage transaction failed.'));
        tx.onabort = () => reject(tx.error || new Error('Picture storage transaction aborted.'));
      }),
  );
}

/* ── keys ──────────────────────────────────────────────────────────────────── */

/** A stable, URL-safe id for a course ("CSE 3101" → "cse-3101"). */
export function courseSlug(courseCode) {
  const slug = String(courseCode || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'default';
}

/** The key of one picture slot: course + topic + question position. */
export function questionImageKey(courseKey, topicName, questionIndex) {
  const topic = String(topicName || '').trim().toLowerCase();
  return `${courseKey}::${topic}::${questionIndex}`;
}

/**
 * The key of one picture slot in the raw semester papers. `@semester` keeps
 * these apart from topic keys (a topic could theoretically be named "spring
 * 2017").
 */
export function semesterImageKey(courseKey, semester, questionIndex) {
  const name = String(semester || '').trim().toLowerCase();
  return `${courseKey}::@semester::${name}::${questionIndex}`;
}

function attachmentForReport(image) {
  const entry = { name: image.name, url: image.url };
  if (image.mime) entry.mime = image.mime;
  if (image.size) entry.size = image.size;
  if (image.media) entry.media = image.media;
  return entry;
}

function splitAttachments(list) {
  const question = [];
  const answer = [];
  (Array.isArray(list) ? list : []).forEach((image) => {
    if (!image || !image.url) return;
    const target = image.kind === 'answer' ? answer : question;
    target.push(attachmentForReport(image));
  });
  return { question, answer };
}

/**
 * Copy the attached files into a report so the print report can show them
 * under their question. The report itself is left untouched — the caller
 * decides whether the result is for printing or for saving.
 *
 * Records created before the question/answer split have no `kind`; they are
 * treated as question pictures so old data keeps working.
 */
export function attachImagesToReport(report, courseKey, byQuestion) {
  if (!report || !Array.isArray(report.topics)) return report;
  if (!byQuestion || !Object.keys(byQuestion).length) return report;

  const topics = report.topics.map((topic) => {
    const questions = (Array.isArray(topic.questions) ? topic.questions : []).map((question, index) => {
      const originalIndex = question.originalIndex ?? index;
      const baseKey = questionImageKey(courseKey, topic.name, originalIndex);
      const base = splitAttachments(byQuestion[baseKey]);

      // Every wording keeps its own attachments: the first one shares the
      // row's slot (so files added before the versions were shown still
      // appear), later ones use the slot the preview gives them.
      const versions = buildQuestionVersions(question);
      const versionImages = versions.map((version) => {
        const source = typeof version.sourceIndex === 'number' ? version.sourceIndex : originalIndex;
        const baseSlot = questionImageKey(courseKey, topic.name, source);
        const key = version.slot ? `${baseSlot}::${version.slot}` : baseSlot;
        return splitAttachments(byQuestion[key]).question;
      });
      const versionAnswerImages = versions.map((version) => {
        const source = typeof version.sourceIndex === 'number' ? version.sourceIndex : originalIndex;
        const baseSlot = questionImageKey(courseKey, topic.name, source);
        const key = version.slot ? `${baseSlot}::${version.slot}` : baseSlot;
        return splitAttachments(byQuestion[key]).answer;
      });

      const hasVersionImages = versionImages.some((images) => images.length);
      const hasVersionAnswers = versionAnswerImages.some((images) => images.length);
      if (
        !base.question.length
        && !base.answer.length
        && !hasVersionImages
        && !hasVersionAnswers
      ) {
        return question;
      }

      return {
        ...question,
        ...(base.question.length ? { images: base.question } : {}),
        ...(base.answer.length ? { answerImages: base.answer } : {}),
        ...(hasVersionImages ? { versionImages } : {}),
        ...(hasVersionAnswers ? { versionAnswerImages } : {}),
      };
    });
    return { ...topic, questions };
  });

  const semesterPapers = (Array.isArray(report.semesterPapers) ? report.semesterPapers : []).map((paper) => {
    const questions = (Array.isArray(paper.questions) ? paper.questions : []).map((question, index) => {
      const split = splitAttachments(byQuestion[semesterImageKey(courseKey, paper.semester, index)]);
      if (!split.question.length && !split.answer.length) return question;
      return {
        ...question,
        ...(split.question.length ? { images: split.question } : {}),
        ...(split.answer.length ? { answerImages: split.answer } : {}),
      };
    });
    return { ...paper, questions };
  });

  return { ...report, topics, semesterPapers };
}

/**
 * Merge the local picture cache with the server mirror.
 *
 * The server is authoritative for pictures that were synced before: if it no
 * longer has one, it was deleted on another device and is dropped here. A
 * picture added after the last sync (or while offline) is kept and pushed.
 *
 * @param {Array} local - records in IndexedDB
 * @param {Array} remote - records from the server (which just answered)
 * @param {string} lastSync - ISO time of the last successful sync ('' if none)
 * @returns {{ merged: Array, unsynced: Array, dropped: Array }}
 */
export function mergeImageLists(local, remote, lastSync) {
  const localList = Array.isArray(local) ? local : [];
  const remoteList = Array.isArray(remote) ? remote : [];
  const remoteIds = new Set(remoteList.map((record) => record.id));
  const unsynced = localList.filter((record) => (
    !remoteIds.has(record.id)
    && (!lastSync || String(record.createdAt || '') > lastSync)
  ));
  const merged = [...remoteList, ...unsynced];
  const keptIds = new Set(merged.map((record) => record.id));
  const dropped = localList.filter((record) => !keptIds.has(record.id));
  return { merged, unsynced, dropped };
}

/* ── image preparation ─────────────────────────────────────────────────────── */

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`"${file.name}" could not be read as an image.`));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error(`"${file.name}" could not be read.`));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be prepared.'))),
        mime,
        quality,
      );
      return;
    }
    try {
      const dataUrl = canvas.toDataURL(mime, quality);
      resolve(dataUrlToBlob(dataUrl));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Shrink and re-encode a picked picture so it stays small enough for
 * IndexedDB, for the server mirror and for the print report.
 *
 * PNG stays PNG (diagrams keep their sharp lines) unless it grows past
 * 1.2 MB, then it falls back to JPEG. Every other browser-readable image
 * (GIF, BMP, SVG, …) becomes JPEG on a white background.
 */
export async function prepareImageFile(file) {
  if (!file) throw new Error('No file was given.');
  const type = String(file.type || '').toLowerCase();
  if (!isImageMime(type, file.name)) {
    throw new Error(`"${file.name}" is not a picture.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`"${file.name}" is bigger than 8 MB.`);
  }

  const image = await loadImageElement(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process pictures.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 'image/jpeg', 0.86);
  let mime = 'image/jpeg';
  if (type === 'image/png') {
    const png = await canvasToBlob(canvas, 'image/png');
    if (png && png.size <= 1.2 * 1024 * 1024) {
      blob = png;
      mime = 'image/png';
    }
  }

  return {
    blob,
    mime,
    size: blob.size,
    width,
    height,
    name: file.name || 'picture',
    media: 'image',
  };
}

/**
 * Prepare anything the student drops into a question/answer box.
 *
 * Pictures are resized and re-encoded. PDF, PPT, PPTX, DOC, DOCX and any other
 * file are stored byte-for-byte and rendered as a named attachment.
 */
export async function prepareAttachmentFile(file) {
  if (!file) throw new Error('No file was given.');
  if (isImageMime(file.type, file.name)) {
    return prepareImageFile(file);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is bigger than 25 MB.`);
  }
  return {
    blob: file,
    mime: String(file.type || '').toLowerCase() || inferMimeType(file.name),
    size: file.size,
    width: 0,
    height: 0,
    name: file.name || 'attachment',
    media: 'file',
  };
}

/* ── records ───────────────────────────────────────────────────────────────── */

function newImageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function saveImage(record) {
  await runStore('readwrite', (store) => {
    store.put(record);
  });
  return record;
}

export async function listImages(courseKey) {
  const records = await runStore('readonly', (store) => {
    const request = store.index(COURSE_INDEX).getAll(courseKey);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Could not read the stored pictures.'));
    });
  });
  return records.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function deleteImage(id) {
  await runStore('readwrite', (store) => {
    store.delete(id);
  });
}

export async function clearCourseImages(courseKey) {
  const records = await listImages(courseKey);
  await Promise.all(records.map((record) => deleteImage(record.id)));
}

/* ── blobs ↔ data URLs ─────────────────────────────────────────────────────── */

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the picture.'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

/* ── server mirror ─────────────────────────────────────────────────────────── */

function serverKey(courseKey) {
  return `${SERVER_STORE_PREFIX}:${courseKey}`;
}

/**
 * Copy every picture of a course to the per-user server store so another
 * device can fetch them. Returns true when the server accepted them.
 *
 * An empty list is pushed too: otherwise a picture the student deleted would
 * stay on the server and come back on a new device.
 */
export async function pushImagesToServer(courseKey, records) {
  const payload = [];
  for (const record of records || []) {
    payload.push({
      id: record.id,
      questionKey: record.questionKey,
      name: record.name,
      mime: record.mime,
      size: record.size,
      width: record.width,
      height: record.height,
      kind: record.kind === 'answer' ? 'answer' : 'question',
      media: record.media === 'file' ? 'file' : 'image',
      createdAt: record.createdAt,
      dataUrl: await blobToDataUrl(record.blob),
    });
  }

  const res = await fetch(`/api/store/user/${encodeURIComponent(serverKey(courseKey))}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: payload }),
  });
  return res.ok;
}

/**
 * Fetch the mirrored pictures of a course.
 *
 * @returns {Promise<{ ok: boolean, records: Array }>} `ok` says whether the
 *   server answered. `ok: false` must never be treated as "no pictures" —
 *   that would let a failed request wipe the local copy.
 */
export async function pullImagesFromServer(courseKey) {
  try {
    const res = await fetch(`/api/store/user/${encodeURIComponent(serverKey(courseKey))}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return { ok: false, records: [] };
    const json = await res.json();
    const list = Array.isArray(json.value)
      ? json.value
      : (Array.isArray(json.value?.images) ? json.value.images : []);
    const records = list
      .map((item) => {
        const blob = dataUrlToBlob(item.dataUrl);
        if (!blob) return null;
        return {
          id: item.id || newImageId(),
          courseKey,
          questionKey: item.questionKey,
          kind: item.kind === 'answer' ? 'answer' : 'question',
          media: item.media === 'file'
            ? 'file'
            : item.media === 'image'
              ? 'image'
              : (isImageMime(item.mime || blob.type, item.name) ? 'image' : 'file'),
          name: item.name || 'attachment',
          mime: item.mime || blob.type || inferMimeType(item.name),
          size: item.size || blob.size,
          width: item.width || 0,
          height: item.height || 0,
          blob,
          createdAt: item.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);
    return { ok: true, records };
  } catch {
    return { ok: false, records: [] };
  }
}
