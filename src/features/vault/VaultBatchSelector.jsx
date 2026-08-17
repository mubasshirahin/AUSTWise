import { useState } from 'react';
import { Plus, X, Users, Check, Link, Unlink } from 'lucide-react';
import { getBatchConfigs, addBatchConfig, updateBatchDriveUrl } from '../../utils/vaultBatchStorage';
import { extractFolderId } from '../../utils/googleDrive';
import VaultMasthead from './VaultMasthead';

export default function VaultBatchSelector({ department, yearSem, onSelectBatch, progress }) {
  const [batches, setBatches] = useState(() => getBatchConfigs(department, yearSem));
  const [showForm, setShowForm] = useState(batches.length === 0);
  const [batchNo, setBatchNo] = useState('');
  const [batchName, setBatchName] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [editingDrive, setEditingDrive] = useState(null);

  const refresh = () => {
    setBatches(getBatchConfigs(department, yearSem));
  };

  const handleAdd = () => {
    if (!batchNo.trim() || !batchName.trim()) return;
    addBatchConfig(department, yearSem, {
      batchNo: batchNo.trim(),
      batchName: batchName.trim(),
      driveUrl: driveUrl.trim() || '',
    });
    setBatchNo('');
    setBatchName('');
    setDriveUrl('');
    setShowForm(false);
    refresh();
  };

  const handleDisconnect = (id) => {
    updateBatchDriveUrl(department, yearSem, id, '');
    refresh();
  };

  const handleSelect = (batch) => {
    if (batch.driveUrl) {
      const folderId = extractFolderId(batch.driveUrl);
      if (folderId) {
        onSelectBatch({ ...batch, folderId });
        return;
      }
    }
    setEditingDrive(batch.id);
  };

  const handleSetDrive = (batchId) => {
    const url = driveUrl.trim();
    if (!url) return;
    const folderId = extractFolderId(url);
    if (!folderId) return;
    updateBatchDriveUrl(department, yearSem, batchId, url);
    setDriveUrl('');
    setEditingDrive(null);
    refresh();
    const batch = batches.find(b => b.id === batchId);
    if (batch) onSelectBatch({ ...batch, driveUrl: url, folderId });
  };

  return (
    <div className="vb-selector">
      <VaultMasthead department={department} yearSem={yearSem} />

      {progress}

      <div className="vb-list">
        {[...batches].reverse().map(batch => (
          <div key={batch.id} className={`vb-card ${batch.driveUrl ? 'has-drive' : ''}`}>
            <div className="vb-card-main" onClick={() => handleSelect(batch)}>
              <div className="vb-card-left">
                <div className="vb-card-icon">
                  <Users size={18} />
                </div>
                <div className="vb-card-info">
                  <div className="vb-card-name">{batch.batchName} {batch.batchNo}</div>
                </div>
              </div>
              <div className="vb-card-right">
                {batch.driveUrl ? (
                  <div className="vb-card-actions">
                    <span className="vb-card-status connected">
                      <Check size={12} /> Connected
                    </span>
                    <button className="vb-card-disconnect" onClick={e => { e.stopPropagation(); handleDisconnect(batch.id); }}>
                      <Unlink size={12} /> Disconnect
                    </button>
                  </div>
                ) : (
                  <span className="vb-card-status no-drive">
                    <Link size={12} /> Set Drive
                  </span>
                )}
              </div>
            </div>
            {editingDrive === batch.id && (
              <div className="vb-drive-input" onClick={e => e.stopPropagation()}>
                <input
                  className="vb-input"
                  placeholder="Paste Google Drive folder link..."
                  value={driveUrl}
                  onChange={e => setDriveUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetDrive(batch.id)}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={() => handleSetDrive(batch.id)} disabled={!driveUrl.trim()}>
                  <Link size={13} /> Connect
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingDrive(null); setDriveUrl(''); }}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="vb-form">
          <div className="vb-form-row">
            <input
              className="vb-input"
              placeholder="Batch name (e.g. Encrypt)"
              value={batchName}
              onChange={e => setBatchName(e.target.value)}
            />
            <input
              className="vb-input"
              placeholder="Batch no (e.g. 51)"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
            />
          </div>
          <div className="vb-form-row">
            <input
              className="vb-input"
              placeholder="Google Drive folder link (optional)"
              value={driveUrl}
              onChange={e => setDriveUrl(e.target.value)}
            />
          </div>
          <div className="vb-form-actions">
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!batchNo.trim() || !batchName.trim()}>
              <Plus size={14} /> Add Batch
            </button>
            {batches.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <button className="vb-add-btn" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Add another batch
        </button>
      )}
    </div>
  );
}
