# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** Infra setup завершено — repo створено, CI + Pages працюють, перший deploy зелений.

## Поточний стан
- 🟢 Docs v2 (7 файлів після cross-review)
- 🟢 CLAUDE.md у корені
- 🟢 Git repo: https://github.com/stfalcon/townscaper-mvp (public)
- 🟢 CI workflow: `.github/workflows/ci.yml` — test + deploy, **зелений**
- 🟢 Branch protection на main: require «Unit tests» green, no force-push, no deletions
- 🟢 GitHub Pages: `https://stfalcon.github.io/townscaper-mvp/` (HTTP 200)
- 🟢 Smoke tests: 2 passing (infrastructure validation)
- 🔴 Код гри: не починався (наступне — T-001)

## Deploy URL
**https://stfalcon.github.io/townscaper-mvp/**
Last deploy: 2026-04-20, initial infra commit (placeholder page).

## Наступна задача
**T-001: Setup + Three.js сцена + import map + shims** (2h estimate)

Див. `docs/06-backlog.md` для повних DoD + AC. Коротко:
- Додати Three.js r160 через jsdelivr + `es-module-shims` у `index.html`
- Створити `src/main.js`, `src/constants.js`, `src/renderer.js`
- Порожня сцена: sky-градієнт, ambient + directional + hemisphere lights, ground-plane 30×30
- Orthographic camera (dimetric 30°, yaw 45°)
- RAF render loop, `?dev=1` → stats.js overlay

## Blockers
Немає. Очікую «ок» від user після тесту placeholder URL → беру T-001.

## Історія задач

| T-XXX | Status | Commit | Date |
|-------|--------|--------|------|
| infra-setup | ✅ Done | `68a4...` (main) | 2026-04-20 |

## Notes
- Node 20 deprecation warning у Actions (non-blocking, fix до червня 2026)
- Playwright + happy-dom поки не встановлені — додамо коли потрібно (T-002 для happy-dom, T-007 для Playwright)
