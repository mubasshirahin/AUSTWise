/**
 * Canteen food feedback storage (localStorage).
 *
 * TODO: Swap localStorage for API calls — see MIGRATION.md Phase 3
 *   GET  /api/canteen → canteen menu + reviews/feedback
 *   POST /api/canteen → submit review or complaint
 *
 * Two kinds of feedback, both keyed by a food item's id:
 *   - reviews:    { id, foodId, rating (1-5), comment, contributorId, createdAt }
 *   - complaints: { id, foodId, text, contributorId, createdAt }
 *
 * Mirrors the course-review approach: anonymous per-browser contributor id,
 * no backend. Data is per-device (won't sync across browsers).
 */

const reviewsKey = 'aust-canteen-reviews-v1';
const complaintsKey = 'aust-canteen-complaints-v1';
const contributorKey = 'aust-canteen-contributor-id';

const roundOne = (value) => Number(value.toFixed(1));

export function getContributorId() {
  try {
    const existing = localStorage.getItem(contributorKey);
    if (existing) return existing;
    const nextId =
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      `local-${Date.now()}`;
    localStorage.setItem(contributorKey, nextId);
    return nextId;
  } catch {
    return `local-${Date.now()}`;
  }
}

function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------------- Reviews (star + comment) ---------------- */

export function getReviewsForFood(foodId) {
  return loadList(reviewsKey)
    .filter((r) => r.foodId === foodId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => ({ ...r, dateLabel: formatDate(r.createdAt) }));
}

/** Aggregate rating summary for one food item. */
export function getReviewSummary(foodId) {
  const reviews = loadList(reviewsKey).filter((r) => r.foodId === foodId);
  if (reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((total, r) => total + Number(r.rating || 0), 0);
  return { average: roundOne(sum / reviews.length), count: reviews.length };
}

export function addReview(foodId, rating, comment) {
  const ratingValue = Number(rating);
  if (!(ratingValue >= 1 && ratingValue <= 5)) {
    throw new Error('Please select a rating between 1 and 5 stars.');
  }

  const createdAt = new Date().toISOString();
  const entry = {
    id:
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      `rev-${Date.now()}`,
    foodId,
    rating: ratingValue,
    comment: String(comment || '').trim(),
    contributorId: getContributorId(),
    createdAt,
  };

  const list = loadList(reviewsKey);
  list.push(entry);
  saveList(reviewsKey, list);
  return entry;
}

/* ---------------- Complaints (public) ---------------- */

export function getComplaintsForFood(foodId) {
  return loadList(complaintsKey)
    .filter((c) => c.foodId === foodId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => ({ ...c, dateLabel: formatDate(c.createdAt) }));
}

export function getComplaintCount(foodId) {
  return loadList(complaintsKey).filter((c) => c.foodId === foodId).length;
}

export function addComplaint(foodId, text) {
  const body = String(text || '').trim();
  if (!body) throw new Error('Please describe your complaint before submitting.');

  const createdAt = new Date().toISOString();
  const entry = {
    id:
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      `cmp-${Date.now()}`,
    foodId,
    text: body,
    contributorId: getContributorId(),
    createdAt,
  };

  const list = loadList(complaintsKey);
  list.push(entry);
  saveList(complaintsKey, list);
  return entry;
}
