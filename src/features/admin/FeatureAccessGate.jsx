import { useAuth } from '../../context/AuthContext';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import { getAccessRole } from '../../utils/accessRole';

export default function FeatureAccessGate({ featureKey, children }) {
  const { user } = useAuth();
  const { config, loading } = useRoleAccess(featureKey);
  const isAdmin = user?.role === 'admin';
  const accessRole = getAccessRole(user);

  if (loading && !isAdmin) return null;
  if (!isAdmin && config.enabled === false) return null;
  if (!isAdmin && config.featureHidden?.includes(accessRole)) return null;
  return children;
}
