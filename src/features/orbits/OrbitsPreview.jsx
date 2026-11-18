import {
  Orbit, Film, Gamepad2, Music, Target, User, BookOpen, Heart, MapPin, Sparkles,
  Users, Link2, Swords, ShieldCheck, Palette, Trophy, Plane, Award, ExternalLink, Check,
  GraduationCap, Code, FolderGit2, Sun, Brain, Radio, Languages, History, Briefcase,
  Laptop, Coffee, PawPrint, Lightbulb, MessageCircle, PenLine,
} from 'lucide-react';
import { createElement } from 'react';
import { humanizeKey } from './OrbitsContext';
import { mediaSourceFor, mediaShapeFor, mediaItem } from './mediaSearch';

// Renders one checkpoint's edited fields — the "same to same" content that
// shows in the stalk road-trip when you Drive My Orbit. Fields are edited in
// Checkpoint Control; this only previews them.
//
// Each field picks a layout from its key and the shape of its value:
//   short text / number   → "quick facts" tiles
//   short tag lists       → chips (stack, traits, topics)
//   message + signature   → signed note
//   long text             → paragraph
//   social handles        → link rows (GitHub, LinkedIn …)
//   media lists           → poster / cover / artwork / flag tiles
//   colour list           → swatches
//   quotes                → quote lines
//   other text lists      → numbered list
//   this-or-that          → A vs B with the pick marked
//   object lists          → entries: title, tag (year / role), body, link

const ICONS = [
  // specific labels first — "Ask Me About" must not fall into /about/, etc.
  [/ask me/i, MessageCircle],
  [/note to|guestbook/i, PenLine],
  [/career|job/i, Briefcase],
  [/day in|routine/i, Sun],
  [/campus/i, GraduationCap],
  [/skill|stack|tech/i, Code],
  [/project/i, FolderGit2],
  [/personality/i, Brain],
  [/^currently/i, Radio],
  [/language/i, Languages],
  [/timeline|history/i, History],
  [/setup|gear/i, Laptop],
  [/hangout|spot|cafe/i, Coffee],
  [/\bpets?\b/i, PawPrint],
  [/fun fact|trivia/i, Lightbulb],
  [/favourite|favorite/i, Heart],
  [/movie|film|series|anime|watch|cinema/i, Film],
  [/game|gaming|play/i, Gamepad2],
  [/music|song|artist|playlist|band/i, Music],
  [/bucket|goal|dream|plan|future/i, Target],
  [/user|about|bio|profile|intro|detail/i, User],
  [/associat|club|societ/i, Users],
  [/social|connect/i, Link2],
  [/this or that|versus|vs/i, Swords],
  [/blueprint|clearance/i, ShieldCheck],
  [/hobb/i, Palette],
  [/achiev|award/i, Trophy],
  [/travel|trip|journey/i, Plane],
  [/book|study|subject|class|course/i, BookOpen],
  [/home|town|place|city/i, MapPin],
];
const iconFor = (label) => ICONS.find(([re]) => re.test(label || ''))?.[1] || Orbit;

const SOCIAL = {
  github: { tag: 'GH', name: 'GitHub', url: (h) => `https://github.com/${h}` },
  linkedin: { tag: 'in', name: 'LinkedIn', url: (h) => `https://www.linkedin.com/in/${h}` },
  facebook: { tag: 'f', name: 'Facebook', url: (h) => `https://facebook.com/${h}` },
  instagram: { tag: 'IG', name: 'Instagram', url: (h) => `https://instagram.com/${h}` },
  discord: { tag: 'D', name: 'Discord', url: null },
  twitter: { tag: 'X', name: 'X', url: (h) => `https://x.com/${h}` },
};

const SHORT = 42;
const filled = (v) => String(v ?? '').trim() !== '';
const itemHasValue = (item) => Object.values(item || {}).some(filled);
const isUrl = (s) => /^https?:\/\//i.test(String(s || ''));
const cleanHandle = (h) => String(h).trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\/(in\/)?/i, '').replace(/\/$/, '');

function prettyValue(key, val) {
  const text = String(val ?? '').trim();
  if (/(_at|date)$/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return text;
}

// short-word lists that read better as chips than as a numbered list
const CHIP_KEYS = /languages|frameworks|tools|learning|words|flags|peeves|topics|tags|skills|traits/i;

const isCssColor = (c) => typeof CSS !== 'undefined' && CSS.supports?.('color', c);

// object-list item → { title, tag, body, link }
function entryOf(item) {
  const get = (...keys) => keys.map((k) => item[k]).find(filled);
  const title = get('title', 'name', 'destination', 'language', 'question') || Object.values(item).find(filled);
  const tag = get('year', 'designation', 'role', 'rank', 'level', 'species', 'area');
  const body = get('experience', 'description', 'details', 'note');
  const link = get('certificate_url', 'url', 'link');
  const linkLabel = filled(item.certificate_url) ? 'View certificate' : 'Open link';
  return {
    title: String(title ?? ''), tag: tag ? String(tag) : '', body: body ? String(body) : '',
    link: isUrl(link) ? link : '', linkLabel,
  };
}

function classify(entries) {
  const facts = [];
  const blocks = [];
  const links = [];
  let signature = '';
  entries.forEach(([key, val]) => {
    const label = humanizeKey(key);

    if (key === 'signature' && typeof val === 'string') { signature = val.trim(); return; }

    if (SOCIAL[key.toLowerCase()] && !Array.isArray(val)) {
      if (filled(val)) links.push({ key: key.toLowerCase(), handle: cleanHandle(val) });
      return;
    }

    if (Array.isArray(val)) {
      const isMedia = mediaSourceFor(key) || val.some((v) => v && typeof v === 'object' && 'image' in v);
      if (isMedia) {
        const items = val.map(mediaItem).filter((it) => filled(it.title));
        if (items.length) blocks.push({ kind: 'media', key, label, items, shape: mediaShapeFor(key) });
        return;
      }
      if (val.length && typeof val[0] === 'object') {
        const objs = val.filter(itemHasValue);
        if (!objs.length) return;
        if ('option_a' in objs[0]) {
          blocks.push({ kind: 'vs', key, label, items: objs });
        } else {
          blocks.push({ kind: 'entries', key, label, items: objs.map(entryOf).filter((e) => e.title) });
        }
        return;
      }
      const items = val.map((v) => mediaItem(v).title).filter(filled);
      if (!items.length) return;
      if (/colou?r/i.test(key)) blocks.push({ kind: 'colors', key, label, items });
      else if (CHIP_KEYS.test(key)) blocks.push({ kind: 'chips', key, label, items });
      else if (/quote/i.test(key)) blocks.push({ kind: 'quotes', key, label, items });
      else blocks.push({ kind: 'list', key, label, items });
      return;
    }

    if (typeof val === 'number') {
      facts.push({ key, label, text: val.toLocaleString(), isNum: true });
      return;
    }
    const text = prettyValue(key, val);
    if (!text) return;
    if (text.length <= SHORT && !text.includes('\n')) facts.push({ key, label, text });
    else blocks.push({ kind: 'text', key, label, text });
  });
  if (links.length) blocks.unshift({ kind: 'links', key: '__links', label: 'Find me on', items: links });
  if (signature) {
    // a signed note: attach to the message; with no message it is just a fact
    const msg = blocks.find((b) => b.kind === 'text' && b.key === 'message')
      || (() => { const f = facts.findIndex((x) => x.key === 'message'); if (f < 0) return null; const [m] = facts.splice(f, 1); const b = { kind: 'text', key: m.key, label: m.label, text: m.text }; blocks.push(b); return b; })();
    if (msg) { msg.kind = 'note'; msg.sign = signature; } else facts.push({ key: 'signature', label: 'Signature', text: signature });
  }
  return { facts, blocks };
}

function Block({ b }) {
  const countable = !['text', 'note'].includes(b.kind);
  return (
    <section className={`sr-orbit-block is-${b.kind}`}>
      <h4 className="sr-orbit-label">
        {b.label}
        {countable && <span className="sr-orbit-count">{b.items.length}</span>}
      </h4>

      {b.kind === 'text' && <p className="sr-orbit-text">{b.text}</p>}

      {b.kind === 'note' && (
        <div className="sr-orbit-note">
          <p className="sr-orbit-text">{b.text}</p>
          <p className="sr-orbit-sign">{b.sign}</p>
        </div>
      )}

      {b.kind === 'chips' && (
        <ul className="sr-orbit-chips">
          {b.items.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}

      {b.kind === 'links' && (
        <ul className="sr-orbit-links">
          {b.items.map(({ key, handle }) => {
            const s = SOCIAL[key];
            const href = s.url ? s.url(handle) : '';
            const inner = (
              <>
                <span className="sr-orbit-link-tile">{s.tag}</span>
                <span className="sr-orbit-link-txt"><small>{s.name}</small><b>{handle}</b></span>
                {href && <ExternalLink size={13} className="sr-orbit-link-go" />}
              </>
            );
            return (
              <li key={key}>
                {href
                  ? <a className="sr-orbit-link" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
                  : <span className="sr-orbit-link">{inner}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {b.kind === 'media' && (
        <ul className={`sr-orbit-media is-${b.shape}`}>
          {b.items.map((it, i) => (
            <li key={i} className="sr-orbit-media-item">
              <span className="sr-orbit-thumb">
                {it.image
                  ? <img src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
                  : null}
                <span className="sr-orbit-thumb-fallback" aria-hidden="true">{it.title.charAt(0)}</span>
              </span>
              <span className="sr-orbit-media-txt">
                <b title={it.title}>{it.title}</b>
                {it.sub && <small>{it.sub}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {b.kind === 'colors' && (
        <ul className="sr-orbit-colors">
          {b.items.map((c, i) => (
            <li key={i}>
              <span className="sr-orbit-swatch" style={isCssColor(c) ? { background: c } : undefined} />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}

      {b.kind === 'quotes' && (
        <ul className="sr-orbit-quotes">
          {b.items.map((qt, i) => <li key={i}>{qt}</li>)}
        </ul>
      )}

      {b.kind === 'list' && (
        <ol className="sr-orbit-list">
          {b.items.map((it, i) => (
            <li key={i}>
              <span className="sr-orbit-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="sr-orbit-li">{it}</span>
            </li>
          ))}
        </ol>
      )}

      {b.kind === 'vs' && (
        <ul className="sr-orbit-vs">
          {b.items.map((it, i) => {
            const pick = String(it.selected_option || '').toLowerCase();
            const opts = [['a', it.option_a], ['b', it.option_b]];
            return (
              <li key={it.q_id || i}>
                {filled(it.question) && <p className="sr-orbit-vs-q">{it.question}</p>}
                <div className="sr-orbit-vs-row">
                  {opts.map(([k, text], j) => {
                    const on = pick === k || (pick && pick === String(text || '').toLowerCase());
                    return (
                      <span key={k} className="sr-orbit-vs-cell">
                        {j === 1 && <i className="sr-orbit-vs-or">or</i>}
                        <span className={`sr-orbit-vs-opt${on ? ' is-on' : ''}`}>
                          {on && <Check size={12} strokeWidth={3} />}
                          {text || '—'}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {b.kind === 'entries' && (
        <ul className="sr-orbit-entries">
          {b.items.map((e, i) => (
            <li key={i}>
              <div className="sr-orbit-entry-head">
                <span className="sr-orbit-row-main">{e.title}</span>
                {e.tag && <span className="sr-orbit-tag">{e.tag}</span>}
              </div>
              {e.body && <p className="sr-orbit-entry-body">{e.body}</p>}
              {e.link && (
                <a className="sr-orbit-entry-link" href={e.link} target="_blank" rel="noopener noreferrer">
                  {e.linkLabel === 'View certificate' ? <Award size={12} /> : <ExternalLink size={12} />} {e.linkLabel}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function OrbitsCheckpointPreview({ label, fields, accent }) {
  const entries = Object.entries(fields || {});
  const { facts, blocks } = classify(entries);
  const count = facts.length + blocks.reduce((n, b) => n + (b.items ? b.items.length : 1), 0);
  const headIcon = createElement(iconFor(label), { size: 17 });

  return (
    <div className="sr-orbit-cp" style={accent ? { '--sa': accent } : undefined}>
      <header className="sr-orbit-head">
        <span className="sr-orbit-head-icon">{headIcon}</span>
        <div className="sr-orbit-head-text">
          <h3 className="sr-orbit-title">{label}</h3>
          <span className="sr-orbit-sub">
            {count ? `${count} ${count === 1 ? 'detail' : 'details'}` : 'Checkpoint'}
          </span>
        </div>
      </header>

      {count === 0 ? (
        <p className="sr-orbit-empty">
          <Sparkles size={14} />
          <span>Nothing filled in yet — edit it in Checkpoint Control.</span>
        </p>
      ) : (
        <div className="sr-orbit-body">
          {facts.length > 0 && (
            <dl className={`sr-orbit-facts${facts.length === 1 ? ' is-single' : ''}`}>
              {facts.map((f) => (
                <div className={`sr-orbit-fact${f.isNum ? ' is-num' : ''}`} key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{f.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {blocks.map((b) => <Block b={b} key={b.key} />)}
        </div>
      )}
    </div>
  );
}
