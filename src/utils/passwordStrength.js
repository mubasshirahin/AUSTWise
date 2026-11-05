/**
 * Password strength — a compact, dependency-free estimator inspired by
 * zxcvbn: it scores guessed-crack difficulty (bits of entropy) and then
 * penalises the patterns real attackers exploit first.
 *
 * Signals used:
 *   · search-space entropy from the character classes actually present
 *   · the top ~200 leaked passwords (with leetspeak / trailing-digit variants)
 *   · runs and repeats ("aaaa", "abcabc")
 *   · sequences and keyboard walks ("1234", "qwerty", "asdf")
 *   · dates and years
 *   · minimum length and class diversity gates
 *
 * Returns { score (0..5), grade, label, tone, pct (4..100), strength (0..1) }
 * where `pct` drives meters/rings and `tone` maps to an accent colour var.
 */

// Top leaked / most-guessed passwords (lower-case).
const COMMON_PASSWORDS = new Set([
  'password', 'passw0rd', 'password1', 'password12', 'password123', 'password1234',
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345', '1234',
  '111111', '000000', '121212', '123123', '112233', '654321', '666666', '696969',
  '987654321', '9876543210', '789456123', 'qwerty', 'qwerty1', 'qwerty12', 'qwerty123',
  'qwertyuiop', 'asdfgh', 'asdfghjkl', 'asdf1234', 'zxcvbn', 'zxcvbnm', 'qazwsx',
  '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'q1w2e3r4', 'abc123', 'abcd1234', 'abc12345',
  'letmein', 'letmein1', 'welcome', 'welcome1', 'welcome123', 'admin', 'admin123',
  'administrator', 'root', 'toor', 'guest', 'login', 'master', 'monkey', 'monkey1',
  'dragon', 'dragon1', 'shadow', 'shadow1', 'sunshine', 'princess', 'princess1',
  'football', 'baseball', 'basketball', 'soccer', 'hockey', 'tennis', 'mustang',
  'ferrari', 'porsche', 'mercedes', 'corvette', 'harley', 'ranger', 'buster',
  'superman', 'batman', 'spiderman', 'starwars', 'pokemon', 'minecraft', 'naruto',
  'iloveyou', 'iloveyou1', 'lovely', 'myloveyou', 'trustno1', 'whatever', 'nothing',
  'secret', 'default', 'changeme', 'temp123', 'test123', 'testtest', 'computer',
  'internet', 'samsung', 'google', 'facebook', 'instagram', 'whatsapp', 'linkedin',
  'twitter', 'snapchat', 'tiktok', 'youtube', 'netflix', 'spotify', 'microsoft',
  'outlook', 'gmail', 'hotmail', 'yahoo', 'apple', 'android', 'iphone',
  'bangladesh', 'dhaka', 'chittagong', 'aust', 'student', 'college', 'university',
  'school', 'teacher', 'engineer', 'doctor', 'birthday', 'happybirthday', 'married',
  'summer', 'winter', 'spring', 'autumn', 'january', 'february', 'august', 'december',
  'monday', 'friday', 'sunday', 'angel', 'hello', 'hello123', 'freedom', 'cookie',
  'chocolate', 'banana', 'orange', 'purple', 'killer', 'hunter', 'thomas', 'robert',
  'daniel', 'andrew', 'charlie', 'jessica', 'jennifer', 'michelle', 'nicole',
  'michael', 'jordan', 'george', 'william', 'anthony', 'eagle', 'falcon', 'phoenix',
  'india', 'pakistan', 'chennai', 'kolkata', 'mumbai', 'delhi', 'karachi', 'lahore',
  '786786', '786', '112358', '159753', '147258', '1q2w3e', 'pass1234', 'passpass',
  'nothing1', 'changeme1', 'office', 'company', 'business', 'money', 'freedom1',
]);

const KEYBOARD_SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  'qazwsxedc',
];

const GRADES = [
  { grade: 'F', label: 'F — Very weak', tone: 'rose' },
  { grade: 'D', label: 'D — Weak', tone: 'orange' },
  { grade: 'C', label: 'C — Fair', tone: 'amber' },
  { grade: 'B', label: 'B — Good', tone: 'cyan' },
  { grade: 'A', label: 'A — Strong', tone: 'emerald' },
  { grade: 'A+', label: 'A+ — Unbreakable!', tone: 'emerald' },
];

const LEET_MAP = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', $: 's', '!': 'i' };

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function deLeet(value) {
  return value.replace(/[013456789@$!]/g, (ch) => LEET_MAP[ch] || ch);
}

export function countCharacterClasses(pw) {
  let classes = 0;
  if (/[a-z]/.test(pw)) classes += 1;
  if (/[A-Z]/.test(pw)) classes += 1;
  if (/[0-9]/.test(pw)) classes += 1;
  if (/[^A-Za-z0-9]/.test(pw)) classes += 1;
  return classes;
}

// Pooled search space of a random-string password.
function searchSpaceBits(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  if (pool === 0) pool = 1;
  return pw.length * Math.log2(pool);
}

// Does the password contain a 4+ character run from a known sequence,
// forwards or backwards? ("abcd", "4321", "qwer", "asdf"…)
function hasSequence(lower) {
  for (const seq of KEYBOARD_SEQUENCES) {
    const reversed = [...seq].reverse().join('');
    for (let i = 0; i + 4 <= seq.length; i += 1) {
      const forward = seq.slice(i, i + 4);
      if (lower.includes(forward)) return true;
      if (lower.includes(reversed.slice(i, i + 4))) return true;
    }
  }
  // Monotonic character runs outside the known keyboard rows (e.g. "aaaa"-safe).
  let run = 1;
  for (let i = 1; i < lower.length; i += 1) {
    const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    run = diff === 1 || diff === -1 ? run + 1 : 1;
    if (run >= 4) return true;
  }
  return false;
}

// "aaaa", "ababab", "abcabcabc" — cheap repeats that shrink the search space.
function hasRepeat(lower) {
  if (/(.)\1{2,}/.test(lower)) return true;
  if (/(.{2,4})\1{1,}/.test(lower)) return true;
  return false;
}

function hasDate(lower) {
  if (/(19|20)\d{2}/.test(lower)) return true;
  return /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(lower);
}

// Exact leaked password, or a leaked password wearing digits/leet on the end.
function commonMatch(lower) {
  if (COMMON_PASSWORDS.has(lower)) return 'exact';
  const deLeeted = deLeet(lower);
  if (COMMON_PASSWORDS.has(deLeeted)) return 'exact';
  const stripped = lower.replace(/[._\-!@#$%^&*()+=0-9]+$/, '');
  if (stripped.length >= 4 && COMMON_PASSWORDS.has(stripped)) return 'suffix';
  if (stripped.length >= 4 && COMMON_PASSWORDS.has(deLeet(stripped))) return 'suffix';
  return null;
}

export function getPasswordGrade(password = '') {
  const pw = password || '';
  if (!pw) {
    return { score: -1, grade: '', label: '', tone: 'muted', pct: 0, strength: 0, bits: 0, suggestions: [] };
  }

  const lower = pw.toLowerCase();
  const classes = countCharacterClasses(pw);
  const common = commonMatch(lower);

  let bits = searchSpaceBits(pw);
  const suggestions = [];

  if (common === 'exact') {
    bits = Math.min(bits, 8);
    suggestions.push('This is one of the most-guessed passwords in the world.');
  } else if (common === 'suffix') {
    bits = Math.min(bits, 20);
    suggestions.push('A common word with digits on the end is easy to guess.');
  }

  if (hasRepeat(lower)) {
    bits *= 0.65;
    suggestions.push('Avoid repeated characters or repeated blocks.');
  }
  if (hasSequence(lower)) {
    bits *= 0.6;
    suggestions.push('Avoid keyboard runs and simple sequences like 1234 or abcd.');
  }
  if (hasDate(lower)) {
    bits *= 0.7;
    suggestions.push('Dates and years are among the first things guessed.');
  }
  if (classes === 1) {
    bits *= 0.75;
    suggestions.push('Mix upper case, lower case, digits and symbols.');
  }
  if (new Set(pw).size <= 2) bits = Math.min(bits, 8);

  bits = Math.max(0, bits);

  // Score from bits, then apply hard gates that entropy alone would overrate.
  let score = 0;
  [22, 36, 50, 64, 82].forEach((threshold) => {
    if (bits >= threshold) score += 1;
  });
  if (pw.length < 6) score = 0;
  else if (pw.length < 8) score = Math.min(score, 2);
  else if (pw.length < 10) score = Math.min(score, 3);
  if (classes < 2) score = Math.min(score, 2);
  if (common === 'exact') score = Math.min(score, 1);
  if (common === 'suffix') score = Math.min(score, 3);
  // "Unbreakable" needs real length, not just variety.
  if (pw.length < 14) score = Math.min(score, 4);

  const info = GRADES[score];
  if (pw.length < 12 && !suggestions.some((s) => s.startsWith('Use at least'))) {
    suggestions.push('Use at least 12–16 characters for a strong passphrase.');
  }

  const pct = clamp(Math.round(bits), 4, 100);

  return {
    score,
    grade: info.grade,
    label: info.label,
    tone: info.tone,
    pct,
    strength: pct / 100,
    bits: Math.round(bits),
    suggestions: suggestions.slice(0, 2),
  };
}
