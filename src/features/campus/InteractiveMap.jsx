import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn, Maximize2, Minimize2,
  Compass, MoreVertical, Check, Plus, Minus, RotateCcw,
} from 'lucide-react';
import { campusFloors as staticCampusFloors } from '../../data/mockData';
import GliderTabs from '../../components/GliderTabs';
import './SemesterViewWidget.css';

// Attempt to fetch campus locations from API — falls back to static data
let _campusApiPromise = null;
function fetchCampusLocations() {
  if (_campusApiPromise) return _campusApiPromise;
  _campusApiPromise = fetch('/api/campus-locations')
    .then(r => r.json())
    .then(data => (data.success && Array.isArray(data.floors) ? data.floors : null))
    .catch(() => null);
  return _campusApiPromise;
}

const zoomLevels = [
  { id: 'fit', label: 'Fit', scale: 1 },
  { id: '1.5', label: '1.5×', scale: 1.5 },
  { id: '2', label: '2×', scale: 2 },
  { id: '3', label: '3×', scale: 3 },
  { id: '4', label: '4×', scale: 4 },
];
const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Basic plan shown for floors without their own image (2nd–8th).
const GROUND_FLOOR_IMAGE = '/campus/ground-floor.png';

const RESIZE_DIRECTIONS = {
  nw: { dl: 1, dt: 1, dw: -1, dh: -1 },
  se: { dl: 0, dt: 0, dw: 1, dh: 1 },
  sw: { dl: 1, dt: 0, dw: -1, dh: 1 },
  ne: { dl: 0, dt: 1, dw: 1, dh: -1 },
};

const getRoomHotspots = (room) => room.hotspots || (room.hotspot ? [room.hotspot] : []);
const getHotspotKey = (room, index) => `${room.id}-${index}`;

/* Room-type hotspots all share the single primary accent so the map stays
   consistent, not a rotating palette. Semantic colors (emerald/rose) are
   reserved for status, not room categories. */
const getRoomColor = (_type) => 'var(--accent-blue)';

function FloorShowcase({ floorData, selectedFloor, floorTabs, onFloorChange }) {
  const [zoom, setZoom] = useState('fit');
  const [scale, setScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedHotspotKey, setSelectedHotspotKey] = useState(null);
  const [editMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [positions, setPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('aust-campus-positions');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [rotations, setRotations] = useState(() => {
    try {
      const saved = localStorage.getItem('aust-campus-rotations');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const viewportRef = useRef(null);
  const hotspotRefs = useRef({});
  const imageWrapRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 100) / 100));

  const applyScaleAtPoint = useCallback((nextScale, focal) => {
    const vp = viewportRef.current;
    const prev = scaleRef.current;
    const next = clampScale(nextScale);
    if (next === prev) return;
    const ratio = next / prev;
    if (vp && focal) {
      const rect = vp.getBoundingClientRect();
      const fx = focal.x - rect.left + vp.scrollLeft;
      const fy = focal.y - rect.top + vp.scrollTop;
      vp.scrollLeft = fx * ratio - (focal.x - rect.left);
      vp.scrollTop = fy * ratio - (focal.y - rect.top);
    }
    setScale(next);
    setZoom(next === 1 ? 'fit' : String(next));
  }, []);

  const fitZoom = useCallback(() => {
    const vp = viewportRef.current;
    setScale(1);
    setZoom('fit');
    // scroll reset happens on next frame after width shrinks
    requestAnimationFrame(() => {
      if (vp) { vp.scrollLeft = 0; vp.scrollTop = 0; }
    });
  }, []);

  const onPinchPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        scale: scaleRef.current,
      };
      setIsPinching(true);
    }
  };

  const onPinchPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size !== 2 || !pinchRef.current) return;
    e.preventDefault();
    const [a, b] = [...pointersRef.current.values()];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (pinchRef.current.dist > 0) {
      applyScaleAtPoint(pinchRef.current.scale * (dist / pinchRef.current.dist), mid);
    }
    pinchRef.current.dist = dist;
    pinchRef.current.mid = mid;
    pinchRef.current.scale = scaleRef.current;
  };

  const onPinchPointerEnd = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
      setIsPinching(false);
    }
  };

  const onWheelZoom = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    applyScaleAtPoint(scaleRef.current * (e.deltaY < 0 ? 1.1 : 0.9), { x: e.clientX, y: e.clientY });
  };

  const onDoubleTapZoom = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    if (scaleRef.current > 1) fitZoom();
    else applyScaleAtPoint(2, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  // Sync menu choice → scale (menu sets zoom string)
  const handleZoomSelect = (level) => {
    setZoom(level.id);
    setMenuOpen(false);
    const vp = viewportRef.current;
    if (level.scale === 1) {
      fitZoom();
    } else if (vp) {
      const rect = vp.getBoundingClientRect();
      applyScaleAtPoint(level.scale, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setScale(level.scale);
    }
  };

  useEffect(() => {
    localStorage.setItem('aust-campus-positions', JSON.stringify(positions));
    localStorage.setItem('aust-campus-rotations', JSON.stringify(rotations));
  }, [positions, rotations]);

  const toggleFullscreen = useCallback(async () => {
    const el = viewportRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Close ⋮ menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const clearSelection = useCallback(() => {
    setSelectedRoomId(null);
    setSelectedHotspotKey(null);
  }, []);

  const handleHotspotPointerDown = (e, room, hotspot, hotspotKey) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedRoomId(room.id);
    setSelectedHotspotKey(hotspotKey);

    const hotspotEl = hotspotRefs.current[hotspotKey];
    const imageWrap = imageWrapRef.current;
    if (!hotspotEl || !imageWrap) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const currentPos = positions[hotspotKey] || hotspot;
    const startLeft = currentPos.left;
    const startTop = currentPos.top;
    const wrapRect = imageWrap.getBoundingClientRect();

    const handlePointerMove = (moveEvent) => {
      const deltaXPercent = ((moveEvent.clientX - startX) / wrapRect.width) * 100;
      const deltaYPercent = ((moveEvent.clientY - startY) / wrapRect.height) * 100;

      setPositions((prev) => ({
        ...prev,
        [hotspotKey]: {
          ...(prev[hotspotKey] || hotspot),
          left: Math.round(Math.max(0, Math.min(100 - currentPos.width, startLeft + deltaXPercent)) * 10) / 10,
          top: Math.round(Math.max(0, Math.min(100 - currentPos.height, startTop + deltaYPercent)) * 10) / 10,
        },
      }));
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizeStart = (e, room, hotspot, hotspotKey, corner) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedRoomId(room.id);
    setSelectedHotspotKey(hotspotKey);

    const imageWrap = imageWrapRef.current;
    if (!imageWrap) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const currentPos = positions[hotspotKey] || hotspot;
    const startLeft = currentPos.left;
    const startTop = currentPos.top;
    const startWidth = currentPos.width;
    const startHeight = currentPos.height;
    const wrapRect = imageWrap.getBoundingClientRect();
    const dir = RESIZE_DIRECTIONS[corner];

    const handlePointerMove = (moveEvent) => {
      const deltaXPercent = ((moveEvent.clientX - startX) / wrapRect.width) * 100;
      const deltaYPercent = ((moveEvent.clientY - startY) / wrapRect.height) * 100;

      const newLeft = Math.round(Math.max(0, startLeft + dir.dl * deltaXPercent) * 10) / 10;
      const newTop = Math.round(Math.max(0, startTop + dir.dt * deltaYPercent) * 10) / 10;
      const newWidth = Math.round(Math.max(4, startWidth + dir.dw * deltaXPercent) * 10) / 10;
      const newHeight = Math.round(Math.max(4, startHeight + dir.dh * deltaYPercent) * 10) / 10;

      setPositions((prev) => ({
        ...prev,
        [hotspotKey]: {
          ...(prev[hotspotKey] || hotspot),
          left: newLeft,
          top: newTop,
          width: Math.min(newWidth, 100 - newLeft),
          height: Math.min(newHeight, 100 - newTop),
        },
      }));
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleRotateStart = (e, room, hotspot, hotspotKey) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedRoomId(room.id);
    setSelectedHotspotKey(hotspotKey);

    const imageWrap = imageWrapRef.current;
    if (!imageWrap) return;

    const currentPos = positions[hotspotKey] || hotspot;
    const currentRotation = rotations[hotspotKey] || 0;
    const wrapRect = imageWrap.getBoundingClientRect();

    const getAngle = (clientX, clientY) => {
      const centerX = wrapRect.left + ((currentPos.left + currentPos.width / 2) / 100) * wrapRect.width;
      const centerY = wrapRect.top + ((currentPos.top + currentPos.height / 2) / 100) * wrapRect.height;
      return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI + 90;
    };

    const startMouseAngle = getAngle(e.clientX, e.clientY);

    const handlePointerMove = (moveEvent) => {
      const currentMouseAngle = getAngle(moveEvent.clientX, moveEvent.clientY);
      const deltaAngle = currentMouseAngle - startMouseAngle;
      const newRotation = Math.round((currentRotation + deltaAngle) * 10) / 10;
      setRotations((prev) => ({
        ...prev,
        [hotspotKey]: newRotation,
      }));
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="glass-card-static schedule-widget sv-widget floor-map-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Compass size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Inside AUST</span>
            <div className="schedule-title">Floor Map</div>
            <span className="schedule-subtitle">
              AUST {selectedFloor.toLowerCase()} floor
            </span>
          </div>
        </div>

        <div className="schedule-actions">
          <div className="export-dropdown" ref={menuRef}>
            <button
              className="schedule-nav-btn"
              onClick={() => setMenuOpen((o) => !o)}
              title="Options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="export-menu" role="menu">
                {zoomLevels.map(level => (
                  <button
                    key={level.id}
                    className={`export-menu-item${zoom === level.id ? ' menu-active' : ''}`}
                    onClick={() => handleZoomSelect(level)}
                    role="menuitem"
                  >
                    <ZoomIn size={14} /> Zoom {level.label}
                    {zoom === level.id && <Check size={14} className="menu-check" />}
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
      </div>

      <div className="schedule-dotted-divider" />

      {/* ── Floor selector (boxed below the header divider) ── */}
      <div className="floor-selector-box">
        <GliderTabs
          tabs={floorTabs}
          activeTab={selectedFloor}
          onChange={onFloorChange}
          variant="dashboard"
          compact
        />
      </div>

      <div className="floor-plan-workspace">
        <div className="floor-plan-main">

          <div
            ref={viewportRef}
            className={`floor-plan-viewport floor-plan-zoom-${zoom}${scale > 1 ? ' is-zoomed' : ''}${isPinching ? ' is-pinching' : ''}`}
            onWheel={onWheelZoom}
            onDoubleClick={onDoubleTapZoom}
            aria-label={`Floor map — pinch to zoom (${Math.round(scale * 100)}%)`}
          >
            <div
              className="floor-plan-image-frame"
              style={{
                width: `${scale * 100}%`,
                minWidth: scale > 1 ? `${scale * 100}%` : undefined,
                margin: '0 auto',
                transition: isPinching ? 'none' : 'width .35s cubic-bezier(.4,0,.2,1)',
              }}
            >
              <div
                ref={imageWrapRef}
                className="floor-plan-image-wrap"
                onClick={clearSelection}
                onKeyDown={(e) => { if (e.key === 'Escape') clearSelection(); }}
                onPointerDown={onPinchPointerDown}
                onPointerMove={onPinchPointerMove}
                onPointerUp={onPinchPointerEnd}
                onPointerCancel={onPinchPointerEnd}
                onLostPointerCapture={onPinchPointerEnd}
                role="presentation"
              >
                {(floorData.mapImage || GROUND_FLOOR_IMAGE) ? (
                  <img
                    src={floorData.mapImage || GROUND_FLOOR_IMAGE}
                    alt={`AUST ${selectedFloor} Floor Plan`}
                    className="floor-plan-image"
                    draggable={false}
                  />
                ) : (
                  <div className="floor-plan-no-image-fallback">
                    <svg style={{ width: '100%', height: '420px' }}>
                      <rect x="10%" y="20%" width="80%" height="60%" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="4 4" rx="8" />
                      <rect x="25%" y="40%" width="50%" height="20%" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      {floorData.rooms.map((room) => (
                        <g key={room.id} style={{ cursor: 'pointer' }}>
                          <circle cx={`${room.x}%`} cy={`${room.y}%`} r="14" fill={getRoomColor(room.type)} opacity="0.18" />
                          <circle cx={`${room.x}%`} cy={`${room.y}%`} r="7" fill={getRoomColor(room.type)} />
                          <text x={`${room.x}%`} y={`${room.y - 3.5}%`} textAnchor="middle" fill="var(--text-primary)" fontSize="11px" fontWeight="bold">
                            {room.id}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                )}
                {floorData.rooms
                  .filter((room) => getRoomHotspots(room).length > 0)
                  .flatMap((room) => getRoomHotspots(room).map((hotspot, index) => {
                    const isSelected = selectedRoomId === room.id;
                    const hotspotKey = getHotspotKey(room, index);
                    const isEditing = editMode && isSelected && selectedHotspotKey === hotspotKey;
                    const pos = positions[hotspotKey] || hotspot;
                    const rotation = rotations[hotspotKey] || 0;

                    return (
                      <div
                        key={hotspotKey}
                        ref={(el) => { hotspotRefs.current[hotspotKey] = el; }}
                        className={`floor-plan-hotspot ${isSelected ? 'active' : ''} ${isEditing ? 'edit-active' : ''}`}
                        style={{
                          left: `${pos.left}%`,
                          top: `${pos.top}%`,
                          width: `${pos.width}%`,
                          height: `${pos.height}%`,
                          transform: `rotate(${rotation}deg)`,
                          transformOrigin: 'center center',
                        }}
                        onPointerDown={(e) => handleHotspotPointerDown(e, room, hotspot, hotspotKey)}
                        aria-hidden={!isSelected}
                      >
                        <span
                          className={`floor-plan-hotspot-inner floor-plan-hotspot-${room.type} ${isSelected ? 'active' : ''}`}
                        />
                        {isSelected && index === 0 && (
                          <span className="floor-plan-hotspot-label">{room.name}</span>
                        )}
                        {isEditing && (
                          <>
                            <span
                              className="floor-plan-resize-handle floor-plan-resize-nw"
                              onPointerDown={(e) => handleResizeStart(e, room, hotspot, hotspotKey, 'nw')}
                            />
                            <span
                              className="floor-plan-resize-handle floor-plan-resize-se"
                              onPointerDown={(e) => handleResizeStart(e, room, hotspot, hotspotKey, 'se')}
                            />
                            <span
                              className="floor-plan-resize-handle floor-plan-resize-sw"
                              onPointerDown={(e) => handleResizeStart(e, room, hotspot, hotspotKey, 'sw')}
                            />
                            <span
                              className="floor-plan-resize-handle floor-plan-resize-ne"
                              onPointerDown={(e) => handleResizeStart(e, room, hotspot, hotspotKey, 'ne')}
                            />
                            <span
                              className="floor-plan-rotate-handle"
                              onPointerDown={(e) => handleRotateStart(e, room, hotspot, hotspotKey)}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" className="floor-plan-rotate-icon">
                                <path d="M5 1a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" fill="currentColor" opacity="0.35" />
                                <path d="M5 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="currentColor" opacity="0.7" />
                                <circle cx="5" cy="5" r="1.2" fill="currentColor" />
                              </svg>
                            </span>
                          </>
                        )}
                      </div>
                    );
                  }                ))}
              </div>
            </div>

            {/* Pinch hint + zoom controls */}
            <div className="floor-plan-zoom-hud">
              <span className="floor-plan-zoom-hint">
                {isPinching ? `${Math.round(scale * 100)}%` : scale > 1 ? `${Math.round(scale * 100)}% · pinch to zoom` : 'Pinch to zoom'}
              </span>
              <div className="floor-plan-zoom-btns">
                <button type="button" className="floor-plan-zoom-fab" aria-label="Zoom out" disabled={scale <= MIN_SCALE}
                  onClick={(e) => { e.stopPropagation(); const vp = viewportRef.current; const rect = vp?.getBoundingClientRect(); if (vp && rect) applyScaleAtPoint(scaleRef.current - 0.5, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); }}>
                  <Minus size={18} />
                </button>
                <button type="button" className="floor-plan-zoom-fab" aria-label="Reset zoom" disabled={scale === 1}
                  onClick={(e) => { e.stopPropagation(); fitZoom(); }}>
                  <RotateCcw size={16} />
                </button>
                <button type="button" className="floor-plan-zoom-fab" aria-label="Zoom in" disabled={scale >= MAX_SCALE}
                  onClick={(e) => { e.stopPropagation(); const vp = viewportRef.current; const rect = vp?.getBoundingClientRect(); if (vp && rect) applyScaleAtPoint(scaleRef.current + 0.5, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); }}>
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InteractiveMap() {
  const [selectedFloor, setSelectedFloor] = useState('Ground');
  const [campusFloors, setCampusFloors] = useState(null);

  useEffect(() => {
    fetchCampusLocations().then((data) => {
      if (data && data.length > 0) setCampusFloors(data);
    });
  }, []);

  const allFloors = campusFloors || staticCampusFloors;
  const floorTabs = allFloors.map((f) => ({
    id: f.floor,
    label: f.floor,
    icon: null,
    desc: '',
  }));
  const currentFloorData = allFloors.find((f) => f.floor === selectedFloor) || allFloors[0];

  return (
    <div className="interactive-map-root interactive-map-root-plan">
      <FloorShowcase
        floorData={currentFloorData}
        selectedFloor={selectedFloor}
        floorTabs={floorTabs}
        onFloorChange={setSelectedFloor}
      />
    </div>
  );
}
