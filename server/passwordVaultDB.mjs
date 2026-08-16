/**
 * Password Vault data layer — dual-mode like prisma.js:
 *   SQL Server (via db.mjs) when DB is configured, else JSON file fallback.
 *
 * Passwords are NEVER stored in plaintext — only `iv:content:authTag` from
 * passwordCrypto.mjs. Decryption happens in-memory at the API layer.
 */

import { query } from './db.mjs';
import { readJson, writeJson } from './jsonDB.mjs';
import { encrypt, decrypt, serialize, parse } from './passwordCrypto.mjs';

// ── JSON fallback ────────────────────────────────────────────────────────────

async function readVault() {
  const list = await readJson('password_vault.json');
  return list;
}

async function writeVault(list) {
  await writeJson('password_vault.json', list);
}

// ── SQL path helpers ─────────────────────────────────────────────────────────

function toDto(row) {
  return {
    id: String(row.Id),
    userId: String(row.UserId),
    platform: String(row.Platform || ''),
    email: String(row.Email || ''),
    username: row.Username != null ? String(row.Username) : '',
    encPassword: serialize({
      iv: String(row.EncIv),
      content: String(row.EncContent),
      authTag: String(row.EncAuthTag),
    }),
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : new Date().toISOString(),
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : new Date().toISOString(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Insert or update a credential. `enc` is { iv, content, authTag }. */
export async function saveCredential(userId, { platform, email, username, enc }) {
  if (!userId) throw new Error('userId is required.');
  const platformName = String(platform || '').trim();
  if (!platformName) throw new Error('Platform name is required.');
  if (!email || !String(email).trim()) throw new Error('Email or phone is required.');
  if (!enc?.iv || !enc?.content || !enc?.authTag) throw new Error('Encrypted payload missing.');

  const stored = {
    iv: String(enc.iv),
    content: String(enc.content),
    authTag: String(enc.authTag),
  };

  // SQL Server path
  if (process.env.DB_SERVER) {
    const existing = await query(
      'SELECT TOP 1 Id FROM PasswordVault WHERE UserId = @userId AND Platform = @platform',
      { userId: { value: userId }, platform: { value: platformName } }
    );
    if (existing.recordset.length > 0) {
      const result = await query(
        `UPDATE PasswordVault
           SET Email = @email, Username = @username,
               EncIv = @iv, EncContent = @content, EncAuthTag = @authTag,
               UpdatedAt = GETDATE()
           OUTPUT INSERTED.*
           WHERE Id = @id`,
        {
          email: { value: String(email).trim() },
          username: { value: String(username || '').trim() || null },
          iv: { value: stored.iv },
          content: { value: stored.content },
          authTag: { value: stored.authTag },
          id: { value: existing.recordset[0].Id },
        }
      );
      return toDto(result.recordset[0]);
    }
    const result = await query(
      `INSERT INTO PasswordVault (UserId, Platform, Email, Username, EncIv, EncContent, EncAuthTag)
         VALUES (@userId, @platform, @email, @username, @iv, @content, @authTag);
       SELECT TOP 1 * FROM PasswordVault WHERE UserId = @userId AND Platform = @platform;`,
      {
        userId: { value: userId },
        platform: { value: platformName },
        email: { value: String(email).trim() },
        username: { value: String(username || '').trim() || null },
        iv: { value: stored.iv },
        content: { value: stored.content },
        authTag: { value: stored.authTag },
      }
    );
    return toDto(result.recordset[0]);
  }

  // JSON fallback
  const list = await readVault();
  const idx = list.findIndex((c) => c.userId === userId && c.platform === platformName);
  const now = new Date().toISOString();
  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      email: String(email).trim(),
      username: String(username || '').trim(),
      encPassword: serialize(stored),
      updatedAt: now,
    };
    await writeVault(list);
    return list[idx];
  }
  const record = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    platform: platformName,
    email: String(email).trim(),
    username: String(username || '').trim(),
    encPassword: serialize(stored),
    createdAt: now,
    updatedAt: now,
  };
  list.push(record);
  await writeVault(list);
  return record;
}

/** Update a credential by id (ownership enforced). Returns null if not found. */
export async function updateCredential(id, userId, { platform, email, username, enc }) {
  if (!id || !userId) throw new Error('id and userId are required.');
  const platformName = String(platform || '').trim();
  if (!platformName) throw new Error('Platform name is required.');
  if (!email || !String(email).trim()) throw new Error('Email or phone is required.');
  if (!enc?.iv || !enc?.content || !enc?.authTag) throw new Error('Encrypted payload missing.');

  const stored = {
    iv: String(enc.iv),
    content: String(enc.content),
    authTag: String(enc.authTag),
  };

  if (process.env.DB_SERVER) {
    const result = await query(
      `UPDATE PasswordVault
         SET Platform = @platform, Email = @email, Username = @username,
             EncIv = @iv, EncContent = @content, EncAuthTag = @authTag,
             UpdatedAt = GETDATE()
         OUTPUT INSERTED.*
         WHERE Id = @id AND UserId = @userId`,
      {
        platform: { value: platformName },
        email: { value: String(email).trim() },
        username: { value: String(username || '').trim() || null },
        iv: { value: stored.iv },
        content: { value: stored.content },
        authTag: { value: stored.authTag },
        id: { value: id },
        userId: { value: userId },
      }
    );
    if (result.recordset.length === 0) return null;
    return toDto(result.recordset[0]);
  }

  const list = await readVault();
  const idx = list.findIndex((c) => c.id === id && c.userId === userId);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    platform: platformName,
    email: String(email).trim(),
    username: String(username || '').trim(),
    encPassword: serialize(stored),
    updatedAt: new Date().toISOString(),
  };
  await writeVault(list);
  return list[idx];
}

/** List a user's credentials, decrypting each password in-memory. */
export async function listCredentials(userId) {
  if (!userId) throw new Error('userId is required.');

  if (process.env.DB_SERVER) {
    const result = await query(
      'SELECT * FROM PasswordVault WHERE UserId = @userId ORDER BY Platform ASC',
      { userId: { value: userId } }
    );
    return result.recordset.map(toDto);
  }

  const list = await readVault();
  return list
    .filter((c) => c.userId === userId)
    .map((c) => ({ ...c, username: c.username || '' }))
    .sort((a, b) => String(a.platform).localeCompare(String(b.platform)));
}

/** Decrypt the password field of a record (shared by list endpoint). */
export function revealPassword(record) {
  const parts = parse(record.encPassword || record.enc);
  return decrypt(parts);
}

/** Delete a credential owned by the user. Returns true if deleted. */
export async function deleteCredential(id, userId) {
  if (!id || !userId) return false;

  if (process.env.DB_SERVER) {
    const result = await query(
      'DELETE FROM PasswordVault WHERE Id = @id AND UserId = @userId',
      { id: { value: id }, userId: { value: userId } }
    );
    return result.rowsAffected[0] > 0;
  }

  let list = await readVault();
  const before = list.length;
  list = list.filter((c) => !(c.id === id && c.userId === userId));
  if (list.length === before) return false;
  await writeVault(list);
  return true;
}

/** Sanity self-check: encrypt → decrypt round-trip. */
export function selfCheck() {
  const enc = encrypt('p@ssw0rd-check');
  const back = decrypt(enc);
  if (back !== 'p@ssw0rd-check') throw new Error('Vault crypto round-trip failed.');
  return true;
}
