import { useEffect, useMemo, useState } from 'react';
import {
  Link2, Check, X, ExternalLink, Trash2, ShieldCheck, AlertTriangle, Pencil, Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLiveValue } from '../../utils/liveStore';
import { getAllAccounts } from '../../utils/authStorage';
import {
  batchLabelOf,
  sameBatch,
  upsertBatchDrive,
  removeBatchDrive,
} from '../../utils/vaultBatchStorage';
import { extractFolderId } from '../../utils/googleDrive';
import { getYearSemOptions } from '../../utils/semester';
import VaultMasthead from './VaultMasthead';
import './BatchDriveManager.css';

const SHARED_KEY = 'aust-batch-drives';

export default function BatchDriveManager() {
  const { user } = useAuth();
  const [store] = useLiveValue('shared', SHARED_KEY, {});
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const department = user?.department || '';
  const batchNo = String(user?.batchNo || '').trim();
  const batchName = String(user?.batchName || '').trim();
  // Full identity: "Quanta 52" — the number alone is not unique per dept.
  const batchLabel = batchLabelOf(user);

  const semesters = useMemo(() => getYearSemOptions(department), [department]);
  const bucket = store?.[department] || {};

  // Who else can edit this batch's links (CR + SR of the same dept + batch).
  const [members, setMembers] = useState(() => getAllAccounts());
  useEffect(() => {
    let cancelled = false;
    fetch('/api/presence/members')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.members)) return;
        setMembers((prev) => {
          const byId = new Map(prev.map((a) => [a.id, a]));
          return data.members.map((m) => ({ ...(byId.get(m.id) || {}), ...m }));
        });
      })
      .catch(() => { /* keep the local account cache */ });
    return () => { cancelled = true; };
  }, []);

  const mine = useMemo(() => ({ batchName, batchNo, batch: batchLabel }), [batchName, batchNo, batchLabel]);

  const maintainers = useMemo(() => members.filter((m) => (
    ['cr', 'sr'].includes(m.role)
    && String(m.department || '').trim().toUpperCase() === department.trim().toUpperCase()
    && sameBatch(m, mine)
  )), [members, department, mine]);

  // Always show the signed-in editor, even if the directory fetch is stale.
  const editors = useMemo(() => {
    if (!user?.id) return maintainers;
    if (maintainers.some((m) => m.id === user.id)) return maintainers;
    return [{ id: user.id, name: user.name || 'You', role: user.role }, ...maintainers];
  }, [maintainers, user?.id, user?.name, user?.role]);

  const entryFor = (yearSem) => (bucket[yearSem] || []).find((b) => sameBatch(b, mine));

  const startEdit = (yearSem) => {
    setError('');
    setEditing(yearSem);
    setDraft(entryFor(yearSem)?.driveUrl || '');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
    setError('');
  };

  const save = (yearSem) => {
    const url = draft.trim();
    if (!url) {
      setError('Paste a Google Drive folder link first.');
      return;
    }
    if (!extractFolderId(url)) {
      setError('That link does not look like a Google Drive folder.');
      return;
    }
    upsertBatchDrive(department, yearSem, {
      batchNo,
      batchName,
      driveUrl: url,
      userId: user?.id,
      userName: user?.name || '',
    });
    cancelEdit();
  };

  const clear = (yearSem) => {
    removeBatchDrive(department, yearSem, batchNo, user?.id, user?.name || '', batchName);
    if (editing === yearSem) cancelEdit();
  };

  if (!department || !batchLabel) {
    return (
      <div className="bdm-wrap">
        <VaultMasthead title="Drive Links" subtitle="CR / SR — semester links" />
        <div className="bdm-empty">
          <AlertTriangle size={26} />
          <p>Your profile is missing a department or batch.</p>
          <span>Ask an admin to set your batch name and number (e.g. Quanta 52), then reload.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bdm-wrap">
      <VaultMasthead title="Drive Links" subtitle="CR / SR — semester links" />

      <div className="bdm-batchbar">
        <div className="bdm-batch-id">
          <span className="bdm-batch-chip">{department}</span>
          <span className="bdm-batch-name">{batchLabel}</span>
        </div>

        <div className="bdm-maintainers">
          <Users size={13} />
          <span className="bdm-maintainers-label">Can edit</span>
          {editors.length > 0 ? editors.map((m) => (
            <span
              key={m.id}
              className={`bdm-person ${m.id === user?.id ? 'is-you' : ''}`}
              title={m.role === 'sr' ? 'Student Representative' : 'Class Representative'}
            >
              <span className="bdm-person-initials">{m.initials || (m.name || '?').slice(0, 2).toUpperCase()}</span>
              {m.name}{m.id === user?.id ? ' (you)' : ''}
            </span>
          )) : (
            <span className="bdm-person muted">No CR/SR listed for this batch</span>
          )}
        </div>
      </div>

      <div className="bdm-note">
        <ShieldCheck size={15} />
        <p>
          Shared with every CR &amp; SR of <strong>{batchLabel}</strong> ({department}).
          Anyone can update a semester link — saving a new link replaces the previous one.
        </p>
      </div>

      <div className="bdm-list">
        {semesters.map((yearSem, index) => {
          const entry = entryFor(yearSem);
          const hasLink = Boolean(entry?.driveUrl);
          const isEditing = editing === yearSem;

          return (
            <div key={yearSem} className={`bdm-row ${hasLink ? 'is-set' : ''}`}>
              <div className="bdm-row-head">
                <div className="bdm-sem">
                  <span className="bdm-sem-chip">{yearSem}</span>
                  <div className="bdm-sem-text">
                    <span className="bdm-sem-title">Semester {index + 1}</span>
                    {hasLink ? (
                      <span className="bdm-sem-status set">
                        <Check size={11} /> Link saved
                        {entry.updatedBy ? ` · ${entry.updatedBy}` : ''}
                      </span>
                    ) : (
                      <span className="bdm-sem-status empty">No link yet</span>
                    )}
                  </div>
                </div>

                <div className="bdm-row-actions">
                  {hasLink && (
                    <a
                      className="bdm-icon-btn"
                      href={entry.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open link"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {hasLink && !isEditing && (
                    <>
                      <button
                        className="bdm-text-btn"
                        onClick={() => startEdit(yearSem)}
                        title="Replace link"
                      >
                        <Pencil size={12} /> Change
                      </button>
                      <button
                        className="bdm-icon-btn danger"
                        onClick={() => clear(yearSem)}
                        title="Remove link"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  {!hasLink && !isEditing && (
                    <button className="bdm-text-btn" onClick={() => startEdit(yearSem)}>
                      <Link2 size={12} /> Add link
                    </button>
                  )}
                </div>
              </div>

              {hasLink && !isEditing && (
                <p className="bdm-url">{entry.driveUrl}</p>
              )}

              {isEditing && (
                <div className="bdm-edit">
                  <input
                    className="bdm-input"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save(yearSem);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="bdm-edit-actions">
                    <button
                      className="bdm-save"
                      onClick={() => save(yearSem)}
                      disabled={!draft.trim()}
                    >
                      <Check size={13} /> {hasLink ? 'Replace' : 'Save'}
                    </button>
                    <button className="bdm-cancel" onClick={cancelEdit}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                  {error && <p className="bdm-error">{error}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
