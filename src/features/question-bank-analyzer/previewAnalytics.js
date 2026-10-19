/**
 * Pure aggregation helpers for the question-bank preview.
 *
 * The parser already normalises the raw Markdown. This file turns that data
 * into the numbers the dashboard displays: priority weights, top topics,
 * semester coverage, exam mix and the short "what should I study first"
 * insights. No React, no DOM, no chart library.
 */

import { PRIORITIES } from './parseQuestionBank';

const PRIORITY_RANK = { VIP: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEASON_RANK = { spring: 1, summer: 2, fall: 3, autumn: 3, winter: 4 };

const EXAM_TONES = {
  Final: 'cyan',
  Mid: 'violet',
  Quiz: 'amber',
  Other: 'neutral',
};

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function priorityKey(value) {
  const key = String(value || 'MEDIUM').toUpperCase();
  return PRIORITIES.includes(key) ? key : 'MEDIUM';
}

function normName(value) {
  return String(value || '').trim().toLowerCase();
}

function semesterScore(value) {
  const text = String(value || '').toLowerCase();
  const year = text.match(/(?:19|20)\d{2}/);
  const season = Object.keys(SEASON_RANK).find((name) => text.includes(name));
  if (!year && !season) return null;
  return (year ? Number(year[0]) : 0) * 10 + (season ? SEASON_RANK[season] : 0);
}

function emptyPriorityMap() {
  return Object.fromEntries(PRIORITIES.map((priority) => [priority, 0]));
}

function topicAsks(topic) {
  const questions = Array.isArray(topic?.questions) ? topic.questions : [];
  return numberOr(
    topic?.timesAsked,
    questions.reduce((sum, question) => sum + numberOr(question.times), 0),
  );
}

function examLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return 'Other';
  if (/final/i.test(raw)) return 'Final';
  if (/\bmid\b|\bmidterm\b/i.test(raw)) return 'Mid';
  if (/\bquiz\b/i.test(raw)) return 'Quiz';
  return 'Other';
}

/**
 * Build every derived number used by the preview in one pass.
 */
export function buildPreviewAnalytics(data) {
  const topics = Array.isArray(data?.topics) ? data.topics : [];
  const summary = data?.summary || {};
  const allQuestions = [];

  topics.forEach((topic, topicIndex) => {
    const topicPriority = priorityKey(topic.priority);
    const questions = Array.isArray(topic.questions) ? topic.questions : [];
    questions.forEach((question, questionIndex) => {
      allQuestions.push({
        ...question,
        topic: topic.name || 'Untitled topic',
        topicPriority,
        topicIndex,
        questionIndex,
        // The question's own position inside its topic — the pictures of a
        // question are keyed by it, so it must survive merging.
        originalIndex: question.originalIndex ?? questionIndex,
      });
    });
  });

  const computedAsked = topics.reduce((sum, topic) => sum + topicAsks(topic), 0);
  const totalQuestions = allQuestions.length || numberOr(summary.totalQuestions);
  const totalAsked = computedAsked || numberOr(summary.totalAsked);

  const priorityTopics = emptyPriorityMap();
  const priorityAsks = emptyPriorityMap();
  const priorityQuestions = emptyPriorityMap();

  for (const topic of topics) {
    const priority = priorityKey(topic.priority);
    priorityTopics[priority] += 1;
    priorityAsks[priority] += topicAsks(topic);
  }
  for (const question of allQuestions) {
    priorityQuestions[question.topicPriority] += 1;
  }

  const topTopics = [...topics]
    .map((topic) => ({
      name: topic.name || 'Untitled topic',
      priority: priorityKey(topic.priority),
      timesAsked: topicAsks(topic),
      questionCount: Array.isArray(topic.questions) ? topic.questions.length : 0,
      avgMarks: topic.avgMarks,
      lastAsked: topic.lastAsked,
    }))
    .sort((a, b) => (
      b.timesAsked - a.timesAsked
      || b.questionCount - a.questionCount
      || (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
      || a.name.localeCompare(b.name)
    ))
    .slice(0, 6);

  const maxTimes = Math.max(1, ...topics.map((topic) => topicAsks(topic)));

  // ── semester coverage ─────────────────────────────────────────────────────
  const semesterMap = new Map();
  for (const question of allQuestions) {
    const name = question.semester && question.semester !== '-'
      ? question.semester
      : 'Unknown semester';
    if (!semesterMap.has(name)) {
      semesterMap.set(name, {
        name,
        total: 0,
        asks: 0,
        byPriority: emptyPriorityMap(),
        topicNames: new Set(),
      });
    }
    const bucket = semesterMap.get(name);
    bucket.total += 1;
    bucket.asks += numberOr(question.times);
    bucket.byPriority[question.topicPriority] += 1;
    bucket.topicNames.add(question.topic);
  }

  const semesterStats = [...semesterMap.values()]
    .map((semester) => ({
      ...semester,
      topicCount: semester.topicNames.size,
    }))
    .sort((a, b) => {
      const scoreA = semesterScore(a.name);
      const scoreB = semesterScore(b.name);
      if (scoreA === null && scoreB === null) return a.name.localeCompare(b.name);
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      return scoreA - scoreB;
    });

  const listedSemesters = Array.isArray(data?.semesters) ? data.semesters.filter(Boolean) : [];
  const knownSemesterCount = listedSemesters.length
    || semesterStats.filter((semester) => semester.name !== 'Unknown semester').length;
  const latestSemester = [...semesterStats]
    .reverse()
    .find((semester) => semester.name !== 'Unknown semester')?.name
    || listedSemesters[listedSemesters.length - 1]
    || '';

  // ── exam mix ──────────────────────────────────────────────────────────────
  const examMap = new Map();
  for (const question of allQuestions) {
    const label = examLabel(question.exam);
    if (!examMap.has(label)) {
      examMap.set(label, {
        label,
        count: 0,
        asks: 0,
        tone: EXAM_TONES[label] || 'neutral',
      });
    }
    const bucket = examMap.get(label);
    bucket.count += 1;
    bucket.asks += numberOr(question.times);
  }
  const examStats = [...examMap.values()].sort((a, b) => (
    b.count - a.count || a.label.localeCompare(b.label)
  ));
  const topExam = examStats[0] || null;
  const maxExamCount = Math.max(1, ...examStats.map((exam) => exam.count));

  // ── VIP matrix ────────────────────────────────────────────────────────────
  const topicByName = new Map(topics.map((topic) => [normName(topic.name), topic]));
  const rawMatrix = Array.isArray(data?.vipMatrix) && data.vipMatrix.length
    ? data.vipMatrix
    : topics.map((topic) => ({
      topic: topic.name,
      timesAsked: topicAsks(topic),
      avgMarks: topic.avgMarks,
      lastAsked: topic.lastAsked,
      priority: topic.priority,
    }));

  const matrix = rawMatrix
    .map((row) => {
      const topic = topicByName.get(normName(row.topic)) || null;
      return {
        topic: row.topic || topic?.name || 'Untitled topic',
        priority: priorityKey(row.priority || topic?.priority),
        timesAsked: numberOr(row.timesAsked, topic ? topicAsks(topic) : 0),
        avgMarks: row.avgMarks ?? topic?.avgMarks ?? null,
        lastAsked: row.lastAsked || topic?.lastAsked || '-',
        questionCount: topic && Array.isArray(topic.questions) ? topic.questions.length : 0,
        topicRef: topic,
      };
    })
    .sort((a, b) => (
      (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
      || b.timesAsked - a.timesAsked
      || a.topic.localeCompare(b.topic)
    ))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const maxMatrixTimes = Math.max(1, ...matrix.map((row) => row.timesAsked));

  const vipTopics = topics.filter((topic) => priorityKey(topic.priority) === 'VIP');
  const firstHigh = topics.find((topic) => priorityKey(topic.priority) === 'HIGH');
  const topTopic = topTopics[0] || null;
  const topShare = totalAsked && topTopic
    ? Math.round((topTopic.timesAsked / totalAsked) * 100)
    : 0;
  const repeatFactor = totalQuestions ? totalAsked / totalQuestions : 0;
  const approxCount = allQuestions.filter(
    (question) => question.timesApproximate || question.marksApproximate,
  ).length || numberOr(summary.approximateCount);

  return {
    topics,
    allQuestions,
    totalQuestions,
    totalAsked,
    priorityTopics,
    priorityAsks,
    priorityQuestions,
    topTopics,
    maxTimes,
    semesterStats,
    knownSemesterCount,
    latestSemester,
    examStats,
    maxExamCount,
    topExam,
    matrix,
    maxMatrixTimes,
    vipTopics,
    firstHigh,
    topTopic,
    topShare,
    repeatFactor,
    approxCount,
    summary,
  };
}

/**
 * Narrow the parsed report to the topics picked in the preview filter.
 *
 * The parser data stays untouched (the PDF exports keep the full course), but
 * every preview calculation uses this subset so the summary, matrix, charts,
 * semesters and study plan all describe the same visible questions. Passing an
 * empty list, every topic, or only stale names returns the original data.
 */
export function filterPreviewData(data, selectedNames) {
  if (!data) return data;

  const topics = Array.isArray(data.topics) ? data.topics : [];
  const topicNames = new Set(topics.map((topic) => normName(topic.name)));
  const wanted = new Set(
    (Array.isArray(selectedNames) ? selectedNames : [])
      .map(normName)
      .filter((name) => name && topicNames.has(name)),
  );

  if (!wanted.size || wanted.size >= topicNames.size) return data;

  const filteredTopics = topics.filter((topic) => wanted.has(normName(topic.name)));
  if (!filteredTopics.length) return data;

  const questions = filteredTopics.flatMap((topic) => (
    Array.isArray(topic.questions) ? topic.questions : []
  ));
  const totalAsked = filteredTopics.reduce((sum, topic) => sum + topicAsks(topic), 0);
  const priorityCounts = emptyPriorityMap();
  for (const topic of filteredTopics) {
    priorityCounts[priorityKey(topic.priority)] += 1;
  }

  const semesterNames = [];
  const seenSemesters = new Set();
  for (const question of questions) {
    const name = question.semester && question.semester !== '-' ? String(question.semester) : '';
    const key = normName(name);
    if (name && !seenSemesters.has(key)) {
      seenSemesters.add(key);
      semesterNames.push(name);
    }
  }

  const vipMatrix = (Array.isArray(data.vipMatrix) ? data.vipMatrix : []).filter((row) => (
    wanted.has(normName(row.topic))
  ));

  const studyPlan = (Array.isArray(data.studyPlan) ? data.studyPlan : []).filter((item) => {
    const text = normName(typeof item === 'string' ? item : item?.text);
    return filteredTopics.some((topic) => text.includes(normName(topic.name)));
  });

  return {
    ...data,
    topics: filteredTopics,
    semesters: semesterNames,
    vipMatrix,
    studyPlan,
    summary: {
      ...(data.summary || {}),
      topicCount: filteredTopics.length,
      totalQuestions: questions.length,
      totalAsked,
      approximateCount: questions.filter(
        (question) => question.timesApproximate || question.marksApproximate,
      ).length,
      vipCount: priorityCounts.VIP,
      highCount: priorityCounts.HIGH,
      mediumCount: priorityCounts.MEDIUM,
      lowCount: priorityCounts.LOW,
    },
  };
}

/**
 * Apply the preview's manual "merge similar questions" groups.
 *
 * A group is an array of original question indices inside one topic. The first
 * selected question becomes the visible row; the others are kept verbatim in
 * its `variants` array, so no wording or metadata is ever discarded. Groups
 * that overlap, point outside the topic, or contain fewer than two questions
 * are ignored. Without valid groups the original report is returned untouched.
 */
export function applyManualMerges(data, mergeGroups) {
  if (!data) return data;

  const topics = Array.isArray(data.topics) ? data.topics : [];
  if (!topics.length) return data;
  const groupsByTopic = mergeGroups && typeof mergeGroups === 'object' ? mergeGroups : {};
  let changed = false;

  const mergedTopics = topics.map((topic) => {
    const questions = Array.isArray(topic.questions) ? topic.questions : [];
    const rawGroups = Array.isArray(groupsByTopic[topic.name]) ? groupsByTopic[topic.name] : [];
    const used = new Set();
    const groups = [];

    for (const group of rawGroups) {
      if (!Array.isArray(group)) continue;
      const indices = [...new Set(group)]
        .filter((index) => (
          Number.isInteger(index)
          && index >= 0
          && index < questions.length
          && !used.has(index)
        ))
        .sort((a, b) => a - b);
      if (indices.length < 2) continue;
      indices.forEach((index) => used.add(index));
      groups.push(indices);
    }

    if (!groups.length) {
      return {
        ...topic,
        questions: questions.map((question, index) => ({ ...question, originalIndex: index })),
      };
    }

    changed = true;
    const groupsByFirst = new Map(groups.map((indices) => [indices[0], indices]));
    const mergedQuestions = [];

    questions.forEach((question, index) => {
      const indices = groupsByFirst.get(index);
      if (indices) {
        const variants = indices.map((variantIndex) => questions[variantIndex]);
        const first = variants[0];
        mergedQuestions.push({
          ...first,
          originalIndex: index,
          merged: true,
          mergedIndices: indices,
          variants,
          // A picture on any of the versions belongs to the merged row.
          needsFigure: variants.some((variant) => variant.needsFigure),
          // The wordings now live in the variants, not in the row itself.
          versions: [],
          times: variants.reduce((sum, variant) => sum + numberOr(variant.times), 0),
          timesApproximate: variants.some((variant) => variant.timesApproximate),
          marksApproximate: variants.some((variant) => variant.marksApproximate),
        });
      } else if (!used.has(index)) {
        mergedQuestions.push({ ...question, originalIndex: index });
      }
    });

    return { ...topic, questions: mergedQuestions };
  });

  if (!changed) return data;

  const allQuestions = mergedTopics.flatMap((topic) => (
    Array.isArray(topic.questions) ? topic.questions : []
  ));
  const totalAsked = mergedTopics.reduce((sum, topic) => sum + topicAsks(topic), 0);
  const priorityCounts = emptyPriorityMap();
  for (const topic of mergedTopics) {
    priorityCounts[priorityKey(topic.priority)] += 1;
  }

  return {
    ...data,
    topics: mergedTopics,
    summary: {
      ...(data.summary || {}),
      topicCount: mergedTopics.length,
      totalQuestions: allQuestions.length,
      totalAsked,
      approximateCount: allQuestions.filter((question) => (
        question.timesApproximate
        || question.marksApproximate
        || question.variants?.some((variant) => variant.timesApproximate || variant.marksApproximate)
      )).length,
      vipCount: priorityCounts.VIP,
      highCount: priorityCounts.HIGH,
      mediumCount: priorityCounts.MEDIUM,
      lowCount: priorityCounts.LOW,
    },
  };
}

/**
 * Every wording of one question, in display order.
 *
 * A question can carry its own wordings (`versions` — the AI writes
 * "Version 1: ... Version 2: ..." inside one row) or be merged by hand
 * (`variants` — the rows the student grouped in the preview). Both end up
 * here so the preview and the print report show the same thing.
 *
 * @returns {Array<{ label: string, text: string }>}
 */
export function buildQuestionVersions(question) {
  if (!question) return [];

  const variants = Array.isArray(question.variants) ? question.variants : [];
  if (variants.length) {
    // When a merged row already carries wordings of its own, number them
    // "1.1", "1.2", "2.1" so no two pills carry the same label.
    const nested = variants.some((variant) => (
      Array.isArray(variant.versions) && variant.versions.length
    ));
    const list = [];
    variants.forEach((variant, index) => {
      const own = Array.isArray(variant.versions) ? variant.versions : [];
      if (own.length) {
        own.forEach((version, ownIndex) => list.push({
          label: nested ? `Version ${index + 1}.${ownIndex + 1}` : `Version ${index + 1}`,
          text: version.text,
        }));
      } else {
        list.push({
          label: nested ? `Version ${index + 1}.1` : `Version ${index + 1}`,
          text: variant.question || '—',
        });
      }
    });
    return list;
  }

  return Array.isArray(question.versions) ? question.versions : [];
}

/**
 * The report the preview panel, the print report and the save flow all read.
 *
 * `applyManualMerges` already returns the whole report, topics included, so
 * this must NOT overwrite `topics` — an empty list here renders the preview as
 * "Nothing to preview yet" even though the Markdown parsed fine.
 */
export function buildDisplayData(reportData, mergeGroups) {
  if (!reportData) return { topics: [] };
  return applyManualMerges(reportData, mergeGroups);
}

/**
 * Plain-language insights shown above the charts. Kept separate so the UI can
 * render them without doing arithmetic in JSX.
 */
export function buildPreviewInsights(analytics) {
  const {
    topTopic,
    topShare,
    vipTopics,
    firstHigh,
    topExam,
    totalQuestions,
    knownSemesterCount,
    latestSemester,
    repeatFactor,
    totalAsked,
  } = analytics;

  const insights = [];

  if (topTopic) {
    insights.push({
      key: 'top',
      icon: 'trophy',
      label: 'Highest-yield topic',
      value: topTopic.name,
      detail: `${topTopic.timesAsked} asks · ${topShare}% of all repeats`,
      tone: topTopic.priority.toLowerCase(),
    });
  }

  if (vipTopics.length) {
    const names = vipTopics.slice(0, 2).map((topic) => topic.name).join(' · ');
    const extra = vipTopics.length > 2 ? ` +${vipTopics.length - 2} more` : '';
    insights.push({
      key: 'focus',
      icon: 'crown',
      label: 'Priority focus',
      value: `${vipTopics.length} VIP ${vipTopics.length === 1 ? 'topic' : 'topics'}`,
      detail: `${names}${extra}`,
      tone: 'vip',
    });
  } else {
    insights.push({
      key: 'focus',
      icon: 'crown',
      label: 'Priority focus',
      value: firstHigh ? 'Start with HIGH' : 'No priority data',
      detail: firstHigh ? firstHigh.name : 'Ask the AI to include priorities.',
      tone: 'high',
    });
  }

  if (topExam) {
    const percent = totalQuestions
      ? Math.round((topExam.count / totalQuestions) * 100)
      : 0;
    insights.push({
      key: 'exam',
      icon: 'clipboard',
      label: 'Exam pattern',
      value: topExam.label,
      detail: `${topExam.count} of ${totalQuestions} questions · ${percent}%`,
      tone: 'cyan',
    });
  }

  insights.push({
    key: 'coverage',
    icon: 'calendar',
    label: 'Semester coverage',
    value: `${knownSemesterCount} ${knownSemesterCount === 1 ? 'semester' : 'semesters'}`,
    detail: latestSemester ? `Latest: ${latestSemester}` : 'Semester data was not listed.',
    tone: 'emerald',
  });

  if (totalQuestions) {
    insights.push({
      key: 'repeat',
      icon: 'repeat',
      label: 'Repeat factor',
      value: `${repeatFactor.toFixed(1)}×`,
      detail: `${totalQuestions} unique ${totalQuestions === 1 ? 'question' : 'questions'} → ${totalAsked} recorded asks`,
      tone: 'amber',
    });
  }

  return insights.slice(0, 5);
}

export { PRIORITIES };
