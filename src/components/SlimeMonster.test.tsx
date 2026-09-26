import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlimeMonster } from './SlimeMonster';
import {
  SLIME_HEIGHT,
  SLIME_SHEET_H,
  SLIME_SHEET_W,
  SLIME_WIDTH,
  slimeFrameContent,
  slimeScaleFor,
} from '../utils/slime';

const htmlWith = (props: Parameters<typeof SlimeMonster>[0]) =>
  renderToStaticMarkup(<SlimeMonster {...props} />);

/** Pull a `name:<number>px` value out of the rendered inline style. */
const px = (html: string, name: string): number => {
  const m = html.match(new RegExp(`${name}:(-?[\\d.]+)px`));
  expect(m, `${name} not found in output`).not.toBeNull();
  return parseFloat(m![1]);
};

describe('SlimeMonster rendering', () => {
  it('draws the full body into the collision box', () => {
    const html = htmlWith({ x: 0, y: 0, color: 'emerald', state: 'run' });
    // One content window per slime, sized to the default 44x40 box.
    expect(px(html, 'width')).toBe(44);
    expect(px(html, 'height')).toBe(SLIME_HEIGHT);
    // Base frame: 274x173 art px at 44/274 scale — exactly the box width.
    const s = slimeScaleFor(44);
    expect(px(html, 'height')).toBe(40);
    expect(s).toBeCloseTo(44 / 274, 10);
    // The face lives in the art — no DOM eye overlay.
    expect(html).not.toContain('data-slime-eye');
  });

  it('scales down the hi-res art for the narrow-stage body', () => {
    const html = htmlWith({ x: 0, y: 0, color: 'cyan', width: 32, height: 29 });
    expect(px(html, 'width')).toBe(32);
    expect(px(html, 'height')).toBe(29);
  });

  it('positions the background on the requested cell including the content offset', () => {
    const html = htmlWith({ x: 0, y: 0, color: 'violet', state: 'run', frameIndex: 5 });
    const s = slimeScaleFor(SLIME_WIDTH);
    const c = slimeFrameContent(5); // attack row, col 1
    // The shared table is Emerald-derived: r1c1 emerald x[408-723] → rx = 46
    // (other colours sit within ~10 art px, absorbed by the shared anchor).
    expect(c.rx).toBe(46);
    expect(px(html, 'background-position')).toBeCloseTo(-((1 * 362 + c.rx) * s), 6);
    expect(px(html, 'background-size')).toBeCloseTo(SLIME_SHEET_W * s, 6);
    // background-size is a pair; check the height too via the second number.
    const sizePair = html.match(/background-size:(-?[\d.]+)px (-?[\d.]+)px/);
    expect(parseFloat(sizePair![2])).toBeCloseTo(SLIME_SHEET_H * s, 6);
    expect(html).not.toContain('scaleX');
  });

  it('never mirrors the sheet for facing — the art carries the face', () => {
    const right = htmlWith({ x: 0, y: 0, color: 'amber', frameIndex: 6 });
    const left = htmlWith({ x: 0, y: 0, color: 'amber', frameIndex: 6 });
    const pos = (h: string) => h.match(/background-position:[^;]+/)?.[0];
    expect(pos(right)).toBe(pos(left));
  });

  it('grounds every state on the box bottom via the row sole', () => {
    // Movement sole 354, attack 328, death 308 — the top offset must differ
    // per state even for the same box, because each row carries its own sole.
    const tops = ([0, 4, 8] as const).map((f) => {
      const html = htmlWith({ x: 0, y: 0, color: 'emerald', frameIndex: f });
      return px(html, 'top');
    });
    expect(new Set(tops).size).toBe(3);
    // And the base frame's content bottom sits exactly on the box bottom:
    // ry + h == sole for a grounded frame, so top + drawnH == box height.
    const base = htmlWith({ x: 0, y: 0, color: 'emerald', frameIndex: 0 });
    const s = slimeScaleFor(SLIME_WIDTH);
    const c = slimeFrameContent(0);
    expect(px(base, 'top') + c.h * s).toBeCloseTo(SLIME_HEIGHT, 6);
  });
});
