/** Heat Rush — HEAT LOCK prototype constants.
 * Spec authority: docs/GAME_HOOK_HEAT_LOCK.md
 */

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 1080;

export const GRID_COLS = 12;
export const GRID_ROWS = 24;
export const CELL_SIZE = GAME_WIDTH / GRID_COLS; // 45px

/** Fuse zone: player may recolor / heat only here (rows 0–3). */
export const FUSE_MAX_Y = 3;
/** Auto / stack zone begins here. Matches resolve only for stuck cubes with y >= this. */
export const AUTO_MIN_Y = FUSE_MAX_Y + 1; // 4

export const Y_SPAWN = 0;
export const Y_TOP = GRID_ROWS - 1; // 23

/**
 * Rise step baseline (ms). Empty board ≈ 23 steps → early target ~3.5s ⇒ ~150ms/step.
 * Scaled further by score via riseStepForScore().
 */
export const RISE_STEP_MS = 155;
export const RISE_TWEEN_MS = 95;

/** Fuse load timers by score band (ms). */
export const FUSE_TIMER_EARLY_MS = 4500;
export const FUSE_TIMER_MID_MS = 3400;
export const FUSE_TIMER_LATE_MS = 2500;

export const HEAT_START = 2;
export const HEAT_MAX = 3;

/** Wave spawn sizes. */
export const WAVE_SIZE_MIN = 3;
export const WAVE_SIZE_MAX = 6;

/** First detonation scripting. */
export const FIRST_DETONATE_BIAS = true;

export const COMBO_WINDOW_MS = 4200;

/** Consecutive ARMED detonations before streak score bonus kicks in. */
export const ARMED_STREAK_START = 2;
/** Max armed-detonation streak multiplier (applied as flat bonus, not combo stack). */
export const ARMED_STREAK_BONUS_PER = 15;
export const ARMED_STREAK_BONUS_CAP = 90;

export const CUBE_COLORS = ['yellow', 'blue', 'green', 'white'] as const;
export type BaseCubeColor = (typeof CUBE_COLORS)[number];
export type CubeColor = BaseCubeColor | 'red';

/** High-contrast palette — distinct under dark chamber lighting. */
export const COLOR_HEX: Record<CubeColor, { top: number; bot: number }> = {
  yellow: { top: 0xffe566, bot: 0xf0a000 },
  blue: { top: 0x4de0ff, bot: 0x1a6dff },
  green: { top: 0x5dff6a, bot: 0x18a84a },
  white: { top: 0xffffff, bot: 0xc8c8e0 },
  red: { top: 0xff5a20, bot: 0xc81020 },
};

export type SimPhase = 'idle' | 'loading' | 'rising' | 'resolving' | 'gameover';

export function fuseTimerForScore(score: number): number {
  if (score < 400) return FUSE_TIMER_EARLY_MS;
  if (score < 1200) return FUSE_TIMER_MID_MS;
  return FUSE_TIMER_LATE_MS;
}

/** Base rise step ms by score band (further scaled by distance-to-face). */
export function riseStepForScore(score: number): number {
  // Slightly snappier early — cut "boring watch" vs Tetris continuous control
  if (score < 400) return 132;
  if (score < 1200) return 112;
  return 90;
}

/**
 * Distance-based rise tempo: fast dead air, slow approach for lock drama.
 * Cold packets skip dead air harder (less AFK watch); ARMED slows near face.
 * stepsLeft = rows until face/ceiling.
 */
export function riseStepForDistance(
  baseMs: number,
  stepsLeft: number,
  armed: boolean
): number {
  // Cold trail — punish boredom, not the player: race to the next decision
  if (!armed) {
    if (stepsLeft >= 12) return Math.max(42, baseMs - 95);
    if (stepsLeft >= 6) return Math.max(55, baseMs - 55);
    if (stepsLeft <= 4) return Math.max(70, baseMs - 20);
    return Math.max(60, baseMs - 35);
  }
  // ARMED — skip empty shaft, dramatize the last approach
  if (stepsLeft >= 12) return Math.max(68, baseMs - 55);
  if (stepsLeft >= 6) return baseMs;
  if (stepsLeft <= 4) return Math.min(240, baseMs + 70);
  if (stepsLeft <= 5) return baseMs + 40;
  return baseMs;
}

/** Extra steps to advance per tick when cold and far from face (skip dead air). */
export function riseSkipSteps(stepsLeft: number, armed: boolean): number {
  if (armed) return 1;
  if (stepsLeft >= 14) return 3;
  if (stepsLeft >= 9) return 2;
  return 1;
}

export function waveSizeForScore(score: number): number {
  if (score < 200) return 4;
  if (score < 600) return 5;
  return WAVE_SIZE_MAX;
}

export function scoreForMatch(size: number, redCount: number): number {
  let base = 30;
  if (size === 3) base = 30;
  else if (size === 4) base = 60;
  else if (size === 5) base = 100;
  else if (size === 6) base = 150;
  else base = 200 + (size - 7) * 50;
  return base + redCount * 20;
}
