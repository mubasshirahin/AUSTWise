import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import {
  X, Download, Copy, Check, Share2, Loader2, ArrowBigUp, Palette,
} from 'lucide-react';
import { shadowInitials } from '../../utils/shadowName';
import { useTheme } from '../../context/ThemeContext';
import logoNew from '../../assets/logo-new.png';

// ─── Card layout ────────────────────────────────────────────────────────────
// Preview width is rendered at 3x for export → 1080px wide PNG
// (great for WhatsApp / IG feed).
const CARD_WIDTH = 360;
const CARD_MIN_HEIGHT = 460;
const CARD_PADDING = '28px 26px';
const CARD_RADIUS = 24;
const CARD_GAP = 18;

// ─── Site-theme palette builder ─────────────────────────────────────────────
// The card auto-matches the app's active theme. Every theme in the project
// defines the same CSS token contract, so we resolve those tokens to concrete
// colors here — the card then uses only these values inline, which keeps the
// html2canvas capture identical to the live preview.
const readVar = (name, fallback = '') => {
  const val = (typeof window !== 'undefined')
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';
  return val || fallback;
};

// Convert any #hex / rgb() color into rgba() with the given alpha.
const withAlpha = (color, alpha) => {
  const t = (color || '').trim();
  if (t.startsWith('#')) {
    let hex = t.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length !== 6) return t;
    const num = parseInt(hex, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }
  if (t.startsWith('rgb(')) return t.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  return t;
};

// Approximate perceived luminance (0–1) so we can pick contrasting text.
const luminance = (color) => {
  const t = (color || '').trim();
  let r = 128; let g = 128; let b = 128;
  if (t.startsWith('#')) {
    let hex = t.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      r = (num >> 16) & 255; g = (num >> 8) & 255; b = num & 255;
    }
  } else if (t.startsWith('rgb')) {
    const m = t.match(/\d+(\.\d+)?/g);
    if (m && m.length >= 3) { r = +m[0]; g = +m[1]; b = +m[2]; }
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// Builds the palette for whatever theme is currently active on the site.
function buildSitePalette() {
  const bgPrimary = readVar('--bg-primary', '#08090a');
  const bgSecondary = readVar('--bg-secondary', '#111113');
  const bgCard = readVar('--bg-card', '#121214');
  const bgTertiary = readVar('--bg-tertiary', '#1a1a1d');
  const textPrimary = readVar('--text-primary', '#fafafa');
  const textSecondary = readVar('--text-secondary', '#a1a1aa');
  const textTertiary = readVar('--text-tertiary', '#71717a');
  const borderPrimary = readVar('--border-primary', 'rgba(244,244,245,0.08)');
  const accent = readVar('--accent-amber', readVar('--accent-blue', '#f59e0b'));
  // Detect light/dark from the page background — text-primary is the inverse
  // (light text on dark themes), so it must not be used for this check.
  const isLight = luminance(bgPrimary) > 0.5;

  return {
    background: `linear-gradient(150deg, ${bgCard} 0%, ${bgSecondary} 45%, ${bgPrimary} 100%)`,
    captureBackground: bgPrimary,
    stage: `radial-gradient(ellipse at top, ${withAlpha(accent, isLight ? 0.08 : 0.06)}, transparent 60%), ${bgPrimary}`,
    textPrimary,
    textBody: textSecondary,
    textMuted: textTertiary,
    borderTop: borderPrimary,
    avatarBg: `linear-gradient(135deg, ${bgTertiary}, ${bgSecondary})`,
    avatarBorder: borderPrimary,
    avatarText: accent,
    scoreColor: accent,
  };
}

// ─── The beautiful card itself (captured for export) ───────────────────────
export function BuzzPostCard({ post, timeAgo, palette }) {
  return (
    <div style={{
      boxSizing: 'border-box',
      width: CARD_WIDTH,
      minHeight: CARD_MIN_HEIGHT,
      padding: CARD_PADDING,
      borderRadius: CARD_RADIUS,
      color: palette.textPrimary,
      fontFamily: "'Inter', system-ui, sans-serif",
      background: palette.background,
      display: 'flex',
      flexDirection: 'column',
      gap: CARD_GAP,
      position: 'relative',
      overflow: 'hidden',
      textAlign: 'left',
    }}>
      {/* Header — navbar logo, centered & prominent */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <img
          src={logoNew}
          alt="AUSTWise"
          style={{ height: 64, width: 'auto', maxWidth: '90%', objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Content — pushed to the top, not vertically centered */}
      <div style={{
        position: 'relative', flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 10,
        paddingTop: 6,
      }}>
        {post.title && (
          <div style={{ fontSize: 23, fontWeight: 800, lineHeight: 1.28, color: palette.textPrimary, wordBreak: 'break-word' }}>
            {post.title}
          </div>
        )}
        {post.body && (
          <div style={{
            fontSize: 14.5, lineHeight: 1.65, color: palette.textBody,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {post.body}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative', borderTop: `1px solid ${palette.borderTop}`,
        paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: palette.avatarBg,
            border: `1px solid ${palette.avatarBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: palette.avatarText, flexShrink: 0,
          }}>
            {shadowInitials(post.author)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: palette.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.author}</div>
            <div style={{ fontSize: 10.5, color: palette.textMuted }}>{timeAgo}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: palette.scoreColor, flexShrink: 0 }}>
          <ArrowBigUp size={17} fill={palette.scoreColor} />
          {post.score}
        </div>
      </div>

    </div>
  );
}

// ─── Modal + export actions ────────────────────────────────────────────────
export default function SharePostCard({ post, timeAgo, onClose }) {
  const { theme } = useTheme();
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(null); // 'download' | 'copy' | 'share'
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');

  // Rebuild the palette on every render — the component re-renders whenever
  // the site theme changes (via useTheme), so the card always matches it.
  const palette = buildSitePalette();

  // Render the card off-screen and capture it at 3x → crisp 1080px-wide image.
  const captureCard = useCallback(async () => {
    const el = cardRef.current;
    if (!el) return null;
    const clone = el.cloneNode(true);
    clone.style.cssText = `
      position: fixed; left: -9999px; top: 0;
      width: ${CARD_WIDTH}px;
      z-index: 99999;
      background: ${palette.captureBackground};
    `;
    document.body.appendChild(clone);
    try {
      await new Promise((r) => setTimeout(r, 120));
      return await html2canvas(clone, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: palette.captureBackground,
        width: CARD_WIDTH,
        height: clone.scrollHeight,
      });
    } finally {
      if (document.body.contains(clone)) document.body.removeChild(clone);
    }
  }, [palette]);

  const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });

  const baseFileName = post?.id
    ? `buzz-post-${post.id}.png`
    : 'buzz-post.png';

  // Close on Escape + lock body scroll while the modal is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleDownload = async () => {
    setBusy('download');
    setNotice('');
    try {
      const canvas = await captureCard();
      const link = document.createElement('a');
      link.download = baseFileName;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download failed:', e);
      setNotice('Oops — couldn’t generate the image. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const doCopy = async () => {
    const canvas = await captureCard();
    const blob = await canvasToBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopy = async () => {
    setBusy('copy');
    setNotice('');
    try {
      await doCopy();
    } catch (e) {
      console.error('Copy failed:', e);
      setNotice('Copy needs a secure context — try Download instead.');
    } finally {
      setBusy(null);
    }
  };

  // Native share (WhatsApp / Instagram / etc. on mobile). Falls back to copy.
  const handleShare = async () => {
    setBusy('share');
    setNotice('');
    try {
      const canvas = await captureCard();
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], baseFileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'AUST Buzz',
          text: post?.title ? `“${post.title}”` : 'Check this out on AUST Buzz!',
        });
      } else {
        await doCopy();
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Share failed:', e);
        setNotice('Native share isn’t available here — use Download or Copy.');
      }
    } finally {
      setBusy(null);
    }
  };

  // Portal the overlay straight to <body> so it escapes the page layout's
  // stacking context (the .page-wrapper fadeInUp animation keeps a transform
  // which would otherwise trap a position:fixed overlay and let the navbar /
  // DevToolbar / other floating UI paint on top of it).
  return createPortal(
    <div className="buzz-share-overlay" onClick={onClose}>
      <div
        className="buzz-share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Share post card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="buzz-share-head">
          <div className="buzz-share-title"><Share2 size={15} /> Share post card</div>
          <button type="button" className="buzz-share-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Auto-match note */}
        <p className="buzz-share-auto-note">
          <Palette size={12} />
          Card matches your current theme
          {theme ? <strong> — {theme}</strong> : null}
        </p>

        <div className="buzz-share-stage" style={{ background: palette.stage }}>
          <div ref={cardRef}>
            <BuzzPostCard post={post} timeAgo={timeAgo} palette={palette} />
          </div>
        </div>

        <div className="buzz-share-actions">
          <button type="button" className="buzz-share-btn primary" onClick={handleDownload} disabled={!!busy}>
            {busy === 'download' ? <Loader2 size={15} className="buzz-share-spin" /> : <Download size={15} />}
            Download
          </button>
          <button type="button" className="buzz-share-btn" onClick={handleCopy} disabled={!!busy}>
            {copied
              ? <Check size={15} />
              : busy === 'copy' ? <Loader2 size={15} className="buzz-share-spin" /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy image'}
          </button>
          <button type="button" className="buzz-share-btn" onClick={handleShare} disabled={!!busy}>
            {busy === 'share' ? <Loader2 size={15} className="buzz-share-spin" /> : <Share2 size={15} />}
            Share
          </button>
        </div>

        {notice && <p className="buzz-share-notice">{notice}</p>}
        {!notice && (
          <p className="buzz-share-hint">
            Download or copy the image, then post it on WhatsApp or Instagram ✨
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
