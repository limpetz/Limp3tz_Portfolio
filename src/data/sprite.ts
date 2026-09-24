/**
 * Measured metrics of the shipped character sprite.
 *
 * The artwork is a portrait canvas that is mostly transparent margin, so sizing
 * the *canvas* to the character's collision width renders the character far
 * smaller than intended. Everything that draws the sprite sizes it by the
 * visible content instead, using the helpers below.
 *
 * The numbers come from decoding the PNG's alpha channel to find the visible
 * bounding box. Re-measure if the artwork is replaced — see the "Sprite framing"
 * section of the README.
 */
export interface SpriteMetrics {
  /** Canvas size, in source pixels. */
  frameW: number;
  frameH: number;
  /** Visible (non-transparent) character size, in source pixels. */
  contentW: number;
  contentH: number;
  /** Transparent margins around the character, in source pixels. */
  padLeft: number;
  padTop: number;
  padRight: number;
  padBottom: number;
}

export const CHARACTER_SPRITE: SpriteMetrics = {
  frameW: 799,
  frameH: 1967,
  contentW: 769,
  contentH: 1778,
  padLeft: 14,
  padTop: 93,
  padRight: 16,
  padBottom: 96,
};

export interface CanvasSize {
  width: number;
  height: number;
}

/** CSS size the canvas must render at for the visible character to be `targetVisibleH` tall. */
export function spriteCanvasSize(
  targetVisibleH: number,
  metrics: SpriteMetrics = CHARACTER_SPRITE,
): CanvasSize {
  const scale = targetVisibleH / metrics.contentH;

  return {
    width: Math.round(metrics.frameW * scale),
    height: Math.round(metrics.frameH * scale),
  };
}

export interface SpritePlacement {
  /** Offsets from the actor box's bottom-left corner, in px. */
  left: number;
  bottom: number;
  /** On-screen size of the visible character, in px. */
  visibleWidth: number;
  visibleHeight: number;
}

/**
 * Where to place the canvas so the visible character is centred horizontally on
 * a `boxW`-wide actor box with its feet resting on the box's bottom edge.
 *
 * `bottom` is negative because the canvas extends below the feet by the scaled
 * bottom padding.
 */
export function spritePlacement(
  boxW: number,
  targetVisibleH: number,
  metrics: SpriteMetrics = CHARACTER_SPRITE,
): SpritePlacement {
  const scale = targetVisibleH / metrics.contentH;

  return {
    left: Math.round((boxW - metrics.contentW * scale) / 2 - metrics.padLeft * scale),
    bottom: -Math.round(metrics.padBottom * scale),
    visibleWidth: metrics.contentW * scale,
    visibleHeight: metrics.contentH * scale,
  };
}
