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
  const [selectedChartSemester, setSelectedChartSemester] = React.useState(null);
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

  const semesterAverages = useMemo(() => semesterNumbers.map((semester, index) => {
    const batches = heatmapView.visibleBatches.filter((batch) => batch.cells[index] !== null);
    const average = batches.length
      ? batches.reduce((sum, batch) => sum + batch.cells[index], 0) / batches.length
      : null;
    return { semester, average, batchCount: batches.length };
  }), [heatmapView]);

  const chart = { width: 960, height: 340, left: 48, right: 18, top: 50, bottom: 48 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const chartX = (index) => chart.left + (semesterNumbers.length === 1 ? plotWidth / 2 : (index * plotWidth) / (semesterNumbers.length - 1));
  const chartY = (value) => chart.top + ((4 - value) / 4) * plotHeight;
  let chartPathActive = false;
  const chartPath = semesterAverages.map((item, index) => {
    if (item.average === null) { chartPathActive = false; return ''; }
    const command = chartPathActive ? 'L' : 'M';
    chartPathActive = true;
    return `${command} ${chartX(index)} ${chartY(item.average)}`;
  }).filter(Boolean).join(' ');

  const totalBatches = heatmapView.visibleBatches.length + heatmapView.pendingBatches.length;

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

      {heatmapView.visibleBatches.length > 0 && (
        <section className="hm-chart-card" aria-label={`${selectedDepartment} semester average graph`}>
          <div className="hm-chart-heading">
            <div>
              <h3>{selectedDepartment} · Semester Average</h3>
              <p>Average SGPA across batches. Click a point to see how many batches contributed.</p>
            </div>
            <span className="hm-chart-basis">Batch average</span>
          </div>
          <div className="hm-chart-scroll">
            <svg className="hm-average-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${selectedDepartment} average SGPA by semester with contributing batch counts`}>
              {[0, 1, 2, 3, 4].map((tick) => {
                const y = chartY(tick);
                return (
                  <g key={tick}>
                    <line className="hm-chart-gridline" x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} />
                    <text className="hm-chart-y-label" x={chart.left - 10} y={y + 4} textAnchor="end">{tick.toFixed(1)}</text>
                  </g>
                );
              })}
              {chartPath && <path className="hm-chart-line" d={chartPath} />}
              {semesterAverages.map((item, index) => {
                const x = chartX(index);
                const y = item.average === null ? null : chartY(item.average);
                const isSelected = selectedChartSemester === item.semester;
                const countLabelY = y === null ? null : Math.max(8, y - 35);
                const countLabelX = Math.min(chart.width - chart.right - 38, Math.max(chart.left + 38, x));
                return (
                  <g key={item.semester}>
                    {y !== null && (
                      <>
                        <line className="hm-chart-point-guide" x1={x} x2={x} y1={y} y2={chart.height - chart.bottom} />
                        <circle
                          className={`hm-chart-point ${isSelected ? 'is-selected' : ''}`}
                          cx={x} cy={y} r={isSelected ? 7 : 5}
                          role="button" tabIndex="0"
                          aria-label={`${formatSemesterLabel(item.semester)}, ${item.average.toFixed(2)} average SGPA. Click to show contributing batch count.`}
                          onClick={() => setSelectedChartSemester(isSelected ? null : item.semester)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedChartSemester(isSelected ? null : item.semester);
                            }
                          }}
                        >
                          <title>{`${selectedDepartment} · ${formatSemesterLabel(item.semester)} · ${item.average.toFixed(2)} avg SGPA`}</title>
                        </circle>
                        {isSelected && (
                          <g className="hm-chart-count-badge" aria-live="polite">
                            <rect x={countLabelX - 38} y={countLabelY} width="76" height="22" rx="11" />
                            <text x={countLabelX} y={countLabelY + 15} textAnchor="middle">
                              {item.batchCount} {item.batchCount === 1 ? 'batch' : 'batches'}
                            </text>
                          </g>
                        )}
                        <text className="hm-chart-value-label" x={x} y={y + 19} textAnchor="middle">{item.average.toFixed(2)}</text>
                      </>
                    )}
                    <text className="hm-chart-x-label" x={x} y={chart.height - 16} textAnchor="middle">{formatSemesterLabel(item.semester)}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
      )}

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

            return (
              <div
                key={batch.batchNo}
                className="hm-row hm-batch"
                style={{ gridTemplateColumns: `120px repeat(${HEATMAP_SEMESTER_COUNT}, 1fr)` }}
              >
                <div className="hm-cell hm-batch-label" style={{ borderLeftColor: batchDensity, color: batchDensity }}>
                  {batch.label}
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
