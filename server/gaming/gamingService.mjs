/**
 * Gaming Zone business logic, shared by the HTTP routes and the WebSocket
 * handler. Every action goes through can() from permissions.mjs and throws
 * GamingError(status, message) when refused.
 */
import * as db from './gamingDB.mjs';
import { can, capabilitiesFor, gamingTier, LIMITS } from './permissions.mjs';
import {
  prepareMessage, cleanLine, cleanText, createRateLimiter, createSlowMode, isAllowedLink,
  MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_LOBBY_CODE_LENGTH,
} from './chatSafety.mjs';
import { buildBracket, placeWinner, winnerFromScores, championOf } from './bracket.mjs';
import {
  broadcastToRoom, sendToUsers, unsubscribeUserFromRoom, viewerCounts, getOnlineUserIds,
} from './gamingBus.mjs';
import { getUserById } from '../userStore.mjs';

export class GamingError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

const deny = (message = 'You are not allowed to do that.') => { throw new GamingError(403, message); };
const notFound = (what = 'Not found.') => { throw new GamingError(404, what); };
const bad = (message) => { throw new GamingError(400, message); };

const SQUAD_IDLE_MS = 2 * 60 * 60 * 1000;
const SQUAD_MAX_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_MUTE_MINUTES = 24 * 60;
const LFG_PING_COOLDOWN_MS = 10 * 60 * 1000;
const REPORTS_PER_HOUR = 10;

const messageLimiter = createRateLimiter({ max: 5, windowMs: 5000 });
const typingLimiter = createRateLimiter({ max: 4, windowMs: 3000 });
const slowMode = createSlowMode();
const lastLfgPing = new Map(); // roomId -> ms

// ── Cached lookups ─────────────────────────────────────────────────────────

const cardCache = new Map(); // userId -> { at, card }
const CARD_TTL_MS = 60 * 1000;

/** Public profile card for a user id (name, avatar, dept, batch). */
export async function userCard(userId) {
  const id = String(userId || '');
  if (!id) return null;
  const hit = cardCache.get(id);
  if (hit && Date.now() - hit.at < CARD_TTL_MS) return hit.card;
  let card = null;
  try {
    const user = await getUserById(id);
    if (user) {
      card = {
        id: user.id,
        name: user.name || 'AUSTian',
        avatar: user.avatar || null,
        department: user.department || '',
        batch: user.batch || user.batchName || '',
        tier: gamingTier(user),
      };
    }
  } catch { /* leave null */ }
  if (cardCache.size > 5000) cardCache.clear();
  cardCache.set(id, { at: Date.now(), card });
  return card;
}

export async function userCards(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const cards = await Promise.all(unique.map(userCard));
  return Object.fromEntries(unique.map((id, index) => [id, cards[index]]).filter(([, card]) => card));
}

/** Fresh account for a socket user (role checks need role/roles). */
export async function accountForSocket(userId) {
  const user = await getUserById(String(userId));
  return user ? { id: user.id, role: user.role, roles: user.roles || [] } : null;
}

const sanctionCache = new Map(); // userId -> { at, value }
const SANCTION_TTL_MS = 15 * 1000;

function invalidateSanctions(userId) {
  sanctionCache.delete(String(userId));
}

/** { zoneBanned, zoneBanUntil, zoneMuted, roomBans:Set, roomMutes:Set } */
async function sanctionsFor(userId) {
  const id = String(userId || '');
  if (!id) return { zoneBanned: false, zoneMuted: false, roomBans: new Set(), roomMutes: new Set() };
  const hit = sanctionCache.get(id);
  if (hit && Date.now() - hit.at < SANCTION_TTL_MS) return hit.value;
  const rows = await db.activeSanctions(id);
  const zoneBan = rows.find((row) => row.type === 'zone_ban');
  const value = {
    zoneBanned: !!zoneBan,
    zoneBanUntil: zoneBan?.until || null,
    zoneBanReason: zoneBan?.reason || '',
    zoneMuted: rows.some((row) => row.type === 'mute' && !row.roomId),
    roomBans: new Set(rows.filter((row) => row.type === 'room_ban' && row.roomId).map((row) => row.roomId)),
    roomMutes: new Set(rows.filter((row) => row.type === 'mute' && row.roomId).map((row) => row.roomId)),
  };
  if (sanctionCache.size > 5000) sanctionCache.clear();
  sanctionCache.set(id, { at: Date.now(), value });
  return value;
}

async function baseCtx(actor) {
  const s = await sanctionsFor(actor?.id);
  return { zoneBanned: s.zoneBanned, sanctions: s };
}

async function roomCtx(actor, room) {
  const base = await baseCtx(actor);
  const membership = actor?.id ? await db.getMember(room.id, String(actor.id)) : null;
  const memberMuted = membership?.mutedUntil && new Date(membership.mutedUntil) > new Date();
  return {
    ...base,
    room,
    membership,
    memberCount: room.memberCount ?? 0,
    roomBanned: base.sanctions.roomBans.has(room.id),
    muted: base.sanctions.zoneMuted || base.sanctions.roomMutes.has(room.id) || !!memberMuted,
  };
}

async function loadRoom(roomId) {
  const room = await db.getRoom(roomId);
  if (!room) notFound('Room not found.');
  return room;
}

function roomCapabilities(actor, ctx) {
  return {
    read: can(actor, 'room.read', ctx),
    join: !ctx.membership && can(actor, 'room.join', ctx),
    chat: can(actor, 'room.chat', ctx),
    host: can(actor, 'room.host', ctx),
    manage: can(actor, 'room.manage', ctx),
    moderate: can(actor, 'report.review', ctx),
    muted: !!ctx.muted,
  };
}

/** Room fields safe to show this viewer. */
function viewRoom(room, { member = false, host = false } = {}) {
  const out = { ...room };
  if (!member) out.lobbyCode = '';
  if (!host) out.inviteCode = null;
  return out;
}

async function membersWithCards(roomId) {
  const members = await db.listMembers(roomId);
  const cards = await userCards(members.map((member) => member.userId));
  const profiles = await db.getProfiles(members.map((member) => member.userId));
  const profileBy = Object.fromEntries(profiles.map((profile) => [profile.userId, profile]));
  return members.map((member) => ({ ...member, user: cards[member.userId] || null, profile: profileBy[member.userId] || null }));
}

async function systemMessage(roomId, text) {
  const message = await db.insertMessage({ roomId, fromId: 'system', text, kind: 'system' });
  broadcastToRoom(roomId, 'gz-message', { roomId, message, author: null });
  return message;
}

async function pushRoomState(roomId) {
  const room = await db.getRoom(roomId);
  if (!room) return;
  broadcastToRoom(roomId, 'gz-room-update', { roomId, room: viewRoom(room, { member: true }) });
  if (room.type !== 'lounge') {
    broadcastToRoom(roomId, 'gz-members', { roomId, members: await membersWithCards(roomId) });
  }
}

/** Keep squad status in step with occupancy. */
async function syncFullStatus(room) {
  const fresh = await db.getRoom(room.id);
  if (!fresh || fresh.type === 'lounge') return fresh;
  if (fresh.status === 'open' && fresh.memberCount >= fresh.capacity) return db.updateRoom(fresh.id, { status: 'full' });
  if (fresh.status === 'full' && fresh.memberCount < fresh.capacity) return db.updateRoom(fresh.id, { status: 'open' });
  return fresh;
}

// ── Input helpers ──────────────────────────────────────────────────────────

const intIn = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function pickRank(game, rank) {
  if (rank == null || rank === '') return null;
  const value = String(rank);
  if (!game.ranks?.length) return null;
  if (!game.ranks.includes(value)) bad(`Unknown rank "${value}" for ${game.name}.`);
  return value;
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) bad(`${label} is not a valid date.`);
  return date;
}

// ── Me / overview / games ──────────────────────────────────────────────────

export async function getMe(actor) {
  const ctx = await baseCtx(actor);
  const [rooms, profile] = await Promise.all([
    actor?.id ? db.listRoomsForUser(String(actor.id)) : [],
    actor?.id ? db.getProfile(String(actor.id)) : null,
  ]);
  return {
    capabilities: capabilitiesFor(actor, ctx),
    zoneBan: ctx.zoneBanned ? { until: ctx.sanctions.zoneBanUntil, reason: ctx.sanctions.zoneBanReason } : null,
    zoneMuted: ctx.sanctions.zoneMuted,
    rooms,
    profile,
    limits: { openRooms: gamingTier(actor) === 'gaming_mod' || gamingTier(actor) === 'staff' ? LIMITS.openRoomsPerMod : LIMITS.openRoomsPerUser },
  };
}

export async function overview(actor) {
  const ctx = await baseCtx(actor);
  if (!can(actor, 'view', ctx)) deny('You are suspended from the Gaming Zone.');
  const [games, counts, events, lounges] = await Promise.all([
    db.listGames(),
    db.roomCountsByGame(),
    db.listEvents({ from: new Date(), limit: 6 }),
    db.listRooms({ type: 'lounge', statuses: ['open'], limit: 200 }),
  ]);
  const viewers = viewerCounts();
  const countBy = Object.fromEntries(counts.map((row) => [row.gameId, row.openSquads]));
  const loungeBy = Object.fromEntries(lounges.map((room) => [room.gameId, room.id]));
  return {
    games: games.map((game) => ({
      ...game,
      loungeId: loungeBy[game.id] || null,
      openSquads: countBy[game.id] || 0,
      inLounge: viewers[loungeBy[game.id]] || 0,
    })),
    events,
    onlineNow: getOnlineUserIds().length,
  };
}

export async function listGames(actor, { includeInactive = false } = {}) {
  return db.listGames({ includeInactive: includeInactive && can(actor, 'game.manage') });
}

function cleanGameInput(input, { partial = false } = {}) {
  const out = {};
  if (!partial || 'name' in input) {
    out.name = cleanLine(input.name, 40);
    if (!out.name) bad('Game name is required.');
  }
  if (!partial) {
    out.slug = String(input.slug || out.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    if (!out.slug) bad('Game slug is required.');
  }
  if (!partial || 'genre' in input) out.genre = cleanLine(input.genre, 40);
  if (!partial || 'platforms' in input) {
    out.platforms = (Array.isArray(input.platforms) ? input.platforms : []).map((value) => cleanLine(value, 20)).filter(Boolean).slice(0, 5);
  }
  if (!partial || 'ranks' in input) {
    out.ranks = [...new Set((Array.isArray(input.ranks) ? input.ranks : []).map((value) => cleanLine(value, 30)).filter(Boolean))].slice(0, 20);
  }
  if (!partial || 'iconKey' in input) out.iconKey = /^[a-z-]{2,20}$/.test(input.iconKey || '') ? input.iconKey : 'gamepad';
  if (!partial || 'maxSquad' in input) out.maxSquad = intIn(input.maxSquad, 2, 50, 5);
  if (!partial || 'sortOrder' in input) out.sortOrder = intIn(input.sortOrder, 0, 10000, 500);
  if (partial && 'active' in input) out.active = !!input.active;
  return out;
}

export async function createGame(actor, input) {
  if (!can(actor, 'game.manage', await baseCtx(actor))) deny();
  const game = cleanGameInput(input || {});
  if (await db.getGame(game.slug)) bad('A game with that slug already exists.');
  const created = await db.createGame(game, String(actor.id));
  await db.createRoom({
    gameId: created.id, type: 'lounge', title: `${created.name} Lounge`,
    description: `Hang out, find a squad and talk ${created.name}.`, capacity: 500,
  });
  return created;
}

export async function updateGame(actor, gameId, input) {
  if (!can(actor, 'game.manage', await baseCtx(actor))) deny();
  const game = await db.getGame(gameId);
  if (!game) notFound('Game not found.');
  return db.updateGame(game.id, cleanGameInput(input || {}, { partial: true }));
}

// ── Rooms ──────────────────────────────────────────────────────────────────

export async function listRooms(actor, filters = {}) {
  const ctx = await baseCtx(actor);
  if (!can(actor, 'view', ctx)) deny('You are suspended from the Gaming Zone.');
  let gameId = null;
  if (filters.game) {
    const game = await db.getGame(filters.game);
    if (!game) notFound('Game not found.');
    gameId = game.id;
  }
  const statuses = ['open', 'full', 'in_game'];
  const rooms = await db.listRooms({
    gameId,
    type: ['lounge', 'squad', 'event'].includes(filters.type) ? filters.type : undefined,
    statuses,
    platform: filters.platform ? cleanLine(filters.platform, 20) : undefined,
    openSlots: filters.open === '1' || filters.open === true,
  });
  const viewers = viewerCounts();
  const owners = await userCards(rooms.map((room) => room.ownerId));
  return rooms.map((room) => ({
    ...viewRoom(room),
    owner: room.ownerId ? owners[room.ownerId] || null : null,
    viewers: viewers[room.id] || 0,
  }));
}

export async function getRoomDetail(actor, roomId) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'view', ctx)) deny('You are suspended from the Gaming Zone.');
  const caps = roomCapabilities(actor, ctx);
  const game = await db.getGame(room.gameId);
  const isMember = !!ctx.membership || caps.moderate;
  return {
    room: viewRoom(room, { member: isMember, host: caps.host }),
    game,
    owner: room.ownerId ? await userCard(room.ownerId) : null,
    members: caps.read && room.type !== 'lounge' ? await membersWithCards(room.id) : [],
    membership: ctx.membership,
    capabilities: caps,
    viewers: viewerCounts()[room.id] || 0,
  };
}

export async function createRoom(actor, input = {}) {
  const ctx = await baseCtx(actor);
  ctx.ownOpenRooms = await db.countOpenRoomsOwnedBy(String(actor.id));
  if (!can(actor, 'room.create', ctx)) {
    if (ctx.zoneBanned) deny('You are suspended from the Gaming Zone.');
    if (gamingTier(actor) === 'guest') deny('Guests cannot create rooms.');
    deny(`You already have ${ctx.ownOpenRooms} open rooms. Close one first.`);
  }
  const game = await db.getGame(input.gameId || input.game);
  if (!game || !game.active) bad('Pick a game.');
  const title = cleanLine(input.title, MAX_TITLE_LENGTH);
  if (title.length < 3) bad('Room title needs at least 3 characters.');
  const visibility = input.visibility === 'private' ? 'private' : 'public';
  let inviteCode = null;
  if (visibility === 'private') {
    for (let tries = 0; tries < 5 && !inviteCode; tries += 1) {
      const code = db.newInviteCode();
      if (!(await db.getRoomByInviteCode(code))) inviteCode = code;
    }
  }
  const rankMin = pickRank(game, input.rankMin);
  const rankMax = pickRank(game, input.rankMax);
  if (rankMin && rankMax && game.ranks.indexOf(rankMin) > game.ranks.indexOf(rankMax)) bad('Minimum rank is above maximum rank.');
  const room = await db.createRoom({
    gameId: game.id,
    type: 'squad',
    title,
    description: cleanText(input.description, MAX_DESCRIPTION_LENGTH),
    ownerId: String(actor.id),
    capacity: intIn(input.capacity, 2, game.maxSquad, game.maxSquad),
    visibility,
    inviteCode,
    rankMin,
    rankMax,
    region: cleanLine(input.region, 30),
    platform: game.platforms.includes(input.platform) ? input.platform : (game.platforms[0] || ''),
    expiresAt: new Date(Date.now() + SQUAD_MAX_LIFETIME_MS),
  });
  await db.addMemberIfSpace(room.id, String(actor.id), 'owner');
  await systemMessage(room.id, 'Room created. Share the lobby code here once everyone is in.');
  return getRoomDetail(actor, room.id);
}

async function joinLoaded(actor, room, { inviteOk = false } = {}) {
  const ctx = await roomCtx(actor, room);
  if (ctx.membership) return getRoomDetail(actor, room.id);
  ctx.inviteOk = inviteOk;
  if (!can(actor, 'room.join', ctx)) {
    if (ctx.zoneBanned) deny('You are suspended from the Gaming Zone.');
    if (ctx.roomBanned) deny('You were removed from this room.');
    if (room.status === 'closed') deny('This room is closed.');
    if (room.visibility === 'private' && !inviteOk) deny('This room needs an invite code.');
    if (ctx.memberCount >= room.capacity) throw new GamingError(409, 'This room is full.');
    deny('You cannot join this room.');
  }
  if (room.type === 'lounge') return getRoomDetail(actor, room.id);
  const added = await db.addMemberIfSpace(room.id, String(actor.id), 'member');
  if (!added && !(await db.getMember(room.id, String(actor.id)))) throw new GamingError(409, 'This room is full.');
  const card = await userCard(actor.id);
  await systemMessage(room.id, `${card?.name || 'Someone'} joined.`);
  await syncFullStatus(room);
  await pushRoomState(room.id);
  return getRoomDetail(actor, room.id);
}

export async function joinRoom(actor, roomId, { inviteCode } = {}) {
  const room = await loadRoom(roomId);
  const inviteOk = !!room.inviteCode && String(inviteCode || '').toUpperCase() === room.inviteCode;
  return joinLoaded(actor, room, { inviteOk });
}

export async function joinByCode(actor, code) {
  const room = await db.getRoomByInviteCode(String(code || '').trim());
  if (!room) notFound('No open room has that invite code.');
  return joinLoaded(actor, room, { inviteOk: true });
}

async function handOverOrClose(room, leavingUserId) {
  const members = (await db.listMembers(room.id)).filter((member) => member.userId !== leavingUserId);
  if (!members.length) {
    await db.updateRoom(room.id, { status: 'closed', closedAt: new Date() });
    broadcastToRoom(room.id, 'gz-room-closed', { roomId: room.id, reason: 'empty' });
    return;
  }
  const heir = members.find((member) => member.roomRole === 'cohost') || members[0];
  await db.setMemberRole(room.id, heir.userId, 'owner');
  await db.updateRoom(room.id, { ownerId: heir.userId });
  const card = await userCard(heir.userId);
  await systemMessage(room.id, `${card?.name || 'A member'} is now the room owner.`);
}

export async function leaveRoom(actor, roomId) {
  const room = await loadRoom(roomId);
  const userId = String(actor.id);
  const membership = await db.getMember(room.id, userId);
  if (!membership) return { left: false };
  await db.removeMember(room.id, userId);
  unsubscribeUserFromRoom(userId, room.id);
  const card = await userCard(userId);
  if (membership.roomRole === 'owner') await handOverOrClose(room, userId);
  const fresh = await db.getRoom(room.id);
  if (fresh && fresh.status !== 'closed') {
    await systemMessage(room.id, `${card?.name || 'Someone'} left.`);
    await syncFullStatus(fresh);
    await pushRoomState(room.id);
  }
  return { left: true };
}

async function targetCtx(actor, room, targetUserId) {
  const ctx = await roomCtx(actor, room);
  ctx.targetMembership = await db.getMember(room.id, String(targetUserId));
  const target = await getUserById(String(targetUserId));
  ctx.target = target ? { id: target.id, role: target.role, roles: target.roles || [] } : null;
  return ctx;
}

export async function kickMember(actor, roomId, targetUserId, { ban = false, reason = '' } = {}) {
  const room = await loadRoom(roomId);
  const ctx = await targetCtx(actor, room, targetUserId);
  if (!ctx.targetMembership) notFound('That user is not in this room.');
  if (!can(actor, 'room.moderate', ctx)) deny('You cannot remove that member.');
  const targetId = String(targetUserId);
  await db.removeMember(room.id, targetId);
  unsubscribeUserFromRoom(targetId, room.id);
  if (ban) {
    await db.createSanction({
      userId: targetId, type: 'room_ban', roomId: room.id, until: null,
      reason: cleanLine(reason, 200) || 'Removed by the room host', issuedBy: String(actor.id),
    });
    invalidateSanctions(targetId);
  }
  if (ctx.targetMembership.roomRole === 'owner') await handOverOrClose(room, targetId);
  sendToUsers([targetId], 'gz-kicked', { roomId: room.id, title: room.title, banned: !!ban });
  const card = await userCard(targetId);
  await systemMessage(room.id, `${card?.name || 'A member'} was removed.`);
  await syncFullStatus(room);
  await pushRoomState(room.id);
  return { removed: true };
}

export async function muteMember(actor, roomId, targetUserId, minutes) {
  const room = await loadRoom(roomId);
  const ctx = await targetCtx(actor, room, targetUserId);
  if (!ctx.targetMembership) notFound('That user is not in this room.');
  if (!can(actor, 'room.moderate', ctx)) deny('You cannot mute that member.');
  const mins = intIn(minutes, 0, MAX_MUTE_MINUTES, 10);
  const until = mins === 0 ? null : new Date(Date.now() + mins * 60 * 1000);
  await db.setMemberMutedUntil(room.id, String(targetUserId), until);
  sendToUsers([String(targetUserId)], 'gz-muted', { roomId: room.id, until });
  await pushRoomState(room.id);
  return { mutedUntil: until };
}

export async function setMemberRole(actor, roomId, targetUserId, roomRole) {
  if (!['cohost', 'member'].includes(roomRole)) bad('Role must be cohost or member.');
  const room = await loadRoom(roomId);
  const ctx = await targetCtx(actor, room, targetUserId);
  if (!ctx.targetMembership) notFound('That user is not in this room.');
  if (ctx.targetMembership.roomRole === 'owner') bad('Use transfer to change the owner.');
  if (!can(actor, 'room.manage', ctx)) deny('Only the room owner can change roles.');
  await db.setMemberRole(room.id, String(targetUserId), roomRole);
  await pushRoomState(room.id);
  return { roomRole };
}

export async function transferOwnership(actor, roomId, targetUserId) {
  const room = await loadRoom(roomId);
  const ctx = await targetCtx(actor, room, targetUserId);
  if (!ctx.targetMembership) notFound('That user is not in this room.');
  if (!can(actor, 'room.manage', ctx)) deny('Only the room owner can transfer it.');
  const currentOwner = room.ownerId;
  if (currentOwner && currentOwner !== String(targetUserId) && await db.getMember(room.id, currentOwner)) {
    await db.setMemberRole(room.id, currentOwner, 'cohost');
  }
  await db.setMemberRole(room.id, String(targetUserId), 'owner');
  await db.updateRoom(room.id, { ownerId: String(targetUserId) });
  const card = await userCard(targetUserId);
  await systemMessage(room.id, `${card?.name || 'A member'} is now the room owner.`);
  await pushRoomState(room.id);
  return { ownerId: String(targetUserId) };
}

export async function updateRoomSettings(actor, roomId, input = {}) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  const patch = {};
  const hostFields = ['lobbyCode', 'status'];
  const manageFields = ['title', 'description', 'capacity', 'visibility', 'slowModeSec', 'rankMin', 'rankMax', 'region', 'platform'];
  const wantsManage = manageFields.some((field) => field in input);
  const wantsHost = hostFields.some((field) => field in input);
  if (!wantsManage && !wantsHost) bad('Nothing to update.');
  if (wantsManage && !can(actor, 'room.manage', ctx)) deny('Only the room owner can change these settings.');
  if (wantsHost && !can(actor, 'room.host', ctx)) deny('Only room hosts can do that.');
  const game = await db.getGame(room.gameId);
  if ('title' in input) {
    patch.title = cleanLine(input.title, MAX_TITLE_LENGTH);
    if (patch.title.length < 3) bad('Room title needs at least 3 characters.');
  }
  if ('description' in input) patch.description = cleanText(input.description, MAX_DESCRIPTION_LENGTH);
  if ('capacity' in input) {
    const max = room.type === 'squad' ? game.maxSquad : 500;
    patch.capacity = Math.max(intIn(input.capacity, 2, max, room.capacity), room.memberCount || 0);
  }
  if ('visibility' in input && room.type === 'squad') {
    patch.visibility = input.visibility === 'private' ? 'private' : 'public';
    if (patch.visibility === 'private' && !room.inviteCode) patch.inviteCode = db.newInviteCode();
  }
  if ('slowModeSec' in input) patch.slowModeSec = intIn(input.slowModeSec, 0, 300, 0);
  if ('rankMin' in input) patch.rankMin = pickRank(game, input.rankMin);
  if ('rankMax' in input) patch.rankMax = pickRank(game, input.rankMax);
  if ('region' in input) patch.region = cleanLine(input.region, 30);
  if ('platform' in input) patch.platform = game.platforms.includes(input.platform) ? input.platform : room.platform;
  if ('lobbyCode' in input) {
    if (room.type === 'lounge') bad('Lounges have no lobby code.');
    patch.lobbyCode = cleanLine(input.lobbyCode, MAX_LOBBY_CODE_LENGTH);
  }
  if ('status' in input) {
    if (!['open', 'in_game'].includes(input.status) || room.type === 'lounge') bad('Status must be open or in_game.');
    patch.status = input.status === 'open' && (room.memberCount || 0) >= room.capacity ? 'full' : input.status;
  }
  const updated = await db.updateRoom(room.id, patch);
  if ('lobbyCode' in patch && patch.lobbyCode) await systemMessage(room.id, 'Lobby code updated. Check the room card.');
  if (patch.status === 'in_game') await systemMessage(room.id, 'Game on. Good luck!');
  await pushRoomState(room.id);
  return viewRoom(updated, { member: true, host: true });
}

export async function closeRoom(actor, roomId) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  if (room.type === 'lounge') bad('Lounges cannot be closed.');
  if (!can(actor, 'room.manage', ctx)) deny('Only the room owner can close it.');
  await db.updateRoom(room.id, { status: 'closed', closedAt: new Date() });
  broadcastToRoom(room.id, 'gz-room-closed', { roomId: room.id, reason: 'closed' });
  return { closed: true };
}

export async function setReady(actor, roomId, ready) {
  const room = await loadRoom(roomId);
  const membership = await db.getMember(room.id, String(actor.id));
  if (!membership) deny('Join the room first.');
  if ((await baseCtx(actor)).zoneBanned) deny('You are suspended from the Gaming Zone.');
  await db.setMemberReady(room.id, String(actor.id), !!ready);
  await pushRoomState(room.id);
  const members = await db.listMembers(room.id);
  const allReady = members.length > 1 && members.every((member) => member.ready);
  if (allReady && ready) await systemMessage(room.id, 'Everyone is ready.');
  return { ready: !!ready, allReady };
}

export async function readyCheck(actor, roomId) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'room.host', ctx)) deny('Only room hosts can start a ready check.');
  await db.resetReady(room.id);
  await systemMessage(room.id, 'Ready check! Tap Ready when you are set.');
  broadcastToRoom(room.id, 'gz-ready-check', { roomId: room.id, by: String(actor.id), at: Date.now() });
  await pushRoomState(room.id);
  return { started: true };
}

export async function pingLookingForSquad(actor, roomId) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'lfg.ping', ctx)) deny('Only room hosts can ping for players.');
  if (room.type !== 'squad' || room.visibility !== 'public') bad('Only public squads can ping for players.');
  const missing = room.capacity - (room.memberCount || 0);
  if (missing <= 0) bad('Your room is already full.');
  const last = lastLfgPing.get(room.id) || 0;
  if (Date.now() - last < LFG_PING_COOLDOWN_MS) {
    throw new GamingError(429, 'You pinged recently. Try again in a few minutes.', { retryAfterMs: LFG_PING_COOLDOWN_MS - (Date.now() - last) });
  }
  lastLfgPing.set(room.id, Date.now());
  const memberIds = new Set((await db.listMembers(room.id)).map((member) => member.userId));
  const online = new Set(getOnlineUserIds());
  const lookers = await db.listLookingForSquad(room.gameId, 500);
  const recipients = lookers.map((profile) => profile.userId).filter((id) => online.has(id) && !memberIds.has(id));
  const game = await db.getGame(room.gameId);
  sendToUsers(recipients, 'gz-lfg-ping', {
    roomId: room.id, title: room.title, game: { id: game.id, name: game.name, slug: game.slug },
    missing, rankMin: room.rankMin, rankMax: room.rankMax, from: await userCard(actor.id),
  });
  await systemMessage(room.id, `Pinged ${recipients.length} player${recipients.length === 1 ? '' : 's'} looking for a squad.`);
  return { notified: recipients.length };
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function listMessages(actor, roomId, { before, limit } = {}) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'room.read', ctx)) deny('Join the room to read its chat.');
  const messages = await db.listMessages(room.id, { before: before ? parseDate(before, 'before') : null, limit: intIn(limit, 1, 100, 50) });
  const authors = await userCards(messages.map((message) => message.fromId).filter((id) => id !== 'system'));
  return { messages, authors };
}

export async function postMessage(actor, roomId, { text, replyToId } = {}) {
  const room = await loadRoom(roomId);
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'room.chat', ctx)) {
    if (ctx.zoneBanned) deny('You are suspended from the Gaming Zone.');
    if (ctx.muted) deny('You are muted here.');
    if (gamingTier(actor) === 'guest') deny('Guests can read but not chat.');
    deny('Join the room to chat.');
  }
  const userId = String(actor.id);
  const rate = messageLimiter(userId);
  if (!rate.ok) throw new GamingError(429, 'Slow down a little.', { retryAfterMs: rate.retryAfterMs });
  if (!can(actor, 'room.host', ctx)) {
    const slow = slowMode(room.id, userId, room.slowModeSec);
    if (!slow.ok) throw new GamingError(429, `Slow mode is on (${room.slowModeSec}s).`, { retryAfterMs: slow.retryAfterMs });
  }
  const prepared = prepareMessage(text);
  if (!prepared.ok) bad(prepared.error);
  let reply = null;
  if (replyToId) {
    reply = await db.getMessage(replyToId);
    if (!reply || reply.roomId !== room.id) reply = null;
  }
  const message = await db.insertMessage({ roomId: room.id, fromId: userId, text: prepared.text, replyToId: reply?.id || null });
  const author = await userCard(userId);
  broadcastToRoom(room.id, 'gz-message', { roomId: room.id, message, author });
  return { message, author, flagged: prepared.flagged, linksRemoved: prepared.linksRemoved };
}

export async function deleteMessage(actor, roomId, messageId) {
  const room = await loadRoom(roomId);
  const message = await db.getMessage(messageId);
  if (!message || message.roomId !== room.id) notFound('Message not found.');
  const ctx = await roomCtx(actor, room);
  ctx.isAuthor = message.fromId === String(actor.id);
  if (message.kind === 'system' || !can(actor, 'message.delete', ctx)) deny('You cannot delete that message.');
  await db.softDeleteMessage(message.id);
  broadcastToRoom(room.id, 'gz-message-deleted', { roomId: room.id, messageId: message.id });
  return { deleted: true };
}

/** Typing indicator (socket only). Silently ignored when not allowed. */
export async function typing(actor, roomId, isTyping) {
  if (!typingLimiter(String(actor.id)).ok) return;
  const room = await db.getRoom(roomId);
  if (!room) return;
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'room.chat', ctx)) return;
  broadcastToRoom(room.id, 'gz-typing', { roomId: room.id, userId: String(actor.id), isTyping: !!isTyping });
}

/** May this socket user watch the room live? */
export async function canWatchRoom(actor, roomId) {
  const room = await db.getRoom(roomId);
  if (!room) return { ok: false, error: 'Room not found.' };
  const ctx = await roomCtx(actor, room);
  if (!can(actor, 'room.read', ctx)) return { ok: false, error: 'Join the room to watch it.' };
  return { ok: true, room };
}

// ── Gamer profiles & squad finder ──────────────────────────────────────────

export async function getProfile(actor, userId) {
  if (!can(actor, 'view', await baseCtx(actor))) deny('You are suspended from the Gaming Zone.');
  const id = String(userId || actor.id);
  const [profile, user] = await Promise.all([db.getProfile(id), userCard(id)]);
  if (!user) notFound('User not found.');
  return { user, profile: profile || { userId: id, games: [], platforms: [], availability: {}, lookingForSquad: false, lfgGameIds: [], bio: '', reputation: 0 } };
}

const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export async function saveProfile(actor, input = {}) {
  if (!can(actor, 'profile.edit', await baseCtx(actor))) deny('You cannot edit a gamer profile.');
  const games = await db.listGames({ includeInactive: true });
  const gameById = Object.fromEntries(games.map((game) => [game.id, game]));
  const entries = (Array.isArray(input.games) ? input.games : []).slice(0, 12).map((entry) => {
    const game = gameById[entry?.gameId];
    if (!game) return null;
    return {
      gameId: game.id,
      ign: cleanLine(entry.ign, 32),
      rank: game.ranks.includes(entry.rank) ? entry.rank : '',
      position: cleanLine(entry.position, 24),
    };
  }).filter(Boolean);
  const availability = {};
  for (const day of DAYS) {
    const slots = Array.isArray(input.availability?.[day]) ? input.availability[day] : [];
    const valid = slots.filter((slot) => SLOT_RE.test(String(slot))).slice(0, 4);
    if (valid.length) availability[day] = valid;
  }
  const lfgGameIds = (Array.isArray(input.lfgGameIds) ? input.lfgGameIds : []).filter((id) => gameById[id]).slice(0, 12);
  const profile = await db.upsertProfile(String(actor.id), {
    games: entries,
    platforms: (Array.isArray(input.platforms) ? input.platforms : []).map((value) => cleanLine(value, 20)).filter(Boolean).slice(0, 5),
    availability,
    lookingForSquad: !!input.lookingForSquad,
    lfgGameIds,
    bio: cleanText(input.bio, 200),
  });
  return profile;
}

export async function listLookingForSquad(actor, gameRef) {
  if (!can(actor, 'view', await baseCtx(actor))) deny('You are suspended from the Gaming Zone.');
  let gameId = null;
  if (gameRef) {
    const game = await db.getGame(gameRef);
    if (!game) notFound('Game not found.');
    gameId = game.id;
  }
  const profiles = await db.listLookingForSquad(gameId);
  const cards = await userCards(profiles.map((profile) => profile.userId));
  const online = new Set(getOnlineUserIds());
  return profiles
    .filter((profile) => cards[profile.userId])
    .map((profile) => ({ ...profile, user: cards[profile.userId], online: online.has(profile.userId) }))
    .sort((a, b) => Number(b.online) - Number(a.online));
}

// ── Events & tournaments ───────────────────────────────────────────────────

export async function listEvents(actor, filters = {}) {
  if (!can(actor, 'view', await baseCtx(actor))) deny('You are suspended from the Gaming Zone.');
  let gameId = null;
  if (filters.game) {
    const game = await db.getGame(filters.game);
    if (!game) notFound('Game not found.');
    gameId = game.id;
  }
  const events = await db.listEvents({
    gameId,
    kind: ['game_night', 'tournament'].includes(filters.kind) ? filters.kind : undefined,
    from: filters.past ? undefined : new Date(Date.now() - 6 * 60 * 60 * 1000),
    includeFinished: !!filters.past,
  });
  const creators = await userCards(events.map((event) => event.createdBy));
  return events.map((event) => ({ ...event, creator: creators[event.createdBy] || null }));
}

export async function getEventDetail(actor, eventId) {
  if (!can(actor, 'view', await baseCtx(actor))) deny('You are suspended from the Gaming Zone.');
  const event = await db.getEvent(eventId);
  if (!event) notFound('Event not found.');
  const [entries, matches, game] = await Promise.all([db.listEntries(event.id), db.listMatches(event.id), db.getGame(event.gameId)]);
  const cards = await userCards([event.createdBy, ...entries.map((entry) => entry.userId)]);
  const myEntry = entries.find((entry) => entry.userId === String(actor.id)) || null;
  const ctx = await baseCtx(actor);
  return {
    event: { ...event, creator: cards[event.createdBy] || null },
    game,
    entries: entries.map((entry) => ({ ...entry, user: cards[entry.userId] || null })),
    matches,
    champion: matches.length ? championOf(matches) : null,
    myEntry,
    capabilities: {
      register: !myEntry && event.status === 'scheduled' && can(actor, 'event.register', ctx),
      manage: can(actor, 'event.manage', { ...ctx, event }),
      resolve: can(actor, 'match.resolve', ctx),
    },
  };
}

export async function createEvent(actor, input = {}) {
  const kind = input.kind === 'tournament' ? 'tournament' : 'game_night';
  const ctx = await baseCtx(actor);
  if (!can(actor, 'event.create', { ...ctx, kind })) {
    deny(kind === 'tournament' ? 'Only gaming mods can create tournaments.' : 'Only faculty, club reps and gaming mods can host game nights.');
  }
  const game = await db.getGame(input.gameId || input.game);
  if (!game || !game.active) bad('Pick a game.');
  const title = cleanLine(input.title, MAX_TITLE_LENGTH);
  if (title.length < 3) bad('Event title needs at least 3 characters.');
  const startsAt = parseDate(input.startsAt, 'Start time');
  if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) bad('Start time is in the past.');
  const endsAt = input.endsAt ? parseDate(input.endsAt, 'End time') : null;
  if (endsAt && endsAt <= startsAt) bad('End time must be after the start time.');
  const teamSize = kind === 'tournament' ? intIn(input.teamSize, 1, game.maxSquad, 1) : 1;
  const capacity = intIn(input.capacity, 2, kind === 'tournament' ? 64 : 500, kind === 'tournament' ? 16 : 50);
  const event = await db.createEvent({
    gameId: game.id, title, description: cleanText(input.description, 600), kind, startsAt, endsAt,
    capacity, teamSize, format: kind === 'tournament' ? 'single_elim' : '', createdBy: String(actor.id),
    clubId: input.clubId ? cleanLine(input.clubId, 60) : null,
  });
  // Every event gets its own chat room; registrants join it automatically.
  const room = await db.createRoom({
    gameId: game.id, type: 'event', title, description: `Chat for ${title}.`, ownerId: String(actor.id),
    capacity: Math.min(capacity * teamSize + 10, 600), visibility: 'public',
  });
  await db.addMemberIfSpace(room.id, String(actor.id), 'owner');
  return db.updateEvent(event.id, { roomId: room.id });
}

export async function updateEvent(actor, eventId, input = {}) {
  const event = await db.getEvent(eventId);
  if (!event) notFound('Event not found.');
  if (!can(actor, 'event.manage', { ...(await baseCtx(actor)), event })) deny('You cannot edit this event.');
  const patch = {};
  if ('title' in input) {
    patch.title = cleanLine(input.title, MAX_TITLE_LENGTH);
    if (patch.title.length < 3) bad('Event title needs at least 3 characters.');
  }
  if ('description' in input) patch.description = cleanText(input.description, 600);
  if ('startsAt' in input) patch.startsAt = parseDate(input.startsAt, 'Start time');
  if ('endsAt' in input) patch.endsAt = input.endsAt ? parseDate(input.endsAt, 'End time') : null;
  if ('capacity' in input) patch.capacity = Math.max(intIn(input.capacity, 2, 500, event.capacity), event.entryCount || 0);
  if ('status' in input) {
    if (!['scheduled', 'live', 'finished', 'cancelled'].includes(input.status)) bad('Unknown status.');
    patch.status = input.status;
  }
  const updated = await db.updateEvent(event.id, patch);
  if (patch.status === 'cancelled' || patch.startsAt) {
    const entrants = (await db.listEntries(event.id)).map((entry) => entry.userId);
    sendToUsers(entrants, 'gz-event-update', { eventId: event.id, title: updated.title, status: updated.status, startsAt: updated.startsAt });
  }
  return updated;
}

export async function registerForEvent(actor, eventId, input = {}) {
  const event = await db.getEvent(eventId);
  if (!event) notFound('Event not found.');
  if (!can(actor, 'event.register', await baseCtx(actor))) deny('You cannot register for events.');
  if (event.status !== 'scheduled') bad('Registration is closed.');
  const teamName = event.teamSize > 1 ? cleanLine(input.teamName, 40) : '';
  if (event.teamSize > 1 && teamName.length < 2) bad('Team name is required.');
  const teamMembers = event.teamSize > 1
    ? (Array.isArray(input.teamMembers) ? input.teamMembers : []).map((name) => cleanLine(name, 32)).filter(Boolean).slice(0, event.teamSize - 1)
    : [];
  const entry = await db.addEntryIfSpace(event.id, { userId: String(actor.id), teamName, teamMembers });
  if (!entry) {
    const existing = (await db.listEntries(event.id)).find((row) => row.userId === String(actor.id));
    if (existing) return existing;
    throw new GamingError(409, 'This event is full.');
  }
  if (event.roomId) await db.addMemberIfSpace(event.roomId, String(actor.id), 'member');
  return entry;
}

export async function unregisterFromEvent(actor, eventId) {
  const event = await db.getEvent(eventId);
  if (!event) notFound('Event not found.');
  if ((await db.listMatches(event.id)).length) bad('The bracket is already out. Ask a mod to withdraw you.');
  await db.removeEntry(event.id, String(actor.id));
  if (event.roomId) await db.removeMember(event.roomId, String(actor.id));
  return { removed: true };
}

export async function checkIn(actor, eventId) {
  const event = await db.getEvent(eventId);
  if (!event) notFound('Event not found.');
  const startsAt = new Date(event.startsAt).getTime();
  if (Date.now() < startsAt - 60 * 60 * 1000) bad('Check-in opens one hour before the start.');
  const entry = await db.setCheckedIn(event.id, String(actor.id), true);
  if (!entry) bad('You are not registered for this event.');
  return entry;
}

export async function generateBracket(actor, eventId) {
  const event = await db.getEvent(eventId);
  if (!event) notFound('Event not found.');
  if (event.kind !== 'tournament') bad('Only tournaments have brackets.');
  if (!can(actor, 'event.manage', { ...(await baseCtx(actor)), event })) deny('Only gaming mods can build brackets.');
  const existing = await db.listMatches(event.id);
  if (existing.some((match) => match.reportedBy || (match.status === 'confirmed' && match.entryAId && match.entryBId))) {
    bad('Matches have already been played.');
  }
  const entries = await db.listEntries(event.id);
  const anyCheckedIn = entries.some((entry) => entry.checkedIn);
  const playing = anyCheckedIn ? entries.filter((entry) => entry.checkedIn) : entries;
  if (playing.length < 2) bad('At least 2 entries are needed.');
  const ordered = [...playing].sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9) || new Date(a.createdAt) - new Date(b.createdAt));
  await db.setEntrySeeds(event.id, ordered.map((entry) => entry.id));
  const matches = await db.replaceMatches(event.id, buildBracket(ordered.map((entry) => entry.id)));
  await db.updateEvent(event.id, { status: 'live' });
  sendToUsers(entries.map((entry) => entry.userId), 'gz-event-update', { eventId: event.id, title: event.title, status: 'live' });
  return matches;
}

async function matchContext(actor, matchId) {
  const match = await db.getMatch(matchId);
  if (!match) notFound('Match not found.');
  const event = await db.getEvent(match.eventId);
  const entries = await db.listEntries(match.eventId);
  const mine = entries.find((entry) => entry.userId === String(actor.id));
  const side = mine?.id === match.entryAId ? 'A' : (mine?.id === match.entryBId ? 'B' : null);
  return { match, event, entries, side, ctx: await baseCtx(actor) };
}

async function finishMatch(match, { scoreA, scoreB, winnerEntryId, confirmedBy }) {
  const decided = await db.updateMatch(match.id, {
    scoreA, scoreB, winnerEntryId, status: 'confirmed', confirmedBy, confirmedAt: new Date(),
  });
  const all = await db.listMatches(match.eventId);
  const next = placeWinner(all, { ...decided });
  if (next) await db.updateMatch(next.id, { entryAId: next.entryAId, entryBId: next.entryBId });
  const refreshed = await db.listMatches(match.eventId);
  if (championOf(refreshed)) await db.updateEvent(match.eventId, { status: 'finished' });
  return decided;
}

export async function reportMatch(actor, matchId, input = {}) {
  const { match, side, ctx } = await matchContext(actor, matchId);
  if (!match.entryAId || !match.entryBId) bad('This match is not ready yet.');
  if (match.status === 'confirmed') bad('This match is already decided.');
  if (!can(actor, 'match.report', { ...ctx, isEntrant: !!side })) deny('Only the two captains can report this match.');
  const scoreA = intIn(input.scoreA, 0, 999, -1);
  const scoreB = intIn(input.scoreB, 0, 999, -1);
  const winnerEntryId = winnerFromScores(match, scoreA, scoreB);
  if (!winnerEntryId) bad('Enter both scores; draws are not allowed.');
  const screenshotUrl = input.screenshotUrl && isAllowedLink(input.screenshotUrl) ? String(input.screenshotUrl).slice(0, 300) : '';
  if (can(actor, 'match.resolve', ctx) && !side) {
    return finishMatch(match, { scoreA, scoreB, winnerEntryId, confirmedBy: String(actor.id) });
  }
  return db.updateMatch(match.id, {
    scoreA, scoreB, winnerEntryId, status: 'reported', reportedBy: String(actor.id), reportedAt: new Date(), screenshotUrl,
  });
}

export async function confirmMatch(actor, matchId, { dispute = false } = {}) {
  const { match, entries, side, ctx } = await matchContext(actor, matchId);
  if (match.status !== 'reported') bad('There is no reported result to confirm.');
  const reporterEntry = entries.find((entry) => entry.userId === match.reportedBy);
  const reporterSide = reporterEntry?.id === match.entryAId ? 'A' : (reporterEntry?.id === match.entryBId ? 'B' : null);
  const isOpponent = !!side && side !== reporterSide;
  if (!can(actor, 'match.confirm', { ...ctx, isOpponent })) deny('Only the other captain can confirm this result.');
  if (dispute) return db.updateMatch(match.id, { status: 'disputed' });
  return finishMatch(match, { scoreA: match.scoreA, scoreB: match.scoreB, winnerEntryId: match.winnerEntryId, confirmedBy: String(actor.id) });
}

export async function resolveMatch(actor, matchId, input = {}) {
  const { match, ctx } = await matchContext(actor, matchId);
  if (!can(actor, 'match.resolve', ctx)) deny('Only gaming mods can settle results.');
  if (!match.entryAId || !match.entryBId) bad('This match is not ready yet.');
  if (match.status === 'confirmed') bad('This match is already decided.');
  const scoreA = intIn(input.scoreA, 0, 999, -1);
  const scoreB = intIn(input.scoreB, 0, 999, -1);
  const winnerEntryId = winnerFromScores(match, scoreA, scoreB);
  if (!winnerEntryId) bad('Enter both scores; draws are not allowed.');
  return finishMatch(match, { scoreA, scoreB, winnerEntryId, confirmedBy: String(actor.id) });
}

export async function leaderboard(actor, { game, period } = {}) {
  if (!can(actor, 'view', await baseCtx(actor))) deny('You are suspended from the Gaming Zone.');
  let gameId = null;
  if (game) {
    const found = await db.getGame(game);
    if (!found) notFound('Game not found.');
    gameId = found.id;
  }
  const since = period === 'month' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;
  const rows = await db.leaderboardRows({ gameId, since });
  const cards = await userCards(rows.map((row) => row.userId));
  const players = new Map();
  for (const row of rows) {
    const current = players.get(row.userId) || { userId: row.userId, wins: 0, titles: 0, points: 0 };
    current.wins += row.wins;
    current.titles += row.titles;
    current.points += row.wins * 3 + row.titles * 10;
    players.set(row.userId, current);
  }
  const ranked = [...players.values()]
    .filter((player) => cards[player.userId])
    .map((player) => ({ ...player, user: cards[player.userId] }))
    .sort((a, b) => b.points - a.points || b.titles - a.titles);
  const departments = new Map();
  for (const player of ranked) {
    const dept = player.user.department || 'Other';
    const current = departments.get(dept) || { department: dept, points: 0, players: 0 };
    current.points += player.points;
    current.players += 1;
    departments.set(dept, current);
  }
  return {
    players: ranked.slice(0, 50),
    departments: [...departments.values()].sort((a, b) => b.points - a.points),
  };
}

// ── Reports & sanctions ────────────────────────────────────────────────────

const REPORT_REASONS = ['toxicity', 'harassment', 'cheating', 'spam', 'scam', 'no_show', 'other'];

export async function createReport(actor, input = {}) {
  if (!can(actor, 'report.create', await baseCtx(actor))) deny('You cannot file reports.');
  const reason = REPORT_REASONS.includes(input.reason) ? input.reason : null;
  if (!reason) bad(`Reason must be one of: ${REPORT_REASONS.join(', ')}.`);
  const targetUserId = String(input.targetUserId || '');
  if (!targetUserId || targetUserId === String(actor.id)) bad('Pick someone to report.');
  if (!(await userCard(targetUserId))) notFound('User not found.');
  const recent = await db.countRecentReportsBy(String(actor.id), new Date(Date.now() - 60 * 60 * 1000));
  if (recent >= REPORTS_PER_HOUR) throw new GamingError(429, 'Too many reports this hour.');
  let roomId = null;
  let messageId = null;
  if (input.messageId) {
    const message = await db.getMessage(input.messageId);
    if (message && message.fromId === targetUserId) { messageId = message.id; roomId = message.roomId; }
  }
  if (!roomId && input.roomId && await db.getRoom(input.roomId)) roomId = String(input.roomId);
  const report = await db.createReport({
    reporterId: String(actor.id), targetUserId, roomId, messageId, reason, details: cleanText(input.details, 500),
  });
  return { id: report.id, status: report.status };
}

export async function listReports(actor, { status } = {}) {
  if (!can(actor, 'report.review', await baseCtx(actor))) deny();
  const reports = await db.listReports({ status: ['open', 'actioned', 'dismissed'].includes(status) ? status : undefined });
  const ids = reports.flatMap((report) => [report.reporterId, report.targetUserId, report.handledBy]);
  const cards = await userCards(ids);
  const messages = await Promise.all(reports.map((report) => (report.messageId ? db.getMessage(report.messageId) : null)));
  return reports.map((report, index) => ({
    ...report,
    reporter: cards[report.reporterId] || null,
    target: cards[report.targetUserId] || null,
    handler: report.handledBy ? cards[report.handledBy] || null : null,
    message: messages[index],
  }));
}

export async function resolveReport(actor, reportId, input = {}) {
  if (!can(actor, 'report.review', await baseCtx(actor))) deny();
  const report = await db.getReport(reportId);
  if (!report) notFound('Report not found.');
  if (!['actioned', 'dismissed'].includes(input.status)) bad('Status must be actioned or dismissed.');
  return db.resolveReport(report.id, { status: input.status, resolution: cleanText(input.resolution, 300), handledBy: String(actor.id) });
}

export async function issueSanction(actor, input = {}) {
  const type = ['mute', 'room_ban', 'zone_ban'].includes(input.type) ? input.type : null;
  if (!type) bad('Type must be mute, room_ban or zone_ban.');
  const targetId = String(input.userId || '');
  const target = targetId ? await getUserById(targetId) : null;
  if (!target) notFound('User not found.');
  const days = input.days == null || input.days === '' ? null : Number(input.days);
  if (days != null && (!Number.isFinite(days) || days <= 0 || days > 3650)) bad('Days must be a positive number.');
  const ctx = {
    ...(await baseCtx(actor)),
    target: { id: target.id, role: target.role, roles: target.roles || [] },
    sanctionType: type,
    banDays: days,
  };
  if (!can(actor, 'sanction.issue', ctx)) deny('You cannot sanction this user like that.');
  let roomId = null;
  if (type === 'room_ban' || (type === 'mute' && input.roomId)) {
    const room = input.roomId ? await db.getRoom(input.roomId) : null;
    if (!room) bad('Pick the room.');
    roomId = room.id;
  }
  const reason = cleanLine(input.reason, 200);
  if (reason.length < 3) bad('Give a short reason.');
  const sanction = await db.createSanction({
    userId: target.id, type, roomId, until: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
    reason, issuedBy: String(actor.id),
  });
  invalidateSanctions(target.id);
  if (type === 'room_ban') {
    await db.removeMember(roomId, target.id);
    unsubscribeUserFromRoom(target.id, roomId);
    await pushRoomState(roomId);
  }
  if (type === 'zone_ban') {
    for (const room of await db.listRoomsForUser(target.id)) {
      unsubscribeUserFromRoom(target.id, room.id);
    }
  }
  sendToUsers([target.id], 'gz-sanction', { type, roomId, until: sanction.until, reason });
  if (input.reportId) {
    await db.resolveReport(String(input.reportId), { status: 'actioned', resolution: `${type}: ${reason}`, handledBy: String(actor.id) }).catch(() => {});
  }
  return sanction;
}

export async function revokeSanction(actor, sanctionId) {
  if (!can(actor, 'sanction.revoke', await baseCtx(actor))) deny();
  const sanction = await db.revokeSanction(String(sanctionId), String(actor.id));
  if (!sanction) notFound('No active sanction with that id.');
  invalidateSanctions(sanction.userId);
  sendToUsers([sanction.userId], 'gz-sanction', { type: sanction.type, roomId: sanction.roomId, revoked: true });
  return sanction;
}

export async function listSanctions(actor, { userId, active } = {}) {
  if (!can(actor, 'report.review', await baseCtx(actor))) deny();
  const rows = await db.listSanctions({ userId: userId ? String(userId) : undefined, activeOnly: active === '1' || active === true });
  const cards = await userCards(rows.flatMap((row) => [row.userId, row.issuedBy, row.revokedBy]));
  return rows.map((row) => ({ ...row, user: cards[row.userId] || null, issuer: cards[row.issuedBy] || null }));
}

// ── Housekeeping (gamingJobs.mjs) ──────────────────────────────────────────

export async function closeStaleRooms(now = Date.now()) {
  const stale = await db.findStaleRooms(new Date(now - SQUAD_IDLE_MS));
  for (const { id } of stale) {
    await db.updateRoom(id, { status: 'closed', closedAt: new Date(now) });
    broadcastToRoom(id, 'gz-room-closed', { roomId: id, reason: 'idle' });
  }
  return stale.length;
}

const remindedEvents = new Set();

export async function sendEventReminders(now = Date.now()) {
  const soon = await db.eventsStartingBetween(new Date(now + 25 * 60 * 1000), new Date(now + 35 * 60 * 1000));
  let sent = 0;
  for (const event of soon) {
    if (remindedEvents.has(event.id)) continue;
    remindedEvents.add(event.id);
    const entrants = (await db.listEntries(event.id)).map((entry) => entry.userId);
    sendToUsers(entrants, 'gz-event-reminder', { eventId: event.id, title: event.title, startsAt: event.startsAt, roomId: event.roomId });
    sent += entrants.length;
  }
  if (remindedEvents.size > 2000) remindedEvents.clear();
  return sent;
}
