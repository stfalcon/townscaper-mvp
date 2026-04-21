# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-21
**Що зроблено:** T-014 завершено — scale tweens на place (bounce) / remove (shrink) через TweenManager. Cubes pinned-bottom до cell.y протягом всієї анімації. Plus fix/erase-hover. 122 unit + 74 E2E.

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
- 🟢 **T-013 Done:** Save/Load + debounce + quota/private/corrupt handling
- 🟢 **fix/horizontal-gaps:** freestanding/corner геометрії повернуто до 1×1×1
- 🟢 **T-012 Done:** mode toggle UI, progressive disclosure, erase-feedback
- 🟢 **fix/erase-hover:** outline на самому кубі, не сусідній клітинці
- 🟢 **T-014 Done:** scale-in bounce + scale-out shrink, pinned-bottom geometry
- 🟢 Tests: 122 unit + 74 E2E
- 🔴 Далі — T-016 Random City (wow), T-018 Onboarding (P0 для 7-річки)

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-21, T-014 merge (commit `c38fb20`). **Гра має juice** — кубики bounce-ають з землі на placement і зникають з shrink на remove.

## Наступна задача
**T-016: Random City (2h)** — клавіша `R` → BFS-генератор 30-60 будинків з cascade-анімацією (stagger 40мс/клітинку). Головний wow-момент з Vision. TweenManager + scale animations уже є — тож cascade виглядатиме дуже добре.

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
| T-013 | ✅ Done | `74c5bad` (PR #13) | 2026-04-20 |
| fix/horiz | ✅ Done | `7b6fc16` (PR #14) | 2026-04-20 |
| T-012 | ✅ Done | `6a5c3f7` (PR #15) | 2026-04-20 |
| fix/erase-hover | ✅ Done | `5955ecf` (PR #16) | 2026-04-21 |
| T-014 | ✅ Done | `c38fb20` (PR #17) | 2026-04-21 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- happy-dom поки не встановлений — ще не треба (GameState чиста логіка)
- Coverage thresholds: 95/90/95/95 — gameState.js досяг 100/96/100/100
