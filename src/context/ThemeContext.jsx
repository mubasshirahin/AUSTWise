import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = ['light', 'dark', 'midnight', 'industrial', 'swiss', 'newsprint', 'sketchbook', 'minimalist-monochrome', 'terminal', 'art-deco', 'bitcoindefi', 'poster', 'nexus'];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('aust-theme');
    if (saved && THEMES.includes(saved)) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aust-theme', theme);
  }, [theme]);

  // Kept for backward compatibility — flips only between dark/light.
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Advances through every available theme (Dark → Light → Newsprint → …).
  const cycleTheme = () => setTheme(prev => {
    const idx = THEMES.indexOf(prev);
    return THEMES[(idx + 1) % THEMES.length];
  });

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme, toggleTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
