import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const THEMES = ['light', 'dark', 'midnight', 'industrial', 'swiss', 'newsprint', 'sketchbook', 'minimalist-monochrome', 'terminal', 'art-deco', 'bitcoindefi', 'poster', 'nexus', 'cyberpunk', 'meshtopo'];

// Each theme's native primary accent (its --accent-blue), so the default color
// follows the theme. The user can still pick any custom hex, which overrides.
const THEME_ACCENTS = {
  dark: '#F5A623',
  light: '#7a653d',
  midnight: '#ff9f43',
  industrial: '#ff4757',
  swiss: '#FF3000',
  newsprint: '#cc0000',
  sketchbook: '#ff4d4d',
  'minimalist-monochrome': '#000000',
  terminal: '#33ff00',
  'art-deco': '#D4AF37',
  bitcoindefi: '#F7931A',
  poster: '#FF3D00',
  nexus: '#10B981',
  cyberpunk: '#00ff88',
  meshtopo: '#10B981',
};

const ACCENT_KEY = 'aust-accent';

function hexToRgb(hex) {
  const int = parseInt(hex.replace('#', ''), 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// amt > 0 lightens toward white, amt < 0 darkens toward black.
function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  const mix = (c) => Math.round(c + (t - c) * a);
  const toHex = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// Every brand token that reads "gold" by default (accent-blue and accent-amber
// are both #F5A623 on the standard dark theme) — recolored together so the
// whole UI re-skins coherently when the user picks a custom accent.
const ACCENT_OVERRIDE_VARS = (hex) => ({
  '--accent-blue': hex,
  '--accent-amber': hex,
  '--accent-orange': hex,
  '--accent-blue-glow': withAlpha(hex, 0.14),
  '--accent-amber-glow': withAlpha(hex, 0.14),
  '--accent-orange-glow': withAlpha(hex, 0.14),
  '--border-focus': withAlpha(hex, 0.5),
  '--shadow-glow-amber': `0 0 24px ${withAlpha(hex, 0.14)}`,
  '--gradient-accent': `linear-gradient(135deg, ${hex} 0%, ${shade(hex, 0.35)} 100%)`,
  '--gradient-warm': `linear-gradient(135deg, ${shade(hex, -0.15)} 0%, ${shade(hex, -0.35)} 100%)`,
});

function applyAccentOverrides(hex) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(ACCENT_OVERRIDE_VARS(hex))) {
    root.style.setProperty(key, value);
  }
}

function clearAccentOverrides() {
  const root = document.documentElement;
  for (const key of Object.keys(ACCENT_OVERRIDE_VARS('#000000'))) {
    root.style.removeProperty(key);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('aust-theme');
    if (saved && THEMES.includes(saved)) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aust-theme', theme);
  }, [theme]);

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
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme, toggleTheme, cycleTheme, accent, accentOverridden, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const getThemeAccent = (theme) => THEME_ACCENTS[theme] || null;