/**
 * Phone-width playtest: verifies the slime hazards on a 375px viewport, where
 * the narrow-stage rules apply (`slimeBoxFor` drops to the 32x29 body and the
 * safe zone reserves a left patrol lane).
 *
 * Unlike `playtest.mjs` (which suppresses hazards to measure the walk), this
 * run keeps hazards ON and asserts their DOM behavior directly:
 *
 *   1. All four slimes render.
 *   2. Each uses the narrow 32x34 body on a phone-width stage.
 *   3. Every slime actually patrols (covers ground) instead of vibrating
 *      against a wall — the pinned-slime bug this stage ships against.
 *   4. No sample ever places a body inside the safe zone, and no two samples
 *      are far enough apart to be a teleport (the ~190px blink bug).
 *
 * Usage: node scripts/slime-playtest.mjs [url]   (url defaults to :4173)
 * Exit code 0 = all assertions passed.
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = process.argv[2] || 'http://localhost:4173/';
const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error('No Chrome binary found; set CHROME_PATH.');
  process.exit(1);
}

const VIEWPORT = { width: 375, height: 667 }; // phone width → narrow-stage rules
const SAMPLE_MS = 150;
const SAMPLE_SECONDS = 12;
const MAX_STEP_PX = 45; // one frame of walk is ~1px; a teleport was ~190px

function assert(cond, message) {
  if (!cond) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok: ${message}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=375,667'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
  // NOTE: `__ARCADE_NO_HAZARDS__` is deliberately NOT set — this run tests the
  // hazards themselves.
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[aria-label="Press start to enter the portfolio"]', {
    timeout: 20000,
  });
  await page.click('[aria-label="Press start to enter the portfolio"]');
  // Spawn grace (2s) + the idle beat (0.7s) before patrol readings mean
  // anything; sample for 12s after that to cover several wall/zone bounces.
  await new Promise((r) => setTimeout(r, 3000));

  const readSlimes = () =>
    page.evaluate(() => {
      const slimes = [...document.querySelectorAll('[aria-label^="Slime Hazard:"]')].map(
        (el) => ({
          label: el.getAttribute('aria-label'),
          x: parseFloat(el.style.left) || 0,
          w: el.offsetWidth,
          h: el.offsetHeight,
        }),
      );
      // Safe zone: climb from the "SAFE ZONE HERE" label to the positioned
      // band that carries the zone's left/width styles.
      const span = [...document.querySelectorAll('span')].find((s) =>
        s.textContent?.includes('SAFE ZONE HERE'),
      );
      const band = span?.parentElement?.parentElement;
      const zone = band
        ? { left: band.offsetLeft, width: band.offsetWidth }
        : null;
      return { slimes, zone };
    });

  console.log('slime roster:');
  const first = await readSlimes();
  assert(first.slimes.length === 4, `four slimes rendered (got ${first.slimes.length})`);

  console.log('narrow-stage body:');
  const narrow = first.slimes.every((s) => s.w === 32 && s.h === 29);
  assert(
    narrow,
    `every slime uses the 32x29 narrow box (${first.slimes
      .map((s) => `${s.w}x${s.h}`)
      .join(', ')})`,
  );
  assert(first.zone !== null, 'safe zone marker found in the DOM');
  if (!narrow || !first.zone) {
    console.error('\nSLIME PLAYTEST FAILED');
    process.exit(1);
  }

  console.log(`patrol over ${SAMPLE_SECONDS}s:`);
  const seen = new Map(first.slimes.map((s) => [s.label, [s]]));
  const t0 = Date.now();
  while (Date.now() - t0 < SAMPLE_SECONDS * 1000) {
    await new Promise((r) => setTimeout(r, SAMPLE_MS));
    const { slimes, zone } = await readSlimes();
    for (const s of slimes) {
      const list = seen.get(s.label) ?? [];
      list.push({ ...s, zone });
      seen.set(s.label, list);
    }
  }

  let anyViolation = false;
  for (const [label, samples] of seen) {
    const xs = samples.map((s) => s.x);
    const range = Math.max(...xs) - Math.min(...xs);
    assert(range > 8, `${label} patrols (covers ${range.toFixed(0)}px)`);

    // Never inside the safe zone (1px sampling slack), never a teleport.
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (
        s.zone &&
        s.x + s.w > s.zone.left + 1 &&
        s.x < s.zone.left + s.zone.width - 1
      ) {
        anyViolation = true;
        console.error(`  FAIL: ${label} sampled inside the safe zone at x=${s.x}`);
      }
      if (i > 0) {
        const step = Math.abs(s.x - samples[i - 1].x);
        if (step > MAX_STEP_PX) {
          anyViolation = true;
          console.error(
            `  FAIL: ${label} jumped ${step.toFixed(0)}px between samples (teleport)`,
          );
        }
      }
    }
  }
  if (!anyViolation) console.log('  ok: no body inside the safe zone, no teleports');

  console.log(process.exitCode ? '\nSLIME PLAYTEST FAILED' : '\nAll slime playtest assertions passed.');
} finally {
  await browser.close();
}
