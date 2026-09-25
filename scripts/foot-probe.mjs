/**
 * Foot-position probe for the walk sheet (dev tool, not shipped).
 *
 * For every cell, looks at the lower-leg/foot region (rows footY-48..footY-1)
 * and clusters opaque pixels by x. Two separated clusters = contact pose (both
 * feet planted, legs apart); one cluster = passing pose (feet together). The
 * cluster centroids show where each foot sits, which is what defines the gait
 * order — silhouette width alone can't distinguish a contact from a reach.
 *
 * Usage: node scripts/foot-probe.mjs [sheet.png] [json]
 * Defaults to the shipped walk sheet + metadata. Requires sharp (ad hoc:
 * `npm install --no-save sharp`; kept out of package.json — dev tool only).
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const PNG = process.argv[2] || 'src/assets/images/arshad-sprites-240px/assets/arshad-walk.png';
const JSON_PATH =
  process.argv[3] || 'src/assets/images/arshad-sprites-240px/assets/arshad-walk.json';

const meta = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const { imageWidth, frameWidth, frameHeight, columns, anchor } = meta;
const FOOT_Y = anchor.footY;
const BAND_TOP = FOOT_Y - 48;
const BAND_BOTTOM = FOOT_Y - 1; // ignore the anti-aliased baseline row itself

const rows = [];
for (let row = 0; row < meta.rows; row++) {
  const strip = await sharp(PNG)
    .extract({
      left: 0,
      top: row * frameHeight + BAND_TOP,
      width: imageWidth,
      height: BAND_BOTTOM - BAND_TOP,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  rows.push(strip.data);
}
const CHANNELS = 4;

function footClusters(cell) {
  const row = Math.floor(cell / columns);
  const col = cell % columns;
  const data = rows[row];
  const stripW = imageWidth;
  const x0 = col * frameWidth;
  const votes = new Array(frameWidth).fill(0);
  for (let y = 0; y < BAND_BOTTOM - BAND_TOP; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const idx = ((y * stripW) + x0 + x) * CHANNELS;
      if (data[idx + 3] > 64) votes[x]++;
    }
  }
  // group consecutive columns with votes into clusters (gap tolerance 4px)
  const clusters = [];
  let start = -1;
  let gap = 0;
  for (let x = 0; x < frameWidth; x++) {
    if (votes[x] > 2) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > 4) {
        clusters.push([start, x - gap]);
        start = -1;
      }
    }
  }
  if (start >= 0) clusters.push([start, frameWidth - 1 - gap]);
  return clusters
    .filter(([a, b]) => b - a >= 4)
    .map(([a, b]) => {
      let sum = 0;
      let w = 0;
      for (let x = a; x <= b; x++) {
        sum += x * votes[x];
        w += votes[x];
      }
      return { center: +(sum / w + 0.5).toFixed(1), span: b - a + 1 };
    });
}

for (let row = 0; row < meta.rows; row++) {
  const facing = row === 0 ? 'RIGHT' : 'LEFT';
  console.log(`\n=== row ${row} (${facing}) — band y ${BAND_TOP}..${BAND_BOTTOM} ===`);
  for (let col = 0; col < columns; col++) {
    const cell = row * columns + col;
    const f = meta.frames[cell];
    const clusters = footClusters(cell);
    const label =
      f.name.startsWith('idle') ? 'IDLE' : f.name;
    const b = f.bounds;
    console.log(
      `cell ${col}: ${label.padEnd(14)} clusters=${clusters.length} ` +
        clusters.map((c) => `x=${c.center} (w${c.span})`).join('  ') +
        `  | silhouette ${b.left}..${b.right} (w${b.width})`,
    );
  }
}
