# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-004 завершено — TileResolver модуль, priority-based orchestrator re-tile з no-op optimization і resolveAll для post-load. 86 unit + 11 E2E, coverage 100%.

## Поточний стан
- 🟢 Infra: repo + CI (3 джоби: test + e2e + deploy) + Pages + branch protection (required: Unit tests + E2E)
- 🟢 **T-001 Done:** Three.js scene (dimetric dance under soft sky)
- 🟢 **infra/playwright-setup Done:** агент сам перевіряє через Playwright перед PO-тестом
- 🟢 **T-002 Done:** GameState модуль з повним API з TDD §3.2
- 🟢 **T-003 Done:** pure resolveTile + 10-case data-driven test
- 🟢 **T-004 Done:** TileResolver (priority=1) + no-op optimization + resolveAll
- 🟢 Tests: 86 unit (100% coverage) + 11 E2E
- 🔴 T-005 — 4-pool InstancedMesh + instanceColor (6h, найбільша задача рендеру)

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-004 merge (commit `85737bc`). Візуально ідентично T-001 — логіка (state + resolver) готова, рендер ще не wired.

## Наступна задача
**T-005: 4-пульні InstancedMesh + instanceColor** (6h estimate)

- 4 `InstancedMesh` пули (по одному на tileType), не 20
- Колір через `InstancedBufferAttribute('instanceColor', 3)` + `MeshLambertMaterial({vertexColors: true})`
- Swap-remove allocate/free instanceId
- Setup `mesh.computeBoundingSphere()` для frustum culling
- Dev spawner `?dev=1&spawn=500` для measurement FPS
- DoD: 60 FPS @ 500 cells на M1

Це найбільша задача — після неї буде ВИДНО кубики на сцені (хоч без кліку ще).

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

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
