/**
 * Ground-contact probe (dev tool).
 *
 * The x-cluster probe (foot-probe.mjs) can't tell a PLANTED foot from a
 * RAISED one hovering in the scan band. This probe goes further: for each
 * cell it finds, per foot (left/right x-cluster), the LOWEST opaque pixel —
 * how close that foot gets to the ground baseline (footY). footY-2 .. footY
 * touching = planted; higher = raised.
 *
 * This answers the real question about the walk's completeness: does the
 * second foot ever step ON the ground, or does the art only ever plant one
 * foot?
 *
 * Usage: node scripts/ground-probe.mjs [png] [json]
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const ASSETS = 'src/assets/images/arshad-sprites-240px/assets';
const PNG = process.argv[2] || `${ASSETS}/arshad-walk.png`;
const JSON_PATH = process.argv[3] || `${ASSETS}/arshad-walk.json`;

const meta = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const { imageWidth, frameWidth, frameHeight, columns, rows, anchor } = meta;
const FOOT_Y = anchor.footY; // 318: declared ground baseline
// Bottom 16px only: pure foot zone. A wider band catches calves/ankles that
// bridge the gap between the feet and merge the clusters (defeats the test).
// A PLANTED foot reaches the floor of this band; a RAISED foot has no pixels
// down here at all.
const SCAN_TOP = FOOT_Y - 18;
const SCAN_H = FOOT_Y - 2 - SCAN_TOP;

const rowsData = [];
for (let row = 0; row < rows; row++) {
  const strip = await sharp(PNG)
    .extract({ left: 0, top: row * frameHeight + SCAN_TOP, width: imageWidth, height: SCAN_H })
    .raw()
    .toBuffer({ resolveWithObject: true });
  rowsData.push(strip.data);
}

function footInfo(row, col) {
  const data = rowsData[row];
  const x0 = col * frameWidth;
  const votes = new Array(frameWidth).fill(0);
  // lowestY[x] = bottom-most opaque y within the band, per column
  const lowestY = new Array(frameWidth).fill(-1);
  for (let y = 0; y < SCAN_H; y++) {
    for (let x = 0; x < frameWidth; x++) {
      if (data[(y * imageWidth + x0 + x) * 4 + 3] > 64) {
        votes[x]++;
        lowestY[x] = y; // last hit wins = lowest
      }
    }
  }
  // x-clusters (same gap tolerance as foot-probe.mjs)
  const clusters = [];
  let start = -1;
  let gap = 0;
  for (let x = 0; x < frameWidth; x++) {
    if (votes[x] > 2) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0 && ++gap > 4) {
      clusters.push([start, x - gap]);
      start = -1;
    }
  }
  if (start >= 0) clusters.push([start, frameWidth - 1]);
  return clusters
    .filter(([a, b]) => b - a >= 4)
    .map(([a, b]) => {
      // weighted centroid + lowest pixel y in the cluster
      let sum = 0, w = 0, lowY = -1;
      for (let x = a; x <= b; x++) {
        sum += x * votes[x];
        w += votes[x];
        if (lowestY[x] > lowY) lowY = lowestY[x];
      }
      const centre = sum / w + 0.5;
      const gapToGround = FOOT_Y - 2 - (SCAN_TOP + lowY); // px above baseline
      return { centre: +centre.toFixed(1), gapToGround: lowY < 0 ? null : gapToGround };
    });
}

for (let row = 0; row < rows; row++) {
  const facing = row === 0 ? 'RIGHT' : 'LEFT';
  console.log(`\n=== row ${row} (${facing}) — baseline y ${FOOT_Y}, 0 = touching ===`);
  for (let col = 0; col < columns; col++) {
    const f = meta.frames[row * columns + col];
    const feet = footInfo(row, col);
    const desc = feet
      .map((ft) => `x=${ft.centre} ${ft.gapToGround === 0 ? 'PLANTED' : ft.gapToGround === null ? '?' : `air ${ft.gapToGround}px`}`)
      .join('  |  ');
    console.log(`col ${col} (${f.name.padEnd(13)}): ${desc}`);
  }
}
