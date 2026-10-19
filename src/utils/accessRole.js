// Re-add is a student status role. It overrides Student only for access
// policies, while the account's primary role remains Student.
export function getAccessRole(user) {
  if (!user) return 'guest';
  if (user.role === 'admin' || user.role === 'moderator') return user.role;
  if (Array.isArray(user.roles) && user.roles.includes('readd')) return 'readd';
  return user.role || 'guest';
}
