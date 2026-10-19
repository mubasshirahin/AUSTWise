import { useAuth } from '../context/AuthContext';

// Admins/moderators see the student pages as blank shells (hero + glider tabs,
// no feature boxes). Expose that flag so pages can hide their content areas.
export default function useAdminMode() {
  const { hasRole, isRoleMocked, mockRole } = useAuth();
  // In role-preview iframes, decide from the explicit preview role. This keeps
  // the signed-in admin's real session from leaking admin-only page chrome
  // into a Student/Faculty/etc. preview.
  const isAdmin = isRoleMocked
    ? mockRole === 'admin' || mockRole === 'moderator'
    : hasRole?.('admin') || hasRole?.('moderator');
  return { isAdmin };
}
