// Indoor directions between any two rooms, on one floor or across floors.
//
// Every floor shares the same footprint, so one walkway graph serves them
// all: a loop of corridor waypoints around the Badamtola courtyard. A room
// joins the graph at the nearest point on the loop (its "door"), so no room
// needs hand-placed doors. Floors are linked through lifts and stairs that
// sit at the same spot on both floors.

import { FLOORS, polyCenter } from './floors';

// Map units → metres (the building is roughly 115 m across).
export const METRES_PER_UNIT = 0.1;
const WALK_MPS = 1.3;
const LIFT_WAIT_S = 25;
const LIFT_PER_FLOOR_S = 4;
const STAIR_PER_FLOOR_S = 26;
const CONNECTOR_MATCH = 45; // max offset between the same lift on two floors

const NODES = {
  A: [380, 220], // west block
  B: [600, 215], // west block, by the stairs
  C: [650, 205], // north corridor, west end
  D: [1037, 198], // north corridor, east end
  E: [1110, 190], // north-east lift lobby
  F: [1122, 235], // east wing, north end
  G: [1120, 548], // east wing, south end
  H: [1120, 580], // south corridor, east end
  I: [790, 565], // south corridor, west end
  J: [660, 500], // lounge / showcase
  K: [530, 470], // south-west junction
  L: [430, 350], // plaza
  M: [425, 265], // plaza ↔ west block
  SW: [330, 510], // south-west hall
};

const EDGES = [
  ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['D', 'F'], ['E', 'F'],
  ['F', 'G'], ['G', 'H'], ['H', 'I'], ['I', 'J'], ['J', 'K'], ['K', 'L'],
  ['L', 'M'], ['M', 'A'], ['K', 'SW'],
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Nearest point on the walkway graph to p. */
function attach(p) {
  let best = null;
  for (const [u, v] of EDGES) {
    const a = NODES[u]; const b = NODES[v];
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    const q = [a[0] + t * dx, a[1] + t * dy];
    const d = dist(p, q);
    if (!best || d < best.d) best = { u, v, point: q, d };
  }
  return best;
}

/** Shortest walkway path between two points on one floor. */
export function walkPath(from, to) {
  const s = attach(from);
  const t = attach(to);
  const pos = { ...NODES, $s: s.point, $t: t.point };
  const adj = {};
  const link = (a, b) => {
    const w = dist(pos[a], pos[b]);
    (adj[a] ||= []).push([b, w]);
    (adj[b] ||= []).push([a, w]);
  };
  for (const [u, v] of EDGES) link(u, v);
  link('$s', s.u); link('$s', s.v);
  link('$t', t.u); link('$t', t.v);
  const sameEdge = (s.u === t.u && s.v === t.v);
  if (sameEdge) link('$s', '$t');

  // Dijkstra (the graph has ~16 nodes, so a linear scan is plenty).
  const D = { $s: 0 };
  const prev = {};
  const done = new Set();
  for (;;) {
    let cur = null;
    for (const k of Object.keys(D)) if (!done.has(k) && (cur === null || D[k] < D[cur])) cur = k;
    if (cur === null || cur === '$t') break;
    done.add(cur);
    for (const [n, w] of adj[cur] || []) {
      if (D[cur] + w < (D[n] ?? Infinity)) { D[n] = D[cur] + w; prev[n] = cur; }
    }
  }
  const chain = [];
  for (let k = '$t'; k; k = prev[k]) chain.unshift(pos[k]);
  const points = [from, ...chain, to];
  // Drop zero-length hops (a room whose door is a graph node).
  const clean = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 0.5);
  let length = 0;
  for (let i = 1; i < clean.length; i += 1) length += dist(clean[i - 1], clean[i]);
  return { points: clean, length };
}

const floorIndex = (id) => FLOORS.findIndex((f) => f.id === id);

/** Where a room or connector "is" for routing. */
export function anchorOf(floorId, placeId) {
  const floor = FLOORS.find((f) => f.id === floorId);
  if (!floor) return null;
  const room = floor.rooms.find((r) => r.id === placeId);
  if (room) return { floor, place: room, at: room.labelAt || polyCenter(room.poly), name: room.name };
  const c = (floor.connectors || []).find((x) => x.id === placeId);
  if (c) return { floor, place: c, at: c.at, name: c.kind === 'lift' ? 'Lift' : 'Stairs' };
  return null;
}

const floorName = (id) => (id === 'Ground' ? 'Ground floor' : `${id} floor`);

/**
 * Directions from one place to another.
 * @param from { floorId, id }
 * @param to   { floorId, id }
 * @param prefer 'any' | 'lift' | 'stair'
 * @returns { segments: [{ floorId, points }], steps: [{ floorId, text }], metres, seconds, via } | null
 */
export function findRoute(from, to, prefer = 'any') {
  const a = anchorOf(from.floorId, from.id);
  const b = anchorOf(to.floorId, to.id);
  if (!a || !b) return null;

  if (a.floor.id === b.floor.id) {
    const walk = walkPath(a.at, b.at);
    const metres = walk.length * METRES_PER_UNIT;
    return {
      segments: [{ floorId: a.floor.id, points: walk.points }],
      steps: [
        { floorId: a.floor.id, text: `Start at ${a.name}` },
        { floorId: a.floor.id, text: `Walk about ${Math.round(metres)} m to ${b.name}` },
      ],
      metres,
      seconds: metres / WALK_MPS,
      via: null,
    };
  }

  const delta = Math.abs(floorIndex(a.floor.id) - floorIndex(b.floor.id));
  let best = null;
  for (const c of a.floor.connectors || []) {
    if (prefer !== 'any' && c.kind !== prefer) continue;
    const match = (b.floor.connectors || [])
      .filter((x) => x.kind === c.kind && dist(x.at, c.at) <= CONNECTOR_MATCH)
      .sort((x, y) => dist(x.at, c.at) - dist(y.at, c.at))[0];
    if (!match) continue;
    const w1 = walkPath(a.at, c.at);
    const w2 = walkPath(match.at, b.at);
    const metres = (w1.length + w2.length) * METRES_PER_UNIT;
    const ride = c.kind === 'lift' ? LIFT_WAIT_S + LIFT_PER_FLOOR_S * delta : STAIR_PER_FLOOR_S * delta;
    const seconds = metres / WALK_MPS + ride;
    if (!best || seconds < best.seconds) best = { c, match, w1, w2, metres, seconds };
  }
  if (!best) return prefer === 'any' ? null : findRoute(from, to, 'any');

  const { c, match, w1, w2, metres, seconds } = best;
  const kind = c.kind === 'lift' ? 'lift' : 'stairs';
  const up = floorIndex(b.floor.id) > floorIndex(a.floor.id);
  const m1 = Math.round(w1.length * METRES_PER_UNIT);
  const m2 = Math.round(w2.length * METRES_PER_UNIT);
  return {
    segments: [
      { floorId: a.floor.id, points: w1.points },
      { floorId: b.floor.id, points: w2.points },
    ],
    steps: [
      { floorId: a.floor.id, text: `Start at ${a.name} (${floorName(a.floor.id)})` },
      { floorId: a.floor.id, text: `Walk about ${m1} m to the ${kind}` },
      { floorId: b.floor.id, text: `Take the ${kind} ${up ? 'up' : 'down'} ${delta} floor${delta > 1 ? 's' : ''} to the ${floorName(b.floor.id)}` },
      { floorId: b.floor.id, text: `Walk about ${m2} m to ${b.name}` },
    ],
    metres,
    seconds,
    via: { kind: c.kind, fromId: c.id, toId: match.id, at: c.at },
  };
}

export function formatDuration(seconds) {
  const min = Math.max(1, Math.round(seconds / 60));
  return `${min} min`;
}
