import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isNativeApp, isAssistiveEnabled } from '../utils/isNativeApp';
import {
  Sparkles, LayoutDashboard, DollarSign, BookOpen,
  GraduationCap, Sun, Moon, ArrowUp, Maximize, Minimize,
  X, CalendarDays, Check, Plus, FolderKanban, ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTakaGeloKoi, addDaily, todayKey30, fmtMoney } from '../features/money-tracker/takaGeloKoiStorage';
import brandMark from '../assets/austwise-icon-final.svg';
import './AssistiveWidget.css';

// App-only floating bubble (APK / installed PWA). Web & desktop browser
// never render it — see isNativeApp() in utils/isNativeApp.js.
// These numbers mirror .assistive-bubble in AssistiveWidget.css and keep the
// bubble fully inside the *visible* viewport (mobile URL bars, bottom nav
// and safe-area included).
const BUBBLE_SIZE = 52;
const EDGE_MARGIN = 12;
const MOBILE_NAV_HEIGHT = 66; // .mobile-nav height (bottom:0 full-width bar)
const NAV_BREATHING = 14;

const isCompact = () => window.innerWidth <= 1024;

function getSafeAreaBottom() {
  try {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;left:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
    document.body.appendChild(el);
    const h = parseFloat(getComputedStyle(el).height) || 0;
    el.remove();
    return h;
  } catch { return 0; }
}

function bottomReserve() {
  const safeArea = getSafeAreaBottom();
  // Mobile nav (66px) sits flush at bottom:0 + safe-area inset in app mode.
  return (isCompact() ? MOBILE_NAV_HEIGHT + safeArea + NAV_BREATHING : EDGE_MARGIN + safeArea);
}

/** Clamp a position so the whole bubble stays on screen at the current size. */
function clampToViewport(pos) {
  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;
  const maxX = Math.max(EDGE_MARGIN, width - BUBBLE_SIZE - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, height - BUBBLE_SIZE - bottomReserve());
  return {
    x: Math.min(Math.max(EDGE_MARGIN, pos.x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, pos.y), maxY),
  };
}

const SHORTCUTS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'TakaGeloKoi', path: '/takagelokoi', icon: DollarSign },
  { label: 'Study Room', path: '/study-time', icon: GraduationCap },
  { label: 'Vault', path: '/resource-vault', icon: BookOpen },
  { label: 'Routine', path: '/dashboard/routine', icon: CalendarDays },
  { label: 'Workspace', path: '/workspace', icon: FolderKanban },
];

export default function AssistiveWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [, updateTgk] = useTakaGeloKoi();

  // App-only gate: web/desktop → no bubble at all.
  const [isApp] = useState(() => isNativeApp());
  const [enabled, setEnabled] = useState(() => isAssistiveEnabled());
  useEffect(() => {
    const onToggle = () => setEnabled(isAssistiveEnabled());
    window.addEventListener('aust-assistive-toggle', onToggle);
    window.addEventListener('storage', onToggle);
    return () => {
      window.removeEventListener('aust-assistive-toggle', onToggle);
      window.removeEventListener('storage', onToggle);
    };
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expAdded, setExpAdded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Position state (persisted). A position saved on a big window must not leave
  // the bubble off-screen on a phone, so the current viewport clamps it before
  // the first paint.
  const [pos, setPos] = useState(() => {
    let saved = null;
    try {
      const raw = localStorage.getItem('aust-assistive-pos');
      if (raw) saved = JSON.parse(raw);
    } catch { /* ignore */ }
    const usable = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y);
    const vv = window.visualViewport;
    return clampToViewport(
      usable
        ? saved
        : { x: (vv?.width ?? window.innerWidth) - BUBBLE_SIZE - 22, y: (vv?.height ?? window.innerHeight) - BUBBLE_SIZE - bottomReserve() - 20 }
    );
  });

  const draggingRef = useRef(false);
  const startCoordRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const btnRef = useRef(null);

  // Keep the bubble on screen at every size: window resize, device rotation,
  // the mobile URL bar collapsing, and the on-screen keyboard opening.
  useEffect(() => {
    const keepInside = () => setPos((prev) => {
      const next = clampToViewport(prev);
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
    window.addEventListener('resize', keepInside);
    window.addEventListener('orientationchange', keepInside);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', keepInside);
    vv?.addEventListener('scroll', keepInside);
    return () => {
      window.removeEventListener('resize', keepInside);
      window.removeEventListener('orientationchange', keepInside);
      vv?.removeEventListener('resize', keepInside);
      vv?.removeEventListener('scroll', keepInside);
    };
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Pointer drag logic
  const handlePointerDown = (e) => {
    draggingRef.current = true;
    hasMovedRef.current = false;
    startCoordRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startCoordRef.current.x;
    const dy = e.clientY - startCoordRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
    }
    setPos(clampToViewport({
      x: startPosRef.current.x + dx,
      y: startPosRef.current.y + dy,
    }));
  };

  const handlePointerUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }

    if (hasMovedRef.current) {
      try {
        localStorage.setItem('aust-assistive-pos', JSON.stringify(pos));
      } catch { /* ignore */ }
    } else {
      setIsOpen(o => !o);
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleAddExpense = (e) => {
    e?.preventDefault();
    if (!expTitle.trim() || !expAmt) return;
    updateTgk(d => addDaily(d, todayKey30(new Date()), {
      title: expTitle.trim(),
      amount: Number(expAmt) || 0,
      cat: 'other',
    }));
    setExpAdded(true);
    setTimeout(() => {
      setExpTitle('');
      setExpAmt('');
      setExpAdded(false);
      setShowQuickExpense(false);
    }, 900);
  };

  const toggleFs = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsOpen(false);
  };

  const isDark = theme === 'dark' || theme === 'midnight' || theme === 'terminal';

  // Web / desktop browser: bubble removed entirely.
  if (!isApp || !enabled) return null;

  return (
    <>
      {/* Floating assistive bubble */}
      <button
        ref={btnRef}
        type="button"
        className={`assistive-bubble${isOpen ? ' is-open' : ''}`}
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Assistive Quick Hub"
        aria-label="Assistive Quick Hub"
      >
        <span className="assistive-bubble-inner">
          {isOpen ? (
            <X size={20} />
          ) : (
            <img
              src={brandMark}
              alt=""
              aria-hidden="true"
              draggable="false"
              className="assistive-bubble-logo"
            />
          )}
        </span>
      </button>

      {/* Widget Overlay Card */}
      {isOpen && (
        <div className="assistive-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="assistive-card animate-scaleUp"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Assistive Quick Hub"
          >
            {/* Header */}
            <div className="assistive-head">
              <div className="assistive-title-row">
                <span className="assistive-icon-tile">
                  <Sparkles size={14} />
                </span>
                <div>
                  <h4 className="assistive-title">AUSTWise Quick Hub</h4>
                  <span className="assistive-sub">Assistive tools & shortcuts</span>
                </div>
              </div>
              <button
                type="button"
                className="assistive-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Actions Row */}
            <div className="assistive-actions-row">
              <button
                type="button"
                className="assistive-action-btn"
                onClick={toggleTheme}
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>

              <button
                type="button"
                className="assistive-action-btn"
                onClick={scrollToTop}
                title="Scroll to top"
              >
                <ArrowUp size={15} />
                <span>Top</span>
              </button>

              <button
                type="button"
                className="assistive-action-btn"
                onClick={toggleFs}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                <span>{isFullscreen ? 'Exit FS' : 'Fullscreen'}</span>
              </button>

              <button
                type="button"
                className={`assistive-action-btn${showQuickExpense ? ' is-active' : ''}`}
                onClick={() => setShowQuickExpense(q => !q)}
                title="Quick Add Expense"
              >
                <Plus size={15} />
                <span>+Expense</span>
              </button>
            </div>

            {/* Quick Expense Drawer */}
            {showQuickExpense && (
              <form className="assistive-expense-form animate-fadeIn" onSubmit={handleAddExpense}>
                <div className="assistive-expense-inputs">
                  <input
                    className="input assistive-input"
                    placeholder="Expense title (e.g. Lunch)"
                    value={expTitle}
                    onChange={e => setExpTitle(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="input assistive-input assistive-amt"
                    type="number"
                    placeholder="৳"
                    value={expAmt}
                    onChange={e => setExpAmt(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm assistive-submit-btn"
                  disabled={!expTitle.trim() || !expAmt || expAdded}
                >
                  {expAdded ? (
                    <>
                      <Check size={13} /> Saved!
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> Add today expense
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick Navigation grid */}
            <div className="assistive-section-label">Quick Jump</div>
            <div className="assistive-shortcuts-grid">
              {SHORTCUTS.map(sc => {
                const Icon = sc.icon;
                const isCurrent = location.pathname.startsWith(sc.path);
                return (
                  <button
                    key={sc.path}
                    type="button"
                    className={`assistive-shortcut-btn${isCurrent ? ' is-current' : ''}`}
                    onClick={() => {
                      navigate(sc.path);
                      setIsOpen(false);
                    }}
                  >
                    <span className="assistive-shortcut-icon">
                      <Icon size={16} />
                    </span>
                    <span className="assistive-shortcut-name">{sc.label}</span>
                    <ChevronRight size={12} className="assistive-shortcut-arrow" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
