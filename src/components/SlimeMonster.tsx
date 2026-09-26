import React from 'react';
import type { SlimeColor, SlimeState } from '../utils/slime';
import {
  SLIME_FRAME,
  SLIME_HEIGHT,
  SLIME_SHEET_COLS,
  SLIME_SHEET_H,
  SLIME_SHEET_W,
  SLIME_WIDTH,
  slimeFrameCell,
  slimeFrameContent,
  slimeScaleFor,
} from '../utils/slime';
import slimeEmeraldImg from '../assets/images/Emerald_slime.png';
import slimeVioletImg from '../assets/images/violet_slime.png';
import slimeAmberImg from '../assets/images/Amber_slime.png';
import slimeCyanImg from '../assets/images/Cyan_slime.png';

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
}

/** One sheet per colour; all four share the identical 4x3 / 362px frame grid. */
const SLIME_SHEETS: Record<SlimeColor, string> = {
  emerald: slimeEmeraldImg,
  violet: slimeVioletImg,
  amber: slimeAmberImg,
  cyan: slimeCyanImg,
};

const SHEET_W = SLIME_SHEET_W; // 1448
const SHEET_H = SLIME_SHEET_H; // 1086 — three rows, 362px each

/**
 * The 362px frames are hi-res art drawn well below native size (the body fills
 * a 44px collision box), so the renderer scales DOWN via `slimeScaleFor` — the
 * pixel-art class keeps the result crisp on integer device pixels.
 */
function scaleFor(width: number): number {
  return slimeScaleFor(width);
}

/**
 * Medium-slime hazard sprite. Draws one 362px cell from the colour's 4x3
 * sheet (rows: movement, attack, squished-death; see `SLIME_ANIM`).
 *
 * The frame's opaque content is anchored on the collision box's centre-x and
 * ground line — using each frame's measured bounding box (with the row's sole
 * for airborne frames), so the hop rises and the squash spreads exactly as
 * drawn, and every state sits on the ground instead of floating. The art
 * carries its own face, so the renderer never overlays eyes.
 */
export const SlimeMonster: React.FC<SlimeMonsterProps> = ({
  x,
  y,
  color,
  state = 'run',
  frameIndex = 0,
  width = SLIME_WIDTH,
  height = SLIME_HEIGHT,
}) => {
  const { row, col } = slimeFrameCell(frameIndex);
  const content = slimeFrameContent(frameIndex);
  const SCALE = scaleFor(width);
  const drawnW = content.w * SCALE;
  const drawnH = content.h * SCALE;

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
          // The div IS the frame's content window (its top-left is the content
          // bbox's top-left): centre it on the box centre-x and rest the row's
          // sole — or the airborne frame's baseline — on the box bottom.
          left: `${width / 2 - (content.rx * SCALE + drawnW / 2)}px`,
          top: `${height - (content.baseSole - content.ry) * SCALE}px`,
          width: `${drawnW}px`,
          height: `${drawnH}px`,
          backgroundImage: `url(${SLIME_SHEETS[color]})`,
          backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
          // The div starts at the frame's content corner (rx, ry), not the
          // frame corner — so the offset includes the content position.
          backgroundPosition: `-${(col * SLIME_FRAME + content.rx) * SCALE}px -${
            (row * SLIME_FRAME + content.ry) * SCALE
          }px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
