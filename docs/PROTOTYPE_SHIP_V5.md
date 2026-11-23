# Heat Rush — Prototype Ship Notes (v5)

**Date:** 2026-07-19  
**Hook:** HEAT LOCK + **ARMED STREAK** — *Load it. Lock it. Detonate. Chain it.*  
**Bar:** Playable PC-browser vertical slice; emotion > Tetris mastery

---

## Multi-agent research outcome (this pass)

| Candidate amplifier | Verdict |
|---------------------|---------|
| WAVE BOMB (workshop mode) | Rejected week-1 — long dead-time |
| IGNITE HOLD | Rejected — fights Tetris on mastery axis |
| Free mid-rise match | Rejected — kills delayed boom identity |
| **HOT skill-path guarantee** | **Shipped** — kills “blind recolor” trust poison |
| **ARMED STREAK** | **Shipped** — greed / “one more lock” beyond single boom |
| HEAT LOCK core | Kept (Load · Lock · Detonate) |

**Signature fantasy (v5):**  
Recolor fuse → HOT → ARMED → SEND → ARMED TRAIL → LOCK → **YOU SET THIS** → cascade → **STREAK ×N** → die with heat regret → **ONE MORE LOCK**.

---

## What changed (v5)

| Area | Change | Files |
|------|--------|-------|
| Spawn logic | Mid-run never ships pure-cold when HOT/ARMED geometry exists; free ARMED demoted to HOT ~65% | `fuseSpawn.ts` |
| Hook amp | Armed-detonation streak + score bonus + streak-broken float | `MainGame.ts`, `constants.ts`, `useGameStore.ts` |
| Input | **Q** reverse recolor (PC) | `MainGame.ts` |
| UI | STREAK badge, best streak on OVERHEAT, menu beat chips | `GameUI.tsx`, `MainMenu.tsx` |
| Tempo | Snappier early rise step | `constants.ts` |
| Tests | Mid-run HOT/ARMED ≥10/12 samples | `logic.test.ts` |

---

## Acceptance criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Logic tests | all pass | Required |
| Production build | `npm run build` | Required |
| Input / loop / lock match / score / GO+restart | closed loop | Yes |
| Stable frame | time-step rise, `isResolving`, dirty predict | Yes |
| First detonation | scripted shelf ARMED | Yes |
| Mid-run skill path | HOT/ARMED when geometry allows | Yes |
| Offline play | no Supabase required | Yes |
| Emotion vs Tetris | delayed authored boom + streak greed + heat regret | Design lock |

---

## Failure modes

| Symptom | Cause | Mitigation |
|---------|-------|------------|
| Silent audio | Autoplay policy | First gesture unlocks |
| Leaderboard empty | No env | Expected offline |
| Cold mid-run (rare) | Unsolvable geometry | Pity after 2 zero-clear locks |
| Streak broken float spam | Cold lock after streak | Intentional regret juice |

## Rollback

Revert `fuseSpawn.ts`, `MainGame.ts`, `constants.ts`, `useGameStore.ts`, `GameUI.tsx`, `MainMenu.tsx` from VCS.

## Run

See `docs/PROTOTYPE_RUNBOOK.md`.
