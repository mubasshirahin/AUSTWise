import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Coffee, Flame, Star, MessageSquare, AlertTriangle, Plus, X, Info, MoreVertical, Check, Search, Trash2 } from 'lucide-react';
import { canteenData, currentDayOfWeek } from '../../data/mockData';
import {
  getReviewSummary,
  getReviewsForFood,
  addReview,
  getComplaintsForFood,
  getComplaintCount,
  addComplaint,
} from '../../utils/canteenFeedbackStorage';
import './SemesterViewWidget.css';
import './CanteenMenu.css';

// ─── Time-slot based crowd status ───

const crowdTimeSlots = [
  { start: '07:00', end: '07:50', status: 'Filling Up Fast', icon: '📈', level: 'Moderate', color: '#e2b95c', desc: 'Seats are filling up with the breakfast crowd.' },
  { start: '07:50', end: '08:00', status: 'Sudden Drop', icon: '📉', level: 'Low', color: '#8fc7bc', desc: 'Rapid clearance! Everyone is sprinting to class.' },
  { start: '08:00', end: '09:40', status: 'Ghost Town', icon: '🧊', level: 'Zero Crowd', color: '#a3bd97', desc: 'Practically empty. You can take 3 tables alone.' },
  { start: '09:40', end: '10:00', status: 'Blitz Rush', icon: '⚡', level: 'High (Short)', color: '#cf8666', desc: 'Heavy queue at the counter! Fast-paced break rush.' },
  { start: '10:00', end: '10:30', status: 'Room to Breathe', icon: '🍃', level: 'Low', color: '#8fc7bc', desc: 'Crowd vanished back to class. Lots of free seats.' },
  { start: '10:30', end: '10:50', status: 'Snack Surge', icon: '⚡', level: 'High (Short)', color: '#cf8666', desc: 'Quick mid-day rush. Long lines but moves fast.' },
  { start: '10:50', end: '12:30', status: 'Easy Flow', icon: '🚶', level: 'Light Crowd', color: '#b9e2da', desc: 'Casual crowd. Easy to find a spot to sit and chill.' },
  { start: '12:30', end: '14:30', status: 'Gridlock / Full House', icon: '🔥', level: 'Extreme', color: '#e2b95c', desc: '100% Capacity! Standing room only. Good luck finding a seat.' },
  { start: '14:30', end: '15:30', status: 'Mass Exodus', icon: '📉', level: 'Receding', color: '#d0c15f', desc: 'Heavy crowd is leaving. Tables are opening up.' },
  { start: '15:30', end: '16:20', status: 'Chilled Adda', icon: '☕', level: 'Moderate', color: '#e2b95c', desc: 'Cozy afternoon crowd. Decent rush for tea.' },
  { start: '16:20', end: '17:10', status: 'Dwindling Down', icon: '🍂', level: 'Very Low', color: '#c6d8bd', desc: 'Campus leaving hour. Canteen is emptying out fast.' },
  { start: '17:10', end: '18:00', status: 'Barely Anyone', icon: '🌫️', level: 'Near Zero', color: '#a3bd97', desc: 'Just a handful of people left. Total peace.' },
  { start: '18:00', end: '19:00', status: 'Wrapping Up', icon: '🧹', level: 'Closing', color: '#b998c0', desc: 'No new entry/orders. Staff is cleaning the floors.' },
  { start: '19:00', end: '07:00', status: 'Hard Shutdown', icon: '🚫', level: 'Locked', color: '#ad6448', desc: 'Canteen closed. Doors locked.' },
];

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentTimeSlot() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const slot of crowdTimeSlots) {
    const startM = toMinutes(slot.start);
    const endM = toMinutes(slot.end);
    if (endM > startM) {
      if (currentMinutes >= startM && currentMinutes < endM) return slot;
    } else {
      if (currentMinutes >= startM || currentMinutes < endM) return slot;
    }
  }
  return crowdTimeSlots[crowdTimeSlots.length - 1];
}

// ─── Star display ───
function StarDisplay({ value, size = 12 }) {
  return (
    <span className="canteen-food-rating-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          style={{
            color: n <= Math.round(value) ? 'var(--accent-amber)' : 'var(--text-tertiary)',
            fill: n <= Math.round(value) ? 'var(--accent-amber)' : 'none',
          }}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="canteen-star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={20}
          style={{
            color: n <= (hover || value) ? 'var(--accent-amber)' : 'var(--text-tertiary)',
            fill: n <= (hover || value) ? 'var(--accent-amber)' : 'none',
          }}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        />
      ))}
    </span>
  );
}

// ─── Food card ───
function FoodCard({ food, onDelete }) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackVersion, setFeedbackVersion] = useState(0);

  const summary = useMemo(() => getReviewSummary(food.id), [food.id, feedbackVersion]);
  const complaintCount = useMemo(() => getComplaintCount(food.id), [food.id, feedbackVersion]);

  const densityClass = !food.available ? 'is-rose' : food.popular ? 'is-amber' : 'is-emerald';

  return (
    <div className={`sv-cell canteen-food-card ${densityClass}${food.available ? '' : ' unavailable'}`}>
      {food.popular && (
        <span className="canteen-bestseller-badge">
          <Flame size={8} /> BESTSELLER
        </span>
      )}
      {complaintCount > 0 && (
        <span className="sv-count hot">{complaintCount}</span>
      )}

      <span className="canteen-food-category">{food.category}</span>
      <div className="sv-cell-title canteen-food-name">{food.name}</div>

      <div className="canteen-food-rating">
        <StarDisplay value={summary.average} />
        <span className="canteen-food-rating-count">
          {summary.count > 0 ? `${summary.average} (${summary.count})` : 'No ratings'}
        </span>
      </div>

      <p className="canteen-food-price">৳ {food.price}</p>

      {onDelete && (
        <button
          className="canteen-remove-btn"
          onClick={onDelete}
          title="Remove this item"
          aria-label={`Remove ${food.name}`}
        >
          <Trash2 size={11} />
        </button>
      )}

      <button
        className="canteen-feedback-toggle"
        onClick={() => setIsFeedbackOpen((open) => !open)}
      >
        <MessageSquare size={11} />
        {isFeedbackOpen ? 'Hide feedback' : 'Review or complain'}
      </button>

      {isFeedbackOpen && (
        <FoodFeedback food={food} onChanged={() => setFeedbackVersion((v) => v + 1)} />
      )}
    </div>
  );
}

// ─── Feedback panel ───
function FoodFeedback({ food, onChanged }) {
  const [tab, setTab] = useState('reviews');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [error, setError] = useState('');

  const reviews = getReviewsForFood(food.id);
  const complaints = getComplaintsForFood(food.id);

  const submitReview = (e) => {
    e.preventDefault();
    try {
      addReview(food.id, rating, reviewText);
      setRating(0);
      setReviewText('');
      setError('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitComplaint = (e) => {
    e.preventDefault();
    try {
      addComplaint(food.id, complaintText);
      setComplaintText('');
      setError('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="canteen-feedback-panel">
      <div className="canteen-feedback-tabs">
        <button
          className={`canteen-feedback-tab ${tab === 'reviews' ? 'active' : ''}`}
          onClick={() => setTab('reviews')}
        >
          <MessageSquare size={11} /> Reviews ({reviews.length})
        </button>
        <button
          className={`canteen-feedback-tab ${tab === 'complaints' ? 'active' : ''}`}
          onClick={() => setTab('complaints')}
        >
          <AlertTriangle size={11} /> Complaints ({complaints.length})
        </button>
      </div>

      {error && <p className="canteen-feedback-error">{error}</p>}

      {tab === 'reviews' ? (
        <>
          <form className="canteen-feedback-form" onSubmit={submitReview}>
            <StarPicker value={rating} onChange={setRating} />
            <textarea
              className="input canteen-feedback-textarea"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your thoughts on this item (optional)..."
            />
            <button type="submit" className="canteen-feedback-submit">
              Submit Review
            </button>
          </form>

          <div className="canteen-feedback-list">
            {reviews.length === 0 ? (
              <p className="canteen-feedback-empty">No reviews yet. Be the first!</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="canteen-review-card">
                  <div className="canteen-review-header">
                    <StarDisplay value={r.rating} />
                    <span className="canteen-review-date">{r.dateLabel}</span>
                  </div>
                  {r.comment && <p className="canteen-review-comment">{r.comment}</p>}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <form className="canteen-feedback-form" onSubmit={submitComplaint}>
            <textarea
              className="input canteen-feedback-textarea"
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="Report an issue (quality, hygiene, wrong price...)"
            />
            <button type="submit" className="canteen-feedback-submit complaint">
              Submit Complaint
            </button>
          </form>

          <div className="canteen-feedback-list">
            {complaints.length === 0 ? (
              <p className="canteen-feedback-empty">No complaints filed.</p>
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="canteen-complaint-card">
                  <div className="canteen-complaint-header">
                    <span className="canteen-complaint-badge">
                      <AlertTriangle size={10} /> Complaint
                    </span>
                    <span className="canteen-review-date">{c.dateLabel}</span>
                  </div>
                  <p className="canteen-complaint-text">{c.text}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function CanteenMenu() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [priceFilter, setPriceFilter] = useState('all');
  const [canteenInfo, setCanteenInfo] = useState(() => {
    try {
      const stored = localStorage.getItem('aust-canteen-data');
      return stored ? JSON.parse(stored) : canteenData;
    } catch {
      return canteenData;
    }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'Meals', price: '' });
  const [showCrowdInfo, setShowCrowdInfo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Lock body scroll + close on Escape when overlay is open
  useEffect(() => {
    if (!showCrowdInfo) return;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape') setShowCrowdInfo(false); };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
  }, [showCrowdInfo]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const currentSlot = useMemo(() => getCurrentTimeSlot(), []);

  // Closed all day Friday & Saturday regardless of the crowd slot
  const isWeekend = currentDayOfWeek() === 'Friday' || currentDayOfWeek() === 'Saturday';
  const autoStatus = isWeekend ? 'closed' : (currentSlot.status === 'Hard Shutdown' ? 'closed' : 'open');
  const effectiveStatus = canteenInfo.statusMode === 'auto' ? autoStatus : canteenInfo.status;
  const effectiveCrowdSlot = canteenInfo.crowdMode === 'auto' ? currentSlot : null;
  const isOpen = effectiveStatus === 'open';

  const categories = useMemo(() => {
    const list = new Set(canteenInfo.menu ? canteenInfo.menu.map(item => item.category) : []);
    return ['All', ...Array.from(list)];
  }, [canteenInfo]);

  const filteredMenu = useMemo(() => {
    const menuList = canteenInfo.menu || [];
    const q = menuSearch.trim().toLowerCase();
    const inPriceRange = (p) => {
      switch (priceFilter) {
        case 'under50': return p < 50;
        case '50-100': return p >= 50 && p <= 100;
        case '100-150': return p > 100 && p <= 150;
        case '150plus': return p > 150;
        default: return true;
      }
    };
    return menuList
      .filter(item => item.available)
      .filter(item => activeCategory === 'All' || item.category === activeCategory)
      .filter(item => inPriceRange(Number(item.price)))
      .filter(item => !q || `${item.name} ${item.category}`.toLowerCase().includes(q))
      .sort((a, b) => getReviewSummary(b.id).average - getReviewSummary(a.id).average);
  }, [activeCategory, canteenInfo, menuSearch, priceFilter]);

  const handleAddItem = (e) => {
    e.preventDefault();
    const name = addForm.name.trim();
    const price = Number(addForm.price);
    if (!name || !(price >= 0)) return;

    const newItem = {
      id: Date.now(),
      name,
      category: addForm.category,
      price,
      popular: false,
      available: true,
    };

    const updated = { ...canteenInfo, menu: [...(canteenInfo.menu || []), newItem] };
    setCanteenInfo(updated);
    localStorage.setItem('aust-canteen-data', JSON.stringify(updated));
    setAddForm({ name: '', category: 'Meals', price: '' });
    setShowAddForm(false);
  };

  const handleDeleteFood = (food) => {
    const updated = {
      ...canteenInfo,
      menu: (canteenInfo.menu || []).filter(item => item !== food),
    };
    setCanteenInfo(updated);
    localStorage.setItem('aust-canteen-data', JSON.stringify(updated));
  };

  const getCrowdColor = () => {
    if (!isOpen) return 'var(--text-tertiary)';
    if (canteenInfo.crowdLevel >= 75) return 'var(--accent-rose)';
    if (canteenInfo.crowdLevel >= 40) return 'var(--accent-amber)';
    return 'var(--accent-emerald)';
  };

  const crowdLabel = canteenInfo.crowdLevel >= 75 ? 'Busy' : canteenInfo.crowdLevel >= 40 ? 'Moderate' : 'Quiet';

  return (
    <div className="glass-card-static schedule-widget sv-widget canteen-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Coffee size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Inside AUST</span>
            <div className="schedule-title">Canteen Menu</div>
            <span className="schedule-subtitle">Daily menu &amp; popular picks</span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value" style={{ color: isOpen ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                {isOpen ? 'OPEN' : 'CLOSED'}
              </span>
              <span className="schedule-stat-label">Status</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{canteenInfo.menu ? canteenInfo.menu.length : 0}</span>
              <span className="schedule-stat-label">Items</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="export-dropdown" ref={menuRef}>
            <button className="schedule-nav-btn" onClick={() => setMenuOpen((o) => !o)} title="Options" aria-haspopup="true" aria-expanded={menuOpen}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="export-menu" role="menu">
                <button
                  className="export-menu-item"
                  onClick={() => { setMenuOpen(false); setShowAddForm(open => !open); }}
                  role="menuitem"
                >
                  {showAddForm ? <X size={14} /> : <Plus size={14} />}
                  {showAddForm ? 'Close Add Form' : 'Add Menu Item'}
                </button>
                <div className="export-menu-sep" />
                <button
                  className="export-menu-item"
                  onClick={() => { setMenuOpen(false); setShowCrowdInfo(true); }}
                  role="menuitem"
                >
                  <Info size={14} /> Crowd Reference
                </button>
                <button
                  className="export-menu-item"
                  onClick={() => setActiveCategory('All')}
                  role="menuitem"
                >
                  <Check size={14} /> Show all items
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Category filter ── */}
      {categories.length > 1 && (
        <div className="canteen-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className={`canteen-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Item search ── */}
      <div className="canteen-search">
        <Search size={14} className="canteen-search-icon" />
        <input
          type="text"
          className="canteen-search-input"
          placeholder="Search food items…"
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
        />
        {menuSearch && (
          <button className="canteen-search-clear" onClick={() => setMenuSearch('')}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Filter bar: category + price range ── */}
      <div className="canteen-filterbar">
        <select
          className="canteen-filter-select"
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          aria-label="Filter by category"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="canteen-filter-select"
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          aria-label="Filter by price range"
        >
          <option value="all">Any price</option>
          <option value="under50">Under ৳50</option>
          <option value="50-100">৳50 – ৳100</option>
          <option value="100-150">৳100 – ৳150</option>
          <option value="150plus">৳150 +</option>
        </select>
        {activeCategory !== 'All' && (
          <button className="canteen-filter-clear" onClick={() => setActiveCategory('All')}>
            <X size={12} /> {activeCategory}
          </button>
        )}
      </div>

      {/* ── Current slot indicator ── */}
      {effectiveCrowdSlot && (
        <div className={`canteen-slot-chip ${isOpen ? '' : 'closed'}`}>
          <span>{effectiveCrowdSlot.icon} {effectiveCrowdSlot.status}</span>
          <span className="canteen-slot-time">
            {effectiveCrowdSlot.start} – {effectiveCrowdSlot.end} · {effectiveCrowdSlot.desc}
          </span>
        </div>
      )}

      {/* ── Add Item Form ── */}
      {showAddForm && (
        <form className="canteen-add-form" onSubmit={handleAddItem}>
          <div className="canteen-add-field" style={{ flex: '1 1 160px' }}>
            <label className="canteen-add-field-label">Item Name</label>
            <input
              className="input canteen-add-field-input"
              type="text"
              placeholder="e.g. Chicken Burger"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              required
            />
          </div>
          <div className="canteen-add-field" style={{ flex: '0 1 120px' }}>
            <label className="canteen-add-field-label">Category</label>
            <select
              className="input canteen-add-field-input"
              value={addForm.category}
              onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
            >
              <option value="Meals">Meals</option>
              <option value="Snacks">Snacks</option>
              <option value="Fast Food">Fast Food</option>
              <option value="Beverages">Beverages</option>
              <option value="Dessert">Dessert</option>
            </select>
          </div>
          <div className="canteen-add-field" style={{ flex: '0 1 100px' }}>
            <label className="canteen-add-field-label">Price (৳)</label>
            <input
              className="input canteen-add-field-input"
              type="number"
              min="0"
              step="1"
              placeholder="70"
              value={addForm.price}
              onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="canteen-add-submit">
            <Plus size={14} /> Add
          </button>
        </form>
      )}

      {/* ─── Menu Grid ─── */}
      {filteredMenu.length === 0 ? (
        <div className="sv-empty">
          <Coffee size={38} className="sv-empty-icon" />
          <h3>No Menu Items</h3>
          <p>No menu items available in this category yet.</p>
        </div>
      ) : (
        <div className="canteen-grid">
          {filteredMenu.map(food => (
            <FoodCard key={food.id} food={food} onDelete={() => handleDeleteFood(food)} />
          ))}
        </div>
      )}

      {/* ─── Disclaimer ─── */}
      <p className="canteen-disclaimer">
        ⚠️ Crowd status &amp; opening status are estimated based on typical university schedules
        and human behavior patterns. They are <strong>not</strong> live/real-time data and may not
        reflect actual conditions.
      </p>

      {/* ─── Crowd Reference Overlay ─── */}
      {showCrowdInfo && createPortal(
        <>
          <div className="canteen-overlay-backdrop" onClick={() => setShowCrowdInfo(false)} />
          <div className="canteen-overlay">
            <div className="canteen-overlay-card">
              {/* Header */}
              <div className="canteen-overlay-header">
                <h3 className="canteen-overlay-title">Canteen Crowd Reference</h3>
                <button
                  type="button"
                  className="canteen-overlay-close"
                  onClick={() => setShowCrowdInfo(false)}
                >
                  <X size={16} /> Close
                </button>
              </div>

              {/* Table */}
              <div className="canteen-overlay-body">
                <table className="canteen-ref-table">
                  <thead>
                    <tr>
                      <th>Time Slot</th>
                      <th>Status</th>
                      <th className="center">Level</th>
                      <th>What it means</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crowdTimeSlots.map((slot) => {
                      const isActive = slot === currentSlot;
                      return (
                        <tr key={slot.start + slot.end} className={isActive ? 'canteen-ref-row active' : ''}>
                          <td className="nowrap">
                            {isActive && <span className="canteen-ref-active-icon">▶</span>}
                            {slot.start} — {slot.end}
                          </td>
                          <td className="nowrap">{slot.icon} {slot.status}</td>
                          <td className="center nowrap">{slot.level}</td>
                          <td className="desc">{slot.desc}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
