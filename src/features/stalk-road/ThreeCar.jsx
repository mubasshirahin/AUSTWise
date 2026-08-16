import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ─── Stylized low-poly 3D car (Three.js), pointing +X, turning on the road ───
   The overlay positions this via the .sr-car container transform; the heading
   angle (degrees, screen-space) is fed in through `angleRef` and applied as a
   world-space Y rotation so the body visibly turns in 3D. */

function softShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildCar(accent) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0a0c12', roughness: 0.9, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#16212e', roughness: 0.15, metalness: 0.85 });
  const lightMat = new THREE.MeshStandardMaterial({ color: '#ffe08a', roughness: 0.4, metalness: 0.2 });

  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 18);
  wheelGeo.rotateZ(Math.PI / 2); // axle along X
  const wheelPositions = [
    [1.45, 0.46, 1.02], [1.45, 0.46, -1.02],
    [-1.45, 0.46, 1.02], [-1.45, 0.46, -1.02],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  // lower chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 2.0), darkMat);
  chassis.position.set(0, 0.34, 0);
  group.add(chassis);

  // main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 2.1), bodyMat);
  body.position.set(0, 0.68, 0);
  body.castShadow = true;
  group.add(body);

  // hood taper (front)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 1.9), bodyMat);
  hood.position.set(1.95, 0.8, 0);
  group.add(hood);

  // trunk taper (rear)
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 1.9), bodyMat);
  trunk.position.set(-2.05, 0.82, 0);
  group.add(trunk);

  // cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.72), glassMat);
  cabin.position.set(-0.15, 1.16, 0);
  group.add(cabin);

  // cabin roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.6), bodyMat);
  roof.position.set(-0.15, 1.52, 0);
  group.add(roof);

  // windshield + rear glass (tinted slats for a stylised look)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.66), glassMat);
  glass.position.set(0.92, 1.17, 0);
  group.add(glass);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 1.64), glassMat);
  rearGlass.position.set(-1.28, 1.16, 0);
  group.add(rearGlass);

  // side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.18, 0.14, 0.14);
  for (const side of [1, -1]) {
    const mirror = new THREE.Mesh(mirrorGeo, bodyMat);
    mirror.position.set(0.92, 0.9, 1.08 * side);
    group.add(mirror);
  }

  // headlights + taillights
  const lampGeo = new THREE.BoxGeometry(0.1, 0.12, 0.42);
  for (const side of [1, -1]) {
    const head = new THREE.Mesh(lampGeo, lightMat);
    head.position.set(2.32, 0.72, 0.55 * side);
    group.add(head);
    const tail = new THREE.Mesh(lampGeo, darkMat);
    tail.position.set(-2.32, 0.74, 0.55 * side);
    group.add(tail);
  }

  // soft ground shadow (rotates with the car so it stays underneath)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 4.4),
    new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return group;
}

export default function ThreeCar({ color = '#10b981', angleRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-3.4, 3.4, 3.4, -3.4, 0.1, 100);
    camera.position.set(0, 7.5, 6.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-5, 5, -4);
    scene.add(rim);

    const car = buildCar(color);
    scene.add(car);

    let lastAngle = null;
    let raf = 0;
    const loop = () => {
      const deg = angleRef?.current ?? 0;
      if (deg !== lastAngle) {
        lastAngle = deg;
        car.rotation.y = -THREE.MathUtils.degToRad(deg);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [color, angleRef]);

  return <div ref={mountRef} className="sr-car-3d" />;
}