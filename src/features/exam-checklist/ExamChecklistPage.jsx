import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck, CheckCircle2, Circle, Plus, Trash2, RotateCcw,
  Package, ArrowUpDown
} from 'lucide-react';
import './ExamChecklistPage.css';
import '../../components/PageHero.css';

const DEFAULT_ITEMS = [
  { id: 'admit', label: 'Admit Card / Hall Ticket', icon: '🎫' },
  { id: 'id-card', label: 'Student ID Card', icon: '🪪' },
  { id: 'pen-black', label: 'Black Ball Pen (x2)', icon: '🖊️' },
  { id: 'pen-blue', label: 'Blue Ball Pen (x2)', icon: '✒️' },
  { id: 'pencil', label: 'Pencil (HB / 2B)', icon: '✏️' },
  { id: 'eraser', label: 'Eraser', icon: '🧹' },
  { id: 'sharpener', label: 'Sharpener', icon: '🔧' },
  { id: 'ruler', label: 'Ruler / Scale (15cm)', icon: '📏' },
  { id: 'calculator', label: 'Scientific Calculator', icon: '🔢' },
  { id: 'watch', label: 'Analog Watch', icon: '⌚' },
  { id: 'water', label: 'Water Bottle (transparent)', icon: '💧' },
  { id: 'clipboard', label: 'Clipboard / Writing Pad', icon: '📋' },
  { id: 'geometry', label: 'Geometry Box', icon: '📐' },
  { id: 'tissues', label: 'Tissues / Handkerchief', icon: '🧻' },
];

const STORAGE_KEY = 'exam-checklist-state';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { checked: [], customItems: [] };
    return JSON.parse(raw);
  } catch {
    return { checked: [], customItems: [] };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

export default function ExamChecklistPage() {
  const [state, setState] = useState(loadState);
  const [newItemText, setNewItemText] = useState('');
  const [sortBy, setSortBy] = useState('default'); // default | checked-last
  const inputRef = useRef(null);

  /* Persist whenever state changes */
  useEffect(() => {
    saveState(state);
  }, [state]);

  const allItems = [
    ...DEFAULT_ITEMS.map((d) => ({ ...d, isCustom: false })),
    ...(state.customItems || []).map((c, i) => ({ id: `custom-${i}`, label: c, icon: '📦', isCustom: true })),
  ];

  /* Sort */
  let displayItems = [...allItems];
  if (sortBy === 'checked-last') {
    displayItems.sort((a, b) => {
      const aChecked = (state.checked || []).includes(a.id);
      const bChecked = (state.checked || []).includes(b.id);
      if (aChecked && !bChecked) return 1;
      if (!aChecked && bChecked) return -1;
      return 0;
    });
  }

  const checked = state.checked || [];
  const totalItems = displayItems.length;
  const checkedCount = displayItems.filter((item) => checked.includes(item.id)).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  /* Toggle item */
  const toggleItem = useCallback((id) => {
    setState((prev) => {
      const c = prev.checked || [];
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      return { ...prev, checked: next };
    });
  }, []);

  /* Add custom item */
  const addCustomItem = useCallback(() => {
    const text = newItemText.trim();
    if (!text) return;
    setState((prev) => ({
      ...prev,
      customItems: [...(prev.customItems || []), text],
    }));
    setNewItemText('');
    inputRef.current?.focus();
  }, [newItemText]);

  /* Remove custom item */
  const removeCustomItem = useCallback((index) => {
    setState((prev) => {
      const customId = `custom-${index}`;
      const nextCustom = (prev.customItems || []).filter((_, i) => i !== index);
      const nextChecked = (prev.checked || []).filter((id) => id !== customId);
      return { ...prev, customItems: nextCustom, checked: nextChecked };
    });
  }, []);

  /* Reset all */
  const resetAll = useCallback(() => {
    setState({ checked: [], customItems: [] });
  }, []);

  /* Keyboard */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      addCustomItem();
    }
  }, [addCustomItem]);

  return (
    <div className="exam-checklist-page animate-fadeIn">
      {/* ── Hero ── */}
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Exam Checklist</span>
              </h1>
              <p className="page-hero-subtitle">
                Never forget a single item on exam day — tick off everything you need.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Progress Card ── */}
      <div className="ec-progress-card">
        <div className="ec-progress-top">
          <div className="ec-progress-left">
            <div className="ec-progress-icon-wrap" style={{ background: 'var(--accent-emerald-glow)', color: 'var(--accent-emerald)' }}>
              <Package size={18} />
            </div>
            <div>
              <span className="ec-progress-label">Packing Progress</span>
              <span className="ec-progress-count">
                <strong>{checkedCount}</strong> of {totalItems} items ready
              </span>
            </div>
          </div>
          <div className="ec-progress-right">
            <span className="ec-progress-pct">{Math.round(progress)}%</span>
            <button className="ec-sort-btn" onClick={() => setSortBy(s => s === 'default' ? 'checked-last' : 'default')} title="Toggle sort">
              <ArrowUpDown size={13} />
              {sortBy === 'checked-last' ? 'Unchecked first' : 'Default order'}
            </button>
          </div>
        </div>
        <div className="ec-progress-bar">
          <div
            className="ec-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Checklist Grid ── */}
      <div className="ec-checklist-grid">
        {displayItems.map((item) => {
          const isChecked = checked.includes(item.id);
          return (
            <button
              key={item.id}
              className={`ec-item ${isChecked ? 'ec-item-checked' : ''}`}
              onClick={() => toggleItem(item.id)}
            >
              <span className="ec-item-emoji">{item.icon}</span>
              <span className="ec-item-label">{item.label}</span>
              <span className="ec-item-check">
                {isChecked ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Circle size={20} />
                )}
              </span>
              {item.isCustom && (
                <button
                  className="ec-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = parseInt(item.id.replace('custom-', ''));
                    removeCustomItem(idx);
                  }}
                  title="Remove item"
                >
                  <Trash2 size={13} />
                </button>
              )}
              {isChecked && <span className="ec-item-strike" />}
            </button>
          );
        })}
      </div>

      {/* ── Add custom item ── */}
      <div className="ec-add-card">
        <div className="ec-add-row">
          <input
            ref={inputRef}
            type="text"
            className="ec-add-input"
            placeholder="Add custom item (e.g., Graph Paper, Protractor)..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={60}
          />
          <button className="ec-add-btn" onClick={addCustomItem} disabled={!newItemText.trim()}>
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>
        {totalItems > checkedCount && checkedCount > 0 && (
          <p className="ec-add-hint">
            {totalItems - checkedCount} item{totalItems - checkedCount !== 1 ? 's' : ''} left to pack
          </p>
        )}
      </div>

      {/* ── Reset ── */}
      <div className="ec-reset-row">
        <button className="ec-reset-btn" onClick={resetAll}>
          <RotateCcw size={13} />
          Reset Checklist
        </button>
      </div>

      {/* ── Empty / All Done ── */}
      {checkedCount === totalItems && totalItems > 0 && (
        <div className="ec-done-banner">
          <CheckCircle2 size={20} />
          <span>All set! You&apos;re fully packed for the exam. Good luck! 🎉</span>
        </div>
      )}
    </div>
  );
}
