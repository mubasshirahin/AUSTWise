import { useState, useRef, useCallback } from 'react';
import { HelpCircle, Plus, X, MapPin, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import {
  addLostFoundItem,
  claimLostFoundItem,
  copyContact,
  deleteLostFoundItem,
  formatPostedDate,
  getSellerLabel,
  listLostFoundItems,
  reloadMarketplaceStore,
} from '../../utils/marketplaceStorage';
import ConfirmDialog from './ConfirmDialog';
import { sanitizeUserInput, MAX_TITLE_LENGTH, MAX_SHORT_TEXT_LENGTH } from '../../utils/sanitize';

const defaultForm = {
  title: '',
  type: 'lost',
  location: '',
  description: '',
  image: '',
  contact: '',
};

function resizeImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LostAndFound() {
  const { user } = useAuth();
  const [items, setItems] = useState(() => listLostFoundItems());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(() => setItems(listLostFoundItems()), []);

  // Real-time: when another device adds/removes a listing, refresh the list.
  // The storage util writes through sharedStore, which the server reports as a
  // store-change event (not marketplace-listing), so we listen to both.
  useWebSocket(user?.id || null, {
    onMarketplaceListing: useCallback(() => refresh(), [refresh]),
    onStoreChange: useCallback(({ scope, key }) => {
      if (scope !== 'shared' || key !== 'aust-marketplace-v1') return;
      reloadMarketplaceStore().then(() => refresh());
    }, [refresh]),
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setForm((c) => ({ ...c, image: dataUrl }));
      setPreviewUrl(dataUrl);
    } catch {
      setError('Could not process image. Please try another file.');
    }
  };

  const handleRemoveImage = () => {
    setForm((c) => ({ ...c, image: '' }));
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await addLostFoundItem({ ...form, title: sanitizeUserInput(form.title, MAX_TITLE_LENGTH), location: sanitizeUserInput(form.location, MAX_TITLE_LENGTH), description: sanitizeUserInput(form.description, MAX_SHORT_TEXT_LENGTH), contact: sanitizeUserInput(form.contact, MAX_TITLE_LENGTH), reporter: getSellerLabel(user) });
      setForm({ ...defaultForm });
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
      refresh();
      setMessage('Report published on the campus board.');
    } catch (submitError) {
      setError(submitError.message || 'Could not publish report.');
    }
  };

  const handleClaim = async (item) => {
    try {
      claimLostFoundItem(item.id);
      refresh();
      const result = await copyContact(item.contact, 'Reporter contact');
      setMessage(`Marked as claimed. ${result}`);
      setError('');
    } catch (claimError) {
      setError(claimError.message || 'Could not update item.');
    }
  };

  const handleDelete = (item) => {
    const isOwner = item.contributorId === user?.id;
    const isAdmin = user?.role === 'admin';
    if (!isOwner && !isAdmin) return;
    setDeleteTarget(item);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteLostFoundItem(deleteTarget.id, user?.id, user?.role);
    refresh();
    setMessage('Report removed.');
    setDeleteTarget(null);
  };

  const renderImage = (imageValue) => {
    if (imageValue && imageValue.startsWith('data:')) {
      return <img src={imageValue} alt="Item" />;
    }
    return <HelpCircle size={32} style={{ color: 'var(--text-tertiary)' }} />;
  };

  return (
    <div className="lost-found-container animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <HelpCircle size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Marketplace</span>
            <div className="schedule-title">Lost &amp; Found Desk</div>
            <span className="schedule-subtitle">Report or claim items around campus</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((open) => !open)}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Close' : 'Report Item'}
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {message && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', marginBottom: '10px' }}>{message}</p>}
      {error && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)', marginBottom: '10px' }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="grid-2" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Item title
              <input className="input" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} maxLength={MAX_TITLE_LENGTH} required />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Type
              <select className="input" value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))}>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Location
            <input className="input" value={form.location} onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))} maxLength={MAX_TITLE_LENGTH} required />
          </label>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Description
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} maxLength={MAX_SHORT_TEXT_LENGTH} required />
          </label>
          <div className="grid-2" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ marginBottom: '2px', color: 'var(--text-secondary)' }}>Photo</span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)',
                  border: '1px dashed var(--border-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                <span style={{ fontWeight: 500 }}>Choose photo...</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Contact
              <input className="input" value={form.contact} onChange={(e) => setForm((c) => ({ ...c, contact: e.target.value }))} maxLength={MAX_TITLE_LENGTH} required />
            </label>
          </div>
          {previewUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={previewUrl} alt="Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveImage} style={{ color: 'var(--accent-rose)' }}>Remove photo</button>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Post report</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px' }}>
          <HelpCircle size={36} />
          <h3>Board is empty</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Report a lost or found item for the campus community.</p>
        </div>
      ) : (
        <div className="lost-grid">
          {items.map((item) => {
            const isLost = item.type === 'lost';
            const isClaimed = item.status === 'claimed';

            return (
              <div
                key={item.id}
                className={`mp-card ${isClaimed ? 'mp-card-claimed-overlay' : ''} ${isLost ? 'mp-card-type-lost' : 'mp-card-type-found'}`}
              >
                <div className="mp-card-image">
                  {renderImage(item.image)}
                </div>
                <div className="mp-card-body">
                  <div className="mp-card-header">
                    <span className={`mp-card-badge${isClaimed ? ' mp-card-badge-success' : ''}`}>
                      {isClaimed ? 'CLAIMED' : isLost ? 'LOST' : 'FOUND'}
                    </span>
                    <span className="mp-card-date">{formatPostedDate(item.postedAt)}</span>
                  </div>
                  <h3 className="mp-card-title">{item.title}</h3>
                  <p className="mp-card-location"><MapPin size={12} /> {item.location}</p>
                  <p className="mp-card-description">{item.description}</p>
                </div>
                <div className="mp-card-footer">
                  <span className="mp-card-seller">By {item.reporter}</span>
                  <div className="mp-card-actions">
                    {(user?.role === 'admin' || item.contributorId === user?.id) && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(item)} style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={isClaimed}
                      onClick={() => handleClaim(item)}
                      style={{ fontSize: '9px', padding: '3px 8px' }}
                    >
                      {isClaimed ? 'Resolved' : isLost ? 'Found This' : 'Claim Item'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.title}
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
