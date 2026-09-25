import { describe, expect, it } from 'vitest';
import { REDUCED_MOTION_QUERY, crossfadeMs, shouldAutoAdvance } from './motion';

describe('shouldAutoAdvance', () => {
  it('auto-advances a multi-image slideshow', () => {
    expect(shouldAutoAdvance(6)).toBe(true);
  });

  it('keeps advancing regardless of the motion preference', () => {
    // Deliberate product call: only the crossfade reacts to reduced motion, so
    // the backdrop still rotates every SLIDESHOW_INTERVAL_MS.
    expect(shouldAutoAdvance(2)).toBe(true);
    expect(shouldAutoAdvance(6)).toBe(true);
  });

  it('never auto-advances a slideshow with nothing to advance to', () => {
    expect(shouldAutoAdvance(1)).toBe(false);
    expect(shouldAutoAdvance(0)).toBe(false);
  });
});

describe('crossfadeMs', () => {
  it('keeps the configured crossfade normally', () => {
    expect(crossfadeMs(false, 1000)).toBe(1000);
  });

  it('swaps instantly when motion is reduced', () => {
    expect(crossfadeMs(true, 1000)).toBe(0);
  });

  it('passes through a zero crossfade', () => {
    expect(crossfadeMs(false, 0)).toBe(0);
  });
});

describe('REDUCED_MOTION_QUERY', () => {
  it('matches the standard media query', () => {
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });
});
