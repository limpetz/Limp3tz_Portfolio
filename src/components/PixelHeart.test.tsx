import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PixelHeart } from './PixelHeart';

describe('PixelHeart', () => {
  it('renders SVG with default props', () => {
    const html = renderToStaticMarkup(<PixelHeart />);
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 10 9"');
    expect(html).toContain('width="16"');
    expect(html).toContain('height="14.4"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('animation-delay:0s');
    expect(html).toContain('animate-heart-beat');
  });

  it('respects custom size, className, and delay', () => {
    const html = renderToStaticMarkup(
      <PixelHeart size={20} className="custom-test-class" delay={0.4} />
    );
    expect(html).toContain('width="20"');
    expect(html).toContain('height="18"');
    expect(html).toContain('custom-test-class');
    expect(html).toContain('animation-delay:0.4s');
  });

  it('renders pixel outline, neon body, glint and shading layers', () => {
    const html = renderToStaticMarkup(<PixelHeart />);
    // Neon magenta body fill
    expect(html).toContain('fill="#ff2d78"');
    // Outline fill
    expect(html).toContain('fill="#26000d"');
    // White specular highlight
    expect(html).toContain('fill="#ffffff"');
    // Glint highlight
    expect(html).toContain('fill="#ff7ea8"');
    // Shading edge
    expect(html).toContain('fill="#88002d"');
  });
});
