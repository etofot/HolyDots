# Heat Rush 2.0 — Logic Defects Audit (evidence)

**Date:** 2026-07-18  
**Source of truth:** current `src/` (not bug-report claims)  
**Companion:** `ARCHITECTURE_RECON.md` §5

---

## Verified claimed defects

| Claim | Verdict |
|-------|---------|
| Matches only on newlyStuck | CONFIRMED |
| Rainbow sequences ignore x gaps | CONFIRMED |
| Rainbow insert no match resolve | CONFIRMED |
| applyTap rainbow broken | CONFIRMED (+ auto-zone always blocks real inserts) |
| Sim under menu; resetGame forces playing | CONFIRMED |
| Restart scene-changed no listener | CONFIRMED |
| Upgrades never read by sim | CONFIRMED |
| Dual score ownership | CONFIRMED (synced today, fragile) |
| 2× speed wrong vs complete figures | CONFIRMED |

## New findings (this pass)

| ID | Finding |
|----|---------|
| **C6** | Continue clears top 3 rows; GO is all spawn cells blocked — continue does not undo GO condition |
| **C7** | No `isResolving` — concurrent `detectMatchesAndResolve` while flash/gravity in flight |
| **H5** | Spatial map rebuild after collisions; drag mutates without map write |
| **H6** | Drag vs movement tick race |
| **H7** | Color surge + stuck-only match = delayed mass clear |

---

## Critical (C)

### C1 — Match only on newly stuck
`MainGame.update` clears `newlyStuckCubes` then only calls `detectMatchesAndResolve` when size > 0. Mid-rise auto-zone alignments never clear.

### C2 — Rainbow non-adjacent sequences
`findRowMatchCandidates` builds sequences on color equality only, not `x === prev.x + 1`.

### C3 — Rainbow insert no resolve
`resolveRainbowCollision` sets `stuck: true` without `markCubeStuck` / without calling detect. Comment defers to movement stuck path.

### C4 — Rainbow tap dead
Insert uses `color: 'red'`; `CUBE_COLORS.indexOf('red') === -1` → no cycle, flag uncleared. Inserts land y 19–23 so `y >= 8` early-return always. `updateRainbowGridCubeVisuals` re-paints rainbow after “fix.”

### C5 / H4 — Lifecycle
- Boot always `scene.start('MainGame')`
- `create` → `resetGame()` → `gameState: 'playing'`
- `update` ignores React `gameState`
- RESTART/PLAY emit `scene-changed`; **no** `EventBus.on('scene-changed')` in project
- GO calls `scene.pause()` → board frozen without restart

### C6 — Continue broken for GO rule
`handleContinue` clears `y >= GRID_ROWS - 3`. GO requires stuck at `Y_SPAWN` on all columns. Continue does not free spawn row.

### C7 — Concurrent resolve
No lock while 500ms flash + 400ms post-gravity delayedCall chains run; new stuck events re-enter resolve.

---

## High (H)

| ID | Summary |
|----|---------|
| H1 | 2× speed = any same-color group fully y≥8 (incl. 1–2 cubes), not complete figures |
| H2 | `this.score` and store both accumulate; red bonus inside combo multiply |
| H3 | Shop upgrades/skins never read in MainGame |
| H5–H7 | Map/drag/event races and surge chaos |

---

## Minimal fun-prototype ship path

1. **C5/H4/M7 lifecycle** — play gate + `scene.restart()`  
2. **C1 as intentional HEAT LOCK** OR every-frame stuck resolve — but sell lock  
3. **Defer rainbow (C2–C4)** or full fix  
4. **C7 isResolving**  
5. **Hide shop + continue** (H3, C6)  
6. Single score (H2) when touching scoring  

Full severity table: `ARCHITECTURE_RECON.md` §5.
