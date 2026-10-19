import { lazy, Suspense, useEffect, useState } from 'react';

const FluidOrbCanvas = lazy(() => import('./FluidOrbCanvas'));

function shouldUseFallback() {
  if (typeof window === 'undefined') return true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return Boolean(reduced || mobile || lowCpu || lowMemory);
}

export function FluidOrb() {
  const [fallback, setFallback] = useState(shouldUseFallback);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)');
    const update = () => setFallback(shouldUseFallback());
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (fallback) return <div className="fluid-orb fluid-orb--fallback" aria-hidden="true" />;
  return (
    <Suspense fallback={<div className="fluid-orb fluid-orb--fallback" aria-hidden="true" />}>
      <FluidOrbCanvas />
    </Suspense>
  );
}
