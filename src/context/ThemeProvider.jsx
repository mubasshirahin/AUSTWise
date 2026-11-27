import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { onRealtimeMessage } from '../utils/liveStore';
import { ThemeContext, THEMES } from './ThemeContext';
import { THEME_ACCENTS, ACCENT_KEY, LAYOUT_KEY, LAYOUT_PICK_KEY, LAYOUTS, layoutForTheme, readLayoutPick, applyAccentOverrides, clearAccentOverrides, THEME_STYLES as themeStyles } from './themeConstants';

// Theme and layout styles are separate CSS chunks. Loading every visual system
// in main.jsx made even the Quick Stats route download and parse styles it
// could never use during that visit. Theme loaders live in themeConstants.js.
const layoutStyles = {
  bento: () => import('../layout/ProLayouts.css'),
  compact: () => import('../layout/ProLayouts.css'),
  aurora: () => import('../layout/ProLayouts.css'),
  zen: () => import('../layout/ProLayouts.css'),
  luxe: () => import('../layout/VibeLayouts.css'),
  soft: () => import('../layout/VibeLayouts.css'),
  motion: () => import('../layout/VibeLayouts.css'),
  comic: () => import('../layout/VibeLayouts.css'),
  desk: () => import('../layout/VibeLayouts.css'),
  manga: () => import('../layout/VibeLayouts.css'),
  hud: () => import('../layout/VibeLayouts.css'),
  grid: () => import('../layout/SignatureLayouts.css'),
  press: () => import('../layout/SignatureLayouts.css'),
  sketch: () => import('../layout/SignatureLayouts.css'),
  gallery: () => import('../layout/SignatureLayouts.css'),
  panel: () => import('../layout/SignatureLayouts.css'),
  billboard: () => import('../layout/SignatureLayouts.css'),
  mesh: () => import('../layout/SignatureLayouts.css'),
  console: () => import('../layout/SignatureLayouts.css'),
  deco: () => import('../layout/SignatureLayouts.css'),
  neon: () => import('../layout/SignatureLayouts.css'),
};

// Which themes and layouts admins have made available (Admin → Themes &
// layouts). Cached locally so the first frame already respects it.
const VISIBILITY_CACHE_KEY = 'aust-appearance-visibility';
const DEFAULT_VISIBILITY = { themes: ['dark'], layouts: ['classic'] };
function readVisibility() {
  try {
    const v = JSON.parse(localStorage.getItem(VISIBILITY_CACHE_KEY) || 'null');
    if (Array.isArray(v?.themes) && Array.isArray(v?.layouts)) return v;
  } catch { /* storage unavailable */ }
  return DEFAULT_VISIBILITY;
}
function visibleList(all, allowed, fallback) {
  const list = all.filter((id) => allowed.includes(id));
  return list.length ? list : [fallback];
}

const initialTheme = () => {
  try {
    const saved = localStorage.getItem('aust-theme');
    const allowed = visibleList(THEMES, readVisibility().themes, 'dark');
    if (saved && allowed.includes(saved)) return saved;
    return allowed[0];
  } catch { /* storage unavailable */ }
  return 'dark';
};

const initialLayout = (theme) => {
  const allowed = visibleList(LAYOUTS, readVisibility().layouts, 'classic');
  const pick = readLayoutPick(theme);
  if (pick && allowed.includes(pick)) return pick;
  const own = layoutForTheme(theme);
  return allowed.includes(own) ? own : allowed[0];
};

// Start fetching the saved appearance before React mounts so its stylesheet is
// ready with the app's first useful render. Later picker changes use the same
// cached module imports.
try {
  const bootTheme = initialTheme();
  const bootLayout = initialLayout(bootTheme);
  themeStyles[bootTheme]?.();
  layoutStyles[bootLayout]?.();
} catch { /* storage can be unavailable in private or sandboxed contexts */ }

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  const [visibility, setVisibility] = useState(readVisibility);
  useEffect(() => {
    const apply = (v) => {
      if (!Array.isArray(v?.themes) || !Array.isArray(v?.layouts)) return;
      const next = { themes: v.themes, layouts: v.layouts };
      try { localStorage.setItem(VISIBILITY_CACHE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      setVisibility(next);
    };
    const load = () => fetch('/api/appearance', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.success) apply(d); }).catch(() => {});
    load();
    const off = onRealtimeMessage('appearance', apply);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { off(); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const visibleThemes = useMemo(() => visibleList(THEMES, visibility.themes, 'dark'), [visibility]);
  const visibleLayouts = useMemo(() => visibleList(LAYOUTS, visibility.layouts, 'classic'), [visibility]);
  const visibleRef = useRef({ themes: visibleThemes, layouts: visibleLayouts });
  visibleRef.current = { themes: visibleThemes, layouts: visibleLayouts };
  // A theme's own layout, or the first available one if that layout is hidden.
  const layoutFor = useCallback((id) => {
    const own = layoutForTheme(id);
    const { layouts } = visibleRef.current;
    return layouts.includes(own) ? own : layouts[0];
  }, []);

  // Per-theme custom accents: { theme: '#hex' }. Keys present = user override
  // for that theme; absent = theme's native color (from THEME_ACCENTS).
  const [accentMap, setAccentMap] = useState(() => {
    try {
      const raw = localStorage.getItem(ACCENT_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* malformed storage — start fresh */ }
    return {};
  });

  // Every theme ships with one fixed layout (THEME_LAYOUT in themeConstants).
  // A manual pick from the navbar Layout menu sticks only while the theme it
  // was made under stays active; switching theme restores that theme's own.
  const [layout, setLayoutState] = useState(() => initialLayout(theme));

  const themeRef = useRef(theme);
  themeRef.current = theme;

  const setTheme = useCallback((next) => {
    const id = typeof next === 'function' ? next(themeRef.current) : next;
    if (!visibleRef.current.themes.includes(id) || id === themeRef.current) return;
    try { localStorage.removeItem(LAYOUT_PICK_KEY); } catch { /* storage unavailable */ }
    themeRef.current = id;
    setThemeState(id);
    setLayoutState(layoutFor(id));
  }, [layoutFor]);

  const setLayout = useCallback((next) => {
    setLayoutState((prev) => {
      const id = typeof next === 'function' ? next(prev) : next;
      return visibleRef.current.layouts.includes(id) ? id : prev;
    });
  }, []);

  // An admin hid the active theme or layout: move to an available one.
  useEffect(() => {
    if (!visibleThemes.includes(theme)) {
      const next = visibleThemes[0];
      themeRef.current = next;
      setThemeState(next);
      setLayoutState(layoutFor(next));
    } else if (!visibleLayouts.includes(layout)) {
      setLayoutState(layoutFor(theme));
    }
  }, [visibleThemes, visibleLayouts, theme, layout, layoutFor]);

  // Remember a manual layout pick for the current theme only.
  useEffect(() => {
    try {
      if (layout === layoutForTheme(theme)) localStorage.removeItem(LAYOUT_PICK_KEY);
      else localStorage.setItem(LAYOUT_PICK_KEY, `${theme}:${layout}`);
    } catch { /* storage unavailable */ }
  }, [theme, layout]);

  useEffect(() => {
    document.documentElement.setAttribute('data-layout', layout);
    localStorage.setItem(LAYOUT_KEY, layout);
  }, [layout]);

  const toggleLayout = useCallback(() => setLayout((prev) => (prev === 'studio' ? 'classic' : 'studio')), [setLayout]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aust-theme', theme);
    themeStyles[theme]?.().catch(() => {});
  }, [theme]);

  useEffect(() => {
    layoutStyles[layout]?.().catch(() => {});
  }, [layout]);

  // The active theme's accent = its stored override, else its native color.
  const accentOverridden = !!(accentMap[theme] && /^#[0-9a-fA-F]{6}$/.test(accentMap[theme]));
  const accent = accentOverridden ? accentMap[theme].toLowerCase() : (THEME_ACCENTS[theme] || null);

  const persistAccentMap = useCallback((map) => {
    localStorage.setItem(ACCENT_KEY, JSON.stringify(map));
  }, []);

  // Apply the active accent override live.
  useEffect(() => {
    if (accent) applyAccentOverrides(accent);
    else clearAccentOverrides();
  }, [accent]);

  // Set a custom color for the current theme (or clear → theme's native).
  const setAccent = useCallback((color) => {
    const normalized = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null;
    setAccentMap(prev => {
      const next = { ...prev };
      if (normalized) next[theme] = normalized;
      else delete next[theme];
      persistAccentMap(next);
      return next;
    });
  }, [theme, persistAccentMap]);

  // Kept for backward compatibility — flips only between dark/light.
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Advances through every available theme (Dark → Light → Newsprint → …).
  const cycleTheme = () => setTheme(prev => {
    const idx = visibleThemes.indexOf(prev);
    return visibleThemes[(idx + 1) % visibleThemes.length];
  });

  return (
    <ThemeContext.Provider value={{ theme, themes: visibleThemes, layouts: visibleLayouts, setTheme, toggleTheme, cycleTheme, accent, accentOverridden, setAccent, layout, setLayout, toggleLayout }}>
      {children}
    </ThemeContext.Provider>
  );
}
