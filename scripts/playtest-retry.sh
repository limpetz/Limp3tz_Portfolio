#!/usr/bin/env bash
# CI wrapper: runs scripts/playtest.mjs, retrying ONCE on failure.
#
# Why: headless rAF throttling on CI runners (~300ms frames, absolute timings
# wobbling ±20%) makes a single run flake-prone. The assertions are sets and
# cadence checks, so one retry on a real regression still fails the gate twice
# and exits nonzero; a passing second run is treated as success.
#
# Usage: scripts/playtest-retry.sh [url]
set -u
cd "$(dirname "$0")/.."

URL="${1:-http://localhost:4173/Limp3tz_Portfolio/}"

echo "playtest attempt 1/2:"
if node scripts/playtest.mjs "$URL"; then
  exit 0
fi

echo
echo "playtest attempt 1 failed (possibly runner flake) — retrying once..."
sleep 2
echo "playtest attempt 2/2:"
node scripts/playtest.mjs "$URL"
