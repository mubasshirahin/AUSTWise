/**
 * QBA insights — the numbers behind the Trends, Coverage and Predicted paper
 * views. Pure functions, no DOM, so every rule here is unit-tested.
 *
 *   occurrence = one question asked on one exam paper
 *   paper      = one exam (semester + exam type), e.g. "Fall 2023 · Final"
 *
 * The raw SEMESTER_PAPERS rows are the best source: they are unmerged and
 * carry the printed question number and the Source box. Older outputs have
 * only TOPIC tables, so those fall back to the topic rows' semester lists.
 */

import { splitSemesterList } from './parseQuestionBank';
import { compareSemestersDesc } from './previewAnalytics';
import { buildQuestionMatchIndex, questionSignature } from './qbaQuestionMatch';

export const OTHER_TOPIC = 'Other questions';

const EXAM_RANK = { Quiz: 1, 'Class Test': 1, Mid: 2, Other: 3, Final: 4 };

export function examLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return 'Other';
  if (/final/i.test(raw)) return 'Final';
  if (/\bmid\b|midterm|mid-term/i.test(raw)) return 'Mid';
  if (/\bquiz\b/i.test(raw)) return 'Quiz';
  if (/class\s*test|\bct\b/i.test(raw)) return 'Class Test';
  return 'Other';
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function semesterKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function sameSemester(a, b) {
  const keyA = semesterKey(a);
  const keyB = semesterKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  // "Fall 2023" vs "Fall-23" / "Fall 23": compare season + last two digits.
  const short = (key) => {
    const season = key.match(/spring|summer|fall|autumn|winter/);
    const year = key.match(/(?:19|20)?(\d{2})(?!\d)/);
    return season && year ? `${season[0]}${year[1]}` : '';
  };
  const shortA = short(keyA);
  return Boolean(shortA) && shortA === short(keyB);
}

export function sameExam(a, b) {
  return examLabel(a) === examLabel(b);
}

export function paperId(semester, exam) {
  return `${semesterKey(semester)}::${examLabel(exam)}`;
}

/** Oldest paper first; Mid before Final inside one semester. */
export function comparePapersAsc(a, b) {
  const bySemester = compareSemestersDesc(b.semester, a.semester);
  if (bySemester) return bySemester;
  return (EXAM_RANK[a.exam] || 9) - (EXAM_RANK[b.exam] || 9);
}

function median(values) {
  const list = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

/**
 * Every question asked on every paper.
 * @returns {{ occurrences: object[], source: 'papers'|'topics'|'none' }}
 */
export function buildOccurrences(data) {
  const papers = Array.isArray(data?.semesterPapers) ? data.semesterPapers : [];
  const occurrences = [];

  if (papers.some((paper) => Array.isArray(paper?.questions) && paper.questions.length)) {
    const index = buildQuestionMatchIndex(data, '');
    papers.forEach((paper) => {
      const rows = Array.isArray(paper.questions) ? paper.questions : [];
      // Position inside the exam it belongs to, so "comes early / comes late"
      // is measured per exam paper, not across a semester's Mid and Final.
      const sizeByExam = new Map();
      rows.forEach((row) => {
        const exam = examLabel(row.exam);
        sizeByExam.set(exam, (sizeByExam.get(exam) || 0) + 1);
      });
      const seenByExam = new Map();
      rows.forEach((row, rowIndex) => {
        const exam = examLabel(row.exam);
        const seen = seenByExam.get(exam) || 0;
        seenByExam.set(exam, seen + 1);
        const size = sizeByExam.get(exam) || 1;
        const match = index.match(row.question);
        occurrences.push({
          topic: match?.topic || OTHER_TOPIC,
          text: row.question,
          signature: questionSignature(row.question) || `row:${paper.semester}:${rowIndex}`,
          semester: paper.semester,
          exam,
          marks: numberOrNull(row.marks),
          number: numberOrNull(row.number) || rowIndex + 1,
          position: size > 1 ? seen / (size - 1) : 0.5,
          qid: row.qid || '',
          sourceRegions: Array.isArray(row.sourceRegions) ? row.sourceRegions : [],
          needsFigure: Boolean(row.needsFigure),
        });
      });
    });
    return { occurrences, source: 'papers' };
  }

  const topics = Array.isArray(data?.topics) ? data.topics : [];
  topics.forEach((topic) => {
    (Array.isArray(topic?.questions) ? topic.questions : []).forEach((question) => {
      const semesters = splitSemesterList(question.semester);
      const list = semesters.length ? semesters : ['Unknown semester'];
      list.forEach((semester) => {
        occurrences.push({
          topic: topic.name,
          text: question.question,
          signature: questionSignature(question.question) || `${topic.name}:${question.number}`,
          semester,
          exam: examLabel(question.exam),
          marks: numberOrNull(question.marks),
          number: null,
          position: null,
          qid: '',
          sourceRegions: [],
          needsFigure: Boolean(question.needsFigure),
        });
      });
    });
  });
  return { occurrences, source: occurrences.length ? 'topics' : 'none' };
}

/** Distinct papers (oldest first) of the given occurrences. */
export function buildPaperList(occurrences) {
  const map = new Map();
  occurrences.forEach((occurrence) => {
    const id = paperId(occurrence.semester, occurrence.exam);
    if (!map.has(id)) {
      map.set(id, {
        id,
        semester: occurrence.semester,
        exam: occurrence.exam,
        questionCount: 0,
        totalMarks: 0,
      });
    }
    const paper = map.get(id);
    paper.questionCount += 1;
    paper.totalMarks += occurrence.marks || 0;
  });
  return [...map.values()].sort(comparePapersAsc);
}

/** Which exam types exist, most papers first ("Final" wins a tie). */
export function examOptions(data) {
  const { occurrences } = buildOccurrences(data);
  const papers = buildPaperList(occurrences);
  const counts = new Map();
  papers.forEach((paper) => counts.set(paper.exam, (counts.get(paper.exam) || 0) + 1));
  return [...counts.entries()]
    .map(([exam, count]) => ({ exam, count }))
    .sort((a, b) => b.count - a.count || (EXAM_RANK[b.exam] || 0) - (EXAM_RANK[a.exam] || 0));
}

const RECENCY_DECAY = 0.72;

export const TREND_LABELS = {
  due: 'Due',
  rising: 'Rising',
  cooling: 'Cooling',
  new: 'New',
  steady: 'Steady',
};

export const TREND_HINTS = {
  due: 'Comes in most papers but was skipped last time',
  rising: 'Asked more often in the recent papers',
  cooling: 'Asked less often lately',
  new: 'Only started appearing recently',
  steady: 'Comes at a steady rate',
};

/** "Very likely" … "Unlikely" from a 0..1 score. */
export function chanceBand(score) {
  if (score >= 0.6) return { key: 'very-likely', label: 'Very likely' };
  if (score >= 0.4) return { key: 'likely', label: 'Likely' };
  if (score >= 0.22) return { key: 'possible', label: 'Possible' };
  return { key: 'unlikely', label: 'Unlikely' };
}

function classifyTrend({ paperCount, hitIndexes, hitRate }) {
  if (!hitIndexes.length) return 'steady';
  const latest = paperCount - 1;
  const lastIndex = hitIndexes[hitIndexes.length - 1];
  const firstIndex = hitIndexes[0];
  if (paperCount < 3) return 'steady';

  const recentWindow = Math.min(3, Math.max(1, Math.floor(paperCount / 2)));
  const olderWindow = paperCount - recentWindow;
  const recentHits = hitIndexes.filter((index) => index > latest - recentWindow).length;
  const olderHits = hitIndexes.length - recentHits;
  const recentRate = recentHits / recentWindow;
  const olderRate = olderWindow ? olderHits / olderWindow : 0;

  // A regular topic that sat out only the last paper or two is "due"; one
  // that has been gone longer is cooling, not due.
  const gap = latest - lastIndex;
  if (gap >= 1 && gap <= 2 && hitRate >= 0.5 && recentHits >= 1) return 'due';

  if (paperCount >= 4 && firstIndex >= paperCount - 2) return 'new';
  if (recentRate - olderRate >= 0.34) return 'rising';
  if (olderRate - recentRate >= 0.34) return 'cooling';
  return 'steady';
}

/**
 * Topic × paper statistics for one exam type ('all' = every paper).
 *
 * @returns {{
 *   exam: string, papers: object[], topics: object[], source: string,
 *   totalMarks: number,
 * }}
 */
export function buildTopicTrends(data, { exam = 'all' } = {}) {
  const { occurrences: all, source } = buildOccurrences(data);
  const occurrences = exam === 'all' ? all : all.filter((item) => item.exam === exam);
  const papers = buildPaperList(occurrences);
  const paperIndex = new Map(papers.map((paper, index) => [paper.id, index]));
  const paperCount = papers.length;

  const weights = papers.map((_, index) => RECENCY_DECAY ** (paperCount - 1 - index));
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;

  const byTopic = new Map();
  occurrences.forEach((occurrence) => {
    if (!byTopic.has(occurrence.topic)) {
      byTopic.set(occurrence.topic, {
        name: occurrence.topic,
        occurrences: [],
        cells: papers.map(() => ({ count: 0, marks: 0 })),
      });
    }
    const topic = byTopic.get(occurrence.topic);
    topic.occurrences.push(occurrence);
    const index = paperIndex.get(paperId(occurrence.semester, occurrence.exam));
    if (index !== undefined) {
      topic.cells[index].count += 1;
      topic.cells[index].marks += occurrence.marks || 0;
    }
  });

  const totalMarks = occurrences.reduce((sum, item) => sum + (item.marks || 0), 0);
  const draft = [...byTopic.values()].map((topic) => {
    const hitIndexes = topic.cells
      .map((cell, index) => (cell.count ? index : -1))
      .filter((index) => index >= 0);
    const hits = hitIndexes.length;
    const hitRate = paperCount ? hits / paperCount : 0;
    const recency = hitIndexes.reduce((sum, index) => sum + weights[index], 0) / weightSum;
    const marks = topic.occurrences.reduce((sum, item) => sum + (item.marks || 0), 0);
    const positions = topic.occurrences
      .map((item) => item.position)
      .filter((value) => Number.isFinite(value));
    const trend = classifyTrend({ paperCount, hitIndexes, hitRate });
    const lastIndex = hits ? hitIndexes[hits - 1] : -1;
    return {
      name: topic.name,
      hits,
      paperCount,
      hitRate,
      recency,
      asks: topic.occurrences.length,
      marks,
      marksShare: totalMarks ? marks / totalMarks : 0,
      avgMarks: topic.occurrences.some((item) => item.marks)
        ? Math.round((marks / topic.occurrences.filter((item) => item.marks).length) * 10) / 10
        : null,
      uniqueQuestions: new Set(topic.occurrences.map((item) => item.signature)).size,
      position: positions.length ? positions.reduce((s, v) => s + v, 0) / positions.length : null,
      trend,
      firstSeen: hits ? papers[hitIndexes[0]] : null,
      lastSeen: hits ? papers[lastIndex] : null,
      gap: hits ? paperCount - 1 - lastIndex : paperCount,
      cells: topic.cells,
      occurrences: topic.occurrences,
    };
  });

  const maxShare = Math.max(0, ...draft.map((topic) => topic.marksShare)) || 1;
  const topics = draft.map((topic) => {
    let score = 0.42 * topic.hitRate + 0.36 * topic.recency + 0.14 * (topic.marksShare / maxShare);
    if (topic.trend === 'due') score += 0.1;
    else if (topic.trend === 'rising') score += 0.06;
    else if (topic.trend === 'cooling') score -= 0.05;
    score = Math.max(0, Math.min(1, score));
    return { ...topic, score, band: chanceBand(score) };
  }).sort((a, b) => b.score - a.score || b.asks - a.asks || a.name.localeCompare(b.name));

  return { exam, papers, topics, source, totalMarks };
}

/** Short paper label: "Fall 2023 · Final". */
export function paperLabel(paper) {
  if (!paper) return '-';
  return paper.exam && paper.exam !== 'Other' ? `${paper.semester} · ${paper.exam}` : paper.semester;
}

/** Typical shape of one exam paper, read from the past papers. */
export function inferPaperStructure(data, exam = 'all') {
  const trends = buildTopicTrends(data, { exam });
  const counts = trends.papers.map((paper) => paper.questionCount);
  const { occurrences } = buildOccurrences(data);
  const marks = occurrences
    .filter((item) => exam === 'all' || item.exam === exam)
    .map((item) => item.marks)
    .filter(Boolean);
  const questionCount = Math.round(median(counts) || 0) || Math.min(8, trends.topics.length) || 6;
  const marksEach = Math.round(median(marks) || 0) || 10;
  return {
    questionCount: Math.max(1, Math.min(20, questionCount)),
    marksEach: Math.max(1, Math.min(100, marksEach)),
    paperCount: trends.papers.length,
  };
}

// ── coverage: did the AI skip anything? ─────────────────────────────────────

/**
 * Compare PAPER_INVENTORY (what the AI said is printed) with SEMESTER_PAPERS
 * (what it wrote out). A printed number with no row is a missed question.
 */
export function buildCoverage(data) {
  const inventory = Array.isArray(data?.inventory) ? data.inventory : [];
  const papers = Array.isArray(data?.semesterPapers) ? data.semesterPapers : [];

  const rowsFor = (semester, exam) => {
    const paper = papers.find((item) => sameSemester(item.semester, semester));
    if (!paper) return [];
    const rows = Array.isArray(paper.questions) ? paper.questions : [];
    if (!exam || exam === '-' || examLabel(exam) === 'Other') return rows;
    return rows.filter((row) => sameExam(row.exam, exam));
  };

  const covered = new Set();
  const entries = inventory.map((entry) => {
    const rows = rowsFor(entry.semester, entry.exam);
    rows.forEach((row) => covered.add(`${semesterKey(entry.semester)}|${examLabel(row.exam)}|${row.number}`));
    const numbers = new Set(rows.map((row) => Number(row.number)));
    const expected = Array.isArray(entry.numbers) && entry.numbers.length
      ? entry.numbers
      : Array.from({ length: entry.count || 0 }, (_, i) => i + 1);
    const missing = expected.filter((number) => !numbers.has(number));
    return {
      semester: entry.semester,
      exam: entry.exam,
      file: entry.file || '',
      expected: expected.length,
      found: expected.length - missing.length,
      missing,
      extraRows: rows.filter((row) => !expected.includes(Number(row.number))).length,
      status: missing.length ? 'missing' : 'ok',
    };
  });

  // Papers the AI wrote out but never listed in the inventory.
  const untracked = [];
  papers.forEach((paper) => {
    const byExam = new Map();
    (paper.questions || []).forEach((row) => {
      const exam = examLabel(row.exam);
      if (!byExam.has(exam)) byExam.set(exam, 0);
      byExam.set(exam, byExam.get(exam) + 1);
    });
    byExam.forEach((count, exam) => {
      const listed = inventory.some((entry) => sameSemester(entry.semester, paper.semester)
        && (examLabel(entry.exam) === exam || examLabel(entry.exam) === 'Other'));
      if (!listed) untracked.push({ semester: paper.semester, exam, rows: count });
    });
  });

  const expected = entries.reduce((sum, entry) => sum + entry.expected, 0);
  const found = entries.reduce((sum, entry) => sum + entry.found, 0);
  return {
    hasInventory: entries.length > 0,
    entries,
    untracked,
    expected,
    found,
    missingCount: expected - found,
    percent: expected ? Math.round((found / expected) * 100) : 100,
  };
}

/**
 * A follow-up message for the SAME AI chat that asks only for the missed
 * questions, in a shape the site merges as one more part.
 */
export function buildRecoveryPrompt(data, coverage) {
  const missing = (coverage?.entries || []).filter((entry) => entry.missing.length);
  if (!missing.length) return '';
  const topicNames = (Array.isArray(data?.topics) ? data.topics : [])
    .map((topic) => topic.name)
    .filter((name) => name && name !== OTHER_TOPIC);
  const list = missing.map((entry) => {
    const file = entry.file ? ` — file ${entry.file}` : '';
    const numbers = entry.missing.join(', ');
    return `- ${entry.semester} ${entry.exam !== '-' ? entry.exam : ''}${file}: question ${numbers}`.replace(/\s+:/, ':');
  }).join('\n');

  return `You missed some questions. Your PAPER_INVENTORY lists them, but SEMESTER_PAPERS has no row for:

${list}

Open those files again and look at every page as a picture. Then output ONLY
the missing questions as ONE Markdown code block, in exactly the same format
as your first answer:

1. The same front matter (course, title, semesters, files).
2. MASTER QUESTION POOL entries for the missing questions only. Use NEW IDs
   R001, R002, R003 ... — never reuse an ID from your first answer.
3. One "## TOPIC:" block per topic, holding only these new QIDs. Reuse the
   exact topic name from your first answer when the question fits one:
   ${topicNames.length ? topicNames.join('; ') : '(no topics yet)'}
4. "## SEMESTER_PAPERS" with only the missing rows: the printed question
   number in "#", the [QID: Rnnn] reference, Exam, Marks and an exact Source
   cell (RULE 9).
5. "## PAPER_INVENTORY" with the rows of these papers again.

Do not repeat any question you already wrote. Keep every rule of the master
prompt: word-for-word text, sub-parts inside the entry, [image] for pictures.`;
}

// ── manual additions: questions the student cut out themselves ─────────────

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
}

function boxText(box) {
  return box.map((value) => Math.min(1, Math.max(0, Number(value) || 0)).toFixed(3)).join(',');
}

/**
 * Turn the questions a student added by hand into one more Markdown part.
 * It goes through the same parser as the AI output, so every view, the
 * crops and the predictions treat it like any other question.
 */
export function manualQuestionsToMarkdown(entries, { course = '', title = '' } = {}) {
  const list = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.semester);
  if (!list.length) return '';

  const files = [...new Set(list.map((entry) => entry.file).filter(Boolean))];
  const semesters = [...new Set(list.map((entry) => entry.semester))];
  const ids = list.map((_, index) => `M${String(index + 1).padStart(3, '0')}`);
  const textOf = (entry) => {
    const typed = String(entry.text || '').trim();
    const label = `Question ${entry.number || ''} (${entry.semester} ${entry.exam || ''})`.replace(/\s+\)/, ')').trim();
    return typed ? `${escapeCell(typed)} [image]` : `[image] ${label} — see the original paper`;
  };

  const pool = list.map((entry, index) => [
    `[QID: ${ids[index]}] ${textOf(entry)}`,
    `Topic: ${entry.topic || OTHER_TOPIC}`,
    `Semesters: ${entry.semester}`,
  ].join('\n')).join('\n\n');

  const byTopic = new Map();
  list.forEach((entry, index) => {
    const topic = entry.topic || OTHER_TOPIC;
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push({ entry, id: ids[index] });
  });
  const topicBlocks = [...byTopic.entries()].map(([topic, rows]) => [
    `## TOPIC: ${topic}`,
    'priority: LOW',
    `total_asked: ${rows.length}`,
    '',
    '| # | Question | Exam | Semester | Marks | Times |',
    '|---|----------|------|----------|-------|-------|',
    ...rows.map(({ entry, id }, index) => (
      `| ${index + 1} | [QID: ${id}] | ${escapeCell(entry.exam || 'Final')} | ${escapeCell(entry.semester)} | ${entry.marks || '-'} | 1 |`
    )),
  ].join('\n')).join('\n\n');

  const bySemester = new Map();
  list.forEach((entry, index) => {
    if (!bySemester.has(entry.semester)) bySemester.set(entry.semester, []);
    bySemester.get(entry.semester).push({ entry, id: ids[index] });
  });
  const paperBlocks = [...bySemester.entries()].map(([semester, rows]) => [
    `### ${semester}`,
    '| # | Question | Exam | Marks | Source |',
    '|---|----------|------|-------|--------|',
    ...rows.map(({ entry, id }) => {
      const source = entry.file && entry.page && Array.isArray(entry.box)
        ? `${entry.file} :: p${entry.page} :: ${boxText(entry.box)}`
        : '-';
      return `| ${entry.number || 1} | [QID: ${id}] | ${escapeCell(entry.exam || 'Final')} | ${entry.marks || '-'} | ${source} |`;
    }),
  ].join('\n')).join('\n\n');

  return [
    '---',
    `course: ${course}`,
    `title: ${title}`,
    `semesters: [${semesters.join(', ')}]`,
    `files: [${files.join(', ')}]`,
    '---',
    '',
    pool,
    '',
    topicBlocks,
    '',
    '## SEMESTER_PAPERS',
    '',
    paperBlocks,
    '',
  ].join('\n');
}
