import { useAuth } from '../context/AuthContext';
import useAdminMode from './useAdminMode';
import { useRoleAccess } from './useRoleAccess';

// Content gate for pages that keep their hero box + glider tab bar always
// visible (like the Dashboard and Grade Lab): only the content box below the
// tabs is hidden when the viewer's role sits in the page's "Feature Hidden"
// list. Admins/moderators always pass — pages show them the blank shell and
// the RoleAccessControlCard instead.
export default function usePageAccess(pageKey) {
  const { user } = useAuth();
  const { isAdmin } = useAdminMode();
  const { config, loading } = useRoleAccess(pageKey);
  const denied = !loading && !isAdmin && config.featureHidden?.includes(user?.role);
  return { denied, loading, isAdmin, role: user?.role };
}
