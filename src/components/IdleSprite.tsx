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
 * Idle animation system for the portrait in the character sheet, built on
 * the 7 shipped 2x strips in `assets/images/idle-sprites/` (176x340 cells,
 * nearest-neighbour upscaled from the approved 88x170 art; bit-exact lossless
 * WebP shipped, PNG originals in `.originals/idle-sprites/`).
 *
 * Geometry is owned entirely by the pack CSS: `.arshad-sprite-stage` sizes
 * the box (169x326.4) and `.arshad-sprite` draws the 176x340 cell at its
 * 0.96x stage scale — which lands the ~313px character at the historical
 * ~301px portrait height, and because the source is now 2x art the render
 * is a slight DOWNSCALE (crisp, like the old hi-res portrait was).
 * The component only switches the `arshad-sprite--*` modifier class and
 * restarts one-shots via an epoch key (a repeated action re-fires the CSS
 * animation).
 *
 * Behaviour (cadence constants live in utils/idleDirector.ts, lockstep-tested
 * against this pack CSS):
 * - **greets** with the wave ~0.8s after mount;
 * - **breathing** loop plays as the base state;
 * - self-directed one-shots (blink, look-around, check-watch, weight-shift)
 *   start after a short first beat, then on the resting cadence;
 * - **hover** greets with the wave;
 * - heart buttons drive quest-complete (heal) and blink (damage) via
 *   the `signal` prop.
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
  // schedules the next self-directed one-shot. `first` is consumed when the
  // fidget actually FIRES, not when scheduled: the mount greeting (or a
  // hover) cancels this timer, and the beat after that interruption should
  // still be the short one.
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

  if (reduced) {
    return (
      <span className={`arshad-sprite-stage ${className ?? ''}`}>
        <span
          aria-hidden="true"
          className="arshad-sprite arshad-sprite--breathing"
          style={{ animation: 'none' }}
        />
      </span>
    );
  }

  const cssClass = phase.kind === 'action' ? IDLE_ACTION_CLASS[phase.action] : IDLE_BASE_CLASS;

  return (
    <span className={`arshad-sprite-stage ${className ?? ''}`} onPointerEnter={onPointerEnter}>
      <span
        aria-hidden="true"
        key={phase.kind === 'action' ? phase.epoch : 'base'}
        className={`arshad-sprite arshad-sprite--${cssClass}`}
      />
    </span>
  );
};
