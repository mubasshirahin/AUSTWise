import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Award, BookOpen, CalendarDays, Flame, GraduationCap, Mail,
  Orbit, Sparkles, UserRound,
} from 'lucide-react';
import { useStalk } from '../stalk-road/StalkContext';
import './MemberProfilePage.css';

function roleLabel(role = 'student') {
  if (role === 'cr') return 'CR';
  if (role === 'sr') return 'SR';
  if (role === 'alumni_with_carry') return 'Alumni with carry';
  return role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/presence/profiles/${encodeURIComponent(memberId)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load this profile.');
        setProfile(data.profile);
        if (data.profile.studentId && data.profile.studentId !== memberId) {
          navigate(`/members/${encodeURIComponent(data.profile.studentId)}`, { replace: true });
        }
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') setError(fetchError.message || 'Could not load this profile.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [memberId, navigate]);

  const identity = useMemo(() => {
    if (!profile) return [];
    return [
      { label: 'AUSTWise ID', value: profile.awid, icon: UserRound },
      { label: 'Student ID', value: profile.studentId, icon: GraduationCap },
      { label: 'Email', value: profile.email, icon: Mail, kind: 'email' },
      { label: 'Blood group', value: profile.bloodGroup, icon: Droplets },
      { label: 'Department', value: profile.department, icon: BookOpen },
      { label: 'Batch', value: profile.batchName || profile.batchNo || profile.batch, icon: CalendarDays },
      { label: 'Year · Semester', value: profile.yearSemester || (profile.semester ? `Semester ${profile.semester}` : ''), icon: GraduationCap },
      { label: 'Section', value: profile.section && profile.labSection ? `${profile.section} · Lab ${profile.labSection}` : profile.section || profile.labSection, icon: BookOpen },
      { label: 'Designation', value: profile.designation, icon: Award },
      { label: 'Company', value: profile.company, icon: Orbit },
      { label: 'Graduation year', value: profile.graduationYear, icon: CalendarDays },
    ].filter((item) => item.value !== '' && item.value !== null && item.value !== undefined);
  }, [profile]);

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  if (loading) {
    return <div className="member-profile-state" role="status" aria-live="polite">Loading profile…</div>;
  }

  if (error || !profile) {
    return (
      <div className="member-profile-state">
        <p>{error || 'Member not found.'}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Go back</button>
      </div>
    );
  }

  const activity = profile.activity || {};
  const socialAccounts = Array.isArray(profile.linkedAccounts) ? profile.linkedAccounts : [];
  const activityInsights = [
    Number(activity.maxStreak) > 0 && `Your best streak is ${activity.maxStreak} days. AUSTWise is starting to suspect this is your favorite study spot.`,
    Number(activity.semestersRecorded) > 0 && `${activity.semestersRecorded} semesters on record. Your transcript has officially entered its lore era.`,
    Number(activity.transcriptCourses) > 0 && `${activity.transcriptCourses} courses recorded. Even your timetable needs a timetable.`,
  ].filter(Boolean).slice(0, 3);
  const lastActiveText = profile.status === 'online'
    ? 'Active now'
    : profile.lastSeenAt
      ? `Last active ${new Date(profile.lastSeenAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'Activity time unavailable';

  return (
    <main className="member-profile-page">
      <button type="button" className="member-profile-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back to members
      </button>

      <section className="member-profile-hero glass-card-static">
        <div className="member-profile-cover" />
        <div className="member-profile-heading">
          <div className="member-profile-avatar">
            {profile.avatar ? <img src={profile.avatar} alt="" /> : profile.initials}
          </div>
          <div className="member-profile-name-block">
            <span className="member-profile-role">{roleLabel(profile.role)}</span>
            <h1>{profile.name}</h1>
            <p>{[profile.department, profile.yearSemester || (profile.semester ? `Semester ${profile.semester}` : '')].filter(Boolean).join(' · ') || 'AUSTWise member'}</p>
          </div>
          {joinedDate && <span className="member-profile-joined">Member since {joinedDate}</span>}
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
              {kind === 'email' ? <a href={`mailto:${value}`}>{identityValue(value)}</a> : <strong>{identityValue(value)}</strong>}
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
          <div><h2 id="member-activity-title">AUSTWise activity</h2><p>Personal account data and contributions · {lastActiveText}</p></div>
        </div>
        <div className="member-profile-metrics">
          <Metric icon={Flame} label="Max streak (days)" value={activity.maxStreak} tone="is-amber" />
          <Metric icon={GraduationCap} label="Semesters recorded" value={activity.semestersRecorded} tone="is-blue" />
          <Metric icon={BookOpen} label="Courses in transcript" value={activity.transcriptCourses} tone="is-purple" />
        </div>
      </section>

      <section className="member-profile-fun glass-card-static" aria-labelledby="member-profile-fun-title">
        <div className="member-profile-fun-heading"><Sparkles size={17} /><h2 id="member-profile-fun-title">AUSTWise noticed…</h2></div>
        {activityInsights.length > 0 ? (
          <ul>{activityInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
        ) : (
          <p>This profile is still in its quiet era. One saved note or study session will give AUSTWise something to tease you about.</p>
        )}
      </section>

      <div className="member-profile-orbit-wrap">
        <p>Want to see more of {profile.name.split(' ')[0]}&apos;s world?</p>
        <button type="button" className="member-profile-orbit" onClick={() => stalk(profile)}>
          <Orbit size={17} /> Visit Orbit
        </button>
      </div>
    </main>
  );
}
