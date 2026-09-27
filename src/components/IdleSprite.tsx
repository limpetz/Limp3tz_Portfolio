import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  GREETING_DELAY_MS,
  IDLE_ACTION_CLASS,
  IDLE_ACTION_MS,
  IDLE_BASE_CLASS,
  ONE_SHOT_HOLD_MS,
  firstOneShotDelayMs,
  nextOneShotDelayMs,
  pickOneShot,
  type IdleAction,
} from '../utils/idleDirector';
import '../assets/images/idle-sprites/character-sprites.css';

/**
 * Pixel-perfect idle animation system for the portrait in the character
 * sheet, built on the 7 shipped strips in `assets/images/idle-sprites/`
 * (88x170 cells, `.arshad-sprite--*` classes from the pack CSS):
 *
 * - **greets** with the wave ~0.8s after mount;
 * - the **breathing** loop plays continuously as the base state;
 * - a director (utils/idleDirector.ts) schedules self-directed one-shots
 *   (blink, look-around, check-watch, weight-shift) — the FIRST one after a
 *   short 4-9s beat so the portrait visibly lives right away, then every
 *   9-20s like a resting character;
 * - **hover** greets with the wave;
 * - the character sheet's heart buttons drive quest-complete (heal) and
 *   blink (damage) via the `signal` prop.
 *
 * Scaling: the strips are 88x170 with ~157px of character, so the old
 * 301px portrait size implies a fractional ~1.92x upscale — which renders
 * art pixels 1px and 2px wide unevenly (the "heavily pixelated" look).
 * The scale is therefore snapped to a whole 2x: every art pixel renders
 * as exactly 2x2 screen pixels (portrait canvas stays ~301px-era sized at
 * 176x340). TRUE crispness needs higher-resolution source art: re-export
 * the 7 strips at 176x340 per frame (2x) and this component renders them
 * at ~0.96x like the old hi-res portrait.
 *
 * The pack CSS keyframes step `background-position` in absolute 88px cells,
 * so the sprite element itself must stay 88x170; it is transformed inside a
 * wrapper sized to the scaled cell. One-shots hold their final pose via the
 * CSS `both` fill; the director's durations (`IDLE_ACTION_MS`, lockstep-
 * tested against the pack CSS) decide when to swap back to the base loop.
 *
 * Under `prefers-reduced-motion` the pack CSS freezes every strip to frame 0
 * and this component stops scheduling — a static standing pose.
 */

export type IdleSpriteSignal = 'heal' | 'damage';

export interface IdleSpriteSignalEvent {
  kind: IdleSpriteSignal;
  /** Monotonic counter; a repeat click re-fires even at the same kind. */
  n: number;
}

interface IdleSpriteProps {
  /** Heart-button events from the character sheet (heal → quest-complete, damage → blink). */
  signal?: IdleSpriteSignalEvent | null;
  className?: string;
}

/** Strip-native cell size (px) — must match the pack CSS `.arshad-sprite`. */
const CELL_W = 88;
const CELL_H = 170;
/** Opaque character height inside one 170px cell (measured from the strips). */
const CELL_CONTENT_H = 157;
/** Portrait display height for the visible character, as the old <img> had. */
const PORTRAIT_H = 301;

/**
 * Whole-integer snap of PORTRAIT_H / CELL_CONTENT_H (≈1.92 → 2). A fractional
 * scale renders art pixels unevenly (some 1px, some 2px wide) — the ragged
 * pixelation. Integer scales keep every art pixel the same size.
 */
const DISPLAY_SCALE = Math.max(1, Math.ceil(PORTRAIT_H / CELL_CONTENT_H));

type Phase = { kind: 'base' } | { kind: 'action'; action: IdleAction; epoch: number };

export const IdleSprite: React.FC<IdleSpriteProps> = ({ signal, className }) => {
  const [phase, setPhase] = useState<Phase>({ kind: 'base' });
  const [reduced, setReduced] = useState(false);
  const epoch = useRef(0);

  // Honour prefers-reduced-motion: the pack CSS shows frame 0 statically.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const beginAction = useCallback((action: IdleAction) => {
    setPhase({ kind: 'action', action, epoch: ++epoch.current });
  }, []);

  // Mount greeting: wave shortly after the portrait appears.
  useEffect(() => {
    if (reduced) return undefined;
    const t = window.setTimeout(() => beginAction('wave'), GREETING_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [reduced, beginAction]);

  // The scheduler, keyed on phase: actions time their return to base; base
  // schedules the next self-directed one-shot — the first after the short
  // 4-9s beat, later ones after the long 9-20s gap.
  const hadFirstFidget = useRef(false);
  useEffect(() => {
    if (reduced) return undefined;
    if (phase.kind === 'action') {
      const t = window.setTimeout(
        () => setPhase({ kind: 'base' }),
        IDLE_ACTION_MS[phase.action] + ONE_SHOT_HOLD_MS,
      );
      return () => window.clearTimeout(t);
    }
    // `first` is consumed when the fidget actually FIRES, not when scheduled:
    // the mount greeting (or a hover) cancels this timer, and the beat after
    // that interruption should still be the short one.
    const first = !hadFirstFidget.current;
    const t = window.setTimeout(
      () => {
        hadFirstFidget.current = true;
        beginAction(pickOneShot());
      },
      first ? firstOneShotDelayMs() : nextOneShotDelayMs(),
    );
    return () => window.clearTimeout(t);
  }, [phase, reduced, beginAction]);

  // Directed signals from the character sheet: heal → quest-complete,
  // damage → blink. Keyed off the monotonic counter so repeat clicks replay.
  const lastSignal = useRef(0);
  useEffect(() => {
    if (!signal || reduced || signal.n === lastSignal.current) return;
    lastSignal.current = signal.n;
    beginAction(signal.kind === 'heal' ? 'quest-complete' : 'blink');
  }, [signal, reduced, beginAction]);

  // Hover greeting: wave when the pointer enters an idle portrait.
  const onPointerEnter = () => {
    if (reduced || phase.kind !== 'base') return;
    beginAction('wave');
  };

  const wrapperStyle: React.CSSProperties = {
    width: Math.round(CELL_W * DISPLAY_SCALE),
    height: Math.round(CELL_H * DISPLAY_SCALE),
    maxWidth: '100%',
    display: 'inline-block',
    position: 'relative',
  };

  if (reduced) {
    return (
      <span className={className} style={wrapperStyle}>
        <span
          aria-hidden="true"
          className="arshad-sprite arshad-sprite--breathing"
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            transform: `scale(${DISPLAY_SCALE})`,
            transformOrigin: 'bottom left',
            animation: 'none',
          }}
        />
      </span>
    );
  }

  const cssClass = phase.kind === 'action' ? IDLE_ACTION_CLASS[phase.action] : IDLE_BASE_CLASS;

  return (
    <span className={className} style={wrapperStyle} onPointerEnter={onPointerEnter}>
      <span
        aria-hidden="true"
        key={phase.kind === 'action' ? phase.epoch : 'base'}
        className={`arshad-sprite arshad-sprite--${cssClass}`}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          transform: `scale(${DISPLAY_SCALE})`,
          transformOrigin: 'bottom left',
        }}
      />
    </span>
  );
};
