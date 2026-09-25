/**
 * Pure mystery-block logic for the arcade stage: which block the character is
 * bumping from below, and what collecting one does to the collection state.
 *
 * Kept free of React/DOM so the scoring rules — especially "never award the
 * same block twice" and the all-items-found bonus — can be unit tested.
 */
import { isHeadBump } from './physics';

/**
 * How close the actor's centre must be to a block's centre, in px, for the
 * "jump to bump" hint to light up. Slightly tighter than the collision grace so
 * the hint never promises a bump that the collision then rejects.
 */
export const BUMP_HINT_RANGE = 30;

/** Points awarded the first time a block is collected. */
export const BLOCK_SCORE = 50;

/** Coins awarded the first time a block is collected. */
export const BLOCK_COIN = 1;

/** One-off bonus once every power item has been found. */
export const ALL_BLOCKS_BONUS = 500;

/**
 * Downward velocity applied to the actor on a head bump (px/sec).
 *
 * Baseline for the 240px body: firm enough that a hold-to-jump bounce reads as
 * a distinct beat and cannot re-trigger the same block, soft enough to feel
 * springy. The stage may apply its own tuned value; this stays the tested,
 * shared contract.
 */
export const HEAD_BUMP_BOUNCE = -180;

export interface BlockHit {
  /** Index into the block definitions array. */
  index: number;
  /** Horizontal centre of the block that was hit. */
  centerX: number;
}

export interface HeadBumpQuery {
  /** Actor centre X, in stage pixels. */
  actorCenterX: number;
  /** Actor head height above ground. */
  actorHead: number;
  /**
   * Horizontal centres of the blocks, in stage pixels, measured from the DOM.
   *
   * These are deliberately passed in rather than recomputed from a spacing
   * constant: the blocks are laid out by CSS, whose gap and size change at the
   * `sm` breakpoint, so any duplicated layout maths drifts out of alignment
   * with what the player can actually see.
   */
  blockCentres: readonly number[];
  /** Height of the block band above ground. */
  blockLift: number;
  /**
   * Per-block band bottoms above ground (relocation). When provided and
   * complete, it replaces the shared `blockLift` so a block moved up or down
   * by the arranger collides at its real height.
   */
  blockBottoms?: readonly number[];
  /** Half-width of a block's collision box. */
  radius: number;
  tolerance?: number;
}

/**
 * Which overhead block (if any) the actor's head is currently bumping.
 *
 * Mirrors the collision the physics loop applies: the head must be inside the
 * block band (within `tolerance`) *and* horizontally within `radius` of a
 * measured block centre. Returns the first match, or null when the bump misses
 * everything.
 */
export function findHeadBumpedBlock({
  actorCenterX,
  actorHead,
  blockCentres,
  blockLift,
  blockBottoms,
  radius,
  tolerance = 40,
}: HeadBumpQuery): BlockHit | null {
  if (blockCentres.length === 0) return null;

  // Per-block bands (relocation) take precedence; the shared band is the
  // fallback for callers that have not measured vertical offsets yet.
  const perBlock = blockBottoms && blockBottoms.length === blockCentres.length;

  for (let i = 0; i < blockCentres.length; i++) {
    const bandBottom = perBlock ? blockBottoms[i] : blockLift;
    // The head only collides while it is inside this block's band.
    if (!isHeadBump(actorHead, bandBottom, tolerance)) continue;
    if (Math.abs(actorCenterX - blockCentres[i]) < radius) {
      return { index: i, centerX: blockCentres[i] };
    }
  }

  return null;
}

/**
 * Index of the first block whose horizontal footprint AND vertical band
 * overlap the actor's, or -1 if none. Used for side collisions when blocks
 * sit at different heights (relocation); `bandBottoms`/`bandTops` are per
 * block, above ground, in stage pixels.
 */
export function findOverlappingBlockInBand(
  actorLeft: number,
  actorRight: number,
  actorBottom: number,
  actorTop: number,
  blockCentres: readonly number[],
  radius: number,
  bandBottoms: readonly number[],
  bandTops: readonly number[],
): number {
  for (let i = 0; i < blockCentres.length; i++) {
    const bx = blockCentres[i];
    if (actorRight < bx - radius || actorLeft > bx + radius) continue;
    if (actorTop > bandBottoms[i] && actorBottom < bandTops[i]) return i;
  }
  return -1;
}

/**
 * Index of the block the actor should be hinted to bump, or null.
 *
 * A block qualifies when the actor's centre is within `range` of the block's
 * centre — i.e. close enough that a jump would land the bump. Mirrors the
 * collision test's shape so the hint and the mechanic can never disagree about
 * what "under a block" means; only the reach differs.
 */
export function nearestBumpTarget(
  actorCenterX: number,
  blockCentres: readonly number[],
  range = BUMP_HINT_RANGE,
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < blockCentres.length; i++) {
    const dist = Math.abs(actorCenterX - blockCentres[i]);
    // Exactly at range counts as in range; ties go to the first block.
    if (dist > range) continue;
    if (best === null || dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }

  return best;
}

export interface CollectionResult {
  /** The updated map — the same reference when nothing changed. */
  collected: Record<string, boolean>;
  /** False when this block had already been collected. */
  isNew: boolean;
  /** Number of items collected so far. */
  total: number;
  /** True once every block has been found. */
  allCollected: boolean;
}

/**
 * Record a block collection. Never mutates the input map, so callers can hand
 * in their ref-held state directly. Re-bumping an already-collected block
 * reports `isNew: false` so the caller can skip awarding points twice.
 */
export function collectBlock(
  collected: Record<string, boolean>,
  key: string,
  totalBlocks: number,
): CollectionResult {
  const next = collected[key] ? collected : { ...collected, [key]: true };
  const total = Object.keys(next).length;

  return {
    collected: next,
    isNew: !collected[key],
    total,
    allCollected: totalBlocks > 0 && total >= totalBlocks,
  };
}
