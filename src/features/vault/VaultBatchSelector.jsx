import { useMemo, useState } from 'react';
import { Users, Check, Flame, FolderOpen, HardDrive } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { batchLabelOf, sameBatch, toggleDriveReaction } from '../../utils/vaultBatchStorage';
import { extractFolderId } from '../../utils/googleDrive';
import VaultMasthead from './VaultMasthead';

const SHARED_KEY = 'aust-batch-drives';

function prettyUpdated(entry) {
  if (!entry?.updatedAt) return '';
  try {
    return new Date(entry.updatedAt).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function VaultBatchSelector({ department, yearSem, onSelectBatch, progress }) {
  const { user } = useAuth();
  const [store] = useLiveValue('shared', SHARED_KEY, {});
  const [error, setError] = useState('');

  // Only batches whose CR/SR has actually uploaded a Drive link are shown.
  // Order: your own batch first, then the most recently updated link.
  const batches = useMemo(() => {
    const list = store?.[department]?.[yearSem] || [];
    return list
      .filter((b) => Boolean(b.driveUrl))
      .sort((a, b) => {
        const aOwn = user && sameBatch(a, user) ? 1 : 0;
        const bOwn = user && sameBatch(b, user) ? 1 : 0;
        if (aOwn !== bOwn) return bOwn - aOwn;
        const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        if (aTime !== bTime) return bTime - aTime;
        return batchLabelOf(a).localeCompare(batchLabelOf(b), undefined, { numeric: true });
      });
  }, [store, department, yearSem, user]);

  const isOwnBatch = (batch) => Boolean(user && sameBatch(batch, user));

  const reactions = store?.[department]?.reactions || {};

  const handleSelect = (batch) => {
    const folderId = extractFolderId(batch.driveUrl);
    if (!folderId) {
      setError('That Drive link looks broken. Ask your CR/SR to update it.');
      return;
    }
    setError('');
    onSelectBatch({ ...batch, folderId });
  };

  const handleReact = (event, batch) => {
    event.stopPropagation();
    if (!user?.id) return;
    toggleDriveReaction(department, batch.id, user.id);
  };

  return (
    <div className="vb-selector">
      <VaultMasthead department={department} yearSem={yearSem} />

      {progress}

      {error && <p className="vb-inline-error">{error}</p>}

      {batches.length === 0 ? (
        <div className="vb-empty">
          <HardDrive size={30} strokeWidth={1.5} />
          <p>No Drive links yet for {department} · {yearSem}</p>
          <span>Your CR or SR can add the semester Drive link from the Drive Links tab.</span>
        </div>
      ) : (
        <div className="vb-list">
          {batches.map((batch) => {
            const reactorMap = reactions[batch.id] || {};
            const count = Object.keys(reactorMap).length;
            const reacted = Boolean(user?.id && reactorMap[user.id]);
            const updated = prettyUpdated(batch);
            const own = isOwnBatch(batch);
            const label = batchLabelOf(batch) || [batch.batchName, batch.batchNo].filter(Boolean).join(' ');

            return (
              <div
                key={batch.id}
                className="vb-card has-drive"
                onClick={() => handleSelect(batch)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(batch); }}
              >
                <div className="vb-card-main">
                  <div className="vb-card-left">
                    <div className="vb-card-icon">
                      <Users size={18} />
                    </div>
                    <div className="vb-card-info">
                      <div className="vb-card-name">
                        {label}
                        {own && <span className="vb-own-badge">Your batch</span>}
                      </div>
                      <div className="vb-card-meta">
                        <Check size={10} /> Drive connected{updated ? ` · ${updated}` : ''}
                      </div>
                      {batch.updatedBy && (
                        <div className="vb-card-by">by {batch.updatedBy}</div>
                      )}
                    </div>
                  </div>

                  <div className="vb-card-right">
                    <button
                      type="button"
                      className={`vb-react ${reacted ? 'is-on' : ''}`}
                      onClick={(e) => handleReact(e, batch)}
                      title={reacted ? 'Remove reaction' : 'React to this Drive'}
                      aria-pressed={reacted}
                    >
                      <Flame size={15} />
                      <span>{count}</span>
                    </button>
                    <span className="vb-card-open">
                      <FolderOpen size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
