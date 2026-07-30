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
export function getShadowIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id && parsed?.nickname) return parsed;
    }
  } catch { /* fall through to create */ }

  const identity = {
    id: 'sid_' + Math.random().toString(36).slice(2, 11),
    nickname: generateShadowName(),
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

/**
 * Refreshes the visitor's nickname (keeps the same stable id) and persists it.
 * @returns {{ id: string, nickname: string }} the updated identity
 */
export function regenerateShadowNickname() {
  const current = getShadowIdentity();
  const next = { ...current, nickname: generateShadowName() };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
  return next;
}
