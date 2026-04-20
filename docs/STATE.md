# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-006 завершено — Math-based picking (DDA) + hover ghost cursor. Курсор тепер «йде» за мишкою по сітці з wireframe-підсвіткою. Червоний для невалідних позицій. 96 unit + 20 E2E.

## Поточний стан
- 🟢 Infra: repo + CI (3 джоби: test + e2e + deploy) + Pages + branch protection (required: Unit tests + E2E)
- 🟢 **T-001 Done:** Three.js scene (dimetric dance under soft sky)
- 🟢 **infra/playwright-setup Done:** агент сам перевіряє через Playwright перед PO-тестом
- 🟢 **T-002 Done:** GameState модуль з повним API з TDD §3.2
- 🟢 **T-003 Done:** pure resolveTile + 10-case data-driven test
- 🟢 **T-004 Done:** TileResolver (priority=1) + no-op optimization + resolveAll
- 🟢 **T-005 Done:** 4 InstancedMesh пули + instanceColor + swap-remove + dev spawner
- 🟢 **T-006 Done:** DDA picking + hover ghost cursor (pointer-driven)
- 🟢 Tests: 96 unit + 20 E2E
- 🔴 T-007 — PointerEvents place/remove з drag-threshold (3h)

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-006 merge (commit `fa9d692`). **Hover cursor працює** — водиш мишкою, бачиш wireframe-виділення.

## Наступна задача
**T-007: PointerEvents + Place/Remove з drag-threshold** (3h estimate)

- ЛКМ → `state.setCell` з currentColor (поки hardcoded 1)
- ПКМ → `state.removeCell` + preventDefault на contextmenu
- Drag detection: ≤8px, ≤300мс → click, інакше ignore
- Passive:false для wheel (для T-CAM далі)
- Focus management: tabindex=0, auto-focus на pointerdown
- AC-F1-01..09, AC-F2-01..03

Після цього вже можна буде справді грати мишкою. Далі T-008 (4 варіації геометрій) або T-CAM (камера обертання).

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

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
