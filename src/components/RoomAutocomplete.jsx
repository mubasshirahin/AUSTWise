import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X } from 'lucide-react';

/**
 * Campus room layout — every floor from 2 to 9 has three blocks:
 *   A Block: classrooms XA03 – XA07
 *   B Block: labs       XB01 – XB08
 *   C Block: classrooms XC03 – XC07
 * Only the leading floor digit changes between floors.
 */
const ROOM_FLOORS = [2, 3, 4, 5, 6, 7, 8, 9];
const ROOM_BLOCKS = [
  { block: 'A', from: 3, to: 7 },
  { block: 'B', from: 1, to: 8 },
  { block: 'C', from: 3, to: 7 },
];

const ROOM_SUGGESTIONS = (() => {
  const rooms = [];
  for (const floor of ROOM_FLOORS) {
    for (const { block, from, to } of ROOM_BLOCKS) {
      for (let n = from; n <= to; n += 1) {
        rooms.push(`${floor}${block}${String(n).padStart(2, '0')}`);
      }
    }
  }
  return rooms;
})();

/**
 * RoomAutocomplete Component
 * Suggests campus room codes while typing (e.g. 7A03, 7B01, 7C07) and lets
 * the user pick a suggestion OR type any custom room value.
 */
export default function RoomAutocomplete({
  value,
  onRoomSelect,
  placeholder = 'e.g. 7A03 — choose a room or type your own...',
  className = '',
}) {
  const [inputValue, setInputValue] = useState(value || '');
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

  // Update local value when prop changes (render-phase sync — mirrors
  // CourseAutocomplete without a cascading setState inside an effect)
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
          selectRoom(suggestions[highlightedIndex]);
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

  // Handle input change — filter suggestions
  const handleInputChange = (event) => {
    const newValue = event.target.value.toUpperCase();
    setInputValue(newValue);

    if (newValue.trim().length > 0) {
      const q = newValue.trim().toLowerCase();
      const results = ROOM_SUGGESTIONS.filter(room => room.toLowerCase().includes(q));
      setSuggestions(results);
      setShowSuggestions(true);
      setHighlightedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  // Select a room from suggestions
  const selectRoom = (room) => {
    setInputValue(room);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    didSelectRef.current = true;
    onRoomSelect(room);
  };

  // Commit a custom typed value on blur (when nothing was selected)
  const handleBlur = () => {
    didSelectRef.current = false;

    // Delay to allow click on suggestion
    setTimeout(() => {
      if (!didSelectRef.current && showSuggestionsRef.current && inputValueRef.current.trim()) {
        onRoomSelect(inputValueRef.current.trim());
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
    onRoomSelect('');
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
        <MapPin
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
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            maxHeight: '240px',
            overflowY: 'auto',
            overflowX: 'visible',
            zIndex: 1000000,
            listStyle: 'none',
            padding: '4px',
            margin: 0,
          }}
        >
          {suggestions.length > 0 ? (
            suggestions.map((room, index) => (
              <li
                key={room}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectRoom(room);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  backgroundColor: index === highlightedIndex ? 'var(--accent-cyan-glow)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                  borderBottom: '1px solid var(--border-secondary)',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontWeight: 'var(--fw-semibold)',
                      color: 'var(--accent-cyan)',
                      fontSize: 'var(--fs-sm)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {highlightMatch(room, inputValue)}
                  </span>
                  <span
                    style={{
                      color: 'var(--text-tertiary)',
                      fontSize: 'var(--fs-xs)',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {room[1] === 'B' ? 'Lab' : 'Classroom'}
                  </span>
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
              No matching rooms found
            </li>
          )}
          {/* Custom value option - always show when typing */}
          <li
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (inputValue.trim()) {
                didSelectRef.current = true;
                onRoomSelect(inputValue.trim());
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
                + Add custom room: <strong>{inputValue.trim()}</strong>
              </span>
            </div>
          </li>
        </ul>,
        document.body
      )}
    </div>
  );
}
