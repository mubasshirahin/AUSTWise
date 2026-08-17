import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Moon, Eye, Star, Shield, Send, User, Timer, MessageSquare, Flame,
  Loader2, AlertTriangle, Wifi, WifiOff, Zap,
} from 'lucide-react';
import CourseReview from '../analytics/CourseReview';
import BuzzPage from '../austeddit/AustedditPage';
import RoastCVPage from '../roast-cv/RoastCVPage';
import GliderTabs from '../../components/GliderTabs';
import useTabUrlState from '../../hooks/useTabUrlState';
import './ShadowPage.css';
import './shadow-tokens.css';

const SHADOW_DURATION = 10 * 60; // 10 minutes in seconds

function generateShadowId() {
  return `shadow-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Shared subtab masthead.
function ShadowMasthead({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="schedule-masthead">
      <div className="schedule-title-block">
        <div className="schedule-icon-tile">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div>
          <span className="schedule-overline">Shadow</span>
          <p className="schedule-title">{title}</p>
          <span className="schedule-subtitle">{subtitle}</span>
        </div>
      </div>
      <div className="schedule-masthead-center" />
      <div className="schedule-actions">{actions}</div>
    </div>
  );
}

export default function ShadowPage() {
  const [totalReviews] = useState(() => {
    try {
      const raw = localStorage.getItem('aust-course-reviews');
      if (!raw) return 0;
      const reviews = JSON.parse(raw);
      return Array.isArray(reviews) ? reviews.length : 0;
    } catch { return 0; }
  });

  const [uniqueUsers] = useState(() => {
    try {
      const raw = localStorage.getItem('aust-course-reviews');
      if (!raw) return 0;
      const reviews = JSON.parse(raw);
      if (!Array.isArray(reviews) || reviews.length === 0) return 0;
      const userSet = new Set(reviews.map(r => r.userId).filter(Boolean));
      return userSet.size;
    } catch { return 0; }
  });

  /* ─── Tab state ─── */
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'reviews'); // reviews | chat | buzz
  const handleShadowTabChange = useTabUrlState({
    storageKey: 'shadow-active-tab',
    defaultValue: 'reviews',
    onChange: setActiveTab,
  });

  /* ─── Shadow Chat State ─── */
  const [chatState, setChatState] = useState('idle'); // idle | queued | matched | ended
  const [shadowId] = useState(generateShadowId);
  const [peerId, setPeerId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(SHADOW_DURATION);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [queuePosition, setQueuePosition] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [wsError, setWsError] = useState(false);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatStateRef = useRef(chatState);
  chatStateRef.current = chatState;

  /* ─── Scroll to bottom on new messages ─── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Server-authoritative timer — driven entirely by shadow-tick events (no client countdown) ─── */

  /* ─── WebSocket Connection ─── */
  const connectWS = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setWsError(false);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          switch (type) {
            case 'connected':
            case 'user-registered':
              break;

            case 'shadow-queued':
              setQueuePosition(payload.position || 1);
              setChatState('queued');
              break;

            case 'shadow-matched': {
              setPeerId(payload.peerId);
              setSessionId(payload.sessionId);
              // Sync timer from server expiry
              const remaining = Math.max(0, Math.floor((payload.expiresAt - Date.now()) / 1000));
              setTimeLeft(remaining);
              setChatState('matched');
              setMessages([]);
              setEndReason('');
              // Focus input
              setTimeout(() => inputRef.current?.focus(), 300);
              break;
            }

            case 'shadow-message': {
              setMessages((prev) => [...prev, {
                id: payload.id || Date.now().toString(),
                text: payload.text,
                from: payload.from,
                timestamp: payload.timestamp || Date.now(),
                isOwn: false,
              }]);
              setPeerTyping(false);
              break;
            }

            case 'shadow-typing':
              setPeerTyping(payload.isTyping);
              break;

            case 'shadow-tick': {
              const secs = Math.max(0, Math.floor(payload.remaining / 1000));
              setTimeLeft(secs);
              break;
            }

            case 'shadow-ended': {
              setChatState('ended');
              setTimeLeft(0);
              const reasonMap = {
                'timeout': 'The 10-minute session has ended.',
                'peer-disconnected': 'The other shadow has faded...',
              };
              setEndReason(reasonMap[payload.reason] || 'The session has ended.');
              setTimeout(() => setMessages([]), 3000);
              break;
            }

            case 'shadow-time': {
              const secs = Math.max(0, Math.floor(payload.remaining / 1000));
              setTimeLeft(secs);
              break;
            }

            case 'shadow-left':
              setChatState('idle');
              break;

            case 'error':
              console.warn('Shadow WS error:', payload.message);
              break;
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (chatStateRef.current === 'matched') {
          setChatState('ended');
          setEndReason('Connection lost.');
        }
      };

      ws.onerror = () => {
        setWsError(true);
      };
    } catch {
      setWsError(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connectWS();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      clearTimeout(typingTimeoutRef.current);
    };
  }, [connectWS]);

  /* ─── Actions ─── */
  const handleJoinQueue = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'shadow-join', payload: { id: shadowId } }));
    }
  };

  const handleLeaveQueue = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'shadow-leave', payload: {} }));
      setChatState('idle');
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !sessionId || chatState !== 'matched') return;
    const msgId = Date.now().toString();
    setMessages((prev) => [...prev, { id: msgId, text, from: shadowId, timestamp: Date.now(), isOwn: true }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'shadow-message',
        payload: { sessionId, text, id: msgId, timestamp: Date.now() },
      }));
    }
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (val) => {
    setInput(val);
    if (sessionId && wsRef.current?.readyState === WebSocket.OPEN) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      wsRef.current?.send(JSON.stringify({ type: 'shadow-typing', payload: { sessionId, isTyping: true } }));
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'shadow-typing', payload: { sessionId, isTyping: false } }));
        }
      }, 2000);
    }
  };

  const getPeerLabel = (msgFrom) => (msgFrom === shadowId ? 'You' : 'Stranger');

  const stats = [
    { icon: Eye, value: totalReviews, label: 'Total Reviews', color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)' },
    { icon: Star, value: uniqueUsers, label: 'Anonymous Reporters', color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)' },
    { icon: Shield, value: '100%', label: 'Anonymous', color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)' },
  ];

  return (
    <div className="shadow-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="sh-hero">
        <div className="sh-hero-content">
          <div className="sh-hero-eyebrow">
            <span className="sh-hero-period-icon">
              <Moon size={16} />
            </span>
            <span className="sh-hero-date-label">
              Anonymous · no login required
            </span>
          </div>
          <h1 className="sh-hero-title">
            Shadow<span className="sh-hero-name"> Mode</span>
          </h1>
          <p className="sh-hero-subtitle">
            Anonymous course reviews and 10-minute anonymous chats — no login required.
          </p>
        </div>
      </header>

      {/* ── Stats Row ── */}
      {totalReviews > 0 && (
        <div className="shadow-stats-row">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="shadow-quick-stat-card"
                style={{ animationDelay: `${i * 80 + 280}ms` }}
              >
                <div className="shadow-quick-stat-shine" aria-hidden="true" />
                <div className="shadow-quick-stat-icon" style={{ background: stat.bg, color: stat.color }}>
                  <Icon size={18} />
                </div>
                <div className="shadow-quick-stat-body">
                  <span className="shadow-quick-stat-value" style={{ color: stat.color }}>{stat.value}</span>
                  <span className="shadow-quick-stat-label">{stat.label}</span>
                </div>
                <div className="shadow-quick-stat-bar" style={{ background: stat.color }} aria-hidden="true" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static sh-tabs-card">
        <GliderTabs
          tabs={[
            { id: 'reviews', label: 'Course Reviews',   desc: 'Anonymous feedback',     color: 'amber',  icon: Star          },
            { id: 'chat',    label: 'Shadow Chat',      desc: '10-min anonymous match', color: 'amber',  icon: MessageSquare },
            { id: 'buzz',    label: 'Buzz',             desc: 'AUST forum',             color: 'amber',  icon: Zap           },
            { id: 'roast-cv', label: 'Roast CV',        desc: 'CV feedback',            color: 'amber',  icon: Flame         },
          ]}
          activeTab={activeTab}
          onChange={handleShadowTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="sh-content-card" key={activeTab}>
        <div className="shadow-content-area">
          {activeTab === 'buzz' ? (
            <>
              <ShadowMasthead
                icon={Zap}
                title="Buzz"
                subtitle="AUST forum — anonymous posts"
              />
              <div className="schedule-dotted-divider shadow-repeat-divider" />
              <BuzzPage />
            </>
          ) : activeTab === 'reviews' ? (
            <CourseReview />
          ) : activeTab === 'roast-cv' ? (
            <RoastCVPage />
          ) : (
            <>
              <ShadowMasthead
                icon={MessageSquare}
                title="Shadow Chat"
                subtitle="Match with a stranger for a 10-minute anonymous conversation."
                actions={
                  wsConnected ? (
                    <span className="shadow-chat-status-badge badge-live">
                      <Wifi size={10} /> Connected
                    </span>
                  ) : (
                    <span className="shadow-chat-status-badge badge-urgent">
                      <WifiOff size={10} /> Disconnected
                    </span>
                  )
                }
              />
              <div className="schedule-dotted-divider shadow-repeat-divider" />
            <section className="shadow-chat-card">
              <div className="shadow-chat-body">
            {/* Idle state */}
            {chatState === 'idle' && (
              <div className="shadow-chat-idle">
                <div className="shadow-chat-idle-icon">
                  <User size={40} />
                </div>
                <h3>Ready to talk?</h3>
                <p>You'll be matched with a random stranger for exactly 10 minutes. Completely anonymous — no names, no traces.</p>
                <button
                  className="shadow-join-btn"
                  onClick={handleJoinQueue}
                  disabled={!wsConnected}
                >
                  {wsConnected ? (
                    <><MessageSquare size={16} /> Find a Stranger</>
                  ) : (
                    <><Loader2 size={16} className="spin" /> Connecting...</>
                  )}
                </button>
                {wsError && (
                  <p className="shadow-chat-error">
                    <AlertTriangle size={12} /> Connection failed. Please refresh the page.
                  </p>
                )}
              </div>
            )}
  
            {/* Queued state */}
            {chatState === 'queued' && (
              <div className="shadow-chat-queued">
                <div className="shadow-chat-queued-ring">
                  <Loader2 size={48} className="spin" />
                </div>
                <h3>Finding a stranger...</h3>
                <p>You're in the queue at position #{queuePosition}. Hang tight!</p>
                <button className="shadow-leave-btn" onClick={handleLeaveQueue}>
                  Cancel
                </button>
              </div>
            )}
  
            {/* Matched state — Chat UI */}
            {chatState === 'matched' && (
              <>
                {/* Timer bar */}
                <div className="shadow-timer-bar">
                  <Timer size={14} />
                  <div className="shadow-timer-track">
                    <div
                      className="shadow-timer-fill"
                      style={{ width: `${(timeLeft / SHADOW_DURATION) * 100}%` }}
                    />
                  </div>
                  <span className={`shadow-timer-text ${timeLeft <= 60 ? 'shadow-timer-urgent' : ''}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
  
                {/* Messages */}
                <div className="shadow-messages">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`shadow-msg ${msg.isOwn ? 'shadow-msg-own' : 'shadow-msg-peer'}`}
                    >
                      <span className="shadow-msg-sender">
                        {msg.isOwn ? 'You' : 'Stranger'}
                      </span>
                      <div className="shadow-msg-bubble">
                        {msg.text}
                      </div>
                      <span className="shadow-msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {peerTyping && (
                    <div className="shadow-msg shadow-msg-peer">
                      <span className="shadow-msg-sender">Stranger</span>
                      <div className="shadow-msg-bubble shadow-msg-typing">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
  
                {/* Input */}
                <div className="shadow-input-area">
                  <input
                    ref={inputRef}
                    type="text"
                    className="shadow-input"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={500}
                  />
                  <button
                    className="shadow-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim()}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
  
            {/* Ended state */}
            {chatState === 'ended' && (
              <div className="shadow-chat-ended">
                <div className="shadow-chat-ended-icon">
                  <AlertTriangle size={36} />
                </div>
                <h3>Session Ended</h3>
                <p>{endReason || 'The session has concluded.'}</p>
                <button
                  className="shadow-join-btn"
                  onClick={() => { setChatState('idle'); setMessages([]); setEndReason(''); setTimeLeft(SHADOW_DURATION); }}
                >
                  <MessageSquare size={16} /> Start New Chat
                </button>
              </div>
            )}
              </div>
            </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
