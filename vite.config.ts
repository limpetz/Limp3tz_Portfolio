import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import {defineConfig} from 'vite';

/** Run a git command, returning a fallback when git is unavailable/shallow. */
function git(args: string, fallback: string): string {
  try {
    const out = execSync(`git ${args}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const value = out.toString().trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

// Build identity baked into the bundle so a stale deploy is visible on the
// boot screen: version = nearest tag + distance (falls back to a bare sha on
// shallow clones), sha = the exact commit, date = UTC build day.
const buildVersion = git('describe --tags --always --dirty', 'dev');
const buildSha =
  process.env.GITHUB_SHA?.slice(0, 7) || git('rev-parse --short HEAD', 'unknown');
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion),
      __BUILD_SHA__: JSON.stringify(buildSha),
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    // Hosted at the origin root (localhost dev, AI Studio). A '/' base keeps
    // every asset URL root-relative so the same build works in both places.
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
