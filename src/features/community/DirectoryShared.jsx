import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, ChevronDown, Orbit, UserRound } from 'lucide-react';
import './MemberAvatarPreview.css';
import { getMemberPreviewStats, mergeWithDirectory } from '../../utils/memberPreview';
import { getCachedMembers } from '../../utils/memberDirectory';

/**
 * Profile icon for a loose person record ({ userId|id, studentId, name,
 * avatar, department, batchLabel, email }): floating mini stats card filled
 * from the member directory; "View profile" calls onOpenProfile.
 */
export function MemberIconPreview({ person, onOpenProfile, avatarClassName, avatarContent }) {
  const id = person?.studentId || person?.userId || person?.id || '';
  const card = mergeWithDirectory({
    id: person?.userId || person?.id || id,
    studentId: person?.studentId,
    name: person?.name || 'Member',
    avatar: person?.avatar || undefined,
    department: person?.department,
    batch: person?.batchLabel || person?.batch,
    email: person?.email,
  }, getCachedMembers());
  return (
    <MemberAvatarPreview
      floating
      member={card}
      roleLabel={card.role ? String(card.role).toUpperCase() : 'Member'}
      previewStats={getMemberPreviewStats(card)}
      onOpenProfile={id ? onOpenProfile : undefined}
      avatarClassName={avatarClassName}
      avatarStyle={{}}
      avatarContent={avatarContent}
    />
  );
}
import { useStalk } from '../stalk-road/StalkContext';
import { getMemberInitials } from './directoryUtils';

// Shared building blocks for the Alumni, Student and Faculty directories so
// all three render departments and people in exactly the same style.

/** Collapsible department header: building icon · full name · count · chevron. */
export function DirectoryDepartmentHeader({ label, count, expanded, onToggle, contentId }) {
  return (
    <div className="alumni-batch-header">
      <button
        type="button"
        className="alumni-group-toggle"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <Building2 className="alumni-department-icon" size={16} aria-hidden="true" />
        <span className="alumni-department-name" role="heading" aria-level="3">{label}</span>
        {count !== undefined && <span className="alumni-department-count">{count}</span>}
        <ChevronDown className={`alumni-group-chevron${expanded ? ' is-expanded' : ''}`} size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * One person row: avatar (with hover profile preview) · name + badges ·
 * a department line · a muted meta line · trailing icon actions.
 *
 * `previewStats` is a list of [label, value] pairs (falsy values skipped).
 * `metaItems` are plain strings joined with " · "; `email` is appended as a
 * mailto link.
 */
export function DirectoryMemberCard({
  member,
  roleLabel,
  isMe = false,
  badges = null,
  deptLine,
  metaItems = [],
  email,
  previewStats = [],
  actions = null,
  onOpenProfile,
}) {
  const meta = metaItems.filter(Boolean);

  return (
    <div className="alumni-card">
      <div className="alumni-card-top">
        <MemberAvatarPreview
          member={member}
          roleLabel={roleLabel}
          previewStats={previewStats}
          onOpenProfile={onOpenProfile}
        />

        <div className="alumni-card-info">
          <h3 className="alumni-card-name">
            {member.name}
            {badges}
            {isMe && <span className="alumni-card-you">you</span>}
          </h3>
          {deptLine && <p className="alumni-card-dept">{deptLine}</p>}
          {(meta.length > 0 || email) && (
            <p className="alumni-card-meta">
              {meta.join(' · ')}
              {email && (
                <>
                  {meta.length > 0 && ' · '}
                  <a href={`mailto:${email}`} className="alumni-card-email" title={email}>
                    {email}
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <div className="alumni-card-actions">{actions}</div>
      </div>
    </div>
  );
}

/**
 * Avatar button + mini stats card. Hover (or keyboard focus) shows the card;
 * click/tap toggles it. The card carries "View profile" and "Visit Orbit".
 * Shared by the member rows and the Student Directory's SR/CR/VP/GS slots.
 */
export function MemberAvatarPreview({
  member,
  roleLabel,
  previewStats = [],
  onOpenProfile,
  avatarClassName = 'avatar',
  avatarStyle = { width: '40px', height: '40px', flexShrink: 0 },
  className = '',
  // Portal the card to <body> with fixed positioning, for icons inside
  // scrolling/clipping containers (notice list, chat header, admin cards).
  floating = false,
  // Custom icon content (keeps a call site's existing avatar markup).
  avatarContent,
}) {
  const previewId = `directory-profile-preview-${useId().replace(/:/g, '')}`;
  const initials = getMemberInitials(member);
  const stats = previewStats.filter(([, value]) => value);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [floatPos, setFloatPos] = useState(null); // { top, left }
  const previewRef = useRef(null);
  const buttonRef = useRef(null);
  const cardRef = useRef(null);
  const hoverTimer = useRef(null);
  const { stalk } = useStalk();

  // Close on an outside tap or Escape.
  useEffect(() => {
    if (!previewOpen) return undefined;
    const onPointer = (event) => {
      if (previewRef.current?.contains(event.target) || cardRef.current?.contains(event.target)) return;
      setPreviewOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setPreviewOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [previewOpen]);

  // Floating: place under the icon (above when no room), clamped 8px inside
  // the viewport; follow the icon on scroll/resize.
  const place = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const card = cardRef.current;
    const w = card?.offsetWidth || Math.min(300, window.innerWidth - 32);
    const h = card?.offsetHeight || 0;
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - w - 8));
    let top = r.bottom + 8;
    if (h && top + h > window.innerHeight - 8 && r.top - h - 8 >= 8) top = r.top - h - 8;
    setFloatPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, []);
  useLayoutEffect(() => {
    if (!floating || !previewOpen) { setFloatPos(null); return undefined; }
    place();
    const raf = requestAnimationFrame(place); // re-place once the card has a size
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [floating, previewOpen, place]);

  // Floating hover: native listeners (React's synthetic enter/leave is
  // unreliable across the portal) with a short close delay so the cursor
  // can cross the gap onto the card.
  useEffect(() => {
    if (!floating) return undefined;
    const els = [buttonRef.current, previewOpen ? cardRef.current : null].filter(Boolean);
    const enter = (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer.current);
      setPreviewOpen(true);
    };
    const leave = (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setPreviewOpen(false), 140);
    };
    els.forEach((el) => { el.addEventListener('pointerenter', enter); el.addEventListener('pointerleave', leave); });
    return () => els.forEach((el) => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); });
  }, [floating, previewOpen]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const card = (
      <div
        id={previewId}
        ref={cardRef}
        className={`alumni-profile-preview${floating ? ' is-floating' : ''}`}
        role="dialog"
        aria-label={`${member.name} quick stats`}
        style={floating ? { top: floatPos?.top ?? -9999, left: floatPos?.left ?? -9999 } : undefined}
        // React bubbles portal events up the component tree: keep clicks and
        // touches on the card from expanding/swiping the row it belongs to.
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <div className="alumni-profile-preview-head">
          <span className="alumni-profile-preview-avatar">
            {member.avatar ? <img src={member.avatar} alt="" /> : initials}
          </span>
          <span className="alumni-profile-preview-identity">
            <strong>{member.name}</strong>
            <span>{roleLabel}</span>
          </span>
        </div>
        {stats.length > 0 && (
          <div className="alumni-profile-preview-stats">
            {stats.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        )}
        <div className="alumni-profile-preview-actions">
          {onOpenProfile && (
            <button
              type="button"
              className="alumni-profile-preview-cta"
              onClick={() => { setPreviewOpen(false); onOpenProfile(); }}
            >
              <UserRound size={13} aria-hidden="true" />
              View profile
            </button>
          )}
          <button
            type="button"
            className="alumni-profile-preview-cta"
            onClick={() => { setPreviewOpen(false); stalk(member); }}
            aria-label={`Visit ${member.name}'s Orbit`}
          >
            <Orbit size={13} aria-hidden="true" />
            Visit Orbit
          </button>
        </div>
      </div>
  );

  return (
    <div ref={previewRef} className={`alumni-avatar-preview${previewOpen ? ' is-open' : ''}${floating ? ' is-floating-anchor' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        ref={buttonRef}
        className={avatarClassName}
        style={{ ...avatarStyle, padding: 0, border: 'none', cursor: 'pointer', overflow: 'hidden' }}
        onClick={(event) => {
          // Never let the icon click open/expand the row it sits in.
          event.stopPropagation();
          setPreviewOpen((open) => !open);
        }}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        title={`${member.name} — quick stats`}
        aria-label={`Show ${member.name}'s quick stats`}
        aria-expanded={previewOpen}
        aria-controls={previewId}
      >
        {avatarContent ?? (member.avatar ? (
          <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initials)}
      </button>
      {floating
        ? (previewOpen && createPortal(card, document.body))
        : card}
    </div>
  );
}
