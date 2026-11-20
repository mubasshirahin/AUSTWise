// Per-theme accent tokens — kept out of ThemeContext.jsx so that file only
// exports the context and hooks (react-refresh only-export-components).

export const THEME_ACCENTS = {
  dark: '#F5A623',
  light: '#7a653d',
  midnight: '#ff9f43',
  industrial: '#e02d3c',
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
  blueprint: '#7CC8FF',
  obsidian: '#CDAE72',
  pastel: '#7356A6',
  prism: '#F2785A',
  toon: '#D43F3A',
  lofi: '#D9A05B',
  sakura: '#BE3A66',
  arcade: '#36D3F2',
  notebook: '#2747C9',
  nightowl: '#F5D24A',
};

export const ACCENT_KEY = 'aust-accent';

// Page layout. Every theme ships with ONE fixed layout (THEME_LAYOUT) so each
// theme is a finished product: colour + structure. Picking a theme applies its
// layout; the navbar Layout menu can still override it until the theme changes.
export const LAYOUT_KEY = 'aust-layout';
export const LAYOUTS = [
  'classic', 'studio', 'bento', 'compact', 'aurora', 'zen',
  'luxe', 'soft', 'motion', 'comic', 'desk', 'manga', 'hud',
  'grid', 'press', 'sketch', 'gallery', 'panel', 'billboard', 'mesh', 'console', 'deco', 'neon',
];
// Layouts intended for the paid plan (shown with a PRO tag in the picker).
export const PRO_LAYOUTS = LAYOUTS.filter((id) => id !== 'classic' && id !== 'studio');

export const THEME_LAYOUT = {
  dark: 'classic',
  light: 'zen',
  midnight: 'aurora',
  industrial: 'panel',
  swiss: 'grid',
  newsprint: 'press',
  sketchbook: 'sketch',
  'minimalist-monochrome': 'gallery',
  terminal: 'console',
  'art-deco': 'deco',
  bitcoindefi: 'bento',
  poster: 'billboard',
  nexus: 'compact',
  cyberpunk: 'neon',
  meshtopo: 'mesh',
  blueprint: 'studio',
  obsidian: 'luxe',
  pastel: 'soft',
  prism: 'motion',
  toon: 'comic',
  lofi: 'desk',
  sakura: 'manga',
  arcade: 'hud',
  notebook: 'studio',
  nightowl: 'studio',
};

export const layoutForTheme = (theme) => THEME_LAYOUT[theme] || 'classic';

// A manual pick from the Layout menu is remembered only for the theme it was
// made under ("theme:layout"); any other theme falls back to its own layout.
export const LAYOUT_PICK_KEY = 'aust-layout-pick';
export function readLayoutPick(theme) {
  try {
    const [pickTheme, pickLayout] = String(localStorage.getItem(LAYOUT_PICK_KEY) || '').split(':');
    if (pickTheme === theme && LAYOUTS.includes(pickLayout)) return pickLayout;
  } catch { /* storage unavailable */ }
  return null;
}

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

export function applyAccentOverrides(hex) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(ACCENT_OVERRIDE_VARS(hex))) {
    root.style.setProperty(key, value);
  }
}

export function clearAccentOverrides() {
  const root = document.documentElement;
  for (const key of Object.keys(ACCENT_OVERRIDE_VARS('#000000'))) {
    root.style.removeProperty(key);
  }
}

// Lazy CSS for each theme (themes not listed live in index.css). Shared by
// ThemeProvider and the admin QA theme-contrast test.
export const THEME_STYLES = {
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
  notebook: () => import('../themes/notebook.css'),
  nightowl: () => import('../themes/notebook.css'),
};
