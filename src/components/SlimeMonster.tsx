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
/** Integer upscale keeps the 14x13px art crisp (no half-pixel sampling). */
const SCALE = 3;
// The art is only ~14x13px inside its 32px cell, centred horizontally with the
// sole on y=23. Anchoring those two points onto the collision box (centre-x,
// bottom) is what makes the slime sit on the ground line instead of floating.
const ANCHOR_X = 16;
const ANCHOR_Y = 23;

/**
 * Medium-slime hazard sprite. Draws one 32x32 cell from the colour's 128x128
 * sheet, upscaled 3x. Rows 0/1 hold the idle and move cycles; see `SLIME_ANIM`.
 *
 * The art is a symmetric blob with no eyes, so `facing` is intentionally not a
 * prop — there is nothing to mirror.
 */
export const SlimeMonster: React.FC<SlimeMonsterProps> = ({
  x,
  y,
  color,
  state = 'run',
  frameIndex = 0,
}) => {
  const { row, col } = slimeFrameCell(frameIndex);
  const cell = CELL * SCALE;

  return (
    <div
      className="absolute z-20 pointer-events-none select-none"
      style={{
        left: `${x}px`,
        bottom: `${y}px`,
        width: `${SLIME_WIDTH}px`,
        height: `${SLIME_HEIGHT}px`,
      }}
      aria-label={`Slime Hazard: ${color}`}
    >
      <div
        className="pixel-art drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]"
        style={{
          position: 'absolute',
          // Anchor cell point (ANCHOR_X, ANCHOR_Y) on the box centre-x / bottom.
          left: `${SLIME_WIDTH / 2 - ANCHOR_X * SCALE}px`,
          top: `${SLIME_HEIGHT - ANCHOR_Y * SCALE}px`,
          width: `${cell}px`,
          height: `${cell}px`,
          backgroundImage: `url(${SLIME_SHEETS[color]})`,
          backgroundSize: `${SHEET * SCALE}px ${SHEET * SCALE}px`,
          backgroundPosition: `-${col * cell}px -${row * cell}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
