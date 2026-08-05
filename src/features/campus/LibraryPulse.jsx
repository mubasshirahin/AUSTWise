import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Library, Activity, MapPin, LogOut, Loader2, Users, Armchair, Gauge } from 'lucide-react';
import { libraryData } from '../../data/mockData';
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

// A stable per-browser id so the server can tell one device from another
// without any login. Persisted in localStorage.
function getDeviceId() {
  let id = localStorage.getItem('aust-device-id');
  if (!id) {
    id =
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('aust-device-id', id);
  }
  return id;
}

export default function LibraryPulse() {
  const [libState] = useState(() => {
    try {
      const stored = localStorage.getItem('aust-library-data');
      return stored ? JSON.parse(stored) : libraryData;
    } catch {
      return libraryData;
    }
  });

  // Live occupancy from the backend (real GPS check-ins).
  const [occupancy, setOccupancy] = useState({ occupied: 0, capacity: libState.totalSeats || 120 });
  const [checkedIn, setCheckedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const deviceId = useRef(getDeviceId()).current;

  // Fetch the current live count.
  const loadOccupancy = useCallback(async () => {
    try {
      const res = await fetch('/api/library/occupancy');
      const data = await res.json();
      if (data.success) {
        setOccupancy({ occupied: data.occupied, capacity: data.capacity });
      }
    } catch {
      /* server offline — keep last known value */
    }
  }, []);

  // Send this device's GPS to the server. `silent` skips the busy spinner/status
  // so heartbeat refreshes don't flicker the UI.
  const doCheckIn = useCallback(
    (silent = false) => {
      if (!('geolocation' in navigator)) {
        setStatus('Your browser does not support location.');
        return;
      }
      if (!silent) setBusy(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const res = await fetch('/api/library/checkin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceId, lat: latitude, lng: longitude }),
            });
            const data = await res.json();
            if (data.success) {
              setOccupancy({ occupied: data.occupied, capacity: data.capacity });
              if (data.inside) {
                setCheckedIn(true);
                if (!silent) setStatus(`Checked in — you're at the library ✅ (~${data.distance}m from center)`);
              } else {
                setCheckedIn(false);
                if (!silent) setStatus(`You're ~${data.distance}m away — not inside the library radius.`);
              }
            } else if (!silent) {
              setStatus(data.error || 'Check-in failed.');
            }
          } catch {
            if (!silent) setStatus('Could not reach the server.');
          } finally {
            if (!silent) setBusy(false);
          }
        },
        () => {
          if (!silent) {
            setStatus('Location permission denied. Enable it to check in.');
            setBusy(false);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    },
    [deviceId]
  );

  const doCheckOut = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/library/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (data.success) setOccupancy({ occupied: data.occupied, capacity: data.capacity });
    } catch {
      /* ignore */
    } finally {
      setCheckedIn(false);
      setStatus('Checked out. Thanks!');
      setBusy(false);
    }
  }, [deviceId]);

  // Poll live occupancy on mount and every 30s.
  useEffect(() => {
    loadOccupancy();
    const id = setInterval(loadOccupancy, 30000);
    return () => clearInterval(id);
  }, [loadOccupancy]);

  // While checked in, send a silent heartbeat every 60s so the server keeps
  // counting this device (check-ins expire after 10 min without a heartbeat).
  useEffect(() => {
    if (!checkedIn) return;
    const id = setInterval(() => doCheckIn(true), 60000);
    return () => clearInterval(id);
  }, [checkedIn, doCheckIn]);

  const chartData = {
    labels: libState.peakHours ? libState.peakHours.map(item => item.hour) : [],
    datasets: [
      {
        label: 'Occupancy %',
        data: libState.peakHours ? libState.peakHours.map(item => item.occupancy) : [],
        backgroundColor: 'var(--accent-blue)',
        borderRadius: 4,
        hoverBackgroundColor: 'var(--accent-blue)',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'var(--text-secondary)' } },
      y: { max: 100, ticks: { color: 'var(--text-secondary)', stepSize: 20 } }
    }
  };

  const capacity = occupancy.capacity || 120;
  const occupied = occupancy.occupied || 0;
  const occupancyPercentage = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
  const freeSeats = Math.max(capacity - occupied, 0);
  const densityClass = occupancyPercentage >= 75 ? 'is-rose' : occupancyPercentage >= 40 ? 'is-amber' : occupancyPercentage >= 1 ? 'is-cyan' : 'is-emerald';

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
            <span className="schedule-subtitle">Live crowd level from students checked in via GPS</span>
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
          </div>
        </div>

        <div className="schedule-actions">
          {checkedIn ? (
            <button className="lib-action-btn" onClick={doCheckOut} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Check out
            </button>
          ) : (
            <button className="lib-action-btn primary" onClick={() => doCheckIn(false)} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              I'm at the library
            </button>
          )}
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Status line + occupancy cell ── */}
      <p className="lib-status-text">
        {status || 'Tap the button to share your location and update the live library count.'}
      </p>

      <div className={`sv-cell lib-occ-cell ${densityClass}`}>
        <div className="lib-occ-left">
          <Gauge size={18} className="lib-occ-icon" />
          <div>
            <div className="sv-cell-title">Library {densityClass === 'is-rose' ? 'Near Capacity' : densityClass === 'is-amber' ? 'Getting Busy' : 'Plenty of Space'}</div>
            <div className="sv-cell-sub">
              {occupied}/{capacity} seats occupied · {freeSeats} seats free
            </div>
          </div>
        </div>
        <div className="lib-occ-meter">
          <div className="lib-occ-meter-fill" style={{ width: `${occupancyPercentage}%` }} />
        </div>
      </div>

      {/* ── Hourly Occupancy Chart ── */}
      <div className="lib-chart-card">
        <div className="lib-chart-head">
          <Activity size={15} />
          <span>Hourly Peak Tracker</span>
          <span className="lib-chart-hint">occupancy %</span>
        </div>
        <div className="lib-chart-body">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* ── Zone seats ── */}
      {libState.zones && libState.zones.length > 0 && (
        <>
          <div className="sv-section-label">Reading Zones</div>
          <div className="lib-zones-grid">
            {libState.zones.map(zone => {
              const zOcc = zone.occupied || 0;
              const zCap = zone.seats || 0;
              const zPct = zCap > 0 ? Math.round((zOcc / zCap) * 100) : 0;
              const zClass = zPct >= 75 ? 'is-rose' : zPct >= 40 ? 'is-amber' : zPct >= 1 ? 'is-cyan' : 'is-emerald';
              return (
                <div key={zone.name} className={`sv-cell lib-zone-cell ${zClass}`}>
                  <span className={`sv-count${zPct >= 75 ? ' hot' : ''}`}>{zPct}%</span>
                  <div className="lib-zone-emoji">
                    {zPct >= 75 ? <Users size={18} /> : <Armchair size={18} />}
                  </div>
                  <div className="sv-cell-title">{zone.name}</div>
                  <div className="sv-cell-sub">
                    {zOcc}/{zCap} seats · {zone.noise}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
