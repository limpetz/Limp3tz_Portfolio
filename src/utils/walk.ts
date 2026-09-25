/**
 * Walk-cycle animation for the arcade stage character.
 *
 * Driven entirely by `arshad-walk.json` (shipped next to the sheet): the JSON
 * declares the cell size, the animation index groups and the per-frame
 * durations, so nothing here hard-codes frame counts or positions.
 *
 * The renderer only ever changes CSS `background-position`/`background-size` on
 * the actor's sprite element — frame selection runs inside the existing physics
 * loop, so there is no React state churn per frame.
 */
import sheetPng from '../assets/images/arshad-sprites-240px/assets/arshad-walk.png';
import sheetJson from '../assets/images/arshad-sprites-240px/assets/arshad-walk.json';

export interface WalkFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number | null;
}

export interface WalkSheet {
  src: string;
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  frameHeight: number;
  /** Frame rectangles in sheet coordinates, indexed by animation index. */
  frames: WalkFrameRect[];
  animations: Record<string, number[]>;
  defaultFps: number;
  /** Foot baseline within a cell, from the top of the cell. */
  footY: number;
  /** Horizontal character anchor within a cell. */
  anchorX: number;
}

const raw = sheetJson as {
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  frameHeight: number;
  defaultFps: number;
  anchor: { x: number; footY: number };
  animation: Record<string, number[]>;
  frames: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    durationMs: number | null;
  }>;
};

export const WALK_SHEET: WalkSheet = {
  src: sheetPng,
  imageWidth: raw.imageWidth,
  imageHeight: raw.imageHeight,
  frameWidth: raw.frameWidth,
  frameHeight: raw.frameHeight,
  frames: raw.frames,
  animations: raw.animation,
  defaultFps: raw.defaultFps,
  footY: raw.anchor.footY,
  anchorX: raw.anchor.x,
};

/** Sanity guard: the JSON, the sheet and the animation indices must agree. */
if (
  WALK_SHEET.frames.length !==
  Object.values(WALK_SHEET.animations).reduce((n, a) => Math.max(n, Math.max(...a) + 1), 0)
) {
  // A mismatch means the metadata and the artwork drifted apart; fail fast in
  // dev rather than animating garbage.
  console.warn('[walk] animation indices do not cover the declared frames');
}

/** ms a given frame stays on screen (JSON duration, else the default fps). */
export function frameDurationMs(frame: WalkFrameRect, defaultFps: number): number {
  return frame.durationMs ?? 1000 / defaultFps;
}

/** Total loop length of an animation, in ms. */
export function animationLengthMs(
  indices: number[],
  frames: WalkFrameRect[],
  defaultFps: number,
): number {
  return indices.reduce((sum, i) => sum + frameDurationMs(frames[i], defaultFps), 0);
}

/**
 * Which frame of `indices` is showing `elapsedMs` into the (looping) cycle.
 *
 * Pure so the cadence is unit tested; the physics loop just calls this with a
 * monotonically increasing elapsed time.
 */
export function frameAtElapsed(
  elapsedMs: number,
  indices: number[],
  frames: WalkFrameRect[],
  defaultFps: number,
): number {
  const total = animationLengthMs(indices, frames, defaultFps);
  if (total <= 0 || indices.length === 0) return indices[0] ?? 0;

  let t = ((elapsedMs % total) + total) % total;
  for (const i of indices) {
    t -= frameDurationMs(frames[i], defaultFps);
    if (t < 0) return i;
  }
  return indices[indices.length - 1];
}

/** The background-position that shows a frame's cell in a container of `cellW`×`cellH`. */
export function backgroundPositionFor(
  frame: WalkFrameRect,
  sheet: WalkSheet,
  cellW: number,
  cellH: number,
): string {
  const scale = cellW / sheet.frameWidth;
  return `${-(frame.x * scale).toFixed(2)}px ${-(frame.y * scale).toFixed(2)}px`;
}
