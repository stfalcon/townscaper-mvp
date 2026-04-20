# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-002 завершено — GameState модуль з priority-based event bus, canPlace, immutability, 46 unit + 3 E2E тести.

## Поточний стан
- 🟢 Infra: repo + CI (3 джоби: test + e2e + deploy) + Pages + branch protection (required: Unit tests + E2E)
- 🟢 **T-001 Done:** Three.js scene (dimetric dance under soft sky)
- 🟢 **infra/playwright-setup Done:** агент сам перевіряє через Playwright перед PO-тестом
- 🟢 **T-002 Done:** GameState модуль з повним API з TDD §3.2
- 🟢 Tests: 57 unit (100% coverage gameState.js + constants.js) + 8 E2E
- 🔴 T-003 tileLogic — не розпочато

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-002 merge (commit `b9f5d5c`). Візуально ідентично T-001 — нова логіка state поки не wired.

## Наступна задача
**T-003: tileLogic.js + 10-case data-driven unit test** (1h estimate)

- Pure функція `resolveTile(cell, neighbors)` — 10 рядків з TDD §5.1
- `it.each(fixture)` тест на всі 10 комбінацій
- AC-F3-04, AC-F3-01, AC-F3-02

Потім → T-004 TileResolver → T-005 4-pool InstancedMesh.

## Blockers
Немає. Очікую «ок» від user.

## Історія задач

| T-XXX | Status | Commit | Date |
|-------|--------|--------|------|
| infra-setup | ✅ Done | `c27dc94`, `adb649b` | 2026-04-20 |
| T-001 | ✅ Done | `3a8d6bc` (PR #1) | 2026-04-20 |
| infra/playwright | ✅ Done | `1de8da7` (PR #2) | 2026-04-20 |
| T-002 | ✅ Done | `b9f5d5c` (PR #3) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
