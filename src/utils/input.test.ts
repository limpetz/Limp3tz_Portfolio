import { describe, expect, it } from 'vitest';
import {
  JUMP_KEYS,
  LEFT_KEYS,
  RIGHT_KEYS,
  isJumpKey,
  isLeftKey,
  isRightKey,
  moveDirection,
  shouldTriggerJump,
} from './input';

describe('key mapping', () => {
  it('maps both arrow and WASD movement keys', () => {
    expect([...LEFT_KEYS]).toEqual(['ArrowLeft', 'KeyA']);
    expect([...RIGHT_KEYS]).toEqual(['ArrowRight', 'KeyD']);
    expect([...JUMP_KEYS]).toEqual(['Space', 'ArrowUp', 'KeyW']);
  });

  it('recognises left keys only', () => {
    expect(isLeftKey('ArrowLeft')).toBe(true);
    expect(isLeftKey('KeyA')).toBe(true);
    expect(isLeftKey('ArrowRight')).toBe(false);
    expect(isLeftKey('KeyD')).toBe(false);
  });

  it('recognises right keys only', () => {
    expect(isRightKey('ArrowRight')).toBe(true);
    expect(isRightKey('KeyD')).toBe(true);
    expect(isRightKey('ArrowLeft')).toBe(false);
  });

  it('recognises every jump key', () => {
    expect(JUMP_KEYS.every(isJumpKey)).toBe(true);
    expect(isJumpKey('KeyW')).toBe(true);
    expect(isJumpKey('KeyS')).toBe(false);
  });

  it('is case sensitive, matching KeyboardEvent.code values', () => {
    expect(isLeftKey('keya')).toBe(false);
  });
});

describe('shouldTriggerJump', () => {
  it('lets a fresh press jump', () => {
    expect(shouldTriggerJump({ repeat: false, heldJump: false, holdToJump: false })).toBe(true);
  });

  it('ignores OS key-repeat when hold-to-jump is off', () => {
    expect(shouldTriggerJump({ repeat: true, heldJump: true, holdToJump: false })).toBe(false);
  });

  it('ignores a second jump key pressed while one is already held', () => {
    expect(shouldTriggerJump({ repeat: false, heldJump: true, holdToJump: false })).toBe(false);
  });

  it('allows every event in hold-to-jump mode, leaving grounding to doJump()', () => {
    expect(shouldTriggerJump({ repeat: true, heldJump: true, holdToJump: true })).toBe(true);
    expect(shouldTriggerJump({ repeat: false, heldJump: false, holdToJump: true })).toBe(true);
  });
});

describe('moveDirection', () => {
  it('is -1 when only left is held', () => {
    expect(moveDirection(true, false)).toBe(-1);
  });

  it('is 1 when only right is held', () => {
    expect(moveDirection(false, true)).toBe(1);
  });

  it('is 0 when idle', () => {
    expect(moveDirection(false, false)).toBe(0);
  });

  it('is 0 when both directions are held, so the actor stands still', () => {
    expect(moveDirection(true, true)).toBe(0);
  });
});
