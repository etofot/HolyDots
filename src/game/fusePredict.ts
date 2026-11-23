/**
 * Predict lock-time matches for fuse foreshadow (ARMED / HOT states).
 * Pure — no Phaser. Lets players *see* the boom they author during LOAD.
 */

import { AUTO_MIN_Y, CUBE_COLORS, GRID_COLS, Y_TOP, type CubeColor } from './constants';
import { findMatches, uniqueMatchKeys, maxRunSize, type MatchCell } from './matchCore';

export interface PredictInputCell {
  x: number;
  y: number;
  color: CubeColor;
  id?: string;
}

export interface LockPrediction {
  /** Keys "x,y" of cells that would match after fuse packs into stack. */
  matchKeys: string[];
  /** Fuse cube ids that participate in a predicted match. */
  armedFuseIds: string[];
  /**
   * True only if fuse participates in a post-lock match.
   * Stack-only latent matches are NOT marketed as ARMED.
   */
  armed: boolean;
  /** Max run length in prediction. */
  maxRun: number;
  /** One base-color recolor away from armed. */
  hot: boolean;
  /** Fuse ids that arm via a single recolor (not heat). */
  hotFuseIds: string[];
  /** Fuse ids that arm only if painted wild (HEAT). */
  heatHotFuseIds: string[];
  /** Final land cells for ghost silhouettes {id,x,y,color}. */
  ghostCells: MatchCell[];
}

/**
 * Simulate fuse cubes rising column-by-column until packed against stuck stack / ceiling.
 * Higher-y fuse in a column lands first (closer to stack).
 */
export function simulateLandedBoard(
  fuse: PredictInputCell[],
  stuck: PredictInputCell[]
): MatchCell[] {
  const occupied = new Map<string, MatchCell>();

  for (const s of stuck) {
    if (s.y < 0 || s.y > Y_TOP) continue;
    occupied.set(`${s.x},${s.y}`, {
      x: s.x,
      y: s.y,
      color: s.color,
      id: s.id,
    });
  }

  const byCol = new Map<number, PredictInputCell[]>();
  for (const f of fuse) {
    if (f.x < 0 || f.x >= GRID_COLS) continue;
    const list = byCol.get(f.x) ?? [];
    list.push(f);
    byCol.set(f.x, list);
  }

  for (const [, list] of byCol) {
    list.sort((a, b) => b.y - a.y);
    for (const f of list) {
      let y = f.y;
      while (y < Y_TOP) {
        const next = y + 1;
        if (occupied.has(`${f.x},${next}`)) break;
        y = next;
      }
      occupied.set(`${f.x},${y}`, {
        x: f.x,
        y,
        color: f.color,
        id: f.id,
      });
    }
  }

  return [...occupied.values()];
}

function predictionFromLanded(
  landed: MatchCell[],
  fuseIds: Set<string>
): Omit<LockPrediction, 'hot' | 'hotFuseIds' | 'heatHotFuseIds' | 'ghostCells'> {
  const autoCells = landed.filter((c) => c.y >= AUTO_MIN_Y);
  const runs = findMatches(autoCells);
  const matchKeys = uniqueMatchKeys(runs);
  const matchSet = new Set(matchKeys);

  const armedFuseIds: string[] = [];
  for (const c of landed) {
    if (!c.id || !fuseIds.has(c.id)) continue;
    if (matchSet.has(`${c.x},${c.y}`)) armedFuseIds.push(c.id);
  }

  const armedIds = [...new Set(armedFuseIds)];
  return {
    matchKeys,
    armedFuseIds: armedIds,
    // Authorship: ARMED only if the fuse packet participates
    armed: armedIds.length > 0,
    maxRun: maxRunSize(runs),
  };
}

/**
 * Predict which cells detonate if current fuse is committed as-is.
 * HOT = one recolor; heatHot = HEAT wild required.
 */
export function predictLockDetonation(
  fuse: PredictInputCell[],
  stuck: PredictInputCell[]
): LockPrediction {
  if (fuse.length === 0) {
    return {
      matchKeys: [],
      armedFuseIds: [],
      armed: false,
      maxRun: 0,
      hot: false,
      hotFuseIds: [],
      heatHotFuseIds: [],
      ghostCells: [],
    };
  }

  const fuseIds = new Set(fuse.map((f) => f.id).filter(Boolean) as string[]);
  const landed = simulateLandedBoard(fuse, stuck);
  const base = predictionFromLanded(landed, fuseIds);
  const ghostCells = landed.filter((c) => c.id && fuseIds.has(c.id));

  if (base.armed) {
    return {
      ...base,
      hot: false,
      hotFuseIds: [],
      heatHotFuseIds: [],
      ghostCells,
    };
  }

  const hotFuseIds = new Set<string>();
  const heatHotFuseIds = new Set<string>();

  for (const f of fuse) {
    if (!f.id || f.color === 'red') continue;
    let recolorArms = false;
    for (const col of CUBE_COLORS) {
      if (col === f.color) continue;
      const altFuse = fuse.map((c) =>
        c.id === f.id ? { ...c, color: col as CubeColor } : c
      );
      const alt = predictionFromLanded(simulateLandedBoard(altFuse, stuck), fuseIds);
      if (alt.armed) {
        recolorArms = true;
        break;
      }
    }
    if (recolorArms) {
      hotFuseIds.add(f.id);
      continue;
    }
    const wildFuse = fuse.map((c) =>
      c.id === f.id ? { ...c, color: 'red' as CubeColor } : c
    );
    const wild = predictionFromLanded(simulateLandedBoard(wildFuse, stuck), fuseIds);
    if (wild.armed) heatHotFuseIds.add(f.id);
  }

  const hotIds = [...hotFuseIds];
  return {
    ...base,
    hot: hotIds.length > 0,
    hotFuseIds: hotIds,
    heatHotFuseIds: [...heatHotFuseIds],
    ghostCells,
  };
}

/** Score a fuse cube for HEAT targeting — higher = better clutch. */
export function scoreHeatTarget(
  fuse: PredictInputCell[],
  stuck: PredictInputCell[],
  targetId: string,
  lastTappedId?: string | null
): number {
  const target = fuse.find((f) => f.id === targetId);
  if (!target || target.color === 'red') return -1;

  const fuseIds = new Set(fuse.map((f) => f.id).filter(Boolean) as string[]);
  const before = predictionFromLanded(simulateLandedBoard(fuse, stuck), fuseIds);
  const afterFuse = fuse.map((c) =>
    c.id === targetId ? { ...c, color: 'red' as CubeColor } : c
  );
  const after = predictionFromLanded(simulateLandedBoard(afterFuse, stuck), fuseIds);

  let score = 0;
  if (after.armed && !before.armed) score += 100;
  if (after.matchKeys.length > before.matchKeys.length) {
    score += 40 * (after.matchKeys.length - before.matchKeys.length);
  }
  if (after.maxRun > before.maxRun) score += 25 * (after.maxRun - before.maxRun);
  if (target.id === lastTappedId) score += 10;
  return score;
}
