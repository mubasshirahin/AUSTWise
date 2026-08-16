import { useState } from 'react';
import { GripVertical, ChevronDown, Eye, EyeOff, Plus, X, RotateCcw } from 'lucide-react';
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

function FieldEditor({ type, fieldKey, value, onChange }) {
  const kind = getFieldKind(type, fieldKey);
  if (kind === 'number') {
    return <input type="number" className="orb-input" value={value} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (kind === 'list') return <TagInput value={value} onChange={onChange} />;
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