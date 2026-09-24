import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_SLIDESHOW,
  HAS_CUSTOM_BACKGROUNDS,
  SLIDESHOW_FADE_MS,
  SLIDESHOW_INTERVAL_MS,
  STAGE_BACKGROUNDS,
  resolveStageBackgrounds,
  sortBackgroundEntries,
  stepBackgroundIndex,
} from './backgrounds';

describe('sortBackgroundEntries', () => {
  it('returns an empty list for an empty glob result', () => {
    expect(sortBackgroundEntries({})).toEqual([]);
  });

  it('orders images by filename, so 01- comes before 10-', () => {
    const entries = {
      '../assets/images/backgrounds/10-last.webp': 'url-10',
      '../assets/images/backgrounds/02-second.webp': 'url-02',
      '../assets/images/backgrounds/01-first.webp': 'url-01',
    };
    expect(sortBackgroundEntries(entries)).toEqual(['url-01', 'url-02', 'url-10']);
  });

  it('maps module paths to their resolved URLs', () => {
    const entries = { '../assets/images/backgrounds/only.webp': '/assets/only.webp' };
    expect(sortBackgroundEntries(entries)).toEqual(['/assets/only.webp']);
  });
});

describe('resolveStageBackgrounds', () => {
  it('uses the discovered images when there are any', () => {
    expect(resolveStageBackgrounds(['a.webp', 'b.webp'], 'fallback.jpg')).toEqual([
      'a.webp',
      'b.webp',
    ]);
  });

  it('falls back to the original backdrop when the folder is empty', () => {
    expect(resolveStageBackgrounds([], 'fallback.jpg')).toEqual(['fallback.jpg']);
  });

  it('returns a copy so callers cannot mutate the discovered list', () => {
    const urls = ['a.webp'];
    const resolved = resolveStageBackgrounds(urls, 'fallback.jpg');
    resolved.push('b.webp');
    expect(urls).toEqual(['a.webp']);
  });
});

describe('stepBackgroundIndex', () => {
  it('advances one slide at a time', () => {
    expect(stepBackgroundIndex(0, 1, 6)).toBe(1);
    expect(stepBackgroundIndex(2, 1, 6)).toBe(3);
  });

  it('wraps forward past the last slide', () => {
    expect(stepBackgroundIndex(5, 1, 6)).toBe(0);
  });

  it('wraps backward past the first slide', () => {
    expect(stepBackgroundIndex(0, -1, 6)).toBe(5);
    expect(stepBackgroundIndex(3, -1, 6)).toBe(2);
  });

  it('stays in range even for out-of-range steps', () => {
    expect(stepBackgroundIndex(0, 7, 6)).toBe(1);
    expect(stepBackgroundIndex(0, -13, 6)).toBe(5);
  });

  it('is a fixed point when only one background exists', () => {
    expect(stepBackgroundIndex(0, 1, 1)).toBe(0);
    expect(stepBackgroundIndex(0, -1, 1)).toBe(0);
  });

  it('returns 0 rather than NaN for an empty slideshow', () => {
    expect(stepBackgroundIndex(0, 1, 0)).toBe(0);
  });
});

describe('slideshow configuration', () => {
  it('holds each background for 4 seconds', () => {
    expect(SLIDESHOW_INTERVAL_MS).toBe(4000);
  });

  it('crossfades faster than the hold time, so a slide never fades into itself', () => {
    expect(SLIDESHOW_FADE_MS).toBeLessThan(SLIDESHOW_INTERVAL_MS);
  });

  it('always resolves to at least one usable background', () => {
    expect(STAGE_BACKGROUNDS.length).toBeGreaterThan(0);
    expect(STAGE_BACKGROUNDS.every((url) => typeof url === 'string' && url.length > 0)).toBe(true);
  });

  it('tracks whether images were discovered on disk', () => {
    expect(HAS_CUSTOM_BACKGROUNDS).toBe(BACKGROUND_SLIDESHOW.length > 0);
  });

  it('uses the discovered images when they exist, and only then', () => {
    if (HAS_CUSTOM_BACKGROUNDS) {
      expect(STAGE_BACKGROUNDS).toEqual(BACKGROUND_SLIDESHOW);
    } else {
      expect(STAGE_BACKGROUNDS).toHaveLength(1);
    }
  });
});
