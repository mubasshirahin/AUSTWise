import { describe, expect, it } from 'vitest';
import {
  cleanText, cleanLine, maskProfanity, filterLinks, isAllowedLink, prepareMessage,
  createRateLimiter, createSlowMode, MAX_MESSAGE_LENGTH,
} from './chatSafety.mjs';
import { buildBracket, seedOrder, bracketSize, placeWinner, winnerFromScores, championOf } from './bracket.mjs';

describe('text cleanup', () => {
  it('strips invisible characters, squeezes blank lines and caps length', () => {
    expect(cleanText('  hi\u200B there\u202E  ')).toBe('hi there');
    expect(cleanText('a\n\n\n\nb')).toBe('a\n\nb');
    expect(cleanText('x'.repeat(MAX_MESSAGE_LENGTH + 50))).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(cleanLine('Late\nnight  squad')).toBe('Late night squad');
  });
});

describe('profanity', () => {
  it('masks English, Banglish and Bangla words', () => {
    expect(maskProfanity('what the FUCK')).toEqual({ text: 'what the F***', flagged: true });
    expect(maskProfanity('tui magi naki').text).toBe('tui m*** naki');
    expect(maskProfanity('তুই খানকি').flagged).toBe(true);
  });

  it('does not flag innocent words that contain a blocked substring', () => {
    expect(maskProfanity('Dickens and classic shitake?').flagged).toBe(false);
    expect(maskProfanity('magic trick').flagged).toBe(false);
  });
});

describe('links', () => {
  it('keeps allow-listed hosts and removes the rest', () => {
    expect(isAllowedLink('https://discord.gg/abc')).toBe(true);
    expect(isAllowedLink('https://www.youtube.com/watch?v=1')).toBe(true);
    expect(isAllowedLink('https://tracker.gg.evil.com/x')).toBe(false);
    expect(isAllowedLink('javascript:alert(1)')).toBe(false);
    expect(filterLinks('join https://discord.gg/x or http://free-skins.ru/x')).toEqual({
      text: 'join https://discord.gg/x or [link removed]', removed: 1,
    });
  });

  it('full pipeline', () => {
    expect(prepareMessage('   ')).toMatchObject({ ok: false });
    expect(prepareMessage('gg shit game www.scam.io')).toMatchObject({ ok: true, text: 'gg s*** game [link removed]', flagged: true });
  });
});

describe('limits', () => {
  it('rate limiter allows max per window then recovers', () => {
    const hit = createRateLimiter({ max: 2, windowMs: 1000 });
    expect(hit('u', 0).ok).toBe(true);
    expect(hit('u', 10).ok).toBe(true);
    const blocked = hit('u', 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(980);
    expect(hit('u', 1001).ok).toBe(true);
    expect(hit('other', 20).ok).toBe(true);
  });

  it('slow mode is per user per room', () => {
    const check = createSlowMode();
    expect(check('r', 'u', 10, 0).ok).toBe(true);
    expect(check('r', 'u', 10, 5000)).toEqual({ ok: false, retryAfterMs: 5000 });
    expect(check('r', 'v', 10, 5000).ok).toBe(true);
    expect(check('r', 'u', 0, 5000).ok).toBe(true);
    expect(check('r', 'u', 10, 10000).ok).toBe(true);
  });
});

describe('brackets', () => {
  it('seeds so the top seeds meet last', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketSize(5)).toBe(8);
    expect(bracketSize(2)).toBe(2);
  });

  it('builds all rounds and walks byes through', () => {
    const matches = buildBracket(['a', 'b', 'c', 'd', 'e']);
    expect(matches).toHaveLength(7);
    const r1 = matches.filter((match) => match.round === 1);
    expect(r1.map((match) => [match.entryAId, match.entryBId])).toEqual([
      ['a', null], ['d', 'e'], ['b', null], ['c', null],
    ]);
    const r2 = matches.filter((match) => match.round === 2);
    expect(r2[0].entryAId).toBe('a');
    expect(r2[1]).toMatchObject({ entryAId: 'b', entryBId: 'c' });
    expect(() => buildBracket(['solo'])).toThrow();
  });

  it('decides winners and finds the champion', () => {
    const matches = buildBracket(['a', 'b']);
    const final = matches[0];
    expect(winnerFromScores(final, 2, 2)).toBe(null);
    expect(winnerFromScores(final, 1, 3)).toBe('b');
    final.winnerEntryId = 'b';
    final.status = 'confirmed';
    expect(placeWinner(matches, final)).toBe(null);
    expect(championOf(matches)).toBe('b');
  });
});
