import { describe, it, expect } from 'vitest';
import { nextStrike, CYCLE_MS } from './strikes.mjs';

const DAY = 86400000;

describe('nextStrike ladder', () => {
  it('warn → 2 days → 10 days → 10 days, then resets after a month', () => {
    const t0 = 1_000_000_000_000;
    let r = nextStrike(undefined, t0);
    expect(r.count).toBe(1); expect(r.banUntil).toBe(0);
    r = nextStrike(r, t0 + DAY);
    expect(r.count).toBe(2); expect(r.banUntil).toBe(t0 + 3 * DAY);
    r = nextStrike(r, t0 + 5 * DAY);
    expect(r.count).toBe(3); expect(r.banUntil).toBe(t0 + 15 * DAY);
    r = nextStrike(r, t0 + 20 * DAY);
    expect(r.banUntil).toBe(t0 + 30 * DAY);
    r = nextStrike(r, t0 + CYCLE_MS + DAY);
    expect(r.count).toBe(1); expect(r.banUntil).toBe(0);
  });
});
