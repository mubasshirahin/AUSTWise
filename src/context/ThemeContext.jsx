import { createContext, useContext } from 'react';
import { THEME_ACCENTS } from './themeConstants';

export const ThemeContext = createContext();

export const THEMES = ['light', 'dark', 'midnight', 'industrial', 'swiss', 'newsprint', 'sketchbook', 'minimalist-monochrome', 'terminal', 'art-deco', 'bitcoindefi', 'poster', 'nexus', 'cyberpunk', 'meshtopo'];

export const useTheme = () => useContext(ThemeContext);
export const getThemeAccent = (theme) => THEME_ACCENTS[theme] || null;