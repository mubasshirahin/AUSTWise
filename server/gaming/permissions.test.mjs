import { describe, expect, it } from 'vitest';
import { can, gamingTier, capabilitiesFor, GAMING_ACTIONS, LIMITS } from './permissions.mjs';

const acc = (id, ...roles) => ({ id, role: roles[0], roles });
const guest = acc('g', 'guest');
const banned = acc('b', 'banned');
const student = acc('s', 'student');
const cr = acc('cr', 'cr', 'student');
const clubRep = acc('club', 'student', 'clubs_representative');
const alumni = acc('al', 'alumni');
const faculty = acc('f', 'faculty', 'faculty_cse');
const deptFaculty = acc('f2', 'faculty_eee');
const gmod = acc('gm', 'student', 'gaming_mod');
const gmod2 = acc('gm2', 'student', 'gaming_mod');
const mod = acc('m', 'moderator');
const admin = acc('a', 'admin');
const helpDesk = acc('h', 'help_desk');

const lounge = { type: 'lounge', status: 'open', visibility: 'public', ownerId: null, capacity: 500 };
const squad = (over = {}) => ({ type: 'squad', status: 'open', visibility: 'public', ownerId: 's', capacity: 5, ...over });
const asMember = (userId, roomRole = 'member') => ({ userId, roomRole });

describe('tiers', () => {
  it('maps accounts to the right tier', () => {
    expect(gamingTier(null)).toBe('guest');
    expect(gamingTier(guest)).toBe('guest');
    expect(gamingTier(banned)).toBe('banned');
    expect(gamingTier({ id: 'x', role: 'admin', roles: ['admin', 'banned'] })).toBe('banned');
    for (const account of [student, cr, alumni, helpDesk, clubRep]) expect(gamingTier(account)).toBe('member');
    expect(gamingTier(faculty)).toBe('faculty');
    expect(gamingTier(deptFaculty)).toBe('faculty');
    expect(gamingTier(gmod)).toBe('gaming_mod');
    expect(gamingTier(mod)).toBe('staff');
    expect(gamingTier(admin)).toBe('staff');
  });

  it('throws on unknown actions', () => {
    expect(() => can(student, 'nope')).toThrow();
    expect(GAMING_ACTIONS).toContain('room.chat');
  });
});

describe('viewing and chatting', () => {
  it('guests can look but not talk; banned users see nothing', () => {
    expect(can(guest, 'view')).toBe(true);
    expect(can(guest, 'room.read', { room: lounge })).toBe(true);
    expect(can(guest, 'room.chat', { room: lounge })).toBe(false);
    expect(can(banned, 'view')).toBe(false);
    expect(can(student, 'view', { zoneBanned: true })).toBe(false);
  });

  it('lounges are open to members; squads need membership', () => {
    expect(can(student, 'room.chat', { room: lounge })).toBe(true);
    expect(can(student, 'room.read', { room: squad() })).toBe(false);
    expect(can(student, 'room.chat', { room: squad() })).toBe(false);
    expect(can(student, 'room.chat', { room: squad(), membership: asMember('s') })).toBe(true);
    expect(can(gmod, 'room.read', { room: squad() })).toBe(true);
  });

  it('mutes, room bans, zone bans and closed rooms stop chat', () => {
    const ctx = { room: squad(), membership: asMember('s') };
    expect(can(student, 'room.chat', { ...ctx, muted: true })).toBe(false);
    expect(can(student, 'room.chat', { ...ctx, roomBanned: true })).toBe(false);
    expect(can(student, 'room.chat', { ...ctx, zoneBanned: true })).toBe(false);
    expect(can(student, 'room.chat', { ...ctx, room: squad({ status: 'closed' }) })).toBe(false);
  });
});

describe('rooms', () => {
  it('caps open rooms per user', () => {
    expect(can(student, 'room.create', { ownOpenRooms: 0 })).toBe(true);
    expect(can(student, 'room.create', { ownOpenRooms: LIMITS.openRoomsPerUser })).toBe(false);
    expect(can(gmod, 'room.create', { ownOpenRooms: LIMITS.openRoomsPerUser })).toBe(true);
    expect(can(guest, 'room.create', { ownOpenRooms: 0 })).toBe(false);
  });

  it('join respects capacity, privacy and bans', () => {
    expect(can(student, 'room.join', { room: squad(), memberCount: 4 })).toBe(true);
    expect(can(student, 'room.join', { room: squad(), memberCount: 5 })).toBe(false);
    expect(can(student, 'room.join', { room: squad({ visibility: 'private' }), memberCount: 1 })).toBe(false);
    expect(can(student, 'room.join', { room: squad({ visibility: 'private' }), memberCount: 1, inviteOk: true })).toBe(true);
    expect(can(student, 'room.join', { room: squad(), memberCount: 1, roomBanned: true })).toBe(false);
    expect(can(student, 'room.join', { room: squad({ status: 'closed' }), memberCount: 1 })).toBe(false);
    expect(can(student, 'room.join', { room: lounge })).toBe(true);
  });

  it('owner moderates members and co-hosts; co-host only members', () => {
    const room = squad();
    const owner = { room, membership: asMember('s', 'owner') };
    expect(can(student, 'room.moderate', { ...owner, targetMembership: asMember('x', 'cohost') })).toBe(true);
    expect(can(student, 'room.moderate', { ...owner, targetMembership: asMember('s', 'owner') })).toBe(false);
    const cohost = { room, membership: asMember('cr', 'cohost') };
    expect(can(cr, 'room.moderate', { ...cohost, targetMembership: asMember('x', 'member') })).toBe(true);
    expect(can(cr, 'room.moderate', { ...cohost, targetMembership: asMember('y', 'cohost') })).toBe(false);
    expect(can(cr, 'room.moderate', { ...cohost, targetMembership: asMember('s', 'owner') })).toBe(false);
    expect(can(alumni, 'room.moderate', { room, membership: asMember('al'), targetMembership: asMember('x') })).toBe(false);
  });

  it('owners cannot kick a gaming mod; mods cannot act on equal or higher tiers', () => {
    const room = squad();
    expect(can(student, 'room.moderate', { room, membership: asMember('s', 'owner'), targetMembership: asMember('gm'), target: gmod })).toBe(false);
    expect(can(gmod, 'room.moderate', { room, targetMembership: asMember('s', 'owner'), target: student })).toBe(true);
    expect(can(gmod, 'room.moderate', { room, targetMembership: asMember('gm2'), target: gmod2 })).toBe(false);
    expect(can(mod, 'room.moderate', { room, targetMembership: asMember('gm2'), target: gmod2 })).toBe(true);
    expect(can(gmod, 'room.moderate', { room: lounge, targetMembership: asMember('s'), target: student })).toBe(true);
  });

  it('only the owner manages; co-hosts can host; lounges are mod-only', () => {
    const room = squad();
    expect(can(student, 'room.manage', { room, membership: asMember('s', 'owner') })).toBe(true);
    expect(can(cr, 'room.manage', { room, membership: asMember('cr', 'cohost') })).toBe(false);
    expect(can(cr, 'room.host', { room, membership: asMember('cr', 'cohost') })).toBe(true);
    expect(can(student, 'room.manage', { room: lounge })).toBe(false);
    expect(can(gmod, 'room.manage', { room: lounge })).toBe(true);
  });

  it('message deletion: author, squad hosts, mods', () => {
    expect(can(student, 'message.delete', { room: lounge, isAuthor: true })).toBe(true);
    expect(can(student, 'message.delete', { room: lounge })).toBe(false);
    expect(can(student, 'message.delete', { room: squad(), membership: asMember('s', 'owner') })).toBe(true);
    expect(can(gmod, 'message.delete', { room: lounge })).toBe(true);
  });
});

describe('events and tournaments', () => {
  it('who creates what', () => {
    expect(can(student, 'event.create', { kind: 'game_night' })).toBe(false);
    expect(can(faculty, 'event.create', { kind: 'game_night' })).toBe(true);
    expect(can(clubRep, 'event.create', { kind: 'game_night' })).toBe(true);
    expect(can(faculty, 'event.create', { kind: 'tournament' })).toBe(false);
    expect(can(gmod, 'event.create', { kind: 'tournament' })).toBe(true);
    expect(can(gmod, 'event.create', { kind: 'tournament', zoneBanned: true })).toBe(false);
  });

  it('creators manage their own game nights only', () => {
    expect(can(faculty, 'event.manage', { event: { createdBy: 'f', kind: 'game_night' } })).toBe(true);
    expect(can(faculty, 'event.manage', { event: { createdBy: 'other', kind: 'game_night' } })).toBe(false);
    expect(can(gmod, 'event.manage', { event: { createdBy: 'other', kind: 'tournament' } })).toBe(true);
  });

  it('match reporting needs to be an entrant; confirming needs to be the opponent', () => {
    expect(can(student, 'match.report', { isEntrant: true })).toBe(true);
    expect(can(student, 'match.report', {})).toBe(false);
    expect(can(student, 'match.confirm', { isOpponent: true })).toBe(true);
    expect(can(student, 'match.confirm', { isEntrant: true })).toBe(false);
    expect(can(student, 'match.resolve')).toBe(false);
    expect(can(gmod, 'match.resolve')).toBe(true);
  });
});

describe('moderation', () => {
  it('members report; mods review', () => {
    expect(can(student, 'report.create')).toBe(true);
    expect(can(guest, 'report.create')).toBe(false);
    expect(can(student, 'report.review')).toBe(false);
    expect(can(gmod, 'report.review')).toBe(true);
  });

  it('gaming mods: capped zone bans, no action on mods or staff', () => {
    expect(can(gmod, 'sanction.issue', { target: student, sanctionType: 'zone_ban', banDays: 7 })).toBe(true);
    expect(can(gmod, 'sanction.issue', { target: student, sanctionType: 'zone_ban', banDays: 30 })).toBe(false);
    expect(can(gmod, 'sanction.issue', { target: student, sanctionType: 'zone_ban', banDays: null })).toBe(false);
    expect(can(gmod, 'sanction.issue', { target: student, sanctionType: 'mute' })).toBe(true);
    expect(can(gmod, 'sanction.issue', { target: gmod2, sanctionType: 'mute' })).toBe(false);
    expect(can(gmod, 'sanction.issue', { target: mod, sanctionType: 'mute' })).toBe(false);
    expect(can(gmod, 'sanction.issue', { target: gmod, sanctionType: 'mute' })).toBe(false);
  });

  it('staff: any length, gaming mods ok, other staff never', () => {
    expect(can(mod, 'sanction.issue', { target: student, sanctionType: 'zone_ban', banDays: null })).toBe(true);
    expect(can(mod, 'sanction.issue', { target: gmod, sanctionType: 'zone_ban', banDays: 30 })).toBe(true);
    expect(can(mod, 'sanction.issue', { target: admin, sanctionType: 'mute' })).toBe(false);
    expect(can(student, 'sanction.issue', { target: alumni, sanctionType: 'mute' })).toBe(false);
  });

  it('capabilities summary', () => {
    expect(capabilitiesFor(guest)).toMatchObject({ tier: 'guest', view: true, participate: false, createRoom: false });
    expect(capabilitiesFor(student)).toMatchObject({ participate: true, createRoom: true, createGameNight: false, moderate: false });
    expect(capabilitiesFor(gmod)).toMatchObject({ createTournament: true, moderate: true, manageGames: true });
    expect(capabilitiesFor(student, { zoneBanned: true })).toMatchObject({ view: false, participate: false });
  });
});
