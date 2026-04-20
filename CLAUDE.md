# CLAUDE.md — Cozy Town Builder

> Auto-loaded on every Claude Code session. Це первинний контракт взаємодії з цим проєктом.

## 🎯 Bootstrap protocol (виконай ПЕРШИМ при старті сесії)

1. Прочитай цей файл повністю
2. `cat docs/STATE.md` — де зупинились минулого разу
3. `cat docs/06-backlog.md` — статуси задач, знайди наступну `[ ]`
4. `git log --oneline -15` — recent context
5. `git status` — незавершена робота?
6. **Репортни користувачу коротко:** «Поточний стан: [X]. Продовжую з T-YYY? Очікую ok.»

НЕ починай код поки користувач не підтвердить.

## 👤 User interaction model: Product Owner flow

Користувач — **product owner, не code reviewer**. Він:
- **НЕ дивиться diff-и і PR-и**
- **НЕ робить git-команд**
- **НЕ рідає код**
- **Тестує робочий результат у браузері** після кожної задачі (3-5 хв)
- Каже «ок» → беру наступну задачу. «Зламано X» → створюю bug task.

### Що я (агент) роблю автономно

1. Беру задачу T-XXX з `docs/06-backlog.md` у порядку dependency graph
2. Створюю гілку `task/T-XXX-short-name` з main
3. Пишу тести ПЕРШИМИ (TDD з зубами)
4. Імплементую мінімум щоб тести пройшли
5. Локально: `npm test` + `npx playwright test` — зелені
6. Commit + push
7. CI на GitHub Actions запускається автоматично
8. **Якщо CI зелений** → squash-merge до main → auto-deploy на GitHub Pages
9. **Якщо CI червоний** → до 3 спроб фіксу → якщо не зміг, створюю `docs/blocked/BLOCKED-T-XXX.md` і пінгую user
10. Оновлюю `docs/06-backlog.md` (status: Done, commit hash)
11. Оновлюю `docs/STATE.md` (what's done, what's next)
12. **Видаю PO Report** користувачу (див. формат нижче)

### PO Report формат (output після кожної задачі)

```
✅ T-XXX готово — [коротка назва]

🌐 Тестуй: https://<user>.github.io/townscaper-mvp
   (оновилось N хв тому)

🎮 Що перевірити (~3 хв):
   1. [конкретний крок]
   2. [конкретний крок]
   3. [конкретний крок]

✨ Що вже працює: [накопичені фічі коротко]
⚠️  Знані обмеження: [що ще не зроблено, посилання на наступні T]

Відповідь очікую: "ок" / "зламано: X" / "хочу змінити: Y"
```

**Мова PO-report — продуктова, не технічна.** Не «InstancedMesh pool migration» — а «кубики починають виглядати по-різному залежно від сусідів».

### Коли ЗУПИНИТИСЬ і запитати user

- CI fail після 3 спроб → `BLOCKED-T-XXX.md` + коротке повідомлення user
- Неоднозначний AC у test-plan → запит
- Виникає потреба змінити архітектуру → запит
- Хочу додати залежність → запит
- User сказав «зламано X» → клярифікую що саме бачить

## 📚 Документи (single source of truth)

Перед задачею завжди читай відповідне:

- `docs/01-vision.md` — бінарні success criteria, scope
- `docs/02-gdd.md` — геймплей, UX, controls
- `docs/03-art-brief.md` — палітра, анімації, іконки
- `docs/04-tdd.md` — **архітектура v2 після cross-review**
- `docs/05-test-plan.md` — AC з ID, integration scenarios, CI
- `docs/06-backlog.md` — задачі T-XXX у порядку виконання
- `docs/STATE.md` — поточний стан проєкту

**НЕ міняй документи без явного запиту.** Вони — контракт.

## ⚠️ Cross-review anti-patterns (критичні — не зроби гірше)

З перехресного ревʼю 6 профільних агентів. Всі 6 агентів знайшли ці помилки у v1 TDD. Тепер v2 їх виправляє. **НЕ повертайся до v1 підходу.**

1. ❌ **Не створюй 20 `InstancedMesh` пулів.** Лише 4 (по одному на tileType) + `instanceColor` per-instance attribute
2. ❌ **Не використовуй `raycaster.intersectObject`** на InstancedMesh для picking. Тільки math-based DDA (TDD §5.2). O(1) незалежно від cells.
3. ❌ **Не читай `hit.face.normal`** напряму з InstancedMesh — нормаль у local space. Math-picking взагалі не читає normal.
4. ❌ **Не персистуй `tileType`** у save. Derived state → `tileResolver.resolveAll()` після load.
5. ❌ **Не пиши per-tween `requestAnimationFrame`.** Один центральний TweenManager, keyed by cellKey.
6. ❌ **Не використовуй MouseEvents.** Pointer Events з day 1 (уніфікує mouse+touch+trackpad).
7. ❌ **Не використовуй emoji 🧽 у UI.** Windows/Linux рендерять як box. Тільки inline SVG.
8. ❌ **Не кажи «classic isometric» для pitch 30°.** Це dimetric 30°. Class iso = atan(1/√2) ≈ 35.26°.
9. ❌ **Не тримай mode toggle видимим на старті.** Progressive disclosure: показуємо після першого placement.
10. ❌ **Не роби Yes/No модалку для Clear all.** Hold-to-confirm 1.5с — захист від випадкового C від 7yo.

## 🧱 Tech stack (FIXED)

- Vanilla JS ES2022 modules
- Three.js r160 через jsdelivr CDN + `es-module-shims` polyfill
- Vitest + happy-dom (unit)
- Playwright (E2E: Chromium + WebKit)
- GitHub Actions (CI), GitHub Pages (deploy)
- localStorage (save)
- **Без:** bundlers, TypeScript, React/Vue, lodash/jQuery, GSAP

**Запуск dev:** `npx serve .` (НЕ `file://` — CORS ламає ES modules).

## 🔧 Code conventions

- Files: `camelCase.js`
- Classes: `PascalCase`
- Functions/vars: `camelCase`
- Constants: `UPPER_SNAKE_CASE` (export from `constants.js`)
- Private fields: `#privateField`
- **Без коментарів-очевидностей.** Тільки «чому», не «що»
- UI-тексти українською, код і commit messages англійською

## 🌳 Git workflow

- **Trunk-based з feature-branches.** `main` завжди deploy-able.
- Гілка: `task/T-XXX-short-description`
- Commits: дрібні, логічні. Пиши WHY у body якщо неочевидно.
- **Squash-merge до main** (не merge-commit, не rebase)
- **Branch protection:** main приймає merge тільки якщо CI зелений
- Видаляй гілку після merge

### Формат commit
```
[T-XXX] Short imperative (≤60 chars)

Why this change (2-3 lines if non-obvious).

- detail 1
- detail 2
```

**Ніколи:** `Co-Authored-By: Claude`, emoji у body, `--no-verify`, force-push на main.

## 🧪 Quality gates

Задача T-XXX готова ТІЛЬКИ якщо:
- [ ] Всі AC з DoD позначені [x] у `docs/05-test-plan.md`
- [ ] `npm test` — зелений
- [ ] `npx playwright test` — зелений (якщо фіча P0/P1)
- [ ] Працює у Chrome AND Safari
- [ ] FPS ≥60 @ 100 cells на M1, ≥30 @ 500 cells на Intel UHD
- [ ] 0 console.error/warning у DevTools
- [ ] **CI зелений на GitHub** (не тільки локально)
- [ ] `docs/06-backlog.md` оновлено (статус + commit hash)
- [ ] `docs/STATE.md` оновлено

## 🚨 Budget caps (autonomous safety)

- Max 3 fix-attempts per task → якщо не зміг, `BLOCKED-T-XXX.md`
- Max 1.5× estimate → пауза, запит user
- Якщо `npm test` зависає >60с → kill, створити bug report
- Якщо CI не стартує >5 хв → запит user перевірити GitHub status

## 📝 Session handoff (виконай в КІНЦІ кожної сесії)

Перед тим як завершити роботу (або коли user відповідає «ок»):

1. Commit всі pending changes
2. Оновити `docs/STATE.md`:
   - Last completed task + hash
   - Next task up
   - Any blockers
   - Deploy URL і timestamp
3. Push все на remote
4. Видати user фінальний PO Report

Це гарантує що наступна сесія (або наступний агент) без проблем продовжить.
