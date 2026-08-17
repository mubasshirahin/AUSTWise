import { useState, useCallback } from 'react';

const buildingZones = [
  {
    id: 'plaza',
    name: 'Plaza',
    description: 'Central open courtyard — main gathering area',
    points: '543,260 324,274 310,417 514,444 530,308 540,303',
    fill: '#e2b95c',
    stroke: '#c99a3a',
    labelX: 352,
    labelY: 366,
    labelClass: 'ground-zone-title ground-zone-title-small',
  },
  {
    id: 'admin',
    name: 'Proctor & Information',
    description: 'Administrative offices, student services & information desk',
    points: '106,547 283,570 286,592 341,600 349,613 475,626 506,595 516,451 272,420 261,432 228,436',
    fill: '#cf8666',
    stroke: '#ad6448',
    labelX: 300,
    labelY: 540,
    labelClass: 'ground-small-label',
  },
  {
    id: 'badamtola',
    name: 'Badamtola Hall',
    description: 'Multi-purpose hall — events, gatherings & architecture showcase',
    points: '520,454 515,584 588,593 593,654 1008,704 1032,720 1199,738 1215,565 1020,557 778,525 744,470 713,447 582,418 553,428 547,453',
    fill: '#f0e691',
    stroke: '#d0c15f',
    labelX: 640,
    labelY: 372,
    labelClass: 'ground-zone-title',
  },
  {
    id: 'library',
    name: 'Library',
    description: 'University library — study spaces & book collections',
    points: '1040,220 1027,552 1216,562 1241,228',
    fill: '#c6d8bd',
    stroke: '#a3bd97',
    labelX: 1132,
    labelY: 392,
    labelClass: 'ground-room-label',
  },
  {
    id: 'classrooms',
    name: 'Classroom Block',
    description: 'Rooms, lecture halls & teaching spaces',
    points: '633,135 1086,107 1127,105 1190,101 1246,161 1244,223 633,224',
    fill: '#b9e2da',
    stroke: '#8fc7bc',
    labelX: 940,
    labelY: 170,
    labelClass: 'ground-cell-label',
  },
  {
    id: 'prayer-medical',
    name: 'Prayer & Medical',
    description: 'Prayer room, medical center & student wellness facilities',
    points: '626,128 226,153 212,202 249,199 320,269 628,250',
    fill: '#d9c2dd',
    stroke: '#b998c0',
    labelX: 365,
    labelY: 200,
    labelClass: 'ground-room-label',
  },
];

export default function BuildingStructure({
  selectedZone,
  onZoneSelect,
  title = 'AUST CAMPUS',
  children,
}) {
  const [hoveredZone, setHoveredZone] = useState(null);

  const handleZoneClick = useCallback((zone) => {
    const next = selectedZone === zone.id ? null : zone.id;
    onZoneSelect?.(next ? zone : null);
  }, [selectedZone, onZoneSelect]);

  const shouldDim = (zoneId) => selectedZone !== null && selectedZone !== zoneId;

  return (
    <div className="ground-interactive-card">
      <div className="ground-interactive-header">
        <div>
          <div className="ground-interactive-eyebrow">Interactive Campus Plan</div>
          <h3>{title}</h3>
        </div>
        <div className="ground-interactive-legend">
          <span>
            <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
              <rect x="0.5" y="0.5" width="25" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <line x1="4.7" y1="0.5" x2="4.7" y2="13.5" stroke="currentColor" strokeWidth="1" />
              <line x1="8.9" y1="0.5" x2="8.9" y2="13.5" stroke="currentColor" strokeWidth="1" />
              <line x1="13.1" y1="0.5" x2="13.1" y2="13.5" stroke="currentColor" strokeWidth="1" />
              <line x1="17.3" y1="0.5" x2="17.3" y2="13.5" stroke="currentColor" strokeWidth="1" />
              <line x1="21.5" y1="0.5" x2="21.5" y2="13.5" stroke="currentColor" strokeWidth="1" />
            </svg>
            Stairs
          </span>
          {selectedZone && (
            <button
              type="button"
              className="ground-clear-btn"
              onClick={() => onZoneSelect?.(null)}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="ground-interactive-map-frame">
        <svg className="ground-interactive-svg" viewBox="0 0 1379 768" xmlns="http://www.w3.org/2000/svg" aria-label="AUST building interactive plan">
          <defs>
            <filter id="groundZoneShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#2b2110" floodOpacity="0.22" />
            </filter>
            <linearGradient id="groundSheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="zoneGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur2" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="28" result="blur3" />
              <feMerge>
                <feMergeNode in="blur3" />
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="zoneHoverGlow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#2b2110" floodOpacity="0.18" />
            </filter>
            <g id="groundStairs">
              <rect x="0" y="0" width="62" height="24" rx="2" fill="none" stroke="#241d10" strokeWidth="1.4" />
              <line x1="8" y1="1" x2="8" y2="23" stroke="#241d10" strokeWidth="1.2" />
              <line x1="16.6" y1="1" x2="16.6" y2="23" stroke="#241d10" strokeWidth="1.2" />
              <line x1="25.2" y1="1" x2="25.2" y2="23" stroke="#241d10" strokeWidth="1.2" />
              <line x1="33.8" y1="1" x2="33.8" y2="23" stroke="#241d10" strokeWidth="1.2" />
              <line x1="42.4" y1="1" x2="42.4" y2="23" stroke="#241d10" strokeWidth="1.2" />
              <line x1="51" y1="1" x2="51" y2="23" stroke="#241d10" strokeWidth="1.2" />
            </g>
            <g id="groundLiftIcon">
              <rect x="0" y="0" width="24" height="24" rx="4" fill="#fffdf8" stroke="#241d10" strokeWidth="1.4" />
              <path d="M12 4 L7.8 11 L16.2 11 Z" fill="#241d10" />
              <path d="M12 20 L7.8 13 L16.2 13 Z" fill="#241d10" />
            </g>
          </defs>

          <rect x="0" y="0" width="1379" height="768" fill="#f2ead8" />

          {/* Zone polygons */}
          {buildingZones.map((zone) => {
            const isSelected = selectedZone === zone.id;
            const isHovered = hoveredZone === zone.id && !isSelected;
            const fillColor = isSelected ? '#4a90d9' : isHovered ? zone.fill : zone.fill;
            const strokeColor = isSelected ? '#3a6fb5' : zone.stroke;

            return (
              <g
                key={zone.id}
                className={`ground-zone-group ${shouldDim(zone.id) ? 'ground-zone-dimmed' : ''}`}
                onPointerEnter={() => setHoveredZone(zone.id)}
                onPointerLeave={() => setHoveredZone(null)}
                onClick={() => handleZoneClick(zone)}
                style={{ cursor: 'pointer' }}
              >
                <g filter={isSelected ? 'url(#zoneGlowFilter)' : 'url(#groundZoneShadow)'}>
                  <polygon
                    className={`ground-interactive-outline ground-zone-poly ${isSelected ? 'ground-zone-selected' : ''} ${isHovered ? 'ground-zone-hovered' : ''}`}
                    points={zone.points}
                    fill={fillColor}
                    stroke={strokeColor}
                  />
                  <polygon
                    points={zone.points}
                    fill="url(#groundSheen)"
                  />
                </g>
              </g>
            );
          })}

          {/* Classroom divider lines */}
          <line className="ground-interactive-divider" x1="714" y1="224" x2="714" y2="128" />
          <line className="ground-interactive-divider" x1="793" y1="224" x2="793" y2="122" />
          <line className="ground-interactive-divider" x1="876" y1="224" x2="876" y2="116" />
          <line className="ground-interactive-divider" x1="957" y1="224" x2="957" y2="110" />
          <line className="ground-interactive-divider" x1="1036" y1="224" x2="1036" y2="107" />
          <line className="ground-interactive-divider" x1="1192" y1="221" x2="1192" y2="103" />

          {/* Stairs */}
          <use href="#groundStairs" x="430" y="149" />
          <use href="#groundStairs" x="555" y="220" />
          <use href="#groundStairs" x="1165" y="184" />
          <use href="#groundStairs" x="481" y="550" />
          <use href="#groundStairs" x="670" y="625" />
          <use href="#groundStairs" x="1110" y="590" />

          {/* Lift icons */}
          <use href="#" x="462" y="132" />
          <text className="ground-lift-label" x="530" y="160" textAnchor="middle">Lift</text>
          <use href="#" x="558" y="129" />
          <text className="ground-lift-label" x="570" y="160" textAnchor="middle">Lift</text>
          <use href="#" x="1091" y="111" />
          <text className="ground-lift-label" x="1080" y="140" textAnchor="middle">Lift</text>
          <use href="#" x="1147" y="107" />
          <text className="ground-lift-label" x="1120" y="140" textAnchor="middle">Lift</text>
          <g transform="translate(1178,595) rotate(90)">
            <use href="" x="-12" y="-34" />
          </g>
          <text className="ground-lift-label" x="1195" y="680" transform="rotate(90 1195,662)" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold' }}>Lift</text>

          {/* Floor-specific text labels passed as children */}
          {children}
        </svg>
      </div>
    </div>
  );
}
