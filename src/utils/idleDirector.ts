/**
 * Idle director for the character-sheet portrait.
 *
 * Decides WHICH idle animation plays and WHEN, so the component only has to
 * apply the pack's CSS classes (`idle-sprites/character-sprites.css`). Pure
 * functions + data only — no timers, no DOM — so the policy is unit testable.
 *
 * The shipped pack (src/assets/images/idle-sprites/, 88x170 cells):
 *
 *   base loop     breathing-idle (4 frames, 0.8s cycle = 5fps)
 *   one-shots     blink (3f, 240ms) · look-around (4f, 0.8s) ·
 *                 check-watch (6f, 0.9s) · wave (6f, 700ms) ·
 *                 quest-complete (8f, 0.9s) · weight-shift (6f, 1.2s)
 *
 * The quest-complete one-shot also pulses a subtle green drop-shadow aura
 * (arshad-quest-glow in the pack CSS) — the heal reward beat.
 *
 * Cadence: the first fidget lands 2.5-5s after the mount greeting settles,
 * later ones every 5-11s.
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

/**
 * How long each one-shot runs, in ms — mirroring the pack CSS durations
 * (retimed up from the authored ~3fps to a snappier retro 5-9fps; the CSS
 * comment documents the per-strip numbers and the lockstep test holds the
 * two files together).
 */
export const IDLE_ACTION_MS: Record<IdleAction, number> = {
  blink: 240,
  'look-around': 800,
  'check-watch': 900,
  wave: 700,
  'quest-complete': 900,
  'weight-shift': 1200,
};

/**
 * Base idle rotation. Instead of only ever breathing, the portrait rotates
 * through the calm loops as its resting state — breathing → weight-shift →
 * look-around-loop — picking the next one each time it returns to base.
 * (`look-around-loop` is the pack CSS's looping variant of the look-around
 * strip; the plain class is a one-shot that would hold its end pose.)
 */
export const BASE_LOOPS = ['breathing', 'weight-shift', 'look-around-loop'] as const;
export type BaseLoop = (typeof BASE_LOOPS)[number];

/** The default starting base loop. */
export const IDLE_BASE_CLASS: BaseLoop = 'breathing';
/** Breathing base loop: one full 4-frame cycle per the pack CSS (0.8s). */
export const IDLE_BASE_CYCLE_MS = 800;

/**
 * The next base loop in the rotation, cycling forever. Injected `random`
 * keeps tests deterministic (an injected 0/0.5/1 maps to consecutive picks).
 */
export function nextBaseLoop(prev: BaseLoop, random: () => number = Math.random): BaseLoop {
  const i = BASE_LOOPS.indexOf(prev);
  if (i < 0) return IDLE_BASE_CLASS;
  return BASE_LOOPS[(i + 1) % BASE_LOOPS.length];
}

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

/**
 * Bounds for the quiet gap between one-shots (measured from action end).
 * Retuned from 9-20s: at the resting cadence the portrait sat still long
 * enough to read as static between fidgets. 5-11s keeps it clearly alive
 * while still breathing like a character, not a screensaver.
 */
export const ONE_SHOT_GAP_MIN_MS = 5_000;
export const ONE_SHOT_GAP_MAX_MS = 11_000;

/** Random quiet delay before the next self-directed one-shot, in ms. */
export function nextOneShotDelayMs(random: () => number = Math.random): number {
  return ONE_SHOT_GAP_MIN_MS + random() * (ONE_SHOT_GAP_MAX_MS - ONE_SHOT_GAP_MIN_MS);
}

/**
 * Shorter gap before the FIRST self-directed fidget (after the mount
 * greeting): a portrait that sits perfectly still for its first seconds
 * reads as a static image, not a character.
 */
export const FIRST_GAP_MIN_MS = 2_500;
export const FIRST_GAP_MAX_MS = 5_000;

/** Random short delay before the first self-directed one-shot, in ms. */
export function firstOneShotDelayMs(random: () => number = Math.random): number {
  return FIRST_GAP_MIN_MS + random() * (FIRST_GAP_MAX_MS - FIRST_GAP_MIN_MS);
}

/** The mount greeting (wave) plays this soon after the portrait appears. */
export const GREETING_DELAY_MS = 800;

/**
 * Extra hold after a one-shot's animation finishes before returning to the
 * base loop — the pack CSS keeps the final pose via `both`, so a short beat
 * on the end pose reads intentional instead of snatched away.
 */
export const ONE_SHOT_HOLD_MS = 400;
