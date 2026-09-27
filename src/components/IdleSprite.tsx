import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  IDLE_ACTION_CLASS,
  IDLE_ACTION_MS,
  IDLE_BASE_CLASS,
  ONE_SHOT_HOLD_MS,
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
 * - **breathing** loop plays continuously as the base state;
 * - a director (utils/idleDirector.ts) schedules self-directed one-shots
 *   (blink, look-around, check-watch, weight-shift) every 9-20s;
 * - **hover** greets with the wave one-shot;
 * - the character sheet's heart buttons drive quest-complete (heal) and
 *   blink (damage) via the `signal` prop.
 *
 * Scheduling model: one effect keyed on `phase`. An action phase schedules
 * its own return to base (after the pack-CSS-locked duration + a short hold
 * on the end pose); the base phase schedules the next self-directed one-shot
 * after a random quiet gap. Directed signals (hearts, hover) simply flip the
 * phase and the chain keeps running — no timer juggling between systems.
 *
 * The pack CSS keyframes step `background-position` in absolute 88px cells,
 * so the sprite element itself must stay 88x170; it is scaled up with a
 * transform inside a wrapper sized to the scaled cell, keeping the art crisp
 * (`image-rendering: pixelated` comes from the pack class). The inner span
 * is keyed by an epoch that bumps on every action start, so re-firing the
 * same one-shot (e.g. two heals in a row) restarts the CSS animation.
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

const DISPLAY_SCALE = PORTRAIT_H / CELL_CONTENT_H;

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

  // The scheduler, keyed on phase: actions time their return to base; base
  // schedules the next self-directed one-shot. Each branch owns exactly one
  // timer and cancels it on the next phase change.
  useEffect(() => {
    if (reduced) return undefined;
    if (phase.kind === 'action') {
      const t = window.setTimeout(
        () => setPhase({ kind: 'base' }),
        IDLE_ACTION_MS[phase.action] + ONE_SHOT_HOLD_MS,
      );
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => beginAction(pickOneShot()), nextOneShotDelayMs());
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
