# Project STATE

> Оновлюється агентом в кінці кожної сесії. Читається на старті щоб не втратити контекст.

## Остання сесія
**Дата:** 2026-04-20
**Що зроблено:** Документація готова, всі 7 docs пройшли cross-review 6 агентів, створено v2. CLAUDE.md в корені налаштовано. Код ще не починався.

## Поточний стан
- 🟢 Docs v2 готові (vision, gdd, art-brief, tdd, test-plan, backlog, agents-md)
- 🟢 CLAUDE.md у корені налаштовано з PO workflow
- 🔴 Git repo: не ініціалізовано
- 🔴 GitHub remote: не створено
- 🔴 CI workflow: не створено
- 🔴 Код: не починався
- 🔴 GitHub Pages: не налаштовано

## Наступна задача
**T-001: Setup + Three.js сцена + import map + shims** (2h estimate)

Але ПЕРЕД T-001 треба infra (одноразово):
1. `git init` + перший commit
2. `gh repo create townscaper-mvp --public --source=. --push`
3. Створити `.github/workflows/ci.yml` (test + playwright + deploy-pages)
4. Налаштувати branch protection на main (squash merge, require CI green)
5. Enable GitHub Pages, source = `gh-pages` branch (або `main` через workflow)

Після infra — перший merge → автоматичний deploy → user отримує URL для тестування.

## Blockers
Немає. Чекаємо команди user «стартуємо» щоб почати infra-setup.

## Deploy URL
_(буде доступна після першого successful CI run)_

## Історія задач
_(заповнюватиметься після Done кожної задачі)_

| T-XXX | Status | Commit | Date |
|-------|--------|--------|------|
| — | — | — | — |

## Рішення що прийняті під час роботи
_(ADR-lite: додавати тут якщо виникає нова архітектурна розвилка не у TDD)_

Немає поки що.

## Знані обмеження / technical debt
Немає поки що.
