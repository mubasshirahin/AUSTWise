import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Film, Tv, Gamepad2, Ghost, Plus, X, Star, Search,
  Edit3, Trash2, Save, ListVideo, ExternalLink,
  Key, Loader2, AlertCircle,
} from 'lucide-react';
import { liveLoad, liveSave } from '../../../utils/liveStorage';
import { useLiveRefresh } from '../../../utils/liveStore';
import '../../daily-life/DailyMasthead.css';
import './ChillMasthead.css';
import './MediaTracker.css';

/* ─── Constants ─── */

const CATEGORIES = [
  { id: 'movies', label: 'Movies',     icon: Film     },
  { id: 'series', label: 'Web Series', icon: Tv       },
  { id: 'anime',  label: 'Anime',      icon: Ghost    },
  { id: 'games',  label: 'Games',      icon: Gamepad2 },
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
  return liveLoad('user', STORAGE_KEY, { movies: [], series: [], anime: [], games: [] }, ['aust-media-tracker']);
}

function saveData(data) {
  liveSave('user', STORAGE_KEY, data);
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

/* ─── Modal shell (skill-style §7: portal on <body>, day-modal look) ─── */
function MtModal({ icon: Icon, title, label, onClose, summary, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay mt-overlay" onClick={onClose}>
      <div className="modal mt-modal" role="dialog" aria-modal="true" aria-label={label || title}
        onClick={(e) => e.stopPropagation()}>
        <div className="mt-modal-head">
          <span className="mt-modal-title"><Icon size={13} /> {title}</span>
          <button type="button" className="mt-modal-close" aria-label="Close" onClick={onClose}><X size={12} /></button>
        </div>
        {summary && <div className="mt-modal-summary">{summary}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Api Key Settings ─── */
function ApiKeySettings({ apiKeys, onSave, onClose }) {
  const [omdb, setOmdb] = useState(apiKeys.omdb);
  const [rawg, setRawg] = useState(apiKeys.rawg);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ omdb: omdb.trim(), rawg: rawg.trim() });
    onClose();
  };

  return (
    <MtModal icon={Key} title="API keys" onClose={onClose}
      summary={<>
        <span className={`mt-badge ${omdb.trim() ? 'is-amber' : 'is-rose'}`}>OMDb: {omdb.trim() ? 'Set' : 'Missing'}</span>
        <span className={`mt-badge ${rawg.trim() ? 'is-amber' : 'is-rose'}`}>RAWG: {rawg.trim() ? 'Set' : 'Missing'}</span>
      </>}>
      <form className="mt-form" onSubmit={handleSubmit}>
        <p className="mt-form-note">Free API keys auto-fill movie, series and game details when you add items.</p>

        <label className="mt-field">
          <span className="mt-label">OMDb key <em>movies, series &amp; anime</em></span>
          <input id="media-omdb-key" name="omdbKey" className="input mt-input" value={omdb}
            onChange={(e) => setOmdb(e.target.value)} placeholder="Paste your OMDb API key..." />
          <a className="mt-link" href="http://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={10} /> Get a free OMDb key
          </a>
        </label>

        <label className="mt-field">
          <span className="mt-label">RAWG key <em>games</em></span>
          <input id="media-rawg-key" name="rawgKey" className="input mt-input" value={rawg}
            onChange={(e) => setRawg(e.target.value)} placeholder="Paste your RAWG API key..." />
          <a className="mt-link" href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={10} /> Get a free RAWG key
          </a>
        </label>

        <div className="mt-actions">
          <button type="submit" className="btn btn-primary"><Save size={13} /> Save keys</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </form>
    </MtModal>
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
  const useApi = !item;

  // Debounced API search
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    let results = [];
    if (category === 'games' && apiKeys.rawg) {
      results = await searchRAWG(q, apiKeys.rawg);
    } else if ((category === 'movies' || category === 'series' || category === 'anime') && apiKeys.omdb) {
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
    <MtModal icon={catInfo.icon} title={`${item ? 'Edit' : 'Add'} ${singularLabel(category).toLowerCase()}`} onClose={onClose}
      summary={<>
        <span className="mt-badge is-muted">Status: <strong>{STATUS_LABELS[status]}</strong></span>
        <span className="mt-badge is-amber">Progress: {Math.min(100, Math.max(0, progress || 0))}%</span>
      </>}>
      <form className="mt-form" onSubmit={handleSubmit}>
        {/* API Search */}
        {useApi && (
          <div className="media-api-search">
            <label className="mt-field">
              <span className="mt-label">
                Search {catInfo.label.toLowerCase()}
                {needsKey && <em className="is-warn">set an API key first</em>}
              </span>
              <span className="media-search-input-wrap">
                <Search size={13} />
                <input id="media-api-search" name="apiSearch" className="input mt-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Search ${catInfo.label.toLowerCase()} by name...`}
                  autoFocus
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                />
                {searching && <Loader2 size={13} className="media-spinner" />}
              </span>
            </label>

            {showResults && searchResults.length > 0 && (
              <div className="media-api-results">
                {searchResults.map((r) => (
                  <button key={r.id} type="button" className="media-api-result"
                    onClick={() => selectResult(r)} onMouseDown={(e) => e.preventDefault()}>
                    <span className="media-api-result-poster">
                      {r.poster ? <img src={r.poster} alt="" /> : <Film size={14} />}
                    </span>
                    <span className="media-api-result-info">
                      <span className="media-api-result-title">{r.title}</span>
                      <span className="media-api-result-meta">{r.year}{r.genres ? ` • ${r.genres}` : ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-form-row">
          <label className="mt-field is-title">
            <span className="mt-label">Title</span>
            <input id="media-title" name="title" className="input mt-input" value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${singularLabel(category)} name`}
              autoFocus={!useApi}
            />
          </label>
          <label className="mt-field is-year">
            <span className="mt-label">Year</span>
            <input id="media-year" name="year" className="input mt-input" value={year}
              onChange={(e) => setYear(e.target.value)} placeholder="2024" inputMode="numeric" />
          </label>
        </div>

        <div className="mt-form-row">
          <label className="mt-field">
            <span className="mt-label">Status</span>
            <select id="media-status" name="status" className="input mt-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {['watching', 'planning', 'completed', 'on-hold', 'dropped'].map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="mt-field">
            <span className="mt-label">Progress (%)</span>
            <input id="media-progress" name="progress" className="input mt-input" type="number" min="0" max="100"
              value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          </label>
        </div>

        <div className="mt-field">
          <span className="mt-label">Rating</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <label className="mt-field">
          <span className="mt-label">Notes</span>
          <textarea id="media-notes" name="notes" className="input mt-input mt-textarea" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Thoughts, episode count, playtime..." rows={3} />
        </label>

        <div className="mt-actions">
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {item ? <Save size={13} /> : <Plus size={13} />}
            {item ? 'Update' : 'Add to list'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </MtModal>
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

  // Live-sync: adopt the server copy when another device edits the tracker.
  useLiveRefresh([STORAGE_KEY], () => setData(loadData()));

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
    const saved = { ...item, category: item.category || activeCat };
    setData((prev) => {
      const list = prev[activeCat] || [];
      const idx = list.findIndex((i) => i.id === saved.id);
      const newList = idx >= 0
        ? list.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...list];
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

  const needsApiKey = (!apiKeys.omdb && (activeCat === 'movies' || activeCat === 'series' || activeCat === 'anime'))
    || (!apiKeys.rawg && activeCat === 'games');

  const openAdd = () => { setEditingItem(null); setShowForm(true); };
  const filtered = Boolean(searchQuery) || statusFilter !== 'all';

  return (
    <div className="media-tracker cz-tab">
      {/* ── Masthead (skill-style §2) ── */}
      <header className="dl-head has-actions">
        <div className="dl-head-title">
          <div className="dl-head-tile" aria-hidden="true"><Film size={20} strokeWidth={2.1} /></div>
          <div className="dl-head-text">
            <span className="dl-head-overline">DownTime</span>
            <h2 className="dl-head-name">Media Tracker</h2>
            <span className="dl-head-subtitle">Movies, series, anime &amp; games</span>
          </div>
        </div>
        <dl className="dl-head-stats">
          <div className="dl-head-stat"><dt>Watching</dt><dd>{stats.watching}</dd></div>
          <div className="dl-head-stat"><dt>Done</dt><dd>{stats.completed}</dd></div>
          <div className="dl-head-stat"><dt>Planned</dt><dd>{stats.planning}</dd></div>
          <div className="dl-head-stat"><dt>Total</dt><dd>{stats.total}</dd></div>
        </dl>
        <div className="dl-head-actions">
          <button type="button" className="dl-head-menu-btn" title="API keys" aria-label="API keys"
            onClick={() => setShowApiSettings(true)}>
            <Key />
          </button>
        </div>
      </header>

      {/* ── Category switcher (§4, scrolls sideways on phone) ── */}
      <div className="mt-switch" role="tablist" aria-label="Media category">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = (data[cat.id] || []).length;
          return (
            <button key={cat.id} type="button" role="tab" aria-selected={activeCat === cat.id}
              className={`mt-switch-pill${activeCat === cat.id ? ' is-active' : ''}`}
              onClick={() => { setActiveCat(cat.id); setStatusFilter('all'); setSearchQuery(''); }}>
              <Icon size={13} /> {cat.label}
              <span className="mt-switch-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── API key notice ── */}
      {needsApiKey && (
        <div className="mt-notice">
          <AlertCircle size={14} />
          <span>Set API keys to auto-fill details from OMDb &amp; RAWG.</span>
          <button type="button" onClick={() => setShowApiSettings(true)}><Key size={12} /> Set keys</button>
        </div>
      )}

      {/* ── List card ── */}
      <section className="mt-card">
        <div className="mt-card-head-row">
          <h3 className="mt-card-title">
            <CatIcon size={14} /> {catInfo?.label}
            <span className="mt-card-count">{filtered ? `${sortedItems.length} / ${stats.total}` : stats.total}</span>
          </h3>
          <button type="button" className="mt-add-icon-btn" onClick={openAdd}
            title={`Add ${singularLabel(activeCat).toLowerCase()}`} aria-label={`Add ${singularLabel(activeCat).toLowerCase()}`}>
            <Plus size={15} />
          </button>
        </div>

        <div className="mt-toolbar">
          <div className="mt-filter" role="tablist" aria-label="Status filter">
            {STATUSES.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={statusFilter === s}
                className={`mt-filter-pill${statusFilter === s ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <label className="mt-search">
            <Search size={13} />
            <input type="text" aria-label={`Search ${catInfo?.label.toLowerCase()}`}
              placeholder={`Search ${catInfo?.label.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
          </label>
        </div>

        {sortedItems.length === 0 ? (
          <div className="cz-empty">
            <span className="cz-empty-icon"><ListVideo size={16} /></span>
            <p className="cz-empty-hint">
              {filtered
                ? 'Nothing matches these filters.'
                : `No ${catInfo?.label.toLowerCase()} yet - track what you're watching, finished or planning next.`}
            </p>
            {!filtered && (
              <button type="button" className="cz-empty-action" onClick={openAdd}>
                <Plus size={13} /> Add {singularLabel(activeCat).toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          <ul className="mt-list">
            {sortedItems.map((item) => {
              const itemCatId = item.category || activeCat;
              const ItemIcon = (CATEGORIES.find((c) => c.id === itemCatId)?.icon) || CatIcon;
              const pct = Math.min(100, Math.max(0, item.progress || 0));
              return (
                <li key={item.id} className="mt-row">
                  <span className={`mt-row-thumb${item.poster ? ' has-poster' : ''}`}>
                    {item.poster ? (
                      <img src={item.poster} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.parentElement.classList.remove('has-poster'); e.currentTarget.remove(); }} />
                    ) : null}
                    <ItemIcon size={16} className="mt-row-fallback" />
                  </span>

                  <div className="mt-row-body">
                    <div className="mt-row-top">
                      <span className="mt-row-title" title={item.title}>{item.title}</span>
                      {item.year && <span className="mt-row-year">{item.year}</span>}
                    </div>
                    <div className="mt-row-meta">
                      <span className={`mt-status is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span>
                      <StarRating value={item.rating || 0} onChange={(r) => handleQuickRating(item.id, r)} />
                    </div>
                    {item.notes && <div className="mt-row-notes">{item.notes}</div>}
                    <div className="mt-row-progress">
                      <span className="mt-bar"><span className="mt-bar-fill" style={{ width: `${pct}%` }} /></span>
                      <span className="mt-row-pct">{pct}%</span>
                      <select className="mt-row-select" aria-label="Status" value={item.status}
                        onChange={(e) => handleQuickStatus(item.id, e.target.value)}>
                        {['watching', 'planning', 'completed', 'on-hold', 'dropped'].map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-row-actions">
                    <button type="button" className="mt-icon-btn" title="Edit" aria-label={`Edit ${item.title}`}
                      onClick={() => { setEditingItem(item); setShowForm(true); }}>
                      <Edit3 size={13} />
                    </button>
                    <button type="button" className="mt-icon-btn is-delete" title="Delete" aria-label={`Delete ${item.title}`}
                      onClick={() => handleDelete(item.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {showForm && (
        <MediaFormModal
          category={activeCat}
          item={editingItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
          apiKeys={apiKeys}
        />
      )}

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
