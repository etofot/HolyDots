# 🐛 Bug Report — Heat Rush 2.0

**Дата:** 2026-06-07
**Аудитор:** Code Review Pass
**Версия:** 0.0.1 (Pre-release)

---

## 🔴 Критические Баги (блокируют релиз)

### BUG-001: Race Condition — Движение + Match одновременно
**Файл:** `src/game/scenes/MainGame.ts:1010-1012`
**Серьёзность:** 🔴 Critical

```typescript
this.time.delayedCall(500, () => {
  // ... remove matched cubes ...
  this.applyGravityAfterMatch();  // tween 150ms
  
  this.time.delayedCall(300, () => {  // ❌ 300 < 150
    onComplete();  // вызывает resolveLoop → detectMatches
  });
});
```

**Проблема:** После матча gravity tween (150ms) ещё не завершился, а через 300ms уже вызывается новый поиск матчей. Кубики могут быть обнаружены в ПРОЦЕССЕ падения, что приводит к:
- Ложным матчам (кубы в воздухе)
- Потере кубов (match во время tween)
- Невозможности каскада

**Фикс:** Задержка должна быть минимум 250-300ms после полного завершения gravity tween.

---

### BUG-002: Spawn столкновение не учитывает ВСЕ кубы
**Файл:** `src/game/scenes/MainGame.ts:149, 1101-1111`
**Серьёзность:** 🔴 Critical

```typescript
private spawnCube(lx: number) {
  const isBlocked = this.cubes.some(c => c.x === lx && c.y === Y_SPAWN && c.stuck);
  // ...
}
```

**Проблема:** `Y_SPAWN` = 0 — это нижняя строка. Но `checkGameOver()`:
```typescript
if(this.cubes.some(c => c.x === x && c.y === Y_SPAWN && c.stuck)) {
  blockedCount++;
}
```

**Для тетриса-наоборот** (стек сверху) Game Over должен срабатывать, когда **весь столбец заполнен** от y=0 до y=23, а не только когда y=0 заблокирован.

**Сценарий:** Столбец может быть полным с y=8 до y=23, но y=0 свободен → game продолжается, но spawn работает нормально. Когда y=0 наконец-то заполнится, game over. Логика в целом рабочая, но визуально непонятно — игрок не понимает почему game over.

**Фикс:** Добавить визуальное предупреждение или улучшить game over логику (когда любой столбец заполнен до y=8+).

---

### BUG-003: `findRowMatchCandidates` считает wildcard'ы как 'red'
**Файл:** `src/game/scenes/MainGame.ts:625-658`
**Серьёзность:** 🔴 Critical

```typescript
const cube = this.cubes.find(c => c.x === x && c.y === y && c.stuck && !c.matched);
if (cube) {
  candidates.push({x, color: cube.color});  // ❌ берёт color
}
```

**Проблема:** Rainbow wildcard cube имеет `color: 'red'` и `isRainbowWildcard: true`. В match detection он считается как 'red'. Это OK, но rainbow wildcard НЕ должен учитываться в `findRowMatchCandidates` если игрок тапнул по нему и `isRainbowWildcard` стал false. Логика работает, но `updateRainbowGridCubeVisuals` вызывается только ОДИН раз, и при изменении `isRainbowWildcard` на false, куб продолжает рисоваться радужным.

**Фикс:** Изменить `updateCubeVisuals` для проверки `isRainbowWildcard` динамически (уже сделано частично) и при `applyTap` вызывать `updateCubeVisuals`.

---

## 🟠 Серьёзные Баги (нарушают геймплей)

### BUG-004: Drag handler не работает корректно в Preparation Zone
**Файл:** `src/game/scenes/MainGame.ts:206-211`
**Серьёзность:** 🟠 Major

```typescript
this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
  const cube = this.cubes.find(c => c.sprite === gameObject);
  if (!cube || cube.y >= 8 || cube.stuck || cube.matched) return;
  
  const minY = this.getVY(7);   // Higher on screen
  const maxY = this.getVY(0);   // Lower on screen
  // ...
});
```

**Проблема:** После моих предыдущих изменений логика `unstuck` может сделать куб `stuck: false` пока его тащит. Это приводит к:
- `cube.stuck` false в `drag` handler, но `cube.y >= 8` true → ранний return
- Игрок не может перетащить куб обратно в зону подготовки если он только что перешёл в автоматическую зону

**Фикс:** Добавить проверку `gameObject` напрямую вместо `cube.y`.

---

### BUG-005: `setupDragEvents` использует устаревший `cube` объект
**Файл:** `src/game/scenes/MainGame.ts:190-243`
**Серьёзность:** 🟠 Major

**Проблема:** `dragend` использует `gameObject.getData('dragStartLy')` — но `gameObject.setData` срабатывает только если куб найден в `dragstart`. Если куб был удалён между dragstart и dragend (например, стал `matched`), `startLy` будет `undefined`.

**Фикс:** Использовать сохранённые значения с дефолтами и проверять на undefined.

---

### BUG-006: `getMovingGroups` O(n²) производительность
**Файл:** `src/game/scenes/MainGame.ts:387-418`
**Серьёзность:** 🟠 Major

```typescript
for (const cube of movingCubes) {  // O(n)
  if (visited.has(cube)) continue;
  const group = new Set<CubeObj>();
  const queue = [cube];
  // ...
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const other of movingCubes) {  // O(n) внутри
      // ...
    }
  }
}
```

**Проблема:** На сетке 288 клеток (12×24), при полном заполнении = O(n²) = ~83,000 операций **каждые 600ms**. На слабых устройствах — фризы.

**Фикс:** Использовать пространственный хэш или проверять только соседей (4-directional BFS).

---

### BUG-007: Rainbow cubes не очищают свою графику
**Файл:** `src/game/scenes/MainGame.ts:582-591`
**Серьёзность:** 🟠 Major

```typescript
if (fc.isRainbow) {
  const s = fc.sprite as Phaser.GameObjects.Graphics;
  s.clear();
  s.fillStyle(0xFFFFFF, pulse);
  // ... redraw
}
```

**Проблема:** `updateRainbowCubeVisuals` создаёт `gradient = this.add.graphics()` (строка 550) и НИКОГДА не уничтожает его. Утечка памяти! Каждый rainbow reward создаёт 1+ лишних graphics объектов.

**Фикс:** Удалить `const gradient = this.add.graphics();` — он не используется.

---

### BUG-008: `handleCubeMovement` возвращает `newlyStuck` после первого stuck, но не ловит cascading
**Файл:** `src/game/scenes/MainGame.ts:420-495`
**Серьёзность:** 🟠 Major

**Проблема:** Если 5 кубов становятся stuck в одном tick, `newlyStuck = true` устанавливается на первом. После movement завершается, match detection ищет match. Если match есть — ОК. Если НЕТ, **другие 4 куба** никогда не вызовут повторную проверку (т.к. `justBecameStuck` отбрасывается).

**Сценарий:** 5 кубов застряли в конфигурации без match → match не срабатывает → когда они станут 6 или 7 через несколько кадров, match может произойти. Но это случайно.

**Фикс:** Установить `newlyStuck = true` ВСЕГДА, если хотя бы один куб стал stuck. Match detection сам определит нужно ли что-то делать.

---

## 🟡 Средние Баги (влияют на UX)

### BUG-009: Tap counter не сбрасывается при пересечении зоны
**Файл:** `src/game/scenes/MainGame.ts:762, 390`
**Серьёзность:** 🟡 Medium

**Проблема:** PRD требует: "Tap counter resets when cube crosses into automatic zone (y≥9)". Текущий код в `applyTap`:
```typescript
if (cube.y >= 8 || cube.matched) return;
```

Tap просто игнорируется, но `tapCount` не сбрасывается. Если игрок тапнул 7 раз на y=7, потом куб перешёл в y=8, потом он вернулся в y=7 (теоретически), counter уже на 7.

**Фикс:** В `handleCubeMovement` сбрасывать `tapCount = 0` при переходе y с < 8 на >= 8.

---

### BUG-010: Y_ICE_MIN/MAX и spawnRainbowReward используют разные диапазоны
**Файл:** `src/game/scenes/MainGame.ts:525, 18-19 в constants.ts`
**Серьёзность:** 🟡 Medium

```typescript
// constants.ts
export const Y_ICE_MIN = 19;
export const Y_ICE_MAX = 23;

// MainGame.ts spawnRainbowReward
const y = Math.floor(Math.random() * 5) + 18;  // 18-22
```

**Проблема:** Rainbow cubes спавнятся на y=18-22, а `findRowMatchCandidates` ищет cubes на точном `y`. Если flying cube летит на y=22.4, `Math.round(22.4)` = 22 — ОК. Но диапазоны рассинхронизированы.

**Фикс:** Использовать `Y_ICE_MIN/MAX` в `spawnRainbowReward`.

---

### BUG-011: Combo не сбрасывается при Game Over
**Файл:** `src/store/useGameStore.ts`
**Серьёзность:** 🟡 Medium

**Проблема:** `combo: 2.5` сохраняется через `resetGame()`. После рестарта игры комбо = 2.5, но это должно быть 1.0.

**Фикс:** В `resetGame()` явно установить `combo: 1`.

---

### BUG-012: Shop покупка может сломать state
**Файл:** `src/components/Shop.tsx:885-911`
**Серьёзность:** 🟡 Medium

```typescript
const buyUpgrade = (key: keyof typeof upgrades) => {
  const cost = def.costs[level];
  if (heatPoints >= cost) {
    const newUpgrades = { ...upgrades, [key]: level + 1 };
    setUser({ 
      heatPoints: heatPoints - cost, 
      upgrades: newUpgrades 
    });
  }
};
```

**Проблема:** При быстром двойном клике (race condition), обе транзакции читают одинаковый `heatPoints`, обе проходят проверку, деньги тратятся дважды.

**Фикс:** Добавить debounce или `isProcessing` флаг.

---

### BUG-013: Supabase ошибка не отображается пользователю
**Файл:** `src/components/Login.tsx:587-590`
**Серьёзность:** 🟡 Medium

**Проблема:** `catch (err: any) { setError(err.message); }` — показывается только в Login. Но если Supabase недоступен во время игры, ошибки тихо логируются.

**Фикс:** Создать глобальный error handler / toast notifications.

---

## 🔵 Мелкие Баги (полировка)

### BUG-014: Нет favicon
**Файл:** `index.html:5`
**Серьёзность:** 🔵 Minor

```html
<link rel="icon" type="image/svg+xml" href="/favicon.png" />
```

Файл `favicon.png` отсутствует → 404 в консоли.

**Фикс:** Создать `public/favicon.png` или удалить строку.

---

### BUG-015: `Login.tsx` использует `miaoda.com` в email
**Файл:** `src/components/Login.tsx:540`
**Серьёзность:** 🔵 Minor

```typescript
const { data, error: err } = await supabase.auth.signUp({
  email: `${username}@miaoda.com`,  // ❌ hardcoded
  password,
});
```

**Проблема:** Используется чужой домен. Если Supabase настроен — работает, но это костыль.

**Фикс:** Использовать `${username}@local.app` или нормальную email регистрацию.

---

### BUG-016: `updateRainbowGridCubeVisuals` не вызывается при изменении `isRainbowWildcard`
**Файл:** `src/game/scenes/MainGame.ts:765-770`
**Серьёзность:** 🔵 Minor

**Проблема:** `applyTap` меняет `isRainbowWildcard` на false, но не обновляет visuals (вызывает только `updateCubeVisuals` — это OK, т.к. метод уже проверяет флаг). Но `getHexColor('red')` вернёт 0xFF4500 (красный) — ОК.

**Фикс:** Не требуется (уже работает), но для безопасности можно вызвать `updateRainbowGridCubeVisuals` явно.

---

### BUG-017: Pause Menu отсутствует
**Файл:** PRD §3.5
**Серьёзность:** 🔵 Minor

**Проблема:** PRD требует Pause Menu (Esc/Back button), но его нет. Игрок не может поставить игру на паузу.

**Фикс:** Добавить pause кнопку в HUD + реализовать `gameState === 'paused'`.

---

### BUG-018: Continue Mechanic не работает
**Файл:** `src/game/scenes/MainGame.ts:127-137`
**Серьёзность:** 🔵 Minor

**Проблема:** `handleContinue` чистит только y=0 (Y_SPAWN). По PRD должен очищать **топ 3 ряда** (y=22-24, не y=21-23).

**Фикс:** Изменить логику очистки на `y >= GRID_ROWS - 3`.

---

### BUG-019: Нет keyboard support
**Файл:** Все input handlers
**Серьёзность:** 🔵 Minor

**Проблема:** Игра работает только с touch/mouse. Нет поддержки клавиатуры для desktop.

**Фикс:** Добавить keyboard listener для Space (tap) и Arrow keys (move).

---

### BUG-020: Stripe functions — placeholder
**Файл:** `supabase/functions/`
**Серьёзность:** 🔵 Minor

**Проблема:** Edge функции возвращают заглушки. Реальные Stripe функции не реализованы (безопасное упрощение для оффлайн-режима).

**Фикс:** При необходимости — реализовать полную логику.

---

## 📊 Сводка

| Категория | Количество |
|-----------|------------|
| 🔴 Critical | 3 (все исправлены) |
| 🟠 Major | 5 (все исправлены) |
| 🟡 Medium | 5 (все исправлены) |
| 🔵 Minor | 7 (3 исправлены, 4 deferred) |
| **Всего** | **20** |

## ✅ Статус исправлений

| Bug | Статус | Файл |
|-----|--------|------|
| BUG-001 (Race condition) | ✅ Fixed | `MainGame.ts` (delay 300→400ms) |
| BUG-002 (Game Over UX) | ✅ Fixed | `MainGame.ts` (danger zones + improved check) |
| BUG-003 (Wildcard color) | ✅ Fixed | `MainGame.ts` (visuals updated) |
| BUG-004 (Drag zone) | ✅ Fixed | `MainGame.ts` (early return fix) |
| BUG-005 (Drag data) | ✅ Fixed | `MainGame.ts` (default values) |
| BUG-006 (Perf O(n²)) | ✅ Fixed | `MainGame.ts` (spatial hash map) |
| BUG-007 (Memory leak) | ✅ Fixed | `MainGame.ts` (gradient removed) |
| BUG-008 (Cascading) | ✅ Fixed | `MainGame.ts` (per-cube tracking) |
| BUG-009 (Tap reset) | ✅ Fixed | `MainGame.ts` (zone crossing) |
| BUG-010 (Y range) | ✅ Fixed | `MainGame.ts` (Y_ICE_MIN/MAX) |
| BUG-011 (Combo reset) | ✅ Fixed | `useGameStore.ts` |
| BUG-012 (Shop race) | ✅ Fixed | `Shop.tsx` (isProcessing flag) |
| BUG-013 (Error UX) | ✅ Fixed | `useUIStore.ts` + `ToastViewport.tsx` |
| BUG-014 (Favicon) | ✅ Fixed | `public/favicon.svg` |
| BUG-016 (Wildcard vis) | ✅ Fixed | `MainGame.ts` (defensive update) |
| BUG-015 (Miaoda email) | 🔵 Deferred | needs domain decision |
| BUG-017 (Pause) | 🔵 Deferred | needs UX design |
| BUG-018 (Continue) | ✅ Fixed | `MainGame.ts` (top-3 rows) |
| BUG-019 (Keyboard) | 🔵 Deferred | low priority |
| BUG-020 (Stripe) | 🔵 Deferred | needs Stripe API |

---

## 🎯 Приоритеты для следующего спринта

1. **BUG-001** (Race Condition) — критично, влияет на геймплей
2. **BUG-002** (Game Over UX) — критично, непонятно игроку
3. **BUG-006** (Производительность) — влияет на UX
4. **BUG-007** (Memory Leak) — долгосрочная проблема
5. **BUG-011** (Combo reset) — легко исправить, ломает баланс

---

## ✅ Что работает хорошо

- ✅ Зонирование (Preparation vs Automatic)
- ✅ Cascade matches (рекурсивный resolveLoop)
- ✅ Rainbow reward system
- ✅ Match detection по stuck-кубам (не во время движения)
- ✅ Граничные проверки y < GRID_ROWS
- ✅ Gravity после match
- ✅ Tap counter с временным окном (RED_TAP_WINDOW)
- ✅ Combo system с таймаутом
- ✅ Graceful offline fallback для Supabase
