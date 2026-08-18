<div align="center">

# 🗣️ Til Up — 🚀 Тіл Ап

### **Bilingual Speech Practice Game for Children | Детская игра для тренировки речи**

[![CI](https://github.com/serik-k/til-up/actions/workflows/ci.yml/badge.svg)](https://github.com/serik-k/til-up/actions/workflows/ci.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Web Speech API](https://img.shields.io/badge/Web_Speech_API-Native-FF6F00?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Client--Side-4CAF50?style=for-the-badge&logo=shield&logoColor=white)](#-privacy--microphone-use--приватность)

<p align="center">
  <b>Interactive, friendly, and privacy-first speech exercises in Russian & Kazakh</b><br>
  <b>Интерактивная и безопасная тренировка правильного произношения звуков «Л», «Р», «Ш»</b>
</p>

---

[ English ](#-english-overview) • [ Русский ](#-русский-обзор) • [ Quick Start ](#-quick-start--быстрый-запуск) • [ Architecture ](#-project-structure--структура-проекта)

---

</div>

<br>

## 📌 English Overview

**Til Up** is a browser-based speech practice app designed for kids. It guides children through engaging, bite-sized pronunciation exercises targeting tricky sounds (**Л**, **Р**, and **Ш**) using bright visual cards, audio hints, interactive mascot reactions, and a motivational star-reward system.

The core gameplay is **voice-first**: the child selects a target sound, looks at a picture card, and pronounces the word out loud. The game leverages the native browser **Web Speech API** to recognize spoken words in real time. If speech recognition is unsupported or microphone permissions are unavailable, an instant **manual fallback button** seamlessly takes over so the fun never stops.

---

### ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🌐 **Bilingual Support** | Complete Kazakh (KZ) and Russian (RU) interfaces & curated word decks. |
| 🎴 **18 Sound Decks** | 18 localized practice cards focused on challenging **Л**, **Р**, and **Ш** sounds. |
| 🎙️ **Voice-First Engine** | Real-time speech recognition via browser native Web Speech API with TTS examples. |
| 🛡️ **Zero-Backend Privacy** | 100% client-side app. No audio recordings uploaded, no trackers, no servers. |
| 🔄 **Smart Fallback** | Automatic manual click fallback if microphone access fails or is denied. |
| 📊 **Parent Progress** | Session history and word counts stored strictly in local `localStorage`. |
| ♿ **Accessible Design** | Responsive, full keyboard navigation, and reduced-motion visual support. |
| 🚀 **SEO & OpenGraph** | Meta tags, canonical URLs, `hreflang`, structured JSON-LD, and social previews. |

---

### 🕹️ How It Works

```mermaid
flowchart LR
    A[🎯 Select Sound L / R / Sh] --> B[🎙️ Allow Mic Access]
    B --> C[🖼️ Look at Picture Card]
    C --> D[🗣️ Pronounce Word]
    D -- Recognized --> E[⭐ Earn Star & Next Card]
    D -- Mic Issues / Denied --> F[👇 Manual Fallback Click]
    F --> E
    E -- 5 Stars --> G[🎉 Round Complete & Local Stats]
```

> [!NOTE]
> **Pedagogical & Clinical Note:**
> **Til Up** verifies recognized words for repetition practice; it **does not** analyze phonetic articulation quality or perform medical diagnostics. It is meant for enjoyable home practice and is not a substitute for professional speech-language therapy.

---

### 🛡️ Privacy & Microphone Use

- **No Remote Servers**: Audio data is **never** sent to any custom backend server.
- **Local Storage Only**: Practice history and star counts stay strictly inside `localStorage`.
- **Browser Standard API**: Speech recognition runs through the browser's implementation of `SpeechRecognition`.
- **On-Demand Access**: Microphone access is requested only when an exercise active session begins.

---

<br>

---

<br>

## 🇷🇺 Русский обзор

**Til Up** — это яркая и добрая браузерная игра для развития речи у детей. Она помогает ребёнку отрабатывать правильное произношение наиболее частых «трудных» звуков (**Л**, **Р** и **Ш**) через короткие игровые упражнения с красочными карточками, озвучкой, реакциями живого маскота и звёздными наградами.

Игра построена на **голосовом взаимодействии**: ребёнок выбирает звук, видит карточку со словом и произносит его вслух. Приложение использует встроенный в браузер **Web Speech API** для распознавания речи в реальном времени. Если микрофон недоступен или браузер не поддерживает распознавание, автоматически включается **ручной режим (fallback)**, благодаря которому ребёнок может продолжить игру без препятствий.

---

### ⚡ Главные возможности

- 🇰🇿 🇷🇺 **Два языка**: Полноценный интерфейс и наборы слов на казахском и русском языках.
- 🎴 **18 красочных карточек**: Локализованный набор для закрепления звуков «Л», «Р» и «Ш».
- 🗣️ **Распознавание речи**: Озвучивание примеров и проверка произнесённого слова средствами браузера.
- 🛡️ **100% Конфиденциальность**: Без бэкенда, без записи звука, без передачи личных данных.
- 🔄 **Умная страховка (Fallback)**: Игра не блокируется при отсутствии микрофона — включается кнопка подтверждения.
- 📈 **Статистика для родителей**: Учёт занятий и повторённых слов сохраняется только в браузере.
- ♿ **Доступность и комфорт**: Поддержка управления с клавиатуры, адаптивность и режим `reduced-motion`.
- 🔍 **SEO & Метаданные**: Полная подготовка `OpenGraph`, `JSON-LD`, `hreflang` и канонических ссылок.

---

### 🛠️ Игровой процесс

1. **Выбор звука**: Выберите один из тренируемых звуков (**Л**, **Р** или **Ш**).
2. **Разрешение микрофона**: Нажмите «Начать» и разрешите доступ к микрофону.
3. **Произношение**: Назовите предмет, изображённый на карточке.
4. **Сбор звёзд**: Соберите 5 звёзд, чтобы успешно завершить сессию.
5. **Прогресс**: Просматривайте динамику упражнений в локальной панели статистики.

> [!IMPORTANT]
> **Информация для родителей:**
> Til Up распознаёт совпадение названий картинок для поддержания интереса к тренировке, но **не является диагностическим или логопедическим медицинским прибором**. Приложение создано для домашней практики и не заменяет индивидуальные занятия с логопедом.

---

<br>

## 💻 Tech Stack | Технологический стек

| Technology | Purpose / Описание |
| :--- | :--- |
| ![Vue.js](https://img.shields.io/badge/Vue.js_3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white) | Progressive framework using Composition API & Script Setup |
| ![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=flat-square&logo=typescript&logoColor=white) | Strictly typed state management and speech engine interfaces |
| ![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=flat-square&logo=vite&logoColor=white) | Next-generation frontend build tooling & HMR dev server |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | Utility-first CSS frame with responsive & dark/light styling |
| ![VueUse](https://img.shields.io/badge/VueUse-41B883?style=flat-square&logo=vue.js&logoColor=white) | Reactive browser utilities collection |
| ![Unhead](https://img.shields.io/badge/Unhead_Vue-8E44AD?style=flat-square) | Universal document head & SEO metadata manager |
| ![Web Speech API](https://img.shields.io/badge/Web_Speech_API-FF6F00?style=flat-square&logo=googlechrome&logoColor=white) | Native SpeechRecognition & SpeechSynthesis browser engine |

---

## 🚀 Quick Start | Быстрый запуск

### Requirements / Требования
- **Node.js**: `v18.x` or higher (LTS recommended)
- **npm**: `v9.x` or higher

```bash
git clone https://github.com/serik-k/til-up.git
cd til-up
npm install
npm run dev
```

> Open your browser at `http://localhost:5173` (or the Vite dev URL displayed in terminal).

---

## 🧪 Quality Checks & Build | Проверка качества и сборка

```bash
# Type check
npm run type-check

# Type check + production build (same command used by CI)
npm run check

# Production build
npm run build

# Local preview
npm run preview
```

Every pull request targeting `main` runs the same type-check + production build pipeline in GitHub Actions.

---

## 🏗️ Project Structure | Структура проекта

```text
til-up/
├── 📁 public/
│   ├── 📁 images/speech-cards/   # 🖼️ Sound card artwork & assets
│   └── 📄 robots.txt             # 🤖 Search engine crawlers config
├── 📁 src/
│   ├── 📁 app/                   # 🚀 Application shell & main view setup
│   ├── 📁 assets/                # 🎨 Static styles & global graphics
│   ├── 📁 components/            # 🧩 Game UI and mascot components
│   ├── 📁 composables/           # 🎙️ Speech recognition & synthesis lifecycle hooks
│   ├── 📁 locales/               # 🌍 Multilingual strings (RU / KZ)
│   ├── 📁 styles/                # 💅 Tailwind & custom CSS utility styles
│   ├── 📁 types/                 # 📐 TypeScript definitions & interfaces
│   └── 📄 content.ts             # 🎴 Russian & Kazakh speech card decks data
├── 📄 index.html                 # 📄 Entry point HTML with SEO metadata
├── 📄 vite.config.js             # ⚡ Vite build configuration
├── 📄 tailwind.config.js         # 🎨 Tailwind CSS design system theme
└── 📄 package.json               # 📦 Dependencies & npm scripts
```

---

## 🤝 Contributing | Участие в разработке

Contributions are welcome! If you'd like to improve **Til Up**:

1. Fork the project repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Run `npm run check` to verify type safety and the production build.
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5. Push the branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

> [!TIP]
> *Note on new content*: Any new speech cards or therapeutic word additions should be verified by native speakers and, ideally, reviewed by a certified speech-language pathologist.

---

## 📄 License | Лицензия

Private repository / All rights reserved. License decision pending.

Все права защищены. Публичный доступ к коду не означает свободу повторного использования без разрешения правообладателя.

---

<div align="center">
  <sub>Made with ❤️ for kids and parents | Сделано с любовью для детей и родителей</sub>
</div>
