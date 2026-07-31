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
import { Activity, MapPin, LogOut, Loader2 } from 'lucide-react';
import { libraryData } from '../../data/mockData';
import { apiFetch } from '../../utils/api';

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
      const res = await apiFetch('/api/library/occupancy');
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
            const res = await apiFetch('/api/library/checkin', {
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
      const res = await apiFetch('/api/library/checkout', {
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
        backgroundColor: '#6391ff',
        borderRadius: 4,
        hoverBackgroundColor: '#22d3ee',
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

  return (
    <div className="glass-card-static library-pulse-container animate-fadeInUp">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="icon" style={{ backgroundColor: 'rgba(99, 145, 255, 0.12)', color: 'var(--accent-blue)', padding: '6px', borderRadius: '8px' }}>
            <Activity size={18} />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Library Occupancy Pulse</h2>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Live crowd level from students checked in via GPS</p>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Live Occupancy:</span>
          <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)', color: 'var(--accent-blue)' }}>
            {occupancyPercentage}%
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>({occupied}/{capacity} seats)</span>
        </div>
      </div>

      {/* Check-in control */}
      <div
        className="flex justify-between items-center mb-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px', borderRadius: 'var(--radius-lg)', flexWrap: 'wrap', gap: '8px' }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {status || 'Tap to share your location and update the live library count.'}
        </div>
        {checkedIn ? (
          <button className="btn btn-secondary" onClick={doCheckOut} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Check out
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => doCheckIn(false)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            I'm at the library
          </button>
        )}
      </div>

      {/* Hourly Occupancy Chart */}
      <div className="glass-card-static" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', marginBottom: '12px' }}>Hourly Peak Tracker</h3>
        <div style={{ flex: 1, position: 'relative' }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
