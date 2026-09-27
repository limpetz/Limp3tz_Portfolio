/**
 * CI gate: fail when the bundled payload outgrows its budget.
 *
 * Guards two numbers:
 *   - dist/assets total  — everything the bundler emits (code-split images,
 *     fonts, css, js chunks). This is the number the asset workflow governs;
 *     re-committing an oversized source set (e.g. the pre-WebP 7.5MB sheets)
 *     trips it immediately.
 *   - largest .js chunk — catches dependency/feature bloat in the app bundle.
 *
 * Media served from `public/` (background music, og image, stomp video) is
 * deliberately out of scope: it bypasses the bundler and is guarded by review,
 * not by this gate.
 *
 * Budgets are calibrated to the shipped site with deliberate headroom:
 * bumping one is a decision — do it in this file and say why in the commit.
 *
 * Usage: node scripts/check-size-budget.mjs   (run `npm run build` first)
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST_ASSETS = 'dist/assets';

/** Max total size of dist/assets, in KB. */
const ASSET_BUDGET_KB = 6 * 1024;
/** Max size of the largest emitted .js chunk, in KB. */
const JS_BUDGET_KB = 420;

if (!existsSync(DIST_ASSETS)) {
  console.error('dist/assets not found — run `npm run build` first.');
  process.exit(1);
}

let totalKB = 0;
let largestJs = { file: '-', kb: 0 };
const rows = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    const kb = statSync(p).size / 1024;
    totalKB += kb;
    rows.push([entry, kb]);
    if (extname(entry) === '.js' && kb > largestJs.kb) {
      largestJs = { file: entry, kb };
    }
  }
};
walk(DIST_ASSETS);

rows.sort((a, b) => b[1] - a[1]);
console.log(`dist/assets: ${totalKB.toFixed(0)}KB across ${rows.length} files`);
console.log('largest files:');
for (const [file, kb] of rows.slice(0, 5)) {
  console.log(`  ${kb.toFixed(0).padStart(6)}KB  ${file}`);
}

let failed = false;
if (totalKB > ASSET_BUDGET_KB) {
  console.error(
    `  FAIL: dist/assets is ${totalKB.toFixed(0)}KB, over the ${ASSET_BUDGET_KB}KB budget ` +
      `(over by ${(totalKB - ASSET_BUDGET_KB).toFixed(0)}KB)`,
  );
  failed = true;
} else {
  console.log(
    `  ok: dist/assets ${totalKB.toFixed(0)}KB <= ${ASSET_BUDGET_KB}KB budget ` +
      `(${((1 - totalKB / ASSET_BUDGET_KB) * 100).toFixed(0)}% headroom)`,
  );
}

if (largestJs.kb > JS_BUDGET_KB) {
  console.error(
    `  FAIL: largest js chunk ${largestJs.file} is ${largestJs.kb.toFixed(0)}KB, ` +
      `over the ${JS_BUDGET_KB}KB budget`,
  );
  failed = true;
} else {
  console.log(
    `  ok: largest js chunk ${largestJs.file} ${largestJs.kb.toFixed(0)}KB <= ${JS_BUDGET_KB}KB budget`,
  );
}

console.log(failed ? '\nSIZE BUDGET FAILED' : '\nSize budget passed.');
process.exit(failed ? 1 : 0);
