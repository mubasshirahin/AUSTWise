import {
  lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  X, ChevronDown, Flag, Route, Clapperboard, Gamepad2, Eye, Headphones, Swords,
  Play, Pause, RotateCcw, Check, TrainFront, Gauge, ScanEye, Map as MapIcon,
  Building2, Flame, Trees, Orbit,
} from 'lucide-react';
import { useStalk } from './StalkContext';
import { useAuth } from '../../context/AuthContext';
import { loadUserFavoriteColor } from '../orbits/OrbitsContext';
import { MoviesSection, GamingSection, AnimeSection, MusicSection, ThisOrThatSection } from './StalkPortfolio';
import OrbitsCheckpointPreview from '../orbits/OrbitsPreview';
import {
  buildTrack, makeProgressMap, mulberry, WORLD_H, GROUND, BASE, CAR_GAP, CAR_COUNT,
} from './coasterTrack';
import {
  SkyLife, FarBackdrop, ParkBackdrop, WorldBack, WorldFront, ForegroundLayer,
} from './ParkScenery';
import './StalkPortfolio.css';
import './StalkRoad.css';

// three.js only loads once the rider switches to the first-person view
const CoasterFPP = lazy(() => import('./CoasterFPP'));

// first-person backgrounds (built in CoasterFPP; sky = the colour behind the canvas)
const FPP_BGS = [
  { id: 'city', label: 'Night city', note: 'Skyline, 110 floors up', Icon: Building2, sky: '#070b14', ink: '#ffd27a' },
  { id: 'fire', label: 'Fire', note: 'Lava fields and volcanoes', Icon: Flame, sky: '#1c0a07', ink: '#ff7a2a' },
  { id: 'forest', label: 'Forest', note: 'Pine valley in the morning', Icon: Trees, sky: '#a9cfe0', ink: '#2f6a3a' },
  { id: 'space', label: 'Space', note: 'Orbital station above a planet', Icon: Orbit, sky: '#02030a', ink: '#a99cff' },
];
const readBg = () => {
  try {
    const v = localStorage.getItem('stalk-fpp-bg');
    return FPP_BGS.some((b) => b.id === v) ? v : 'city';
  } catch { return 'city'; }
};

/* ─── Orbit Express ───
   "Visit Orbit" as a night-time roller-coaster ride. Scroll (or Auto ride)
   moves a four-car train along a procedural coaster — lift hill, drops,
   loops, corkscrew, camelbacks — while the camera pans and an amusement-park
   skyline parallaxes behind. Every checkpoint is a lit gate the train brakes
   at, and its details slide in as a side panel (desktop) or bottom sheet
   (phone / portrait tablet). */

const DEFAULT_STOPS = [
  { key: 'movies', label: 'MOVIES', Icon: Clapperboard },
  { key: 'gaming', label: 'GAMING', Icon: Gamepad2 },
  { key: 'anime', label: 'ANIME', Icon: Eye },
  { key: 'music', label: 'MUSIC', Icon: Headphones },
  { key: 'vs', label: 'THIS OR THAT', Icon: Swords },
];

const CP_ZONE = 0.05; // half-width of a checkpoint's active window (scroll progress)
const ARRIVE_AT = 0.965; // ride-complete panel appears only at the very end
const PARK_FACTOR = 0.32; // parallax speed of the amusement-park skyline
const FAR_FACTOR = 0.12; // mountains + city
const FG_FACTOR = 1.25; // near fence / grass / fireflies
const FW_COLORS = ['var(--stalk-accent)', '#ffd166', '#ff7aa8', '#7cd4ff', '#ffffff'];

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function hasWebGL() {
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch { return false; }
}

function shortLabel(label) {
  const t = String(label || '').trim();
  return t.length > 16 ? `${t.slice(0, 15)}…` : t;
}

/* ── One coaster car, drawn in its local frame (track centre at y = 0) ── */
function CoasterCar({ front, innerRef }) {
  return (
    <g ref={innerRef} className="sr-car-g">
      <g className="sr-car-body">
        <rect x="-19" y="-9" width="38" height="5" rx="1.5" className="sr-car-bogie" />
        <circle cx="-13" cy="-3.6" r="3.8" className="sr-car-wheel" />
        <circle cx="13" cy="-3.6" r="3.8" className="sr-car-wheel" />
        <circle cx="-13" cy="6.4" r="2.2" className="sr-car-wheel sr-car-upstop" />
        <circle cx="13" cy="6.4" r="2.2" className="sr-car-wheel sr-car-upstop" />
        <rect x="-15" y="-36" width="4" height="12" rx="2" className="sr-car-headrest" />
        <rect x="1" y="-36" width="4" height="12" rx="2" className="sr-car-headrest" />
        {/* riders */}
        <g className="sr-riders">
          <line x1="-8" y1="-26" x2="-13" y2="-39" className="sr-arm" />
          <line x1="-6" y1="-26" x2="-1" y2="-39" className="sr-arm" />
          <line x1="8" y1="-26" x2="3" y2="-39" className="sr-arm" />
          <line x1="10" y1="-26" x2="15" y2="-39" className="sr-arm" />
          <circle cx="-7" cy="-28.5" r="4.4" className="sr-rider" />
          <circle cx="9" cy="-28.5" r="4.4" className="sr-rider sr-rider-b" />
        </g>
        <path
          d={front
            ? 'M-22 -8 L-22 -22 Q-22 -25 -19 -25 L4 -25 Q8 -25 11 -22 L24 -12 Q26 -10 25 -8 Z'
            : 'M-22 -8 L-22 -22 Q-22 -25 -19 -25 L19 -25 Q22 -25 22 -22 L22 -8 Z'}
          className="sr-car-shell"
        />
        <rect x="-18" y="-21" width={front ? 20 : 36} height="5" rx="2" className="sr-car-seat" />
        <path d="M-2 -20 l5 -4 M14 -20 l5 -4" className="sr-car-lapbar" />
        {front && <circle cx="21.5" cy="-11.5" r="2" className="sr-car-lamp" />}
      </g>
    </g>
  );
}

export default function StalkRoadScene() {
  const { target, portfolio, customStops, favoriteColor: tripFavoriteColor, close } = useStalk();
  const { user } = useAuth();
  const scrollerRef = useRef(null);
  const stageRef = useRef(null);
  const bandRef = useRef(null);
  const parkRef = useRef(null);
  const farRef = useRef(null);
  const fgRef = useRef(null);
  const groundRef = useRef(null);
  const carRefs = useRef([]);
  const trainRef = useRef(null);
  const speedLinesRef = useRef(null);
  const gateRefs = useRef([]);
  const miniDotRef = useRef(null);
  const miniFillRef = useRef(null);
  const speedRef = useRef(null);
  const stopLabelRef = useRef(null);
  const autoRef = useRef({ on: false, pauseUntil: 0, dwelled: new Set() });
  const [autoOn, setAutoOn] = useState(false);
  const fppApiRef = useRef(null);
  const [canFpp] = useState(hasWebGL);
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem('stalk-view') === 'fpp' ? 'fpp' : 'side'; } catch { return 'side'; }
  });
  const fpp = canFpp && view === 'fpp';
  const viewRef = useRef(fpp);
  useEffect(() => {
    viewRef.current = fpp;
    try { sessionStorage.setItem('stalk-view', fpp ? 'fpp' : 'side'); } catch { /* ignore */ }
  }, [fpp]);
  const [bgOpenRaw, setBgOpen] = useState(false);
  const toggleView = useCallback(() => {
    setBgOpen(false);
    setView((v) => (v === 'fpp' ? 'side' : 'fpp'));
  }, []);
  const [bg, setBg] = useState(readBg);
  const bgOpen = fpp && bgOpenRaw;
  const bgRef = useRef(null);
  const bgInfo = FPP_BGS.find((b) => b.id === bg) || FPP_BGS[0];
  useEffect(() => {
    try { localStorage.setItem('stalk-fpp-bg', bg); } catch { /* ignore */ }
  }, [bg]);
  const cycleBg = useCallback(() => {
    if (!viewRef.current) return;
    setBg((cur) => FPP_BGS[(FPP_BGS.findIndex((b) => b.id === cur) + 1) % FPP_BGS.length].id);
  }, []);
  useEffect(() => {
    if (!bgOpen) return undefined;
    const onDown = (e) => { if (!bgRef.current?.contains(e.target)) setBgOpen(false); };
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setBgOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onEsc, true);
    };
  }, [bgOpen]);

  const stops = useMemo(() => (
    customStops && customStops.length
      ? customStops.map((s) => ({ key: s.key, label: s.label, fields: s.fields }))
      : DEFAULT_STOPS
  ), [customStops]);
  const STOP_COUNT = stops.length;
  const fppLabels = useMemo(() => stops.map((s) => s.label), [stops]);
  const SEGMENTS = STOP_COUNT + 2; // scroll runway in viewport heights
  const isOrbitDrive = Boolean(customStops && customStops.length);

  const track = useMemo(() => buildTrack(STOP_COUNT), [STOP_COUNT]);
  const parkWidth = Math.ceil(track.width * PARK_FACTOR + 2600);
  const farWidth = Math.ceil(track.width * FAR_FACTOR + 2600);
  const fgWidth = Math.ceil(track.width * FG_FACTOR + 2600);
  // keep stalls clear of stations, gate posts and loops; crowds gather at stops
  const avoid = useMemo(() => [
    [0, 380],
    [track.stations.end.x - 280, track.stations.end.x + 90],
    ...track.gates.map((g) => [g.x - 110, g.x + 110]),
    ...track.loopSpans,
  ], [track]);
  const crowdAt = useMemo(() => [
    170,
    ...track.gates.map((g) => g.x),
    track.stations.end.x - 100,
  ], [track]);

  // The accent rides the user's chosen favorite color for self-visits and
  // orbit drives; everyone else keeps their deterministic portfolio color.
  const isSelf = Boolean(user && (target?.id === user.id || target?.id === user.awid || target?.awid === user.id));
  const savedFav = isSelf ? (() => { try { return loadUserFavoriteColor(user?.id); } catch { return ''; } })() : '';
  const accent = isOrbitDrive
    ? (tripFavoriteColor || savedFav || '#00ffcc')
    : (savedFav || portfolio?.favoriteColor || '#00ffcc');

  const stars = useMemo(() => {
    const r = mulberry(2026);
    return Array.from({ length: 70 }, (_, i) => ({
      i,
      left: r() * 100,
      top: r() * 58,
      size: r() * 1.8 + 0.8,
      d: r() * 2.6 + 1.6,
      dl: -r() * 4,
    }));
  }, []);

  const fireworks = useMemo(() => {
    const r = mulberry(77);
    return Array.from({ length: 6 }, (_, b) => ({
      b,
      left: 12 + r() * 76,
      top: 10 + r() * 30,
      delay: b * 0.42 + r() * 0.3,
      color: FW_COLORS[b % FW_COLORS.length],
      size: 60 + r() * 50,
    }));
  }, []);

  const miniPath = useMemo(() => track.mini.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(0)} ${y.toFixed(0)}`).join(''), [track]);

  const defaultPanels = [
    <MoviesSection movies={portfolio?.movies} accent={accent} key="p-movies" />,
    <GamingSection games={portfolio?.games} accent={accent} key="p-gaming" />,
    <AnimeSection anime={portfolio?.anime} accent={accent} key="p-anime" />,
    <MusicSection portfolio={portfolio} accent={accent} key="p-music" />,
    <ThisOrThatSection matchups={portfolio?.matchups} accent={accent} key="p-vs" />,
  ];

  const stopAuto = useCallback(() => {
    if (!autoRef.current.on) return;
    autoRef.current.on = false;
    setAutoOn(false);
  }, []);

  const toggleAuto = useCallback(() => {
    const a = autoRef.current;
    const sc = scrollerRef.current;
    if (a.on) { stopAuto(); return; }
    if (sc) {
      const max = sc.scrollHeight - sc.clientHeight;
      if (max > 0 && sc.scrollTop >= max - 2) sc.scrollTop = 0; // finished → ride again
    }
    a.on = true;
    a.pauseUntil = 0;
    a.dwelled = new Set();
    setAutoOn(true);
  }, [stopAuto]);

  const rideAgain = useCallback(() => {
    const sc = scrollerRef.current;
    if (sc) sc.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    if (!target || !portfolio) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    const band = bandRef.current;
    const park = parkRef.current;
    const far = farRef.current;
    const fg = fgRef.current;
    const groundEl = groundRef.current;
    const toLen = makeProgressMap(track);
    const calm = reducedMotion();

    // ── layout: uniform world scale, dock (side panel) vs sheet (bottom) ──
    const lay = {
      W: 0, H: 0, s: 1, top: 0, trainX: 0, mode: 'dock', v: 0, offX: 0, offY: 0,
    };
    const layout = () => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const sheet = W < 720 || H > W * 1.08;
      const short = H < 520;
      let top;
      let worldH;
      let trainX;
      let offX = 0;
      let offY = 0;
      if (sheet) {
        top = 96;
        worldH = Math.max(260, H * 0.56);
        trainX = W * 0.42;
        offY = Math.round(H * 0.16); // horizon above the bottom sheet
      } else {
        top = short ? 50 : 66;
        worldH = H - top - (short ? 46 : 62);
        const panelW = Math.min(440, W * 0.4) + 32;
        trainX = (W - panelW) * 0.44;
        offX = Math.round(panelW * 0.42); // look past the docked panel
      }
      const s = worldH / WORLD_H;
      Object.assign(lay, {
        W, H, s, top, trainX, offX, offY, mode: sheet ? 'sheet' : 'dock', v: lay.v + 1,
      });
      stage.dataset.mode = lay.mode;
      band.style.top = `${top}px`;
      band.style.width = `${track.width * s}px`;
      band.style.height = `${WORLD_H * s}px`;
      park.style.top = `${top}px`;
      park.style.width = `${parkWidth * s}px`;
      park.style.height = `${WORLD_H * s}px`;
      [[far, farWidth], [fg, fgWidth]].forEach(([el, w]) => {
        el.style.top = `${top}px`;
        el.style.width = `${w * s}px`;
        el.style.height = `${WORLD_H * s}px`;
      });
      groundEl.style.top = `${top + GROUND * s}px`;
    };
    layout();

    // ── scroll → target progress ──
    let targetP = 0;
    const readScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      targetP = max > 0 ? scroller.scrollTop / max : 0;
    };

    let curP = -1;
    let lastL = null;
    let speed = 0;
    let lastIdx = -99;
    let lastKmh = -1;
    let lastT = performance.now();
    let raf = 0;
    const gateState = [];
    const gateCentres = stops.map((_, i) => (i + 1) / (SEGMENTS - 1));

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;

      // auto ride: glide the scroller, brake at each gate for a read
      const a = autoRef.current;
      if (a.on && now > a.pauseUntil) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        const rate = max / ((STOP_COUNT + 1) * 4.6);
        const p = max > 0 ? scroller.scrollTop / max : 1;
        const gi = gateCentres.findIndex((c, i) => p >= c && !a.dwelled.has(i));
        if (gi >= 0) {
          a.dwelled.add(gi);
          a.pauseUntil = now + 3400;
        } else if (p >= 0.999) {
          a.on = false;
          setAutoOn(false);
        } else {
          scroller.scrollTop = Math.min(max, scroller.scrollTop + rate * dt);
        }
      }

      readScroll();
      if (curP < 0 || calm) curP = targetP;
      else curP += (targetP - curP) * (1 - Math.exp(-dt * 6.5));
      if (Math.abs(targetP - curP) < 0.00002) curP = targetP;

      const L = toLen(curP);
      const inst = lastL === null ? 0 : Math.abs(L - lastL) / dt;
      lastL = L;
      speed += (inst - speed) * Math.min(1, dt * 5);

      // first-person view: the 3D scene renders instead of the side view
      const api = viewRef.current ? fppApiRef.current : null;
      if (api) {
        if (api.lay !== lay.v) {
          api.lay = lay.v;
          api.resize(lay.W, lay.H, lay.offX, lay.offY);
        }
        api.render(L, speed, dt);
      }

      // train
      if (!api) for (let k = 0; k < CAR_COUNT; k += 1) {
        const el = carRefs.current[k];
        if (!el) continue;
        const Lk = L - k * CAR_GAP;
        const [x, y] = track.pointAt(Lk);
        const ang = (track.angleAt(Lk) * 180) / Math.PI;
        const roll = track.rollAt(Lk);
        el.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(2)}) scale(1 ${roll.toFixed(3)})`);
        if (k === CAR_COUNT - 1 && speedLinesRef.current) {
          speedLinesRef.current.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(2)}) scale(1 ${roll.toFixed(3)})`);
        }
      }
      const fast = speed > 340;
      if (trainRef.current) trainRef.current.classList.toggle('sr-arms-up', fast);
      if (speedLinesRef.current) speedLinesRef.current.style.opacity = String(Math.max(0, Math.min(0.9, (speed - 260) / 520)));

      // camera
      if (!api) {
        const [lx] = track.pointAt(L);
        const minX = Math.min(0, lay.W - track.width * lay.s);
        const bandX = Math.max(minX, Math.min(0, lay.trainX - lx * lay.s));
        band.style.transform = `translate3d(${bandX.toFixed(1)}px,0,0)`;
        park.style.transform = `translate3d(${(bandX * PARK_FACTOR).toFixed(1)}px,0,0)`;
        far.style.transform = `translate3d(${(bandX * FAR_FACTOR).toFixed(1)}px,0,0)`;
        fg.style.transform = `translate3d(${(bandX * FG_FACTOR).toFixed(1)}px,0,0)`;
      }

      // HUD
      const frac = L / track.total;
      if (miniFillRef.current) miniFillRef.current.style.strokeDashoffset = String(1 - frac);
      if (miniDotRef.current) {
        const [mx, my] = track.pointAt(L);
        miniDotRef.current.style.left = `${(mx / track.width) * 100}%`;
        miniDotRef.current.style.top = `${(my / WORLD_H) * 100}%`;
      }
      const kmh = Math.round(speed * 0.16);
      if (kmh !== lastKmh && speedRef.current) {
        lastKmh = kmh;
        speedRef.current.textContent = String(kmh);
      }
      stage.classList.toggle('sr-scrolled', curP > 0.015);

      // gates
      gateRefs.current.forEach((g, i) => {
        if (!g) return;
        const gl = track.gates[i].len;
        const st = L > gl + 200 ? 'passed' : (L > gl - 220 ? 'near' : 'ahead');
        if (gateState[i] !== st) {
          gateState[i] = st;
          g.dataset.state = st;
        }
      });

      // checkpoint panels
      let idx = -1;
      for (let i = 0; i < STOP_COUNT; i += 1) {
        if (curP >= gateCentres[i] - CP_ZONE && curP < gateCentres[i] + CP_ZONE) idx = i;
      }
      if (curP >= ARRIVE_AT) idx = STOP_COUNT;
      if (idx !== lastIdx) {
        lastIdx = idx;
        stage.querySelectorAll('.sr-cp').forEach((pn, i) => {
          pn.classList.toggle('active', i === idx);
          pn.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        });
        gateRefs.current.forEach((g, i) => g && g.classList.toggle('is-active', i === idx));
        stage.classList.toggle('sr-done', idx === STOP_COUNT);
        stage.classList.toggle('sr-at-stop', idx >= 0 && idx < STOP_COUNT);
        if (stopLabelRef.current) {
          stopLabelRef.current.textContent = idx >= 0 && idx < STOP_COUNT
            ? `Stop ${idx + 1}/${STOP_COUNT} · ${stops[idx].label}`
            : (idx === STOP_COUNT ? 'Arrived' : `${STOP_COUNT} stops`);
        }
      }
    };

    // ── resume where the ride left off after a refresh ──
    try {
      const saved = parseFloat(sessionStorage.getItem('stalk-scroll') || '');
      if (!Number.isNaN(saved) && saved > 0) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = saved * max;
      } else {
        scroller.scrollTop = 0;
      }
    } catch { /* ignore */ }
    raf = requestAnimationFrame(frame);

    let saveRaf = 0;
    const onScroll = () => {
      if (saveRaf) return;
      saveRaf = requestAnimationFrame(() => {
        saveRaf = 0;
        const max = scroller.scrollHeight - scroller.clientHeight;
        if (max > 0) {
          try { sessionStorage.setItem('stalk-scroll', String(scroller.scrollTop / max)); } catch { /* ignore */ }
        }
      });
    };
    const onUserInput = () => stopAuto();
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey && !e.altKey
        && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) toggleView();
      else if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey && !e.altKey
        && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) cycleBg();
      else if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) stopAuto();
    };
    const onResize = () => layout();

    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('wheel', onUserInput, { passive: true });
    scroller.addEventListener('touchstart', onUserInput, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(stage);

    return () => {
      cancelAnimationFrame(raf);
      if (saveRaf) cancelAnimationFrame(saveRaf);
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('wheel', onUserInput);
      scroller.removeEventListener('touchstart', onUserInput);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      document.body.style.overflow = prevOverflow;
    };
  }, [target, portfolio, track, parkWidth, farWidth, fgWidth, stops, STOP_COUNT, SEGMENTS, close, stopAuto, toggleView, cycleBg]);

  if (!target || !portfolio) return null;

  const { start: st0, end: st1 } = track.stations;

  return (
    <div className="sr-overlay" ref={scrollerRef} data-role="stalk-road">
      <div className="sr-track" style={{ '--sr-segments': SEGMENTS }}>
        <div className="sr-stage" ref={stageRef} data-mode="dock" data-view={fpp ? 'fpp' : 'side'} style={{ '--stalk-accent': accent }}>
          {/* night sky */}
          <div className="sr-sky" aria-hidden="true">
            <span className="sr-moon"><i /><i /><i /><i /></span>
            {stars.map((s) => (
              <span
                key={s.i}
                className="sr-star"
                style={{
                  left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
                  '--d': `${s.d}s`, animationDelay: `${s.dl}s`,
                }}
              />
            ))}
          </div>

          <div className="sr-skylife" aria-hidden="true"><SkyLife /></div>

          {/* mountains + city (slowest parallax) */}
          <div className="sr-far" ref={farRef} aria-hidden="true">
            <FarBackdrop width={farWidth} />
          </div>

          {/* amusement-park skyline (parallax) */}
          <div className="sr-park" ref={parkRef} aria-hidden="true">
            <ParkBackdrop width={parkWidth} />
          </div>
          <div className="sr-ground" ref={groundRef} aria-hidden="true" />

          {/* the coaster world — the camera pans across this strip */}
          <div className="sr-band" ref={bandRef}>
            <svg className="sr-world" viewBox={`0 0 ${track.width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
              <WorldBack width={track.width} avoid={avoid} />

              {/* supports + lattice */}
              <path d={track.braces} className="sr-brace" />
              <path d={track.supports} className="sr-support" />
              <path d={track.footings} className="sr-footing" />

              <WorldFront width={track.width} crowdAt={crowdAt} />

              {/* gate posts (behind the train) */}
              {track.gates.map((g, i) => (
                <g key={`gp${i}`} className="sr-gate-posts">
                  <rect x={g.x - 80} y={g.y - 122} width="6" height={GROUND - g.y + 122} rx="2" />
                  <rect x={g.x + 74} y={g.y - 122} width="6" height={GROUND - g.y + 122} rx="2" />
                </g>
              ))}

              {/* stations */}
              {[st0, st1].map((stn, i) => {
                const x0 = i === 0 ? stn.x + 20 : stn.x - 230;
                const w = 280;
                return (
                  <g key={`s${i}`} className="sr-station">
                    <rect x={x0} y={BASE + 12} width={w} height="12" rx="2" className="sr-station-deck" />
                    <rect x={x0 + 10} y={BASE - 78} width="6" height="90" className="sr-station-post" />
                    <rect x={x0 + w - 16} y={BASE - 78} width="6" height="90" className="sr-station-post" />
                    <path d={`M${x0 - 14} ${BASE - 78}L${x0 + w / 2} ${BASE - 108}L${x0 + w + 14} ${BASE - 78}Z`} className="sr-station-roof" />
                    <rect x={x0 + w / 2 - 70} y={BASE - 74} width="140" height="22" rx="4" className="sr-station-sign" />
                    <text x={x0 + w / 2} y={BASE - 59} className="sr-station-text">{i === 0 ? 'ORBIT EXPRESS' : 'ARRIVAL'}</text>
                    {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f, k) => (
                      <circle key={f} cx={x0 - 14 + (w + 28) * f} cy={BASE - 80 - 30 * (1 - Math.abs(f - 0.5) * 2)} r="2.4" className={`sr-bulb ${k % 2 ? 'sr-bulb-b' : ''}`} />
                    ))}
                  </g>
                );
              })}

              {/* the track: spine, ties, rails, lift chain */}
              <polyline points={track.rails.spine} className="sr-spine" />
              <path d={track.rails.ties} className="sr-ties" />
              <polyline points={track.rails.right} className="sr-rail sr-rail-back" />
              <polyline points={track.rails.left} className="sr-rail" />
              <polyline points={track.chain} className="sr-chain" />
              <path d={track.catwalk.posts} className="sr-catwalk" />
              <polyline points={track.catwalk.rail} className="sr-catwalk" />
              <g className="sr-buffer">
                <rect x={track.trackEnd - 6} y={BASE - 16} width="10" height="30" rx="2" />
                <rect x={track.trackEnd - 4} y={BASE + 14} width="6" height={GROUND - BASE - 14} />
                <circle cx={track.trackEnd - 1} cy={BASE - 22} r="3" className="sr-bulb sr-bulb-warn" />
              </g>

              {/* speed lines trail behind the last car */}
              <g ref={speedLinesRef} className="sr-speedlines" style={{ opacity: 0 }}>
                <line x1="-34" y1="-12" x2="-96" y2="-12" />
                <line x1="-30" y1="-20" x2="-74" y2="-20" />
                <line x1="-38" y1="-28" x2="-118" y2="-28" />
              </g>

              {/* the train */}
              <g ref={trainRef} className="sr-train">
                {Array.from({ length: CAR_COUNT }, (_, k) => (
                  <CoasterCar key={k} front={k === 0} innerRef={(el) => { carRefs.current[k] = el; }} />
                )).reverse()}
              </g>

              {/* gate banners (overhead) */}
              {track.gates.map((g, i) => {
                const stop = stops[i];
                const label = shortLabel(stop?.label);
                const bw = 160;
                const Icon = stop?.Icon;
                const by = g.y - 150;
                return (
                  <g
                    key={`gb${i}`}
                    className="sr-gate"
                    data-state="ahead"
                    ref={(el) => { gateRefs.current[i] = el; }}
                  >
                    <rect x={g.x - bw / 2} y={by} width={bw} height="40" rx="7" className="sr-gate-board" />
                    {Array.from({ length: 12 }, (_, k) => (
                      <circle key={`t${k}`} cx={g.x - bw / 2 + 10 + k * ((bw - 20) / 11)} cy={by - 0.5} r="2.3" className="sr-gate-bulb" style={{ '--i': k }} />
                    ))}
                    {Array.from({ length: 12 }, (_, k) => (
                      <circle key={`b${k}`} cx={g.x + bw / 2 - 10 - k * ((bw - 20) / 11)} cy={by + 40.5} r="2.3" className="sr-gate-bulb" style={{ '--i': k + 12 }} />
                    ))}
                    <g className="sr-gate-icon">
                      <rect x={g.x - bw / 2 + 9} y={by + 8} width="24" height="24" rx="6" />
                      {Icon
                        ? <Icon x={g.x - bw / 2 + 13} y={by + 12} size={16} strokeWidth={2.2} />
                        : <text x={g.x - bw / 2 + 21} y={by + 25} className="sr-gate-init">{label.charAt(0)}</text>}
                    </g>
                    <text x={g.x - bw / 2 + 41} y={by + 17} className="sr-gate-num">STOP {i + 1}</text>
                    <text x={g.x - bw / 2 + 41} y={by + 31} className="sr-gate-label">{label}</text>
                    <g className="sr-gate-check">
                      <circle cx={g.x + bw / 2 - 2} cy={by + 2} r="10" />
                      <Check x={g.x + bw / 2 - 9} y={by - 5} size={14} strokeWidth={3} />
                    </g>
                  </g>
                );
              })}

            </svg>
          </div>

          {/* near foreground — passes faster than the world */}
          <div className="sr-fg" ref={fgRef} aria-hidden="true">
            <ForegroundLayer width={fgWidth} />
          </div>

          {/* first-person (front seat) view */}
          {fpp && (
            <div className="sr-fpp" aria-hidden="true" style={{ background: bgInfo.sky }}>
              <Suspense fallback={<div className="sr-fpp-loading">Boarding the front seat…</div>}>
                <CoasterFPP track={track} accent={accent} labels={fppLabels} apiRef={fppApiRef} theme={bg} />
              </Suspense>
            </div>
          )}

          {/* fireworks on arrival */}
          <div className="sr-fireworks" aria-hidden="true">
            {fireworks.map((f) => (
              <span
                key={f.b}
                className="sr-fw"
                style={{ left: `${f.left}%`, top: `${f.top}%`, '--fc': f.color, '--fd': `${f.delay}s`, '--fr': `${f.size}px` }}
              >
                {Array.from({ length: 14 }, (_, k) => <i key={k} style={{ '--a': `${(k / 14) * 360}deg` }} />)}
              </span>
            ))}
          </div>

          {/* top HUD */}
          <div className="sr-hud">
            <div className="sr-badge">
              <span className="sr-badge-tile"><TrainFront size={15} /></span>
              <span className="sr-badge-text">
                <span className="sr-badge-over">Orbit Express</span>
                <strong>{portfolio.name}</strong>
              </span>
            </div>
            <div className="sr-hud-actions">
              {fpp && (
                <div className="sr-bg" ref={bgRef}>
                  <button
                    type="button"
                    className={`sr-hud-btn sr-bg-btn ${bgOpen ? 'is-open' : ''}`}
                    onClick={() => setBgOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={bgOpen}
                    aria-label={`Background: ${bgInfo.label}. Change background`}
                    title="Change background (B)"
                  >
                    <bgInfo.Icon size={15} />
                    <span>{bgInfo.label}</span>
                    <ChevronDown size={13} className="sr-bg-chev" />
                  </button>
                  {bgOpen && (
                    <div className="sr-bg-menu" role="menu" aria-label="Background">
                      <div className="sr-bg-head">Background</div>
                      {FPP_BGS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={b.id === bg}
                          className={`sr-bg-opt ${b.id === bg ? 'is-on' : ''}`}
                          onClick={() => { setBg(b.id); setBgOpen(false); }}
                        >
                          <span className="sr-bg-swatch" style={{ background: b.sky, color: b.ink }}>
                            <b.Icon size={16} />
                          </span>
                          <span className="sr-bg-text">
                            <strong>{b.label}</strong>
                            <small>{b.note}</small>
                          </span>
                          {b.id === bg && <Check size={15} className="sr-bg-check" />}
                        </button>
                      ))}
                      <div className="sr-bg-foot">Press B to switch</div>
                    </div>
                  )}
                </div>
              )}
              {canFpp && (
                <button
                  type="button"
                  className={`sr-hud-btn ${fpp ? 'is-on' : ''}`}
                  onClick={toggleView}
                  aria-pressed={fpp}
                  aria-label={fpp ? 'Switch to side view' : 'Switch to first-person view'}
                  title="Toggle view (V)"
                >
                  {fpp ? <MapIcon size={15} /> : <ScanEye size={15} />}
                  <span>{fpp ? 'Side view' : 'First person'}</span>
                </button>
              )}
              <button
                type="button"
                className={`sr-hud-btn ${autoOn ? 'is-on' : ''}`}
                onClick={toggleAuto}
                aria-pressed={autoOn}
                aria-label={autoOn ? 'Pause auto ride' : 'Auto ride'}
              >
                {autoOn ? <Pause size={15} /> : <Play size={15} />}
                <span>{autoOn ? 'Pause' : 'Auto ride'}</span>
              </button>
              <button type="button" className="sr-close" onClick={close} aria-label="Close ride">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ride HUD: stop label, track mini-map, speed */}
          <div className="sr-ride">
            <span className="sr-stop-label" ref={stopLabelRef}>{STOP_COUNT} stops</span>
            <div className="sr-mini" aria-hidden="true">
              <svg viewBox={`0 0 ${track.width} ${WORLD_H}`} preserveAspectRatio="none">
                <path d={miniPath} className="sr-mini-base" />
                <path d={miniPath} className="sr-mini-fill" ref={miniFillRef} pathLength="1" />
              </svg>
              {track.gates.map((g, i) => (
                <span key={i} className="sr-mini-gate" style={{ left: `${(g.x / track.width) * 100}%`, top: `${(g.y / WORLD_H) * 100}%` }} />
              ))}
              <span className="sr-mini-dot" ref={miniDotRef} />
            </div>
            <span className="sr-speed"><Gauge size={13} /><b ref={speedRef}>0</b><small>km/h</small></span>
          </div>

          {/* intro card */}
          <div className="sr-intro">
            <span className="sr-intro-over">Now boarding</span>
            <h2 className="sr-intro-title">{portfolio.name}&apos;s Orbit</h2>
            <p className="sr-intro-sub">{STOP_COUNT} stops · loops, drops and a corkscrew. Keep your hands inside the car.</p>
            <div className="sr-intro-actions">
              <button type="button" className="sr-intro-btn" onClick={toggleAuto}>
                <Play size={14} /> Auto ride
              </button>
              <span className="sr-intro-hint"><ChevronDown size={15} /> or scroll to ride</span>
            </div>
          </div>

          {/* checkpoint panels */}
          <div className="sr-cps">
            {stops.map((s, i) => (
              <section key={s.key} className="sr-cp" data-cp={s.key} aria-hidden="true">
                <div className="sr-cp-meta">
                  <span>Stop {i + 1} of {STOP_COUNT}</span>
                  <span className="sr-cp-dots">
                    {stops.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}
                  </span>
                </div>
                {isOrbitDrive ? (
                  <OrbitsCheckpointPreview label={s.label} fields={s.fields} accent={accent} />
                ) : (
                  defaultPanels[i]
                )}
              </section>
            ))}

            {/* arrival */}
            <section className="sr-cp sr-done-panel" aria-hidden="true">
              <span className="sr-done-flag"><Flag size={20} /></span>
              <h2 className="sr-done-title">Ride complete</h2>
              <p className="sr-done-sub">
                You rode <b>{portfolio.miles} mi</b> through {portfolio.name}&apos;s orbit
                {portfolio.vibe ? <> — {String(portfolio.vibe).toLowerCase()}</> : null}.
              </p>
              <div className="sr-done-chips">
                <span className="sr-done-chip"><Route size={12} /> {portfolio.miles} mi</span>
                <span className="sr-done-chip"><Flag size={12} /> {STOP_COUNT} stops</span>
                <span className="sr-done-chip"><span className="sr-done-swatch" /> #{String(accent).replace('#', '').toUpperCase()}</span>
              </div>
              <div className="sr-done-actions">
                <button type="button" className="sr-done-btn" onClick={close}>Done</button>
                <button type="button" className="sr-done-ghost" onClick={rideAgain}>
                  <RotateCcw size={13} /> Ride again
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
