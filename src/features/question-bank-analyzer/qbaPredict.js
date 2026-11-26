/**
 * Predicted paper — a likely exam paper built from the past papers.
 *
 * Everything is deterministic and explainable: each slot says which topic it
 * is, how often that topic came, when it last came and why it was picked. No
 * AI call, so the same inputs always give the same paper.
 *
 *   1. score every topic (how often + how recently + marks weight + trend)
 *   2. keep only the topics in the student's syllabus
 *   3. fill N slots with the best topics (a topic repeats only when the
 *      syllabus has fewer topics than slots)
 *   4. order the slots the way the teacher usually orders them
 *   5. pick the most-asked, most-recent question of each topic for its slot
 */

import { OTHER_TOPIC, buildTopicTrends, chanceBand, paperLabel, TREND_HINTS } from './qbaInsights';

// ── syllabus matching ───────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'of', 'in', 'to', 'an', 'on', 'by', 'at', 'is', 'or', 'as', 'be', 'vs',
  'and', 'the', 'for', 'with', 'from', 'into', 'its', 'their', 'using', 'use',
  'introduction', 'intro', 'overview', 'basic', 'basics', 'concept', 'concepts',
  'chapter', 'unit', 'part', 'topic', 'topics', 'other', 'questions', 'question',
  'various', 'different', 'types', 'type', 'related', 'etc', 'via', 'based',
]);

function stem(word) {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es') && /(?:ss|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function syllabusTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^\p{L}\p{N}+#]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .filter((word) => !STOP_WORDS.has(word))
    .map(stem);
}

/**
 * Which topic names does a pasted syllabus cover?
 * A topic matches when its name appears as a phrase, or when at least 60% of
 * its meaningful words (and at least one) appear in the syllabus.
 *
 * @returns {Set<string>} the matched topic names
 */
export function matchSyllabusTopics(topicNames, syllabusText) {
  const matched = new Set();
  const text = String(syllabusText || '');
  if (!text.trim()) return matched;
  const flat = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').replace(/\s+/g, ' ')} `;
  const words = new Set(syllabusTokens(text));

  (Array.isArray(topicNames) ? topicNames : []).forEach((name) => {
    const phrase = String(name || '').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!phrase) return;
    if (flat.includes(` ${phrase} `)) {
      matched.add(name);
      return;
    }
    const tokens = [...new Set(syllabusTokens(name))];
    if (!tokens.length) return;
    const hits = tokens.filter((token) => words.has(token)).length;
    if (hits && hits / tokens.length >= 0.6) matched.add(name);
  });
  return matched;
}

// ── marks ───────────────────────────────────────────────────────────────────

/**
 * "10, 10, 15" / "4x10, 2x15" / "10" → a list of marks per question.
 * A single number with a count fills every slot.
 */
export function parseMarksList(value, count) {
  const text = String(value ?? '').trim();
  const slots = Math.max(1, Math.min(30, Number(count) || 1));
  if (!text) return [];
  const marks = [];
  text.split(/[,;\s]+/).filter(Boolean).forEach((part) => {
    const repeat = part.match(/^(\d{1,2})\s*[x×*]\s*(\d{1,3}(?:\.\d)?)$/i);
    if (repeat) {
      for (let i = 0; i < Number(repeat[1]); i += 1) marks.push(Number(repeat[2]));
      return;
    }
    const single = Number(part);
    if (Number.isFinite(single) && single > 0) marks.push(single);
  });
  if (marks.length === 1) return Array.from({ length: slots }, () => marks[0]);
  return marks.slice(0, 30);
}

// ── candidate questions ─────────────────────────────────────────────────────

function buildCandidates(topic, paperOrder) {
  const bySignature = new Map();
  topic.occurrences.forEach((occurrence) => {
    const key = occurrence.signature;
    if (!bySignature.has(key)) {
      bySignature.set(key, {
        signature: key,
        text: occurrence.text,
        count: 0,
        last: -1,
        latest: null,
        marks: [],
        semesters: [],
        needsFigure: false,
      });
    }
    const candidate = bySignature.get(key);
    const order = paperOrder.get(`${occurrence.semester}::${occurrence.exam}`) ?? -1;
    candidate.count += 1;
    if (occurrence.marks) candidate.marks.push(occurrence.marks);
    if (!candidate.semesters.includes(occurrence.semester)) candidate.semesters.push(occurrence.semester);
    candidate.needsFigure = candidate.needsFigure || occurrence.needsFigure;
    if (order >= candidate.last) {
      candidate.last = order;
      candidate.latest = occurrence;
    }
  });
  return [...bySignature.values()];
}

function candidateScore(candidate, slotMarks, paperCount) {
  const recency = paperCount > 1 ? Math.max(0, candidate.last) / (paperCount - 1) : 1;
  const typical = candidate.marks.length
    ? candidate.marks.reduce((sum, value) => sum + value, 0) / candidate.marks.length
    : null;
  const fit = typical && slotMarks ? 1 - Math.min(1, Math.abs(typical - slotMarks) / slotMarks) : 0.5;
  return candidate.count * 1.2 + recency * 1.4 + fit * 0.6;
}

function asQuestion(candidate) {
  const latest = candidate.latest || {};
  return {
    text: candidate.text,
    count: candidate.count,
    semesters: candidate.semesters,
    qid: latest.qid || '',
    sourceRegions: latest.sourceRegions || [],
    sourceSemester: latest.semester || '',
    sourceNumber: latest.number || null,
    needsFigure: candidate.needsFigure,
    typicalMarks: candidate.marks.length
      ? Math.round(candidate.marks.reduce((sum, value) => sum + value, 0) / candidate.marks.length)
      : null,
  };
}

function plural(word, count) {
  return count === 1 ? word : `${word}s`;
}

function slotReason(topic, examName) {
  const what = examName && examName !== 'all' ? `${examName.toLowerCase()} ${plural('paper', topic.paperCount)}` : plural('paper', topic.paperCount);
  const parts = [`Came in ${topic.hits} of ${topic.paperCount} ${what}`];
  if (topic.lastSeen) {
    parts.push(`last in ${examName && examName !== 'all' ? topic.lastSeen.semester : paperLabel(topic.lastSeen)}`);
  }
  if (topic.trend !== 'steady') parts.push(TREND_HINTS[topic.trend].toLowerCase());
  return parts.join(' · ');
}

/**
 * Build the predicted paper.
 *
 * @param {object} data      parsed report (topics + semesterPapers)
 * @param {object} options
 *   exam:          'Final' | 'Mid' | … | 'all'
 *   syllabus:      Set of topic names in the syllabus (empty/null = all)
 *   questionCount: questions printed on the paper
 *   answerCount:   "answer any N" (optional)
 *   marks:         number[] per question (or one number for all)
 */
export function predictPaper(data, options = {}) {
  const requestedExam = options.exam || 'all';
  let trends = buildTopicTrends(data, { exam: requestedExam });
  let usedAllExams = false;
  if (requestedExam !== 'all' && trends.papers.length < 2) {
    const wide = buildTopicTrends(data, { exam: 'all' });
    if (wide.papers.length > trends.papers.length) {
      trends = wide;
      usedAllExams = true;
    }
  }

  const syllabus = options.syllabus instanceof Set && options.syllabus.size ? options.syllabus : null;
  let eligible = trends.topics.filter((topic) => (syllabus ? syllabus.has(topic.name) : true));
  const named = eligible.filter((topic) => topic.name !== OTHER_TOPIC);
  if (named.length) eligible = named;

  const questionCount = Math.max(1, Math.min(30, Number(options.questionCount) || 1));
  const marksInput = Array.isArray(options.marks)
    ? options.marks
    : Array.from({ length: questionCount }, () => Number(options.marks) || null);
  const marks = Array.from({ length: questionCount }, (_, index) => (
    Number(marksInput[index]) || Number(marksInput[marksInput.length - 1]) || null
  ));

  if (!eligible.length) {
    return {
      exam: requestedExam,
      usedAllExams,
      paperCount: trends.papers.length,
      slots: [],
      backups: [],
      totalMarks: 0,
      answerCount: options.answerCount || null,
      questionCount,
    };
  }

  // 1. Topics for every slot. Best first; a topic repeats only after every
  //    eligible topic got one slot.
  const picks = [];
  for (let round = 0; picks.length < questionCount && round < 6; round += 1) {
    let added = false;
    for (const topic of eligible) {
      if (picks.length >= questionCount) break;
      if (topic.uniqueQuestions > round) {
        picks.push(topic);
        added = true;
      }
    }
    if (!added) break;
  }

  // 2. Teacher's order: topics usually asked early come first.
  const ordered = picks
    .map((topic, index) => ({ topic, index }))
    .sort((a, b) => {
      const posA = a.topic.position ?? 2 + a.index;
      const posB = b.topic.position ?? 2 + b.index;
      return posA - posB || a.index - b.index;
    })
    .map(({ topic }) => topic);

  // 3. One question per slot.
  const paperOrder = new Map(trends.papers.map((paper, index) => [`${paper.semester}::${paper.exam}`, index]));
  const candidatesByTopic = new Map();
  const usedSignatures = new Set();
  const slots = ordered.map((topic, index) => {
    if (!candidatesByTopic.has(topic.name)) {
      candidatesByTopic.set(topic.name, buildCandidates(topic, paperOrder));
    }
    const slotMarks = marks[index];
    const ranked = candidatesByTopic.get(topic.name)
      .filter((candidate) => !usedSignatures.has(candidate.signature))
      .map((candidate) => ({ candidate, score: candidateScore(candidate, slotMarks, trends.papers.length) }))
      .sort((a, b) => b.score - a.score);
    const chosen = ranked[0]?.candidate || null;
    if (chosen) usedSignatures.add(chosen.signature);
    return {
      number: index + 1,
      marks: slotMarks,
      topic: topic.name,
      score: topic.score,
      band: topic.band,
      hits: topic.hits,
      paperCount: topic.paperCount,
      hitRate: topic.hitRate,
      trend: topic.trend,
      lastSeen: topic.lastSeen,
      reason: slotReason(topic, usedAllExams ? 'all' : requestedExam),
      question: chosen ? asQuestion(chosen) : null,
      alternates: ranked.slice(1, 3).map(({ candidate }) => asQuestion(candidate)),
    };
  });

  const chosenTopics = new Set(picks.map((topic) => topic.name));
  const backups = eligible
    .filter((topic) => !chosenTopics.has(topic.name))
    .slice(0, 4)
    .map((topic) => ({
      topic: topic.name,
      band: topic.band,
      reason: slotReason(topic, usedAllExams ? 'all' : requestedExam),
    }));

  return {
    exam: requestedExam,
    usedAllExams,
    paperCount: trends.papers.length,
    slots,
    backups,
    totalMarks: marks.reduce((sum, value) => sum + (value || 0), 0),
    answerCount: Number(options.answerCount) || null,
    questionCount,
  };
}

export { chanceBand };
