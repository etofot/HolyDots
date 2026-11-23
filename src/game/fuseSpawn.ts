/**
 * Pure fuse-wave color planning — biases toward readable near-matches / first boom.
 * No Phaser deps. Guarantees ARMED/HOT where geometry allows (spawn→predict coupling).
 */

import {
  AUTO_MIN_Y,
  CUBE_COLORS,
  GRID_COLS,
  Y_TOP,
  type BaseCubeColor,
  type CubeColor,
} from './constants';
import { predictLockDetonation } from './fusePredict';

export interface StackCell {
  x: number;
  y: number;
  color: CubeColor;
}

export interface SpawnPlan {
  x: number;
  y: number;
  color: CubeColor;
}

/**
 * Contact face of stack per column = lowest y among stuck auto-zone cells
 * (cubes pack toward top / high y; risers hit the bottom face first).
 */
export function stackTops(cells: StackCell[]): (StackCell | null)[] {
  const minY = Array.from({ length: GRID_COLS }, () => Infinity);
  const face: (StackCell | null)[] = Array.from({ length: GRID_COLS }, () => null);
  for (const c of cells) {
    if (c.y < AUTO_MIN_Y) continue;
    if (c.y < minY[c.x]) {
      minY[c.x] = c.y;
      face[c.x] = c;
    }
  }
  return face;
}

function randColor(exclude?: CubeColor): BaseCubeColor {
  const pool = CUBE_COLORS.filter((c) => c !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? CUBE_COLORS[0];
}

function baseOf(c: CubeColor): BaseCubeColor {
  if (c === 'red') return CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];
  return c;
}

/**
 * Prefer a consecutive horizontal cluster (true triple adjacency).
 * Picks `count` free slots from free list, clustered by x when y allows.
 */
export function pickClusteredSlots(
  freeSlots: { x: number; y: number }[],
  count: number
): { x: number; y: number }[] {
  if (freeSlots.length === 0 || count <= 0) return [];
  const n = Math.min(count, freeSlots.length);

  // Group by row (prefer lowest fuse row for readability)
  const byY = new Map<number, { x: number; y: number }[]>();
  for (const s of freeSlots) {
    const list = byY.get(s.y) ?? [];
    list.push(s);
    byY.set(s.y, list);
  }
  const rows = [...byY.keys()].sort((a, b) => a - b);

  for (const y of rows) {
    const row = (byY.get(y) ?? []).slice().sort((a, b) => a.x - b.x);
    if (row.length < Math.min(3, n)) continue;

    // Find longest consecutive-x run, then take a CENTERED window of size n inside it
    let bestStart = 0;
    let bestLen = 1;
    let runStart = 0;
    for (let i = 1; i <= row.length; i++) {
      const broken = i === row.length || row[i].x !== row[i - 1].x + 1;
      if (broken) {
        const len = i - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
        } else if (len === bestLen) {
          const mid = GRID_COLS / 2;
          const prevMid = (row[bestStart].x + row[bestStart + bestLen - 1].x) / 2;
          const curMid = (row[runStart].x + row[i - 1].x) / 2;
          if (Math.abs(curMid - mid) < Math.abs(prevMid - mid)) bestStart = runStart;
        }
        runStart = i;
      }
    }

    if (bestLen >= Math.min(3, n)) {
      const take = Math.min(bestLen, n);
      // Center the window inside the run (not left-edge of full board)
      const midX = GRID_COLS / 2;
      let windowStart = bestStart;
      let bestDist = Infinity;
      for (let s = bestStart; s <= bestStart + bestLen - take; s++) {
        const wMid = (row[s].x + row[s + take - 1].x) / 2;
        const dist = Math.abs(wMid - midX);
        if (dist < bestDist) {
          bestDist = dist;
          windowStart = s;
        }
      }
      const cluster = row.slice(windowStart, windowStart + take);
      if (cluster.length >= n) return cluster.slice(0, n);
      const used = new Set(cluster.map((s) => `${s.x},${s.y}`));
      const rest = freeSlots
        .filter((s) => !used.has(`${s.x},${s.y}`))
        .sort(
          (a, b) =>
            a.y - b.y ||
            Math.abs(a.x - GRID_COLS / 2) - Math.abs(b.x - GRID_COLS / 2)
        );
      return [...cluster, ...rest].slice(0, n);
    }
  }

  // Fallback: mid-biased by y then x
  return freeSlots
    .slice()
    .sort(
      (a, b) =>
        a.y - b.y || Math.abs(a.x - GRID_COLS / 2) - Math.abs(b.x - GRID_COLS / 2)
    )
    .slice(0, n);
}

/**
 * Plan colors for fuse slots.
 * - scriptedFirst: force a horizontal triple of one color in consecutive columns
 * - pity: force easy consecutive 3-set
 * - otherwise: ~45% chance to echo stack-face colors for vertical setups
 */
export function planFuseColors(
  slots: { x: number; y: number }[],
  stack: StackCell[],
  opts: { scriptedFirst?: boolean; pity?: boolean; detonationCount: number }
): SpawnPlan[] {
  if (slots.length === 0) return [];

  const faces = stackTops(stack);
  const plans: SpawnPlan[] = [];
  // Work on x-sorted order so consecutive bias is real
  const ordered = slots.slice().sort((a, b) => a.y - b.y || a.x - b.x);

  if (opts.scriptedFirst && opts.detonationCount === 0) {
    const color = CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];
    // Find longest consecutive run in the chosen slots (same y preferred)
    const byY = new Map<number, typeof ordered>();
    for (const s of ordered) {
      const list = byY.get(s.y) ?? [];
      list.push(s);
      byY.set(s.y, list);
    }
    let bestRun: typeof ordered = [];
    for (const row of byY.values()) {
      row.sort((a, b) => a.x - b.x);
      let run: typeof ordered = [row[0]];
      for (let i = 1; i < row.length; i++) {
        if (row[i].x === row[i - 1].x + 1) run.push(row[i]);
        else {
          if (run.length > bestRun.length) bestRun = run;
          run = [row[i]];
        }
      }
      if (run.length > bestRun.length) bestRun = run;
    }
    const triple = bestRun.slice(0, 3);
    const used = new Set(triple.map((s) => `${s.x},${s.y}`));
    for (const s of triple) plans.push({ x: s.x, y: s.y, color });
    for (const s of ordered) {
      if (used.has(`${s.x},${s.y}`)) continue;
      plans.push({ x: s.x, y: s.y, color: randColor(color) });
    }
    return plans;
  }

  if (opts.pity) {
    const color = CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];
    // Paint longest consecutive run with pity color (min 3 when possible)
    const byY = new Map<number, typeof ordered>();
    for (const s of ordered) {
      const list = byY.get(s.y) ?? [];
      list.push(s);
      byY.set(s.y, list);
    }
    let bestRun: typeof ordered = [];
    for (const row of byY.values()) {
      row.sort((a, b) => a.x - b.x);
      let run: typeof ordered = [row[0]];
      for (let i = 1; i < row.length; i++) {
        if (row[i].x === row[i - 1].x + 1) run.push(row[i]);
        else {
          if (run.length > bestRun.length) bestRun = run;
          run = [row[i]];
        }
      }
      if (run.length > bestRun.length) bestRun = run;
    }
    const pitySet = new Set(bestRun.slice(0, Math.max(3, Math.min(3, bestRun.length))).map((s) => `${s.x},${s.y}`));
    // If best run < 3, force first 3 ordered slots same color (still better than random)
    if (pitySet.size < 3) {
      ordered.slice(0, 3).forEach((s) => pitySet.add(`${s.x},${s.y}`));
    }
    for (const s of ordered) {
      plans.push({
        x: s.x,
        y: s.y,
        color: pitySet.has(`${s.x},${s.y}`) ? color : randColor(color),
      });
    }
    return plans;
  }

  // Normal: per-column bias toward face color or neighbor face for horizontal hooks
  for (const s of ordered) {
    const face = faces[s.x];
    const left = s.x > 0 ? faces[s.x - 1] : null;
    const right = s.x < GRID_COLS - 1 ? faces[s.x + 1] : null;
    const roll = Math.random();

    let color: CubeColor;
    if (face && roll < 0.48) {
      // Vertical setup — same color as contact face
      color = baseOf(face.color);
    } else if (left && roll < 0.68) {
      color = baseOf(left.color);
    } else if (right && roll < 0.82) {
      color = baseOf(right.color);
    } else {
      color = randColor();
    }
    plans.push({ x: s.x, y: s.y, color });
  }

  // Soft horizontal glue: if two consecutive slots already match face bias, nudge a third
  // when we have an isolated pair of same color with a free neighbor still random.
  glueHorizontalPairs(plans, faces);

  return plans;
}

/** Nudge one random-looking neighbor toward a same-color pair to create readable setups. */
function glueHorizontalPairs(plans: SpawnPlan[], faces: (StackCell | null)[]): void {
  if (plans.length < 3) return;
  const byX = new Map(plans.map((p) => [p.x, p]));
  const xs = [...byX.keys()].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = byX.get(xs[i]);
    const b = byX.get(xs[i + 1]);
    if (!a || !b) continue;
    if (xs[i + 1] !== xs[i] + 1) continue;
    if (a.color === 'red' || b.color === 'red') continue;
    if (a.color !== b.color) continue;
    // Pair exists — try extend left or right
    const left = byX.get(xs[i] - 1);
    const right = byX.get(xs[i + 1] + 1);
    const target = left && left.color !== a.color && left.color !== 'red' ? left : right;
    if (target && target.color !== a.color && target.color !== 'red' && Math.random() < 0.55) {
      // Only glue if stack face won't make it an auto-death brick (always OK)
      target.color = a.color;
      return;
    }
    // Or bias toward vertical if face matches
    const faceA = faces[a.x];
    if (faceA && baseOf(faceA.color) === a.color && Math.random() < 0.3) {
      // keep pair; good vertical + horizontal potential
    }
  }
}

/** Estimate rise steps from y=0 to stack face (empty → Y_TOP). */
export function riseStepsForColumn(faceY: number | null): number {
  if (faceY === null || !Number.isFinite(faceY)) return Y_TOP - 0;
  return Math.max(1, faceY - 0);
}

/**
 * Opening ceiling plate — flat contact face so first scripted triple lands on
 * the same y (true horizontal match). Shortens empty-board rise (~23 → ~21 steps)
 * and gives the player a stack to aim at (not a void ceiling).
 *
 * IMPORTANT: face must be gap-free. Gaps make fuse columns land on different y
 * and break ARMED prediction for the opening triple.
 */
export function planOpeningShelf(): StackCell[] {
  const cells: StackCell[] = [];
  const mid = Math.floor(GRID_COLS / 2);
  const faceColor = CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];

  for (let x = 0; x < GRID_COLS; x++) {
    // Ceiling row
    cells.push({
      x,
      y: Y_TOP,
      color: CUBE_COLORS[(x + 1) % CUBE_COLORS.length],
    });
    // Flat contact face at Y_TOP-1 — no holes
    // Mid triple uses a shared color so vertical setups also read after first clear
    const isMidBand = x >= mid - 2 && x <= mid + 2;
    cells.push({
      x,
      y: Y_TOP - 1,
      color: isMidBand ? faceColor : CUBE_COLORS[x % CUBE_COLORS.length],
    });
  }
  return cells;
}

// ─── Spawn → predict coupling (P0 authenticity) ─────────────────────────────

function planToFuse(plans: SpawnPlan[]) {
  return plans.map((p, i) => ({
    x: p.x,
    y: p.y,
    color: p.color,
    id: `plan${i}`,
  }));
}

function stackToStuck(stack: StackCell[]) {
  return stack.map((s, i) => ({
    x: s.x,
    y: s.y,
    color: s.color,
    id: `stk${i}`,
  }));
}

/** Evaluate whether a plan will ARMED/HOT after lock. */
export function evaluateFusePlan(
  plans: SpawnPlan[],
  stack: StackCell[]
): { armed: boolean; hot: boolean; maxRun: number } {
  if (plans.length === 0) return { armed: false, hot: false, maxRun: 0 };
  const pred = predictLockDetonation(planToFuse(plans), stackToStuck(stack));
  return { armed: pred.armed, hot: pred.hot, maxRun: pred.maxRun };
}

/**
 * Face contact y per column (min stuck y in auto zone). Empty → Y_TOP+1 sentinel
 * so land y becomes Y_TOP for all empty columns (flat ceiling band).
 */
function faceYs(stack: StackCell[]): number[] {
  const faces = stackTops(stack);
  return faces.map((f) => (f ? f.y : Y_TOP + 1));
}

/**
 * Force a plan that predicts ARMED (preferred) or at least HOT.
 * Geometry strategies:
 * 1) Horizontal triple on consecutive free cols with same land face height
 * 2) Vertical triple in one free column (3 stacked fuse cells)
 * 3) Face-echo vertical setups (fuse color = face) on deepest flat band
 */
export function forceReadableFusePlan(
  freeSlots: { x: number; y: number }[],
  stack: StackCell[],
  count: number
): SpawnPlan[] | null {
  if (freeSlots.length === 0 || count <= 0) return null;
  const stuck = stackToStuck(stack);
  const fy = faceYs(stack);
  const n = Math.min(Math.max(3, count), freeSlots.length, 6);

  // Index free by "x,y"
  const freeSet = new Set(freeSlots.map((s) => `${s.x},${s.y}`));
  const freeAt = (x: number, y: number) => freeSet.has(`${x},${y}`);

  const tryPlans = (plans: SpawnPlan[]): SpawnPlan[] | null => {
    if (plans.length === 0) return null;
    const pred = predictLockDetonation(planToFuse(plans), stuck);
    return pred.armed ? plans : null;
  };

  const tryHot = (plans: SpawnPlan[]): SpawnPlan[] | null => {
    if (plans.length === 0) return null;
    const pred = predictLockDetonation(planToFuse(plans), stuck);
    return pred.armed || pred.hot ? plans : null;
  };

  // --- Strategy A: horizontal same-face consecutive columns ---
  const byY = new Map<number, { x: number; y: number }[]>();
  for (const s of freeSlots) {
    const list = byY.get(s.y) ?? [];
    list.push(s);
    byY.set(s.y, list);
  }
  const rows = [...byY.keys()].sort((a, b) => a - b);

  for (const rowY of rows) {
    const row = (byY.get(rowY) ?? []).slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i <= row.length - 3; i++) {
      // longest consecutive window starting at i
      let j = i;
      while (j + 1 < row.length && row[j + 1].x === row[j].x + 1) j++;
      const runLen = j - i + 1;
      if (runLen < 3) continue;

      for (let take = Math.min(n, runLen); take >= 3; take--) {
        for (let start = i; start <= i + runLen - take; start++) {
          const window = row.slice(start, start + take);
          // Same land height ⇒ same face y
          const face0 = fy[window[0].x];
          if (!window.every((s) => fy[s.x] === face0)) continue;
          // Land must be in auto zone
          const landY = face0 - 1;
          if (landY < AUTO_MIN_Y) continue;

          for (const color of CUBE_COLORS) {
            const core: SpawnPlan[] = window.map((s) => ({
              x: s.x,
              y: s.y,
              color,
            }));
            // Fill remaining count with non-spoiling colors if needed
            const used = new Set(core.map((p) => `${p.x},${p.y}`));
            const extras = freeSlots
              .filter((s) => !used.has(`${s.x},${s.y}`))
              .sort(
                (a, b) =>
                  a.y - b.y ||
                  Math.abs(a.x - GRID_COLS / 2) - Math.abs(b.x - GRID_COLS / 2)
              )
              .slice(0, Math.max(0, n - core.length))
              .map((s) => ({
                x: s.x,
                y: s.y,
                color: randColor(color) as CubeColor,
              }));
            const plans = [...core, ...extras];
            const ok = tryPlans(plans);
            if (ok) return ok;
          }
        }
      }
    }
  }

  // --- Strategy B: vertical triple in one column (3 free fuse cells) ---
  for (let x = 0; x < GRID_COLS; x++) {
    const colFree: { x: number; y: number }[] = [];
    for (let y = 0; y <= 3; y++) {
      if (freeAt(x, y)) colFree.push({ x, y });
    }
    if (colFree.length < 3) continue;
    const triple = colFree.slice(0, 3);
    for (const color of CUBE_COLORS) {
      // Prefer face color if present
      const face = stackTops(stack)[x];
      const c: CubeColor =
        face && face.color !== 'red' && Math.random() < 0.7
          ? baseOf(face.color)
          : color;
      const core = triple.map((s) => ({ x: s.x, y: s.y, color: c }));
      const used = new Set(core.map((p) => `${p.x},${p.y}`));
      const extras = freeSlots
        .filter((s) => !used.has(`${s.x},${s.y}`))
        .slice(0, Math.max(0, n - 3))
        .map((s) => ({ x: s.x, y: s.y, color: randColor(c) as CubeColor }));
      const ok = tryPlans([...core, ...extras]);
      if (ok) return ok;
    }
  }

  // --- Strategy C: face-echo pairs extended (HOT at least) ---
  const faces = stackTops(stack);
  for (const rowY of rows) {
    const row = (byY.get(rowY) ?? []).slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i + 2 < row.length; i++) {
      const a = row[i];
      const b = row[i + 1];
      const c = row[i + 2];
      if (b.x !== a.x + 1 || c.x !== b.x + 1) continue;
      if (fy[a.x] !== fy[b.x] || fy[b.x] !== fy[c.x]) continue;
      if (fy[a.x] - 1 < AUTO_MIN_Y) continue;
      // Match face color if majority agree
      const cols = [a, b, c].map((s) => faces[s.x]);
      const colorVotes = cols
        .filter((f): f is StackCell => !!f && f.color !== 'red')
        .map((f) => baseOf(f.color));
      const color: BaseCubeColor =
        colorVotes[0] ?? CUBE_COLORS[Math.floor(Math.random() * CUBE_COLORS.length)];
      const plans: SpawnPlan[] = [a, b, c].map((s) => ({
        x: s.x,
        y: s.y,
        color,
      }));
      const used = new Set(plans.map((p) => `${p.x},${p.y}`));
      for (const s of freeSlots) {
        if (plans.length >= n) break;
        if (used.has(`${s.x},${s.y}`)) continue;
        plans.push({ x: s.x, y: s.y, color: randColor(color) });
      }
      const armed = tryPlans(plans);
      if (armed) return armed;
      const hot = tryHot(plans);
      if (hot) return hot;
    }
  }

  return null;
}

/**
 * Plan fuse colors then **validate** via predict. On pity / early waves / cold plans,
 * force a geometry-true ARMED (or HOT) packet so the slogan is not a lie.
 *
 * Skill contract (v5):
 * - Teach / pity / first boom → prefer ARMED when geometry allows.
 * - Mid-run → free ARMED is rare (skill ownership), but **never ship a fully cold
 *   packet when a HOT path exists**. Blind recolor-under-timer is trust poison.
 * - Pure cold only when forceReadable cannot find ARMED/HOT geometry (real pressure).
 */
export function finalizeFusePlan(
  freeSlots: { x: number; y: number }[],
  stack: StackCell[],
  opts: {
    scriptedFirst?: boolean;
    pity?: boolean;
    detonationCount: number;
    waveSize: number;
    /** When true, never ship a fully cold wave if geometry allows */
    ensureReadable?: boolean;
  }
): SpawnPlan[] {
  const size = Math.min(opts.waveSize, freeSlots.length);
  if (size <= 0) return [];

  const picks = pickClusteredSlots(freeSlots, size);
  let plans = planFuseColors(picks, stack, {
    scriptedFirst: opts.scriptedFirst,
    pity: opts.pity,
    detonationCount: opts.detonationCount,
  });

  const eval0 = evaluateFusePlan(plans, stack);
  const teach =
    opts.pity || opts.scriptedFirst || opts.detonationCount === 0;

  // Already ARMED — ship it (teach and mid-run alike)
  if (eval0.armed) return plans;

  // Mid-run HOT is the skill path (one recolor → ARMED). Keep it.
  if (eval0.hot && !teach) return plans;

  // Teach / pity still try to upgrade HOT → ARMED when possible
  if (eval0.hot && teach) {
    const forced = forceReadableFusePlan(freeSlots, stack, size);
    if (forced) {
      const ev = evaluateFusePlan(forced, stack);
      if (ev.armed) return forced;
    }
    return plans;
  }

  // Fully cold: always try to find HOT/ARMED geometry (mid-run skill path guarantee).
  // ensureReadable / teach prefer ARMED; otherwise HOT is enough.
  const forced = forceReadableFusePlan(freeSlots, stack, size);
  if (forced) {
    const ev = evaluateFusePlan(forced, stack);
    if (teach || opts.ensureReadable) {
      if (ev.armed || ev.hot) return forced;
    } else if (ev.hot || ev.armed) {
      // Mid-run: demote free ARMED sometimes so skill still matters (~35% keep ARMED gift)
      if (ev.armed && Math.random() < 0.35) return forced;
      if (ev.hot) return forced;
      // ARMED gift rejected — try to leave a HOT-only packet by scrambling one cube
      if (ev.armed) {
        const hotOnly = demoteArmedToHot(forced, stack);
        if (hotOnly) return hotOnly;
      }
      return forced;
    }
  }

  // Geometry unsolvable without invasion — honest cold / pressure
  return plans;
}

/**
 * When force found a free ARMED packet mid-run, optionally break one non-critical
 * cube so the wave reads HOT (one recolor) instead of free detonation.
 */
function demoteArmedToHot(
  plans: SpawnPlan[],
  stack: StackCell[]
): SpawnPlan[] | null {
  if (plans.length < 2) return null;
  // Try recoloring each cube once to break ARMED while preserving HOT
  for (let i = 0; i < plans.length; i++) {
    const base = plans[i].color;
    if (base === 'red') continue;
    for (const alt of CUBE_COLORS) {
      if (alt === base) continue;
      const trial = plans.map((p, idx) =>
        idx === i ? { ...p, color: alt as CubeColor } : { ...p }
      );
      const ev = evaluateFusePlan(trial, stack);
      if (!ev.armed && ev.hot) return trial;
    }
  }
  return null;
}
