// Reddit-style anonymous handle generator — Adjective_Noun_#### (e.g. Silent_Falcon_482).
// Used by the Buzz forum (Shadow section) so every user posts under an anonymous nickname.

const ADJECTIVES = [
  'Silent', 'Hidden', 'Masked', 'Phantom', 'Shadow', 'Ghostly', 'Cryptic', 'Veiled',
  'Anonymous', 'Unknown', 'Nameless', 'Faceless', 'Obscure', 'Elusive', 'Covert',
  'Mystic', 'Nocturnal', 'Whispering', 'Vanishing', 'Dusky', 'Midnight', 'Fading',
  'Quiet', 'Lurking', 'Drifting', 'Wandering', 'Secret', 'Muted', 'Dim', 'Cloaked',
];

const NOUNS = [
  'Falcon', 'Raven', 'Wolf', 'Fox', 'Owl', 'Panther', 'Viper', 'Lynx', 'Hawk',
  'Specter', 'Wraith', 'Nomad', 'Drifter', 'Ghost', 'Shade', 'Cipher', 'Echo',
  'Comet', 'Ember', 'Frost', 'Storm', 'Mirage', 'Nebula', 'Onyx', 'Rogue',
  'Sentinel', 'Voyager', 'Wanderer', 'Prowler', 'Stalker', 'Reaper', 'Oracle',
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Generates a Reddit-like anonymous username, e.g. "Cryptic_Raven_739".
 * @returns {string}
 */
export function generateShadowName() {
  const num = Math.floor(Math.random() * 900) + 100; // 100–999
  return `${pick(ADJECTIVES)}_${pick(NOUNS)}_${num}`;
}

/**
 * Derives two-letter initials from a shadow name for avatar fallbacks.
 * "Cryptic_Raven_739" -> "CR"
 * @param {string} name
 * @returns {string}
 */
export function shadowInitials(name) {
  if (!name) return 'SH';
  const parts = name.split('_').filter(Boolean);
  const a = parts[0]?.[0] ?? 'S';
  const b = parts[1]?.[0] ?? 'H';
  return `${a}${b}`.toUpperCase();
}

const IDENTITY_KEY = 'aust-buzz-identity';

/**
 * Returns the visitor's persistent Buzz identity { id, nickname }, creating one
 * on first use. The id is stable (used to attribute votes/authorship); the
 * nickname is the display handle and can be refreshed with regenerateShadowNickname.
 * @returns {{ id: string, nickname: string }}
 */
/** Build a stable per-account identity id so the same login keeps the same
 * anonymous id across devices. Guests and anonymous visitors still get a
 * device-local random id (they have no account to anchor to). */
function identityIdForUser(user) {
  return (user?.id && user.id !== 'guest')
    ? 'uid_' + String(user.id)
    : 'sid_' + Math.random().toString(36).slice(2, 11);
}

export function getShadowIdentity(userOrId) {
  const user = userOrId && typeof userOrId === 'object' ? userOrId : null;
  const userId = user?.id || (typeof userOrId === 'string' ? userOrId : '');

  // Account-scoped identity — derive the id from the account, cache the
  // nickname under a per-account key so every device of the same login
  // converges on one anonymous handle.
  if (userId && userId !== 'guest') {
    const accountKey = IDENTITY_KEY + '-user-' + userId;
    try {
      const raw = localStorage.getItem(accountKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.nickname) return { id: identityIdForUser({ id: userId }), nickname: parsed.nickname };
      }
    } catch { /* fall through */ }
    const fresh = { id: identityIdForUser({ id: userId }), nickname: generateShadowName() };
    try { localStorage.setItem(accountKey, JSON.stringify(fresh)); } catch { /* ignore */ }
    return fresh;
  }

  // Device-local identity for guests (no account to synch across devices).
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id && parsed?.nickname) return parsed;
    }
  } catch { /* fall through to create */ }

  const identity = {
    id: identityIdForUser(),
    nickname: generateShadowName(),
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

/**
 * Refreshes the visitor's nickname (keeps the same stable id) and persists it.
 * @returns {{ id: string, nickname: string }} the updated identity
 */
export function regenerateShadowNickname(userOrId) {
  const current = getShadowIdentity(userOrId);
  const user = userOrId && typeof userOrId === 'object' ? userOrId : null;
  const userId = user?.id || (typeof userOrId === 'string' ? userOrId : '');
  const next = { ...current, nickname: generateShadowName() };
  try {
    if (userId && userId !== 'guest') {
      localStorage.setItem(IDENTITY_KEY + '-user-' + userId, JSON.stringify(next));
    } else {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
    }
  } catch { /* ignore */ }
  return next;
}
