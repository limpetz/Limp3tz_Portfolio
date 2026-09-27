/**
 * Portrait geometry probe: guards the 170/176 stage retune's contract in a
 * real browser. The pack CSS scales the 176x340 cell by 170/176 so each frame
 * STEP lands on exactly 170 whole CSS px (fractional steps rasterize every
 * frame on a different sub-pixel phase — the whole character shimmers). This
 * loads the served build, measures the live stage box + computed scale, and
 * asserts both still match 170 x 328.41 and 170/176. Fresh screenshots of the
 * portrait card and the full stage are saved to .freebuff/visual-check/ for
 * review.
 *
 * Usage: node scripts/probe-portrait-170.mjs [url]   (url defaults to :4173)
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = process.argv[2] || 'http://localhost:4173/';
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) =>
    existsSync(p),
  );

if (!CHROME) {
  console.error('No Chrome binary found; set CHROME_PATH.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,1000', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 1000 },
});

const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30_000 });

// Skip the boot screen if present.
await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Press start to enter the portfolio"]');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1200));

// Scroll to the character sheet (#about) so the portrait mounts.
await page.evaluate(() => document.getElementById('about')?.scrollIntoView());
await new Promise((r) => setTimeout(r, 1500));

const portrait = await page.evaluate(() => {
  const stage = document.querySelector('.arshad-sprite-stage');
  const sprite = document.querySelector('.arshad-sprite');
  if (!stage || !sprite) return null;
  const s = stage.getBoundingClientRect();
  const cls = sprite.className;
  const transform = getComputedStyle(sprite).transform;
  // Parse the matrix(a, b, c, d, e, f) — a is the x scale.
  const m = transform.match(/matrix\(([-\d.]+),/);
  const scale = m ? parseFloat(m[1]) : NaN;
  return {
    stageW: s.width.toFixed(2),
    stageH: s.height.toFixed(2),
    scale,
    cls,
    transform,
  };
});

console.log('portrait stage:', portrait);

// Screenshot the portrait card region.
const aboutEl = await page.$('#about');
if (aboutEl) {
  await aboutEl.screenshot({ path: '.freebuff/visual-check/portrait-170-verify.png' });
  console.log('saved .freebuff/visual-check/portrait-170-verify.png');
}

// Full stage screenshot.
await page.evaluate(() => document.getElementById('stage')?.scrollIntoView());
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: '.freebuff/visual-check/stage-170-verify.png' });
console.log('saved .freebuff/visual-check/stage-170-verify.png');

await browser.close();

// Sanity assertions on the retune.
if (portrait) {
  const okW = Math.abs(parseFloat(portrait.stageW) - 170) < 0.5;
  const okH = Math.abs(parseFloat(portrait.stageH) - 328.41) < 0.5;
  const okScale = Math.abs(portrait.scale - 170 / 176) < 0.001;
  console.log(`  ok: stage box is 170x328.41 (${portrait.stageW}x${portrait.stageH}) : ${okW && okH}`);
  console.log(`  ok: sprite scale is 170/176 = ${(170 / 176).toFixed(4)} (got ${portrait.scale}) : ${okScale}`);
  if (!(okW && okH && okScale)) process.exitCode = 1;
} else {
  console.error('  FAIL: portrait not found in the DOM');
  process.exitCode = 1;
}
