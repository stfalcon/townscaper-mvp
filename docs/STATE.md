# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-003 завершено — pure `resolveTile` функція з 10-case data-driven test (AC-F3-04). 71 unit + 9 E2E, coverage 100%.

## Поточний стан
- 🟢 Infra: repo + CI (3 джоби: test + e2e + deploy) + Pages + branch protection (required: Unit tests + E2E)
- 🟢 **T-001 Done:** Three.js scene (dimetric dance under soft sky)
- 🟢 **infra/playwright-setup Done:** агент сам перевіряє через Playwright перед PO-тестом
- 🟢 **T-002 Done:** GameState модуль з повним API з TDD §3.2
- 🟢 **T-003 Done:** pure resolveTile + 10-case data-driven test
- 🟢 Tests: 71 unit (100% coverage) + 9 E2E
- 🔴 T-004 TileResolver — не розпочато

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-003 merge (commit `a80c12f`). Візуально ідентично T-001 — нова логіка поки не wired у рендер.

## Наступна задача
**T-004: TileResolver модуль + unit + integration** (3h estimate)

- Новий модуль — єдиний оркестратор re-tile
- Підписується на `cellChanged` priority=1, обчислює tileType для cell + 6 сусідів, кличе `state.updateTile`
- Метод `resolveAll()` для post-load
- AC-F3-03 (scope ≤7), IS-01, IS-05

Потім → T-005 4-pool InstancedMesh → T-006 math-picking → T-007 Place/Remove.

## Blockers
Немає. Очікую «ок» від user.

## Історія задач

| T-XXX | Status | Commit | Date |
|-------|--------|--------|------|
| infra-setup | ✅ Done | `c27dc94`, `adb649b` | 2026-04-20 |
| T-001 | ✅ Done | `3a8d6bc` (PR #1) | 2026-04-20 |
| infra/playwright | ✅ Done | `1de8da7` (PR #2) | 2026-04-20 |
| T-002 | ✅ Done | `b9f5d5c` (PR #3) | 2026-04-20 |
| T-003 | ✅ Done | `a80c12f` (PR #4) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
