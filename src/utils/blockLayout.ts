/**
 * Mystery-block relocation (dev feature, persisted).
 *
 * The in-game arranger lets the owner DRAG each mystery block to any
 * horizontal spot along the stage (this replaces the earlier reorder model —
 * relocation, not permutation). Positions persist to localStorage so the
 * stage keeps rendering them after the arranger UI is removed.
 *
 * Coordinates are stored as `dxPct`: the block centre's horizontal offset
 * from the stage centre, as a fraction of the stage width. A fraction is
 * resolution-independent — the same saved layout composes correctly on a
 * phone and on a 4K display, and clamping keeps every block on-stage.
 *
 * Pure helpers here; ArcadeStage wires them to drag events.
 */

export const BLOCK_POSITIONS_KEY = 'limp3tz_block_positions';

/** Horizontal placement of one block: centre offset from stage centre. */
export type BlockPosition = { key: string; dxPct: number };

export function loadBlockPositions(storageKey: string): BlockPosition[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const positions: BlockPosition[] = [];
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as BlockPosition).key === 'string' &&
        typeof (entry as BlockPosition).dxPct === 'number' &&
        Number.isFinite((entry as BlockPosition).dxPct)
      ) {
        positions.push({ key: (entry as BlockPosition).key, dxPct: (entry as BlockPosition).dxPct });
      }
    }
    return positions;
  } catch {
    return [];
  }
}

export function saveBlockPositions(storageKey: string, positions: BlockPosition[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(positions));
  } catch {
    // Storage disabled: layout is session-only. Fine.
  }
}

/**
 * Position for `key`: its saved dxPct, or `defaultDxPct` when unset.
 * `saved` may hold stale keys — they are simply never read.
 */
export function blockDxPct(saved: BlockPosition[], key: string, defaultDxPct: number): number {
  const hit = saved.find((p) => p.key === key);
  return hit ? hit.dxPct : defaultDxPct;
}

/** Upsert one block's position and return the new array (pure). */
export function withBlockPosition(
  saved: BlockPosition[],
  key: string,
  dxPct: number,
): BlockPosition[] {
  const next = saved.filter((p) => p.key !== key);
  next.push({ key, dxPct });
  return next;
}

/**
 * Clamp a block centre so the whole block stays on-stage. The actor collides
 * against blocks by centre ± half-width, so an off-canvas block would be
 * bumpable while invisible.
 */
export function clampDxPct(dxPct: number, stageWidth: number, blockSize: number): number {
  if (stageWidth <= 0) return 0;
  const halfPct = blockSize / 2 / stageWidth;
  const min = -0.5 + halfPct;
  const max = 0.5 - halfPct;
  return Math.min(max, Math.max(min, dxPct));
}

/** Absolute stage-x of a block centre, from its dxPct. */
export function blockStageX(dxPct: number, stageWidth: number): number {
  return stageWidth / 2 + dxPct * stageWidth;
}

/**
 * Default placement for the block at `index` of `count`: the even, centred
 * spread the old flex row produced (block + gap per slot). Used when no
 * saved position exists for that block.
 */
export function defaultDxPct(
  index: number,
  count: number,
  stageWidth: number,
  blockSize: number,
  gapPx: number,
): number {
  if (stageWidth <= 0 || count === 0) return 0;
  const centre = stageWidth / 2 + (index - (count - 1) / 2) * (blockSize + gapPx);
  return clampDxPct((centre - stageWidth / 2) / stageWidth, stageWidth, blockSize);
}
