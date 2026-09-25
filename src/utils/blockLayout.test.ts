import { describe, expect, it } from 'vitest';
import {
  blockDxPct,
  clampDxPct,
  clampDyUpPct,
  blockStageX,
  defaultDxPct,
  withBlockPosition,
} from './blockLayout';

describe('blockDxPct', () => {
  it('returns the saved position when present', () => {
    expect(blockDxPct([{ key: 'a', dxPct: -0.2 }], 'a', 0.1)).toBe(-0.2);
  });

  it('falls back to the default for unset or stale keys', () => {
    expect(blockDxPct([{ key: 'ghost', dxPct: 0.4 }], 'a', 0.1)).toBe(0.1);
    expect(blockDxPct([], 'a', 0.1)).toBe(0.1);
  });
});

describe('withBlockPosition', () => {
  it('adds a new position and updates an existing one (upsert)', () => {
    let pos = withBlockPosition([], 'a', -0.25);
    expect(pos).toEqual([{ key: 'a', dxPct: -0.25 }]);
    pos = withBlockPosition(pos, 'b', 0.3);
    expect(pos).toEqual([
      { key: 'a', dxPct: -0.25 },
      { key: 'b', dxPct: 0.3 },
    ]);
    pos = withBlockPosition(pos, 'a', -0.1);
    expect(pos).toEqual([
      { key: 'b', dxPct: 0.3 },
      { key: 'a', dxPct: -0.1 },
    ]);
  });

  it('carries the vertical offset and replaces it on re-upsert', () => {
    let pos = withBlockPosition([], 'a', 0, 0.05);
    expect(pos).toEqual([{ key: 'a', dxPct: 0, dyUpPct: 0.05 }]);
    pos = withBlockPosition(pos, 'a', 0.1); // no dy => dx-only update, dy dropped
    expect(pos).toEqual([{ key: 'a', dxPct: 0.1 }]);
    pos = withBlockPosition(pos, 'a', 0.1, -0.04);
    expect(pos).toEqual([{ key: 'a', dxPct: 0.1, dyUpPct: -0.04 }]);
  });
});

describe('clampDyUpPct', () => {
  const H = 800;
  const DEFAULT_LIFT = 380;

  it('keeps 0 unchanged (default height is legal)', () => {
    expect(clampDyUpPct(0, H, DEFAULT_LIFT)).toBeCloseTo(0, 6);
  });

  it('never lets the block bottom dip into the walking lane', () => {
    // Huge "up" values get clamped so the bottom stays >= 240px above ground.
    const clamped = clampDyUpPct(1, H, DEFAULT_LIFT);
    expect(DEFAULT_LIFT - clamped * H).toBeGreaterThanOrEqual(240);
  });

  it('never lets the block bottom exceed the stage minus margin', () => {
    // Huge "down" values clamp so the bottom stays <= stageHeight - 40.
    const clamped = clampDyUpPct(-1, H, DEFAULT_LIFT);
    expect(DEFAULT_LIFT - clamped * H).toBeLessThanOrEqual(H - 40);
  });
});

describe('clampDxPct', () => {
  it('keeps the block fully on-stage at both ends', () => {
    // 56px block on a 1000px stage: half-width is 2.8% → range ±47.2%.
    expect(clampDxPct(-0.9, 1000, 56)).toBeCloseTo(-0.472, 5);
    expect(clampDxPct(0.9, 1000, 56)).toBeCloseTo(0.472, 5);
  });

  it('lets interior values through unchanged', () => {
    expect(clampDxPct(0.2, 1000, 56)).toBe(0.2);
  });

  it('is degenerate-safe on a zero-width stage', () => {
    expect(clampDxPct(0.4, 0, 56)).toBe(0);
  });
});

describe('blockStageX', () => {
  it('converts the fraction to absolute stage-x around centre', () => {
    expect(blockStageX(0, 1000)).toBe(500);
    expect(blockStageX(-0.2, 1000)).toBe(300);
    expect(blockStageX(0.1, 800)).toBe(480);
  });
});

describe('defaultDxPct', () => {
  it('spreads blocks evenly around the centre like the old flex row', () => {
    // 56px blocks, 24px gap, 1000px stage: pitch 80px, slots at -80/0/+80.
    expect(defaultDxPct(0, 3, 1000, 56, 24)).toBeCloseTo(-0.08, 5);
    expect(defaultDxPct(1, 3, 1000, 56, 24)).toBeCloseTo(0, 5);
    expect(defaultDxPct(2, 3, 1000, 56, 24)).toBeCloseTo(0.08, 5);
  });

  it('clamps when the spread would run off-stage (narrow stages)', () => {
    // 320px stage: even 3-spread would exceed the ±46.25% clamp.
    expect(Math.abs(defaultDxPct(0, 3, 320, 56, 24))).toBeLessThan(0.5);
  });
});
