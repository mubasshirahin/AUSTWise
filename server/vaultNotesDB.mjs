/**
 * Vault Notes — JSON-based metadata storage (mirrors telegramDB.mjs pattern).
 * Each uploaded file gets a record with: id, filename, originalName, uploader,
 * course, department, semester, size, mimeType, uploadedAt.
 *
 * Files live on disk under uploads/ — this module only manages metadata.
 */
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'vaultNotes.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

// Magic-byte sniffers keyed by MIME type. Verifies the buffer's leading bytes
// match the declared type so an attacker can't upload a renamed executable or
// spoofed image (e.g. a .php/.html with a PNG Content-Type).
const MAGIC = {
  'application/pdf': buf => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/png':       buf => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg':      buf => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/jpg':       buf => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  // docx is a ZIP archive (PK\x03\x04). We additionally reject the common
  // executable/misleading headers (PE `MZ`, HTML `<!`, script `#!`) so a
  // crafted payload can't slip through as a docx.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    buf => buf.length >= 4 && buf.subarray(0, 2).equals(Buffer.from([0x50, 0x4b])) &&
      !buf.subarray(0, 2).equals(Buffer.from([0x4d, 0x5a])),
};

/** Verify a buffer's magic bytes match the declared MIME type. */
export function verifyMimeType(buffer, mimeType) {
  const check = MAGIC[mimeType];
  if (!check) return false;
  return check(buffer);
}

export { ALLOWED_TYPES, MAX_SIZE_BYTES, UPLOADS_DIR };

async function readNotes() {
  try {
    if (!existsSync(DB_PATH)) return [];
    const raw = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}

async function writeNotes(notes) {
  await writeFile(DB_PATH, JSON.stringify(notes, null, 2));
}

/** Ensure uploads/ directory exists */
export async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Save a new note record and return the metadata.
 * @param {{ originalName, filename, uploader, uploaderName, course, department, semester, size, mimeType }} data
 */
export async function saveNote(data) {
  const notes = await readNotes();
  const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
  const record = {
    id,
    originalName: data.originalName,
    filename: data.filename,
    uploader: data.uploader || 'unknown',
    uploaderName: data.uploaderName || 'Anonymous',
    course: data.course || '',
    department: data.department || '',
    semester: data.semester || '',
    size: data.size,
    mimeType: data.mimeType,
    uploadedAt: new Date().toISOString(),
  };
  notes.push(record);
  await writeNotes(notes);
  return record;
}

/**
 * List notes, optionally filtered by course or department.
 */
export async function listNotes({ course, department, semester } = {}) {
  let notes = await readNotes();
  if (course) notes = notes.filter(n => n.course === course);
  if (department) notes = notes.filter(n => n.department === department);
  if (semester) notes = notes.filter(n => n.semester === semester);
  return notes.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

/**
 * Get a single note by ID.
 */
export async function getNoteById(id) {
  const notes = await readNotes();
  return notes.find(n => n.id === id) || null;
}

/**
 * Delete a note by ID (metadata + file on disk).
 * @param {string} id
 * @param {string} uploaderId — only the uploader (or admin) can delete
 * @param {boolean} isAdmin
 */
export async function deleteNoteById(id, uploaderId, isAdmin = false) {
  const notes = await readNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return { deleted: false, error: 'Note not found.' };
  const note = notes[idx];
  if (note.uploader !== uploaderId && !isAdmin) {
    return { deleted: false, error: 'You can only delete your own uploads.' };
  }
  // Remove file from disk
  const filePath = path.join(UPLOADS_DIR, note.filename);
  try { await unlink(filePath); } catch { /* file already gone */ }
  // Remove metadata
  notes.splice(idx, 1);
  await writeNotes(notes);
  return { deleted: true, filename: note.filename };
}
