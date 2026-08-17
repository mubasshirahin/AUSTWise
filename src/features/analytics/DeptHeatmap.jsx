import React, { useMemo } from 'react';
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

  const heatmapView = useMemo(
    () => buildHeatmapView(selectedDepartment),
    [selectedDepartment],
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
              Avg CGPA · {heatmapView.totalSubmissions} students · {totalBatches} batches
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
            const isUserBatch = batch.batchNo === userBatchNo;
            const batchDensity = densityColor(batch.contributorCount);
            const ready = batch.contributorCount >= MIN_BATCH_CONTRIBUTORS;

            return (
              <div
                key={batch.batchNo}
                className={`hm-row hm-batch ${isUserBatch ? 'hm-user' : ''}`}
                style={{ gridTemplateColumns: `120px repeat(${HEATMAP_SEMESTER_COUNT}, 1fr)` }}
              >
                <div className="hm-cell hm-batch-label" style={{ borderLeftColor: batchDensity, color: batchDensity }}>
                  {batch.label}
                  {isUserBatch && <em>You</em>}
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
                        {gpa !== null ? `${gpa} avg CGPA` : `Needs ${MIN_CELL_CONTRIBUTORS}+ CGPA Calculator entries`}
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
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-emerald)' }}>High CGPA (3.5+)</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-blue)' }}>Moderate (3.2–3.5)</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-amber)' }}>Average (2.8–3.2)</span>
        <span className="hm-legend-chip" style={{ '--chip': 'var(--accent-rose)' }}>Critical (&lt;2.8)</span>
      </div>
    </div>
  );
}
