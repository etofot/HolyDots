/**
 * Lightweight pure-logic tests for HEAT LOCK core.
 * Run: npx tsx src/game/logic.test.ts
 * Or: node --experimental-strip-types (if available)
 */

import { findMatches, uniqueMatchKeys, maxRunSize } from './matchCore';
import {
  predictLockDetonation,
  simulateLandedBoard,
} from './fusePredict';
import {
  pickClusteredSlots,
  planFuseColors,
  planOpeningShelf,
  stackTops,
  finalizeFusePlan,
  forceReadableFusePlan,
  evaluateFusePlan,
} from './fuseSpawn';
import {
  AUTO_MIN_Y,
  GRID_COLS,
  Y_TOP,
  riseSkipSteps,
  riseStepForDistance,
  scoreForMatch,
} from './constants';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  OK  ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL ${msg}`);
  }
}

console.log('\n=== matchCore ===');
{
  const cells = [
    { x: 3, y: 10, color: 'yellow' as const },
    { x: 4, y: 10, color: 'yellow' as const },
    { x: 5, y: 10, color: 'yellow' as const },
  ];
  const runs = findMatches(cells);
  assert(uniqueMatchKeys(runs).length === 3, 'horizontal triple matches');
  assert(maxRunSize(runs) === 3, 'max run 3');
}

{
  // Gap must NOT match
  const cells = [
    { x: 3, y: 10, color: 'blue' as const },
    { x: 5, y: 10, color: 'blue' as const },
    { x: 6, y: 10, color: 'blue' as const },
  ];
  const runs = findMatches(cells);
  assert(uniqueMatchKeys(runs).length === 0, 'gapped blues do not match');
}

{
  // Wild bridges
  const cells = [
    { x: 2, y: 12, color: 'green' as const },
    { x: 3, y: 12, color: 'red' as const },
    { x: 4, y: 12, color: 'green' as const },
  ];
  const runs = findMatches(cells);
  assert(uniqueMatchKeys(runs).length === 3, 'wild bridges same color');
}

{
  // Fuse zone excluded
  const cells = [
    { x: 1, y: 1, color: 'white' as const },
    { x: 2, y: 1, color: 'white' as const },
    { x: 3, y: 1, color: 'white' as const },
  ];
  const runs = findMatches(cells);
  assert(uniqueMatchKeys(runs).length === 0, 'fuse-zone y excluded from match');
}

{
  const cells = [
    { x: 4, y: 8, color: 'yellow' as const },
    { x: 4, y: 9, color: 'yellow' as const },
    { x: 4, y: 10, color: 'yellow' as const },
  ];
  assert(uniqueMatchKeys(findMatches(cells)).length === 3, 'vertical triple');
}

console.log('\n=== fusePredict / land ===');
{
  const stuck = planOpeningShelf().map((c, i) => ({ ...c, id: `s${i}` }));
  const mid = Math.floor(GRID_COLS / 2);
  const fuse = [
    { x: mid - 1, y: 0, color: 'yellow' as const, id: 'f0' },
    { x: mid, y: 0, color: 'yellow' as const, id: 'f1' },
    { x: mid + 1, y: 0, color: 'yellow' as const, id: 'f2' },
  ];
  const landed = simulateLandedBoard(fuse, stuck);
  const landY = landed.filter((c) => c.id?.startsWith('f')).map((c) => c.y);
  assert(
    landY.every((y) => y === landY[0]),
    `opening fuse lands flat (y=${landY[0]})`
  );
  assert(landY[0]! >= AUTO_MIN_Y, 'land in auto zone');
  const pred = predictLockDetonation(fuse, stuck);
  assert(pred.armed === true, 'scripted yellow triple is ARMED vs opening shelf');
  assert(pred.armedFuseIds.length === 3, 'all three fuse ids armed');
}

{
  const stuck = [
    { x: 5, y: 20, color: 'blue' as const, id: 's' },
  ];
  const fuse = [
    { x: 4, y: 0, color: 'green' as const, id: 'a' },
    { x: 5, y: 0, color: 'yellow' as const, id: 'b' },
    { x: 6, y: 0, color: 'white' as const, id: 'c' },
  ];
  const pred = predictLockDetonation(fuse, stuck);
  assert(pred.armed === false, 'mismatched fuse not armed');
  // HOT: recoloring should be able to form something sometimes — not always guaranteed
  // Just ensure API returns boolean
  assert(typeof pred.hot === 'boolean', 'hot flag present');
}

console.log('\n=== fuseSpawn clustering ===');
{
  const free = Array.from({ length: 12 }, (_, x) => ({ x, y: 0 }));
  const picks = pickClusteredSlots(free, 4);
  assert(picks.length === 4, 'picks 4 slots');
  const xs = picks.map((p) => p.x).sort((a, b) => a - b);
  let consec = true;
  for (let i = 1; i < xs.length; i++) if (xs[i] !== xs[i - 1] + 1) consec = false;
  assert(consec, 'clustered picks are consecutive x');
  const mid = (xs[0] + xs[xs.length - 1]) / 2;
  assert(Math.abs(mid - 5.5) <= 1.5, `cluster centered near mid (got mid=${mid})`);
}

{
  const slots = [
    { x: 4, y: 0 },
    { x: 5, y: 0 },
    { x: 6, y: 0 },
    { x: 8, y: 0 },
  ];
  const plans = planFuseColors(slots, [], {
    scriptedFirst: true,
    detonationCount: 0,
  });
  const midColors = plans.filter((p) => p.x >= 4 && p.x <= 6).map((p) => p.color);
  assert(
    midColors.length === 3 && midColors.every((c) => c === midColors[0]),
    'scriptedFirst paints consecutive triple same color'
  );
}

{
  const shelf = planOpeningShelf();
  const faces = stackTops(shelf);
  const faceYs = faces.map((f) => f?.y).filter((y) => y != null);
  assert(faceYs.length === GRID_COLS, 'opening shelf face every column');
  assert(
    faceYs.every((y) => y === Y_TOP - 1),
    'flat face at Y_TOP-1'
  );
}

console.log('\n=== finalizeFusePlan / force ARMED ===');
{
  const shelf = planOpeningShelf();
  const free = Array.from({ length: GRID_COLS }, (_, x) => ({ x, y: 0 }));
  const plan = finalizeFusePlan(free, shelf, {
    scriptedFirst: true,
    detonationCount: 0,
    waveSize: 3,
    ensureReadable: true,
  });
  const ev = evaluateFusePlan(plan, shelf);
  assert(plan.length >= 3, 'finalize returns ≥3 cells');
  assert(ev.armed === true, 'scripted finalize is ARMED vs opening shelf');
}

{
  // Jagged stack: different face heights — force should still find ARMED or HOT
  const jagged = [
    { x: 0, y: Y_TOP, color: 'blue' as const },
    { x: 1, y: Y_TOP, color: 'green' as const },
    { x: 2, y: Y_TOP, color: 'yellow' as const },
    { x: 3, y: Y_TOP, color: 'white' as const },
    { x: 4, y: Y_TOP, color: 'blue' as const },
    { x: 5, y: Y_TOP, color: 'green' as const },
    { x: 6, y: Y_TOP, color: 'yellow' as const },
    { x: 7, y: Y_TOP, color: 'white' as const },
    { x: 8, y: Y_TOP, color: 'blue' as const },
    { x: 9, y: Y_TOP, color: 'green' as const },
    { x: 10, y: Y_TOP, color: 'yellow' as const },
    { x: 11, y: Y_TOP, color: 'white' as const },
    // jagged face band
    { x: 3, y: Y_TOP - 1, color: 'yellow' as const },
    { x: 4, y: Y_TOP - 1, color: 'yellow' as const },
    { x: 5, y: Y_TOP - 1, color: 'yellow' as const },
    { x: 6, y: Y_TOP - 3, color: 'blue' as const },
    { x: 7, y: Y_TOP - 5, color: 'green' as const },
  ];
  const free: { x: number; y: number }[] = [];
  for (let y = 0; y <= 3; y++) {
    for (let x = 0; x < GRID_COLS; x++) free.push({ x, y });
  }
  const forced = forceReadableFusePlan(free, jagged, 4);
  assert(forced !== null && forced!.length >= 3, 'forceReadable returns a plan on jagged');
  if (forced) {
    const ev = evaluateFusePlan(forced, jagged);
    assert(ev.armed || ev.hot, `force plan is ARMED or HOT (armed=${ev.armed} hot=${ev.hot})`);
  }

  const pity = finalizeFusePlan(free, jagged, {
    pity: true,
    detonationCount: 5,
    waveSize: 4,
    ensureReadable: true,
  });
  const pev = evaluateFusePlan(pity, jagged);
  assert(pev.armed || pev.hot, 'pity finalize prefers ARMED/HOT when geometry allows');
}

console.log('\n=== rise tempo / heat scoring contracts ===');
{
  assert(riseSkipSteps(16, false) === 3, 'cold far skip 3 steps');
  assert(riseSkipSteps(10, false) === 2, 'cold mid skip 2 steps');
  assert(riseSkipSteps(16, true) === 1, 'armed never multi-skips');
  const coldFar = riseStepForDistance(145, 14, false);
  const armedNear = riseStepForDistance(145, 3, true);
  assert(coldFar < armedNear, 'cold far rise faster than armed approach');
  assert(scoreForMatch(3, 0) === 30, 'triple base score 30');
  assert(scoreForMatch(4, 0) === 60, 'quad base score 60');
}

console.log('\n=== mid-run skill path (HOT guarantee) ===');
{
  // Mid-run on flat shelf: must ship HOT or ARMED when geometry allows
  // (never pure-blind cold when a recolor path exists).
  const shelf = planOpeningShelf();
  const free = Array.from({ length: GRID_COLS }, (_, x) => ({ x, y: 0 }));
  let hotOrArmed = 0;
  for (let i = 0; i < 12; i++) {
    const plan = finalizeFusePlan(free, shelf, {
      scriptedFirst: false,
      pity: false,
      detonationCount: 4,
      waveSize: 4,
      ensureReadable: false,
    });
    assert(plan.length >= 3, `mid-run plan ${i} spawns ≥3`);
    const ev = evaluateFusePlan(plan, shelf);
    if (ev.armed || ev.hot) hotOrArmed += 1;
  }
  assert(
    hotOrArmed >= 10,
    `mid-run HOT/ARMED skill path ≥10/12 (got ${hotOrArmed}/12)`
  );
}

{
  // Teach still forces ARMED on opening shelf
  const shelf = planOpeningShelf();
  const free = Array.from({ length: GRID_COLS }, (_, x) => ({ x, y: 0 }));
  const plan = finalizeFusePlan(free, shelf, {
    scriptedFirst: true,
    detonationCount: 0,
    waveSize: 3,
    ensureReadable: true,
  });
  assert(evaluateFusePlan(plan, shelf).armed, 'teach opening remains ARMED');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
