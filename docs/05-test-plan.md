# Test Plan + Acceptance Criteria

## 1. Рівні тестування

| Рівень | Що перевіряє | Інструмент | Coverage target |
|--------|-------------|-----------|-----------------|
| **Unit** | Чиста логіка: `GameState`, `tileLogic`, `cityGen`, `saveState` | Vitest + happy-dom | ≥80% модулів з логікою |
| **Integration** | Модулі разом: state → renderer-stub → ui | Vitest з mocked Three.js | P0 сценарії |
| **E2E** | Сценарії в реальному браузері | Playwright (Chromium + WebKit) | Всі P0 user flows |
| **Manual / Playtest** | Живі сесії з дитиною | Спостереження + нотатки | 2 сесії перед релізом |

## 2. Формат Acceptance Criteria

Використовуємо **Given-When-Then**:

```
GIVEN <початковий стан>
  AND <додаткова умова>
WHEN <дія користувача>
THEN <очікуваний результат>
  AND <перевіряємий side effect>
```

Кожне AC має мати **ID** (AC-F1-01, AC-F1-02, ...) для посилань з тестів і backlog'а.

## 3. Фічі і AC

### F1: Поставити будинок

**AC-F1-01**: Placement на порожню ground-клітинку
```
GIVEN порожнє поле
  AND вибраний colorId=2 (Terracotta)
  AND mode='build'
WHEN click (pointerdown + pointerup у межах 8px/300мс) по клітинці (5, 0, 5)
THEN state.getCell(5, 0, 5) === { x:5, y:0, z:5, colorId:2, tileType:'roof' }
  AND Renderer додає instance у pool 'roof' з instanceColor = Terracotta
  AND інстанс доступний на НАСТУПНИЙ RAF (вимірюється через performance.mark у E2E)
  AND запускається scale-in анімація тривалістю 250мс
  AND через 2с автозбереження у localStorage
```
_Примітка: timing-metric "≤100мс" перенесено у NF-1.7 (performance budget), бо Playwright не гарантує sub-frame timing._

**AC-F1-02**: Placement поверх існуючого будинку
```
GIVEN будинок у (5, 0, 5)
WHEN ЛКМ по верхній грані цього будинку
THEN зʼявляється новий будинок у (5, 1, 5)
  AND tileType попереднього = 'wall' (бо hasAbove=true, 0 horizontal)
  AND tileType нового = 'roof'
```

**AC-F1-03**: Placement збоку від будинку
```
GIVEN будинок у (5, 0, 5)
WHEN ЛКМ по східній грані цього будинку
THEN зʼявляється новий будинок у (6, 0, 5)
  AND обидва отримують tileType='roof' (бо hasAbove=false для обох)
```

**AC-F1-04**: Placement поза межами
```
GIVEN курсор миші за межами 30×30 поля
WHEN ЛКМ
THEN нічого не відбувається
  AND state не змінюється
```

**AC-F1-05**: Placement у режимі erase — silent-failure protection
```
GIVEN mode='erase'
WHEN ЛКМ по порожній клітинці
THEN state не змінюється
  AND зʼявляється inline toast "Ти стираєш 🧽" біля курсора на 1с
  AND mode-button робить shake-animation 300мс
```

**AC-F1-06** (NEW): Edge case — placement at y=9 (максимум)
```
GIVEN башта 10 поверхів (y=0..9) у (5,*,5)
WHEN click по верхній грані (5,9,5)
THEN state.canPlace(5,10,5) === { ok:false, reason:'too-high' }
  AND placement не відбувається
  AND нема crash, нема console.error
```

**AC-F1-07** (NEW): Edge case — plating на floating cell (no support)
```
GIVEN ground clear
WHEN намагатись поставити cell у (5,5,5) без опори під/поряд
THEN state.canPlace(5,5,5) === { ok:false, reason:'no-support' }
  AND hover-outline показується ЧЕРВОНИМ (invalid)
  AND click ігнорується
```

**AC-F1-08** (NEW): Edge case — rapid click spam
```
GIVEN порожнє поле
WHEN 100 click events у ту саму клітинку за 1 секунду
THEN state має рівно 1 cell (повторні click на occupied — no-op)
  AND немає console.error
  AND FPS під час спаму лишається ≥30
```

**AC-F1-09** (NEW): Drag-vs-click threshold
```
GIVEN mouse down на клітинці (5,0,5)
WHEN pointermove на 20px AND pointerup через 100мс
THEN placement НЕ відбувається (перевищено 8px drag threshold)
```

### F2: Видалити будинок

**AC-F2-01**: Видалення ПКМ
```
GIVEN будинок у (5, 0, 5)
WHEN ПКМ по цьому будинку
THEN state.getCell(5, 0, 5) === null
  AND mesh зникає зі сцени (після 150мс scale-out анімації)
  AND сусіди (5,0,4), (5,0,6), (4,0,5), (6,0,5) отримують оновлений tileType
  AND контекстне меню браузера НЕ показується (preventDefault)
```

**AC-F2-02**: Erase-mode + ЛКМ
```
GIVEN mode='erase', будинок у (5, 0, 5)
WHEN ЛКМ по цьому будинку
THEN будинок видаляється (як при ПКМ)
```

**AC-F2-03**: Видалення нижнього поверху башти
```
GIVEN будинок у (5, 0, 5) і (5, 1, 5)
WHEN ПКМ по (5, 0, 5)
THEN (5, 0, 5) видаляється
  AND (5, 1, 5) залишається "в повітрі" (поки не валить — це OK для MVP)
```

### F3: Автоматичний вибір тайла за сусідами

**AC-F3-01**: Freestanding → corner при першому сусіді
```
GIVEN будинок у (0,0,0), tileType='roof' (freestanding ефективно, але roof бо !hasAbove)
WHEN ставимо будинок у (1,0,0)
THEN обидва — tileType='roof' (бо hasAbove=false для обох)
```

**AC-F3-02**: Wall vs corner vs freestanding з above
```
GIVEN будинки у (0,0,0), (1,0,0), (0,1,0) — L-подібна форма 2 поверхи
WHEN ставимо (2,0,0)
THEN:
  (0,0,0): horizontal=1 (east), hasAbove=true → 'corner'
  (1,0,0): horizontal=2 (west+east), hasAbove=false → 'roof'
  (2,0,0): horizontal=1 (west), hasAbove=false → 'roof'
  (0,1,0): hasAbove=false → 'roof'
```

**AC-F3-03**: Re-tile scope обмежений 7 клітинками
```
GIVEN 100 будинків на полі
  AND spy = vi.spyOn(tileLogic, 'resolveTile')
WHEN ставимо новий у (15, 0, 15)
THEN spy.mock.calls.length ≤ 7
  (для самого cell + 6 сусідів: 4 horizontal + above + below)
```

**AC-F3-04** (NEW): Data-driven test усіх 10 кейсів таблиці TDD §5.1
```
GIVEN test fixture 10 рядків:
  [
    { horizontal: 0, hasAbove: false, expected: 'roof' },
    { horizontal: 0, hasAbove: true,  expected: 'freestanding' },
    { horizontal: 1, hasAbove: false, expected: 'roof' },
    { horizontal: 1, hasAbove: true,  expected: 'corner' },
    { horizontal: 2, hasAbove: false, expected: 'roof' },
    { horizontal: 2, hasAbove: true,  expected: 'wall' },
    { horizontal: 3, hasAbove: false, expected: 'roof' },
    { horizontal: 3, hasAbove: true,  expected: 'wall' },
    { horizontal: 4, hasAbove: false, expected: 'roof' },
    { horizontal: 4, hasAbove: true,  expected: 'wall' },
  ]
WHEN it.each(fixture) виконує resolveTile
THEN для кожного рядка результат === expected
```

### F4: Вибір кольору

**AC-F4-01**: Клавіатура 1-5
```
GIVEN гра запущена, selectedColorId=1
WHEN натиснути клавішу "3"
THEN selectedColorId === 3
  AND UI-палітра підсвічує button #3
  AND hover-outline (якщо видимий) змінює колір на Sage
```

**AC-F4-02**: Клік по палітрі
```
GIVEN selectedColorId=1
WHEN клік по 5-й circle-button у палітрі
THEN selectedColorId === 5
  AND кнопка робить pulse-animation (scale 1→1.15→1, 150мс)
```

**AC-F4-03**: Клавіші 0, 6-9 ігноруються
```
GIVEN selectedColorId=2
WHEN натиснути "7"
THEN selectedColorId залишається 2
```

### F5: Збереження і завантаження

**AC-F5-01**: Автозбереження після placement
```
GIVEN порожнє поле, localStorage порожній
WHEN поставити будинок у (5,0,5)
  AND почекати 2.1 секунди
THEN localStorage.getItem('townscaper-mvp-v1') містить JSON з версією 'v1' і 1 cell
```

**AC-F5-02**: Завантаження при старті
```
GIVEN localStorage містить валідний save з 10 cells
WHEN сторінка перезавантажується
THEN всі 10 cells відновлені на сцені
  AND tileType для всіх перераховано (не довіряємо збереженому)
  AND позиція камери відновлена
  AND selectedColorId відновлений
```

**AC-F5-03**: Graceful handling пошкодженого save
```
GIVEN localStorage містить некоректний JSON
WHEN сторінка завантажується
THEN поле порожнє
  AND в консоль warning
  AND localStorage очищується
  AND помилка не блокує гру
```

**AC-F5-04**: Debounce
```
GIVEN поле з 5 cells
WHEN швидко поставити 10 cells за 1 секунду
THEN localStorage.setItem викликається не більше 2 разів (не 10)
```

**AC-F5-05** (NEW): Quota exceeded
```
GIVEN localStorage mock throw QuotaExceededError on setItem
WHEN auto-save спрацьовує
THEN показується non-blocking toast "Не вдалось зберегти (місце вичерпано)"
  AND гра продовжує працювати in-memory
  AND наступні placements не крашать
```

**AC-F5-06** (NEW): localStorage недоступний (Safari private mode)
```
GIVEN localStorage throw SecurityError / undefined
WHEN startup
THEN fallback у in-memory Map
  AND banner "Збереження вимкнено" у top bar
  AND після F5 — стан втрачається (очікувана поведінка)
  AND немає console.error, game playable
```

**AC-F5-07** (NEW): tileType не персистується
```
GIVEN save з 20 cells створений на v1
WHEN load
THEN cells у state мають tileType = null одразу після fromJSON
  AND tileResolver.resolveAll() викликається
  AND всі cells отримують правильний tileType
```

### F6: Random city

**AC-F6-01**: Генерація (with seeded RNG для детермінізму)
```
GIVEN будь-який стан поля
  AND seeded rng (seed=42)
WHEN натиснути "R"
THEN попередні cells очищаються (очищення теж анімоване)
  AND через ≤ 2 сек на полі рівно N будинків (детерміновано для seed=42)
  AND будинки утворюють звʼязний кластер (BFS property)
  AND для seed=42: ≥3 різних кольорів, ≥30 cells, ≤60 cells
  AND FPS не падає нижче 30 під час генерації
  AND saveState.pause()/resume() оточує генерацію (немає 20 debounced saves)
```

**AC-F6-02**: Стабільність
```
GIVEN будь-який стан
WHEN натиснути "R" 10 разів поспіль
THEN гра не крашиться
  AND кінцеве місто — результат останньої генерації (попередні відмінені)
```

### F7: Clear all — hold-to-confirm (v2)

**AC-F7-01**: Hold-to-confirm UI
```
GIVEN ≥1 будинок на полі
WHEN натиснути "C" або клік по trash-іконці
THEN зʼявляється велика кнопка "Утримай щоб стерти" з radial progress
  AND кнопка НЕ клікабельна моментально
  AND радіальний прогрес заповнюється 1.5с при утримуванні
  AND canvas заблокований від інтеракції поки modal відкритий
```

**AC-F7-02**: Completion через hold
```
GIVEN hold-button відкрита
WHEN користувач утримує кнопку 1.5с повних
THEN всі будинки видаляються з fade-out
  AND localStorage очищається
  AND modal закривається
```

**AC-F7-03**: Abort через release / ESC
```
GIVEN hold-button утримується 0.8с
WHEN користувач відпускає АБО натискає ESC
THEN прогрес резетиться
  AND modal закривається (через ESC) або чекає наступного hold
  AND будинки ЗАЛИШАЮТЬСЯ
  AND localStorage незмінений
```

### F8: Hover-preview

**AC-F8-01**: Hover на порожній клітинці
```
GIVEN selectedColorId=2, mode='build'
WHEN курсор над клітинкою (5,0,5) без будинку
THEN outline-mesh зʼявляється у (5,0,5)
  AND колір outline = Terracotta з alpha 0.4
  AND fade-in за 100мс
```

**AC-F8-02**: Hover виходить за межі
```
GIVEN курсор над (5,0,5)
WHEN курсор залишає canvas (на палітру)
THEN outline fade-out за 80мс
  AND після закінчення видаляється зі сцени
```

### F9: Камера — привʼязано до T-CAM

**AC-F9-01**: Rotate Q/E (tied to T-CAM)
```
GIVEN yaw=45°
WHEN натиснути "E"
THEN yaw tweens до 135° за 200мс (easeInOutCubic)
  AND сцена відрендерена у новій позиції
  AND ongoing placement animations не переривається
```

**AC-F9-02**: Zoom (tied to T-CAM)
```
GIVEN zoom=1.0
WHEN прокрутити колесо вгору (delta negative)
THEN zoom стає 1.1 (з clamp до 2.0)
```

**AC-F9-03** (NEW): Zoom clamp upper bound
```
GIVEN zoom=2.0
WHEN прокрутити колесо вгору ще
THEN zoom залишається 2.0 з spring-bounce 50px visual feedback
```

**AC-F9-04** (NEW): Zoom clamp lower bound
```
GIVEN zoom=0.5
WHEN прокрутити колесо вниз
THEN zoom залишається 0.5 з spring-bounce
```

### F11: Keyboard grid cursor (NEW для WCAG 2.1.1)

**AC-F11-01**: Arrow keys рухають ghost-cursor
```
GIVEN canvas має focus, немає hover
WHEN натиснути ArrowRight
THEN ghost-cursor виділяє клітинку (16, 0, 15) (від центру +1 east)
  AND outline видимий у кольорі палітри
```

**AC-F11-02**: Space розміщує у позиції ghost-cursor
```
GIVEN ghost-cursor на (5, 0, 5)
WHEN натиснути Space
THEN state має cell у (5, 0, 5)
  AND поведінка ідентична кліку миші
```

**AC-F11-03**: Delete видаляє
```
GIVEN ghost-cursor на (5, 0, 5) з cell
WHEN натиснути Delete або Backspace
THEN cell видаляється
```

### F12: Surprise color unlock (NEW)

**AC-F12-01**: Unlock після 10 placements
```
GIVEN 9 cells поставлено
WHEN поставити 10-й
THEN 6-та circle-button у палітрі fade-in
  AND sparkle-animation 400мс
  AND інший існуючий UI не рухається (no layout shift)
```

### F10: Help / Onboarding

**AC-F10-01**: Перший запуск
```
GIVEN localStorage порожній (перший запуск)
WHEN сторінка завантажена ≥ 3 секунди і жодного кліку не було
THEN зʼявляється підказка "Тикни — побудуй!" над центральною клітинкою
  AND центральна клітинка пульсує white outline
```

**AC-F10-02**: Help modal
```
GIVEN будь-який стан
WHEN клік по ? кнопці або натиснути "H"
THEN зʼявляється повноекранний overlay з controls-таблицею
  AND є кнопка "Закрити" і спрацьовує ESC
```

## 4. Non-functional AC

### NF-1: Performance (v2)

| ID | Сценарій | Критерій |
|----|----------|----------|
| NF-1.1 | Idle (порожнє поле) | 60 FPS, <5% CPU |
| NF-1.2 | 500 будинків, M1 Mac + Chrome | 60 FPS |
| NF-1.3 | 2000 будинків, M1 | ≥30 FPS |
| NF-1.4 | Random city генерація | ≥30 FPS під час cascade |
| NF-1.5 | Початкове завантаження 4G empty cache | ≤3с |
| NF-1.6 | Memory @ 2000 cells | ≤100 MB (tightened проти v1 200 MB) |
| **NF-1.7** | **500 cells, Intel UHD 620 (типовий батьківський ноут)** | **≥30 FPS — основна target-машина** |
| NF-1.8 | iPad 2020 Safari 16.4+, 500 cells | ≥30 FPS |
| NF-1.9 | Click latency: від `pointerdown` до instance у scene | ≤1 RAF tick (~16мс) |
| NF-1.10 | Picking (math-DDA) cost | ≤0.2мс незалежно від кількості cells |

### NF-2: Accessibility

| ID | Критерій |
|----|----------|
| NF-2.1 | Всі UI-елементи доступні через Tab (focus ring видимий) |
| NF-2.2 | Контраст тексту UI ≥ 4.5:1 (WCAG AA) |
| NF-2.3 | Кольори будинків ≥ 3:1 проти трави (не-текст WCAG AA) |
| NF-2.4 | Всі кнопки ≥ 48×48 px (touch target, Apple HIG / Google M3) |
| NF-2.5 | Немає flashing >3Hz (photosensitive safety) |
| NF-2.6 | Помилка сумісності браузера показується текстом (fallback, не чорний екран) |

### NF-3: UX для дітей

| ID | Критерій | Як перевіряємо |
|----|----------|----------------|
| NF-3.1 | 7-річна дитина ставить перший будинок ≤30 сек без пояснень | Playtest |
| NF-3.2 | 12-річна дитина знаходить Random city (R) ≤5 хв | Playtest |
| NF-3.3 | Немає блокуючих модалок при першому старті | E2E |
| NF-3.4 | Undo не потрібен (дія по ПКМ = миттєве виправлення) | Design review |
| NF-3.5 | Весь UI-текст — українською, простими словами | Manual review |

### NF-4: Browser compat

| ID | Браузер | Критерій |
|----|---------|----------|
| NF-4.1 | Chrome 100+ (desktop) | Все працює |
| NF-4.2 | Safari 16+ (macOS) | Все працює |
| NF-4.3 | Firefox 108+ | Все працює |
| NF-4.4 | Chrome 110 на Android | Game playable (stretch) |
| NF-4.5 | iOS Safari 16 на iPad | Game playable (stretch) |

## 5. Manual playtest plan

**Сесія 1 (5 дня перед релізом): з 7-річкою**
- Запустити гру, НЕ пояснювати нічого
- Нотувати: час до першого будинку, моменти frustration, що спробував
- Запитати після 10 хв: «що було цікаво? що незрозуміло?»
- Оновити backlog з P2-P3 issues

**Сесія 2 (3 дня перед релізом): з 12-річкою**
- Те саме, але показати help один раз
- Перевірити: чи знайде R? чи використає палітру? чи розбере re-tile?
- Запитати: «як думаєш, а ти міг би зробити щось схоже з АІ?»

## 6. Bug severity

- **P0 (Blocker):** гра не запускається; crash під час гри; дані втрачаються
- **P1 (Critical):** ключова механіка зламана (клік не ставить будинок; save не працює)
- **P2 (Major):** некритична фіча зламана (random city кривий; hover не показується)
- **P3 (Minor):** візуальні/UX дрібниці (анімація трохи лагає; tooltip запізнюється)

## 6a. Integration scenarios (NEW — gap-fill між unit і E2E)

Запускаються у Vitest з mocked Three.js (`vi.mock('three')`):

**IS-01: State → TileResolver → Renderer**
```
GIVEN mock Renderer shim що записує allocate/free calls
WHEN state.setCell(5,0,5,{colorId:2})
THEN у порядку:
  1. state emit 'cellChanged'
  2. resolver обчислює tileType='roof'
  3. state emit 'cellResolved'
  4. renderer.onCellResolved викликається рівно раз
  5. renderer.allocate викликається з (pool='roof', color=2)
```

**IS-02: State → SaveState debounce**
```
GIVEN mocked localStorage
WHEN 10 setCell за 500мс
THEN localStorage.setItem викликається ≤1 раз протягом 3 сек
  AND stringified payload не містить field 'tileType' у cells[]
```

**IS-03: Save → Load round-trip з resolveAll**
```
GIVEN 20 cells розставлені з різними tileType
WHEN state.toJSON() → save → new state → state.fromJSON() → resolver.resolveAll()
THEN всі tileType перераховані коректно
  AND жоден cell не має tileType=null після resolveAll
```

**IS-04: City gen with pause**
```
GIVEN saveState attached
WHEN cityGen.generate(state, {seed:42})
THEN saveState.pause() викликається на старті
  AND saveState.resume() на кінці
  AND localStorage.setItem викликається лише ≤1 раз після завершення (не 20)
```

**IS-05: Event priority order**
```
GIVEN custom bus з 3 listeners: tileResolver (p=1), renderer (p=2), saveState (p=3)
WHEN emit 'cellChanged'
THEN listeners викликаються у порядку 1→2→3 детерміновано
```

## 7. Definition of Done (для задачі з backlog)

Задача `T-XXX` вважається готовою коли:
- [ ] Всі повʼязані AC (перелічені у задачі) проходять
- [ ] Unit-тести для нової логіки зелені (якщо фіча має логіку)
- [ ] E2E-тест додано для фічі P0/P1
- [ ] Немає регресій у існуючих тестах
- [ ] Ручна перевірка у Chrome + Safari пройдена
- [ ] FPS перевірено (не впав проти попередньої ітерації)
- [ ] Backlog оновлено (статус, посилання на PR / commit)
- [ ] Немає console.error у DevTools

## 8. Release criteria (готовність MVP)

MVP відпускаємо дітям коли:
- ✅ Всі P0-фічі (F1-F12) мають AC 100% зелених
- ✅ NF-1 (performance) всі зелені, **включно з NF-1.7 Intel UHD**
- ✅ NF-2 (accessibility) всі зелені
- ✅ Обидві playtest-сесії (NF-3) пройдені, UX-7 ✅ UX-12 ✅ (з Vision)
- ✅ Працює у Chrome + Safari на батьківському ноуті
- ✅ 0 відкритих P0-P1 bugs
- ✅ ≤3 відкритих P2 bugs (P3 можна лишити на пост-MVP)
- ✅ CI зелений на main branch (GitHub Actions)

## 9. Test execution / CI (NEW)

**Локально:**
```bash
npm test              # vitest, watch mode
npm test -- --run     # single run
npm run test:coverage # coverage report
npx playwright test   # E2E headed (Chromium + WebKit)
npx playwright test --ui  # debug mode
```

**GitHub Actions (`.github/workflows/ci.yml`):**
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test -- --run --coverage
      - run: npx playwright install chromium webkit
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**Test fixtures:**
- Unit: `beforeEach(() => localStorage.clear())` у saveState tests
- Integration: `vi.mock('three')` з минімальним shim (stubs для InstancedMesh, Raycaster, Camera)
- E2E: fresh browser context per spec (Playwright default), `page.evaluate(() => localStorage.clear())` у beforeEach

**AI-агент DoD:** «тести зелені» = **CI зелений на branch**, не просто локально. Без CI немає гарантії.

## 10. Manual playtest — посилені правила (v2 після UX-ревʼю)

- **Мінімум 2 сесії на вік.** Якщо дитина 7 один з 2 provides negative feedback (не може почати за 60с) — це **P0 bug, блок релізу**.
- **Запис сесії** (OBS/QuickTime) для пост-аналізу frustration-points.
- **Спостерігач не підказує** протягом перших 3 хвилин, навіть якщо дитина явно застрягла.
- **Після-сесія інтервʼю** (5 питань, ≤3 хв): «Що було цікаво?», «Що не вийшло?», «Що треба додати?».
- **Fallback plan:** якщо UX-7 fail — переформатувати onboarding (T-018 P0 rework), відкласти реліз на 1 вечір.
