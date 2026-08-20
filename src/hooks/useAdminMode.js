import { useAuth } from '../context/AuthContext';

// Admins/moderators see the student pages as blank shells (hero + glider tabs,
// no feature boxes). Expose that flag so pages can hide their content areas.
export default function useAdminMode() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole?.('admin') || hasRole?.('moderator');
  return { isAdmin };
}