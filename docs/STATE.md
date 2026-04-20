# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-005 завершено — 4-пульний InstancedMesh з instanceColor. ПЕРШИЙ візуальний результат: кубики реально зʼявляються на сцені. Зловили і виправили баг чорних кубиків (vertexColors:true vs instanceColor).

## Поточний стан
- 🟢 Infra: repo + CI (3 джоби: test + e2e + deploy) + Pages + branch protection (required: Unit tests + E2E)
- 🟢 **T-001 Done:** Three.js scene (dimetric dance under soft sky)
- 🟢 **infra/playwright-setup Done:** агент сам перевіряє через Playwright перед PO-тестом
- 🟢 **T-002 Done:** GameState модуль з повним API з TDD §3.2
- 🟢 **T-003 Done:** pure resolveTile + 10-case data-driven test
- 🟢 **T-004 Done:** TileResolver (priority=1) + no-op optimization + resolveAll
- 🟢 **T-005 Done:** 4 InstancedMesh пули + instanceColor + swap-remove + dev spawner
- 🟢 Tests: 86 unit (100% coverage) + 16 E2E (11 existing + 5 нові для T-005)
- 🔴 T-006 — math-based picking (DDA) + ghost cursor (5h)

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-005 merge (commit `6ad6bdc`). **Вперше видно voxel-сцену.** Через `?spawn=500` генерується кластер кольорових кубиків.

## Наступна задача
**T-006: Math-based picking (DDA) + ghost cursor** (5h estimate)

- `pick(pointer)` через Amanatides-Woo DDA (TDD §5.2) — raycast тільки по ground plane, далі walk через voxel grid з `state.getCell()`
- Повертає `{ hitCell, placementCoord, face }`
- Ghost cursor (hover-outline mesh) у coord-місці, колір = currentColor (з палітри) для valid, червоний для `canPlace.ok=false`
- Unit test `pick()` на 20 напрямків камери × cell конфігурацій
- NF-1.10: <0.2мс незалежно від кількості cells

Потім T-007 (Place/Remove з drag-threshold) — після цього вже можна буде клікати мишкою.

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
| T-004 | ✅ Done | `85737bc` (PR #5) | 2026-04-20 |
| T-005 | ✅ Done | `6ad6bdc` (PR #6) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
