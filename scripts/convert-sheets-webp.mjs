/**
 * One-shot: re-encode the 4 slime + 4 mystery-block sheets as HALF-RESOLUTION
 * lossless WebP (724x543, from 1448x1086) with bit-exact verification against
 * the resized source.
 *
 * Why half resolution: the 362px art frames render at 32-64px on the stage (a
 * 6-11x downscale), so the sheets are ~6x overspecified. Half-res keeps 2.3x
 * headroom above the largest render (64px block on a 181px frame) — sharp on
 * every shipped viewport including retina — while lossless WebP then reaches
 * ~75% below the original PNGs (measured: 7.49MB -> ~1.85MB for the set).
 * Full-res lossless only saved ~24%: these PNGs are already palette-efficient,
 * and lossy WebP is disqualified because it is always YUV 4:2:0, which wobbles
 * saturated neon chroma (measured composited deltas up to ~105 even at q100).
 *
 * Pipeline per sheet:
 *   1. resize to 724x543 (lanczos3) -> temp PNG (the verification baseline)
 *   2. encode lossless WebP with exact:true (bit-exact pixels INCLUDING the
 *      RGB under transparent pixels; without it libwebp rewrites that garbage)
 *   3. require the WebP decode to equal the baseline buffer exactly
 *
 * Exits nonzero if any sheet fails to verify or fails to shrink.
 *
 * Sources live in `src/assets/images/.originals/slime-block-sheets/` (git
 * ignored, like every other .originals folder — see README "Asset workflow").
 */
import sharp from 'sharp';
import { statSync } from 'node:fs';

const ORIG_DIR = 'src/assets/images/.originals/slime-block-sheets';
const OUT_DIR = 'src/assets/images';

const SHEETS = [
  'Emerald_slime.png',
  'violet_slime.png',
  'Amber_slime.png',
  'Cyan_slime.png',
  'Identifier_Name_block.png',
  'class_role_block.png',
  'base-location_block.png',
  'status_block.png',
];

const HALF_W = 724;
const HALF_H = 543;

let failed = false;

for (const name of SHEETS) {
  const src = `${ORIG_DIR}/${name}`;
  const out = `${OUT_DIR}/${name.replace(/\.png$/, '.webp')}`;

  // 1. Downscale to the shipped resolution; PNG buffer is the verify baseline.
  const baseBuf = await sharp(src).resize(HALF_W, HALF_H, { kernel: 'lanczos3' }).png().toBuffer();

  // 2. Encode lossless + exact from the SAME resized pixels.
  const webpBuf = await sharp(baseBuf).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const fs = await import('node:fs');
  fs.writeFileSync(out, webpBuf);

  const before = statSync(src).size;
  const after = webpBuf.length;

  // 3. Bit-exact check: decode the WebP and compare with the baseline.
  const a = await sharp(baseBuf).ensureAlpha().raw().toBuffer();
  const b = await sharp(webpBuf).ensureAlpha().raw().toBuffer();
  let deltas = 0;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > 0) {
      deltas++;
      if (d > max) max = d;
    }
  }

  const shrunk = after < before;
  const ok = shrunk && deltas === 0;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name}: ` +
      `${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB ` +
      `(${((1 - after / before) * 100).toFixed(1)}% smaller vs original), ` +
      `${HALF_W}x${HALF_H}, delta samples: ${deltas} (max ${max}) — must be 0`,
  );
  if (!ok) failed = true;
}

console.log(failed ? '\nCONVERSION FAILED' : '\nAll sheets converted and verified bit-exact.');
process.exit(failed ? 1 : 0);
