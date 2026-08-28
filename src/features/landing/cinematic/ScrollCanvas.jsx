/*
 * ScrollCanvas — The persistent Three.js canvas that reacts to scroll.
 * Uses React Three Fiber for declarative 3D, with GSAP-style scroll sync.
 */
import { Canvas } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import HubGeometry from './HubGeometry';
import ParticleField from './ParticleField';

function Scene({ scrollProgress }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#F5A623" />
      <pointLight position={[-5, -5, -5]} intensity={0.4} color="#3AC1D9" />

      {/* Camera movement based on scroll */}
      <CameraRig scrollProgress={scrollProgress} />

      {/* Main hub */}
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <HubGeometry scrollProgress={scrollProgress} />
      </Float>

      {/* Ambient particles */}
      <ParticleField scrollProgress={scrollProgress} />
    </>
  );
}

function CameraRig({ scrollProgress }) {
  import('@react-three/fiber').then(({ useFrame }) => {
    // This is a workaround — the actual hook usage is below
  });

  // Camera positions for each section
  const cameraPositions = [
    { pos: [0, 0, 6], look: [0, 0, 0] },       // Hero
    { pos: [3, 1, 5], look: [0, 0, 0] },        // Problems
    { pos: [0, 0.5, 4.5], look: [0, 0, 0] },   // Reassembly
    { pos: [-2, 0, 5], look: [0, 0, 0] },       // Features
    { pos: [1, 0.5, 5.5], look: [0, 0, 0] },   // Roles
    { pos: [0, 0, 6], look: [0, 0, 0] },        // CTA
  ];

  // Interpolate camera
  const t = scrollProgress * (cameraPositions.length - 1);
  const idx = Math.min(Math.floor(t), cameraPositions.length - 2);
  const frac = t - idx;
  const from = cameraPositions[idx];
  const to = cameraPositions[idx + 1];

  const camX = from.pos[0] + (to.pos[0] - from.pos[0]) * frac;
  const camY = from.pos[1] + (to.pos[1] - from.pos[1]) * frac;
  const camZ = from.pos[2] + (to.pos[2] - from.pos[2]) * frac;

  return (
    <group>
      <perspectiveCamera
        position={[camX, camY, camZ]}
        fov={45}
        near={0.1}
        far={100}
        makeDefault
      />
    </group>
  );
}

export default function ScrollCanvas({ scrollProgress }) {
  return (
    <div className="cine-canvas">
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, 6], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        <Scene scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
