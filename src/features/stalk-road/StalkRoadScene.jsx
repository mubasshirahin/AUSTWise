import {
  createElement, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  X, ChevronDown, Flag, Route, Clapperboard, Gamepad2, Eye, Headphones, Swords,
  Play, Pause, RotateCcw, Check, TrainFront, Gauge, ScanEye, Map as MapIcon,
} from 'lucide-react';
import { useStalk } from './StalkContext';
import { createPortal } from 'react-dom';
import { hasOrbitContent } from '../orbits/OrbitsContext';
import { useTheme } from '../../context/ThemeContext';
import { MoviesSection, GamingSection, AnimeSection, MusicSection, ThisOrThatSection } from './StalkPortfolio';
import OrbitsCheckpointPreview from '../orbits/OrbitsPreview';
import { withDevFakeFields, DEV_FAKE_STOPS } from './devFakeStops';
import {
  buildTrack, makeProgressMap, mulberry, WORLD_H, GROUND, BASE, CAR_GAP, CAR_COUNT,
} from './coasterTrack';
import {
  SkyLife, FarBackdrop, ParkBackdrop, WorldBack, WorldFront, ForegroundLayer,
} from './ParkScenery';
import { THEME_SCENERY } from './themeScenery';
import { INTEREST_SCENERY } from './interestScenery';
import { INTEREST_BY_ID } from './interestThemes';
import CoasterCar from './coasterCars';
import { RIDE_THEMES, themeById } from './rideThemes';
import './StalkPortfolio.css';
import './StalkRoad.css';

// three.js only loads once the rider switches to the first-person view
const CoasterFPP = lazy(() => import('./CoasterFPP'));

// Ride theme (rideThemes.js): one theme drives both the side view and the
// first-person view — track layout, car, scenery, station names, colours.
const readBg = () => {
  try {
    const v = localStorage.getItem('stalk-fpp-bg');
    return RIDE_THEMES.some((b) => b.id === v) ? v : 'city';
  } catch { return 'city'; }
};

// Side-view scenery layer for the theme: the Night city park is built in
// ParkScenery; the other themes come from themeScenery.
const CITY_SCENERY = {
  SkyLife, Far: FarBackdrop, Park: ParkBackdrop, Back: WorldBack, Front: WorldFront, Fg: ForegroundLayer,
};
const layer = (theme, name, props) => createElement(
  (THEME_SCENERY[theme] || INTEREST_SCENERY[theme] || CITY_SCENERY)[name] || CITY_SCENERY[name],
  props,
);

// Interest themes colour the shared track / station from their palette
const interestVars = (id) => {
  const t = INTEREST_BY_ID[id];
  if (!t) return undefined;
  const p = t.pal;
  return {
    '--sr-sky': p.sky,
    '--sr-silhouette': p.far,
    '--sr-silhouette-2': p.mid,
    '--sr-ground': p.ground,
    '--sr-steel': p.steel,
    '--sr-steel-2': p.steel2,
    '--ti-spine': p.spine,
    '--ti-roof': p.roof,
    '--ti-deck': p.deck,
    '--ti-board': p.board,
    '--ti-footing': p.footing || p.steel,
  };
};
const THEME_GROUPS = [['world', 'Worlds'], ['interest', 'Interests']];

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

// A checkpoint card opens just before its station (not half-way there) and
// stays a little after it. Values are scroll progress.
const CP_LEAD = 0.012;
const CP_TRAIL = 0.05;
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

export default function StalkRoadScene() {
  const { target, portfolio, customStops, close } = useStalk();
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
  const autoRef = useRef({ on: false, pauseUntil: 0, pauseMs: 0, pos: -1, dwelled: new Set() });
  const countRef = useRef(null);
  // Mobile gas pedal: hold to accelerate, release to coast to a stop.
  const gasRef = useRef({ down: false, vel: 0, pos: -1 });
  const [gasDown, setGasDown] = useState(false);
  const gasBtnRef = useRef(null);
  const stopsLenRef = useRef(0);
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
  const bgOpen = bgOpenRaw;
  const bgRef = useRef(null);
  const bgMenuRef = useRef(null);
  const bgInfo = themeById(bg);
  useEffect(() => {
    try { localStorage.setItem('stalk-fpp-bg', bg); } catch { /* ignore */ }
  }, [bg]);
  const cycleBg = useCallback(() => {
    setBg((cur) => RIDE_THEMES[(RIDE_THEMES.findIndex((b) => b.id === cur) + 1) % RIDE_THEMES.length].id);
  }, []);
  useEffect(() => {
    if (!bgOpen) return undefined;
    const onDown = (e) => { if (!bgRef.current?.contains(e.target) && !bgMenuRef.current?.contains(e.target)) setBgOpen(false); };
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

  // DEV: always preview the station cards with sample content (empty stops
  // get fake fields; no custom stops → a fake set). Production is unchanged.
  const devCards = import.meta.env.DEV;
  const stops = useMemo(() => {
    if (customStops && customStops.length) {
      const real = customStops.map((s) => ({ key: s.key, label: s.label, fields: s.fields }));
      const all = devCards ? withDevFakeFields(real) : real;
      // Skip stations with nothing filled in, so a long orbit isn't a ride past
      // blank cards. If every one is empty, keep them all (shows the empty state).
      const withContent = all.filter((st) => hasOrbitContent(st.fields));
      return withContent.length ? withContent : all;
    }
    return devCards ? DEV_FAKE_STOPS : DEFAULT_STOPS;
  }, [customStops, devCards]);
  const STOP_COUNT = stops.length;
  useEffect(() => { stopsLenRef.current = STOP_COUNT; }, [STOP_COUNT]);
  const fppLabels = useMemo(() => stops.map((s) => s.label), [stops]);
  const SEGMENTS = STOP_COUNT + 2; // scroll runway in viewport heights
  const isOrbitDrive = Boolean(customStops && customStops.length) || devCards;

  const track = useMemo(() => buildTrack(STOP_COUNT, bg), [STOP_COUNT, bg]);
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

  // The ride follows the active theme's accent (no per-user favourite color).
  const { accent: themeAccent } = useTheme() || {};
  const accent = themeAccent || '#F5A623';

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
    a.pos = -1;
    // Started mid-road: gates already behind the train count as visited,
    // otherwise the ride would brake again at every one it has passed.
    a.dwelled = new Set();
    if (sc) {
      const max = sc.scrollHeight - sc.clientHeight;
      const p = max > 0 ? sc.scrollTop / max : 0;
      const segs = stopsLenRef.current + 2;
      for (let i = 0; i < stopsLenRef.current; i += 1) {
        if ((i + 1) / (segs - 1) < p - 0.004) a.dwelled.add(i);
      }
    }
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
        // Float position kept here: phones round scrollTop to whole pixels, so
        // adding a sub-pixel step each frame never moved the ride on mobile.
        if (a.pos < 0 || Math.abs(a.pos - scroller.scrollTop) > 2) a.pos = scroller.scrollTop;
        const rate = max / ((STOP_COUNT + 1) * 4.6);
        const p = max > 0 ? scroller.scrollTop / max : 1;
        const gi = gateCentres.findIndex((c, i) => p >= c && !a.dwelled.has(i));
        if (gi >= 0) {
          a.dwelled.add(gi);
          a.stopIdx = gi;
          a.pauseMs = viewRef.current ? 5000 : 3400;
          a.pauseUntil = now + a.pauseMs;
        } else if (p >= 0.999) {
          a.on = false;
          setAutoOn(false);
        } else {
          a.pos = Math.min(max, a.pos + rate * dt);
          scroller.scrollTop = a.pos;
        }
      }

      // gas pedal (mobile): ease up to cruise speed while held, glide to a stop on release
      const g = gasRef.current;
      if (g.down || g.vel > 0) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        const top = max / ((STOP_COUNT + 1) * 2.4);
        // ~2.5s to reach full speed; ~1s to coast from full speed to a stop
        g.vel = g.down ? Math.min(top, g.vel + top * 0.4 * dt) : Math.max(0, g.vel - top * 1.0 * dt);
        if (g.pos < 0 || Math.abs(g.pos - scroller.scrollTop) > 2) g.pos = scroller.scrollTop;
        if (g.pos >= max) g.vel = 0;
        g.pos = Math.min(max, g.pos + g.vel * dt);
        scroller.scrollTop = g.pos;
        const btn = gasBtnRef.current;
        if (btn) {
          btn.style.setProperty('--gas', (top > 0 ? g.vel / top : 0).toFixed(3));
          btn.classList.toggle('is-moving', g.vel > 0);
        }
      }

      // station countdown: how long the card stays before the ride moves on
      const cd = countRef.current;
      if (cd) {
        const left = a.on && now < a.pauseUntil ? a.pauseUntil - now : 0;
        const show = left > 0;
        if (cd.dataset.on !== String(show)) cd.dataset.on = String(show);
        if (show) {
          const secs = String(Math.ceil(left / 1000));
          if (cd.firstChild.textContent !== secs) cd.firstChild.textContent = secs;
          cd.style.setProperty("--left", (left / (a.pauseMs || 1)).toFixed(3));
          // sit right above the open station card, centred on it
          const card = stage.querySelector(".sr-cp.active");
          if (card) {
            const sr = stage.getBoundingClientRect();
            const cr = card.getBoundingClientRect();
            const top = Math.max(8, cr.top - sr.top - cd.offsetHeight - 8);
            cd.style.top = `${Math.round(top)}px`;
            cd.style.left = `${Math.round(cr.left - sr.left + cr.width / 2)}px`;
          }
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
        const gap = 1 / (SEGMENTS - 1);
        if (curP >= gateCentres[i] - Math.min(CP_LEAD, gap * 0.12) && curP < gateCentres[i] + Math.min(CP_TRAIL, gap * 0.3)) idx = i;
      }
      // auto ride: the card is up only while the train waits at the station
      if (a.on) idx = now < a.pauseUntil ? a.stopIdx : -1;
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
    <div
      className="sr-overlay"
      ref={scrollerRef}
      data-role="stalk-road"
      data-theme={bg}
      data-kit={bgInfo.group === 'interest' ? 'interest' : undefined}
      data-light={bgInfo.light ? 'true' : undefined}
      style={interestVars(bg)}
    >
      <div className="sr-track" style={{ '--sr-segments': SEGMENTS }}>
        <div className="sr-stage" ref={stageRef} data-mode="dock" data-view={fpp ? 'fpp' : 'side'} data-theme={bg} style={{ '--stalk-accent': accent }}>
          {/* sky: the theme's sun / moon / planet */}
          <div className="sr-sky" aria-hidden="true">
            {bg !== 'city' && layer(bg, 'Sky', { stars })}
            {bg === 'city' && <span className="sr-moon"><i /><i /><i /><i /></span>}
            {bg === 'city' && stars.map((s) => (
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

          <div className="sr-skylife" aria-hidden="true">{layer(bg, 'SkyLife', {})}</div>

          {/* mountains + city (slowest parallax) */}
          <div className="sr-far" ref={farRef} aria-hidden="true">
            {layer(bg, 'Far', { width: farWidth })}
          </div>

          {/* amusement-park skyline (parallax) */}
          <div className="sr-park" ref={parkRef} aria-hidden="true">
            {layer(bg, 'Park', { width: parkWidth })}
          </div>
          <div className="sr-ground" ref={groundRef} aria-hidden="true" />

          {/* the coaster world — the camera pans across this strip */}
          <div className="sr-band" ref={bandRef}>
            <svg className="sr-world" viewBox={`0 0 ${track.width} ${WORLD_H}`} preserveAspectRatio="none" aria-hidden="true">
              {layer(bg, 'Back', { width: track.width, avoid })}

              {/* supports + lattice */}
              <path d={track.braces} className="sr-brace" />
              <path d={track.supports} className="sr-support" />
              <path d={track.footings} className="sr-footing" />

              {layer(bg, 'Front', { width: track.width, crowdAt })}

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
                    <text x={x0 + w / 2} y={BASE - 59} className="sr-station-text">{i === 0 ? bgInfo.ride : 'ARRIVAL'}</text>
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
                  <CoasterCar key={k} front={k === 0} theme={bg} innerRef={(el) => { carRefs.current[k] = el; }} />
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
            {layer(bg, 'Fg', { width: fgWidth })}
          </div>

          {/* first-person (front seat) view */}
          {fpp && (
            <div className="sr-fpp" aria-hidden="true" style={{ background: bgInfo.sky }}>
              <Suspense fallback={<div className="sr-fpp-loading">Boarding the front seat…</div>}>
                <CoasterFPP track={track} accent={accent} labels={fppLabels} apiRef={fppApiRef} theme={bg} rideName={bgInfo.ride} />
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
                <span className="sr-badge-over">{bgInfo.ride}</span>
                <strong>{portfolio.name}</strong>
              </span>
            </div>
            <div className="sr-hud-actions">
              <div className="sr-bg" ref={bgRef}>
                <button
                  type="button"
                  className={`sr-hud-btn sr-bg-btn ${bgOpen ? 'is-open' : ''}`}
                  onClick={() => setBgOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={bgOpen}
                  aria-label={`Ride theme: ${bgInfo.label}. Change theme`}
                  title="Change ride theme (B)"
                >
                  <bgInfo.Icon size={15} />
                  <span>{bgInfo.label}</span>
                  <ChevronDown size={13} className="sr-bg-chev" />
                </button>
                {bgOpen && ((menu) => (stageRef.current && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches ? createPortal(menu, stageRef.current) : menu))(
                  <div className="sr-bg-menu" ref={bgMenuRef} role="menu" aria-label="Ride theme">
                    <div className="sr-bg-head">Ride theme · both views</div>
                    <div className="sr-bg-scroll">
                      {THEME_GROUPS.map(([group, title]) => (
                        <div key={group} className="sr-bg-group" role="group" aria-label={title}>
                          <div className="sr-bg-sub">{title}</div>
                          <div className="sr-bg-grid">
                            {RIDE_THEMES.filter((b) => b.group === group).map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={b.id === bg}
                                className={`sr-bg-opt ${b.id === bg ? 'is-on' : ''}`}
                                onClick={() => { setBg(b.id); setBgOpen(false); }}
                                title={`${b.label} — ${b.note}`}
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
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="sr-bg-foot">B switches theme · V switches view</div>
                  </div>
                )}
              </div>
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

          <button
            ref={gasBtnRef}
            type="button"
            className={`sr-gas${gasDown ? ' is-down' : ''}`}
            aria-label="Hold to ride forward"
            onPointerDown={(e) => { e.preventDefault(); stopAuto(); gasRef.current.down = true; gasRef.current.pos = -1; setGasDown(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }}
            onPointerUp={() => { gasRef.current.down = false; setGasDown(false); }}
            onPointerCancel={() => { gasRef.current.down = false; setGasDown(false); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg className="sr-gas-ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="sr-gas-track" cx="50" cy="50" r="46" />
              <circle className="sr-gas-spin" cx="50" cy="50" r="46" />
              <circle className="sr-gas-fill" cx="50" cy="50" r="40" pathLength="100" />
            </svg>
            <Gauge size={22} className="sr-gas-icon" />
          </button>

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

          {/* checkpoint panels */}
          <div className="sr-cps">
            <div className="sr-auto-count" ref={countRef} data-on="false" aria-live="polite">
              <b>0</b><span>s · next stop</span><i aria-hidden="true" />
            </div>
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
