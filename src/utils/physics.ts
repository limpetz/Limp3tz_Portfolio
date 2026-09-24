/**
 * Pure physics & collision helpers for the arcade stage.
 *
 * Everything here is side-effect free and independent of React/DOM so it can
 * be unit tested directly. ArcadeStage imports these for its animation loop.
 */

/** Clamp a score increment to the maximum displayable value. */
export function clampScore(current: number, amount: number, max = 999999): number {
  return Math.min(current + amount, max);
}

/**
 * Accelerate `current` toward `target` by `accel * dt`, never overshooting.
 * Used for horizontal sprint/acceleration.
 */
export function rampVelocity(current: number, target: number, accel: number, dt: number): number {
  if (current < target) return Math.min(target, current + accel * dt);
  if (current > target) return Math.max(target, current - accel * dt);
  return current;
}

/**
 * Decelerate `current` toward zero by `friction * dt`, snapping to a full stop
 * once it drops below the stop threshold so the sprite doesn't crawl.
 */
export function applyFriction(current: number, friction: number, dt: number, stopBelow = 5): number {
  const step = friction * dt;
  let next = current;
  if (next > 0) next = Math.max(0, next - step);
  else if (next < 0) next = Math.min(0, next + step);
  return Math.abs(next) < stopBelow ? 0 : next;
}

/**
 * Height a projectile reaches for a given launch velocity and gravity:
 * h = v^2 / 2g. Used to sanity-check that a jump can reach the blocks.
 */
export function jumpApexHeight(jumpVelocity: number, gravity: number): number {
  if (gravity <= 0) return Infinity;
  return (jumpVelocity * jumpVelocity) / (2 * gravity);
}

/**
 * Horizontal center positions of the overhead mystery blocks.
 * Blocks are centered as a group within the stage width.
 */
export function blockCenters(
  stageWidth: number,
  count: number,
  spacing: number,
  offset = 26
): number[] {
  if (count <= 0) return [];
  const startX = stageWidth / 2 - (count * spacing) / 2;
  return Array.from({ length: count }, (_, i) => startX + i * spacing + offset);
}

/**
 * Whether a vertical span [bottom, top] overlaps the band [bandBottom, bandTop].
 * A block is only solid to the player when these bands overlap.
 */
export function isInVerticalBand(
  bottom: number,
  top: number,
  bandBottom: number,
  bandTop: number
): boolean {
  return top > bandBottom && bottom < bandTop;
}

/**
 * Index of the first block whose horizontal footprint overlaps the actor's,
 * or -1 if none. `radius` is the half-width of a block's collision box.
 */
export function findOverlappingBlock(
  actorLeft: number,
  actorRight: number,
  blocks: readonly number[],
  radius: number
): number {
  for (let i = 0; i < blocks.length; i++) {
    const bx = blocks[i];
    if (actorRight >= bx - radius && actorLeft <= bx + radius) return i;
  }
  return -1;
}

/**
 * Resolve a horizontal collision against a single block by placing the actor
 * flush against the side it was moving toward. Returns the corrected x.
 */
export function resolveBlockCollision(
  actorLeft: number,
  actorWidth: number,
  blockCenterX: number,
  radius: number,
  movingRight: boolean
): number {
  return movingRight
    ? blockCenterX - radius - actorWidth
    : blockCenterX + radius;
}

/** Keep a value inside the stage, leaving `margin` px on each side. */
export function clampToStage(x: number, stageWidth: number, actorWidth: number, margin = 12): number {
  const maxX = Math.max(margin, stageWidth - actorWidth - margin);
  return Math.max(margin, Math.min(maxX, x));
}

/**
 * Whether a head-bump against an overhead block should register, given the
 * actor's head height and the block's band.
 */
export function isHeadBump(headHeight: number, blockBandBottom: number, tolerance = 40): boolean {
  return headHeight >= blockBandBottom && headHeight <= blockBandBottom + tolerance;
}
