// Per-theme accent tokens — kept out of ThemeContext.jsx so that file only
// exports the context and hooks (react-refresh only-export-components).

export const THEME_ACCENTS = {
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

export const ACCENT_KEY = 'aust-accent';

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
