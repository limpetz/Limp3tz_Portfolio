import { describe, it, expect } from 'vitest';
import {
  MUSHROOM_ANIM,
  MUSHROOM_SPEED,
  MUSHROOM_STATE_SECONDS,
  MUSHROOM_WIDTH,
  mushroomFrameIndex,
  mushroomSpawn,
  playerSpawnX,
  resolveMushroomMotion,
  safeZoneBounds,
  type MushroomState,
} from './mushroom';

describe('playerSpawnX', () => {
  it('centres the player, offset for the actor box', () => {
    expect(playerSpawnX(1000)).toBe(440);
    expect(playerSpawnX(1366)).toBe(623);
    expect(playerSpawnX(2000)).toBe(940);
  });

  it('never returns a negative x on a tiny stage', () => {
    expect(playerSpawnX(200)).toBe(40);
    expect(playerSpawnX(0)).toBe(20);
  });
});

describe('safeZoneBounds', () => {
  it('is centred on the spawn', () => {
    const { min, max } = safeZoneBounds(640, 1400);
    expect(min).toBe(640 - 140);
    expect(max).toBe(640 + 140);
    expect((min + max) / 2).toBe(640);
  });

  it('caps the half-width at 140 on wide stages', () => {
    const { min, max } = safeZoneBounds(900, 2000);
    expect(max - min).toBe(280);
  });

  it('keeps a floor half-width of 60 on narrow stages', () => {
    const { min, max } = safeZoneBounds(190, 500);
    expect(max - min).toBeGreaterThanOrEqual(60);
  });

  it('never extends past the wall the actor is clamped to', () => {
    const stageWidth = 2000;
    const wallRight = stageWidth - 72 - 12;
    const { max } = safeZoneBounds(1900, stageWidth);
    expect(max).toBe(wallRight);
  });

  it('always yields min >= 12 and max > min across stage widths', () => {
    for (const w of [200, 320, 375, 500, 768, 1024, 1366, 1920, 2560]) {
      const spawnX = playerSpawnX(w);
      const { min, max } = safeZoneBounds(spawnX, w);
      expect(min).toBeGreaterThanOrEqual(12);
      expect(max).toBeGreaterThan(min);
    }
  });

  it('leaves room for a monster to the right of the zone and before the wall', () => {
    for (const w of [375, 768, 1366, 1920]) {
      const spawnX = playerSpawnX(w);
      const { max } = safeZoneBounds(spawnX, w);
      const monsterWall = w - MUSHROOM_WIDTH - 24;
      // The monster's wall must sit beyond the zone, or the two rules would
      // fight and trap the monster (the narrow-screen bug).
      expect(monsterWall).toBeGreaterThan(max);
    }
  });
});

describe('mushroomFrameIndex', () => {
  it('loops run frames (8 frames @ 10fps)', () => {
    expect(mushroomFrameIndex('run', 0)).toBe(0);
    expect(mushroomFrameIndex('run', 0.1)).toBe(1);
    expect(mushroomFrameIndex('run', 0.7)).toBe(7);
    expect(mushroomFrameIndex('run', 0.8)).toBe(0);
    expect(mushroomFrameIndex('run', 1.7)).toBe(1);
  });

  it('loops idle frames (7 frames @ 9fps)', () => {
    expect(mushroomFrameIndex('idle', 0)).toBe(0);
    expect(mushroomFrameIndex('idle', 0.7)).toBe(6);
    expect(mushroomFrameIndex('idle', 0.8)).toBe(0);
  });

  it('clamps one-shot states on their final frame', () => {
    expect(mushroomFrameIndex('die', 0)).toBe(0);
    expect(mushroomFrameIndex('die', 0.08)).toBe(1);
    expect(mushroomFrameIndex('die', 5)).toBe(14);
    expect(mushroomFrameIndex('hit', 2)).toBe(4);
    expect(mushroomFrameIndex('attack', 2)).toBe(9);
  });

  it('stays within [0, frames - 1] for every state and timer', () => {
    const states = Object.keys(MUSHROOM_ANIM) as MushroomState[];
    for (const state of states) {
      for (const t of [0, 0.01, 0.5, 1.2, 4, 12.7]) {
        const frame = mushroomFrameIndex(state, t);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(MUSHROOM_ANIM[state].frames);
        expect(Number.isInteger(frame)).toBe(true);
      }
    }
  });
});

describe('MUSHROOM_STATE_SECONDS', () => {
  it('derives one-shot durations from frames / fps', () => {
    expect(MUSHROOM_STATE_SECONDS.die).toBeCloseTo(1.2, 5);
    expect(MUSHROOM_STATE_SECONDS.hit).toBeCloseTo(5 / 12, 5);
    expect(MUSHROOM_STATE_SECONDS.attack).toBeCloseTo(10 / 12, 5);
  });

  it('lets looping states run forever', () => {
    expect(MUSHROOM_STATE_SECONDS.run).toBe(Infinity);
    expect(MUSHROOM_STATE_SECONDS.idle).toBe(Infinity);
  });
});

describe('mushroomSpawn', () => {
  it('starts at the far wall, opposite the safe zone', () => {
    const stageWidth = 1400;
    const zoneMax = safeZoneBounds(playerSpawnX(stageWidth), stageWidth).max;
    const spawn = mushroomSpawn(stageWidth, zoneMax);
    expect(spawn.x).toBe(stageWidth - MUSHROOM_WIDTH - 24);
    expect(spawn.x).toBeGreaterThan(zoneMax);
  });

  it('patrols left, facing left, idling on arrival', () => {
    const spawn = mushroomSpawn(1000, 580);
    expect(spawn.vx).toBe(-MUSHROOM_SPEED);
    expect(spawn.facing).toBe(-1);
    expect(spawn.state).toBe('idle');
    expect(spawn.frameIndex).toBe(0);
  });

  it('never places the monster inside the safe zone, even on a tiny stage', () => {
    // rightWall (32) is left of the zone edge (200): the clamp keeps it clear.
    const spawn = mushroomSpawn(100, 200);
    expect(spawn.x).toBeGreaterThanOrEqual(200);
  });

  it('keeps the body inside the stage walls on real widths', () => {
    for (const w of [375, 768, 1366, 1920]) {
      const zoneMax = safeZoneBounds(playerSpawnX(w), w).max;
      const spawn = mushroomSpawn(w, zoneMax);
      expect(spawn.x).toBeGreaterThanOrEqual(zoneMax);
      expect(spawn.x).toBeLessThanOrEqual(w - MUSHROOM_WIDTH - 24);
    }
  });
});

describe('resolveMushroomMotion', () => {
  const zone = { min: 400, max: 600 };

  it('repels a monster moving left into the zone, sending it back right', () => {
    const out = resolveMushroomMotion({
      x: 610,
      vx: -60,
      width: MUSHROOM_WIDTH,
      dt: 0.5,
      stageWidth: 1000,
      safeZone: zone,
    });
    expect(out.x).toBe(zone.max);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.facing).toBe(1);
  });

  it('ejects left when there is room on the left', () => {
    const out = resolveMushroomMotion({
      x: 380,
      vx: 60,
      width: MUSHROOM_WIDTH,
      dt: 0.5,
      stageWidth: 1000,
      safeZone: zone,
    });
    expect(out.x).toBe(zone.min - MUSHROOM_WIDTH);
    expect(out.vx).toBeLessThan(0);
    expect(out.facing).toBe(-1);
  });

  it('ejects right when there is no room to the left of the zone', () => {
    const out = resolveMushroomMotion({
      x: 20,
      vx: 60,
      width: MUSHROOM_WIDTH,
      dt: 0.5,
      stageWidth: 400,
      safeZone: { min: 25, max: 200 },
    });
    expect(out.x).toBe(200);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.facing).toBe(1);
  });

  it('bounces off the far wall without entering the zone', () => {
    const wallRight = 1000 - MUSHROOM_WIDTH - 24;
    const out = resolveMushroomMotion({
      x: 950,
      vx: 60,
      width: MUSHROOM_WIDTH,
      dt: 1,
      stageWidth: 1000,
      safeZone: zone,
    });
    expect(out.x).toBe(wallRight);
    expect(out.vx).toBeLessThan(0);
    expect(out.facing).toBe(-1);
  });

  it('always derives facing from the final velocity', () => {
    for (const vx of [-120, -60, 60, 120]) {
      for (const x of [50, 300, 500, 700, 950]) {
        const out = resolveMushroomMotion({
          x,
          vx,
          width: MUSHROOM_WIDTH,
          dt: 0.25,
          stageWidth: 1000,
          safeZone: zone,
        });
        expect(out.facing).toBe(out.vx >= 0 ? 1 : -1);
      }
    }
  });

  it('never leaves the body overlapping the safe zone', () => {
    const inside = (x: number) => x + MUSHROOM_WIDTH > zone.min && x < zone.max;
    let x = 620;
    let vx = -60;
    for (let i = 0; i < 2000; i++) {
      const out = resolveMushroomMotion({
        x,
        vx,
        width: MUSHROOM_WIDTH,
        dt: 1 / 60,
        stageWidth: 1000,
        safeZone: zone,
      });
      x = out.x;
      vx = out.vx;
      expect(inside(x)).toBe(false);
    }
  });

  it('patrols in a loop: turns at the safe zone and at the far wall', () => {
    const stageWidth = 1000;
    const wallRight = stageWidth - MUSHROOM_WIDTH - 24;
    let { x, vx } = mushroomSpawn(stageWidth, zone.max);
    let minX = x;
    let maxX = x;
    let sawLeft = false;
    let sawRight = false;

    for (let i = 0; i < 60 * 90; i++) {
      const out = resolveMushroomMotion({
        x,
        vx,
        width: MUSHROOM_WIDTH,
        dt: 1 / 60,
        stageWidth,
        safeZone: zone,
      });
      x = out.x;
      vx = out.vx;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      if (out.facing === -1) sawLeft = true;
      if (out.facing === 1) sawRight = true;
    }

    // It reaches the safe-zone edge (turns around there) ...
    expect(minX).toBeGreaterThanOrEqual(zone.max);
    expect(minX).toBeLessThanOrEqual(zone.max + 2);
    // ... and the far wall, and travels both ways.
    expect(maxX).toBeGreaterThanOrEqual(wallRight - 2);
    expect(sawLeft).toBe(true);
    expect(sawRight).toBe(true);
  });
});
