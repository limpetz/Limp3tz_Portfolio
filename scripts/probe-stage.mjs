/**
 * Temporary probe: what does the capture driver actually see?
 * Prints actor box (incl. style.bottom), slimes, safe-zone band and bubble
 * text for ~8s while holding jump, at the same viewport the capture uses.
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = process.argv[2] || 'http://localhost:4187/';
const CHROME =
  process.env.CHROME_PATH ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=460,720'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 460, height: 700, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[aria-label="Press start to enter the portfolio"]', {
    timeout: 20000,
  });
  await page.click('[aria-label="Press start to enter the portfolio"]');
  await sleep(3200);

  const read = () =>
    page.evaluate(() => {
      const el = document.querySelector('[title*="Click to jump"]');
      const a = el ? el.getBoundingClientRect() : null;
      const slimes = [...document.querySelectorAll('[aria-label^="Slime Hazard:"]')].map(
        (s) => {
          const r = s.getBoundingClientRect();
          return { x: Math.round(r.left), w: r.width };
        },
      );
      const bubble = [...document.querySelectorAll('div.font-pixel')]
        .map((d) => d.textContent.trim())
        .find((t) => t.length > 0);
      // Safe zone: the aria-hidden band with a left/width, find via the label.
      const span = [...document.querySelectorAll('span')].find((s) =>
        s.textContent?.includes('SAFE ZONE HERE'),
      );
      const band = span?.parentElement?.parentElement;
      return {
        actor: a ? { left: Math.round(a.left), w: Math.round(a.width), bottom: el.style.bottom } : null,
        slimes,
        zone: band ? { left: Math.round(band.offsetLeft), width: band.offsetWidth } : null,
        bubble: bubble || '',
      };
    });

  console.log('t=0s   :', JSON.stringify(await read()));
  await page.keyboard.down('ArrowRight');
  await sleep(1000);
  await page.keyboard.up('ArrowRight');
  console.log('t=1s R :', JSON.stringify(await read()));
  await page.keyboard.down('ArrowUp');
  for (let t = 3; t <= 9; t += 2) {
    await sleep(2000);
    console.log(`t=${t}s J :`, JSON.stringify(await read()));
  }
  await page.keyboard.up('ArrowUp');
} finally {
  await browser.close();
}
