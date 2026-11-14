import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GAME_CATALOG, ensureGamingSeed, gameIdFor, loungeIdFor } from './gameCatalog.mjs';

describe('game catalog', () => {
  it('has unique, url-safe slugs and sane squad sizes', () => {
    const slugs = GAME_CATALOG.map((game) => game.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const game of GAME_CATALOG) {
      expect(game.slug).toMatch(/^[a-z0-9-]+$/);
      expect(game.name.length).toBeGreaterThan(0);
      expect(game.maxSquad).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(game.ranks)).toBe(true);
      expect(new Set(game.ranks).size).toBe(game.ranks.length);
      expect(game.platforms.length).toBeGreaterThan(0);
    }
  });

  it('seeds one game and one lounge per entry with every SQL param supplied', async () => {
    const calls = [];
    await ensureGamingSeed(async (sqlText, params) => { calls.push({ sqlText, params }); });
    expect(calls).toHaveLength(GAME_CATALOG.length * 2);
    for (const { sqlText, params } of calls) {
      const names = [...sqlText.matchAll(/@(\w+)/g)].map((match) => match[1]);
      for (const name of names) expect(params).toHaveProperty(name);
      expect(sqlText).toMatch(/ON CONFLICT/);
    }
    const valorant = calls.find((call) => call.params.slug === 'valorant' && call.params.id);
    expect(valorant.params.id).toBe(gameIdFor('valorant'));
    expect(valorant.params.ranks).toEqual({ type: 'text[]', value: GAME_CATALOG[0].ranks });
    const lounge = calls.find((call) => call.params.loungeId === loungeIdFor('valorant'));
    expect(lounge.params.title).toBe('Valorant Lounge');
  });
});

describe('gaming DDL', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const ddl = readFileSync(path.resolve(here, '..', 'prismaTables.sql'), 'utf8');
  const tables = ['Game', 'GameRoom', 'GameRoomMember', 'GameRoomMessage', 'GamerProfile',
    'GameEvent', 'EventEntry', 'TournamentMatch', 'GamingReport', 'GamingSanction'];

  it('creates every gaming table idempotently', () => {
    for (const table of tables) {
      expect(ddl).toContain(`CREATE TABLE IF NOT EXISTS "${table}" (`);
    }
  });

  it('has no @tokens that db.mjs query() would treat as params', () => {
    // The whole file is sent through query(), which rewrites @name tokens.
    expect(ddl).not.toMatch(/@\w/);
  });

  it('never links gaming rows to the Prisma "User" table', () => {
    const gamingPart = ddl.slice(ddl.indexOf('-- ─── Gaming Zone'));
    expect(gamingPart).not.toMatch(/REFERENCES "User"/);
  });
});
