import React, { useMemo } from 'react';
import { useLiveValue } from '../../utils/liveStore';
import { Grid3x3, MoreVertical, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatSemesterLabel } from '../../utils/semester';
import {
  MIN_BATCH_CONTRIBUTORS,
  MIN_CELL_CONTRIBUTORS,
  HEATMAP_SEMESTER_COUNT,
  buildHeatmapView,
  getBatchNoFromUser,
  heatmapDepartments,
  syncHeatmapFromTracker,
} from '../../utils/deptHeatmapStorage';

const semesterNumbers = Array.from({ length: HEATMAP_SEMESTER_COUNT }, (_, index) => index + 1);

const densityColor = (count) => {
  if (count >= 3) return 'var(--accent-rose)';
  if (count === 2) return 'var(--accent-amber)';
  if (count === 1) return 'var(--accent-cyan)';
  return 'var(--accent-emerald)';
};

const tierColor = (value) => {
  if (value === null) return null;
  if (value >= 3.5) return 'var(--accent-emerald)';
  if (value >= 3.2) return 'var(--accent-blue)';
  if (value >= 2.8) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
};

export default function DeptHeatmap() {
  const { user } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = React.useState(user.department || 'CSE');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const userBatchNo = getBatchNoFromUser(user);

  React.useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [submissions] = useLiveValue('shared', 'aust-helper-dept-heatmap-submissions-v1', []);
  const [userResults] = useLiveValue('user', 'aust-user-semester-results', null);
  // Immediate sync on mount so refresh shows heatmap without visiting CGPA calc
  React.useEffect(() => {
    syncHeatmapFromTracker();
  }, []);
  // Debounced sync on CGPA/batch changes — avoids 429
  const syncTimeoutRef = React.useRef(null);
  const debouncedSync = React.useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => syncHeatmapFromTracker(), 800);
  }, []);
  React.useEffect(() => {
    debouncedSync();
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [userResults, user.department, user.batch, user.batchNo, debouncedSync]);

  // Cleanup dummy/year/seed-demo data — keep only real 1-sem entries
  React.useEffect(() => {
    const isDummySeed = (s) => {
      const cid = String(s.contributorId);
      const no = String(s.batchNo);
      if (cid.startsWith('dummy-') || cid.startsWith('seed-demo-')) return true;
      if (/^20\d{2}$/.test(no)) return true;
      if (['50', '51', '52'].includes(no) && Object.keys(s.semesters || {}).length >= 6) return true;
      return false;
    };
    const hasDummy = submissions.some(isDummySeed);
    if (!hasDummy) return;
    const cleaned = submissions.filter((s) => !isDummySeed(s));
    import('../../utils/liveStorage.js').then(({ liveSave }) => {
      liveSave('shared', 'aust-helper-dept-heatmap-submissions-v1', cleaned);
    });
    try {
      localStorage.setItem('aust-helper-dept-heatmap-submissions-v1', JSON.stringify(cleaned));
    } catch {}
    try {
      localStorage.removeItem('aust-heatmap-dummy-seeded');
      localStorage.removeItem('aust-heatmap-dummy-seeded-v2');
    } catch {}
    setTimeout(() => syncHeatmapFromTracker(), 700);
  }, [submissions]);

  // No dummy demo — only real submissions from CGPA calc will show
  const heatmapView = useMemo(
    () => buildHeatmapView(selectedDepartment, submissions),
    [selectedDepartment, submissions],
  );

  const totalBatches = heatmapView.visibleBatches.length + heatmapView.pendingBatches.length;

  const allBatches = [...heatmapView.visibleBatches, ...heatmapView.pendingBatches]
    .sort((a, b) => Number(b.batchNo) - Number(a.batchNo));

  return (
    <div className="glass-card-static schedule-widget st-widget heatmap-widget animate-fadeInUp">
      <div className="schedule-masthead" style={{ gridTemplateColumns: '1fr auto' }}>
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Grid3x3 size={20} strokeWidth={2.2} />
          </div>
          <div className="schedule-title-text">
            <span className="schedule-overline">Grade Lab</span>
            <h2 className="schedule-title">Dept. Heatmap</h2>
            <span className="schedule-subtitle">
              Avg SGPA · {heatmapView.totalSubmissions} students · {totalBatches} batches
            </span>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="export-dropdown" ref={menuRef}>
            <button
              className="schedule-nav-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Heatmap options"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="export-menu">
                <div className="export-menu-sep" />
                {heatmapDepartments.map((department) => (
                  <button
                    key={department}
                    className={`export-menu-item ${selectedDepartment === department ? 'menu-active' : ''}`}
                    onClick={() => {
                      setSelectedDepartment(department);
                      setMenuOpen(false);
                    }}
                  >
                    <Check size={13} style={{ opacity: selectedDepartment === department ? 1 : 0 }} />
                    {department}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {heatmapView.visibleBatches.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <Grid3x3 size={36} />
          <h3>No batch data visible yet</h3>
          <p style={{ maxWidth: '520px', margin: '0 auto' }}>
            {heatmapView.pendingBatches.length > 0
              ? `${heatmapView.pendingBatches.length} batch(es) are collecting CGPA Calculator saves. Each batch needs ${MIN_BATCH_CONTRIBUTORS}+ students before its row appears.`
              : `Save semester results in CGPA Calculator (with batch set in Settings). Once ${MIN_BATCH_CONTRIBUTORS}+ students from the same batch contribute, averages will show here.`}
          </p>
        </div>
      ) : (
        <div className="hm-table">
          <div
            className="hm-row hm-header"
            style={{ gridTemplateColumns: `120px repeat(${HEATMAP_SEMESTER_COUNT}, 1fr)` }}
          >
            <div className="hm-head hm-batch-head">Batch</div>
            {semesterNumbers.map((semester) => (
              <div className="hm-head" key={semester}>{formatSemesterLabel(semester)}</div>
            ))}
          </div>

          {heatmapView.visibleBatches.map((batch) => {
            const batchDensity = densityColor(batch.contributorCount);
            const ready = batch.contributorCount >= MIN_BATCH_CONTRIBUTORS;

            return (
              <div
                key={batch.batchNo}
                className="hm-row hm-batch"
                style={{ gridTemplateColumns: `120px repeat(${HEATMAP_SEMESTER_COUNT}, 1fr)` }}
              >
                <div className="hm-cell hm-batch-label" style={{ borderLeftColor: batchDensity, color: batchDensity }}>
                  {batch.label}
                  <span
                    className={`schedule-day-count ${ready ? 'hot' : ''}`}
                    title={`${batch.contributorCount} / ${MIN_BATCH_CONTRIBUTORS} students`}
                  >
                    {batch.contributorCount}
                  </span>
                </div>

                {batch.cells.map((gpa, semesterIndex) => {
                  const color = tierColor(gpa);
                  return (
                    <div
                      key={semesterIndex}
                      className="hm-cell tooltip-wrapper"
                      style={{
                        borderLeftColor: color || 'transparent',
                        color: color || 'var(--text-tertiary)',
                      }}
                    >
                      {gpa !== null ? gpa.toFixed(2) : '—'}
                      <div className="tooltip">
                        {batch.label} • {formatSemesterLabel(semesterIndex + 1)}:{' '}
                        {gpa !== null ? `${gpa} avg SGPA` : `Needs ${MIN_CELL_CONTRIBUTORS}+ entries`}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Batch-wise contributor counter ── */}
      {(heatmapView.visibleBatches.length > 0 || heatmapView.pendingBatches.length > 0) && (
        <div className="hm-summary">
          <strong>Collected Data:</strong>
          <div className="hm-summary-chips">
            {allBatches.map((batch) => {
              const ready = batch.contributorCount >= MIN_BATCH_CONTRIBUTORS;
              return (
                <span key={batch.batchNo} className={`hm-summary-chip ${ready ? 'ready' : ''}`}>
                  <span>{batch.label}</span>
                  <b>{batch.contributorCount}</b>
                  <em>students</em>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="hm-legend">
        <span className="hm-legend-title">Heatmap Legend</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-emerald)' }}>High SGPA (3.5+)</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-blue)' }}>Moderate (3.2–3.5)</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-amber)' }}>Average (2.8–3.2)</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-rose)' }}>Critical (&lt;2.8)</span>
      </div>
    </div>
  );
}
