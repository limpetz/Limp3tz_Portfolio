/**
 * Live verification of the stomp + under-block-hint changes, driven headless:
 *
 *   STOMP — walks the hero into a slime's lane, jumps, and holds the bounce
 *   until the stomp registers; asserts the squash chain fires (score pays the
 *   stompChainScore link value) and the hazard count drops by one while the
 *   corpse plays out.
 *
 *   HINT — parks the hero under an unopened block and polls for the
 *   animate-hint-pulse class on the hinted block; asserts exactly one block
 *   is hinted, and that it is the nearest one.
 *
 * Usage: node scripts/stomp-hint-playtest.mjs [url]   (defaults to :4173)
 * Exit code 0 = all assertions passed.
 *
 * Notes:
 *   - Desktop viewport (1400x900): full-size 44x40 slimes, desktop block
 *     spacing — the stomp geometry and the hint reach differ on phone width,
 *     and both code paths share the same pure helpers, so desktop is the
 *     representative run.
 *   - The script drives REAL keyboard input; a hold-to-jump relaunch makes the
 *     stomp attempt robust against headless rAF throttling.
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

const SEL = '[aria-label="Pixel character of Arshad Mohemed"]';
const BOOT = '[aria-label="Press start to enter the portfolio"]';

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
  // Hazards stay ON — this run is about the hazards.
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector(BOOT, { timeout: 20000 });
  await page.click(BOOT);
  // Spawn grace is 2s; wait it out plus the slimes' idle beat.
  await new Promise((r) => setTimeout(r, 3000));

  const readState = () =>
    page.evaluate(() => {
      const slimes = [...document.querySelectorAll('[aria-label^="Slime Hazard:"]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top };
      });
      const actor = document.querySelector('[title*="Click to jump"]');
      const a = actor ? actor.getBoundingClientRect() : null;
      const scoreEl = document.querySelector('b.tabular-nums');
      const blocks = [...document.querySelectorAll('[aria-label^="Mystery Block:"]')].map((el) => ({
        hinted: el.className.includes('animate-hint-pulse'),
        arrow: !!el.querySelector('span[aria-hidden="true"]'),
        left: el.getBoundingClientRect().left,
        right: el.getBoundingClientRect().right,
      }));
      const bubble = [...document.querySelectorAll('div,span,p')].find((el) =>
        /SLIME STOMPED|STOMP CHAIN/.test(el.textContent ?? ''),
      );
      return {
        slimes,
        actor: a ? { left: a.left, right: a.right, top: a.top, bottom: a.bottom } : null,
        score: scoreEl ? parseInt(scoreEl.textContent ?? '0', 10) : 0,
        blocks,
        stomped: !!bubble,
      };
    });

  // -------------------------------------------------------------------
  // 1. HINT: the hero spawns inside the safe zone, which sits under the
  //    stage centre — poll from boot for the hint, before moving.
  // -------------------------------------------------------------------
  console.log('under-block hint:');
  let hintState = null;
  const hintT0 = Date.now();
  while (Date.now() - hintT0 < 8000) {
    const s = await readState();
    const hinted = s.blocks.filter((b) => b.hinted);
    if (hinted.length > 0) {
      hintState = { ...s, hinted };
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  assert(hintState !== null, 'hint pulse appears while the hero stands under a block');
  if (hintState) {
    assert(
      hintState.hinted.length === 1,
      `exactly one block is hinted (${hintState.hinted.length})`,
    );
    const block = hintState.hinted[0];
    assert(block.arrow, 'bouncing ▼ marker renders inside the hinted block');
    const aCenter = (hintState.actor.left + hintState.actor.right) / 2;
    const bCenter = (block.left + block.right) / 2;
    assert(
      Math.abs(aCenter - bCenter) <= 36,
      `hinted block is the overhead one (actor↔block centres ${Math.abs(aCenter - bCenter) | 0}px apart)`,
    );
  }

  // -------------------------------------------------------------------
  // 2. STOMP: walk right until the hero overlaps a slime's lane, then
  //    hold jump. The hold-to-jump relaunch makes repeated attempts; the
  //    first fall onto a head squashes it.
  // -------------------------------------------------------------------
  console.log('stomp a slime:');
  const scoreBefore = (await readState()).score;
  let stompResult = null;
  const t0 = Date.now();

  // Walk right through the lanes; hold jump continuously so the hero keeps
  // bouncing — any slime under a descending arc gets squashed.
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  while (Date.now() - t0 < 15000) {
    await new Promise((r) => setTimeout(r, 250));
    const s = await readState();
    if (s.score > scoreBefore && s.stomped) {
      stompResult = s;
      break;
    }
  }
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');

  if (!stompResult) {
    // One more attempt from a standing jump in place (slimes come to you).
    await page.keyboard.down('ArrowUp');
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) {
      await new Promise((r) => setTimeout(r, 250));
      const s = await readState();
      if (s.score > scoreBefore && s.stomped) {
        stompResult = s;
        break;
      }
    }
    await page.keyboard.up('ArrowUp');
  }

  assert(stompResult !== null, 'a stomp registered (score + SLIME STOMPED shout)');
  if (stompResult) {
    assert(
      stompResult.score >= scoreBefore + 350,
      `stomp paid the chain-base score (${stompResult.score} ≥ ${scoreBefore + 350})`,
    );

    // The corpse plays Hit (0.3s) + Die (1.2s) in the roster, then despawns.
    // With the 4s respawn there is a ~2.8s window where only 3 slimes exist —
    // poll for it instead of sampling once.
    let sawGap = false;
    const gapT0 = Date.now();
    while (Date.now() - gapT0 < 8000) {
      const s = await readState();
      if (s.slimes.length < 4) {
        sawGap = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    assert(
      sawGap,
      'squashed slime despawned before its respawn (3-slime gap observed)',
    );
  }

  console.log(process.exitCode ? '\nSTOMP/HINT PLAYTEST FAILED' : '\nAll stomp/hint assertions passed.');
} finally {
  await browser.close();
}
