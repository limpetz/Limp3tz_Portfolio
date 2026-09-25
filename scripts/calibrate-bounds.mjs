/**
 * One-off threshold calibration for the bounds gate (dev tool).
 *
 * For sample cells, prints the pixel-detected bbox at several alpha
 * thresholds next to the JSON-declared bounds, so the gate's tolerance can
 * be picked from evidence rather than guessed.
 *
 * Usage: node scripts/calibrate-bounds.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const ASSETS = 'src/assets/images/arshad-sprites-240px/assets';
const pack = JSON.parse(readFileSync(`${ASSETS}/animations.json`, 'utf8'));

const SAMPLES = [
  { section: 'jump', cell: 0 },
  { section: 'jump', cell: 1 },
  { section: 'jump', cell: 4 },
  { section: 'turn', cell: 2 },
  { section: 'airTurn', cell: 3 },
];

const THRESHOLDS = [1, 32, 64, 128];

for (const { section, cell } of SAMPLES) {
  const s = pack[section];
  if (!s || !s.frames?.[cell]) continue;
  const f = s.frames[cell];
  const col = cell % (s.columns || 9);
  const row = Math.floor(cell / (s.columns || 9));
  const fw = s.frameWidth;
  const fh = s.frameHeight;
  const { data } = await sharp(`${ASSETS}/${s.file.replace('assets/', '')}`)
    .extract({ left: col * fw, top: row * fh, width: fw, height: fh })
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`\n${section} f${cell} — declared:`, JSON.stringify(f.bounds));
  for (const thr of THRESHOLDS) {
    let l = fw,
      t = fh,
      r = -1,
      b = -1;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (data[(y * fw + x) * 4 + 3] > thr) {
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
          if (y > b) b = y;
        }
      }
    }
    if (r < 0) {
      console.log(`  thr ${thr}: EMPTY`);
      continue;
    }
    console.log(
      `  thr ${thr}: left ${l} top ${t} right ${r} bottom ${b} (w${r - l + 1} h${b - t + 1})`,
    );
  }
}
