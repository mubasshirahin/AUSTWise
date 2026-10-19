import { useLocation } from 'react-router-dom';
import { useRoleAccess } from '../hooks/useRoleAccess';
import useAdminMode from '../hooks/useAdminMode';
import { useAuth } from '../context/AuthContext';
import { getAccessRole } from '../utils/accessRole';

/**
 * Gates a page's content box by the viewer's role, using the SAME key as the
 * admin RoleAccessControlCard (the page's route path by default). The card is
 * rendered once per page by App.jsx, not here — this component only gates.
 */
export default function MastheadAccessControl({ pageKey, children }) {
  const location = useLocation();
  const { isAdmin } = useAdminMode();
  const { user } = useAuth();
  const { config, loading } = useRoleAccess(pageKey || location.pathname);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
        Checking access…
      </div>
    );
  }

  const accessRole = getAccessRole(user);
  const hidden = (config.featureHidden || []).includes(accessRole);

  if (hidden && !isAdmin) {
    return null;
  }

  return children;
}
