# Cozy Town Builder

Townscaper-подібна sandbox-гра для дітей 7-12 років у браузері.

## Запуск

```bash
npx serve .
# Відкрити http://localhost:3000
```

**Важливо:** НЕ відкривай `index.html` подвійним кліком — CORS блокує ES modules на `file://`.

## Тести

```bash
npm install
npm test
```

## Документація

Вся специфікація в `docs/`:
- [Vision](docs/01-vision.md) — що за гра
- [GDD](docs/02-gdd.md) — game design
- [TDD](docs/04-tdd.md) — архітектура
- [Backlog](docs/06-backlog.md) — задачі

Для АІ-агентів: [CLAUDE.md](CLAUDE.md) — контракт взаємодії.

## Статус

🚧 Перший deploy (infra only). Реальна гра — після T-001.
