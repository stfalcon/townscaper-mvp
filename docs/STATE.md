# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-007 завершено — гра нарешті ГРАБЕЛЬНА МИШКОЮ. ЛКМ ставить, ПКМ стирає. Drag-threshold 8px/300мс проти випадкових дитячих micro-drag. 96 unit + 27 E2E.

## Поточний стан
- 🟢 Infra: repo + CI (3 джоби: test + e2e + deploy) + Pages + branch protection (required: Unit tests + E2E)
- 🟢 **T-001 Done:** Three.js scene (dimetric dance under soft sky)
- 🟢 **infra/playwright-setup Done:** агент сам перевіряє через Playwright перед PO-тестом
- 🟢 **T-002 Done:** GameState модуль з повним API з TDD §3.2
- 🟢 **T-003 Done:** pure resolveTile + 10-case data-driven test
- 🟢 **T-004 Done:** TileResolver (priority=1) + no-op optimization + resolveAll
- 🟢 **T-005 Done:** 4 InstancedMesh пули + instanceColor + swap-remove + dev spawner
- 🟢 **T-006 Done:** DDA picking + hover ghost cursor (pointer-driven)
- 🟢 **T-007 Done:** ЛКМ place + ПКМ remove + drag-threshold + erase-mode
- 🟢 Tests: 96 unit + 27 E2E
- 🔴 Далі — або T-008 (4 різні tile-геометрії) або T-CAM (rotate Q/E + zoom)

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-007 merge (commit `0cb18c8`). **Гра ГРАБЕЛЬНА мишкою.** ЛКМ ставить, ПКМ стирає.

## Наступна задача (на вибір user)

**Варіант A — T-008: 4 різні tile-геометрії** (3h)
- freestanding куб з пірамідальним дашком
- wall простий куб
- corner кубик зі скошеним верхнім ребром
- roof з низькою пірамідою/hipped-roof
- Y-gradient vertex colors (не baked AO)
- Silhouette height delta ≥15% між варіантами

**Варіант B — T-CAM: Камера обертання Q/E + zoom** (2h)
- Q/E → yaw ±90° snap, 200мс easeInOutCubic
- Колесо → zoom 0.1 step, clamp 0.5-2.0 + spring-bounce
- AC-F9-01..04

Обидва дають візуально суттєве покращення. T-008 даje «чому це не просто Minecraft», T-CAM — interactive feel. Рекомендую T-CAM першим — після нього я зможу протестувати picking під різними кутами у T-008.

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
| T-006 | ✅ Done | `fa9d692` (PR #7) | 2026-04-20 |
| T-007 | ✅ Done | `0cb18c8` (PR #8) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
