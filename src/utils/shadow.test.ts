import { describe, expect, it } from 'vitest';
import { SHADOW_CURVE, shadowForHeight } from './shadow';

// Real stage values: the scripted jump apexes ~310px above the ground.
const APEX = 1100 * 1100 / (2 * 1950);

describe('shadowForHeight', () => {
  it('is full size and darkest on the ground', () => {
    const s = shadowForHeight(0, APEX);
    expect(s.scaleX).toBeCloseTo(1, 5);
    expect(s.scaleY).toBeCloseTo(1, 5);
    expect(s.opacity).toBeCloseTo(SHADOW_CURVE.groundOpacity, 5);
  });

  it('reaches its smallest and faintest exactly at the apex', () => {
    const s = shadowForHeight(APEX, APEX);
    expect(s.scaleX).toBeCloseTo(SHADOW_CURVE.minScaleX, 5);
    expect(s.scaleY).toBeCloseTo(SHADOW_CURVE.minScaleY, 5);
    expect(s.opacity).toBeCloseTo(SHADOW_CURVE.apexOpacity, 5);
  });

  // Regression guard: the old implementation clamped out at 57% of the arc, so
  // the shadow stopped reacting for the whole top half of every jump.
  it('keeps reacting above the halfway point of the arc', () => {
    const half = shadowForHeight(APEX * 0.5, APEX);
    const threeQuarters = shadowForHeight(APEX * 0.75, APEX);
    expect(threeQuarters.opacity).toBeLessThan(half.opacity);
    expect(threeQuarters.scaleX).toBeLessThan(half.scaleX);
  });

  it('never grows or darkens as the caster rises', () => {
    let previous = shadowForHeight(0, APEX);
    for (let h = 0; h <= APEX * 1.2; h += APEX / 40) {
      const current = shadowForHeight(h, APEX);
      expect(current.scaleX).toBeLessThanOrEqual(previous.scaleX + 1e-9);
      expect(current.scaleY).toBeLessThanOrEqual(previous.scaleY + 1e-9);
      expect(current.opacity).toBeLessThanOrEqual(previous.opacity + 1e-9);
      previous = current;
    }
  });

  it('clamps heights beyond the apex', () => {
    const atApex = shadowForHeight(APEX, APEX);
    const wayAbove = shadowForHeight(APEX * 5, APEX);
    expect(wayAbove).toEqual(atApex);
  });

  it('treats a negative height as grounded', () => {
    expect(shadowForHeight(-40, APEX)).toEqual(shadowForHeight(0, APEX));
  });

  it('treats a non-positive apex as grounded instead of emitting NaN', () => {
    for (const apex of [0, -10]) {
      const s = shadowForHeight(50, apex);
      expect(Number.isNaN(s.opacity)).toBe(false);
      expect(s.scaleX).toBeCloseTo(1, 5);
      expect(s.opacity).toBeCloseTo(SHADOW_CURVE.groundOpacity, 5);
    }
  });

  it('squashes on landing: wider and flatter, never darker', () => {
    const rest = shadowForHeight(0, APEX, false);
    const landing = shadowForHeight(0, APEX, true);
    expect(landing.scaleX).toBeGreaterThan(rest.scaleX);
    expect(landing.scaleY).toBeLessThan(rest.scaleY);
    expect(landing.opacity).toBeCloseTo(rest.opacity, 5);
  });
});

describe('SHADOW_CURVE tuning', () => {
  it('an ease above 1 keeps the shadow attached near the ground', () => {
    // At half the arc height, a super-linear falloff is still darker than the
    // straight-line midpoint between ground and apex opacity.
    const half = shadowForHeight(APEX * 0.5, APEX);
    const linearMidpoint = (SHADOW_CURVE.groundOpacity + SHADOW_CURVE.apexOpacity) / 2;
    expect(SHADOW_CURVE.ease).toBeGreaterThan(1);
    expect(half.opacity).toBeGreaterThan(linearMidpoint);
  });

  it('stays fainter at the apex than on the ground', () => {
    expect(SHADOW_CURVE.apexOpacity).toBeLessThan(SHADOW_CURVE.groundOpacity);
  });

  it('keeps the landing squash flatter than it is wide', () => {
    expect(SHADOW_CURVE.landScaleY).toBeLessThan(1);
    expect(SHADOW_CURVE.landScaleX).toBeGreaterThan(1);
  });
});

describe('floating block contact shadows', () => {
  // The blocks hover 275px up, so their shadows should still be visible but
  // clearly weaker than a grounded shadow.
  const block = shadowForHeight(275, APEX);

  it('is visible but weaker than a grounded shadow', () => {
    expect(block.opacity).toBeLessThan(SHADOW_CURVE.groundOpacity);
    expect(block.opacity).toBeGreaterThan(0.2);
  });

  it('is smaller than grounded, so the blocks read as elevated', () => {
    expect(block.scaleX).toBeLessThan(1);
  });
});
