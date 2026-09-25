import { PORTFOLIO_CONFIG } from './portfolioData';

/**
 * Hero background slideshow.
 *
 * Drop images into `src/assets/images/backgrounds/` and they are picked up
 * automatically — no code changes needed. They cycle in filename order, so
 * prefix them (`01-city.jpg`, `02-rain.jpg`, …) if you want a specific order.
 *
 * Supported formats: jpg, jpeg, png, webp, avif.
 * If the folder is empty, the single original backdrop is used as a fallback.
 */
const modules = import.meta.glob('../assets/images/backgrounds/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

/**
 * Turn a Vite glob result into the ordered list of background URLs.
 *
 * Vite returns an object keyed by module path; sorting those keys keeps files
 * in `01-`, `02-`, … order. Pure so the ordering is unit tested directly.
 */
export function sortBackgroundEntries(entries: Record<string, string>): string[] {
  return Object.keys(entries)
    .sort()
    .map((key) => entries[key]);
}

/**
 * The list the stage should actually cycle through. Never empty: when no
 * custom images are found we fall back to the original single backdrop.
 */
export function resolveStageBackgrounds(urls: readonly string[], fallback: string): string[] {
  return urls.length > 0 ? [...urls] : [fallback];
}

/**
 * Step an index around a slideshow, wrapping in both directions.
 * `direction` is +1 for next and -1 for previous.
 */
export function stepBackgroundIndex(current: number, direction: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + direction) % length) + length) % length;
}

/** Discovered background URLs, sorted by filename. */
export const BACKGROUND_SLIDESHOW: string[] = sortBackgroundEntries(modules);

/** True when the user has supplied at least one custom background. */
export const HAS_CUSTOM_BACKGROUNDS = BACKGROUND_SLIDESHOW.length > 0;

/** Effective list used by the stage — always non-empty. */
export const STAGE_BACKGROUNDS: string[] = resolveStageBackgrounds(
  BACKGROUND_SLIDESHOW,
  PORTFOLIO_CONFIG.defaultBackground,
);

/** How long each background stays on screen, in milliseconds. */
export const SLIDESHOW_INTERVAL_MS = 5000;

/** Crossfade duration, in milliseconds. */
export const SLIDESHOW_FADE_MS = 1000;
