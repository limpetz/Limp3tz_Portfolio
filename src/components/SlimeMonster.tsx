import React from 'react';
import type { SlimeColor, SlimeState } from '../utils/slime';
import { SLIME_HEIGHT, SLIME_WIDTH, slimeFrameCell } from '../utils/slime';
import slimeBlueImg from '../assets/images/Slime_Medium_Blue.png';
import slimeGreenImg from '../assets/images/Slime_Medium_Green.png';
import slimeRedImg from '../assets/images/Slime_Medium_Red.png';
import slimeWhiteImg from '../assets/images/Slime_Medium_White.png';

// Re-exported so consumers can keep importing the state union from here while
// the single source of truth lives in the pure utils module.
export type { SlimeColor, SlimeState };

interface SlimeMonsterProps {
  x: number;
  y: number; // ground clearance in px
  color: SlimeColor;
  state?: SlimeState;
  frameIndex?: number;
  /** Collision-box size — narrow stages use a smaller body (see `slimeBoxFor`). */
  width?: number;
  height?: number;
  /**
   * Direction the slime is pointed, as derived by `resolveSlimeMotion` — the
   * same value drives the patrol, so the eyes can never disagree with it.
   * The sheet art is a symmetric blob, so the eyes are drawn by this
   * renderer rather than mirrored in the sheet.
   */
  facing?: 1 | -1;
}

/** One sheet per colour; all four share an identical 4x4 / 32px frame grid. */
const SLIME_SHEETS: Record<SlimeColor, string> = {
  blue: slimeBlueImg,
  green: slimeGreenImg,
  red: slimeRedImg,
  white: slimeWhiteImg,
};

const CELL = 32; // sheet cell, px
const SHEET = 128; // full sheet, px
/**
 * Integer upscale keeps the 14x13px art crisp (no half-pixel sampling): 3x for
 * the full-size body, 2x for the narrow one, so the drawn slime always covers
 * about the same share of its collision box.
 */
function scaleFor(width: number): number {
  return Math.max(1, Math.round((width / SLIME_WIDTH) * 3));
}
// The art is only ~14x13px inside its 32px cell, centred horizontally with the
// sole on y=23. Anchoring those two points onto the collision box (centre-x,
// bottom) is what makes the slime sit on the ground line instead of floating.
const ANCHOR_X = 16;
const ANCHOR_Y = 23;

/** Eye layout in sheet (art) pixels, relative to the cell's top-left. */
const EYE_XS = [13, 18]; // centres, 5 art px apart, straddling ANCHOR_X
const EYE_ROW = 14; // top of the eyes, a couple of px below the blob's crown
const EYE_SHIFT = 1; // art px the eyes lean toward `facing`
const EYE_W = 1; // open eye: 1x2 tall pixel oval
const EYE_H = 2;
const DAZED_W = 2; // hit/die: a flat 2x1 closed lid, no lean
const DAZED_H = 1;
const EYE_COLOR = 'rgba(12,10,20,0.85)';

/**
 * Medium-slime hazard sprite. Draws one 32x32 cell from the colour's 128x128
 * sheet, upscaled 3x. Rows 0/1 hold the idle and move cycles; see `SLIME_ANIM`.
 *
 * The sheet art is a symmetric blob, so `facing` is rendered here as two pixel
 * eyes that lean toward the patrol direction (flat "dazed" lids on hit/die) —
 * the same `facing` the physics loop derives from the resolved velocity, so
 * the gaze always matches where the slime is actually going.
 */
export const SlimeMonster: React.FC<SlimeMonsterProps> = ({
  x,
  y,
  color,
  state = 'run',
  frameIndex = 0,
  width = SLIME_WIDTH,
  height = SLIME_HEIGHT,
  facing = 1,
}) => {
  const { row, col } = slimeFrameCell(frameIndex);
  const SCALE = scaleFor(width);
  const cell = CELL * SCALE;
  const dazed = state === 'hit' || state === 'die';
  const lean = dazed ? 0 : facing;
  const eyeW = (dazed ? DAZED_W : EYE_W) * SCALE;
  const eyeH = (dazed ? DAZED_H : EYE_H) * SCALE;
  const eyeState = dazed ? 'dazed' : facing === 1 ? 'right' : 'left';

  return (
    <div
      className="absolute z-20 pointer-events-none select-none"
      style={{
        left: `${x}px`,
        bottom: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      aria-label={`Slime Hazard: ${color}`}
    >
      <div
        className="pixel-art drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]"
        style={{
          position: 'absolute',
          // Anchor cell point (ANCHOR_X, ANCHOR_Y) on the box centre-x / bottom.
          left: `${width / 2 - ANCHOR_X * SCALE}px`,
          top: `${height - ANCHOR_Y * SCALE}px`,
          width: `${cell}px`,
          height: `${cell}px`,
          backgroundImage: `url(${SLIME_SHEETS[color]})`,
          backgroundSize: `${SHEET * SCALE}px ${SHEET * SCALE}px`,
          backgroundPosition: `-${col * cell}px -${row * cell}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
      {/* Renderer-drawn eyes: sheet art is symmetric, so the gaze lives here.
          Anchored on the same cell points as the sprite, so it stays put at
          either body scale. */}
      {EYE_XS.map((ex) => (
        <div
          key={ex}
          data-slime-eye={eyeState}
          style={{
            position: 'absolute',
            left: `${width / 2 + (ex - ANCHOR_X + lean) * SCALE}px`,
            top: `${height - (ANCHOR_Y - EYE_ROW) * SCALE}px`,
            width: `${eyeW}px`,
            height: `${eyeH}px`,
            background: EYE_COLOR,
          }}
        />
      ))}
    </div>
  );
};
