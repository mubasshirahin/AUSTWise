/*
 * ParticleField — Ambient floating particles that react to scroll.
 * Adds depth and premium feel without heavy GPU cost.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 200;

export default function ParticleField({ scrollProgress = 0 }) {
  const meshRef = useRef();

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      vel[i * 3] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const pos = meshRef.current.geometry.attributes.position;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos.array[i * 3] += velocities[i * 3] + Math.sin(time * 0.1 + i) * 0.001;
      pos.array[i * 3 + 1] += velocities[i * 3 + 1] + Math.cos(time * 0.1 + i * 0.7) * 0.001;
      pos.array[i * 3 + 2] += velocities[i * 3 + 2];

      // Wrap around
      for (let j = 0; j < 3; j++) {
        if (pos.array[i * 3 + j] > 10) pos.array[i * 3 + j] = -10;
        if (pos.array[i * 3 + j] < -10) pos.array[i * 3 + j] = 10;
      }
    }
    pos.needsUpdate = true;

    // React to scroll — particles spread out during chaos, converge during reassembly
    const spread = scrollProgress < 0.35 ? 1 : scrollProgress < 0.55 ? 1.5 : 1;
    meshRef.current.scale.setScalar(spread);
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#F5A623"
        transparent
        opacity={0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
