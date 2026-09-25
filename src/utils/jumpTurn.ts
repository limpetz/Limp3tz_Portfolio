/**
 * Jump and 3D Turning sprite sheet definitions and animation controller.
 *
 * Provides:
 * - 3D turning animation using arshad-turn.png (grounded) and arshad-air-turn.png (airborne).
 * - Multi-phase directional jumping using arshad-jump.png.
 * - Walk cycle support from the compact walk sheet.
 * - Alignment and drawing anchor offsets so switching sheets never jerks the character.
 * - Mid-turn reversal, easing, reduced-motion compatibility, and sharp pixel rendering.
 */

import walkPng from '../assets/images/sprite/walk/arshad-walk.png';
import jumpPng from '../assets/images/sprite/jump-turn/arshad-jump.png';
import turnPng from '../assets/images/sprite/jump-turn/arshad-turn.png';
import airTurnPng from '../assets/images/sprite/jump-turn/arshad-air-turn.png';

export type SpriteSheetKey = 'walk' | 'jump' | 'turn' | 'airTurn';

export interface SheetSpec {
  src: string;
  w: number;
  h: number;
  cols: number;
  rows: number;
  ax: number;
  fy: number;
  /**
   * Measured height of the *standing* character inside a cell, in sheet px.
   *
   * The sheets were drawn at different scales — the walk art is roughly 25%
   * smaller than the jump/turn art — so this is what lets the renderer
   * normalise them onto one on-screen size (see `renderScale`). Measured from
   * the alpha bounding box of a standing frame; re-measure if the art changes.
   * Airborne sheets use the scale of the art they share a canvas size with.
   */
  contentH: number;
}

export const SPRITE_SPECS: Record<SpriteSheetKey, SheetSpec> = {
  walk: {
    src: walkPng,
    w: 88,
    h: 170,
    cols: 9,
    rows: 2,
    ax: 44,
    fy: 164,
    contentH: 124,
  },
  jump: {
    src: jumpPng,
    w: 144,
    h: 208,
    cols: 9,
    rows: 2,
    ax: 72,
    fy: 202,
    contentH: 155,
  },
  turn: {
    src: turnPng,
    w: 112,
    h: 170,
    cols: 9,
    rows: 1,
    ax: 56,
    fy: 164,
    contentH: 155,
  },
  airTurn: {
    src: airTurnPng,
    w: 144,
    h: 208,
    cols: 9,
    rows: 1,
    ax: 72,
    fy: 202,
    contentH: 155,
  },
};

/**
 * On-screen height the standing character renders at, in CSS px.
 *
 * Every sheet is scaled so its standing character lands here, which is what
 * stops the character changing size between idle, walking and jumping. Bumping
 * this number scales the whole character uniformly (all sheets together), so
 * the size stays consistent while he reads larger against the backdrop.
 *
 * Ceiling: the standing head must clear the overhead block band (BLOCK_Y) and
 * the head must still fit the stage at the top of a jump, so this cannot grow
 * without also moving the blocks or retuning the jump. See the reach maths in
 * ArcadeStage (BLOCK_Y / JUMP_V / GRAVITY).
 */
export const TARGET_CONTENT_H = 240;

/** Cell scale that lands a sheet's standing character at `TARGET_CONTENT_H`. */
export function renderScale(spec: SheetSpec): number {
  return TARGET_CONTENT_H / spec.contentH;
}

/**
 * Jump lifecycle poses (columns 0-8 in arshad-jump.png).
 * Row 0: facing right
 * Row 1: facing left
 */
export const JUMP_COLUMNS = {
  IDLE: 0,
  ANTICIPATION: 1,
  TAKEOFF: 2,
  RISING: 3,
  APEX: 4,
  FALLING: 5,
  PRE_LANDING: 6,
  LANDING: 7,
  RECOVERY: 8,
} as const;

/**
 * Timing constants for turning and jumping.
 */
export const TURN_DURATION = 0.25; // 250ms per user preference
export const JUMP_TIMINGS = {
  ANTICIPATION: 0.12, // seconds
  AIRTIME: 0.8,       // seconds
  LANDING: 0.12,      // seconds
  RECOVERY: 0.12,     // seconds
};

/**
 * Three-quarter turn columns mapping:
 * Left-to-right (turnProgress 0 -> 1): 2 -> 3 -> 4 -> 5 -> 6
 * Right-to-left (turnProgress 1 -> 0): 6 -> 5 -> 4 -> 3 -> 2
 */
export const TURN_START_COL = 2; // ~ -45 deg left 3/4 view
export const TURN_END_COL = 6;   // ~ +45 deg right 3/4 view

/**
 * Linear progression across every rotation frame.
 */
export function easeLinear(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * Maps a continuous turn progress [0, 1] (0 = left 3/4, 1 = right 3/4)
 * to a discrete column index [2..6] using linear interpolation.
 */
export function turnProgressToColumn(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return TURN_START_COL + Math.round(clamped * (TURN_END_COL - TURN_START_COL));
}

export interface CharacterRenderPose {
  sheet: SpriteSheetKey;
  column: number;
  row: number;
  width: number;
  height: number;
  /** Offset relative to character collision box bottom-center: (actorX + actorW/2, groundY + jumpOffset) */
  offsetX: number;
  offsetY: number;
  /** Background-position CSS value for the sprite cell */
  backgroundPosition: string;
  /** Background-size CSS value that keeps the whole sheet at the cell scale */
  backgroundSize: string;
}

/**
 * Calculates CSS background-position and relative bounding-box placement
 * for a specific sprite sheet cell and actor anchor.
 */
export function getRenderPose(
  sheetKey: SpriteSheetKey,
  column: number,
  row: number,
  actorWidth: number = 72,
): CharacterRenderPose {
  const spec = SPRITE_SPECS[sheetKey];
  // Normalise the art scale so every sheet's standing character is the same
  // on-screen height, then position/scale the cell from that.
  const scale = renderScale(spec);
  const cellW = spec.w * scale;
  const cellH = spec.h * scale;

  // Horizontal offset from actor box left edge:
  // Character anchorX aligns with the actor's center: actorWidth / 2
  // So sprite left is: (actorWidth / 2) - spec.ax * scale
  const offsetX = actorWidth / 2 - spec.ax * scale;

  // Vertical offset from actor box bottom (feet baseline):
  // Baseline is spec.fy px from the top of the sprite cell.
  // The bottom of the sprite cell extends below the baseline by: (spec.h - spec.fy).
  // So CSS bottom should be: -(spec.h - spec.fy) * scale
  const offsetY = -(spec.h - spec.fy) * scale;

  return {
    sheet: sheetKey,
    column,
    row,
    width: cellW,
    height: cellH,
    offsetX,
    offsetY,
    backgroundPosition: `${-column * cellW}px ${-row * cellH}px`,
    backgroundSize: `${cellW * spec.cols}px ${cellH * spec.rows}px`,
  };
}

export type AnimationMode =
  | 'ground'
  | 'anticipation'
  | 'air'
  | 'landing'
  | 'recovery';

export interface TurnState {
  isTurning: boolean;
  /** 0 = left 3/4 facing, 1 = right 3/4 facing */
  progress: number;
  /** Target direction: 1 (right) or -1 (left) */
  targetDir: 1 | -1;
}

/**
 * State machine for managing 3D turning and multi-phase jumps.
 */
export class AvatarAnimationController {
  mode: AnimationMode = 'ground';
  elapsed: number = 0;
  facingDir: 1 | -1 = 1; // 1 = right, -1 = left
  turnState: TurnState = {
    isTurning: false,
    progress: 1, // Start facing right (1)
    targetDir: 1,
  };
  reducedMotion: boolean = false;

  constructor(options?: { facingDir?: 1 | -1; reducedMotion?: boolean }) {
    if (options?.facingDir) {
      this.facingDir = options.facingDir;
      this.turnState.progress = options.facingDir === 1 ? 1 : 0;
      this.turnState.targetDir = options.facingDir;
    }
    if (options?.reducedMotion) {
      this.reducedMotion = options.reducedMotion;
    }
  }

  /**
   * Request a facing direction change.
   * If already facing this direction and not turning, does nothing.
   * If mid-turn, reverses smoothly from the current progress.
   */
  requestDirection(dir: 1 | -1) {
    if (this.reducedMotion) {
      this.facingDir = dir;
      this.turnState.progress = dir === 1 ? 1 : 0;
      this.turnState.targetDir = dir;
      this.turnState.isTurning = false;
      return;
    }

    if (this.turnState.targetDir === dir && (this.turnState.isTurning || this.facingDir === dir)) {
      // Already moving toward or at this direction. Holding key won't restart.
      return;
    }

    this.turnState.targetDir = dir;
    this.turnState.isTurning = true;
  }

  /**
   * Trigger a jump. Returns true if jump transition started.
   */
  startJump(): boolean {
    if (this.mode !== 'ground') return false;
    if (this.reducedMotion) {
      this.mode = 'air';
      this.elapsed = 0;
      return true;
    }
    this.mode = 'anticipation';
    this.elapsed = 0;
    return true;
  }

  /**
   * Reset / cancel active animations.
   */
  reset() {
    this.mode = 'ground';
    this.elapsed = 0;
    this.turnState.isTurning = false;
    this.turnState.progress = this.facingDir === 1 ? 1 : 0;
    this.turnState.targetDir = this.facingDir;
  }

  /**
   * Step the animation clock by dt seconds.
   */
  update(dt: number) {
    let remaining = Math.max(0, dt);

    while (remaining > 0) {
      const clampedDt = Math.min(remaining, 0.02);
      remaining -= clampedDt;

      // Update jump mode lifecycle
      if (this.mode !== 'ground') {
        this.elapsed += clampedDt;
        if (this.mode === 'anticipation' && this.elapsed >= JUMP_TIMINGS.ANTICIPATION) {
          this.mode = 'air';
          this.elapsed = 0;
        } else if (this.mode === 'landing' && this.elapsed >= JUMP_TIMINGS.LANDING) {
          this.mode = 'recovery';
          this.elapsed = 0;
        } else if (this.mode === 'recovery' && this.elapsed >= JUMP_TIMINGS.RECOVERY) {
          this.mode = 'ground';
          this.elapsed = 0;
        }
      }

      // Update turning
      if (this.turnState.isTurning) {
        const step = (1 / TURN_DURATION) * clampedDt;

        if (this.turnState.targetDir === 1) {
          this.turnState.progress = Math.min(1, this.turnState.progress + step);
          if (this.turnState.progress >= 1) {
            this.turnState.progress = 1;
            this.turnState.isTurning = false;
            this.facingDir = 1;
          }
        } else {
          this.turnState.progress = Math.max(0, this.turnState.progress - step);
          if (this.turnState.progress <= 0) {
            this.turnState.progress = 0;
            this.turnState.isTurning = false;
            this.facingDir = -1;
          }
        }
      }
    }
  }

  /**
   * Determine the current sprite frame and sheet to draw.
   */
  getCurrentPose(options: {
    walking: boolean;
    walkFrame: number;
    actorWidth?: number;
    jumpProgress?: number; // 0..1 in air, fallback if physics controls airtime
  }): CharacterRenderPose {
    const actorW = options.actorWidth ?? 72;

    // 1. Turning (takes precedence on ground or mid-air)
    if (this.turnState.isTurning) {
      const sheet = this.mode === 'air' ? 'airTurn' : 'turn';
      const col = turnProgressToColumn(this.turnState.progress);
      return getRenderPose(sheet, col, 0, actorW);
    }

    // 2. Jump phases
    const row = this.facingDir === 1 ? 0 : 1;
    if (this.mode === 'anticipation') {
      return getRenderPose('jump', JUMP_COLUMNS.ANTICIPATION, row, actorW);
    }
    if (this.mode === 'air') {
      const p = Math.max(0, Math.min(1, options.jumpProgress ?? (this.elapsed / JUMP_TIMINGS.AIRTIME)));
      // Columns in air:
      // takeoff (2), rising (3), apex (4), falling (5), pre-landing (6)
      let col: number;
      if (p < 0.15) col = JUMP_COLUMNS.TAKEOFF;
      else if (p < 0.38) col = JUMP_COLUMNS.RISING;
      else if (p < 0.62) col = JUMP_COLUMNS.APEX;
      else if (p < 0.85) col = JUMP_COLUMNS.FALLING;
      else col = JUMP_COLUMNS.PRE_LANDING;

      return getRenderPose('jump', col, row, actorW);
    }
    if (this.mode === 'landing') {
      return getRenderPose('jump', JUMP_COLUMNS.LANDING, row, actorW);
    }
    if (this.mode === 'recovery') {
      return getRenderPose('jump', JUMP_COLUMNS.RECOVERY, row, actorW);
    }

    // 3. Grounded: Walk or Idle
    const walkRow = this.facingDir === 1 ? 0 : 1;
    // Map walk frame index (which is an index into WALK_SHEET.frames, e.g. 0 or 9 for idle, 1..8 or 10..17 for walk)
    // to column (0..8) within row 0 or row 1:
    const walkCol = options.walking ? (options.walkFrame % 9) : 0;
    return getRenderPose('walk', walkCol, walkRow, actorW);
  }
}
