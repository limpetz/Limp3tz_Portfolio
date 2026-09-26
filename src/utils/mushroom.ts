/**
 * Pure Mushroom Monster logic for the arcade stage.
 *
 * Everything that decides *where* a hazard may be and *which frame* it should
 * show lives here, so the rules can be unit tested without a DOM, a canvas or a
 * running animation loop. `ArcadeStage.tsx` imports these and only supplies the
 * per-frame state.
 *
 * Two invariants the stage depends on:
 *
 * 1. A monster can never end a tick overlapping the safe zone — the repulsion
 *    resolves it to whichever side of the zone its body came from.
 * 2. `facing` is always derived from the resolved velocity, never carried over,
 *    so the sprite can't walk one way while facing the other.
 *
 * The safe zone and the stage walls are separate rules; both are clamped
 * against each other so they can never shove a monster back and forth (which
 * trapped monsters in a "vibrating" loop on phone-width stages).
 */

export type MushroomState = 'run' | 'idle' | 'hit' | 'die' | 'attack';

/** Gameplay (collision-box) size — smaller than the 80x64 sprite cells. */
export const MUSHROOM_WIDTH = 44;
export const MUSHROOM_HEIGHT = 48;
export const MUSHROOM_SPEED = 60;
export const MUSHROOM_WALL_MARGIN = 24;
export const MUSHROOM_IDLE_SECONDS = 0.7; // \"notice you\" pause after spawning
export const MUSHROOM_ATTACK_RANGE = 130; // px the player must be within to telegraph
export const MUSHROOM_RESPAWN_MS = 5000;
export const SPAWN_GRACE_MS = 2000; // no contact damage before the player has control

/** The collision-box width the actor's spawn and safe zone are centred on. */
export const ACTOR_WIDTH = 72;

/**
 * Per-state frame counts and playback rates for the Mushroom Monster sheets
 * (see `MushroomMonster.tsx`). Looping states cycle; one-shot states clamp on
 * their final frame.
 */
export const MUSHROOM_ANIM: Record<
  MushroomState,
  { frames: number; fps: number; loop: boolean }
> = {
  run: { frames: 8, fps: 10, loop: true },
  idle: { frames: 7, fps: 9, loop: true },
  attack: { frames: 10, fps: 12, loop: false },
  hit: { frames: 5, fps: 12, loop: false },
  die: { frames: 15, fps: 12.5, loop: false },
};

/** How long each one-shot state lasts, in seconds; looping states never expire. */
export const MUSHROOM_STATE_SECONDS: Record<MushroomState, number> = {
  run: Infinity,
  idle: Infinity,
  attack: MUSHROOM_ANIM.attack.frames / MUSHROOM_ANIM.attack.fps,
  hit: MUSHROOM_ANIM.hit.frames / MUSHROOM_ANIM.hit.fps,
  die: MUSHROOM_ANIM.die.frames / MUSHROOM_ANIM.die.fps,
};

/** Frame index for a state at `timer` seconds — loops, or clamps for one-shots. */
export function mushroomFrameIndex(state: MushroomState, timer: number): number {
  const anim = MUSHROOM_ANIM[state];
  const raw = Math.floor(timer * anim.fps);
  return anim.loop ? raw % anim.frames : Math.min(anim.frames - 1, raw);
}

export interface SafeZoneBounds {
  min: number;
  max: number;
}

/** Actor spawn x for a stage width, mirroring the stage's layout rule. */
export function playerSpawnX(stageWidth: number): number {
  return Math.max(20, stageWidth / 2 - 60);
}

/**
 * Safe zone for a given spawn, clamped inside the stage walls.
 *
 * The half-width scales with the stage but is capped, and `max` can never pass
 * the wall the actor itself is clamped to (`stageWidth - actorWidth - 12`), so
 * a monster bouncing off the right wall can't be pushed back into the zone.
 */
export function safeZoneBounds(
  spawnX: number,
  stageWidth: number,
  actorWidth: number = ACTOR_WIDTH,
): SafeZoneBounds {
  const half = Math.min(140, Math.max(60, stageWidth * 0.2));
  const wallRight = stageWidth - actorWidth - 12;
  const min = Math.max(12, spawnX - half);
  const max = Math.min(wallRight, Math.max(min + 40, spawnX + half));
  return { min, max };
}

export interface MushroomMotion {
  x: number;
  vx: number;
  facing: 1 | -1;
}

/**
 * Resolve one tick of a patrolling monster: advance by `vx * dt`, repel it out
 * of the safe zone, then bounce off the stage walls. Facing follows the final
 * velocity.
 */
export function resolveMushroomMotion(params: {
  x: number;
  vx: number;
  width: number;
  dt: number;
  stageWidth: number;
  safeZone: SafeZoneBounds;
  wallMargin?: number;
  speed?: number;
}): MushroomMotion {
  const { width, dt, stageWidth, safeZone } = params;
  const wallMargin = params.wallMargin ?? MUSHROOM_WALL_MARGIN;
  const speed = params.speed ?? MUSHROOM_SPEED;

  let x = params.x + params.vx * dt;
  let vx = params.vx;

  // Safe-zone repulsion: push the whole body out before it can enter. Exit
  // toward the nearer side, but only left when the body actually fits —
  // otherwise the wall would shove it straight back in.
  if (x + width >= safeZone.min && x <= safeZone.max) {
    const bodyCenter = x + width / 2;
    const zoneCenter = (safeZone.min + safeZone.max) / 2;
    const canExitLeft = safeZone.min - width >= wallMargin;
    if (canExitLeft && bodyCenter < zoneCenter) {
      x = safeZone.min - width;
      vx = -Math.abs(vx || speed);
    } else {
      x = safeZone.max;
      vx = Math.abs(vx || speed);
    }
  }

  // Stage wall bounce, clamped so it can't drop the body back inside the zone.
  // Because safeZoneBounds() keeps the zone inside the actor's wall, the
  // monster wall always sits beyond the zone — the `Math.max/min` guards only
  // matter for degenerate inputs.
  const wallLeft = wallMargin;
  const wallRight = stageWidth - width - wallMargin;
  if (x <= wallLeft) {
    x = Math.min(wallLeft, safeZone.min - width);
    vx = Math.abs(vx || speed);
  } else if (x >= wallRight) {
    x = Math.max(wallRight, safeZone.max);
    vx = -Math.abs(vx || speed);
  }

  return { x, vx, facing: vx >= 0 ? 1 : -1 };
}

export interface MushroomSpawn {
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: MushroomState;
  frameIndex: number;
  animTimer: number;
  stateTimer: number;
  width: number;
  height: number;
}

/**
 * Spawn fields for a monster that appears at the **far wall** — the side
 * opposite the player's safe zone — then patrols left across the whole span.
 * Starting pinned to the wall (rather than a fixed offset from the zone) is
 * what makes the patrol read as "cross the stage, turn at the safe zone, head
 * back": a spawn just past the zone edge looks like it pops *out* of the safe
 * zone instead. Facing is tied to `vx`.
 */
export function mushroomSpawn(
  stageWidth: number,
  safeZoneMax: number,
  width: number = MUSHROOM_WIDTH,
): MushroomSpawn {
  // Never left of the zone, even on a stage too narrow to reach the wall.
  const rightWall = stageWidth - width - MUSHROOM_WALL_MARGIN;
  return {
    x: Math.max(rightWall, safeZoneMax),
    y: 0,
    vx: -MUSHROOM_SPEED,
    facing: -1,
    state: 'idle',
    frameIndex: 0,
    animTimer: 0,
    stateTimer: 0,
    width,
    height: MUSHROOM_HEIGHT,
  };
}
