import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WALK_SHEET,
  animationLengthMs,
  backgroundPositionFor,
  frameAtElapsed,
  frameDurationMs,
} from './walk';

const F = WALK_SHEET.frames;
const WALK_RIGHT = WALK_SHEET.animations.walkRight;

describe('WALK_SHEET metadata', () => {
  it('declares the compact 88x170 sheet', () => {
    expect(WALK_SHEET.frameWidth).toBe(88);
    expect(WALK_SHEET.frameHeight).toBe(170);
    expect(WALK_SHEET.imageWidth).toBe(792);
    expect(WALK_SHEET.imageHeight).toBe(340);
  });

  it('has idle and walk animations for both directions', () => {
    expect(WALK_SHEET.animations.idleRight).toEqual([0]);
    expect(WALK_SHEET.animations.idleLeft).toEqual([9]);
    expect(WALK_SHEET.animations.walkRight).toHaveLength(8);
    expect(WALK_SHEET.animations.walkLeft).toHaveLength(8);
  });

  it('keeps every animation index inside the declared frames', () => {
    for (const [name, indices] of Object.entries(WALK_SHEET.animations)) {
      for (const i of indices) {
        expect(i, `${name}[${i}]`).toBeLessThan(F.length);
        expect(i, `${name}[${i}]`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('places each animation row in its own half of the sheet', () => {
    // Row 0 (y=0) faces right, row 1 (y=170) faces left.
    for (const i of WALK_SHEET.animations.walkRight) {
      expect(F[i].y).toBe(0);
    }
    for (const i of WALK_SHEET.animations.walkLeft) {
      expect(F[i].y).toBe(WALK_SHEET.frameHeight);
    }
  });
});

describe('left-facing idle (row 1 anchor)', () => {
  const LEFT_IDLE = F[WALK_SHEET.animations.idleLeft[0]];

  it('sits at column 0 of the left-facing row, a full cell', () => {
    expect(LEFT_IDLE.x).toBe(0);
    expect(LEFT_IDLE.y).toBe(WALK_SHEET.frameHeight); // row 1 starts at y=170
    expect(LEFT_IDLE.width).toBe(WALK_SHEET.frameWidth);
    expect(LEFT_IDLE.height).toBe(WALK_SHEET.frameHeight);
  });

  it('anchors both rows on the same feet/pelvis point, so flipping direction never drifts', () => {
    // The JSON declares a single anchor for the whole sheet: pelvis centred
    // horizontally, feet 6px above the cell bottom. Row 1 is mirrored art of
    // row 0, so the same anchor has to hold for the left-facing idle.
    expect(WALK_SHEET.anchorX).toBe(WALK_SHEET.frameWidth / 2); // 44
    expect(WALK_SHEET.footY).toBe(164);
    expect(WALK_SHEET.frameHeight - WALK_SHEET.footY).toBe(6);
  });

  it('renders the row-1 cell by shifting the sheet up exactly one cell height', () => {
    // At 1:1 the left idle shows sheet column 0, row 1: offset (0, -170).
    // This is the exact background-position the stage renders while idle
    // facing left.
    expect(backgroundPositionFor(LEFT_IDLE, WALK_SHEET, 88, 170)).toBe('0px -170px');
  });
});

describe('frameDurationMs', () => {
  it('uses the per-frame duration when the JSON declares one', () => {
    // Walk frames declare durationMs: 100.
    expect(frameDurationMs(F[WALK_RIGHT[0]], WALK_SHEET.defaultFps)).toBe(100);
  });

  it('falls back to the default fps when durationMs is null (idle frame)', () => {
    const idle = F[WALK_SHEET.animations.idleRight[0]];
    expect(idle.durationMs).toBeNull();
    expect(frameDurationMs(idle, 10)).toBe(100);
  });
});

describe('animationLengthMs', () => {
  it('sums the frame durations of the walk cycle', () => {
    expect(animationLengthMs(WALK_RIGHT, F, 10)).toBe(800); // 8 × 100ms
  });

  it('is zero-safe on an empty animation', () => {
    expect(animationLengthMs([], F, 10)).toBe(0);
  });
});

describe('frameAtElapsed', () => {
  it('shows the first frame at t=0', () => {
    expect(frameAtElapsed(0, WALK_RIGHT, F, 10)).toBe(WALK_RIGHT[0]);
  });

  it('advances one frame per 100ms', () => {
    expect(frameAtElapsed(50, WALK_RIGHT, F, 10)).toBe(WALK_RIGHT[0]);
    expect(frameAtElapsed(150, WALK_RIGHT, F, 10)).toBe(WALK_RIGHT[1]);
    expect(frameAtElapsed(750, WALK_RIGHT, F, 10)).toBe(WALK_RIGHT[7]);
  });

  it('wraps the loop instead of running off the end', () => {
    // Exactly one loop lands back on the first walk frame.
    expect(frameAtElapsed(800, WALK_RIGHT, F, 10)).toBe(WALK_RIGHT[0]);
    // 850ms = 50ms into the second loop: still the first walk frame.
    expect(frameAtElapsed(850, WALK_RIGHT, F, 10)).toBe(WALK_RIGHT[0]);
  });

  it('handles large elapsed times and negative input without leaving the animation', () => {
    for (const t of [-150, 0, 12345, 999999]) {
      const frame = frameAtElapsed(t, WALK_RIGHT, F, 10);
      expect(WALK_RIGHT).toContain(frame);
    }
  });

  it('is safe on an empty animation', () => {
    expect(frameAtElapsed(100, [], F, 10)).toBe(0);
  });
});

describe('backgroundPositionFor', () => {
  it('maps a frame rectangle to a scaled negative offset', () => {
    // The JSON is the source of truth: walkRight[1] lives at sheet x=176
    // (column 2 — column 1 is the idle frame).
    const frame = F[WALK_RIGHT[1]];
    expect(frame.x).toBe(176);
    // Displayed at the same size as the cell -> 1:1, offset = -x.
    expect(backgroundPositionFor(frame, WALK_SHEET, 88, 170)).toBe('-176px 0px');
  });

  it('scales with the display size', () => {
    const frame = F[WALK_RIGHT[1]];
    // Half size: every sheet coordinate halves.
    expect(backgroundPositionFor(frame, WALK_SHEET, 44, 85)).toBe('-88px 0px');
  });

  it('shifts rows for the left-facing animation', () => {
    const frame = F[WALK_SHEET.animations.walkLeft[0]]; // row 1, y = 170
    expect(backgroundPositionFor(frame, WALK_SHEET, 88, 170)).toContain('-170px');
  });
});

// The physics loop advances the walk clock with real dt; keep a rough check
// that a 60fps frame budget selects the right frames across one full loop.
describe('integration: loop cadence at 60fps', () => {
  let t = 0;
  beforeEach(() => {
    vi.restoreAllMocks();
    t = 0;
  });

  it('walks all 8 frames in order across one loop', () => {
    const seen: number[] = [];
    let last = -1;
    for (let step = 0; step < 48; step++) {
      t += 1000 / 60;
      const frame = frameAtElapsed(t, WALK_RIGHT, F, 10);
      if (frame !== last) {
        seen.push(frame);
        last = frame;
      }
    }
    expect(seen).toEqual(WALK_RIGHT);
  });
});
