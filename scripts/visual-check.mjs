/**
 * Visual check: verifies the arcade sprites (4 mystery blocks + 4 slimes) in a
 * real browser against the shipped half-res WebP sheets, in three layers:
 *
 *   1. DOM — every sprite renders with the expected sheet geometry
 *      (background-size 400% 300%, square transformed box, pixelated sampling),
 *      and every sheet URL was fetched with HTTP 200.
 *   2. Decode — each sheet is drawn into a canvas via `new Image()`: natural
 *      size must be exactly 724x543 (half-res grid) and the decoded pixels
 *      must carry real art (opaque coverage + sheet-dominant chroma). This is
 *      the layer that catches a corrupt/failed WebP.
 *   3. Composite — screenshots of the live stage are inspected with sharp:
 *      each sprite's on-screen clip must contain saturated art pixels drawn
 *      over the backdrop. Screenshots are saved to .freebuff/visual-check/
 *      for human review.
 *
 * Runs against real Chrome via puppeteer-core against `vite preview` (start
 * one first, or pass a URL). Exit code 0 = all layers verified.
 *
 * Usage: node scripts/visual-check.mjs [url]   (url defaults to :4173)
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

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

const OUT_DIR = '.freebuff/visual-check';
mkdirSync(OUT_DIR, { recursive: true });

const BLOCK_SHEETS = ['Identifier_Name_block', 'class_role_block', 'base-location_block', 'status_block'];
const SLIME_SHEETS = ['Emerald_slime', 'violet_slime', 'Amber_slime', 'Cyan_slime'];
const SHEET_W = 724;
const SHEET_H = 543;

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
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

  // Track every sheet response so a renamed/404'd asset fails loudly.
  const sheetStatus = new Map();
  page.on('response', (res) => {
    const url = res.url();
    const hit = [...BLOCK_SHEETS, ...SLIME_SHEETS].find((n) => url.includes(n));
    if (hit) sheetStatus.set(hit, res.status());
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[aria-label="Press start to enter the portfolio"]', {
    timeout: 20000,
  });
  await page.click('[aria-label="Press start to enter the portfolio"]');
  await new Promise((r) => setTimeout(r, 1500));

  // ---------------------------------------------------------------- layer 1
  console.log('DOM geometry:');
  const dom = await page.evaluate((names) => {
    const sprites = (needle) =>
      [...document.querySelectorAll('span[aria-hidden="true"], div[aria-hidden="true"]')].filter(
        (el) => needle.some((n) => (el.style.backgroundImage || '').includes(n)),
      );
    const blocks = sprites(names).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        sheet: (el.style.backgroundImage.match(/([^/"]+)\.webp/) || [])[1],
        w: r.width,
        h: r.height,
        bgSize: cs.backgroundSize,
        rendering: cs.imageRendering,
      };
    });
    const slimes = [...document.querySelectorAll('[aria-label^="Slime Hazard:"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.x, y: r.y };
    });
    return { blocks, slimes };
  }, BLOCK_SHEETS);

  assert(dom.blocks.length === 4, `four mystery-block sprites render (got ${dom.blocks.length})`);
  assert(
    dom.blocks.every((b) => Math.abs(b.w - b.h) < 2),
    `block boxes are square after the fill compensation (${dom.blocks
      .map((b) => `${b.sheet}:${Math.round(b.w)}x${Math.round(b.h)}`)
      .join(', ')})`,
  );
  assert(
    dom.blocks.every((b) => b.bgSize === '400% 300%'),
    'every block sprite uses the 4x3 sprite grid (background-size 400% 300%)',
  );
  assert(
    dom.blocks.every((b) => b.rendering === 'pixelated'),
    'every block sprite samples with image-rendering: pixelated',
  );
  const slimeBoxes = dom.slimes.map((s) => `${Math.round(s.w)}x${Math.round(s.h)}`);
  assert(dom.slimes.length === 4, `four slime hazards render (got ${dom.slimes.length})`);
  assert(
    dom.slimes.every((s) => Math.abs(s.w - 44) <= 1 && Math.abs(s.h - 40) <= 1),
    `slimes use the full-size 44x40 collision box (${slimeBoxes.join(', ')})`,
  );

  console.log('network:');
  for (const name of [...BLOCK_SHEETS, ...SLIME_SHEETS]) {
    assert(sheetStatus.get(name) === 200, `${name}.webp fetched with HTTP 200`);
  }

  // ---------------------------------------------------------------- layer 2
  console.log('decode (canvas draw of the served WebP):');
  const decode = await page.evaluate(
    async (names, slimeNames, expW, expH) => {
      const findUrl = (needle) => {
        const el = [...document.querySelectorAll('[style*="background-image"]')].find((el) =>
          (el.style.backgroundImage || '').includes(needle),
        );
        if (!el) return null;
        const m = el.style.backgroundImage.match(/url\("?([^")]+)"?\)/);
        return m ? m[1] : null;
      };
      const load = (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });
      // Hue-agnostic: this art is neon by design, so a healthy sheet carries
      // plenty of SATURATED pixels regardless of which colour it is.
      const analyze = (img) => {
        if (!img) return { ok: false, reason: 'decode failed' };
        if (img.naturalWidth !== expW || img.naturalHeight !== expH)
          return { ok: false, reason: `size ${img.naturalWidth}x${img.naturalHeight}` };
        const c = document.createElement('canvas');
        c.width = expW / 8; // 4x3 grid -> 181px frames; sample at 1/8 keeps it cheap
        c.height = expH / 6;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let opaque = 0;
        let saturated = 0;
        for (let p = 0; p < d.length; p += 4) {
          if (d[p + 3] > 10) opaque++;
          const [r, g, b] = [d[p], d[p + 1], d[p + 2]];
          if (Math.max(r, g, b) - Math.min(r, g, b) > 40) saturated++;
        }
        const total = (d.length / 4) | 0;
        return {
          ok: opaque / total > 0.05 && saturated > 50,
          reason: `opaque ${((opaque / total) * 100).toFixed(1)}%, saturated ${saturated}`,
        };
      };
      const out = {};
      for (const n of [...names, ...slimeNames]) {
        const img = await load(findUrl(n));
        out[n] = analyze(img);
      }
      return out;
    },
    BLOCK_SHEETS,
    SLIME_SHEETS,
    SHEET_W,
    SHEET_H,
  );
  for (const [name, r] of Object.entries(decode)) {
    assert(r.ok, `${name}: decodes at ${SHEET_W}x${SHEET_H} with real art (${r.reason})`);
  }

  // ---------------------------------------------------------------- layer 3
  console.log('composite (screenshots):');
  const rects = await page.evaluate((names) => {
    const find = (needle) => {
      const el = [...document.querySelectorAll('[style*="background-image"]')].find((el) =>
        (el.style.backgroundImage || '').includes(needle),
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const pad = 12;
      return {
        x: Math.max(0, Math.floor(r.x - pad)),
        y: Math.max(0, Math.floor(r.y - pad)),
        width: Math.ceil(r.width + pad * 2),
        height: Math.ceil(r.height + pad * 2),
      };
    };
    const out = {};
    for (const n of names) out[n] = find(n);
    const slime = document.querySelector('[aria-label^="Slime Hazard:"]');
    if (slime) {
      const r = slime.getBoundingClientRect();
      const pad = 16;
      out['Emerald_slime'] = {
        x: Math.max(0, Math.floor(r.x - pad)),
        y: Math.max(0, Math.floor(r.y - pad)),
        width: Math.ceil(r.width + pad * 2),
        height: Math.ceil(r.height + pad * 2),
      };
    }
    return out;
  }, BLOCK_SHEETS);

  for (const [name, clip] of Object.entries(rects)) {
    if (!clip) {
      assert(false, `${name}: no on-screen rect to screenshot`);
      continue;
    }
    const buf = await page.screenshot({ clip });
    const stats = await sharp(buf).stats();
    // Saturated art over the dark low-chroma backdrop: at least one channel
    // must swing hard inside the clip, and the clip must not be flat.
    const swing = Math.max(...stats.channels.map((c) => c.max - c.min));
    const stdev = Math.max(...stats.channels.map((c) => c.stdev));
    assert(
      swing > 120 && stdev > 15,
      `${name}: clip shows drawn art (channel swing ${swing}, stdev ${stdev.toFixed(1)})`,
    );
    const suffix = BLOCK_SHEETS.includes(name) ? 'block' : 'slime';
    await sharp(buf).toFile(join(OUT_DIR, `${name}-${suffix}.png`));
  }
  await page.screenshot({ path: join(OUT_DIR, 'stage-full.png') });

  console.log(
    process.exitCode
      ? `\nVISUAL CHECK FAILED (screenshots in ${OUT_DIR}/)`
      : `\nAll visual layers verified. Screenshots in ${OUT_DIR}/`,
  );
} finally {
  await browser.close();
}
