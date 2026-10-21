/**
 * Shared identity for the two ways the report shows a question.
 *
 * The AI writes every question twice: once inside a TOPIC block (merged with
 * its similar versions) and once in SEMESTER_PAPERS (exactly as printed). The
 * preview must treat those two rows as the SAME question, so a picture added
 * in one place appears in the other and the topic filter can narrow both.
 *
 * The link is made by comparing the question text, not by its position:
 *   - `<br>` is already a newline when the parser hands us the data;
 *   - sub-parts (a, b, c) are compared by their text, so "2.a)" and "(a)"
 *     count as the same part;
 *   - punctuation, case and the "Version 1:" prefix are ignored.
 *
 * When a raw row matches a topic row, both views use the topic row's picture
 * key. Pictures are still per user; this only makes the two views agree.
 */

import { buildQuestionVersions, compareSemestersDesc } from './previewAnalytics';
import { splitSemesterList, splitSubQuestions } from './parseQuestionBank';
import { questionImageKey, semesterImageKey } from './qbaKeys';

/** Lowercase, strip markup/punctuation, collapse whitespace. */
export function normalizeQuestionText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\s*(?:image|diagram|figure|picture)s?\s*\]/gi, ' ')
    .replace(/^\s*version\s*\d+\s*:\s*/gim, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * The comparable text of one question: its stem plus every sub-part, with the
 * part labels removed. "2.a) foo<br>2.b) bar" and "(a) foo (b) bar" produce the
 * same signature.
 */
export function questionSignature(value) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  const { stem, parts } = splitSubQuestions(text);
  if (!parts.length) return normalizeQuestionText(text);
  return [normalizeQuestionText(stem), ...parts.map((part) => normalizeQuestionText(part.text))]
    .filter(Boolean)
    .join(' || ');
}

/** A small deterministic hash, used only for DOM anchors. */
export function hashKey(value) {
  let hash = 5381;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function anchorIdForKey(key) {
  return `qba-q-${hashKey(key)}`;
}

/**
 * The exact picture key the topic-wise view uses for one question or one of
 * its versions. Keeping this in one place is what makes the two views share
 * their files.
 */
export function topicQuestionKey(courseKey, topicName, question, questionIndex, version) {
  const originalIndex = question?.originalIndex ?? questionIndex;
  // Questions the preview adds from an unmatched paper row already carry the
  // stable semester key they were created with, so that key wins.
  const savedKey = question?.pictureKey || '';
  if (version) {
    const source = typeof version.sourceIndex === 'number' ? version.sourceIndex : originalIndex;
    const base = savedKey || questionImageKey(courseKey, topicName, source);
    return version.slot ? `${base}::${version.slot}` : base;
  }
  return savedKey || questionImageKey(courseKey, topicName, originalIndex);
}

/** The picture key of one sub-part (a, b, c) inside a question. */
export function partImageKey(baseKey, part, index) {
  const label = String(part?.label || 'part').trim().toLowerCase();
  return `${baseKey}::part:${label}-${index}`;
}

function diceCoefficient(first, second) {
  const a = new Set(String(first || '').split(' ').filter(Boolean));
  const b = new Set(String(second || '').split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((token) => {
    if (b.has(token)) shared += 1;
  });
  return (2 * shared) / (a.size + b.size);
}

/**
 * Index every wording of every topic question.
 *
 * @returns {{
 *   entries: Array<object>,
 *   match: (text: string) => object|null,
 * }}
 */
export function buildQuestionMatchIndex(report, courseKey) {
  const entries = [];
  const bySignature = new Map();

  const add = (entry) => {
    entries.push(entry);
    if (!entry.signature) return;
    const list = bySignature.get(entry.signature);
    if (list) list.push(entry);
    else bySignature.set(entry.signature, [entry]);
  };

  const topics = Array.isArray(report?.topics) ? report.topics : [];
  topics.forEach((topic, topicIndex) => {
    const questions = Array.isArray(topic?.questions) ? topic.questions : [];
    questions.forEach((question, questionIndex) => {
      const versions = buildQuestionVersions(question);
      if (versions.length) {
        versions.forEach((version, versionIndex) => {
          add({
            topic: topic.name,
            topicIndex,
            topicPriority: topic.priority,
            question,
            questionIndex,
            originalIndex: question.originalIndex ?? questionIndex,
            version,
            versionIndex,
            key: topicQuestionKey(courseKey, topic.name, question, questionIndex, version),
            text: version.text,
            signature: questionSignature(version.text),
          });
        });
        return;
      }
      add({
        topic: topic.name,
        topicIndex,
        topicPriority: topic.priority,
        question,
        questionIndex,
        originalIndex: question.originalIndex ?? questionIndex,
        version: null,
        versionIndex: -1,
        key: topicQuestionKey(courseKey, topic.name, question, questionIndex, null),
        text: question.question,
        signature: questionSignature(question.question),
      });
    });
  });

  const match = (text) => {
    const signature = questionSignature(text);
    if (!signature) return null;

    const exact = bySignature.get(signature);
    if (exact?.length) return { ...exact[0], score: 1, method: 'exact' };

    const normalized = normalizeQuestionText(text);
    if (normalized.length < 18) return null;

    let best = null;
    let bestScore = 0;
    for (const entry of entries) {
      if (!entry.signature) continue;
      const lengthGap = Math.abs(entry.signature.length - signature.length);
      if (lengthGap > Math.max(24, signature.length * 0.5)) continue;
      const score = diceCoefficient(entry.signature, signature);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    if (best && bestScore >= 0.86) return { ...best, score: bestScore, method: 'similar' };
    return null;
  };

  return { entries, match };
}

/**
 * Remember where each topic wording appeared on the raw papers.
 *
 * The topic-wise view numbers its own questions 1, 2, 3..., but the student
 * still needs to find the same question on the original paper. This index
 * maps a topic/version picture key to the paper rows that matched it:
 *   { semester: 'Spring 2025', number: 1, partLabels: ['a', 'b'], text: '...' }
 *
 * Unmatched paper questions are indexed by their semester picture key too, so
 * the "Other questions" rows can show the same source pills.
 */
export function buildPaperSourceReferences(report, courseKey, matchIndex = null) {
  const matcher = matchIndex || buildQuestionMatchIndex(report, courseKey);
  const byKey = new Map();
  const papers = Array.isArray(report?.semesterPapers) ? report.semesterPapers : [];

  const add = (key, ref) => {
    if (!key || !ref?.semester) return;
    const list = byKey.get(key) || [];
    if (list.some((item) => (
      item.semester === ref.semester
      && String(item.number) === String(ref.number)
    ))) {
      return;
    }
    list.push(ref);
    list.sort((first, second) => (
      compareSemestersDesc(first.semester, second.semester)
      || (Number(first.number) || 0) - (Number(second.number) || 0)
    ));
    byKey.set(key, list);
  };

  papers.forEach((paper) => {
    const questions = Array.isArray(paper.questions) ? paper.questions : [];
    questions.forEach((question, index) => {
      const number = question.number ?? index + 1;
      const { parts } = splitSubQuestions(question.question || '');
      const ref = {
        semester: paper.semester,
        number,
        partLabels: parts.map((part) => String(part.label).toLowerCase()),
        text: question.question || '',
      };
      const match = matcher.match(question.question);
      if (match) add(match.key, ref);
      // Unmatched paper rows become "Other questions" and keep this key.
      add(semesterImageKey(courseKey, paper.semester, index), ref);
    });
  });

  return byKey;
}

/**
 * Add every raw paper question the AI forgot to put in a TOPIC block to an
 * "Other questions" topic. The preview does this for the screen; the printed
 * report uses the same shape so its topic-wise section is complete too.
 *
 * Repeated wording is merged into one row and its semesters are combined. A
 * question added this way keeps the raw paper's picture key, so the paper row
 * and the "Other questions" row share the same attachment slot.
 */
export function addUnmatchedPaperQuestions(report, courseKey) {
  if (!report || !Array.isArray(report.topics) || !Array.isArray(report.semesterPapers)) {
    return report;
  }

  const matchIndex = buildQuestionMatchIndex(report, courseKey);
  const topics = report.topics.map((topic) => ({
    ...topic,
    questions: (Array.isArray(topic.questions) ? topic.questions : [])
      .map((question) => ({ ...question })),
  }));
  let other = topics.find(
    (topic) => String(topic.name).trim().toLowerCase() === 'other questions',
  );
  if (!other) {
    other = { name: 'Other questions', priority: 'MEDIUM', questions: [] };
  }

  const bySignature = new Map(
    other.questions.map((question) => [questionSignature(question.question), question]),
  );
  let added = false;

  report.semesterPapers.forEach((paper) => {
    const questions = Array.isArray(paper.questions) ? paper.questions : [];
    questions.forEach((question, index) => {
      if (matchIndex.match(question.question)) return;

      const signature = questionSignature(question.question);
      const existing = bySignature.get(signature);
      if (existing) {
        const seen = new Set(
          splitSemesterList(existing.semester || '').map((name) => name.toLowerCase()),
        );
        if (paper.semester && !seen.has(paper.semester.toLowerCase())) {
          existing.semester = [existing.semester, paper.semester].filter(Boolean).join(', ');
        }
        existing.times = (existing.times || 1) + 1;
        added = true;
        return;
      }

      const entry = {
        ...question,
        semester: paper.semester,
        times: question.times || 1,
        originalIndex: other.questions.length,
        pictureKey: semesterImageKey(courseKey, paper.semester, index),
        addedFromPaper: true,
      };
      other.questions.push(entry);
      bySignature.set(signature, entry);
      added = true;
    });
  });

  if (!added) return report;

  other.timesAsked = other.questions.reduce(
    (sum, question) => sum + (Number(question.times) || 1),
    0,
  );
  const semesters = other.questions
    .flatMap((question) => splitSemesterList(question.semester || ''))
    .sort(compareSemestersDesc);
  if (semesters.length) other.lastAsked = semesters[0];
  const marks = other.questions
    .map((question) => Number(question.marks))
    .filter((value) => Number.isFinite(value));
  if (marks.length) {
    other.avgMarks = Math.round(
      (marks.reduce((sum, value) => sum + value, 0) / marks.length) * 10,
    ) / 10;
  }

  if (!topics.includes(other)) topics.push(other);
  return { ...report, topics };
}
