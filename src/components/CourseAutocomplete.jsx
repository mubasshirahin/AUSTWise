import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { searchCourses } from '../data/courses';

/**
 * CourseAutocomplete Component
 * Provides autocomplete functionality for course selection
 * Supports bidirectional search - type course code to get name, or type name to get code
 */
export default function CourseAutocomplete({ 
  value, 
  onCourseSelect, 
  placeholder = 'Start typing course code or name...', 
  type = 'code', // 'code' or 'name' - determines what field is being edited
  disabled = false,
  className = '',
  department = null, // optional: 'CSE', 'EEE', etc. — filters suggestions to that dept
  showCredit = true // show credit in dropdown
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

  // Adjust local value when the prop changes — done during render per the
  // React docs ("adjusting state when props change") to avoid a second pass.
  const [prevValue, setPrevValue] = useState(value || '');
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value || '');
  }

  // State for portal positioning
  const [portalPosition, setPortalPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted] = useState(true);

  // Update portal position when suggestions are shown
  const updatePortalPosition = useCallback(() => {
    if (inputRef.current && showSuggestions) {
      const rect = inputRef.current.getBoundingClientRect();
      setPortalPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [showSuggestions]);

  useEffect(() => {
    if (showSuggestions && mounted) {
      updatePortalPosition();
      // Update position on scroll/resize
      window.addEventListener('scroll', updatePortalPosition, true);
      window.addEventListener('resize', updatePortalPosition);
      return () => {
        window.removeEventListener('scroll', updatePortalPosition, true);
        window.removeEventListener('resize', updatePortalPosition);
      };
    }
  }, [showSuggestions, mounted, updatePortalPosition]);

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
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          selectCourse(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle input change
  const handleInputChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    if (newValue.trim().length > 0) {
      const results = searchCourses(newValue, department, 50); // filtered by department
      setSuggestions(results);
      // Always show suggestions dropdown when typing (even if empty, to show "use custom" message)
      setShowSuggestions(true);
      setHighlightedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  // Select a course from suggestions
  const selectCourse = (course) => {
    const selectedValue = type === 'code' ? course.code : course.name;
    setInputValue(selectedValue);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    didSelectRef.current = true;
    onCourseSelect(course);
  };

  // Handle blur - save custom value if no suggestion selected
  const handleBlur = () => {
    // Reset the did select flag - will be set to true if a suggestion is clicked
    didSelectRef.current = false;
    
    // Delay to allow click on suggestion
    setTimeout(() => {
      // Only handle manual typing if no suggestion was clicked
      // Use refs to get current values instead of closure values (which would be stale)
      if (!didSelectRef.current && showSuggestionsRef.current && inputValueRef.current.trim()) {
        // Use typed value - only update the field being edited, don't overwrite the other field
        if (type === 'code') {
          // Only update code, keep existing name as-is
          onCourseSelect({ code: inputValueRef.current.trim(), partialUpdate: true, field: 'code' });
        } else {
          // Only update name, keep existing code as-is
          onCourseSelect({ name: inputValueRef.current.trim(), partialUpdate: true, field: 'name' });
        }
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
    onCourseSelect(null);
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
          alignItems: 'center'
        }}
      >
        <Search 
          size={16} 
          style={{ 
            position: 'absolute', 
            left: '12px', 
            color: 'var(--text-secondary)',
            pointerEvents: 'none'
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
          disabled={disabled}
          style={{ 
            paddingLeft: '36px',
            paddingRight: inputValue ? '36px' : '12px'
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
              borderRadius: '4px'
            }}
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showSuggestions && inputValue.trim().length > 0 && mounted && createPortal(
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
            suggestions.map((course, index) => (
              <li
                key={course.code}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectCourse(course);
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
                  WebkitUserSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span 
                    className="course-code"
                    style={{ 
                      fontWeight: 'var(--fw-semibold)', 
                      color: 'var(--accent-cyan)',
                      fontSize: 'var(--fs-sm)'
                    }}
                  >
                    {highlightMatch(course.code, inputValue)}
                  </span>
                  <span 
                    className="course-name"
                    style={{ 
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--fs-xs)',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}
                  >
                    {highlightMatch(course.name, inputValue)}
                  </span>
                  {showCredit && course.credit && (
                    <span 
                      className="course-credit"
                      style={{
                        color: 'var(--accent-amber)',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 'var(--fw-bold)',
                        background: 'var(--accent-amber-glow)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        flexShrink: 0
                      }}
                    >
                      {course.credit}
                    </span>
                  )}
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
                textAlign: 'center'
              }}
            >
              No matching courses found
            </li>
          )}
          {/* Custom value option - always show when typing */}
          <li
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (inputValue.trim()) {
                didSelectRef.current = true;
                if (type === 'code') {
                  onCourseSelect({ code: inputValue.trim(), partialUpdate: true, field: 'code' });
                } else {
                  onCourseSelect({ name: inputValue.trim(), partialUpdate: true, field: 'name' });
                }
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
              WebkitUserSelect: 'none'
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
