import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASE_LOOPS,
  FIRST_GAP_MAX_MS,
  FIRST_GAP_MIN_MS,
  GREETING_DELAY_MS,
  IDLE_ACTION_CLASS,
  IDLE_ACTION_MS,
  IDLE_BASE_CLASS,
  IDLE_BASE_CYCLE_MS,
  ONE_SHOT_GAP_MAX_MS,
  ONE_SHOT_GAP_MIN_MS,
  ONE_SHOT_HOLD_MS,
  firstOneShotDelayMs,
  nextBaseLoop,
  nextOneShotDelayMs,
  pickOneShot,
} from './idleDirector';

describe('idle director scheduling', () => {
  it('keeps the gap between one-shots in the 5-11s band', () => {
    for (let i = 0; i < 200; i++) {
      const delay = nextOneShotDelayMs();
      expect(delay).toBeGreaterThanOrEqual(ONE_SHOT_GAP_MIN_MS);
      expect(delay).toBeLessThanOrEqual(ONE_SHOT_GAP_MAX_MS);
    }
  });

  it('bounds the first fidget gap to the short 2.5-5s window', () => {
    for (let i = 0; i < 200; i++) {
      const delay = firstOneShotDelayMs();
      expect(delay).toBeGreaterThanOrEqual(FIRST_GAP_MIN_MS);
      expect(delay).toBeLessThanOrEqual(FIRST_GAP_MAX_MS);
    }
    expect(firstOneShotDelayMs(() => 0)).toBe(FIRST_GAP_MIN_MS);
    expect(firstOneShotDelayMs(() => 1)).toBe(FIRST_GAP_MAX_MS);
  });

  it('greets shortly after mount', () => {
    expect(GREETING_DELAY_MS).toBeGreaterThan(0);
    expect(GREETING_DELAY_MS).toBeLessThan(2000);
  });

  it('scales the quiet delay with the injected random', () => {
    expect(nextOneShotDelayMs(() => 0)).toBe(ONE_SHOT_GAP_MIN_MS);
    expect(nextOneShotDelayMs(() => 1)).toBe(ONE_SHOT_GAP_MAX_MS);
    expect(nextOneShotDelayMs(() => 0.5)).toBe((ONE_SHOT_GAP_MIN_MS + ONE_SHOT_GAP_MAX_MS) / 2);
  });

  it('picks only from the self-directed pool and never the reserved actions', () => {
    const picks = new Set<ReturnType<typeof pickOneShot>>();
    for (let i = 0; i < 500; i++) picks.add(pickOneShot());
    for (const action of picks) {
      expect(Object.keys(IDLE_ACTION_CLASS)).toContain(action);
      expect(action).not.toBe('wave'); // reserved for hover greeting
      expect(action).not.toBe('quest-complete'); // reserved for heals
    }
    expect(picks.size).toBeGreaterThan(1); // the pool actually varies
  });

  it('honours the pool weights at the boundaries', () => {
    // Weights 4/2/2/1 over 9: cumulative boundaries 4, 6, 8, 9.
    expect(pickOneShot(() => 0.0)).toBe('blink');
    expect(pickOneShot(() => 3.5 / 9)).toBe('blink');
    expect(pickOneShot(() => 4.5 / 9)).toBe('look-around');
    expect(pickOneShot(() => 7.5 / 9)).toBe('check-watch');
    expect(pickOneShot(() => 8.5 / 9)).toBe('weight-shift');
  });

  it('exposes the end-pose hold constant', () => {
    expect(ONE_SHOT_HOLD_MS).toBeGreaterThan(0);
  });

  it('rotates the base loops without repeating and always returns home', () => {
    // Deterministic walk through the full cycle.
    let cur = IDLE_BASE_CLASS;
    const seen: string[] = [cur];
    for (let i = 0; i < BASE_LOOPS.length * 2; i++) {
      cur = nextBaseLoop(cur, () => 0);
      seen.push(cur);
    }
    expect(seen).toEqual([
      'breathing',
      'weight-shift',
      'look-around-loop',
      'breathing',
      'weight-shift',
      'look-around-loop',
      'breathing',
    ]);
    // An unknown previous loop (e.g. a class rename) falls back to the default.
    expect(nextBaseLoop('not-a-loop' as never)).toBe(IDLE_BASE_CLASS);
  });
});

/**
 * Lockstep guard: the pack CSS is the source of truth for how long each
 * one-shot LOOKS; this util decides WHEN. If someone retimes the CSS without
 * updating `IDLE_ACTION_MS` (or vice versa), the scheduler would swap back to
 * the base loop mid-animation — these tests make that drift a failing test.
 */
describe('idle director / pack CSS lockstep', () => {
  const cssPath = join(__dirname, '../../src/assets/images/idle-sprites/character-sprites.css');
  const css = readFileSync(cssPath, 'utf8');

  /** Duration in ms from the `animation:` shorthand of one class. The pack
   *  CSS mixes units — `1.2s` for most strips, `240ms` for the blink. */
  const animationDurationOf = (cls: string): number => {
    const block = css.match(new RegExp(`\\.arshad-sprite--${cls}\\s*\\{([^}]*)\\}`));
    expect(block, `.arshad-sprite--${cls} not found in the pack CSS`).not.toBeNull();
    const m = block![1].match(/animation:\s*[\w-]+\s+([\d.]+)(ms|s)\b/);
    expect(m, `no duration found for .arshad-sprite--${cls}`).not.toBeNull();
    return parseFloat(m![1]) * (m![2] === 's' ? 1000 : 1);
  };

  it('base loop matches the pack breathing cycle', () => {
    expect(IDLE_BASE_CYCLE_MS).toBe(animationDurationOf(IDLE_BASE_CLASS));
  });

  it('every rotating base loop exists in the pack CSS and loops forever', () => {
    for (const cls of BASE_LOOPS) {
      const block = css.match(new RegExp(`\\.arshad-sprite--${cls}\\s*\\{([^}]*)\\}`));
      expect(block, `.arshad-sprite--${cls} not found in the pack CSS`).not.toBeNull();
      expect(block![1]).toMatch(/infinite/);
    }
  });

  it('every one-shot duration matches its pack CSS animation', () => {
    for (const [action, cls] of Object.entries(IDLE_ACTION_CLASS)) {
      expect(IDLE_ACTION_MS[action as keyof typeof IDLE_ACTION_MS]).toBe(animationDurationOf(cls));
    }
  });
});
