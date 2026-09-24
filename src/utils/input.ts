/**
 * Keyboard input mapping and jump decision logic for the arcade stage.
 *
 * Kept pure so the auto-repeat / hold-to-jump behaviour can be unit tested
 * without a DOM or a running React tree.
 */

export const LEFT_KEYS = ['ArrowLeft', 'KeyA'] as const;
export const RIGHT_KEYS = ['ArrowRight', 'KeyD'] as const;
export const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'] as const;

export function isLeftKey(code: string): boolean {
  return (LEFT_KEYS as readonly string[]).includes(code);
}

export function isRightKey(code: string): boolean {
  return (RIGHT_KEYS as readonly string[]).includes(code);
}

export function isJumpKey(code: string): boolean {
  return (JUMP_KEYS as readonly string[]).includes(code);
}

export interface JumpDecisionInput {
  /** KeyboardEvent.repeat — true for OS key-repeat events. */
  repeat: boolean;
  /** Whether the jump key is already being held down. */
  heldJump: boolean;
  /**
   * When true, holding the jump key bounces continuously (each bounce is still
   * gated by the grounded check inside doJump). When false, only a fresh press
   * triggers a jump and key-repeat is ignored entirely.
   */
  holdToJump: boolean;
}

/**
 * Decide whether a jump keydown event should trigger a jump.
 *
 * In hold-to-jump mode every event is allowed through; the caller's grounded
 * check prevents mid-air double jumps. Otherwise repeat events are ignored and
 * the held flag prevents pressing two jump keys at once from double-firing.
 */
export function shouldTriggerJump({ repeat, heldJump, holdToJump }: JumpDecisionInput): boolean {
  if (holdToJump) return true;
  return !repeat && !heldJump;
}

/**
 * Horizontal direction from the currently held movement keys: -1 left, 1 right,
 * or 0 when idle / both directions held.
 */
export function moveDirection(left: boolean, right: boolean): -1 | 0 | 1 {
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  return dir as -1 | 0 | 1;
}
