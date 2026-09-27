import { describe, expect, it } from 'vitest';
import {
  TRAIL_COIN_COUNT,
  TRAIL_MIN_H,
  TRAIL_WALL_MARGIN,
  generateCoinTrail,
  pickTrailShape,
  trailMaxHeight,
  trailSpacing,
} from './coinTrail';

// Stage-realistic params: 1200px stage, 92px ground, ~391px jump apex
// (JUMP_V² / 2G = 1250² / 4000).
const P = { width: 1200, groundH: 92, jumpApex: 391 };

describe('coin trail reachability', () => {
  it('keeps every coin inside the jump reach and off the floor', () => {
    const maxH = trailMaxHeight(P.jumpApex);
    expect(maxH).toBe(313); // 80% of the 391px apex
    for (const shape of ['arc', 'wave', 'stairs'] as const) {
      const { coins } = generateCoinTrail(shape, P);
      for (const c of coins) {
        expect(c.h).toBeGreaterThanOrEqual(TRAIL_MIN_H);
        expect(c.h).toBeLessThanOrEqual(maxH);
        expect(c.x).toBeGreaterThanOrEqual(TRAIL_WALL_MARGIN);
        expect(c.x).toBeLessThanOrEqual(P.width - TRAIL_WALL_MARGIN);
      }
    }
  });

  it('always emits the designed coin count', () => {
    for (const shape of ['arc', 'wave', 'stairs'] as const) {
      expect(generateCoinTrail(shape, P).coins).toHaveLength(TRAIL_COIN_COUNT);
    }
  });

  it('spans the stage from a random start without hugging the walls', () => {
    const spacing = trailSpacing(P.width);
    for (let i = 0; i < 100; i++) {
      const { coins } = generateCoinTrail('arc', P);
      const first = coins[0].x;
      const last = coins[coins.length - 1].x;
      expect(last - first).toBe(spacing * (TRAIL_COIN_COUNT - 1));
      // The whole trail fits the usable span.
      expect(first).toBeGreaterThanOrEqual(TRAIL_WALL_MARGIN);
      expect(last).toBeLessThanOrEqual(P.width - TRAIL_WALL_MARGIN);
    }
  });

  it('shapes actually differ: arc domes, stairs climbs, wave oscillates', () => {
    const arc = generateCoinTrail('arc', P).coins.map((c) => c.h);
    const stairs = generateCoinTrail('stairs', P).coins.map((c) => c.h);
    const wave = generateCoinTrail('wave', P).coins.map((c) => c.h);

    // Arc: apex mid-trail, symmetric-ish ends below the apex.
    expect(arc[3]).toBe(Math.max(...arc));
    expect(arc[0]).toBeLessThan(arc[3]);
    expect(arc[6]).toBeLessThan(arc[3]);
    // Stairs: strictly climbing.
    for (let i = 1; i < stairs.length; i++) expect(stairs[i]).toBeGreaterThan(stairs[i - 1]);
    // Wave: at least two local maxima.
    let crests = 0;
    for (let i = 1; i < wave.length - 1; i++) {
      if (wave[i] > wave[i - 1] && wave[i] > wave[i + 1]) crests++;
    }
    expect(crests).toBeGreaterThanOrEqual(1);
  });

  it('respects the injected random for deterministic placement', () => {
    const a = generateCoinTrail('arc', { ...P, random: () => 0 });
    const b = generateCoinTrail('arc', { ...P, random: () => 0 });
    expect(a).toEqual(b);
    const c = generateCoinTrail('arc', { ...P, random: () => 0.999 });
    expect(c.coins[0].x).toBeGreaterThan(a.coins[0].x);
  });

  it('pickTrailShape only returns known shapes', () => {
    for (let i = 0; i < 50; i++) {
      expect(['arc', 'wave', 'stairs']).toContain(pickTrailShape());
    }
    expect(pickTrailShape(() => 0)).toBe('arc');
    expect(pickTrailShape(() => 0.5)).toBe('wave');
    expect(pickTrailShape(() => 0.999)).toBe('stairs');
  });
});
