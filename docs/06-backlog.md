# Task Backlog — v2

> Переглянуто після перехресного ревʼю 6 агентів. Оцінка зросла 32h → **48h** (1.5× на реалістичність). Додано задачі T-CAM, T-DEMO, T-README, T-ERR, T-CDN. Змінено підхід: 4 пули замість 20, math-picking замість raycast, новий модуль tileResolver.

## Формат задачі

```
### T-XXX: [Назва]
**Epic:** {E1-E7} | **Estimate:** {h} | **Priority:** {P0/P1/P2} | **Dependencies:** {T-YYY}

**Опис:** що саме робимо, 2-4 речення.

**Definition of Done:**
- [ ] критерій 1
- [ ] AC з Test Plan (ID: AC-Fx-yy) пройдені
- [ ] CI зелений (npm test + playwright)

**Файли які торкаємо:**
- `src/...`

**Тестування:** як перевірити.
```

---

## Епіки

| ID | Назва |
|----|-------|
| E1 | Infrastructure + Core modules |
| E2 | Placement + Math picking |
| E3 | Tile logic + Resolver + Variations |
| E4 | UI / Palette / Camera |
| E5 | Save/Load з edge cases |
| E6 | Polish (anim, onboarding, help) |
| E7 | Bonus (Random city, Clear, Surprise color) |
| **E8** | **Ops (Demo prep, README, CI, Error handling)** |

---

## Черга виконання

### Sprint 1: Infrastructure + Core (~10 год)

#### T-001: Setup + Three.js сцена + import map + shims ✅ **Done** (PR #1, `3a8d6bc`)
**Epic:** E1 | **Estimate:** 2h | **Priority:** P0 | **Dependencies:** —

**Опис:** `index.html` з import map (jsdelivr) + `es-module-shims` polyfill. Порожня сцена, ambient+directional+hemisphere lights, ground plane 30×30. `OrthographicCamera` pitch 30°/yaw 45° (dimetric). RAF render loop. `?dev=1` → stats.js overlay.

**DoD:**
- [ ] Запускається через `npx serve .`, відкривається у Chrome + Safari
- [ ] Test у Safari 15 — працює через shims (візуально підтверджено)
- [ ] Console: 0 warnings, 0 errors
- [ ] `npx serve` → локальна URL у README

**Файли:** `index.html`, `src/main.js` (scaffold), `src/constants.js`, `src/renderer.js` (init тільки), `vendor/es-module-shims.js`

---

#### T-002: GameState модуль + canPlace + unit тести ✅ **Done** (PR #3, `b9f5d5c`)
**Epic:** E1 | **Estimate:** 4h | **Priority:** P0 | **Dependencies:** —

**Опис:** `GameState` з priority-based event bus (not native EventTarget). API: `getCell`, `canPlace`, `setCell`, `removeCell`, `updateTile`, `getNeighbors`, `all`, `clear`, `toJSON`, `fromJSON`, `on(event, fn, priority)`. Immutable cells (spread on mutate). Повний unit-test suite.

**DoD:**
- [ ] Всі методи реалізовані з TDD §3.2
- [ ] `canPlace` перевіряє: out-of-bounds, occupied, too-high, too-many, no-support
- [ ] Priority-based bus: listeners вистрілюють у порядку priority (детерміновано)
- [ ] Unit-тести ≥95% coverage
- [ ] `toJSON` НЕ містить `tileType` у cells
- [ ] AC-F1-06, AC-F1-07 з Test Plan проходять

**Файли:** `src/gameState.js`, `tests/gameState.test.js`, `package.json` (vitest, happy-dom)

---

#### T-003: tileLogic.js + 10-case data-driven unit test ✅ **Done** (PR #4, `a80c12f`)
**Epic:** E3 | **Estimate:** 1h | **Priority:** P0 | **Dependencies:** —

**Опис:** Pure `resolveTile(cell, neighbors)` — 10 рядків. `it.each(fixture)` тест на всі 10 комбінацій з TDD §5.1.

**DoD:**
- [ ] AC-F3-04 проходить (data-driven 10 кейсів)
- [ ] AC-F3-01, AC-F3-02 проходять

**Файли:** `src/tileLogic.js`, `tests/tileLogic.test.js`

---

#### T-004: TileResolver модуль + unit + integration ✅ **Done** (PR #5, `85737bc`)
**Epic:** E3 | **Estimate:** 3h | **Priority:** P0 | **Dependencies:** T-002, T-003

**Опис:** Новий модуль — єдиний оркестратор re-tile. Підписується на `cellChanged` priority=1, обчислює tileType для зачеплених cells + 6 сусідів, викликає `state.updateTile`. Метод `resolveAll()` для post-load.

**DoD:**
- [ ] `#onChange` викликається перед renderer/save
- [ ] Scope re-tile ≤7 cells (spy-test)
- [ ] `resolveAll` коректно працює на save з 100 cells
- [ ] AC-F3-03, IS-01, IS-05 проходять

**Файли:** `src/tileResolver.js`, `tests/tileResolver.test.js`, `tests/integration/tileResolver.test.js`

---

### Sprint 2: InstanceColor pools + Math picking (~12 год)

#### T-005: 4-пульні InstancedMesh + instanceColor ✅ **Done** (PR #6, `6ad6bdc`)
**Epic:** E1 | **Estimate:** 6h | **Priority:** P0 | **Dependencies:** T-001

**Опис:** Створити 4 `InstancedMesh` пули (один на tileType). Колір — через `InstancedBufferAttribute('instanceColor', 3)`. `MeshLambertMaterial({ vertexColors: true })`. Swap-remove allocate/free. `setCellColor(cellKey, rgb)` для color change без міграції. `computeBoundingSphere()` після batch placement.

**DoD:**
- [ ] 4 пули при старті, не 20
- [ ] FPS ≥60 при 500 cells через dev-spawner (`?dev=1&spawn=500`)
- [ ] Color change = 1 buffer write, не migration
- [ ] Tweens key by cellKey, не instanceId (захист від stale writes)
- [ ] Frustum culling: або `computeBoundingSphere()` регулярно, або `frustumCulled=false`

**Файли:** `src/renderer.js` (клас `InstancePool`), `tests/integration/renderer.test.js` з Three.js shim

---

#### T-006: Math-based picking (DDA) + ghost cursor ✅ **Done** (PR #7, `fa9d692`)
**Epic:** E2 | **Estimate:** 5h | **Priority:** P0 | **Dependencies:** T-005

**Опис:** Реалізувати `pick(pointer)` через Amanatides-Woo DDA з TDD §5.2. Raycast тільки проти ground plane; далі walk через voxel grid з `state.getCell()` lookup. Повертає `{ hitCell, placementCoord, face }`. Hover-outline відповідно.

**DoD:**
- [ ] Unit test: pick повертає правильну клітинку для 20 тестових напрямків камери і cell-конфігурацій
- [ ] Тест з rotated камерою (yaw 90°, 180°, 270°) — placement coord коректний
- [ ] NF-1.10 проходить (<0.2мс на pick незалежно від кількості cells)
- [ ] Ghost-cursor slot виділяється поточним кольором; червоний якщо `canPlace.ok=false`

**Файли:** `src/input.js` (pick logic), `src/renderer.js` (hover mesh), `tests/picking.test.js`

---

#### T-007: PointerEvents + Place/Remove з drag-threshold ✅ **Done** (PR #8, `0cb18c8`)
**Epic:** E2 | **Estimate:** 3h | **Priority:** P0 | **Dependencies:** T-006, T-002

**Опис:** Pointer Events з day 1: pointerdown/pointermove/pointerup + `setPointerCapture`. Drag vs click: ≤8px, ≤300мс. ЛКМ у Build → setCell. ПКМ → removeCell. Erase-mode: ЛКМ → removeCell. Passive listeners для wheel/touch.

**DoD:**
- [ ] AC-F1-01 до AC-F1-09 проходять
- [ ] AC-F2-01, AC-F2-02, AC-F2-03 проходять
- [ ] Contextmenu `preventDefault` на canvas працює
- [ ] Drag на 20px не place'ить (AC-F1-09)

**Файли:** `src/input.js`, `src/main.js` (wiring)

---

### Sprint 3: Tile variations + Camera (~10 год)

#### T-008: 4 tile-геометрії з Y-gradient vertex colors ✅ **Done** (PR #10, `006db2b`)
**Epic:** E3 | **Estimate:** 3h | **Priority:** P1 | **Dependencies:** T-005

**Опис:** Процедурно згенерувати 4 геометрії:
- **freestanding:** кубик + пірамідальний дашок (8+4 vertex)
- **wall:** простий кубик
- **corner:** кубик з одним скошеним верхнім ребром (chamfer)
- **roof:** кубик з низькою hipped-roof

Замість baked AO — **Y-gradient vertex colors**: top vertex × 1.05, bottom vertex × 0.7, linear у fragments. Це 30 хв замість 3h справжнього AO.

**DoD:**
- [ ] 4 візуально відмінні геометрії (silhouette height ≥15% дельта)
- [ ] Референсний screenshot у `docs/screenshots/tile-variants.png`
- [ ] FPS ≥60 при 500 cells (регрес-чек NF-1.2)
- [ ] Геометрії інстансуються у відповідних пулах

**Файли:** `src/renderer.js` (createGeometries), `docs/screenshots/tile-variants.png`

---

#### T-009: Renderer слухає cellResolved + анімації migrate
**Epic:** E3 | **Estimate:** 2h | **Priority:** P0 | **Dependencies:** T-004, T-005, T-008

**Опис:** Renderer підписується на `cellResolved` (priority=2, after tileResolver). При зміні tileType — cancel tween на старому пулі, migrate instance до нового, restart tween від current scale. Без візуального glitch.

**DoD:**
- [ ] Без flicker при placement поряд (neighbors змінюють tileType)
- [ ] AC-F3-01, AC-F3-02 проходять (E2E)
- [ ] IS-01 integration test зелений

**Файли:** `src/renderer.js`

---

#### T-CAM: Camera rotate (Q/E) + zoom з clamp ✅ **Done** (PR #9, `c125a59`)
**Epic:** E4 | **Estimate:** 2h | **Priority:** P1 | **Dependencies:** T-001

**Опис:** Q/E → yaw ±90° snap з 200мс easeInOutCubic tween. Wheel → zoom 0.1 step, clamp 0.5-2.0 з spring-bounce feedback на межах.

**DoD:**
- [ ] AC-F9-01, AC-F9-02, AC-F9-03, AC-F9-04 проходять
- [ ] Ongoing placement tweens не переривається rotate

**Файли:** `src/renderer.js` (camera methods), `src/input.js` (Q/E, wheel handlers)

---

#### T-010: Keyboard grid cursor (WCAG 2.1.1)
**Epic:** E4 | **Estimate:** 3h | **Priority:** P1 | **Dependencies:** T-006, T-007

**Опис:** Arrow keys рухають ghost-cursor по сітці. Space = place, Delete = remove. Focus ring на canvas (`tabindex="0"` + `:focus-visible`). Shortcuts слухаються на document з early-return для button/input focus.

**DoD:**
- [ ] AC-F11-01, AC-F11-02, AC-F11-03 проходять
- [ ] Tab через UI коректно фокусує canvas і назад
- [ ] 1-5 не плутається з button click semantics

**Файли:** `src/input.js` (grid cursor state, keyboard handler)

---

### Sprint 4: UI + Save (~9 год)

#### T-011: UI Palette (SVG icons) + Surprise color ✅ **Done** (PR #12, `3af703a`)
**Epic:** E4 | **Estimate:** 3h | **Priority:** P0 | **Dependencies:** T-001

**Опис:** DOM overlay з 5→6 circle-buttons. Inline SVG icons (не emoji). 6-й button fade-in після 10 placements (AC-F12-01). Selection — 3px white outline. Shortcut keys 1-6 (6 доступний після unlock).

**DoD:**
- [ ] AC-F4-01, AC-F4-02, AC-F4-03, AC-F12-01 проходять
- [ ] SVG icons рендеряться на Windows/macOS однаково
- [ ] Palette не перехоплює клік через canvas (pointer-events: auto на палітрі, none на wrapper)

**Файли:** `index.html` (SVG icons inline), `src/ui.js`, `src/styles.css`

---

#### T-012: Mode toggle + progressive disclosure + erase toast ✅ **Done** (PR #15, `6a5c3f7`)
**Epic:** E4 | **Estimate:** 2h | **Priority:** P1 | **Dependencies:** T-011, T-007

**Опис:** Два buttons (Build/Erase) у top-right. **Прихований до першого placement**. Erase-mode: ЛКМ на порожню клітинку → toast «Ти стираєш 🧽» + button shake. Після 3 no-op кліків — auto-switch назад у Build.

**DoD:**
- [ ] AC-F1-05 проходить (toast показано)
- [ ] Toggle зʼявляється лише після першого placement
- [ ] Після 3 no-op erase-кліків — auto-switch + toast

**Файли:** `src/ui.js`, `src/input.js`, `index.html`

---

#### T-013: Save/Load з edge cases (quota, private mode) ✅ **Done** (PR #13, `74c5bad`)
**Epic:** E5 | **Estimate:** 4h | **Priority:** P0 | **Dependencies:** T-002, T-004

**Опис:** `saveState.js` з:
- Debounced auto-save 2с
- `pause()/resume()` для cityGen
- `QuotaExceededError` → toast, continue in-memory
- `localStorage` недоступний → fallback to Map + banner
- `fromJSON` → resolver.resolveAll()
- Mock-based unit tests

**DoD:**
- [ ] AC-F5-01, F5-02, F5-03, F5-04, F5-05, F5-06, F5-07 проходять
- [ ] Integration IS-02, IS-03 проходять

**Файли:** `src/saveState.js`, `tests/saveState.test.js`

---

### Sprint 5: Polish + Bonus + Ops (~7 год)

#### T-014: Central TweenManager + scale animations ✅ **Done** (PR #17, `c38fb20`)
**Epic:** E6 | **Estimate:** 2h | **Priority:** P1 | **Dependencies:** T-005

**Опис:** `tween.js` з `TweenManager` — один RAF loop. `start(key, {...})` cancel якщо існує. Keyed by cellKey (не instanceId). Driven з `renderer.render()`.

Scale-in animation при placement (0→1.1→1 easeOutBack, 250мс), scale-out при remove (1→1.1→0 easeInQuad, 150мс).

**DoD:**
- [ ] Animation juice видима
- [ ] 20+ concurrent tweens не викликають stale-write bugs (Random city test)
- [ ] Cancel on migrate працює

**Файли:** `src/tween.js`, `src/renderer.js`

---

#### T-015: Hover outline + invalid state
**Epic:** E6 | **Estimate:** 1h | **Priority:** P1 | **Dependencies:** T-006

**Опис:** Hover-mesh (wireframe) у поточній клітинці. Колір = selectedColor @60% alpha для valid, red @60% для `canPlace.ok=false`. Fade-in 100мс, fade-out 80мс.

**DoD:** AC-F8-01, AC-F8-02, а також invalid-state візуалізація

**Файли:** `src/renderer.js`

---

#### T-016: Random City (seeded) + cascade animation
**Epic:** E7 | **Estimate:** 2h | **Priority:** **P1** (не ріжемо!) | **Dependencies:** T-007, T-014

**Опис:** `cityGen.js` з seeded RNG, BFS з центру, stagger 40мс. Кольори: 80% як у parent, 20% випадкових. `saveState.pause()/resume()` навколо.

**DoD:** AC-F6-01, AC-F6-02, IS-04 проходять

**Файли:** `src/cityGen.js`, `src/input.js` (R handler)

---

#### T-017: Clear all — hold-to-confirm
**Epic:** E7 | **Estimate:** 1h | **Priority:** P2 | **Dependencies:** T-007, T-011

**Опис:** Кнопка у trash-icon + клавіша C → велика hold-кнопка з radial progress 1.5с. Видаляє при completion, abort при release/ESC.

**DoD:** AC-F7-01, AC-F7-02, AC-F7-03 проходять

**Файли:** `src/ui.js`, `src/input.js`, `index.html`

---

#### T-018: Onboarding arrow + hints + celebrations
**Epic:** E6 | **Estimate:** 1h | **Priority:** P1 | **Dependencies:** T-013

**Опис:**
- При порожньому save — SVG-arrow screen-anchored + headline «Тикни — побудуй!»
- Pulse на центральній клітинці + canvas edge pulse
- Після 5 placements — tooltip «R — ціле місто!»
- Micro-celebrations: 10 cells, перша башта, 30 cells

**DoD:** AC-F10-01, NF-3.1 (sessions з дітьми)

**Файли:** `src/ui.js`, `src/main.js`

---

#### T-019: Help modal 2-level
**Epic:** E6 | **Estimate:** 1h | **Priority:** P2 | **Dependencies:** T-011

**Опис:** H/? → 2-level help:
- Default: 4 великі візуальні інструкції (click, right-click, 1-5, R)
- Toggle «Показати всі команди» → повна таблиця shortcuts

**DoD:** AC-F10-02 проходить

**Файли:** `src/ui.js`, `index.html`

---

### Ops tasks (Epic E8, NEW)

#### T-README: README + launch instructions
**Estimate:** 0.5h | **Priority:** P1 | **Dependencies:** T-001

**Опис:** Короткий README:
- Що це, для кого, скріншот
- Як запустити: `npx serve .` або `python3 -m http.server`
- Shortcuts (копія з help)
- Credits
- Note: чому `file://` не працює (CORS + ES modules)

**Файли:** `README.md`

---

#### T-CDN: es-module-shims fallback + vendoring option
**Estimate:** 1h | **Priority:** P2 | **Dependencies:** T-001

**Опис:** Перевірити що `es-module-shims` коректно поліфіллить імпорт на Safari 15. Опційно — vendor three.module.js у `/vendor/` для full-offline (один raw файл, 600KB) з fallback у import map.

**Файли:** `vendor/es-module-shims.js`, `index.html`, `vendor/three.module.js` (опційно)

---

#### T-ERR: Global error handler + no-WebGL fallback
**Estimate:** 0.5h | **Priority:** P2 | **Dependencies:** T-001

**Опис:** `window.addEventListener('error')` → friendly UI «Щось зламалось :(». No-WebGL → текстова помилка «Твоєму браузеру треба оновлення». CDN-fail (Three.js не завантажився) → «Немає інтернету?».

**Файли:** `src/main.js`, `index.html`

---

#### T-DEMO: Demo script + preflight checklist
**Estimate:** 1h | **Priority:** P1 | **Dependencies:** T-018, T-016

**Опис:** Markdown у `docs/demo-script.md`:
- **Preflight:** laptop battery ≥80%, fullscreen F11, localStorage.clear(), fresh incognito window, audio level check
- **Script сесії:** що показати дітям по хвилинах (0-1 «дивись що я зробив», 1-5 дитина грає сама, 5-10 random city + custom кольори)
- **Backup:** якщо краш — кнопка reload + apology

**Файли:** `docs/demo-script.md`

---

#### T-CI: GitHub Actions workflow
**Estimate:** 0.5h | **Priority:** P1 | **Dependencies:** T-002, T-003

**Опис:** `.github/workflows/ci.yml` з Test Plan §9. Запуск на push + PR: vitest + playwright + coverage artifact.

**Файли:** `.github/workflows/ci.yml`

---

## Estimation summary (v2)

| Sprint | Задачі | Години |
|--------|--------|--------|
| 1 Infrastructure + Core | T-001 до T-004 | 10 |
| 2 Pools + Picking + Place | T-005 до T-007 | 14 |
| 3 Tiles + Resolver + Camera | T-008, T-009, T-CAM, T-010 | 10 |
| 4 UI + Save | T-011, T-012, T-013 | 9 |
| 5 Polish + Bonus | T-014 до T-019 | 8 |
| Ops (E8) | T-README, T-CDN, T-ERR, T-DEMO, T-CI | 3.5 |
| **Разом MVP** | **24 задачі** | **~54 год** |

_Після додавання Ops-задач + TileResolver + T-CAM + T-010: ~54h (раніше було 48h). Round up до 60h для safety._

### Хронологія:
- 26h (початкова)
- 32h (після декомпозиції)
- 48h (після 1.5× reality check)
- **60h (після додавання пропущених ops-tasks)**

Це нормально. Чесно.

### Stretch (після MVP)
- **T-020 Mobile touch** (3h) — PointerEvents уже є, треба long-press + sizing
- **T-021 SFX** (2h) — CC0 sounds + mute toggle
- **T-022 SSAO** (2h) — postprocessing для справжнього Townscaper-look

---

## Phase 2 v2 — Townscaper-look на регулярній сітці (post cross-review)

**Ціль:** візуально наблизитись до Townscaper зберігаючи 30×30 сітку. Три спринти + Ops, **18 задач, ~28.5 годин** (після 5-агентного cross-review).

**Ключові архітектурні рішення (з ревʼю):**
- `cell.tileType` НЕ розширюється — залишається 4 значень. Нове поле **`cell.roofVariant`** ∈ `null | single | ridge-NS | ridge-EW | hip-L | hip-T | flat`.
- Bevel-геометрії через **`RoundedBoxGeometry` + flatten bottom**, НЕ `ExtrudeGeometry`.
- Контактні тіні **baked у ground DataTexture**, НЕ per-cell transparent planes (Intel UHD fillrate).
- `DecorationsManager` з dual-subscription (cellResolved + cellChanged remove).
- Decoration density cap 30% + progressive unlock після 20 placements.
- Dirty-flag batching на buffer uploads.
- O(1) `cellToPool` Map замість O(9) scan.
- Bevel size 0.10 (не 0.06 — було невидимо при звичайному зумі).

### Sprint 2A — Polish (~5h)

#### T-PH2-A1: Bevel-геометрії для 4 tileType (заокруглені краї)
**Epic:** E-PH2 | **Estimate:** 3h | **Priority:** P0 | **Dependencies:** —

**Опис:** Замінити `BoxGeometry(1,1,1)` на кастомний bevel-box. Використати `ExtrudeGeometry` з квадратним shape, `bevelEnabled:true, bevelSize:0.06, bevelThickness:0.06, bevelSegments:2`. Bevel тільки на TOP + VERTICAL edges; BOTTOM плоский (no-gap invariant).

**DoD:**
- [ ] 4 геометрії (wall/freestanding/corner/roof) — bevel видимий
- [ ] bbox span [−0.5, +0.5] на XYZ зберігається (regression E2E)
- [ ] T-005 instanceColor test зелений (color multiplication працює)
- [ ] Screenshot до/після для візуального порівняння

**Файли:** `src/renderer.js` — `makeWallGeometry`, `makeFreestandingGeometry`, `makeCornerGeometry`, `makeRoofGeometry`

---

#### T-PH2-A2: Vertex AO (тіні у закутках)
**Epic:** E-PH2 | **Estimate:** 1h | **Priority:** P0 | **Dependencies:** T-PH2-A1

**Опис:** `BufferAttribute('color', 3)` для кожної геометрії: bottom vertices × 0.75, edge/corner × 0.88, top × 1.0. Material `vertexColors: true` + `instanceColor` — фінальний колір мулитиплікативний.

**DoD:**
- [ ] AO видимий візуально (нижні грані темніші)
- [ ] `instanceColor` продовжує працювати (всі 5 кольорів палітри видимі)
- [ ] Regression T-005 пули test зелений

**Файли:** `src/renderer.js` — `_applyVertexAO(geometry)` helper

---

#### T-PH2-A3: Тепле вечірнє освітлення
**Epic:** E-PH2 | **Estimate:** 0.5h | **Priority:** P0 | **Dependencies:** —

**Опис:** Параметри Three.js lights:
- Directional: `0xFFE8CC`, intensity 1.1
- Ambient: `0xE8D8C0`, intensity 0.35
- Hemisphere: sky `0xF2E8D0`, ground `0x9BA585`, intensity 0.35
- Background: `0xE8D8C0`

**DoD:**
- [ ] Сцена виглядає «вечірньо-тепло» (субʼєктивно — playtesting)
- [ ] Кольори палітри читаються (не занадто жовті)
- [ ] Скріншот порівняння

**Файли:** `src/renderer.js` `#setupLights()`, `src/constants.js` PALETTE

---

#### T-PH2-A4: Контактні тіні під кубами
**Epic:** E-PH2 | **Estimate:** 0.5h | **Priority:** P1 | **Dependencies:** T-PH2-A3

**Опис:** Під кожну ground-level клітинку — прозорий quad з radial gradient shadow. Texture згенерована `THREE.CanvasTexture` (64×64 canvas з radial gradient, 0 файлів). Один `InstancedMesh` pool `shadowPool` з `PlaneGeometry(1.2, 1.2)`, rotated -π/2, y=0.01.

**DoD:**
- [ ] Контактні тіні під кожним ground cell
- [ ] Лише для y===0 (upper floors не потребують)
- [ ] Не з-файтинг з ground plane
- [ ] FPS не падає (1 додатковий instanced mesh)

**Файли:** `src/renderer.js` — `#setupContactShadows()`, `shadowPool`

---

### Sprint 2B — Merged Roofs (~8h)

#### T-PH2-B1: resolveRoofVariant logic + tests
**Epic:** E-PH2 | **Estimate:** 2h | **Priority:** P0 | **Dependencies:** —

**Опис:** Нова функція `resolveRoofVariant(cell, neighbors)` у `src/tileLogic.js`. Повертає один з 6 варіантів на основі roof-сусідів (ключ — які cells з neighbors-same-level мають tileType.startsWith('roof')):
- 0 roof-сусідів → `roof-single`
- 1 по N/S → `roof-ridge-NS`
- 1 по E/W → `roof-ridge-EW`
- 2 лінійно (NS або EW з обох сторін) → `roof-ridge-NS` / `roof-ridge-EW`
- 2 перпендикулярно (1 N/S + 1 E/W) → `roof-hip-L`
- 3 → `roof-hip-T`
- 4 → `roof-flat`

**DoD:**
- [ ] Unit тести покривають всі 7 кейсів (6 variants + edge cases симетрії)
- [ ] Integration test: placing neighbor змінює variant
- [ ] Existing tileLogic tests (T-003) зелені

**Файли:** `src/tileLogic.js`, `tests/tileLogic.test.js`

---

#### T-PH2-B2: roof-single bevel geometry
**Epic:** E-PH2 | **Estimate:** 0.5h | **Priority:** P1 | **Dependencies:** T-PH2-A1

**Опис:** Оновити існуючий `makeRoofGeometry` (базовий roof) з bevel-ами на основі + pyramid. Використовується для `roof-single` variant.

**DoD:** bbox correct, pyramid sharp, base bevelled, screenshot

**Файли:** `src/renderer.js`

---

#### T-PH2-B3: roof-ridge-NS/EW geometries
**Epic:** E-PH2 | **Estimate:** 1h | **Priority:** P1 | **Dependencies:** T-PH2-B2

**Опис:** Дві нові геометрії: `makeRoofRidgeNS`, `makeRoofRidgeEW`. Base 1×0.7×1 + призма-прямокутник з ridge уздовж відповідної осі (Z для NS, X для EW). Apex ridge-line має висоту 1.3.

**DoD:**
- [ ] NS: ridge-line проходить (x=0.5, y=1.3, z=[0, 1])
- [ ] EW: ridge-line проходить (x=[0, 1], y=1.3, z=0.5)
- [ ] bbox span XYZ коректний, height 1.3

**Файли:** `src/renderer.js`

---

#### T-PH2-B4: roof-hip-L geometry (кут з поворотом ridge)
**Epic:** E-PH2 | **Estimate:** 1h | **Priority:** P1 | **Dependencies:** T-PH2-B3

**Опис:** L-подібний hip-roof. Base + 2 нахилені площини, які сходяться у один corner (ridge line має згин на 90°). Custom BufferGeometry — важче ExtrudeGeometry, треба вручну vertex + triangle indices.

**DoD:** Два роз'їдні face-plane сходяться у diagonal ridge

**Файли:** `src/renderer.js`

---

#### T-PH2-B5: roof-hip-T geometry (три сторони)
**Epic:** E-PH2 | **Estimate:** 1h | **Priority:** P2 | **Dependencies:** T-PH2-B4

**Опис:** T-подібний hip-roof — 3 нахилені площини сходяться у T-ridge. Для ground-level cell який має 2 лінійних + 1 перпендикулярний roof-сусід.

**DoD:** 3 face-planes meet at T-junction; bbox OK

**Файли:** `src/renderer.js`

---

#### T-PH2-B6: roof-flat geometry
**Epic:** E-PH2 | **Estimate:** 0.5h | **Priority:** P2 | **Dependencies:** —

**Опис:** Просто коробка 1×1×1 (bevelled) без піраміди. Для cells оточених з 4 сторін roof-сусідами (internal of roof-cluster).

**DoD:** Плоский top face, бокс full-height 1.0

**Файли:** `src/renderer.js`

---

#### T-PH2-B7: Renderer 9-pool dispatch
**Epic:** E-PH2 | **Estimate:** 2h | **Priority:** P0 | **Dependencies:** T-PH2-B1..B6

**Опис:** Розширити `#setupPools` з 4 до 9 пулів (wall, freestanding, corner + 6 roof-variants). `#onCellResolved` дистпатчить на правильний пул за `cell.tileType` який тепер може бути `'roof-ridge-NS'` тощо. Міграція між roof-variants коли сусід-roof ставиться/знімається.

**DoD:**
- [ ] 9 InstancedMesh пулів у сцені
- [ ] FPS ≥60 при 500 cells на M1 (9 draw calls — має витримати)
- [ ] FPS ≥30 при 500 cells на Intel UHD (target ноут батьків)
- [ ] Міграція roof-single → roof-ridge при placement сусіда (E2E)
- [ ] Scale tweens (T-014) продовжують працювати

**Файли:** `src/renderer.js`, `src/constants.js` TILE_TYPES

---

### Sprint 2C — Decorations (~6h)

#### T-PH2-C1: Deterministic decision module
**Epic:** E-PH2 | **Estimate:** 1h | **Priority:** P0 | **Dependencies:** —

**Опис:** `src/decorations.js` — `decorationsFor(cell, neighbors)` повертає `{window, chimney, door, plant}` booleans. Використовує seeded hash(cellKey) з murmur3-4byte inline — детерміністично per cellKey щоб re-tile не мигтив декор.

**DoD:**
- [ ] Unit тест: `decorationsFor(cellA)` завжди повертає те саме
- [ ] Probabilities: window 15%, chimney 10%, door 5%, plant 7%
- [ ] Conditional: chimney/plant тільки для roof-*, door для y===0, window для exposed-wall

**Файли:** `src/decorations.js`, `tests/decorations.test.js`

---

#### T-PH2-C2: Decoration meshes + 4 pools
**Epic:** E-PH2 | **Estimate:** 3h | **Priority:** P1 | **Dependencies:** T-PH2-C1

**Опис:** 4 нові InstancedMesh пули:
- **Window**: `PlaneGeometry(0.3, 0.4)`, inset 0.02 у стіну, колір `0x2A2520`
- **Chimney**: `BoxGeometry(0.2, 0.3, 0.2)`, offset на roof-edge, brick color `0x8B4513`
- **Door**: `BoxGeometry(0.3, 0.6, 0.05)`, ground-level, dark brown `0x4A2E1A`
- **Plant**: `CylinderGeometry(0.12, 0.15, 0.2, 8)`, roof-edge, green `0x4A7C3A`

Кожен має свою allocate/free логіку, прикріпленим до parent cell через offset.

**DoD:** 4 пули рендеряться, positions коректні, color distinct

**Файли:** `src/renderer.js` — `decorations` map of pools

---

#### T-PH2-C3: Integration + feature flag
**Epic:** E-PH2 | **Estimate:** 2h | **Priority:** P0 | **Dependencies:** T-PH2-C2, T-PH2-B7

**Опис:** Hook у `#onCellResolved`: після main mesh allocation, викликати `decorationsFor(cell)` і allocate у відповідні decoration pools. При `cellRemoved` / `clear` — free decorations цієї cell. Feature flag `?decor=0` вимикає decorations entirely (для тестів і на слабкому залізі).

**DoD:**
- [ ] Decorations зʼявляються на ~15-30% cells
- [ ] `?decor=0` вимикає їх (0 декорацій у scene)
- [ ] Save/load відновлює без flickering (детермінізм працює)
- [ ] FPS ≥30 Intel UHD з включеними decor

**Файли:** `src/renderer.js`, `src/main.js`

---

### Phase 2 v2 Ops-tasks (з cross-review)

#### T-PH2-VR: Visual regression infrastructure
**Epic:** E-PH2 | **Estimate:** 2h | **Priority:** P0 | **Dependencies:** —

**Опис:** Setup Playwright `toHaveScreenshot()` baseline-ів для Phase 2 features. Fixed camera + fixed seed + threshold 0.3%.

**DoD:** 3 baseline screenshots (bevel close-up, merged roofs 3×3, decorations sample) у `tests/__screenshots__/`.

---

#### T-PH2-PERF: Manual Intel UHD performance validation
**Epic:** E-PH2 | **Estimate:** 1h | **Priority:** P0 | **Dependencies:** T-PH2-C3

**Опис:** `docs/phase2-perf-manual.md` — checklist для запуску на реальному Intel UHD 620 ноуті (батьківський). `?dev=1&spawn=500&decor=1` → 30с замір stats.js. Blocker для Phase 2 merge.

**DoD:** ≥30 FPS avg, ≥25 FPS p95 на Intel UHD. Документовано thermal throttle behaviour.

---

#### T-PH2-REGR: Regression matrix + pool-stats compat
**Epic:** E-PH2 | **Estimate:** 0.5h | **Priority:** P0 | **Dependencies:** T-PH2-B7

**Опис:** Розширити `getPoolStats()` — додати `roof` convenience key = sum(6 roof-variants). Перевірити 13+ existing тестів що можуть ламатись (T-005, T-008, T-014, fix/horizontal-gaps, fix/erase-hover).

**DoD:** Всі existing E2E+unit тести зелені, нова convenience key додана.

---

#### T-PH2-PALETTE: Palette-under-warm validation
**Epic:** E-PH2 | **Estimate:** 0.5h | **Priority:** P0 | **Dependencies:** T-PH2-A3

**Опис:** E2E screenshot з 5 palette кольорів × 3 tile types під новим warm lighting. Manual review — чи не muddy.

**DoD:** Sage і Sky distinct (не сіро-коричневі). Якщо fail — adjust PALETTE колори або знизити ambient intensity.

---

### Phase 2 estimation summary v2

| Sprint | Задачі | Години |
|--------|--------|--------|
| 2A Polish | T-PH2-A1..A4 | 6.5 |
| 2B Merged Roofs | T-PH2-B1..B7 (roofVariant separate field, 2-phase resolve) | 10 |
| 2C Decorations | T-PH2-C1..C3 (DecorationsManager + density cap + unlock) | 8 |
| 2-Ops | T-PH2-VR, T-PH2-PERF, T-PH2-REGR, T-PH2-PALETTE | 4 |
| **Разом Phase 2 v2** | **18 задач** | **~28.5 год** |

Між спринтами можна зупинятись. Кожен sprint окрема гілка, PR-и інтегровані окремо з screenshot-ами.

### Phase 2 cut-priority (v2)

Якщо горить — ріжемо з кінця:
1. T-PH2-C3 decorations integration (Sprint 2C цілком) — найбільший UX ризик
2. T-PH2-B5/B6 hip-T + flat (fallback на roof-hip-L для цих кейсів)
3. T-PH2-A4 baked shadows (ground без них читається теж OK)

**Ніколи не ріжемо:** T-PH2-A1/A2/A3 (найбільший ROI), T-PH2-B1/B2/B3/B7 (merged roofs характерна фіча), T-PH2-VR/PERF (без них не знаємо що реально працює).

---

## Пріоритет скорочення — переписано

**Ріжемо з кінця (у порядку):**
1. **T-019 Help modal** (дорослий пояснить)
2. **T-CDN shims** (сказати «нове Safari / Chrome» — приймаємо брак iOS 15)
3. **T-017 Clear all** (F5 + clearStorage з консолі)
4. **T-015 Hover outline invalid-state** (базовий hover лишаємо)
5. **T-018 micro-celebrations** (зберегти onboarding arrow — це P0 для 7yo!)
6. **T-014 scale animations** (без juice, але грає)

**Ніколи не ріжемо:**
- T-001..T-007 (без них гри немає)
- T-013 Save/Load (без persistence не cross-session)
- T-016 Random City (wow-moment для 12yo, зафіксовано у Vision)
- T-018 onboarding arrow (P0 для UX-7)
- T-012 erase-toast (P0 — silent failure protection)
- T-DEMO (без demo-script провалюємо мету проєкту)

---

## Dependency graph (topology)

```
T-001 ────┬─► T-005 ──► T-006 ──► T-007 ──► T-009 ──► T-014
          │                           │
          └─► T-011 ──► T-012        T-010
              T-CAM    T-017
              T-019
              T-README

T-002 ──┬─► T-004 ──► T-009
        │
        └─► T-013 ──► T-018

T-003 ──► T-004

T-016 depends on T-007 + T-014
T-ERR  depends on T-001
T-CI   depends on T-002 + T-003
T-DEMO depends on T-016 + T-018
```

Sprint 1 можна починати у паралель: T-001 і T-002+T-003+T-004 — незалежні треки. Ідеально для 2-х АІ-агентів паралельно.
