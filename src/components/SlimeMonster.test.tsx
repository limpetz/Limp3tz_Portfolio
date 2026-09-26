import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlimeMonster } from './SlimeMonster';

const htmlWith = (props: Parameters<typeof SlimeMonster>[0]) =>
  renderToStaticMarkup(<SlimeMonster {...props} />);

const countEyes = (html: string) => (html.match(/data-slime-eye=/g) ?? []).length;

describe('SlimeMonster eyes', () => {
  it('draws two facing-right eyes by default, leaning toward +1', () => {
    const html = htmlWith({ x: 0, y: 0, color: 'blue' });
    expect(countEyes(html)).toBe(2);
    expect(html).toContain('data-slime-eye="right"');
    expect(html).not.toContain('data-slime-eye="left"');
    // Sheet-art anchor maths: eyes sit at left 16px / 31px on the 44px box
    // (centre 22 + (ex - 16 + 1) * 3).
    expect(html).toContain('left:16px');
    expect(html).toContain('left:31px');
    // Open eye is a 1x2 art-pixel oval: 3x6 on a full-size body.
    expect(html).toContain('width:3px');
    expect(html).toContain('height:6px');
  });

  it('mirrors the lean when facing left', () => {
    const html = htmlWith({ x: 0, y: 0, color: 'red', facing: -1 });
    expect(html).toContain('data-slime-eye="left"');
    expect(html).not.toContain('data-slime-eye="right"');
    // Same eyes minus the lean: 10px / 25px.
    expect(html).toContain('left:10px');
    expect(html).toContain('left:25px');
  });

  it('goes dazed — flat lids, no lean — on hit and die', () => {
    for (const state of ['hit', 'die'] as const) {
      const html = htmlWith({ x: 0, y: 0, color: 'green', state });
      expect(html).toContain('data-slime-eye="dazed"');
      expect(html).not.toContain('data-slime-eye="right"');
      expect(html).not.toContain('data-slime-eye="left"');
      // 2x1 art-pixel lid: 6x3, and no +1 lean (left 13px, not 16px).
      expect(html).toContain('width:6px');
      expect(html).toContain('height:3px');
      expect(html).toContain('left:13px');
      expect(html).not.toContain('left:16px');
    }
    // Combat states keep the directional eyes.
    for (const state of ['run', 'idle', 'attack'] as const) {
      const html = htmlWith({ x: 0, y: 0, color: 'white', state });
      expect(html).not.toContain('data-slime-eye="dazed"');
    }
  });

  it('scales the eyes with the narrow-stage body (2x instead of 3x)', () => {
    const html = htmlWith({ x: 0, y: 0, color: 'blue', width: 32, height: 34 });
    // Open eye at 2x: 2x4 px.
    expect(html).toContain('width:2px');
    expect(html).toContain('height:4px');
    // Anchor follows the shorter box: top 34 - (23-14)*2 = 16px.
    expect(html).toContain('top:16px');
  });

  it('keeps the sprite cell free of eyes it does not draw itself', () => {
    // The sheet cell must not be mirrored or transformed to "fake" facing —
    // the background position stays on the requested cell for either facing.
    const right = htmlWith({ x: 0, y: 0, color: 'blue', facing: 1, frameIndex: 5 });
    const left = htmlWith({ x: 0, y: 0, color: 'blue', facing: -1, frameIndex: 5 });
    const pos = (html: string) => html.match(/background-position:[^;]+/)?.[0];
    expect(pos(right)).toBe(pos(left));
  });
});
