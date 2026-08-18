// TODO: Swap localStorage for API calls — see MIGRATION.md Phase 3
//   Course reviews can be served from dedicated /api/reviews endpoints.
const reviewsKey = 'aust-course-reviews-v2';
const contributorKey = 'aust-course-review-contributor-id';
const upvotesKey = 'aust-course-review-upvotes';
const semesterResultsKey = 'aust-helper-semester-results-v2';

import { getShadowIdentity } from './shadowName';
import { sanitizeUserInput, MAX_TEXT_LENGTH } from './sanitize';
import { liveLoad, liveSave } from './liveStorage';

const roundOne = (value) => Number(value.toFixed(1));

export function getContributorId() {
  try {
    const existing = localStorage.getItem(contributorKey);
    if (existing) return existing;
    const nextId = crypto.randomUUID();
    localStorage.setItem(contributorKey, nextId);
    return nextId;
  } catch {
    return `local-${Date.now()}`;
  }
}

function loadRawEntries() {
  return liveLoad('shared', reviewsKey, [], ['aust-course-reviews']);
}

function saveRawEntries(entries) {
  liveSave('shared', reviewsKey, entries);
}

function loadUpvotedCommentIds() {
  const ids = liveLoad('user', upvotesKey, []);
  return new Set(Array.isArray(ids) ? ids : []);
}

function saveUpvotedCommentIds(ids) {
  liveSave('user', upvotesKey, [...ids]);
}

export function courseKey(course, name, faculty) {
  return `${String(course).trim().toUpperCase()}|${String(name).trim().toLowerCase()}|${String(faculty).trim().toLowerCase()}`;
}

function formatReviewDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';

  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function average(values) {
  if (!values.length) return 0;
  return roundOne(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildCourseReviewList() {
  const groups = new Map();

  for (const entry of loadRawEntries()) {
    const key = courseKey(entry.course, entry.name, entry.faculty);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        course: entry.course,
        name: entry.name,
        faculty: entry.faculty,
        ratings: [],
        comments: [],
      });
    }

    const group = groups.get(key);
    if (entry.rating !== null && entry.rating !== undefined) {
      group.ratings.push({
        rating: entry.rating,
        difficulty: entry.difficulty,
        workload: entry.workload,
      });
    }

    if (entry.comment?.text?.trim()) {
      group.comments.push({
        id: entry.comment.id,
        text: entry.comment.text.trim(),
        author: entry.comment.author || 'Anonymous',
        date: formatReviewDate(entry.comment.createdAt || entry.createdAt),
        upvotes: entry.comment.upvotes || 0,
        createdAt: entry.comment.createdAt || entry.createdAt,
      });
    }
  }

  return Array.from(groups.values())
    .filter((group) => group.ratings.length > 0)
    .map((group) => ({
      id: group.id,
      course: group.course,
      name: group.name,
      faculty: group.faculty,
      rating: average(group.ratings.map((item) => item.rating)),
      difficulty: average(group.ratings.map((item) => item.difficulty)),
      workload: average(group.ratings.map((item) => item.workload)),
      reviews: group.ratings.length,
      comments: group.comments.sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    }))
    .sort((left, right) => right.reviews - left.reviews || right.rating - left.rating);
}

export function getCoursesFromTracker() {
  try {
    const raw = localStorage.getItem(semesterResultsKey);
    if (!raw) return [];

    const results = JSON.parse(raw);
    const seen = new Set();
    const courses = [];

    for (const semester of results) {
      for (const course of semester.courses || []) {
        const code = String(course.code || '').trim();
        if (!code) continue;
        const key = code.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        courses.push({
          code,
          name: String(course.name || code).trim(),
        });
      }
    }

    return courses.sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

export function addCourseReview({ course, name, faculty, rating, difficulty, workload, commentText }) {
  const normalizedCourse = String(course || '').trim();
  const normalizedName = String(name || '').trim();

  if (!normalizedCourse || !normalizedName) {
    throw new Error('Course code and title are required.');
  }

  const ratingValue = Number(rating);
  const difficultyValue = Number(difficulty);
  const workloadValue = Number(workload);

  if (![ratingValue, difficultyValue, workloadValue].every((value) => value >= 1 && value <= 5)) {
    throw new Error('Rating, difficulty, and workload must be between 1 and 5.');
  }

  const createdAt = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    contributorId: getContributorId(),
    course: normalizedCourse,
    name: normalizedName,
    faculty: String(faculty || '').trim(),
    rating: roundOne(ratingValue),
    difficulty: roundOne(difficultyValue),
    workload: roundOne(workloadValue),
    createdAt,
    comment: commentText?.trim()
      ? {
          id: crypto.randomUUID(),
          text: sanitizeUserInput(commentText.trim(), MAX_TEXT_LENGTH),
          author: getShadowIdentity().nickname,
          upvotes: 0,
          createdAt,
        }
      : null,
  };

  const entries = loadRawEntries();
  entries.push(entry);
  saveRawEntries(entries);

  return courseKey(normalizedCourse, normalizedName, String(faculty || '').trim());
}

export function addCommentToCourse(courseId, commentText) {
  const text = sanitizeUserInput(String(commentText || '').trim(), MAX_TEXT_LENGTH);
  if (!text) throw new Error('Write a comment before submitting.');

  const entries = loadRawEntries();
  const sample = entries.find((entry) => courseKey(entry.course, entry.name, entry.faculty) === courseId);
  if (!sample) throw new Error('Course not found.');

  const createdAt = new Date().toISOString();
  entries.push({
    id: crypto.randomUUID(),
    contributorId: getContributorId(),
    course: sample.course,
    name: sample.name,
    faculty: sample.faculty,
    rating: null,
    difficulty: null,
    workload: null,
    createdAt,
    comment: {
      id: crypto.randomUUID(),
      text,
      author: getShadowIdentity().nickname,
      upvotes: 0,
      createdAt,
    },
  });

  saveRawEntries(entries);
}

export function upvoteComment(commentId) {
  const upvotedIds = loadUpvotedCommentIds();
  if (upvotedIds.has(commentId)) {
    return { alreadyVoted: true, reviews: buildCourseReviewList() };
  }

  const entries = loadRawEntries();
  let found = false;

  const updatedEntries = entries.map((entry) => {
    if (entry.comment?.id !== commentId) return entry;
    found = true;
    return {
      ...entry,
      comment: {
        ...entry.comment,
        upvotes: (entry.comment.upvotes || 0) + 1,
      },
    };
  });

  if (!found) {
    throw new Error('Comment not found.');
  }

  upvotedIds.add(commentId);
  saveUpvotedCommentIds(upvotedIds);
  saveRawEntries(updatedEntries);

  return { alreadyVoted: false, reviews: buildCourseReviewList() };
}

export function hasUpvotedComment(commentId) {
  return loadUpvotedCommentIds().has(commentId);
}
