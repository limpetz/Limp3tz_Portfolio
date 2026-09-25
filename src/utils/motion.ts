/**
 * Reduced-motion support.
 *
 * Users who set "reduce motion" in their OS want decorative animation to stop.
 * The pure helpers below decide the two behavioural changes (whether the hero
 * slideshow may auto-advance, and how long its crossfade lasts); the remaining
 * purely-visual loops are switched off in `index.css`.
 */
import { useEffect, useState } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the slideshow should advance on its own.
 *
 * Auto-advance is a deliberate product choice and keeps running regardless of
 * the visitor's motion preference — the backdrop rotating is the point of the
 * hero. Only the crossfade length reacts to that preference (`crossfadeMs`), so
 * reduced-motion visitors get hard cuts instead of fades. A single-image
 * slideshow has nothing to advance to.
 */
export function shouldAutoAdvance(slideCount: number): boolean {
  return slideCount > 1;
}

/** Crossfade length in ms — instant when motion is reduced. */
export function crossfadeMs(reducedMotion: boolean, configuredMs: number): number {
  return reducedMotion ? 0 : configuredMs;
}

/** Subscribe to the OS "reduce motion" preference, updating live if it changes. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setReduced(query.matches);

    // Re-sync in case the preference changed between render and effect.
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
