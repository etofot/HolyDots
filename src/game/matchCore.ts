/**
 * Pure match detection for HEAT LOCK.
 * No Phaser deps — unit-testable.
 */

import { AUTO_MIN_Y, GRID_COLS, GRID_ROWS, type CubeColor } from './constants';

export interface MatchCell {
  x: number;
  y: number;
  color: CubeColor;
  /** Optional id for map-back to scene objects */
  id?: string;
}

export interface MatchRun {
  cells: MatchCell[];
}

function colorsCompatible(a: CubeColor, b: CubeColor): boolean {
  if (a === 'red' || b === 'red') return true;
  return a === b;
}

/** Resolve a run's base color (null if all wilds). */
function runBaseColor(cells: MatchCell[]): CubeColor | null {
  for (const c of cells) {
    if (c.color !== 'red') return c.color;
  }
  return null;
}

/**
 * Find horizontal + vertical runs of length ≥3 among stuck auto-zone cells.
 * Grid is sparse map "x,y" → MatchCell.
 */
export function findMatches(cells: MatchCell[]): MatchRun[] {
  const map = new Map<string, MatchCell>();
  for (const c of cells) {
    if (c.y < AUTO_MIN_Y) continue;
    map.set(`${c.x},${c.y}`, c);
  }

  const hit = new Set<string>();
  const runs: MatchRun[] = [];

  // Horizontal
  for (let y = AUTO_MIN_Y; y < GRID_ROWS; y++) {
    let x = 0;
    while (x < GRID_COLS) {
      const start = map.get(`${x},${y}`);
      if (!start) {
        x++;
        continue;
      }
      const run: MatchCell[] = [start];
      let nx = x + 1;
      while (nx < GRID_COLS) {
        const next = map.get(`${nx},${y}`);
        if (!next) break;
        const probe = [...run, next];
        const base = runBaseColor(probe);
        // All-red is allowed as match only if length ok and we treat as wild chain
        if (base === null) {
          // pure wilds: still count consecutive reds
          if (next.color !== 'red' && run.some((c) => c.color !== 'red' && c.color !== next.color)) break;
        } else if (next.color !== 'red' && next.color !== base) {
          break;
        }
        run.push(next);
        nx++;
      }
      if (run.length >= 3) {
        const key = run.map((c) => `${c.x},${c.y}`).join('|');
        if (!hit.has(key)) {
          hit.add(key);
          runs.push({ cells: run });
        }
      }
      x = nx > x ? nx : x + 1;
    }
  }

  // Vertical
  for (let x = 0; x < GRID_COLS; x++) {
    let y = AUTO_MIN_Y;
    while (y < GRID_ROWS) {
      const start = map.get(`${x},${y}`);
      if (!start) {
        y++;
        continue;
      }
      const run: MatchCell[] = [start];
      let ny = y + 1;
      while (ny < GRID_ROWS) {
        const next = map.get(`${x},${ny}`);
        if (!next) break;
        const base = runBaseColor([...run, next]);
        if (base === null) {
          if (next.color !== 'red' && run.some((c) => c.color !== 'red' && c.color !== next.color)) break;
        } else if (next.color !== 'red' && next.color !== base) {
          break;
        }
        run.push(next);
        ny++;
      }
      if (run.length >= 3) {
        const key = run.map((c) => `${c.x},${c.y}`).join('|');
        if (!hit.has(key)) {
          hit.add(key);
          runs.push({ cells: run });
        }
      }
      y = ny > y ? ny : y + 1;
    }
  }

  // Union unique cells from all runs (overlap OK — destroy once)
  return runs;
}

/** Flatten match runs to unique cell keys. */
export function uniqueMatchKeys(runs: MatchRun[]): string[] {
  const keys = new Set<string>();
  for (const r of runs) {
    for (const c of r.cells) keys.add(`${c.x},${c.y}`);
  }
  return [...keys];
}

export function maxRunSize(runs: MatchRun[]): number {
  let m = 0;
  for (const r of runs) m = Math.max(m, r.cells.length);
  return m;
}

// re-export helper used by tests / callers
export { colorsCompatible };
