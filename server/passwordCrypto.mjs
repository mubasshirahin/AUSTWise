/**
 * AES-256-GCM encryption for the Password Vault.
 *
 * Master key comes from CRYPTO_SECRET_KEY in .env. Any length is accepted:
 * the raw string is hashed with SHA-256 so the actual cipher key is always
 * exactly 32 bytes, as AES-256 requires. (A 32-byte key set in .env works
 * identically — the SHA-256 of a 32-byte value is still deterministic.)
 *
 * Stored form: `iv:content:authTag` — all hex. The auth tag is verified on
 * decrypt, so tampered ciphertext fails loudly instead of returning garbage.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const TAG_LEN = 16;

function getKey() {
  const secret = process.env.CRYPTO_SECRET_KEY;
  if (!secret) {
    throw new Error('CRYPTO_SECRET_KEY is not set in .env — password vault cannot encrypt.');
  }
  // Deterministic 32-byte key regardless of secret length.
  return createHash('sha256').update(String(secret)).digest();
}

/** Encrypt a plaintext string → { iv, content, authTag } (all hex). */
export function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv, { authTagLength: TAG_LEN });
  const content = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    content: content.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

/** Decrypt { iv, content, authTag } back to plaintext. Throws on tamper/bad key. */
export function decrypt({ iv, content, authTag }) {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(iv, 'hex'), { authTagLength: TAG_LEN });
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(content, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

/** Serialize encrypted parts into one storage string: `iv:content:authTag`. */
export function serialize(enc) {
  return `${enc.iv}:${enc.content}:${enc.authTag}`;
}

/** Parse a stored string back into { iv, content, authTag }. */
export function parse(serialized) {
  const [iv, content, authTag] = String(serialized).split(':');
  if (!iv || !content || !authTag) throw new Error('Malformed encrypted credential.');
  return { iv, content, authTag };
}
