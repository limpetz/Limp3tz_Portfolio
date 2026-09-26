/**
 * Pure Slime hazard logic for the arcade stage.
 *
 * Everything that decides *where* a hazard may be and *which frame* it should
 * show lives here, so the rules can be unit tested without a DOM, a canvas or a
 * running animation loop. `ArcadeStage.tsx` imports these and only supplies the
 * per-frame state.
 *
 * Two invariants the stage depends on:
 *
 * 1. A slime can never end a tick overlapping the safe zone — the repulsion
 *    bounces it back off the edge it approached from, so a body is never
 *    carried across the zone (which read as a teleport on phone-width stages).
 * 2. `facing` is always derived from the resolved velocity, never carried over,
 *    so the patrol always reads direction-consistent (the medium slimes are
 *    symmetric blobs and don't mirror, but the attack telegraph does use it).
 *
 * The safe zone and the stage walls are separate rules; both are clamped
 * against each other so they can never shove a slime back and forth (which
 * trapped monsters in a "vibrating" loop on phone-width stages).
 *
 * Four slimes patrol the stage — two launched from the left wall and two from
 * the right — so the spawn helpers are side-aware. See `SLIME_ROSTER`.
 */

export type SlimeState = 'run' | 'idle' | 'hit' | 'die' | 'attack';
export type SlimeColor = 'blue' | 'green' | 'red' | 'white';
export type SlimeSide = 'left' | 'right';
export type SlimeSlot = 0 | 1;

/** Gameplay (collision-box) size — matches the retired mushroom hazard. */
export const SLIME_WIDTH = 44;
export const SLIME_HEIGHT = 48;

/**
 * Hazard box (and matching sprite scale) used on narrow stages.
 *
 * Below `SLIME_NARROW_STAGE_WIDTH` a full-size body plus its lane needs more
 * room than the stage can spare beside the safe zone, so the two would trade
 * the same few pixels and either the patrol or the zone would give way. A
 * smaller box hands the room back to the zone: the lane requirement
 * (`width + SLIME_CORRIDOR_TRAVEL`) shrinks with it, so a phone-width stage
 * keeps its full half-width. `SlimeMonster` draws the narrow box at 2x instead
 * of 3x, keeping the visible art and the collision box in the same proportion.
 */
export const SLIME_NARROW_WIDTH = 32;
export const SLIME_NARROW_HEIGHT = 34;
/** Stage width below which the full-size body starts squeezing the safe zone. */
export const SLIME_NARROW_STAGE_WIDTH = 448;

/** Hazard box for a stage width: the full-size body, or the narrow variant. */
export function slimeBoxFor(stageWidth: number): { width: number; height: number } {
  return stageWidth < SLIME_NARROW_STAGE_WIDTH
    ? { width: SLIME_NARROW_WIDTH, height: SLIME_NARROW_HEIGHT }
    : { width: SLIME_WIDTH, height: SLIME_HEIGHT };
}
export const SLIME_SPEED = 60;
export const SLIME_WALL_MARGIN = 24;
export const SLIME_IDLE_SECONDS = 0.7; // "notice you" pause after spawning
export const SLIME_ATTACK_RANGE = 130; // px the player must be within to telegraph
export const SLIME_RESPAWN_MS = 5000;
export const SPAWN_GRACE_MS = 2000; // no contact damage before the player has control

/** The collision-box width the actor's spawn and safe zone are centred on. */
export const ACTOR_WIDTH = 72;

/**
 * Sheet geometry. Every `Slime_Medium_*.png` is a single 128x128 sheet holding a
 * 4x4 grid of 32x32 frames. Rows 2 and 3 repeat rows 0 and 1 with only a few
 * shine pixels changed, so the two usable cycles live on:
 *
 *   row 0 — idle: a tall, gentle pulse
 *   row 1 — move: a flatter hop/squash
 *
 * The art is a symmetric blob with no eyes, so there is no facing row and the
 * renderer never mirrors it.
 */
export const SLIME_CELL = 32;
export const SLIME_SHEET_COLS = 4;
export const SLIME_SHEET_ROWS = 4;

export interface SlimeAnim {
  /** Sheet row the cycle lives on. */
  row: number;
  /** First column of the cycle within that row. */
  start: number;
  /** Number of frames in the cycle. */
  frames: number;
  fps: number;
  loop: boolean;
}

/**
 * Per-state playback for the medium-slime sheets. The mob keeps all five states;
 * because a slime ships only an idle and a move cycle, the combat states reuse
 * those frames:
 *
 * - `idle`   → the idle pulse.
 * - `run`    → the hop cycle.
 * - `attack` → the hop cycle at 2x, then it clamps on the deepest lunge pose.
 * - `hit`    → the single flattest (most squashed) frame, held as a stagger.
 * - `die`    → the hop cycle played fast, then held collapsed.
 */
export const SLIME_ANIM: Record<SlimeState, SlimeAnim> = {
  idle: { row: 0, start: 0, frames: 4, fps: 6, loop: true },
  run: { row: 1, start: 0, frames: 4, fps: 8, loop: true },
  attack: { row: 1, start: 0, frames: 4, fps: 16, loop: false },
  hit: { row: 1, start: 2, frames: 1, fps: 12, loop: false },
  die: { row: 1, start: 0, frames: 4, fps: 18, loop: false },
};

/** How long each one-shot state lasts, in seconds; looping states never expire. */
export const SLIME_STATE_SECONDS: Record<SlimeState, number> = {
  run: Infinity,
  idle: Infinity,
  attack: SLIME_ANIM.attack.frames / SLIME_ANIM.attack.fps,
  hit: 0.3,
  die: 1.2,
};

/**
 * Flat cell index (row * COLS + col) for a state at `timer` seconds — loops, or
 * clamps on the final frame for one-shots.
 */
export function slimeFrameIndex(state: SlimeState, timer: number): number {
  const anim = SLIME_ANIM[state];
  const raw = Math.floor(timer * anim.fps);
  const idx = anim.loop ? raw % anim.frames : Math.min(anim.frames - 1, raw);
  return anim.row * SLIME_SHEET_COLS + (anim.start + idx);
}

/** Split a flat cell index back into sheet row / column for the renderer. */
export function slimeFrameCell(frameIndex: number): { row: number; col: number } {
  const safe = Math.max(0, Math.floor(frameIndex));
  return { row: Math.floor(safe / SLIME_SHEET_COLS), col: safe % SLIME_SHEET_COLS };
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
 * Smallest left-hand lane the safe zone must leave a slime.
 *
 * A left-side slime patrols between the stage's left wall and the zone's left
 * edge. If the zone crowds the wall closer than a body-width plus this much
 * run, the two rules clamp the body to the same x on every tick: it turns
 * around constantly without ever moving, which reads as a slime walking into
 * the wall. The zone therefore gives up part of its *left* half on narrow
 * stages; where that still isn't enough the patrol drops the wall margin too.
 */
export const SLIME_CORRIDOR_TRAVEL = 24;

/**
 * Safe zone for a given spawn, clamped inside the stage walls — and offset so a
 * patrol still has a lane beside it.
 *
 * The half-width scales with the stage but is capped, and `max` can never pass
 * the wall the actor itself is clamped to (`stageWidth - actorWidth - 12`), so
 * a slime bouncing off the right wall can't be pushed back into the zone.
 *
 * Only the *left* half is ever trimmed. A body-width plus `SLIME_CORRIDOR_TRAVEL`
 * of lane belongs to the slimes off the left wall, so a phone-width stage ends
 * up with a zone that reaches less far left of the spawn than right of it
 * rather than a uniformly shrunken one — the right half is room the right-hand
 * pair can spare, and the spawn always stays inside the zone.
 */
export function safeZoneBounds(
  spawnX: number,
  stageWidth: number,
  actorWidth: number = ACTOR_WIDTH,
): SafeZoneBounds {
  const wallRight = stageWidth - actorWidth - 12;
  const half = Math.min(140, Math.max(60, stageWidth * 0.2));
  // Narrow stages use the smaller hazard box, so their lane costs less and the
  // zone keeps more of its left half.
  const laneCost = slimeBoxFor(stageWidth).width + SLIME_CORRIDOR_TRAVEL;
  const leftHalf = Math.max(0, Math.min(half, spawnX - laneCost));
  const min = Math.max(12, spawnX - leftHalf);
  const max = Math.min(wallRight, Math.max(min + 40, spawnX + half));
  return { min, max };
}

export interface SlimeMotion {
  x: number;
  vx: number;
  facing: 1 | -1;
}

/**
 * Resolve one tick of a patrolling slime: advance by `vx * dt`, repel it out of
 * the safe zone, then bounce off the stage walls. Facing follows the final
 * velocity.
 */
export function resolveSlimeMotion(params: {
  x: number;
  vx: number;
  width: number;
  dt: number;
  stageWidth: number;
  safeZone: SafeZoneBounds;
  wallMargin?: number;
  speed?: number;
}): SlimeMotion {
  const { width, dt, stageWidth, safeZone } = params;
  const wallMargin = params.wallMargin ?? SLIME_WALL_MARGIN;
  const speed = params.speed ?? SLIME_SPEED;

  let x = params.x + params.vx * dt;
  let vx = params.vx;

  // Safe-zone repulsion: bounce the whole body back off the edge it came from.
  // The body is never carried through the zone — on a stage too narrow to hold
  // a slime on one side, the teleport used to blink it ~190px across the safe
  // zone mid-patrol. A left-side bounce is only legal when the body can sit
  // on-stage to the left of the zone; otherwise the right-side exit is the only
  // position that keeps both the stage and zone invariants.
  if (x + width >= safeZone.min && x <= safeZone.max) {
    const bodyCenter = x + width / 2;
    const zoneCenter = (safeZone.min + safeZone.max) / 2;
    const cameFromLeft = bodyCenter < zoneCenter;
    const leftBounceX = safeZone.min - width;
    if (cameFromLeft && leftBounceX >= 0) {
      x = leftBounceX;
      vx = -Math.abs(vx || speed);
    } else {
      x = safeZone.max;
      vx = Math.abs(vx || speed);
    }
  }

  // Stage wall bounce, clamped so it can't drop the body back inside the zone.
  // Because safeZoneBounds() keeps the zone inside the actor's wall, the
  // slime's wall always sits beyond the zone — the `Math.max/min` guards only
  // matter for degenerate inputs. When the margin would leave a lane shorter
  // than a run, the wall moves out to the true stage edge instead — a body
  // pinned between the wall and the zone turns around forever without ever
  // travelling, and that is what read as a slime walking into the wall.
  const marginLaneLeft = safeZone.min - width - wallMargin;
  const wallLeft = marginLaneLeft >= SLIME_CORRIDOR_TRAVEL ? wallMargin : 0;
  const marginLaneRight = stageWidth - width - wallMargin - safeZone.max;
  const wallRight =
    marginLaneRight >= SLIME_CORRIDOR_TRAVEL ? stageWidth - width - wallMargin : stageWidth - width;
  if (x <= wallLeft) {
    x = Math.min(wallLeft, safeZone.min - width);
    vx = Math.abs(vx || speed);
  } else if (x >= wallRight) {
    x = Math.max(wallRight, safeZone.max);
    vx = -Math.abs(vx || speed);
  }

  return { x, vx, facing: vx >= 0 ? 1 : -1 };
}

export interface SlimeSpawn {
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: SlimeState;
  frameIndex: number;
  animTimer: number;
  stateTimer: number;
  width: number;
  height: number;
  color: SlimeColor;
  side: SlimeSide;
  slot: SlimeSlot;
}

/** Horizontal gap between the two slimes that share a side. */
export const SLIME_SIDE_STAGGER = 76;

/**
 * Per-slot patrol speed.
 *
 * Two slimes sharing a side must not share a speed: the wall bounce *and* the
 * safe-zone repulsion both clamp a body to a single x, so equal-speed walkers
 * would land on the same pixel at every turn and then merge into one sprite.
 * A slight offset keeps them separate without changing the patrol rules.
 */
export const SLIME_SLOT_SPEED: readonly [number, number] = [SLIME_SPEED, SLIME_SPEED * 1.15];

/**
 * The four medium slimes: two launched from the left wall, two from the right.
 * Left and right each carry a different colour so the pairs stay readable when
 * they cross.
 */
export const SLIME_ROSTER: ReadonlyArray<{
  side: SlimeSide;
  slot: SlimeSlot;
  color: SlimeColor;
}> = [
  { side: 'left', slot: 0, color: 'blue' },
  { side: 'left', slot: 1, color: 'green' },
  { side: 'right', slot: 0, color: 'red' },
  { side: 'right', slot: 1, color: 'white' },
];

/**
 * Spawn fields for a slime pinned to `side`'s wall and walking inward, idling
 * for a beat on arrival. Slot 1 stands one `SLIME_SIDE_STAGGER` further into
 * the stage so the pair never overlaps, and the spawn is clamped clear of the
 * safe zone even on a stage too narrow to reach the wall.
 */
export function slimeSpawn(params: {
  side: SlimeSide;
  slot: SlimeSlot;
  color: SlimeColor;
  stageWidth: number;
  safeZone: SafeZoneBounds;
  width?: number;
  height?: number;
}): SlimeSpawn {
  const { side, slot, color, stageWidth, safeZone } = params;
  const box = slimeBoxFor(stageWidth);
  const width = params.width ?? box.width;
  const height = params.height ?? box.height;
  const speed = SLIME_SLOT_SPEED[slot] ?? SLIME_SPEED;

  const rawX =
    side === 'left'
      ? SLIME_WALL_MARGIN + slot * SLIME_SIDE_STAGGER
      : stageWidth - width - SLIME_WALL_MARGIN - slot * SLIME_SIDE_STAGGER;
  // Never start inside the zone: the left pair sits left of `min`, the right
  // pair right of `max`.
  const clearOfZone =
    side === 'left' ? Math.min(rawX, safeZone.min - width) : Math.max(rawX, safeZone.max);
  // Keep the body on-stage even on a degenerate narrow layout; the first
  // resolved tick still pushes it clear of the zone.
  const x = Math.max(0, Math.min(clearOfZone, stageWidth - width));

  const vx = (side === 'left' ? 1 : -1) * speed;

  return {
    x,
    y: 0,
    vx,
    facing: vx >= 0 ? 1 : -1,
    state: 'idle',
    frameIndex: 0,
    animTimer: 0,
    stateTimer: 0,
    width,
    height,
    color,
    side,
    slot,
  };
}

/** The full four-slime roster (2 left + 2 right) for a laid-out stage. */
export function slimeRoster(stageWidth: number, safeZone: SafeZoneBounds): SlimeSpawn[] {
  return SLIME_ROSTER.map((entry) => slimeSpawn({ ...entry, stageWidth, safeZone }));
}

/* ---------------------------------------------------------------------------
 * Stomp chains
 *
 * A stomp bounces the player upward off the slime, so skilled play chains
 * stomps without ever touching the ground. The chain rewards that: every
 * consecutive airborne stomp is worth `STOMP_CHAIN_BASE` more than the last.
 * Touching the ground (a landing, or a knockback) resets it.
 * ------------------------------------------------------------------------ */

/** Score for the first stomp of a chain — the long-standing flat reward. */
export const STOMP_CHAIN_BASE = 350;
/** Points each further link adds over the previous one. */
export const STOMP_CHAIN_STEP = 150;
/**
 * Longest rewarded chain; later stomps in one flight keep this link's value.
 *
 * Tuning note (checked against the stage physics, final): a stomp relaunches
 * the player at 880 px/s from about the slime's 48px top, so each link costs
 * ~0.9s of flight while the arc drifts at the player's air speed — linking is
 * about steering to the next patrolling slime. Two to four links is a normal
 * skilled flight; x8 demands every one of the four hazards lined up under the
 * arc, so the cap is a safety ceiling against degenerate multi-hits, not a
 * limit anyone regularly feels. Revisit only if players start seeing x8
 * shouts routinely; the fix would be a higher cap, not a smaller step.
 */
export const STOMP_CHAIN_MAX = 8;

/**
 * Score for link `count` (1-based) of a stomp chain: 350, 500, 650, … capped
 * after `STOMP_CHAIN_MAX` links so a glitched multi-hit can't mint points.
 */
export function stompChainScore(count: number): number {
  // Degenerate counters (0, negative, NaN from an uninitialised ref) all pay
  // the first link's score rather than minting a negative or NaN reward.
  const link = Number.isFinite(count)
    ? Math.min(Math.max(1, Math.floor(count)), STOMP_CHAIN_MAX)
    : 1;
  return STOMP_CHAIN_BASE + (link - 1) * STOMP_CHAIN_STEP;
}

/** Shout text for a chain link — 1 stays the classic line, 2+ name the combo. */
export function stompChainLabel(count: number): string {
  return count >= 2
    ? `STOMP CHAIN x${Math.min(count, STOMP_CHAIN_MAX)}! +${stompChainScore(count)} PTS!`
    : 'SLIME STOMPED! +350 PTS!';
}
