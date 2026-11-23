# Heat Rush — Prototype Ship Notes (v4)

**Date:** 2026-07-19  
**Hook:** HEAT LOCK — *Load it. Lock it. Detonate.*  
**Bar:** Playable vertical slice for PC browser (emotion > Tetris mastery)

---

## What shipped

Playable HEAT LOCK loop end-to-end:

1. **Menu → PLAY** gates sim (no ghost play under menu)
2. **Fuse load** — recolor / reverse recolor / HEAT under timer
3. **HOT → ARMED** telegraphs with ghost landings
4. **SEND / SPACE** commit → rise trail → pack-to-face lock
5. **Detonate only on lock** with cascades, combos, verdicts
6. **OVERHEAT** with heat-left regret + ONE MORE LOCK restart
7. **Pause** freezes fuse deadline; ESC toggle

## Hook research outcome (multi-agent)

Kept HEAT LOCK (not WAVE BOMB / IGNITE HOLD). Emotion axis:

| Tetris | Heat Rush |
|--------|-----------|
| Continuous placement mastery | Brief authorship → forced spectatorship |
| Instant line clear | Delayed boom you can see (ARMED trail) |
| “I misdropped” | “I sent cold” / “I didn’t heat” |
| Always in control | CLUTCH heat + regret receipt |

## v4 logic / feel P0s implemented

| ID | Change | Files |
|----|--------|-------|
| P0-1 | GO only post-resolve; rising ignores just-landed committed fuse | `MainGame.ts` |
| P0-2 | Always `packCommittedToFace` before lock; mid-run spawn not free-ARMED | `MainGame.ts`, `fuseSpawn.ts` |
| P0-3 | Dirty predict + Zustand equality guards (no 60fps thrash) | `MainGame.ts`, `useGameStore.ts` |
| P1-4 | Cold multi-skip rise; ARMED slow approach | `constants.ts`, `MainGame.ts` |
| P1-5 | Heat only on size≥4 / cascade≥2; CLUTCH UI | `MainGame.ts`, `GameUI.tsx` |

## Acceptance criteria (measurable)

| Criterion | Target | Status |
|-----------|--------|--------|
| Logic tests | `npm run test:logic` all pass | Required |
| Production build | `npm run build` succeeds | Required |
| First detonation | Scripted shelf + ARMED first fuse | Implemented |
| Predict ≡ land | Pack before every lock | Implemented |
| Unfair mid-boom death | 0 (GO after resolve) | Implemented |
| Offline play | No Supabase required | Yes |
| Restart | scene.restart + store reset | Yes |

## Failure modes

| Symptom | Cause | Mitigation |
|---------|-------|------------|
| Silent audio | Autoplay policy | First gesture unlocks (`unlockAudio`) |
| Leaderboard empty | No env / offline | Expected; play still works |
| Cold mid-run fuse | Skill ownership (not a bug) | Recolor / HEAT / pity after 2 duds |
| Stack invades after boom | Residue in fuse band | Fair GO; use heat earlier next run |

## Rollback

Revert this pass: restore prior `MainGame.ts`, `fuseSpawn.ts`, `constants.ts`, `useGameStore.ts` from VCS. Sim is self-contained under `src/game/`.

## Run

See `docs/PROTOTYPE_RUNBOOK.md`.
