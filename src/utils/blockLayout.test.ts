import { describe, expect, it } from 'vitest';
import { applyBlockOrder, rotateBlockOrder, sameOrder } from './blockLayout';

describe('applyBlockOrder', () => {
  const blocks = [{ key: 'name' }, { key: 'quest' }, { key: 'coin' }, { key: 'discord' }];

  it('reorders to the saved order', () => {
    const arranged = applyBlockOrder(blocks, ['discord', 'quest', 'coin', 'name']);
    expect(arranged.map((b) => b.key)).toEqual(['discord', 'quest', 'coin', 'name']);
  });

  it('appends blocks missing from a stale saved order (never drops)', () => {
    const arranged = applyBlockOrder(blocks, ['coin']);
    expect(arranged.map((b) => b.key)).toEqual(['coin', 'name', 'quest', 'discord']);
  });

  it('ignores unknown or duplicate keys in the saved order (never duplicates)', () => {
    const arranged = applyBlockOrder(blocks, ['ghost', 'quest', 'ghost', 'name', 'name']);
    expect(arranged.map((b) => b.key)).toEqual(['quest', 'name', 'coin', 'discord']);
  });
});

describe('rotateBlockOrder', () => {
  it('moves a block and wraps around both ends', () => {
    expect(rotateBlockOrder(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(rotateBlockOrder(['a', 'b', 'c'], 2, 1)).toEqual(['c', 'a', 'b']); // end wraps to front
    expect(rotateBlockOrder(['a', 'b', 'c'], 0, -1)).toEqual(['b', 'c', 'a']); // front wraps to end
  });

  it('handles empty input', () => {
    expect(rotateBlockOrder([], 0, 1)).toEqual([]);
  });
});

describe('sameOrder', () => {
  it('compares element-wise', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], [])).toBe(false);
  });
});
