// AUST floor plans as vector data.
//
// Every floor shares one coordinate space (the 1379×768 grid the original
// floor-plan drawings were made in), so floors line up exactly when they are
// stacked for a 3D view later. Each zone is a polygon; nothing here is an
// image.
//
// Room codes follow the campus convention seen on the 1st-floor drawing:
// the leading digit is the floor number + 1 (1st floor → 2A03, 4th → 5B02).
//
// Ground and 1st floor are traced from the drawings in /public/campus.
// Floors 2–8 use one typical-floor template (A block north wing, B block east
// wing, C block south wing) until real drawings of those floors are added.

export const VIEW_BOX = { x: 80, y: 80, w: 1200, h: 680 };

// ── Shared building footprint ────────────────────────────────────────────
const WEST_BLOCK = [[220, 152], [455, 146], [455, 128], [532, 128], [532, 150], [556, 150], [556, 128], [630, 128], [632, 252], [320, 272], [248, 207], [240, 214], [208, 194]];
const NORTH_WING = [[630, 132], [1078, 104], [1250, 96], [1250, 225], [1035, 220], [632, 228]];
const EAST_WING = [[1035, 220], [1245, 225], [1222, 562], [1022, 552]];
const PLAZA = [[320, 272], [548, 258], [540, 300], [518, 445], [305, 420]];
const SOUTH_WEST = [[262, 418], [305, 420], [518, 445], [515, 590], [478, 628], [285, 600], [100, 550], [230, 432]];
const SOUTH_WING = [[518, 445], [545, 425], [570, 412], [680, 425], [740, 452], [775, 520], [1022, 552], [1222, 562], [1205, 745], [1005, 712], [590, 656], [585, 597], [515, 590]];
const COURTYARD = [[548, 258], [632, 236], [1035, 228], [1022, 552], [775, 520], [740, 452], [680, 425], [570, 412], [545, 425], [518, 445], [540, 300]];

export const FOOTPRINT = [WEST_BLOCK, NORTH_WING, EAST_WING, PLAZA, SOUTH_WEST, SOUTH_WING];

// ── Helpers ──────────────────────────────────────────────────────────────
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Centre of a polygon's bounding box: a good default label anchor. */
export function polyCenter(poly) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export function polyBounds(poly) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Interpolate along the sloped north-wing rooms (the wing tilts upward). */
function northRoom(x0, x1, top = 0) {
  // Top edge runs y=132 at x=630 → y=104 at x=1078; rooms are ~52 deep.
  const yAt = (x) => 132 - ((x - 630) * 28) / 448;
  return [[x0, yAt(x0) + top], [x1, yAt(x1) + top], [x1, yAt(x1) + 52], [x0, yAt(x0) + 52]];
}

const A_BLOCK_X = [632, 715, 795, 875, 957, 1037];

// ── Ground floor ─────────────────────────────────────────────────────────
const groundFloor = {
  id: 'Ground',
  label: 'Ground',
  courtyard: { poly: COURTYARD, name: 'Badamtola' },
  rooms: [
    { id: 'MHA', name: 'M.H Khan Auditorium', short: 'Auditorium', type: 'hall', poly: [[220, 152], [455, 146], [455, 128], [468, 128], [468, 260], [320, 272], [248, 207], [240, 214], [208, 194]], labelAt: [350, 205] },
    { id: 'G-REDEX', name: 'Redex Photocopy', short: 'Photocopy', type: 'admin', poly: [[468, 128], [532, 128], [532, 150], [556, 150], [556, 128], [630, 128], [632, 252], [468, 260]], labelAt: [552, 205] },
    { id: 'G-GCR', name: "Girl's Common Room", type: 'facility', poly: [[630, 132], [1060, 106], [1060, 222], [632, 228]], labelAt: [845, 165] },
    { id: 'G-WR', name: 'Washroom', short: 'WC', type: 'washroom', poly: [[1185, 99], [1250, 96], [1250, 160], [1185, 160]] },
    { id: 'G-REDX', name: 'RedX', type: 'facility', poly: PLAZA, labelAt: [420, 350] },
    { id: 'G-REDX-HALL', name: 'RedX Hall', type: 'facility', poly: SOUTH_WEST, labelAt: [330, 520] },
    { id: 'CANTEEN', name: 'Canteen', type: 'canteen', poly: EAST_WING },
    { id: 'G-TT', name: 'TT Ground', type: 'facility', poly: SOUTH_WING, labelAt: [870, 650] },
  ],
  connectors: [
    { id: 'G-L1', kind: 'lift', at: [490, 140] },
    { id: 'G-L2', kind: 'lift', at: [593, 140] },
    { id: 'G-L3', kind: 'lift', at: [1100, 125] },
    { id: 'G-L4', kind: 'lift', at: [1140, 125] },
    { id: 'G-L5', kind: 'lift', at: [1100, 605] },
    { id: 'G-L6', kind: 'lift', at: [1140, 698] },
    { id: 'G-S1', kind: 'stair', at: [390, 163] },
    { id: 'G-S2', kind: 'stair', at: [596, 238] },
    { id: 'G-S3', kind: 'stair', at: [1187, 190] },
    { id: 'G-S4', kind: 'stair', at: [606, 617] },
    { id: 'G-S5', kind: 'stair', at: [1158, 608] },
  ],
};

// ── 1st floor ────────────────────────────────────────────────────────────
const firstFloor = {
  id: '1st',
  label: '1st',
  courtyard: { poly: COURTYARD, name: 'Badamtola', note: 'Open to below' },
  rooms: [
    { id: '1-PR', name: 'Prayer Room', type: 'facility', poly: [[220, 152], [330, 149], [330, 266], [320, 272], [248, 207], [240, 214], [208, 194]], labelAt: [282, 195] },
    { id: '1-MC', name: 'Medical Center', type: 'medical', poly: [[330, 149], [455, 146], [455, 128], [532, 128], [532, 150], [556, 150], [556, 128], [630, 128], [632, 252], [330, 266]], labelAt: [450, 225] },
    ...A_BLOCK_X.slice(0, -1).map((x0, i) => ({
      id: `2A0${i + 3}`,
      name: `Room 2A0${i + 3}`,
      type: 'classroom',
      poly: northRoom(x0, A_BLOCK_X[i + 1]),
    })),
    { id: '1-WR', name: 'Washroom', short: 'WC', type: 'washroom', poly: [[1192, 99], [1250, 96], [1250, 150], [1192, 150]] },
    { id: '1-PZ', name: 'Plaza', type: 'facility', poly: PLAZA },
    { id: '1-LIB', name: 'Library', type: 'library', poly: EAST_WING },
    { id: '1-PRC', name: 'Proctor Room', type: 'admin', poly: [[262, 418], [305, 420], [420, 434], [400, 600], [285, 600], [100, 550], [230, 432]], labelAt: [255, 515] },
    { id: '1-ID', name: 'Information Desk', short: 'Info Desk', type: 'admin', poly: [[420, 434], [518, 445], [515, 590], [478, 628], [400, 600]], labelAt: [458, 530] },
    { id: '1-APS', name: 'Architecture Project Showcase', short: 'Arch. Showcase', type: 'facility', poly: [[518, 445], [545, 425], [570, 412], [680, 425], [740, 452], [775, 520], [760, 668], [590, 656], [585, 597], [515, 590]], labelAt: [645, 520] },
    { id: '1-SR', name: 'Study Room', type: 'library', poly: [[775, 520], [1022, 552], [1222, 562], [1205, 745], [1005, 712], [760, 668]], labelAt: [990, 640] },
  ],
  corridors: [
    // Corridor running along the south side of the A block.
    [[632, 184], [1037, 176], [1037, 220], [632, 228]],
  ],
  connectors: [
    { id: '1-L1', kind: 'lift', at: [490, 140] },
    { id: '1-L2', kind: 'lift', at: [593, 140] },
    { id: '1-L3', kind: 'lift', at: [1101, 128] },
    { id: '1-L4', kind: 'lift', at: [1155, 128] },
    { id: '1-L5', kind: 'lift', at: [1188, 640] },
    { id: '1-S1', kind: 'stair', at: [387, 163] },
    { id: '1-S2', kind: 'stair', at: [595, 236] },
    { id: '1-S3', kind: 'stair', at: [1198, 190] },
    { id: '1-S4', kind: 'stair', at: [478, 595] },
    { id: '1-S5', kind: 'stair', at: [642, 610] },
    { id: '1-S6', kind: 'stair', at: [1150, 588] },
  ],
};

// ── Typical upper floor (2nd – 8th) ──────────────────────────────────────
// A block: 5 classrooms in the north wing (same slots as the 1st floor).
// B block: 8 labs in the east wing, two columns of four with a corridor.
// C block: 5 classrooms along the south wing.
function typicalFloor(level, label, overrides = {}) {
  const p = String(level + 1); // room-code prefix
  const rooms = [];

  rooms.push({ id: `${level}-OFF`, name: 'Department Office', type: 'admin', poly: WEST_BLOCK, labelAt: [430, 215] });
  rooms.push({ id: `${level}-FAC`, name: 'Faculty Rooms', type: 'admin', poly: PLAZA });
  rooms.push({ id: `${level}-SEM`, name: 'Seminar Room', type: 'hall', poly: SOUTH_WEST, labelAt: [330, 520] });

  A_BLOCK_X.slice(0, -1).forEach((x0, i) => {
    const id = `${p}A0${i + 3}`;
    rooms.push({ id, name: `Room ${id}`, type: 'classroom', poly: northRoom(x0, A_BLOCK_X[i + 1]) });
  });
  rooms.push({ id: `${level}-WR`, name: 'Washroom', short: 'WC', type: 'washroom', poly: [[1192, 99], [1250, 96], [1250, 150], [1192, 150]] });

  // East wing: left column B01–B04, right column B05–B08.
  const eastTop = 232; const eastRow = 78;
  for (let i = 0; i < 4; i += 1) {
    const y = eastTop + i * eastRow;
    const idL = `${p}B0${i + 1}`;
    const idR = `${p}B0${i + 5}`;
    rooms.push({ id: idL, name: `Lab ${idL}`, type: 'lab', poly: rect(1040 - i * 4, y, 72, eastRow - 6) });
    rooms.push({ id: idR, name: `Lab ${idR}`, type: 'lab', poly: rect(1146 - i * 5, y, 74, eastRow - 6) });
  }

  // South wing: C03–C07 along the outer (south) wall.
  const cx = [770, 852, 934, 1016, 1098, 1180];
  for (let i = 0; i < 5; i += 1) {
    const id = `${p}C0${i + 3}`;
    const x0 = cx[i]; const x1 = cx[i + 1];
    // South wall slopes from (590,656) to (1205,745); rooms sit 70 deep.
    const yAt = (x) => 656 + ((x - 590) * 89) / 615;
    rooms.push({ id, name: `Room ${id}`, type: 'classroom', poly: [[x0, yAt(x0) - 72], [x1, yAt(x1) - 72], [x1, yAt(x1)], [x0, yAt(x0)]] });
  }
  rooms.push({ id: `${level}-LNG`, name: 'Student Lounge', type: 'facility', poly: [[518, 445], [545, 425], [570, 412], [680, 425], [740, 452], [770, 516], [770, 682], [590, 656], [585, 597], [515, 590]], labelAt: [650, 540] });

  return {
    id: label,
    label,
    typical: true,
    courtyard: { poly: COURTYARD, name: 'Badamtola', note: 'Open to below' },
    rooms: rooms.map((r) => ({ ...r, ...(overrides[r.id] || {}) })),
    corridors: [
      [[632, 184], [1037, 176], [1037, 220], [632, 228]],
      [[1112, 228], [1146, 228], [1137, 548], [1104, 546]],
      [[775, 520], [1022, 552], [1222, 562], [1219, 600], [770, 590]],
    ],
    connectors: [
      { id: `${level}-L1`, kind: 'lift', at: [490, 140] },
      { id: `${level}-L2`, kind: 'lift', at: [593, 140] },
      { id: `${level}-L3`, kind: 'lift', at: [1101, 128] },
      { id: `${level}-L4`, kind: 'lift', at: [1155, 128] },
      { id: `${level}-S1`, kind: 'stair', at: [387, 175] },
      { id: `${level}-S2`, kind: 'stair', at: [595, 236] },
      { id: `${level}-S3`, kind: 'stair', at: [1198, 190] },
      { id: `${level}-S4`, kind: 'stair', at: [478, 595] },
    ],
  };
}

export const FLOORS = [
  groundFloor,
  firstFloor,
  typicalFloor(2, '2nd'),
  typicalFloor(3, '3rd'),
  typicalFloor(4, '4th'),
  typicalFloor(5, '5th'),
  typicalFloor(6, '6th'),
  typicalFloor(7, '7th'),
  typicalFloor(8, '8th'),
];

export const ROOM_TYPE_LABEL = {
  classroom: 'Classroom',
  lab: 'Lab',
  hall: 'Hall',
  admin: 'Office',
  facility: 'Facility',
  library: 'Library',
  washroom: 'Washroom',
  canteen: 'Canteen',
  medical: 'Medical',
};

/** Every room on every floor, with its floor id attached, for search. */
export const ALL_ROOMS = FLOORS.flatMap((f) => f.rooms.map((r) => ({ ...r, floorId: f.id })));

/** Find a room by code or name fragment (case- and dash-insensitive). */
export function searchRooms(query, limit = 8) {
  const q = String(query || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (!q) return [];
  const compact = q.replace(/ /g, '');
  const scored = [];
  for (const room of ALL_ROOMS) {
    const id = room.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const name = room.name.toLowerCase();
    let score = -1;
    if (id === compact) score = 0;
    else if (id.startsWith(compact)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 3;
    if (score >= 0) scored.push({ room, score });
  }
  scored.sort((a, b) => a.score - b.score || a.room.id.localeCompare(b.room.id));
  return scored.slice(0, limit).map((s) => s.room);
}
