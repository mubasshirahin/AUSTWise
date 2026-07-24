import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Film, Tv, Gamepad2, Ghost, Plus, X, Star, Search,
  Edit3, Trash2, Save, ListVideo, ExternalLink,
  Key, Loader2, AlertCircle,
} from 'lucide-react';
import './MediaTracker.css';

/* ─── Constants ─── */

const CATEGORIES = [
  { id: 'movies', label: 'Movies',     icon: Film,     color: 'blue'    },
  { id: 'series', label: 'Web Series',  icon: Tv,       color: 'purple'  },
  { id: 'anime',  label: 'Anime',       icon: Ghost,    color: 'rose'    },
  { id: 'games',  label: 'Games',       icon: Gamepad2, color: 'emerald' },
];

const STATUSES = ['all', 'watching', 'planning', 'completed', 'on-hold', 'dropped'];
const STATUS_LABELS = {
  watching:  'Watching',
  planning:  'Plan to',
  completed: 'Completed',
  'on-hold': 'On Hold',
  dropped:   'Dropped',
};

const STORAGE_KEY   = 'media-tracker-data';
const API_KEYS_KEY  = 'media-tracker-api-keys';
const OMD_BASE      = 'https://www.omdbapi.com';
const RAWG_BASE     = 'https://api.rawg.io/api/games';

/* ─── Helpers ─── */

function singularLabel(catId) {
  const map = { movies: 'Movie', series: 'Series', anime: 'Anime', games: 'Game' };
  return map[catId] || catId;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { movies: [], series: [], anime: [], games: [] };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadApiKeys() {
  try {
    const raw = localStorage.getItem(API_KEYS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Default keys provided by user
  return { omdb: 'a6b92d31', rawg: '0a5ed22357d941438089378e466e3acf' };
}

function saveApiKeys(keys) {
  localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
}

/* ─── API Search ─── */

async function searchOMDb(query, apiKey) {
  if (!apiKey || !query.trim()) return [];
  const url = `${OMD_BASE}?apikey=${apiKey}&s=${encodeURIComponent(query)}&r=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.Response === 'True' && data.Search) {
      return data.Search.slice(0, 6).map((item) => ({
        id: item.imdbID,
        title: item.Title,
        year: item.Year,
        type: item.Type,
        poster: item.Poster !== 'N/A' ? item.Poster : null,
      }));
    }
    return [];
  } catch { return []; }
}

async function searchRAWG(query, apiKey) {
  if (!apiKey || !query.trim()) return [];
  const url = `${RAWG_BASE}?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=6`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results) {
      return data.results.map((item) => ({
        id: item.id,
        title: item.name,
        year: item.released ? item.released.split('-')[0] : '',
        poster: item.background_image,
        rating: item.rating ? Math.round(item.rating) : 0,
        genres: item.genres?.map((g) => g.name).join(', ') || '',
      }));
    }
    return [];
  } catch { return []; }
}

/* ─── Star Rating ─── */
function StarRating({ value, onChange }) {
  return (
    <div className="media-stars">
      {[1,2,3,4,5,6,7,8,9,10].map((s) => (
        <Star key={s} size={12}
          className={`media-star ${s <= value ? '' : 'empty'}`}
          onClick={() => onChange?.(s === value ? 0 : s)}
        />
      ))}
    </div>
  );
}

/* ─── Api Key Settings Panel ─── */
function ApiKeySettings({ apiKeys, onSave, onClose }) {
  const [omdb, setOmdb] = useState(apiKeys.omdb);
  const [rawg, setRawg] = useState(apiKeys.rawg);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ omdb: omdb.trim(), rawg: rawg.trim() });
    onClose();
  };

  return (
    <div className="media-form-overlay" onClick={onClose}>
      <div className="media-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="media-form-header">
          <div className="media-form-title">
            <Key size={18} />
            API Keys
          </div>
          <button type="button" className="media-form-close" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Free API keys auto-fill movie/series/game details when adding items.
          </p>

          <div className="media-field">
            <label className="media-label">
              OMDb API Key
              <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, opacity: 0.6 }}>(movies &amp; series)</span>
            </label>
            <input className="media-input" value={omdb}
              onChange={(e) => setOmdb(e.target.value)}
              placeholder="Paste your OMDb API key..."
            />
            <a href="http://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <ExternalLink size={10} /> Get free OMDb key →
            </a>
          </div>

          <div className="media-field">
            <label className="media-label">
              RAWG API Key
              <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, opacity: 0.6 }}>(games)</span>
            </label>
            <input className="media-input" value={rawg}
              onChange={(e) => setRawg(e.target.value)}
              placeholder="Paste your RAWG API key..."
            />
            <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <ExternalLink size={10} /> Get free RAWG key →
            </a>
          </div>

          <button type="submit" className="media-submit" data-cat="movies"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}>
            <Save size={14} /> Save Keys
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Add / Edit Form Modal with API Search ─── */
function MediaFormModal({ category, item, onSave, onClose, apiKeys }) {
  const [title, setTitle] = useState(item?.title || '');
  const [status, setStatus] = useState(item?.status || 'planning');
  const [rating, setRating] = useState(item?.rating || 0);
  const [progress, setProgress] = useState(item?.progress ?? 0);
  const [notes, setNotes] = useState(item?.notes || '');
  const [year, setYear] = useState(item?.year || '');
  const [posterUrl, setPosterUrl] = useState(item?.poster || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef(null);

  const catInfo = CATEGORIES.find((c) => c.id === category);
  const useApi = (category === 'movies' || category === 'series' || category === 'games') && !item;

  // Debounced API search
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    let results = [];
    if (category === 'games' && apiKeys.rawg) {
      results = await searchRAWG(q, apiKeys.rawg);
    } else if ((category === 'movies' || category === 'series') && apiKeys.omdb) {
      results = await searchOMDb(q, apiKeys.omdb);
    }
    setSearchResults(results);
    setShowResults(results.length > 0);
    setSearching(false);
  }, [category, apiKeys]);

  useEffect(() => {
    if (!useApi) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(title), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [title, useApi, doSearch]);

  const selectResult = (r) => {
    setTitle(r.title);
    setYear(r.year || '');
    setPosterUrl(r.poster || '');
    if (r.rating) setRating(r.rating);
    setShowResults(false);
    setSearchResults([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...(item || {}),
      id: item?.id || generateId(),
      title: title.trim(),
      year,
      poster: posterUrl,
      status,
      rating,
      progress: Math.min(100, Math.max(0, progress)),
      notes: notes.trim(),
      createdAt: item?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  };

  const needsKey = useApi && (
    (category === 'games' && !apiKeys.rawg) ||
    (category !== 'games' && !apiKeys.omdb)
  );

  return (
    <div className="media-form-overlay" onClick={onClose}>
      <div className="media-form" onClick={(e) => e.stopPropagation()}>
        <div className="media-form-header">
          <div className="media-form-title">
            <catInfo.icon size={20} />
            {item ? 'Edit' : 'Add'} {singularLabel(category)}
          </div>
          <button type="button" className="media-form-close" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* API Search */}
          {useApi && (
            <div className={`media-api-search ${showResults && searchResults.length > 0 ? 'has-results-open' : ''}`}>
              <div className="media-field">
                <label className="media-label">
                  Search via API
                  {needsKey && (
                    <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--accent-amber)', marginLeft: 6 }}>
                      (set API key above)
                    </span>
                  )}
                </label>
                <div className="media-search-input-wrap">
                  <Search size={14} />
                  <input className="media-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Search ${catInfo.label.toLowerCase()} by name...`}
                    autoFocus={!item}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  />
                  {searching && <Loader2 size={14} className="media-spinner" />}
                </div>
              </div>

              {/* Search results dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="media-api-results">
                  {searchResults.map((r) => (
                    <button key={r.id} type="button" className="media-api-result"
                      onClick={() => selectResult(r)} onMouseDown={(e) => e.preventDefault()}>
                      <div className="media-api-result-poster">
                        {r.poster
                          ? <img src={r.poster} alt="" />
                          : <Film size={16} style={{ opacity: 0.3 }} />
                        }
                      </div>
                      <div className="media-api-result-info">
                        <span className="media-api-result-title">{r.title}</span>
                        <span className="media-api-result-meta">
                          {r.year}{r.genres ? ` • ${r.genres}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual fields */}
          <div className="media-input-row">
            <div className="media-field" style={{ flex: 2 }}>
              <label className="media-label">Title *</label>
              <input className="media-input" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Enter ${singularLabel(category).toLowerCase()} name...`}
                autoFocus={!!item || !useApi}
              />
            </div>
            <div className="media-field" style={{ flex: 1 }}>
              <label className="media-label">Year</label>
              <input className="media-input" value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
              />
            </div>
          </div>

          <div className="media-input-row">
            <div className="media-field">
              <label className="media-label">Status</label>
              <select className="media-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['watching', 'planning', 'completed', 'on-hold', 'dropped'].map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="media-field">
              <label className="media-label">Progress (%)</label>
              <input className="media-input" type="number" min="0" max="100"
                value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
            </div>
          </div>

          <div className="media-field">
            <label className="media-label">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div className="media-field">
            <label className="media-label">Notes</label>
            <textarea className="media-input" value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Your thoughts, episode count, playtime..."
              rows={3} />
          </div>

          <button type="submit" className="media-submit" data-cat={category} disabled={!title.trim()}>
            <Save size={16} />
            {item ? 'Update' : 'Add to List'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main MediaTracker ─── */
export default function MediaTracker() {
  const [activeCat, setActiveCat] = useState('movies');
  const [data, setData] = useState(loadData);
  const [apiKeys, setApiKeys] = useState(loadApiKeys);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { saveData(data); }, [data]);

  const currentItems = data[activeCat] || [];
  const filteredItems = currentItems.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortOrder = { watching: 0, planning: 1, 'on-hold': 2, completed: 3, dropped: 4 };
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aOrder = sortOrder[a.status] ?? 99;
    const bOrder = sortOrder[b.status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });

  const stats = {
    total: currentItems.length,
    watching:  currentItems.filter((i) => i.status === 'watching').length,
    completed: currentItems.filter((i) => i.status === 'completed').length,
    planning:  currentItems.filter((i) => i.status === 'planning').length,
  };

  const catInfo = CATEGORIES.find((c) => c.id === activeCat);
  const CatIcon = catInfo?.icon || Film;

  const handleSaveApiKeys = (keys) => {
    setApiKeys(keys);
    saveApiKeys(keys);
  };

  const handleSave = (item) => {
    setData((prev) => {
      const list = prev[activeCat] || [];
      const idx = list.findIndex((i) => i.id === item.id);
      const newList = idx >= 0
        ? list.map((i) => (i.id === item.id ? item : i))
        : [item, ...list];
      return { ...prev, [activeCat]: newList };
    });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleDelete = (itemId) => {
    setData((prev) => ({
      ...prev,
      [activeCat]: (prev[activeCat] || []).filter((i) => i.id !== itemId),
    }));
  };

  const handleQuickStatus = (itemId, newStatus) => {
    setData((prev) => ({
      ...prev,
      [activeCat]: (prev[activeCat] || []).map((i) =>
        i.id === itemId ? { ...i, status: newStatus, updatedAt: Date.now() } : i
      ),
    }));
  };

  const handleQuickRating = (itemId, rating) => {
    setData((prev) => ({
      ...prev,
      [activeCat]: (prev[activeCat] || []).map((i) =>
        i.id === itemId ? { ...i, rating, updatedAt: Date.now() } : i
      ),
    }));
  };

  const hasApiKeys = apiKeys.omdb || apiKeys.rawg;
  const needsApiKey = !hasApiKeys && (activeCat === 'movies' || activeCat === 'series' || activeCat === 'games');

  return (
    <div className="media-tracker">
      {/* ── Category sub-tabs ── */}
      <div className="media-category-tabs">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = (data[cat.id] || []).length;
          return (
            <button key={cat.id} type="button"
              className={`media-cat-tab ${activeCat === cat.id ? 'active' : ''}`}
              data-cat={cat.id}
              onClick={() => { setActiveCat(cat.id); setStatusFilter('all'); setSearchQuery(''); }}>
              <Icon size={16} /> {cat.label}
              <span className="media-cat-count">({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── API Key banner (shown when no key set for active category) ── */}
      {needsApiKey && (
        <div className="media-api-banner">
          <AlertCircle size={14} />
          <span>Set API keys to auto-fill details from OMDb &amp; RAWG</span>
          <button type="button" onClick={() => setShowApiSettings(true)}>
            <Key size={12} /> Set Keys
          </button>
        </div>
      )}

      {/* ── Header row ── */}
      <div className="media-header-row">
        <div className="media-stats">
          <span className="media-stat">
            <span className="media-stat-dot" style={{ background: 'var(--accent-blue)' }} />
            {stats.watching} watching
          </span>
          <span className="media-stat">
            <span className="media-stat-dot" style={{ background: 'var(--accent-emerald)' }} />
            {stats.completed} done
          </span>
          <span className="media-stat">
            <span className="media-stat-dot" style={{ background: 'var(--accent-amber)' }} />
            {stats.planning} planned
          </span>
          <span className="media-stat">Total: {stats.total}</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button type="button" className="media-api-key-btn"
            onClick={() => setShowApiSettings(true)}
            title="Set API Keys">
            <Key size={14} />
          </button>
          <button type="button" className="media-add-btn" data-cat={activeCat}
            onClick={() => { setEditingItem(null); setShowForm(true); }}>
            <Plus size={16} />
            Add {singularLabel(activeCat)}
          </button>
        </div>
      </div>

      {/* ── Filter & Search ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <div className="media-filter-bar">
          {STATUSES.map((s) => (
            <button key={s} type="button"
              className={`media-filter-btn ${statusFilter === s ? 'active' : ''}`}
              data-status={s}
              onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="media-search">
          <Search size={13} />
          <input type="text"
            placeholder={`Search ${catInfo?.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* ── Items List ── */}
      <div className="media-list">
        {sortedItems.length === 0 ? (
          <div className="media-empty">
            <div className="media-item-icon" style={{ width: 48, height: 48, background: 'var(--bg-input)', color: 'var(--text-tertiary)' }}>
              <ListVideo size={24} />
            </div>
            <p>
              {searchQuery || statusFilter !== 'all'
                ? 'No items match your filters.'
                : `Your ${catInfo?.label.toLowerCase()} list is empty.`}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button type="button" className="media-add-btn" data-cat={activeCat}
                onClick={() => { setEditingItem(null); setShowForm(true); }}
                style={{ marginTop: 'var(--sp-2)' }}>
                <Plus size={14} />
                Add your first {singularLabel(activeCat).toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          sortedItems.map((item, idx) => (
            <div key={item.id} className="media-item" data-cat={activeCat}
              style={{ animationDelay: `${idx * 0.04}s` }}>
              <div className="media-item-icon">
                <CatIcon size={18} />
              </div>
              <div className="media-item-body">
                <div className="media-item-top">
                  <span className="media-item-title">{item.title}</span>
                  {item.year && <span className="media-item-year">{item.year}</span>}
                  <span className={`media-badge ${item.status}`}>
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                  <StarRating value={item.rating || 0}
                    onChange={(r) => handleQuickRating(item.id, r)} />
                </div>
                {item.notes && <div className="media-item-notes">{item.notes}</div>}
                <div className="media-progress">
                  <div className="media-progress-bar">
                    <div className="media-progress-fill" style={{ width: `${item.progress || 0}%` }} />
                  </div>
                  <span className="media-progress-text">{item.progress || 0}%</span>
                  <select className="media-select"
                    value={item.status}
                    onChange={(e) => handleQuickStatus(item.id, e.target.value)}
                    style={{ padding: '2px 24px 2px 8px', fontSize: '10px', minWidth: 0, width: 'auto', backgroundSize: '8px', backgroundPosition: 'right 6px center' }}>
                    {['watching', 'planning', 'completed', 'on-hold', 'dropped'].map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="media-item-actions">
                <button type="button" className="media-action-btn edit" title="Edit"
                  onClick={() => { setEditingItem(item); setShowForm(true); }}>
                  <Edit3 size={14} />
                </button>
                <button type="button" className="media-action-btn delete" title="Delete"
                  onClick={() => handleDelete(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <MediaFormModal
          category={activeCat}
          item={editingItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
          apiKeys={apiKeys}
        />
      )}

      {/* ── API Settings ── */}
      {showApiSettings && (
        <ApiKeySettings
          apiKeys={apiKeys}
          onSave={handleSaveApiKeys}
          onClose={() => setShowApiSettings(false)}
        />
      )}
    </div>
  );
}
