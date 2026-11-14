/**
 * Gaming Zone permission matrix. One pure function, can(actor, action, ctx),
 * decides every gaming action so the rules live in one place and are tested.
 *
 * actor: { id, role, roles[] } (JWT payload or stored user).
 * ctx (all optional):
 *   zoneBanned       – actor has an active zone ban
 *   roomBanned       – actor is banned from ctx.room
 *   muted            – actor is muted in ctx.room (or zone-wide)
 *   room             – { type, status, visibility, ownerId, capacity }
 *   memberCount      – current members of ctx.room
 *   membership       – actor's GameRoomMember row in ctx.room (or null)
 *   targetMembership – the target user's row in ctx.room (kick/mute/role)
 *   target           – the target account { id, role, roles } (sanctions)
 *   inviteOk         – the private-room invite code matched
 *   ownOpenRooms     – squad rooms the actor owns that are not closed
 *   event            – { createdBy, kind, clubId }
 *   isEntrant / isOpponent / isAuthor – relationship flags
 *   banDays          – requested zone-ban length in days (null = permanent)
 */
import { hasAnyRole, isBannedAccount } from '../roleGuards.mjs';

export const TIERS = ['banned', 'guest', 'member', 'faculty', 'gaming_mod', 'staff'];

export const LIMITS = {
  openRoomsPerUser: 2,
  openRoomsPerMod: 5,
  gamingModMaxBanDays: 7,
};

/** Highest gaming tier an account has. */
export function gamingTier(actor) {
  if (!actor) return 'guest';
  if (isBannedAccount(actor)) return 'banned';
  if (hasAnyRole(actor, 'admin', 'moderator')) return 'staff';
  if (hasAnyRole(actor, 'gaming_mod')) return 'gaming_mod';
  const roles = [...new Set([...(Array.isArray(actor.roles) ? actor.roles : []), actor.role])]
    .filter(Boolean).map((role) => String(role).toLowerCase());
  if (roles.some((role) => role === 'faculty' || role.startsWith('faculty_'))) return 'faculty';
  if (roles.length === 0 || roles.every((role) => role === 'guest')) return 'guest';
  return 'member';
}

const rank = (tier) => TIERS.indexOf(tier);
const atLeast = (actor, tier) => rank(gamingTier(actor)) >= rank(tier);
const isMod = (actor) => atLeast(actor, 'gaming_mod');

const isRoomOwner = (actor, ctx) => ctx.membership?.roomRole === 'owner'
  || (!!ctx.room?.ownerId && String(ctx.room.ownerId) === String(actor?.id || ''));
const isRoomHost = (actor, ctx) => isRoomOwner(actor, ctx) || ctx.membership?.roomRole === 'cohost';

function canParticipate(actor, ctx) {
  return atLeast(actor, 'member') && !ctx.zoneBanned;
}

const RULES = {
  // Read the zone: lounges, room lists, events. Guests may look around.
  view: (actor, ctx) => gamingTier(actor) !== 'banned' && !ctx.zoneBanned,

  // Read a specific room's chat.
  'room.read': (actor, ctx) => {
    if (!RULES.view(actor, ctx)) return false;
    if (ctx.room?.type === 'lounge') return true;
    return !!ctx.membership || isMod(actor);
  },

  'room.create': (actor, ctx) => {
    if (!canParticipate(actor, ctx)) return false;
    const cap = isMod(actor) ? LIMITS.openRoomsPerMod : LIMITS.openRoomsPerUser;
    return (ctx.ownOpenRooms ?? 0) < cap;
  },

  'room.join': (actor, ctx) => {
    if (!canParticipate(actor, ctx) || ctx.roomBanned || !ctx.room) return false;
    if (ctx.membership) return true; // already in
    if (ctx.room.status === 'closed') return false;
    if (ctx.room.type === 'lounge') return true;
    if (ctx.room.visibility === 'private' && !ctx.inviteOk && !isMod(actor)) return false;
    return (ctx.memberCount ?? 0) < (ctx.room.capacity ?? 0);
  },

  // Post in a room. Lounges need no membership; other rooms do.
  'room.chat': (actor, ctx) => {
    if (!canParticipate(actor, ctx) || ctx.roomBanned || ctx.muted || !ctx.room) return false;
    if (ctx.room.status === 'closed') return false;
    if (ctx.room.type === 'lounge') return true;
    return !!ctx.membership;
  },

  // Kick / mute members. Hosts cannot act on the owner or another host.
  'room.moderate': (actor, ctx) => {
    if (!ctx.room || ctx.room.status === 'closed') return false;
    const targetRole = ctx.targetMembership?.roomRole;
    if (String(ctx.targetMembership?.userId || '') === String(actor?.id || '')) return false;
    if (isMod(actor)) {
      // Mods can act on anyone in a room, owners included, but not on an
      // account of their own tier or higher.
      return !(ctx.target && rank(gamingTier(ctx.target)) >= rank(gamingTier(actor)));
    }
    if (ctx.target && isMod(ctx.target)) return false;
    if (!canParticipate(actor, ctx) || ctx.room.type === 'lounge') return false;
    if (isRoomOwner(actor, ctx)) return targetRole !== 'owner';
    if (ctx.membership?.roomRole === 'cohost') return targetRole === 'member';
    return false;
  },

  // Edit settings, lobby code, ready check, promote co-hosts, transfer, close.
  'room.manage': (actor, ctx) => {
    if (!ctx.room || ctx.room.status === 'closed') return false;
    if (isMod(actor)) return true;
    if (!canParticipate(actor, ctx) || ctx.room.type === 'lounge') return false;
    return isRoomOwner(actor, ctx);
  },

  // Co-hosts can run the lobby (lobby code, ready check, start game).
  'room.host': (actor, ctx) => {
    if (!ctx.room || ctx.room.status === 'closed') return false;
    if (isMod(actor)) return true;
    if (!canParticipate(actor, ctx) || ctx.room.type === 'lounge') return false;
    return isRoomHost(actor, ctx);
  },

  'message.delete': (actor, ctx) => {
    if (isMod(actor)) return true;
    if (!canParticipate(actor, ctx)) return false;
    if (ctx.isAuthor) return true;
    return ctx.room?.type !== 'lounge' && isRoomHost(actor, ctx);
  },

  'profile.edit': (actor, ctx) => canParticipate(actor, ctx),

  'lfg.ping': (actor, ctx) => RULES['room.host'](actor, ctx),

  'event.create': (actor, ctx) => {
    if (ctx.zoneBanned) return false;
    if (ctx.kind === 'tournament') return isMod(actor);
    return isMod(actor) || gamingTier(actor) === 'faculty' || hasAnyRole(actor, 'clubs_representative');
  },

  'event.manage': (actor, ctx) => {
    if (isMod(actor)) return true;
    if (ctx.zoneBanned || !ctx.event) return false;
    return String(ctx.event.createdBy) === String(actor?.id || '') && ctx.event.kind !== 'tournament';
  },

  'event.register': (actor, ctx) => canParticipate(actor, ctx),

  'match.report': (actor, ctx) => isMod(actor) || (canParticipate(actor, ctx) && !!ctx.isEntrant),
  'match.confirm': (actor, ctx) => isMod(actor) || (canParticipate(actor, ctx) && !!ctx.isOpponent),
  'match.resolve': (actor) => isMod(actor),

  'report.create': (actor, ctx) => canParticipate(actor, ctx),
  'report.review': (actor) => isMod(actor),

  // Sanctions: gaming mods cannot touch staff or other gaming mods, and their
  // zone bans are capped. Staff can sanction anyone except other staff.
  'sanction.issue': (actor, ctx) => {
    if (!isMod(actor) || !ctx.target) return false;
    if (String(ctx.target.id) === String(actor.id)) return false;
    const targetTier = gamingTier(ctx.target);
    if (targetTier === 'staff') return false;
    if (gamingTier(actor) === 'gaming_mod') {
      if (targetTier === 'gaming_mod') return false;
      if (ctx.sanctionType === 'zone_ban'
        && (ctx.banDays == null || ctx.banDays > LIMITS.gamingModMaxBanDays)) return false;
    }
    return true;
  },
  'sanction.revoke': (actor) => isMod(actor),

  'game.manage': (actor) => isMod(actor),
};

export const GAMING_ACTIONS = Object.keys(RULES);

export function can(actor, action, ctx = {}) {
  const rule = RULES[action];
  if (!rule) throw new Error(`Unknown gaming action: ${action}`);
  return !!rule(actor, ctx || {});
}

/** Coarse capabilities the UI uses to show or hide controls. */
export function capabilitiesFor(actor, ctx = {}) {
  return {
    tier: gamingTier(actor),
    view: can(actor, 'view', ctx),
    participate: can(actor, 'profile.edit', ctx),
    createRoom: can(actor, 'room.create', { ...ctx, ownOpenRooms: 0 }),
    createGameNight: can(actor, 'event.create', { ...ctx, kind: 'game_night' }),
    createTournament: can(actor, 'event.create', { ...ctx, kind: 'tournament' }),
    moderate: can(actor, 'report.review', ctx),
    manageGames: can(actor, 'game.manage', ctx),
  };
}
