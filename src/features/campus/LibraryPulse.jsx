import React, { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { Library, Activity } from 'lucide-react';
import useLibraryTracking from '../../hooks/useLibraryTracking';
import LibraryHeatmap from './LibraryHeatmap';
import './SemesterViewWidget.css';
import './LibraryPulse.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  ChartLegend
);

export default function LibraryPulse() {
  // Resolve theme CSS vars to concrete canvas colors (var() won't paint on canvas).
  const cssVar = (name, fallback) =>
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
      : fallback;
  const barColor = cssVar('--accent-blue', '#F59E0B');
  const barActiveColor = cssVar('--accent-amber', '#F43F5E');
  const roseColor = cssVar('--accent-rose', '#F43F5E');

  // Live occupancy from the backend.
  const [occupancy, setOccupancy] = useState({ occupied: 0, reporting: 0, points: [], hourPeaks: [], capacity: 350 });

  // Background geofencing engine (starts only if tracking is enabled).
  const tracking = useLibraryTracking();

  // Fetch the current live count (short-polled every 10s).
  const loadPulse = useCallback(async () => {
    try {
      const res = await fetch('/api/library/pulse');
      const data = await res.json();
      if (data.success) {
        setOccupancy({
          occupied: data.occupied,
          reporting: data.reporting,
          points: data.points || [],
          hourPeaks: data.hourPeaks || [],
          capacity: data.capacity,
        });
      }
    } catch {
      /* server offline — keep last known value */
    }
  }, []);

  // Short polling loop for real-time sync without WebSockets.
  useEffect(() => {
    loadPulse();
    const id = setInterval(loadPulse, 10000);
    return () => clearInterval(id);
  }, [loadPulse]);

  const { hourPeaks } = occupancy;
  const nowHour = new Date().getHours();
  const currentIdx = hourPeaks.findIndex((h) => h.hour === nowHour);
  const currentPeak = currentIdx >= 0 ? hourPeaks[currentIdx].value : 0;
  const capacity = occupancy.capacity || 350;

  // Dashed "capacity" reference line drawn on the chart.
  const capacityLinePlugin = {
    id: 'capacityLine',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const y = scales.y.getPixelForValue(capacity);
      ctx.save();
      ctx.strokeStyle = roseColor;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = roseColor;
      ctx.font = '10px "SF Pro Display", "Segoe UI", sans-serif';
      ctx.fillText(`Capacity ${capacity}`, chartArea.left + 6, y - 5);
      ctx.restore();
    },
  };

  const chartData = {
    labels: hourPeaks.map((h) => h.label),
    datasets: [
      {
        label: 'Peak seats',
        data: hourPeaks.map((h) => h.value),
        backgroundColor: (ctx) => (ctx.dataIndex === currentIdx ? barActiveColor : barColor),
        hoverBackgroundColor: barActiveColor,
        borderRadius: 6,
        maxBarThickness: 44,
        borderSkipped: false,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cssVar('--bg-elevated', '#1c1c24'),
        titleColor: cssVar('--text-primary', '#f4f4f5'),
        bodyColor: cssVar('--text-secondary', '#a1a1aa'),
        borderColor: cssVar('--border-primary', '#2A2A35'),
        borderWidth: 1,
        callbacks: {
          label: (ctx) => {
            const isCurrent = ctx.dataIndex === currentIdx;
            return isCurrent ? `● Live peak: ${ctx.parsed.y} seats` : `Peak: ${ctx.parsed.y} seats`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: cssVar('--text-secondary', '#a1a1aa'), font: { size: 10 } } },
      y: { max: capacity, min: 0, ticks: { color: cssVar('--text-secondary', '#a1a1aa'), stepSize: 50 }, grid: { color: cssVar('--border-subtle', 'rgba(255,255,255,0.06)') } },
    },
  };

  const occupied = occupancy.occupied || 0;
  const occupancyPercentage = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
  const freeSeats = Math.max(capacity - occupied, 0);

  return (
    <div className="glass-card-static schedule-widget sv-widget library-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Library size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">Library Occupancy Pulse</div>
            <span className="schedule-subtitle">Live crowd level across the library</span>
            {tracking.enabled && (
              <span className="schedule-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span
                  className="lib-live-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: tracking.inside ? 'var(--accent-emerald)' : tracking.watching ? 'var(--accent-blue)' : 'var(--accent-amber)',
                    boxShadow: '0 0 6px currentColor',
                    display: 'inline-block',
                  }}
                />
                {tracking.error
                  ? 'Location unavailable — not counting you'
                  : tracking.inside
                    ? 'You are inside the library'
                    : tracking.watching
                      ? 'Live tracking active'
                      : 'Tracking active'}
              </span>
            )}
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{occupied}</span>
              <span className="schedule-stat-label">Occupied</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{freeSeats}</span>
              <span className="schedule-stat-label">Free</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{occupancyPercentage}%</span>
              <span className="schedule-stat-label">Full</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{occupancy.reporting}</span>
              <span className="schedule-stat-label">Tracking</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Hourly Peak Chart (real-time) ── */}
      <div className="lib-chart-card">
        <div className="lib-chart-head">
          <Activity size={15} />
          <span>Hourly Peak Tracker</span>
          {currentIdx >= 0 ? (
            <span className="lib-chart-live">
              <span className="lib-live-dot" />
              {hourPeaks[currentIdx].label} live peak · {currentPeak}/{capacity}
            </span>
          ) : (
            <span className="lib-chart-hint">peak seats / hour</span>
          )}
        </div>
        <div className="lib-chart-body">
          <Bar data={chartData} options={chartOptions} plugins={[capacityLinePlugin]} />
        </div>
      </div>

      {/* ── Live Heatmap ── */}
      <LibraryHeatmap self={tracking.position} points={occupancy.points} occupied={occupied} capacity={capacity} />

    </div>
  );
}
