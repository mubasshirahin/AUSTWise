/**
 * Gaming Zone data access (PostgreSQL via db.mjs query()). Plain functions,
 * no permission checks — gamingService.mjs decides who may call what.
 */
import { randomUUID, randomInt } from 'node:crypto';
import { query } from '../db.mjs';

const T = { text: 'text', int: 'int', bool: 'boolean', ts: 'timestamptz', arr: 'text[]' };
const p = (type, value) => ({ type, value });
const one = (rows) => (rows && rows[0]) || null;

// ── Games ──────────────────────────────────────────────────────────────────

export async function listGames({ includeInactive = false } = {}) {
  return query(
    `SELECT * FROM "Game" ${includeInactive ? '' : 'WHERE "active" = true'} ORDER BY "sortOrder", "name"`,
  );
}

export async function getGame(idOrSlug) {
  return one(await query('SELECT * FROM "Game" WHERE "id" = @k OR "slug" = @k', { k: String(idOrSlug) }));
}

export async function createGame(game, createdBy) {
  return one(await query(
    `INSERT INTO "Game" ("id", "slug", "name", "genre", "platforms", "iconKey", "maxSquad", "ranks", "sortOrder", "createdBy")
     VALUES (@id, @slug, @name, @genre, @platforms, @iconKey, @maxSquad, @ranks, @sortOrder, @createdBy)
     RETURNING *`,
    {
      id: `game-${game.slug}`, slug: game.slug, name: game.name, genre: game.genre,
      platforms: p(T.arr, game.platforms), iconKey: game.iconKey, maxSquad: p(T.int, game.maxSquad),
      ranks: p(T.arr, game.ranks), sortOrder: p(T.int, game.sortOrder), createdBy,
    },
  ));
}

export async function updateGame(id, patch) {
  const sets = [];
  const params = { id };
  const fields = {
    name: T.text, genre: T.text, platforms: T.arr, iconKey: T.text,
    maxSquad: T.int, ranks: T.arr, active: T.bool, sortOrder: T.int,
  };
  for (const [field, type] of Object.entries(fields)) {
    if (field in patch) { sets.push(`"${field}" = @${field}`); params[field] = p(type, patch[field]); }
  }
  if (!sets.length) return getGame(id);
  return one(await query(
    `UPDATE "Game" SET ${sets.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = @id RETURNING *`, params,
  ));
}

// ── Rooms ──────────────────────────────────────────────────────────────────

const ROOM_COLUMNS = `r.*, (SELECT count(*)::int FROM "GameRoomMember" m WHERE m."roomId" = r."id") AS "memberCount"`;

export async function listRooms({ gameId, type, statuses, platform, openSlots, limit = 60 } = {}) {
  const where = [];
  const params = { limit: p(T.int, limit) };
  if (gameId) { where.push('r."gameId" = @gameId'); params.gameId = gameId; }
  if (type) { where.push('r."type" = @type'); params.type = type; }
  if (statuses?.length) { where.push('r."status" = ANY(@statuses)'); params.statuses = p(T.arr, statuses); }
  if (platform) { where.push('r."platform" = @platform'); params.platform = platform; }
  // Private squads never appear in lists; they are joined by invite code.
  where.push(`r."visibility" = 'public'`);
  const rows = await query(
    `SELECT ${ROOM_COLUMNS} FROM "GameRoom" r
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY r."type" = 'lounge' DESC, r."lastActivityAt" DESC
     LIMIT @limit`,
    params,
  );
  return openSlots ? rows.filter((room) => room.memberCount < room.capacity) : rows;
}

export async function listRoomsForUser(userId) {
  return query(
    `SELECT ${ROOM_COLUMNS}, me."roomRole" AS "myRole" FROM "GameRoom" r
     JOIN "GameRoomMember" me ON me."roomId" = r."id" AND me."userId" = @userId
     WHERE r."status" <> 'closed'
     ORDER BY r."lastActivityAt" DESC`,
    { userId },
  );
}

export async function getRoom(id) {
  return one(await query(`SELECT ${ROOM_COLUMNS} FROM "GameRoom" r WHERE r."id" = @id`, { id: String(id) }));
}

export async function getRoomByInviteCode(code) {
  return one(await query(
    `SELECT ${ROOM_COLUMNS} FROM "GameRoom" r WHERE r."inviteCode" = @code AND r."status" <> 'closed'`,
    { code: String(code).toUpperCase() },
  ));
}

export async function countOpenRoomsOwnedBy(userId) {
  const row = one(await query(
    `SELECT count(*)::int AS n FROM "GameRoom" WHERE "ownerId" = @userId AND "type" = 'squad' AND "status" <> 'closed'`,
    { userId },
  ));
  return row?.n ?? 0;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newInviteCode() {
  return Array.from({ length: 6 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');
}

export async function createRoom(room) {
  const id = randomUUID();
  return one(await query(
    `INSERT INTO "GameRoom" ("id", "gameId", "type", "title", "description", "ownerId", "capacity", "visibility",
       "inviteCode", "rankMin", "rankMax", "region", "platform", "expiresAt")
     VALUES (@id, @gameId, @type, @title, @description, @ownerId, @capacity, @visibility,
       @inviteCode, @rankMin, @rankMax, @region, @platform, @expiresAt)
     RETURNING *, 0 AS "memberCount"`,
    {
      id, gameId: room.gameId, type: room.type || 'squad', title: room.title, description: room.description || '',
      ownerId: room.ownerId ?? null, capacity: p(T.int, room.capacity), visibility: room.visibility || 'public',
      inviteCode: room.inviteCode ?? null, rankMin: room.rankMin ?? null, rankMax: room.rankMax ?? null,
      region: room.region || '', platform: room.platform || '', expiresAt: p(T.ts, room.expiresAt ?? null),
    },
  ));
}

export async function updateRoom(id, patch) {
  const fields = {
    title: T.text, description: T.text, capacity: T.int, visibility: T.text, inviteCode: T.text,
    rankMin: T.text, rankMax: T.text, region: T.text, platform: T.text, lobbyCode: T.text,
    status: T.text, slowModeSec: T.int, ownerId: T.text, expiresAt: T.ts, closedAt: T.ts,
  };
  const sets = [];
  const params = { id };
  for (const [field, type] of Object.entries(fields)) {
    if (field in patch) { sets.push(`"${field}" = @${field}`); params[field] = p(type, patch[field]); }
  }
  if (!sets.length) return getRoom(id);
  await query(`UPDATE "GameRoom" SET ${sets.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = @id`, params);
  return getRoom(id);
}

export async function touchRoom(id) {
  await query('UPDATE "GameRoom" SET "lastActivityAt" = CURRENT_TIMESTAMP WHERE "id" = @id', { id });
}

/** Squad rooms idle since `idleBefore`, or past expiresAt. */
export async function findStaleRooms(idleBefore) {
  return query(
    `SELECT "id" FROM "GameRoom"
     WHERE "type" = 'squad' AND "status" <> 'closed'
       AND ("lastActivityAt" < @idleBefore OR ("expiresAt" IS NOT NULL AND "expiresAt" < CURRENT_TIMESTAMP))`,
    { idleBefore: p(T.ts, idleBefore) },
  );
}

// ── Members ────────────────────────────────────────────────────────────────

export async function listMembers(roomId) {
  return query('SELECT * FROM "GameRoomMember" WHERE "roomId" = @roomId ORDER BY "joinedAt"', { roomId });
}

export async function getMember(roomId, userId) {
  return one(await query(
    'SELECT * FROM "GameRoomMember" WHERE "roomId" = @roomId AND "userId" = @userId', { roomId, userId },
  ));
}

/**
 * Add a member only while the room has space (atomic). Returns the row, or
 * null when the room filled up in the meantime.
 */
export async function addMemberIfSpace(roomId, userId, roomRole = 'member') {
  return one(await query(
    `INSERT INTO "GameRoomMember" ("id", "roomId", "userId", "roomRole")
     SELECT @id, r."id", @userId, @roomRole FROM "GameRoom" r
     WHERE r."id" = @roomId
       AND (SELECT count(*) FROM "GameRoomMember" m WHERE m."roomId" = r."id") < r."capacity"
     ON CONFLICT ("roomId", "userId") DO NOTHING
     RETURNING *`,
    { id: randomUUID(), roomId, userId, roomRole },
  ));
}

export async function removeMember(roomId, userId) {
  await query('DELETE FROM "GameRoomMember" WHERE "roomId" = @roomId AND "userId" = @userId', { roomId, userId });
}

export async function setMemberRole(roomId, userId, roomRole) {
  return one(await query(
    `UPDATE "GameRoomMember" SET "roomRole" = @roomRole WHERE "roomId" = @roomId AND "userId" = @userId RETURNING *`,
    { roomId, userId, roomRole },
  ));
}

export async function setMemberReady(roomId, userId, ready) {
  return one(await query(
    `UPDATE "GameRoomMember" SET "ready" = @ready WHERE "roomId" = @roomId AND "userId" = @userId RETURNING *`,
    { roomId, userId, ready: p(T.bool, !!ready) },
  ));
}

export async function resetReady(roomId) {
  await query('UPDATE "GameRoomMember" SET "ready" = false WHERE "roomId" = @roomId', { roomId });
}

export async function setMemberMutedUntil(roomId, userId, until) {
  return one(await query(
    `UPDATE "GameRoomMember" SET "mutedUntil" = @until WHERE "roomId" = @roomId AND "userId" = @userId RETURNING *`,
    { roomId, userId, until: p(T.ts, until) },
  ));
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function listMessages(roomId, { before, limit = 50 } = {}) {
  const rows = await query(
    `SELECT * FROM "GameRoomMessage"
     WHERE "roomId" = @roomId ${before ? 'AND "createdAt" < @before' : ''}
     ORDER BY "createdAt" DESC LIMIT @limit`,
    { roomId, limit: p(T.int, Math.min(Math.max(limit, 1), 100)), ...(before ? { before: p(T.ts, before) } : {}) },
  );
  return rows.reverse();
}

export async function getMessage(id) {
  return one(await query('SELECT * FROM "GameRoomMessage" WHERE "id" = @id', { id: String(id) }));
}

export async function insertMessage({ roomId, fromId, text, kind = 'text', replyToId = null }) {
  const row = one(await query(
    `INSERT INTO "GameRoomMessage" ("id", "roomId", "fromId", "text", "kind", "replyToId")
     VALUES (@id, @roomId, @fromId, @text, @kind, @replyToId) RETURNING *`,
    { id: randomUUID(), roomId, fromId, text, kind, replyToId },
  ));
  await touchRoom(roomId);
  return row;
}

export async function softDeleteMessage(id) {
  return one(await query(
    `UPDATE "GameRoomMessage" SET "deleted" = true, "text" = '' WHERE "id" = @id RETURNING *`, { id },
  ));
}

// ── Gamer profiles ─────────────────────────────────────────────────────────

const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

function mapProfile(row) {
  if (!row) return null;
  return { ...row, games: parseJson(row.games, []), availability: parseJson(row.availability, {}) };
}

export async function getProfile(userId) {
  return mapProfile(one(await query('SELECT * FROM "GamerProfile" WHERE "userId" = @userId', { userId })));
}

export async function getProfiles(userIds) {
  if (!userIds.length) return [];
  const rows = await query('SELECT * FROM "GamerProfile" WHERE "userId" = ANY(@ids)', { ids: p(T.arr, userIds) });
  return rows.map(mapProfile);
}

export async function upsertProfile(userId, profile) {
  return mapProfile(one(await query(
    `INSERT INTO "GamerProfile" ("userId", "games", "platforms", "availability", "lookingForSquad", "lfgGameIds", "bio")
     VALUES (@userId, @games, @platforms, @availability, @lfg, @lfgGameIds, @bio)
     ON CONFLICT ("userId") DO UPDATE SET
       "games" = EXCLUDED."games", "platforms" = EXCLUDED."platforms", "availability" = EXCLUDED."availability",
       "lookingForSquad" = EXCLUDED."lookingForSquad", "lfgGameIds" = EXCLUDED."lfgGameIds", "bio" = EXCLUDED."bio",
       "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    {
      userId, games: JSON.stringify(profile.games), platforms: p(T.arr, profile.platforms),
      availability: JSON.stringify(profile.availability), lfg: p(T.bool, profile.lookingForSquad),
      lfgGameIds: p(T.arr, profile.lfgGameIds), bio: profile.bio,
    },
  )));
}

export async function listLookingForSquad(gameId, limit = 60) {
  const rows = await query(
    `SELECT * FROM "GamerProfile" WHERE "lookingForSquad" = true
       ${gameId ? 'AND @gameId = ANY("lfgGameIds")' : ''}
     ORDER BY "updatedAt" DESC LIMIT @limit`,
    { limit: p(T.int, limit), ...(gameId ? { gameId } : {}) },
  );
  return rows.map(mapProfile);
}

export async function adjustReputation(userId, delta) {
  await query(
    `INSERT INTO "GamerProfile" ("userId", "reputation") VALUES (@userId, @delta)
     ON CONFLICT ("userId") DO UPDATE SET "reputation" = "GamerProfile"."reputation" + @delta`,
    { userId, delta: p(T.int, delta) },
  );
}

// ── Events ─────────────────────────────────────────────────────────────────

const EVENT_COLUMNS = `e.*, (SELECT count(*)::int FROM "EventEntry" x WHERE x."eventId" = e."id") AS "entryCount"`;

export async function listEvents({ gameId, from, kind, includeFinished = false, limit = 50 } = {}) {
  const where = [];
  const params = { limit: p(T.int, limit) };
  if (gameId) { where.push('e."gameId" = @gameId'); params.gameId = gameId; }
  if (kind) { where.push('e."kind" = @kind'); params.kind = kind; }
  if (from) { where.push('COALESCE(e."endsAt", e."startsAt") >= @from'); params.from = p(T.ts, from); }
  if (!includeFinished) where.push(`e."status" IN ('scheduled', 'live')`);
  return query(
    `SELECT ${EVENT_COLUMNS} FROM "GameEvent" e ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY e."startsAt" ASC LIMIT @limit`,
    params,
  );
}

export async function getEvent(id) {
  return one(await query(`SELECT ${EVENT_COLUMNS} FROM "GameEvent" e WHERE e."id" = @id`, { id: String(id) }));
}

export async function createEvent(event) {
  const id = randomUUID();
  await query(
    `INSERT INTO "GameEvent" ("id", "gameId", "roomId", "title", "description", "kind", "startsAt", "endsAt",
       "capacity", "teamSize", "format", "createdBy", "clubId")
     VALUES (@id, @gameId, @roomId, @title, @description, @kind, @startsAt, @endsAt,
       @capacity, @teamSize, @format, @createdBy, @clubId)`,
    {
      id, gameId: event.gameId, roomId: event.roomId ?? null, title: event.title, description: event.description,
      kind: event.kind, startsAt: p(T.ts, event.startsAt), endsAt: p(T.ts, event.endsAt ?? null),
      capacity: p(T.int, event.capacity), teamSize: p(T.int, event.teamSize), format: event.format,
      createdBy: event.createdBy, clubId: event.clubId ?? null,
    },
  );
  return getEvent(id);
}

export async function updateEvent(id, patch) {
  const fields = {
    title: T.text, description: T.text, startsAt: T.ts, endsAt: T.ts, capacity: T.int,
    status: T.text, roomId: T.text,
  };
  const sets = [];
  const params = { id };
  for (const [field, type] of Object.entries(fields)) {
    if (field in patch) { sets.push(`"${field}" = @${field}`); params[field] = p(type, patch[field]); }
  }
  if (sets.length) {
    await query(`UPDATE "GameEvent" SET ${sets.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = @id`, params);
  }
  return getEvent(id);
}

export async function eventsStartingBetween(from, to) {
  return query(
    `SELECT * FROM "GameEvent" WHERE "status" = 'scheduled' AND "startsAt" >= @from AND "startsAt" < @to`,
    { from: p(T.ts, from), to: p(T.ts, to) },
  );
}

export async function listEntries(eventId) {
  return query('SELECT * FROM "EventEntry" WHERE "eventId" = @eventId ORDER BY "seed" NULLS LAST, "createdAt"', { eventId });
}

/** Register while there is space (atomic). Returns the row or null if full / already in. */
export async function addEntryIfSpace(eventId, { userId, teamName, teamMembers }) {
  return one(await query(
    `INSERT INTO "EventEntry" ("id", "eventId", "userId", "teamName", "teamMembers")
     SELECT @id, e."id", @userId, @teamName, @teamMembers FROM "GameEvent" e
     WHERE e."id" = @eventId
       AND (SELECT count(*) FROM "EventEntry" x WHERE x."eventId" = e."id") < e."capacity"
     ON CONFLICT ("eventId", "userId") DO NOTHING
     RETURNING *`,
    { id: randomUUID(), eventId, userId, teamName, teamMembers: p(T.arr, teamMembers) },
  ));
}

export async function removeEntry(eventId, userId) {
  await query('DELETE FROM "EventEntry" WHERE "eventId" = @eventId AND "userId" = @userId', { eventId, userId });
}

export async function setCheckedIn(eventId, userId, checkedIn) {
  return one(await query(
    `UPDATE "EventEntry" SET "checkedIn" = @checkedIn WHERE "eventId" = @eventId AND "userId" = @userId RETURNING *`,
    { eventId, userId, checkedIn: p(T.bool, checkedIn) },
  ));
}

export async function setEntrySeeds(eventId, orderedEntryIds) {
  for (const [index, entryId] of orderedEntryIds.entries()) {
    await query('UPDATE "EventEntry" SET "seed" = @seed WHERE "id" = @id AND "eventId" = @eventId',
      { seed: p(T.int, index + 1), id: entryId, eventId });
  }
}

// ── Tournament matches ─────────────────────────────────────────────────────

export async function listMatches(eventId) {
  return query('SELECT * FROM "TournamentMatch" WHERE "eventId" = @eventId ORDER BY "round", "slot"', { eventId });
}

export async function getMatch(id) {
  return one(await query('SELECT * FROM "TournamentMatch" WHERE "id" = @id', { id: String(id) }));
}

export async function replaceMatches(eventId, matches) {
  await query('DELETE FROM "TournamentMatch" WHERE "eventId" = @eventId', { eventId });
  for (const match of matches) {
    await query(
      `INSERT INTO "TournamentMatch" ("id", "eventId", "round", "slot", "entryAId", "entryBId", "winnerEntryId", "status")
       VALUES (@id, @eventId, @round, @slot, @entryAId, @entryBId, @winnerEntryId, @status)`,
      {
        id: randomUUID(), eventId, round: p(T.int, match.round), slot: p(T.int, match.slot),
        entryAId: match.entryAId, entryBId: match.entryBId, winnerEntryId: match.winnerEntryId, status: match.status,
      },
    );
  }
  return listMatches(eventId);
}

export async function updateMatch(id, patch) {
  const fields = {
    entryAId: T.text, entryBId: T.text, scoreA: T.int, scoreB: T.int, winnerEntryId: T.text, status: T.text,
    reportedBy: T.text, reportedAt: T.ts, confirmedBy: T.text, confirmedAt: T.ts, screenshotUrl: T.text,
  };
  const sets = [];
  const params = { id };
  for (const [field, type] of Object.entries(fields)) {
    if (field in patch) { sets.push(`"${field}" = @${field}`); params[field] = p(type, patch[field]); }
  }
  if (!sets.length) return getMatch(id);
  return one(await query(`UPDATE "TournamentMatch" SET ${sets.join(', ')} WHERE "id" = @id RETURNING *`, params));
}

// ── Reports & sanctions ────────────────────────────────────────────────────

export async function createReport(report) {
  return one(await query(
    `INSERT INTO "GamingReport" ("id", "reporterId", "targetUserId", "roomId", "messageId", "reason", "details")
     VALUES (@id, @reporterId, @targetUserId, @roomId, @messageId, @reason, @details) RETURNING *`,
    {
      id: randomUUID(), reporterId: report.reporterId, targetUserId: report.targetUserId,
      roomId: report.roomId ?? null, messageId: report.messageId ?? null, reason: report.reason, details: report.details,
    },
  ));
}

export async function countRecentReportsBy(reporterId, since) {
  const row = one(await query(
    'SELECT count(*)::int AS n FROM "GamingReport" WHERE "reporterId" = @reporterId AND "createdAt" >= @since',
    { reporterId, since: p(T.ts, since) },
  ));
  return row?.n ?? 0;
}

export async function listReports({ status, limit = 100 } = {}) {
  return query(
    `SELECT * FROM "GamingReport" ${status ? 'WHERE "status" = @status' : ''} ORDER BY "createdAt" DESC LIMIT @limit`,
    { limit: p(T.int, limit), ...(status ? { status } : {}) },
  );
}

export async function getReport(id) {
  return one(await query('SELECT * FROM "GamingReport" WHERE "id" = @id', { id: String(id) }));
}

export async function resolveReport(id, { status, resolution, handledBy }) {
  return one(await query(
    `UPDATE "GamingReport" SET "status" = @status, "resolution" = @resolution, "handledBy" = @handledBy,
       "handledAt" = CURRENT_TIMESTAMP WHERE "id" = @id RETURNING *`,
    { id, status, resolution, handledBy },
  ));
}

export async function createSanction(sanction) {
  return one(await query(
    `INSERT INTO "GamingSanction" ("id", "userId", "type", "roomId", "until", "reason", "issuedBy")
     VALUES (@id, @userId, @type, @roomId, @until, @reason, @issuedBy) RETURNING *`,
    {
      id: randomUUID(), userId: sanction.userId, type: sanction.type, roomId: sanction.roomId ?? null,
      until: p(T.ts, sanction.until ?? null), reason: sanction.reason, issuedBy: sanction.issuedBy,
    },
  ));
}

export async function activeSanctions(userId) {
  return query(
    `SELECT * FROM "GamingSanction"
     WHERE "userId" = @userId AND "revokedAt" IS NULL AND ("until" IS NULL OR "until" > CURRENT_TIMESTAMP)`,
    { userId },
  );
}

export async function listSanctions({ userId, activeOnly = false, limit = 100 } = {}) {
  const where = [];
  const params = { limit: p(T.int, limit) };
  if (userId) { where.push('"userId" = @userId'); params.userId = userId; }
  if (activeOnly) where.push('"revokedAt" IS NULL AND ("until" IS NULL OR "until" > CURRENT_TIMESTAMP)');
  return query(
    `SELECT * FROM "GamingSanction" ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY "createdAt" DESC LIMIT @limit`,
    params,
  );
}

export async function getSanction(id) {
  return one(await query('SELECT * FROM "GamingSanction" WHERE "id" = @id', { id: String(id) }));
}

export async function revokeSanction(id, revokedBy) {
  return one(await query(
    `UPDATE "GamingSanction" SET "revokedBy" = @revokedBy, "revokedAt" = CURRENT_TIMESTAMP
     WHERE "id" = @id AND "revokedAt" IS NULL RETURNING *`,
    { id, revokedBy },
  ));
}

// ── Leaderboard ────────────────────────────────────────────────────────────
// 3 points per real match win (byes excluded) and +10 for winning a final.

export async function leaderboardRows({ gameId, since, limit = 100 } = {}) {
  const where = [`m."status" = 'confirmed'`, 'm."entryAId" IS NOT NULL', 'm."entryBId" IS NOT NULL'];
  const params = { limit: p(T.int, limit) };
  if (gameId) { where.push('ev."gameId" = @gameId'); params.gameId = gameId; }
  if (since) { where.push('ev."startsAt" >= @since'); params.since = p(T.ts, since); }
  return query(
    `SELECT en."userId", ev."gameId",
       count(*)::int AS "wins",
       sum(CASE WHEN m."round" = (SELECT max(m2."round") FROM "TournamentMatch" m2 WHERE m2."eventId" = m."eventId")
                THEN 1 ELSE 0 END)::int AS "titles"
     FROM "TournamentMatch" m
     JOIN "EventEntry" en ON en."id" = m."winnerEntryId"
     JOIN "GameEvent" ev ON ev."id" = m."eventId"
     WHERE ${where.join(' AND ')}
     GROUP BY en."userId", ev."gameId"
     ORDER BY count(*) DESC
     LIMIT @limit`,
    params,
  );
}

// ── Overview counts ────────────────────────────────────────────────────────

export async function roomCountsByGame() {
  return query(
    `SELECT "gameId", count(*)::int AS "openSquads" FROM "GameRoom"
     WHERE "type" = 'squad' AND "status" IN ('open', 'full', 'in_game') AND "visibility" = 'public'
     GROUP BY "gameId"`,
  );
}
