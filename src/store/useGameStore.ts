import { create } from 'zustand';
import { HEAT_MAX, HEAT_START, type SimPhase } from '../game/constants';

export type AppScreen =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'settings'
  | 'leaderboard'
  | 'login';

interface GameState {
  score: number;
  wave: number;
  combo: number;
  heat: number;
  heatMax: number;
  /** 0–1 remaining fuse load; only meaningful in loading phase */
  fuseRatio: number;
  phase: SimPhase;
  /** Soft onboarding prompt shown in HUD */
  prompt: string;
  /** Heat left unused at last death (for GO regret UI) */
  heatAtDeath: number;
  /** Current fuse will detonate on lock if SENT as-is */
  fuseArmed: boolean;
  /** Predicted max run size for HUD juice */
  armedRun: number;
  /** One recolor away from armed — skill telegraph */
  fuseHot: boolean;
  /** Session stats (shown on OVERHEAT for closure) */
  sessionDetonations: number;
  sessionMaxCascade: number;
  sessionBestClear: number;
  /** Last lock authorship stamp */
  lastVerdict: string;
  /** Forensic one-liner on death */
  deathCause: string;
  /**
   * HEAT can force ARMED on a glowing cube this load (clutch telegraph).
   * Independent of HOT (HOT = one recolor; heatCanArm = spend charge).
   */
  heatCanArm: boolean;
  /** Consecutive ARMED detonations this session (resets on cold lock). */
  armedStreak: number;
  /** Best armed streak this session. */
  bestArmedStreak: number;
  gameState: AppScreen;
  setGameState: (state: AppScreen) => void;
  addScore: (points: number) => void;
  setWave: (wave: number) => void;
  setCombo: (combo: number) => void;
  setHeat: (heat: number) => void;
  setFuseRatio: (ratio: number) => void;
  setPhase: (phase: SimPhase) => void;
  setPrompt: (prompt: string) => void;
  setHeatAtDeath: (n: number) => void;
  setFuseArmed: (armed: boolean, run?: number) => void;
  setFuseHot: (hot: boolean) => void;
  setHeatCanArm: (can: boolean) => void;
  setLastVerdict: (v: string) => void;
  setDeathCause: (cause: string) => void;
  setArmedStreak: (n: number) => void;
  setBestArmedStreak: (n: number) => void;
  setSessionStats: (stats: {
    detonations?: number;
    maxCascade?: number;
    bestClear?: number;
  }) => void;
  /** Reset session stats; does NOT force gameState — caller sets playing. */
  resetSession: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  score: 0,
  wave: 1,
  combo: 1,
  heat: HEAT_START,
  heatMax: HEAT_MAX,
  fuseRatio: 1,
  phase: 'idle',
  prompt: '',
  heatAtDeath: 0,
  fuseArmed: false,
  armedRun: 0,
  fuseHot: false,
  sessionDetonations: 0,
  sessionMaxCascade: 0,
  sessionBestClear: 0,
  lastVerdict: '',
  deathCause: '',
  heatCanArm: false,
  armedStreak: 0,
  bestArmedStreak: 0,
  gameState: 'menu',
  setGameState: (gameState) => set((s) => (s.gameState === gameState ? s : { gameState })),
  addScore: (points) =>
    set((state) => ({ score: state.score + Math.round(points * state.combo) })),
  setWave: (wave) => set((s) => (s.wave === wave ? s : { wave })),
  setCombo: (combo) => set((s) => (s.combo === combo ? s : { combo })),
  setHeat: (heat) =>
    set((state) => {
      const next = Math.max(0, Math.min(HEAT_MAX, heat));
      return state.heat === next ? state : { heat: next };
    }),
  setFuseRatio: (fuseRatio) =>
    set((state) => {
      const next = Math.max(0, Math.min(1, fuseRatio));
      // ~20 Hz bucket — avoid 60fps React thrash on the timer bar
      if (Math.round(state.fuseRatio * 40) === Math.round(next * 40)) return state;
      return { fuseRatio: next };
    }),
  setPhase: (phase) => set((s) => (s.phase === phase ? s : { phase })),
  setPrompt: (prompt) => set((s) => (s.prompt === prompt ? s : { prompt })),
  setHeatAtDeath: (heatAtDeath) =>
    set((s) => (s.heatAtDeath === heatAtDeath ? s : { heatAtDeath })),
  setFuseArmed: (fuseArmed, armedRun = 0) =>
    set((s) =>
      s.fuseArmed === fuseArmed && s.armedRun === armedRun ? s : { fuseArmed, armedRun }
    ),
  setFuseHot: (fuseHot) => set((s) => (s.fuseHot === fuseHot ? s : { fuseHot })),
  setHeatCanArm: (heatCanArm) =>
    set((s) => (s.heatCanArm === heatCanArm ? s : { heatCanArm })),
  setLastVerdict: (lastVerdict) =>
    set((s) => (s.lastVerdict === lastVerdict ? s : { lastVerdict })),
  setDeathCause: (deathCause) =>
    set((s) => (s.deathCause === deathCause ? s : { deathCause })),
  setArmedStreak: (armedStreak) =>
    set((s) => (s.armedStreak === armedStreak ? s : { armedStreak })),
  setBestArmedStreak: (bestArmedStreak) =>
    set((s) => (s.bestArmedStreak === bestArmedStreak ? s : { bestArmedStreak })),
  setSessionStats: (stats) =>
    set((state) => {
      const sessionDetonations = stats.detonations ?? state.sessionDetonations;
      const sessionMaxCascade = stats.maxCascade ?? state.sessionMaxCascade;
      const sessionBestClear = stats.bestClear ?? state.sessionBestClear;
      if (
        sessionDetonations === state.sessionDetonations &&
        sessionMaxCascade === state.sessionMaxCascade &&
        sessionBestClear === state.sessionBestClear
      ) {
        return state;
      }
      return { sessionDetonations, sessionMaxCascade, sessionBestClear };
    }),
  resetSession: () =>
    set({
      score: 0,
      wave: 1,
      combo: 1,
      heat: HEAT_START,
      heatMax: HEAT_MAX,
      fuseRatio: 1,
      phase: 'idle',
      prompt: '',
      heatAtDeath: 0,
      fuseArmed: false,
      armedRun: 0,
      fuseHot: false,
      heatCanArm: false,
      armedStreak: 0,
      bestArmedStreak: 0,
      sessionDetonations: 0,
      sessionMaxCascade: 0,
      sessionBestClear: 0,
      lastVerdict: '',
      deathCause: '',
    }),
}));
