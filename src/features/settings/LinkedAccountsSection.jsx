import { useState } from 'react';
import { Plus, X, Check, Loader, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { startOAuthFlow } from '../../utils/socialOAuthFlow.js';
import { PROVIDER_MAP } from '../../utils/socialOAuth.jsx';

export default function LinkedAccountsSection({ user, updateUser }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [copiedProvider, setCopiedProvider] = useState(null);

  const linkedAccounts = user.linkedAccounts || [];
  const gmail = user.linkedSocial?.gmail;

  const handleConnect = async (providerKey) => {
    // Remove existing connection first if reconnecting
    const alreadyLinked = alreadyConnected(providerKey);
    let remainingAccounts = linkedAccounts;
    if (alreadyLinked) {
      remainingAccounts = linkedAccounts.filter(a => a.provider !== providerKey);
      updateUser({ linkedAccounts: remainingAccounts });
    }

    setConnecting(true);
    setError('');

    try {
      const profile = await startOAuthFlow(providerKey);
      if (!profile || profile.error) {
        throw new Error(profile?.error || 'Connection failed');
      }

      const newAccount = {
        provider: providerKey,
        providerName: PROVIDER_MAP[providerKey].name,
        username: providerKey === 'discord'
          ? (profile.username || profile.id || '').replace(/#0$/, '')
          : (profile.username || profile.id),
        displayName: profile.displayName || profile.username || profile.id,
        email: profile.email || '',
        avatar: profile.avatar || null,
        link: profile.link || null,
        connectedAt: new Date().toISOString(),
      };

      const updatedAccounts = [...remainingAccounts, newAccount];
      updateUser({ linkedAccounts: updatedAccounts });
      setShowAddModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleRemoveAccount = (providerKey) => {
    const updatedAccounts = linkedAccounts.filter(a => a.provider !== providerKey);
    updateUser({ linkedAccounts: updatedAccounts });
  };

  const handleCopyUsername = async (text, provider) => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedProvider(provider);
      setTimeout(() => setCopiedProvider(null), 1500);
    } catch {
      // ignore
    }
  };

  const alreadyConnected = (providerKey) => {
    return linkedAccounts.some(a => a.provider === providerKey);
  };

  return (
    <div className="profile-linked-social">
      <div className="profile-linked-social-header">
        <h4>Linked Accounts</h4>
        <button
          className="profile-linked-add-btn"
          onClick={() => setShowAddModal(true)}
          title="Add linked account"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="profile-linked-social-list">
        {gmail && (
          <span className="profile-linked-social-item">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {gmail}
          </span>
        )}
        {linkedAccounts.map((account) => {
          const cfg = PROVIDER_MAP[account.provider];
          if (!cfg) return null;
          const url = cfg.profileUrl?.(account);
          const displayLabel = account.provider === 'discord'
            ? (account.username || '').replace(/#0$/, '')
            : (account.displayName || account.username);
          const content = (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {account.avatar ? (
                  <img src={account.avatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                ) : cfg.icon}
                <span style={{ fontSize: '10px', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cfg.name}</span>
                {account.provider === 'discord' ? (
                  <button
                    className="profile-linked-copy-btn"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCopyUsername(displayLabel, account.provider); }}
                    title={copiedProvider === account.provider ? 'Copied!' : 'Click to copy username'}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', userSelect: 'text', WebkitUserSelect: 'text' }}>{displayLabel}</span>
                    {copiedProvider === account.provider ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  </button>
                ) : (
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)', userSelect: 'text', WebkitUserSelect: 'text' }} title={displayLabel}>{displayLabel}</span>
                )}
                <span className="profile-linked-status-dot" />
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemoveAccount(account.provider); }}
                className="profile-linked-remove-btn"
                title={`Disconnect ${cfg.name}`}
              >
                <X size={12} />
              </button>
            </>
          );
          if (url) {
            return (
              <a
                key={account.provider}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-linked-social-item profile-linked-social-item-connected is-clickable"
                title={`Open ${cfg.name} profile`}
              >
                {content}
                <ExternalLink size={11} style={{ opacity: 0.4, flexShrink: 0 }} />
              </a>
            );
          }
          return (
            <span
              key={account.provider}
              className="profile-linked-social-item profile-linked-social-item-connected"
            >
              {content}
            </span>
          );
        })}
        {linkedAccounts.length === 0 && !gmail && (
          <span className="profile-linked-social-item" style={{ opacity: 0.35, fontStyle: 'italic' }}>
            No accounts linked yet
          </span>
        )}
      </div>

      {showAddModal && (
        <div className="profile-linked-modal-overlay" onClick={() => { setShowAddModal(false); setError(''); }}>
          <div className="profile-linked-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-linked-modal-header">
              <h5>Link an Account</h5>
              <button className="profile-linked-modal-close" onClick={() => { setShowAddModal(false); setError(''); }}>
                <X size={18} />
              </button>
            </div>

            <div className="profile-linked-provider-grid">
              {Object.entries(PROVIDER_MAP).map(([key, config]) => {
                const connected = alreadyConnected(key);
                return (
                  <button
                    key={key}
                    className={`profile-linked-provider-btn ${connected ? 'is-connected' : ''}`}
                    onClick={() => !connecting && handleConnect(key)}
                    disabled={connecting}
                    title={connected ? `Reconnect ${config.name}` : `Connect ${config.name}`}
                    style={{ '--provider-color': config.color }}
                  >
                    {connecting ? <Loader size={18} className="spin" /> : config.icon}
                    <span>{config.name}</span>
                    {connected && <Check size={14} className="connected-badge" />}
                  </button>
                );
              })}
            </div>

            {error && (
              <div style={{
                marginTop: 'var(--sp-3)',
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--accent-rose-glow)',
                border: '1px solid var(--accent-rose)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-xs)',
                color: 'var(--accent-rose)',
              }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
