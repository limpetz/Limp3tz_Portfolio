import { describe, expect, it } from 'vitest';
import {
  CHARACTER_SPRITE,
  spriteCanvasSize,
  spritePlacement,
} from './sprite';

// Stage values: the character renders 172px tall on a 72px collision box.
const STAGE_VISIBLE_H = 172;
const ACTOR_W = 72;
// CharacterSheet value: the portrait's visible height.
const PORTRAIT_VISIBLE_H = 301;

describe('CHARACTER_SPRITE metrics', () => {
  // Deliberate tripwire: these are the *measured* numbers for the shipped art.
  // If the sprite is replaced, re-measure and update CHARACTER_SPRITE — and this
  // test — rather than quietly shifting the character's on-screen size.
  it('records the measured artwork', () => {
    expect(CHARACTER_SPRITE).toEqual({
      frameW: 799,
      frameH: 1967,
      contentW: 769,
      contentH: 1778,
      padLeft: 14,
      padTop: 93,
      padRight: 16,
      padBottom: 96,
    });
  });

  it('has content that fits inside the canvas', () => {
    const m = CHARACTER_SPRITE;
    expect(m.contentW).toBeLessThanOrEqual(m.frameW);
    expect(m.contentH).toBeLessThanOrEqual(m.frameH);
  });

  it('has padding that adds back up to the full canvas', () => {
    const m = CHARACTER_SPRITE;
    expect(m.padLeft + m.contentW + m.padRight).toBe(m.frameW);
    expect(m.padTop + m.contentH + m.padBottom).toBe(m.frameH);
  });

  it('describes a portrait canvas, which is why width cannot imply height', () => {
    expect(CHARACTER_SPRITE.frameH).toBeGreaterThan(CHARACTER_SPRITE.frameW);
  });
});

describe('spriteCanvasSize', () => {
  it('sizes the stage canvas so the visible character hits 172px', () => {
    expect(spriteCanvasSize(STAGE_VISIBLE_H)).toEqual({ width: 77, height: 190 });
  });

  it('sizes the CharacterSheet canvas so the portrait hits 301px', () => {
    expect(spriteCanvasSize(PORTRAIT_VISIBLE_H)).toEqual({ width: 135, height: 333 });
  });

  it('preserves the artwork aspect ratio', () => {
    const { width, height } = spriteCanvasSize(STAGE_VISIBLE_H);
    const sourceRatio = CHARACTER_SPRITE.frameW / CHARACTER_SPRITE.frameH;
    expect(width / height).toBeCloseTo(sourceRatio, 1);
  });

  it('scales linearly, up to whole-pixel rounding', () => {
    const single = spriteCanvasSize(172);
    const double = spriteCanvasSize(344);
    expect(Math.abs(double.height - 2 * single.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(double.width - 2 * single.width)).toBeLessThanOrEqual(1);
  });

  it('produces a canvas taller than wide, matching the portrait art', () => {
    const { width, height } = spriteCanvasSize(STAGE_VISIBLE_H);
    expect(height).toBeGreaterThan(width);
  });
});

describe('spritePlacement', () => {
  const placement = spritePlacement(ACTOR_W, STAGE_VISIBLE_H);
  const scale = STAGE_VISIBLE_H / CHARACTER_SPRITE.contentH;

  it('centres the visible character on the actor box', () => {
    const contentLeft = placement.left + CHARACTER_SPRITE.padLeft * scale;
    const contentCentre = contentLeft + placement.visibleWidth / 2;
    expect(contentCentre).toBeCloseTo(ACTOR_W / 2, 0);
  });

  it('lands the feet on the box bottom, not on the canvas bottom', () => {
    const feetFromBoxBottom = placement.bottom + CHARACTER_SPRITE.padBottom * scale;
    expect(feetFromBoxBottom).toBeCloseTo(0, 0);
  });

  it('reports the visible character size the caller asked for', () => {
    expect(placement.visibleHeight).toBeCloseTo(STAGE_VISIBLE_H, 5);
    expect(placement.visibleWidth).toBeCloseTo(74.4, 1);
  });

  it('keeps the visible character wider than the collision box, so the art may overhang', () => {
    expect(placement.visibleWidth).toBeGreaterThan(ACTOR_W);
  });

  it('matches the offsets the stage renders with', () => {
    expect(placement.left).toBe(-3);
    expect(placement.bottom).toBe(-9);
  });

  it('shifts left as the actor box narrows', () => {
    const narrower = spritePlacement(40, STAGE_VISIBLE_H);
    expect(narrower.left).toBeLessThan(placement.left);
    expect(narrower.visibleWidth).toBeCloseTo(placement.visibleWidth, 5);
  });
});
