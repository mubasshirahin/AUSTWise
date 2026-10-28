import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Send, Users } from 'lucide-react';
import './TelegramConnectionsPanel.css';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TelegramConnectionsPanel() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadConnections = useCallback(async (isRefresh = false, silent = false) => {
    if (!silent) setError('');
    if (isRefresh) setRefreshing(true);
    else if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/telegram/users', { credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Could not load Telegram connections (${response.status}).`);
      }
      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (err) {
      if (!silent) setError(err.message || 'Could not load Telegram connections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadConnections(false, true);
    }, 3000);
    return () => window.clearInterval(refreshTimer);
  }, [loadConnections]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      String(user.accountName || '').toLowerCase().includes(needle) ||
      String(user.studentId || '').toLowerCase().includes(needle) ||
      String(user.awid || '').toLowerCase().includes(needle) ||
      String(user.chatId || '').toLowerCase().includes(needle)
    );
  }, [users, query]);

  return (
    <section className="telegram-connections-page">
      <header className="telegram-connections-heading">
        <div className="telegram-connections-title">
          <span className="telegram-connections-icon"><Send size={19} /></span>
          <div>
            <p className="telegram-connections-kicker">ADMIN DIRECTORY</p>
            <h2>Telegram connections</h2>
            <p>See which accounts are connected to the AUSTWise Telegram bot.</p>
          </div>
        </div>
        <div className="telegram-connections-count" aria-live="polite">
          <Users size={16} />
          <strong>{users.length}</strong>
          <span>connected</span>
        </div>
      </header>

      <div className="telegram-connections-toolbar">
        <label className="telegram-connections-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search by account name, Student ID, AWID, or Chat ID</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, Student ID, AWID, or Chat ID..."
          />
        </label>
        <button
          type="button"
          className="telegram-connections-refresh"
          onClick={() => loadConnections(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} />
          Refresh
        </button>
      </div>

      {error && <p className="telegram-connections-error" role="alert">{error}</p>}

      <div className="telegram-connections-table-wrap">
        <table className="telegram-connections-table">
          <thead>
            <tr>
              <th scope="col">Connected account</th>
              <th scope="col">Student ID</th>
              <th scope="col">AWID</th>
              <th scope="col">Telegram Chat ID</th>
              <th scope="col">Connected on</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="telegram-connections-empty" colSpan={6}>Loading Telegram connections...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td className="telegram-connections-empty" colSpan={6}>
                  {query ? 'No connections match your search.' : 'No Telegram accounts are connected yet.'}
                </td>
              </tr>
            ) : filteredUsers.map((user) => (
              <tr key={user.chatId}>
                <td>
                  <div className="telegram-account-name">
                    <span>{String(user.accountName || 'Unlinked account').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'}</span>
                    <strong>{user.accountName || 'Unlinked account'}</strong>
                  </div>
                </td>
                <td><span className="telegram-account-id">{user.studentId || '—'}</span></td>
                <td><code className="telegram-account-id">{user.awid || '—'}</code></td>
                <td><code className="telegram-chat-id">{user.chatId || '—'}</code></td>
                <td>{formatDate(user.createdAt)}</td>
                <td><span className={`telegram-connection-status ${user.enabled ? 'is-connected' : ''}`}>{user.enabled ? 'Connected' : 'Paused'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="telegram-connections-result-count" aria-live="polite">
        Showing {loading ? 0 : filteredUsers.length} of {users.length} connections
      </p>
    </section>
  );
}
