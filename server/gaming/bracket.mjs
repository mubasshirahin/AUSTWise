/**
 * Single-elimination brackets. Pure functions over plain match objects:
 *   { round, slot, entryAId, entryBId, winnerEntryId, status, scoreA, scoreB }
 * Round 1 has size/2 slots; round r has size/2^r. The winner of (r, slot)
 * moves to (r+1, floor(slot/2)), side A when slot is even, else side B.
 */

export function bracketSize(count) {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

export function roundCount(size) {
  return Math.log2(size);
}

/**
 * Standard seeding order so top seeds meet last: for 8 → [1,8,4,5,2,7,3,6].
 */
export function seedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

/**
 * Build every match for `entryIds` (already in seed order: best first).
 * Byes become confirmed walkovers and their winners are placed in round 2.
 */
export function buildBracket(entryIds) {
  const entries = [...entryIds];
  if (entries.length < 2) throw new Error('A bracket needs at least 2 entries.');
  const size = bracketSize(entries.length);
  const rounds = roundCount(size);
  const order = seedOrder(size);
  const matches = [];
  for (let round = 1; round <= rounds; round += 1) {
    const slots = size / 2 ** round;
    for (let slot = 0; slot < slots; slot += 1) {
      matches.push({ round, slot, entryAId: null, entryBId: null, winnerEntryId: null, status: 'pending', scoreA: null, scoreB: null });
    }
  }
  const first = matches.filter((match) => match.round === 1);
  first.forEach((match, slot) => {
    match.entryAId = entries[order[slot * 2] - 1] ?? null;
    match.entryBId = entries[order[slot * 2 + 1] - 1] ?? null;
  });
  for (const match of first) {
    const lone = match.entryAId && !match.entryBId ? match.entryAId : (!match.entryAId && match.entryBId ? match.entryBId : null);
    if (lone) {
      match.winnerEntryId = lone;
      match.status = 'confirmed';
      placeWinner(matches, match);
    }
  }
  return matches;
}

export function nextSlot(match) {
  return { round: match.round + 1, slot: Math.floor(match.slot / 2), side: match.slot % 2 === 0 ? 'A' : 'B' };
}

/** Put a decided match's winner into the next round. Returns the changed match or null (final). */
export function placeWinner(matches, match) {
  if (!match.winnerEntryId) return null;
  const { round, slot, side } = nextSlot(match);
  const next = matches.find((candidate) => candidate.round === round && candidate.slot === slot);
  if (!next) return null;
  if (side === 'A') next.entryAId = match.winnerEntryId;
  else next.entryBId = match.winnerEntryId;
  return next;
}

/** Winner from a score line, or null on a draw / missing scores. */
export function winnerFromScores(match, scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return null;
  return a > b ? match.entryAId : match.entryBId;
}

/** The champion once the final is decided, else null. */
export function championOf(matches) {
  const lastRound = Math.max(...matches.map((match) => match.round));
  const final = matches.find((match) => match.round === lastRound);
  return final?.status === 'confirmed' ? final.winnerEntryId : null;
}
