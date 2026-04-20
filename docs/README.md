# Cozy Town Builder — Документація (v2)

Townscaper-подібна sandbox-гра для дітей 7-12 років, браузерна. Запускається через `npx serve .`.

> **v2 (після cross-review):** усі 7 документів переглянуті 6 профільними агентами (architect-reviewer, frontend-architect, ui-ux-designer, quality-engineer, requirements-analyst, performance-engineer). Критичні знахідки враховані — див. changelog нижче.

## Порядок читання

1. **[01-vision.md](./01-vision.md)** — One-pager: що, для кого, чому. Бінарні success criteria.
2. **[02-gdd.md](./02-gdd.md)** — Game Design: геймплей, контроли, UX-флоу, onboarding arrow, erase-toast, hold-to-confirm
3. **[03-art-brief.md](./03-art-brief.md)** — Візуал, 5+1 палітра, Y-gradient замість AO, SVG-іконки
4. **[04-tdd.md](./04-tdd.md)** — Архітектура v2: 4 пули, math-picking, tileResolver, PointerEvents
5. **[05-test-plan.md](./05-test-plan.md)** — 60+ AC, integration scenarios, CI, edge cases
6. **[06-backlog.md](./06-backlog.md)** — 24 задачі MVP (включно з T-CAM, T-DEMO, T-README, T-ERR, T-CI, T-CDN), **~60 годин**
7. **[07-agents-md.md](./07-agents-md.md)** — Інструкції для АІ-агента з anti-patterns (v2)

## Статус

| # | Документ | Статус |
|---|----------|--------|
| 1 | Vision | 🟢 v2 Готово |
| 2 | GDD | 🟢 v2 Готово |
| 3 | Art Brief | 🟢 v2 Готово |
| 4 | TDD | 🟢 v2 Готово |
| 5 | Test Plan | 🟢 v2 Готово |
| 6 | Backlog | 🟢 v2 Готово |
| 7 | AGENTS.md | 🟢 v2 Готово |

## Квік-навігація

- Хочу зрозуміти **що це за гра** → [01-vision.md](./01-vision.md)
- Хочу **грати і бачити як це виглядатиме** → [02-gdd.md](./02-gdd.md) §4 (UX-флоу)
- Хочу **почати реалізацію** → [06-backlog.md](./06-backlog.md) → `T-001`
- Я АІ-агент, беру задачу → [07-agents-md.md](./07-agents-md.md) спочатку
- Хочу перевірити чи фіча **готова** → [05-test-plan.md](./05-test-plan.md) → DoD + AC

## Ключові рішення (v2)

- **Стек:** Vanilla JS + Three.js r160 через jsdelivr + `es-module-shims` polyfill
- **Запуск:** `npx serve .` (не `file://` подвійний клік — CORS ламає ES modules)
- **Сітка:** квадратна 30×30, до 10 поверхів
- **Рендер:** 4 `InstancedMesh` пули + `instanceColor` attribute (не 20 пулів)
- **Picking:** math-based DDA, без raycast по мешах (<0.2мс незалежно від кількості cells)
- **Tile resolver:** окремий модуль з priority-bus (оркеструє re-tile)
- **Save:** не персистує `tileType` (derived), з edge cases для quota / private mode
- **Тайли:** 4 процедурні варіації з Y-gradient vertex colors (не baked AO)
- **Палітра:** 5 muted + 1 **Surprise** unlock-після-10 (для 7yo retention)
- **Іконки:** inline SVG, не emoji
- **Input:** Pointer Events з day 1 (не MouseEvents), drag-threshold 8px/300мс
- **Keyboard:** arrow-key grid cursor для WCAG 2.1.1
- **Час:** ~60 годин (після реалістичного recount)
- **Аудиторія:** 7 і 12 років, progressive disclosure, onboarding arrow для 7yo

## Changelog v1 → v2 (після cross-review)

### Critical fixes (знайдено 2+ агентами)
- 4 InstancedMesh пули + instanceColor (раніше 20 — wrong axis)
- Math-picking DDA замість `intersectObject` на InstancedMesh
- Окремий `tileResolver.js` як оркестратор (раніше неявно у `main.js`)
- Save не персистує `tileType`
- Estimate 26h → 32h → 48h → **60h** (після додавання Ops-задач)
- iOS Safari 15 через `es-module-shims` (раніше казали «16.4+ only»)
- Vision success criteria → бінарні measurable

### UX fixes (7yo focus)
- Onboarding SVG-arrow anchored до viewport center
- Erase-mode toast + auto-switch після 3 no-op кліків
- Hold-to-confirm для Clear (замість Yes/No модалки)
- 6-й Surprise color unlock після 10 placements
- Micro-celebrations (10 cells, перша башта, 30 cells)
- SVG-іконки замість emoji 🧽
- Typography явні розміри (body 18px, hint 16px, headline 28px)
- Keyboard grid cursor (arrow keys + Space)

### Quality fixes
- AC-F3-04 data-driven test 10 кейсів (раніше 3)
- AC-F1-06..09 edge cases (y=9, no-support, rapid clicks, drag-threshold)
- AC-F5-05..07 edge cases (quota, private mode, tileType не персистується)
- AC-F9-03/04, AC-F11, AC-F12 — нові ACs
- Integration scenarios §6a (IS-01..05)
- CI section §9 з GitHub Actions
- NF-1.7 Intel UHD 620 benchmark (раніше лише M1)

### New tasks
- T-CAM (camera rotate + zoom) — раніше bundled у T-001
- T-DEMO (demo script + preflight) — валідація мети проєкту
- T-README, T-CDN, T-ERR, T-CI — Ops epic E8
