import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ImageUp, LoaderCircle, Plus, RotateCcw, Save, Shuffle, Trash2 } from 'lucide-react';
import { DEFAULT_TESTIMONIALS, setTestimonials } from '../../hooks/useTestimonials';
import './TestimonialsPanel.css';

const ROWS = [
  { id: 'top', label: 'Top row', hint: 'Scrolls right to left' },
  { id: 'bottom', label: 'Bottom row', hint: 'Scrolls left to right' },
];
const QUOTE_MAX = 400;
const MAX_CARDS = 40;

const generatedAvatar = (seed) => `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed || 'AUSTWise')}`;

/** Square-crop and shrink an uploaded photo to a small JPEG data URL. */
function photoToDataUrl(file, size = 160) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Choose an image file.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const clone = (v) => ({ top: v.top.map((t) => ({ ...t })), bottom: v.bottom.map((t) => ({ ...t })) });

function CardEditor({ card, onChange }) {
  const fileRef = useRef(null);
  const [photoError, setPhotoError] = useState('');
  const set = (patch) => onChange({ ...card, ...patch });
  const isUpload = card.avatar?.startsWith('data:');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try { set({ avatar: await photoToDataUrl(file) }); } catch (err) { setPhotoError(err.message); }
  };

  return (
    <div className="tp-editor">
      <div className="tp-photo">
        {card.avatar
          ? <img src={card.avatar} alt="" className="tp-photo-img" />
          : <span className="tp-photo-img tp-initial">{card.name?.[0] || '?'}</span>}
        <div className="tp-photo-actions">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><ImageUp size={14} /> Upload photo</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ avatar: generatedAvatar(`${card.name}${Date.now() % 1000}`) })}><Shuffle size={14} /> Cartoon avatar</button>
          {card.avatar && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ avatar: '' })}>Remove</button>}
        </div>
      </div>
      {photoError && <p className="tp-notice is-error" role="alert">{photoError}</p>}
      <label className="tp-field">
        <span>Photo link</span>
        <input
          className="input"
          value={isUpload ? '' : card.avatar || ''}
          placeholder={isUpload ? 'Uploaded photo in use' : 'https://…'}
          onChange={(e) => set({ avatar: e.target.value.trim() })}
        />
      </label>
      <div className="tp-field-row">
        <label className="tp-field">
          <span>Name</span>
          <input className="input" value={card.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="tp-field">
          <span>Department and batch</span>
          <input className="input" value={card.role} maxLength={60} placeholder="CSE, Batch 49" onChange={(e) => set({ role: e.target.value })} />
        </label>
      </div>
      <label className="tp-field">
        <span>Text <small>{card.quote.length}/{QUOTE_MAX}</small></span>
        <textarea className="input" rows={3} value={card.quote} maxLength={QUOTE_MAX} onChange={(e) => set({ quote: e.target.value })} />
      </label>
    </div>
  );
}

export default function TestimonialsPanel() {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [row, setRow] = useState('top');
  const [open, setOpen] = useState(-1);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetch('/api/testimonials', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const value = data?.success && data.value ? data.value : DEFAULT_TESTIMONIALS;
        setSaved(value);
        setDraft(clone(value));
      })
      .catch(() => { setSaved(DEFAULT_TESTIMONIALS); setDraft(clone(DEFAULT_TESTIMONIALS)); });
  }, []);

  const dirty = useMemo(() => draft && saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const invalid = draft && [...draft.top, ...draft.bottom].some((t) => !t.name.trim() || !t.quote.trim());

  if (!draft) {
    return <section className="glass-card-static tp-panel"><p className="tp-muted"><LoaderCircle size={16} className="animate-spin" /> Loading testimonials…</p></section>;
  }

  const list = draft[row];
  const updateRow = (next) => setDraft((d) => ({ ...d, [row]: next }));
  const updateCard = (i, card) => updateRow(list.map((t, j) => (j === i ? card : t)));
  const removeCard = (i) => {
    if (list.length <= 1) return;
    updateRow(list.filter((_, j) => j !== i));
    setOpen(-1);
  };
  const addCard = () => {
    if (list.length >= MAX_CARDS) return;
    updateRow([...list, { quote: '', name: '', role: '', avatar: '', rating: 5 }]);
    setOpen(list.length);
  };
  const switchRow = (id) => { setRow(id); setOpen(-1); };

  const save = async () => {
    setBusy('save');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/testimonials', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save the cards.');
      setSaved(data.value);
      setDraft(clone(data.value));
      setTestimonials(data.value);
      setNotice({ type: 'success', text: 'Saved. Landing and See Plans now show these cards.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally { setBusy(''); }
  };

  const reset = async () => {
    if (!window.confirm('Put back the original cards? Your edits will be lost.')) return;
    setBusy('reset');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/testimonials', { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not reset the cards.');
      setSaved(DEFAULT_TESTIMONIALS);
      setDraft(clone(DEFAULT_TESTIMONIALS));
      setTestimonials(null);
      setOpen(-1);
      setNotice({ type: 'success', text: 'Original cards restored on both pages.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally { setBusy(''); }
  };

  return (
    <section className="glass-card-static tp-panel">
      <header className="tp-head">
        <div>
          <h2>Testimonials</h2>
          <p>Review cards on the Landing and See Plans pages. One save updates both.</p>
        </div>
        <div className="tp-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={reset}>
            {busy === 'reset' ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reset
          </button>
          {dirty && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => { setDraft(clone(saved)); setOpen(-1); }}>Discard</button>}
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || invalid || !!busy} onClick={save}>
            {busy === 'save' ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save changes
          </button>
        </div>
      </header>

      {notice && <p className={`tp-notice is-${notice.type}`} role="status">{notice.text}</p>}
      {invalid && <p className="tp-notice is-error">Every card needs a name and text before you can save.</p>}

      <div className="tp-tabs" role="tablist">
        {ROWS.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={row === r.id} className={row === r.id ? 'is-on' : ''} onClick={() => switchRow(r.id)}>
            <span>{r.label}</span>
            <small>{draft[r.id].length} cards · {r.hint}</small>
          </button>
        ))}
      </div>

      <ol className="tp-list">
        {list.map((t, i) => {
          const isOpen = open === i;
          return (
            <li key={i} className={`tp-item ${isOpen ? 'is-open' : ''}`}>
              <div className="tp-row">
                <button type="button" className="tp-row-main" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span className="tp-num">{i + 1}</span>
                  {t.avatar ? <img src={t.avatar} alt="" className="tp-avatar" loading="lazy" /> : <span className="tp-avatar tp-initial">{t.name?.[0] || '?'}</span>}
                  <span className="tp-row-text">
                    <strong>{t.name || 'Untitled card'}{t.role && <small> · {t.role}</small>}</strong>
                    <span>{t.quote || 'No text yet'}</span>
                  </span>
                  <ChevronDown size={16} className="tp-chevron" />
                </button>
                <button type="button" className="btn-icon tp-delete" aria-label={`Delete ${t.name || 'card'}`} disabled={list.length <= 1} onClick={() => removeCard(i)}>
                  <Trash2 size={15} />
                </button>
              </div>
              {isOpen && <CardEditor card={t} onChange={(card) => updateCard(i, card)} />}
            </li>
          );
        })}
      </ol>

      <button type="button" className="btn btn-secondary btn-sm tp-add" disabled={list.length >= MAX_CARDS} onClick={addCard}>
        <Plus size={14} /> Add card
      </button>
    </section>
  );
}
