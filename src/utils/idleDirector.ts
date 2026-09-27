/**
 * Idle director for the character-sheet portrait.
 *
 * Decides WHICH idle animation plays and WHEN, so the component only has to
 * apply the pack's CSS classes (`idle-sprites/character-sprites.css`). Pure
 * functions + data only — no timers, no DOM — so the policy is unit testable.
 *
 * The shipped pack (src/assets/images/idle-sprites/, 88x170 cells):
 *
 *   base loop     breathing-idle (4 frames, 1.2s cycle)
 *   one-shots     blink (3f, 240ms) · look-around (4f, 1.2s) ·
 *                 check-watch (6f, 1.2s) · wave (6f, 900ms) ·
 *                 quest-complete (8f, 1.2s) · weight-shift (6f, 1.8s)
 *
 * One-shot durations MUST match the pack CSS keyframe lengths — the component
 * schedules off these numbers, and `idleDirector.test.ts` parses the CSS to
 * hold the two in lockstep.
 */

export type IdleAction =
  | 'blink'
  | 'look-around'
  | 'check-watch'
  | 'wave'
  | 'quest-complete'
  | 'weight-shift';

/** CSS class suffix on `.arshad-sprite--…` for each one-shot action. */
export const IDLE_ACTION_CLASS: Record<IdleAction, string> = {
  blink: 'blink',
  'look-around': 'look-around',
  'check-watch': 'check-watch',
  wave: 'wave',
  'quest-complete': 'quest-complete',
  'weight-shift': 'weight-shift',
};

/** How long each one-shot runs, in ms — mirroring the pack CSS durations. */
export const IDLE_ACTION_MS: Record<IdleAction, number> = {
  blink: 240,
  'look-around': 1200,
  'check-watch': 1200,
  wave: 900,
  'quest-complete': 1200,
  'weight-shift': 1800,
};

/** Breathing base loop: one full 4-frame cycle per the pack CSS (1.2s). */
export const IDLE_BASE_CLASS = 'breathing';
export const IDLE_BASE_CYCLE_MS = 1200;

/**
 * Weighted pool of self-directed one-shots. Blink dominates (a character that
 * idly glances at its watch every few seconds reads manic); weight-shift is
 * rare because it visibly moves the stance. Wave is intentionally absent —
 * it is reserved for hover greeting, quest-complete for heals (driven by the
 * character sheet's heart buttons).
 */
const ONE_SHOT_POOL: Array<{ action: IdleAction; weight: number }> = [
  { action: 'blink', weight: 4 },
  { action: 'look-around', weight: 2 },
  { action: 'check-watch', weight: 2 },
  { action: 'weight-shift', weight: 1 },
];

const TOTAL_POOL_WEIGHT = ONE_SHOT_POOL.reduce((n, e) => n + e.weight, 0);

/**
 * Pick the next self-directed one-shot. `random` is injected so tests are
 * deterministic; defaults to Math.random in production.
 */
export function pickOneShot(random: () => number = Math.random): IdleAction {
  let roll = random() * TOTAL_POOL_WEIGHT;
  for (const entry of ONE_SHOT_POOL) {
    roll -= entry.weight;
    if (roll < 0) return entry.action;
  }
  return ONE_SHOT_POOL[0].action; // numeric edge (roll === TOTAL_WEIGHT)
}

/** Bounds for the quiet gap between one-shots (measured from action end). */
export const ONE_SHOT_GAP_MIN_MS = 9_000;
export const ONE_SHOT_GAP_MAX_MS = 20_000;

/** Random quiet delay before the next self-directed one-shot, in ms. */
export function nextOneShotDelayMs(random: () => number = Math.random): number {
  return ONE_SHOT_GAP_MIN_MS + random() * (ONE_SHOT_GAP_MAX_MS - ONE_SHOT_GAP_MIN_MS);
}

/**
 * Extra hold after a one-shot's animation finishes before returning to the
 * base loop — the pack CSS keeps the final pose via `both`, so a short beat
 * on the end pose reads intentional instead of snatched away.
 */
export const ONE_SHOT_HOLD_MS = 400;
