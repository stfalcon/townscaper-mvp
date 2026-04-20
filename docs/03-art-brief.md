# Art Brief

## 1. Стиль

**Вибір для MVP:** Low-poly voxel зі стилізованим AO (cozy-voxel).

**Чому:**
- Швидко генерується процедурно (немає потреби в артисті)
- При сильній палітрі + правильному освітленні виглядає «прилизано», а не дешево
- Легкий для рендера: 60 FPS навіть з 2000+ кубами через `InstancedMesh`
- Знайомий дітям (Minecraft, Roblox) — не лякає

**Що відкидаємо:**
- Townscaper-like зі згладженими кутами → ручні меші, 200+ варіацій, місяці роботи
- Flat 2.5D → програє у відчутті обʼєму і «магії сусідства»

## 2. Мудборд / Референси

1. **Townscaper** (Oskar Stålberg) — загальна атмосфера, палітра, satisfaction
2. **Islanders** (GrizzlyGames) — cozy isometric placement, мʼякі кольори
3. **Block'hood** (Plethora Project) — стилізований voxel з теплим світлом
4. **Lucas Pope, "Mars After Midnight"** — приклад як мінімалізм + сильна палітра виглядають преміально
5. **Dribbble search «cozy voxel town»** — сучасні пастельні voxel-сцени
6. **ArtStation "low poly village"** — приклади AO + warm lighting

_Перед стартом імплементації: зібрати 10-15 скріншотів у папку `assets/moodboard/` для референсу._

## 3. Палітра

### Основні кольори будинків (5 + 1 bonus)

| # | Назва | Hex | RGB | Використання |
|---|-------|-----|-----|--------------|
| 1 | Теплий білий | `#F2EBD3` | 242, 235, 211 | Стіни за замовчанням, stone-white |
| 2 | Теракота | `#D97A5B` | 217, 122, 91 | Теплий акцент, «південь» |
| 3 | Шавлієвий | `#A8BFA0` | 168, 191, 160 | Мʼякий зелений, природний |
| 4 | Небесно-блакитний | `#8AB3C4` | 138, 179, 196 | Cool-акцент, «Санторіні» |
| 5 | Гірчичний | `#E8B547` | 232, 181, 71 | Теплий золотий, жовтіший за охру |
| 6 | **Surprise** 🎁 | `#FF6B3D` | 255, 107, 61 | **Насичений помаранчевий. Unlock після 10 placements. Для 7yo — dopamine-hit проти муті́д-палітри.** |

Палітра 1-5 спеціально обрана як **harmonious/muted** — townscaper-feel на простих кубах. Усі 5 мають близьку luminance ≈75%.

**Кольор 6 (Surprise)** — виняток навмисно. UX-ревʼю визначило ризик: 7-річки звикли до насичених primary-кольорів (Minecraft, Roblox), мутед-палітра може здатись «нудною» за 2 хвилини. Unlock 6-го кольору після 10 placements — мʼякий reward-loop без порушення пасивної естетики основної палітри.

### Допоміжні

| Роль | Hex | Примітка |
|------|-----|----------|
| Трава (земля) | `#B8D49A` | світло-зелена, контрастує з палітрою |
| Сітка ліній (grid) | `#9FBC82` | трохи темніша за траву |
| Небо вгорі | `#C8E0ED` | прохолодний блакитний |
| Небо на горизонті | `#F0E8DA` | тепла «вечірня» нота |
| Тінь (multiply) | `#4A3A2E` @ 25% | baked AO на нижніх гранях і в кутах |
| Hover outline | `currentColor` @ 60% | динамічний, = вибраний колір палітри |
| Selection-обрамлення палітри | `#FFFFFF` @ 100%, 3px | навколо обраного кольору |
| UI-фон (палітра) | `#FFFFFF` @ 75%, blur 12px | glassmorphism |
| UI-текст | `#2A2520` | темно-теплий коричневий |

### WCAG перевірка
- Текст `#2A2520` на `#FFFFFF@75%` — контраст ≈14:1 ✅ AAA
- Будинки на траві `#B8D49A` — мін. 3.8:1 (для не-тексту) ✅ AA
- Hover-outline добре видимий проти всіх 5 кольорів і трави

## 4. Освітлення

- **Directional light:**
  - Напрям: top-right (x: +0.5, y: +1.0, z: +0.3), нормалізований
  - Колір: `#FFF8EB` (тепло-білий)
  - Intensity: 0.9
- **Ambient light:**
  - Колір: `#B8C8D4` (прохолодний синій)
  - Intensity: 0.5
- **Hemisphere light** (NEW, дешевий «ліфт» темних сторон):
  - Sky: `#C8E0ED`, Ground: `#B8D49A`
  - Intensity: 0.4
- **Real-time тіні:** НЕ використовуємо (performance)

### AO — переглянуто після perf/frontend-ревʼю

**Старий план (v1):** baked vertex-color AO на 4-х процедурних геометріях. Оцінка 3h.

**Проблема:** для low-poly кубика (8 вершин) «AO» = просто темніші нижні vertex-и. На ortho 30° pitch гравець бачить переважно верхні грані — AO майже не помітне. 3 години роботи = мінімальний ROI.

**Новий план:** **fragment-level Y-gradient** через кастомний `ShaderMaterial` або простий vertex-color trick:
- Нижні 4 vertex-и: колір × 0.7 (darker)
- Верхні 4 vertex-и: колір × 1.05 (slightly brighter)
- Лінійна інтерполяція всередині fragment

Реалізація: `geometry.setAttribute('color', ...)` з 8 vertex-ів, `MeshLambertMaterial({ vertexColors: true })`. Бюджет: 30 хвилин замість 3 годин.

**Альтернатива (post-MVP):** `SSAOPass` з postprocessing — дорого, але вигляд наближений до Townscaper.

Теплий direct + холодний ambient + hemisphere = «cozy late-afternoon» look без real-time shadows.

## 5. Камера

- **Тип:** `OrthographicCamera` (ізометрія без perspective-спотворення)
- **Кут огляду:** **pitch 30°, yaw 45°**. _Це **dimetric 30°**, НЕ classic isometric (який вимагає pitch = atan(1/√2) ≈ 35.26°)._ Dimetric обрано навмисно — ми отримуємо «пласкіший, cozy-вигляд», як у більшості voxel-indie-ігор. Термінологічне уточнення після frontend-ревʼю.
- **Обертання:** тільки навколо Y. 4 фіксованих positions (0°, 90°, 180°, 270°), snap з `Q`/`E`, 200мс easeInOutCubic
- **Зум:**
  - Діапазон: 0.5x (віддалено) … 2.0x (наближено)
  - Крок колеса: 0.1x
  - Clamp м'яким spring-ефектом на межах
- **Стартова позиція:** центр поля (15, 0, 15), zoom 1.0, yaw 45°

## 6. Анімації

| Подія | Ефект | Тривалість | Easing |
|-------|-------|------------|--------|
| Поява будинку | scale Y [0, 1.1, 1.0] | 250мс | easeOutBack(1.7) |
| Видалення | scale Y [1.0, 1.1, 0] | 150мс | easeInQuad |
| Зміна tile-типу (re-tile) | crossfade opacity між меш-варіантами | 150мс | linear |
| Hover на клітинці | outline fade-in | 100мс | linear |
| Unhover | outline fade-out | 80мс | linear |
| Вибір кольору | button scale [1, 1.15, 1] | 150мс | easeOutQuad |
| Обертання камери | yaw lerp | 200мс | easeInOutCubic |
| Зум | zoom lerp | 150мс | easeOutQuad |
| Random city cascade | per-cell delay 40мс | 1500-2000мс total | staggered |
| First-time hint fade | opacity 0→1→0 | 300мс in, тримає 4с, 300мс out | linear |

## 7. UI / HUD

- **Шрифт:** `Nunito` (Google Fonts weight 600/700) з fallback на `system-ui, -apple-system, sans-serif`
- **Розміри типографіки (явно, після UX-ревʼю):**
  - Onboarding headline «Тикни — побудуй!» — **28px** bold
  - Body text (help modal, toast) — **18px**
  - Hint text («R — ціле місто!») — **16px**
  - Tooltip labels — 14px (не для читання 7yo, це для 12yo hover)
- **Стиль:** rounded-corners 12px, мʼякі тіні `0 4px 12px rgba(0,0,0,0.1)`
- **Розміри компонентів:**
  - Палітра: 5 (→6) circle-buttons 56×56 px, gap 12px, bottom center
  - Mode toggle: 2 buttons 56×56 px, top-right, gap 8px. **Прихований до першого placement** (progressive disclosure)
  - Help (?): 48×48 px круглий, top-left
  - Selection-обрамлення: 3px білий
  - Onboarding arrow: 120×120 px SVG, anchored viewport-center
- **Tooltip-підказки:** зʼявляються при hover через **250мс** (не 500мс — дитяча attention span), fade-in 150мс
- **Help modal:** 2-рівневий (simple 4-icon для 7yo default + toggle «Показати всі команди» для 12yo). ESC або клік по фону — закриває
- **Іконки — ТІЛЬКИ inline SVG** (не emoji). Причина: 🧽 не рендериться на Windows/старих Linux. SVG-іконки 24×24 viewBox, `fill: currentColor`:
  - Build: house silhouette (пряма лінія даху + стіни)
  - Erase: eraser rectangle з smudge
  - Help: question mark у колі
  - Clear: trash can
  - Random: dice з пʼятьма крапочками
- **Erase-mode toast:** зʼявляється біля курсора, 18px, білий фон з blur + shadow, 1с timeout

## 8. Звук (stretch goal, опційно)

- **Атмосфера:** тихий ambient-луп (вітер + далекі птахи), гучність 0.15, loop безшовний
- **SFX:**
  - **Place:** короткий «pop» (~180Hz, envelope 80мс, spatial volume 0.6)
  - **Remove:** «whoosh» descending 400→200Hz, 150мс
  - **Color select:** короткий «click» 0.3 volume
  - **Random city cascade:** wind-chime з pitch-варіацією per cell
  - **Clear all confirm:** soft bell
- **Джерела:** OpenGameArt.org (CC0), freesound.org (CC0/CC-BY), або проста генерація через WebAudio `OscillatorNode` + `GainNode`
- **Mute by default?** Ні, але кнопка mute у куті екрану обовʼязкова

## 9. Чого уникаємо

- **Темні / насичені кольори** (червоний, чорний, фіолетовий неоновий) — це дитяча cozy-гра
- **Обличчя, очі, персонажі** — тримаємо абстрактність
- **Вогонь, зброя, черепи, крапельки крові** — будь-які «загрозливі» асети
- **Реальні логотипи брендів**
- **Гучний UI з gradient-ами і shadow-spam** — тримаємо мінімалізм
- **Гучна музика** (якщо додаємо аудіо — тиха ambient)
- **Flashing / blinking > 3 Hz** — ризик для фото-чутливих
