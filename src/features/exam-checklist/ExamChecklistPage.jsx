import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck, CheckCircle2, Circle, Plus, Trash2, RotateCcw,
  MoreVertical, Check
} from 'lucide-react';
import './ExamChecklistPage.css';

const DEFAULT_ITEMS = [
  { id: 'calculator', label: 'Scientific Calculator', icon: '🔢' },
  { id: 'id-card', label: 'Student ID Card', icon: '🪪' },
  { id: 'pen-black', label: 'Black Ball Pen (x2)', icon: '🖊️' },
  { id: 'ruler', label: 'Ruler / Scale (15cm)', icon: '📏' },
  { id: 'pencil', label: 'Pencil (HB / 2B)', icon: '✏️' },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  /* Persist whenever state changes */
  useEffect(() => {
    saveState(state);
  }, [state]);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

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
    setMenuOpen(false);
  }, []);

  /* Toggle sort from menu */
  const toggleSort = useCallback(() => {
    setSortBy((s) => (s === 'default' ? 'checked-last' : 'default'));
    setMenuOpen(false);
  }, []);

  /* Keyboard */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      addCustomItem();
    }
  }, [addCustomItem]);

  return (
    <div className="glass-card-static schedule-widget ec-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        {/* Left: title block */}
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <ClipboardCheck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <div className="schedule-title">Exam Checklist</div>
            <span className="schedule-subtitle">{checkedCount}/{totalItems} items ready</span>
          </div>
        </div>

        {/* Center: stats */}
        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{checkedCount}</span>
              <span className="schedule-stat-label">Packed</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{totalItems - checkedCount}</span>
              <span className="schedule-stat-label">Remaining</span>
            </div>
          </div>
        </div>

        {/* Right: actions — 3-dot menu */}
        <div className="schedule-actions">
          <div className="export-dropdown" ref={menuRef}>
            <button
              className="schedule-nav-btn"
              onClick={() => setMenuOpen((o) => !o)}
              title="Options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="export-menu" role="menu">
                {/* Sort toggle */}
                <button
                  className={`export-menu-item${sortBy === 'checked-last' ? ' menu-active' : ''}`}
                  onClick={toggleSort}
                  role="menuitem"
                >
                  <Check size={14} className="menu-check" />
                  {sortBy === 'checked-last' ? 'Unchecked first' : 'Default order'}
                </button>
                <div className="export-menu-sep" />
                {/* Reset */}
                <button
                  className="export-menu-item"
                  onClick={resetAll}
                  role="menuitem"
                >
                  <RotateCcw size={14} />
                  Reset Checklist
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dotted divider ── */}
      <div className="schedule-dotted-divider" />

      {/* ── Slim progress bar ── */}
      <div className="ec-progress-slim">
        <div
          className="ec-progress-slim-fill"
          style={{ width: `${progress}%` }}
        />
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

      {/* ── All Done Banner ── */}
      {checkedCount === totalItems && totalItems > 0 && (
        <div className="ec-done-banner">
          <CheckCircle2 size={20} />
          <span>All set! You&apos;re fully packed for the exam. Good luck! 🎉</span>
        </div>
      )}

    </div>
  );
}
