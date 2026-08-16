import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  PawPrint, X, ChevronDown, Flag, Route, Clapperboard, Gamepad2, Eye, Headphones, Swords,
} from 'lucide-react';
import { useStalk } from './StalkContext';
import { MoviesSection, GamingSection, AnimeSection, MusicSection, ThisOrThatSection } from './StalkPortfolio';
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

/* ─── Road-trip stops (checkpoints) shown along the drive ─── */
const STOPS = [
  { key: 'movies', label: 'MOVIES', Icon: Clapperboard },
  { key: 'gaming', label: 'GAMING', Icon: Gamepad2 },
  { key: 'anime', label: 'ANIME', Icon: Eye },
  { key: 'music', label: 'MUSIC', Icon: Headphones },
  { key: 'vs', label: 'THIS OR THAT', Icon: Swords },
];
const STOP_COUNT = STOPS.length;
// track height in viewport segments (intro + stops + arrival)
const SEGMENTS = STOP_COUNT + 2;

// The highway is far wider than the screen — the camera pans across it.
const BAND_W = 4.2; // band width in viewport units
const CAR_X = 0.30; // car's screen position as a fraction of the viewport width

/* ─── Stylized top-down sports car sprite ─── */
function CarSprite({ color, uid }) {
  const gid = `srk-body-${uid}`;
  return (
    <svg viewBox="0 0 140 64" width="100%" height="100%" aria-hidden="true" className="sr-car-svg">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect x="14" y="4" width="27" height="10" rx="5" fill="#0a0c11" />
      <rect x="14" y="50" width="27" height="10" rx="5" fill="#0a0c11" />
      <rect x="92" y="4" width="27" height="10" rx="5" fill="#0a0c11" />
      <rect x="92" y="50" width="27" height="10" rx="5" fill="#0a0c11" />
      <rect x="10" y="19" width="12" height="26" rx="5" fill="#11141b" />
      <path
        d="M12 32 C12 20 22 12 36 12 L92 12 C106 12 114 16 118 25 C122 29 128 30 132 32 C128 34 122 35 118 39 C114 48 106 52 92 52 L36 52 C22 52 12 44 12 32 Z"
        fill={`url(#${gid})`}
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.55"
      />
      <path d="M44 16 C58 16 70 18 76 22 L76 42 C70 46 58 48 44 48 C36 48 32 44 32 38 L32 26 C32 20 36 16 44 16 Z" fill="#0a0c11" opacity="0.92" />
      <path d="M47 18 C58 19 66 21 70 24 L70 27 C62 23 52 21 47 21 Z" fill="#ffffff" opacity="0.16" />
      <rect x="126" y="27" width="10" height="10" rx="4" fill="#ffe08a" />
      <ellipse cx="70" cy="32" rx="56" ry="14" fill={color} opacity="0.18" />
    </svg>
  );
}

export default function StalkRoadOverlay() {
  const { target, portfolio, close } = useStalk();
  const scrollerRef = useRef(null); // fixed scroll container
  const trackRef = useRef(null);    // tall runway that provides scroll
  const stageRef = useRef(null);    // pinned 100vw x 100vh viewport
  const bandRef = useRef(null);     // the wide highway strip the camera pans across
  const carRef = useRef(null);      // the car (screen-space, camera-followed)
  const flagsRef = useRef([]);

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
      flagsRef.current.forEach((flagEl, i) => {
        const pt = pathEl.getPointAtLength(totalLen * ((i + 1) / (SEGMENTS - 1)));
        flagEl.style.left = `${pt.x * sx()}px`;
        flagEl.style.top = `${pt.y * sy()}px`;
        gsap.set(flagEl, { autoAlpha: 0, scale: 0 });
      });

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
        car.style.transform = `translate(${carScreenX}px, ${carY}px) translate(-50%, -50%) rotate(${angle}deg)`;

        if (progressFill) progressFill.style.width = `${Math.round(p * 100)}%`;
        stage.classList.toggle('sr-scrolled', p > 0.02);

        let idx = -1;
        for (let i = 0; i < STOP_COUNT; i += 1) {
          if (p >= (i + 0.5) / (SEGMENTS - 1) && p < (i + 1.5) / (SEGMENTS - 1)) idx = i;
        }
        if (p >= (STOP_COUNT + 0.5) / (SEGMENTS - 1)) idx = STOP_COUNT; // arrival

        if (idx === last) return;
        last = idx;

        panels.forEach((pn, i) => {
          pn.classList.toggle('active', i === idx);
          pn.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        });
        flagsRef.current.forEach((fl, i) => {
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
          stopLabel.textContent = idx >= 0 && idx < STOP_COUNT ? STOPS[idx].label : '';
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
  }, [target, portfolio, close]);

  if (!target || !portfolio) return null;

  const accent = portfolio.favoriteColor;

  return (
    <div className="sr-overlay" ref={scrollerRef} data-role="stalk-road">
      <div className="sr-track" ref={trackRef}>
        <div className="sr-stage" ref={stageRef} style={{ '--stalk-accent': accent }}>
          {/* cinematic letterbox bars */}
          <div className="sr-letterbox sr-letterbox-top" />
          <div className="sr-letterbox sr-letterbox-bottom" />

          {/* the wide highway — the camera pans across this strip */}
          <div className="sr-band" ref={bandRef}>
            <svg className="sr-road-svg" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
              <path id="sr-road-path" d={ROAD_PATH_D} fill="none" className="sr-road-body" />
              <path d={ROAD_PATH_D} fill="none" className="sr-road-edge" style={{ stroke: accent }} />
              <path d={ROAD_PATH_D} fill="none" className="sr-road-dash" />
            </svg>

            {/* checkpoint flags along the highway */}
            {STOPS.map((s, i) => {
              const Icon = s.Icon;
              return (
                <div key={s.key} className="sr-flag" data-idx={i} ref={(el) => { flagsRef.current[i] = el; }}>
                  <span className="sr-flag-icon"><Icon size={14} /></span>
                  <span className="sr-flag-label">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* the car (sits still until you scroll) */}
          <div className="sr-car" ref={carRef}>
            <CarSprite color={accent} uid={portfolio.id} />
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
            <div className="sr-cp" data-cp="movies" aria-hidden="true">
              <MoviesSection movies={portfolio.movies} accent={accent} />
            </div>
            <div className="sr-cp" data-cp="gaming" aria-hidden="true">
              <GamingSection games={portfolio.games} accent={accent} />
            </div>
            <div className="sr-cp" data-cp="anime" aria-hidden="true">
              <AnimeSection anime={portfolio.anime} accent={accent} />
            </div>
            <div className="sr-cp" data-cp="music" aria-hidden="true">
              <MusicSection portfolio={portfolio} accent={accent} />
            </div>
            <div className="sr-cp" data-cp="vs" aria-hidden="true">
              <ThisOrThatSection matchups={portfolio.matchups} accent={accent} />
            </div>
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