/**
 * Question Bank Analyzer — Markdown parser.
 *
 * Pure JS: no React, no DOM, no network. AI output is imperfect, so every
 * stage is deliberately forgiving and never throws. The public contract is:
 *
 *   parseQuestionBank(rawText) -> { data, warnings, errors }
 *   parseQuestionBankParts(texts) -> { data, warnings, errors }
 *   mergeAnalyses(results) -> { data, warnings, errors }
 *
 * `errors` are fatal (nothing usable was found). `warnings` are non-fatal
 * repairs the UI should show in plain language.
 */

export const PRIORITIES = ['VIP', 'HIGH', 'MEDIUM', 'LOW'];

const PRIORITY_RANK = { VIP: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const SEASON_RANK = { spring: 1, summer: 2, fall: 3, autumn: 3, winter: 4 };

// ── small text helpers ───────────────────────────────────────────────────────

function stripEmphasis(value) {
  return String(value ?? '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .trim();
}

function cleanInline(value) {
  return stripEmphasis(value).replace(/\s+/g, ' ').trim();
}

/**
 * Question cells are displayed verbatim. Keep every word, punctuation mark and
 * line break the AI returned; only remove harmless formatting tags and turn
 * <br> into a real newline so sub-parts (a), (b), (c) stay readable.
 */
function cleanQuestion(value) {
  return stripEmphasis(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:b|strong|i|em|u|code|span|div|p|ul|ol|li)>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normKey(value) {
  return cleanInline(value).toLowerCase().replace(/[^a-z0-9#]+/g, '');
}

function normName(value) {
  return cleanInline(value).toLowerCase();
}

function emptyData() {
  return {
    course: '',
    title: '',
    semesters: [],
    topics: [],
    vipMatrix: [],
    studyPlan: [],
    summary: {
      topicCount: 0,
      totalQuestions: 0,
      totalAsked: 0,
      vipCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      approximateCount: 0,
    },
  };
}

function pushUnique(list, seen, message) {
  if (!message || seen.has(message)) return;
  seen.add(message);
  list.push(message);
}

// ── number parsing ───────────────────────────────────────────────────────────

/**
 * Read a count like "3", "~3", "≈ 3", "3x", "about 4", "2-3".
 * Returns { value: number|null, approximate: boolean }.
 */
export function parseCount(value) {
  const raw = cleanInline(value).replace(/,/g, '');
  const approximate = /(^|[\s(])(~|≈|~=|approx\.?|approximately|about|around|circa)/i.test(raw);
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return { value: null, approximate };
  const number = Number(match[0]);
  if (!Number.isFinite(number)) return { value: null, approximate };
  return { value: Math.round(number), approximate };
}

// ── priority / exam / semester normalisation ─────────────────────────────────

export function normalizePriority(value) {
  const key = cleanInline(value).toUpperCase().replace(/[^A-Z]/g, '');
  if (!key) return null;
  if (key.startsWith('VIP') || key.includes('VERYIMPORTANT') || key === 'VERYHIGH') return 'VIP';
  if (key.startsWith('HIGH') || key === 'H' || key === 'IMPORTANT') return 'HIGH';
  if (key.startsWith('MED') || key === 'M' || key === 'NORMAL' || key === 'AVERAGE') return 'MEDIUM';
  if (key.startsWith('LOW') || key === 'L') return 'LOW';
  return null;
}

function normalizeExam(value) {
  const text = cleanInline(value);
  if (!text || text === '-') return '-';
  const key = text.toLowerCase();
  if (/\bquiz\b/.test(key)) return 'Quiz';
  if (/\bmid\b|\bmidterm\b/.test(key)) return 'Mid';
  if (/\bfinal\b|\bfinalterm\b/.test(key)) return 'Final';
  return text;
}

function normalizeSemester(value) {
  const text = cleanInline(value);
  return !text || text === '-' ? '-' : text;
}

function semesterScore(value) {
  const text = String(value || '').toLowerCase();
  const year = text.match(/(?:19|20)\d{2}/);
  const season = Object.keys(SEASON_RANK).find((name) => text.includes(name));
  if (!year && !season) return null;
  return (year ? Number(year[0]) : 0) * 10 + (season ? SEASON_RANK[season] : 0);
}

function latestSemester(semesters) {
  const list = semesters.filter((semester) => semester && semester !== '-');
  if (!list.length) return '-';
  let best = null;
  let bestScore = -Infinity;
  list.forEach((semester) => {
    const score = semesterScore(semester);
    if (score === null) return;
    // Later entries win ties.
    if (score >= bestScore) {
      bestScore = score;
      best = semester;
    }
  });
  return best || list[list.length - 1];
}

// ── fences & front matter ────────────────────────────────────────────────────

function stripCodeFences(text) {
  const fenced = [...text.matchAll(/(?:```|~~~)[^\n]*\n([\s\S]*?)(?:```|~~~)/g)];
  if (fenced.length) {
    const best = fenced.find((match) =>
      /(^|\n)\s*#{1,6}\s*TOPIC\b/i.test(match[1]) ||
      /(^|\n)\s*#{0,6}\s*VIP[\s_-]*MATRIX\b/i.test(match[1]) ||
      /(^|\n)\s*---\s*\n[\s\S]*?\bcourse\s*:/i.test(match[1])
    ) || fenced.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    return best[1];
  }
  // Unterminated opening fence (truncated AI response).
  const open = text.match(/(?:```|~~~)[^\n]*\n([\s\S]*)$/);
  return open ? open[1] : text;
}

function unquote(value) {
  return cleanInline(value).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}

function parseSemesters(value) {
  const raw = unquote(value).replace(/^\[/, '').replace(/\]$/, '');
  if (!raw) return [];
  return raw
    .split(/,|;|\s+\|\s+/)
    .map(unquote)
    .filter(Boolean);
}

function extractFrontMatter(text) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*-{3,}\s*$/.test(lines[i])) continue;
    const lookahead = lines.slice(i + 1, i + 14);
    const keyCount = lookahead.filter((line) => /^\s*(course|title|semesters)\s*:/i.test(line)).length;
    if (keyCount >= 1) {
      start = i;
      break;
    }
  }
  if (start === -1) return { fields: {}, body: text, found: false };

  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*-{3,}\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) return { fields: {}, body: text, found: false };

  const fields = {};
  for (let i = start + 1; i < end; i += 1) {
    const match = lines[i].match(/^\s*([A-Za-z][A-Za-z _-]*?)\s*:\s*(.*)$/);
    if (match) fields[normKey(match[1])] = match[2].trim();
  }
  return { fields, body: lines.slice(end + 1).join('\n'), found: true };
}

// ── section headings ─────────────────────────────────────────────────────────

function detectHeading(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;
  const hasHash = /^#{1,6}\s*\S/.test(trimmed);
  const withoutHashes = stripEmphasis(trimmed.replace(/^#{1,6}\s*/, '')).trim();

  if (/^TOPIC(?:$|\s*[:=]\s*|\s+[-–]\s+|\s+)/i.test(withoutHashes) || /^TOPIC$/i.test(withoutHashes)) {
    if (!hasHash && !/^TOPIC\s*[:=\-–]/i.test(withoutHashes)) return null;
    const name = cleanInline(withoutHashes.replace(/^TOPIC\s*[:=\-–]?\s*/i, ''));
    return { type: 'topic', name: name || 'Untitled topic' };
  }
  if (/^VIP[\s_-]*MATRIX\b/i.test(withoutHashes)) return { type: 'vip' };
  if (/^STUDY[\s_-]*PLAN\b/i.test(withoutHashes)) return { type: 'study' };
  if (hasHash) return { type: 'other' };
  return null;
}

function segmentSections(body) {
  const blocks = [];
  let current = { type: 'preamble', name: '', lines: [] };

  for (const line of body.split('\n')) {
    const heading = detectHeading(line);
    if (heading) {
      if (current.lines.length || current.type !== 'preamble') blocks.push(current);
      current = { type: heading.type, name: heading.name || '', lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  blocks.push(current);
  return blocks;
}

// ── table parsing ────────────────────────────────────────────────────────────

function splitTableRow(line) {
  let text = String(line).trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);

  const cells = [];
  let buffer = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\\' && text[i + 1] === '|') {
      buffer += '|';
      i += 1;
    } else if (char === '|') {
      cells.push(cleanInline(buffer));
      buffer = '';
    } else {
      buffer += char;
    }
  }
  cells.push(cleanInline(buffer));
  return cells;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell.replace(/\s/g, '')));
}

function findColumn(keys, aliases) {
  const normalized = aliases.map(normKey).filter(Boolean);
  for (const alias of normalized) {
    const exact = keys.indexOf(alias);
    if (exact !== -1) return exact;
  }
  for (const alias of normalized) {
    if (alias.length < 3) continue;
    const partial = keys.findIndex((key) => key.includes(alias));
    if (partial !== -1) return partial;
  }
  return -1;
}

function looksLikeTopicHeader(cells) {
  const keys = cells.map(normKey);
  return keys.some((key) => key === 'question' || key === 'questions' || key === 'questiontext');
}

function looksLikeVipHeader(cells) {
  const keys = cells.map(normKey);
  return keys.includes('topic') && (keys.some((key) => key.includes('priority')) || keys.some((key) => key.includes('time')));
}

/**
 * Collect the first table in a block. Returns { header, rows } where header is
 * null when the AI omitted it. Separator rows are dropped.
 */
function extractTable(lines, kind) {
  const tableLines = [];
  for (const line of lines) {
    if (/^\s*\|/.test(line)) tableLines.push(line);
    else if (tableLines.length) break;
  }
  if (!tableLines.length) return { header: null, rows: [] };

  const parsed = tableLines.map(splitTableRow).filter((cells) => !isSeparatorRow(cells));
  if (!parsed.length) return { header: null, rows: [] };

  const header = kind === 'topic' ? looksLikeTopicHeader(parsed[0]) : looksLikeVipHeader(parsed[0]);
  return header
    ? { header: parsed[0], rows: parsed.slice(1) }
    : { header: null, rows: parsed };
}

function topicColumnIndices(header, rows) {
  if (header) {
    const keys = header.map(normKey);
    return {
      number: findColumn(keys, ['#', 'no', 'no.', 'num', 'number', 'serial', 'sl', 'sno', 's no']),
      question: findColumn(keys, ['question', 'questions', 'question text', 'ques', 'q']),
      exam: findColumn(keys, ['exam type', 'exam', 'assessment', 'type']),
      semester: findColumn(keys, ['semester', 'sem', 'term', 'session', 'year']),
      marks: findColumn(keys, ['marks', 'mark', 'score', 'points', 'weightage', 'weight']),
      times: findColumn(keys, ['times asked', 'times', 'time', 'asked', 'count', 'frequency', 'freq', 'repeat']),
    };
  }

  const first = rows[0] || [];
  const firstLooksNumeric = /^\s*#?\s*\d+[.)]?\s*$/.test(first[0] || '');
  return firstLooksNumeric && first.length >= 6
    ? { number: 0, question: 1, exam: 2, semester: 3, marks: 4, times: 5 }
    : { number: -1, question: 0, exam: 1, semester: 2, marks: 3, times: 4 };
}

function vipColumnIndices(header) {
  if (header) {
    const keys = header.map(normKey);
    return {
      topic: findColumn(keys, ['topic', 'topics', 'chapter', 'name']),
      times: findColumn(keys, ['times asked', 'times', 'time', 'asked', 'count', 'frequency', 'freq']),
      avgMarks: findColumn(keys, ['avg marks', 'average marks', 'avg mark', 'avg', 'average', 'marks']),
      lastAsked: findColumn(keys, ['last asked', 'last', 'latest', 'recent', 'most recent']),
      priority: findColumn(keys, ['priority', 'rank', 'level', 'importance']),
    };
  }
  return { topic: 0, times: 1, avgMarks: 2, lastAsked: 3, priority: 4 };
}

function cellAt(row, index) {
  return index >= 0 && index < row.length ? row[index] : '';
}

// ── topic block ──────────────────────────────────────────────────────────────

function parseTopicBlock(block, warn) {
  const name = cleanInline(block.name) || 'Untitled topic';
  let declaredPriority = '';
  let declaredTotal = '';

  for (const line of block.lines) {
    if (/^\s*\|/.test(line)) continue;
    const plain = stripEmphasis(line).trim();
    const priorityMatch = plain.match(/^(?:[-*]\s*)?priority\s*[:=]\s*(.+)$/i);
    if (priorityMatch) declaredPriority = priorityMatch[1];
    const totalMatch = plain.match(/^(?:[-*]\s*)?total[\s_-]*asked\s*[:=]\s*(.+)$/i);
    if (totalMatch) declaredTotal = totalMatch[1];
  }

  let priority = normalizePriority(declaredPriority);
  if (!priority) {
    if (cleanInline(declaredPriority)) {
      warn(`Topic "${name}" has priority "${cleanInline(declaredPriority)}", which is not VIP/HIGH/MEDIUM/LOW — using MEDIUM.`);
    } else {
      warn(`Topic "${name}" has no priority — using MEDIUM.`);
    }
    priority = 'MEDIUM';
  }

  const { header, rows } = extractTable(block.lines, 'topic');
  const indices = topicColumnIndices(header, rows);

  if (header) {
    const missing = [
      ['Exam', indices.exam],
      ['Semester', indices.semester],
      ['Marks', indices.marks],
      ['Times', indices.times],
    ].filter(([, index]) => index === -1).map(([label]) => label);
    if (missing.length) {
      warn(`Topic "${name}": the table is missing the ${missing.join(', ')} column(s) — missing values were filled with "-".`);
    }
  } else if (rows.length) {
    warn(`Topic "${name}": the table has no header row — columns were read in the standard order.`);
  }

  const questions = [];
  let shortRows = 0;
  rows.forEach((row, rowIndex) => {
    if (header && row.length < header.length) shortRows += 1;
    const question = cleanQuestion(cellAt(row, indices.question));
    if (!question || question === '-' || /^[-–—]+$/.test(question)) return;
    if (looksLikeTopicHeader(row)) return;

    const numberToken = cellAt(row, indices.number);
    const numberValue = parseInt(numberToken, 10);
    const number = Number.isFinite(numberValue) && numberValue > 0 ? numberValue : rowIndex + 1;

    const timesParsed = parseCount(cellAt(row, indices.times));
    let times = timesParsed.value;
    if (times === null || times < 0) times = 1;
    const timesApproximate = timesParsed.approximate;

    const marksParsed = parseCount(cellAt(row, indices.marks));
    const marks = marksParsed.value;
    const marksApproximate = marksParsed.approximate;

    const rawTimes = cleanInline(cellAt(row, indices.times));
    if (!rawTimes || rawTimes === '-') {
      if (indices.times !== -1) {
        warn(`Topic "${name}": a question has no Times value — counted once.`);
      }
    }

    questions.push({
      number,
      question,
      exam: normalizeExam(cellAt(row, indices.exam)),
      semester: normalizeSemester(cellAt(row, indices.semester)),
      marks,
      marksApproximate,
      times,
      timesApproximate,
    });
  });

  if (shortRows) {
    warn(`Topic "${name}": ${shortRows} row(s) had fewer columns than the header — missing values were filled with "-" and Times was counted once.`);
  }
  if (!rows.length) {
    warn(`Topic "${name}" was found, but it has no question table.`);
  }
  if (!questions.length && rows.length) {
    warn(`Topic "${name}" has table rows, but no readable question text.`);
  }

  const computedTotal = questions.reduce((sum, question) => sum + (question.times || 0), 0);
  const declaredParsed = parseCount(declaredTotal);
  let totalAsked = computedTotal;
  let totalApproximate = declaredParsed.approximate;
  if (declaredParsed.value === null) {
    if (questions.length) {
      warn(`Topic "${name}" has no total_asked — calculated ${computedTotal} from the Times column.`);
    }
  } else if (declaredParsed.value !== computedTotal) {
    warn(`Topic "${name}" says total_asked ${declaredParsed.value}, but its question rows add up to ${computedTotal}. Used ${computedTotal}.`);
  } else {
    totalApproximate = declaredParsed.approximate;
  }

  const marksList = questions.map((question) => question.marks).filter((value) => typeof value === 'number');
  const avgMarks = marksList.length
    ? Math.round((marksList.reduce((sum, value) => sum + value, 0) / marksList.length) * 10) / 10
    : null;

  return {
    name,
    priority,
    totalAsked,
    totalApproximate,
    avgMarks,
    lastAsked: latestSemester(questions.map((question) => question.semester)),
    questions,
    timesAsked: computedTotal,
  };
}

// ── VIP matrix ───────────────────────────────────────────────────────────────

function parseVipBlock(block, warn) {
  const { header, rows } = extractTable(block.lines, 'vip');
  const indices = vipColumnIndices(header);
  const parsed = [];

  for (const row of rows) {
    const topic = cleanInline(cellAt(row, indices.topic));
    if (!topic || topic === '-') continue;
    if (looksLikeVipHeader(row)) continue;

    const times = parseCount(cellAt(row, indices.times));
    const avgMarks = parseCount(cellAt(row, indices.avgMarks));
    const lastAsked = cleanInline(cellAt(row, indices.lastAsked));
    const rawPriority = cellAt(row, indices.priority);
    let priority = normalizePriority(rawPriority);
    if (!priority) {
      if (cleanInline(rawPriority)) {
        warn(`VIP matrix priority "${cleanInline(rawPriority)}" for "${topic}" is not VIP/HIGH/MEDIUM/LOW — using MEDIUM.`);
      }
      priority = 'MEDIUM';
    }

    parsed.push({
      topic,
      timesAsked: times.value === null ? 0 : times.value,
      avgMarks: avgMarks.value,
      lastAsked: lastAsked && lastAsked !== '-' ? lastAsked : '-',
      priority,
    });
  }
  return parsed;
}

function buildMatrixFromTopics(topics) {
  return topics.map((topic) => ({
    topic: topic.name,
    timesAsked: topic.timesAsked,
    avgMarks: topic.avgMarks,
    lastAsked: topic.lastAsked,
    priority: topic.priority,
  }));
}

export function sortVipMatrix(matrix) {
  return [...matrix].sort((a, b) => {
    const priority = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    if (priority) return priority;
    const times = (b.timesAsked || 0) - (a.timesAsked || 0);
    if (times) return times;
    return String(a.topic).localeCompare(String(b.topic));
  });
}

// ── study plan ───────────────────────────────────────────────────────────────

function parseStudyPlan(block) {
  const items = [];
  const seen = new Set();
  for (const line of block.lines) {
    if (/^\s*\|/.test(line)) continue;
    const plain = stripEmphasis(line).trim();
    const match = plain.match(/^(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (!match) continue;
    const text = cleanInline(match[1]);
    if (!text || seen.has(normName(text))) continue;
    seen.add(normName(text));
    items.push({ step: items.length + 1, text });
  }
  return items;
}

function fallbackStudyPlan(topics) {
  return sortVipMatrix(buildMatrixFromTopics(topics)).map((row, index) => {
    const topic = topics.find((item) => normName(item.name) === normName(row.topic));
    const asked = row.timesAsked === 1 ? '1 time' : `${row.timesAsked} times`;
    let reason;
    if (row.priority === 'VIP') reason = `start here — ${asked} in past exams`;
    else if (row.priority === 'HIGH') reason = `revise early — ${asked} in past exams`;
    else if (row.priority === 'MEDIUM') reason = `cover after the top topics — ${asked} in past exams`;
    else reason = `lowest exam frequency (${asked}) — review if time allows`;
    if (topic && topic.avgMarks !== null) reason += `, average ${topic.avgMarks} marks`;
    return { step: index + 1, text: `${row.topic} — ${reason}.` };
  });
}

// ── summary ──────────────────────────────────────────────────────────────────

function recomputeSummary(topics, matrix) {
  const questions = topics.flatMap((topic) => topic.questions);
  return {
    topicCount: topics.length,
    totalQuestions: questions.length,
    totalAsked: questions.reduce((sum, question) => sum + (question.times || 0), 0),
    vipCount: matrix.filter((row) => row.priority === 'VIP').length,
    highCount: matrix.filter((row) => row.priority === 'HIGH').length,
    mediumCount: matrix.filter((row) => row.priority === 'MEDIUM').length,
    lowCount: matrix.filter((row) => row.priority === 'LOW').length,
    approximateCount: questions.filter((question) => question.timesApproximate || question.marksApproximate).length,
  };
}

function collectSemesters(frontMatterSemesters, topics) {
  const ordered = [];
  const seen = new Set();
  const add = (semester) => {
    const clean = cleanInline(semester);
    if (!clean || clean === '-') return;
    const key = normName(clean);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(clean);
  };
  (frontMatterSemesters || []).forEach(add);
  topics.forEach((topic) => topic.questions.forEach((question) => add(question.semester)));
  return ordered;
}

// ── main parse ───────────────────────────────────────────────────────────────

export function parseQuestionBank(rawText) {
  const warnings = [];
  const errors = [];
  const warningSet = new Set();
  const errorSet = new Set();
  const warn = (message) => pushUnique(warnings, warningSet, message);
  const fail = (message) => pushUnique(errors, errorSet, message);

  try {
    if (typeof rawText !== 'string' || !rawText.trim()) {
      fail('No Markdown was provided. Paste the AI output or upload the .md file first.');
      return { data: emptyData(), warnings, errors };
    }

    let text = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    text = stripCodeFences(text);

    const frontMatter = extractFrontMatter(text);
    let body = frontMatter.body;
    const fields = frontMatter.fields || {};

    if (!frontMatter.found) {
      warn('No front matter was found — course code and title could not be read from the file. You can still type them above.');
    }

    // Ignore any prose the AI added before the first recognised section.
    const bodyLines = body.split('\n');
    const firstSection = bodyLines.findIndex((line) => {
      const heading = detectHeading(line);
      return heading && heading.type !== 'other';
    });
    if (firstSection > 0) body = bodyLines.slice(firstSection).join('\n');

    const blocks = segmentSections(body);
    const topics = [];
    const topicMap = new Map();

    for (const block of blocks) {
      if (block.type !== 'topic') continue;
      const topic = parseTopicBlock(block, warn);
      const key = normName(topic.name);
      const existing = topicMap.get(key);
      if (existing) {
        const duplicates = mergeTopic(existing, topic);
        warn(
          `Topic "${existing.name}" appeared more than once — the topic blocks were merged`
          + `${duplicates ? ` and ${duplicates} duplicate question row(s) were removed` : ''}.`,
        );
        recomputeTopic(existing);
      } else {
        topicMap.set(key, topic);
        topics.push(topic);
      }
    }

    if (!topics.length) {
      fail('This does not look like a Question Bank Analysis file. The AI output should contain "## TOPIC: ..." sections, or at least a "## VIP_MATRIX" table.');
      return { data: emptyData(), warnings, errors };
    }

    const totalQuestions = topics.reduce((sum, topic) => sum + topic.questions.length, 0);
    if (!totalQuestions) {
      warn('TOPIC sections were found, but no readable question rows were detected. Check that the AI included the question table.');
    }

    // VIP matrix: trust the provided one, but repair it against the topics.
    const vipBlock = blocks.find((block) => block.type === 'vip');
    let providedMatrix = [];
    if (vipBlock) providedMatrix = parseVipBlock(vipBlock, warn);

    let vipMatrix;
    if (providedMatrix.length) {
      vipMatrix = providedMatrix.map((row) => {
        const topic = topics.find((item) => normName(item.name) === normName(row.topic))
          || topics.find((item) => normName(item.name).includes(normName(row.topic)) || normName(row.topic).includes(normName(item.name)));
        if (!topic) return row;
        if (row.timesAsked && row.timesAsked !== topic.timesAsked) {
          warn(`VIP matrix says "${row.topic}" was asked ${row.timesAsked} time(s), but its question rows add up to ${topic.timesAsked}. Used ${topic.timesAsked}.`);
        }
        return {
          topic: topic.name,
          timesAsked: topic.timesAsked,
          avgMarks: topic.avgMarks !== null ? topic.avgMarks : row.avgMarks,
          lastAsked: topic.lastAsked !== '-' ? topic.lastAsked : row.lastAsked,
          priority: row.priority || topic.priority,
        };
      });

      for (const topic of topics) {
        if (!vipMatrix.some((row) => normName(row.topic) === normName(topic.name))) {
          vipMatrix.push({
            topic: topic.name,
            timesAsked: topic.timesAsked,
            avgMarks: topic.avgMarks,
            lastAsked: topic.lastAsked,
            priority: topic.priority,
          });
          warn(`VIP matrix did not include "${topic.name}" — added it from the topic block.`);
        }
      }
    } else {
      vipMatrix = buildMatrixFromTopics(topics);
      warn('No VIP_MATRIX section was found, so it was built from the TOPIC blocks (sum of Times, average Marks, latest semester, topic priority).');
    }

    vipMatrix = sortVipMatrix(vipMatrix);

    const studyBlock = blocks.find((block) => block.type === 'study');
    let studyPlan = studyBlock ? parseStudyPlan(studyBlock) : [];
    if (!studyPlan.length) {
      studyPlan = fallbackStudyPlan(topics);
      warn('No STUDY_PLAN section was found, so study suggestions were generated from the VIP matrix.');
    }

    const data = {
      course: unquote(fields.course || ''),
      title: unquote(fields.title || ''),
      semesters: collectSemesters(parseSemesters(fields.semesters || ''), topics),
      topics,
      vipMatrix,
      studyPlan,
      summary: recomputeSummary(topics, vipMatrix),
    };

    if (data.summary.approximateCount > 0) {
      warn(`${data.summary.approximateCount} count(s) were marked approximate (for example "~3"). They were read as whole numbers — double-check those rows.`);
    }

    return { data, warnings, errors };
  } catch {
    return {
      data: emptyData(),
      warnings,
      errors: [
        'The file could not be parsed. Check that it is the Markdown text returned by the AI, not a PDF or a screenshot.',
      ],
    };
  }
}

// ── merging multiple parts ───────────────────────────────────────────────────

function recomputeTopic(topic) {
  topic.timesAsked = topic.questions.reduce((sum, question) => sum + (question.times || 0), 0);
  topic.totalAsked = topic.timesAsked;
  const marks = topic.questions.map((question) => question.marks).filter((value) => typeof value === 'number');
  topic.avgMarks = marks.length
    ? Math.round((marks.reduce((sum, value) => sum + value, 0) / marks.length) * 10) / 10
    : null;
  topic.lastAsked = latestSemester(topic.questions.map((question) => question.semester));
  return topic;
}

function mergeTopic(target, incoming) {
  const seen = new Set(target.questions.map((question) => [
    normName(question.question),
    normName(question.exam),
    normName(question.semester),
    question.marks ?? '-',
  ].join('|')));
  let duplicates = 0;

  for (const question of incoming.questions) {
    const key = [
      normName(question.question),
      normName(question.exam),
      normName(question.semester),
      question.marks ?? '-',
    ].join('|');
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    target.questions.push(question);
  }

  target.questions.forEach((question, index) => { question.number = index + 1; });
  target.priority = (PRIORITY_RANK[incoming.priority] || 0) > (PRIORITY_RANK[target.priority] || 0)
    ? incoming.priority
    : target.priority;
  target.totalApproximate = target.totalApproximate || incoming.totalApproximate;
  return duplicates;
}

export function mergeAnalyses(parsedList) {
  const warnings = [];
  const errors = [];
  const warningSet = new Set();
  const errorSet = new Set();
  const warn = (message) => pushUnique(warnings, warningSet, message);
  const fail = (message) => pushUnique(errors, errorSet, message);

  const list = Array.isArray(parsedList) ? parsedList.filter(Boolean) : [];
  if (!list.length) {
    fail('No parts were provided.');
    return { data: emptyData(), warnings, errors };
  }

  const good = list.filter((part) => part.data && Array.isArray(part.data.topics) && part.data.topics.length);
  if (!good.length) {
    list.forEach((part, index) => {
      (part.errors || []).forEach((message) => fail(`Part ${index + 1}: ${message}`));
    });
    if (!errors.length) fail('None of the parts contained a readable TOPIC section.');
    return { data: emptyData(), warnings, errors };
  }

  list.forEach((part, index) => {
    if (!part.data || !part.data.topics.length) {
      const reason = part.errors && part.errors[0] ? part.errors[0] : 'no TOPIC sections were found';
      warn(`Part ${index + 1} could not be read (${reason}) — it was skipped.`);
      return;
    }
    (part.warnings || []).forEach((message) => warn(`Part ${index + 1}: ${message}`));
  });

  let course = '';
  let title = '';
  const semesterList = [];
  const topicMap = new Map();
  const topics = [];
  let duplicateRows = 0;
  const plan = [];
  const planSeen = new Set();

  for (const part of good) {
    const data = part.data;
    if (data.course && course && normName(data.course) !== normName(course)) {
      warn(`Different course codes were found between parts ("${course}" and "${data.course}"). Kept "${course}".`);
    }
    if (!course && data.course) course = data.course;
    if (data.title && title && normName(data.title) !== normName(title)) {
      warn(`Different course titles were found between parts. Kept "${title}".`);
    }
    if (!title && data.title) title = data.title;

    (data.semesters || []).forEach((semester) => {
      const key = normName(semester);
      if (key && !semesterList.some((item) => normName(item) === key)) semesterList.push(semester);
    });

    for (const topic of data.topics) {
      const key = normName(topic.name);
      const existing = topicMap.get(key);
      if (existing) {
        duplicateRows += mergeTopic(existing, topic);
      } else {
        const copy = {
          ...topic,
          questions: topic.questions.map((question) => ({ ...question })),
        };
        topicMap.set(key, copy);
        topics.push(copy);
      }
    }

    (data.studyPlan || []).forEach((item) => {
      const key = normName(item.text);
      if (!key || planSeen.has(key)) return;
      planSeen.add(key);
      plan.push({ step: plan.length + 1, text: item.text });
    });
  }

  if (duplicateRows > 0) {
    warn(`${duplicateRows} duplicate question row(s) were merged across parts (likely the "continue" overlap).`);
  }

  // Recompute every topic count from the merged rows.
  for (const topic of topics) recomputeTopic(topic);

  const vipMatrix = sortVipMatrix(buildMatrixFromTopics(topics));
  warn('Parts were merged, so the VIP matrix was recalculated from all question rows.');

  const studyPlan = plan.length ? plan : fallbackStudyPlan(topics);
  if (!plan.length) warn('Study suggestions were generated from the merged VIP matrix.');

  const data = {
    course,
    title,
    semesters: collectSemesters(semesterList, topics),
    topics,
    vipMatrix,
    studyPlan,
    summary: recomputeSummary(topics, vipMatrix),
  };

  if (data.summary.approximateCount > 0) {
    warn(`${data.summary.approximateCount} count(s) were marked approximate and were read as whole numbers.`);
  }

  return { data, warnings, errors };
}

export function parseQuestionBankParts(texts) {
  const list = Array.isArray(texts) ? texts : [texts];
  // A single file is the common case: keep its own VIP matrix and priorities
  // exactly as the AI wrote them (the merge step intentionally recalculates).
  if (list.length === 1) return parseQuestionBank(list[0]);
  const parsed = list.map((text) => parseQuestionBank(text));
  return mergeAnalyses(parsed);
}

export default parseQuestionBank;
