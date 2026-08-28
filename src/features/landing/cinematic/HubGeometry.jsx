/*
 * HubGeometry — The central 3D "hub" representing AUSTWise as the single
 * point tying together scattered student life.
 *
 * Scroll-progress-to-state mapping:
 *   0.0 – 0.15  → Idle float (hero)
 *   0.15 – 0.35 → Scattered / chaos (problems section)
 *   0.35 – 0.55 → Reassembly (everything-you-need)
 *   0.55 – 0.85 → Orbiting modules (feature showcase)
 *   0.85 – 1.0  → Settled hero (final CTA)
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NODE_COUNT = 24;
const EDGE_THRESHOLD = 2.8;

export default function HubGeometry({ scrollProgress = 0 }) {
  const groupRef = useRef();
  const nodesRef = useRef();
  const edgesRef = useRef();

  // Generate initial node positions in a sphere
  const { initialPositions, scatteredPositions, assembledPositions } = useMemo(() => {
    const initial = [];
    const scattered = [];
    const assembled = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      // Initial sphere layout
      initial.push(
        Math.cos(theta) * radius * 1.8,
        y * 1.8,
        Math.sin(theta) * radius * 1.8
      );

      // Scattered — explosion outward with randomness
      const scatterFactor = 3 + Math.sin(i * 7.3) * 2;
      scattered.push(
        Math.cos(theta) * radius * scatterFactor + Math.sin(i * 3.1) * 1.5,
        y * scatterFactor * 1.2 + Math.cos(i * 2.7) * 1.5,
        Math.sin(theta) * radius * scatterFactor + Math.cos(i * 5.3) * 1.5
      );

      // Assembled — organized grid/orbit
      const ring = Math.floor(i / 8);
      const posInRing = i % 8;
      const angle = (posInRing / 8) * Math.PI * 2;
      const ringRadius = 1.2 + ring * 0.8;
      assembled.push(
        Math.cos(angle) * ringRadius,
        (ring - 1) * 0.6,
        Math.sin(angle) * ringRadius
      );
    }

    return {
      initialPositions: new Float32Array(initial),
      scatteredPositions: new Float32Array(scattered),
      assembledPositions: new Float32Array(assembled),
    };
  }, []);

  // Interpolate positions based on scroll
  const currentPositions = useMemo(() => {
    return new Float32Array(NODE_COUNT * 3);
  }, []);

  useFrame((state) => {
    if (!groupRef.current || !nodesRef.current) return;

    const t = scrollProgress;
    const geo = nodesRef.current.geometry;
    const pos = geo.attributes.position;

    for (let i = 0; i < NODE_COUNT * 3; i++) {
      let from, to, blend;

      if (t < 0.15) {
        // Idle — gentle float from initial
        from = initialPositions[i];
        to = initialPositions[i];
        blend = 0;
      } else if (t < 0.35) {
        // Scatter
        from = initialPositions[i];
        to = scatteredPositions[i];
        blend = (t - 0.15) / 0.2;
      } else if (t < 0.55) {
        // Reassemble
        from = scatteredPositions[i];
        to = assembledPositions[i];
        blend = (t - 0.35) / 0.2;
      } else if (t < 0.85) {
        // Module showcase — subtle orbit
        from = assembledPositions[i];
        to = assembledPositions[i];
        blend = 0;
      } else {
        // Settled
        from = assembledPositions[i];
        to = initialPositions[i];
        blend = (t - 0.85) / 0.15;
      }

      // Ease in-out
      const eased = blend < 0.5
        ? 2 * blend * blend
        : 1 - Math.pow(-2 * blend + 2, 2) / 2;

      currentPositions[i] = from + (to - from) * eased;
    }

    pos.array.set(currentPositions);
    pos.needsUpdate = true;

    // Idle float animation
    const idleTime = state.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(idleTime * 0.15) * 0.1 + scrollProgress * Math.PI * 0.5;
    groupRef.current.rotation.x = Math.sin(idleTime * 0.1) * 0.05;

    // Scale pulse during reassembly
    if (t > 0.35 && t < 0.55) {
      const pulse = 1 + Math.sin((t - 0.35) / 0.2 * Math.PI) * 0.1;
      groupRef.current.scale.setScalar(pulse);
    } else {
      groupRef.current.scale.setScalar(1);
    }
  });

  // Build edges (connections between nearby nodes)
  const edgeGeometry = useMemo(() => {
    const points = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = initialPositions[i * 3] - initialPositions[j * 3];
        const dy = initialPositions[i * 3 + 1] - initialPositions[j * 3 + 1];
        const dz = initialPositions[i * 3 + 2] - initialPositions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < EDGE_THRESHOLD) {
          points.push(
            initialPositions[i * 3], initialPositions[i * 3 + 1], initialPositions[i * 3 + 2],
            initialPositions[j * 3], initialPositions[j * 3 + 1], initialPositions[j * 3 + 2]
          );
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [initialPositions]);

  return (
    <group ref={groupRef}>
      {/* Nodes */}
      <points ref={nodesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={NODE_COUNT}
            array={currentPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          color="#F5A623"
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Glowing core */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color="#F5A623"
          emissive="#F5A623"
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Edges */}
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial
          color="#F5A623"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}
