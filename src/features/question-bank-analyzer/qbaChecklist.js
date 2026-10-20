/**
 * QBA checklist — pure helpers shared by the page, the preview and the store.
 *
 * A question is identified by its topic plus a hash of its text, not by its
 * position. Positions change when the student renumbers, filters or merges
 * rows; the wording is what the student is actually ticking off.
 *
 * A merged row stores one id per wording (`variants`), so merging or
 * unmerging questions never throws a solved mark away.
 */

/** A stable, lowercase slug for a topic name. */
export function topicSlug(topicName) {
  const slug = String(topicName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'general';
}

/** Normalise a question so trivial whitespace/case changes keep the same id. */
export function normalizeQuestionText(text) {
  return String(text || '')
    .replace(/\[image\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Small, fast, non-cryptographic hash (djb2 + xor). */
export function hashText(text) {
  let hash = 5381;
  const value = String(text || '');
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

/** The text that identifies one question row (or one variant of it). */
export function questionTextForId(question) {
  if (!question) return '';
  if (typeof question.question === 'string' && question.question.trim()) {
    return question.question;
  }
  if (Array.isArray(question.versions)) {
    return question.versions.map((version) => version?.text || '').join(' ');
  }
  return '';
}

/** The checklist id of one wording. */
export function questionCheckId(topicName, question) {
  const text = normalizeQuestionText(questionTextForId(question));
  return `t:${topicSlug(topicName)}:${hashText(text)}`;
}

/**
 * Every checklist id a row owns. A merged row owns one id per wording.
 * @returns {string[]}
 */
export function questionCheckIds(topicName, question) {
  const variants = Array.isArray(question?.variants) ? question.variants : [];
  const sources = variants.length ? variants : [question];
  const ids = sources.map((source) => questionCheckId(topicName, source));
  return [...new Set(ids)];
}

/** True when every id of the row is ticked. */
export function isQuestionSolved(items, ids) {
  if (!Array.isArray(ids) || !ids.length) return false;
  return ids.every((id) => Boolean(items?.[id]?.solved));
}

/**
 * Tick or untick a whole row. If every id is already solved, the click clears
 * them; otherwise it solves them all.
 *
 * @returns {Record<string, { solved: boolean, updatedAt: string }>}
 */
export function toggleChecklistIds(items, ids, now = new Date().toISOString()) {
  const list = [...new Set(Array.isArray(ids) ? ids : [])];
  if (!list.length) return items || {};
  const wasSolved = isQuestionSolved(items, list);
  const next = { ...(items || {}) };
  list.forEach((id) => {
    next[id] = { solved: !wasSolved, updatedAt: now };
  });
  return next;
}

/**
 * Merge two checklist maps (server + local cache) by per-item timestamp.
 * The newest edit wins, so a tick made offline is not lost.
 */
export function mergeChecklistItems(base, incoming) {
  const merged = { ...(base || {}) };
  Object.entries(incoming || {}).forEach(([id, item]) => {
    if (!item || typeof item !== 'object') return;
    const previous = merged[id];
    const incomingTime = String(item.updatedAt || '');
    const previousTime = String(previous?.updatedAt || '');
    if (!previous || incomingTime >= previousTime) {
      merged[id] = { solved: Boolean(item.solved), updatedAt: incomingTime || previousTime };
    }
  });
  return merged;
}

/** Drop very old "unsolved" tombstones so the map cannot grow forever. */
export function pruneChecklistItems(items, maxAgeDays = 180) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const next = {};
  Object.entries(items || {}).forEach(([id, item]) => {
    if (!item) return;
    if (item.solved) {
      next[id] = item;
      return;
    }
    const time = Date.parse(item.updatedAt || '');
    if (!Number.isFinite(time) || time >= cutoff) next[id] = item;
  });
  return next;
}

/**
 * Count solved question rows in a report.
 *
 * `total` is the number of visible rows (a merged row counts once), matching
 * the preview and the PDF. A row is solved only when all of its wordings are
 * solved.
 *
 * @returns {{ total: number, solved: number, percent: number }}
 */
export function countSolvedQuestions(topics, items) {
  let total = 0;
  let solved = 0;
  (Array.isArray(topics) ? topics : []).forEach((topic) => {
    (Array.isArray(topic?.questions) ? topic.questions : []).forEach((question) => {
      total += 1;
      if (isQuestionSolved(items, questionCheckIds(topic?.name, question))) solved += 1;
    });
  });
  return {
    total,
    solved,
    percent: total ? Math.round((solved / total) * 100) : 0,
  };
}
