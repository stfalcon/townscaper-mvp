# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** T-001 завершено — перша Three.js сцена задеплоєна. Зелене поле + небо + dimetric камера.

## Поточний стан
- 🟢 Docs v2 + CLAUDE.md
- 🟢 Git repo + CI + Pages + branch protection
- 🟢 **T-001 Done:** Three.js scene з ambient/directional/hemisphere lights, 30×30 ground plane, ortho dimetric camera, RAF loop, WebGL2 detection, stats.js у dev-mode
- 🟢 Tests: 11 passing (2 smoke + 9 constants)
- 🔴 T-002 GameState — не розпочато

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, T-001 merge (commit `3a8d6bc`).

## Наступна задача
**T-002: GameState модуль + canPlace + unit тести** (4h estimate)

- `GameState` з priority-based event bus (не native EventTarget)
- API: getCell, canPlace, setCell, removeCell, updateTile, getNeighbors, all, clear, toJSON, fromJSON
- canPlace перевіряє: out-of-bounds, occupied, too-high, too-many, no-support
- Immutable cells (spread on mutate)
- ≥95% coverage

Після T-002 → T-003 (tileLogic) → T-004 (tileResolver) → T-005 (4 pools).

## Blockers
Немає. Очікую «ок» від user після тесту T-001 URL.

## Історія задач

| T-XXX | Status | Commit | Date |
|-------|--------|--------|------|
| infra-setup | ✅ Done | `c27dc94`, `adb649b` | 2026-04-20 |
| T-001 | ✅ Done | `3a8d6bc` (PR #1) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking)
- Playwright + happy-dom поки не встановлені — додамо у T-002 (happy-dom) і T-007 (Playwright)
- Grid helper lines (T-003 у v1 backlog, P2) — пропустив у T-001, зробимо якщо потрібно візуально
