# Design Delta — STREAK SHIELD & Emotional Amplifiers

**Date:** 2026-07-19  
**Status:** Spec lock for next implement pass (not implemented this QA)  
**Authority parents:** `GAME_HOOK_HEAT_LOCK.md` · `QA_HARD_HEAT_LOCK.md`  
**Constraint:** No new skill verbs · no mid-rise match · no drag · SEND remains commit-only  

---

## Problem statement

v5 ships HEAT LOCK + HOT skill path + ARMED STREAK score bonus.  
Joint research (design + logic + visual agents) finds:

1. **First boom works** — authorship language is possible.
2. **Second heartbeat is missing** — streak is `+15…90` garnish, not greed.
3. **P0 feel poison** — authored boom → residue fuse invasion GO feels *stolen*.
4. **Claim “better than Tetris emotion” is blocked** until playtest language gates + stake rewrite.

Realized hook strength: **64/100**. Ceiling with deltas below: **~84/100**.

---

## Rank 1 — STREAK SHIELD ★ ship first

### Player fantasy
“I’m on a run — the board can’t silently steal this from me once.”

### Mechanical delta

| Event | Effect |
|-------|--------|
| Armed detonation | `armedStreak++` (keep existing) |
| `armedStreak` reaches **3** and shield off | Grant **FUSE SHIELD** (1 charge, max 1); float `SHIELD ONLINE` |
| Cold lock / MISFIRE / scrape | Break streak; if shield: also **SHIELD LOST** float |
| Would GO on fuse invasion | If shield: consume → absorb invading fuse-band stuck cubes (or pack them out of fuse) → float `SHIELD HOLD` / `STREAK SAVED` → continue session |
| Score bonus | Keep optional small garnish; **stake is the product**, not points |

### Emotional peak
Boom → stack drops → red haze → **shield burns** → player gasps and loads hotter.

### Risks / kill criteria
- Feels like free Continue → if ≥40% of deaths are “shield then aimless scrape,” kill shield → heat-bank-only fallback.
- Median session balloons without more ARMED intent language → kill.

### Acceptance (measurable)
| Gate | Pass |
|------|------|
| Sessions hitting streak ≥3 that activate shield | ≥50% |
| “Unfair after authored boom” quotes | drop ≥50% vs baseline / ≤1 of 5 |
| Unprompted “saved by streak / shield” | ≥2/5 |
| Retry &lt;10s | still ≥65% |

### Cost
**M** — flag + GO intercept + 2 floats + HUD pip. Touch: `MainGame.ts`, `constants.ts`, `useGameStore.ts`, `GameUI.tsx`.

---

## Rank 2 — CRUSH WINDOW

### Player fantasy
“If I die after a boom, I die **failing the clutch**, not from a silent stack teleport.”

### Mechanical delta
After resolve settles, if next state is fuse invasion:

| Condition | Behavior |
|-----------|----------|
| heat ≥ 1 or shield | Open **1.2–1.6s CRUSH WINDOW**: HEAT (and optional single recolor on invaders) allowed; success → `CLUTCH HOLD`; fail → GO with authored receipt |
| heat = 0 and no shield | **0.35s telegraph** `STACK WILL CRUSH` then GO |

### Kill criteria
Heat banked only for crush (spend/min &lt;0.3) **or** language becomes “extra life” → telegraph-only.

### Acceptance
Unfair-after-clear ≤1/5; crush wins ≤25% of all GO; 0 softlocks.

### Cost
**M** — higher edge-case risk; ship **after or with** Rank 1.

---

## Rank 3 — LOCK APPROACH CINEMATIC

### Player fantasy
“I’m watching **my** bomb approach the face.”

### Mechanical delta (ARMED commits only)
- Last **4** rise steps: strobe match cells, slight camera hold (1.02–1.04), heartbeat SFX ramp.
- Hard cap ARMED rise feel: early **≤2.2s**, mid **≤1.8s** (tighten constants; do not lengthen).
- Cold packets keep multi-skip.

### Kill criteria
≥2/5 “just watching / boring” or unexplained MISFIRE after stronger ghost → kill zoom, keep tempo+strobe.

### Cost
**S**

---

## Rank 4 — CLUTCH THEATER

### Player fantasy
“One ember left — I can still force the boom.”

### Mechanical delta
When `danger ≥ 2` and heat &gt; 0 and not ARMED and `heatCanArm`:
1. Target cube 2× pulse + red ring  
2. HUD: **`CLUTCH · SAVE`**  
3. Once/session optional +0.6s fuse breath  
4. On GO with heat left: 1.0s ghost rewrite of the cube they didn’t heat  

### Kill criteria
Unused-heat deaths still **&gt;40%** after ship → UX failed (input/readability before more text).

### Cost
**S–M** (systems mostly exist)

---

## Rank 5 — POST-BOOM ESCALATION BEAT

### Player fantasy
“First boom was the tutorial. Now I chain for shield.”

### Mechanical delta (25–50s second act)
1. After first ARMED detonation: next 2 waves bias HOT-not-free-ARMED  
2. Float `STREAK STARTS NOW` on second ARMED  
3. At streak 2→3: chip `SHIELD ONLINE` (ties Rank 1)  
4. Soft residue so shield/crush can appear before minute 2  

### Kill criteria
≥3/5 “guided / fake” after 60s → strip scripts; keep HOT guarantee only.

### Cost
**S**

---

## Recommended week-1 ship slice

| Must | Optional if unfairness remains | Free ride |
|------|-------------------------------|-----------|
| Rank 1 STREAK SHIELD | Rank 2 CRUSH WINDOW | Rank 5 if 1 ships |
| Rank 3 LOCK APPROACH | | |
| Rank 4 CLUTCH THEATER | | |

Also fix **pause N1/N1b** and **letterbox HUD** before external clip share (QA P0/P1 engineering).

---

## Implementation sketch

```
onArmedDetonation:
  streak++
  if streak == 3 and !shield: shield = true; float SHIELD ONLINE

onColdOrMisfireOrScrape:
  if streak > 0: float STREAK BROKEN
  streak = 0
  if shield: shield = false; float SHIELD LOST

onWouldGameOver(fuseInvasion):
  if shield:
    shield = false
    resolveInvasionAbsorb()
    float SHIELD HOLD
    continue loop
  else if heat >= 1 and crushWindowEnabled:
    enterCrushWindow(1.4s)
  else:
    telegraphCrush(0.35s); GO
```

---

## Explicit rejects (do not open)

WAVE BOMB · mid-rise match · drag · third skill verb · score-only streak buffs · free heat on pity · longer rise for drama · rainbow/shop/shapes costume.

---

## Marketing ban

Do **not** claim better-than-Tetris on emotion until dogfood N=5:

| Gate | Pass |
|------|------|
| First detonate ≤25s | ≥90% |
| Authorship language | ≥3/5 |
| Retry &lt;10s | ≥65% |
| Unfair after boom | ≤1/5 |
| Bored watch primary | ≤1/5 |
| Mentions streak/shield/clutch | ≥3/5 combined |
| Softlocks | 0 |

---

## One-line product truth after ship

> **Load it. Lock it. Detonate. Chain it — or lose the shield.**
