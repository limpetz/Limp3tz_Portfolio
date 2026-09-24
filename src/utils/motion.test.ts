import { describe, expect, it } from 'vitest';
import { REDUCED_MOTION_QUERY, crossfadeMs, shouldAutoAdvance } from './motion';

describe('shouldAutoAdvance', () => {
  it('auto-advances a multi-image slideshow by default', () => {
    expect(shouldAutoAdvance(false, 6)).toBe(true);
  });

  it('stops auto-advancing when motion is reduced', () => {
    expect(shouldAutoAdvance(true, 6)).toBe(false);
  });

  it('never auto-advances a slideshow with nothing to advance to', () => {
    expect(shouldAutoAdvance(false, 1)).toBe(false);
    expect(shouldAutoAdvance(false, 0)).toBe(false);
    expect(shouldAutoAdvance(true, 1)).toBe(false);
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
