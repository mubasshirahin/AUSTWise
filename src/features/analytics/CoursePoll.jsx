import React, { useState, useMemo, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Trophy, Users, Send, Award, CheckCircle } from 'lucide-react';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import {
  MAX_PICKS,
  saveMyBallot,
  getMyBallot,
  getBestLeaderboard,
  getWorstLeaderboard,
  getTotalVoters,
} from '../../utils/coursePollStorage';

function PickList({ title, icon, accent, picks, setPicks }) {
  const updateSlot = (index, course) => {
    const next = [...picks];
    if (!course) {
      next[index] = { code: '', name: '' };
    } else if (course.partialUpdate) {
      next[index] = { code: course.code ?? next[index].code, name: next[index].name };
    } else {
      next[index] = { code: course.code || '', name: course.name || '' };
    }
    setPicks(next);
  };

  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="flex items-center gap-2" style={{ color: accent }}>
        {icon}
        <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0 }}>{title}</h4>
      </div>

      {picks.map((pick, index) => (
        <CourseAutocomplete
          key={index}
          value={pick.code}
          onCourseSelect={(course) => updateSlot(index, course)}
          placeholder="e.g. CSE 1101"
          type="code"
        />
      ))}
    </div>
  );
}

function Leaderboard({ title, icon, accent, rows, totalVoters }) {
  const maxVotes = rows.length > 0 ? rows[0].votes : 0;

  return (
    <div className="glass-card-static" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2" style={{ color: accent }}>
          {icon}
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>{title}</h3>
        </div>
        <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          <Users size={12} /> {totalVoters} voted
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px 16px' }}>
          <Trophy size={32} style={{ opacity: 0.5 }} />
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '8px' }}>
            No votes yet. Be the first to pick.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map((row, index) => (
            <div
              key={row.code}
              className="flex items-center gap-3 p-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${index === 0 ? accent : 'var(--border-primary)'}`,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: index === 0 ? accent : 'var(--text-tertiary)',
                  minWidth: '20px',
                  textAlign: 'center',
                }}
              >
                {index + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{row.code}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    {row.votes} {row.votes === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 6px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.name}
                </p>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${maxVotes > 0 ? (row.votes / maxVotes) * 100 : 0}%`, background: accent }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoursePoll() {
  const [voted, setVoted] = useState(false);
  const [best, setBest] = useState(() =>
    Array.from({ length: MAX_PICKS }, () => ({ code: '', name: '' }))
  );
  const [worst, setWorst] = useState(() =>
    Array.from({ length: MAX_PICKS }, () => ({ code: '', name: '' }))
  );
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if this browser already submitted a ballot
    const existing = getMyBallot();
    if (existing) {
      setVoted(true);
      // Restore picks from existing ballot for display
      const fillSlots = (picks) => {
        const slots = Array.from({ length: MAX_PICKS }, () => ({ code: '', name: '' }));
        (picks || []).forEach((p, i) => { if (i < MAX_PICKS) slots[i] = p; });
        return slots;
      };
      setBest(fillSlots(existing.best));
      setWorst(fillSlots(existing.worst));
    }
  }, []);

  /*
   * MANUAL TEST: Duplicate-vote protection
   * 1. Open the Course Poll page, pick some courses, and click "Submit My Picks".
   * 2. Verify the leaderboard shows your vote counted (totalVoters increased by 1).
   * 3. Reload the page — you should see the "Your vote has been recorded" view,
   *    NOT the voting form. The submit button is not shown.
   * 4. In DevTools → Application → Local Storage, find the key
   *    "aust-course-poll-ballots-v1". Verify your ballot appears exactly once.
   * 5. Manually delete just that ballot from localStorage, reload — the vote form
   *    reappears (since no ballot belongs to this contributorId anymore).
   *
   * Expected: clicking vote twice (via page reloads or re-submit attempts) only
   * counts once because saveMyBallot filters out the existing contributorId
   * before pushing the new ballot, and getMyBallot() short-circuits the form on
   * mount before any submit handler can fire.
   */

  const bestBoard = useMemo(() => getBestLeaderboard(), [version]);
  const worstBoard = useMemo(() => getWorstLeaderboard(), [version]);
  const totalVoters = useMemo(() => getTotalVoters(), [version]);

  const submit = (e) => {
    e.preventDefault();
    try {
      saveMyBallot(best, worst);
      setError('');
      setVoted(true);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  if (voted) {
    return (
      <div className="course-poll-wrapper animate-fadeInUp" style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--sp-5)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        <div className="mb-6">
          <h2 className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Best &amp; Worst Courses</h2>
        </div>

        <div className="flex items-center gap-3 mb-6" style={{ padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)' }}>
          <CheckCircle size={20} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 'bold', margin: 0 }}>Your vote has been recorded</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Thanks for sharing your opinion! You cannot change or delete your vote.
            </p>
          </div>
        </div>

        <div className="grid-2" style={{ gap: '16px' }}>
          <Leaderboard
            title="Top Rated Courses"
            icon={<Award size={18} />}
            accent="var(--accent-emerald)"
            rows={bestBoard}
            totalVoters={totalVoters}
          />
          <Leaderboard
            title="Lowest Rated Courses"
            icon={<ThumbsDown size={18} />}
            accent="var(--accent-rose)"
            rows={worstBoard}
            totalVoters={totalVoters}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="course-poll-wrapper animate-fadeInUp" style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--sp-5)',
      boxShadow: '0 4px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <div className="mb-6">
        <h2 className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Best &amp; Worst Courses</h2>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
          Pick up to {MAX_PICKS} favourite and {MAX_PICKS} least-favourite courses.
          Your vote is one-time only — you cannot change or delete it after submitting.
        </p>
      </div>

      <form onSubmit={submit} className="mb-6">
        <div className="grid-2" style={{ gap: '16px' }}>
          <PickList
            title="Your Best Courses"
            icon={<ThumbsUp size={16} />}
            accent="var(--accent-emerald)"
            picks={best}
            setPicks={setBest}
          />
          <PickList
            title="Your Worst Courses"
            icon={<ThumbsDown size={16} />}
            accent="var(--accent-rose)"
            picks={worst}
            setPicks={setWorst}
          />
        </div>

        {error && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)', marginTop: '12px' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        <button type="submit" style={{
          padding: '10px 28px 10px 24px',
          fontSize: 'var(--fs-sm)',
          fontWeight: 'var(--fw-semibold)',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          outline: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget;
          btn.style.borderColor = 'var(--accent-amber)';
          btn.style.background = 'color-mix(in srgb, var(--accent-amber) 12%, transparent)';
          btn.style.color = 'var(--accent-amber)';
          btn.style.boxShadow = '0 0 20px color-mix(in srgb, var(--accent-amber) 15%, transparent)';
          const icon = btn.querySelector('.submit-icon');
          if (icon) icon.style.transform = 'translateX(4px)';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget;
          btn.style.borderColor = 'rgba(255,255,255,0.1)';
          btn.style.background = 'rgba(255,255,255,0.04)';
          btn.style.color = 'var(--text-primary)';
          btn.style.boxShadow = 'none';
          const icon = btn.querySelector('.submit-icon');
          if (icon) icon.style.transform = 'none';
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-amber)';
          e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-amber) 20%, transparent)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          Submit My Picks
          <span className="submit-icon" style={{
            display: 'inline-flex',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <Send size={15} />
          </span>
        </button>
        </div>
      </form>

      <div className="grid-2" style={{ gap: '16px' }}>
        <Leaderboard
          title="Top Rated Courses"
          icon={<Award size={18} />}
          accent="var(--accent-emerald)"
          rows={bestBoard}
          totalVoters={totalVoters}
        />
        <Leaderboard
          title="Lowest Rated Courses"
          icon={<ThumbsDown size={18} />}
          accent="var(--accent-rose)"
          rows={worstBoard}
          totalVoters={totalVoters}
        />
      </div>
    </div>
  );
}
