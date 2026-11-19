/**
 * Bangla / Banglish / English gali detector. Shared by the server
 * (authoritative, counts strikes) and the client (instant inline error).
 *
 * Three kinds of match, to keep false positives low:
 *   EXACT    – the whole word must match ("bal", "ass", "বাল")
 *   CONTAINS – root anywhere inside a word ("fuck" in "clusterfuck")
 *   JOINED   – long roots checked on the text with spaces removed, so
 *              "f u c k" and "kuttar bacha" are still caught
 */

const LEET = { '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '3': 'e', '$': 's', '5': 's', '7': 't', '8': 'b', '+': 't' };

const EXACT = [
  // English
  'fuck', 'fck', 'fuk', 'fuq', 'shit', 'sht', 'bitch', 'btch', 'bastard', 'ass', 'asshole', 'dick', 'dickhead',
  'pussy', 'cunt', 'slut', 'whore', 'cock', 'nigga', 'nigger', 'retard', 'bullshit', 'motherfucker', 'stfu',
  'boobs', 'tits', 'dumbass', 'jackass',
  // Banglish
  'bal', 'baal', 'baler', 'magi', 'magir', 'chod', 'choda', 'chudi', 'chudir', 'chude', 'chudbo', 'chudtam', 'chodar',
  'harami', 'haramjada', 'haramzada', 'khanki', 'khanky', 'khankir', 'voda', 'bhoda', 'vuda', 'gandu', 'lund', 'lauda',
  'loda', 'leora', 'laora', 'randi', 'chut', 'chutiya', 'chutia', 'bhosdike', 'madarchod', 'behenchod', 'bokachoda',
  'dhoner', 'shuor', 'suor', 'beshya', 'besshya', 'kuttarbaccha',
  // Bangla
  'বাল', 'বালের', 'বালছাল', 'মাগি', 'মাগী', 'মাগির', 'মাগীর', 'খানকি', 'খানকী', 'খানকির', 'চোদা', 'চুদি', 'চুদা', 'চোদ',
  'হারামি', 'হারামী', 'হারামজাদা', 'হারামজাদি', 'ভোদা', 'গুদ', 'ধোন', 'ধোনের', 'পোদ', 'পুটকি', 'ল্যাওড়া', 'লেওড়া',
  'বেশ্যা', 'শুয়োর', 'শুওর', 'শূয়র', 'চুতিয়া', 'চুতমারানি', 'বোকাচোদা', 'মাদারচোদ',
  // Hinglish
  'bsdk', 'bhenchod', 'benchod', 'bhenchood', 'maderchod', 'madarchood', 'chutiye', 'chutiyapa', 'chootiya',
  'bhosdi', 'bhosdika', 'bhosdiwale', 'bhosda', 'gaand', 'gand', 'gaandu', 'lawda', 'lavda', 'laude', 'lodu',
  'jhant', 'jhaatu', 'jhatu', 'harami', 'haramkhor', 'kamina', 'kamine', 'kutti', 'kutiya', 'randwa',
  'tatti', 'chinal', 'chinaal', 'raand', 'bkl', 'mkc', 'chod', 'chodu',
  // Hindi (Devanagari)
  'चूतिया', 'चुतिया', 'चूत', 'भोसड़ी', 'भोसडी', 'भोसड़ा', 'भोसड़ीके', 'मादरचोद', 'बहनचोद', 'बहनचोद', 'भेनचोद', 'गांड',
  'गाँड', 'गांडू', 'लौड़ा', 'लोडा', 'लंड', 'लुंड', 'झांट', 'झाटू', 'हरामी', 'हरामखोर', 'कमीना', 'कमीने', 'कुतिया', 'रंडी',
  'रांड', 'छिनाल', 'चोद', 'चोदू', 'टट्टी',
];

const CONTAINS = [
  'fuck', 'fuk', 'bitch', 'cunt', 'asshole', 'nigger', 'whore', 'pussy', 'dickhead', 'bullshit',
  'chod', 'chud', 'khanki', 'khanky', 'magir', 'haramjad', 'haramzad', 'madarchod', 'behenchod', 'bhosd', 'chutiy',
  'চোদ', 'চুদ', 'খানকি', 'খানকী', 'মাগির', 'মাগীর', 'হারামজাদ', 'চুতমার', 'বোকাচোদ', 'ল্যাওড়', 'লেওড়',
  'bhenchod', 'benchod', 'chutiy', 'chootiy', 'bhosdi', 'gaandu', 'lawde', 'lavde', 'jhaat', 'haramkhor',
  'चोद', 'चुतिय', 'चूतिय', 'भोसड', 'गांडू', 'लौड़', 'हरामखोर', 'रंडी',
];

const JOINED = [
  'fuck', 'motherfuck', 'bitch', 'asshole', 'madarchod', 'behenchod', 'bokachod', 'khanki', 'haramjad', 'haramzad',
  'kuttarbach', 'kuttarbacc', 'shuorerbach', 'suorerbach', 'magirpola', 'khankirpola', 'tormaire', 'tormayere',
  'কুত্তারবাচ্চা', 'শুয়োরেরবাচ্চা', 'শুওরেরবাচ্চা', 'খানকিরপোলা', 'মাগিরপোলা', 'তোরমারে', 'চুদি', 'চোদা',
  'terimaaki', 'terimaki', 'terimaaka', 'maakichut', 'maakachod', 'behenkelode', 'tereibaap', 'तेरीमाँकी', 'तेरीमांकी', 'माँकीचूत',
];

const collapse = (s) => s.replace(/(.)\1+/g, '$1');
const isLatin = (s) => /^[a-z]+$/.test(s);

function normToken(raw) {
  let t = raw.toLowerCase().normalize('NFKC');
  if (/[a-z@$0-9!+]/.test(t) && !/[ऀ-ॿঀ-৿]/.test(t)) {
    t = t.replace(/[@40!13$578+]/g, (c) => LEET[c] || c).replace(/[^a-z]/g, '');
  } else {
    t = t.replace(/[^ऀ-ॿঀ-৿]/g, '');
  }
  return t;
}

const EXACT_SET = new Set(EXACT.flatMap((w) => [w, collapse(w)]));
const CONTAINS_C = CONTAINS.map(collapse);
const JOINED_C = JOINED.map(collapse);

/** @returns {{ hit: boolean, words: string[] }} */
export function containsProfanity(text) {
  if (typeof text !== 'string' || !text.trim()) return { hit: false, words: [] };
  const words = new Set();
  const clean = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const tokens = clean.split(/[\s,.;:?"'()[\]{}<>/\\|।॥_~^*=-]+/).map(normToken).filter(Boolean);

  for (const t of tokens) {
    const c = collapse(t);
    if (EXACT_SET.has(t) || EXACT_SET.has(c)) { words.add(t); continue; }
    const root = CONTAINS_C.find((r) => c.includes(r) && (!isLatin(r) || r.length >= 4));
    if (root) words.add(t);
  }

  if (!words.size) {
    const joined = collapse(tokens.join(''));
    const root = JOINED_C.find((r) => joined.includes(r));
    if (root) words.add(root);
  }
  return { hit: words.size > 0, words: [...words] };
}

/** Pull every string out of a JSON value (for scanning store writes). */
export function collectStrings(value, out = [], depth = 0) {
  if (depth > 12 || value == null) return out;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out, depth + 1));
  else if (typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out, depth + 1));
  return out;
}

/** Strings present in `next` that weren't in `prev` — only new/edited text is judged. */
export function newStrings(prev, next) {
  const before = new Set(collectStrings(prev));
  return collectStrings(next).filter((s) => !before.has(s));
}
