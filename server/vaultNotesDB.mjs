/**
 * Vault Notes — metadata store, dual-mode like storeDB.mjs.
 *   SQL Server (via db.mjs) when configured, else the legacy JSON file
 *   (server/vaultNotes.json) as fallback.
 *
 * Each uploaded file gets a record with: id, filename, originalName, uploader,
 * course, department, semester, size, mimeType, uploadedAt.
 *
 * Files live on disk under uploads/ — this module only manages metadata
 * (records persist to SQL so they survive Railway redeploys).
 */
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, sql } from './db.mjs';

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

// ── SQL table ────────────────────────────────────────────────────────────────

const VAULT_NOTES_DDL = `
CREATE TABLE IF NOT EXISTS "VaultNotes" (
  id   TEXT PRIMARY KEY,
  data TEXT DEFAULT '{}'
);
`;

let _tablesEnsured = false;
let _dbAvailable = null;

async function isDbAvailable() {
  if (_dbAvailable !== null) return _dbAvailable;
  try {
    await query('SELECT 1');
    _dbAvailable = true;
  } catch {
    _dbAvailable = false;
  }
  return _dbAvailable;
}

async function ensureTables() {
  if (_tablesEnsured) return;
  try {
    for (const stmt of VAULT_NOTES_DDL.split(';').map((s) => s.trim()).filter(Boolean)) {
      await query(stmt);
    }
    _tablesEnsured = true;
  } catch (err) {
    console.warn('⚠️  vaultNotesDB: could not create VaultNotes table:', err.message);
  }
}

async function readNotesFromDb() {
  await ensureTables();
  const rows = await query('SELECT data FROM "VaultNotes"');
  return rows.map((r) => {
    try { return JSON.parse(r.data); } catch { return null; }
  }).filter(Boolean);
}

async function upsertNoteRow(note) {
  const data = JSON.stringify(note);
  await query(`
    INSERT INTO "VaultNotes" (id, data)
    VALUES (@id, @data)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
  `, [
    { name: 'id', type: sql.NVarChar(100), value: note.id },
    { name: 'data', type: sql.NVarChar(-1), value: data },
  ]);
}

async function deleteNoteRow(id) {
  await query('DELETE FROM "VaultNotes" WHERE id = @id',
    [{ name: 'id', type: sql.NVarChar(100), value: id }]);
}

// ── Persistent read (SQL-first with JSON fallback) ───────────────────────────

async function readNotes() {
  if (await isDbAvailable()) {
    try {
      const notes = await readNotesFromDb();
      // One-time migration from the JSON file if SQL is empty.
      if (notes.length === 0) {
        try {
          const legacy = JSON.parse(await readFile(DB_PATH, 'utf-8'));
          if (Array.isArray(legacy) && legacy.length) {
            for (const n of legacy) await upsertNoteRow(n);
            return legacy;
          }
        } catch { /* invalid/absent file — ignore */ }
      }
      return notes;
    } catch (err) {
      console.warn('⚠️  vaultNotesDB: SQL read failed, using JSON fallback:', err.message);
    }
  }
  try {
    if (!existsSync(DB_PATH)) return [];
    const raw = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch { return []; }
}

async function writeNotes(notes) {
  if (await isDbAvailable()) {
    try {
      for (const n of notes) await upsertNoteRow(n);
    } catch (err) {
      console.warn('⚠️  vaultNotesDB: SQL write failed, writing JSON only:', err.message);
    }
  }
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
  if (await isDbAvailable()) {
    try { await deleteNoteRow(id); } catch (err) {
      console.warn('⚠️  vaultNotesDB: SQL delete failed:', err.message);
    }
  }
  return { deleted: true, filename: note.filename };
}