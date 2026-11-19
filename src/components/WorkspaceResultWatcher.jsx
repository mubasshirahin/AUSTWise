import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { scanWorkspaceForResults } from '../features/workspace/resultPostAlerts';

const FIRST_CHECK_MS = 20 * 1000;
const CHECK_EVERY_MS = 10 * 60 * 1000;

/**
 * Background check for new marks / result / grade posts in connected Google
 * Classroom courses, while the app is open on any page. Renders nothing.
 */
export default function WorkspaceResultWatcher() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const run = () => { void scanWorkspaceForResults().catch(() => {}); };
    const first = setTimeout(run, FIRST_CHECK_MS);
    const every = setInterval(run, CHECK_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [isAuthenticated]);

  return null;
}
