/**
 * Diagnostic: where do the worst PNG-vs-WebP composited deltas live?
 * Prints the top-N offending pixels with their alpha and raw RGB from both
 * files, plus per-alpha-band error totals, for one sheet.
 */
import sharp from 'sharp';

const SRC = process.argv[2] || 'src/assets/images/Emerald_slime.png';
const OUT = SRC.replace(/\.png$/, '.webp');
const BG = '#070512';

const pngRaw = await sharp(SRC).ensureAlpha().raw().toBuffer();
const webpRaw = await sharp(OUT).ensureAlpha().raw().toBuffer();
const { width, height, channels } = await sharp(SRC).ensureAlpha().metadata();

const aFlat = await sharp(SRC).ensureAlpha().flatten({ background: BG }).raw().toBuffer();
const bFlat = await sharp(OUT).ensureAlpha().flatten({ background: BG }).raw().toBuffer();

const offenders = [];
const bandErr = new Map(); // alpha band -> {n, sum, max}
for (let p = 0; p < width * height; p++) {
  const i = p * channels;
  let worst = 0;
  for (let c = 0; c < 3; c++) {
    const d = Math.abs(aFlat[i + c] - bFlat[i + c]);
    if (d > worst) worst = d;
  }
  const a = pngRaw[i + 3];
  const band = a === 0 ? 0 : a < 16 ? 1 : a < 64 ? 2 : a < 128 ? 3 : a < 250 ? 4 : 5;
  const e = bandErr.get(band) ?? { n: 0, sum: 0, max: 0 };
  e.n++;
  e.sum += worst;
  if (worst > e.max) e.max = worst;
  bandErr.set(band, e);
  if (worst > 30) {
    offenders.push({
      x: p % width,
      y: Math.floor(p / width),
      worst,
      a,
      webpA: webpRaw[i + 3],
      pngRgb: [pngRaw[i], pngRaw[i + 1], pngRaw[i + 2]],
      webpRgb: [webpRaw[i], webpRaw[i + 1], webpRaw[i + 2]],
    });
  }
}

offenders.sort((x, y) => y.worst - x.worst);
console.log(`top offenders (${offenders.length} pixels over 30):`);
for (const o of offenders.slice(0, 10)) {
  console.log(
    `  (${o.x},${o.y}) compositeΔ=${o.worst} alpha=${o.a} (webp ${o.webpA}) ` +
      `pngRGB=${o.pngRgb} webpRGB=${o.webpRgb}`,
  );
}

const names = ['a=0', 'a=1-15', 'a=16-63', 'a=64-127', 'a=128-249', 'a=250-255'];
console.log('\nper-alpha-band composite error:');
for (const [band, e] of [...bandErr.entries()].sort((x, y) => x[0] - y[0])) {
  console.log(
    `  ${names[band].padEnd(10)} px=${String(e.n).padStart(8)} ` +
      `avgΔ=${(e.sum / e.n / 3).toFixed(2)} maxΔ=${e.max}`,
  );
}
