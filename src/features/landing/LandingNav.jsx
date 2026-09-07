import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Moon, MoonStar, Cpu, Terminal, SquareTerminal, Zap, Building2,
  Type, Orbit, Grid2x2, Newspaper, PenTool, Gauge, Pen, Sun, Check, ArrowRight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import wordmarkLight from '../../assets/austwise-4.svg';
import wordmarkDark from '../../assets/austwise-5.svg';
import './LandingPage.css';

const darkThemeOptions = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'midnight', label: 'Midnight', icon: MoonStar },
  { id: 'nexus', label: 'Nexus', icon: Cpu },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: Terminal },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'bitcoindefi', label: 'Bitcoin DeFi', icon: Zap },
  { id: 'art-deco', label: 'Art Deco', icon: Building2 },
  { id: 'poster', label: 'Bold Type', icon: Type },
  { id: 'meshtopo', label: 'Mesh Topology', icon: Orbit },
];

const lightThemeOptions = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'swiss', label: 'Swiss', icon: Grid2x2 },
  { id: 'newsprint', label: 'Newsprint', icon: Newspaper },
  { id: 'sketchbook', label: 'Sketchbook', icon: PenTool },
  { id: 'industrial', label: 'Industrial', icon: Gauge },
  { id: 'minimalist-monochrome', label: 'Monochrome', icon: Pen },
];

const allThemeOptions = [...darkThemeOptions, ...lightThemeOptions];

export default function LandingNav() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeSwitcherRef = useRef(null);
  const [logoClicked, setLogoClicked] = useState(false);
  const logoClickTimes = useRef([]);

  const checkEasterEgg = useCallback(() => {
    const now = Date.now();
    logoClickTimes.current.push(now);
    const windowMs = 3000;
    const threshold = 3;
    logoClickTimes.current = logoClickTimes.current.filter(t => now - t < windowMs);
    if (logoClickTimes.current.length >= threshold) {
      logoClickTimes.current = [];
      navigate('/terminal');
    }
  }, [navigate]);

  const toggleLogo = () => {
    setLogoClicked(true);
    setTimeout(() => setLogoClicked(false), 600);
    checkEasterEgg();
  };

  // Click-outside closes theme menu
  useEffect(() => {
    const handleClick = (e) => {
      if (themeSwitcherRef.current && !themeSwitcherRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeTheme = allThemeOptions.find((t) => t.id === theme) || allThemeOptions[0];
  const ThemeIcon = activeTheme.icon;
  const lightThemes = new Set(lightThemeOptions.map((t) => t.id));
  const wordmarkSrc = lightThemes.has(theme) ? wordmarkLight : wordmarkDark;

  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        <div className="landing-nav-left">
          <div className="topbar-logo">
            <img
              src={wordmarkSrc}
              alt="AUSTWise"
              className={`topbar-wordmark-img ${logoClicked ? 'clicked' : ''}`}
              onClick={toggleLogo}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggleLogo()}
              title="Click 3x for Nexus Terminal"
              aria-label="AUSTWise logo"
            />
            <div className="logo-burst" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
              <i></i><i></i><i></i><i></i>
            </div>
          </div>
        </div>

        <div className="landing-nav-mid">
          <div className="landing-theme-switcher" ref={themeSwitcherRef}>
            <button
              type="button"
              className="landing-theme-btn"
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              aria-label={`Theme: ${activeTheme.label}. Choose a theme`}
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              <div className={`landing-theme-icon ${theme}`}>
                <ThemeIcon size={16} />
              </div>
            </button>

            <div className={`landing-theme-menu ${themeMenuOpen ? 'open' : ''}`} role="menu" aria-label="Select theme">
              <span className="landing-theme-menu-heading">Dark Mode</span>
              {darkThemeOptions.map(({ id, label, icon: Icon }) => {
                const isActive = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`landing-theme-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => { setTheme(id); setThemeMenuOpen(false); }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    {isActive && <Check size={14} className="landing-theme-menu-check" />}
                  </button>
                );
              })}

              <div className="landing-theme-menu-divider" />

              <span className="landing-theme-menu-heading">Light Mode</span>
              {lightThemeOptions.map(({ id, label, icon: Icon }) => {
                const isActive = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`landing-theme-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => { setTheme(id); setThemeMenuOpen(false); }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    {isActive && <Check size={14} className="landing-theme-menu-check" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="landing-nav-right">
          <button className="landing-btn landing-btn-primary ripple-btn" onClick={() => navigate('/login')}>Start for Free <ArrowRight size={16} /><span className="ripple-overlay" aria-hidden="true" /></button>
        </div>
      </div>
    </nav>
  );
}
