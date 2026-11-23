# Heat Rush 2.0 (HolyDots) — ARCHITECTURE §Exploration

**Task:** `Game_Browser_Pro` / `recon`  
**Date:** 2026-07-18 (joint multi-agent re-verify)  
**Bar:** Senior/Staff production systems  
**Agents:** explore (logic audit) + plan (hook decision) + orchestrator verification against source

---

## 0. Executive summary

| Item | Finding |
|------|---------|
| **Product** | Heat Rush 2.0 — inverted-stack + match-3 hybrid (portrait browser 540×1080) |
| **Path** | `I:\1_VSCODE\2026_3  GAMES\HolyDots` |
| **Stack** | React 19 · Phaser 3.90 · TypeScript · Zustand · Tailwind · Vite · optional Supabase |
| **Playable today?** | Partially — board moves, tap/drag, H/V matches, game over; **not** a trusted prototype |
| **Core pain** | PRD is huge; sim is a ~1280-line god scene; **lifecycle + match pipeline break trust**; identity muddy |
| **Emotional gap vs Tetris** | Tetris owns continuous control mastery. Current build is a multi-system mashup without a signature delayed-payoff moment |
| **Recommended hook** | **HEAT LOCK** — *Load · Lock · Detonate* (see §7 + `GAME_HOOK_HEAT_LOCK.md`) |

**Verdict:** Do **not** implement the full PRD. Freeze feature sprawl, fix lifecycle + match honesty (P0), then rebuild the core loop around **HEAT LOCK** until “one more try” beats Tetris on playtest metrics.

**OpenCode note:** Workspace `GROK_OPENCODE_FILES` is the wrapper only. All game work happens in HolyDots above.

---

## Implementation status (post-recon — same day)

| Item | Status |
|------|--------|
| P0 play gate (`gameState === 'playing'`) | **DONE** |
| P0 restart (`heat-lock-restart` → `scene.restart`) | **DONE** |
| P0 `isResolving` + lock-only match | **DONE** |
| P0 shop / continue hidden | **DONE** |
| P1 HEAT LOCK loop (fuse 0–3, timer, SEND, heat charges) | **DONE** |
| P1 fuse-invasion death + unused heat GO | **DONE** |
| P1 pure `matchCore.ts` | **DONE** |
| Runbook | `docs/PROTOTYPE_RUNBOOK.md` |
| External playtest metrics | Pending dogfood |

Prototype identity is live in code; full PRD remains non-goals.

---

## 1. Repository map

```
HolyDots/
├── index.html, package.json, vite.config.ts, tailwind…
├── launch.bat / build.bat
├── prd.txt                 # Spec (~1000+ lines) — aspirational, half-unshipped
├── map.md                  # Older architecture map (partially stale)
├── bug-report.md           # Historical; several “fixed” claims overstated vs current source
├── public/favicon.svg
├── dist/                   # Last production static build
├── docs/
│   ├── ARCHITECTURE_RECON.md   # ← this file
│   └── GAME_HOOK_HEAT_LOCK.md  # Hook design lock
├── src/
│   ├── main.tsx, App.tsx, index.css
│   ├── components/         # React overlay UI
│   │   ├── PhaserGame.tsx  # Mounts Phaser canvas (always on)
│   │   ├── GameUI.tsx      # HUD + Game Over (restart wire broken)
│   │   ├── MainMenu.tsx, Shop.tsx, Settings.tsx
│   │   ├── Leaderboard.tsx, Login.tsx, ToastViewport.tsx
│   ├── store/
│   │   ├── useGameStore.ts # score, wave, combo, gameState
│   │   ├── useUserStore.ts # meta currency, upgrades (unwired in sim)
│   │   └── useUIStore.ts   # toasts + global error handler
│   ├── lib/supabase.ts     # Offline-friendly client
│   └── game/               # Phaser engine
│       ├── main.ts         # Phaser.Game config 540×1080 FIT
│       ├── constants.ts    # Grid, timing, colors
│       ├── EventBus.ts     # React ↔ Phaser bridge (incomplete)
│       ├── utils.ts        # startScene helper (unused by UI)
│       └── scenes/
│           ├── Boot.ts     # Procedural bg → always starts MainGame
│           └── MainGame.ts # ★ ~1280 LOC — ALL sim + render + input
└── supabase/               # migrations + Stripe stubs
```

---

## 2. Runtime architecture

```
┌────────────────────────────────────────────────────────────┐
│ index.html → main.tsx → App.tsx                            │
│   ├─ PhaserGame  (always mounted) ── Phaser.Game           │
│   │     Boot → MainGame (always running after Boot)        │
│   ├─ GameUI      (HUD / Game Over when state matches)      │
│   ├─ MainMenu | Shop | Settings | Leaderboard | Login      │
│   └─ ToastViewport                                         │
│                                                            │
│   EventBus: game-over, game-continue (listened)            │
│             scene-changed (EMITTED, NEVER LISTENED)  ← H5  │
│   Zustand: useGameStore + useUserStore + useUIStore        │
│   Supabase: optional auth / profiles / leaderboards        │
└────────────────────────────────────────────────────────────┘
```

### Engine / scenes / assets / input

| Layer | Implementation | Assessment |
|-------|----------------|------------|
| **Engine** | Phaser 3.90, AUTO renderer, Scale.FIT, 540×1080 | Solid baseline for portrait PC browser |
| **Scenes** | Boot (textures) → MainGame only | No menu scene, no pause scene, no tutorial scene |
| **Assets** | No image pack — procedural Graphics + `bg` texture | Fast cold start; weak visual identity |
| **Input** | pointerdown + drag + pointerup-as-tap on containers | No keyboard SEND/pause; drag + tap compete |
| **Audio** | None | Critical juice gap for emotion |
| **Sim gate** | None — MainGame `update` only checks `isGameOver` | **Critical defect (C5)** |

### Data contracts (typed gaps)

```typescript
// Actual CubeObj — missing isRainbowWildcard on type
interface CubeObj {
  x, y: number;
  color: CubeColor; // 'yellow'|'blue'|'green'|'white'|'red'
  stuck, matched: boolean;
  tapCount, lastTapTime: number;
  sprite: Container;
  counterText: Text;
}
// Rainbow flag is (cube as any).isRainbowWildcard — tech debt
// Dual meaning: color === 'red' is both heat-wild AND rainbow insert color
```

---

## 3. Current gameplay model (as coded)

### Grid & motion

- **12 × 24** logical cells; pixel cell **45px**.
- **y increases upward** on screen: spawn `y=0` bottom → rise → stack toward `y=23` top.
- Move tick hard-coded **600ms**; prep-zone groups move every **other** tick ≈ 1200ms; groups fully in `y≥8` move every tick (2×).
- After clear: gravity **packs toward top** (`expectedY = GRID_ROWS - 1`). Aligns with inverted stack; conflicts with PRD “fall down” wording.

### Zones

| Zone | Rows (0-based) | Player | Matches |
|------|----------------|--------|---------|
| Spawn/prep | `y < 8` | Tap recolor, drag, 8-tap → red | No |
| Auto | `y ≥ 8` | Ignored | Yes, only when **newly stuck** |

### Match / scoring / meta

- Match: horizontal + vertical runs ≥3, red as wildcard, auto zone only.
- Cascade: delayed resolve loop after gravity tween (~400ms after 500ms flash).
- Combo: 1 → 1.5 → 2 → 2.5, 3s window.
- Wave: `floor(sceneScore / 500) + 1` (not PRD time-based 60s).
- Rainbow flyers: reward for match size ≥6 only; `handleIceSpawning` is no-op.
- Game over: **all 12** columns have stuck cube at `y=0` (soft vs PRD full-column).

---

## 4. PRD vs implementation matrix

| PRD system | Code status | Impact |
|------------|-------------|--------|
| Prep 1–8 / Auto 9–24 | Approx (0–7 / ≥8) | OK shape |
| Tap color cycle | Implemented | OK |
| Drag H+V prep | Implemented | Dilutes skill; fat-finger |
| 8-tap heat → red | Implemented | Slow power fantasy |
| Matches only auto | Implemented | OK |
| **Every-frame** match in auto | **No** — only on `newlyStuck` | Logic suffers |
| Shape matches L/T/Z/□ | **Missing** | Spec bloat |
| Complete-figure 2× accelerate | **Wrong** — any same-color group all y≥8 | Logic suffers |
| Flying colored cubes | **Missing** — rainbow rewards only | Partial |
| Random events (4 types) | 2 stubs (surge, slowdown) | Weak |
| Blizzard every 10 waves | Present | OK |
| Pause menu | **Missing** | UX |
| Keyboard | **Missing** | Desktop |
| Audio / juice | **Missing** | Emotion |
| Daily rewards / achievements | **Missing** | Retention |
| Shop upgrades affect play | **Never read by MainGame** | Trust poison |
| Skins on cubes | **Unwired** | Cosmetic fake |
| Tutorial | **Missing** | Onboarding cliff |
| Continue clear top 3 | Present but **wrong for GO rule** | C6 |

**Staff takeaway:** The PRD describes a AAA mobile feature list. The code is a **vertical slice** of inverted stack match-3. Shipping path is **cut PRD to identity**, not “finish the PRD.”

---

## 5. Confirmed logic defects (joint multi-agent audit)

Severity: **C** critical · **H** high · **M** medium  
Explore agent re-verified all prior claims against source; **new** defects C6–C7 added.

| ID | Defect | Where | Why it hurts fun | Ship blocker? |
|----|--------|-------|------------------|---------------|
| **C1** | Matches only when cubes newly stuck | `update` ~385–387 | Alignments mid-rise never clear; board feels “stuck” / unfair **unless** sold as lock detonation | Yes vs PRD; design-OK under HEAT LOCK if juiced |
| **C2** | Rainbow row candidates ignore **consecutive x** | `findRowMatchCandidates` ~697–729 | Gaps count as runs → false rainbow inserts | Yes if rainbow on |
| **C3** | Rainbow insert does not kick match resolve | `resolveRainbowCollision` | Completes line, flash, then idle until later stuck | Yes if rainbow on |
| **C4** | Tap on rainbow broken (`color: 'red'`, indexOf −1); insert y≥19 so zone gate always blocks; re-draw rainbow after “fix” | `applyTap` ~833–846 | Core power unusable / visuals stuck rainbow | Yes if rainbow on |
| **C5** | Boot always starts MainGame; sim under menus; `resetGame()` forces `playing`; restart emits dead event | Boot, create, store, GameUI | Menu ghost game; **retry loop dead** | **Hard yes** |
| **C6** | Continue clears top 3 rows; GO is spawn-row full block | `handleContinue` vs `checkGameOver` | Pay 50 crystals → GO again immediately | Yes if continue on |
| **C7** | No `isResolving` lock; concurrent match resolve | resolve + update | Double score/destroy late game | Yes under density |
| **H1** | 2× speed = all y≥8 same-color group, not complete figures | `handleCubeMovement` ~505–518 | Accidental speedups; PRD strategy dead | Soft for slice |
| **H2** | Dual score owners; red bonus × combo | resolve + `addScore` | Fragile; balance skew | Soft for fun |
| **H3** | Upgrades never applied in sim | Shop + useUserStore only | Players buy nothing-of-value | Hide shop |
| **H4** | Restart/Play: `scene-changed` has **no Phaser listener** | GameUI ~87, MainMenu ~12 | After GO pause, board frozen | Same as C5 |
| **H5** | Spatial map stale during collisions/drag | update order | Missed/false rainbow joins | Medium |
| **H6** | Drag vs sim race in prep | setupDragEvents + movement | Jumps, refuse drop | Partial |
| **H7** | Color surge recolors all without immediate resolve | `triggerEvent` | Delayed mass chaos | Soft |
| **M1–M8** | Soft GO, inverted gravity vs PRD wording, missing systems, double GO write, occupancy inconsistency | various | Prototype incompleteness | Cut scope |

**Note:** `bug-report.md` claims several criticals fixed. Current source still exhibits **C1–C5**. Treat bug-report as historical.

### Lifecycle failure path (diagram)

```
Boot.create → scene.start(MainGame)
MainGame.create → resetGame() → gameState='playing'   // menu thrash
update() → always sim while !isGameOver                // ghost under menu overlay
Game Over → scene.pause()
RESTART → setGameState('playing') + emit scene-changed // NO LISTENER
         → board stays paused forever                  // HARD FAIL
```

---

## 6. Why the player doesn’t fall in love (emotion analysis)

### What Tetris owns

1. **Immediate feedback** — place piece → line or fail in <1s  
2. **Clear skill fantasy** — spatial mastery every frame  
3. **Death narrative** — “I misdropped” is fair and personal  
4. **One more try** — 30–90s sessions, zero teaching cost  

### What Heat Rush currently delivers

1. Delayed/confusing feedback (match only on stuck + racey timers) without owning the delay  
2. **Too many verbs** (tap, multi-tap heat, drag axes) without a hero moment  
3. **Ghost systems** (shop, rainbow, events) that don’t form a story  
4. **No audio / weak juice** — detonations don’t feel authored  
5. **Trust breaks** (restart, menu sim, rainbow tap, continue) kill “I’ll retry”  

### Opportunity

The inverted grid + lock-then-match is **not** a failed Tetris clone — it’s a **delayed detonation** fantasy Tetris cannot own. The code accidentally half-implements that fantasy (stuck-only match) but surrounds it with sandbox noise.

---

## 7. Joint design decision: **HEAT LOCK**

> **Identity:** You recolor a rising fuse under a ticking window; when it locks into the ceiling stack it detonates — heat wilds turn a clean clear into a panic cascade.  
> **Slogan:** **LOAD IT. LOCK IT. DETONATE.**  
> **Not:** continuous Tetris control. **Yes:** anticipation + authored explosion + last-wild hope.

### Hook candidates scored (plan agent)

| Hook | Weighted | Week-1 fit | Emotion vs Tetris | Decision |
|------|----------|------------|-------------------|----------|
| **A HEAT LOCK** | **4.55** | Excellent | Delayed authored boom | **SHIP** |
| B WAVE BOMB | 3.35 | Too expensive | Big bomb, rare peaks | Sequel mode |
| C IGNITE HOLD | 3.40 | Medium | Timing thrills | Pro modifier later |

### Core loop (tightened vs first draft)

| Phase | Early timing | Player | Feel |
|-------|--------------|--------|------|
| Fuse window | **4.0→2.4s**, **y0–3 only** | Recolor · Heat | Agency |
| Commit | Instant | Timer or **SEND** | Irreversible |
| Rise | **≤3.5s early** (not 5s) | **No touch** | Anticipation |
| Lock | ~0.3s | Watch | Heart spike |
| Detonate + cascade | 0.8–2.5s | Watch | Authored boom |
| Aftermath | 0–2s | Next fuse (overlap OK) | Residue threat |

### KEEP / CUT / TRANSFORM

| KEEP | CUT | TRANSFORM |
|------|-----|-----------|
| Rise-up + pack to top | Drag reposition | Prep → **fuse 4 rows** |
| Match only when locked | 8-tap heat spam | Heat → **charge wallet** (max 3) |
| 4 colors + wild red | Fake shop / unwired upgrades | Rainbow flyers → **cascade embers = heat** (defer flyers) |
| Cascades + combo | Shape/figure PRD systems | Timer fuse bar + optional SEND |
| Danger visual | Mid-rise clears “to feel responsive” | Near-match fuse spark VFX while rising |
| EventBus shell | Blizzard/events week-1 | Death = **fuse invasion y≤3** |

### Metrics (prototype acceptance)

| Metric | Target |
|--------|--------|
| Time-to-first-detonate | ≤25s |
| Retry within 10s of GO | ≥65% |
| Median session length | ≥4.5 min |
| Detonations / min (early) | 2.0–3.5 |
| Sessions with cascade≥2 | ≥70% |
| Playtest phrase | “I set that up and it exploded” — **not** “Tetris upside down” |

Full design narrative + 7-day order: `docs/GAME_HOOK_HEAT_LOCK.md`.

---

## 8. Target architecture (prototype → production)

### Pure core (testable, no Phaser) — preferred extract path

```
src/game/core/
  types.ts
  grid.ts              # occupancy, spatial hash (logical coords only)
  movement.ts
  fuse.ts              # fuse window, timer, commit, heat wallet
  match.ts             # H/V, wild, consecutive-x rules
  gravity.ts           # pack toward stack top (documented)
  scoring.ts           # pure: (base)×combo + redBonus
  spawn.ts
  step.ts              # step(state, input, dt) → { state, events[] }
```

Week-1 may **patch MainGame in place** if pure-core extract blocks schedule — trust + fuse first, extract when blocked by testability.

### Phaser shell

```
scenes/Boot.ts
scenes/MainGame.ts     # thin: input → core, events → juice
view/CubeView.ts
juice/JuiceBus.ts      # SFX/VFX/shake/haptics
bridge/StoreSync.ts    # single score owner; upgrades at session start
```

### React shell

- Menu / retry / mute / debug metrics  
- Game Over with heat regret UX  
- Shop **hidden** until ≥1 upgrade is wired (`VITE_ENABLE_SHOP=false`)

### Config via env

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ENABLE_SHOP=false
VITE_DEBUG_METRICS=true
VITE_LEGACY_LOOP=false
```

### Observability

- Structured `game_events` log (localStorage ring buffer): `detonate`, `heat_spend`, `death`, `retry`  
- No silent catch; toast on auth/network failures (partially present)

### Security boundaries

- Client score never trusted for competitive leaderboards without server validation (current insert is client-trust — OK for offline prototype, not for ranked)  
- Stripe functions remain stubs — do not enable IAP until verify path is real  

---

## 9. Prototype roadmap (measurable)

### P0 — Trust & playability (1–2 days) — **MUST BEFORE HOOK MARKETING**

1. Lifecycle: pause sim unless `gameState === 'playing'`; restart = `scene.restart()`; no force-play on Boot create.  
2. Wire RESTART/PLAY to real Phaser restart (listen `scene-changed` **or** call `scene.restart` from bridge).  
3. Match honesty: consecutive-x; resolve after lock **and** after gravity; **defer rainbow** week-1 or fully fix C2–C4.  
4. Resolve lock (`isResolving`) — C7.  
5. Single score path; red bonus outside combo.  
6. Hide shop + disable continue until C6 fixed.  
7. Acceleration: complete figures only **or** temporary flat speed curve (document choice).

### P1 — HEAT LOCK slice (3–5 days)

1. Fuse window 4 rows; timer + SEND (Space on PC).  
2. Two verbs only; heat charges (start 2, max 3).  
3. Near-match fuse VFX + lock flash + 8 SFX stubs.  
4. Death = fuse invasion y≤3.  
5. First-60s scripted first detonation.  
6. Debug metrics HUD.

### P2 — Polish for “better than Tetris emotionally”

1. Difficulty curve 5 min + pity RNG.  
2. Playtest 5 people against acceptance table §7.  
3. Cut dead meta UI permanently for slice.  
4. Heat regret on GO screen.

### Explicit non-goals for prototype

Multiplayer, full PRD events, shape matches, Stripe, daily calendar, narrative, landscape, controller, rainbow flyers.

---

## 10. Runbook

### Dev

```bat
cd "I:\1_VSCODE\2026_3  GAMES\HolyDots"
npm install
npm run dev
:: → http://localhost:5173
```

Or `launch.bat`.

### Production build

```bat
npm run build
npm run preview
```

### Env

| Var | Required | Notes |
|-----|----------|-------|
| `VITE_SUPABASE_URL` | No | Offline fallback if missing/placeholder |
| `VITE_SUPABASE_ANON_KEY` | No | Same |
| `VITE_ENABLE_SHOP` | No | Default false for prototype |
| `VITE_DEBUG_METRICS` | No | Local event ring + HUD |

### Failure modes

| Symptom | Likely cause | Mitigation |
|---------|--------------|------------|
| Menu but cubes still move | C5 lifecycle | Gate update on `playing` |
| Restart dead board | H4/C5 no scene restart | `scene.restart()` |
| Rainbow does nothing | C2–C4 | Defer rainbow or fix candidates + resolve + tap |
| Shop purchase no effect | H3 | Hide shop |
| Continue → instant GO | C6 | Clear spawn blockers or disable continue |
| Late double clears | C7 | `isResolving` gate |
| Auth toast | Supabase down | Offline local progress |

### Rollback

- Git tag before HEAT LOCK refactor (`prototype-pre-heat-lock`)  
- `dist/` is last known static build — emergency static host  
- Feature flag: `VITE_LEGACY_LOOP=true` to keep old prep-8 until P1 stabilizes  

---

## 11. Acceptance criteria (recon complete when)

- [x] Engine, files, assets, input, scenes mapped  
- [x] Logic defects evidenced with severity (C1–C7, H1–H7, M*)  
- [x] PRD gap matrix written  
- [x] Multi-agent hook design (HEAT LOCK vs WAVE BOMB vs IGNITE HOLD) with metrics  
- [x] Architecture target + pure-core split  
- [x] Runbook + prototype roadmap  

**Not in recon scope (next task):** implement P0/P1 code changes.

---

## 12. File ownership for next implementer

| Concern | File |
|---------|------|
| God sim | `src/game/scenes/MainGame.ts` |
| Constants | `src/game/constants.ts` |
| Scene boot | `src/game/scenes/Boot.ts` |
| React lifecycle | `src/App.tsx`, `GameUI.tsx`, `MainMenu.tsx`, `PhaserGame.tsx` |
| Score/combo | `src/store/useGameStore.ts` |
| Dead meta | `src/components/Shop.tsx`, `useUserStore.ts` |
| Spec debt | `prd.txt` vs this doc — **this doc + GAME_HOOK win for prototype** |

---

## 13. Agent collaboration log

| Agent | Role | Outcome |
|-------|------|---------|
| explore | Source-level defect audit | Confirmed C1–C5; added C6 (continue vs GO), C7 (concurrent resolve); H5–H7 races |
| plan | Hook candidates + week plan | HEAT LOCK 4.55 wins; rise ≤3.5s; death fuse invasion; trust-first days 1–2 |
| orchestrator | Cross-check + docs | Docs locked; ship order: P0 trust → P1 HEAT LOCK → P2 playtest |

---

*End of ARCHITECTURE §Exploration.*
