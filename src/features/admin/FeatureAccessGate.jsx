import { useAuth } from '../../context/AuthContext';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import useAdminMode from '../../hooks/useAdminMode';
import { getAccessRole } from '../../utils/accessRole';

export default function FeatureAccessGate({ featureKey, children }) {
  const { user } = useAuth();
  const { isAdmin } = useAdminMode();
  const { config, loading } = useRoleAccess(featureKey);
  const accessRole = getAccessRole(user);

  if (loading && !isAdmin) return null;
  if (!isAdmin && config.enabled === false) return null;
  if (!isAdmin && config.featureHidden?.includes(accessRole)) return null;
  return children;
}
