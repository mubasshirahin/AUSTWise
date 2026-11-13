import { Building2, ChevronDown } from 'lucide-react';
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
  const previewId = `directory-profile-preview-${encodeURIComponent(String(member.id))}`;
  const initials = getMemberInitials(member);
  const meta = metaItems.filter(Boolean);
  const stats = previewStats.filter(([, value]) => value);

  return (
    <div className="alumni-card">
      <div className="alumni-card-top">
        <div className="alumni-avatar-preview">
          <button
            type="button"
            className="avatar"
            style={{ width: '40px', height: '40px', flexShrink: 0, padding: 0, border: 'none', cursor: 'pointer', overflow: 'hidden' }}
            onClick={onOpenProfile}
            title={`View ${member.name}'s profile / ID`}
            aria-label={`View ${member.name}'s profile`}
            aria-describedby={previewId}
          >
            {member.avatar ? (
              <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : initials}
          </button>
          <div id={previewId} className="alumni-profile-preview" role="tooltip">
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
          </div>
        </div>

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
