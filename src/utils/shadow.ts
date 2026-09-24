/**
 * Ground-shadow maths for the arcade stage.
 *
 * A shadow shrinks and fades as its caster rises, so the character's shadow and
 * the floating blocks' contact shadows are both driven by the same curve — that
 * is what makes them read as sitting at the same depth in the scene.
 *
 * All tuning lives in `SHADOW_CURVE`. The helpers are pure so the response
 * across the jump arc can be unit tested instead of eyeballed.
 */

export interface ShadowCurve {
  /** Size kept at the top of the arc, as a fraction of the grounded size. */
  minScaleX: number;
  minScaleY: number;
  /** Shadow opacity just above the ground… */
  groundOpacity: number;
  /** …and at the top of the arc. */
  apexOpacity: number;
  /** Landing squash: wider and flatter than at rest. */
  landScaleX: number;
  landScaleY: number;
  /**
   * Falloff exponent. Above 1 the shadow holds its size and weight close to the
   * ground, then drops away faster once the caster is genuinely airborne. That
   * makes small hops feel weighted rather than floaty, and stops the shadow
   * looking detached from a character who has barely left the floor.
   */
  ease: number;
}

export const SHADOW_CURVE: ShadowCurve = {
  minScaleX: 0.3,
  minScaleY: 0.45,
  groundOpacity: 0.9,
  apexOpacity: 0.22,
  landScaleX: 1.28,
  landScaleY: 0.72,
  ease: 1.35,
};

export interface ShadowState {
  scaleX: number;
  scaleY: number;
  opacity: number;
}

/**
 * Shadow state for a caster `height` px above the ground, where `apex` is the
 * highest point it can reach.
 *
 * Heights past the apex clamp, so a variable-height jump that stops short simply
 * gets a proportionally stronger shadow. A non-positive apex is treated as
 * "on the ground" rather than producing NaN.
 */
export function shadowForHeight(
  height: number,
  apex: number,
  landing = false,
  curve: ShadowCurve = SHADOW_CURVE,
): ShadowState {
  const t = apex > 0 ? Math.min(1, Math.max(0, height / apex)) : 0;
  const falloff = Math.pow(t, curve.ease);

  return {
    scaleX: (1 - (1 - curve.minScaleX) * falloff) * (landing ? curve.landScaleX : 1),
    scaleY: (1 - (1 - curve.minScaleY) * falloff) * (landing ? curve.landScaleY : 1),
    opacity: curve.groundOpacity - (curve.groundOpacity - curve.apexOpacity) * falloff,
  };
}
