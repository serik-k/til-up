# Til Up

Child-friendly speech practice in Russian and Kazakh.

Детская тренировка речи на русском и казахском языках.

[English](#english) · [Русский](#русский)

---

## English

Til Up is a small browser-based speech practice game for children. It helps a child repeat words containing the **Л**, **Р**, and **Ш** sounds through short, positive exercises with pictures, voice examples, and gentle rewards.

The experience is voice-first: a child chooses a sound, starts an exercise, looks at a card, and says the word aloud. The game uses the browser's Web Speech API to recognize the expected word. If speech recognition is unavailable or microphone access fails, a manual fallback is enabled automatically so the exercise is never blocked.

### Features

- Russian and Kazakh interfaces and word sets
- 18 localized practice cards across three target sounds
- Automatic card rotation during a five-word exercise
- Browser speech recognition and spoken word examples
- Clear microphone permission and compatibility messages
- Local progress summary for parents
- No account, backend, analytics, or remote project database
- Responsive layout, keyboard support, and reduced-motion support
- Localized SEO metadata, canonical links, `hreflang`, Open Graph, and JSON-LD

### How it works

1. Select **Л**, **Р**, or **Ш**.
2. Start the exercise and allow microphone access.
3. Say the word shown on the card.
4. Collect five stars to complete the exercise.
5. Review the locally stored session and word counters.

Til Up recognizes the name of the picture. It does **not** assess articulation quality and is not a diagnostic or medical tool. It is intended for light practice and does not replace sessions with a speech-language professional.

### Privacy and microphone use

- The application itself has no backend and does not upload or store recordings.
- Exercise statistics are stored only in the browser's `localStorage`.
- Speech recognition is provided by the browser. Depending on the browser and operating system, audio processing may be performed by the browser vendor's online service.
- Microphone access begins only after the user starts an exercise.
- If access is denied or recognition fails, the game enables a manual fallback.

For public deployment, serve the application over HTTPS. Browser support for the Web Speech API varies; current Chromium-based browsers generally provide the best experience.

### Development

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

### Quality checks

```bash
npm run type-check
npm run build
npm audit
```

Preview the production build locally:

```bash
npm run preview
```

### Project structure

```text
src/app/                         Application entry and page shell
src/components/SoundPopGame.vue Game state, cards, progress, and statistics
src/components/Mascot.vue       Interactive accessible mascot
src/composables/                 Browser speech-recognition lifecycle
src/content.ts                   Russian and Kazakh content and card decks
public/images/                   Speech-card artwork
```

### Technology

Vue 3, TypeScript, Vite, Tailwind CSS, VueUse, Unhead, and the browser Web Speech API.

### Contributing

Bug reports and focused pull requests are welcome. Please run the type check and production build before opening a pull request. New words should be reviewed by a native speaker and, when presented as speech therapy material, by a qualified specialist.

---

## Русский

Til Up — небольшая браузерная игра для детской речевой практики. Она помогает ребёнку повторять слова со звуками **Л**, **Р** и **Ш** в коротких доброжелательных упражнениях с картинками, голосовыми примерами и наградами.

Основной сценарий построен вокруг голоса: ребёнок выбирает звук, запускает упражнение, смотрит на карточку и произносит слово. Игра использует браузерный Web Speech API, чтобы распознать ожидаемое слово. Если распознавание недоступно или браузер не получил доступ к микрофону, ручной fallback включается автоматически и не блокирует упражнение.

### Возможности

- Интерфейс и наборы слов на русском и казахском языках
- 18 локализованных карточек для трёх тренируемых звуков
- Автоматическая смена карточек в упражнении из пяти слов
- Распознавание речи и озвучивание примеров средствами браузера
- Понятные сообщения о доступе к микрофону и совместимости
- Локальная статистика для родителей
- Нет аккаунтов, backend, аналитики и удалённой базы данных проекта
- Адаптивная вёрстка, управление с клавиатуры и поддержка reduced motion
- Локализованные SEO-метаданные, canonical, `hreflang`, Open Graph и JSON-LD

### Как играть

1. Выбрать звук **Л**, **Р** или **Ш**.
2. Начать упражнение и разрешить доступ к микрофону.
3. Произнести слово, изображённое на карточке.
4. Собрать пять звёзд и завершить упражнение.
5. Посмотреть локальную статистику занятий и повторённых слов.

Til Up распознаёт название картинки, но **не оценивает качество произношения**. Это не диагностический и не медицинский инструмент. Игра предназначена для лёгкой практики и не заменяет занятия с логопедом.

### Приватность и микрофон

- У приложения нет собственного backend: оно не загружает и не хранит аудиозаписи.
- Статистика сохраняется только в `localStorage` браузера.
- Распознавание выполняется браузером. В зависимости от браузера и операционной системы звук может обрабатываться онлайн-сервисом производителя браузера.
- Доступ к микрофону запрашивается только после запуска упражнения.
- При запрете доступа или ошибке распознавания игра автоматически разрешает ручной fallback.

Для публичного размещения приложение должно работать по HTTPS. Поддержка Web Speech API различается между браузерами; обычно наиболее стабильный результат дают актуальные Chromium-браузеры.

### Локальный запуск

Понадобятся актуальная LTS-версия Node.js и npm.

```bash
npm install
npm run dev
```

После запуска откройте локальный адрес, который выведет Vite.

### Проверка качества

```bash
npm run type-check
npm run build
npm audit
```

Локальный просмотр production-сборки:

```bash
npm run preview
```

### Структура проекта

```text
src/app/                         Точка входа и основная страница
src/components/SoundPopGame.vue Игровые состояния, карточки и статистика
src/components/Mascot.vue       Интерактивный доступный маскот
src/composables/                 Жизненный цикл распознавания речи
src/content.ts                   Контент и наборы карточек RU/KZ
public/images/                   Изображения карточек
```

### Технологии

Vue 3, TypeScript, Vite, Tailwind CSS, VueUse, Unhead и браузерный Web Speech API.

### Участие в разработке

Приветствуются отчёты об ошибках и небольшие целевые pull request. Перед отправкой изменений запустите проверку типов и production-сборку. Новые слова должен проверить носитель языка, а материалы, заявленные как логопедические, — профильный специалист.

## License / Лицензия

No open-source license has been selected yet. Public access to the source code does not automatically grant permission to reuse it.

Лицензия открытого исходного кода пока не выбрана. Публичный доступ к коду сам по себе не даёт разрешения на его повторное использование.
