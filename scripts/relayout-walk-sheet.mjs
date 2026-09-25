/**
 * Relayout the walk sheet into true gait order.
 *
 * History: the mirror bake (71a8204) permuted the cells stride-first, so the
 * JSON's animation arrays had to play a scrambled order [4,8,1,5,2,6,3,7] to
 * reproduce the artist's gait. This script rewrites the sheet so cell column N
 * holds the Nth gait pose again — the JSON then reads 1..8 like any normal
 * sprite sheet, and the footfall poses sit at columns 1 and 5.
 *
 * Pixels are MOVED, never modified: each 172x330 cell is extracted and
 * composited at its new column, transparent pixels preserved. The JSON is
 * regenerated (x, column, name, file) and bounds are copied from the source
 * cell (art is unchanged, only relocated).
 *
 * Usage: node scripts/relayout-walk-sheet.mjs   (run once; idempotent after)
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const ASSETS = 'src/assets/images/arshad-sprites-240px/assets';
const PNG_PATH = `${ASSETS}/arshad-walk.png`;
const JSON_PATH = `${ASSETS}/arshad-walk.json`;

// Current playback order (cells holding gait pose 1..8), from the gait fix.
const GAIT_ORDER = [4, 8, 1, 5, 2, 6, 3, 7];

const meta = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const { imageWidth, imageHeight, frameWidth, frameHeight, columns, rows } = meta;

// --- 1. Extract every cell we need on the new canvas ---
// Walk cells move to their gait position; the col-0 idles are copied verbatim
// (the canvas is rebuilt from scratch, so skipping them would blank the idle).
const cells = [];
for (let row = 0; row < rows; row++) {
  for (let pos = 0; pos < GAIT_ORDER.length; pos++) {
    const srcIndex = row * columns + GAIT_ORDER[pos];
    const src = meta.frames[srcIndex];
    const buffer = await sharp(PNG_PATH)
      .extract({ left: src.x, top: src.y, width: frameWidth, height: frameHeight })
      .png()
      .toBuffer();
    cells.push({ row, outCol: pos + 1, buffer, src });
  }
  const idle = meta.frames[row * columns];
  cells.push({
    row,
    outCol: 0,
    buffer: await sharp(PNG_PATH)
      .extract({ left: idle.x, top: idle.y, width: frameWidth, height: frameHeight })
      .png()
      .toBuffer(),
    src: idle,
  });
}

// --- 2. Composite onto a clean canvas (col 0 idles stay in place) ---
const composites = cells.map(({ row, outCol, buffer }) => ({
  input: buffer,
  left: outCol * frameWidth,
  top: row * frameHeight,
}));

await sharp({
  create: {
    width: imageWidth,
    height: imageHeight,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(`${PNG_PATH}.new`);

// --- 3. Regenerate the JSON metadata ---
for (const { row, outCol, src } of cells) {
  const outIndex = row * columns + outCol;
  if (outCol === 0) {
    // Idle cells keep their identity (name/file/duration); only row/column are
    // restated. Renaming them to walk-NN would mislabel the standing pose.
    meta.frames[outIndex] = { ...src, row, column: 0 };
    continue;
  }
  const facing = row === 0 ? 'right' : 'left';
  meta.frames[outIndex] = {
    ...src,
    row,
    column: outCol,
    x: outCol * frameWidth,
    y: row * frameHeight,
    name: `${facing}-walk-${String(outCol).padStart(2, '0')}`,
    file: `frames/walk-${facing}/${String(outCol).padStart(2, '0')}.png`,
  };
}

meta.animation.walkRight = [1, 2, 3, 4, 5, 6, 7, 8];
meta.animation.walkLeft = Array.from({ length: 8 }, (_, i) => columns + 1 + i);

writeFileSync(JSON_PATH, JSON.stringify(meta, null, 2) + '\n');

// --- 4. Swap in the new PNG only after the metadata succeeded ---
const { execSync } = await import('node:child_process');
execSync(`mv ${PNG_PATH}.new ${PNG_PATH}`);

console.log('relayout complete:');
console.log(`  ${PNG_PATH} recomposed (cells moved, pixels untouched)`);
console.log(`  ${JSON_PATH}: walkRight=${JSON.stringify(meta.animation.walkRight)}, walkLeft=${JSON.stringify(meta.animation.walkLeft)}`);
