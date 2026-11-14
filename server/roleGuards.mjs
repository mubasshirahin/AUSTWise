/**
 * Pure role helpers shared by auth, middleware, the WebSocket server and the
 * admin routes. No I/O here so the rules can be unit-tested directly.
 *
 * An account (JWT payload or stored user) has a primary `role` plus a
 * `roles[]` array; every check looks at both.
 */

export function rolesOf(account) {
  if (!account) return new Set();
  const list = [...(Array.isArray(account.roles) ? account.roles : []), account.role];
  return new Set(list.filter(Boolean).map((role) => String(role).toLowerCase()));
}

export function hasAnyRole(account, ...roles) {
  const owned = rolesOf(account);
  return roles.some((role) => owned.has(String(role).toLowerCase()));
}

export function isBannedAccount(account) {
  return hasAnyRole(account, 'banned');
}

export const STAFF_ROLES = ['admin', 'moderator'];

export function isStaff(account) {
  return hasAnyRole(account, ...STAFF_ROLES);
}

/**
 * Can `actor` edit, re-role or delete `target` from the admin panel?
 * - Nobody manages an admin account through the API.
 * - Only an admin manages a moderator.
 * - Staff cannot change their own account from the admin panel.
 */
export function canManageAccount(actor, target) {
  if (!actor || !target) return false;
  if (!isStaff(actor) || isBannedAccount(actor)) return false;
  if (String(actor.id) === String(target.id)) return false;
  if (hasAnyRole(target, 'admin')) return false;
  if (hasAnyRole(target, 'moderator') && !hasAnyRole(actor, 'admin')) return false;
  return true;
}

/**
 * Can `actor` hand out every role in `nextRoles`?
 * `admin` is never assignable through the API; `moderator` only by an admin.
 */
export function canAssignRoles(actor, nextRoles) {
  const wanted = [...new Set((nextRoles || []).filter(Boolean).map((role) => String(role).toLowerCase()))];
  if (wanted.includes('admin')) return false;
  if (wanted.includes('moderator') && !hasAnyRole(actor, 'admin')) return false;
  return true;
}

/**
 * Shared-store keys the server trusts for access decisions or stats. Only an
 * admin may write or delete them through the generic store endpoints.
 */
const PROTECTED_SHARED_EXACT = new Set(['aust-usage-v1']);
const PROTECTED_SHARED_PREFIXES = ['system:'];

export function isProtectedSharedKey(key) {
  const k = String(key || '');
  if (PROTECTED_SHARED_EXACT.has(k)) return true;
  return PROTECTED_SHARED_PREFIXES.some((prefix) => k.startsWith(prefix));
}
