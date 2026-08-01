import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, GraduationCap, Library, Users, ShoppingBag, Settings, LayoutDashboard, FileText, X, ScrollText, Home, StickyNote } from 'lucide-react';
import './SearchModal.css';

const searchItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: 'home dashboard' },
  { label: 'Routine Templates', path: '/templates', icon: FileText, keywords: 'templates routine schedule' },
  { label: 'Grade Lab', path: '/analytics', icon: GraduationCap, keywords: 'analytics grades cgpa' },
  { label: 'Resource Vault', path: '/vault', icon: Library, keywords: 'vault resources notes questions' },
  { label: 'Notebook', path: '/notebook', icon: StickyNote, keywords: 'notebook notes canvas whiteboard editor writing' },
  { label: 'InsideAUST', path: '/campus', icon: BookOpen, keywords: 'campus map canteen library seat insideaust' },
  { label: 'Community', path: '/community', icon: Users, keywords: 'community alumni clubs stories' },
  { label: 'Marketplace', path: '/marketplace', icon: ShoppingBag, keywords: 'marketplace buy sell exchange mentor' },
  { label: 'Daily Life', path: '/daily-life', icon: Home, keywords: 'daily life meals transport schedule mess meal' },
  { label: 'Cheatsheets', path: '/cheatsheets', icon: ScrollText, keywords: 'cheatsheets formulas quick reference' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'settings profile theme notifications' },
];

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const filteredItems = searchItems.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    );
  });

  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, filteredItems.length - 1));

  const handleSelect = useCallback((item) => {
    navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' && filteredItems[safeSelectedIndex]) {
        handleSelect(filteredItems[safeSelectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, safeSelectedIndex, onClose, handleSelect]);

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal glass-card-static" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, features..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button className="search-close-btn" onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>

        {filteredItems.length > 0 ? (
          <div className="search-results">
            {filteredItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  className={`search-result-item ${index === safeSelectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <span className="search-result-path">{item.path}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="search-empty">No results found for "{query}"</div>
        )}

        <div className="search-footer">
          <span className="search-hint">↑↓ to navigate</span>
          <span className="search-hint">↵ to select</span>
          <span className="search-hint">esc to close</span>
        </div>
      </div>
    </div>
  );
}
