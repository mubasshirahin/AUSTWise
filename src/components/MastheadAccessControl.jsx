import { useRoleAccess } from '../hooks/useRoleAccess';
import useAdminMode from '../hooks/useAdminMode';
import { useAuth } from '../context/AuthContext';
import AccessDeniedContent from './AccessDeniedContent';
import RoleAccessControlCard from '../features/admin/RoleAccessControlCard';


export default function MastheadAccessControl({ pageKey, children }) {
  const { isAdmin } = useAdminMode();
  const { user } = useAuth();
  const { config, loading } = useRoleAccess(pageKey);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
        Checking access…
      </div>
    );
  }

  const hidden = config.featureHidden.includes(user?.role);

  if (hidden && !isAdmin) {
    return <AccessDeniedContent role={user?.role} />;
  }

  return (
    <>
      {children}
      {isAdmin && (
        <div style={{ marginTop: '16px', textAlign: 'left' }}>
          <RoleAccessControlCard pageKey={pageKey} />
        </div>
      )}
    </>
  );
}
