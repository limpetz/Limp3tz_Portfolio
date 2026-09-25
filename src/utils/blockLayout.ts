/**
 * Mystery-block arrangement (dev feature, persisted).
 *
 * The in-game arranger lets the owner reorder the mystery blocks by dragging
 * them while `arrangeMode` is on. The chosen order persists to localStorage so
 * the stage keeps rendering it after the arranger UI is removed.
 *
 * Pure helpers here; ArcadeStage wires them to drag events.
 */

export const DEFAULT_BLOCK_ORDER_KEY = 'limp3tz_block_order';

export function loadBlockOrder(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((k) => typeof k !== 'string')) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveBlockOrder(storageKey: string, order: string[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(order));
  } catch {
    // Private mode / storage disabled: arrangement is session-only. Fine.
  }
}

/**
 * Reorder `blocks` to match `order`. Keys missing from `order` keep their
 * data order after the arranged ones; unknown keys in `order` are ignored —
 * so a stale saved arrangement can never drop or duplicate blocks.
 */
export function applyBlockOrder<T extends { key: string }>(blocks: T[], order: string[]): T[] {
  const byKey = new Map(blocks.map((b) => [b.key, b] as const));
  const arranged: T[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    const block = byKey.get(key);
    if (block && !seen.has(key)) {
      arranged.push(block);
      seen.add(key);
    }
  }
  for (const block of blocks) {
    if (!seen.has(block.key)) arranged.push(block);
  }
  return arranged;
}

/**
 * Rotate the block at `index` by `dir` (+1 right, -1 left) and return the new
 * key order. Wraps around the ends, so every arrangement is reachable by
 * repeated taps as well as drags.
 */
export function rotateBlockOrder(keys: string[], index: number, dir: 1 | -1): string[] {
  if (keys.length === 0) return [];
  const i = ((index % keys.length) + keys.length) % keys.length;
  const j = (i + dir + keys.length) % keys.length;
  const next = [...keys];
  const [moved] = next.splice(i, 1);
  next.splice(j, 0, moved);
  return next;
}

export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
