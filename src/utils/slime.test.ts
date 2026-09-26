import { describe, it, expect } from 'vitest';
import {
  ACTOR_WIDTH,
  SLIME_ANIM,
  SLIME_CELL,
  SLIME_CORRIDOR_TRAVEL,
  SLIME_ROSTER,
  SLIME_SHEET_COLS,
  SLIME_SHEET_ROWS,
  SLIME_HEIGHT,
  SLIME_NARROW_HEIGHT,
  SLIME_NARROW_STAGE_WIDTH,
  SLIME_NARROW_WIDTH,
  SLIME_SIDE_STAGGER,
  SLIME_SLOT_SPEED,
  SLIME_STATE_SECONDS,
  SLIME_WIDTH,
  slimeBoxFor,
  playerSpawnX,
  resolveSlimeMotion,
  safeZoneBounds,
  slimeFrameCell,
  slimeFrameIndex,
  slimeRoster,
  slimeSpawn,
  type SlimeState,
} from './slime';

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

  it('leaves room for a slime to the right of the zone and before the wall', () => {
    for (const w of [375, 768, 1366, 1920]) {
      const spawnX = playerSpawnX(w);
      const { max } = safeZoneBounds(spawnX, w);
      const slimeWall = w - slimeBoxFor(w).width - 24;
      // The slime's wall must sit beyond the zone, or the two rules would
      // fight and trap the slime (the narrow-screen bug).
      expect(slimeWall).toBeGreaterThan(max);
    }
  });

  it('leaves the left pair a lane to patrol on phone-width stages', () => {
    for (const w of [320, 360, 375, 390, 414, 428, 480, 620, 768]) {
      const spawnX = playerSpawnX(w);
      const { min, max } = safeZoneBounds(spawnX, w);
      // The zone's left edge must sit clear of the body by a full run, or the
      // wall and zone rules clamp a left-side slime to one x and it burns every
      // tick "walking" into the wall instead of patrolling.
      expect(min - slimeBoxFor(w).width).toBeGreaterThanOrEqual(SLIME_CORRIDOR_TRAVEL);
      // ... and the player still spawns inside their own safe zone.
      expect(min).toBeLessThanOrEqual(spawnX);
      expect(max).toBeGreaterThanOrEqual(spawnX);
    }
  });

  it('keeps its full right half on a phone-width stage', () => {
    for (const w of [320, 360, 375, 390, 414, 428, 480]) {
      const spawnX = playerSpawnX(w);
      const { min, max } = safeZoneBounds(spawnX, w);
      const half = Math.min(140, Math.max(60, w * 0.2));
      // Only the left half is ever trimmed — the right half is room the
      // right-hand pair can spare, so the zone keeps all of it.
      expect(max - spawnX).toBeGreaterThanOrEqual(half - 1e-6);
      // And the whole zone still comfortably holds the actor.
      expect(max - min).toBeGreaterThanOrEqual(ACTOR_WIDTH);
    }
  });

  it('gives the slimes a smaller body on narrow stages', () => {
    expect(slimeBoxFor(SLIME_NARROW_STAGE_WIDTH - 1)).toEqual({
      width: SLIME_NARROW_WIDTH,
      height: SLIME_NARROW_HEIGHT,
    });
    expect(slimeBoxFor(SLIME_NARROW_STAGE_WIDTH)).toEqual({
      width: SLIME_WIDTH,
      height: SLIME_HEIGHT,
    });
  });

  it('trades hazard size, not safe-zone width, on a phone-width stage', () => {
    // Without the narrow body the left lane would have to come out of the
    // zone's own half-width; with it the zone is back to its full reach.
    const w = 375;
    const spawnX = playerSpawnX(w);
    const half = Math.min(140, Math.max(60, w * 0.2));
    const { min, max } = safeZoneBounds(spawnX, w);
    expect(spawnX - min).toBeLessThan(half);
    expect(spawnX - min).toBeGreaterThan(half - 5);
    expect(max - spawnX).toBeGreaterThanOrEqual(half);
  });
});

describe('slime sheets', () => {
  it('is a 4x4 grid of 32px cells', () => {
    expect(SLIME_CELL).toBe(32);
    expect(SLIME_SHEET_COLS).toBe(4);
    expect(SLIME_SHEET_ROWS).toBe(4);
  });

  it('slimeFrameCell splits a flat index back into row / column', () => {
    expect(slimeFrameCell(0)).toEqual({ row: 0, col: 0 });
    expect(slimeFrameCell(3)).toEqual({ row: 0, col: 3 });
    expect(slimeFrameCell(4)).toEqual({ row: 1, col: 0 });
    expect(slimeFrameCell(6)).toEqual({ row: 1, col: 2 });
    expect(slimeFrameCell(7)).toEqual({ row: 1, col: 3 });
  });
});

describe('slimeFrameIndex', () => {
  it('loops the idle pulse on sheet row 0 (4 frames @ 6fps)', () => {
    expect(slimeFrameIndex('idle', 0)).toBe(0);
    expect(slimeFrameIndex('idle', 1 / 6)).toBe(1);
    expect(slimeFrameIndex('idle', 0.5)).toBe(3);
    expect(slimeFrameIndex('idle', 4 / 6)).toBe(0);
    expect(slimeFrameIndex('idle', 0.7)).toBe(0);
  });

  it('loops the move cycle on sheet row 1 (4 frames @ 8fps)', () => {
    expect(slimeFrameIndex('run', 0)).toBe(4);
    expect(slimeFrameIndex('run', 0.125)).toBe(5);
    expect(slimeFrameIndex('run', 0.3)).toBe(6);
    expect(slimeFrameIndex('run', 0.5)).toBe(4);
  });

  it('clamps one-shot states on their final frame', () => {
    expect(slimeFrameIndex('attack', 0)).toBe(4);
    expect(slimeFrameIndex('attack', 2)).toBe(7);
    expect(slimeFrameIndex('hit', 0)).toBe(6);
    expect(slimeFrameIndex('hit', 2)).toBe(6);
    expect(slimeFrameIndex('die', 0)).toBe(4);
    expect(slimeFrameIndex('die', 5)).toBe(7);
  });

  it('always maps a state to a valid cell on that state’s own row', () => {
    const states = Object.keys(SLIME_ANIM) as SlimeState[];
    for (const state of states) {
      for (const t of [0, 0.01, 0.5, 1.2, 4, 12.7]) {
        const frame = slimeFrameIndex(state, t);
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(SLIME_SHEET_ROWS * SLIME_SHEET_COLS);
        expect(slimeFrameCell(frame).row).toBe(SLIME_ANIM[state].row);
      }
    }
  });
});

describe('SLIME_STATE_SECONDS', () => {
  it('derives the attack beat from frames / fps', () => {
    expect(SLIME_STATE_SECONDS.attack).toBeCloseTo(4 / 16, 5);
  });

  it('keeps the stagger and death beats short', () => {
    expect(SLIME_STATE_SECONDS.hit).toBeCloseTo(0.3, 5);
    expect(SLIME_STATE_SECONDS.die).toBeCloseTo(1.2, 5);
  });

  it('lets looping states run forever', () => {
    expect(SLIME_STATE_SECONDS.run).toBe(Infinity);
    expect(SLIME_STATE_SECONDS.idle).toBe(Infinity);
  });
});

describe('slimeSpawn', () => {
  const zone = { min: 300, max: 580 };

  it('starts the left pair on the left wall, walking inward', () => {
    const a = slimeSpawn({ side: 'left', slot: 0, color: 'blue', stageWidth: 1000, safeZone: zone });
    const b = slimeSpawn({ side: 'left', slot: 1, color: 'green', stageWidth: 1000, safeZone: zone });
    expect(a.x).toBe(24);
    expect(b.x).toBe(24 + SLIME_SIDE_STAGGER);
    expect(a.vx).toBeGreaterThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.facing).toBe(1);
    // Both sit clear of the zone.
    expect(a.x + SLIME_WIDTH).toBeLessThanOrEqual(zone.min);
    expect(b.x + SLIME_WIDTH).toBeLessThanOrEqual(zone.min);
  });

  it('starts the right pair on the right wall, walking inward', () => {
    const a = slimeSpawn({ side: 'right', slot: 0, color: 'red', stageWidth: 1000, safeZone: zone });
    const b = slimeSpawn({ side: 'right', slot: 1, color: 'white', stageWidth: 1000, safeZone: zone });
    expect(a.x).toBe(1000 - SLIME_WIDTH - 24);
    expect(b.x).toBe(1000 - SLIME_WIDTH - 24 - SLIME_SIDE_STAGGER);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeLessThan(0);
    expect(a.facing).toBe(-1);
    expect(a.x).toBeGreaterThanOrEqual(zone.max);
    expect(b.x).toBeGreaterThanOrEqual(zone.max);
  });

  it('idles on arrival at frame 0', () => {
    const spawn = slimeSpawn({ side: 'left', slot: 0, color: 'blue', stageWidth: 1000, safeZone: zone });
    expect(spawn.state).toBe('idle');
    expect(spawn.frameIndex).toBe(0);
    expect(spawn.animTimer).toBe(0);
    expect(spawn.stateTimer).toBe(0);
  });

  it('carries its colour, side and slot so a respawn can rebuild it', () => {
    const spawn = slimeSpawn({ side: 'right', slot: 1, color: 'white', stageWidth: 1000, safeZone: zone });
    expect(spawn.color).toBe('white');
    expect(spawn.side).toBe('right');
    expect(spawn.slot).toBe(1);
  });

  it('starts every slime clear of the safe zone on real stages', () => {
    for (const w of [375, 768, 1366, 1920, 2560]) {
      const stageZone = safeZoneBounds(playerSpawnX(w), w);
      const box = slimeBoxFor(w);
      for (const entry of SLIME_ROSTER) {
        const spawn = slimeSpawn({ ...entry, stageWidth: w, safeZone: stageZone });
        expect(spawn.width).toBe(box.width);
        if (entry.side === 'left') {
          expect(spawn.x + box.width).toBeLessThanOrEqual(stageZone.min + 1e-6);
        } else {
          expect(spawn.x).toBeGreaterThanOrEqual(stageZone.max);
        }
      }
    }
  });

  it('stays on-stage on a degenerate narrow stage, where the zone leaves no room', () => {
    // On a 100px stage the zone spans almost the whole width, so no 44px body
    // can sit clear of it: the on-stage clamp wins, and the first resolved tick
    // ejects the slime instead.
    const spawn = slimeSpawn({
      side: 'right',
      slot: 0,
      color: 'red',
      stageWidth: 100,
      safeZone: { min: 25, max: 200 },
    });
    expect(spawn.x).toBeGreaterThanOrEqual(0);
    expect(spawn.x).toBeLessThanOrEqual(100 - slimeBoxFor(100).width);
  });

  it('keeps every spawned body on-stage across real widths', () => {
    for (const w of [320, 375, 768, 1366, 1920, 2560]) {
      const zone2 = safeZoneBounds(playerSpawnX(w), w);
      for (const entry of SLIME_ROSTER) {
        const spawn = slimeSpawn({ ...entry, stageWidth: w, safeZone: zone2 });
        expect(spawn.x).toBeGreaterThanOrEqual(0);
        expect(spawn.x).toBeLessThanOrEqual(w - slimeBoxFor(w).width);
      }
    }
  });

  it('gives the two slimes sharing a side different speeds', () => {
    // Equal speeds would land both bodies on the same clamped x at every turn
    // and merge them into one sprite.
    expect(SLIME_SLOT_SPEED[0]).not.toBe(SLIME_SLOT_SPEED[1]);
    const a = slimeSpawn({ side: 'left', slot: 0, color: 'blue', stageWidth: 1000, safeZone: zone });
    const b = slimeSpawn({ side: 'left', slot: 1, color: 'green', stageWidth: 1000, safeZone: zone });
    expect(Math.abs(a.vx)).not.toBe(Math.abs(b.vx));
  });
});

describe('slimeRoster', () => {
  const zone = { min: 300, max: 580 };

  it('returns four slimes: two per side, one colour each', () => {
    const roster = slimeRoster(1000, zone);
    expect(roster).toHaveLength(4);
    expect(roster.filter((s) => s.side === 'left')).toHaveLength(2);
    expect(roster.filter((s) => s.side === 'right')).toHaveLength(2);
    expect(new Set(roster.map((s) => s.color)).size).toBe(4);
    expect(new Set(roster.map((s) => s.color))).toEqual(
      new Set(['blue', 'green', 'red', 'white']),
    );
  });

  it('gives every slime a distinct slot on its side', () => {
    const roster = slimeRoster(1000, zone);
    for (const side of ['left', 'right'] as const) {
      const slots = roster.filter((s) => s.side === side).map((s) => s.slot);
      expect(new Set(slots).size).toBe(2);
    }
  });
});

describe('resolveSlimeMotion', () => {
  const zone = { min: 400, max: 600 };

  it('repels a slime moving left into the zone, sending it back right', () => {
    const out = resolveSlimeMotion({
      x: 610,
      vx: -60,
      width: SLIME_WIDTH,
      dt: 0.5,
      stageWidth: 1000,
      safeZone: zone,
    });
    expect(out.x).toBe(zone.max);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.facing).toBe(1);
  });

  it('ejects left when there is room on the left', () => {
    const out = resolveSlimeMotion({
      x: 380,
      vx: 60,
      width: SLIME_WIDTH,
      dt: 0.5,
      stageWidth: 1000,
      safeZone: zone,
    });
    expect(out.x).toBe(zone.min - SLIME_WIDTH);
    expect(out.vx).toBeLessThan(0);
    expect(out.facing).toBe(-1);
  });

  it('ejects right when there is no room to the left of the zone', () => {
    const out = resolveSlimeMotion({
      x: 20,
      vx: 60,
      width: SLIME_WIDTH,
      dt: 0.5,
      stageWidth: 400,
      safeZone: { min: 25, max: 200 },
    });
    expect(out.x).toBe(200);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.facing).toBe(1);
  });

  it('bounces off the far wall without entering the zone', () => {
    const wallRight = 1000 - SLIME_WIDTH - 24;
    const out = resolveSlimeMotion({
      x: 950,
      vx: 60,
      width: SLIME_WIDTH,
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
        const out = resolveSlimeMotion({
          x,
          vx,
          width: SLIME_WIDTH,
          dt: 0.25,
          stageWidth: 1000,
          safeZone: zone,
        });
        expect(out.facing).toBe(out.vx >= 0 ? 1 : -1);
      }
    }
  });

  it('preserves a per-slime speed through a wall bounce', () => {
    const out = resolveSlimeMotion({
      x: 950,
      vx: 69,
      width: SLIME_WIDTH,
      dt: 1,
      stageWidth: 1000,
      safeZone: zone,
      speed: 69,
    });
    expect(out.vx).toBe(-69);
  });

  it('never leaves the body overlapping the safe zone', () => {
    const inside = (x: number) => x + SLIME_WIDTH > zone.min && x < zone.max;
    let x = 620;
    let vx = -60;
    for (let i = 0; i < 2000; i++) {
      const out = resolveSlimeMotion({
        x,
        vx,
        width: SLIME_WIDTH,
        dt: 1 / 60,
        stageWidth: 1000,
        safeZone: zone,
      });
      x = out.x;
      vx = out.vx;
      expect(inside(x)).toBe(false);
    }
  });

  it('patrols in a loop: turns at the safe zone and at its own wall', () => {
    const stageWidth = 1000;
    const wallRight = stageWidth - SLIME_WIDTH - 24;
    let { x, vx } = slimeSpawn({
      side: 'right',
      slot: 0,
      color: 'red',
      stageWidth,
      safeZone: zone,
    });
    let minX = x;
    let maxX = x;
    let sawLeft = false;
    let sawRight = false;

    for (let i = 0; i < 60 * 90; i++) {
      const out = resolveSlimeMotion({
        x,
        vx,
        width: SLIME_WIDTH,
        dt: 1 / 60,
        stageWidth,
        safeZone: zone,
        speed: Math.abs(vx),
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
    // ... and its own wall, and travels both ways.
    expect(maxX).toBeGreaterThanOrEqual(wallRight - 2);
    expect(sawLeft).toBe(true);
    expect(sawRight).toBe(true);
  });

  it('patrols in both directions on every laid-out width', () => {
    for (const stageWidth of [320, 375, 390, 414, 428, 480, 768, 1366]) {
      const stageZone = safeZoneBounds(playerSpawnX(stageWidth), stageWidth);
      const box = slimeBoxFor(stageWidth).width;
      const inside = (x: number) => x + box > stageZone.min && x < stageZone.max;
      const zoneCenter = (stageZone.min + stageZone.max) / 2;

      for (const entry of SLIME_ROSTER) {
        let { x, vx } = slimeSpawn({ ...entry, stageWidth, safeZone: stageZone });
        const side = x + box / 2 < zoneCenter ? -1 : 1;
        let minX = x;
        let maxX = x;
        let flips = 0;
        let prevSign = Math.sign(vx);

        for (let i = 0; i < 60 * 30; i++) {
          const step = Math.abs(vx) / 60;
          const out = resolveSlimeMotion({
            x,
            vx,
            width: box,
            dt: 1 / 60,
            stageWidth,
            safeZone: stageZone,
            speed: Math.abs(vx),
          });
          // No tick may teleport the body — a jump bigger than one frame of
          // walk plus clamp slack is the bug where slimes crossed the zone.
          expect(Math.abs(out.x - x)).toBeLessThanOrEqual(step + 1);
          if (Math.sign(out.vx) !== prevSign) flips++;
          prevSign = Math.sign(out.vx);
          x = out.x;
          vx = out.vx;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          expect(inside(x)).toBe(false);
          // It never ends up on the far side of the zone from where it started.
          expect(Math.sign(x + box / 2 - zoneCenter)).toBe(side);
        }

        // A real patrol: it covers ground and turns at its wall and at the zone
        // — but not on every tick, which is how a pinned slime looks.
        expect(maxX - minX).toBeGreaterThan(SLIME_CORRIDOR_TRAVEL / 2);
        expect(flips).toBeGreaterThan(0);
        expect(flips).toBeLessThan(60 * 30 / 4);
      }
    }
  });

  it('keeps a left-side slime on the left of the zone on a wide stage', () => {
    const stageWidth = 1000;
    const leftWall = 24;
    let { x, vx } = slimeSpawn({
      side: 'left',
      slot: 0,
      color: 'blue',
      stageWidth,
      safeZone: zone,
    });
    let minX = x;
    let maxX = x;

    for (let i = 0; i < 60 * 90; i++) {
      const out = resolveSlimeMotion({
        x,
        vx,
        width: SLIME_WIDTH,
        dt: 1 / 60,
        stageWidth,
        safeZone: zone,
        speed: Math.abs(vx),
      });
      x = out.x;
      vx = out.vx;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }

    // Never crosses the zone; turns at the zone's left edge and its own wall.
    expect(maxX + SLIME_WIDTH).toBeLessThanOrEqual(zone.min);
    expect(maxX).toBeGreaterThanOrEqual(zone.min - SLIME_WIDTH - 2);
    expect(minX).toBeLessThanOrEqual(leftWall + 2);
  });
});
