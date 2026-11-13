import { useState, useEffect, useCallback } from 'react';
import { ThemeContext, THEMES } from './ThemeContext';
import { THEME_ACCENTS, ACCENT_KEY, LAYOUT_KEY, LAYOUTS, applyAccentOverrides, clearAccentOverrides } from './themeConstants';

// Theme and layout styles are separate CSS chunks. Loading every visual system
// in main.jsx made even the Quick Stats route download and parse styles it
// could never use during that visit.
const themeStyles = {
  dark: () => import('../themes/dark-enhanced.css'),
  midnight: () => import('../themes/minimalist-dark.css'),
  industrial: () => import('../themes/industrial.css'),
  swiss: () => import('../themes/swiss.css'),
  terminal: () => import('../themes/terminal.css'),
  'art-deco': () => import('../themes/artdeco.css'),
  bitcoindefi: () => import('../themes/bitcoindefi.css'),
  poster: () => import('../themes/poster.css'),
  nexus: () => import('../themes/nexus.css'),
  meshtopo: () => import('../themes/meshtopo.css'),
  blueprint: () => import('../themes/blueprint.css'),
  obsidian: () => import('../themes/vibes.css'),
  pastel: () => import('../themes/vibes.css'),
  prism: () => import('../themes/vibes.css'),
  toon: () => import('../themes/vibes.css'),
  lofi: () => import('../themes/vibes.css'),
  sakura: () => import('../themes/vibes.css'),
  arcade: () => import('../themes/vibes.css'),
};

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
};

// Start fetching the saved appearance before React mounts so its stylesheet is
// ready with the app's first useful render. Later picker changes use the same
// cached module imports.
try {
  const savedTheme = localStorage.getItem('aust-theme') || 'blueprint';
  const savedLayout = localStorage.getItem(LAYOUT_KEY);
  themeStyles[savedTheme]?.();
  layoutStyles[savedLayout || (savedTheme === 'blueprint' ? 'studio' : 'classic')]?.();
} catch { /* storage can be unavailable in private or sandboxed contexts */ }

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('aust-theme');
    if (saved && THEMES.includes(saved)) return saved;
    return 'blueprint';
  });

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

  // Layout is independent of theme: "classic" (original boxed pages) or
  // "studio" (open heroes, pill tab dock, unboxed content) — any theme, either
  // layout. With nothing saved, Blueprint starts in studio (as it shipped).
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (LAYOUTS.includes(saved)) return saved;
    return theme === 'blueprint' ? 'studio' : 'classic';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-layout', layout);
    localStorage.setItem(LAYOUT_KEY, layout);
  }, [layout]);

  const toggleLayout = useCallback(() => setLayout((prev) => (prev === 'studio' ? 'classic' : 'studio')), []);

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
    const idx = THEMES.indexOf(prev);
    return THEMES[(idx + 1) % THEMES.length];
  });

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme, toggleTheme, cycleTheme, accent, accentOverridden, setAccent, layout, setLayout, toggleLayout }}>
      {children}
    </ThemeContext.Provider>
  );
}
