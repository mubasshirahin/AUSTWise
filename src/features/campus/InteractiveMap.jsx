import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn, Maximize2, Minimize2,
  MapPin, Compass, Move, RotateCcw, MoreVertical, Check,
} from 'lucide-react';
import { campusFloors as staticCampusFloors } from '../../data/mockData';
import GliderTabs from '../../components/GliderTabs';
import FirstFloorInteractivePlan from './FirstFloorInteractivePlan';
import BuildingStructure from './BuildingStructure';
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

const floorTabs = (staticCampusFloors).map((f) => ({
  id: f.floor,
  label: f.floor,
  icon: null,
  desc: '',
}));

const zoomLevels = [
  { id: 'fit', label: 'Fit' },
  { id: '100', label: '100%' },
  { id: '125', label: '125%' },
  { id: '150', label: '150%' },
];

const roomTypeLabels = {
  admin: 'Administration',
  hall: 'Auditorium / Hall',
  facility: 'Facility',
  library: 'Library',
  classroom: 'Classroom',
  lab: 'Laboratory',
  lift: 'Lift',
  washroom: 'Washroom',
};

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
const getRoomColor = (type) => 'var(--accent-blue)';

function FloorShowcase({ floorData, selectedFloor }) {
  const [zoom, setZoom] = useState('fit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedHotspotKey, setSelectedHotspotKey] = useState(null);
  const [floorView, setFloorView] = useState('image');
  const [editMode, setEditMode] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
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
    setSelectedZone(null);
  }, []);

  const handleLocationClick = useCallback((room) => {
    setSelectedRoomId((prev) => {
      const next = prev === room.id ? null : room.id;
      setSelectedHotspotKey(next ? getHotspotKey(room, 0) : null);
      if (next) {
        requestAnimationFrame(() => {
          const hotspotEl = hotspotRefs.current[getHotspotKey(room, 0)];
          if (hotspotEl && viewportRef.current) {
            hotspotEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }
        });
      }
      return next;
    });
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

  const updatePosition = (hotspotKey, hotspot, field, value) => {
    setPositions((prev) => {
      return {
        ...prev,
        [hotspotKey]: { ...(prev[hotspotKey] || hotspot), [field]: parseFloat(value) || 0 },
      };
    });
  };

  const updateRotation = (hotspotKey, value) => {
    setRotations((prev) => ({
      ...prev,
      [hotspotKey]: parseFloat(value) || 0,
    }));
  };

  const resetPositions = () => {
    setPositions({});
    setRotations({});
    localStorage.removeItem('aust-campus-positions');
    localStorage.removeItem('aust-campus-rotations');
  };

  const editingRoom = floorData.rooms.find((r) => r.id === selectedRoomId);
  const editingHotspotIndex = editingRoom && selectedHotspotKey
    ? Number(selectedHotspotKey.split('-').at(-1))
    : 0;
  const editingHotspot = editingRoom ? getRoomHotspots(editingRoom)[editingHotspotIndex] : null;
  const editingPos = editingHotspot && selectedHotspotKey ? (positions[selectedHotspotKey] || editingHotspot) : null;
  const editingRotation = selectedHotspotKey ? (rotations[selectedHotspotKey] || 0) : 0;
  const isInteractiveView = floorView === 'interactive';
  const isInteractiveFloor = floorView === 'interactive';

  /** Generate SVG text labels for floors 2-8 which reuse the same building structure */
  function renderOtherFloorLabels(floor, floorData) {
    const rooms = floorData.rooms;
    const classroomRooms = rooms.filter((r) => r.type === 'classroom');
    const labRooms = rooms.filter((r) => r.type === 'lab');
    const adminRooms = rooms.filter((r) => r.type === 'admin');
    const otherRooms = rooms.filter((r) => r.type !== 'classroom' && r.type !== 'lab' && r.type !== 'admin' && r.type !== 'lift' && r.type !== 'washroom');
    const washroom = rooms.find((r) => r.type === 'washroom');

    // Distribute classroom/lab rooms across positions in the Classroom Block zone
    const roomList = [...classroomRooms, ...labRooms];
    const classPositions = [674, 754, 834, 915, 995];

    return (
      <>
        {/* Zone name labels — same physical zones but generic names */}
        <text className="ground-room-label" x="365" y="228">Prayer &</text>
        <text className="ground-room-label" x="365" y="252">Medical</text>
        <text className="ground-zone-title ground-zone-title-small" x="352" y="366">Plaza</text>
        <text className="ground-zone-title" x="640" y="372">Badamtola</text>
        <text className="ground-room-label" x="1132" y="392" textAnchor="middle" style={{ fontSize: '35px', fontWeight: 'bold' }}>Library</text>

        {/* Classroom / Lab rooms in the Classroom Block zone */}
        {roomList.map((room, i) =>
          i < classPositions.length ? (
            <text key={room.id} className="ground-cell-label" x={classPositions[i]} y="168" textAnchor="middle">
              {room.id}
            </text>
          ) : null
        )}

        {/* Admin / Faculty rooms in the Admin zone */}
        {adminRooms.map((room, i) => (
          <text key={room.id} className="ground-small-label" x={280} y={540 + i * 28} style={{ fontSize: '16px', fontWeight: 'bold' }}>
            {room.name}
          </text>
        ))}

        {/* Other rooms (hall, facility) in the badamtola zone */}
        {otherRooms.map((room, i) => (
          <text key={room.id} className="ground-small-label" x={640} y={500 + i * 30} textAnchor="middle" style={{ fontSize: '16px', fontWeight: 'bold' }}>
            {room.name}
          </text>
        ))}

        {/* Washroom */}
        {washroom && (
          <>
            <text className="ground-tiny-label" x="1215" y="155" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 'bold' }}>Wash</text>
            <text className="ground-tiny-label" x="1215" y="170" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 'bold' }}>room</text>
          </>
        )}
      </>
    );
  }

  return (
    <div className="glass-card-static schedule-widget sv-widget floor-map-widget animate-fadeInUp">

      {/* ── Masthead ── */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Compass size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Campus</span>
            <div className="schedule-title">{selectedFloor} Floor Plan</div>
            <span className="schedule-subtitle">
              AUST {selectedFloor.toLowerCase()} floor · click Key Locations to highlight areas
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{floorData.rooms.length}</span>
              <span className="schedule-stat-label">Rooms</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">
                {floorData.rooms.filter(r => r.type === 'classroom' || r.type === 'lab').length}
              </span>
              <span className="schedule-stat-label">Classes / Labs</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value" style={{ textTransform: 'capitalize' }}>{floorView}</span>
              <span className="schedule-stat-label">View</span>
            </div>
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
                <button
                  className={`export-menu-item${floorView === 'image' ? ' menu-active' : ''}`}
                  onClick={() => { setFloorView('image'); setSelectedZone(null); setMenuOpen(false); }}
                  role="menuitem"
                >
                  Image View
                  {floorView === 'image' && <Check size={14} className="menu-check" />}
                </button>
                <button
                  className={`export-menu-item${floorView === 'interactive' ? ' menu-active' : ''}`}
                  onClick={() => { setFloorView('interactive'); clearSelection(); setMenuOpen(false); }}
                  role="menuitem"
                >
                  Interactive View
                  {floorView === 'interactive' && <Check size={14} className="menu-check" />}
                </button>
                <div className="export-menu-sep" />
                {zoomLevels.map(level => (
                  <button
                    key={level.id}
                    className={`export-menu-item${zoom === level.id ? ' menu-active' : ''}`}
                    onClick={() => { setZoom(level.id); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <ZoomIn size={14} /> Zoom {level.label}
                    {zoom === level.id && <Check size={14} className="menu-check" />}
                  </button>
                ))}
                <div className="export-menu-sep" />
                <button
                  className={`export-menu-item${editMode ? ' menu-active' : ''}`}
                  onClick={() => { setEditMode(p => !p); setMenuOpen(false); }}
                  role="menuitem"
                >
                  <Move size={14} /> {editMode ? 'Exit Edit Mode' : 'Edit Positions'}
                  {editMode && <Check size={14} className="menu-check" />}
                </button>
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

      <div className="floor-plan-workspace">
        <div className="floor-plan-main">

          <div
            ref={viewportRef}
            className={`floor-plan-viewport floor-plan-zoom-${zoom}`}
          >
            <div className="floor-plan-image-frame">
              <div
                ref={imageWrapRef}
                className="floor-plan-image-wrap"
                onClick={clearSelection}
                onKeyDown={(e) => { if (e.key === 'Escape') clearSelection(); }}
                role="presentation"
              >
                {isInteractiveFloor ? (
                  selectedFloor === '1st' ? (
                    <FirstFloorInteractivePlan
                      onZoneSelect={setSelectedZone}
                      selectedZone={selectedZone}
                    />
                  ) : (
                    <BuildingStructure
                      selectedZone={selectedZone}
                      onZoneSelect={setSelectedZone}
                      title={`AUST CAMPUS — ${selectedFloor} Floor`}
                    >
                      {renderOtherFloorLabels(selectedFloor, floorData)}
                    </BuildingStructure>
                  )
                ) : floorData.mapImage ? (
                  <img
                    src={floorData.mapImage}
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
                  }))}
              </div>
            </div>
            <p className="floor-plan-hint">
              {isInteractiveFloor && selectedZone
                ? 'Click the zone again or press Clear to reset the map'
                : selectedRoomId
                  ? 'Tap the same location again or click anywhere to clear'
                  : isInteractiveFloor
                    ? 'Click any colored zone on the map to highlight it'
                    : 'Click a Key Location to glow it on the map · Scroll or pinch to explore'}
            </p>
          </div>
        </div>

        <aside className="floor-plan-sidebar">
          <div className="floor-plan-sidebar-card">
            <h3 className="floor-plan-sidebar-title">
              <MapPin size={16} />
              Key Locations
            </h3>
            <p className="floor-plan-sidebar-desc">Tap to highlight on the map</p>
            <ul className="floor-plan-location-list">
              {floorData.rooms.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    className={`floor-plan-location-item ${selectedRoomId === room.id ? 'active' : ''}`}
                    onClick={() => handleLocationClick(room)}
                  >
                    <span className={`floor-plan-location-dot floor-plan-dot-${room.type}`} />
                    <div>
                      <span className="floor-plan-location-id">{room.id}</span>
                      <span className="floor-plan-location-name">{room.name}</span>
                      <span className="floor-plan-location-type">
                        {roomTypeLabels[room.type] || room.type}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="floor-plan-sidebar-card floor-plan-tips">
            <h3 className="floor-plan-sidebar-title">Quick Tips</h3>
            <ul className="floor-plan-tips-list">
              <li>Click same location again or anywhere to <strong>clear</strong> glow</li>
              <li>Use <strong>125%</strong> or <strong>150%</strong> to read labels clearly</li>
              <li>Tap <strong>Fullscreen</strong> for a bigger view</li>
              {editMode && (
                <li style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <strong>Edit mode:</strong> Drag box to move. Drag corners to resize. Use top handle to rotate.
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: '6px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', padding: '4px 8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                    onClick={resetPositions}
                  >
                    <RotateCcw size={12} /> Reset All Positions
                  </button>
                </li>
              )}
            </ul>
          </div>

          {editMode && editingPos && editingRoom && (
            <div className="floor-plan-sidebar-card floor-plan-editor">
              <h3 className="floor-plan-sidebar-title">
                <Move size={16} />
                Adjust: {editingRoom.name} ({selectedRoomId})
              </h3>
              <div className="floor-plan-editor-grid">
                {['left', 'top', 'width', 'height'].map((field) => (
                  <label key={field} className="floor-plan-editor-row">
                    <span className="floor-plan-editor-label">{field}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={editingPos[field]}
                      onChange={(e) => updatePosition(selectedHotspotKey, editingHotspot, field, e.target.value)}
                      className="floor-plan-editor-range"
                    />
                    <span className="floor-plan-editor-value">
                      {Math.round(editingPos[field] * 10) / 10}%
                    </span>
                  </label>
                ))}
                <label className="floor-plan-editor-row">
                  <span className="floor-plan-editor-label">rotate</span>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={editingRotation}
                    onChange={(e) => updateRotation(selectedHotspotKey, e.target.value)}
                    className="floor-plan-editor-range"
                  />
                  <span className="floor-plan-editor-value">
                    {editingRotation}deg
                  </span>
                </label>
              </div>
              <p className="floor-plan-editor-hint">
                Drag the box to move it. Drag corner handles to resize. Drag the top circle to rotate.
              </p>
            </div>
          )}
        </aside>
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
      <GliderTabs
        tabs={floorTabs}
        activeTab={selectedFloor}
        onChange={(id) => setSelectedFloor(id)}
        variant="dashboard"
      />

      <FloorShowcase floorData={currentFloorData} selectedFloor={selectedFloor} />
    </div>
  );
}
