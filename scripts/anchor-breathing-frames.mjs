/**
 * One-shot: horizontally anchor the breathing strip's frames.
 *
 * The artist's breathing-idle export carries a horizontal head drift between
 * frames — measured head-band centres in the 176px cell: 88.5 / 86.5 / 87.5 /
 * 88.5 device px (±1-2 art px; present in the original 88x170 art, preserved
 * by the 2x re-export). A breathing idle should move the chest vertically,
 * not slide the head: on stage this read as the lips wobbling left-right
 * every frame, at any cadence.
 *
 * Pixels are MOVED, never modified: each 176x340 cell is shifted by a whole
 * number of art pixels (2px at 2x scale) so every frame's head band aligns
 * with frame 0. Transparency is preserved (cells composite onto a clean
 * canvas). Weight-shift is deliberately NOT touched — its larger head swing
 * (83.5-91.5) is the authored weight transfer.
 *
 * Usage: node scripts/anchor-breathing-frames.mjs
 * The WebP is NOT re-encoded bit-exact here — re-run
 * `scripts/convert-idle-webp.mjs`-style verification is unnecessary because
 * this script writes the PNG through sharp and the pack ships lossless WebP
 * from it; the root README's asset workflow documents the pipeline.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'src/assets/images/idle-sprites';
const SRC = `${DIR}/breathing-idle.webp`;
const OUT_PNG = `${DIR}/breathing-idle.webp.new.png`;
const OUT = `${DIR}/breathing-idle.webp`;

// Head-band shift per frame vs frame 0, in DEVICE px of the 176px cell.
// Derived from the measured centres (88.5 / 86.5 / 87.5 / 88.5): f1 is 2px
// left of f0, f2 is 1px left, f3 matches f0. Frames move RIGHT by this much
// to realign; 2px device = 1 art px at the 2x export.
const SHIFTS = [0, 2, 1, 0];

const FW = 176;
const FH = 340;
const meta = await sharp(SRC).metadata();
if (meta.width !== FW * SHIFTS.length || meta.height !== FH) {
  console.error(`unexpected geometry: ${meta.width}x${meta.height}`);
  process.exit(1);
}

const composites = [];
for (let k = 0; k < SHIFTS.length; k++) {
  const buf = await sharp(SRC)
    .extract({ left: k * FW, top: 0, width: FW, height: FH })
    .png()
    .toBuffer();
  composites.push({ input: buf, left: k * FW + SHIFTS[k], top: 0 });
}

await sharp({
  create: { width: meta.width, height: FH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(OUT_PNG);

// --- verify: re-measure the head-band centres on the output ---
const outStats = [];
for (let k = 0; k < SHIFTS.length; k++) {
  const raw = await sharp(OUT_PNG)
    .extract({ left: k * FW, top: 0, width: FW, height: 120 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  let l = FW, r = -1;
  for (let y = 0; y < 120; y++)
    for (let x = 0; x < FW; x++)
      if (raw[(y * FW + x) * 4 + 3] > 10) {
        if (x < l) l = x;
        if (x > r) r = x;
      }
  outStats.push((l + r) / 2);
}
const spread = Math.max(...outStats) - Math.min(...outStats);
console.log('aligned head centres:', outStats.map((c) => c.toFixed(1)).join(' / '));
if (spread > 0.5) {
  console.error(`FAIL: head centres still spread by ${spread}px`);
  process.exit(1);
}

// --- ship: lossless WebP from the aligned PNG, then swap in ---
// (write to a sibling temp file first: Windows can hold a transient lock on
// the asset while editors/AV scan it, and writeFileSync onto it fails with
// errno -4094; the bash `mv -f` below is the atomic-ish swap).
const webp = await sharp(OUT_PNG).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
writeFileSync(`${OUT}.tmp`, webp);
const { unlinkSync, statSync } = await import('node:fs');
unlinkSync(OUT_PNG);
console.log(
  `ok: breathing frames head-anchored (spread ${spread}px), encoded ${(statSync(`${OUT}.tmp`).size / 1024).toFixed(0)}KB lossless WebP — swap in with:\n` +
    `  mv -f "${OUT}.tmp" "${OUT}"`,
);
