import React from 'react';

import nameBlockImg from '../assets/images/Identifier_Name_block.png';
import roleBlockImg from '../assets/images/class_role_block.png';
import locationBlockImg from '../assets/images/base-location_block.png';
import statusBlockImg from '../assets/images/status_block.png';

export type MysteryBlockKey = 'name' | 'role' | 'location' | 'status';
export type MysteryBlockVisualState = 'idle' | 'bump' | 'revealed';

/** One sheet per block; all four share the identical 4x3 / 362px frame grid. */
const BLOCK_SHEETS: Record<MysteryBlockKey, string> = {
  name: nameBlockImg,
  role: roleBlockImg,
  location: locationBlockImg,
  status: statusBlockImg,
};

/**
 * Idle floats through the sheet's top row (4-frame shimmer/float cycle); bump
 * plays the middle row once (sink → rise → peak → settle, as authored in the
 * frames); revealed holds the bottom row's label art. Frames are selected by
 * `background-position` percentages, which is what makes
 * `background-size: 400% 300%` work as a sprite grid: x at 0/33.33/66.67/100%
 * picks the column, y at 0/50/100% picks the row.
 */
const ANIM_CLASS: Record<MysteryBlockVisualState, string> = {
  idle: 'animate-block-idle',
  bump: 'animate-block-bump',
  revealed: 'animate-block-revealed',
};

/** Static fallback position, also the frozen frame under reduced motion. */
const STATIC_POSITION: Record<MysteryBlockVisualState, string> = {
  idle: '0% 0%',
  bump: '100% 50%',
  revealed: '0% 100%',
};

/**
 * Per-sheet fill compensation. The four sheets draw their block at different
 * widths inside the 362px frame — measured content widths are ~291px (name),
 * ~285px (role), ~235px (location) and ~227px (status) — so at one shared
 * scale the LOCATION and STATUS blocks read visibly smaller and their
 * revealed labels too. Each sheet scales so its content fills the same share
 * of the button (name's 291/362 ≈ 0.80 of the frame): location lands at
 * ~1.24x and status at ~1.28x, which also grows the revealed label art by
 * the same ratio. Transform-only, so hitboxes and neighbours never reflow.
 */
const SHEET_COMPENSATION: Record<MysteryBlockKey, number> = {
  name: 1,
  role: 1,
  location: 291 / 235,
  status: 291 / 227,
};

interface MysteryBlockSpriteProps {
  blockKey: MysteryBlockKey;
  state: MysteryBlockVisualState;
}

/**
 * Pixel-art sprite for one mystery block, drawn from its 1448x1086 sheet
 * (4x3 grid of 362px frames: idle / bump / revealed rows). The art carries the
 * whole block — rivets, `?`, bump pose and revealed label — so the button
 * behind it stays transparent and only supplies hitbox, hint glow and drag.
 */
export const MysteryBlockSprite: React.FC<MysteryBlockSpriteProps> = ({
  blockKey,
  state,
}) => (
  <span
    aria-hidden="true"
    className={`pixel-art absolute inset-0 block ${ANIM_CLASS[state]}`}
    style={{
      backgroundImage: `url(${BLOCK_SHEETS[blockKey]})`,
      backgroundSize: '400% 300%',
      backgroundPosition: STATIC_POSITION[state],
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
      // Normalise the drawn block size across sheets (transform only, so the
      // hitbox stays the button and neighbors never reflow).
      transform: `scale(${SHEET_COMPENSATION[blockKey]})`,
    }}
  />
);
