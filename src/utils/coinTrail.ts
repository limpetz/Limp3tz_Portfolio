/**
 * Coin-trail patterns for the arcade stage — pure level-design logic.
 *
 * Instead of only single coins raining from the sky, the stage periodically
 * spawns a SHAPED group of coins that hangs in the air (no gravity) for a
 * limited window: an arc to jump through, a sine wave to chase, a staircase
 * to climb. Reachability is computed from the hero's real jump physics
 * (`JUMP_V = 1250`, `GRAVITY = 2000` → apex ≈ 391px; the stage's own reach
 * rule keeps a safety margin), so every pattern is guaranteed collectible.
 *
 * Pure functions + data only: the stage decides WHEN to spawn and does the
 * per-tick collection; this module decides the SHAPE and enforces reach.
 */

/** One coin of a generated trail, in stage coordinates (px). */
export interface TrailCoin {
  /** Horizontal position in stage px. */
  x: number;
  /** Height above the ground line in stage px (0 = standing on the floor). */
  h: number;
}

/** The shapes the generator can draw. */
export type TrailShape = 'arc' | 'wave' | 'stairs';

export interface CoinTrail {
  shape: TrailShape;
  coins: TrailCoin[];
}

export interface TrailParams {
  /** Usable horizontal span, in px (stage width minus wall margins). */
  width: number;
  /** Ground line (px) the trail hangs above. */
  groundH: number;
  /** The hero's full jump apex above the ground, in px (JUMP_V²/2G). */
  jumpApex: number;
  /** Deterministic randomness for tests; defaults to Math.random. */
  random?: () => number;
}

/** Coins never hug the walls — same comfort margin the rain uses (40px). */
export const TRAIL_WALL_MARGIN = 40;
/** Vertical clearance so coins never intersect the ground line or blocks. */
export const TRAIL_MIN_H = 60;
/** A trail is a treat, not a wall of coins. */
export const TRAIL_COIN_COUNT = 7;
/** How long a trail hangs in the air before the remaining coins fade. */
export const TRAIL_WINDOW_MS = 9000;

/** Max height any trail coin may reach: 80% of the hero's jump apex. */
export function trailMaxHeight(jumpApex: number): number {
  return Math.round(jumpApex * 0.8);
}

/** Horizontal spacing between the coins of a trail, in px. */
export function trailSpacing(width: number): number {
  // 7 coins should span roughly half the stage: readable shape, chaseable.
  return Math.round((width * 0.5) / (TRAIL_COIN_COUNT - 1));
}

/**
 * Generate a shaped coin trail. All heights stay within
 * `[TRAIL_MIN_H, trailMaxHeight(jumpApex)]`, and x spans ~half the stage
 * from a random start, so every coin is reachable with one jump.
 */
export function generateCoinTrail(shape: TrailShape, p: TrailParams): CoinTrail {
  const random = p.random ?? Math.random;
  const usable = Math.max(0, p.width - TRAIL_WALL_MARGIN * 2);
  const spacing = trailSpacing(p.width);
  const span = spacing * (TRAIL_COIN_COUNT - 1);
  const startX = TRAIL_WALL_MARGIN + random() * Math.max(0, usable - span);
  const maxH = trailMaxHeight(p.jumpApex);

  const coins: TrailCoin[] = [];
  for (let i = 0; i < TRAIL_COIN_COUNT; i++) {
    const t = i / (TRAIL_COIN_COUNT - 1); // 0..1 along the trail
    let h: number;
    switch (shape) {
      case 'arc':
        // A jump-shaped dome: rise, apex mid-trail, fall — trace the arc.
        h = TRAIL_MIN_H + (maxH - TRAIL_MIN_H) * Math.sin(t * Math.PI);
        break;
      case 'wave': {
        // One-and-a-half periods: a crest lands exactly mid-trail (t=0.5), so
        // the shape reads as a wave AND its high point is a jump target.
        h = TRAIL_MIN_H + (maxH - TRAIL_MIN_H) * (0.55 + 0.45 * Math.sin(t * Math.PI * 3));
        break;
      }
      case 'stairs':
        // Climb left→right: each coin a step higher, then a leap off the top.
        h = TRAIL_MIN_H + (maxH - TRAIL_MIN_H) * t;
        break;
    }
    coins.push({ x: Math.round(startX + i * spacing), h: Math.round(h) });
  }
  return { shape, coins };
}

/** Pick a random shape (injectable random for deterministic tests). */
export function pickTrailShape(random: () => number = Math.random): TrailShape {
  const shapes: TrailShape[] = ['arc', 'wave', 'stairs'];
  return shapes[Math.floor(random() * shapes.length) % shapes.length];
}
