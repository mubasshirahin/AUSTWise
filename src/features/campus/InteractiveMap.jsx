import { useState, useRef, useCallback, useEffect, useMemo, useId, lazy, Suspense } from 'react';
import {
  ZoomIn, Maximize2, Minimize2, Compass, MoreVertical, Check, Plus, Minus,
  RotateCcw, Search, X, MapPin, Clock, Navigation, ArrowUpDown, Box, Map as MapIcon,
  CircleDot, Footprints, ArrowUp, ChevronDown,
} from 'lucide-react';
import GliderTabs from '../../components/GliderTabs';
import FloorPlanSvg, { MIN_SCALE, MAX_SCALE } from './floorplan/FloorPlanSvg';
import { FLOORS, ROOM_TYPE_LABEL, searchRooms } from './floorplan/floors';
import { findRoute, formatDuration } from './floorplan/routing';
import useRoomStatus from './floorplan/useRoomStatus';
import './SemesterViewWidget.css';
import '../daily-life/DailyMasthead.css';
import './floorplan/FloorPlan.css';

// three.js is heavy: only download it when someone opens the 3D view.
const FloorPlan3D = lazy(() => import('./floorplan/FloorPlan3D'));

const zoomLevels = [
  { id: 'fit', label: 'Fit', scale: 1 },
  { id: '1.5', label: '1.5×', scale: 1.5 },
  { id: '2', label: '2×', scale: 2 },
  { id: '3', label: '3×', scale: 3 },
  { id: '4', label: '4×', scale: 4 },
];

const PREFER_OPTIONS = [
  { id: 'any', label: 'Fastest' },
  { id: 'lift', label: 'Lift' },
  { id: 'stair', label: 'Stairs' },
];

const FLOOR_TABS = FLOORS.map((f) => ({ id: f.id, label: f.label, icon: null, desc: '' }));
// Phones: all nine floors must fit in one row, so tabs use G, 1, 2 …
const FLOOR_TABS_SHORT = FLOORS.map((f) => ({ id: f.id, label: f.id === 'Ground' ? 'G' : f.id.replace(/\D/g, ''), icon: null, desc: '' }));
const NARROW_PX = 560;
const floorName = (id) => (id === 'Ground' ? 'Ground floor' : `${id} floor`);
const isRoomCode = (id) => /^\d[A-C]\d\d$/.test(id);
const placeText = (place) => (place ? (isRoomCode(place.id) ? place.id : place.name) : '');

function RoomSearch({ onPick, value = '', placeholder, label, icon = 'search', autoFocus = false }) {
  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) { setPrevValue(value); setQuery(value); }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listId = `fp-list-${useId().replace(/:/g, '')}`;
  const results = useMemo(() => (query === value ? [] : searchRooms(query)), [query, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (room) => {
    onPick(room);
    setQuery(placeText(room));
    setOpen(false);
  };

  const Icon = icon === 'from' ? CircleDot : icon === 'to' ? MapPin : Search;

  return (
    <div className={`fp-search fp-search--${icon}`} ref={wrapRef}>
      <Icon size={15} className="fp-search-icon" aria-hidden="true" />
      <input
        type="search"
        className="fp-search-input"
        placeholder={placeholder}
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        aria-label={label}
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        role="combobox"
      />
      {query && (
        <button type="button" className="fp-search-clear" aria-label={`Clear ${label}`} onClick={() => { setQuery(''); setOpen(false); }}>
          <X size={14} />
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="fp-search-list" id={listId} role="listbox">
          {results.map((room, i) => (
            <li key={`${room.floorId}-${room.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`fp-search-item${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(room)}
              >
                <span className={`fp-swatch fp-swatch--${room.type}`} aria-hidden="true" />
                <span className="fp-search-name">{room.name}</span>
                <span className="fp-search-floor">{room.floorId === 'Ground' ? 'Ground' : `${room.floorId} floor`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomSheet({ room, floor, status, onClose, onDirections }) {
  if (!room) return null;
  const busy = status?.status === 'busy';
  const d = status?.details;
  let statusLine = null;
  if (status) {
    if (d?.venue === 'canteen') statusLine = d.open ? `Open now · ${d.hours}` : `Closed · ${d.hours}`;
    else if (d?.venue === 'auditorium') statusLine = busy ? `Event: ${d.event?.title}` : 'No event right now';
    else if (busy) statusLine = [d?.course, d?.dept && `${d.dept}${d.semester ? ` ${d.semester}` : ''}${d.section ? ` (${d.section})` : ''}`, d?.time].filter(Boolean).join(' · ');
    else statusLine = 'No class booked right now';
  }
  return (
    <div className="fp-sheet" role="region" aria-label={`${room.name} details`}>
      <span className={`fp-swatch fp-swatch--${room.type} fp-sheet-swatch`} aria-hidden="true" />
      <div className="fp-sheet-body">
        <div className="fp-sheet-title">
          <strong>{room.name}</strong>
          {status && (
            <span className={`fp-chip is-${status.status}`}>
              {d?.venue === 'canteen' ? (d.open ? 'Open' : 'Closed') : busy ? 'Busy' : 'Free'}
            </span>
          )}
        </div>
        <div className="fp-sheet-meta">
          <span><MapPin size={12} /> {floorName(floor.id)}{isRoomCode(room.id) ? ` · ${room.id}` : ''}</span>
          <span>{ROOM_TYPE_LABEL[room.type] || 'Room'}</span>
        </div>
        {statusLine && <div className="fp-sheet-status"><Clock size={12} /> {statusLine}</div>}
        {floor.typical && <div className="fp-sheet-note">Room positions on this floor are approximate.</div>}
        <div className="fp-sheet-actions">
          <button type="button" className="fp-btn is-primary" onClick={() => onDirections('to')}>
            <Navigation size={14} /> Directions here
          </button>
          <button type="button" className="fp-btn" onClick={() => onDirections('from')}>
            <CircleDot size={14} /> Start from here
          </button>
        </div>
      </div>
      <button type="button" className="fp-sheet-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
    </div>
  );
}

function DirectionsPanel({ from, to, prefer, route, activeFloorId, compact, onFrom, onTo, onSwap, onPrefer, onStep, onClose }) {
  const crossFloor = from && to && from.floorId !== to.floorId;
  // On phones the step list starts folded so the map stays in view.
  const [stepsOpen, setStepsOpen] = useState(!compact);
  return (
    <section className="fp-dir" aria-label="Directions">
      <div className="fp-dir-head">
        <strong><Navigation size={15} /> Directions</strong>
        <button type="button" className="fp-sheet-close" aria-label="Close directions" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="fp-dir-fields">
        <div className="fp-dir-inputs">
          <RoomSearch icon="from" label="Start" placeholder="From — Canteen, 2A05…" value={placeText(from)} onPick={onFrom} autoFocus={!from} />
          <RoomSearch icon="to" label="Destination" placeholder="To — 5B03, Library…" value={placeText(to)} onPick={onTo} autoFocus={Boolean(from) && !to} />
        </div>
        <button type="button" className="fp-dir-swap" aria-label="Swap start and destination" onClick={onSwap} disabled={!from && !to}>
          <ArrowUpDown size={16} />
        </button>
      </div>

      {crossFloor && (
        <div className="fp-seg" role="radiogroup" aria-label="Go between floors by">
          {PREFER_OPTIONS.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={prefer === o.id}
              className={`fp-seg-btn${prefer === o.id ? ' is-active' : ''}`} onClick={() => onPrefer(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {route && (
        <>
          <div className="fp-dir-summary">
            <span className="fp-dir-time">{formatDuration(route.seconds)}</span>
            <span>{Math.round(route.metres)} m walk{route.via ? ` · via ${route.via.kind === 'lift' ? 'lift' : 'stairs'}` : ''}</span>
            {compact && (
              <button type="button" className="fp-steps-toggle" aria-expanded={stepsOpen} onClick={() => setStepsOpen((o) => !o)}>
                {stepsOpen ? 'Hide steps' : `${route.steps.length} steps`}
                <ChevronDown size={14} className={stepsOpen ? 'is-open' : ''} />
              </button>
            )}
          </div>
          {stepsOpen && (
          <ol className="fp-steps">
            {route.steps.map((step, i) => (
              <li key={i}>
                <button type="button" className={`fp-step${step.floorId === activeFloorId ? ' is-current' : ''}`} onClick={() => onStep(step.floorId)}>
                  <span className="fp-step-n">{i + 1}</span>
                  <span className="fp-step-text">{step.text}</span>
                  <span className="fp-step-floor">{step.floorId}</span>
                </button>
              </li>
            ))}
          </ol>
          )}
          {stepsOpen && <p className="fp-dir-note"><Footprints size={12} /> Times and distances are estimates.</p>}
        </>
      )}
      {from && to && !route && <p className="fp-dir-note">No way found between these two places.</p>}
    </section>
  );
}

export default function InteractiveMap() {
  const [floorId, setFloorId] = useState('Ground');
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [view, setView] = useState('2d');
  const [dirOpen, setDirOpen] = useState(false);
  const [dirFrom, setDirFrom] = useState(null);
  const [dirTo, setDirTo] = useState(null);
  const [prefer, setPrefer] = useState('any');
  const menuRef = useRef(null);
  const viewportRef = useRef(null);
  const mapRef = useRef(null);
  const widgetRef = useRef(null);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < NARROW_PX);

  // Portrait layout follows the widget's own width, not the window's.
  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const getStatus = useRoomStatus();

  const floor = FLOORS.find((f) => f.id === floorId) || FLOORS[0];
  const selectedRoom = floor.rooms.find((r) => r.id === selectedId) || null;
  const zoomId = zoomLevels.find((z) => Math.abs(z.scale - scale) < 0.05)?.id;

  const route = useMemo(
    () => (dirOpen && dirFrom && dirTo ? findRoute(dirFrom, dirTo, prefer) : null),
    [dirOpen, dirFrom, dirTo, prefer],
  );
  const segIndex = route ? route.segments.findIndex((s) => s.floorId === floorId) : -1;
  const floorRoute = segIndex >= 0 ? {
    points: route.segments[segIndex].points,
    isStart: segIndex === 0,
    isEnd: segIndex === route.segments.length - 1,
  } : null;

  const changeFloor = (id) => { setFloorId(id); setSelectedId(null); };

  // Focus a room / fit a route once its floor has rendered.
  useEffect(() => {
    if (!pendingFocus || pendingFocus.floorId !== floorId || view !== '2d') return undefined;
    const t = setTimeout(() => {
      if (pendingFocus.points) mapRef.current?.fitPoints(pendingFocus.points);
      else mapRef.current?.focusRoom(pendingFocus.id);
      setPendingFocus(null);
    }, 60);
    return () => clearTimeout(t);
  }, [pendingFocus, floorId, view]);

  const showSegment = useCallback((r, fid) => {
    const seg = r.segments.find((s) => s.floorId === fid) || r.segments[0];
    setFloorId(seg.floorId);
    setSelectedId(null);
    setPendingFocus({ floorId: seg.floorId, points: seg.points, n: Date.now() });
  }, []);

  // A new route opens on its starting floor, framed to fit.
  const [shownRoute, setShownRoute] = useState(null);
  if (route !== shownRoute) {
    setShownRoute(route);
    if (route) showSegment(route, route.segments[0].floorId);
  }

  const handlePick = (room) => {
    setFloorId(room.floorId);
    setSelectedId(room.id);
    setPendingFocus({ id: room.id, floorId: room.floorId, n: Date.now() });
  };

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    if (id) mapRef.current?.focusRoom(id);
  }, []);

  const handleSelect3D = useCallback((fid, id) => {
    if (fid !== floorId) setFloorId(fid);
    setSelectedId(id);
  }, [floorId]);

  const openDirections = (role) => {
    const place = selectedRoom ? { floorId: floor.id, id: selectedRoom.id, name: selectedRoom.name } : null;
    if (role === 'to') setDirTo(place); else setDirFrom(place);
    setDirOpen(true);
    setSelectedId(null);
  };

  const closeDirections = () => { setDirOpen(false); setDirFrom(null); setDirTo(null); };

  const toggleFullscreen = useCallback(async () => {
    const el = viewportRef.current;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const toPlace = (room) => ({ floorId: room.floorId, id: room.id, name: room.name });

  return (
    <div className="interactive-map-root interactive-map-root-plan">
      <div ref={widgetRef} className="glass-card-static schedule-widget sv-widget floor-map-widget animate-fadeInUp">
        <header className="dl-head has-actions fm-head">
          <div className="dl-head-title">
            <div className="dl-head-tile" aria-hidden="true">
              <Compass size={20} strokeWidth={2.2} />
            </div>
            <div className="dl-head-text">
              <span className="dl-head-overline">Inside AUST</span>
              <h2 className="dl-head-name">Floor Map</h2>
              <span className="dl-head-subtitle">AUST {floor.id.toLowerCase()} floor</span>
            </div>
          </div>
          <dl className="dl-head-stats">
            <div className="dl-head-stat">
              <dt>Rooms</dt>
              <dd>{floor.rooms.length}</dd>
            </div>
            <div className="dl-head-stat">
              <dt>{view === '3d' ? 'View' : 'Zoom'}</dt>
              <dd className="is-small">{view === '3d' ? '3D' : `${Math.round(scale * 100)}%`}</dd>
            </div>
          </dl>

          <div className="dl-head-actions">
            <div className="export-dropdown" ref={menuRef}>
              <button
                className="dl-head-menu-btn"
                onClick={() => setMenuOpen((o) => !o)}
                title="Options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="export-menu" role="menu">
                  {view === '2d' && zoomLevels.map((level) => (
                    <button
                      key={level.id}
                      className={`export-menu-item${zoomId === level.id ? ' menu-active' : ''}`}
                      onClick={() => {
                        setMenuOpen(false);
                        if (level.scale === 1) mapRef.current?.reset();
                        else mapRef.current?.zoomTo(level.scale);
                      }}
                      role="menuitem"
                    >
                      <ZoomIn size={14} /> Zoom {level.label}
                      {zoomId === level.id && <Check size={14} className="menu-check" />}
                    </button>
                  ))}
                  <button
                    className="export-menu-item"
                    onClick={() => { toggleFullscreen(); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="floor-selector-box">
          <GliderTabs tabs={narrow ? FLOOR_TABS_SHORT : FLOOR_TABS} activeTab={floorId} onChange={changeFloor} variant="dashboard" compact />
        </div>

        {dirOpen ? (
          <DirectionsPanel
            from={dirFrom}
            to={dirTo}
            prefer={prefer}
            route={route}
            activeFloorId={floorId}
            compact={narrow}
            onFrom={(room) => setDirFrom(toPlace(room))}
            onTo={(room) => setDirTo(toPlace(room))}
            onSwap={() => { setDirFrom(dirTo); setDirTo(dirFrom); }}
            onPrefer={setPrefer}
            onStep={(fid) => route && showSegment(route, fid)}
            onClose={closeDirections}
          />
        ) : (
          <div className="fp-searchrow">
            <RoomSearch label="Search rooms" placeholder={narrow ? 'Find a room or place' : 'Find a room — 5B03, Library, Canteen…'} onPick={handlePick} />
            <button type="button" className="fp-btn is-primary fp-dir-open" onClick={() => setDirOpen(true)}>
              <Navigation size={15} /> <span>Directions</span>
            </button>
          </div>
        )}

        <div ref={viewportRef} className={`fp-viewport${scale > 1.01 && view === '2d' ? ' is-zoomed' : ''}${view === '3d' ? ' is-3d' : ''}${narrow ? ' is-portrait' : ''}`}>
          {view === '2d' ? (
            <FloorPlanSvg
              ref={mapRef}
              floor={floor}
              selectedId={selectedId}
              onSelect={handleSelect}
              getStatus={getStatus}
              route={floorRoute}
              portrait={narrow}
              onScaleChange={setScale}
              wheelAlwaysZooms={isFullscreen}
            />
          ) : (
            <Suspense fallback={<div className="fp-3d-loading">Loading 3D view…</div>}>
              <FloorPlan3D
                key={narrow ? 'portrait' : 'landscape'}
                activeFloorId={floorId}
                selectedId={selectedId}
                route={route}
                onSelect={handleSelect3D}
                portrait={narrow}
              />
            </Suspense>
          )}
          <span className={`fp-north${narrow ? ' is-portrait' : ''}`} aria-label={narrow ? 'North is to the right' : 'North is up'} role="img">
            <ArrowUp size={12} strokeWidth={2.6} /> N
          </span>
        </div>

        <div className="fp-toolbar">
          <div className="fp-viewswitch" role="radiogroup" aria-label="Map view">
            <button type="button" role="radio" aria-checked={view === '2d'} className={view === '2d' ? 'is-active' : ''} onClick={() => setView('2d')}>
              <MapIcon size={14} /> 2D
            </button>
            <button type="button" role="radio" aria-checked={view === '3d'} className={view === '3d' ? 'is-active' : ''} onClick={() => setView('3d')}>
              <Box size={14} /> 3D
            </button>
          </div>
          <div className="fp-legend" aria-hidden="true">
            {view === '2d' ? (
              <>
                <span><i className="fp-status-dot-key is-free" /> Free</span>
                <span><i className="fp-status-dot-key is-busy" /> Busy</span>
                <span className="fp-hint">
                  {scale > 1.01 ? 'Drag to move · pinch or Ctrl + scroll to zoom' : 'Tap a room · pinch or Ctrl + scroll to zoom'}
                </span>
              </>
            ) : (
              <span className="fp-hint is-visible">
                {narrow ? 'Drag to turn · pinch to zoom' : 'Drag to turn · scroll or pinch to zoom · floors above the selected one are hidden'}
              </span>
            )}
          </div>
          {view === '2d' && (
            <div className="fp-zoom-btns">
              <button type="button" className="floor-plan-zoom-fab" aria-label="Zoom out" disabled={scale <= MIN_SCALE + 0.01}
                onClick={() => mapRef.current?.zoomBy(1 / 1.5)}>
                <Minus size={18} />
              </button>
              <button type="button" className="floor-plan-zoom-fab" aria-label="Reset zoom" disabled={scale <= MIN_SCALE + 0.01}
                onClick={() => mapRef.current?.reset()}>
                <RotateCcw size={16} />
              </button>
              <button type="button" className="floor-plan-zoom-fab" aria-label="Zoom in" disabled={scale >= MAX_SCALE - 0.01}
                onClick={() => mapRef.current?.zoomBy(1.5)}>
                <Plus size={18} />
              </button>
            </div>
          )}
        </div>

        <RoomSheet
          room={selectedRoom}
          floor={floor}
          status={selectedRoom ? getStatus(selectedRoom.id) : null}
          onClose={() => setSelectedId(null)}
          onDirections={openDirections}
        />
      </div>
    </div>
  );
}
