import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight, BookOpen, Coffee, FileText, Handshake, History, MessageSquare, MessagesSquare,
  NotebookPen, ScrollText, Star, Users, Vote, X,
} from 'lucide-react';

// Shared by the public profile (/members/:id) and the Settings → Identity
// preview of your own profile, so both show contributions the same way.

// Every kind of contribution the server credits to a member.
const CONTRIBUTION_KINDS = {
  paper: { label: 'Question papers', icon: ScrollText },
  cheatsheet: { label: 'Cheatsheets', icon: NotebookPen },
  community: { label: 'Community posts', icon: Users },
  peer: { label: 'Mentor / study offers', icon: Handshake },
  routine: { label: 'Class routines', icon: BookOpen },
  review: { label: 'Course reviews', icon: Star },
  comment: { label: 'Course comments', icon: MessagesSquare },
  poll: { label: 'Course polls', icon: Vote },
  campus: { label: 'Campus feedback', icon: Coffee },
  reply: { label: 'Mentor replies', icon: MessageSquare },
  other: { label: 'Other', icon: FileText },
};
// Older servers send only the type text, so map it to a kind.
const KIND_BY_TYPE = {
  'Question paper shared': 'paper',
  'Cheatsheet shared': 'cheatsheet',
  'Community post': 'community',
  'Mentor or study partner offer': 'peer',
  'Class routine shared': 'routine',
  'Course review': 'review',
  'Course comment': 'comment',
  'Course poll submitted': 'poll',
  'Campus feedback': 'campus',
  'Mentorship reply': 'reply',
};
const RECENT_LIMIT = 5;

// DEV ONLY — dummy contributions for previewing the card + "View all" modal.
// In `npm run dev` they appear automatically when a profile has 5 or fewer
// real contributions (so "View all" shows), or always with ?demo in the URL;
// ?nodemo turns them off. Never stored anywhere; stripped from production
// builds because import.meta.env.DEV is false there.
function buildDemoContributions() {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const rows = [
    ['paper', 'Question paper shared', 'CSE 3101 — Mid term 2025'],
    ['comment', 'Course comment', 'CSE 3103 discussion'],
    ['cheatsheet', 'Cheatsheet shared', 'Data Structures — Graph algorithms cheatsheet'],
    ['review', 'Course review', 'MATH 2103 review'],
    ['community', 'Community post', 'Selling Casio fx-991EX calculator'],
    ['reply', 'Mentorship reply', 'How to start competitive programming?'],
    ['routine', 'Class routine shared', 'CSE routine'],
    ['poll', 'Course poll submitted', 'Best & Worst course poll'],
    ['campus', 'Campus feedback', 'Canteen review'],
    ['peer', 'Mentor or study partner offer', 'Digital Logic Design study partner'],
    ['paper', 'Question paper shared', 'EEE 2101 — Final 2024 (a very long title to check the ellipsis truncation)'],
    ['community', 'Community post', 'Lost: blue water bottle near Library'],
    ['cheatsheet', 'Cheatsheet shared', 'Operating Systems — Scheduling summary'],
    ['campus', 'Campus feedback', 'Canteen feedback'],
    ['comment', 'Course comment', 'CSE 2201 discussion'],
    ['review', 'Course review', 'HUM 1201 review'],
    ['paper', 'Question paper shared', 'CSE 1101 — Quiz 2'],
    ['reply', 'Mentorship reply', 'Best resources for DBMS?'],
    ['paper', 'Question paper shared', 'CSE 2103 — Final 2025'],
    ['community', 'Community post', 'To-let: room near Tejgaon for 2 students'],
    ['review', 'Course review', 'CSE 3201 review'],
    ['cheatsheet', 'Cheatsheet shared', 'Computer Networks — OSI layers in one page'],
    ['comment', 'Course comment', 'MATH 2201 discussion'],
    ['peer', 'Mentor or study partner offer', 'Java OOP mentor (weekends)'],
    ['campus', 'Campus feedback', 'Canteen review'],
    ['reply', 'Mentorship reply', 'Which thesis lab is best for ML?'],
    ['routine', 'Class routine shared', 'CSE routine'],
    ['paper', 'Question paper shared', 'EEE 1101 — Mid term 2024'],
    ['community', 'Community post', 'Found: student ID card at Gate 2'],
    ['poll', 'Course poll submitted', 'Best & Worst course poll'],
  ];
  const gaps = [1, 3, 6, 9, 14, 20, 27, 35, 41, 48, 60, 72, 88, 95, 120, 150, 185, 230,
    250, 268, 290, 305, 330, 352, 371, 395, 410, 440, 465, 500];
  return rows.map(([kind, type, title], index) => ({
    id: `demo-${index}`,
    kind,
    type,
    title,
    createdAt: new Date(now - gaps[index] * day).toISOString(),
  }));
}

function getContributionKind(item) {
  const kind = item?.kind || KIND_BY_TYPE[item?.type];
  return CONTRIBUTION_KINDS[kind] ? kind : 'other';
}

function formatContributionDate(value, options) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, options);
}

const FULL_DATE = { day: 'numeric', month: 'short', year: 'numeric' };
const SHORT_DATE = { day: 'numeric', month: 'short' };

function ContributionRow({ item, dateOptions = FULL_DATE }) {
  const kind = getContributionKind(item);
  const Icon = CONTRIBUTION_KINDS[kind].icon;
  const date = formatContributionDate(item.createdAt, dateOptions);
  return (
    <li className="mp-contrib-row">
      <span className="mp-contrib-icon" aria-hidden="true"><Icon size={14} /></span>
      <span className="mp-contrib-body">
        <strong title={item.title}>{item.title}</strong>
        <span>{item.type}</span>
      </span>
      {date && <time className="mp-contrib-date" dateTime={new Date(item.createdAt).toISOString()}>{date}</time>}
    </li>
  );
}

/** Full contribution history: type filter chips + rows grouped by month. */
function ContributionsModal({ name, items, total, onClose }) {
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const kindCounts = useMemo(() => {
    const counts = {};
    for (const item of items) {
      const kind = getContributionKind(item);
      counts[kind] = (counts[kind] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const groups = useMemo(() => {
    const visible = filter === 'all' ? items : items.filter((item) => getContributionKind(item) === filter);
    const byMonth = [];
    for (const item of visible) {
      const label = formatContributionDate(item.createdAt, { month: 'long', year: 'numeric' }) || 'Undated';
      const last = byMonth[byMonth.length - 1];
      if (last && last.label === label) last.items.push(item);
      else byMonth.push({ label, items: [item] });
    }
    return byMonth;
  }, [items, filter]);

  return createPortal(
    <div className="modal-overlay mp-overlay" onClick={onClose}>
      <div
        className="modal mp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s contributions`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mp-modal-head">
          <span className="mp-modal-title"><History size={14} /> All contributions</span>
          <button type="button" className="mp-modal-close" onClick={onClose} aria-label="Close"><X size={13} /></button>
        </div>
        <div className="mp-modal-summary">
          <span className="mp-badge is-amber">Total: {total}</span>
          <span className="mp-badge">Types: <strong>{kindCounts.length}</strong></span>
          {total > items.length && <span className="mp-badge">Latest {items.length} shown</span>}
        </div>

        <div className="mp-chip-row" role="tablist" aria-label="Filter contributions by type">
          <button type="button" role="tab" aria-selected={filter === 'all'} className="mp-chip" onClick={() => setFilter('all')}>
            All <span>{items.length}</span>
          </button>
          {kindCounts.map(([kind, count]) => {
            const Icon = CONTRIBUTION_KINDS[kind].icon;
            return (
              <button key={kind} type="button" role="tab" aria-selected={filter === kind} className="mp-chip" onClick={() => setFilter(kind)}>
                <Icon size={12} aria-hidden="true" /> {CONTRIBUTION_KINDS[kind].label} <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mp-modal-list">
          {groups.map((group) => (
            <section key={group.label} className="mp-month">
              <h3 className="mp-month-label">{group.label}<span>{group.items.length}</span></h3>
              <ul className="mp-contrib-list">
                {group.items.map((item) => <ContributionRow key={item.id} item={item} dateOptions={SHORT_DATE} />)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * "Recent contributions" card: latest 5 rows, a total count, and a
 * "View all" button that opens the full history modal.
 * In dev it fills itself with dummy items (see buildDemoContributions).
 */
export function RecentContributionsCard({ name, items, total, headingId = 'recent-contributions-title' }) {
  const [showAll, setShowAll] = useState(false);
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const realCount = Array.isArray(items) ? items.length : 0;
  const showDemo = Boolean(params)
    && !params.has('nodemo')
    && (params.has('demo') || realCount <= RECENT_LIMIT);
  const contributions = useMemo(
    () => (showDemo ? buildDemoContributions() : (Array.isArray(items) ? items : [])),
    [showDemo, items],
  );
  const contributionsTotal = showDemo
    ? contributions.length
    : Math.max(Number(total) || 0, contributions.length);

  return (
    <section className="member-profile-fun glass-card-static" aria-labelledby={headingId}>
      <div className="member-profile-fun-heading">
        <BookOpen size={17} />
        <h2 id={headingId}>Recent contributions</h2>
        {showDemo && <span className="mp-count mp-demo-tag" title="Dummy data — dev only. Add ?nodemo to the URL to hide.">Dev demo</span>}
        {contributionsTotal > 0 && <span className="mp-count">{contributionsTotal}</span>}
      </div>
      {contributions.length > 0 ? (
        <>
          <ul className="mp-contrib-list">
            {contributions.slice(0, RECENT_LIMIT).map((item) => <ContributionRow key={item.id} item={item} />)}
          </ul>
          {contributions.length > RECENT_LIMIT && (
            <button type="button" className="mp-view-all" onClick={() => setShowAll(true)}>
              View all {contributionsTotal} contributions <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </>
      ) : (
        <div className="mp-empty">
          <span className="mp-empty-icon"><FileText size={16} aria-hidden="true" /></span>
          <p className="mp-empty-hint">No verified contributions yet.</p>
        </div>
      )}
      {showAll && (
        <ContributionsModal
          name={name}
          items={contributions}
          total={contributionsTotal}
          onClose={() => setShowAll(false)}
        />
      )}
    </section>
  );
}
