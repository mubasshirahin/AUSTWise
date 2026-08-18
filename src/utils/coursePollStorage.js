/**
 * Course Poll storage (localStorage).
 *
 * Each contributor picks up to 3 "best" and 3 "worst" courses. We store one
 * ballot per contributor (re-submitting overwrites their previous ballot), then
 * aggregate all ballots into two ranked leaderboards:
 *   - best  → courses ordered by how many people voted them best
 *   - worst → courses ordered by how many people voted them worst
 *
 * Each leaderboard row is { code, name, votes } where `votes` is the number of
 * people who selected that course. Highest votes first.
 *
 * Anonymous, per-browser, no backend (mirrors courseReviewStorage).
 */

const ballotsKey = 'aust-course-poll-ballots-v1';
const contributorKey = 'aust-course-poll-contributor-id';

import { liveLoad, liveSave, liveDelete } from './liveStorage';

export const MAX_PICKS = 3;

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

function loadBallots() {
  return liveLoad('shared', ballotsKey, [], ['aust-course-poll-ballots']);
}

function saveBallots(ballots) {
  liveSave('shared', ballotsKey, ballots);
}

/** Normalise a course code so "cse3101" and "CSE 3101" count as the same course. */
function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/** The current browser's saved ballot, or null. */
export function getMyBallot() {
  const id = getContributorId();
  return loadBallots().find((b) => b.contributorId === id) || null;
}

/**
 * Save this browser's ballot. `best` and `worst` are arrays of
 * { code, name }. Overwrites any previous ballot from this contributor.
 */
export function saveMyBallot(best, worst) {
  const clean = (list) =>
    (list || [])
      .filter((c) => c && String(c.code).trim())
      .slice(0, MAX_PICKS)
      .map((c) => ({ code: normalizeCode(c.code), name: String(c.name || c.code).trim() }));

  const cleanBest = clean(best);
  const cleanWorst = clean(worst);

  if (cleanBest.length === 0 && cleanWorst.length === 0) {
    throw new Error('Pick at least one course before submitting.');
  }

  const id = getContributorId();
  const ballots = loadBallots().filter((b) => b.contributorId !== id);
  ballots.push({
    contributorId: id,
    best: cleanBest,
    worst: cleanWorst,
    updatedAt: new Date().toISOString(),
  });
  saveBallots(ballots);
}

/**
 * Aggregate one side ("best" | "worst") into a ranked list.
 * Ties (same vote count) fall back to alphabetical course code.
 */
function tally(side) {
  const counts = new Map(); // code -> { code, name, votes }
  for (const ballot of loadBallots()) {
    for (const pick of ballot[side] || []) {
      const code = normalizeCode(pick.code);
      if (!code) continue;
      if (!counts.has(code)) {
        counts.set(code, { code, name: pick.name || code, votes: 0 });
      }
      counts.get(code).votes += 1;
    }
  }
  return Array.from(counts.values()).sort(
    (a, b) => b.votes - a.votes || a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
}

export function getBestLeaderboard() {
  return tally('best');
}

export function getWorstLeaderboard() {
  return tally('worst');
}

/** Total number of people who have submitted a ballot. */
export function getTotalVoters() {
  return loadBallots().length;
}

/** Clear all poll ballots and contributor ID (start fresh). */
export function clearAllPollData() {
  liveDelete('shared', ballotsKey);
  try { localStorage.removeItem(contributorKey); } catch {}
}
