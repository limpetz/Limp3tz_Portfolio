/**
 * Live cadence probe (dev tool, not shipped, not in CI).
 *
 * Measures what the walk actually renders against the deployed site (or a
 * preview): steady-state speed, loop period, steps/min and travel per step —
 * the numbers needed to judge foot-slide against the art's contact spreads
 * (~59-73px between the two feet at the footfall poses).
 *
 * Usage: CHROME_PATH=... node scripts/cadence-probe.mjs [url]
 * Defaults to the local vite preview build (run `npm run build` first).
 */
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://localhost:4173/';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const SEL = '[aria-label="Pixel character of Arshad Mohemed"]';
const BOOT = '[aria-label="Press start to enter the portfolio"]';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector(BOOT, { timeout: 20000 });
  await page.click(BOOT);
  await sleep(800);

  // Sample bg + x position every ~16ms while the key is held.
  const sample = () =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const actor = document.querySelector('[title*="Click to jump"]');
      return el && actor
        ? { bg: el.style.backgroundPosition, x: actor.style.left }
        : null;
    }, SEL);

  // Walk clear of the blocks first (measured, like the playtest).
  await page.keyboard.down('ArrowRight');
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const clear = await page.evaluate(() => {
      const actor = document.querySelector('[title*="Click to jump"]');
      const blocks = document.querySelectorAll('[aria-label^="Mystery Block:"]');
      if (!actor || !blocks.length) return false;
      const a = actor.getBoundingClientRect();
      let right = -Infinity;
      for (const b of blocks) right = Math.max(right, b.getBoundingClientRect().right);
      return a.left > right + 40;
    });
    if (clear) break;
    await sleep(60);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowRight');
  }
  await page.keyboard.up('ArrowRight');
  await sleep(400);
  // Let the turn finish so the measured leg isn't contaminated by turn frames.
  await sleep(600);

  // --- Measured run: hold LEFT for 3.5s (back across the open stage —
  // continuing right would hit the stage wall mid-window) ---
  const samples = [];
  await page.keyboard.down('ArrowLeft');
  const r0 = Date.now();
  while (Date.now() - r0 < 3500) {
    const s = await sample();
    if (s) samples.push({ t: Date.now() - r0, ...s });
    await sleep(16);
  }
  await page.keyboard.up('ArrowRight');

  // Steady state: use the last 2.5s for speed (skip accel ramp).
  const tail = samples.filter((s) => s.t >= 1000);
  const px = (s) => parseFloat(s.x);
  const speed = ((px(tail[tail.length - 1]) - px(tail[0])) / (tail[tail.length - 1].t - tail[0].t)) * 1000;

  // Distinct bg frames in steady state (absolute timestamps).
  const frames = [];
  for (const s of samples) {
    if (s.t >= 1000 && (!frames.length || frames[frames.length - 1].bg !== s.bg)) {
      frames.push({ bg: s.bg, t: s.t });
    }
  }
  // Loop period: median of re-encounter intervals of the same bg.
  const seen = {};
  const periods = [];
  for (const f of frames) {
    if (seen[f.bg] !== undefined) periods.push(f.t - seen[f.bg]);
    seen[f.bg] = f.t;
  }
  periods.sort((a, b) => a - b);
  const medianPeriod = periods[Math.floor(periods.length / 2)];

  const cyclesPerMin = 60000 / medianPeriod;
  const travelPerCycle = (speed * medianPeriod) / 1000;
  const travelPerStep = travelPerCycle / 2;

  console.log(`live walk measurements (${URL}):`);
  console.log(`  steady-state speed     : ${speed.toFixed(0)} px/s (MAX_SPEED target 280)`);
  console.log(`  distinct frames seen   : ${frames.length} in 2.5s (8 expected per cycle)`);
  console.log(`  loop period (median)   : ${medianPeriod}ms (art-authored 800ms @ 210px/s)`);
  console.log(`  full cycles / min      : ${cyclesPerMin.toFixed(0)}  (one cycle = 8 poses)`);
  console.log(`  footfalls / min        : ${(cyclesPerMin * 2).toFixed(0)}`);
  console.log(`  travel per cycle       : ${travelPerCycle.toFixed(0)}px`);
  console.log(`  travel per step        : ${travelPerStep.toFixed(0)}px  (art contact spreads ~59-73px)`);
  console.log(
    travelPerStep > 73
      ? `  -> stance foot slides ~${(travelPerStep - 66).toFixed(0)}px/step beyond art-natural stride`
      : '  -> travel per step within art-natural stride range',
  );
} finally {
  await browser.close();
}
