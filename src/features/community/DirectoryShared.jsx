import { useEffect, useId, useRef, useState } from 'react';
import { Building2, ChevronDown, Orbit, UserRound } from 'lucide-react';
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
}) {
  const previewId = `directory-profile-preview-${useId().replace(/:/g, '')}`;
  const initials = getMemberInitials(member);
  const stats = previewStats.filter(([, value]) => value);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef(null);
  const { stalk } = useStalk();

  // Close on an outside tap or Escape.
  useEffect(() => {
    if (!previewOpen) return undefined;
    const onPointer = (event) => {
      if (previewRef.current && !previewRef.current.contains(event.target)) setPreviewOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setPreviewOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [previewOpen]);

  return (
    <div ref={previewRef} className={`alumni-avatar-preview${previewOpen ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={avatarClassName}
        style={{ ...avatarStyle, padding: 0, border: 'none', cursor: 'pointer', overflow: 'hidden' }}
        onClick={() => setPreviewOpen((open) => !open)}
        title={`${member.name} — quick stats`}
        aria-label={`Show ${member.name}'s quick stats`}
        aria-expanded={previewOpen}
        aria-controls={previewId}
      >
        {member.avatar ? (
          <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : initials}
      </button>
      <div id={previewId} className="alumni-profile-preview" role="dialog" aria-label={`${member.name} quick stats`}>
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
    </div>
  );
}
