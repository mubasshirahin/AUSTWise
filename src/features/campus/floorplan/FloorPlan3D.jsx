import { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { FLOORS, FOOTPRINT, VIEW_BOX, polyCenter } from './floors';

// Same polygons as the 2D map, extruded and stacked one floor above another.
const S = 1 / 100; // map units → world units
const CX = VIEW_BOX.x + VIEW_BOX.w / 2;
const CY = VIEW_BOX.y + VIEW_BOX.h / 2;
const FLOOR_H = 1.15;
const SLAB = 0.06;
const ROOM_H = 0.42;
const ROUTE_Y = SLAB + ROOM_H + 0.04;

const TYPE_COLOR = {
  classroom: '#4c8df6',
  lab: '#9b6bf2',
  hall: '#f08a3c',
  admin: '#d9b44a',
  facility: '#3ac1d9',
  library: '#2fb57a',
  canteen: '#f08a3c',
  medical: '#f0554a',
  washroom: '#8a8f98',
};

// Rooms are toned toward the theme's card colour and grey so they don't glare.
const softCache = new Map();
function softColor(hex, base) {
  const key = `${hex}|${base}`;
  if (!softCache.has(key)) {
    const c = new THREE.Color(hex);
    c.lerp(new THREE.Color(base), 0.18).lerp(new THREE.Color('#9aa0aa'), 0.22);
    softCache.set(key, `#${c.getHexString()}`);
  }
  return softCache.get(key);
}

const levelOf = (floorId) => FLOORS.findIndex((f) => f.id === floorId);
const toWorld = ([x, y], level, lift = 0) => [(x - CX) * S, level * FLOOR_H + lift, (y - CY) * S];

function toShape(poly) {
  const shape = new THREE.Shape();
  poly.forEach(([x, y], i) => {
    const X = (x - CX) * S;
    const Y = -(y - CY) * S; // rotated −90° about X below, so −Y → +Z
    if (i === 0) shape.moveTo(X, Y); else shape.lineTo(X, Y);
  });
  shape.closePath();
  return shape;
}

const extrude = (poly, depth) => new THREE.ExtrudeGeometry(toShape(poly), { depth, bevelEnabled: false });

// Geometry is identical for every render, so build it once per floor.
const geometryCache = new Map();
function floorGeometry(floor) {
  if (!geometryCache.has(floor.id)) {
    geometryCache.set(floor.id, {
      slabs: FOOTPRINT.map((p) => extrude(p, SLAB)),
      rooms: floor.rooms.map((r) => ({ room: r, geo: extrude(r.poly, ROOM_H), tall: extrude(r.poly, ROOM_H * 1.35) })),
    });
  }
  return geometryCache.get(floor.id);
}

// The 3D view mounts inside the widget, so its theme colours can be read once.
function readThemeColors() {
  const el = document.querySelector('.floor-map-widget') || document.documentElement;
  const cs = getComputedStyle(el);
  return {
    slab: cs.getPropertyValue('--bg-card').trim() || '#2b2b30',
    edge: cs.getPropertyValue('--text-tertiary').trim() || '#8a8f98',
  };
}

/** Glides the orbit target (and camera) to the active floor's height. */
function FloorRig({ level }) {
  const invalidate = useThree((s) => s.invalidate);
  const goal = level * FLOOR_H;
  useFrame(({ controls, camera }) => {
    if (!controls) return;
    const dy = goal - controls.target.y;
    if (Math.abs(dy) < 0.002) return;
    const step = dy * 0.14;
    controls.target.y += step;
    camera.position.y += step;
    controls.update();
    invalidate();
  });
  useEffect(() => { invalidate(); }, [level, invalidate]);
  return null;
}

function Floor({ floor, level, mode, selectedId, onSelect, colors }) {
  const { slabs, rooms } = useMemo(() => floorGeometry(floor), [floor]);
  if (mode === 'hidden') return null;
  const active = mode === 'active';
  const ghost = !active;
  const noHit = () => null;
  return (
    <group position={[0, level * FLOOR_H, 0]}>
      {slabs.map((geo, i) => (
        <mesh key={i} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} raycast={noHit}>
          <meshStandardMaterial color={colors.slab} transparent opacity={active ? 1 : 0.14} depthWrite={active} />
          {active && <Edges color={colors.edge} threshold={20} />}
        </mesh>
      ))}
      {rooms.map(({ room, geo, tall }) => {
        const selected = active && room.id === selectedId;
        const dim = active && selectedId && !selected;
        return (
          <mesh
            key={room.id}
            geometry={selected ? tall : geo}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, SLAB, 0]}
            raycast={active ? undefined : noHit}
            onClick={active ? (e) => { e.stopPropagation(); onSelect(floor.id, selected ? null : room.id); } : undefined}
            onPointerOver={active ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
            onPointerOut={active ? () => { document.body.style.cursor = ''; } : undefined}
          >
            <meshStandardMaterial
              color={softColor(TYPE_COLOR[room.type] || TYPE_COLOR.classroom, colors.slab)}
              transparent
              opacity={ghost ? 0.1 : dim ? 0.45 : 0.92}
              depthWrite={!ghost}
              emissive={selected ? TYPE_COLOR[room.type] : '#000000'}
              emissiveIntensity={selected ? 0.55 : 0}
              roughness={0.7}
            />
            {active && !dim && <Edges color="#ffffff" threshold={20} transparent opacity={0.35} />}
          </mesh>
        );
      })}
    </group>
  );
}

function Route3D({ route }) {
  if (!route) return null;
  const parts = route.segments.map((seg) => {
    const level = levelOf(seg.floorId);
    return seg.points.map((p) => toWorld(p, level, ROUTE_Y));
  });
  const last = parts[parts.length - 1];
  const end = last[last.length - 1];
  const start = parts[0][0];
  const lines = [...parts];
  // Vertical hop through the lift / stairs between the two floors.
  if (parts.length > 1) lines.push([parts[0][parts[0].length - 1], parts[1][0]]);
  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#4f95ff" lineWidth={7} depthTest={false} renderOrder={10} />
      ))}
      <mesh position={start} renderOrder={11}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <mesh position={[end[0], end[1] + 0.3, end[2]]} rotation={[Math.PI, 0, 0]} renderOrder={11}>
        <coneGeometry args={[0.16, 0.5, 24]} />
        <meshBasicMaterial color="#f0554a" depthTest={false} />
      </mesh>
    </group>
  );
}

export default function FloorPlan3D({ activeFloorId, selectedId, route, onSelect, portrait = false }) {
  const [colors] = useState(readThemeColors);
  const active = levelOf(activeFloorId);
  // Only the first render places the orbit target; FloorRig moves it after.
  const [initialTarget] = useState(() => [0, active * FLOOR_H, 0]);
  const routeLevels = new Set((route?.segments || []).map((s) => levelOf(s.floorId)));
  const top = Math.max(active, ...routeLevels);
  const selectedRoom = FLOORS[active]?.rooms.find((r) => r.id === selectedId);

  return (
    <Canvas
      className="fp-3d-canvas"
      frameloop="demand"
      dpr={[1, 2]}
      // Portrait phones: the building is turned 90° (like the 2D map) and
      // seen from higher up so its long side fills the tall screen.
      camera={{
        position: portrait ? [0, active * FLOOR_H + 14, 8] : [0, active * FLOOR_H + 8.5, 9.5],
        fov: portrait ? 46 : 40,
        near: 0.1,
        far: 200,
      }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onSelect(activeFloorId, null)}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 14, 8]} intensity={1.1} />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} />

      <group rotation={[0, portrait ? -Math.PI / 2 : 0, 0]}>
        {FLOORS.map((floor, level) => {
          let mode = 'ghost';
          if (level === active) mode = 'active';
          else if (level > top) mode = 'hidden';
          return (
            <Floor
              key={floor.id}
              floor={floor}
              level={level}
              mode={mode}
              selectedId={level === active ? selectedId : null}
              onSelect={onSelect}
              colors={colors}
            />
          );
        })}

        <Route3D route={route} />

        {selectedRoom && (
          <Html position={toWorld(selectedRoom.labelAt || polyCenter(selectedRoom.poly), active, SLAB + ROOM_H * 1.35 + 0.25)} center zIndexRange={[20, 0]}>
            <div className="fp-3d-label">{selectedRoom.name}</div>
          </Html>
        )}
      </group>

      <OrbitControls
        makeDefault
        enableDamping={false}
        minDistance={3}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2.15}
        target={initialTarget}
      />
      <FloorRig level={active} />
    </Canvas>
  );
}
