/**
 * Captures a stomp-chain demo video of the arcade stage.
 *
 * Drives the REAL stage (hazards on) with a synthetic keyboard: leave the safe
 * zone, hold jump for the auto-relaunch bounce, and steer each airborne arc
 * onto the next patrolling slime. A chain of 3+ stomps fires the coin burst +
 * screen shake, which is the shot. Frames come from the CDP screencast API
 * (works on stock headless Chrome — no OS-level capture needed) and are muxed
 * with a throwaway ffmpeg build (nothing installed globally or in the repo).
 *
 * Usage:
 *   node scripts/capture-stomp.mjs [url] [out.mp4]
 *   url defaults to http://localhost:4173/ (vite preview of a built site)
 *   out defaults to <tmpdir>/stomp-chain-demo.mp4
 *
 * Env:
 *   CHROME_PATH  chrome binary (auto-detected on win32/linux when unset)
 *   FFMPEG_PATH  ffmpeg binary (defaults to <tmpdir>/ffmpeg-throwaway/ffmpeg.exe)
 */
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || join(tmpdir(), 'stomp-chain-demo.mp4');
const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].find((p) => existsSync(p));
const FFMPEG =
  process.env.FFMPEG_PATH || join(tmpdir(), 'ffmpeg-throwaway', 'ffmpeg.exe');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!CHROME) {
  console.error('No Chrome binary found; set CHROME_PATH.');
  process.exit(1);
}
if (!existsSync(FFMPEG)) {
  console.error(`ffmpeg not found at ${FFMPEG} — set FFMPEG_PATH or fetch a throwaway build.`);
  process.exit(1);
}

/** Raw screencast frames (base64 jpeg) with arrival timestamps. */
const frames = [];  const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1 });

  // Collect frames via CDP. Acking every frame keeps the screencast flowing.
  const cdp = await page.createCDPSession();
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    maxWidth: 900,
    maxHeight: 660,
    everyNthFrame: 1,
  });
  cdp.on('Page.screencastFrame', (ev) => {
    frames.push({ data: ev.data, t: Date.now() });
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[aria-label="Press start to enter the portfolio"]', {
    timeout: 20000,
  });
  await page.click('[aria-label="Press start to enter the portfolio"]');
  // Spawn grace (2s) plus the idle beat, so the first arcs are stompable.
  await sleep(3200);

  const bubbleText = () =>
    page.evaluate(() => {
      // The shout is the first span inside the bubble div (`font-pixel` sits on
      // the container; the arrow span is empty, so textContent is just the shout).
      const el = [...document.querySelectorAll('div.font-pixel')].find((s) =>
        /STOMP|SLIME/.test(s.textContent || ''),
      );
      return el ? el.textContent.trim() : '';
    });

  const slimes = () =>
    page.evaluate(() => {
      const span = [...document.querySelectorAll('span')].find((s) =>
        s.textContent?.includes('SAFE ZONE HERE'),
      );
      const band = span?.parentElement?.parentElement;
      return {
        list: [...document.querySelectorAll('[aria-label^="Slime Hazard:"]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left, w: r.width };
        }),
        zone: band ? { left: band.offsetLeft, width: band.offsetWidth } : null,
      };
    });

  const actor = () =>
    page.evaluate(() => {
      const el = document.querySelector('[title*="Click to jump"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, w: r.width, b: parseFloat(el.style.bottom || '0') };
    });

  // --- Setup: walk right out of the safe zone ------------------------------
  // A grounded check breaks instantly at spawn (the hero starts on the
  // ground), so walk by time instead: ~0.5s at sprint clears the zone edge.
  console.log('setup: leave the safe zone');
  await page.keyboard.down('ArrowRight');
  await sleep(1200);
  await page.keyboard.up('ArrowRight');
  await sleep(300);

  // --- Chain phase: hold jump, steer each arc at the nearest slime ---------
  // Reachability (measured, see slime.ts): the two patrol pairs live in
  // zone-locked regions ~500px apart and one flight covers ~230px, so the
  // deepest chain anyone can land is x2 — stomp both slimes of one pair in a
  // single flight. That is the shot: it fires the coin burst + screen shake.
  console.log('chain: hold jump, work one patrol pair');
  // Commit to one target per flight: "nearest" re-picked every tick flips
  // between slimes and ends the arc over neither. Slimes right under the
  // player are the corpse of the stomp that launched this flight — chasing
  // them wastes it, so they are excluded from picking.
  let target = null;
  let wasAirborne = false;

  let steer = null;
  let stomps = 0;
  let lastCompleted = '';
  let chainSeen = 0;
  const CHAIN_MS = 45000;
  const chainStart = Date.now();

  await page.keyboard.down('ArrowUp');
  while (Date.now() - chainStart < CHAIN_MS) {
    const [a, { list, zone }] = await Promise.all([actor(), slimes()]);
    if (a && list.length) {
      const airborne = a.b > 8;
      const center = a.x + a.w / 2;
      let dir = null;
      if (airborne && !wasAirborne) {
        // New flight: commit to the nearest live slime at least 50px away —
        // anything closer is the corpse this bounce just came off.
        const live = list.filter((s) => Math.abs(s.x - a.x) > 50);
        target = (live.length ? live : list).reduce(
          (best, s) => (Math.abs(s.x - a.x) < Math.abs(best.x - a.x) ? s : best),
          live[0] ?? list[0],
        );
      }
      wasAirborne = airborne;
      if (airborne) {
        // Target corpse fell behind mid-flight: re-aim at the nearest live
        // slime so the rest of the arc is not wasted.
        const live = list.filter((s) => Math.abs(s.x - a.x) > 50);
        if (live.length) {
          target = live.reduce(
            (best, s) => (Math.abs(s.x - a.x) < Math.abs(best.x - a.x) ? s : best),
            live[0],
          );
        }
        if (target) {
          const want = target.x + target.w / 2 - center;
          dir = Math.abs(want) > 10 ? (want > 0 ? 'ArrowRight' : 'ArrowLeft') : null;
        }
      } else {
        target = null;
        // Grounded, two rules in priority order:
        // 1. NEVER wait inside the safe zone — repulsion keeps slimes at the
        //    edge, so a player bouncing there can never be stomped at all.
        // 2. Otherwise approach the nearest live slime — but stop ~55px short
        //    so the descent lands on it (a stomp) instead of walking into it
        //    (contact damage).
        if (zone && center > zone.left && center < zone.left + zone.width) {
          const zoneMid = zone.left + zone.width / 2;
          dir = center < zoneMid ? 'ArrowLeft' : 'ArrowRight';
        } else {
          const near = list.reduce(
            (best, s) => (Math.abs(s.x - a.x) < Math.abs(best.x - a.x) ? s : best),
            list[0],
          );
          const want = near.x + near.w / 2 - center;
          if (Math.abs(want) > 55) dir = want > 0 ? 'ArrowRight' : 'ArrowLeft';
        }
      }
      // Headless rAF throttling starves HELD keys (the CI playtest nudges for
      // exactly this reason): re-press the steering key on every poll.
      if (steer) await page.keyboard.up(steer);
      if (dir) await page.keyboard.down(dir);
      steer = dir;
    }

    // The shout types on character by character, so only a COMPLETED line
    // (ends with '!') counts as one stomp — prefixes are the same shout.
    const shout = await bubbleText();
    if (shout.endsWith('!') && shout !== lastCompleted) {
      lastCompleted = shout;
      if (/STOMP/.test(shout)) {
        stomps += 1;
        const chain = /x(\d+)/.exec(shout);
        if (chain) {
          chainSeen = Math.max(chainSeen, parseInt(chain[1], 10));
          console.log(`  chain link: ${shout}`);
        } else {
          console.log(`  stomp ${stomps}: ${shout}`);
        }
      }
    }

    await sleep(40);
  }
  await page.keyboard.up('ArrowUp');
  if (steer) await page.keyboard.up(steer);
  // Tail so the last coin burst and shake finish on camera.
  await sleep(1500);

  console.log(`\ncompleted shouts: ${stomps}, deepest chain: x${chainSeen}`);
  console.log(`last shout: ${lastCompleted || '(none)'}`);
  console.log(`collected ${frames.length} screencast frames`);
} finally {
  await browser.close();
}

if (frames.length < 30) {
  console.error('Too few frames captured; aborting encode.');
  process.exit(1);
}

// --- Encode -----------------------------------------------------------------
// Screencast frames arrive irregularly, so derive the average capture rate and
// play at that speed instead of a made-up constant.
const spanS = (frames[frames.length - 1].t - frames[0].t) / 1000;
const fps = Math.min(30, Math.max(10, Math.round(frames.length / Math.max(1, spanS))));

const work = join(tmpdir(), 'stomp-chain-frames');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
frames.forEach((f, i) =>
  writeFileSync(join(work, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64')),
);

console.log(`\nencoding ${frames.length} frames at ${fps} fps...`);
execFileSync(
  FFMPEG,
  [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    join(work, 'f%05d.jpg'),
    // yuv420p needs even dimensions; Chrome's screencast scaling happily
    // produces odd ones (e.g. 900x553 from a 1400x860 viewport).
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    OUT,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
rmSync(work, { recursive: true, force: true });
console.log(`\nWrote ${OUT}`);
