# 🗺️ HolyDots / Heat Rush 2.0 — Карта Логики Приложения

> **Тип:** Match-3 аркада (Tetris-inverted) с зонами подготовки и автоматического матчинга
> **Стек:** React 19 + Phaser 3 + TypeScript + Zustand + TailwindCSS
> **Backend (опционально):** Supabase + Stripe

---

## 📁 Структура Файлов

### 🎯 Корневые конфиги
```
package.json              # Зависимости, npm-скрипты
vite.config.ts            # Конфиг Vite + React + SVGR
tsconfig.json             # Базовый TypeScript
tsconfig.app.json         # TypeScript для src/
tsconfig.node.json        # TypeScript для vite.config
tailwind.config.js        # TailwindCSS
postcss.config.js         # PostCSS для Tailwind
index.html                # Entry HTML
.env.example              # Шаблон env-переменных Supabase
launch.bat                # 🟢 Запуск dev-сервера
build.bat                 # 🏗️ Сборка production
```

### 🎮 src/ — Игровая Логика

```
src/
├── main.tsx              # Entry React (createRoot)
├── App.tsx               # Root: инициализация auth + routing
├── index.css             # Tailwind + глобальные стили
├── vite-env.d.ts         # Vite типы
│
├── lib/
│   └── supabase.ts       # 🗄️ Supabase client (fallback на placeholder)
│
├── db/
│   └── supabase.ts       # 🗄️ Backup Supabase client
│
├── store/
│   ├── useGameStore.ts   # 🎯 Zustand: score, wave, combo, gameState
│   └── useUserStore.ts   # 👤 Zustand: user, upgrades, currency
│
├── components/           # ⚛️ React UI (overlay над Phaser)
│   ├── PhaserGame.tsx    # 🎮 Инициализация Phaser canvas
│   ├── GameUI.tsx        # 📊 HUD: score, wave, combo + Game Over screen
│   ├── MainMenu.tsx      # 🏠 Главное меню
│   ├── Shop.tsx          # 🛒 Магазин: upgrades, skins, кристаллы
│   ├── Leaderboard.tsx   # 🏆 Таблица лидеров
│   ├── Settings.tsx      # ⚙️ Настройки + аккаунт
│   └── Login.tsx         # 🔐 Логин/Регистрация
│
└── game/                 # 🎮 Phaser Engine
    ├── main.ts           # 🚀 StartGame() — конфиг Phaser
    ├── constants.ts      # 📐 Все константы (размеры, скорости, цвета)
    ├── EventBus.ts       # 📢 Мост между React ↔ Phaser
    ├── utils.ts          # 🔧 Утилита: startScene
    └── scenes/
        ├── Boot.ts       # 🏁 Загрузка ресурсов
        └── MainGame.ts   # 🎮 ГЛАВНАЯ СЦЕНА (1137 строк)
```

### 🗄️ supabase/ — Backend (опционально)
```
supabase/
├── migrations/
│   └── 00001_001_init.sql      # Таблицы: profiles, leaderboards, orders
└── functions/
    ├── create_stripe_checkout/  # 💳 Stripe checkout (placeholder)
    └── verify_stripe_payment/   # ✅ Верификация платежа
```

---

## 🧬 Архитектура Потоков Данных

```
┌─────────────────────────────────────────────────────┐
│                   index.html                        │
│                     ↓                               │
│              main.tsx (React 19)                    │
│                     ↓                               │
│                App.tsx                              │
│         ┌───────────┼───────────┐                   │
│         ↓           ↓           ↓                   │
│   PhaserGame   GameUI    {Menu, Shop, Settings,...} │
│   (Canvas)     (HUD)     (по gameState)             │
│         ↕           ↕                                │
│       EventBus ←→ Zustand stores                    │
│         ↕                                            │
│      Supabase (опционально)                          │
└─────────────────────────────────────────────────────┘
```

### 🔄 Цикл Игры (Phaser)

```
update(time, delta)
   │
   ├── handleCubeSpawning()      # Спавн новых кубов внизу (y=0)
   ├── handleCubeMovement()      # Движение вверх (600ms tick)
   │     │
   │     └── returns newlyStuck? │
   │                            ↓
   ├── handleIceSpawning()      # (No-op сейчас)
   ├── handleIceMovement()       # Движение радужных кубов
   ├── handleCollisions()        # Поиск совпадений для радужных
   │
   └── detectMatchesAndResolve() # ТОЛЬКО если newlyStuck!
         │
         └── resolveMatchesAndApplyGravity()
               │
               ├── spawnRainbowReward(6+ matches)  # 🎁 Награда
               ├── applyGravityAfterMatch()        # Падение
               └── resolveLoop() → cascade         # Рекурсия
```

---

## 🎯 Игровая Механика

### 📐 Сетка 12×24 (портретная)
```
y=24  ┌──────────────────┐  ← Верхняя граница
y=23  │  ⬛⬛⬛⬛⬛⬛⬛⬛⬛  │  ← Последний ряд стека (стоп)
y=22  │  ⬛⬛⬛⬛⬛⬛⬛⬛⬛  │  ← Зона автоматического матча
...   │  ...               │
y=8   │  ⬛⬛⬛⬛⬛⬛⬛⬛⬛  │  ← ───── Линия-разделитель ─────
y=7   │  ⬛⬛⬛⬛⬛⬛⬛⬛⬛  │  ← Зона подготовки
...   │  ...               │
y=0   │  ⬛⬛⬛⬛⬛⬛⬛⬛⬛  │  ← Зона спавна (spawn)
      └──────────────────┘
      x=0                x=11
```

### 🎨 Цвета и состояния
| Цвет | HEX | Роль |
|------|-----|------|
| 🟡 Yellow | `#FFD700 → #FFA500` | Базовый |
| 🔵 Blue | `#00CED1 → #1E90FF` | Базовый |
| 🟢 Green | `#32CD32 → #50C878` | Базовый |
| ⚪ White | `#FFFFFF → #E0E0E0` | Базовый |
| 🔴 Red | `#FF4500 → #DC143C` | Wildcard (джокер) |
| 🌈 Rainbow | мульти-градиент | Награда за 6+ match |

### 🕹️ Управление

| Действие | Где | Эффект |
|----------|-----|--------|
| **Tap (single)** | y=0-7 | Цикл цвета: Y→B→G→W→Y |
| **Tap (8 раз за 2 сек)** | y=0-7 | Превращение в 🔴 (wildcard) |
| **Drag** | y=0-7 | Перемещение по x и y |
| **Tap/Swipe** | y=8+ | ❌ Игнорируется |

### 🏆 Система Очков
```
3 куба   =  30 очков
4 куба   =  60 очков
5 кубов  = 100 очков
6 кубов  = 150 очков  ← 🎁 1 Rainbow
7 кубов  = 200 очков  ← 🎁 2 Rainbow
8+       = 200 + 50*n  ← 🎁 4 Rainbow
🔴 бонус = +20 за куб
```

### 📊 Combo Система
- 1-й match: ×1.0
- 2-й match: ×1.5
- 3-й match: ×2.0
- 4+ match: ×2.5
- **Таймаут:** 3 секунды без match → reset на ×1.0

### 🌊 Волны
```
Каждые 500 очков = +1 волна
Скорость полёта = BASE + (wave × 0.1)
Интервал спавна = max(500ms, 1800 - wave × 100)
Каждая 10-я волна = ❄️ Blizzard (10 сек, синий фильтр)
```

---

## 🎁 Rainbow Cubes — Система Наград

### Триггер
```
Match 6+ кубов → spawnRainbowReward(size)
  size 6: 1 радужный
  size 7: 2 радужных
  size 8+: 4 радужных
```

### Поведение Радужного Куба
```
Спавн:    появляется слева/справа на y=18-22
Движение: летит горизонтально (1.2× скорости)
Поиск:    сканирует ряд — ищет 2+ куба одного цвета
Найдено:  встраивается в ряд как wildcard (isRainbowWildcard)
Не найдено: улетает за экран → исчезает
```

### Визуал
- Градиент: `#FF00FF → #FFFF00 → #00FFFF`
- Золотая рамка `#FFD700` 3px
- Белая искра в углу
- Пульсация при полёте (sin wave alpha)

---

## 🗃️ Stores (Zustand)

### useGameStore
```typescript
{
  score: number;          // Текущий счёт
  wave: number;           // Волна (1+)
  combo: number;          // Множитель (1.0, 1.5, 2.0, 2.5)
  gameState: 'menu' | 'playing' | 'paused' | 'gameover' 
           | 'shop' | 'leaderboard' | 'settings' | 'login'
  setGameState(s)
  addScore(points)        // points * combo
  setWave(w)
  setCombo(c)
  resetGame()
}
```

### useUserStore
```typescript
{
  id, username, role
  heatPoints: number      // Очки за игру (мета-валюта)
  crystals: number        // Премиум-валюта
  bestWave, bestScore, totalGames
  upgrades: {             // 5 типов апгрейдов
    startTemp, heatSpeed, coolingResist, fuelCap, blastRadius
  }
  skins: string[]         // ['default', 'magma', 'ice', 'neon']
  currentSkin: string
  setUser, addHeatPoints, addCrystals, updateBest
}
```

---

## 🔄 React ↔ Phaser Мост (EventBus)

```typescript
// Phaser → React
EventBus.emit('game-over')    // → GameUI переходит на 'gameover'
EventBus.emit('scene-changed', { key: 'MainGame' })

// React → Phaser
EventBus.emit('game-continue')  // → MainGame.handleContinue()
```

---

## 🎬 Жизненный Цикл Игры

```
1. App init → supabase.auth.getSession()
   ├── Есть session: загрузка профиля → setUser()
   └── Нет session: setUser({ id: null })

2. MainMenu → "PLAY" → setGameState('playing')
   → EventBus.emit('scene-changed', { key: 'MainGame' })

3. MainGame.create() — инициализация Phaser сцены
   - Сброс stores
   - Рисует grid, blizzard overlay
   - Спавн первого куба

4. MainGame.update() — игровой цикл
   - 60 FPS tick
   - Логика движения, матчинга, наград

5. Game Over → triggerGameOver()
   - 1 сек задержка (slowmo)
   - EventBus.emit('game-over')
   - React GameUI → 'gameover' state
   - Показ Continue/Restart/Menu

6. Continue → EventBus.emit('game-continue')
   - Очистка y=0 (Y_SPAWN)
   - scene.resume()
```

---

## 📐 Ключевые Файлы (быстрый поиск)

| Что найти | Где смотреть |
|-----------|--------------|
| Изменить размер сетки | `src/game/constants.ts` |
| Изменить скорость движения | `CUBE_MOVE_INTERVAL` в constants.ts |
| Изменить логику match | `MainGame.ts:detectMatchesAndResolve()` |
| Изменить физику кубов | `MainGame.ts:handleCubeMovement()` |
| Изменить условие Game Over | `MainGame.ts:checkGameOver()` |
| Изменить спавн Rainbow | `MainGame.ts:spawnRainbowReward()` |
| Изменить магазин | `src/components/Shop.tsx` |
| Изменить HUD | `src/components/GameUI.tsx` |
| Изменить стартовое меню | `src/components/MainMenu.tsx` |
| Изменить auth flow | `src/App.tsx` + `src/lib/supabase.ts` |
| Изменить SQL схему | `supabase/migrations/00001_001_init.sql` |

---

## 🚀 Запуск Проекта

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск dev-сервера
npm run dev
# → http://localhost:5173

# 3. Сборка production
npm run build
# → dist/

# Или через .bat файлы:
launch.bat   # → npm install + npm run dev
build.bat    # → npm install + npm run build
```

---

## 📊 Статистика Проекта

| Метрика | Значение |
|---------|----------|
| Строк кода (MainGame.ts) | 1137 |
| Компонентов React | 7 |
| Phaser сцен | 2 (Boot, MainGame) |
| Zustand stores | 2 |
| Поддерживаемых цветов | 5 (4 base + 1 red) |
| Типов match | 2 (horizontal, vertical) |
| Поддержка keyboard | ❌ (только touch/mouse) |
| Мобильная ориентация | Portrait only |

---
