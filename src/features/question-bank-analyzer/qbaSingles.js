/**
 * Single questions — every printed sub-part is its own item.
 *
 * A paper question "2" with parts (a) and (b) becomes two items, 2)a and
 * 2)b, each with its own topic, its own solved tick, its own picture slot and
 * (when the AI gave one) its own crop of the original paper.
 *
 * New answers already arrive split (the master prompt asks for one pool
 * entry and one paper row per part). Older answers keep the parts inside one
 * entry; they are split here, and every part inherits the row's topic and
 * crop.
 *
 * Ticks: a part has its own checklist id. A tick made on the whole row before
 * parts were split still counts for every part, until the student changes
 * one of them (see `singleToggleChanges`).
 */
import { splitSemesterList, splitSubQuestions } from './parseQuestionBank';
import { isQuestionSolved, questionCheckId, questionCheckIds } from './qbaChecklist';
import { buildQuestionVersions, compareSemestersDesc } from './previewAnalytics';

// "(a) …", "a) …", "2.b) …" at the very start of a text.
const LEADING_LABEL = /^\s*(?:\d{1,3}\s*[.)]\s*)?(?:\(\s*([a-z]{1,4}|[ক-হ]{1,3})\s*\)|([a-z]|[ক-হ])\s*[.)])\s+/i;

/**
 * Split one question text into its single items.
 *
 * @param {string} text            the question text (parts separated by new lines)
 * @param {string} [printedPart]   the part label printed in the paper's "#" cell
 * @returns {{ label: string, text: string, stem: string, index: number, part: object|null, idLabel: string }[]}
 *   `label` is what the student sees; `idLabel` is what the checklist id and
 *   picture slot use, so the topic view and the paper view agree.
 */
export function splitIntoSingles(text, printedPart = '') {
  const clean = String(text ?? '').trim();
  const printed = String(printedPart || '').toLowerCase();
  const { stem, parts } = splitSubQuestions(clean);

  if (parts.length) {
    let list = parts.map((part, index) => ({
      label: String(part.label || '').toLowerCase(),
      idLabel: String(part.label || '').toLowerCase(),
      text: part.text,
      stem,
      index,
      part,
    }));
    // A paper row printed as "2b" whose entry still holds every part: keep
    // only the part the row is about.
    if (printed && list.length > 1) {
      const own = list.filter((item) => item.label === printed);
      if (own.length) list = own;
    }
    return list;
  }

  const lead = clean.match(LEADING_LABEL);
  if (lead) {
    const label = String(lead[1] || lead[2] || '').toLowerCase();
    return [{
      label: printed || label,
      idLabel: label,
      text: clean.slice(lead[0].length).trim() || clean,
      stem: '',
      index: 0,
      // Not split from a longer entry: the picture slot stays the row's own.
      part: null,
    }];
  }

  return [{ label: printed, idLabel: '', text: clean, stem: '', index: 0, part: null }];
}

/** "2" + "a" → "2)a"; a question with no part keeps its plain number. */
export function formatSingleNumber(number, label = '') {
  const base = number === null || number === undefined || number === '' ? '' : String(number);
  if (!label) return base || '•';
  return base ? `${base})${label}` : `${label})`;
}

/** The checklist id of one single item. A whole question keeps its old id. */
export function singleCheckId(topicName, single, wholeText) {
  if (!single.idLabel) return questionCheckId(topicName, { question: wholeText });
  const text = `${single.stem || ''}\n(${single.idLabel}) ${single.text}`;
  return questionCheckId(topicName, { question: text });
}

/** True when the item is ticked, or its whole row was ticked before splitting. */
export function isSingleSolved(items, single) {
  if (!single) return false;
  if (items?.[single.id]?.solved) return true;
  const legacy = Array.isArray(single.legacyIds) ? single.legacyIds : [];
  if (!legacy.length || legacy.includes(single.id)) return false;
  return isQuestionSolved(items, legacy);
}

/**
 * The checklist changes one click makes. Unticking a part whose whole row
 * was ticked earlier clears the row tick and keeps the other parts ticked.
 *
 * @returns {Record<string, boolean>}
 */
export function singleToggleChanges(items, single, siblings = []) {
  if (!single?.id) return {};
  if (!isSingleSolved(items, single)) return { [single.id]: true };
  const changes = { [single.id]: false };
  const legacy = Array.isArray(single.legacyIds) ? single.legacyIds : [];
  const viaLegacy = legacy.length && !legacy.includes(single.id) && isQuestionSolved(items, legacy);
  if (viaLegacy) {
    legacy.forEach((id) => { changes[id] = false; });
    siblings.forEach((other) => {
      if (other?.id && other.id !== single.id && !(other.id in changes)) changes[other.id] = true;
    });
  }
  return changes;
}

/**
 * The single items of one topic row, every wording and every part.
 *
 * @returns {{ id: string, legacyIds: string[], label: string, idLabel: string, text: string,
 *   stem: string, index: number, part: object|null, version: object|null, versionIndex: number }[]}
 */
export function rowSingles(topicName, question) {
  const legacyIds = questionCheckIds(topicName, question);
  const versions = buildQuestionVersions(question);
  const wordings = versions.length
    ? versions.map((version, versionIndex) => ({ text: version.text, version, versionIndex }))
    : [{ text: question?.question || '', version: null, versionIndex: -1 }];

  const list = [];
  wordings.forEach(({ text, version, versionIndex }) => {
    splitIntoSingles(text).forEach((single) => {
      list.push({
        ...single,
        version,
        versionIndex,
        id: singleCheckId(topicName, single, text),
        legacyIds,
      });
    });
  });
  return list;
}

/**
 * Count solved single items in a report — the header's "solved x/y".
 * @returns {{ total: number, solved: number, percent: number }}
 */
export function countSolvedSingles(topics, items) {
  let total = 0;
  let solved = 0;
  (Array.isArray(topics) ? topics : []).forEach((topic) => {
    (Array.isArray(topic?.questions) ? topic.questions : []).forEach((question) => {
      rowSingles(topic?.name, question).forEach((single) => {
        total += 1;
        if (isSingleSolved(items, single)) solved += 1;
      });
    });
  });
  return { total, solved, percent: total ? Math.round((solved / total) * 100) : 0 };
}

/** The newest semester a question was asked in. */
export function latestSemesterOf(question) {
  const list = splitSemesterList(question?.semester || '');
  if (!list.length) return '';
  return list.reduce(
    (best, name) => (compareSemestersDesc(name, best) < 0 ? name : best),
    list[0],
  );
}

/**
 * A topic's rows newest first, the order the screen and the PDF both use.
 * Each row's position is pinned first: picture slots are keyed by it.
 */
export function orderTopicRows(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, position) => (
      question.originalIndex === undefined ? { ...question, originalIndex: position } : question
    ))
    .sort((first, second) => compareSemestersDesc(latestSemesterOf(first), latestSemesterOf(second)));
}
