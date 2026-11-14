/**
 * Chat safety for Gaming Zone rooms: text cleanup, a profanity mask
 * (English + Bangla + Banglish), a link allow-list and per-user rate limits.
 * Pure helpers except the in-memory limiters.
 */

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 280;
export const MAX_LOBBY_CODE_LENGTH = 120;

// Control chars except tab/newline; zero-width and bidi overrides that are
// used to hide or flip text.
// eslint-disable-next-line no-control-regex
const INVISIBLE_RE = /[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/** Trim, drop invisible characters, cap blank lines and length. */
export function cleanText(value, maxLength = MAX_MESSAGE_LENGTH) {
  let text = String(value ?? '').replace(INVISIBLE_RE, '').replace(/\r\n?/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
}

/** Single-line field (titles, team names): newlines collapse to spaces. */
export function cleanLine(value, maxLength = MAX_TITLE_LENGTH) {
  return cleanText(String(value ?? '').replace(/\s*\n\s*/g, ' '), maxLength);
}

// Latin-script words are matched as whole words; Bengali-script words as
// substrings (\b does not work for Bengali).
const LATIN_BLOCKED = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole', 'cunt',
  'dick', 'slut', 'whore', 'nigger', 'nigga', 'retard', 'faggot',
  // Banglish
  'magi', 'khanki', 'khankir', 'chudi', 'chuda', 'choda', 'chudir', 'chodna', 'bokachoda',
  'madarchod', 'madarchud', 'bhenchod', 'bainchod', 'banchod', 'haramjada', 'haramjadi',
  'kuttarbaccha', 'shuorerbaccha', 'tor maire', 'tor mayre',
];
const BENGALI_BLOCKED = [
  'মাগি', 'মাগী', 'খানকি', 'খানকী', 'চুদি', 'চোদা', 'চুদা', 'চুদির', 'বোকাচোদা',
  'মাদারচোদ', 'বানচোদ', 'হারামজাদা', 'হারামজাদি', 'কুত্তার বাচ্চা', 'শুয়োরের বাচ্চা',
];

const escapeRe = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LATIN_RE = new RegExp(`\\b(${LATIN_BLOCKED.map(escapeRe).join('|')})\\b`, 'gi');
const BENGALI_RE = new RegExp(`(${BENGALI_BLOCKED.map(escapeRe).join('|')})`, 'g');

const mask = (word) => word[0] + '*'.repeat(Math.max(1, word.length - 1));

/** Mask blocked words. Returns { text, flagged }. */
export function maskProfanity(text) {
  let flagged = false;
  const out = String(text)
    .replace(LATIN_RE, (match) => { flagged = true; return mask(match); })
    .replace(BENGALI_RE, (match) => { flagged = true; return mask(match); });
  return { text: out, flagged };
}

// Hosts players actually share in game rooms. Anything else is replaced.
export const ALLOWED_LINK_HOSTS = [
  'discord.gg', 'discord.com', 'youtube.com', 'youtu.be', 'twitch.tv', 'kick.com',
  'steamcommunity.com', 'store.steampowered.com', 'tracker.gg', 'op.gg', 'faceit.com',
  'lichess.org', 'chess.com', 'medal.tv', 'facebook.com', 'fb.gg', 'start.gg', 'challonge.com',
];

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;

export function isAllowedLink(raw) {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return ALLOWED_LINK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/** Replace links outside the allow-list. Returns { text, removed }. */
export function filterLinks(text) {
  let removed = 0;
  const out = String(text).replace(URL_RE, (match) => {
    if (isAllowedLink(match)) return match;
    removed += 1;
    return '[link removed]';
  });
  return { text: out, removed };
}

/** Full pipeline for a chat message. Returns { ok, text, flagged, error }. */
export function prepareMessage(raw) {
  const cleaned = cleanText(raw);
  if (!cleaned) return { ok: false, error: 'Message is empty.' };
  const linked = filterLinks(cleaned);
  const masked = maskProfanity(linked.text);
  return { ok: true, text: masked.text, flagged: masked.flagged, linksRemoved: linked.removed };
}

/**
 * Sliding-window limiter: at most `max` hits per `windowMs` per key.
 * Returns a function hit(key, now?) → { ok, retryAfterMs }.
 */
export function createRateLimiter({ max, windowMs, maxKeys = 20000 }) {
  const hits = new Map();
  return function hit(key, now = Date.now()) {
    const k = String(key);
    const recent = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(k, recent);
      return { ok: false, retryAfterMs: windowMs - (now - recent[0]) };
    }
    recent.push(now);
    if (hits.size >= maxKeys && !hits.has(k)) hits.clear();
    hits.set(k, recent);
    return { ok: true, retryAfterMs: 0 };
  };
}

/** Per-user-per-room slow mode. Returns { ok, retryAfterMs }. */
export function createSlowMode() {
  const last = new Map();
  return function check(roomId, userId, slowModeSec, now = Date.now()) {
    if (!slowModeSec || slowModeSec <= 0) return { ok: true, retryAfterMs: 0 };
    const key = `${roomId}|${userId}`;
    if (last.has(key)) {
      const wait = slowModeSec * 1000 - (now - last.get(key));
      if (wait > 0) return { ok: false, retryAfterMs: wait };
    }
    if (last.size > 20000) last.clear();
    last.set(key, now);
    return { ok: true, retryAfterMs: 0 };
  };
}
