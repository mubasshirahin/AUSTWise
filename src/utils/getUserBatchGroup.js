const BATCH_GROUPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];

/**
 * Single source of truth for batchGroup derivation.
 * Priority: labSection (CR 25) > section (SR 50 / legacy lab-coded section) > batchNo fallback.
 * Returns strict A1-D2 or 'A1' default. No empty string leak.
 */
export function getUserBatchGroup(user) {
  if (!user) return 'A1';
  const norm = (v) => String(v || '').trim().toUpperCase();
  const sec = norm(user.labSection);
  if (sec && BATCH_GROUPS.includes(sec)) return sec;
  const sec2 = norm(user.section);
  if (sec2 && BATCH_GROUPS.includes(sec2)) return sec2;
  if (user.batchNo) {
    const n = parseInt(user.batchNo, 10);
    if (!Number.isNaN(n)) {
      const idx = (n - 52) % 8;
      return BATCH_GROUPS[idx >= 0 ? idx : 0];
    }
  }
  return 'A1';
}

export const BATCH_GROUPS_LIST = BATCH_GROUPS;
