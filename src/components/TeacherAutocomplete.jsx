import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, X } from 'lucide-react';
import { getAllAccounts } from '../utils/authStorage';

/**
 * TeacherAutocomplete Component
 * Suggests registered faculty members (role: 'faculty') while typing a teacher
 * name — each suggestion shows their photo, name and department. Faculty who
 * haven't registered yet can still be added as a custom value.
 *
 * Faculty list = localStorage accounts ∪ server member list (deduped by email).
 */
const AVATAR_STYLE = { width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };

function initialsOf(name) {
  const n = String(name || '').trim();
  if (!n) return '?';
  return n.slice(0, 2).toUpperCase();
}

async function loadFacultyList() {
  const byEmail = new Map();
  const push = (m) => {
    const email = String(m.email || '').trim().toLowerCase();
    if (email) byEmail.set(email, m);
  };

  // 1) Registered accounts stored locally (works offline / server down)
  try {
    getAllAccounts()
      .filter((a) => a.role === 'faculty')
      .forEach(push);
  } catch { /* best effort */ }

  // 2) Server member list — authoritative for registered faculty
  try {
    const res = await fetch('/api/presence/members', { credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    if (data?.success && Array.isArray(data.members)) {
      data.members.filter((m) => m.role === 'faculty').forEach(push);
    }
  } catch { /* server not reachable — keep local list */ }

  return [...byEmail.values()]
    .filter((m) => m && String(m.name || '').trim())
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar || null,
      department: m.department || '',
      designation: m.designation || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function TeacherAutocomplete({
  value,
  onTeacherSelect,
  placeholder = 'Type teacher name (e.g. Dr. Rahman)...',
  className = '',
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [faculty, setFaculty] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const showSuggestionsRef = useRef(false);
  const inputValueRef = useRef('');
  const didSelectRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    showSuggestionsRef.current = showSuggestions;
    inputValueRef.current = inputValue;
  });

  // Load registered faculty once on mount
  useEffect(() => {
    let cancelled = false;
    loadFacultyList().then((list) => {
      if (!cancelled) setFaculty(list);
    });
    return () => { cancelled = true; };
  }, []);

  // Update local value when prop changes (render-phase sync)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value || '');
  }

  // State for portal positioning
  const [portalPosition, setPortalPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update portal position when suggestions are shown
  const updatePortalPosition = useCallback(() => {
    if (inputRef.current && showSuggestions) {
      const rect = inputRef.current.getBoundingClientRect();
      setPortalPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showSuggestions]);

  useEffect(() => {
    if (showSuggestions) {
      updatePortalPosition();
      window.addEventListener('scroll', updatePortalPosition, true);
      window.addEventListener('resize', updatePortalPosition);
      return () => {
        window.removeEventListener('scroll', updatePortalPosition, true);
        window.removeEventListener('resize', updatePortalPosition);
      };
    }
  }, [showSuggestions, updatePortalPosition]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          selectTeacher(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Handle input change — filter faculty by name / department
  const handleInputChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    if (newValue.trim().length > 0) {
      const q = newValue.trim().toLowerCase();
      const results = faculty.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q) ||
        (m.designation || '').toLowerCase().includes(q)
      );
      setSuggestions(results);
      setShowSuggestions(true);
      setHighlightedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  // Select a faculty member from suggestions
  const selectTeacher = (member) => {
    setInputValue(member.name);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    didSelectRef.current = true;
    onTeacherSelect(member.name);
  };

  // Commit a custom typed value on blur (when nothing was selected)
  const handleBlur = () => {
    didSelectRef.current = false;

    // Delay to allow click on suggestion
    setTimeout(() => {
      if (!didSelectRef.current && showSuggestionsRef.current && inputValueRef.current.trim()) {
        onTeacherSelect(inputValueRef.current.trim());
      }
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  // Clear the input
  const handleClear = (event) => {
    if (event) event.stopPropagation();
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    onTeacherSelect('');
    inputRef.current?.focus();
  };

  // Highlight matching text in suggestion
  const highlightMatch = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ backgroundColor: 'var(--accent-cyan-glow)', color: 'var(--accent-cyan)', padding: '0 1px', borderRadius: '2px' }}>{part}</mark>
        : part
    );
  };

  return (
    <div
      ref={wrapperRef}
      className={`course-autocomplete-wrapper ${className}`}
      style={{ position: 'relative' }}
    >
      <div
        className="course-autocomplete-input-wrapper"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <GraduationCap
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            color: 'var(--text-secondary)',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          className="input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            paddingLeft: '36px',
            paddingRight: inputValue ? '36px' : '12px',
          }}
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              borderRadius: '4px',
            }}
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showSuggestions && inputValue.trim().length > 0 && createPortal(
        <ul
          className="course-autocomplete-suggestions"
          style={{
            position: 'fixed',
            top: `${portalPosition.top}px`,
            left: `${portalPosition.left}px`,
            width: `${portalPosition.width}px`,
            background: '#1a1a24',
            backgroundColor: '#1a1a24',
            border: '1px solid #2a2a36',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            maxHeight: '240px',
            overflowY: 'auto',
            overflowX: 'visible',
            zIndex: 1000000,
            listStyle: 'none',
            padding: '4px',
            margin: 0,
            opacity: 1,
          }}
        >
          {suggestions.length > 0 ? (
            suggestions.map((member, index) => (
              <li
                key={member.id || member.email || member.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectTeacher(member);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  backgroundColor: index === highlightedIndex ? 'var(--accent-cyan-glow)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                  borderBottom: '1px solid var(--border-secondary)',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {member.avatar ? (
                    <img src={member.avatar} alt="" style={AVATAR_STYLE} />
                  ) : (
                    <span
                      style={{
                        ...AVATAR_STYLE,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--accent-blue-glow)',
                        color: 'var(--accent-blue)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}
                    >
                      {initialsOf(member.name)}
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 'var(--fw-semibold)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--fs-sm)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {highlightMatch(member.name, inputValue)}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--fs-xs)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {[member.department, member.designation].filter(Boolean).join(' • ') || 'Faculty'}
                    </div>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li
              style={{
                padding: '10px 12px',
                color: 'var(--text-secondary)',
                fontSize: 'var(--fs-xs)',
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              No registered faculty found
            </li>
          )}
          {/* Custom value option - always show when typing */}
          <li
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (inputValue.trim()) {
                didSelectRef.current = true;
                onTeacherSelect(inputValue.trim());
                setShowSuggestions(false);
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderRadius: '6px',
              backgroundColor: 'var(--accent-green-glow)',
              border: '1px dashed var(--accent-green)',
              color: 'var(--accent-green)',
              marginTop: suggestions.length > 0 ? '4px' : '0',
              textAlign: 'center',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>
                + Add custom: <strong>{inputValue.trim()}</strong>
              </span>
            </div>
          </li>
        </ul>,
        document.body
      )}
    </div>
  );
}
