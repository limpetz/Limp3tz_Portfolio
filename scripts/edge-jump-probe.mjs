/**
 * Edge-jump probe: jump an arc that passes a mystery block's corner and assert
 * the arc is NOT truncated (phantom head-bump) and the actor is NOT teleported
 * (sideways shove). Compares max jump height beside a block edge vs in the
 * open, and watches for per-sample x snaps.
 *
 * Temporary diagnostic for the side-bump fix; safe to delete.
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = process.argv[2] || 'http://localhost:3001/';
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    window.__ARCADE_NO_HAZARDS__ = true; // isolate block physics from slimes
  });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[aria-label="Press start to enter the portfolio"]', {
    timeout: 20000,
  });
  await page.click('[aria-label="Press start to enter the portfolio"]');
  await sleep(1500);

  const geom = () =>
    page.evaluate(() => {
      const actor = document.querySelector('[title*="Click to jump"]');
      const blocks = [...document.querySelectorAll('[aria-label^="Mystery Block:"]')].map((b) => {
        const r = b.getBoundingClientRect();
        return { left: r.left, right: r.right, cx: r.left + r.width / 2 };
      });
      const a = actor.getBoundingClientRect();
      return { ax: a.left, aw: a.width, bottom: parseFloat(actor.style.bottom || '0'), blocks };
    });

  // Walk toward `dir` until the actor's centre sits `targetDx` (± tol) from a
  // block centre (the edge zone just outside the collision box).
  async function walkUntil(dir, targetDx, maxMs = 9000, tol = 6) {
    await page.keyboard.down(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const g = await geom();
      const near = g.blocks.reduce((b, c) =>
        Math.abs(c.cx - (g.ax + g.aw / 2)) < Math.abs(b.cx - (g.ax + g.aw / 2)) ? c : b,
      );
      const dx = near.cx - (g.ax + g.aw / 2);
      if (Math.abs(dx) <= targetDx + tol && Math.abs(dx) >= targetDx - tol) {
        await page.keyboard.up(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
        return true;
      }
      await sleep(50);
      // Nudge: headless starves held keys.
      await page.keyboard.up(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
      await page.keyboard.down(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
    }
    await page.keyboard.up(dir < 0 ? 'ArrowLeft' : 'ArrowRight');
    return false;
  }

  /** One held jump; returns max bottom, min bottom and max |x snap| per tick. */
  async function jumpSample(ms = 1300) {
    let maxB = -Infinity;
    let minB = Infinity;
    let maxSnap = 0;
    let prevX = null;
    await page.keyboard.down('ArrowUp');
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const g = await geom();
      maxB = Math.max(maxB, g.bottom);
      minB = Math.min(minB, g.bottom);
      if (prevX !== null) maxSnap = Math.max(maxSnap, Math.abs(g.ax - prevX));
      prevX = g.ax;
      await sleep(25);
      await page.keyboard.up('ArrowUp');
      await page.keyboard.down('ArrowUp');
    }
    await page.keyboard.up('ArrowUp');
    return { maxB, minB, maxSnap };
  }

  // Position beside the FIRST block's edge. The edge sliver sits between the
  // head-bump radius (32 = true half width) and the side-collision radius
  // (36 = half width + 4px grace), so target its middle and hold tight —
  // landing at dx < 32 is a legitimate under-block bump, not the bug.
  console.log('positioning beside a block edge...');
  const placed = await walkUntil(1, 34, 9000, 2);
  if (!placed) {
    console.error('FAIL: could not position beside a block edge');
    process.exitCode = 1;
  } else {
    const edge = await jumpSample();
    console.log(
      `edge jump: maxB=${edge.maxB.toFixed(1)} minB=${edge.minB.toFixed(1)} maxXsnap=${edge.maxSnap.toFixed(1)}`,
    );

    // Walk far from the blocks for a free reference jump.
    await page.keyboard.down('ArrowLeft');
    await sleep(2000);
    await page.keyboard.up('ArrowLeft');
    await sleep(300);
    const free = await jumpSample();
    console.log(
      `free jump: maxB=${free.maxB.toFixed(1)} minB=${free.minB.toFixed(1)} maxXsnap=${free.maxSnap.toFixed(1)}`,
    );

    const truncation = free.maxB - edge.maxB;
    console.log(`arc truncation: ${truncation.toFixed(1)}px`);
    if (truncation > 12) {
      console.error('FAIL: arc truncated beside block edge (phantom head-bump)');
      process.exitCode = 1;
    } else {
      console.log('ok: full arc beside block edge');
    }
    if (edge.maxSnap > 40) {
      console.error('FAIL: large x snap beside block edge (sideways shove)');
      process.exitCode = 1;
    } else {
      console.log('ok: no sideways teleport beside block edge');
    }
  }
} finally {
  await browser.close();
}
