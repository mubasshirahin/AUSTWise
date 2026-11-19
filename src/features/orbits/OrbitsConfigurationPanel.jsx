import { useState, useEffect, useRef } from 'react';
import { GripVertical, ChevronDown, Eye, EyeOff, Plus, X, RotateCcw, Search, Loader2 } from 'lucide-react';
import { mediaSourceFor, mediaItem } from './mediaSearch';
import { useOrbits, getFieldKind, getListItemTemplate, humanizeKey } from './OrbitsContext';
import './Orbits.css';

function TagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="orb-tag-input">
      <div className="orb-tags">
        {value.map((tag, i) => (
          <span key={`${tag}-${i}`} className="orb-tag">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${tag}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="orb-tag-add">
        <input
          className="orb-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder || 'Add item…'}
        />
        <button type="button" className="orb-btn orb-btn-ghost" onClick={add} aria-label="Add">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/* Search a public API as you type; picking a result stores
   { title, image, sub } so the station card can show its picture.
   Enter still adds whatever was typed as plain text. */
function MediaTagInput({ value, onChange, source }) {
  const [draft, setDraft] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    const term = draft.trim();
    if (term.length < 2) { setResults([]); setLoading(false); setFailed(false); return undefined; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await source.search(term, ctrl.signal);
        setResults(r.filter((x) => x.title));
        setFailed(false);
        setHi(0);
      } catch (err) {
        if (err.name !== 'AbortError') { setResults([]); setFailed(true); }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [draft, source]);

  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [open]);

  const pick = (item) => {
    onChange([...value, item]);
    setDraft('');
    setResults([]);
    setOpen(false);
  };
  const addTyped = () => {
    const v = draft.trim();
    if (v) pick(v);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setOpen(true); setHi((h) => (h + 1) % results.length); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setHi((h) => (h - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && results[hi]) pick(results[hi]); else addTyped(); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const showList = open && draft.trim().length >= 2;

  return (
    <div className="orb-tag-input orb-media-input" ref={boxRef}>
      <div className="orb-tags">
        {value.map((raw, i) => {
          const it = mediaItem(raw);
          return (
            <span key={`${it.title}-${i}`} className={`orb-tag${it.image ? ' has-thumb' : ''}`}>
              {it.image && <img className={`orb-tag-thumb is-${source.shape}`} src={it.image} alt="" loading="lazy" />}
              {it.title}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${it.title}`}>
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>
      <div className="orb-tag-add orb-media-add">
        <span className="orb-media-icon" aria-hidden="true">{loading ? <Loader2 size={14} className="orb-spin" /> : <Search size={14} />}</span>
        <input
          className="orb-input"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={`Search ${source.label}…`}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
        />
        <button type="button" className="orb-btn orb-btn-ghost" onClick={addTyped} aria-label="Add as text">
          <Plus size={14} />
        </button>
        {showList && (
          <ul className="orb-media-results" role="listbox">
            {results.map((r, i) => (
              <li key={`${r.title}-${i}`} role="option" aria-selected={i === hi}>
                <button
                  type="button"
                  className={`orb-media-opt${i === hi ? ' is-hi' : ''}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(r)}
                >
                  <span className={`orb-media-thumb is-${source.shape}`}>
                    {r.image ? <img src={r.image} alt="" loading="lazy" /> : r.title.charAt(0)}
                  </span>
                  <span className="orb-media-txt">
                    <b>{r.title}</b>
                    {r.sub && <small>{r.sub}</small>}
                  </span>
                </button>
              </li>
            ))}
            {!loading && results.length === 0 && (
              <li className="orb-media-none">
                {failed ? `${source.label} didn't respond — press Enter to add as text.` : 'No matches — press Enter to add as text.'}
              </li>
            )}
            {loading && results.length === 0 && <li className="orb-media-none">Searching {source.label}…</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function ObjectListEditor({ items, template, onChange }) {
  const updateItem = (i, key, val) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: val } : it)));
  const addItem = () => onChange([...items, { ...template }]);
  const removeItem = (i) => onChange(items.filter((_, j) => j !== i));
  return (
    <div className="orb-obj-list">
      {items.map((item, i) => (
        <div className="orb-obj-item" key={i}>
          <div className="orb-obj-item-head">
            <span>Item {i + 1}</span>
            <button type="button" className="orb-btn orb-btn-ghost" onClick={() => removeItem(i)} aria-label="Remove item">
              <X size={12} />
            </button>
          </div>
          {Object.entries(item).map(([key, val]) => (
            <label className="orb-field orb-field--nested" key={key}>
              <span>{humanizeKey(key)}</span>
              <input
                className="orb-input"
                value={String(val ?? '')}
                onChange={(e) => updateItem(i, key, e.target.value)}
              />
            </label>
          ))}
        </div>
      ))}
      <button type="button" className="orb-btn orb-btn-ghost orb-obj-add" onClick={addItem}>
        <Plus size={14} /> Add item
      </button>
    </div>
  );
}

const PROFILE_FIELDS = new Set(['name', 'id', 'dept', 'batch', 'blood_group']);

function FieldEditor({ type, fieldKey, value, onChange }) {
  if (type === 'user_details' && PROFILE_FIELDS.has(fieldKey)) {
    return <input className="orb-input" value={value ?? ''} readOnly title="Synced from your profile" />;
  }
  const kind = getFieldKind(type, fieldKey);
  if (kind === 'number') {
    return <input type="number" className="orb-input" value={value} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (kind === 'list') {
    const source = mediaSourceFor(fieldKey);
    if (source) return <MediaTagInput value={value} onChange={onChange} source={source} />;
    return <TagInput value={value.map((v) => mediaItem(v).title)} onChange={onChange} />;
  }
  if (kind === 'objectList') {
    return <ObjectListEditor items={value} template={getListItemTemplate(type, fieldKey)} onChange={onChange} />;
  }
  return <input className="orb-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

export default function OrbitsConfigurationPanel() {
  const { checkpoints, updateCheckpointOrder, toggleVisibility, updateCheckpointFields, resetCheckpoints } = useOrbits();
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const visibleCount = checkpoints.filter((c) => c.isVisible).length;

  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const from = checkpoints.findIndex((c) => c.id === dragId);
    const to = checkpoints.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const reordered = [...checkpoints];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reordered.forEach((c, i) => updateCheckpointOrder(c.id, i + 1));
    setDragId(null);
    setOverId(null);
  };

  return (
    <section className="orb-panel">
      <div className="orb-panel-head">
        <div>
          <h3 className="orb-panel-title">Checkpoint Control</h3>
          <p className="orb-panel-sub">
            Reorder by dragging, toggle visibility, and edit every field. Changes auto-save.
          </p>
        </div>
        <div className="orb-panel-actions">
          <span className="orb-count-badge">{visibleCount} / {checkpoints.length} on route</span>
          <button type="button" className="orb-btn orb-btn-ghost" onClick={resetCheckpoints} title="Restore defaults">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="orb-cp-list">
        {checkpoints.map((cp) => {
          const open = openId === cp.id;
          return (
            <div
              key={cp.id}
              className={`orb-cp-row${dragId === cp.id ? ' orb-dragging' : ''}${overId === cp.id ? ' orb-over' : ''}`}
              draggable
              onDragStart={() => setDragId(cp.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(cp.id); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(cp.id); }}
            >
              <span className="orb-grip"><GripVertical size={16} /></span>
              <span className={`orb-order${cp.isVisible ? '' : ' orb-order--off'}`}>{String(cp.order).padStart(2, '0')}</span>
              <button type="button" className="orb-cp-title" onClick={() => setOpenId(open ? null : cp.id)}>
                <span className="orb-cp-icon">{cp.label.charAt(0)}</span>
                {cp.label}
                <ChevronDown size={16} className={`orb-chevron${open ? ' orb-chevron--open' : ''}`} />
              </button>
              <span className="orb-cp-type">{cp.type}</span>
              <button
                type="button"
                className={`orb-vis${cp.isVisible ? '' : ' orb-vis--off'}`}
                onClick={() => toggleVisibility(cp.id)}
                aria-pressed={cp.isVisible}
                aria-label={`${cp.isVisible ? 'Hide' : 'Show'} ${cp.label}`}
              >
                {cp.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              {open && (
                <div className="orb-cp-fields">
                  {Object.entries(cp.fields).map(([key, val]) => (
                    <label className="orb-field" key={key}>
                      <span className="orb-field-label">{humanizeKey(key)}</span>
                      <FieldEditor
                        type={cp.type}
                        fieldKey={key}
                        value={val}
                        onChange={(next) => updateCheckpointFields(cp.id, { [key]: next })}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}