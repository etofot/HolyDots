# Heat Rush — HEAT LOCK Prototype Runbook

**Version:** prototype-heat-lock-v5  
**Spec:** `GAME_HOOK_HEAT_LOCK.md` + `PROTOTYPE_SHIP_V5.md`  
**Date:** 2026-07-19

---

## How to run (PC browser)

```bat
cd "I:\1_VSCODE\2026_3  GAMES\HolyDots"
npm install
npm run dev
```

Or double-click `launch.bat`.

Open **http://localhost:5173** (Vite default).

Production static:

```bat
npm run build
npm run preview
```

Output: `dist/`

### Logic tests (pure core, no browser)

```bat
npm run test:logic
```

### Env (optional)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | No | Auth / leaderboard (offline works without) |
| `VITE_SUPABASE_ANON_KEY` | No | Same |

Copy `.env.example` → `.env` only if you want cloud. Game is fully playable offline.

---

## How to play (HEAT LOCK)

| Control | Action |
|---------|--------|
| **TAP** cube in orange FUSE zone | Recolor (cycle 4 silhouettes) |
| **Q** / **RMB** / **Shift+TAP** | Reverse recolor (faster search) |
| **HEAT** / **CLUTCH** button or **H** | Spend 1 heat → best clutch cube becomes **wild ★** |
| **SEND** / **DETONATE** or **SPACE** / **Enter** | Commit fuse → cubes rise |
| **ESC** / Pause | Freeze fuse timer |
| Timer bar empty | Auto-commit (blocked once if SEND = guaranteed death, then OVERHEAT) |
| **Space / Enter** on OVERHEAT | ONE MORE LOCK |
| Chain **ARMED** detonations | **STREAK ×N** bonus (resets on cold/misfire) |

### Skill telegraphs

| State | Look | Meaning |
|-------|------|---------|
| **HOT** | Amber ring on fuse cubes | One recolor from a detonation |
| **ARMED** | Gold glow + ghost landings | This SEND will boom on lock |
| **CLUTCH** | Pulsing HEAT button | Heat can force ARMED on a glowing cube |
| **ARMED TRAIL** | Gold ghosts + beams during rise | Your authored boom still visible while rising |
| **COLD TRAIL** | Grey ghosts (rises fast) | You committed a dud — dig next fuse |
| **SNAP** | +25 on early ARMED SEND | You committed with time to spare |
| **Verdict float** | YOU SET THIS / FIRST LOCK / COLD LOCK / … | Authorship stamp at detonation |

**Loop:** Load (recolor/heat) → HOT → ARMED → SEND → Rise (own the trail) → Lock flash → Verdict + Detonate cascades → next fuse.

**Death:** Stack invades fuse **after** detonation/gravity resolves (never cancels an authored boom mid-flash). Also: fuse cannot spawn, or stalled invade timer on auto-commit.

**Heat:** Start 2 / max 3. Earn +1 only on quality clear (run ≥4, unique clear ≥4, or cascade depth ≥2) — once per lock. Size-3 ARMED alone does **not** refill heat. Smart HEAT targets the cube that best arms the fuse.

### v5 logic / hook fixes (playtest bar)

| Fix | Why |
|-----|-----|
| Mid-run HOT skill-path guarantee | No blind recolor-under-timer when geometry allows |
| Free ARMED demoted to HOT ~65% mid-run | Skill ownership without trust poison |
| ARMED STREAK bonuses | Greed / “one more lock” emotion vs Tetris |
| Q reverse recolor | Faster color search on PC |
| Snappier early rise | Cut boring-watch dead air |
| Pack-to-face before every lock | Land ≡ predict |
| GO only post-resolve | Authored boom always plays out |
| Zustand equality + dirty predict | Stable 60fps HUD |

---

## Architecture (runtime)

```
React (menu/HUD) ──EventBus──► Phaser MainGame
     │                              │
     └── Zustand useGameStore ◄─────┘
         score, heat, fuseRatio, phase, gameState, HOT/ARMED, verdict, deathCause
```

| File | Role |
|------|------|
| `src/game/scenes/MainGame.ts` | Sim + input + juice + trail + verdict |
| `src/game/matchCore.ts` | Pure match detection |
| `src/game/fusePredict.ts` | ARMED / HOT / ghost landings |
| `src/game/fuseSpawn.ts` | Clustered spawn, pity, opening shelf, **spawn→predict guarantee** |
| `src/game/cubeArt.ts` | Silhouette art per color |
| `src/game/constants.ts` | Grid, fuse, timers, scoring |
| `src/components/GameUI.tsx` | HUD, SEND/HEAT, OVERHEAT receipt, pause |
| `src/components/MainMenu.tsx` | Play gate |
| `src/store/useGameStore.ts` | Session state |

Sim **only** runs when `gameState === 'playing'`. Menu does not ghost-simulate. Pause owns the Phaser clock (`time.paused` + tweens) so fuse, delayedCall resolve chains, and tweens freeze; loading remaining is scoped to the current fuse only (N1/N1b fixed).

---

## v3 logic / hook fixes (this pass)

| Problem | Fix |
|---------|-----|
| Post-opener duds on jagged stacks | `finalizeFusePlan` + `forceReadableFusePlan` validate via `predictLockDetonation` |
| Pity that was not actually matchable | Pity path forces ARMED/HOT when geometry allows |
| Teach prompt made players brick first ARMED | First-wave prompt prefers “ARMED — SEND” when already gold |
| Rise was dead watching | **ARMED TRAIL** / COLD TRAIL from commit snapshot |
| “I don’t know what I did” | **LOCK VERDICT** float (YOU SET THIS / FIRST LOCK / …) |
| Infinite invade timer softlock | 2 stalls max → OVERHEAT |
| Weak heat refill | +1 heat on armed detonation / quality / cascade |
| Weak retry story | OVERHEAT receipt + Space/Enter retry |

---

## Failure modes

| Symptom | Cause | Fix / rollback |
|---------|-------|----------------|
| Blank LOADING forever | Supabase hang (rare) | Hard-refresh; auth is try/catch |
| Play does nothing | EventBus before scene ready | Boot → MainGame; restart via `heat-lock-restart` |
| No detonations | Extremely packed fuse (rare) | HEAT wild; pity after 2 zero-clears |
| Immediate OVERHEAT | Stack packed into fuse | Expected late-game; restart |
| Score not saving cloud | No Supabase / not logged in | Offline: best score in `localStorage` |
| Detonation continues while paused | **Fixed (N1)** — pause sets `this.time.paused` + `tweens.pauseAll()` | Regression: check `syncPauseClock` |
| Fuse timer wrong after pause mid-rise | **Fixed (N1b)** — remaining cleared on commit/spawn/begin/create; not saved off-loading | Regression: pause mid-rise then load |
| HUD off the board on wide desktop | **Fixed (N9)** — App playfield is 540:1080 aspect box; HUD docks to board | Outer chrome is letterbox; playfield aligned |
| Die right after a good boom | Residue fuse invasion post-resolve (design; QA **N10** feel) | Death receipt; next design: STREAK SHIELD |
| Silent first SFX | Autoplay policy | First gesture unlocks audio |

### Rollback

```bat
git checkout -- src/
npm run dev
```

---

## Acceptance (prototype v3)

| # | Gate | Status |
|---|------|--------|
| 1 | ≤2 skill verbs; no drag; match only on lock | ✅ |
| 2 | First wave ARMED vs opening shelf; teach doesn’t force brick | ✅ |
| 3 | Spawn plans validated ARMED/HOT when geometry allows | ✅ |
| 4 | Restart works (`scene.restart` + play gate + Space on GO) | ✅ |
| 5 | Death shows unused heat + receipt + session stats | ✅ |
| 6 | Cascades + floating score + lock flash + verdict + SFX | ✅ |
| 7 | ARMED TRAIL during rise (not empty watch) | ✅ |
| 8 | Pure logic tests green (`npm run test:logic`) — **43** cases (v5) | ✅ |
| 9 | Local best score persists offline | ✅ |
| 10 | External playtest metrics / emotion vs Tetris claim | ⬜ dogfood — see `QA_HARD_HEAT_LOCK.md` |
| 11 | Pause owns Phaser timers (N1/N1b) | ✅ `syncPauseClock` + remaining scoped to current load |
| 11b | Letterbox-safe HUD (N9) | ✅ aspect playfield in `App.tsx` |
| 12 | STREAK SHIELD stake (not score-only) | ⬜ design locked in `DESIGN_DELTA_STREAK_SHIELD.md` |

---

## Signature emotional beat (≤20s)

1. Opening shelf + scripted triple → gold **ARMED**  
2. **SPACE** SEND → **ARMED TRAIL** rise  
3. **LOCK** flash → float **FIRST LOCK** / **YOU SET THIS**  
4. Cascade pops → next fuse  

Tetris: continuous mastery. Heat Rush: **authored delayed boom you want to see again**.

Mute: Settings → Sound Effects (`localStorage`).
