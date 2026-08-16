/**
 * Role/permission helpers for UI gating and dev-switch verification.
 */

export function canAccessAdminPanel(user) {
  if (!user) return false;
  return user.hasRole?.('admin') || user.hasRole?.('moderator') || user.role === 'admin' || user.role === 'moderator';
}

export function canInviteMembers(user) {
  return canAccessAdminPanel(user);
}

export function canReviewApplications(user) {
  return canAccessAdminPanel(user);
}

export function canManageNotices(user) {
  return canAccessAdminPanel(user);
}

export function canManageLibrary(user) {
  return canAccessAdminPanel(user);
}

export function canManageCanteen(user) {
  return canAccessAdminPanel(user);
}

export function canManageUsers(user) {
  return canAccessAdminPanel(user);
}
