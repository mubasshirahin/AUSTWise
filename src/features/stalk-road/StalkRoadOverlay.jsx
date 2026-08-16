import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  PawPrint, X, ChevronDown, Flag, Route, Clapperboard, Gamepad2, Eye, Headphones, Swords,
} from 'lucide-react';
import { useStalk } from './StalkContext';
import { useAuth } from '../../context/AuthContext';
import { loadUserFavoriteColor } from '../orbits/OrbitsContext';
import ThreeCar from './ThreeCar';
import { MoviesSection, GamingSection, AnimeSection, MusicSection, ThisOrThatSection } from './StalkPortfolio';
import OrbitsCheckpointPreview from '../orbits/OrbitsPreview';
import './StalkPortfolio.css';
import './StalkRoad.css';

gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);

/* ─── The long winding highway (viewBox 0 0 1200 800) ─── */
const ROAD_PATH_D = [
  'M 70 750',
  'C 150 680, 165 590, 270 570',
  'C 400 546, 430 440, 385 350',
  'C 340 260, 235 235, 215 170',
  'C 195 105, 285 60, 375 80',
  'C 490 105, 530 180, 630 165',
  'C 745 148, 780 85, 880 105',
  'C 985 126, 1020 215, 995 300',
  'C 970 385, 875 425, 900 510',
  'C 920 580, 1010 610, 1100 640',
  'C 1145 656, 1170 685, 1200 700',
].join(' ');

/* ─── Deterministic pseudo-random generator (stable scenery across mounts) ─── */
function mulberry(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─── Road-trip stops (checkpoints) shown along the drive ─── */
const DEFAULT_STOPS = [
  { key: 'movies', label: 'MOVIES', Icon: Clapperboard },
  { key: 'gaming', label: 'GAMING', Icon: Gamepad2 },
  { key: 'anime', label: 'ANIME', Icon: Eye },
  { key: 'music', label: 'MUSIC', Icon: Headphones },
  { key: 'vs', label: 'THIS OR THAT', Icon: Swords },
];

// The highway is far wider than the screen — the camera pans across it.
const BAND_W = 4.2; // band width in viewport units
const CAR_X = 0.30; // car's screen position as a fraction of the viewport width

// Checkpoint detail panels only appear a short while before/after the car
// reaches each checkpoint flag — nothing in between (no premature overlays).
const CP_ZONE = 0.045; // half-width of the active window (in trip progress)
const ARRIVE_AT = 0.96; // journey-complete panel appears only at the very end

export default function StalkRoadOverlay() {
  const { target, portfolio, customStops, favoriteColor: tripFavoriteColor, close } = useStalk();
  const { user } = useAuth();
  const scrollerRef = useRef(null); // fixed scroll container
  const trackRef = useRef(null);    // tall runway that provides scroll
  const stageRef = useRef(null);    // pinned 100vw x 100vh viewport
  const bandRef = useRef(null);     // the wide highway strip the camera pans across
  const carRef = useRef(null);      // the car (screen-space, camera-followed)
  const carAngleRef = useRef(0);    // current road heading, fed to the 3D car
  const skylineRef = useRef(null);  // distant city backdrop (parallax layer)

  // Drive My Orbit passes its own editable checkpoints; anything else uses the
  // classic five stops (movies → gaming → anime → music → this-or-that).
  const stops = useMemo(() => (
    customStops && customStops.length
      ? customStops.map((s) => ({ key: s.key, label: s.label, fields: s.fields }))
      : DEFAULT_STOPS
  ), [customStops]);
  const STOP_COUNT = stops.length;
  // track height in viewport segments (intro + stops + arrival)
  const SEGMENTS = STOP_COUNT + 2;
  const isOrbitDrive = Boolean(customStops && customStops.length);

  // The accent rides the user's chosen favorite color whenever the target is
  // the logged-in user (self-stalk) or an orbit drive; everyone else keeps
  // their deterministic portfolio color.
  const isSelf = Boolean(user && (target?.id === user.id || target?.id === user.awid || target?.awid === user.id));
  const savedFav = isSelf ? (() => { try { return loadUserFavoriteColor(user?.id); } catch { return ''; } })() : '';
  // The orbit drive (Drive My Orbit) always rides the user's favorite color;
  // when none is saved yet it falls back to the default cyan — never the
  // deterministic portfolio color, which can be pink.
  const accent = isOrbitDrive
    ? (tripFavoriteColor || savedFav || '#00ffcc')
    : (savedFav || portfolio?.favoriteColor);

  const defaultPanels = [
    <MoviesSection movies={portfolio?.movies} accent={accent} key="p-movies" />,
    <GamingSection games={portfolio?.games} accent={accent} key="p-gaming" />,
    <AnimeSection anime={portfolio?.anime} accent={accent} key="p-anime" />,
    <MusicSection portfolio={portfolio} accent={accent} key="p-music" />,
    <ThisOrThatSection matchups={portfolio?.matchups} accent={accent} key="p-vs" />,
  ];

  useEffect(() => {
    if (!target || !portfolio) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (scroller) scroller.scrollTop = 0;

    const created = [];

    const ctx = gsap.context(() => {
      // ── Cinematic open (no driving yet — the car waits for scroll) ──
      gsap.fromTo('.sr-letterbox-top', { scaleY: 1 }, { scaleY: 0, duration: 0.7, ease: 'power4.inOut' });
      gsap.fromTo('.sr-letterbox-bottom', { scaleY: 1 }, { scaleY: 0, duration: 0.7, ease: 'power4.inOut' }, 0);
      gsap.fromTo('.sr-badge', { y: -18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, delay: 0.55, ease: 'power2.out' });
      gsap.fromTo('.sr-hint', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.9, ease: 'power2.out', clearProps: 'all' });

      // ── Pin each checkpoint flag onto the highway ──
      const pathEl = stage.querySelector('#sr-road-path');
      const totalLen = pathEl.getTotalLength();
      const sx = () => (window.innerWidth * BAND_W) / 1200;
      const sy = () => window.innerHeight / 800;
      const flagEls = Array.from(stage.querySelectorAll('.sr-flag'));
      flagEls.forEach((flagEl, i) => {
        const pt = pathEl.getPointAtLength(totalLen * ((i + 1) / (SEGMENTS - 1)));
        flagEl.style.left = `${pt.x * sx()}px`;
        flagEl.style.top = `${pt.y * sy()}px`;
        gsap.set(flagEl, { autoAlpha: 0, scale: 0 });
      });

      // ── Night sky: twinkling stars + drifting clouds ──
      const sky = stage.querySelector('.sr-sky');
      if (sky) {
        const starRand = mulberry(2026);
        for (let s = 0; s < 48; s += 1) {
          const star = document.createElement('span');
          star.className = 'sr-star';
          star.style.left = `${(starRand() * 100).toFixed(2)}%`;
          star.style.top = `${(starRand() * 64).toFixed(2)}%`;
          const size = starRand() * 1.6 + 1;
          star.style.width = `${size.toFixed(1)}px`;
          star.style.height = `${size.toFixed(1)}px`;
          star.style.setProperty('--d', `${(starRand() * 2.4 + 1.3).toFixed(2)}s`);
          star.style.animationDelay = `${(-starRand() * 4).toFixed(2)}s`;
          sky.appendChild(star);
        }
        const cloudRand = mulberry(31);
        for (let c = 0; c < 3; c += 1) {
          const cloud = document.createElement('span');
          cloud.className = 'sr-cloud';
          cloud.style.top = `${(cloudRand() * 26 + 7).toFixed(1)}%`;
          cloud.style.setProperty('--sc', (cloudRand() * 0.9 + 0.55).toFixed(2));
          cloud.style.setProperty('--dur', `${(cloudRand() * 70 + 60).toFixed(0)}s`);
          cloud.style.animationDelay = `${(-cloudRand() * 90).toFixed(0)}s`;
          sky.appendChild(cloud);
        }
      }

      // ── Distant city skyline (parallax backdrop) ──
      const skyline = skylineRef.current;
      if (skyline) {
        const bRand = mulberry(777);
        for (let b = 0; b < 66; b += 1) {
          const bld = document.createElement('span');
          bld.className = 'sr-building';
          bld.style.left = `${(b * 3.1).toFixed(1)}vw`;
          bld.style.width = `${(bRand() * 2.6 + 1.6).toFixed(1)}vw`;
          bld.style.height = `${((bRand() * 0.5 + 0.18) * 22).toFixed(1)}vh`;
          if (bRand() > 0.8) bld.classList.add('sr-building-tall');
          skyline.appendChild(bld);
        }
      }

      // ── Roadside scenery: lamps, trees, bushes, signs & billboards ──
      const scenery = stage.querySelector('.sr-scenery');
      if (scenery) {
        const sRand = mulberry(4242);
        const roadLen = pathEl.getTotalLength();
        const INNER = {
          tree: '<span class="sr-tree-b"><span class="sr-tree-trunk"></span><span class="sr-tree-top"></span></span>',
          lamp: '<span class="sr-lamp-b"><span class="sr-lamp-pole"></span><span class="sr-lamp-head"></span></span>',
          sign: '<span class="sr-sign-b"><span class="sr-sign-board"></span><span class="sr-sign-pole"></span></span>',
          warn: '<span class="sr-warn-b"><span class="sr-warn-board"></span><span class="sr-warn-pole"></span></span>',
          traffic: '<span class="sr-traffic-b"><span class="sr-traffic-head"><i class="sr-traffic-lamp sr-traffic-r"></i><i class="sr-traffic-lamp sr-traffic-y"></i><i class="sr-traffic-lamp sr-traffic-g"></i></span><span class="sr-traffic-pole"></span></span>',
          cone: '<span class="sr-cone-b"><span class="sr-cone-body"></span></span>',
          marker: '<span class="sr-marker-b"><span class="sr-marker-block"></span><span class="sr-marker-post"></span></span>',
          bush: '<span class="sr-bush-b"></span>',
          billboard: '<span class="sr-billboard-b"><span class="sr-billboard-board"></span></span>',
        };
        const place = (type, len, side, off, scl = 1) => {
          const pt = pathEl.getPointAtLength(len);
          const a = pathEl.getPointAtLength(Math.min(len + 5, roadLen));
          const b = pathEl.getPointAtLength(Math.max(len - 5, 0));
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dl = Math.hypot(dx, dy) || 1;
          const nx = -dy / dl;
          const ny = dx / dl;
          const el = document.createElement('div');
          el.className = `sr-sc sr-${type}`;
          el.innerHTML = INNER[type] || '';
          el.style.left = `${(pt.x * sx() + nx * off * side).toFixed(1)}px`;
          el.style.top = `${(pt.y * sy() + ny * off * side).toFixed(1)}px`;
          el.style.setProperty('--s', String(scl));
          el.style.setProperty('--d', `${(sRand() * 3 + 3.6).toFixed(2)}s`);
          el.style.setProperty('--dl', `${(-sRand() * 4).toFixed(2)}s`);
          scenery.appendChild(el);
          return el;
        };

        const STEP = 40;
        const M = Math.floor(roadLen / STEP);
        for (let i = 1; i < M; i += 1) {
          const len = i * STEP;
          const side = i % 2 === 0 ? 1 : -1;
          const r = sRand();
          if (i % 17 === 9) {
            place('traffic', len, side, 34 + sRand() * 12);
          } else if (i % 8 === 6) {
            place('marker', len, side, 26 + sRand() * 8);
          } else if (i % 4 === 0) {
            place('lamp', len, side, 30 + sRand() * 14);
          } else if (i % 6 === 5) {
            place('cone', len, side, 32 + sRand() * 10);
          } else if (i % 7 === 3) {
            const el = place('sign', len, side, 34 + sRand() * 12);
            el.classList.add(`sr-sign-${i % 3}`);
          } else if (i % 11 === 7) {
            place('warn', len, side, 30 + sRand() * 12);
          } else if (r < 0.42) {
            place('tree', len, side, 30 + sRand() * 40, 0.7 + sRand() * 0.65);
          } else if (r < 0.72) {
            place('bush', len, side, 24 + sRand() * 20, 0.7 + sRand() * 0.6);
          } else if (r < 0.88) {
            place('tree', len, side, 30 + sRand() * 30, 0.8 + sRand() * 0.5);
          } else {
            place('bush', len, side, 22 + sRand() * 16, 0.75 + sRand() * 0.5);
          }
        }

        for (let k = 0; k < 4; k += 1) {
          place('billboard', sRand() * roadLen, sRand() > 0.5 ? 1 : -1, 78 + sRand() * 30);
        }
      }

      // ── The drive: one scroll → car rides the road while the camera pans ──
      const panels = stage.querySelectorAll('.sr-cp');
      const progressFill = stage.querySelector('.sr-progress-fill');
      const stopLabel = stage.querySelector('.sr-stop-label');
      const band = bandRef.current;
      const car = carRef.current;

      let last = -99;
      const renderFrame = (p) => {
        const vw = window.innerWidth;

        // where the car is on the road right now
        const pt = pathEl.getPointAtLength(p * totalLen);
        const sample = 6;
        const ahead = pathEl.getPointAtLength(Math.min(p * totalLen + sample, totalLen));
        const behind = pathEl.getPointAtLength(Math.max(p * totalLen - sample, 0));
        const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;

        const carWorldX = pt.x * sx();
        const carY = pt.y * sy();

        // camera: follow the car, clamped so the highway always fills the
        // screen (no empty edge) and the car stays visible the whole trip
        const panMax = vw * (BAND_W - 1);
        const bandX = Math.min(0, Math.max(CAR_X * vw - carWorldX, -panMax));
        const carScreenX = carWorldX + bandX;
        band.style.transform = `translateX(${bandX}px)`;
        if (skylineRef.current) skylineRef.current.style.transform = `translateX(${(bandX * 0.14).toFixed(1)}px)`;
        carAngleRef.current = angle;
        car.style.transform = `translate(${carScreenX}px, ${carY}px) translate(-50%, -50%)`;

        if (progressFill) progressFill.style.width = `${Math.round(p * 100)}%`;
        stage.classList.toggle('sr-scrolled', p > 0.02);

        let idx = -1;
        for (let i = 0; i < STOP_COUNT; i += 1) {
          const centre = (i + 1) / (SEGMENTS - 1);
          if (p >= centre - CP_ZONE && p < centre + CP_ZONE) idx = i;
        }
        if (p >= ARRIVE_AT) idx = STOP_COUNT; // arrival — only at the very end

        if (idx === last) return;
        last = idx;

        panels.forEach((pn, i) => {
          pn.classList.toggle('active', i === idx);
          pn.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        });
        flagEls.forEach((fl, i) => {
          if (i === idx) {
            gsap.to(fl, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', overwrite: true });
          }
        });
        if (idx === STOP_COUNT) {
          gsap.to('.sr-done-panel', { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)', overwrite: true });
          gsap.to('.sr-stop-label', { opacity: 0, duration: 0.3 });
          stage.classList.add('sr-done');
        } else {
          stage.classList.remove('sr-done');
        }
        if (stopLabel) {
          stopLabel.textContent = idx >= 0 && idx < STOP_COUNT ? stops[idx].label : '';
        }
      };

      const st = ScrollTrigger.create({
        trigger: trackRef.current,
        scroller,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => renderFrame(self.progress),
      });
      created.push(st);

      // park the car at the start of the road before any scrolling happens
      renderFrame(0);
    }, stage);

    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);

    // ── Resume where the trip left off after a page refresh ──
    let scrollRaf = 0;
    const saveScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (max > 0) {
        try {
          sessionStorage.setItem('stalk-scroll', String(scroller.scrollTop / max));
        } catch { /* ignore */ }
      }
    };
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        saveScroll();
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    try {
      const saved = parseFloat(sessionStorage.getItem('stalk-scroll') || '');
      if (!Number.isNaN(saved) && saved > 0) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = saved * max;
      }
    } catch { /* ignore */ }

    return () => {
      cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('load', onLoad);
      window.removeEventListener('keydown', onKey);
      created.forEach((t) => t.kill());
      document.body.style.overflow = prevOverflow;
      ctx.revert();
    };
  }, [target, portfolio, customStops, close, stops, STOP_COUNT, SEGMENTS]);

  if (!target || !portfolio) return null;

  return (
    <div className="sr-overlay" ref={scrollerRef} data-role="stalk-road">
      <div className="sr-track" ref={trackRef} style={{ '--sr-segments': SEGMENTS }}>
        <div className="sr-stage" ref={stageRef} style={{ '--stalk-accent': accent }}>
          {/* cinematic letterbox bars */}
          <div className="sr-letterbox sr-letterbox-top" />
          <div className="sr-letterbox sr-letterbox-bottom" />

          {/* night sky — twinkling stars & drifting clouds (fixed, no parallax) */}
          <div className="sr-sky" aria-hidden="true" />
          {/* distant city skyline — parallaxes slowly as the camera pans */}
          <div className="sr-skyline" ref={skylineRef} aria-hidden="true" />

          {/* the wide highway — the camera pans across this strip */}
          <div className="sr-band" ref={bandRef}>
            <svg className="sr-road-svg" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
              <path d={ROAD_PATH_D} fill="none" className="sr-road-verge" />
              <path d={ROAD_PATH_D} fill="none" className="sr-road-edge" />
              <path id="sr-road-path" d={ROAD_PATH_D} fill="none" className="sr-road-body" />
              <path d={ROAD_PATH_D} fill="none" className="sr-road-dash" />
            </svg>

            {/* roadside scenery — lamps, trees, bushes, signs & billboards */}
            <div className="sr-scenery" aria-hidden="true" />

            {/* checkpoint flags along the highway */}
            {stops.map((s, i) => {
              const Icon = s.Icon;
              return (
                <div key={s.key} className="sr-flag" data-idx={i}>
                  <div className="sr-flag-pole" />
                  <div className="sr-flag-banner">
                    <span className="sr-flag-icon">
                      {Icon ? <Icon size={15} /> : <span className="sr-flag-init">{s.label.charAt(0)}</span>}
                    </span>
                    <span className="sr-flag-label">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* the car (3D, sits still until you scroll) */}
          <div className="sr-car" ref={carRef}>
            <ThreeCar color={accent} angleRef={carAngleRef} />
          </div>

          {/* HUD */}
          <div className="sr-hud">
            <div className="sr-badge">
              <PawPrint size={14} style={{ color: accent }} />
              <span>STALKING <strong>{portfolio.name}</strong></span>
            </div>
            <button type="button" className="sr-close" onClick={close} aria-label="Close road trip">
              <X size={18} />
            </button>
          </div>

          <div className="sr-stop-label" />
          <div className="sr-progress" aria-hidden="true"><div className="sr-progress-fill" /></div>

          <div className="sr-hint">
            <ChevronDown size={20} style={{ color: accent }} />
            <span>SCROLL TO DRIVE</span>
          </div>

          {/* checkpoint detail panels — shown on the road itself */}
          <div className="sr-cps">
            {stops.map((s, i) => (
              <div key={s.key} className="sr-cp" data-cp={s.key} aria-hidden="true">
                {isOrbitDrive ? (
                  <OrbitsCheckpointPreview label={s.label} fields={s.fields} accent={accent} />
                ) : (
                  defaultPanels[i]
                )}
              </div>
            ))}
          </div>

          {/* arrival */}
          <div className="sr-done-panel" aria-hidden="true">
            <span className="sr-done-flag"><Flag size={22} style={{ color: accent }} /></span>
            <h2 className="sr-done-title">Journey complete</h2>
            <p className="sr-done-sub">
              You drove <b>{portfolio.miles} mi</b> through {portfolio.name}&apos;s universe —
              {portfolio.vibe.toLowerCase()}, favorite color{' '}
              <b style={{ color: accent }}>#{accent.slice(1).toUpperCase()}</b>.
            </p>
            <div className="sr-done-chips">
              <span className="sr-done-chip"><Route size={12} /> {portfolio.miles} mi</span>
              <span className="sr-done-chip"><PawPrint size={12} /> {STOP_COUNT} checkpoints</span>
            </div>
            <button type="button" className="sr-done-btn" onClick={close}>
              <PawPrint size={15} /> Done stalking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}