/**
 * One-shot: re-encode the 4 hero gait sheets (walk, jump, turn, air-turn) as
 * FULL-RESOLUTION lossless WebP with bit-exact verification against the
 * source pixels.
 *
 * Unlike the slime/block sheets (which render at 32-64px from 362px frames and
 * were therefore halved), the 240px pack renders at NATIVE scale 1.0 — the
 * standing character is 240px in a 330px cell (locked by `jumpTurn.test.ts`),
 * so the only safe transform is a lossless one. Even so it saves ~25%
 * (measured: 685KB PNG -> 515KB WebP): libwebp's palette + spatial-reduction
 * predictors fit this flat-colour pixel art far better than the indexed PNGs.
 * Lossy WebP is disqualified by the same YUV 4:2:0 argument as the other
 * sheets (see `convert-sheets-webp.mjs`).
 *
 * Pipeline per sheet:
 *   1. copy the PNG into `assets/.originals/` (git ignored, like every other
 *      .originals folder — see README "Asset workflow") if it is not there yet
 *   2. encode lossless WebP with exact:true (bit-exact pixels INCLUDING the
 *      RGB under transparent pixels)
 *   3. require the WebP decode to equal the source PNG buffer exactly
 *
 * Exits nonzero if any sheet fails to verify or fails to shrink.
 *
 * NOTE: `scripts/check-gait.mjs` reads the SHIPPED walk sheet, so it keeps
 * gating the gait on the exact bytes the site serves — this script does not
 * need its own CI step. The pack manifests (`arshad-walk.json`,
 * `animations.json`) still declare the `.png` names: they describe the
 * original pack and its frame bboxes, and `jumpTurn.test.ts` tripwires any
 * edit to them.
 */
import sharp from 'sharp';
import { statSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const ASSETS = 'src/assets/images/arshad-sprites-240px/assets';
const ORIG_DIR = `${ASSETS}/.originals`;

const SHEETS = [
  'arshad-walk.png',
  'arshad-jump.png',
  'arshad-turn.png',
  'arshad-air-turn.png',
];

mkdirSync(ORIG_DIR, { recursive: true });

let failed = false;

for (const name of SHEETS) {
  const src = `${ORIG_DIR}/${name}`;
  if (!existsSync(src)) copyFileSync(`${ASSETS}/${name}`, src);

  const pngBuf = await sharp(src).png().toBuffer();
  const webpBuf = await sharp(pngBuf).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const out = `${ASSETS}/${name.replace(/\.png$/, '.webp')}`;
  (await import('node:fs')).writeFileSync(out, webpBuf);

  const before = statSync(src).size;
  const after = webpBuf.length;

  // Bit-exact check: decode the WebP and compare with the source PNG pixels.
  const a = await sharp(pngBuf).ensureAlpha().raw().toBuffer();
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
      `(${((1 - after / before) * 100).toFixed(1)}% smaller), ` +
      `delta samples: ${deltas} (max ${max}) — must be 0`,
  );
  if (!ok) failed = true;
}

console.log(failed ? '\nCONVERSION FAILED' : '\nAll gait sheets converted and verified bit-exact.');
process.exit(failed ? 1 : 0);
