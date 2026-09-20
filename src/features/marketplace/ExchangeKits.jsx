import { useState, useRef, useCallback } from 'react';
import { ShoppingCart, Plus, X, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useWebSocket from '../../hooks/useWebSocket';
import {
  addExchangeItem,
  copyContact,
  deleteExchangeItem,
  formatPostedDate,
  getSellerLabel,
  listExchangeItems,
  reloadMarketplaceStore,
} from '../../utils/marketplaceStorage';
import ConfirmDialog from './ConfirmDialog';
import { sanitizeUserInput, MAX_TITLE_LENGTH } from '../../utils/sanitize';

const categories = ['Books', 'Lab Equipment', 'Stationery', 'Electronics', 'Other'];
const conditions = ['New', 'Like New', 'Good', 'Fair'];

const defaultForm = {
  title: '',
  price: '',
  condition: 'Good',
  category: 'Books',
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

export default function ExchangeKits() {
  const { user } = useAuth();
  const [items, setItems] = useState(() => listExchangeItems());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(() => setItems(listExchangeItems()), []);

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
      await addExchangeItem({ ...form, title: sanitizeUserInput(form.title, MAX_TITLE_LENGTH), contact: sanitizeUserInput(form.contact, MAX_TITLE_LENGTH), seller: getSellerLabel(user) });
      setForm({ ...defaultForm });
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
      refresh();
      setMessage('Listing published.');
    } catch (submitError) {
      setError(submitError.message || 'Could not publish listing.');
    }
  };

  const handleContact = async (item) => {
    try {
      const result = await copyContact(item.contact, 'Seller contact');
      setMessage(result);
      setError('');
    } catch (contactError) {
      setError(contactError.message || 'Could not copy contact.');
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
    deleteExchangeItem(deleteTarget.id, user?.id, user?.role);
    refresh();
    setMessage('Listing removed.');
    setDeleteTarget(null);
  };

  const renderImage = (imageValue) => {
    if (imageValue && imageValue.startsWith('data:')) {
      return <img src={imageValue} alt="Product" />;
    }
    if (imageValue) {
      return <span style={{ fontSize: '36px' }}>{imageValue}</span>;
    }
    return <ShoppingCart size={32} style={{ color: 'var(--text-tertiary)' }} />;
  };

  return (
    <div className="exchange-kits-container animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <ShoppingCart size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Marketplace</span>
            <div className="schedule-title">AW Market</div>
            <span className="schedule-subtitle">Peer-to-peer listings from AUST students</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowForm((open) => !open);
              setError('');
              setMessage('');
            }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Close' : 'Sell Product'}
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
              Product title
              <input id="exchange-title" name="title" className="input" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} maxLength={MAX_TITLE_LENGTH} required />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Price (৳)
              <input id="exchange-price" name="price" className="input" type="number" min="0" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))} required />
            </label>
          </div>
          <div className="grid-3" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Category
              <select id="exchange-category" name="category" className="input" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Condition
              <select id="exchange-condition" name="condition" className="input" value={form.condition} onChange={(e) => setForm((c) => ({ ...c, condition: e.target.value }))}>
                {conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
              </select>
            </label>
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
          </div>
          {previewUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={previewUrl} alt="Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveImage} style={{ color: 'var(--accent-rose)' }}>Remove photo</button>
            </div>
          )}
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Contact (phone / WhatsApp)
            <input className="input" value={form.contact} onChange={(e) => setForm((c) => ({ ...c, contact: e.target.value }))} maxLength={MAX_TITLE_LENGTH} placeholder="+880..." required />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Publish listing</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px' }}>
          <ShoppingCart size={36} />
          <h3>No listings yet</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Be the first to sell books, lab kits, or stationery.</p>
        </div>
      ) : (
        <div className="exchange-grid">
          {items.map((item) => (
            <div key={item.id} className="mp-card">
              <div className="mp-card-image">
                {renderImage(item.image)}
              </div>
              <div className="mp-card-body">
                <div className="mp-card-header">
                  <span className="mp-card-badge">{item.category}</span>
                  <span className="mp-card-date">{formatPostedDate(item.postedAt)}</span>
                </div>
                <h3 className="mp-card-title">{item.title}</h3>
                <p className="mp-card-subtitle">Condition: <b>{item.condition}</b></p>
                <div className="mp-card-price">৳ {item.price}</div>
              </div>
              <div className="mp-card-footer">
                <span className="mp-card-seller">Owner: {item.seller}</span>
                <div className="mp-card-actions">
                  {(user?.role === 'admin' || item.contributorId === user?.id) && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(item)} style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleContact(item)} style={{ fontSize: '10px', padding: '4px 10px' }}>
                    Contact Seller
                  </button>
                </div>
              </div>
            </div>
          ))}
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
