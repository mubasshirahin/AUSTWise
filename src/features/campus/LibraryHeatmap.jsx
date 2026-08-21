import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// AUST Library center (from the user's plus code QC74+CX Dhaka).
export const LIBRARY_LAT = 23.7635625;
export const LIBRARY_LNG = 90.4074375;

// Default marker icon images break under bundlers — build our own.
const libraryIcon = L.divIcon({
  className: 'lib-heat-marker',
  html: '<div class="lib-heat-marker-pin"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

/**
 * Multivariate heatmap — multiple overlapping heat layers, each with its own
 * color scale, radius and transparency, blend to build depth:
 *   1. "glow"  : broad emerald under-glow (macro density)
 *   2. "warm"  : yellow → electric-orange mid layer
 *   3. "hot"   : tight fiery-red micro hot spots / micro-clusters
 * The combination reads as interwoven digital filaments, with small localized
 * hot spots clearly defined on top of the broad density field.
 */
const HEAT_LAYERS = [
  {
    name: 'glow',
    radius: 95,
    blur: 28,
    weight: 0.7,
    gradient: {
      0: 'rgba(16, 185, 129, 0)',
      0.5: 'rgba(16, 185, 129, 0.10)',
      1: 'rgba(52, 211, 153, 0.30)', // intense emerald under-glow
    },
  },
  {
    name: 'warm',
    radius: 55,
    blur: 42,
    weight: 1,
    gradient: {
      0: 'rgba(34, 211, 238, 0)',
      0.45: 'rgba(250, 204, 21, 0.08)', // bright yellow veil
      0.75: 'rgba(251, 146, 60, 0.35)', // electric orange
      1: 'rgba(251, 146, 60, 0.55)',
    },
  },
  {
    name: 'hot',
    radius: 32,
    blur: 26,
    weight: 1.1,
    gradient: {
      0.15: 'rgba(250, 204, 21, 0)',
      0.55: 'rgba(251, 146, 60, 0.45)',
      0.8: 'rgba(244, 63, 94, 0.7)',
      1: 'rgba(244, 63, 94, 0.95)', // fiery red cores
    },
  },
];

const HEAT_OPTIONS = {
  maxZoom: 18,
  minOpacity: 0,
};

// ── Occupancy severity drives overall intensity ──
const SEVERITY_LEVELS = [
  { max: 0,        label: 'Empty',     color: 'var(--text-tertiary)', weight: 0 },
  { max: 30,       label: 'Low',       color: 'var(--accent-emerald)', weight: 0.55 },
  { max: 50,       label: 'Medium',    color: 'var(--accent-amber)',   weight: 0.9 },
  { max: 80,       label: 'High',      color: 'var(--accent-orange)',  weight: 1.25 },
  { max: 110,      label: 'Extreme',   color: 'var(--accent-rose)',    weight: 1.6 },
  { max: Infinity, label: 'Housefull', color: '#ef4444',               weight: 2 },
];

function getSeverity(count) {
  return SEVERITY_LEVELS.find((s) => count <= s.max) || SEVERITY_LEVELS[SEVERITY_LEVELS.length - 1];
}

const LEGEND_GRADIENT =
  'linear-gradient(90deg, rgba(16,185,129,0) 0%, #34d399 18%, #a7f3d0 30%, #facc15 46%, #fb923c 66%, #f43f5e 86%, #ef4444 100%)';

export default function LibraryHeatmap({ points = [], occupied = 0, capacity = 120, self = null, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const selfRef = useRef(null);
  const countRef = useRef(null);

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [LIBRARY_LAT, LIBRARY_LNG],
      zoom: 15,
      minZoom: 13,
      scrollWheelZoom: true,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.marker([LIBRARY_LAT, LIBRARY_LNG], { icon: libraryIcon })
      .addTo(map)
      .bindPopup('<b>Central Library</b><br>AUST, Tejgaon');

    // Keep Leaflet in sync with container size changes (drawer toggles,
    // orientation change) or tiles render gray/offset.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    const onOrientationChange = () => setTimeout(() => map.invalidateSize(), 150);
    window.addEventListener('orientationchange', onOrientationChange);

    // Geofence ring (60m radius).
    L.circle([LIBRARY_LAT, LIBRARY_LNG], {
      radius: 60,
      color: 'var(--accent-blue)',
      weight: 1,
      fillColor: 'var(--accent-blue)',
      fillOpacity: 0.04,
      dashArray: '4 4',
    }).addTo(map);

    // Layered heat: glow → warm → hot (added in order, hotter on top).
    layersRef.current = HEAT_LAYERS.map((spec) =>
      L.heatLayer([], {
        radius: spec.radius,
        blur: spec.blur,
        maxZoom: HEAT_OPTIONS.maxZoom,
        minOpacity: HEAT_OPTIONS.minOpacity,
        gradient: spec.gradient,
      }).addTo(map)
    );

    // Special "you are here" marker (updated live, always visible).
    selfRef.current = L.circleMarker([LIBRARY_LAT, LIBRARY_LNG], {
      radius: 10,
      weight: 3,
      color: '#ffffff',
      fillColor: 'var(--accent-rose)',
      fillOpacity: 1,
    })
      .bindTooltip('<b>You are here</b>', { direction: 'top', offset: [0, -8] })
      .addTo(map);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', onOrientationChange);
      map.remove();
      mapRef.current = null;
      layersRef.current = [];
      selfRef.current = null;
    };
  }, []);

  // Keep the "You are here" marker synced + fit view if you are outside.
  useEffect(() => {
    const map = mapRef.current;
    const selfMarker = selfRef.current;
    if (!map || !selfMarker) return;

    if (self && Number.isFinite(Number(self.lat)) && Number.isFinite(Number(self.lng))) {
      selfMarker.setLatLng([Number(self.lat), Number(self.lng)]).setStyle({ opacity: 1 }).setTooltipContent('<b>You are here</b>');
      const latM = (Number(self.lat) - LIBRARY_LAT) * 111320;
      const lngM =
        (Number(self.lng) - LIBRARY_LNG) *
        (111320 * Math.cos((LIBRARY_LAT * Math.PI) / 180));
      if (Math.hypot(latM, lngM) > 120) {
        map.fitBounds(L.latLngBounds(
          [[LIBRARY_LAT, LIBRARY_LNG], [Number(self.lat), Number(self.lng)]],
          { padding: [40, 40] }
        ), { animate: true });
      } else {
        selfMarker.setTooltipContent('<b>You are inside the library 👀</b>');
      }
    }
  }, [self]);

  // Refresh every layered heat band whenever occupancy data changes.
  useEffect(() => {
    if (!mapRef.current || layersRef.current.length === 0) return;

    const count = Math.max(0, Math.min(Number(occupied) || 0, Number(capacity) || 120));

    // Resolve the list of coordinates to display.
    let pts;
    if (Array.isArray(points) && points.length > 0) {
      pts = points
        .filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p) => [Number(p.lat), Number(p.lng)]);
    } else if (count > 0) {
      // Backend hasn't reported per-user coords yet — scatter `count` pts.
      pts = [];
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 * Math.sqrt(Math.random());
        const lat = LIBRARY_LAT + (dist * Math.cos(angle)) / 111320;
        const lng = LIBRARY_LNG + (dist * Math.sin(angle)) / (111320 * Math.cos((LIBRARY_LAT * Math.PI) / 180));
        pts.push([lat, lng]);
      }
    } else {
      pts = [];
    }

    // Severity scales ALL bands, so low counts stay cool and the map heats up
    // toward fiery red as the library fills.
    const sev = getSeverity(count);
    const scalar = sev.weight || 1;

    layersRef.current.forEach((layer, idx) => {
      const spec = HEAT_LAYERS[idx];
      layer.setLatLngs(pts.map(([lat, lng]) => [lat, lng, spec.weight * scalar]));
    });

    const badge = countRef.current;
    if (badge) {
      badge.textContent = `${count} · ${sev.label}`;
      badge.style.color = sev.color;
    }
  }, [points, occupied, capacity]);

  return (
    <div className={`lib-heatmap-wrap ${className}`}>
      <div className="lib-heatmap-head">
        <span>Live Heatmap</span>
        <span className="lib-heatmap-count" ref={countRef}>— in library</span>
      </div>
      <div className="lib-heatmap-map" ref={containerRef} />

      {/* ── Comprehensive gradient legend ── */}
      <div className="lib-heatmap-legend">
        <div className="lib-heatmap-legend-bar" style={{ background: LEGEND_GRADIENT }} />
        <div className="lib-heatmap-legend-row">
          <span>0 · Empty</span>
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
          <span>Extreme</span>
          <span>110+ · Housefull</span>
        </div>
        <p className="lib-heatmap-legend-note">
          Density scale — cool emerald (few) → fiery red (crowded). Denser clusters glow hotter.
        </p>
      </div>
    </div>
  );
}
