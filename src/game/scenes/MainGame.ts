/**
 * MainGame — HEAT LOCK prototype loop.
 * Load (fuse) → Commit (timer/SEND) → Rise → Lock → Detonate → next fuse.
 * Spec: docs/GAME_HOOK_HEAT_LOCK.md
 */

import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { useGameStore } from '../../store/useGameStore';
import { useUserStore } from '../../store/useUserStore';
import {
  AUTO_MIN_Y,
  CELL_SIZE,
  COLOR_HEX,
  ARMED_STREAK_BONUS_CAP,
  ARMED_STREAK_BONUS_PER,
  ARMED_STREAK_START,
  COMBO_WINDOW_MS,
  FUSE_MAX_Y,
  GRID_COLS,
  GRID_ROWS,
  HEAT_MAX,
  HEAT_START,
  RISE_TWEEN_MS,
  Y_SPAWN,
  Y_TOP,
  fuseTimerForScore,
  riseStepForScore,
  riseStepForDistance,
  riseSkipSteps,
  scoreForMatch,
  waveSizeForScore,
  CUBE_COLORS,
  type CubeColor,
  type SimPhase,
} from '../constants';
import { findMatches, uniqueMatchKeys, type MatchCell } from '../matchCore';
import {
  predictLockDetonation,
  scoreHeatTarget,
  type LockPrediction,
} from '../fusePredict';
import { paintCubeBody } from '../cubeArt';
import { finalizeFusePlan, planOpeningShelf } from '../fuseSpawn';
import { playSfx, unlockAudio } from '../audio';

/** Authorship stamp for one lock cycle (commit → rise → resolve). */
interface CommitSnapshot {
  armed: boolean;
  hot: boolean;
  maxRun: number;
  matchKeys: string[];
  ghostCells: MatchCell[];
  heatSpent: boolean;
  ratioLeft: number;
}

type LockVerdict =
  | 'YOU SET THIS'
  | 'HEAT CARRY'
  | 'CHAIN PAYOFF'
  | 'SCRAPE'
  | 'COLD LOCK'
  | 'MISFIRE'
  | 'FIRST LOCK';

interface CubeObj {
  id: string;
  x: number;
  y: number;
  color: CubeColor;
  stuck: boolean;
  matched: boolean;
  committed: boolean;
  sprite: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  heatRing: Phaser.GameObjects.Graphics;
}

let nextCubeId = 1;

export class MainGame extends Scene {
  private cubes: CubeObj[] = [];
  private cubeMap = new Map<string, CubeObj>();

  private phase: SimPhase = 'idle';
  private isGameOver = false;
  private isResolving = false;

  private score = 0;
  private wave = 1;
  private heat = HEAT_START;
  private comboTimer = 0;
  private cascadeDepth = 0;
  private heatGrantedThisLock = false;
  private zeroClearLocks = 0;
  private detonationCount = 0;
  private sessionStart = 0;
  private maxCascade = 0;
  private bestClear = 0;

  private fuseDeadline = 0;
  private fuseDuration = 0;
  private fuseRemainingOnPause = 0;
  private lastRiseTime = 0;
  private lastTapped: CubeObj | null = null;
  private riseStallFrames = 0;
  private lastCommitArmed = false;
  private riseWasArmed = false;
  private lastGhostKeys = '';
  private lastAppState: string = 'menu';
  private commitSnapshot: CommitSnapshot | null = null;
  private heatSpentThisFuse = false;
  private lastVerdict: LockVerdict | null = null;
  private invadeStallCount = 0;
  private firstBoomCelebrated = false;
  /** Consecutive ARMED detonations — greed loop vs Tetris mastery. */
  private armedStreak = 0;
  private bestArmedStreak = 0;
  /** Cached lock prediction — recompute on recolor/heat/spawn, not every frame. */
  private cachedPred: LockPrediction | null = null;
  private predDirty = true;
  private lastHeatCanArmPrompt = '';

  private dangerOverlay!: Phaser.GameObjects.Graphics;
  private fuseLine!: Phaser.GameObjects.Graphics;
  private nearMatchGfx!: Phaser.GameObjects.Graphics;
  private fuseTimerGfx!: Phaser.GameObjects.Graphics;
  private floatLayer!: Phaser.GameObjects.Container;
  private ambientGfx!: Phaser.GameObjects.Graphics;
  private lastDangerSfx = 0;
  private lastDangerLevel = 0;
  private armedFuseIds = new Set<string>();
  private hotFuseIds = new Set<string>();
  private lastArmed = false;
  private lastHot = false;
  private fuseZoneLabel?: Phaser.GameObjects.Text;
  private stackHeightGfx!: Phaser.GameObjects.Graphics;

  private storeUnsub: (() => void) | null = null;
  private keySend?: Phaser.Input.Keyboard.Key;
  private keyHeat?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyReverse?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('MainGame');
  }

  create() {
    this.add.image(0, 0, 'bg').setOrigin(0);
    this.ambientGfx = this.add.graphics().setDepth(1);
    this.drawAtmosphere();
    this.drawGrid();

    this.dangerOverlay = this.add.graphics().setDepth(99).setVisible(false);
    this.fuseLine = this.add.graphics().setDepth(5);
    this.nearMatchGfx = this.add.graphics().setDepth(50);
    this.fuseTimerGfx = this.add.graphics().setDepth(51);
    this.stackHeightGfx = this.add.graphics().setDepth(4);
    this.floatLayer = this.add.container(0, 0).setDepth(200);

    this.drawFuseZone();

    this.cubes = [];
    this.cubeMap.clear();
    this.isGameOver = false;
    this.isResolving = false;
    this.score = 0;
    this.wave = 1;
    this.heat = HEAT_START;
    this.comboTimer = 0;
    this.cascadeDepth = 0;
    this.heatGrantedThisLock = false;
    this.zeroClearLocks = 0;
    this.detonationCount = 0;
    this.maxCascade = 0;
    this.bestClear = 0;
    this.riseStallFrames = 0;
    this.lastTapped = null;
    this.armedFuseIds.clear();
    this.hotFuseIds.clear();
    this.lastArmed = false;
    this.lastHot = false;
    this.commitSnapshot = null;
    this.heatSpentThisFuse = false;
    this.lastVerdict = null;
    this.invadeStallCount = 0;
    this.firstBoomCelebrated = false;
    this.armedStreak = 0;
    this.bestArmedStreak = 0;
    this.cachedPred = null;
    this.predDirty = true;
    this.lastHeatCanArmPrompt = '';
    this.sessionStart = this.time.now;
    this.phase = 'idle';
    // N1b / N2: no stale pause remaining after scene rebuild
    this.fuseRemainingOnPause = 0;
    this.lastAppState = useGameStore.getState().gameState;
    this.time.paused = false;
    this.tweens.resumeAll();

    // Do NOT force playing — wait for React menu
    this.syncHud(true);

    this.input.on('pointerup', this.onPointerUp, this);

    if (this.input.keyboard) {
      this.keySend = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyHeat = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
      this.keyReverse = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.input.keyboard.on('keydown-ESC', this.onEsc, this);
    }

    EventBus.on('heat-lock-send', this.commitFuse, this);
    EventBus.on('heat-lock-heat', this.applyHeat, this);
    EventBus.on('heat-lock-restart', this.hardRestart, this);

    this.events.once('shutdown', () => {
      EventBus.off('heat-lock-send', this.commitFuse, this);
      EventBus.off('heat-lock-heat', this.applyHeat, this);
      EventBus.off('heat-lock-restart', this.hardRestart, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.keyboard?.off('keydown-ESC', this.onEsc, this);
      this.storeUnsub?.();
      this.storeUnsub = null;
    });

    // If already playing (e.g. scene.restart after death), begin immediately
    if (useGameStore.getState().gameState === 'playing') {
      this.beginSession();
    } else {
      this.setPhase('idle');
    }
  }

  private hardRestart = () => {
    // Caller sets gameState (playing | menu). Scene always rebuilds cleanly.
    useGameStore.getState().resetSession();
    // Preserve intentional screen: if still gameover, promote to playing
    const gs = useGameStore.getState().gameState;
    if (gs === 'gameover') {
      useGameStore.getState().setGameState('playing');
    }
    this.scene.restart();
  };

  private onEsc = () => {
    const gs = useGameStore.getState().gameState;
    if (gs === 'playing') {
      useGameStore.getState().setGameState('paused');
      useGameStore.getState().setPrompt('PAUSED — ESC to resume');
    } else if (gs === 'paused') {
      useGameStore.getState().setGameState('playing');
      useGameStore.getState().setPrompt('');
    }
  };

  /**
   * N1: Pause owns Phaser clock — delayedCall + tweens freeze with the scene clock.
   * N1b: Loading fuse remaining is scoped to the current load only; cleared on leave/spawn.
   */
  private syncPauseClock(appState: string) {
    if (appState === 'paused' && this.lastAppState === 'playing') {
      // Freeze timers/tweens so resolve chains cannot complete under pause
      this.time.paused = true;
      this.tweens.pauseAll();
      if (this.phase === 'loading') {
        this.fuseRemainingOnPause = Math.max(0, this.fuseDeadline - this.time.now);
      } else {
        // Not loading — remaining must not clobber a future fuse
        this.fuseRemainingOnPause = 0;
      }
    } else if (appState === 'playing' && this.lastAppState === 'paused') {
      this.time.paused = false;
      this.tweens.resumeAll();
      if (this.phase === 'loading' && this.fuseRemainingOnPause > 0) {
        this.fuseDeadline = this.time.now + this.fuseRemainingOnPause;
      }
      // Consume remaining after apply so a later resume cannot reuse it
      this.fuseRemainingOnPause = 0;
      this.lastRiseTime = this.time.now;
    } else if (appState !== 'paused' && this.time.paused) {
      // Safety: any non-paused app state (menu/gameover) unfreezes clock
      this.time.paused = false;
      this.tweens.resumeAll();
      this.fuseRemainingOnPause = 0;
    }
    this.lastAppState = appState;
  }

  private beginSession() {
    useGameStore.getState().resetSession();
    this.score = 0;
    this.wave = 1;
    this.heat = HEAT_START;
    this.isGameOver = false;
    this.isResolving = false;
    this.detonationCount = 0;
    this.maxCascade = 0;
    this.bestClear = 0;
    this.zeroClearLocks = 0;
    this.riseStallFrames = 0;
    this.commitSnapshot = null;
    this.heatSpentThisFuse = false;
    this.lastVerdict = null;
    this.invadeStallCount = 0;
    this.firstBoomCelebrated = false;
    this.armedStreak = 0;
    this.bestArmedStreak = 0;
    this.cachedPred = null;
    this.predDirty = true;
    this.lastHeatCanArmPrompt = '';
    this.fuseRemainingOnPause = 0;
    this.time.paused = false;
    this.tweens.resumeAll();
    this.sessionStart = this.time.now;
    this.clearBoard();
    this.seedOpeningShelf();
    useGameStore.getState().setArmedStreak(0);
    useGameStore.getState().setBestArmedStreak(0);
    this.syncHud(true);
    this.spawnFuseWave(true);
  }

  /** First-run ceiling plate — faster first lock + something to aim at. */
  private seedOpeningShelf() {
    const shelf = planOpeningShelf();
    for (const cell of shelf) {
      this.spawnCube(cell.x, cell.y, cell.color, true);
    }
  }

  private clearBoard() {
    for (const c of this.cubes) c.sprite.destroy();
    this.cubes = [];
    this.cubeMap.clear();
    this.lastTapped = null;
    this.nearMatchGfx.clear();
  }

  private setPhase(phase: SimPhase) {
    this.phase = phase;
    useGameStore.getState().setPhase(phase);
  }

  /** Sync session numbers to React. Prefer force=false (equality-guarded store). */
  private syncHud(force = false) {
    const s = useGameStore.getState();
    s.setHeat(this.heat);
    s.setWave(this.wave);
    const ratio =
      this.phase === 'loading' && this.fuseDuration > 0
        ? Math.max(0, (this.fuseDeadline - this.time.now) / this.fuseDuration)
        : this.phase === 'loading'
          ? 1
          : 0;
    if (force) {
      // Bypass bucket equality for hard reset moments
      useGameStore.setState({ fuseRatio: Math.max(0, Math.min(1, ratio)) });
    } else {
      s.setFuseRatio(ratio);
    }
  }

  private markPredDirty() {
    this.predDirty = true;
  }

  private drawAtmosphere() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.ambientGfx.clear();
    // Heat glow at fuse (bottom) + cold stack ceiling
    this.ambientGfx.fillGradientStyle(0x1a0a18, 0x1a0a18, 0x3a1208, 0x3a1208, 0.55, 0.55, 0.75, 0.75);
    this.ambientGfx.fillRect(0, h * 0.62, w, h * 0.38);
    this.ambientGfx.fillStyle(0x080818, 0.35);
    this.ambientGfx.fillRect(0, 0, w, h * 0.28);
    // Vertical lane guides (every 3 cols) for readability
    this.ambientGfx.lineStyle(1, 0xff8800, 0.06);
    for (let c = 3; c < GRID_COLS; c += 3) {
      const x = c * CELL_SIZE;
      this.ambientGfx.lineBetween(x, 0, x, h);
    }
  }

  private drawGrid() {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(1, 0xffffff, 0.05);
    for (let x = 0; x <= w; x += CELL_SIZE) {
      g.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y <= h; y += CELL_SIZE) {
      g.lineBetween(0, y, w, y);
    }
  }

  private drawFuseZone() {
    const w = this.scale.width;
    const topOfFuse = this.getVY(FUSE_MAX_Y) - CELL_SIZE / 2;
    const bottom = this.scale.height;
    this.fuseLine.clear();
    // Fuse bed gradient feel via layered rects
    this.fuseLine.fillStyle(0xff4400, 0.08);
    this.fuseLine.fillRect(0, topOfFuse, w, bottom - topOfFuse);
    this.fuseLine.fillStyle(0xff8800, 0.07);
    this.fuseLine.fillRect(0, topOfFuse, w, CELL_SIZE * 0.55);
    this.fuseLine.fillStyle(0xffd700, 0.04);
    this.fuseLine.fillRect(0, topOfFuse, w, CELL_SIZE * 0.2);
    // Gold lock line
    this.fuseLine.lineStyle(4, 0xffd700, 0.95);
    this.fuseLine.lineBetween(0, topOfFuse, w, topOfFuse);
    this.fuseLine.lineStyle(1, 0xffffff, 0.35);
    this.fuseLine.lineBetween(0, topOfFuse + 3, w, topOfFuse + 3);
    // Danger ticks
    this.fuseLine.lineStyle(2, 0xff4500, 0.75);
    for (let x = 10; x < w; x += 28) {
      this.fuseLine.lineBetween(x, topOfFuse - 5, x + 12, topOfFuse - 5);
    }

    this.fuseZoneLabel?.destroy();
    this.fuseZoneLabel = this.add
      .text(8, topOfFuse + 6, 'FUSE · TAP recolor · Q/RMB reverse · H heat · SPACE send', {
        fontSize: '10px',
        color: '#FFD700',
        fontStyle: 'bold',
      })
      .setDepth(6)
      .setAlpha(0.8);
  }

  /** Board-side fuse countdown rail (readable without HUD). */
  private drawFuseTimerRail(ratio: number) {
    this.fuseTimerGfx.clear();
    if (this.phase !== 'loading' || ratio <= 0) return;
    const w = this.scale.width;
    const topOfFuse = this.getVY(FUSE_MAX_Y) - CELL_SIZE / 2;
    const barH = 6;
    const y = topOfFuse - 10;
    this.fuseTimerGfx.fillStyle(0x000000, 0.55);
    this.fuseTimerGfx.fillRoundedRect(8, y, w - 16, barH, 3);
    const urgent = ratio <= 0.35;
    const col = urgent ? 0xff3300 : ratio <= 0.6 ? 0xff8800 : 0xffd700;
    const fillW = Math.max(2, (w - 16) * ratio);
    this.fuseTimerGfx.fillStyle(col, 0.95);
    this.fuseTimerGfx.fillRoundedRect(8, y, fillW, barH, 3);
    if (urgent) {
      const pulse = 0.3 + Math.sin(this.time.now / 80) * 0.25;
      this.fuseTimerGfx.lineStyle(2, 0xff0000, pulse);
      this.fuseTimerGfx.strokeRoundedRect(6, y - 2, w - 12, barH + 4, 4);
    }
  }

  private getVY(ly: number) {
    return this.scale.height - ly * CELL_SIZE - CELL_SIZE / 2;
  }

  private getVX(lx: number) {
    return lx * CELL_SIZE + CELL_SIZE / 2;
  }

  private keyOf(x: number, y: number) {
    return `${x},${y}`;
  }

  private rebuildMap() {
    this.cubeMap.clear();
    for (const c of this.cubes) {
      if (!c.matched) this.cubeMap.set(this.keyOf(c.x, c.y), c);
    }
  }

  private occupied(x: number, y: number, ignore?: CubeObj): boolean {
    const c = this.cubeMap.get(this.keyOf(x, y));
    return !!c && c !== ignore && !c.matched;
  }

  // ─── UPDATE ───────────────────────────────────────────────

  update(time: number, _delta: number) {
    const appState = useGameStore.getState().gameState;
    this.syncPauseClock(appState);

    if (appState !== 'playing') {
      if (this.phase !== 'idle' && this.phase !== 'gameover') {
        // Soft freeze while menu / pause overlays — no sim ticks
      }
      return;
    }

    // Transition menu → play without full restart when first entering
    if (this.phase === 'idle' && !this.isGameOver) {
      this.beginSession();
      return;
    }

    if (this.isGameOver || this.phase === 'gameover') return;

    // Keyboard
    if (this.phase === 'loading') {
      if (
        (this.keySend && Phaser.Input.Keyboard.JustDown(this.keySend)) ||
        (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace))
      ) {
        this.commitFuse();
      }
      if (this.keyHeat && Phaser.Input.Keyboard.JustDown(this.keyHeat)) {
        this.applyHeat();
      }
      // Q = reverse recolor on last tapped (or first fuse cube)
      if (this.keyReverse && Phaser.Input.Keyboard.JustDown(this.keyReverse)) {
        const target =
          this.lastTapped &&
          !this.lastTapped.matched &&
          !this.lastTapped.stuck &&
          this.lastTapped.y <= FUSE_MAX_Y
            ? this.lastTapped
            : this.cubes.find(
                (c) => !c.matched && !c.stuck && !c.committed && c.y <= FUSE_MAX_Y
              );
        if (target) this.recolorCube(target, true);
      }
    }

    if (this.phase === 'loading') {
      this.tickLoading(time);
    } else if (this.phase === 'rising') {
      this.tickRising(time);
    }
    // note: resolving is driven by delayedCall chains; isResolving gates rise

    if (this.comboTimer > 0 && time > this.comboTimer) {
      useGameStore.getState().setCombo(1);
      this.comboTimer = 0;
    }

    this.updateDanger();
    this.updateNearMatchHints();
    // Predict only when dirty; pulse VFX uses cache every frame
    this.updateArmedPrediction(false);
    this.syncHud(false);
  }

  private tickLoading(time: number) {
    const ratio =
      this.fuseDuration > 0
        ? Math.max(0, (this.fuseDeadline - time) / this.fuseDuration)
        : 0;
    useGameStore.getState().setFuseRatio(ratio);
    this.drawFuseTimerRail(ratio);

    this.pulseFuseBed(ratio);

    if (time >= this.fuseDeadline) {
      // Refuse auto-commit into guaranteed fuse invasion — but never softlock forever
      if (!this.lastArmed && this.wouldInvadeOnCommit()) {
        this.invadeStallCount += 1;
        if (this.invadeStallCount >= 2) {
          useGameStore.getState().setPrompt('STACK CRUSHED THE FUSE');
          playSfx('danger', 1);
          this.triggerGameOver();
          return;
        }
        this.fuseDeadline = time + 2200;
        this.fuseDuration = Math.max(this.fuseDuration, 2200);
        useGameStore.getState().setPrompt(
          this.heat > 0
            ? 'STACK IN FUSE — HEAT / recolor or SEND to die'
            : 'STACK IN FUSE — last SEND or OVERHEAT'
        );
        playSfx('danger', 0.8);
        return;
      }
      this.invadeStallCount = 0;
      this.commitFuse();
    }
  }

  /** True if every fuse column would pack into y ≤ FUSE_MAX_Y (instant death). */
  private wouldInvadeOnCommit(): boolean {
    const fuse = this.cubes.filter(
      (c) => !c.matched && !c.stuck && !c.committed && c.y <= FUSE_MAX_Y
    );
    if (fuse.length === 0) return false;
    const stuck = this.cubes
      .filter((c) => c.stuck && !c.matched)
      .map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));
    const pred = predictLockDetonation(
      fuse.map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id })),
      stuck
    );
    if (pred.ghostCells.length === 0) return false;
    return pred.ghostCells.every((g) => g.y <= FUSE_MAX_Y);
  }

  private pulseFuseBed(ratio: number) {
    const w = this.scale.width;
    const topOfFuse = this.getVY(FUSE_MAX_Y) - CELL_SIZE / 2;
    const bottom = this.scale.height;
    const urgency = 1 - ratio;
    const a = 0.06 + urgency * 0.1 + Math.sin(this.time.now / 160) * 0.03;
    this.fuseLine.clear();
    this.fuseLine.fillStyle(0xff4400, a);
    this.fuseLine.fillRect(0, topOfFuse, w, bottom - topOfFuse);
    this.fuseLine.fillStyle(0xffaa00, a * 0.7);
    this.fuseLine.fillRect(0, topOfFuse, w, CELL_SIZE * 0.4);
    this.fuseLine.lineStyle(4, ratio <= 0.35 ? 0xff3300 : 0xffd700, 0.95);
    this.fuseLine.lineBetween(0, topOfFuse, w, topOfFuse);
    this.fuseLine.lineStyle(2, 0xff4500, 0.7);
    for (let x = 10; x < w; x += 28) {
      this.fuseLine.lineBetween(x, topOfFuse - 5, x + 12, topOfFuse - 5);
    }
  }

  /**
   * HEAT LOCK skill loop: recolor → HOT → ARMED glow → SEND.
   * Heavy predict only when dirty (spawn/recolor/heat); pulse draws from cache.
   */
  private updateArmedPrediction(forceRecompute: boolean) {
    if (this.phase !== 'loading' || this.isGameOver) {
      if (this.lastArmed || this.lastHot || this.armedFuseIds.size > 0 || this.hotFuseIds.size > 0) {
        this.armedFuseIds.clear();
        this.hotFuseIds.clear();
        this.lastArmed = false;
        this.lastHot = false;
        this.cachedPred = null;
        this.predDirty = true;
        useGameStore.getState().setFuseArmed(false, 0);
        useGameStore.getState().setFuseHot(false);
        useGameStore.getState().setHeatCanArm(false);
        for (const c of this.cubes) this.paintCube(c);
      }
      return;
    }

    if (forceRecompute || this.predDirty || !this.cachedPred) {
      const fuse = this.cubes
        .filter((c) => !c.matched && !c.stuck && !c.committed && c.y <= FUSE_MAX_Y)
        .map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));
      const stuck = this.cubes
        .filter((c) => c.stuck && !c.matched)
        .map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));

      const pred = predictLockDetonation(fuse, stuck);
      this.cachedPred = pred;
      this.predDirty = false;

      const nextArmed = new Set(pred.armedFuseIds);
      const nextHot = new Set(pred.hotFuseIds);
      const becameArmed = pred.armed && !this.lastArmed;
      const becameHot = pred.hot && !this.lastHot && !pred.armed;
      const heatCanArm =
        !pred.armed && pred.heatHotFuseIds.length > 0 && this.heat > 0;
      const changed =
        pred.armed !== this.lastArmed ||
        pred.hot !== this.lastHot ||
        nextArmed.size !== this.armedFuseIds.size ||
        nextHot.size !== this.hotFuseIds.size ||
        [...nextArmed].some((id) => !this.armedFuseIds.has(id)) ||
        [...nextHot].some((id) => !this.hotFuseIds.has(id));

      this.armedFuseIds = nextArmed;
      this.hotFuseIds = nextHot;
      this.lastArmed = pred.armed;
      this.lastHot = pred.hot;
      useGameStore.getState().setFuseArmed(pred.armed, pred.maxRun);
      useGameStore.getState().setFuseHot(pred.hot && !pred.armed);
      useGameStore.getState().setHeatCanArm(heatCanArm);

      if (becameArmed) {
        playSfx('armed');
        this.cameras.main.flash(60, 255, 200, 40, false, undefined, this);
        useGameStore.getState().setPrompt(
          pred.maxRun >= 4
            ? `ARMED ×${pred.maxRun} — DETONATE for a big clear!`
            : 'ARMED — SEND / SPACE to detonate!'
        );
      } else if (becameHot) {
        playSfx('hot', 0.7);
        if (this.detonationCount <= 3) {
          useGameStore.getState().setPrompt('HOT — one recolor from ARMED');
        }
      } else if (heatCanArm) {
        const key = pred.heatHotFuseIds.join(',');
        if (key !== this.lastHeatCanArmPrompt) {
          this.lastHeatCanArmPrompt = key;
          useGameStore.getState().setPrompt('CLUTCH — HEAT the glowing cube to ARMED');
        }
      }

      if (changed) {
        for (const c of this.cubes) this.paintCube(c);
      }
    }

    const pred = this.cachedPred;
    if (!pred) return;

    // Ghost landing silhouettes — authored anticipation (pulse every frame)
    for (const g of pred.ghostCells) {
      if (g.y < AUTO_MIN_Y) continue;
      const px = this.getVX(g.x);
      const py = this.getVY(g.y);
      const isMatch = pred.matchKeys.includes(`${g.x},${g.y}`);
      const alpha = isMatch
        ? 0.35 + Math.sin(this.time.now / 90) * 0.12
        : 0.16 + Math.sin(this.time.now / 140) * 0.05;
      const col = isMatch ? 0xffd700 : COLOR_HEX[g.color].top;
      this.nearMatchGfx.lineStyle(isMatch ? 2.5 : 1.5, col, alpha);
      this.nearMatchGfx.strokeRoundedRect(px - 14, py - 14, 28, 28, 6);
      if (isMatch) {
        this.nearMatchGfx.fillStyle(0xffd700, alpha * 0.25);
        this.nearMatchGfx.fillRoundedRect(px - 14, py - 14, 28, 28, 6);
      }
    }

    // Match-key sparks on stack residue
    if (pred.armed && pred.matchKeys.length > 0) {
      for (const key of pred.matchKeys) {
        const [xs, ys] = key.split(',');
        const x = Number(xs);
        const y = Number(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (y < AUTO_MIN_Y) continue;
        if (pred.ghostCells.some((g) => g.x === x && g.y === y)) continue;
        const px = this.getVX(x);
        const py = this.getVY(y);
        const pulse = 0.18 + Math.sin(this.time.now / 100 + x) * 0.12;
        this.nearMatchGfx.fillStyle(0xffd700, pulse);
        this.nearMatchGfx.fillCircle(px, py, 7);
      }
    } else if (pred.heatHotFuseIds.length > 0 && this.heat > 0 && !pred.armed) {
      for (const id of pred.heatHotFuseIds) {
        const cube = this.cubes.find((c) => c.id === id);
        if (!cube) continue;
        const pulse = 0.2 + Math.sin(this.time.now / 100) * 0.1;
        this.nearMatchGfx.lineStyle(2, 0xff4500, pulse);
        this.nearMatchGfx.strokeCircle(cube.sprite.x, cube.sprite.y, CELL_SIZE / 2 + 4);
      }
    }
  }

  private tickRising(time: number) {
    if (this.isResolving) return;

    this.rebuildMap();
    const movers = this.cubes
      .filter((c) => !c.stuck && !c.matched && c.committed)
      .sort((a, b) => b.y - a.y);

    // Distance-based tempo: skip dead air, dramatize approach
    let minStepsLeft = Y_TOP;
    for (const cube of movers) {
      let faceY = Y_TOP + 1;
      for (let y = cube.y + 1; y <= Y_TOP; y++) {
        const occ = this.cubeMap.get(this.keyOf(cube.x, y));
        if (occ && occ !== cube && !occ.matched) {
          faceY = y;
          break;
        }
      }
      const steps = Math.max(0, faceY - cube.y - 1);
      minStepsLeft = Math.min(minStepsLeft, steps);
    }
    const baseMs = riseStepForScore(this.score);
    const stepMs = riseStepForDistance(baseMs, minStepsLeft, this.riseWasArmed);
    if (time < this.lastRiseTime + stepMs) return;
    this.lastRiseTime = time;

    // Cold packets skip multiple rows of empty shaft per tick
    const skips = riseSkipSteps(minStepsLeft, this.riseWasArmed);
    let anyStuck = false;
    let anyMoved = false;

    for (let step = 0; step < skips; step++) {
      this.rebuildMap();
      const batch = this.cubes
        .filter((c) => !c.stuck && !c.matched && c.committed)
        .sort((a, b) => b.y - a.y);
      if (batch.length === 0) break;

      for (const cube of batch) {
        const nextY = cube.y + 1;
        if (nextY > Y_TOP) {
          cube.y = Y_TOP;
          cube.stuck = true;
          anyStuck = true;
          this.tweens.add({
            targets: cube.sprite,
            y: this.getVY(cube.y),
            duration: RISE_TWEEN_MS,
            ease: 'Sine.easeOut',
          });
          if (step === 0) this.spawnRiseTrail(cube);
          continue;
        }

        if (this.occupied(cube.x, nextY, cube)) {
          const above = this.cubeMap.get(this.keyOf(cube.x, nextY));
          if (above && above !== cube) {
            cube.stuck = true;
            anyStuck = true;
            if (step === 0) {
              this.spawnBurst(cube.sprite.x, cube.sprite.y - 8, 0xffd700, 4);
            }
          }
        } else {
          this.cubeMap.delete(this.keyOf(cube.x, cube.y));
          cube.y = nextY;
          this.cubeMap.set(this.keyOf(cube.x, cube.y), cube);
          anyMoved = true;
          this.tweens.add({
            targets: cube.sprite,
            y: this.getVY(cube.y),
            duration: Math.max(50, RISE_TWEEN_MS - (skips - 1) * 12),
            ease: 'Sine.easeOut',
          });
          if (step === 0) this.spawnRiseTrail(cube);
        }
      }
    }

    this.rebuildMap();
    for (const cube of this.cubes) {
      if (cube.stuck || cube.matched || !cube.committed) continue;
      const nextY = cube.y + 1;
      const above = this.cubeMap.get(this.keyOf(cube.x, nextY));
      if (nextY > Y_TOP || (above && above !== cube)) {
        cube.stuck = true;
        anyStuck = true;
      }
    }

    if (anyStuck) {
      this.cameras.main.shake(40, 0.004);
    }

    const risingLeft = this.cubes.some((c) => c.committed && !c.stuck && !c.matched);
    if (!risingLeft) {
      this.riseStallFrames = 0;
      // Always pack to face so land ≡ predict (kills MISFIRE trust poison)
      this.packCommittedToFace();
      this.onLock();
    } else if (!anyMoved && !anyStuck) {
      this.riseStallFrames += 1;
      if (this.riseStallFrames > 4) {
        this.packCommittedToFace();
        this.riseStallFrames = 0;
        this.onLock();
      }
    } else {
      this.riseStallFrames = 0;
    }

    // Rising: ignore just-landed committed fuse in fuse band — payoff first
    this.checkFuseInvasion('rising');
    this.drawStackHeightRail();
  }

  /** Pack all committed free cubes to stack face / ceiling (matches predict sim). */
  private packCommittedToFace() {
    this.rebuildMap();
    const movers = this.cubes
      .filter((c) => c.committed && !c.stuck && !c.matched)
      .sort((a, b) => b.y - a.y);
    for (const cube of movers) {
      this.cubeMap.delete(this.keyOf(cube.x, cube.y));
      let y = cube.y;
      while (y < Y_TOP) {
        const next = y + 1;
        if (this.cubeMap.has(this.keyOf(cube.x, next))) break;
        y = next;
      }
      cube.y = y;
      cube.stuck = true;
      this.cubeMap.set(this.keyOf(cube.x, cube.y), cube);
      cube.sprite.y = this.getVY(cube.y);
    }
  }

  /** Right-edge stack pressure meter — readable death clock. */
  private drawStackHeightRail() {
    this.stackHeightGfx.clear();
    let minStuckY = GRID_ROWS;
    for (const c of this.cubes) {
      if (c.stuck && !c.matched) minStuckY = Math.min(minStuckY, c.y);
    }
    if (minStuckY >= GRID_ROWS) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const fuseTop = this.getVY(FUSE_MAX_Y) - CELL_SIZE / 2;
    const dangerY = this.getVY(minStuckY);
    const fillFrom = Math.min(dangerY, fuseTop);
    const ratio = 1 - minStuckY / Y_TOP;
    const col = minStuckY <= FUSE_MAX_Y + 2 ? 0xff2200 : minStuckY <= FUSE_MAX_Y + 6 ? 0xff8800 : 0xffd700;
    this.stackHeightGfx.fillStyle(0x000000, 0.35);
    this.stackHeightGfx.fillRect(w - 8, 8, 5, h - 16);
    this.stackHeightGfx.fillStyle(col, 0.75);
    const barH = Math.max(4, (h - 16) * Math.min(1, ratio + 0.05));
    this.stackHeightGfx.fillRect(w - 8, h - 8 - barH, 5, barH);
    // Face marker
    this.stackHeightGfx.fillStyle(0xffffff, 0.7);
    this.stackHeightGfx.fillRect(w - 10, fillFrom - 1, 9, 2);
  }

  // ─── FUSE WAVE ────────────────────────────────────────────

  private spawnFuseWave(scriptedFirst: boolean) {
    this.rebuildMap();

    // Death if fuse already invaded
    if (this.checkFuseInvasion()) return;

    this.heatSpentThisFuse = false;
    this.invadeStallCount = 0;
    this.commitSnapshot = null;

    // Teach: first wave is a tight triple; later grow with score
    const size =
      this.detonationCount === 0 ? 3 : waveSizeForScore(this.score);
    // Full fuse free list (all rows) so force-vertical triple can work on jagged stacks
    const freeSlots: { x: number; y: number }[] = [];
    for (let y = Y_SPAWN; y <= FUSE_MAX_Y; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (!this.occupied(x, y)) freeSlots.push({ x, y });
      }
    }

    if (freeSlots.length === 0) {
      this.triggerGameOver();
      return;
    }

    const stackCells = this.cubes
      .filter((c) => c.stuck && !c.matched)
      .map((c) => ({ x: c.x, y: c.y, color: c.color }));

    const pity = this.zeroClearLocks >= 2;
    // Keep scripted bias until first real detonation (not just first spawn)
    const keepScript =
      (scriptedFirst || this.detonationCount === 0) && this.detonationCount === 0;
    // Mid-run: HOT is enough; force ARMED only for teach / pity / 2 cold locks
    const ensureReadable =
      keepScript || pity || this.zeroClearLocks >= 2 || this.detonationCount === 0;
    const plans = finalizeFusePlan(freeSlots, stackCells, {
      scriptedFirst: keepScript,
      pity,
      detonationCount: this.detonationCount,
      waveSize: Math.min(size, freeSlots.length),
      ensureReadable,
    });
    if (pity) this.zeroClearLocks = 0;

    for (const p of plans) {
      this.spawnCube(p.x, p.y, p.color, false);
    }
    playSfx('spawn');

    // First fuse: slightly longer teach window
    const baseTimer = fuseTimerForScore(this.score);
    this.fuseDuration =
      this.detonationCount === 0 ? Math.max(baseTimer, 5200) : baseTimer;
    // N1b: new fuse never inherits pause remaining from a prior load
    this.fuseRemainingOnPause = 0;
    this.fuseDeadline = this.time.now + this.fuseDuration;
    this.setPhase('loading');
    this.lastTapped = null;
    this.riseStallFrames = 0;
    this.markPredDirty();
    this.lastHeatCanArmPrompt = '';

    // Immediate armed check so first wave can glow without waiting a frame
    this.updateArmedPrediction(true);

    if (this.detonationCount === 0 && this.lastArmed) {
      useGameStore.getState().setPrompt(
        'ARMED gold — SPACE / SEND to own the boom (tap only if you want a better setup)'
      );
    } else if (this.detonationCount === 0) {
      useGameStore.getState().setPrompt('TAP recolor → gold ARMED → SPACE send');
    } else if (this.heat > 0 && this.detonationCount === 1) {
      useGameStore.getState().setPrompt('HEAT (H) = wild ★ · spend to force a boom');
    } else if (pity && this.lastArmed) {
      useGameStore.getState().setPrompt('PITY ARMED — free detonation loaded');
    } else if (this.lastArmed) {
      useGameStore.getState().setPrompt('');
    } else if (this.lastHot) {
      useGameStore.getState().setPrompt('HOT — one recolor from ARMED');
    } else {
      useGameStore.getState().setPrompt('');
    }

    this.syncHud();
  }

  private spawnCube(x: number, y: number, color: CubeColor, stuck = false) {
    this.rebuildMap();
    if (this.occupied(x, y)) return;

    const container = this.add.container(this.getVX(x), this.getVY(y));
    const gfx = this.add.graphics();
    const heatRing = this.add.graphics();
    container.add(gfx);
    container.add(heatRing);

    const cube: CubeObj = {
      id: `c${nextCubeId++}`,
      x,
      y,
      color,
      stuck,
      matched: false,
      committed: stuck,
      sprite: container,
      gfx,
      heatRing,
    };

    this.paintCube(cube);
    this.cubes.push(cube);
    this.cubeMap.set(this.keyOf(x, y), cube);

    if (!stuck) {
      const hit = new Phaser.Geom.Rectangle(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      container.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
      container.setData('cubeId', cube.id);

      // Pop-in
      container.setScale(0.2);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Back.easeOut',
      });
    } else {
      container.setData('cubeId', cube.id);
      container.setScale(1);
      container.setAlpha(0.92);
    }
  }

  private paintCube(cube: CubeObj) {
    const armed =
      this.phase === 'loading' &&
      this.armedFuseIds.has(cube.id) &&
      !cube.committed &&
      !cube.stuck;
    const hot =
      !armed &&
      this.phase === 'loading' &&
      this.hotFuseIds.has(cube.id) &&
      !cube.committed &&
      !cube.stuck;
    paintCubeBody(cube.gfx, cube.color, {
      selected: this.lastTapped === cube && this.phase === 'loading',
      rising: cube.committed && !cube.stuck,
      stuck: cube.stuck,
      armed,
      hot,
      dim: cube.stuck && !cube.matched && cube.y <= FUSE_MAX_Y + 2,
    });
    cube.heatRing.clear();
    if (cube.color === 'red') {
      const pulse = 0.45 + Math.sin(this.time.now / 140) * 0.25;
      cube.heatRing.lineStyle(2.5, 0xffaa00, pulse);
      cube.heatRing.strokeCircle(0, 0, CELL_SIZE / 2 - 1);
      cube.heatRing.lineStyle(1, 0xffffff, pulse * 0.6);
      cube.heatRing.strokeCircle(0, 0, CELL_SIZE / 2 + 3);
    } else if (armed) {
      const pulse = 0.35 + Math.sin(this.time.now / 110) * 0.25;
      cube.heatRing.lineStyle(2.5, 0xffd700, pulse);
      cube.heatRing.strokeCircle(0, 0, CELL_SIZE / 2 + 2);
      cube.heatRing.lineStyle(1, 0xffffff, pulse * 0.5);
      cube.heatRing.strokeCircle(0, 0, CELL_SIZE / 2 + 6);
    } else if (hot) {
      const pulse = 0.25 + Math.sin(this.time.now / 130) * 0.2;
      cube.heatRing.lineStyle(2, 0xff8800, pulse);
      cube.heatRing.strokeCircle(0, 0, CELL_SIZE / 2 + 1);
    }
  }

  // ─── INPUT ────────────────────────────────────────────────

  private onPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (useGameStore.getState().gameState !== 'playing') return;
    if (this.phase !== 'loading' || this.isGameOver) return;
    if (pointer.getDistance() > 12) return;
    unlockAudio();

    // Right-click / Shift+tap cycles colors backward (faster search)
    const ev = pointer.event as MouseEvent | PointerEvent | undefined;
    const reverse =
      pointer.rightButtonReleased() ||
      !!(ev && 'shiftKey' in ev && ev.shiftKey);

    const hits = this.input.hitTestPointer(pointer);
    for (const obj of hits) {
      if (!(obj instanceof Phaser.GameObjects.Container)) continue;
      const id = obj.getData('cubeId') as string | undefined;
      if (!id) continue;
      const cube = this.cubes.find((c) => c.id === id);
      if (!cube || cube.matched || cube.stuck || cube.committed) continue;
      if (cube.y > FUSE_MAX_Y) continue;
      this.recolorCube(cube, reverse);
      return;
    }
  };

  private recolorCube(cube: CubeObj, reverse = false) {
    if (cube.color === 'red') {
      // wild stays wild until lock
      this.lastTapped = cube;
      this.refreshSelectionRings();
      playSfx('ui');
      return;
    }
    const idx = CUBE_COLORS.indexOf(cube.color as (typeof CUBE_COLORS)[number]);
    if (idx === -1) return;
    const n = CUBE_COLORS.length;
    cube.color = reverse
      ? CUBE_COLORS[(idx - 1 + n) % n]
      : CUBE_COLORS[(idx + 1) % n];
    this.lastTapped = cube;
    this.markPredDirty();
    this.updateArmedPrediction(true);
    this.paintCube(cube);
    this.refreshSelectionRings();
    playSfx('recolor');

    this.tweens.add({
      targets: cube.sprite,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 55,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    if (this.lastArmed) {
      useGameStore.getState().setPrompt('ARMED — SEND now or recolor more');
    } else if (this.lastHot) {
      useGameStore.getState().setPrompt('HOT — keep recoloring toward ARMED');
    } else if (this.detonationCount === 0) {
      useGameStore.getState().setPrompt('Match colors → gold ARMED → SPACE to SEND');
    }
  }

  private refreshSelectionRings() {
    for (const c of this.cubes) this.paintCube(c);
  }

  private applyHeat = () => {
    if (useGameStore.getState().gameState !== 'playing') return;
    if (this.phase !== 'loading' || this.isGameOver) return;
    unlockAudio();
    if (this.heat <= 0) {
      useGameStore.getState().setPrompt('No heat charges — clear 4+ or chain to earn');
      playSfx('ui', 0.5);
      return;
    }

    const fuse = this.cubes.filter(
      (c) => !c.matched && !c.committed && !c.stuck && c.y <= FUSE_MAX_Y && c.color !== 'red'
    );
    if (fuse.length === 0) {
      useGameStore.getState().setPrompt('No fuse cube to ignite');
      return;
    }

    const stuck = this.cubes
      .filter((c) => c.stuck && !c.matched)
      .map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));
    const fuseCells = fuse.map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));
    const lastId = this.lastTapped?.id ?? null;

    // Smart clutch target: prefer cube that arms the fuse
    let best = fuse[0];
    let bestScore = -1;
    for (const c of fuse) {
      const s = scoreHeatTarget(fuseCells, stuck, c.id, lastId);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    // Honor player tap if nearly as good
    if (this.lastTapped && fuse.includes(this.lastTapped)) {
      const tapScore = scoreHeatTarget(fuseCells, stuck, this.lastTapped.id, lastId);
      if (tapScore >= bestScore - 15) best = this.lastTapped;
    }

    const target = best;
    this.heat -= 1;
    this.heatSpentThisFuse = true;
    target.color = 'red';
    this.lastTapped = target;
    this.markPredDirty();
    this.updateArmedPrediction(true);
    this.paintCube(target);
    this.refreshSelectionRings();
    playSfx('heat');
    this.cameras.main.flash(100, 255, 90, 20, false, undefined, this);
    this.spawnBurst(target.sprite.x, target.sprite.y, 0xff4500, 12);
    this.tweens.add({
      targets: target.sprite,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 100,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    useGameStore.getState().setHeat(this.heat);
    const clutch =
      this.lastArmed &&
      this.fuseDuration > 0 &&
      (this.fuseDeadline - this.time.now) / this.fuseDuration <= 0.4;
    if (clutch) {
      this.spawnFloatText(target.sprite.x, target.sprite.y - 24, 'CLUTCH!', true);
    }
    useGameStore.getState().setPrompt(
      this.lastArmed
        ? clutch
          ? 'CLUTCH WILD — DETONATE NOW!'
          : 'WILD ARMED — DETONATE!'
        : bestScore >= 100
          ? 'WILD set the boom — SEND!'
          : 'WILD ready — recolor neighbors or SEND'
    );
  };

  private commitFuse = () => {
    if (useGameStore.getState().gameState !== 'playing') return;
    if (this.phase !== 'loading' || this.isGameOver) return;
    unlockAudio();

    const fuseCubes = this.cubes.filter(
      (c) => !c.matched && !c.stuck && c.y <= FUSE_MAX_Y
    );
    if (fuseCubes.length === 0) {
      this.spawnFuseWave(false);
      return;
    }

    // Snapshot prediction NOW — rides the rise as ARMED TRAIL (authorship continuity)
    const fuseCells = fuseCubes.map((c) => ({
      x: c.x,
      y: c.y,
      color: c.color,
      id: c.id,
    }));
    const stuckCells = this.cubes
      .filter((c) => c.stuck && !c.matched)
      .map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));
    const pred: LockPrediction = predictLockDetonation(fuseCells, stuckCells);

    const wasArmed = pred.armed;
    const ratioLeft =
      this.fuseDuration > 0
        ? Math.max(0, (this.fuseDeadline - this.time.now) / this.fuseDuration)
        : 0;
    this.lastCommitArmed = wasArmed;
    this.riseWasArmed = wasArmed;
    this.commitSnapshot = {
      armed: pred.armed,
      hot: pred.hot,
      maxRun: pred.maxRun,
      matchKeys: [...pred.matchKeys],
      ghostCells: pred.ghostCells.map((g) => ({ ...g })),
      heatSpent: this.heatSpentThisFuse,
      ratioLeft,
    };

    for (const c of fuseCubes) {
      c.committed = true;
      this.paintCube(c);
    }
    this.lastTapped = null;
    this.armedFuseIds.clear();
    this.hotFuseIds.clear();
    this.lastArmed = false;
    this.lastHot = false;
    // Keep ARMED flag through rise so HUD shows trail ownership (SEND already disabled)
    useGameStore.getState().setFuseArmed(wasArmed, pred.maxRun);
    useGameStore.getState().setFuseHot(false);
    this.fuseTimerGfx.clear();
    this.refreshSelectionRings();
    // N1b: leave loading — discard any pause remaining from this fuse
    this.fuseRemainingOnPause = 0;
    this.setPhase('rising');
    this.lastRiseTime = this.time.now;
    this.riseStallFrames = 0;
    useGameStore.getState().setFuseRatio(0);

    if (wasArmed && ratioLeft >= 0.45) {
      // Flat skill bonus (no combo multiply)
      const store = useGameStore.getState();
      const prevCombo = store.combo;
      store.setCombo(1);
      store.addScore(25);
      store.setCombo(prevCombo);
      this.score = useGameStore.getState().score;
      this.spawnFloatText(this.scale.width / 2, this.scale.height * 0.55, 'SNAP +25', true);
      useGameStore.getState().setPrompt(
        pred.maxRun >= 4
          ? `SNAP · ARMED RISE ×${pred.maxRun} — locks at ceiling`
          : 'SNAP · ARMED RISE — locks at ceiling'
      );
    } else if (wasArmed) {
      useGameStore.getState().setPrompt(
        pred.maxRun >= 4
          ? `ARMED RISE ×${pred.maxRun} — own the lock`
          : 'ARMED RISE — locks at ceiling'
      );
    } else {
      this.spawnFloatText(this.scale.width / 2, this.scale.height * 0.55, 'DUD TRAIL', false);
      useGameStore.getState().setPrompt('COLD RISE — dig the next fuse');
    }
    playSfx('commit');

    this.cameras.main.shake(wasArmed ? 90 : 70, wasArmed ? 0.01 : 0.007);
    if (wasArmed) {
      this.cameras.main.flash(80, 255, 200, 40, false, undefined, this);
    }
    for (const c of fuseCubes) {
      this.tweens.add({
        targets: c.sprite,
        scaleY: 0.82,
        scaleX: 1.08,
        duration: 70,
        yoyo: true,
      });
      this.spawnBurst(c.sprite.x, c.sprite.y + 12, 0xff8800, wasArmed ? 6 : 3);
    }
  };

  // ─── LOCK / DETONATE ──────────────────────────────────────

  private onLock() {
    if (this.isResolving || this.isGameOver) return;
    this.isResolving = true; // gate immediately — no race window
    this.heatGrantedThisLock = false;
    this.cascadeDepth = 0;
    this.setPhase('resolving');
    useGameStore.getState().setPrompt('LOCK!');
    playSfx('lock');
    this.nearMatchGfx.clear();

    // Lock flash + mark stuck visuals
    this.cameras.main.flash(140, 255, 215, 40, false, undefined, this);
    this.cameras.main.shake(80, 0.01);
    for (const c of this.cubes) {
      if (c.stuck && !c.matched) this.paintCube(c);
    }

    this.time.delayedCall(120, () => {
      this.resolveMatches();
    });
  }

  private resolveMatches() {
    if (this.isGameOver) return;
    this.isResolving = true;
    this.rebuildMap();

    const cells: MatchCell[] = this.cubes
      .filter((c) => c.stuck && !c.matched && c.y >= AUTO_MIN_Y)
      .map((c) => ({ x: c.x, y: c.y, color: c.color, id: c.id }));

    const runs = findMatches(cells);
    const keys = uniqueMatchKeys(runs);

    if (keys.length === 0) {
      if (this.cascadeDepth === 0) {
        this.emitLockVerdict(0, false);
      }
      this.finishResolve(this.cascadeDepth > 0);
      return;
    }

    this.cascadeDepth += 1;
    this.maxCascade = Math.max(this.maxCascade, this.cascadeDepth);
    const toDestroy = this.cubes.filter((c) => keys.includes(this.keyOf(c.x, c.y)));
    // Score per run (not unique-cell total) so two triples ≠ one hex-score
    let pts = 0;
    let maxRun = 0;
    let redCount = 0;
    for (const run of runs) {
      const rReds = run.cells.filter((c) => c.color === 'red').length;
      redCount += rReds;
      maxRun = Math.max(maxRun, run.cells.length);
      pts += scoreForMatch(run.cells.length, rReds);
    }
    const size = toDestroy.length;
    this.bestClear = Math.max(this.bestClear, maxRun);

    // Authorship stamp on first clear of this lock
    if (this.cascadeDepth === 1) {
      this.emitLockVerdict(size, redCount > 0);
    }

    const store = useGameStore.getState();
    const comboMul = store.combo;
    const awarded = Math.round(pts * comboMul);
    store.addScore(pts);
    this.score = useGameStore.getState().score;
    store.setSessionStats({
      maxCascade: this.maxCascade,
      bestClear: this.bestClear,
    });

    let nextCombo = store.combo;
    if (store.combo === 1) nextCombo = 1.5;
    else if (store.combo === 1.5) nextCombo = 2.0;
    else if (store.combo >= 2.0) nextCombo = 2.5;
    store.setCombo(nextCombo);
    this.comboTimer = this.time.now + COMBO_WINDOW_MS;

    // Heat economy (spec): size ≥4 OR cascade ≥2 — never free refill on every ARMED-3
    const uniqueCleared = size;
    if (
      !this.heatGrantedThisLock &&
      (maxRun >= 4 || this.cascadeDepth >= 2 || uniqueCleared >= 4)
    ) {
      this.heat = Math.min(HEAT_MAX, this.heat + 1);
      this.heatGrantedThisLock = true;
      store.setHeat(this.heat);
      this.spawnFloatText(this.scale.width / 2, this.scale.height * 0.42, '+1 HEAT', true);
    }

    // Wave from score
    const newWave = Math.floor(this.score / 500) + 1;
    if (newWave > this.wave) {
      this.wave = newWave;
      store.setWave(this.wave);
    }

    // Juice: flash matched + particles + cascade chain trails
    playSfx(this.cascadeDepth <= 1 ? 'detonate' : 'cascade', 0.8 + this.cascadeDepth * 0.15);
    const sorted = [...toDestroy].sort((a, b) => a.sprite.y - b.sprite.y);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      c.matched = true;
      const hex = COLOR_HEX[c.color].top;
      this.time.delayedCall(i * 28, () => {
        if (!c.sprite.active) return;
        this.spawnBurst(c.sprite.x, c.sprite.y, hex, 8 + Math.min(6, size));
        this.tweens.add({
          targets: c.sprite,
          alpha: 0.05,
          scaleX: 1.45,
          scaleY: 1.45,
          yoyo: true,
          repeat: 2,
          duration: 75,
        });
        if (i > 0) {
          const prev = sorted[i - 1];
          const line = this.add.graphics().setDepth(175);
          line.lineStyle(3, 0xffd700, 0.85);
          line.lineBetween(prev.sprite.x, prev.sprite.y, c.sprite.x, c.sprite.y);
          this.tweens.add({
            targets: line,
            alpha: 0,
            duration: 320,
            onComplete: () => line.destroy(),
          });
        }
      });
    }

    const midX =
      toDestroy.reduce((s, c) => s + c.sprite.x, 0) / Math.max(1, toDestroy.length);
    const midY =
      toDestroy.reduce((s, c) => s + c.sprite.y, 0) / Math.max(1, toDestroy.length);
    this.spawnFloatText(midX, midY, `+${awarded}`, size >= 5);
    if (this.cascadeDepth >= 2) {
      this.spawnFloatText(midX, midY + 28, `x${this.cascadeDepth} CHAIN`, true);
    }
    if (size >= 5) {
      this.spawnFloatText(midX, midY - 28, 'MEGA CLEAR', true);
    }

    if (this.cascadeDepth >= 3) {
      this.spawnFloatText(this.scale.width / 2, this.scale.height * 0.35, 'OVERHEAT!', true);
      this.cameras.main.flash(220, 255, 60, 0, false, undefined, this);
    }

    // Signature first boom: brief freeze on authored cubes
    const freezeMs =
      this.cascadeDepth === 1 && this.lastCommitArmed && !this.firstBoomCelebrated
        ? 140
        : 0;
    if (freezeMs > 0) this.firstBoomCelebrated = true;

    this.time.delayedCall(260 + freezeMs, () => {
      for (const c of toDestroy) {
        c.sprite.destroy();
        const idx = this.cubes.indexOf(c);
        if (idx !== -1) this.cubes.splice(idx, 1);
      }
      this.cameras.main.shake(170, 0.009 + Math.min(0.014, size * 0.0012));
      this.applyGravity();
      this.time.delayedCall(RISE_TWEEN_MS + 50, () => {
        this.isResolving = false;
        this.resolveMatches(); // cascade
      });
    });
  }

  /** One primary authorship float per lock — "I set that up and it exploded". */
  private emitLockVerdict(clearSize: number, hadWild: boolean) {
    const snap = this.commitSnapshot;
    let verdict: LockVerdict;

    if (clearSize === 0) {
      verdict = snap?.armed ? 'MISFIRE' : 'COLD LOCK';
    } else if (this.detonationCount === 0 && snap?.armed) {
      verdict = 'FIRST LOCK';
    } else if (snap?.armed) {
      verdict = 'YOU SET THIS';
    } else if (snap?.heatSpent && hadWild) {
      verdict = 'HEAT CARRY';
    } else if (!snap?.armed && clearSize > 0) {
      verdict = 'SCRAPE';
    } else {
      verdict = 'YOU SET THIS';
    }

    // Cascade payoff overlays on later steps via CHAIN float; upgrade label if chain already
    if (this.cascadeDepth >= 2 && clearSize > 0) {
      verdict = 'CHAIN PAYOFF';
    }

    this.lastVerdict = verdict;
    useGameStore.getState().setLastVerdict(verdict);

    const big =
      verdict === 'YOU SET THIS' ||
      verdict === 'FIRST LOCK' ||
      verdict === 'HEAT CARRY' ||
      verdict === 'CHAIN PAYOFF';
    this.spawnFloatText(
      this.scale.width / 2,
      this.scale.height * 0.32,
      verdict,
      big
    );
    if (verdict === 'YOU SET THIS' || verdict === 'FIRST LOCK') {
      playSfx('armed', 0.9);
    }
  }

  private finishResolve(hadDetonation: boolean) {
    this.isResolving = false;
    if (!hadDetonation) {
      this.zeroClearLocks += 1;
      // Cold / misfire snaps the armed streak — regret loop
      if (this.armedStreak > 0) {
        this.spawnFloatText(
          this.scale.width / 2,
          this.scale.height * 0.36,
          `STREAK BROKEN ×${this.armedStreak}`,
          true
        );
      }
      this.armedStreak = 0;
      useGameStore.getState().setArmedStreak(0);
      if (!this.lastCommitArmed) {
        this.spawnFloatText(this.scale.width / 2, this.scale.height * 0.4, 'DUD', false);
      } else {
        this.spawnFloatText(this.scale.width / 2, this.scale.height * 0.44, 'MISFIRE', false);
      }
    } else {
      this.detonationCount += 1;
      this.zeroClearLocks = 0;
      useGameStore.getState().setSessionStats({ detonations: this.detonationCount });

      // ARMED STREAK — authored boom chain (emotion axis vs Tetris)
      if (this.lastCommitArmed) {
        this.armedStreak += 1;
        this.bestArmedStreak = Math.max(this.bestArmedStreak, this.armedStreak);
        useGameStore.getState().setArmedStreak(this.armedStreak);
        useGameStore.getState().setBestArmedStreak(this.bestArmedStreak);
        if (this.armedStreak >= ARMED_STREAK_START) {
          const bonus = Math.min(
            ARMED_STREAK_BONUS_CAP,
            (this.armedStreak - ARMED_STREAK_START + 1) * ARMED_STREAK_BONUS_PER
          );
          const store = useGameStore.getState();
          const prevCombo = store.combo;
          store.setCombo(1);
          store.addScore(bonus);
          store.setCombo(prevCombo);
          this.score = useGameStore.getState().score;
          this.spawnFloatText(
            this.scale.width / 2,
            this.scale.height * 0.28,
            `STREAK ×${this.armedStreak}  +${bonus}`,
            true
          );
          playSfx('armed', 0.7 + Math.min(0.5, this.armedStreak * 0.08));
        }
      } else {
        // Scrape clear without authorship — no streak growth, soft break
        if (this.armedStreak > 0) {
          this.armedStreak = 0;
          useGameStore.getState().setArmedStreak(0);
        }
      }
    }

    // Mark all stuck non-matched as settled; un-commit
    for (const c of this.cubes) {
      if (c.stuck) c.committed = false;
    }

    // Force any non-stuck floating cubes (shouldn't exist) to settle
    this.rebuildMap();
    for (const c of this.cubes) {
      if (!c.matched && !c.stuck && c.y >= AUTO_MIN_Y) {
        c.stuck = true;
        c.committed = false;
      }
    }
    this.applyGravity();

    // Death only AFTER detonation/gravity — never cancel authored boom mid-flash
    this.checkFuseInvasion('hard');
    if (this.isGameOver) return;

    this.rebuildMap();
    useGameStore.getState().setPrompt('');
    useGameStore.getState().setFuseArmed(false, 0);
    useGameStore.getState().setFuseHot(false);
    useGameStore.getState().setHeatCanArm(false);
    this.hotFuseIds.clear();
    this.lastHot = false;
    this.commitSnapshot = null;
    this.cachedPred = null;
    this.predDirty = true;

    // Brief beat before next fuse so detonation reads
    this.time.delayedCall(hadDetonation ? 220 : 80, () => {
      if (this.isGameOver) return;
      this.spawnFuseWave(false);
    });
  }

  private applyGravity() {
    this.rebuildMap();
    for (let x = 0; x < GRID_COLS; x++) {
      const col = this.cubes
        .filter((c) => c.x === x && c.stuck && !c.matched)
        .sort((a, b) => b.y - a.y);

      let expected = Y_TOP;
      for (const cube of col) {
        if (cube.y !== expected) {
          cube.y = expected;
          this.tweens.add({
            targets: cube.sprite,
            y: this.getVY(cube.y),
            duration: RISE_TWEEN_MS,
            ease: 'Sine.easeOut',
          });
        }
        expected--;
      }
    }
    this.rebuildMap();
  }

  // Override finish when cascade ends — resolveMatches calls finish when no matches
  // Fix: when keys.length === 0, call finishResolve with cascadeDepth info
  // (already handled in resolveMatches → finishResolve(false,0) but need hadMatch true if cascaded)

  private spawnFloatText(x: number, y: number, text: string, big: boolean) {
    const t = this.add
      .text(x, y, text, {
        fontSize: big ? '30px' : '20px',
        color: big ? '#FF4500' : '#FFD700',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.floatLayer.add(t);
    this.tweens.add({
      targets: t,
      y: y - 70,
      alpha: 0,
      scale: big ? 1.25 : 1.05,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /** Lightweight burst — embers without a particle manager dependency. */
  private spawnBurst(x: number, y: number, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      const g = this.add.graphics().setDepth(180);
      const r = 2 + Math.random() * 3.5;
      g.fillStyle(color, 0.95);
      g.fillCircle(0, 0, r);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(-r * 0.2, -r * 0.2, r * 0.35);
      g.setPosition(x, y);
      const ang = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 48;
      this.tweens.add({
        targets: g,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist - 12,
        alpha: 0,
        scale: 0.15,
        duration: 280 + Math.random() * 240,
        ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });
    }
  }

  /** Short vertical trail under rising cubes — anticipation juice. */
  private spawnRiseTrail(cube: CubeObj) {
    const g = this.add.graphics().setDepth(40);
    const hex = COLOR_HEX[cube.color].top;
    g.fillStyle(hex, 0.35);
    g.fillEllipse(0, 0, 10, 16);
    g.setPosition(cube.sprite.x, cube.sprite.y + 10);
    this.tweens.add({
      targets: g,
      y: cube.sprite.y + 28,
      alpha: 0,
      scaleX: 0.4,
      scaleY: 1.4,
      duration: RISE_TWEEN_MS + 40,
      ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // ─── DANGER / GO ──────────────────────────────────────────

  /**
   * Fuse invasion death.
   * - rising: ignore just-landed committed fuse (resolve first — authored payoff)
   * - hard: any stuck residue in fuse band (post-resolve / spawn)
   */
  private checkFuseInvasion(mode: 'hard' | 'rising' = 'hard'): boolean {
    const invaded = this.cubes.some((c) => {
      if (!c.stuck || c.matched || c.y > FUSE_MAX_Y) return false;
      // Rising: committed packet may land at y≤3 under a low face — still detonate
      if (mode === 'rising' && c.committed) return false;
      return true;
    });
    if (invaded) {
      this.triggerGameOver();
      return true;
    }
    return false;
  }

  private updateDanger() {
    let minStuckY = GRID_ROWS;
    for (const c of this.cubes) {
      if (c.stuck && !c.matched) minStuckY = Math.min(minStuckY, c.y);
    }
    const danger =
      minStuckY <= FUSE_MAX_Y + 1
        ? 3
        : minStuckY <= FUSE_MAX_Y + 4
          ? 2
          : minStuckY <= FUSE_MAX_Y + 8
            ? 1
            : 0;

    this.dangerOverlay.clear();
    if (danger === 0) {
      this.dangerOverlay.setVisible(false);
      this.lastDangerLevel = 0;
      return;
    }
    this.dangerOverlay.setVisible(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const color = danger === 3 ? 0xff0000 : danger === 2 ? 0xff8800 : 0xffd700;
    const alpha = 0.1 + danger * 0.07 + Math.sin(this.time.now / 200) * 0.05;
    this.dangerOverlay.fillStyle(color, alpha);
    this.dangerOverlay.fillRect(0, h * 0.5, w, h * 0.5);
    if (danger >= 2) {
      this.dangerOverlay.lineStyle(5, color, alpha + 0.25);
      this.dangerOverlay.strokeRect(3, 3, w - 6, h - 6);
    }
    if (danger >= 2 && (danger > this.lastDangerLevel || this.time.now - this.lastDangerSfx > 1200)) {
      playSfx('danger', 0.6 + danger * 0.15);
      this.lastDangerSfx = this.time.now;
    }
    this.lastDangerLevel = danger;
  }

  private updateNearMatchHints() {
    this.nearMatchGfx.clear();
    if (this.phase !== 'rising' && this.phase !== 'loading') return;

    // Repaint wild pulse rings cheaply
    if (this.phase === 'loading') {
      for (const c of this.cubes) {
        if (c.color === 'red' && !c.matched) this.paintCube(c);
      }
    }

    // ARMED TRAIL / DUD TRAIL — commit snapshot rides the rise (no mid-rise match)
    if (this.phase === 'rising' && this.commitSnapshot) {
      this.drawCommitTrail(this.commitSnapshot);
    }

    const rising = this.cubes.filter((c) => c.committed && !c.stuck && !c.matched);
    if (rising.length === 0) return;

    this.rebuildMap();
    for (const r of rising) {
      // Face of stack = lowest stuck y in column
      let face: CubeObj | undefined;
      for (let y = AUTO_MIN_Y; y <= Y_TOP; y++) {
        const c = this.cubeMap.get(this.keyOf(r.x, y));
        if (c?.stuck) {
          face = c;
          break;
        }
      }
      const x = this.getVX(r.x);
      if (face && (face.color === r.color || r.color === 'red' || face.color === 'red')) {
        const y = this.getVY(face.y);
        const pulse = 0.4 + Math.sin(this.time.now / 90) * 0.25;
        this.nearMatchGfx.fillStyle(0xffffff, pulse);
        this.nearMatchGfx.fillCircle(x, y + CELL_SIZE / 2, 5);
        this.nearMatchGfx.lineStyle(2, 0xffd700, 0.7);
        this.nearMatchGfx.strokeCircle(x, y + CELL_SIZE / 2, 11);
        // trail from rising cube to face
        this.nearMatchGfx.lineStyle(1, 0xffd700, 0.25 + pulse * 0.3);
        this.nearMatchGfx.lineBetween(x, r.sprite.y, x, y + CELL_SIZE / 2);
      } else if (!face) {
        // Empty column — path clear to ceiling
        this.nearMatchGfx.lineStyle(1, 0xffffff, 0.08);
        this.nearMatchGfx.lineBetween(x, r.sprite.y, x, this.getVY(Y_TOP));
      }

      // Horizontal foreshadow: adjacent rising same color
      for (const other of rising) {
        if (other === r || other.y !== r.y) continue;
        if (Math.abs(other.x - r.x) !== 1) continue;
        if (other.color === r.color || r.color === 'red' || other.color === 'red') {
          this.nearMatchGfx.lineStyle(2, 0xffaa00, 0.35 + Math.sin(this.time.now / 80) * 0.2);
          this.nearMatchGfx.lineBetween(r.sprite.x, r.sprite.y, other.sprite.x, other.sprite.y);
        }
      }
    }
  }

  /** Persistent authorship ghosts during rise — gold if ARMED, steel if cold. */
  private drawCommitTrail(snap: CommitSnapshot) {
    const matchSet = new Set(snap.matchKeys);
    const pulse = 0.28 + Math.sin(this.time.now / 100) * 0.12;
    const col = snap.armed ? 0xffd700 : 0x8899aa;

    for (const g of snap.ghostCells) {
      if (g.y < AUTO_MIN_Y) continue;
      const px = this.getVX(g.x);
      const py = this.getVY(g.y);
      const isMatch = matchSet.has(`${g.x},${g.y}`);
      const a = isMatch ? pulse + 0.15 : pulse * 0.55;
      this.nearMatchGfx.lineStyle(isMatch ? 2.5 : 1.5, col, a);
      this.nearMatchGfx.strokeRoundedRect(px - 13, py - 13, 26, 26, 5);
      if (isMatch && snap.armed) {
        this.nearMatchGfx.fillStyle(0xffd700, a * 0.22);
        this.nearMatchGfx.fillRoundedRect(px - 13, py - 13, 26, 26, 5);
      }
    }

    // Beams from rising cubes to their ghost land cells
    for (const cube of this.cubes) {
      if (!cube.committed || cube.stuck || cube.matched) continue;
      const ghost = snap.ghostCells.find((g) => g.id === cube.id);
      if (!ghost || ghost.y < AUTO_MIN_Y) continue;
      const isMatch = matchSet.has(`${ghost.x},${ghost.y}`);
      this.nearMatchGfx.lineStyle(
        isMatch ? 2 : 1,
        col,
        isMatch ? 0.35 + pulse * 0.3 : 0.12
      );
      this.nearMatchGfx.lineBetween(
        cube.sprite.x,
        cube.sprite.y,
        this.getVX(ghost.x),
        this.getVY(ghost.y)
      );
    }

    // Contact pulse on stack match keys (not fuse ghosts)
    if (snap.armed) {
      for (const key of snap.matchKeys) {
        const [xs, ys] = key.split(',');
        const x = Number(xs);
        const y = Number(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y) || y < AUTO_MIN_Y) continue;
        if (snap.ghostCells.some((g) => g.x === x && g.y === y)) continue;
        const px = this.getVX(x);
        const py = this.getVY(y);
        this.nearMatchGfx.fillStyle(0xffd700, 0.15 + pulse * 0.2);
        this.nearMatchGfx.fillCircle(px, py, 8);
      }
    }
  }

  private triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.setPhase('gameover');
    this.isResolving = false;
    playSfx('gameover');

    const store = useGameStore.getState();
    store.setHeatAtDeath(this.heat);
    store.setPrompt('');
    store.setSessionStats({
      detonations: this.detonationCount,
      maxCascade: this.maxCascade,
      bestClear: this.bestClear,
    });

    // OVERHEAT RECEIPT — one forensic sentence → retry desire
    const cause = this.buildDeathCause();
    store.setDeathCause(cause);

    this.cameras.main.shake(450, 0.028);
    this.cameras.main.flash(300, 255, 30, 0, false, undefined, this);

    // Brief invasion pulse on fuse band so the board tells the story
    this.dangerOverlay.setVisible(true);
    this.dangerOverlay.clear();
    this.dangerOverlay.fillStyle(0xff0000, 0.35);
    const topOfFuse = this.getVY(FUSE_MAX_Y) - CELL_SIZE / 2;
    this.dangerOverlay.fillRect(0, topOfFuse, this.scale.width, this.scale.height - topOfFuse);

    this.time.delayedCall(550, () => {
      const wave = this.wave;
      const score = this.score;
      store.setGameState('gameover');
      useUserStore.getState().updateBest(wave, score);
      useUserStore.getState().addHeatPoints(Math.floor(score / 10));
      EventBus.emit('game-over', {
        heatLeft: this.heat,
        score,
        wave,
        detonations: this.detonationCount,
        maxCascade: this.maxCascade,
        cause,
      });
    });
  }

  private buildDeathCause(): string {
    const heat = this.heat;
    const armed = this.lastCommitArmed;
    const verdict = this.lastVerdict;
    const streak = this.bestArmedStreak;

    if (streak >= 3 && heat > 0) {
      return `Best streak ×${streak} — then ${heat} heat left unused. One more lock.`;
    }
    if (heat > 0 && !armed) {
      return `${heat} heat left unused — you sent cold under a fat stack.`;
    }
    if (heat > 0 && armed) {
      return `You armed it — residue still crushed the fuse. ${heat} heat left.`;
    }
    if (heat === 0 && verdict === 'YOU SET THIS') {
      return 'Spent every ember. Stack still won.';
    }
    if (heat === 0 && !armed) {
      return 'Cold rises fattened the stack. Rewrite that fuse.';
    }
    if (verdict === 'MISFIRE') {
      return 'Armed trail misfired — geometry shifted. One more lock.';
    }
    if (streak >= 2) {
      return `Streak peaked at ×${streak}. Fuse invaded — rewrite harder.`;
    }
    return 'Fuse invaded. Load it. Lock it. Detonate harder.';
  }
}

