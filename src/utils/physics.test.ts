import { describe, expect, it } from 'vitest';
import {
  applyFriction,
  blockCenters,
  clampScore,
  clampToStage,
  findOverlappingBlock,
  isHeadBump,
  isInVerticalBand,
  jumpApexHeight,
  rampVelocity,
  resolveBlockCollision,
} from './physics';

describe('clampScore', () => {
  it('adds the amount to the current score', () => {
    expect(clampScore(100, 250)).toBe(350);
  });

  it('stops at the default maximum instead of overflowing', () => {
    expect(clampScore(999_990, 500)).toBe(999_999);
  });

  it('honours a custom maximum', () => {
    expect(clampScore(40, 40, 50)).toBe(50);
  });
});

describe('rampVelocity', () => {
  it('accelerates toward the target', () => {
    expect(rampVelocity(0, 280, 1800, 0.1)).toBe(180);
  });

  it('never overshoots the target', () => {
    expect(rampVelocity(270, 280, 1800, 0.5)).toBe(280);
  });

  it('decelerates from above the target', () => {
    expect(rampVelocity(280, -280, 1800, 0.1)).toBe(100);
  });

  it('is a no-op when already at the target', () => {
    expect(rampVelocity(280, 280, 1800, 0.1)).toBe(280);
  });
});

describe('applyFriction', () => {
  it('bleeds off positive speed', () => {
    expect(applyFriction(200, 2200, 0.05)).toBe(90);
  });

  it('bleeds off negative speed toward zero', () => {
    expect(applyFriction(-200, 2200, 0.05)).toBe(-90);
  });

  it('snaps to a full stop below the threshold so the sprite never crawls', () => {
    expect(applyFriction(4, 2200, 0.01)).toBe(0);
    expect(applyFriction(-4, 2200, 0.01)).toBe(0);
  });

  it('leaves zero untouched', () => {
    expect(applyFriction(0, 2200, 0.05)).toBe(0);
  });
});

describe('jumpApexHeight', () => {
  it('follows h = v^2 / 2g', () => {
    expect(jumpApexHeight(10, 10)).toBe(5);
  });

  it('returns Infinity for non-positive gravity rather than dividing by zero', () => {
    expect(jumpApexHeight(10, 0)).toBe(Infinity);
    expect(jumpApexHeight(10, -5)).toBe(Infinity);
  });

  // Regression guard: the stage raises the character to the overhead blocks
  // (BLOCK_Y = 300 in ArcadeStage). Keep these in sync with JUMP_V / GRAVITY.
  it('still clears the 300px overhead block band with the configured jump', () => {
    expect(jumpApexHeight(1100, 1950)).toBeGreaterThan(300);
  });
});

describe('blockCenters', () => {
  it('returns an empty list when there are no blocks', () => {
    expect(blockCenters(1000, 0, 70)).toEqual([]);
  });

  it('centres the group within the stage width', () => {
    expect(blockCenters(1000, 4, 70)).toEqual([386, 456, 526, 596]);
  });

  it('applies the default offset of 26px', () => {
    expect(blockCenters(400, 1, 70)).toEqual([191]);
  });

  it('applies a custom offset', () => {
    expect(blockCenters(400, 1, 70, 0)).toEqual([165]);
  });
});

describe('isInVerticalBand', () => {
  it('is true when the spans overlap', () => {
    expect(isInVerticalBand(0, 175, 275, 331)).toBe(false);
    expect(isInVerticalBand(150, 320, 275, 331)).toBe(true);
  });

  it('is false when the spans merely touch', () => {
    expect(isInVerticalBand(0, 275, 275, 331)).toBe(false);
  });
});

describe('findOverlappingBlock', () => {
  const blocks = [300, 400, 500];

  it('finds the index of the overlapping block', () => {
    expect(findOverlappingBlock(280, 352, blocks, 32)).toBe(0);
    expect(findOverlappingBlock(455, 527, blocks, 32)).toBe(2);
  });

  it('returns -1 when nothing overlaps', () => {
    expect(findOverlappingBlock(0, 72, blocks, 32)).toBe(-1);
  });

  it('treats the block radius as inclusive', () => {
    // Actor's left edge sits exactly on the block's left face.
    expect(findOverlappingBlock(268, 340, blocks, 32)).toBe(0);
    // Actor's right edge stops just short of that face.
    expect(findOverlappingBlock(150, 222, blocks, 32)).toBe(-1);
  });

  it('returns -1 for an empty block list', () => {
    expect(findOverlappingBlock(0, 72, [], 32)).toBe(-1);
  });
});

describe('resolveBlockCollision', () => {
  it('places the actor flush against the left face when moving right', () => {
    expect(resolveBlockCollision(300, 72, 400, 32, true)).toBe(296);
  });

  it('places the actor flush against the right face when moving left', () => {
    expect(resolveBlockCollision(420, 72, 400, 32, false)).toBe(432);
  });
});

describe('clampToStage', () => {
  it('keeps the actor inside the stage', () => {
    expect(clampToStage(5000, 1000, 72)).toBe(916);
    expect(clampToStage(-50, 1000, 72)).toBe(12);
  });

  it('leaves in-range positions alone', () => {
    expect(clampToStage(400, 1000, 72)).toBe(400);
  });

  it('never returns a negative margin on a tiny stage', () => {
    expect(clampToStage(-10, 40, 72)).toBe(12);
  });
});

describe('isHeadBump', () => {
  it('registers a bump from underneath the block band', () => {
    expect(isHeadBump(275, 275)).toBe(true);
    expect(isHeadBump(300, 275)).toBe(true);
  });

  it('ignores heads that are too far below or past the tolerance', () => {
    expect(isHeadBump(200, 275)).toBe(false);
    expect(isHeadBump(316, 275)).toBe(false);
  });

  it('honours a custom tolerance', () => {
    expect(isHeadBump(320, 275, 60)).toBe(true);
  });
});

// nearestBlockDistance was removed: nothing consumed it. The gameplay-facing
// "which block am I under" query lives in blocks.ts as nearestBumpTarget().
