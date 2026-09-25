/**
 * CI playtest: drives the built site with a synthetic keyboard and asserts the
 * walk pose sequence and held-bounce cadence from the live DOM.
 *
 * Runs against real Chrome via puppeteer-core (puppeteer-core is a devDependency;
 * the runner supplies the browser binary). Not part of `npm test` — this needs a
 * browser, so the workflows run it after the build gate.
 *
 * Usage: node scripts/playtest.mjs [url]
 *   url defaults to http://localhost:4173/Limp3tz_Portfolio/ (vite preview,
 *   started by the caller). Timing assertions use generous headless margins;
 *   they guard against regressions (pose sequences, cadence parity), not exact
 *   frame timings.
 *
 * Exit code 0 = all assertions passed; nonzero = the site's animation regressed.
 */
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://localhost:4173/Limp3tz_Portfolio/';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const SEL = '[aria-label="Pixel character of Arshad Mohemed"]';
const BOOT = '[aria-label="Press start to enter the portfolio"]';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector(BOOT, { timeout: 20000 });
  await page.click(BOOT);
  await sleep(1000);

  const sample = () =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? { bg: el.style.backgroundPosition, tr: el.style.transform } : null;
    }, SEL);

  async function holdAndSample(key, ms) {
    const seen = [];
    await page.keyboard.down(key);
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await sample();
      if (s && (!seen.length || seen[seen.length - 1].bg !== s.bg)) {
        seen.push({ bg: s.bg, t: Date.now() - t0 });
      }
      await sleep(10);
    }
    await page.keyboard.up(key);
    return seen;
  }

  const WALK_COLS = ['-172', '-344', '-516', '-688', '-860', '-1032', '-1204', '-1376'];

  // --- 1. Walk pose sequence: 8 distinct stride poses ---
  console.log('walk pose sequence:');
  const right = await holdAndSample('ArrowRight', 1600);
  const rightWalk = right.map((s) => s.bg).filter((bg) => bg !== '0px 0px');

  assert(rightWalk.length >= 8, `right walk shows >=8 distinct poses (got ${rightWalk.length})`);
  assert(rightWalk.every((p) => WALK_COLS.some((c) => p.startsWith(c))),
    'right walk only shows walk-sheet columns');
  // stride-first: the first non-idle pose is a wide stride (cycle cols 1|2 =
  // sheet x -172 or -344). A continuing cycle from a previous input can open
  // mid-cycle, so accept any walk column as the first pose and assert instead
  // that a stride pose appears within the first three distinct poses.
  const firstStrideSoon = rightWalk
    .slice(0, 3)
    .some((p) => p === '-172px 0px' || p === '-344px 0px');
  assert(firstStrideSoon, `a stride pose appears early in the right walk (first: ${rightWalk[0]})`);
  await sleep(500);

  // --- 2. Left/right parity: baked left row, same cadence ---
  console.log('left/right parity:');
  const left = await holdAndSample('ArrowLeft', 1600);
  const leftWalk = left.map((s) => s.bg).filter((bg) => bg !== '0px 0px' && bg !== '0px -330px');
  assert(leftWalk.length >= 8, `left walk shows >=8 distinct poses (got ${leftWalk.length})`);
  assert(leftWalk.every((p) => p.endsWith('-330px')),
    'left walk renders from the baked left row');
  const leftStrideSoon = leftWalk
    .slice(0, 3)
    .some((p) => p === '-172px -330px' || p === '-344px -330px');
  assert(leftStrideSoon, `a stride pose appears early in the left walk (first: ${leftWalk[0]})`);

  const period = (seq) => {
    const seen = {};
    let best = Infinity;
    for (const { bg, t } of seq) {
      if (seen[bg] !== undefined) best = Math.min(best, t - seen[bg]);
      seen[bg] = t;
    }
    return best;
  };
  const pR = period(right);
  const pL = period(left);
  assert(Number.isFinite(pR) && Number.isFinite(pL) && Math.abs(pR - pL) <= 60,
    `loop periods within 60ms (R=${pR}ms L=${pL}ms)`);

  // --- 3. Stride-on-press: first pose change under 80ms ---
  console.log('stride-on-press:');
  async function pressLatency(key) {
    const before = await sample();
    const t0 = Date.now();
    await page.keyboard.down(key);
    let latency = null;
    while (Date.now() - t0 < 500) {
      const s = await sample();
      if (s && s.bg !== before.bg) { latency = Date.now() - t0; break; }
      await sleep(8);
    }
    await page.keyboard.up(key);
    await sleep(500);
    return latency;
  }
  const latR = await pressLatency('ArrowRight');
  const latL = await pressLatency('ArrowLeft');
  assert(latR !== null && latR <= 80, `right stride latency ${latR}ms <= 80ms`);
  assert(latL !== null && latL <= 80, `left stride latency ${latL}ms <= 80ms`);

  // --- 4. Held bounce: immediate relaunch, flowing air cycle ---
  // The boot click parks a walk target near stage centre; walking left first
  // moves the hero clear of the mystery blocks, whose head-bumps would else
  // interrupt the arc and truncate the pose cycle.
  console.log('held bounce:');
  await page.keyboard.down('ArrowLeft');
  await sleep(700);
  await page.keyboard.up('ArrowLeft');
  await sleep(400);
  await page.keyboard.down('ArrowUp');
  const t0 = Date.now();
  let above = false, launches = 0;
  const airPoses = new Set();
  while (Date.now() - t0 < 2400) {
    const s = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const actor = document.querySelector('[title*="Click to jump"]');
      return el ? { bg: el.style.backgroundPosition, b: actor ? parseFloat(actor.style.bottom) : null } : null;
    }, SEL);
    if (s && s.b !== null) {
      const air = s.b > 93;
      if (air && !above) launches++;
      above = air;
      if (air) airPoses.add(s.bg);
    }
    await sleep(12);
  }
  await page.keyboard.up('ArrowUp');
  assert(launches >= 1, `held jump launches (${launches} airborne segment(s) in 2.4s)`);

  // Air cycle must include RISING(3), APEX(4), FALLING(5), PRE_LANDING(6) on
  // whichever row the facing dictates (jump cells 224px; row 0 right, row 1 left).
  const expected = [3, 4, 5, 6].map((c) => [`${-c * 224}px 0px`, `${-c * 224}px -330px`]);
  for (const [rightPose, leftPose] of expected) {
    assert(airPoses.has(rightPose) || airPoses.has(leftPose),
      `held bounce shows air pose col ${rightPose.split('px')[0].slice(1) / 224}`);
  }
  // The takeoff snap (col 2) must NOT dominate: with the immediate relaunch the
  // rising pose (col 3) must appear alongside apex/falling.
  const risingSeen = airPoses.has('-672px 0px') || airPoses.has('-672px -330px');
  assert(risingSeen, 'held bounce includes RISING (no takeoff snap)');

  console.log(process.exitCode ? '\nPLAYTEST FAILED' : '\nAll playtest assertions passed.');
} finally {
  await browser.close();
}
