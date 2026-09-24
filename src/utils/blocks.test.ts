import { describe, expect, it } from 'vitest';
import {
  ALL_BLOCKS_BONUS,
  BLOCK_COIN,
  BLOCK_SCORE,
  BUMP_HINT_RANGE,
  HEAD_BUMP_BOUNCE,
  collectBlock,
  findHeadBumpedBlock,
  nearestBumpTarget,
} from './blocks';
// Centres as actually measured from the rendered flex row in a 1440px stage:
// four 56px blocks with 24px gaps, so the pitch is 80px, not the 70px the old
// duplicated spacing constant assumed.
const MEASURED = [600, 680, 760, 840];

// Collision half-width derived from the measured block width plus a 4px grace.
const RADIUS = 56 / 2 + 4;

const STAGE = {
  blockCentres: MEASURED,
  blockLift: 275,
  radius: RADIUS,
};

describe('findHeadBumpedBlock', () => {
  it('reports the block directly overhead', () => {
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 600, actorHead: 280 })).toEqual({
      index: 0,
      centerX: 600,
    });
  });

  it('finds each block in the row', () => {
    MEASURED.forEach((centerX, index) => {
      const hit = findHeadBumpedBlock({ ...STAGE, actorCenterX: centerX, actorHead: 280 });
      expect(hit).toEqual({ index, centerX });
    });
  });

  it('still collides when the actor is slightly off-centre', () => {
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 615, actorHead: 280 })?.index).toBe(0);
  });

  it('misses when the actor is in the gap between two blocks', () => {
    // 640 is exactly between 600 and 680 — 40px from each, outside the radius.
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 640, actorHead: 280 })).toBeNull();
  });

  it('treats the block radius as exclusive at the exact edge', () => {
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 632, actorHead: 280 })).toBeNull();
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 631, actorHead: 280 })?.index).toBe(0);
  });

  // The bug this replaced: the collision centres were recomputed from a 70px
  // spacing constant, which put block 4's centre at 816 while it is drawn at
  // 840 (spanning 812-868). Everything right of 848 was unreachable — a 20px
  // strip of a visible block that could not be bumped.
  it('registers bumps in the zone the old fixed-spacing layout left dead', () => {
    const deadBefore = 860; // inside the drawn block, 44px from the old centre
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: deadBefore, actorHead: 280 })?.index).toBe(3);
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 820, actorHead: 280 })?.index).toBe(3);
  });

  it('uses the centres it is given, at whatever spacing', () => {
    const uneven = [100, 250, 260, 700];
    expect(
      findHeadBumpedBlock({ ...STAGE, blockCentres: uneven, actorCenterX: 255, actorHead: 280 })
        ?.index,
    ).toBe(1);
  });

  it('misses when the head is below the block band', () => {
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 600, actorHead: 200 })).toBeNull();
  });

  it('misses once the head has passed the band tolerance', () => {
    expect(findHeadBumpedBlock({ ...STAGE, actorCenterX: 600, actorHead: 316 })).toBeNull();
  });

  it('honours a custom tolerance band', () => {
    expect(
      findHeadBumpedBlock({ ...STAGE, actorCenterX: 600, actorHead: 330, tolerance: 60 })?.index,
    ).toBe(0);
  });

  it('returns null when there are no blocks', () => {
    expect(
      findHeadBumpedBlock({ ...STAGE, blockCentres: [], actorCenterX: 600, actorHead: 280 }),
    ).toBeNull();
  });
});

describe('nearestBumpTarget', () => {
  it('hints the block the actor is standing under', () => {
    expect(nearestBumpTarget(600, MEASURED)).toBe(0);
    expect(nearestBumpTarget(838, MEASURED)).toBe(3);
  });

  it('hints nothing outside the range', () => {
    expect(nearestBumpTarget(500, MEASURED)).toBeNull();
    expect(nearestBumpTarget(1000, MEASURED)).toBeNull();
  });

  it('keeps the hint inside what the collision can actually hit', () => {
    // The hint range must never exceed the collision reach (half-width + grace),
    // otherwise it promises bumps the mechanic rejects.
    expect(BUMP_HINT_RANGE).toBeLessThanOrEqual(RADIUS);
  });

  it('picks the first block in a tie', () => {
    // 640 sits exactly between 600 and 680 — reachable only with a widened
    // range, since the default 30 leaves it in the gap.
    expect(nearestBumpTarget(640, MEASURED, 40)).toBe(0);
  });

  it('honours a custom range', () => {
    // 610 is 10px from block 0 and 70px from anything else.
    expect(nearestBumpTarget(610, MEASURED, 10)).toBe(0);
    expect(nearestBumpTarget(610, MEASURED, 9)).toBeNull();
  });

  it('hints nothing when there are no blocks', () => {
    expect(nearestBumpTarget(600, [])).toBeNull();
  });
});

describe('collectBlock', () => {
  it('records a first-time collection', () => {
    const result = collectBlock({}, 'name', 4);
    expect(result.isNew).toBe(true);
    expect(result.total).toBe(1);
    expect(result.allCollected).toBe(false);
    expect(result.collected).toEqual({ name: true });
  });

  it('never mutates the map it was given', () => {
    const collected = {};
    collectBlock(collected, 'name', 4);
    expect(collected).toEqual({});
  });

  it('reports a repeat bump as not new, so points are not awarded twice', () => {
    const collected = { name: true };
    const result = collectBlock(collected, 'name', 4);
    expect(result.isNew).toBe(false);
    expect(result.total).toBe(1);
    // Untouched state is handed straight back, no needless copy.
    expect(result.collected).toBe(collected);
  });

  it('flags the bonus on the collection that completes the set', () => {
    const result = collectBlock({ name: true, role: true, location: true }, 'status', 4);
    expect(result.isNew).toBe(true);
    expect(result.total).toBe(4);
    expect(result.allCollected).toBe(true);
  });

  it('stays complete on later bumps of an already-complete set', () => {
    const complete = { name: true, role: true, location: true, status: true };
    const result = collectBlock(complete, 'name', 4);
    expect(result.isNew).toBe(false);
    expect(result.allCollected).toBe(true);
  });

  it('is never complete when there are no blocks to find', () => {
    expect(collectBlock({}, 'name', 0).allCollected).toBe(false);
  });
});

describe('scoring constants', () => {
  it('awards points and a coin per block, plus a completion bonus', () => {
    expect(BLOCK_SCORE).toBe(50);
    expect(BLOCK_COIN).toBe(1);
    expect(ALL_BLOCKS_BONUS).toBe(500);
  });

  it('bounces the actor downward on a head bump', () => {
    expect(HEAD_BUMP_BOUNCE).toBeLessThan(0);
  });
});
