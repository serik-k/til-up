<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAudioLevel } from '../composables/useAudioLevel';
import type { AnalyticsReturn } from '../types/analytics';
import { useAudioLevelInjected } from '../composables/useAudioLevelProvider';

type GameMode = 'target' | 'mixed';
type Level = 1 | 2 | 3;
type Sound = 'R' | 'L' | 'SH';

type Bubble = {
  id: string;
  x: number; // 0..1
  y: number; // px
  vy: number; // px/s
  letter: Sound;
  alive: boolean;
  smile: boolean; // no-fail feedback for non-target
  popped: boolean;
};

type Particle = {
  id: string;
  x: number; // px
  y: number; // px
  vx: number; // px/s
  vy: number; // px/s
  life: number; // ms
  born: number; // ms
};

const props = defineProps<{
  reducedMotion: boolean;
  analytics: AnalyticsReturn;
}>();

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
const width = ref(0);
const height = ref(0);

const settings = reactive({
  mode: 'target' as GameMode,
  targetSound: 'R' as Sound,
  selectedSounds: ['R', 'L', 'SH'] as Sound[],
  level: 1 as Level,
  roundSeconds: 45,
});

const running = ref(false);
const timeLeft = ref(settings.roundSeconds);
const score = ref(0);
const streak = ref(0);
const freezeUsed = ref(false); // streak freeze once
const rewardText = ref<string>('');

const bubbles = ref<Bubble[]>([]);
const particles = ref<Particle[]>([]);

const fps = ref(60);
const maxBubbles = ref(12);

let rafId: number | null = null;
let lastTs = 0;
let spawnAcc = 0;

const injectedAudio = useAudioLevelInjected();
const ownsAudio = !injectedAudio;
const audio = injectedAudio ?? useAudioLevel();
const micBounce = ref(false);

const onboardingStep = ref(0);
const onboardingSeen = ref(false);

function safeNow() {
  return performance.now();
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function saveSettings() {
  try {
    localStorage.setItem('tilup_game_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('tilup_game_settings');
    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (parsed && (parsed.mode === 'target' || parsed.mode === 'mixed'))
      settings.mode = parsed.mode;
    if (
      parsed &&
      (parsed.targetSound === 'R' || parsed.targetSound === 'L' || parsed.targetSound === 'SH')
    )
      settings.targetSound = parsed.targetSound;

    if (Array.isArray(parsed?.selectedSounds)) {
      const valid = parsed.selectedSounds.filter((s: any) => s === 'R' || s === 'L' || s === 'SH');
      if (valid.length) settings.selectedSounds = Array.from(new Set(valid));
    }

    if (parsed?.level === 1 || parsed?.level === 2 || parsed?.level === 3)
      settings.level = parsed.level;
    if (typeof parsed?.roundSeconds === 'number') {
      const v = Math.round(parsed.roundSeconds);
      settings.roundSeconds = clamp(v, 30, 60);
    }
  } catch {
    // ignore
  }
}

function loadOnboardingFlag() {
  try {
    onboardingSeen.value = localStorage.getItem('tilup_onboarding_seen') === '1';
  } catch {
    onboardingSeen.value = false;
  }
  onboardingStep.value = onboardingSeen.value ? -1 : 0;
}

function markOnboardingSeen() {
  onboardingStep.value = -1;
  onboardingSeen.value = true;
  try {
    localStorage.setItem('tilup_onboarding_seen', '1');
  } catch {
    // ignore
  }
}

function resize() {
  const el = containerRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  width.value = r.width;
  height.value = r.height;
}

const activeSounds = computed<Sound[]>(() => {
  if (settings.mode === 'target') return [settings.targetSound];
  return settings.selectedSounds.length ? settings.selectedSounds : (['R', 'L', 'SH'] as Sound[]);
});

const targetSoundEffective = computed<Sound>(() => {
  return settings.mode === 'target' ? settings.targetSound : settings.targetSound;
});

function pickLetter(): Sound {
  const pool = activeSounds.value;
  return pool[Math.floor(Math.random() * pool.length)] as Sound;
}

function computeDifficultyMultiplier(): number {
  // level affects speed & spawn
  if (settings.level === 1) return 1.0;
  if (settings.level === 2) return 1.18;
  return 1.35;
}

function updateMaxBubblesByFps() {
  // динамический лимит пузырей 10–14 по FPS (и уменьшение при слабых девайсах)
  const base = 12;
  if (fps.value >= 55) maxBubbles.value = clamp(base + 2, 10, 14);
  else if (fps.value >= 45) maxBubbles.value = clamp(base, 10, 14);
  else if (fps.value >= 35) maxBubbles.value = clamp(base - 1, 10, 14);
  else maxBubbles.value = 10;
}

function spawnBubble() {
  if (!running.value) return;
  if (!width.value) return;
  if (bubbles.value.filter((b) => b.alive).length >= maxBubbles.value) return;

  const m = computeDifficultyMultiplier();
  const b: Bubble = {
    id: uid('b'),
    x: Math.random(), // 0..1
    y: -60,
    vy: (70 + Math.random() * 40) * m, // px/s
    letter: pickLetter(),
    alive: true,
    smile: false,
    popped: false,
  };

  bubbles.value.push(b);
}

function removeDead() {
  // чистим умершие и старые частицы
  bubbles.value = bubbles.value.filter((b) => b.alive || b.popped || b.smile);
  const now = safeNow();
  particles.value = particles.value.filter((p) => now - p.born < p.life);
}

function addParticles(px: number, py: number) {
  if (props.reducedMotion) return;

  const now = safeNow();
  const count = 14;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 160;
    particles.value.push({
      id: uid('p'),
      x: px,
      y: py,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 60,
      life: 650 + Math.random() * 350,
      born: now,
    });
  }
}

function isTarget(b: Bubble): boolean {
  if (settings.mode === 'target') return b.letter === settings.targetSound;
  // mixed: делаем “цель” = текущий targetSound (можно менять), чтобы сохранялся “Лови звук”
  // если хочешь, можно “цель” = любой из выбранных, но тогда игра теряет фокус
  return b.letter === settings.targetSound;
}

function noFailFeedback(b: Bubble) {
  // Никаких “ошибок”: мягкая реакция и подсветка цели.
  b.smile = true;
  setTimeout(() => {
    b.smile = false;
    if (!b.popped) b.alive = false;
  }, 420);
}

function popBubble(b: Bubble, clientX: number, clientY: number) {
  if (!running.value) return;
  if (b.popped) return;

  const wasTarget = isTarget(b);

  props.analytics.track({
    name: 'pop_bubble',
    payload: { sound: b.letter, wasTarget },
  });

  if (wasTarget) {
    b.popped = true;
    score.value += 1;
    streak.value += 1;
    rewardText.value = '';

    addParticles(clientX, clientY);

    // мягкое удаление после анимации
    setTimeout(
      () => {
        b.alive = false;
        b.popped = false;
      },
      props.reducedMotion ? 0 : 220
    );
  } else {
    // streak: не обнуляем навсегда, а “замораживаем” 1 раз
    if (!freezeUsed.value && streak.value >= 4) {
      freezeUsed.value = true;
      rewardText.value = 'Серия заморожена — продолжаем!';
    } else {
      streak.value = 0;
    }

    noFailFeedback(b);
  }
}

function startRound() {
  if (running.value) return;

  rewardText.value = '';
  score.value = 0;
  streak.value = 0;
  freezeUsed.value = false;

  timeLeft.value = settings.roundSeconds;
  bubbles.value = [];
  particles.value = [];

  running.value = true;

  props.analytics.track({
    name: 'start_game',
    payload: {
      selectedSounds: settings.selectedSounds,
      level: settings.level,
      mode: settings.mode,
    },
  });

  lastTs = safeNow();
  spawnAcc = 0;

  loop(lastTs);
}

function stopRound(showReward: boolean) {
  running.value = false;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  bubbles.value.forEach((b) => {
    b.alive = false;
    b.popped = false;
    b.smile = false;
  });

  if (showReward) {
    rewardText.value =
      score.value >= 8 ? 'Супер!' : score.value >= 4 ? 'Класс!' : 'Отлично получилось!';
  }
}

function loop(ts: number) {
  if (!running.value) return;

  const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000)); // seconds
  lastTs = ts;

  // fps estimation
  const inst = 1 / dt;
  fps.value = fps.value * 0.92 + inst * 0.08;
  updateMaxBubblesByFps();

  // round timer
  timeLeft.value = Math.max(0, timeLeft.value - dt);
  if (timeLeft.value <= 0) {
    stopRound(true);
    return;
  }

  // spawn cadence (уровень влияет)
  const m = computeDifficultyMultiplier();
  const baseSpawn = 0.85 / m; // sec per bubble-ish
  spawnAcc += dt;
  while (spawnAcc >= baseSpawn) {
    spawnAcc -= baseSpawn;
    spawnBubble();
  }

  // move bubbles
  for (const b of bubbles.value) {
    if (!b.alive) continue;
    b.y += b.vy * dt;

    // если пузырь упал вниз — это не “ошибка”
    if (b.y > height.value + 80) {
      b.alive = false;
      b.popped = false;
      b.smile = false;

      // “мягкая подсказка”: показываем награду за попытку, но не штрафуем
      // streak не трогаем (no-fail)
    }
  }

  // move particles
  if (!props.reducedMotion) {
    const now = safeNow();
    for (const p of particles.value) {
      const age = now - p.born;
      const dts = dt;
      // простая физика
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += 420 * dts; // гравитация

      // лёгкое затухание на конце life
      if (age > p.life) {
        p.x = p.x;
      }
    }
  }

  removeDead();

  rafId = requestAnimationFrame(loop);
}

function bubbleStyle(b: Bubble) {
  // width может быть меньше 88px на экстремально маленьких контейнерах,
  // поэтому страхуемся clamp'ом, чтобы не получить отрицательный диапазон.
  const safeW = Math.max(88, width.value);
  const px = b.x * (safeW - 88) + 44; // безопасные поля
  const py = b.y;
  return {
    transform: `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`,
  };
}

function tapBubble(b: Bubble, e: MouseEvent | TouchEvent) {
  let cx = 0;
  let cy = 0;

  if (e instanceof MouseEvent) {
    cx = e.clientX;
    cy = e.clientY;
  } else {
    const t = e.changedTouches?.[0];
    if (t) {
      cx = t.clientX;
      cy = t.clientY;
    }
  }

  popBubble(b, cx, cy);
}

function toggleSound(sound: Sound) {
  const set = new Set(settings.selectedSounds);
  if (set.has(sound)) set.delete(sound);
  else set.add(sound);
  const next = Array.from(set);
  settings.selectedSounds = next.length ? (next as Sound[]) : (['R', 'L', 'SH'] as Sound[]);
  saveSettings();
}

function setTarget(sound: Sound) {
  settings.targetSound = sound;
  saveSettings();
}

function setLevel(v: Level) {
  settings.level = v;
  saveSettings();
}

function setMode(v: GameMode) {
  settings.mode = v;
  saveSettings();
}

function setRoundSeconds(v: number) {
  settings.roundSeconds = clamp(Math.round(v), 30, 60);
  saveSettings();
}

function openOnboardingIfNeeded() {
  if (onboardingStep.value === -1) return;
  onboardingStep.value = 0;
}

function nextOnboarding() {
  if (onboardingStep.value < 2) onboardingStep.value += 1;
  else markOnboardingSeen();
}

function skipOnboarding() {
  markOnboardingSeen();
}

watch(
  () => settings.roundSeconds,
  () => {
    if (!running.value) timeLeft.value = settings.roundSeconds;
  }
);

watch(
  () => audio.level.value,
  (v) => {
    if (audio.state.value !== 'listening') return;
    if (v >= audio.threshold.value) {
      micBounce.value = true;
      setTimeout(() => (micBounce.value = false), 180);
    }
  }
);

function enableMic() {
  audio.start().then(() => {
    props.analytics.track({
      name: 'enable_mic',
      payload: { success: audio.state.value === 'listening', fallbackUsed: false },
    });
  });
}

function disableMic() {
  audio.stop();
}

function fallbackLoud() {
  // no-mic fallback: имитируем “громко” — прыжок персонажа/фидбек
  micBounce.value = true;
  setTimeout(() => (micBounce.value = false), 220);

  props.analytics.track({
    name: 'enable_mic',
    payload: { success: false, fallbackUsed: true },
  });
}

onMounted(() => {
  loadSettings();
  loadOnboardingFlag();
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // если пользователь сразу попал в игру — покажем onboarding
  if (!onboardingSeen.value) {
    openOnboardingIfNeeded();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', resize);

  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;

  // Важно: если аудио пришло сверху (App-level singleton),
  // не выключаем микрофон при размонтировании игры.
  if (ownsAudio) audio.stop();
});
</script>

<template>
  <section class="mt-8" aria-label="Sound Pop Game">
    <div class="rounded-3xl border border-ink/10 shadow-2xl bg-white p-6 sm:p-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight text-ink">Sound Pop</h2>
          <p class="mt-2 text-sm text-ink/65 max-w-[68ch]">
            Лопай пузыри с буквами. Ошибок нет — только мягкие подсказки. Раунд 30–60 секунд.
          </p>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-3xl px-5 py-3 min-h-[44px] font-bold shadow-xl border border-ink/10 bg-mint text-ink active:scale-[0.98] hover:shadow-2xl"
              data-magnetic="true"
              @click="running ? stopRound(false) : startRound()"
              @touchstart.passive="running ? stopRound(false) : startRound()"
              :aria-label="running ? 'Остановить' : 'Начать'"
            >
              {{ running ? 'Пауза' : 'Старт' }}
            </button>

            <button
              type="button"
              class="rounded-3xl px-5 py-3 min-h-[44px] font-semibold shadow-xl border border-ink/10 bg-white text-ink active:scale-[0.98] hover:shadow-2xl"
              data-magnetic="true"
              @click="openOnboardingIfNeeded"
              @touchstart.passive="openOnboardingIfNeeded"
              aria-label="Показать подсказки"
            >
              Подсказки
            </button>

            <div
              class="rounded-3xl bg-sunny/55 border border-ink/10 px-4 py-3 min-h-[44px] flex items-center gap-3"
            >
              <div>
                <p class="text-xs font-semibold text-ink/80">Время</p>
                <p class="text-sm font-extrabold text-ink">{{ Math.ceil(timeLeft) }}с</p>
              </div>
              <div class="w-[1px] h-8 bg-ink/10"></div>
              <div>
                <p class="text-xs font-semibold text-ink/80">Счёт</p>
                <p class="text-sm font-extrabold text-ink">{{ score }}</p>
              </div>
              <div class="w-[1px] h-8 bg-ink/10"></div>
              <div>
                <p class="text-xs font-semibold text-ink/80">Серия</p>
                <p class="text-sm font-extrabold text-ink">{{ streak }}</p>
              </div>
            </div>

            <div
              class="rounded-3xl border border-ink/10 bg-white px-4 py-3 min-h-[44px] flex items-center"
            >
              <p class="text-xs text-ink/60">
                FPS: <span class="font-bold text-ink">{{ Math.round(fps) }}</span
                >, bubbles: <span class="font-bold text-ink">{{ maxBubbles }}</span>
              </p>
            </div>
          </div>

          <div v-if="rewardText" class="mt-4 rounded-3xl border border-ink/10 bg-mint/30 px-4 py-3">
            <p class="text-sm font-extrabold text-ink">{{ rewardText }}</p>
          </div>
        </div>

        <!-- Настройки (Kids-friendly: мало текста, крупные контролы) -->
        <div class="rounded-3xl border border-ink/10 bg-white shadow-xl p-5 w-full lg:w-[420px]">
          <p class="text-sm font-extrabold text-ink">Настройки</p>

          <div class="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow"
              :class="
                settings.mode === 'target' ? 'bg-mint/60 font-extrabold' : 'bg-white font-semibold'
              "
              data-magnetic="true"
              @click="setMode('target')"
              @touchstart.passive="setMode('target')"
            >
              Лови звук
            </button>
            <button
              type="button"
              class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow"
              :class="
                settings.mode === 'mixed' ? 'bg-mint/60 font-extrabold' : 'bg-white font-semibold'
              "
              data-magnetic="true"
              @click="setMode('mixed')"
              @touchstart.passive="setMode('mixed')"
            >
              Смешанный
            </button>
          </div>

          <div class="mt-4">
            <p class="text-xs font-semibold text-ink/70">Целевой звук</p>
            <div class="mt-2 flex gap-2">
              <button
                v-for="s in ['R', 'L', 'SH'] as Sound[]"
                :key="s"
                type="button"
                class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow text-sm"
                :class="
                  settings.targetSound === s
                    ? 'bg-sunny/70 font-extrabold'
                    : 'bg-white font-semibold'
                "
                data-magnetic="true"
                @click="setTarget(s)"
                @touchstart.passive="setTarget(s)"
                :aria-label="`Выбрать ${s}`"
              >
                {{ s === 'SH' ? 'Ш' : s }}
              </button>
            </div>
            <p class="mt-2 text-[12px] text-ink/55">
              В “Смешанном” режиме цель остаётся выбранной — это сохраняет фокус “Лови звук”.
            </p>
          </div>

          <div class="mt-4">
            <p class="text-xs font-semibold text-ink/70">Звуки (multi-select)</p>
            <div class="mt-2 flex gap-2">
              <button
                v-for="s in ['R', 'L', 'SH'] as Sound[]"
                :key="s"
                type="button"
                class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow text-sm"
                :class="
                  settings.selectedSounds.includes(s)
                    ? 'bg-mint/55 font-extrabold'
                    : 'bg-white font-semibold'
                "
                data-magnetic="true"
                @click="toggleSound(s)"
                @touchstart.passive="toggleSound(s)"
              >
                {{ s === 'SH' ? 'Ш' : s }}
              </button>
            </div>
          </div>

          <div class="mt-4">
            <p class="text-xs font-semibold text-ink/70">Уровень</p>
            <div class="mt-2 flex gap-2">
              <button
                v-for="lv in [1, 2, 3] as Level[]"
                :key="lv"
                type="button"
                class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow text-sm"
                :class="
                  settings.level === lv ? 'bg-sunny/70 font-extrabold' : 'bg-white font-semibold'
                "
                data-magnetic="true"
                @click="setLevel(lv)"
                @touchstart.passive="setLevel(lv)"
              >
                {{ lv }}
              </button>
            </div>
          </div>

          <div class="mt-4">
            <p class="text-xs font-semibold text-ink/70">
              Длина раунда: {{ settings.roundSeconds }}с
            </p>
            <input
              class="mt-2 w-full"
              type="range"
              min="30"
              max="60"
              step="1"
              :value="settings.roundSeconds"
              @input="setRoundSeconds(Number(($event.target as HTMLInputElement).value))"
              aria-label="Длина раунда"
            />
          </div>

          <!-- MIC block -->
          <div class="mt-5 rounded-3xl border border-ink/10 bg-white p-4">
            <p class="text-sm font-extrabold text-ink">Микрофон (только громкость)</p>
            <p class="mt-1 text-xs text-ink/60">
              Мы измеряем лишь уровень громкости. Никаких записей, распознавания речи и сохранения
              аудио.
            </p>

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-if="audio.state.value !== 'listening'"
                type="button"
                class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow bg-mint text-ink font-bold"
                data-magnetic="true"
                @click="enableMic"
                @touchstart.passive="enableMic"
              >
                Включить
              </button>

              <button
                v-else
                type="button"
                class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow bg-white text-ink font-bold"
                data-magnetic="true"
                @click="disableMic"
                @touchstart.passive="disableMic"
              >
                Выключить
              </button>

              <button
                type="button"
                class="rounded-3xl px-4 py-3 min-h-[44px] border border-ink/10 shadow bg-sunny/70 text-ink font-extrabold"
                data-magnetic="true"
                @click="fallbackLoud"
                @touchstart.passive="fallbackLoud"
                aria-label="Fallback громко"
              >
                ГРОМКО!
              </button>
            </div>

            <div class="mt-3">
              <p class="text-xs font-semibold text-ink/70">Шкала громкости</p>
              <div class="mt-2 h-3 rounded-full bg-ink/10 overflow-hidden">
                <div
                  class="h-full rounded-full bg-mint"
                  :style="{ width: `${Math.round(audio.level.value * 100)}%` }"
                ></div>
              </div>

              <div class="mt-3">
                <p class="text-xs font-semibold text-ink/70">
                  Порог: {{ Math.round(audio.threshold.value * 100) }}%
                </p>
                <input
                  class="mt-2 w-full"
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.01"
                  :value="audio.threshold.value"
                  @input="audio.setThreshold(Number(($event.target as HTMLInputElement).value))"
                  aria-label="Порог громкости"
                />
              </div>

              <p v-if="audio.state.value === 'error'" class="mt-2 text-xs text-ink/60">
                {{ audio.errorMessage.value }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Игровое поле -->
      <div class="mt-6">
        <div
          ref="containerRef"
          class="relative rounded-3xl border border-ink/10 bg-gradient-to-b from-mint/35 to-white shadow-2xl overflow-hidden"
          style="height: 420px"
          role="application"
          aria-label="Игровое поле Sound Pop"
        >
          <!-- Подсказка цели (без наказаний) -->
          <div
            class="absolute left-4 top-4 z-10 rounded-3xl bg-white/80 backdrop-blur-md border border-ink/10 px-4 py-3"
          >
            <p class="text-xs font-semibold text-ink/70">Лови звук</p>
            <p class="text-lg font-extrabold text-ink">
              {{ settings.targetSound === 'SH' ? 'Ш' : settings.targetSound }}
            </p>
          </div>

          <!-- Персонаж (условно “живой”, прыгает от громкости/кнопки) -->
          <div
            class="absolute right-4 bottom-4 z-10 rounded-3xl bg-white/75 backdrop-blur-md border border-ink/10 p-4"
          >
            <div
              class="relative size-[110px] rounded-full bg-mint border border-ink/10 shadow-2xl"
              :class="[
                reducedMotion ? '' : 'animate-breathe',
                micBounce ? 'scale-[1.08] -translate-y-1' : '',
              ]"
              style="transition: transform 160ms ease"
              aria-label="Персонаж"
              role="img"
            >
              <div
                class="absolute left-[28%] top-[36%] size-7 rounded-full bg-white shadow"
                aria-hidden="true"
              >
                <div class="absolute left-2 top-2 size-3 rounded-full bg-ink/90"></div>
              </div>
              <div
                class="absolute right-[28%] top-[36%] size-7 rounded-full bg-white shadow"
                aria-hidden="true"
              >
                <div class="absolute left-2 top-2 size-3 rounded-full bg-ink/90"></div>
              </div>
              <div
                class="absolute left-1/2 top-[62%] h-5 w-14 -translate-x-1/2 rounded-b-full border-b-4 border-ink/25"
                aria-hidden="true"
              ></div>
            </div>
            <p class="mt-2 text-[11px] text-ink/60">Подпрыгивает от громкости (или “ГРОМКО!”)</p>
          </div>

          <!-- Пузыри -->
          <div class="absolute inset-0">
            <button
              v-for="b in bubbles"
              :key="b.id"
              type="button"
              class="absolute left-0 top-0"
              :style="bubbleStyle(b)"
              @click="tapBubble(b, $event)"
              @touchstart.passive="tapBubble(b, $event)"
              :aria-label="`Пузырь ${b.letter}`"
            >
              <div
                class="relative size-[88px] rounded-full border border-ink/10 shadow-2xl"
                :class="[b.popped ? 'animate-pop' : '', b.smile ? 'ring-4 ring-sunny/60' : '']"
                style="background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px)"
              >
                <div class="absolute inset-0 rounded-full bg-mint/35" aria-hidden="true"></div>

                <div
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-ink"
                >
                  {{ b.letter === 'SH' ? 'Ш' : b.letter }}
                </div>

                <!-- no-fail улыбка на “не тот” пузырь -->
                <div
                  v-if="b.smile"
                  class="absolute left-1/2 top-[70%] -translate-x-1/2 text-[11px] font-semibold text-ink/70 animate-driftUp"
                >
                  Хи-хи 🙂
                </div>
              </div>
            </button>
          </div>

          <!-- Частицы -->
          <div v-if="!reducedMotion" class="absolute inset-0 pointer-events-none">
            <div
              v-for="p in particles"
              :key="p.id"
              class="absolute size-2 rounded-full bg-sunny/80 shadow"
              :style="{
                transform: `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`,
              }"
            ></div>
          </div>

          <!-- Onboarding overlay -->
          <div v-if="onboardingStep >= 0" class="absolute inset-0 z-20">
            <div class="absolute inset-0 bg-ink/30 backdrop-blur-sm"></div>
            <div
              class="absolute left-1/2 top-1/2 w-[92%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-2xl border border-ink/10 p-6"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-extrabold text-ink">Подсказки</p>
                  <p class="mt-1 text-xs text-ink/60">2–3 шага, минимум текста</p>
                </div>
                <button
                  type="button"
                  class="rounded-3xl px-4 py-2 min-h-[44px] border border-ink/10 bg-white shadow font-semibold"
                  data-magnetic="true"
                  @click="skipOnboarding"
                  @touchstart.passive="skipOnboarding"
                >
                  Пропустить
                </button>
              </div>

              <div class="mt-4 rounded-3xl border border-ink/10 bg-mint/25 p-4">
                <p v-if="onboardingStep === 0" class="text-sm font-semibold text-ink">
                  1) Нажимай на пузыри с нужной буквой.
                </p>
                <p v-else-if="onboardingStep === 1" class="text-sm font-semibold text-ink">
                  2) Если нажал не туда — это не ошибка. Будет мягкая подсказка.
                </p>
                <p v-else class="text-sm font-semibold text-ink">
                  3) Можно включить микрофон — он измеряет только громкость. Нет записи и
                  распознавания речи.
                </p>
              </div>

              <div class="mt-5 flex flex-wrap gap-3 justify-between items-center">
                <div class="rounded-3xl bg-sunny/60 border border-ink/10 px-4 py-3">
                  <p class="text-xs font-semibold text-ink/70">Шаг</p>
                  <p class="text-sm font-extrabold text-ink">{{ onboardingStep + 1 }}/3</p>
                </div>

                <button
                  type="button"
                  class="rounded-3xl px-6 py-3 min-h-[44px] bg-mint border border-ink/10 shadow-2xl font-extrabold text-ink active:scale-[0.98]"
                  data-magnetic="true"
                  @click="nextOnboarding"
                  @touchstart.passive="nextOnboarding"
                >
                  Дальше
                </button>
              </div>

              <p class="mt-3 text-[11px] text-ink/55">
                Доступность: можно управлять клавишами Enter/Space (кнопки доступны фокусом).
              </p>
            </div>
          </div>

          <!-- Когда не запущено -->
          <div v-if="!running" class="absolute inset-0 flex items-center justify-center">
            <div
              class="rounded-3xl bg-white/80 backdrop-blur-md border border-ink/10 shadow-2xl px-6 py-5"
            >
              <p class="text-sm font-extrabold text-ink">Готов?</p>
              <p class="mt-1 text-xs text-ink/60">Нажми “Старт” — и лови звук.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
