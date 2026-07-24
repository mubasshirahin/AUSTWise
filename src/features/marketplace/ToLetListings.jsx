import { useState, useRef } from 'react';
import { Home, Plus, MapPin, X, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  addToLetListing,
  copyContact,
  deleteToLetListing,
  formatPostedDate,
  getSellerLabel,
  listToLetListings,
  setToLetAvailability,
} from '../../utils/marketplaceStorage';
import ConfirmDialog from './ConfirmDialog';

const spaceTypes = ['Seat', 'Room', 'Flat', 'Hostel'];
const amenityOptions = ['WiFi', 'Security', 'Attached Bath', 'Lift', 'Bua'];

const defaultForm = {
  title: '',
  rent: '',
  location: '',
  type: 'Seat',
  amenities: ['WiFi'],
  image: '',
  contact: '',
  description: '',
  environment: 'Male',
  utilities: '',
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

export default function ToLetListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState(() => listToLetListings());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm, contact: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = () => setListings(listToLetListings());

  const toggleAmenity = (amenity) => {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

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

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      addToLetListing({ ...form, owner: getSellerLabel(user) });
      setForm({ ...defaultForm, contact: form.contact });
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
      refresh();
      setMessage('To-let listing published.');
    } catch (submitError) {
      setError(submitError.message || 'Could not publish listing.');
    }
  };

  const handleContact = async (listing) => {
    try {
      const result = await copyContact(listing.contact, 'Owner contact');
      setMessage(result);
      setError('');
    } catch (contactError) {
      setError(contactError.message || 'Could not copy contact.');
    }
  };

  const handleToggleAvailable = (listing) => {
    setToLetAvailability(listing.id, !listing.available);
    refresh();
    setMessage(listing.available ? 'Marked as occupied.' : 'Marked as available.');
  };

  const handleDelete = (listing) => {
    const isOwner = listing.contributorId === user?.id;
    const isAdmin = user?.role === 'admin';
    if (!isOwner && !isAdmin) return;
    setDeleteTarget(listing);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteToLetListing(deleteTarget.id, user?.id, user?.role);
    refresh();
    setMessage('Listing removed.');
    setDeleteTarget(null);
  };

  const renderImage = (imageValue) => {
    if (imageValue && imageValue.startsWith('data:')) {
      return <img src={imageValue} alt="Property" />;
    }
    return <Home size={32} style={{ color: 'var(--text-tertiary)' }} />;
  };

  return (
    <div className="glass-card-static tolet-listings-container animate-fadeInUp">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'var(--accent-purple-glow)', color: 'var(--accent-purple)', padding: '6px', borderRadius: '8px' }}>
            <Home size={18} />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>ToLet Mama</h2>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Student-posted seats, rooms, and flats near campus</p>
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((open) => !open)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Close' : 'Post To-Let'}
        </button>
      </div>

      {message && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', marginBottom: '10px' }}>{message}</p>}
      {error && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)', marginBottom: '10px' }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Listing title
            <input className="input" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} required />
          </label>
          <div className="grid-3" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Monthly rent (৳)
              <input className="input" type="number" min="0" value={form.rent} onChange={(e) => setForm((c) => ({ ...c, rent: e.target.value }))} required />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Location
              <input className="input" value={form.location} onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))} placeholder="Tejgaon" required />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Type
              <select className="input" value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))}>
                {spaceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>
          <div className="grid-2" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Gender
              <select className="input" value={form.environment} onChange={(e) => setForm((c) => ({ ...c, environment: e.target.value }))}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Description (optional)
            <textarea className="input" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Describe the space, rules, who can stay..." rows={2} />
          </label>
          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Utilities (optional)
            <textarea className="input" value={form.utilities} onChange={(e) => setForm((c) => ({ ...c, utilities: e.target.value }))} placeholder="e.g. Electricity, Water, Gas, Internet, Maid..." rows={2} />
          </label>
          <div>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Amenities</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {amenityOptions.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  className={`badge ${form.amenities.includes(amenity) ? 'badge-blue' : 'badge-blue'}`}
                  style={{ cursor: 'pointer', opacity: form.amenities.includes(amenity) ? 1 : 0.45 }}
                  onClick={() => toggleAmenity(amenity)}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>
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
              <input className="input" value={form.contact} onChange={(e) => setForm((c) => ({ ...c, contact: e.target.value }))} required />
            </label>
          </div>
          {previewUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={previewUrl} alt="Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveImage} style={{ color: 'var(--accent-rose)' }}>Remove photo</button>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Publish listing</button>
        </form>
      )}

      {listings.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px' }}>
          <Home size={36} />
          <h3>No to-let posts yet</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Post a seat or flat for students looking near AUST.</p>
        </div>
      ) : (
        <div className="tolet-grid">
          {listings.map((lst) => (
            <div key={lst.id} className={`mp-card ${!lst.available ? 'mp-card-occupied' : ''}`}>
              <div className="mp-card-image">
                {renderImage(lst.image)}
              </div>
              <div className="mp-card-body">
                <div className="mp-card-header">
                  <span className="mp-card-badge badge-purple">{lst.type} Space</span>
                  <span className="mp-card-date">{formatPostedDate(lst.postedAt)}</span>
                </div>
                <h3 className="mp-card-title">{lst.title}</h3>
                <p className="mp-card-location"><MapPin size={12} /> {lst.location}</p>
                <span className="mp-card-badge badge-blue" style={{ alignSelf: 'flex-start' }}>{lst.environment || 'Male'}</span>
                {lst.description && <p className="mp-card-description">{lst.description}</p>}
                {lst.utilities && <p className="mp-card-subtitle"><b>Utilities:</b> {lst.utilities}</p>}
                <div className="mp-card-amenities">
                  {lst.amenities.slice(0, 4).map((am) => (
                    <span key={am} className="mp-card-amenity">{am}</span>
                  ))}
                  {lst.amenities.length > 4 && (
                    <span className="mp-card-amenity">+{lst.amenities.length - 4}</span>
                  )}
                </div>
              </div>
              <div className="mp-card-footer">
                <div>
                  <div className="mp-card-rent-label">Monthly Rent</div>
                  <div className="mp-card-price">৳ {lst.rent}</div>
                </div>
                <div className="mp-card-actions">
                  {(user?.role === 'admin' || lst.contributorId === user?.id) && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(lst)} style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggleAvailable(lst)} style={{ fontSize: '9px', padding: '3px 6px' }}>
                    {lst.available ? 'Mark Full' : 'Reopen'}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!lst.available} onClick={() => handleContact(lst)} style={{ fontSize: '9px', padding: '3px 6px' }}>
                    {lst.available ? 'Contact' : 'Occupied'}
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
