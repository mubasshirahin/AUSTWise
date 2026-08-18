import { useState, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, Trophy, Users, Send, Award, CheckCircle } from 'lucide-react';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { useLiveRefresh } from '../../utils/liveStore';
import {
  MAX_PICKS,
  saveMyBallot,
  getMyBallot,
  getBestLeaderboard,
  getWorstLeaderboard,
  getTotalVoters,
} from '../../utils/coursePollStorage';

const densityColor = (count) => {
  if (count >= 3) return 'var(--accent-rose)';
  if (count === 2) return 'var(--accent-amber)';
  if (count === 1) return 'var(--accent-cyan)';
  return 'var(--accent-emerald)';
};

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

  const filled = picks.filter((pick) => pick.code).length;

  return (
    <div className="poll-pick-card">
      <div className="poll-pick-head" style={{ color: accent }}>
        {icon}
        <h4>{title}</h4>
        <span className="schedule-day-count">{filled}/{MAX_PICKS}</span>
      </div>

      <div className="poll-pick-slots">
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
    </div>
  );
}

function Leaderboard({ title, icon, accent, rows, totalVoters }) {
  const maxVotes = rows.length > 0 ? rows[0].votes : 0;

  return (
    <div className="poll-board">
      <div className="poll-board-head">
        <div style={{ color: accent }}>
          {icon}
          <h3>{title}</h3>
        </div>
        <span className="poll-board-voters">
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
        <div className="poll-board-rows">
          {rows.map((row, index) => {
            const density = densityColor(row.votes);
            return (
              <div key={row.code} className={`poll-row ${index === 0 ? 'poll-top' : ''}`} style={{ borderLeftColor: density }}>
                <span className="poll-rank" style={{ color: index === 0 ? accent : undefined }}>
                  {index + 1}
                </span>
                <div className="poll-course">
                  <div className="poll-course-line">
                    <span className="poll-code" style={{ color: density }}>{row.code}</span>
                    <span className={`schedule-day-count ${row.votes >= 3 ? 'hot' : ''}`}>
                      {row.votes} {row.votes === 1 ? 'vote' : 'votes'}
                    </span>
                  </div>
                  <span className="poll-name">{row.name}</span>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${maxVotes > 0 ? (row.votes / maxVotes) * 100 : 0}%`, background: density }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CoursePoll() {
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  // Live-sync: re-render leaderboards when another device submits a ballot.
  useLiveRefresh(['aust-course-poll-ballots-v1'], () => setRefreshTick((t) => t + 1));

  // Restore a previously submitted ballot (if any) directly in the lazy
  // initializers — no effect needed.
  const fillSlots = (picks) => {
    const slots = Array.from({ length: MAX_PICKS }, () => ({ code: '', name: '' }));
    (picks || []).forEach((p, i) => { if (i < MAX_PICKS) slots[i] = p; });
    return slots;
  };
  const [voted, setVoted] = useState(() => !!getMyBallot());
  const [best, setBest] = useState(() => {
    const existing = getMyBallot();
    return existing ? fillSlots(existing.best) : Array.from({ length: MAX_PICKS }, () => ({ code: '', name: '' }));
  });
  const [worst, setWorst] = useState(() => {
    const existing = getMyBallot();
    return existing ? fillSlots(existing.worst) : Array.from({ length: MAX_PICKS }, () => ({ code: '', name: '' }));
  });

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

  // Recompute the leaderboards whenever the live store refreshes (local or remote).
  const bestBoard = useMemo(() => getBestLeaderboard(), [refreshTick]);
  const worstBoard = useMemo(() => getWorstLeaderboard(), [refreshTick]);
  const totalVoters = useMemo(() => getTotalVoters(), [refreshTick]);

  const submit = (e) => {
    e.preventDefault();
    try {
      saveMyBallot(best, worst);
      setError('');
      setVoted(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-card-static schedule-widget st-widget poll-widget animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Trophy size={20} strokeWidth={2.2} />
          </div>
          <div className="schedule-title-text">
            <span className="schedule-overline">Grade Lab</span>
            <h2 className="schedule-title">Best &amp; Worst</h2>
            <span className="schedule-subtitle">Course poll · one vote per person</span>
          </div>
        </div>

        <div className="schedule-masthead-center schedule-stats">
          <div className="schedule-stat">
            <span className="schedule-stat-value">{totalVoters}</span>
            <span className="schedule-stat-label">Voters</span>
          </div>
        </div>

        <div className="schedule-actions">
          {voted ? (
            <span className="poll-recorded">
              <CheckCircle size={15} /> Recorded
            </span>
          ) : (
            <button type="submit" form="ballot-form" className="poll-submit">
              Submit My Picks <Send size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {!voted && (
        <form id="ballot-form" onSubmit={submit} className="poll-pickers">
          <div className="grid-2" style={{ gap: 'var(--sp-4)' }}>
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

          {error && <p className="poll-error">{error}</p>}
        </form>
      )}

      {voted && (
        <div className="poll-recorded-banner">
          <CheckCircle size={20} />
          <div>
            <p>Your vote has been recorded</p>
            <p>Thanks for sharing your opinion! You cannot change or delete your vote.</p>
          </div>
        </div>
      )}

      <div className="grid-2 poll-leaderboards" style={{ gap: 'var(--sp-4)' }}>
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
