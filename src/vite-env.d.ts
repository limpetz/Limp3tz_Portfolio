/// <reference types="vite/client" />

/**
 * Build identity injected by vite.config.ts `define`. Rendered on the boot
 * screen so a stale deploy is easy to spot at a glance.
 */
declare const __APP_VERSION__: string; // nearest git tag + distance, e.g. "v1.0.0-3-gced5058" (bare sha on shallow clones)
declare const __BUILD_SHA__: string; // short commit sha the bundle was built from
declare const __BUILD_DATE__: string; // UTC date of the build, YYYY-MM-DD
