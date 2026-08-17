import { lazy, Suspense } from 'react';
import { useStalk } from './StalkContext';

// The road-trip cinematic pulls in three.js, GSAP and the portfolio panels
// (~700 kB). It only runs while a stalk target is active, so it is split into
// its own async chunk instead of loading on every page.
const StalkRoadScene = lazy(() => import('./StalkRoadScene'));

export default function StalkRoadOverlay() {
  const { target } = useStalk();

  if (!target) return null;

  return (
    <Suspense fallback={null}>
      <StalkRoadScene />
    </Suspense>
  );
}