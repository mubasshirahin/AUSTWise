/**
 * End-to-end Gaming Zone service tests on a real Postgres engine (PGlite,
 * in-process) using the actual boot DDL (prismaTables.sql) and seed. No
 * external database is touched.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const h = vi.hoisted(() => ({ pg: null, users: {} }));

vi.mock('../db.mjs', () => ({
  // Same @name → $n translation as db.mjs query().
  query: async (text, params) => {
    const map = {};
    for (const [name, value] of Object.entries(params || {})) {
      map[name] = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && 'value' in value
        ? value : { value };
    }
    const values = [];
    const used = new Map();
    const sqlText = text.replace(/@(\w+)/g, (m, name) => {
      if (!(name in map)) return m;
      if (!used.has(name)) { used.set(name, values.length + 1); values.push(map[name].value); }
      return map[name].type ? `$${used.get(name)}::${map[name].type}` : `$${used.get(name)}`;
    });
    const result = await h.pg.query(sqlText, values);
    return result.rows;
  },
  sql: {},
}));

vi.mock('../userStore.mjs', () => ({
  getUserById: async (id) => h.users[String(id)] || null,
}));

const svc = await import('./gamingService.mjs');
const { ensureGamingSeed } = await import('./gameCatalog.mjs');
const db = await import('../db.mjs');
const bus = await import('./gamingBus.mjs');

const delivered = [];
bus.configureGamingBus({
  broadcastToUsers: (ids, data) => delivered.push({ ids: [...ids], ...data }),
  getPresenceMap: () => ({ s2: {}, s3: {} }),
});

const user = (id, name, ...roles) => {
  h.users[id] = { id, name, role: roles[0], roles, department: id.startsWith('e') ? 'EEE' : 'CSE', batch: 'Quanta 52' };
  return { id, role: roles[0], roles };
};
const s1 = user('s1', 'Ayaan', 'student');
const s2 = user('s2', 'Nabila', 'student');
const s3 = user('s3', 'Rafi', 'student');
const e1 = user('e1', 'Tasnim', 'student');
const guest = user('g1', 'Guest', 'guest');
const faculty = user('f1', 'Dr. Karim', 'faculty', 'faculty_cse');
const gmod = user('gm', 'Mod Mim', 'student', 'gaming_mod');
const staff = user('mod', 'Staff', 'moderator');

const expectError = async (promise, status, pattern) => {
  const err = await promise.then(() => null, (e) => e);
  expect(err, 'expected the call to fail').toBeInstanceOf(svc.GamingError);
  expect(err.status).toBe(status);
  if (pattern) expect(err.message).toMatch(pattern);
  return err;
};

beforeAll(async () => {
  h.pg = new PGlite();
  const here = path.dirname(fileURLToPath(import.meta.url));
  await h.pg.exec(readFileSync(path.resolve(here, '..', 'prismaTables.sql'), 'utf8'));
  await ensureGamingSeed(db.query);
  await ensureGamingSeed(db.query); // idempotent
}, 60000);

describe('boot DDL and seed on Postgres', () => {
  it('seeds every game once, each with a lounge', async () => {
    const overview = await svc.overview(s1);
    expect(overview.games.length).toBe(12);
    expect(overview.games.every((game) => game.loungeId)).toBe(true);
    const valorant = overview.games.find((game) => game.slug === 'valorant');
    expect(valorant.ranks.at(-1)).toBe('Radiant');
  });
});

describe('squad rooms', () => {
  let roomId;

  it('creates a room with the owner inside and limits open rooms', async () => {
    const detail = await svc.createRoom(s1, { gameId: 'valorant', title: 'Late night unrated', capacity: 3, rankMin: 'Gold', rankMax: 'Diamond' });
    roomId = detail.room.id;
    expect(detail.membership.roomRole).toBe('owner');
    expect(detail.room.capacity).toBe(3);
    expect(detail.capabilities).toMatchObject({ manage: true, host: true, chat: true });
    await svc.createRoom(s1, { gameId: 'cs2', title: 'Retake practice' });
    await expectError(svc.createRoom(s1, { gameId: 'dota2', title: 'Third room' }), 403, /already have 2/);
    await expectError(svc.createRoom(s2, { gameId: 'valorant', title: 'x' }), 400, /at least 3/);
    await expectError(svc.createRoom(s2, { gameId: 'valorant', title: 'Bad rank', rankMin: 'Radiant', rankMax: 'Iron' }), 400, /above/);
    await expectError(svc.createRoom(guest, { gameId: 'valorant', title: 'Guest room' }), 403);
  });

  it('non-members cannot read; joining works until full', async () => {
    await expectError(svc.listMessages(s2, roomId), 403);
    const joined = await svc.joinRoom(s2, roomId);
    expect(joined.membership.roomRole).toBe('member');
    expect(joined.members).toHaveLength(2);
    await svc.joinRoom(s3, roomId);
    const full = await svc.getRoomDetail(s1, roomId);
    expect(full.room.status).toBe('full');
    await expectError(svc.joinRoom(e1, roomId), 409, /full/);
  });

  it('chat: masks profanity, removes bad links, enforces rate limit', async () => {
    const sent = await svc.postMessage(s2, roomId, { text: 'gg shit game, join https://discord.gg/abc and http://evil.ru' });
    expect(sent.message.text).toBe('gg s*** game, join https://discord.gg/abc and [link removed]');
    expect(sent.flagged).toBe(true);
    for (let i = 0; i < 5; i += 1) await svc.postMessage(s3, roomId, { text: `msg ${i}` });
    await expectError(svc.postMessage(s3, roomId, { text: 'one more' }), 429);
    const { messages, authors } = await svc.listMessages(s1, roomId);
    expect(messages.some((message) => message.kind === 'system')).toBe(true);
    expect(authors.s2.name).toBe('Nabila');
  });

  it('lobby code is members-only; invite code hosts-only', async () => {
    await svc.updateRoomSettings(s1, roomId, { lobbyCode: 'PARTY-1234' });
    expect((await svc.getRoomDetail(s2, roomId)).room.lobbyCode).toBe('PARTY-1234');
    expect((await svc.getRoomDetail(e1, roomId)).room.lobbyCode).toBe('');
    await expectError(svc.updateRoomSettings(s2, roomId, { lobbyCode: 'hijack' }), 403);
    await expectError(svc.updateRoomSettings(s2, roomId, { title: 'Mine now' }), 403);
  });

  it('owner mutes, kicks and bans; banned user cannot rejoin', async () => {
    await svc.muteMember(s1, roomId, 's3', 5);
    await expectError(svc.postMessage(s3, roomId, { text: 'can I talk' }), 403, /muted/);
    await expectError(svc.kickMember(s2, roomId, 's3'), 403);
    await svc.kickMember(s1, roomId, 's3', { ban: true, reason: 'spam' });
    expect(delivered.some((d) => d.type === 'gz-kicked' && d.ids.includes('s3'))).toBe(true);
    await expectError(svc.joinRoom(s3, roomId), 403, /removed/);
    expect((await svc.getRoomDetail(s1, roomId)).room.status).toBe('open');
  });

  it('co-host can host but not manage; owner leaving hands over to co-host', async () => {
    await svc.setMemberRole(s1, roomId, 's2', 'cohost');
    await svc.readyCheck(s2, roomId);
    await expectError(svc.closeRoom(s2, roomId), 403);
    await svc.leaveRoom(s1, roomId);
    const after = await svc.getRoomDetail(s2, roomId);
    expect(after.room.ownerId).toBe('s2');
    expect(after.membership.roomRole).toBe('owner');
  });

  it('private rooms hide from lists and need the invite code', async () => {
    const priv = await svc.createRoom(s2, { gameId: 'pubg-mobile', title: 'Hall squad', visibility: 'private' });
    const code = priv.room.inviteCode;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    const listed = await svc.listRooms(e1, { game: 'pubg-mobile' });
    expect(listed.some((room) => room.id === priv.room.id)).toBe(false);
    await expectError(svc.joinRoom(e1, priv.room.id), 403, /invite/);
    const joined = await svc.joinByCode(e1, code.toLowerCase());
    expect(joined.membership).toBeTruthy();
    expect(joined.room.inviteCode).toBe(null);
  });

  it('lounges: guests read, members chat without joining', async () => {
    const { games } = await svc.overview(s1);
    const lounge = games.find((game) => game.slug === 'chess').loungeId;
    await svc.postMessage(e1, lounge, { text: 'anyone for blitz?' });
    const read = await svc.listMessages(guest, lounge);
    expect(read.messages.at(-1).text).toBe('anyone for blitz?');
    await expectError(svc.postMessage(guest, lounge, { text: 'hi' }), 403, /Guests/);
    await expectError(svc.closeRoom(gmod, lounge), 400);
  });
});

describe('squad finder', () => {
  it('saves a validated profile and pings lookers', async () => {
    const profile = await svc.saveProfile(s3, {
      games: [{ gameId: 'game-valorant', ign: 'rafi#BD1', rank: 'Gold' }, { gameId: 'nope', ign: 'x' }],
      lookingForSquad: true,
      lfgGameIds: ['game-valorant'],
      availability: { fri: ['20:00-23:00', 'bad'] },
      bio: 'IGL',
    });
    expect(profile.games).toEqual([{ gameId: 'game-valorant', ign: 'rafi#BD1', rank: 'Gold', position: '' }]);
    expect(profile.availability).toEqual({ fri: ['20:00-23:00'] });
    const lfg = await svc.listLookingForSquad(s1, 'valorant');
    expect(lfg[0]).toMatchObject({ userId: 's3', online: true });
    const room = await svc.createRoom(e1, { gameId: 'valorant', title: 'Need two' });
    const ping = await svc.pingLookingForSquad(e1, room.room.id);
    expect(ping.notified).toBe(1);
    await expectError(svc.pingLookingForSquad(e1, room.room.id), 429);
  });
});

describe('events and tournaments', () => {
  it('only the right roles create events', async () => {
    const start = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await expectError(svc.createEvent(s1, { gameId: 'valorant', title: 'Friday night', startsAt: start }), 403);
    const night = await svc.createEvent(faculty, { gameId: 'valorant', title: 'Friday night', startsAt: start });
    expect(night.roomId).toBeTruthy();
    await expectError(svc.createEvent(faculty, { kind: 'tournament', gameId: 'chess', title: 'Cup', startsAt: start }), 403);
  });

  it('runs a 3-player bracket to a champion and a leaderboard', async () => {
    const startsAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const cup = await svc.createEvent(gmod, { kind: 'tournament', gameId: 'chess', title: 'Blitz Cup', startsAt, capacity: 8 });
    for (const player of [s1, s2, e1]) await svc.registerForEvent(player, cup.id);
    const matches = await svc.generateBracket(gmod, cup.id);
    expect(matches).toHaveLength(3);
    const detail = await svc.getEventDetail(s1, cup.id);
    const entryOf = (userId) => detail.entries.find((entry) => entry.userId === userId).id;
    const semi = matches.find((match) => match.round === 1 && match.entryAId && match.entryBId);
    const [captainA, captainB] = [semi.entryAId, semi.entryBId].map((id) => detail.entries.find((entry) => entry.id === id).userId);
    const actorFor = (id) => ({ s1, s2, e1 }[id]);
    await expectError(svc.reportMatch(s3, semi.id, { scoreA: 2, scoreB: 0 }), 403);
    await svc.reportMatch(actorFor(captainA), semi.id, { scoreA: 2, scoreB: 1 });
    await expectError(svc.confirmMatch(actorFor(captainA), semi.id), 403);
    await svc.confirmMatch(actorFor(captainB), semi.id);
    const after = await svc.getEventDetail(s1, cup.id);
    const final = after.matches.find((match) => match.round === 2);
    expect([final.entryAId, final.entryBId]).toContain(entryOf(captainA));
    await svc.resolveMatch(gmod, final.id, { scoreA: 3, scoreB: 0 });
    const done = await svc.getEventDetail(s1, cup.id);
    expect(done.event.status).toBe('finished');
    expect(done.champion).toBe(final.entryAId);
    const board = await svc.leaderboard(s1, { game: 'chess' });
    expect(board.players[0].points).toBeGreaterThanOrEqual(10);
    expect(board.departments.length).toBeGreaterThan(0);
  });
});

describe('moderation', () => {
  it('reports go to mods only', async () => {
    const report = await svc.createReport(s2, { targetUserId: 's3', reason: 'toxicity', details: 'flaming' });
    await expectError(svc.listReports(s1), 403);
    const reports = await svc.listReports(gmod, { status: 'open' });
    expect(reports.find((row) => row.id === report.id).target.name).toBe('Rafi');
    await expectError(svc.createReport(s2, { targetUserId: 's2', reason: 'toxicity' }), 400);
  });

  it('gaming mod: short zone bans only; ban locks the user out; revoke restores', async () => {
    await expectError(svc.issueSanction(gmod, { userId: 's3', type: 'zone_ban', days: 30, reason: 'repeat toxicity' }), 403);
    await expectError(svc.issueSanction(gmod, { userId: 'gm', type: 'mute', reason: 'self' }), 403);
    await expectError(svc.issueSanction(gmod, { userId: 'mod', type: 'mute', reason: 'nope' }), 403);
    const ban = await svc.issueSanction(gmod, { userId: 's3', type: 'zone_ban', days: 3, reason: 'repeat toxicity' });
    await expectError(svc.overview(s3), 403, /suspended/);
    expect((await svc.getMe(s3)).zoneBan).toBeTruthy();
    await svc.revokeSanction(staff, ban.id);
    expect((await svc.overview(s3)).games.length).toBe(12);
  });

  it('staff can mute zone-wide; muted users cannot chat in lounges', async () => {
    await svc.issueSanction(staff, { userId: 'e1', type: 'mute', days: 1, reason: 'cool down' });
    const { games } = await svc.overview(e1);
    await expectError(svc.postMessage(e1, games[0].loungeId, { text: 'hello' }), 403, /muted/);
  });
});

describe('housekeeping', () => {
  it('closes squads idle for 2 hours', async () => {
    const closed = await svc.closeStaleRooms(Date.now() + 3 * 60 * 60 * 1000);
    expect(closed).toBeGreaterThan(0);
    const rooms = await svc.listRooms(s1, { type: 'squad' });
    expect(rooms).toHaveLength(0);
  });
});
