# Technical Design Document (TDD) — v2

> Версія після перехресного ревʼю 6 профільних агентів. Ключові зміни від v1:
> - 4 пули InstancedMesh + `instanceColor` (замість 20 пулів)
> - Math-based picking (DDA), без `raycaster.intersectObject` на меші
> - Окремий модуль `tileResolver.js` як оркестратор re-tile
> - Save не персистить `tileType` (derived)
> - Two-phase event contract з явним пріоритетом
> - PointerEvents з day 1 (не stretch)
> - `canPlace(x,y,z)` validation hook
> - Центральний TweenManager замість per-tween RAF
> - iOS Safari 16.4+ АБО `es-module-shims` fallback
> - jsdelivr замість unpkg (uptime)

## 1. Технологічний стек

| Шар | Вибір | Чому |
|-----|-------|------|
| Рушій / рендер | **Three.js r160** через CDN (jsdelivr) з import map | WebGL2, стабільний CDN |
| Мова | **Vanilla JS (ES2022 modules)** | Без транспайлерів |
| Поліфіл | **`es-module-shims`** (~10KB) перед importmap | Фікс для iOS Safari 15-16.3 |
| Запуск | **`npx serve .`** (або Python http-server) | `file://` ламає ES modules у Chrome |
| Тести (unit) | **Vitest** + `happy-dom` | Швидкий, ES modules |
| Тести (E2E) | **Playwright** (Chromium + WebKit) | Browser E2E |
| CI | **GitHub Actions** — `npm test` + `playwright test` | АІ-агент мусить знати що «зелене» |
| Збереження | `localStorage` | Не треба бекенду |
| Хостинг | GitHub Pages | Безкоштовно |

**Відкинуто:** Unity, Godot, Babylon.js, React+R3F, TypeScript, bundlers. Причини у v1 TDD — не повторюю.

**Зміна проти v1:** `file://` більше не support — Vision success criteria оновлено на «запустити через `npx serve` або з GitHub Pages», замість «подвійний клік по index.html».

## 2. Високорівнева архітектура

```
┌───────────────────────────────────────────────────────────┐
│                        index.html                         │
│  <canvas tabindex="0">      UI overlay (DOM)              │
│  importmap (jsdelivr + es-module-shims)                   │
└────────────────────────┬──────────────────────────────────┘
                         │
           ┌─────────────▼──────────────┐
           │        src/main.js         │  (wiring + init order)
           └─────────────┬──────────────┘
                         │
     ┌───────────────────┼─────────────────────┐
     │                   │                     │
┌────▼─────┐        ┌────▼─────┐         ┌─────▼─────┐
│ InputMgr │        │ GameState│         │    UI     │
│(Pointer) │───────►│(Event    │         │ (DOM)     │
└──────────┘ intent │ Target)  │         └─────┬─────┘
                    └────┬─────┘               │
                         │ cellChanged         │
       ┌─────────────────┼─────────────────────┤
       │ (priority 1)    │ (priority 2)        │ (priority 3)
  ┌────▼─────────┐  ┌────▼──────────┐    ┌─────▼─────┐
  │tileResolver  │  │   Renderer    │    │ SaveState │
  │ (derives     │  │ (Three.js,    │    │ (localStg)│
  │  tileType)   │  │  4 pools)     │    └───────────┘
  └──────────────┘  └───────────────┘
       │
       └─► state.updateTile() → emits 'cellResolved'
```

**Контракт подій (фіксований пріоритет):**

1. `GameState` emit `cellChanged` (generic: added | removed | cleared) з delta
2. `tileResolver` слухає `cellChanged` **першим** (priority 1) — обчислює tileType для cell + 6 сусідів, викликає `state.updateTile(coord, newType)`, що emit'ить `cellResolved`
3. `Renderer` і `SaveState` слухають **тільки `cellResolved`** — не `cellChanged`. Це гарантує що вони бачать consistent tileType

**Реалізація пріоритету:** оскільки `EventTarget` не підтримує priority, вводимо кастомний bus:
```js
class GameState {
  #listeners = { cellChanged: [], cellResolved: [] };
  on(event, fn, priority = 10) {
    this.#listeners[event].push({ fn, priority });
    this.#listeners[event].sort((a,b) => a.priority - b.priority);
  }
  #emit(event, detail) { for (const { fn } of this.#listeners[event]) fn(detail); }
}
```

## 3. Модулі

### 3.1 `constants.js`
```js
export const GRID_SIZE = 30;
export const MAX_HEIGHT = 10;
export const MAX_CELLS = 2500;           // hard cap (UX + perf)
export const CELL_SIZE = 1.0;

export const COLORS = [
  { id: 1, hex: 0xF2EBD3, name: 'Warm White' },
  { id: 2, hex: 0xD97A5B, name: 'Terracotta' },
  { id: 3, hex: 0xA8BFA0, name: 'Sage' },
  { id: 4, hex: 0x8AB3C4, name: 'Sky' },
  { id: 5, hex: 0xE8B547, name: 'Mustard' },
  { id: 6, hex: 0xFF6B3D, name: 'Surprise',    unlockAfter: 10 },  // 7yo reward
];

export const TILE_TYPES = ['freestanding', 'wall', 'corner', 'roof'];

export const ANIM = {
  place: 250, remove: 150, hover: 100,
  paletteSelect: 150, cameraRotate: 200,
  holdConfirm: 1500,   // clear all
};

export const CLICK_THRESHOLD = { maxDistance: 8, maxDuration: 300 };  // drag vs click

export const STORAGE_KEY = 'townscaper-mvp-v1';
export const SAVE_DEBOUNCE_MS = 2000;

// Camera: true dimetric 30°, не classic isometric. Документовано.
export const CAMERA = { pitch: Math.PI * 30 / 180, yaw: Math.PI / 4, zoom: 1.0 };
```

### 3.2 `gameState.js`
**Відповідальність:** єдине джерело правди. Знає про Cell структуру, нічого про Three.js/DOM.

**API:**
```js
class GameState {
  getCell(x, y, z): Cell | null
  canPlace(x, y, z): { ok: boolean, reason?: string }    // NEW
  setCell(x, y, z, { colorId }): Cell                    // emits 'cellChanged' { op:'add', cell }
  removeCell(x, y, z): Cell | null                       // emits 'cellChanged' { op:'remove', cell }
  updateTile(x, y, z, tileType): void                    // emits 'cellResolved' { cell }  (called by tileResolver only)
  getNeighbors(x, y, z): { north, south, east, west, above, below }
  all(): Cell[]
  clear(): void                                          // emits 'cellChanged' { op:'clear' }
  toJSON(): { version, cells, camera, ui }
  fromJSON(data): void                                   // re-runs tileResolver across all cells
  on(event, fn, priority): void
  off(event, fn): void
}
```

**`canPlace` правила (з GDD §3.2):**
- Out of bounds → `{ ok:false, reason:'out-of-bounds' }`
- Occupied → `{ ok:false, reason:'occupied' }`
- Above MAX_HEIGHT → `{ ok:false, reason:'too-high' }`
- At MAX_CELLS → `{ ok:false, reason:'too-many' }`
- y > 0 AND no support (no cell below AND no horizontal neighbor same-level) → `{ ok:false, reason:'no-support' }`
- Інакше → `{ ok:true }`

**Cells immutable:** `setCell` створює новий обʼєкт; `updateTile` також створює новий (spread + override tileType). Renderer тримає reference — як snapshot, не мутується.

### 3.3 `tileResolver.js` (NEW module)
**Відповідальність:** єдиний оркестратор де-рівнево-деривованого `tileType`. Слухає `cellChanged`, обчислює правильний тип для зачеплених клітинок, кличе `state.updateTile`.

```js
export class TileResolver {
  constructor(state) {
    this.state = state;
    state.on('cellChanged', this.#onChange.bind(this), /*priority*/ 1);
  }

  #onChange({ op, cell }) {
    const affected = op === 'clear' ? [] : this.#scope(cell);  // cell + 6 neighbors
    for (const c of affected) {
      const type = resolveTile(c, this.state.getNeighbors(c.x, c.y, c.z));
      if (c.tileType !== type) this.state.updateTile(c.x, c.y, c.z, type);
    }
  }

  #scope(cell) {
    const coords = [cell,
      {x:cell.x, y:cell.y, z:cell.z-1}, {x:cell.x, y:cell.y, z:cell.z+1},
      {x:cell.x-1, y:cell.y, z:cell.z}, {x:cell.x+1, y:cell.y, z:cell.z},
      {x:cell.x, y:cell.y-1, z:cell.z}, {x:cell.x, y:cell.y+1, z:cell.z}];
    return coords.map(c => this.state.getCell(c.x, c.y, c.z)).filter(Boolean);
  }

  resolveAll() {  // called after fromJSON
    for (const c of this.state.all()) {
      const type = resolveTile(c, this.state.getNeighbors(c.x, c.y, c.z));
      this.state.updateTile(c.x, c.y, c.z, type);
    }
  }
}
```

### 3.4 `renderer.js`

**Ключове рішення:** **4 `THREE.InstancedMesh` пули (по одному на tileType).** Колір зашитий у per-instance `instanceColor` (Float32 RGB).

**Переваги vs 20-пульного підходу:**
- 4 draw calls замість 20 (5× менше GL state)
- Зміна кольору = `setColorAt(i, color)` — без міграції між пулами
- Міграція між пулами лише при зміні **tileType** (рідко, не при color change)
- 5× менший cost raycasting (якщо взагалі використовуємо)

**API:**
```js
class Renderer {
  constructor(canvas, state)
  dispose()                     // teardown GL context, listeners
  setHover(coord | null)        // move outline mesh; color = current palette @ 60% alpha
  showInvalidHover(coord)       // red tint for canPlace=false
  rotateCamera(direction)       // Q/E, 200ms easeInOutCubic
  zoom(delta)                   // wheel
  render(dt)                    // RAF loop, drives TweenManager.tick()
}
```

Renderer слухає `cellResolved` (не `cellChanged`) через priority 2.

**Tween-адреса:** анімації key by cellKey (`"x_y_z"`), не by instanceId. При міграції між пулами — cancel on old pool, restart on new з current scale. Це критично — інакше freed instance slot отримує stale matrix write.

### 3.5 `input.js`

**Ввід:** Pointer Events з day 1 (`pointerdown`/`pointermove`/`pointerup`), уніфікує мишу + touch + trackpad. `setPointerCapture` для drag-tracking.

**Drag vs click detection:**
```js
function isClick(down, up) {
  const dx = up.clientX - down.clientX, dy = up.clientY - down.clientY;
  return Math.hypot(dx, dy) <= CLICK_THRESHOLD.maxDistance
      && (up.timeStamp - down.timeStamp) <= CLICK_THRESHOLD.maxDuration;
}
```

**Passive listeners застереження:**
- `wheel`, `touchmove` passive за замовчуванням — треба `{ passive: false }` для `preventDefault()`
- `contextmenu` — не passive, простий `e.preventDefault()` працює

**Focus management:**
- Canvas має `tabindex="0"`, авто-focus при `pointerdown`
- Keyboard shortcuts слухаються на `document`, але з early-return якщо `e.target.closest('button,input')`
- Візуальний focus ring на canvas через CSS `:focus-visible`

**Keyboard grid cursor (для WCAG 2.1.1):**
- Arrow keys рухають віртуальний курсор (візуально = outline mesh)
- Space = place at cursor, Delete/Backspace = remove
- Tab виводить з canvas до палітри/UI
- Shift+Tab назад у canvas

### 3.6 `tileLogic.js`
Чиста функція, без змін від v1:
```js
export function resolveTile(cell, neighbors) {
  const horizontal = [neighbors.north, neighbors.south, neighbors.east, neighbors.west]
    .filter(Boolean).length;
  if (!neighbors.above) return 'roof';
  if (horizontal === 0) return 'freestanding';
  if (horizontal === 1) return 'corner';
  return 'wall';
}
```

### 3.7 `saveState.js`
**Зміна проти v1:** **НЕ** персистимо `tileType`. Він derived — на load виконуємо `tileResolver.resolveAll()`.

```js
toJSON = () => ({
  version: 'v1',
  timestamp: Date.now(),
  cells: state.all().map(({x, y, z, colorId}) => ({x, y, z, colorId})),  // без tileType
  camera: { yaw, zoom },
  ui: { selectedColorId, mode },
})
```

**Edge cases (додано):**
- `QuotaExceededError` при `setItem` → показуємо non-blocking toast, продовжуємо гру in-memory
- `localStorage` недоступний (Safari private mode) → fallback to in-memory Map + banner «Save вимкнено»
- Multi-tab: не синхронізуємо (stretch). Документуємо.

**Suspend during cityGen:** `saveState.pause()` / `.resume()` — cityGen викликає щоб не серіалізувати 20 раз за 2 секунди.

### 3.8 `cityGen.js`

**Seeded RNG** (для детермінованих тестів):
```js
export function generateCity(state, { center = {x:15, z:15}, maxCells = 60, rng = Math.random } = {}) {
  // ... використовуємо rng() замість Math.random()
}
```

Для тестів: `generateCity(state, { rng: mulberry32(42) })`.

**Інший алгоритм:** без змін (BFS, decay probability, 80% color coherence). Тест додати: з фіксованим seed → ≥3 кольори, ≥30 cells, звʼязний кластер.

### 3.9 `ui.js`
**Зміна проти v1:** іконки — **inline SVG**, не emoji. Причина: емодзі 🧽 не рендериться на багатьох Windows/Linux системах.

Іконки: `<svg viewBox="0 0 24 24">...</svg>` inline в HTML, стилізовані через CSS `fill: currentColor`.

**Типографіка (явні розміри):**
- Body text: **18px** (для 7yo)
- Hint text: **16px min**
- Modal text: **16px min**
- Palette labels (tooltip): 14px — OK бо 7yo їх не читатиме

**Onboarding arrow for 7yo (NEW):**
При першому запуску — великий анімований SVG-arrow anchored до viewport center, вказує на pulsing клітинку. Зникає при першому placement.

**Erase-mode toast (NEW):**
Якщо ЛКМ у erase-mode потрапляє на порожню клітинку — показуємо inline toast біля курсора: «Ти стираєш 🧽». Також mode-button робить shake-animation 300мс.

**Default mode progression:** починаємо завжди у Build mode. Mode toggle прихований до першого placement (progressive disclosure).

**Clear all — hold-to-confirm:**
Замість Yes/No модалки — кнопка з radial progress що треба утримувати 1.5с. Випадковий клік C нічого не знесе.

### 3.10a Phase 2 — Townscaper-look розширення (planned)

**Зміни у Renderer для Phase 2:**

1. **4 → 9 InstancedMesh пулів** (T-PH2-B7):
   - `wall`, `freestanding`, `corner` — незмінні (plain bevel-box)
   - 6 roof variants: `roof-single`, `roof-ridge-NS`, `roof-ridge-EW`, `roof-hip-L`, `roof-hip-T`, `roof-flat`
   - FPS budget: 9 draw calls + 4 decoration pools + 1 shadow pool = 14 total. Вкладаємось у ≥30 FPS на Intel UHD 620.

2. **Bevel-геометрії** (T-PH2-A1): Всі non-decoration меші мають chamfered TOP + VERTICAL edges, flat BOTTOM (no-gap invariant). Використовуємо `ExtrudeGeometry` або кастомний BufferGeometry.

3. **Vertex AO** (T-PH2-A2): `BufferAttribute('color', 3)` у кожній геометрії. Material `vertexColors: true`. Three.js r160 документовано множить vertex color × instance color × lighting. Якщо цей path зламаний — fallback через `material.onBeforeCompile` shader patch.

4. **Contact shadows pool** (T-PH2-A4): окремий `InstancedMesh` з `PlaneGeometry(1.2, 1.2)` на y=0.01. Shadow texture — `THREE.CanvasTexture` з canvas radial gradient (згенеровано у коді, 0 файлів). Алоцується лише для ground-level (y===0) cells.

5. **Decorations pools** (T-PH2-C2): 4 окремі `InstancedMesh` (window/chimney/door/plant). Allocate/free у `#onCellResolved`/`#onCellRemoved` на основі `decorationsFor(cell)` з `src/decorations.js`. Feature flag `?decor=0`.

**Контракт: роль кожного pool-маніпулювання**
- Main 9 pools — слухають `cellResolved` (existing)
- Shadow pool — слухає `cellChanged` (add/remove filtered на y===0)
- Decoration pools — слухають `cellResolved`, викликають `decorationsFor()`, алоцирують у відповідних pools

**Performance risks:**
- 9 main pools замість 4 — 5 додаткових draw calls. Intel UHD тримає 30+ FPS (перевірити у T-PH2-B7 guard)
- Vertex AO збільшує vertex count ×1.5 (новий color attribute) — прийнятно
- Decorations додають 4 pools з малими геометріями — мало вершин кожна

### 3.11 `decorations.js` (planned, Phase 2)

**Відповідальність:** детерміністичні рішення про декорації для cell, без state на зовні.

**API:**
```js
// Deterministic — same cellKey returns same decorations across sessions
export function decorationsFor(cell, neighbors) {
  // Returns { window: boolean, chimney: boolean, door: boolean, plant: boolean }
}
```

**Hash:** inline murmur3-4byte з seed `${x}_${y}_${z}`. Повертає 4 uniform [0,1) числа для 4 decision-gates.

**Probability gates (ініціально):**
- window: 0.15 && hasExposedWall(neighbors)
- chimney: 0.10 && isRoof(cell.tileType)
- door: 0.05 && cell.y===0 && hasExposedWall
- plant: 0.07 && isRoof(cell.tileType)

Детерміністично: `decorationsFor(cellA) === decorationsFor(cellA)` завжди. Re-tile не змінює (бо tileType не бере участі у hash).

### 3.10 `tween.js` — центральний TweenManager

**Зміна проти v1:** не per-tween `requestAnimationFrame`. Один RAF loop драйвиться з `renderer.render()`.

```js
class TweenManager {
  #tweens = new Map();  // key → tween

  start(key, { from, to, duration, easing, onUpdate, onComplete }) {
    this.cancel(key);  // replace if already running
    this.#tweens.set(key, { from, to, duration, easing, onUpdate, onComplete, startTime: null });
  }

  cancel(key) { this.#tweens.delete(key); }

  tick(now) {
    for (const [key, t] of this.#tweens) {
      if (!t.startTime) t.startTime = now;
      const progress = Math.min((now - t.startTime) / t.duration, 1);
      t.onUpdate(t.from + (t.to - t.from) * t.easing(progress));
      if (progress === 1) { t.onComplete?.(); this.#tweens.delete(key); }
    }
  }
}
```

Результат: 20 concurrent tween-ів → 1 RAF, 1 пул buffer-оновлень на пул. Renderer робить `needsUpdate = true` **один раз на кадр на пул**, не на кожен tween.

## 4. Модель даних

```js
Cell = {
  x: int,          // 0..29
  y: int,          // 0..9
  z: int,          // 0..29
  colorId: 1..5 (1..6 з surprise),
  tileType: 'freestanding' | 'wall' | 'corner' | 'roof' | null,  // in-memory only
}

SaveFile = {
  version: 'v1',
  timestamp: number,
  cells: { x, y, z, colorId }[],    // БЕЗ tileType
  camera: { yaw, zoom },
  ui: { selectedColorId, mode },
  stats: { placementsCount },        // для unlock surprise color
}
```

Save розмір: 50 cells ≈ 2.5 KB. 2000 cells ≈ 100 KB (у квоту localStorage 5 MB вкладаємось).

## 5. Алгоритми

### 5.1 Tile resolution
Див. v1 таблицю 10 кейсів. Незмінено.

### 5.2 Picking — **MATH-BASED, не raycast проти мешів**

**Старий підхід (v1):** `raycaster.intersectObject(pool)` на 20 пулах → O(N) per pool × 20.

**Новий підхід:** raycast тільки проти ground plane → обчислюємо integer grid coord → DDA (Amanatides-Woo) walk по voxel-сітці з `state.getCell()` lookup.

```js
function pick(pointer) {
  const ndc = toNDC(pointer.clientX, pointer.clientY);
  raycaster.setFromCamera(ndc, camera);

  // 1. Ray → math. Start from camera, direction from raycaster.
  const origin = raycaster.ray.origin.clone();
  const dir = raycaster.ray.direction.clone();

  // 2. DDA through voxel grid. Step in integer cells along the ray.
  const step = { x: Math.sign(dir.x), y: Math.sign(dir.y), z: Math.sign(dir.z) };
  const tDelta = {
    x: Math.abs(1 / dir.x), y: Math.abs(1 / dir.y), z: Math.abs(1 / dir.z),
  };
  let cell = { x: Math.floor(origin.x), y: Math.floor(origin.y), z: Math.floor(origin.z) };
  let tMax = {
    x: ((cell.x + (step.x > 0 ? 1 : 0)) - origin.x) / dir.x,
    y: ((cell.y + (step.y > 0 ? 1 : 0)) - origin.y) / dir.y,
    z: ((cell.z + (step.z > 0 ? 1 : 0)) - origin.z) / dir.z,
  };

  const MAX_STEPS = 100;
  let lastEmpty = null, hitFace = null;
  for (let i = 0; i < MAX_STEPS; i++) {
    const existing = state.getCell(cell.x, cell.y, cell.z);
    if (existing) {
      return { hitCell: existing, placementCoord: lastEmpty ?? cell, face: hitFace };
    }
    lastEmpty = { ...cell };
    // Step to next voxel
    if (tMax.x < tMax.y && tMax.x < tMax.z) {
      cell.x += step.x; tMax.x += tDelta.x; hitFace = { axis: 'x', dir: -step.x };
    } else if (tMax.y < tMax.z) {
      cell.y += step.y; tMax.y += tDelta.y; hitFace = { axis: 'y', dir: -step.y };
    } else {
      cell.z += step.z; tMax.z += tDelta.z; hitFace = { axis: 'z', dir: -step.z };
    }
    if (cell.y < 0 || cell.y > MAX_HEIGHT) break;
  }

  // 3. No cell hit — fall through to ground plane
  const groundHit = raycaster.ray.intersectPlane(groundPlane, new Vector3());
  if (!groundHit) return null;
  return { hitCell: null, placementCoord: {
    x: Math.floor(groundHit.x), y: 0, z: Math.floor(groundHit.z)
  }};
}
```

**Вартість:** O(max cell traversals ≤ 100), незалежно від кількості placed cells. Реальна вартість ≈ 0.05-0.2мс. На 10000 cells поводиться так само як на 10.

**Плюси додатково:**
- Не потрібна трансформація face.normal через instanceMatrix (джерело багів у v1)
- Працює навіть якщо Renderer ще не згенерував меші (тестується у headless)
- Deterministic — легко юніт-тестувати

### 5.3 Random city generator
Без змін від v1, плюс seeded RNG (див. §3.8).

## 6. Performance бюджет — переглянутий

| Метрика | Ціль | Як вимірюємо |
|---------|------|--------------|
| FPS @ 500 cells (M1 Mac, Chrome) | 60 | `stats.js` |
| FPS @ 2000 cells (M1) | ≥30 | `stats.js` |
| **FPS @ 500 cells (Intel UHD 620, Chrome)** | **≥30** | **Manual test — ОСНОВНА ЦІЛЬ, це машина батьків** |
| FPS (iPad 2020, Safari 16.4+) | 30+ @ 500 cells | Manual |
| Random city generation | ≥30 FPS під час cascade | stats.js |
| Initial load ≤ 4G empty cache | ≤3с | DevTools network throttle |
| Bundle (HTML+src без Three.js) | ≤200 KB | `du -sh` |
| Memory @ 2000 cells | ≤100 MB | DevTools Memory |
| Time to first interaction | ≤500мс після DOMContentLoaded | `performance.mark` |

**Зміна проти v1:**
- Memory tightened 200→100 MB (реально ≈65MB, запас на leak detection)
- Додано Intel UHD 620 як primary target (парентський ноут)
- Initial load 2→3s (Three.js CDN реально бʼє 2s бюджет)

## 7. Браузерна сумісність

- **Chrome 100+** ✅
- **Firefox 108+** ✅
- **Safari 16.4+** ✅ (import maps native)
- **Safari 15-16.3** ✅ через `es-module-shims` polyfill
- **iOS Safari 15-16.3** ✅ через `es-module-shims`
- **iOS 14-** ❌ показуємо friendly-помилку
- **WebGL2** обовʼязково. Якщо немає — показуємо текст «Твоєму браузеру потрібно оновлення 🙂».

## 8. Структура проєкту

```
townscaper-mvp/
├── index.html
├── package.json             # vitest, playwright, serve
├── README.md                # як запустити (npx serve .)
├── .github/
│   └── workflows/
│       └── ci.yml           # npm test + playwright
├── src/
│   ├── main.js              # wiring, init order
│   ├── constants.js
│   ├── gameState.js
│   ├── tileResolver.js      # NEW
│   ├── renderer.js          # 4 pools + instanceColor
│   ├── input.js             # PointerEvents, DDA, keyboard cursor
│   ├── tileLogic.js         # pure
│   ├── saveState.js         # pause/resume, quota handling
│   ├── ui.js                # SVG icons, onboarding arrow, erase-toast
│   ├── cityGen.js           # seeded RNG
│   └── tween.js             # TweenManager (centralized)
├── vendor/
│   └── es-module-shims.js   # ~10KB polyfill
├── assets/
│   └── sounds/              # опційно
├── tests/
│   ├── gameState.test.js
│   ├── tileLogic.test.js    # 10 data-driven cases
│   ├── tileResolver.test.js
│   ├── saveState.test.js
│   ├── cityGen.test.js      # seeded
│   └── e2e/
│       ├── placement.spec.js
│       ├── keyboard.spec.js
│       ├── save-load.spec.js
│       └── onboarding.spec.js
└── docs/
```

## 9. Залежності

### Runtime (CDN)
| Lib | Версія | Origin | Розмір |
|-----|--------|--------|--------|
| three | 0.160.0 | jsdelivr | ~600KB gz |
| es-module-shims | ^1.8 | jsdelivr | ~10KB gz |
| _(опц dev)_ stats.js | 0.17 | jsdelivr | ~3KB gz |

### Dev
| Lib | Версія |
|-----|--------|
| vitest | ^1.0 |
| happy-dom | ^12 |
| @playwright/test | ^1.40 |
| serve | ^14 |

## 10. Init order у `main.js` (контракт)

```js
// 1. Read save BEFORE Renderer (avoid flicker)
const state = new GameState();
const saveState = new SaveState(state);
const resolver = new TileResolver(state);  // subscribes priority=1
const renderer = new Renderer(canvas, state);  // subscribes priority=2
saveState.attach();  // subscribes priority=3

// 2. Load state (fires events to subscribers in priority order)
const loaded = saveState.load();
if (loaded) resolver.resolveAll();  // tiles were not persisted

// 3. Input wires to state (not state→input)
const input = new InputManager(canvas, state);
const ui = new UI(state);

// 4. Start RAF
renderer.start();
```

## 11. Non-goals (незмінено)

Multiplayer, cloud save, мod, 3D spatial audio, анті-чіт, i18n, PWA, analytics, undo/redo, copy-paste, multi-tab sync.

## 12. Відкриті технічні питання

1. **Batch re-tile при drag-hold?** → Якщо буде jank — через `queueMicrotask` збирати delta і resolve одним пасом. Інакше sync OK.
2. **Hemisphere light додавати?** → Тестуємо без. Якщо сцена виглядає flat — додаємо `HemisphereLight(sky, ground, 0.4)`.
3. **Surprise color unlock — мʼяко чи через toast?** → GDD вирішує. Пропозиція: тихий sparkle без модалки.
4. **Frustum culling для InstancedMesh:** треба явно `mesh.computeBoundingSphere()` після batch placement, ІНАКШЕ або все цисим культиться, або нічого. Або `frustumCulled = false` і завжди малюємо 4 пули — при 30×30 grid це прийнятно.
