/**
 * QBA pictures — storage for the images a student attaches to a question.
 *
 * A picture belongs to ONE question, so it is keyed by
 *   `${courseKey}::${topic}::${questionIndex}`
 * (the index is the question's original position inside its topic, so it
 * survives merging and unmerging similar questions).
 *
 * The bytes live in IndexedDB — never in localStorage, they are far too big
 * for that. The same records are mirrored to the per-user server store when
 * the student presses "Save Preview", so the pictures come back on another
 * device.
 *
 * Everything here is client-side and offline-first: the server is a mirror,
 * never a requirement.
 */

const DB_NAME = 'aust-qba-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const COURSE_INDEX = 'courseKey';

/** Server store key prefix — one key per course. */
export const SERVER_STORE_PREFIX = 'aust-qba-images-v1';

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;
export const MAX_IMAGES_PER_QUESTION = 6;

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
 * Copy the attached pictures into a report so the print report can show them
 * under their question. The report itself is left untouched — the caller
 * decides whether the result is for printing or for saving.
 */
export function attachImagesToReport(report, courseKey, byQuestion) {
  if (!report || !Array.isArray(report.topics)) return report;
  if (!byQuestion || !Object.keys(byQuestion).length) return report;

  const topics = report.topics.map((topic) => {
    const questions = (Array.isArray(topic.questions) ? topic.questions : []).map((question, index) => {
      const originalIndex = question.originalIndex ?? index;
      const list = byQuestion[questionImageKey(courseKey, topic.name, originalIndex)];
      if (!list || !list.length) return question;
      return {
        ...question,
        images: list.map((image) => ({ name: image.name, url: image.url })),
      };
    });
    return { ...topic, questions };
  });

  return { ...report, topics };
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
 * Shrink and re-encode a picked file so it stays small enough for IndexedDB,
 * for the server mirror and for the print report.
 *
 * PNG stays PNG (diagrams keep their sharp lines) unless it grows past
 * 1.2 MB, then it falls back to JPEG.
 */
export async function prepareImageFile(file) {
  if (!file) throw new Error('No file was given.');
  const type = String(file.type || '').toLowerCase();
  if (!IMAGE_MIME_TYPES.includes(type)) {
    throw new Error(`"${file.name}" is not a PNG, JPG or WebP picture.`);
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
 */
export async function pushImagesToServer(courseKey, records) {
  if (!records.length) return true;
  const payload = [];
  for (const record of records) {
    payload.push({
      id: record.id,
      questionKey: record.questionKey,
      name: record.name,
      mime: record.mime,
      size: record.size,
      width: record.width,
      height: record.height,
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

/** Fetch the mirrored pictures of a course (empty when there are none). */
export async function pullImagesFromServer(courseKey) {
  try {
    const res = await fetch(`/api/store/user/${encodeURIComponent(serverKey(courseKey))}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json.value) ? json.value : [];
    return list
      .map((item) => {
        const blob = dataUrlToBlob(item.dataUrl);
        if (!blob) return null;
        return {
          id: item.id || newImageId(),
          courseKey,
          questionKey: item.questionKey,
          name: item.name || 'picture',
          mime: item.mime || blob.type || 'image/jpeg',
          size: item.size || blob.size,
          width: item.width || 0,
          height: item.height || 0,
          blob,
          createdAt: item.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
