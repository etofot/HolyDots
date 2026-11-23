# HEAT LOCK — Player Hook Design (LOCKED)

**Working title:** HEAT LOCK  
**Ship name:** Heat Rush  
**Slogan:** **LOAD IT. LOCK IT. DETONATE.**  
**Goal:** Beat Tetris on **emotion / “one more try”**, not on pure placement skill.  
**Status:** Design lock after multi-agent recon (2026-07-18)

Companion: `ARCHITECTURE_RECON.md`

---

## 0. Decision

| Item | Value |
|------|-------|
| **Hook** | HEAT LOCK |
| **Rejected for week-1** | WAVE BOMB, IGNITE HOLD (see §1) |
| **Verbs** | **Recolor** · **Heat** (+ SEND as commit, not a third skill verb) |
| **Match** | **Only on LOCK** |
| **Heat** | Charges start 2 / max 3 — never 8-tap |
| **Death** | Fuse invasion **y ≤ 3** |
| **Rise watch** | **≤3.5s early** (tightened from 5s) |
| **Rainbow flyers** | **Deferred** week-1 |
| **Shop / events / shapes** | **Cut** for prototype |

---

## Identity (one line)

You recolor a rising fuse under a ticking window; when it locks into the ceiling stack it detonates—and heat wilds turn a clean clear into a panic cascade.

**Menu pitch:** *Recolor a rising fuse. Lock it into the stack. Detonate — or overheat trying.*

---

## 1. Candidate comparison (why HEAT LOCK)

| Criterion (weight) | A HEAT LOCK | B WAVE BOMB | C IGNITE HOLD |
|--------------------|-------------|-------------|---------------|
| Fantasy clarity (20%) | **5** | 4 | 3 |
| Week-1 cost (20%) | **5** | 2 | 3 |
| Emotion vs Tetris (25%) | **5** | 4 | 3 |
| Boring-watch risk (15%) | 3 | 2 | **4** |
| Skill ceiling (10%) | 4 | **5** | **5** |
| Shareability (10%) | **5** | **5** | 3 |
| **Weighted** | **4.55** | 3.35 | 3.40 |

- **WAVE BOMB** = free workshop then launch whole payload. Great sequel mode; long dead-time + new sim = wrong week-1.  
- **IGNITE HOLD** = hold gate to release match window. Continuous skill; fights Tetris on mastery axis; weaker story.  
- **HEAT LOCK** productizes the code’s accidental soul (stuck-only match + upward pack) and owns delayed payoff Tetris cannot copy.

---

## 2. Core loop (12–18s early dopamine cycle)

One loop = spawn → load → commit → rise → lock → detonate → recover.

| Phase | Duration (early → mid) | Player | Feel | Must juice |
|-------|------------------------|--------|------|------------|
| Spawn | 0–0.3s | — | Soft arrival | Thunk |
| **Load (fuse)** | **4.0s → 2.4s** | Recolor · Heat | Agency + greed | Timer bar, recolor tick, heat ignite |
| **Commit** | Instant | Timer empty or **SEND** | Irreversible | Commit thump |
| **Rise** | **3.5s → 2.0s** | No input | Anticipation / dread | Near-match sparks |
| **Lock** | 0.2–0.35s | — | Heart spike | Flash + bass |
| **Detonate** | 0.8–2.5s | Watch | Authored boom | Pop chain, cascade trail |
| Aftermath | 0–2s | Next fuse (overlap OK) | Residue threat | Danger haze |

### Hard rules (non-negotiable)

1. Matches resolve **only on LOCK** (stuck after pack). No mid-rise clears.  
2. Fuse window = **y 0–3 only** (4 rows). Auto = y ≥ 4.  
3. **No drag.** Skill = recolor + when to heat + when to SEND.  
4. Death = packed mass invades fuse (**y ≤ 3**) **or** wave cannot spawn into fuse.  
5. Heat is a **charge** (start 2, max 3), not 8-tap spam.  
6. SEND is commit shortcut (button + **Space** on PC), not a third skill axis.

---

## 3. Why this beats Tetris emotionally

| Axis | Tetris | HEAT LOCK |
|------|--------|-----------|
| Control | Continuous mastery | Brief mastery → forced spectatorship |
| Reward timing | Instant line | **Delayed boom you authored** |
| Near-death | Tight micro-skill | Last wild charge → hope spike |
| Failure story | “I misdropped” | “I sent a bad fuse” / “I didn’t heat” |
| Spectacle | Austere | Cascades + heat chains = fireworks |
| One more try | Perfectible skill | Skill + risk token + unfinished detonation |

**Emotional peaks to hit:** commit → lock flash → cascade → danger blink → death with unused heat (regret → retry).

Tetris makes you want to *play better*.  
HEAT LOCK makes you want to *see the next explosion you caused*.

---

## 4. Systems matrix

### KEEP

- Upward rise, pack to top  
- Match 3+ H/V only when stuck  
- 4 colors + wild red  
- Cascades + combo  
- Danger line readability  
- Phaser 540×1080 FIT + React HUD shell  

### CUT (prototype)

- Drag reposition  
- 8-tap heat  
- Prep 8 rows  
- Unwired shop / fake upgrades / skins path  
- Shape / figure PRD systems  
- Mid-rise matching “for responsiveness”  
- Rainbow flyer sim (week-1)  
- Blizzard / random events  
- Login/Stripe/daily as required path  
- Lying continuous-control chrome without fuse timer  

### TRANSFORM

| From | To |
|------|-----|
| Tap + drag + 8-tap | 2 verbs: recolor, heat |
| Prep 0–7 | Fuse 0–3 + timer bar |
| Free heat spam | Charges: +1 per quality clear (see economy) |
| Rainbow flyers only | Cascade embers → heat UI |
| Always free rise | Timer + optional SEND → rise packet |
| GO = all y=0 blocked | Fuse invasion y≤3 |
| Dead `scene-changed` restart | `scene.restart()` + play gate |

---

## 5. Heat economy

| Event | Δ Heat |
|-------|--------|
| Session start | **+2** (cap 3) |
| Clear size ≥4 in one detonation step | **+1** |
| Cascade depth ≥2 in one lock | **+1** (max one grant per lock with ≥4 rule) |
| Spend on Heat verb | **−1** |
| Cap | **3** |
| Pity | After 2 zero-clear locks: bias next wave toward 1 easy 3-set; **no free heat** |

Target spend rate early: **0.4–0.9 / min**.  
If deaths with unused heat **>40%** → heat UX failed (readability / GO callout).

**Heat input (pick one on Day 4):** prefer **HUD Heat button** for PC clarity; double-tap optional secondary.

---

## 6. Difficulty (first 5 minutes)

| Window | Fuse timer | Rise | Wave size | Heat notes |
|--------|------------|------|-----------|------------|
| 0–60s | 4.5→4.0s | 3.5s | 3–4 cubes | Teach spend; script first detonation |
| 1–2 min | 3.6s | 3.0s | 4–5 | Earn on quality clears |
| 2–3 min | 3.2s | 2.6s | 5–6 | Overlap fuses; greed punished |
| 3–5 min | 2.8→2.2s | 2.2→2.0s | Full width bias | Starve without cascades |

---

## 7. First 60 seconds (scripted beat)

| t | Beat | Player learns |
|---|------|---------------|
| 0–3s | Near-match biased spawn; timer bar visible | Fuse window exists |
| 3–8s | Soft prompt: TAP TO RECOLOR | Recolor |
| 8–12s | Timer/SEND; rise with **strong near-match spark** | “I set it up” |
| 12–16s | First **LOCK + detonate** (guaranteed ≥3) | Payoff |
| 16–25s | 2 heat embers appear; prompt HEAT once | Charges |
| 25–45s | Normal play; residue may appear | Danger |
| 45–60s | Soft text: SEND early if ready | Commit skill |

**Rule:** first detonation **≤25s** for ≥90% sessions (scripted bias OK). No multi-page modal tutorial.

---

## 8. Juice budget (must-have)

### SFX (8)

Spawn · Recolor tick · Heat ignite · Commit · Lock · Detonate · Cascade step · Danger/GO  

### VFX (6)

Fuse timer bar · Near-match spark · Lock flash · Cube pop · Cascade trail · Danger haze  

### UI

Floating score · 3 ember heat icons · OVERHEAT banner only at cascade≥3 · GO shows **heat left unused**

---

## 9. Metrics

| Metric | Prototype target |
|--------|------------------|
| Retry <10s after GO | ≥65% |
| Median session | ≥4.5 min |
| Detonations/min early | 2.0–3.5 |
| Heat spend/min | 0.4–0.9 |
| Time-to-first-detonate | ≤25s |
| Sessions with cascade≥2 | ≥70% |
| Deaths with unused heat | Track; if >40% heat UX failed |
| Softlocks in 5×5min dogfood | **0** |
| Cold load interactive | <5s |

### Qualitative gate (5 playtests)

Unprompted language clusters around **“I set that up and it exploded”** — not “Tetris upside down.”

**Fail language (if majority):** “I didn’t know what I did” · “I was just watching” (bored) · “Restart is broken.”

---

## 10. Acceptance — emotional prototype

1. ≤2 skill verbs; no drag; no mid-rise match  
2. ≥90% players see influenced detonation within 25s  
3. ≥3/5 playtesters describe waiting for lock/explosion  
4. ≥65% retry within 10s  
5. ≥70% sessions cascade≥2 with juice  
6. ≥50% late deaths involve heat regret or recent heat spend  
7. Detonations/min in band for first 3 minutes  
8. Slogan does not feel like a lie  
9. Cold load <5s, 5-minute curve, no softlock  
10. Side-by-side 2-min gut check: majority prefer Heat Rush **shareability** clip even if Tetris still feels “more skillful”

If (3) or (4) fail: **do not add features** — shorten rise, amplify lock juice, strengthen foreshadowing.

---

## 11. 7-day build (implementation order)

**Principle:** Players cannot love a hook they cannot **restart** or **trust**.

| Day | Focus | Deliverable | Exit criteria |
|-----|--------|-------------|---------------|
| **1** | Trust: lifecycle | Sim only if `playing`; Boot no ghost; **Restart = `scene.restart()`**; menu idle = no motion | menu→play→die→restart 10/10 |
| **2** | Trust: match honesty | Consecutive-x; resolve after lock+gravity; **defer rainbow**; single score; `isResolving` | no false/stuck lines; score monotonic |
| **3** | Hook: fuse | Fuse y0–3; timer+SEND; strip drag; strip 8-tap | only fuse edits; commit freezes |
| **4** | Hook: lock+heat | Lock-only match; cascade; heat wallet; fuse-invasion death | full Load→Lock→Detonate playable |
| **5** | Emotion: juice | 8 SFX + 6 VFX + floating score + OVERHEAT | detonation readable even muted |
| **6** | Curve + teach + metrics | First-60s script; 5-min curve; pity; event ring; hide shop | p90 first detonate ≤25s dogfood |
| **7** | Playtest freeze | 5 external tests vs §10; cut non-hook; tag `prototype-heat-lock-v1` | pass/fail notes; only P0 after freeze |

**Non-goals week 1:** shop, accounts, dailies, shapes, Stripe, flyers, blizzard, full pure-core extract (thin match/fuse extract OK if unblocks tests).

### Critical files

| Concern | File |
|---------|------|
| God sim / loop | `src/game/scenes/MainGame.ts` |
| Constants | `src/game/constants.ts` |
| Boot | `src/game/scenes/Boot.ts` |
| Restart / GO | `src/components/GameUI.tsx` |
| Play gate | `src/App.tsx`, `MainMenu.tsx` |
| Score/state | `src/store/useGameStore.ts` |
| Spec authority | **This doc + ARCHITECTURE_RECON** win over `prd.txt` |

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Helpless watch boring | Rise ≤3.5s early; near-match VFX; SEND; never silent rise |
| Heat win-button or useless | Cap 3; earn from quality clears; track unused-heat deaths |
| RNG bricks | Soft pity + scripted first detonation |
| God-object creep | Prefer minimal patches; extract fuse/match only if blocked |
| Looks like broken Tetris | Enforce delayed lock identity in review checklist |
| Trust regressions | Days 1–2 gates before any hook marketing language |

---

*Build the lock boom first. Everything else is costume.*
