/**
 * Original-question screenshots: cut regions out of the student's own
 * PDF / image files entirely in the browser (no upload, no backend).
 *
 *   - Source cells come from the parser (see parseQuestionBank.js).
 *   - Files live as Blobs in IndexedDB so they survive a reload.
 *   - Cropping uses pdfjs-dist (pinned via package.json) with a cdnjs
 *     worker; the render only paints the crop area (transform shift).
 *   - Box overrides from Adjust mode live in localStorage.
 */

// ─── file matching ──────────────────────────────────────────────────────────

function normalizeFileName(name) {
  return String(name ?? '').trim().toLowerCase();
}

/** Space-vs-underscore insensitive key for fallback matching. */
function looseFileName(name) {
  return normalizeFileName(name).replace(/[\s_]+/g, '');
}

/**
 * Find which provided file satisfies a needed name.
 * Exact match first, then case-insensitive, then space/underscore-insensitive.
 */
export function matchSourceFile(needed, provided) {
  const need = normalizeFileName(needed);
  if (!need) return null;
  const list = Array.isArray(provided) ? provided : [];
  const exact = list.find((f) => normalizeFileName(f?.name) === need);
  if (exact) return exact;
  const ci = list.find((f) => normalizeFileName(f?.name) === need);
  if (ci) return ci;
  const loose = looseFileName(needed);
  return list.find((f) => looseFileName(f?.name) === loose) || null;
}

// ─── IndexedDB blob store (files survive reload) ──────────────────────────

const DB_NAME = 'aust-qba-original';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_OVERRIDES = 'overrides';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_OVERRIDES)) {
        db.createObjectStore(STORE_OVERRIDES, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(store, mode).objectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

/** Store a File/Blob under its file name. */
export async function storeSourceFile(file) {
  if (!file || !file.name) throw new Error('No file given.');
  const entry = { name: file.name, blob: file, size: file.size, type: file.type, savedAt: Date.now() };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_FILES, 'readwrite').objectStore(STORE_FILES).put(entry);
    request.onsuccess = () => resolve(entry);
    request.onerror = () => reject(request.error);
  });
}

export async function listSourceFiles() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_FILES, 'readonly').objectStore(STORE_FILES).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSourceFile(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_FILES, 'readwrite').objectStore(STORE_FILES).delete(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSourceFiles() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_FILES, 'readwrite').objectStore(STORE_FILES).clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ─── override store (Adjust mode corrections) ──────────────────────────────

/** Key: `${semester}|${n}|${regionIndex}` — one override per cropped region. */
export function overrideKey(semester, n, regionIndex) {
  return `${String(semester ?? '').trim()}|${Number(n) || 0}|${Number(regionIndex) || 0}`;
}

export async function saveOverride(key, box) {
  if (!key) return;
  const entry = { key, box, savedAt: Date.now() };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_OVERRIDES, 'readwrite').objectStore(STORE_OVERRIDES).put(entry);
    request.onsuccess = () => resolve(entry);
    request.onerror = () => reject(request.error);
  });
}

export async function getOverrides() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_OVERRIDES, 'readonly').objectStore(STORE_OVERRIDES).getAll();
    request.onsuccess = () => {
      const out = {};
      (request.result || []).forEach((entry) => { if (entry?.key) out[entry.key] = entry.box; });
      resolve(out);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOverride(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_OVERRIDES, 'readwrite').objectStore(STORE_OVERRIDES).delete(key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ─── cropping ───────────────────────────────────────────────────────────────

let pdfjsPromise = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((module) => {
      const pdfjs = module.default || module;
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '6.1.200'}/pdf.worker.min.mjs`;
      } catch { /* worker falls back to the bundled viewer */ }
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const docCache = new Map(); // blobKey -> { pdf, promise }

async function getPdfDocument(file) {
  const key = `${file.name}-${file.size}`;
  if (docCache.has(key)) return docCache.get(key);
  const pdfjs = await getPdfjs();
  const data = await file.blob.arrayBuffer();
  const promise = pdfjs.getDocument({ data }).promise;
  docCache.set(key, { pdf: null, promise });
  const pdf = await promise;
  docCache.set(key, { pdf, promise });
  return { pdf, promise };
}

function cropScale(cropWidthPx, targetWidth = 1400) {
  if (!cropWidthPx || cropWidthPx <= 0) return 1;
  const scale = targetWidth / cropWidthPx;
  return Math.min(4, Math.max(1, scale));
}

/**
 * Render one region to a blob URL. Returns { url, page, box, notice } or
 * throws an Error with a user-facing message.
 */
export async function cropRegion(file, region) {
  const box = [0, 0, 1, 1];
  if (region.kind === 'box' && Array.isArray(region.box)) {
    box.splice(0, 4, ...region.box);
  }
  const [x1, y1, x2, y2] = box;
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name) || String(file.type || '').startsWith('image/');

  if (isPdf) {
    const { pdf } = await getPdfDocument(file);
    const pageCount = pdf.numPages;
    const page = region.kind === 'box' ? Math.min(region.page, pageCount) : 1;
    if (page < 1 || page > pageCount) throw new Error(`Page ${region.page} is out of range (file has ${pageCount} pages).`);
    const pdfPage = await pdf.getPage(page);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const pageW = viewport.width;
    const pageH = viewport.height;
    const cropX = x1 * pageW;
    const cropY = y1 * pageH;
    const cropW = Math.max(1, (x2 - x1) * pageW);
    const cropH = Math.max(1, (y2 - y1) * pageH);
    const scale = cropScale(cropW);
    const canvas = document.createElement('canvas');
    const totalPixels = cropW * scale * (cropH * scale);
    if (totalPixels > 16_000_000) {
      const shrink = Math.sqrt(16_000_000 / totalPixels);
      canvas.width = Math.max(1, Math.round(cropW * scale * shrink));
      canvas.height = Math.max(1, Math.round(cropH * scale * shrink));
    } else {
      canvas.width = Math.round(cropW * scale);
      canvas.height = Math.round(cropH * scale);
    }
    const transform = [scale, 0, 0, scale, -cropX * scale, -(pageH - cropY - cropH) * scale];
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport, transform }).promise;
    pdfPage.cleanup();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Crop failed.'));
      else resolve(URL.createObjectURL(blob));
    }, 'image/png'));
  }

  if (isImage) {
    const bitmap = await createImageBitmap(file.blob);
    const imgW = bitmap.width;
    const imgH = bitmap.height;
    const cropW = Math.max(1, (x2 - x1) * imgW);
    const cropH = Math.max(1, (y2 - y1) * imgH);
    const scale = cropScale(cropW);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropW * scale);
    canvas.height = Math.round(cropH * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, x1 * imgW, y1 * imgH, cropW, cropH, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Crop failed.'));
      else resolve(URL.createObjectURL(blob));
    }, 'image/png'));
  }

  throw new Error('Only PDF and image files can be cropped.');
}

/** Render a whole page (for Adjust mode) at a readable scale. */
export async function renderPagePreview(file, page) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  if (isPdf) {
    const { pdf } = await getPdfDocument(file);
    const pageCount = pdf.numPages;
    const safePage = Math.min(Math.max(1, page), pageCount);
    const pdfPage = await pdf.getPage(safePage);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(2, Math.max(0.6, 900 / Math.max(1, viewport.width)));
    const canvas = document.createElement('canvas');
    const scaled = pdfPage.getViewport({ scale });
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport: scaled }).promise;
    pdfPage.cleanup();
    const url = canvas.toDataURL('image/png');
    return { url, page: safePage, pageCount };
  }
  const bitmap = await createImageBitmap(file.blob);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 900 / Math.max(1, bitmap.width));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL('image/png'), page: 1, pageCount: 1 };
}

/**
 * Collect every SEMESTER_PAPERS row referencing one QID, in file order.
 * data: parsed bank; qid: e.g. "001" (with or without the QID: prefix).
 */
export function collectQidRows(data, qid) {
  const want = String(qid ?? '').replace(/^\[\s*QID\s*:\s*/i, '').replace(/\s*\]$/i, '').trim().toUpperCase();
  if (!want) return [];
  const out = [];
  (data?.semesterPapers || []).forEach((paper) => {
    (paper.questions || []).forEach((question, index) => {
      const raw = String(question.qid || '').toUpperCase();
      if (raw === want) {
        out.push({
          semester: paper.semester,
          n: question.number ?? index + 1,
          exam: question.exam || '-',
          marks: question.marks ?? null,
          source: question.source || '',
          sourceRegions: Array.isArray(question.sourceRegions) ? question.sourceRegions : [],
        });
      }
    });
  });
  return out;
}

/**
 * Replace Source cells with override boxes and return corrected Markdown.
 * overrides: { semester: { n: { regionIndex: [x1,y1,x2,y2] } } }
 */
export function applyOverridesToMarkdown(markdown, overrides) {
  if (!markdown || !overrides || !Object.keys(overrides).length) return markdown;
  const lines = String(markdown).split('\n');
  let semester = '';
  const out = [];
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s*(.+)$/);
    if (heading && /(?:19|20)\d{2}/.test(heading[1])) semester = heading[1].trim();
    if (/^\s*\|/.test(line) && semester && overrides[semester]) {
      const match = line.match(/^\s*\|\s*(\d+)\s*\|/);
      const n = match ? Number(match[1]) : null;
      const byRegion = n != null ? overrides[semester][n] : null;
      if (byRegion) {
        const cells = splitRow(line);
        const sourceIndex = cells.length - 1;
        const rebuilt = byRegion.map((box, i) => {
          const fmt = (v) => Number(v.toFixed(4));
          return `${cells[sourceIndex] || ''}__OVERRIDE:${i}__ ${fmt(box[0])},${fmt(box[1])},${fmt(box[2])},${fmt(box[3])}`;
        });
        cells[sourceIndex] = rebuilt.join(' ; ');
        out.push(`| ${cells.join(' | ')} |`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function splitRow(line) {
  let text = String(line).trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  const cells = [];
  let buffer = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && text[i + 1] === '|') { buffer += '|'; i += 1; }
    else if (text[i] === '|') { cells.push(buffer.trim()); buffer = ''; }
    else buffer += text[i];
  }
  cells.push(buffer.trim());
  return cells;
}
