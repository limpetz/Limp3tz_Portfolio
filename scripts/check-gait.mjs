/**
 * CI gate: verify the walk sheet's cell order matches the declared gait.
 *
 * Catches two classes of regression without any human eyes on the art:
 *   1. Permuted cells — a future bake that shuffles columns breaks the gait
 *      (contacts land on the wrong columns). We cluster the foot-band pixels
 *      per cell and require the contact poses (both feet planted) exactly at
 *      columns 1, 5 and 7, and single-foot poses everywhere else.
 *   2. Broken mirror — row 1 must be an exact horizontal mirror of row 0
 *      (cluster centers at 172 − x). A bake that regenerates the left row
 *      asymmetrically fails here.
 *
 * The JSON must also read sequentially: walkRight = 1..8, walkLeft = 10..17.
 *
 * Usage: node scripts/check-gait.mjs [sheet.png] [sheet.json]
 * Defaults to the shipped sheet. Alternate paths exist for negative testing
 * (e.g. verifying the gate rejects a permuted sheet).
 * Requires sharp (devDependency).
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const ASSETS = 'src/assets/images/arshad-sprites-240px/assets';
const PNG_PATH = process.argv[2] || `${ASSETS}/arshad-walk.png`;
const JSON_PATH = process.argv[3] || `${ASSETS}/arshad-walk.json`;
const meta = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const { imageWidth, frameWidth, frameHeight, columns, rows, anchor } = meta;

const CONTACT_COLS = [1, 5, 7]; // footfall poses: both feet planted
const MIN_CONTACT_GAP = 40; // px between the two foot clusters
const MIRROR_TOLERANCE = 4; // px per cluster center

let failed = false;
const fail = (msg) => {
  console.error(`  FAIL: ${msg}`);
  failed = true;
};
const ok = (msg) => console.log(`  ok: ${msg}`);

// --- JSON sanity: sequential playback, both directions ---
if (JSON.stringify(meta.animation.walkRight) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8])) {
  fail(`walkRight must read 1..8, got ${JSON.stringify(meta.animation.walkRight)}`);
} else {
  ok('walkRight reads 1..8');
}
if (
  JSON.stringify(meta.animation.walkLeft) !==
  JSON.stringify([10, 11, 12, 13, 14, 15, 16, 17])
) {
  fail(`walkLeft must read 10..17, got ${JSON.stringify(meta.animation.walkLeft)}`);
} else {
  ok('walkLeft reads 10..17');
}

// --- Foot-band clustering per cell (same method as scripts/foot-probe.mjs) ---
const BAND_TOP = anchor.footY - 48;
const BAND_HEIGHT = 48 - 1; // skip the anti-aliased baseline row

const rowPixels = [];
for (let row = 0; row < rows; row++) {
  const strip = await sharp(PNG_PATH)
    .extract({ left: 0, top: row * frameHeight + BAND_TOP, width: imageWidth, height: BAND_HEIGHT })
    .raw()
    .toBuffer({ resolveWithObject: true });
  rowPixels.push(strip.data);
}

function clustersFor(row, col) {
  const data = rowPixels[row];
  const x0 = col * frameWidth;
  const votes = new Array(frameWidth).fill(0);
  for (let y = 0; y < BAND_HEIGHT; y++) {
    for (let x = 0; x < frameWidth; x++) {
      if (data[(y * imageWidth + x0 + x) * 4 + 3] > 64) votes[x]++;
    }
  }
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
      let sum = 0;
      let w = 0;
      for (let x = a; x <= b; x++) {
        sum += x * votes[x];
        w += votes[x];
      }
      return sum / w + 0.5;
    });
}

const colReport = [];
for (let col = 1; col < columns; col++) {
  const right = clustersFor(0, col);
  const left = clustersFor(1, col);
  colReport.push({ col, right, left });

  const isContact = CONTACT_COLS.includes(col);
  if (isContact) {
    if (right.length !== 2 || right[1] - right[0] < MIN_CONTACT_GAP) {
      fail(`col ${col} should be a contact pose (2 feet >=${MIN_CONTACT_GAP}px apart), got right [${right.map((c) => c.toFixed(1))}]`);
    }
  } else if (right.length > 1) {
    fail(`col ${col} should be a single-foot pose, got right clusters [${right.map((c) => c.toFixed(1))}]`);
  }

  // Mirror invariant: left centers = 172 − right centers. Mirroring REVERSES
  // cluster order (the leftmost foot becomes the rightmost), so compare left[i]
  // against the mirrored right cluster from the far end.
  if (left.length !== right.length) {
    fail(`col ${col} mirror broken: ${right.length} right clusters vs ${left.length} left`);
  } else {
    const n = right.length;
    for (let i = 0; i < n; i++) {
      const mirrored = frameWidth - right[n - 1 - i];
      if (Math.abs(left[i] - mirrored) > MIRROR_TOLERANCE) {
        fail(`col ${col} mirror off: left ${left[i].toFixed(1)} vs mirrored right ${mirrored.toFixed(1)}`);
        break;
      }
    }
  }
}
if (!failed) ok(`foot-band structure correct on both rows (contacts at ${CONTACT_COLS.join(', ')}, mirror within ${MIRROR_TOLERANCE}px)`);

console.log(failed ? '\nGAIT CHECK FAILED' : '\nGait check passed.');
process.exit(failed ? 1 : 0);
