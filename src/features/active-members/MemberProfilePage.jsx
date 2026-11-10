import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Award, BookOpen, CalendarDays, CheckCircle2, Coffee, Droplets, FileText, Flame, GraduationCap, Handshake, Mail,
  MessageSquare, Orbit, Phone, UserRound, Users, Vote,
} from 'lucide-react';
import { useStalk } from '../stalk-road/StalkContext';
import { getAllAccounts, getDisplayRoles, getRoleDisplayName } from '../../utils/authStorage';
import { getDisplayBatchText } from '../../utils/batchIdentity';
import { getAlumniEmployment } from '../../utils/alumniEmployment';
import { copyText } from '../../utils/clipboard';
import './MemberProfilePage.css';

/** Local fallback: accounts that exist only on this device (not yet on the
 *  server) still get a viewable profile from localStorage. */
function findLocalProfile(memberId) {
  try {
    const accounts = getAllAccounts();
    const acc = accounts.find(
      (a) => a && (a.id === memberId || a.awid === memberId || (a.email || '').split('@')[0] === memberId)
    );
    if (!acc) return null;
    return {
      id: acc.id,
      awid: acc.awid || '',
      name: acc.name || '',
      initials: acc.initials || '',
      avatar: acc.avatar || null,
      coverPhoto: acc.coverPhoto || null,
      profileView: acc.profileView || 'classic',
      role: acc.role || 'student',
      roles: Array.isArray(acc.roles) ? acc.roles : (acc.role ? [acc.role] : []),
      email: acc.email || '',
      phone: acc.privacy?.showPhone === false ? '' : (acc.phone || ''),
      privacy: { showPhone: acc.privacy?.showPhone !== false },
      studentId: '',
      bloodGroup: acc.bloodGroup || '',
      department: acc.department || '',
      batch: acc.batch || '',
      batchNo: acc.batchNo || '',
      batchName: acc.batchName || '',
      yearSemester: acc.yearSemester || '',
      semester: acc.semester ?? null,
      section: acc.section || '',
      labSection: acc.labSection || '',
      designation: acc.designation || '',
      company: String(acc.company || '').trim() && String(acc.company || '').trim().toLowerCase() === String(acc.designation || '').trim().toLowerCase() ? '' : (acc.company || ''),
      graduationYear: acc.graduationYear || '',
      createdAt: acc.createdAt || null,
      status: 'offline',
      linkedAccounts: [],
      activity: {},
      orbit: acc.orbit || null,
    };
  } catch {
    return null;
  }
}

function identityValue(value) {
  return value === null || value === undefined || value === '' ? 'Not set' : value;
}

function Metric({ icon: Icon, label, value, tone }) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className={`member-profile-metric ${tone || ''}`}>
      <span className="member-profile-metric-icon"><Icon size={17} /></span>
      <strong>{displayValue ?? 0}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function MemberProfilePage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { stalk } = useStalk();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const load = async () => {
      const response = await fetch(`/api/presence/profiles/${encodeURIComponent(memberId)}`, {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        const err = new Error(data.error || 'Could not load this profile.');
        err.status = response.status;
        throw err;
      }
      return data;
    };
    load()
      .then((data) => {
        setProfile(data.profile);
        if (data.profile.studentId && data.profile.studentId !== memberId) {
          navigate(`/members/${encodeURIComponent(data.profile.studentId)}`, { replace: true });
        }
      })
      .catch(async (fetchError) => {
        if (fetchError.name === 'AbortError') return;
        // One retry for transient server/network blips (e.g. buffer errors)
        try {
          await new Promise((r) => setTimeout(r, 800));
          if (controller.signal.aborted) return;
          const data = await load();
          setProfile(data.profile);
          return;
        } catch { /* fall through to local fallback / error state */ }
        // Server has no such member — try this device's local accounts
        const local = findLocalProfile(memberId);
        if (local) {
          setProfile(local);
          return;
        }
        setError(fetchError.status === 401 ? 'Please login to view this profile.' : fetchError.message || 'Could not load this profile.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [memberId, navigate, retryCount]);

  if (loading) {
    return <div className="member-profile-state" role="status" aria-live="polite">Loading profile…</div>;
  }

  if (error || !profile) {
    return (
      <div className="member-profile-state">
        <p>{error || 'Member not found.'}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setRetryCount((c) => c + 1)}>Retry</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Go back</button>
        </div>
      </div>
    );
  }

  const activity = profile.activity || {};
  const socialAccounts = Array.isArray(profile.linkedAccounts) ? profile.linkedAccounts : [];
  const displayRoles = [...new Set([
    ...getDisplayRoles(profile),
    profile.role,
    ...(Array.isArray(profile.roles) ? profile.roles : []),
  ].map((role) => String(role || '').trim().toLowerCase()).filter(Boolean))];
  const isFacultyProfile = displayRoles.includes('faculty') || displayRoles.some((role) => role.startsWith('faculty_'));
  const isAlumniProfile = displayRoles.includes('alumni') || displayRoles.includes('alumni_with_carry');
  const isFaculty = displayRoles.includes('faculty') || displayRoles.some((role) => role.startsWith('faculty_'));
  const activityLabels = isFaculty
    ? { resources: 'Teaching resources' }
    : { resources: displayRoles.includes('alumni') ? 'Academic resources' : 'Study resources shared' };
  const activityStats = [
    { id: 'streak', icon: Flame, label: 'Max streak (days)', value: activity.maxStreak, tone: 'is-amber' },
    { id: 'resources', icon: FileText, label: activityLabels.resources, value: activity.resourcesShared, tone: 'is-blue' },
    { id: 'communityPosts', icon: Users, label: 'Community posts', value: activity.communityPosts, tone: 'is-purple' },
    { id: 'peerOffers', icon: Handshake, label: 'Mentor / study offers', value: activity.peerOffers, tone: 'is-rose' },
    { id: 'courseReviews', icon: GraduationCap, label: 'Course reviews & comments', value: activity.courseReviews, tone: 'is-cyan' },
    { id: 'coursePolls', icon: Vote, label: 'Course polls submitted', value: activity.coursePolls, tone: 'is-purple' },
    { id: 'campusFeedback', icon: Coffee, label: 'Campus feedback', value: activity.campusFeedback, tone: 'is-emerald' },
    { id: 'mentorReplies', icon: MessageSquare, label: 'Mentor replies', value: activity.mentorReplies, tone: 'is-rose' },
    { id: 'routinesShared', icon: BookOpen, label: 'Class routines shared', value: activity.routinesShared, tone: 'is-blue' },
  ];
  const visibleActivityStats = Array.isArray(profile.profileActivityVisible)
    ? activityStats.filter(({ id }) => profile.profileActivityVisible.includes(id))
    : activityStats;
  const joinedDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : '';
  const employment = getAlumniEmployment(profile);
  const identity = [
    { label: 'AUSTWise ID', value: profile.awid || profile.id, icon: UserRound },
    ...(!isFacultyProfile ? [{ label: 'Student ID', value: profile.studentId, icon: GraduationCap }] : []),
    { label: 'Email', value: profile.email, icon: Mail, kind: 'email' },
    { label: 'Phone', value: profile.privacy?.showPhone === false ? 'Hidden' : profile.phone, icon: Phone },
    { label: 'Blood group', value: profile.bloodGroup, icon: Droplets },
    { label: 'Department', value: profile.department, icon: BookOpen },
    ...(isAlumniProfile ? [
      { label: 'Batch', value: getDisplayBatchText(profile), icon: CalendarDays },
      { label: 'Graduation year', value: profile.graduationYear, icon: CalendarDays },
      { label: 'Designation', value: employment.designation, icon: GraduationCap },
      { label: 'Company', value: employment.company, icon: Award },
    ] : isFacultyProfile ? [
      { label: 'Designation', value: employment.designation, icon: GraduationCap },
      { label: 'Company', value: employment.company, icon: Award },
    ] : [
      { label: 'Batch', value: getDisplayBatchText(profile), icon: CalendarDays },
      { label: 'Year · Semester', value: profile.yearSemester || (profile.semester ? `Semester ${profile.semester}` : ''), icon: GraduationCap },
      { label: 'Section', value: profile.section, icon: Users },
      { label: 'Lab Group', value: profile.labSection, icon: Users },
    ]),
  ];
  const lastActiveText = profile.status === 'online'
    ? 'Active now'
    : profile.lastSeenAt
      ? `Last active ${new Date(profile.lastSeenAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : '';
  const handleCopyEmail = async () => {
    try {
      await copyText(profile.email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      setCopiedEmail(false);
    }
  };

  return (
    <main className={`member-profile-page profile-view-${['classic', 'compact', 'spotlight'].includes(profile.profileView) ? profile.profileView : 'classic'}`}>
      <button type="button" className="member-profile-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <section className="member-profile-hero glass-card-static">
        <div className={`member-profile-cover${profile.coverPhoto ? ' has-cover' : ' is-default-cover'}`}>
          {profile.coverPhoto && <img src={profile.coverPhoto} alt="" aria-hidden="true" />}
        </div>
        <div className="member-profile-heading">
          <div className="avatar xl member-profile-avatar">
            {profile.avatar ? <img src={profile.avatar} alt={`${profile.name}'s profile`} referrerPolicy="no-referrer" /> : profile.initials}
          </div>
          <div className="member-profile-name-block">
            <div className="member-profile-roles" aria-label="Assigned roles">
              {displayRoles.map((roleKey) => (
                <span key={roleKey} className="member-profile-role">{getRoleDisplayName(roleKey)}</span>
              ))}
            </div>
            <h1>{profile.name}</h1>
            <p>{[
              profile.department,
              isFacultyProfile
                ? profile.designation
                : isAlumniProfile
                  ? (profile.graduationYear ? `Graduated ${profile.graduationYear}` : '')
                  : (profile.yearSemester || (profile.semester ? `Semester ${profile.semester}` : '')),
            ].filter(Boolean).join(' · ') || 'AUSTWise member'}</p>
          </div>
          <div className="member-profile-hero-actions">
            <button type="button" className="member-profile-orbit" onClick={() => stalk(profile)} aria-label={`Visit ${profile.name}'s Orbit`}>
              <Orbit size={15} /> Visit Orbit <span aria-hidden="true">↗</span>
            </button>
            <span className="member-profile-joined"><CalendarDays size={13} />{joinedDate ? `Member since ${joinedDate}` : 'AUSTWise member'}</span>
          </div>
        </div>
      </section>

      <section className="member-profile-section glass-card-static" aria-labelledby="member-identity-title">
        <div className="member-profile-section-heading">
          <span className="member-profile-section-icon"><UserRound size={18} /></span>
          <div><h2 id="member-identity-title">Identity</h2><p>Profile details from their Identity settings</p></div>
        </div>
        <div className="member-profile-identity-grid">
          {identity.map(({ label, value, icon: Icon, kind }) => (
            <div className="member-profile-identity-item" key={label}>
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              {kind === 'email' ? <button type="button" onClick={handleCopyEmail} className="member-profile-email" aria-label={copiedEmail ? 'Email copied' : 'Copy email address'} title={copiedEmail ? 'Copied!' : 'Click to copy'}>{identityValue(value)}{copiedEmail && <CheckCircle2 size={13} aria-hidden="true" />}</button> : <strong>{identityValue(value)}</strong>}
            </div>
          ))}
        </div>
        {socialAccounts.some((account) => account?.providerName || account?.provider) && (
          <div className="member-profile-socials">
            <h3>Linked accounts</h3>
            <div>
              {socialAccounts.filter((account) => account?.providerName || account?.provider).map((account) => {
                const href = /^https?:\/\//i.test(account.link || '') ? account.link : '';
                const label = account.providerName || account.provider;
                const handle = account.displayName || account.username || label;
                return href
                  ? <a key={account.provider} href={href} target="_blank" rel="noreferrer">{label}: {handle}</a>
                  : <span key={account.provider}>{label}: {handle}</span>;
              })}
            </div>
          </div>
        )}
      </section>

      <section className="member-profile-section glass-card-static" aria-labelledby="member-activity-title">
        <div className="member-profile-section-heading">
          <span className="member-profile-section-icon is-activity"><Orbit size={18} /></span>
          <div><h2 id="member-activity-title">Contributions</h2><p>Verified resources and community activity{lastActiveText ? ` · ${lastActiveText}` : ''}</p></div>
        </div>
        <div className="member-profile-metrics">
          {visibleActivityStats.map((stat) => <Metric key={stat.id} icon={stat.icon} label={stat.label} value={stat.value} tone={stat.tone} />)}
        </div>
      </section>

      <section className="member-profile-fun glass-card-static" aria-labelledby="member-profile-fun-title">
        <div className="member-profile-fun-heading"><BookOpen size={17} /><h2 id="member-profile-fun-title">Recent contributions</h2></div>
        {Array.isArray(activity.recentContributions) && activity.recentContributions.length > 0 ? (
          <ul>{activity.recentContributions.map((item) => (
            <li key={item.id}><strong>{item.title}</strong><span>{item.type}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}</span></li>
          ))}</ul>
        ) : (
          <p>No verified contributions yet.</p>
        )}
      </section>

    </main>
  );
}
