# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-011 завершено — UI палітра з 5+1 кольорів, клавіші 1-6, Surprise unlock після 10 placements. Плюс по ходу — fix/tile-vertical-gaps (видно було щілини між поверхами). 107 unit + 50 E2E.

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
- 🟢 **T-CAM Done:** Q/E rotate + wheel zoom + TweenManager
- 🟢 **T-008 Done:** 4 silhouette-distinct geometries (30% height delta)
- 🟢 **hotfix tile-vertical-gaps:** stacked cells touch правильно
- 🟢 **T-011 Done:** палітра UI + клавіші 1-6 + Surprise unlock
- 🟢 Tests: 107 unit + 50 E2E
- 🔴 T-013 — Save/Load з edge cases (4h) — наступне

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-011 merge (commit `3af703a`). **Палітра UI — можна грати повноцінно**: вибирай колір кліком або 1-5, склади місто, отримай 6-й Surprise-колір після 10 будинків.

## Наступна задача
**T-013: Save/Load у localStorage з edge cases** (4h)

- Debounced auto-save 2с
- `pause()/resume()` для cityGen
- `QuotaExceededError` → toast, continue in-memory
- `localStorage` недоступний (Safari private mode) → fallback to Map + banner
- `fromJSON` → resolver.resolveAll() (бо tileType не персистується)
- Mock-based unit tests
- AC-F5-01..07, IS-02, IS-03

Після T-013 гра «справжня» — F5 не втрачає місто.

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
| T-CAM | ✅ Done | `c125a59` (PR #9) | 2026-04-20 |
| T-008 | ✅ Done | `006db2b` (PR #10) | 2026-04-20 |
| fix/gaps | ✅ Done | `f1cbe98` (PR #11) | 2026-04-20 |
| T-011 | ✅ Done | `3af703a` (PR #12) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
