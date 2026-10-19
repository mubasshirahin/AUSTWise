import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, BookOpen, GraduationCap, Library, Users, ShoppingBag, Settings,
  LayoutDashboard, X, Home, NotebookPen, MessageSquare, Zap, Coffee, Moon, Crown, CornerDownLeft,
  FileSearch,
} from 'lucide-react';
import './SearchModal.css';

// Mirrors the sidebar: only pages reachable from the nav + their subpages.
const searchItems = [
  {
    label: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: 'home dashboard',
    subs: [
      { id: 'stats', label: 'Quick Stats', keywords: 'quick stats cgpa metrics' },
      { id: 'routine', label: 'Routine', keywords: 'routine weekly timetable' },
      { id: 'calendar', label: 'Semester View', keywords: 'semester view 14 week calendar' },
      { id: 'exams', label: 'Zero Hour', keywords: 'zero hour quiz mid final exams' },
      { id: 'attendance', label: 'Attendance', keywords: 'attendance semester progress' },
    ],
  },
  {
    label: 'Daily Life', path: '/daily-life', icon: Home, keywords: 'daily life meals transport schedule mess meal',
    subs: [
      { id: 'cover-page-generator', label: 'Cover Page', keywords: 'cover page generator' },
      { id: 'bhara-koto', label: 'Bhara Koto', keywords: 'bhara koto fare estimator distance cost transport rickshaw metro bus taxi' },
      { id: 'money-tracker', label: 'TakaGeloKoi', keywords: 'takagelokoi money tracker expenses budget' },
      { id: 'mess-meal', label: 'Mess Meal', keywords: 'mess meal planner food' },
      { id: 'life-planner', label: 'Life Planner', keywords: 'life planner goals habits week plan' },
    ],
  },
  { label: 'Notebook', path: '/notebook', icon: NotebookPen, keywords: 'notebook notes canvas whiteboard editor writing' },
  { label: 'Question Bank Analyzer', path: '/question-bank-analyzer', icon: FileSearch, keywords: 'question bank analyzer past papers exam questions vips priority study plan ai markdown pdf course' },
  { label: 'ConnectBox', path: '/messages', icon: MessageSquare, keywords: 'messages chat inbox dm' },
  {
    label: 'Productivity', path: '/productivity', icon: Zap, keywords: 'productivity focus timer flows',
    subs: [
      { id: 'study-room', label: 'Study Time', keywords: 'study time focus timer' },
      { id: 'cheatsheets', label: 'Cheat Sheets', keywords: 'cheat sheets formulas quick reference' },
      { id: 'cp-hub', label: 'Code Pulse', keywords: 'code pulse cp coding contests' },
      { id: 'workspace', label: 'Workspace', keywords: 'workspace google classroom' },
      { id: 'roast-cv', label: 'Roast CV', keywords: 'roast cv resume feedback' },
    ],
  },
  {
    label: 'DownTime', path: '/chill-zone', icon: Coffee, keywords: 'downtime chill zone relax games',
    subs: [
      { id: 'organizing', label: 'Organizing Area', keywords: 'organizing area plan organize' },
      { id: 'media', label: 'Media Tracker', keywords: 'media tracker movies shows' },
      { id: 'rumour', label: 'Rumour or Real', keywords: 'rumour or real fact fiction' },
      { id: 'trivia', label: 'Trivia', keywords: 'trivia brain quiz' },
      { id: 'gaming', label: 'Gaming Zone', keywords: 'gaming zone mini games' },
    ],
  },
  {
    label: 'Shadow', path: '/shadow', icon: Moon, keywords: 'shadow anonymous post',
    subs: [
      { id: 'reviews', label: 'Course Reviews', keywords: 'course reviews anonymous feedback' },
      { id: 'chat', label: 'Shadow Chat', keywords: 'shadow chat anonymous match' },
      { id: 'buzz', label: 'Buzz', keywords: 'buzz aust forum' },
    ],
  },
  { label: 'See Plans', path: '/pro', icon: Crown, keywords: 'pro plans pricing premium upgrade' },
  {
    label: 'GradeLab', path: '/analytics', icon: GraduationCap, keywords: 'analytics grades cgpa grade',
    subs: [
      { id: 'cgpagraph', label: 'CGPA Calculator', keywords: 'cgpa calculator grade trends gpa' },
      { id: 'semestertracker', label: 'Semester Wise', keywords: 'semester wise grades per semester' },
      { id: 'heatmap', label: 'Dept Heatmap', keywords: 'department heatmap average cgpa' },
      { id: 'bestworst', label: 'Best & Worst', keywords: 'best worst course poll' },
      { id: 'prereqs', label: 'Prerequisites', keywords: 'prerequisites course flow map' },
    ],
  },
  {
    label: 'Resource Vault', path: '/vault', icon: Library, keywords: 'vault resources notes questions',
    subs: [
      { id: 'batch-drive', label: 'Batch Drive', keywords: 'batch drive study materials notes' },
      { id: 'carbon-vault', label: 'Carbon Vault', keywords: 'carbon vault emissions tracker' },
    ],
  },
  {
    label: 'InsideAUST', path: '/campus', icon: BookOpen, keywords: 'campus map canteen library seat insideaust',
    subs: [
      { id: 'map', label: 'Floor Map', keywords: 'floor map building layout' },
      { id: 'library', label: 'Library Pulse', keywords: 'library pulse occupancy seat' },
      { id: 'canteen', label: 'Canteen Menu', keywords: 'canteen menu food today' },
      { id: 'bus', label: 'Bus Tracker', keywords: 'bus tracker shuttle routes' },
      { id: 'classroom', label: 'Free Rooms', keywords: 'free rooms empty classroom available' },
    ],
  },
  {
    label: 'Community', path: '/community', icon: Users, keywords: 'community alumni clubs stories',
    subs: [
      { id: 'alumni', label: 'Alumni Directory', keywords: 'alumni directory connect' },
      { id: 'clubs', label: 'Clubs Hub', keywords: 'clubs hub join student clubs' },
      { id: 'students', label: 'Student Directory', keywords: 'student directory classmates' },
      { id: 'mentorRequests', label: 'Mentor Requests', keywords: 'mentor requests study buddies' },
    ],
  },
  {
    label: 'Marketplace', path: '/marketplace', icon: ShoppingBag, keywords: 'marketplace buy sell exchange mentor',
    subs: [
      { id: 'exchange', label: 'AW Market', keywords: 'aw market trade books equipment' },
      { id: 'tolet', label: 'ToLet Mama', keywords: 'tolet mama bachelor sharing hosts' },
      { id: 'lost', label: 'Lost & Found', keywords: 'lost found locate products' },
    ],
  },
  {
    label: 'Settings', path: '/settings', icon: Settings, keywords: 'settings profile theme notifications',
    subs: [
      { id: 'profile', label: 'Identity', keywords: 'identity profile academic info' },
      { id: 'theme', label: 'UI', keywords: 'ui themes appearance' },
      { id: 'notifications', label: 'Configure', keywords: 'notifications alerts reminders' },
      { id: 'about', label: 'Credits', keywords: 'credits developer info about' },
      { id: 'roleApplication', label: 'Apply for CR/SR', keywords: 'apply cr sr leadership role' },
      { id: 'invite', label: 'Invite Member', keywords: 'invite member send invites' },
    ],
  },
];

// Wrap matched query substring in <mark>
function Highlight({ text, query }) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Flatten into a navigable list of (item, sub|null)
  const results = searchItems.flatMap((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return [{ item, sub: null }];

    const itemHit = (
      item.label.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    );

    if (item.subs?.length) {
      const matchedSubs = item.subs
        .filter((s) => s.label.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q))
        .map((s) => ({ item, sub: s }));
      // If parent hit, show it first; if only subs hit, show just the subs.
      return itemHit ? [{ item, sub: null }, ...matchedSubs] : matchedSubs;
    }
    return itemHit ? [{ item, sub: null }] : [];
  });

  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  const handleSelect = useCallback(({ item, sub }) => {
    navigate(sub ? `${item.path}?tab=${sub.id}` : item.path);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && results[safeSelectedIndex]) {
        handleSelect(results[safeSelectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, safeSelectedIndex, onClose, handleSelect]);

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <Search size={20} className="search-icon" />
          <input
            id="global-search-input"
            name="globalSearch"
            ref={inputRef}
            type="text"
            placeholder="Search pages, features..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-esc-hint">esc</span>
          <button className="search-close-btn" onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>

        {results.length > 0 ? (
          <div className="search-results" role="listbox">
            {results.map(({ item, sub }, index) => {
              const Icon = sub ? item.icon : item.icon;
              const selected = index === safeSelectedIndex;
              return (
                <button
                  key={sub ? `${item.path}/${sub.id}` : item.path}
                  role="option"
                  aria-selected={selected}
                  className={`search-result-item ${sub ? 'is-sub' : ''} ${selected ? 'selected' : ''}`}
                  onClick={() => handleSelect({ item, sub })}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="search-result-icon">
                    <Icon size={16} />
                  </span>
                  <span className="search-result-label">
                    {sub ? (
                      <>
                        <Highlight text={item.label} query={query.trim()} />
                        <span className="search-result-sep">/</span>
                        <Highlight text={sub.label} query={query.trim()} />
                      </>
                    ) : (
                      <Highlight text={item.label} query={query.trim()} />
                    )}
                  </span>
                  <span className="search-result-path">
                    <Highlight text={sub ? item.path : item.path} query={query.trim()} />
                  </span>
                  {selected && <CornerDownLeft size={14} className="search-result-enter" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="search-empty">
            <Search size={28} className="search-empty-icon" />
            <p>No results for <strong>"{query}"</strong></p>
          </div>
        )}

        <div className="search-footer">
          <span className="search-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span className="search-hint"><kbd>↵</kbd> select</span>
          <span className="search-hint"><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
