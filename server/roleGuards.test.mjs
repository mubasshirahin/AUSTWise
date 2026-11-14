import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  rolesOf, hasAnyRole, isBannedAccount, isStaff,
  canManageAccount, canAssignRoles, isProtectedSharedKey,
} from './roleGuards.mjs';

const admin = { id: 'a1', role: 'admin', roles: ['admin'] };
const mod = { id: 'm1', role: 'moderator', roles: ['moderator'] };
const mod2 = { id: 'm2', role: 'moderator', roles: ['moderator'] };
const student = { id: 's1', role: 'student', roles: ['student'] };
const cr = { id: 'c1', role: 'cr', roles: ['student', 'cr'] };
const bannedMod = { id: 'm3', role: 'banned', roles: ['banned'] };

describe('role lookup', () => {
  it('reads both the primary role and roles[]', () => {
    expect([...rolesOf(cr)].sort()).toEqual(['cr', 'student']);
    expect(hasAnyRole({ role: 'student', roles: ['student', 'bus_coordinator'] }, 'bus_coordinator')).toBe(true);
    expect(hasAnyRole({ role: 'student', roles: ['student', 'admin'] }, 'admin')).toBe(true);
    expect(hasAnyRole(null, 'admin')).toBe(false);
  });

  it('spots banned and staff accounts', () => {
    expect(isBannedAccount(bannedMod)).toBe(true);
    expect(isBannedAccount({ role: 'student', roles: ['student', 'banned'] })).toBe(true);
    expect(isBannedAccount(student)).toBe(false);
    expect(isStaff(mod)).toBe(true);
    expect(isStaff(cr)).toBe(false);
  });
});

describe('admin panel guards', () => {
  it('never lets anyone manage an admin', () => {
    expect(canManageAccount(mod, admin)).toBe(false);
    expect(canManageAccount({ id: 'a2', role: 'admin', roles: ['admin'] }, admin)).toBe(false);
  });

  it('lets only an admin manage a moderator', () => {
    expect(canManageAccount(mod, mod2)).toBe(false);
    expect(canManageAccount(admin, mod)).toBe(true);
  });

  it('blocks staff from editing themselves and non-staff from editing anyone', () => {
    expect(canManageAccount(mod, mod)).toBe(false);
    expect(canManageAccount(student, cr)).toBe(false);
    expect(canManageAccount(bannedMod, student)).toBe(false);
    expect(canManageAccount(mod, student)).toBe(true);
  });

  it('never hands out admin; moderator only from an admin', () => {
    expect(canAssignRoles(mod, ['admin'])).toBe(false);
    expect(canAssignRoles(admin, ['admin'])).toBe(false);
    expect(canAssignRoles(mod, ['student', 'moderator'])).toBe(false);
    expect(canAssignRoles(admin, ['moderator'])).toBe(true);
    expect(canAssignRoles(mod, ['cr', 'student', undefined])).toBe(true);
    expect(canAssignRoles(mod, ['ADMIN'])).toBe(false);
  });
});

describe('protected shared-store keys', () => {
  it('covers system:* and server-owned keys only', () => {
    expect(isProtectedSharedKey('system:role-access-config')).toBe(true);
    expect(isProtectedSharedKey('aust-usage-v1')).toBe(true);
    expect(isProtectedSharedKey('aust-notices')).toBe(false);
    expect(isProtectedSharedKey('my-systematic-key')).toBe(false);
  });
});

// ── middleware: banned accounts and requireAuth ──
const tokenRef = { current: null };
vi.mock('./auth.mjs', () => ({ readTokenCookie: () => tokenRef.current }));

function fakeRes() {
  return {
    status: 0,
    body: null,
    writeHead(code) { this.status = code; },
    end(text) { this.body = JSON.parse(text); },
  };
}

describe('middleware', async () => {
  const { requireRole, requireAuth } = await import('./middleware.mjs');
  beforeEach(() => { tokenRef.current = null; });

  it('401 without a session', () => {
    const res = fakeRes();
    expect(requireAuth({}, res)).toBe(null);
    expect(res.status).toBe(401);
  });

  it('requireAuth admits any non-banned role, including help_desk-only', () => {
    tokenRef.current = { id: 'h1', role: 'help_desk', roles: ['help_desk'] };
    expect(requireAuth({}, fakeRes())).toMatchObject({ id: 'h1' });
  });

  it('rejects banned users on requireAuth and requireRole', () => {
    tokenRef.current = { id: 'b1', role: 'banned', roles: ['banned'] };
    const res = fakeRes();
    expect(requireAuth({}, res)).toBe(null);
    expect(res.status).toBe(403);
    expect(res.body.banned).toBe(true);
    tokenRef.current = { id: 'b2', role: 'student', roles: ['student', 'banned'] };
    expect(requireRole('student')({}, fakeRes())).toBe(null);
  });

  it('checks roles[] as well as the primary role', () => {
    tokenRef.current = { id: 'c1', role: 'student', roles: ['student', 'cr'] };
    expect(requireRole('cr')({}, fakeRes())).toMatchObject({ id: 'c1' });
    const res = fakeRes();
    expect(requireRole('admin')({}, res)).toBe(null);
    expect(res.status).toBe(403);
  });
});
