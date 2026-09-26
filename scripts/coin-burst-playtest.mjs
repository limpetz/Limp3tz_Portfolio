/**
 * Live check for the INSERT COIN burst: clicks the button in headless Chrome,
 * asserts ~14 coin-burst-particle spans appear at the click point, then that
 * they self-remove (animationend) and the burst-guard flag clears.
 *
 * Usage: node scripts/coin-burst-playtest.mjs [url]   (defaults to :4173)
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
  await page.waitForSelector('[aria-label="Press start to enter the portfolio"]', {
    timeout: 20000,
  });
  await page.click('[aria-label="Press start to enter the portfolio"]');
  await new Promise((r) => setTimeout(r, 500));

  const clickAndCount = async () => {
    const box = await page.$eval('.coin-burst-host', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    // Sample immediately — the burst lives ~650ms.
    return page.evaluate(() => document.querySelectorAll('.coin-burst-particle').length);
  };

  console.log('INSERT COIN burst:');
  const wave1 = await clickAndCount();
  assert(wave1 >= 10, `click spawns a burst (${wave1} particles)`);

  // Click again mid-burst: the flag must suppress the second wave.
  const wave2 = await clickAndCount();
  assert(wave2 <= wave1, `rapid re-click is suppressed by the guard (${wave2} particles)`);

  // Wait past the 650ms animation + 900ms safety valve.
  await new Promise((r) => setTimeout(r, 1700));
  const after = await page.evaluate(() => ({
    particles: document.querySelectorAll('.coin-burst-particle').length,
    flag: document.querySelector('.coin-burst-host')?.getAttribute('data-bursting'),
  }));
  assert(after.particles === 0, 'particles self-remove after the burst');
  assert(after.flag !== 'true', 'burst-guard flag clears');

  console.log(process.exitCode ? '\nCOIN BURST PLAYTEST FAILED' : '\nAll coin-burst assertions passed.');
} finally {
  await browser.close();
}
