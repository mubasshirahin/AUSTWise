import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const THEMES = ['light', 'dark', 'midnight', 'industrial', 'swiss', 'newsprint', 'sketchbook', 'minimalist-monochrome', 'terminal', 'art-deco', 'bitcoindefi', 'poster', 'nexus', 'cyberpunk', 'meshtopo'];

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

  const [accent, setAccentState] = useState(() => {
    const saved = localStorage.getItem(ACCENT_KEY);
    return saved && /^#[0-9a-fA-F]{6}$/.test(saved) ? saved : null;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aust-theme', theme);
  }, [theme]);

  // Apply the custom accent live. Re-runs on theme change so a theme switch
  // can never clobber the user's chosen color — the inline overrides win.
  useEffect(() => {
    if (accent) applyAccentOverrides(accent);
    else clearAccentOverrides();
  }, [accent, theme]);

  // null/undefined → back to the theme's default accent.
  const setAccent = useCallback((color) => {
    const normalized = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null;
    setAccentState(normalized);
    if (normalized) localStorage.setItem(ACCENT_KEY, normalized);
    else localStorage.removeItem(ACCENT_KEY);
  }, []);

  // Kept for backward compatibility — flips only between dark/light.
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Advances through every available theme (Dark → Light → Newsprint → …).
  const cycleTheme = () => setTheme(prev => {
    const idx = THEMES.indexOf(prev);
    return THEMES[(idx + 1) % THEMES.length];
  });

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme, toggleTheme, cycleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);