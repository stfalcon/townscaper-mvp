# AGENTS.md / CLAUDE.md

> Кладеться у корінь репозиторія як `CLAUDE.md` (для Claude Code) або `AGENTS.md` (для інших АІ-агентів). Це перший файл, який читає агент коли бере задачу.

## Про проєкт

**Cozy Town Builder** — браузерна sandbox-гра для дітей 7-12 років у стилі Townscaper. Клік по полю — зʼявляється будиночок, який автоматично адаптує форму до сусідів. Без цілей, без програшу — тільки творчість.

**Мета проєкту — демо:** показати дітям можливості АІ-розробки у 2026. Гра не мусить бути AAA — вона має бути **prilизаною, швидко зробленою з АІ, і працювати одним HTML-файлом.**

**Повний контекст:**
- `docs/01-vision.md` — one-pager (що, для кого, чому)
- `docs/02-gdd.md` — game design (геймплей, контроли, UX)
- `docs/03-art-brief.md` — візуал, палітра
- `docs/04-tdd.md` — архітектура, модулі, algorithms
- `docs/05-test-plan.md` — AC (Given-When-Then), тестові рівні
- `docs/06-backlog.md` — задачі T-001..T-022 у порядку виконання

**Перед першим коммітом обовʼязково прочитай 04-tdd.md і 05-test-plan.md.**

**Важливо: TDD v2 — після cross-review!** Ключові архітектурні рішення:
- **4 пули InstancedMesh** (по одному на tileType), не 20. Колір через `instanceColor` attribute.
- **Math-picking (DDA)**, не `raycaster.intersectObject` на мешах — див. TDD §5.2.
- **Окремий модуль `tileResolver.js`** як єдиний оркестратор re-tile. Renderer слухає ТІЛЬКИ `cellResolved`, не `cellChanged`.
- **Save НЕ зберігає `tileType`** — derived, `resolveAll()` після load.
- **Pointer Events з day 1**, не MouseEvents. Drag threshold ≤8px/300мс.
- **iOS Safari 15-16.3 підтримується** через `es-module-shims` polyfill.
- **Central TweenManager**, не per-tween RAF. Keyed by cellKey.

## Стек (НЕ змінювати без обговорення з людиною)

- Vanilla JavaScript (ES2022 modules, без TypeScript)
- Three.js r160 через CDN з import map
- Vitest + happy-dom для unit-тестів
- Playwright для E2E
- Без bundler'ів, без frameworks (React/Vue/Svelte), без lodash/jQuery

Причина фіксації: ми хочемо мінімальний setup без transpile-кроків. **Запуск через `npx serve .` або GitHub Pages** — не подвійним кліком (`file://` ламає ES modules у Chrome). Bundler ламав би vision «одна команда запуску».

## Конвенції коду

### Іменування
- **Файли:** `camelCase.js` (напр. `gameState.js`, `tileLogic.js`)
- **Класи:** `PascalCase` (напр. `GameState`, `Renderer`)
- **Функції, змінні, методи:** `camelCase`
- **Константи (export з constants.js):** `UPPER_SNAKE_CASE` (напр. `GRID_SIZE`, `COLORS`)
- **Приватні поля класів:** `#privateField` (native private через `#`)

### Структура модуля
```js
// 1. imports (third-party першими, потім локальні)
import * as THREE from 'three';
import { GRID_SIZE, COLORS } from './constants.js';

// 2. module-level constants
const LOCAL_CACHE = new Map();

// 3. helper functions (не exported)
function helper() { ... }

// 4. exported class / functions
export class GameState { ... }
export function resolveTile(cell, neighbors) { ... }
```

### Коментарі
- **За замовчанням — не писати коментарів.** Код з хорошими іменами не потребує пояснень «що».
- Якщо додаєш коментар — тільки **«чому»** (не «що»). Приклади коли доречно:
  - Workaround для бага Three.js (посилання на issue)
  - Неочевидний invariant, який не видно з коду
  - Performance-hack (і чому він потрібен)
- JSDoc — тільки для public API класів і експортованих функцій, якщо сигнатура нетривіальна.

### Мова
- Код і commit messages — **англійською**
- Коментарі — можна українською, якщо пояснення складне
- UI-тексти (у DOM і модалках) — **українською** (це гра для укр. дітей)
- console.log / error messages — англійською

## Правила роботи з задачею

### Перед початком
1. Відкрий `docs/06-backlog.md`, знайди задачу T-XXX
2. Прочитай Dependencies — переконайся що попередні задачі зроблені
3. Відкрий `docs/05-test-plan.md`, знайди AC з ID згаданими у DoD
4. Відкрий `docs/04-tdd.md` — знайди відповідні модулі
5. Якщо щось нечітко — **зупинись і запитай людину**, не імпровізуй

### Під час роботи
- **Одна задача = один logical commit** (або PR). Не змішуй T-005 і T-007 в одному коміті.
- Тести пишемо **до** або **одразу з** кодом — не «потім, якщо встигну»
- Якщо задача займає >1.5× estimate — зупинись, повідом, оновлюй план
- Не додаєш npm-залежностей без узгодження
- Не ламаєш публічні API модулів описані у TDD §3

### Після завершення
1. `npm test` — всі зелені
2. Запустити гру локально (`npx serve .`), перевірити що фіча працює
3. Перевірити у Chrome **і** Safari (різні WebGL-імплементації)
4. Відмітити AC [x] у backlog і у Test Plan
5. Оновити статус задачі у backlog (Done / In Review)
6. Commit з форматом нижче

## Чого НЕ робити

- ❌ **Не переписувати архітектуру** «бо я думаю так краще». Якщо дійсно краще — зупинись, напиши обґрунтування людині
- ❌ **Не додавати фреймворки** (React, Vue, Svelte, Angular)
- ❌ **Не додавати TypeScript** (навіть якщо дуже хочеться)
- ❌ **Не додавати bundler** (webpack, vite, rollup, esbuild)
- ❌ **Не робити premature optimization** без профілювання. Спочатку виміряй — потім оптимізуй
- ❌ **Не комітити** `node_modules/`, `.DS_Store`, `.env`, `assets/moodboard/*` (великі файли)
- ❌ **Не міняти `docs/`** без явного запиту користувача. Ці файли — single source of truth
- ❌ **Не писати коментарі-очевидності** (`// increment counter` біля `i++`)
- ❌ **Не ігнорувати console.error / warning** — фіксуй одразу
- ❌ **Не використовувати `any` / `Object.assign` / `eval` / `with`** — є кращі альтернативи
- ❌ **Не використовувати emoji у SVG-іконках UI** — 🧽 не рендериться на Windows/Linux. Тільки inline SVG.
- ❌ **Не використовувати `raycaster.intersectObject` на InstancedMesh** для picking — використовуй math-DDA з TDD §5.2
- ❌ **Не викликати `hit.face.normal` напряму** на InstancedMesh — normal у local space, треба transform через `instanceMatrix`. Краще — math-picking взагалі не читає normal
- ❌ **Не персистити `tileType`** у save — derived state, `resolveAll()` після load
- ❌ **Не писати per-tween `requestAnimationFrame`** — використовуй центральний TweenManager

## Формат комітів

```
[T-XXX] Short imperative description (≤60 chars)

Optional longer body explaining WHY, not WHAT.
Wrap at 72 chars.

- detail 1
- detail 2

Refs: #issue (якщо є)
```

**Приклад:**
```
[T-006] Wire up place/remove to GameState events

Left-click now calls state.setCell, right-click state.removeCell.
Added preventDefault on contextmenu so browser menu doesn't appear.

- LMB in build-mode places cell at picked coord
- RMB removes cell; also works in erase-mode + LMB
- AC-F1-01, AC-F2-01 пройдені
```

**Без:** emoji у тілі коміту, «Co-Authored-By: Claude», рекламних тегів.

## Корисні команди

```bash
# Локальний dev-сервер (CORS вимагає HTTP)
npx serve .
# або
python3 -m http.server 8000

# Unit-тести (watch mode)
npm test

# Unit-тести single-run
npm test -- --run

# E2E тести (Chromium + WebKit)
npm run e2e

# Lint (якщо налаштовано)
npm run lint

# Запуск гри з dev-флагами
# ?dev=1 → показує FPS overlay
# ?grid=0 → ховає сітку
# ?seed=42 → фіксований seed для cityGen
```

## Коли зупинитись і запитати людину

Обовʼязково звертайся до людини, якщо:

- 🤔 **Невідомо яке рішення обрати** — коли є 2+ валідних шляхів
- ❓ **AC неповні або суперечливі** — не додумуй свої
- 🏗️ **Потрібна зміна архітектури** з TDD — це обговорюється
- 📦 **Хочеш додати npm-залежність** — завжди треба approval
- 🔄 **Задача не вміщається в estimate >1.5×** — скоригуємо план
- 🐛 **Знайшов баг у попередній задачі** — домовимось хто фіксить
- 🎨 **Нова UI/UX ідея, якої немає у GDD** — додаємо в backlog, не робимо одразу

Не бійся зупинитись. Краще 5 хвилин на запитання, ніж 2 години на переробку.

## Quality checklist для Pull Request

Перед тим як сказати «готово», пройди цей список:

- [ ] Всі AC задачі позначені [x]
- [ ] Unit-тести додано для нової логіки (≥80% coverage на нових файлах)
- [ ] E2E-тест додано для фічі P0/P1
- [ ] `npm test` всі зелені локально
- [ ] **CI зелений на branch** (GitHub Actions) — не лише локально
- [ ] Гра відкривається і працює у Chrome (через `npx serve`)
- [ ] Гра відкривається і працює у Safari (включно з iOS 15 якщо доступний iPad)
- [ ] FPS ≥ 60 при типовому сценарії (100+ cells) на M1
- [ ] FPS ≥ 30 на Intel UHD 620 laptop (перевірка target-hardware)
- [ ] Немає console.error / warning у DevTools
- [ ] Код відформатовано (консистентно з існуючим)
- [ ] Backlog оновлено (статус, посилання на commit)
- [ ] Немає дебаг-коду (`console.log('TEST')`, коментованих блоків)
- [ ] Немає TODO без посилання на задачу чи issue
