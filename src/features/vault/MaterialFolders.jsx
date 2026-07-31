import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder, Plus, Loader2, AlertCircle, RefreshCw, Link, X, Download, Eye, EyeOff,
  ChevronRight, Home, Search, Grid3X3, List, File,
  ExternalLink, Maximize2, Minimize2, ChevronLeft,
  ChevronsLeft, BookOpen, Clock, HardDrive, FileType,
  ZoomIn, ZoomOut, StickyNote, Trash2, Edit3, Save,
  Square, Circle, Pencil, Minus,
  Music, Play, Pause, PlayCircle, Bot, Send, PanelRightOpen, PanelRightClose,
  Upload, FileText, CheckCircle, AlertTriangle as AlertTri,
} from 'lucide-react';
import {
  extractFolderId,
  fetchDriveFolderFiles,
  getFileCategory,
  formatFileSize,
  getCourseFolderUrl,
  saveCourseFolderUrl,
  getSemesterFolderUrl,
  saveSemesterFolderUrl,
} from '../../utils/googleDrive';
import {
  getAnnotations,
  addAnnotation,
  updateAnnotation,
  updateAnnotationData,
  removeAnnotation,
} from '../../utils/annotationsStorage';
import { updateBatchDriveUrl } from '../../utils/vaultBatchStorage';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import './MaterialFolders.css';

// Use the Google API credential from env to access public Drive folders
// No OAuth login needed — works for folders shared with "Anyone with the link"
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

/* ─── Colour palette for each file category ─── */
const CATEGORY_META = {
  folder:      { color: 'var(--accent-blue)',    glow: 'var(--accent-blue-glow)',     icon: '\u{1F4C1}',   label: 'Folder' },
  pdf:         { color: 'var(--accent-rose)',     glow: 'var(--accent-rose-glow)',     icon: '\u{1F4C4}',   label: 'PDF' },
  image:       { color: 'var(--accent-purple)',   glow: 'var(--accent-purple-glow)',   icon: '\u{1F5BC}\uFE0F',   label: 'Image' },
  video:       { color: 'var(--accent-amber)',    glow: 'var(--accent-amber-glow)',    icon: '\u{1F3AC}',   label: 'Video' },
  spreadsheet: { color: 'var(--accent-emerald)',  glow: 'var(--accent-emerald-glow)',  icon: '\u{1F4CA}',   label: 'Sheet' },
  document:    { color: 'var(--accent-blue)',     glow: 'var(--accent-blue-glow)',     icon: '\u{1F4DD}',   label: 'Doc' },
  presentation:{ color: '#f97316',                glow: 'rgba(249,115,22,0.15)',       icon: '\u{1F4FD}\uFE0F',   label: 'Slides' },
  archive:     { color: 'var(--text-tertiary)',   glow: 'var(--bg-secondary)',         icon: '\u{1F4E6}',   label: 'Archive' },
  other:       { color: 'var(--text-tertiary)',   glow: 'var(--bg-secondary)',         icon: '\u{1F4CE}',   label: 'Other' },
};

// ─── Single file-type icon component ───
function FileTypeIcon({ category, size = 40, variant = 'grid' }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;

  return (
    <div
      className={`mf-file-list-icon mf-file-list-icon-${category}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
      }}
    >
      {variant === 'grid' ? (
        <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{meta.icon}</span>
      ) : (
        <span style={{ fontSize: size * 0.45, lineHeight: 1 }}>{meta.icon}</span>
      )}
    </div>
  );
}

// ─── File type badge ───
function FileTypeBadge({ category, small }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  return (
    <span className={`mf-file-grid-badge mf-file-grid-badge-${category}`}>
      {meta.label}
    </span>
  );
}

// ─── Loading skeleton ───
function FileSkeleton() {
  return (
    <div className="mf-skeleton-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="mf-skeleton-card">
          <div className="mf-skeleton-thumb" />
          <div className="mf-skeleton-body">
            <div className="mf-skeleton-line" style={{ width: '80%' }} />
            <div className="mf-skeleton-line-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SIDE PANEL — Music · YouTube · Gemini
   ═══════════════════════════════════════════════════════════════════════ */

// ─── Free lofi study tracks ───
const LOFI_TRACKS = [
  { name: 'lofi beats',        artist: 'lofi girl',        url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1' },
  { name: 'lofi hip hop radio', artist: 'ChilledCow',     url: 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&enablejsapi=1' },
  { name: 'calm piano',        artist: 'Music for study', url: 'https://www.youtube.com/embed/BHa6TOMAf_k?autoplay=1&enablejsapi=1' },
  { name: 'rain sounds',       artist: 'Nature Sounds',   url: 'https://www.youtube.com/embed/mPZkdNFkNps?autoplay=1&enablejsapi=1' },
  { name: 'deep focus',        artist: 'ADHD Relief',     url: 'https://www.youtube.com/embed/TN6WSSVnQvo?autoplay=1&enablejsapi=1' },
];

// ─── Mini Music Player ───
function MusicPlayer() {
  const [playing, setPlaying] = useState(null);

  return (
    <div className="mf-music-player">
      <div className="mf-music-header">
        <Music size={14} />
        <span>Background Music</span>
      </div>
      <div className="mf-music-track-list">
        {LOFI_TRACKS.map((track, idx) => (
          <div key={idx} className={`mf-music-track ${playing === idx ? 'playing' : ''}`}
            onClick={() => setPlaying(playing === idx ? null : idx)}>
            <div className="mf-music-track-play">
              {playing === idx ? <Pause size={12} /> : <Play size={12} />}
            </div>
            <div className="mf-music-track-info">
              <div className="mf-music-track-name">{track.name}</div>
              <div className="mf-music-track-artist">{track.artist}</div>
            </div>
          </div>
        ))}
      </div>
      {playing !== null && (
        <div style={{width:'100%',height:'120px',borderRadius:'var(--radius-md)',overflow:'hidden',background:'#000'}}>
          <iframe src={LOFI_TRACKS[playing].url.replace('autoplay=1','autoplay=1&mute=1')}
            width="100%" height="100%" title="music" allow="autoplay;encrypted-media" />
        </div>
      )}
    </div>
  );
}

// ─── YouTube Player — Full Search + Player App ───
function YouTubeSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef(null);
  const suggestRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch suggestions with debounce
  const fetchSuggestions = (val) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch('/api/youtube/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: val.trim() }),
        });
        const data = await res.json();
        if (data.success && data.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!playingVideo) {
      fetchSuggestions(val);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    // Auto-search on suggestion click
    doSearch(suggestion);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (searchTerm) => {
    const term = searchTerm || query.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setPlayingVideo(null);
    setShowSuggestions(false);
    setSuggestions([]);
    try {
      const res = await apiFetch('/api/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Search failed: ${res.status}`);
      }
      setResults(data.items || []);
      if (data.items?.length === 0) {
        setError('No videos found for "' + term + '"');
      }
    } catch (err) {
      setError(err.message || 'Failed to search YouTube');
    } finally {
      setLoading(false);
    }
  };

  const searchVideos = (e) => {
    e?.preventDefault();
    doSearch();
  };

  const playVideo = (video) => {
    setPlayingVideo(video);
    setShowSuggestions(false);
  };

  const goBack = () => {
    setPlayingVideo(null);
  };

  return (
    <div className="mf-yt-panel">
      {/* Search Bar with Suggestions */}
      <div className="mf-yt-search-wrapper" ref={suggestRef}>
        <form className="mf-yt-search-bar" onSubmit={searchVideos}>
          <Search size={16} className="mf-yt-search-bar-icon" />
          <input
            ref={inputRef}
            type="text"
            className="mf-yt-search-bar-input"
            placeholder="Search YouTube for lectures, tutorials..."
            value={query}
            onChange={handleInputChange}
            onFocus={() => { if (suggestions.length > 0 && !playingVideo) setShowSuggestions(true); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowSuggestions(false); }}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !query.trim()}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </form>
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && !playingVideo && (
          <div className="mf-yt-suggestions">
            {suggestions.map((s, i) => (
              <div key={i} className="mf-yt-suggestion" onClick={() => handleSuggestionClick(s)}>
                <Search size={12} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && !loading && (
        <div className="mf-yt-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mf-yt-loading">
          <Loader2 size={28} className="animate-spin" />
          <span>Searching YouTube...</span>
        </div>
      )}

      {/* Currently Playing View */}
      {playingVideo ? (
        <div className="mf-yt-playing">
          <div className="mf-yt-player-embed">
            <iframe
              src={`https://www.youtube.com/embed/${playingVideo.id.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={playingVideo.snippet.title}
              allow="accelerometer;autoplay;encrypted-media;gyroscope"
              allowFullScreen
            />
          </div>
          <div className="mf-yt-player-info">
            <div className="mf-yt-player-title">{playingVideo.snippet.title}</div>
            <div className="mf-yt-player-channel">
              <PlayCircle size={12} />
              {playingVideo.snippet.channelTitle}
            </div>
          </div>
          <div className="mf-yt-player-actions">
            <button className="btn btn-ghost btn-sm" onClick={goBack}>
              <ChevronsLeft size={14} /> Back to results
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setResults([]); setError(null); }}>
              <X size={14} /> Clear
            </button>
          </div>
        </div>
      ) : !loading && results.length > 0 ? (
        /* Results Grid */
        <div className="mf-yt-results">
          <div className="mf-yt-results-count">{results.length} result{results.length !== 1 ? 's' : ''}</div>
          <div className="mf-yt-results-grid">
            {results.map(video => (
              <div key={video.id.videoId} className="mf-yt-result" onClick={() => playVideo(video)}>
                <div className="mf-yt-result-thumb">
                  <img
                    src={video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url}
                    alt={video.snippet.title}
                    loading="lazy"
                  />
                  <div className="mf-yt-result-play-overlay">
                    <Play size={28} />
                  </div>
                </div>
                <div className="mf-yt-result-info">
                  <div className="mf-yt-result-title">{video.snippet.title}</div>
                  <div className="mf-yt-result-channel">{video.snippet.channelTitle}</div>
                  <div className="mf-yt-result-date">
                    {new Date(video.snippet.publishTime).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !error ? (
        /* Welcome State */
        <div className="mf-yt-welcome">
          <div className="mf-yt-welcome-icon">
            <PlayCircle size={56} />
          </div>
          <h3 className="mf-yt-welcome-title">YouTube Search</h3>
          <p className="mf-yt-welcome-desc">
            Search for study videos, lectures, tutorials and watch them directly right here!
          </p>
          <div className="mf-yt-welcome-tips">
            <div className="mf-yt-welcome-tip">
              <Search size={12} />
              <span>Type a topic above to search</span>
            </div>
            <div className="mf-yt-welcome-tip">
              <Play size={12} />
              <span>Click any video to play instantly</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Left-side YouTube Sidebar wrapper ───
function YTSidebar() {
  return (
    <div className="mf-yt-sidebar">
      <div className="mf-yt-sidebar-header">
        <PlayCircle size={16} />
        <span>YouTube</span>
      </div>
      <div className="mf-yt-sidebar-content">
        <YouTubeSearch />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PDF.js LOCAL VIEWER — inline copy/paste support, no iframe/CSP issues
   ═══════════════════════════════════════════════════════════════════════ */

function PDFPreview({ fileId, annotMode }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.2);
  const containerRef = useRef(null);
  const pagesContainerRef = useRef(null);
  const pdfIdRef = useRef(fileId);

  // Load PDF document
  useEffect(() => {
    let dead = false;
    pdfIdRef.current = fileId;
    setLoading(true);
    setError(null);
    setPdfDoc(null);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

        const res = await apiFetch(`/api/proxy/pdf?id=${fileId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch PDF (${res.status})`);
        }
        const buf = await res.arrayBuffer();
        if (dead) return;

        const doc = await pdfjs.getDocument({ data: buf }).promise;
        if (dead) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err) {
        if (!dead) setError(err.message || 'Failed to load PDF');
      } finally {
        if (!dead) setLoading(false);
      }
    })();

    return () => { dead = true; };
  }, [fileId]);

  // Render all pages continuously
  useEffect(() => {
    if (!pdfDoc || !pagesContainerRef.current) return;
    let dead = false;

    const renderAllPages = async () => {
      const container = pagesContainerRef.current;
      if (!container) return;

      container.innerHTML = '';
      container.scrollTop = 0; // Force scroll to top

      for (let i = 1; i <= totalPages; i++) {
        if (dead) return;

        try {
          const page = await pdfDoc.getPage(i);
          if (dead) return;

          const viewport = page.getViewport({ scale });

          // Create page wrapper
          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'mf-pdf-page-item';
          pageWrapper.style.width = viewport.width + 'px';
          pageWrapper.style.height = viewport.height + 'px';
          pageWrapper.style.position = 'relative';
          pageWrapper.style.margin = '0 auto 8px';
          pageWrapper.style.background = 'white';
          pageWrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          pageWrapper.style.borderRadius = '4px';
          pageWrapper.style.overflow = 'hidden';

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = 'block';
          pageWrapper.appendChild(canvas);

          // Render page
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (dead) return;

          // Add page number label
          const pageLabel = document.createElement('div');
          pageLabel.className = 'mf-pdf-page-label';
          pageLabel.textContent = `${i} / ${totalPages}`;
          pageLabel.style.cssText = 'position:absolute;bottom:4px;right:8px;font-size:10px;color:rgba(0,0,0,0.4);background:rgba(255,255,255,0.8);padding:2px 6px;border-radius:3px;font-family:system-ui;';
          pageWrapper.appendChild(pageLabel);

          container.appendChild(pageWrapper);
        } catch (err) {
          console.error(`Failed to render page ${i}:`, err);
        }
      }

      // Force scroll to top after all pages rendered
      if (!dead) {
        container.scrollTop = 0;
      }
    };

    renderAllPages();

    return () => { dead = true; };
  }, [pdfDoc, totalPages, scale]);

  if (loading) {
    return (
      <div className="mf-pdf-status">
        <Loader2 size={28} className="animate-spin" />
        <span>Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mf-pdf-status mf-pdf-status-error">
        <AlertCircle size={24} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="mf-pdf-viewer" ref={containerRef}>
      <div className="mf-pdf-topbar">
        <div className="mf-pdf-nav">
          <span className="mf-pdf-pg">{totalPages} pages</span>
        </div>
        <div className="mf-pdf-zoom">
          <button className="mf-pdf-btn" onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}>
            <ZoomOut size={14} />
          </button>
          <span className="mf-pdf-pg">{Math.round(scale * 100)}%</span>
          <button className="mf-pdf-btn" onClick={() => setScale(s => Math.min(4, +(s + 0.25).toFixed(2)))}>
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      <div className="mf-pdf-pages-scroll" ref={pagesContainerRef}>
        {/* Pages rendered here */}
      </div>
    </div>
  );
}

// ─── Gemini AI Chat — server key, no user API key needed ───
function GeminiChat() {
  const STORAGE_KEY = 'gemini_chat_history';

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{ role: 'model', text: "Hi! I'm Gemini. Ask me anything about your studies! 😊" }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState(false);
  const chatRef = useRef(null);

  // Persist messages to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const clearChat = () => {
    const welcome = [{ role: 'model', text: "Hi! I'm Gemini. Ask me anything about your studies! 😊" }];
    setMessages(welcome);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(welcome)); } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setError('');

    const updatedMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Convert our message format to Gemini API format
      const geminiContents = updatedMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      const res = await apiFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: geminiContents }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();

      if (data.success && data.reply) {
        setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
      } else {
        const errMsg = data.error || 'No response from Gemini.';
        if (errMsg.includes('not configured') || errMsg.includes('GEMINI_API_KEY')) {
          setServerError(true);
          setError('Gemini AI is not configured on the server yet.');
        } else {
          setError(errMsg);
          setMessages(prev => [...prev, { role: 'model', text: `⚠️ ${errMsg}` }]);
        }
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to send message.';
      setError(errMsg);
      setMessages(prev => [...prev, { role: 'model', text: `⚠️ Connection error: ${errMsg}.` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (serverError) {
    return (
      <div className="mf-gemini-api-setup">
        <Bot size={32} />
        <p><strong>Gemini AI Assistant</strong></p>
        <p style={{fontSize:'10px',color:'var(--accent-rose)',lineHeight:1.5}}>
          ⚠️ Gemini AI is not configured yet.
        </p>
        <p style={{fontSize:'9px',color:'var(--text-tertiary)',lineHeight:1.5}}>
          Server e GEMINI_API_KEY set kora hoyni. Admin ke janaben.
        </p>
      </div>
    );
  }

  return (
    <div className="mf-gemini-chat">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:'var(--fs-xs)',fontWeight:'var(--fw-semibold)',display:'flex',alignItems:'center',gap:'4px',color:'var(--accent-purple)'}}>
          <Bot size={12} /> Gemini Study Assistant
        </span>
        <button className="btn btn-ghost btn-sm" onClick={clearChat} title="Clear conversation"
          style={{fontSize:'9px',padding:'2px 6px'}}>
          Clear
        </button>
      </div>

      <div className="mf-gemini-messages" ref={chatRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`mf-gemini-msg ${msg.role === 'user' ? 'user' : ''}`}>
            <div className="mf-gemini-msg-avatar">
              {msg.role === 'user' ? '\u{1F464}' : '\u{1F916}'}
            </div>
            <div className="mf-gemini-msg-bubble">
              {msg.text.split('\n').map((line, j) => (
                <span key={j}>{line}<br /></span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mf-gemini-msg">
            <div className="mf-gemini-msg-avatar">🤖</div>
            <div className="mf-gemini-msg-bubble" style={{color:'var(--text-tertiary)',display:'flex',alignItems:'center',gap:'8px'}}>
              <Loader2 size={12} className="animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>

      {error && !loading && (
        <div style={{fontSize:'9px',color:'var(--accent-rose)',padding:'4px 0'}}>⚠️ {error}</div>
      )}

      <div className="mf-gemini-input-wrap">
        <textarea
          className="mf-gemini-input"
          rows="2"
          placeholder="Ask any study question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{alignSelf:'flex-end'}}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}

// ─── Layout toggles (right side panel) ───
const PANEL_TABS = [
  { id: 'music',   icon: Music,     label: 'Music' },
  { id: 'gemini',  icon: Bot,       label: 'Gemini' },
];

/* ═══════════════════════════════════════════════════════════════════════
   FILE PREVIEW MODAL — with full annotation toolbox
   Tools: marker, rectangle, circle, pencil
   ═══════════════════════════════════════════════════════════════════════ */

const ANNOT_COLORS = ['#fde68a','#fecaca','#bfdbfe','#bbf7d0','#e9d5ff','#fed7aa','#a5f3fc','#fbcfe8','#fef08a','#fdba74'];
const ANNOT_TOOLS = [
  { id: 'marker',    icon: StickyNote,    label: 'Marker' },
  { id: 'rect',      icon: Square,        label: 'Rectangle' },
  { id: 'circle',    icon: Circle,        label: 'Circle' },
  { id: 'pencil',    icon: Pencil,        label: 'Freehand' },
];

function FilePreviewModal({ files, currentIndex, setCurrentIndex, onClose }) {
  const file = files[currentIndex];
  const category = getFileCategory(file.mimeType);
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const fileId = file.id;

  const [zoomed, setZoomed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const modalRef = useRef(null);
  const bodyRef = useRef(null);

  // ─── Annotation state ───
  const [annotMode, setAnnotMode] = useState(false);
  const [tool, setTool] = useState('marker');
  const [color, setColor] = useState(ANNOT_COLORS[0]);
  const [strokeW, setStrokeW] = useState(2);
  const [annotations, setAnnotations] = useState(() => getAnnotations(fileId));
  const [activeNote, setActiveNote] = useState(null); // { id, editing }
  const [editContent, setEditContent] = useState('');

  // ─── Side panel state ───
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState('music');
  const [showYT, setShowYT] = useState(false); // left-side YouTube panel

  // ─── View mode state ───
  const [showAnnotations, setShowAnnotations] = useState(true);

  // ─── Drawing state ───
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStart = useRef(null);
  const [liveShape, setLiveShape] = useState(null); // for live preview while dragging
  const svgRef = useRef(null);

  // Reload annotations when file changes
  useEffect(() => {
    setAnnotations(getAnnotations(fileId));
    setAnnotMode(false);
    setTool('marker');
    setActiveNote(null);
    setEditContent('');
    setShowAnnotations(true);
  }, [fileId]);

  const annotCount = annotations.length;
  const supportsAnnot = ['pdf', 'image', 'document', 'spreadsheet', 'presentation'].includes(category);
  const isImage = category === 'image';

  // ─── Lock body scroll when modal is open ───
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const originalOverflow = body.style.overflow;
    const originalPosition = body.style.position;
    const originalTop = body.style.top;
    const originalWidth = body.style.width;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = originalOverflow;
      body.style.position = originalPosition;
      body.style.top = originalTop;
      body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // ─── Keyboard ───
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          return;
        }
        if (activeNote) { setActiveNote(null); setEditContent(''); return; }
        if (isDrawing) { setIsDrawing(false); setLiveShape(null); return; }
        if (annotMode) { setAnnotMode(false); return; }
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && !activeNote && !annotMode) { e.preventDefault(); prevFile(); }
      if (e.key === 'ArrowRight' && !activeNote && !annotMode) { e.preventDefault(); nextFile(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, files.length, activeNote, annotMode, isDrawing]);

  const prevFile = () => setCurrentIndex(i => Math.max(0, i - 1));
  const nextFile = () => setCurrentIndex(i => Math.min(files.length - 1, i + 1));

  // Download public file — no auth needed
  const handleDownload = () => {
    window.open('https://drive.google.com/uc?export=download&id=' + file.id, '_blank', 'noopener');
  };

  const openInDrive = () => {
    window.open('https://drive.google.com/file/d/' + file.id + '/view', '_blank', 'noopener');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && modalRef.current) {
      modalRef.current.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  // Listen to fullscreen change events to stay in sync
  useEffect(() => {
    const handler = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Coordinate helpers ───
  const getPct = (e) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0.005, Math.min(0.995, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0.005, Math.min(0.995, (e.clientY - rect.top) / rect.height)),
    };
  };

  // ─── Mouse drawing handlers ───
  const handleMouseDown = (e) => {
    if (!annotMode || !bodyRef.current) return;
    const pos = getPct(e);
    drawStart.current = pos;
    setIsDrawing(true);

    if (tool === 'marker') {
      const anno = addAnnotation(fileId, { type: 'marker', x: pos.x, y: pos.y, color });
      setAnnotations(getAnnotations(fileId));
      setActiveNote({ id: anno.id, editing: true });
      setEditContent('');
      setIsDrawing(false);
      return;
    }

    if (tool === 'pencil') {
      const anno = addAnnotation(fileId, { type: 'freehand', points: [pos], color, strokeWidth: strokeW });
      setLiveShape({ id: anno.id, points: [pos] });
      setAnnotations(getAnnotations(fileId));
      return;
    }

    // rect, circle
    setLiveShape({ type: tool, start: pos, end: pos, color, strokeWidth: strokeW });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !annotMode || !bodyRef.current) return;
    const pos = getPct(e);

    if (tool === 'pencil' && liveShape) {
      const newPts = [...liveShape.points, pos];
      setLiveShape({ ...liveShape, points: newPts });
      return;
    }

    if (liveShape) {
      setLiveShape({ ...liveShape, end: pos });
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !annotMode || !bodyRef.current) return;
    setIsDrawing(false);

    if (tool === 'pencil' && liveShape) {
      updateAnnotationData(fileId, liveShape.id, { points: liveShape.points });
      setAnnotations(getAnnotations(fileId));
      setLiveShape(null);
      return;
    }

    if (liveShape && liveShape.type) {
      const rect = bodyRef.current.getBoundingClientRect();
      const sx = liveShape.start.x;
      const sy = liveShape.start.y;
      const ex = liveShape.end.x;
      const ey = liveShape.end.y;
      const x = Math.min(sx, ex);
      const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx);
      const h = Math.abs(ey - sy);

      if (w < 0.005 && h < 0.005) { setLiveShape(null); return; }

      if (liveShape.type === 'circle') {
        const cx = (sx + ex) / 2;
        const cy = (sy + ey) / 2;
        const rx = Math.abs(ex - sx) / 2;
        const ry = Math.abs(ey - sy) / 2;
        const anno = addAnnotation(fileId, { type: 'circle', cx, cy, rx, ry, color, strokeWidth: strokeW });
        setAnnotations(getAnnotations(fileId));
        setActiveNote({ id: anno.id, editing: true });
        setEditContent('');
      } else { // rect
        const anno = addAnnotation(fileId, { type: 'rect', x, y, w, h, color, strokeWidth: strokeW });
        setAnnotations(getAnnotations(fileId));
        setActiveNote({ id: anno.id, editing: true });
        setEditContent('');
      }
      setLiveShape(null);
    }
  };

  // ─── Note handlers ───
  const handleShapeClick = (e, anno) => {
    if (!annotMode) {
      e.stopPropagation();
      if (activeNote?.id === anno.id) {
        setActiveNote(null); setEditContent('');
      } else {
        setActiveNote({ id: anno.id, editing: false });
        setEditContent(anno.note || '');
      }
    }
  };

  const handleSaveNote = () => {
    if (!activeNote) return;
    updateAnnotation(fileId, activeNote.id, editContent);
    setAnnotations(getAnnotations(fileId));
    setActiveNote(null);
    setEditContent('');
  };

  const handleDeleteAnno = (annoId) => {
    removeAnnotation(fileId, annoId);
    setAnnotations(getAnnotations(fileId));
    setActiveNote(null);
    setEditContent('');
  };

  // ─── Render SVG shapes ───
  const renderShape = (anno, idx) => {
    let el = null;
    switch (anno.type) {
      case 'rect':
        el = <rect x={`${anno.x*100}%`} y={`${anno.y*100}%`} width={`${anno.w*100}%`} height={`${anno.h*100}%`}
              fill={anno.color} fillOpacity="0.25" stroke={anno.color} strokeWidth={anno.strokeWidth||2} rx="4" />;
        break;
      case 'circle':
        el = <ellipse cx={`${anno.cx*100}%`} cy={`${anno.cy*100}%`} rx={`${anno.rx*100}%`} ry={`${anno.ry*100}%`}
              fill={anno.color} fillOpacity="0.25" stroke={anno.color} strokeWidth={anno.strokeWidth||2} />;
        break;
      case 'freehand':
        if (anno.points && anno.points.length > 1) {
          const d = anno.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x*100}% ${p.y*100}%`).join(' ');
          el = <path d={d} fill="none" stroke={anno.color} strokeWidth={anno.strokeWidth||2} strokeLinecap="round" strokeLinejoin="round" />;
        }
        break;
      default:
        break;
    }
    return el;
  };

  // ─── Render preview content ───
  const renderPreviewContent = () => (
    <>
      {category === 'pdf' && (
        <PDFPreview fileId={file.id} annotMode={annotMode} />
      )}
      {['document', 'spreadsheet', 'presentation'].includes(category) && (
        <iframe src={`https://docs.google.com/viewer?url=https://drive.google.com/uc?id=${file.id}&embedded=true`}
          className="mf-preview-iframe" title={file.name}
          style={{ pointerEvents: annotMode ? 'none' : 'auto' }} />
      )}
      {category === 'image' && (
        <div className={`mf-preview-image-wrap ${zoomed ? 'zoomed' : ''}`}
          onClick={() => { if (!annotMode) setZoomed(z => !z); }}>
          <img src={`https://drive.google.com/uc?id=${file.id}`} alt={file.name}
            className={`mf-preview-image ${zoomed ? 'zoomed' : ''}`} draggable={false}
            style={{ pointerEvents: annotMode ? 'none' : 'auto' }} />
        </div>
      )}
      {category === 'video' && (
        <div className="mf-preview-video-wrap">
          <video controls className="mf-preview-video" autoPlay playsInline>
            <source src={`https://drive.google.com/uc?id=${file.id}`} type={file.mimeType} />
          </video>
        </div>
      )}
      {(category && !['pdf','image','video','document','spreadsheet','presentation'].includes(category)) && (
        <div className="mf-preview-unsupported">
          <div className="mf-preview-unsupported-icon">{meta.icon}</div>
          <p>This file type cannot be previewed.</p>
          <button className="btn btn-primary" onClick={handleDownload}><Download size={16} /> Download</button>
        </div>
      )}

      {/* Annotation Overlay */}
      {['pdf','image','document','spreadsheet','presentation'].includes(category) && (
        <div ref={bodyRef} className={`mf-annotation-overlay ${!annotMode ? 'view-mode' : ''}`}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (isDrawing) { setIsDrawing(false); setLiveShape(null); } }}>

          {annotMode && (
            <div className="mf-annot-toolbar" onMouseDown={e => e.stopPropagation()}>
              <div className="mf-annot-tool-group">
                {ANNOT_TOOLS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} className={`mf-annot-tool-btn ${tool === t.id ? 'active' : ''}`}
                      onClick={() => { setTool(t.id); setLiveShape(null); setIsDrawing(false); }} title={t.label}>
                      <Icon size={16} />
                      <span className="mf-annot-tool-tip">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mf-annot-tool-group">
                <div className="mf-annot-color-row">
                  <span className="mf-annot-color-label">Color</span>
                  <div className="mf-annot-colors">
                    {ANNOT_COLORS.map(c => (
                      <button key={c} className={`mf-annot-color-swatch ${color === c ? 'active' : ''}`}
                        style={{ background: c, borderColor: c === '#fef08a' || c === '#fde68a' ? '#d4d4d8' : c }}
                        onClick={() => setColor(c)} />
                    ))}
                  </div>
                </div>
              </div>
              {['rect','circle','pencil'].includes(tool) && (
                <div className="mf-annot-tool-group">
                  <div className="mf-annot-width-row">
                    <span className="mf-annot-color-label" style={{fontSize:'7px'}}>Width</span>
                    {[2,4,6,8].map(w => (
                      <button key={w} className={`mf-annot-width-btn ${strokeW === w ? 'active' : ''}`}
                        onClick={() => setStrokeW(w)}>
                        <Minus size={w} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {showAnnotations && (
            <svg className="mf-annot-svg-layer"
              ref={svgRef} width="100%" height="100%" style={{position:'absolute',inset:0,overflow:'visible',pointerEvents:'none'}}>
              {annotations.map((anno, idx) => {
                const s = renderShape(anno, idx);
                return s ? (
                  <g key={anno.id} className="mf-annot-shape" onClick={(e) => handleShapeClick(e, anno)}>{s}</g>
                ) : null;
              })}
              {liveShape && liveShape.type && (() => {
                if (liveShape.type === 'circle') {
                  const cx = (liveShape.start.x + liveShape.end.x)/2;
                  const cy = (liveShape.start.y + liveShape.end.y)/2;
                  const rx = Math.abs(liveShape.end.x - liveShape.start.x)/2;
                  const ry = Math.abs(liveShape.end.y - liveShape.start.y)/2;
                  return <ellipse cx={`${cx*100}%`} cy={`${cy*100}%`} rx={`${rx*100}%`} ry={`${ry*100}%`}
                    fill={liveShape.color} fillOpacity="0.2" stroke={liveShape.color} strokeWidth={liveShape.strokeWidth||2} />;
                }
                if (liveShape.type === 'rect') {
                  const x = Math.min(liveShape.start.x, liveShape.end.x);
                  const y = Math.min(liveShape.start.y, liveShape.end.y);
                  const w = Math.abs(liveShape.end.x - liveShape.start.x);
                  const h = Math.abs(liveShape.end.y - liveShape.start.y);
                  return <rect x={`${x*100}%`} y={`${y*100}%`} width={`${w*100}%`} height={`${h*100}%`}
                    fill={liveShape.color} fillOpacity="0.2" stroke={liveShape.color} strokeWidth={liveShape.strokeWidth||2} rx="4" />;
                }
                return null;
              })()}
              {liveShape && liveShape.points && liveShape.points.length > 1 && (
                <path d={liveShape.points.map((p,i)=>`${i===0?'M':'L'}${p.x*100}% ${p.y*100}%`).join(' ')}
                  fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          )}

          {showAnnotations && annotations.filter(a => !a.type || a.type === 'marker').map((anno, idx) => (
            <div key={anno.id} className="mf-annotation-marker"
              style={{ left: `${anno.x*100}%`, top: `${anno.y*100}%` }}
              onClick={(e) => handleShapeClick(e, anno)}>
              <div className="mf-annotation-dot" style={{ background: anno.color }}>{idx + 1}</div>
              {activeNote?.id === anno.id && (
                <AnnotPopup note={anno} editing={activeNote.editing}
                  editContent={editContent} setEditContent={setEditContent}
                  onSave={handleSaveNote}
                  onEdit={() => { setActiveNote({ id: anno.id, editing: true }); setEditContent(anno.note || ''); }}
                  onDelete={() => handleDeleteAnno(anno.id)}
                  onClose={() => { setActiveNote(null); setEditContent(''); }} />
              )}
            </div>
          ))}

          {showAnnotations && annotations.filter(a => a.type && ['rect','circle','freehand'].includes(a.type)).map((anno) => {
            let cx = 0.5, cy = 0.5;
            if (anno.type === 'circle') { cx = anno.cx; cy = anno.cy; }
            else if (anno.type === 'freehand' && anno.points?.length) {
              const sum = anno.points.reduce((a,p) => ({x:a.x+p.x, y:a.y+p.y}), {x:0,y:0});
              cx = sum.x / anno.points.length; cy = sum.y / anno.points.length;
            } else { cx = (anno.x || 0) + (anno.w||0)/2; cy = (anno.y || 0) + (anno.h||0)/2; }
            return (
              <div key={`tr_${anno.id}`} className="mf-annot-shape-note-trigger"
                style={{ left: `${cx*100}%`, top: `${cy*100}%`, width:'16px', height:'16px', marginLeft:'-8px', marginTop:'-8px' }}
                onClick={(e) => { e.stopPropagation(); handleShapeClick(e, anno); }}>
                <div style={{ width:'12px', height:'12px', borderRadius:'50%', background: anno.color, margin:'2px auto', border:'2px solid rgba(255,255,255,0.8)', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                {activeNote?.id === anno.id && (
                  <AnnotPopup note={anno} editing={activeNote.editing}
                    editContent={editContent} setEditContent={setEditContent}
                    onSave={handleSaveNote}
                    onEdit={() => { setActiveNote({ id: anno.id, editing: true }); setEditContent(anno.note || ''); }}
                    onDelete={() => handleDeleteAnno(anno.id)}
                    onClose={() => { setActiveNote(null); setEditContent(''); }} />
                )}
              </div>
            );
          })}

          {annotMode && annotations.length === 0 && !isDrawing && (
            <div style={{ position:'absolute', top:'60px', left:'50%', transform:'translateX(-50%)',
              background:'var(--bg-card)', border:'1px solid var(--accent-amber)', borderRadius:'var(--radius-md)',
              padding:'8px 16px', fontSize:'var(--fs-sm)', color:'var(--accent-amber)', fontWeight:'var(--fw-medium)',
              boxShadow:'0 4px 16px rgba(0,0,0,0.15)', pointerEvents:'none', zIndex:25,
              animation:'mfSlideIn 0.3s ease', whiteSpace:'nowrap' }}>
              {tool === 'marker' ? '\u{1F4CD} Click to drop a note marker' : tool === 'pencil' ? '\u270F\uFE0F Drag to draw freehand' : '\u{2B1C} Drag to draw a ' + tool}
            </div>
          )}
        </div>
      )}
    </>
  );

  // ─── Render side panel ───
  const renderSidePanel = () => (
    <div className="mf-side-panel">
      <div className="mf-panel-tabs">
        {PANEL_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={`mf-panel-tab ${panelTab === tab.id ? 'active' : ''}`}
              onClick={() => setPanelTab(tab.id)}>
              <Icon size={12} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mf-panel-content">
        {panelTab === 'music' && <MusicPlayer />}
        {panelTab === 'youtube' && <YouTubePlayer />}
        {panelTab === 'gemini' && <GeminiChat />}
      </div>
    </div>
  );

  return createPortal(
    <div className="mf-preview-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mf-preview-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mf-preview-header">
          <FileTypeIcon category={category} size={24} variant="list" />
          <div className="mf-preview-header-info">
            <div className="mf-preview-header-name">{file.name}</div>
            <div className="mf-preview-header-meta">
              <span>{formatFileSize(file.size)}</span>
              {file.modifiedTime && <><span>·</span><Clock size={10} /><span>{new Date(file.modifiedTime).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</span></>}
              <span>·</span><span>{meta.label}</span>
            </div>
          </div>

          <div className="mf-preview-header-actions">
            {supportsAnnot && (
              <button className={`mf-annotate-btn ${annotMode?'active':''}`} onClick={() => { setAnnotMode(v=>!v); if(!annotMode) setTool('marker'); }} title="Toggle annotation mode">
                <StickyNote size={13} /> {annotMode?'Done':'Annotate'}
                {annotCount>0 && <span className="mf-annotate-count">{annotCount}</span>}
              </button>
            )}
            {annotCount > 0 && (
              <button className="mf-preview-nav-btn"
                onClick={() => setShowAnnotations(v=>!v)}
                title={showAnnotations ? 'Hide annotations' : 'Show annotations'}>
                {showAnnotations ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            )}

            <div className="mf-preview-divider" />

            <button className={`mf-preview-nav-btn ${showYT?'active':''}`}
              onClick={() => setShowYT(v=>!v)} title={showYT?'Close YouTube':'Open YouTube'}>
              <PlayCircle size={14} />
            </button>
            <button className={`mf-preview-nav-btn ${showPanel?'active':''}`}
              onClick={() => setShowPanel(v=>!v)} title={showPanel?'Close panel':'Open panel'}>
              {showPanel ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>

            <div className="mf-preview-divider" />

            <button className="mf-preview-nav-btn" onClick={toggleFullscreen} title={fullscreen?'Exit fullscreen':'Fullscreen'}>
              {fullscreen?<Minimize2 size={14}/>:<Maximize2 size={14}/>}
            </button>
            {isImage && !annotMode && (
              <button className="mf-preview-nav-btn" onClick={()=>setZoomed(z=>!z)} title={zoomed?'Zoom out':'Zoom in'}>
                {zoomed?<ZoomOut size={14}/>:<ZoomIn size={14}/>}
              </button>
            )}
            <button className="mf-preview-nav-btn" onClick={openInDrive} title="Open in Drive">
              <ExternalLink size={14} />
            </button>
            <button className="mf-preview-nav-btn" onClick={handleDownload} title="Download">
              <Download size={14} />
            </button>

            <div className="mf-preview-divider" />

            {currentIndex>0 && !annotMode ? (
              <button className="mf-preview-nav-btn" onClick={prevFile} title="Previous"><ChevronLeft size={14} /></button>
            ) : <div className="mf-preview-nav-placeholder" />}
            <span className="mf-preview-counter">{currentIndex+1}/{files.length}</span>
            {currentIndex<files.length-1 && !annotMode ? (
              <button className="mf-preview-nav-btn" onClick={nextFile} title="Next"><ChevronRight size={14} /></button>
            ) : <div className="mf-preview-nav-placeholder" />}

            <div className="mf-preview-divider" />

            <button className="mf-preview-nav-btn" onClick={onClose} title="Close"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className={`mf-preview-body${showPanel ? ' with-panel' : ''}${showYT ? ' with-yt' : ''}`} key={file.id}>
          {showYT && (
            <YTSidebar />
          )}
          <div className="mf-preview-main">{renderPreviewContent()}</div>
          {showPanel && renderSidePanel()}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Annotation Popup (view / edit) ─── */
function AnnotPopup({ note, editing, editContent, setEditContent, onSave, onEdit, onDelete, onClose }) {
  return (
    <div className="mf-annotation-popup" onClick={e => e.stopPropagation()}>
      {editing ? (
        <>
          <div className="mf-annotation-popup-header">
            <span className="mf-annotation-popup-title"><Edit3 size={11} /> Write your note</span>
            <button className="mf-annotation-popup-close" onClick={onClose}><X size={12} /></button>
          </div>
          <div className="mf-annotation-popup-body">
            <textarea className="mf-annotation-textarea" value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Write your notes here... (bangla, english, anything)"
              autoFocus onKeyDown={e => { if (e.key==='Enter'&&e.ctrlKey) onSave(); if (e.key==='Escape') onClose(); }} />
          </div>
          <div className="mf-annotation-popup-actions">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={onSave}><Save size={12} /> Save</button>
          </div>
        </>
      ) : (
        <>
          <div className="mf-annotation-popup-header">
            <span className="mf-annotation-popup-title">Your Note</span>
            <div style={{display:'flex',gap:'4px'}}>
              <button className="mf-annotation-popup-close" onClick={onEdit} title="Edit"><Edit3 size={11} /></button>
              <button className="mf-annotation-popup-close" onClick={onDelete} title="Delete"><Trash2 size={11} /></button>
              <button className="mf-annotation-popup-close" onClick={onClose} title="Close"><X size={12} /></button>
            </div>
          </div>
          <div className="mf-annotation-popup-body">
            {(note.note || note.content) ? (
              <>
                <div className="mf-annotation-view-content">{note.note || note.content}</div>
                <div className="mf-annotation-view-time">{new Date(note.updatedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
              </>
            ) : (
              <p style={{color:'var(--text-tertiary)',fontSize:'var(--fs-sm)',fontStyle:'italic'}}>Empty note — click edit to add content.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LECTURE NOTES UPLOAD — real file upload with progress
   ═══════════════════════════════════════════════════════════════════════ */

function UploadLectureNotes({ vaultContext }) {
  const { course, courseName, department, yearSem } = vaultContext;
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', msg }
  const fileInputRef = useRef(null);

  const fetchNotes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (course) params.set('course', course);
      if (department) params.set('department', department);
      if (yearSem) params.set('semester', String(yearSem));
      const res = await apiFetch(`/api/vault/notes?${params}`);
      const data = await res.json();
      if (data.success) setNotes(data.notes);
    } catch { /* ignore */ }
  }, [course, department, yearSem]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setStatus(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.onprogress = (evt) => {
          if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 50));
        };
      });
      reader.readAsDataURL(file);
      const fileData = await base64Promise;
      setProgress(60);

      // Upload to server
      const res = await apiFetch('/api/vault/notes/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData,
          fileName: file.name,
          mimeType: file.type,
          course: course || '',
          department: department || '',
          semester: String(yearSem || ''),
        }),
      });
      setProgress(90);

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');

      setProgress(100);
      setStatus({ type: 'success', msg: `"${file.name}" uploaded!` });
      fetchNotes();
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setUploading(false);
      setTimeout(() => { setProgress(0); setStatus(null); }, 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (noteId) => {
    try {
      const res = await apiFetch(`/api/vault/notes/${noteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchNotes();
        setStatus({ type: 'success', msg: 'File deleted.' });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Delete failed' });
        setTimeout(() => setStatus(null), 4000);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Failed to delete: ' + err.message });
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const isOwner = (note) => user?.id && note.uploader === user.id;

  const handleDownload = (note) => {
    window.open(`/api/vault/notes/download/${note.id}`, '_blank');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="glass-card-static" style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-4)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="icon" style={{ backgroundColor: 'var(--accent-blue-glow)', color: 'var(--accent-blue)', padding: '6px', borderRadius: '8px' }}>
          <FileText size={16} />
        </div>
        <div>
          <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0 }}>Upload Lecture Notes</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            Share PDFs, docs, or images with others in this course
          </p>
        </div>
      </div>

      {/* Upload Button */}
      <div style={{ marginBottom: 'var(--sp-3)' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          onChange={handleFilePick}
          style={{ display: 'none' }}
        />
        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          {uploading ? 'Uploading...' : 'Choose File'}
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '10px' }}>
          PDF, DOCX, PNG, JPG — max 15MB
        </span>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="progress-bar" style={{ height: '6px', borderRadius: '3px' }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%`, background: 'var(--accent-blue)', transition: 'width 0.3s ease' }}
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{progress}%</span>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--sp-3)', fontSize: 'var(--fs-xs)',
            background: status.type === 'success' ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
            color: status.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          }}
        >
          {status.type === 'success' ? <CheckCircle size={14} /> : <AlertTri size={14} />}
          {status.msg}
        </div>
      )}

      {/* Notes List */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between"
              style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                <FileText size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.originalName}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {formatSize(note.size)} · {note.uploaderName} · {new Date(note.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDownload(note)}
                  title="Download"
                >
                  <Download size={14} />
                </button>
                {isOwner(note) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(note.id)}
                    title="Delete"
                    style={{ color: 'var(--accent-rose)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && !uploading && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          No lecture notes uploaded yet for this course.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function MaterialFolders({ vaultContext }) {
  const { course, courseName, department, yearSem, batch } = vaultContext;
  const isSemesterMode = !course; // No course selected — use semester-level folder

  /* ─── State ─── */
  const initialUrl = batch?.driveUrl
    ? batch.driveUrl
    : isSemesterMode
      ? (getSemesterFolderUrl(department, yearSem) || '')
      : (getCourseFolderUrl(course, department, yearSem) || '');
  const initialFolderId = batch?.folderId || null;
  const [folderUrl, setFolderUrl] = useState(initialUrl);
  const [imgErrors, setImgErrors] = useState({});
  const [isEditing, setIsEditing] = useState(!initialUrl);
  const [allFiles, setAllFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Folder nav
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [currentFolderName, setCurrentFolderName] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // Preview
  const [previewIndex, setPreviewIndex] = useState(-1);
  const [previewFiles, setPreviewFiles] = useState([]);

  // View options
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('mf_view_mode') || 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  /* ─── Reset on context change (dept/sem/course) ─── */
  useEffect(() => {
    const savedUrl = batch?.driveUrl
      ? batch.driveUrl
      : isSemesterMode
        ? (getSemesterFolderUrl(department, yearSem) || '')
        : (getCourseFolderUrl(course, department, yearSem) || '');
    const savedFolderId = batch?.folderId || null;
    setFolderUrl(savedUrl);
    setIsEditing(!savedUrl);
    setAllFiles([]);
    setCurrentFolderId(savedFolderId);
    setError(null);
    setCurrentFolderId(null);
    setCurrentFolderName('');
    setBreadcrumbs([]);
    setPreviewIndex(-1);
    setPreviewFiles([]);
    setImgErrors({});
  }, [course, department, yearSem, isSemesterMode]);

  /* ─── Persist view mode ─── */
  useEffect(() => {
    localStorage.setItem('mf_view_mode', viewMode);
  }, [viewMode]);

  /* ─── Fetch files from folder using API key ─── */
  const fetchFiles = async (folderId) => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchDriveFolderFiles(folderId, GOOGLE_API_KEY);
      setAllFiles(items);
      setIsEditing(false);
      setImgErrors({});
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError(err.message || 'Failed to load files. Make sure the folder is publicly shared.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Folder navigation ─── */
  const navigateToFolder = async (folder) => {
    const newBreadcrumb = {
      id: currentFolderId || extractFolderId(folderUrl),
      name: currentFolderName || 'Root',
    };
    setBreadcrumbs(prev => [...prev, newBreadcrumb]);
    setCurrentFolderId(folder.id);
    setCurrentFolderName(folder.name);
    setSearchQuery('');
    await fetchFiles(folder.id);
  };

  const navigateBack = async () => {
    if (breadcrumbs.length === 0) {
      const rootId = extractFolderId(folderUrl);
      setCurrentFolderId(null);
      setCurrentFolderName('');
      setBreadcrumbs([]);
      await fetchFiles(rootId);
    } else {
      const prev = breadcrumbs[breadcrumbs.length - 1];
      setBreadcrumbs(prev => prev.slice(0, -1));
      setCurrentFolderId(prev.id);
      setCurrentFolderName(prev.name);
      await fetchFiles(prev.id);
    }
  };

  const navigateToBreadcrumb = async (index) => {
    if (index === -1) {
      const rootId = extractFolderId(folderUrl);
      setCurrentFolderId(null);
      setCurrentFolderName('');
      setBreadcrumbs([]);
      await fetchFiles(rootId);
    } else {
      const target = breadcrumbs[index];
      setBreadcrumbs(prev => prev.slice(0, index));
      setCurrentFolderId(target.id);
      setCurrentFolderName(target.name);
      await fetchFiles(target.id);
    }
  };

  /* ─── Auto-fetch on mount ─── */
  useEffect(() => {
    if (folderUrl && !isEditing) {
      if (currentFolderId) {
        fetchFiles(currentFolderId);
      } else {
        const rootId = extractFolderId(folderUrl);
        if (rootId) fetchFiles(rootId);
      }
    }
  }, [folderUrl, isEditing, currentFolderId]);

  /* ─── Save / remove folder URL ─── */
  const handleSaveUrl = () => {
    if (folderUrl.trim()) {
      if (batch) {
        updateBatchDriveUrl(department, yearSem, batch.id, folderUrl.trim());
      } else if (isSemesterMode) {
        saveSemesterFolderUrl(department, yearSem, folderUrl.trim());
      } else {
        saveCourseFolderUrl(course, department, yearSem, folderUrl.trim());
      }
      setIsEditing(false);
      setCurrentFolderId(null);
      setCurrentFolderName('');
      setBreadcrumbs([]);
      const rootId = extractFolderId(folderUrl.trim());
      if (rootId) fetchFiles(rootId);
    }
  };

  const handleRemoveUrl = () => {
    setFolderUrl('');
    setAllFiles([]);
    setIsEditing(true);
    setCurrentFolderId(null);
    setCurrentFolderName('');
    setBreadcrumbs([]);
    if (batch) {
      updateBatchDriveUrl(department, yearSem, batch.id, '');
    } else if (isSemesterMode) {
      saveSemesterFolderUrl(department, yearSem, '');
    } else {
      saveCourseFolderUrl(course, department, yearSem, '');
    }
  };

  const handleRefresh = () => {
    const targetId = currentFolderId || extractFolderId(folderUrl);
    if (targetId) { setImgErrors({}); fetchFiles(targetId); }
  };

  /* ─── File operations ─── */
  const handleDownload = (file) => {
    window.open('https://drive.google.com/uc?export=download&id=' + file.id, '_blank', 'noopener');
  };

  const handleFileClick = (file) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      navigateToFolder(file);
    } else {
      const category = getFileCategory(file.mimeType);
      if (['pdf', 'image', 'video', 'document', 'spreadsheet', 'presentation'].includes(category)) {
        const previewable = filteredFiles.filter(f =>
          !f.mimeType.includes('folder') &&
          ['pdf', 'image', 'video', 'document', 'spreadsheet', 'presentation'].includes(getFileCategory(f.mimeType))
        );
        const idx = previewable.findIndex(f => f.id === file.id);
        setPreviewFiles(previewable);
        setPreviewIndex(idx >= 0 ? idx : 0);
      } else {
        handleDownload(file);
      }
    }
  };

  /* ─── Search & sort ─── */
  const filteredFiles = useMemo(() => {
    let list = [...allFiles];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const aFolder = a.mimeType === 'application/vnd.google-apps.folder';
      const bFolder = b.mimeType === 'application/vnd.google-apps.folder';
      if (aFolder && !bFolder) return -1;
      if (!aFolder && bFolder) return 1;

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'date':
          return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
        case 'size':
          return (parseInt(b.size) || 0) - (parseInt(a.size) || 0);
        case 'type':
          return (getFileCategory(a.mimeType) || '').localeCompare(getFileCategory(b.mimeType) || '');
        default:
          return 0;
      }
    });

    return list;
  }, [allFiles, searchQuery, sortBy]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const folders = allFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const nonFolders = allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    const totalSize = nonFolders.reduce((sum, f) => sum + (parseInt(f.size) || 0), 0);
    const byCategory = {};
    nonFolders.forEach(f => {
      const cat = getFileCategory(f.mimeType);
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    return { folders: folders.length, files: nonFolders.length, totalSize, byCategory };
  }, [allFiles]);

  /* ─── Render helpers ─── */
  const renderFileGrid = () => (
    <div className="mf-file-grid">
      {filteredFiles.map((file) => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const category = getFileCategory(file.mimeType);
        const meta = CATEGORY_META[category] || CATEGORY_META.other;

        return (
          <div
            key={file.id}
            className={`mf-file-grid-item ${isFolder ? 'mf-folder' : ''}`}
            onClick={() => handleFileClick(file)}
            style={{ animationDelay: '0s' }}
          >
            <div className="mf-file-grid-thumb" style={{ background: isFolder ? meta.glow : 'var(--bg-secondary)' }}>
              {category === 'image' && !imgErrors[file.id] ? (
                <img
                  src={`https://drive.google.com/uc?id=${file.id}`}
                  alt={file.name}
                  className="mf-file-grid-thumb-img"
                  loading="lazy"
                  onError={() => setImgErrors(prev => ({ ...prev, [file.id]: true }))}
                />
              ) : (
                <div className="mf-file-grid-thumb-placeholder" style={{ display: 'flex' }}>
                  <span className="mf-file-grid-thumb-icon">{meta.icon}</span>
                  {isFolder ? <span style={{ fontSize: '8px', opacity: 0.7 }}>Folder</span> : null}
                </div>
              )}
            </div>

            <div className="mf-file-grid-body">
              <div className="mf-file-grid-name">{file.name}</div>
              <div className="mf-file-grid-meta">
                {!isFolder && (
                  <>
                    <span className="mf-file-grid-size">{formatFileSize(file.size)}</span>
                    {file.modifiedTime && <span className="mf-file-grid-date">· {new Date(file.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </>
                )}
                <FileTypeBadge category={category} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderFileList = () => (
    <div className="mf-file-list">
      {filteredFiles.map((file, idx) => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const category = getFileCategory(file.mimeType);
        const canPreview = !isFolder && ['pdf', 'image', 'video', 'document', 'spreadsheet', 'presentation'].includes(category);

        return (
          <div
            key={file.id}
            className={`mf-file-list-item ${isFolder ? 'mf-folder' : ''}`}
            onClick={() => handleFileClick(file)}
            style={{ animationDelay: `${Math.min(idx, 10) * 0.025}s` }}
          >
            <FileTypeIcon category={category} size={40} variant="list" />

            <div className="mf-file-list-body">
              <div className="mf-file-list-name">
                {isFolder ? '\u{1F4C1} ' : ''}{file.name}
              </div>
              <div className="mf-file-list-sub">
                {!isFolder && (
                  <>
                    <span className="mf-file-list-size">{formatFileSize(file.size)}</span>
                    {file.modifiedTime && (
                      <span className="mf-file-list-date">
                        · {new Date(file.modifiedTime).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                    )}
                  </>
                )}
                <span className={`mf-file-list-category mf-file-list-category-${category}`}>
                  {CATEGORY_META[category]?.label || 'Other'}
                </span>
              </div>
            </div>

            <div className="mf-file-list-actions">
              {isFolder ? (
                <ChevronRight size={16} style={{ color: 'var(--accent-blue)' }} />
              ) : (
                <>
                  {canPreview && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleFileClick(file); }}
                      title="Preview"
                      style={{ padding: '4px 8px' }}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                    title="Download"
                    style={{ padding: '4px 8px' }}
                  >
                    <Download size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderNoSearchResults = () => (
    <div className="mf-no-results">
      <Search size={40} />
      <p>No files matching &quot;<strong>{searchQuery}</strong>&quot;</p>
      <button className="btn btn-ghost btn-sm" onClick={() => setSearchQuery('')}>
        <X size={14} /> Clear search
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════
     MAIN UI — No OAuth, just paste a public Drive folder link
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="mf-container animate-fadeInUp">
      {/* ─── Header ─── */}
      <div className="mf-header">
        <div className="mf-header-left">
          <div className="mf-header-icon">
            <BookOpen size={22} />
          </div>
          <div className="mf-header-info">
            <h2>Lecture Notes</h2>
            <p>{isSemesterMode ? `Semester ${yearSem}` : courseName} — Google Drive materials</p>
          </div>
        </div>
        <div className="mf-header-right">
          {folderUrl && !isEditing && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={loading} title="Refresh">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)} title="Change folder">
                <Link size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Stats Bar ─── */}
      {!isEditing && allFiles.length > 0 && (
        <div className="mf-stats-bar">
          <div className="mf-stat">
            <HardDrive size={14} />
            <span><strong>{stats.folders}</strong> folders</span>
          </div>
          <div className="mf-stat-sep" />
          <div className="mf-stat">
            <File size={14} />
            <span><strong>{stats.files}</strong> files</span>
          </div>
          <div className="mf-stat-sep" />
          <div className="mf-stat">
            <Download size={14} />
            <span><strong>{formatFileSize(stats.totalSize)}</strong> total</span>
          </div>
          {Object.entries(stats.byCategory).filter(([_, count]) => count > 0).map(([cat, count]) => (
            <span key={cat} className={`mf-stat-badge mf-stat-badge-${cat}`}>
              {CATEGORY_META[cat]?.icon || '\u{1F4CE}'} {count}
            </span>
          ))}
        </div>
      )}

      {/* ─── Folder URL Input ─── */}
      {isEditing && (
        <div className="mf-folder-input">
          <span className="mf-folder-input-label">Paste your Google Drive folder link:</span>
          <div className="mf-folder-input-row">
            <input
              type="text"
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="mf-folder-input-field"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveUrl} disabled={!folderUrl.trim()}>
              <Link size={14} /> Connect
            </button>
            {folderUrl && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFolderUrl(''); setIsEditing(false); }}>
                <X size={14} />
              </button>
            )}
          </div>
          <p className="mf-folder-input-hint">
            Right-click any folder in Google Drive &rarr; &quot;Get link&quot; &rarr; Paste the link here.
            Make sure the folder is shared with &quot;Anyone with the link&quot;.
          </p>
        </div>
      )}

      {/* ─── Breadcrumbs ─── */}
      {folderUrl && !isEditing && breadcrumbs.length + (currentFolderName ? 1 : 0) > 0 && (
        <div className="mf-breadcrumbs">
          <button
            className={`mf-breadcrumb-btn ${!currentFolderId ? 'mf-breadcrumb-current' : ''}`}
            onClick={() => navigateToBreadcrumb(-1)}
          >
            <Home size={13} /> Root
          </button>
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={bc.id}>
              <ChevronRight size={12} className="mf-breadcrumb-sep" />
              <button
                className={`mf-breadcrumb-btn ${i === breadcrumbs.length - 1 && !currentFolderName ? 'mf-breadcrumb-current' : ''}`}
                onClick={() => navigateToBreadcrumb(i)}
              >
                {bc.name}
              </button>
            </React.Fragment>
          ))}
          {currentFolderName && (
            <>
              <ChevronRight size={12} className="mf-breadcrumb-sep" />
              <span className="mf-breadcrumb-btn mf-breadcrumb-current">{currentFolderName}</span>
            </>
          )}
        </div>
      )}

      {/* ─── Back button ─── */}
      {currentFolderId && !isEditing && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={navigateBack}
          style={{ marginBottom: 'var(--sp-3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronsLeft size={14} /> Back
        </button>
      )}

      {/* ─── Error ─── */}
      {error && (
        <div className="mf-error">
          <AlertCircle size={16} />
          <span className="mf-error-msg">{error}</span>
          <button className="mf-error-dismiss" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Search & Sort Toolbar ─── */}
      {!isEditing && allFiles.length > 0 && (
        <div className="mf-toolbar">
          <div className="mf-search-wrap">
            <Search size={15} className="mf-search-icon" />
            <input
              type="text"
              className="mf-search-input"
              placeholder="Search files by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="mf-search-clear" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>

          <div className="mf-toolbar-actions">
            <select
              className="mf-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>

            <div className="mf-view-toggle">
              <button
                className={`mf-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid3X3 size={14} />
              </button>
              <button
                className={`mf-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Content ─── */}
      {loading ? (
        <FileSkeleton />
      ) : !isEditing && folderUrl && filteredFiles.length === 0 && searchQuery ? (
        renderNoSearchResults()
      ) : !isEditing && folderUrl && allFiles.length === 0 ? (
        <div className="mf-empty">
          <div className="mf-empty-icon"><Folder size={32} /></div>
          <h3>This folder is empty</h3>
          <p>No files or folders found. Try connecting a different folder.</p>
          <button className="btn btn-secondary btn-sm" onClick={handleRemoveUrl}>
            Change Folder
          </button>
        </div>
      ) : !isEditing && !folderUrl ? (
        <div className="mf-empty">
          <div className="mf-empty-icon"><Link size={32} /></div>
          <h3>No folder connected</h3>
          <p>Connect a Google Drive folder to see lecture notes for {isSemesterMode ? `Semester ${yearSem}` : courseName}.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
            <Plus size={14} /> Connect Folder
          </button>
        </div>
      ) : !isEditing ? (
        viewMode === 'grid' ? renderFileGrid() : renderFileList()
      ) : null}

      {/* ─── Upload Lecture Notes Section ─── */}
      {!isEditing && (
        <UploadLectureNotes vaultContext={vaultContext} />
      )}

      {/* ─── Preview Modal ─── */}
      {previewIndex >= 0 && previewFiles.length > 0 && (
        <FilePreviewModal
          files={previewFiles}
          currentIndex={previewIndex}
          setCurrentIndex={setPreviewIndex}
          onClose={() => { setPreviewIndex(-1); setPreviewFiles([]); }}
        />
      )}
    </div>
  );
}
