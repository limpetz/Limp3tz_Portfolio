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
  it('declares the 240px-pack walk sheet', () => {
    expect(WALK_SHEET.frameWidth).toBe(172);
    expect(WALK_SHEET.frameHeight).toBe(330);
    expect(WALK_SHEET.imageWidth).toBe(1548);
    expect(WALK_SHEET.imageHeight).toBe(660);
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
    // Row 0 (y=0) faces right, row 1 (y=330) faces left.
    for (const i of WALK_SHEET.animations.walkRight) {
      expect(F[i].y).toBe(0);
    }
    for (const i of WALK_SHEET.animations.walkLeft) {
      expect(F[i].y).toBe(WALK_SHEET.frameHeight);
    }
  });

  it('plays the artist gait so both footfalls land (regression)', () => {
    // The sheet was relaid out so column N holds the Nth gait pose and the
    // JSON reads 1..8 sequentially. Footfall columns were identified with the
    // foot-pixel probe (scripts/foot-probe.mjs) and are enforced in CI by
    // scripts/check-gait.mjs: contact #1 = col 1, second contact = col 5,
    // push-off contact = col 7.
    expect(WALK_RIGHT).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(F[WALK_RIGHT[0]].x).toBe(172); // first footfall: feet planted apart
    expect(F[WALK_RIGHT[4]].x).toBe(860); // second footfall, mid-cycle
    expect(WALK_SHEET.animations.walkLeft).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
  });
});

describe('left-facing idle (row 1 anchor)', () => {
  const LEFT_IDLE = F[WALK_SHEET.animations.idleLeft[0]];

  it('sits at column 0 of the left-facing row, a full cell', () => {
    expect(LEFT_IDLE.x).toBe(0);
    expect(LEFT_IDLE.y).toBe(WALK_SHEET.frameHeight); // row 1 starts at y=330
    expect(LEFT_IDLE.width).toBe(WALK_SHEET.frameWidth);
    expect(LEFT_IDLE.height).toBe(WALK_SHEET.frameHeight);
  });

  it('anchors both rows on the same feet/pelvis point, so flipping direction never drifts', () => {
    // The JSON declares a single anchor for the whole sheet: pelvis centred
    // horizontally, feet 12px above the cell bottom. Row 1 is mirrored art of
    // row 0, so the same anchor has to hold for the left-facing idle.
    expect(WALK_SHEET.anchorX).toBe(WALK_SHEET.frameWidth / 2); // 86
    expect(WALK_SHEET.footY).toBe(318);
    expect(WALK_SHEET.frameHeight - WALK_SHEET.footY).toBe(12);
  });

  it('renders the row-1 cell by shifting the sheet up exactly one cell height', () => {
    // At 1:1 the left idle shows sheet column 0, row 1: offset (0, -330).
    // This is the exact background-position the stage renders while idle
    // facing left.
    expect(backgroundPositionFor(LEFT_IDLE, WALK_SHEET, 172, 330)).toBe('0px -330px');
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
    // The JSON is the source of truth. The sheet is relaid out in true gait
    // order, so walkRight = frame indices 1..8 and WALK_RIGHT[1] is frame
    // index 2, i.e. sheet column 2 at x = 344.
    const frame = F[WALK_RIGHT[1]];
    expect(frame.x).toBe(344);
    // Displayed at the same size as the cell -> 1:1, offset = -x.
    expect(backgroundPositionFor(frame, WALK_SHEET, 172, 330)).toBe('-344px 0px');
  });

  it('scales with the display size', () => {
    const frame = F[WALK_RIGHT[1]]; // sheet x = 344
    // Half size: every sheet coordinate halves.
    expect(backgroundPositionFor(frame, WALK_SHEET, 86, 165)).toBe('-172px 0px');
  });

  it('shifts rows for the left-facing animation', () => {
    const frame = F[WALK_SHEET.animations.walkLeft[0]]; // row 1, y = 330
    expect(backgroundPositionFor(frame, WALK_SHEET, 172, 330)).toContain('-330px');
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
