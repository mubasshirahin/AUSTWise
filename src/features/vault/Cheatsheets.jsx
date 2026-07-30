import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Copy, Check, BookOpen, Star, Plus, X, Trash2,
  Monitor, Zap, Building2, Cog, Factory, Scissors,
  Building, BarChart3, Calculator, Atom, FlaskConical,
  Search, Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getCheatsheets,
  addCheatsheet,
  deleteCheatsheet,
  getFavoriteIds,
  toggleFavorite,
  fetchFromAPI as fetchCheatsheetsFromAPI,
} from '../../utils/cheatsheetStorage';

const categoryColors = {
  'Programming': '#a855f7',
  'Data Structures': '#3b82f6',
  'Object-Oriented': '#f59e0b',
  'Algorithms': '#10b981',
  'Operating Systems': '#ef4444',
  'Database': '#06b6d4',
  'Networks': '#f97316',
  'Software Engineering': '#8b5cf6',
  'AI': '#ec4899',
  'Machine Learning': '#14b8a6',
  'Mathematics': '#6366f1',
  'Physics': '#5c6bc0',
  'Chemistry': '#26a69a',
  'English': '#ef5350',
  'Humanities': '#ab47bc',
};

const deptMeta = {
  CSE:  { label: 'CSE',  full: 'Computer Science & Engineering',      color: '#a855f7', Icon: Monitor },
  EEE:  { label: 'EEE',  full: 'Electrical & Electronic Engineering',  color: '#ff5722', Icon: Zap },
  CE:   { label: 'CE',   full: 'Civil Engineering',                    color: '#3f51b5', Icon: Building2 },
  ME:   { label: 'ME',   full: 'Mechanical Engineering',               color: '#f44336', Icon: Cog },
  IPE:  { label: 'IPE',  full: 'Industrial & Production Engineering',  color: '#9c27b0', Icon: Factory },
  TE:   { label: 'TE',   full: 'Textile Engineering',                  color: '#ff4081', Icon: Scissors },
  ARCH: { label: 'ARCH', full: 'Architecture',                         color: '#ff9800', Icon: Building },
  BBA:  { label: 'BBA',  full: 'Business Administration',              color: '#4db6ac', Icon: BarChart3 },
  MATH: { label: 'MATH', full: 'Mathematics',                          color: '#6366f1', Icon: Calculator },
  PHY:  { label: 'PHY',  full: 'Physics',                              color: '#5c6bc0', Icon: Atom },
  CHEM: { label: 'CHEM', full: 'Chemistry',                            color: '#26a69a', Icon: FlaskConical },
};

const emptyForm = { title: '', category: '', course: '', formulas: '' };

/* ─── Shared premium inline style factories ─── */
const premiumCard = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
};

const premiumInput = {
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  outline: 'none',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

const pillBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '11px',
  fontWeight: 600,
  padding: '5px 13px',
  borderRadius: 'var(--radius-full)',
  cursor: 'pointer',
  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  border: '1.5px solid transparent',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-secondary)',
};

export default function Cheatsheets({ vaultContext }) {
  const { course, courseName } = vaultContext;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
  const canAdd = true;

  const [sheets, setSheets] = useState(() => getCheatsheets());
  const [favorites, setFavorites] = useState(() => getFavoriteIds(user?.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDept, setActiveDept] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const handleToggleFavorite = useCallback((sheetId) => {
    setFavorites(new Set(toggleFavorite(user?.id, sheetId)));
  }, [user?.id]);

  useEffect(() => {
    setFavorites(getFavoriteIds(user?.id));
  }, [user?.id]);

  // Fetch cheatsheets from API on mount
  useEffect(() => {
    fetchCheatsheetsFromAPI().then(() => {
      setSheets(getCheatsheets());
    });
  }, []);

  const handleDelete = useCallback((sheetId) => {
    deleteCheatsheet(sheetId);
    setSheets(getCheatsheets());
  }, []);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const formulas = form.formulas.split('\n').map((f) => f.trim()).filter(Boolean);
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (formulas.length === 0) { setFormError('Add at least one formula / line.'); return; }
    addCheatsheet({
      title: form.title,
      category: form.category || 'General',
      course: form.course,
      formulas,
      contributorId: user?.id,
    });
    setSheets(getCheatsheets());
    setForm(emptyForm);
    setFormError('');
    setShowAddForm(false);
  };

  const filteredByDept = useMemo(() => {
    return activeDept === 'All'
      ? sheets
      : sheets.filter((cs) => cs.course?.startsWith(activeDept));
  }, [sheets, activeDept]);

  const availableCategories = useMemo(() => {
    const cats = [...new Set(filteredByDept.map((cs) => cs.category).filter(Boolean))];
    return ['All', ...cats.sort()];
  }, [filteredByDept]);

  const filteredCheatsheets = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return filteredByDept
      .filter((cs) => !course || !cs.course || cs.course === course)
      .filter((cs) => !showFavsOnly || favorites.has(cs.id))
      .filter((cs) => activeCategory === 'All' || cs.category === activeCategory)
      .filter((cs) =>
        !q ||
        cs.title.toLowerCase().includes(q) ||
        (cs.category || '').toLowerCase().includes(q) ||
        (cs.course && cs.course.toLowerCase().includes(q)) ||
        cs.formulas.some((f) => f.toLowerCase().includes(q))
      );
  }, [filteredByDept, course, activeCategory, searchTerm, showFavsOnly, favorites]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const favCount = favorites.size;

  return (
    <div className="cheatsheets-container animate-fadeIn" style={premiumCard}>
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-4" style={{ padding: 'var(--sp-5) var(--sp-5) 0' }}>
        <div>
          <h2 style={{
            fontSize: 'var(--fs-xl)',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 2px',
            color: 'var(--text-primary)',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, var(--accent-amber) 0%, var(--accent-cyan) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Cheatsheets
            </span>
          </h2>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: 0 }}>
            {courseName} &mdash; quick formula sheets and references
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFavsOnly((p) => !p)}
            style={{
              ...pillBase,
              border: showFavsOnly ? '1.5px solid var(--accent-amber)' : '1.5px solid rgba(255,255,255,0.07)',
              background: showFavsOnly ? 'color-mix(in srgb, var(--accent-amber) 12%, transparent)' : 'rgba(255,255,255,0.04)',
              color: showFavsOnly ? 'var(--accent-amber)' : 'var(--text-secondary)',
              boxShadow: showFavsOnly ? '0 0 10px color-mix(in srgb, var(--accent-amber) 18%, transparent)' : 'none',
            }}
            title={showFavsOnly ? 'Show all cheatsheets' : 'Show favorites only'}
          >
            <Star size={13} fill={showFavsOnly ? 'currentColor' : 'none'} />
            Favorites{favCount > 0 ? ` (${favCount})` : ''}
          </button>

          {canAdd && (
            <button
              onClick={() => { setShowAddForm((p) => !p); setFormError(''); }}
              style={{
                ...pillBase,
                border: '1.5px solid color-mix(in srgb, var(--accent-amber) 40%, transparent)',
                background: showAddForm
                  ? 'color-mix(in srgb, var(--accent-amber) 80%, transparent)'
                  : 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
                color: showAddForm ? '#0a0a0a' : 'var(--accent-amber)',
                fontWeight: 700,
              }}
            >
              {showAddForm ? <X size={13} /> : <Plus size={13} />}
              {showAddForm ? 'Cancel' : 'Add Cheatsheet'}
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            width: '220px',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}>
            <Search size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search cheatsheets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Add form ── */}
      {canAdd && showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          style={{
            margin: '0 var(--sp-5) var(--sp-5)',
            background: 'rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--sp-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Title * (e.g. C Programming Basics)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ flex: 2, minWidth: '180px', ...premiumInput }}
            />
            <input
              type="text"
              placeholder="Category (e.g. Programming)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={{ flex: 1, minWidth: '140px', ...premiumInput }}
            />
            <input
              type="text"
              placeholder="Course code (e.g. CSE1101)"
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              style={{ flex: 1, minWidth: '140px', ...premiumInput }}
            />
          </div>
          <textarea
            placeholder={'Formulas / lines — one per line *\ne.g.\nprintf("format", args);\nfor (int i = 0; i < n; i++) { }'}
            value={form.formulas}
            onChange={(e) => setForm({ ...form, formulas: e.target.value })}
            rows={5}
            style={{
              ...premiumInput,
              fontFamily: "'Cascadia Code', 'Fira Code', monospace",
              resize: 'vertical',
              padding: '10px 12px',
            }}
          />
          {formError && (
            <p style={{ color: 'var(--accent-rose)', fontSize: '11px', margin: 0 }}>{formError}</p>
          )}
          <div>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--accent-amber)',
                color: '#0a0a0a',
                cursor: 'pointer',
                transition: 'filter 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              <Plus size={13} /> Publish Cheatsheet
            </button>
          </div>
        </form>
      )}

      {/* ── Department filter — Glowing step-tracker pills ── */}
      <div style={{ padding: '0 var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
        <p style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          <Filter size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Department
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-wrap">
          <button
            onClick={() => { setActiveDept('All'); setActiveCategory('All'); }}
            style={{
              ...pillBase,
              background: activeDept === 'All'
                ? 'color-mix(in srgb, var(--accent-amber) 10%, transparent)'
                : 'rgba(255,255,255,0.03)',
              border: activeDept === 'All'
                ? '1.5px solid color-mix(in srgb, var(--accent-amber) 40%, transparent)'
                : '1.5px solid rgba(255,255,255,0.05)',
              color: activeDept === 'All' ? 'var(--accent-amber)' : 'var(--text-secondary)',
              fontWeight: activeDept === 'All' ? 700 : 500,
              boxShadow: activeDept === 'All'
                ? '0 0 12px color-mix(in srgb, var(--accent-amber) 18%, transparent)'
                : 'none',
            }}
          >
            All Departments
          </button>
          {Object.keys(deptMeta).map((dk) => {
            const m = deptMeta[dk];
            const active = activeDept === dk;
            const DeptIcon = m.Icon;
            return (
              <button
                key={dk}
                onClick={() => { setActiveDept(dk); setActiveCategory('All'); }}
                style={{
                  ...pillBase,
                  background: active ? m.color + '16' : 'rgba(255,255,255,0.03)',
                  border: active ? `1.5px solid ${m.color}55` : '1.5px solid rgba(255,255,255,0.05)',
                  color: active ? m.color : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 500,
                  boxShadow: active ? `0 0 12px ${m.color}22` : 'none',
                }}
              >
                <DeptIcon size={11} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Category filter chips ── */}
      {filteredByDept.length > 0 && availableCategories.length > 1 && (
        <div style={{ padding: '0 var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
          <p style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            Topic
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-wrap">
            {availableCategories.map((cat) => {
              const catColor = categoryColors[cat] || 'var(--accent-amber)';
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    ...pillBase,
                    textTransform: 'capitalize',
                    background: active ? catColor + '16' : 'rgba(255,255,255,0.03)',
                    border: active ? `1.5px solid ${catColor}55` : '1.5px solid rgba(255,255,255,0.05)',
                    color: active ? catColor : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    boxShadow: active ? `0 0 10px ${catColor}18` : 'none',
                  }}
                >
                  {cat === 'All' ? 'All Topics' : cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      <div style={{ padding: '0 var(--sp-5) var(--sp-5)' }}>
        {filteredCheatsheets.length === 0 ? (
          <div style={{
            padding: '56px 16px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.015)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed rgba(255,255,255,0.06)',
          }}>
            {showFavsOnly ? (
              <>
                <Star size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0, fontWeight: 500 }}>
                  No favorites yet &mdash; tap the ★ on any cheatsheet to save it here.
                </p>
              </>
            ) : (
              <>
                <BookOpen size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0, fontWeight: 500 }}>
                  {searchTerm
                    ? 'No cheatsheets match your search.'
                    : 'No cheatsheets yet &mdash; use "Add Cheatsheet" to publish the first one!'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid-2">
            {filteredCheatsheets.map((cs) => {
              const catColor = categoryColors[cs.category] || 'var(--accent-amber)';
              const dept = cs.course && deptMeta[cs.course];
              const isFav = favorites.has(cs.id);
              const DeptIcon = dept?.Icon;
              return (
                <div
                  key={cs.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'border-color 0.24s ease, box-shadow 0.24s ease, transform 0.24s cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-amber) 22%, var(--border-primary))';
                    e.currentTarget.style.boxShadow = '0 8px 28px -6px color-mix(in srgb, var(--accent-amber) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.03)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.14)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* Card header */}
                  <div style={{
                    padding: '15px 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}>
                        {cs.title}
                      </h3>
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--text-tertiary)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                      }}>
                        {DeptIcon && <DeptIcon size={10} />}
                        {dept ? dept.full : (cs.course || '')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {cs.category && (
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          background: catColor + '18',
                          color: catColor,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          border: `1px solid ${catColor}25`,
                        }}>
                          {cs.category}
                        </span>
                      )}
                      <button
                        onClick={() => handleToggleFavorite(cs.id)}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          color: isFav ? 'var(--accent-amber)' : 'var(--text-tertiary)',
                          transition: 'color 0.15s ease, transform 0.15s ease',
                          transform: isFav ? 'scale(1.1)' : 'scale(1)',
                          filter: isFav ? 'drop-shadow(0 0 4px color-mix(in srgb, var(--accent-amber) 30%, transparent))' : 'none',
                        }}
                      >
                        <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                      {cs.createdAt && (isAdmin || cs.contributorId === user?.id) && (
                        <button
                          onClick={() => handleDelete(cs.id)}
                          title="Delete cheatsheet"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--text-tertiary)',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-rose)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formula list */}
                  <div style={{
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'rgba(0,0,0,0.1)',
                  }}>
                    {cs.formulas.map((formula, idx) => {
                      const uid = `${cs.id}-${idx}`;
                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'border-color 0.2s ease, background 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          }}
                        >
                          <code style={{
                            fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                            fontSize: '11px',
                            color: 'var(--accent-cyan)',
                            wordBreak: 'break-all',
                            lineHeight: '1.5',
                            flex: 1,
                          }}>
                            {formula}
                          </code>
                          <button
                            onClick={() => handleCopy(formula, uid)}
                            style={{
                              padding: '5px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                              color: copiedId === uid ? 'var(--accent-emerald)' : 'var(--text-tertiary)',
                              transition: 'all 0.15s ease',
                              background: copiedId === uid ? 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Copy"
                          >
                            {copiedId === uid ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
