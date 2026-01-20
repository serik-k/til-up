<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useAudioLevel } from '../composables/useAudioLevel';
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

  popped: boolean; // also used as "interaction lock"
  smile: boolean;

  removeAt: number | null; // timestamp ms when can be removed from array
};

type Particle = {
  id: string;
  x: number; // px (container coords)
  y: number; // px (container coords)
  vx: number; // px/s
  vy: number; // px/s
  life: number; // ms
  born: number; // ms
  alpha: number; // 0..1
};

const props = defineProps<{
  reducedMotion: boolean;
}>();

const reducedMotion = computed(() => props.reducedMotion);

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

type GameState = 'idle' | 'running' | 'paused';
const gameState = ref<GameState>('idle');

const isRunning = computed(() => gameState.value === 'running');
const isPaused = computed(() => gameState.value === 'paused');
const isIdle = computed(() => gameState.value === 'idle');

const timeLeft = ref(settings.roundSeconds);
const score = ref(0);
const streak = ref(0);
const freezeUsed = ref(false);
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
let micBounceTimer: number | null = null;

const onboardingStep = ref(-1);
const onboardingSeen = ref(false);

const onboardingOpen = computed(() => onboardingStep.value >= 0);
const interactionsLocked = computed(() => onboardingStep.value >= 0);
const onboardingTrapActive = computed(() => onboardingOpen.value && !!onboardingModalRef.value);

let ro: ResizeObserver | null = null;
let windowResizeAttached = false;

const timers = new Set<number>();

// Resize throttling
let resizeRaf: number | null = null;
let pendingW = 0;
let pendingH = 0;

const onboardingModalRef = ref<HTMLElement | null>(null);
let onboardingOpener: HTMLElement | null = null;

function safeNow() {
  return performance.now();
}

function uid(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${(crypto as Crypto).randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function schedule(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}

function clearScheduledTimers() {
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
}

function clearMicBounceTimer() {
  if (micBounceTimer !== null) {
    window.clearTimeout(micBounceTimer);
    micBounceTimer = null;
  }
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

    if (parsed && (parsed.mode === 'target' || parsed.mode === 'mixed')) {
      settings.mode = parsed.mode;
    }

    if (
      parsed &&
      (parsed.targetSound === 'R' || parsed.targetSound === 'L' || parsed.targetSound === 'SH')
    ) {
      settings.targetSound = parsed.targetSound;
    }

    if (Array.isArray(parsed?.selectedSounds)) {
      const valid = parsed.selectedSounds.filter((s: any) => s === 'R' || s === 'L' || s === 'SH');
      if (valid.length) settings.selectedSounds = Array.from(new Set(valid));
    }

    if (parsed?.level === 1 || parsed?.level === 2 || parsed?.level === 3) {
      settings.level = parsed.level;
    }

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

function resizeFromRect(w: number, h: number) {
  width.value = w;
  height.value = h;
}

function requestResizeCommit(w: number, h: number) {
  pendingW = w;
  pendingH = h;

  if (resizeRaf !== null) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    resizeFromRect(pendingW, pendingH);
  });
}

function resizeFallback() {
  const el = containerRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  requestResizeCommit(r.width, r.height);
}

const activeSounds = computed<Sound[]>(() => {
  if (settings.mode === 'target') return [settings.targetSound];
  return settings.selectedSounds.length ? settings.selectedSounds : (['R', 'L', 'SH'] as Sound[]);
});

function pickLetter(): Sound {
  const pool = activeSounds.value;
  return pool[Math.floor(Math.random() * pool.length)] as Sound;
}

function computeDifficultyMultiplier(): number {
  if (settings.level === 1) return 1.0;
  if (settings.level === 2) return 1.18;
  return 1.35;
}

function updateMaxBubblesByFps() {
  const base = 12;
  if (fps.value >= 55) maxBubbles.value = clamp(base + 2, 10, 14);
  else if (fps.value >= 45) maxBubbles.value = clamp(base, 10, 14);
  else if (fps.value >= 35) maxBubbles.value = clamp(base - 1, 10, 14);
  else maxBubbles.value = 10;
}

function spawnBubble() {
  if (!isRunning.value) return;
  if (!width.value || !height.value) return;

  let aliveCount = 0;
  for (const bb of bubbles.value) if (bb.alive) aliveCount += 1;
  if (aliveCount >= maxBubbles.value) return;

  const m = computeDifficultyMultiplier();
  const b: Bubble = {
    id: uid('b'),
    x: Math.random(),
    y: -60,
    vy: (70 + Math.random() * 40) * m,
    letter: pickLetter(),
    alive: true,
    smile: false,
    popped: false,
    removeAt: null,
  };

  bubbles.value.push(b);
}

function removeDead() {
  const now = safeNow();

  bubbles.value = bubbles.value.filter((b) => {
    if (b.alive) return true;
    if (b.removeAt !== null && now < b.removeAt) return true;
    return false;
  });

  particles.value = particles.value.filter((p) => now - p.born < p.life);
}

function containerPointFromClient(clientX: number, clientY: number) {
  const el = containerRef.value;
  if (!el) return { x: clientX, y: clientY };
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function addParticles(clientX: number, clientY: number) {
  if (reducedMotion.value) return;

  const now = safeNow();
  const pt = containerPointFromClient(clientX, clientY);

  const count = 14;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 160;

    particles.value.push({
      id: uid('p'),
      x: pt.x,
      y: pt.y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 60,
      life: 650 + Math.random() * 350,
      born: now,
      alpha: 1,
    });
  }
}

function isCorrectBubble(b: Bubble): boolean {
  return b.letter === settings.targetSound;
}

function noFailFeedback(b: Bubble) {
  b.popped = true;

  const now = safeNow();
  b.smile = true;

  const hintMs = reducedMotion.value ? 0 : 420;
  b.removeAt = now + hintMs;

  schedule(() => {
    b.smile = false;
    b.alive = false;
  }, hintMs);
}

function applyWrongTapFeedback(b: Bubble) {
  streak.value = 0;
  rewardText.value = '';
  noFailFeedback(b);
}

function popBubbleAsCorrect(b: Bubble, clientX: number, clientY: number) {
  if (!isRunning.value) return;
  if (interactionsLocked.value) return;
  if (!b.alive) return;
  if (b.popped) return;

  b.popped = true;

  const now = safeNow();
  const popMs = reducedMotion.value ? 0 : 220;

  b.removeAt = now + popMs;

  score.value += 1;
  streak.value += 1;
  rewardText.value = '';

  addParticles(clientX, clientY);

  schedule(() => {
    b.alive = false;
  }, popMs);
}

async function ensureSizeBeforeLoop() {
  await nextTick();
  const el = containerRef.value;
  if (!el) return;

  // предпочтительно: резайз уже придёт из observer, но гарантируем fallback
  if (!width.value || !height.value) {
    const r = el.getBoundingClientRect();
    resizeFromRect(r.width, r.height);
  }
}

function resetRoundState() {
  rewardText.value = '';
  score.value = 0;
  streak.value = 0;
  freezeUsed.value = false;

  timeLeft.value = settings.roundSeconds;
  bubbles.value = [];
  particles.value = [];

  clearScheduledTimers();
  clearMicBounceTimer();

  spawnAcc = 0;
  lastTs = safeNow();
}

async function startRound() {
  if (isRunning.value || isPaused.value) return;
  if (onboardingOpen.value) return;

  resetRoundState();
  gameState.value = 'running';

  await ensureSizeBeforeLoop();

  rafId = requestAnimationFrame(loop);
}

function pauseRound() {
  if (!isRunning.value) return;

  gameState.value = 'paused';
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function resumeRound() {
  if (!isPaused.value) return;
  if (onboardingOpen.value) return;

  gameState.value = 'running';
  lastTs = safeNow();
  rafId = requestAnimationFrame(loop);
}

function stopRound(showReward: boolean) {
  if (isIdle.value) return;

  gameState.value = 'idle';

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  clearScheduledTimers();
  clearMicBounceTimer();

  bubbles.value = [];
  particles.value = [];

  if (showReward) {
    rewardText.value =
      score.value >= 8 ? 'Супер!' : score.value >= 4 ? 'Класс!' : 'Отлично получилось!';
  }
}

function loop(ts: number) {
  if (!isRunning.value) return;

  const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
  lastTs = ts;

  const inst = 1 / dt;
  fps.value = fps.value * 0.92 + inst * 0.08;
  updateMaxBubblesByFps();

  timeLeft.value = Math.max(0, timeLeft.value - dt);
  if (timeLeft.value <= 0) {
    stopRound(true);
    return;
  }

  const m = computeDifficultyMultiplier();
  const baseSpawn = 0.85 / m;
  spawnAcc += dt;
  while (spawnAcc >= baseSpawn) {
    spawnAcc -= baseSpawn;
    spawnBubble();
  }

  for (const b of bubbles.value) {
    if (!b.alive) continue;

    b.y += b.vy * dt;

    if (b.y > height.value + 80) {
      b.popped = true;
      b.alive = false;
      b.smile = false;
      b.removeAt = safeNow() + 50;
    }
  }

  if (!reducedMotion.value) {
    const now = safeNow();
    for (const p of particles.value) {
      const age = now - p.born;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;

      const tLife = clamp(age / p.life, 0, 1);
      p.alpha = 1 - tLife;
    }
  }

  removeDead();
  rafId = requestAnimationFrame(loop);
}

function bubbleStyle(b: Bubble) {
  const safeW = Math.max(88, width.value);
  const px = b.x * (safeW - 88) + 44;
  const py = b.y;

  return {
    transform: `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`,
  };
}

function onBubblePointerDown(b: Bubble, e: PointerEvent) {
  if (!isRunning.value) return;
  if (interactionsLocked.value) return;
  if (!b.alive || b.popped) return;

  e.preventDefault();
  e.stopPropagation();

  if (isCorrectBubble(b)) {
    popBubbleAsCorrect(b, e.clientX, e.clientY);
  } else {
    applyWrongTapFeedback(b);
  }
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

const onboardingPausedGame = ref(false);

function openOnboardingIfNeeded() {
  if (onboardingStep.value < 0) onboardingStep.value = 0;

  onboardingOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  nextTick(() => {
    focusFirstInOnboarding();
  });

  onboardingPausedGame.value = false;
  if (isRunning.value) {
    onboardingPausedGame.value = true;
    pauseRound();
  }
}

function nextOnboarding() {
  if (onboardingStep.value < 2) {
    onboardingStep.value += 1;
    nextTick(() => focusFirstInOnboarding());
  } else {
    closeOnboarding(true);
  }
}

function closeOnboarding(markSeen: boolean) {
  if (markSeen) markOnboardingSeen();
  else onboardingStep.value = -1;

  nextTick(() => {
    if (onboardingOpener) {
      onboardingOpener.focus();
      onboardingOpener = null;
    }

    if (onboardingPausedGame.value && isPaused.value && onboardingStep.value < 0) {
      onboardingPausedGame.value = false;
      resumeRound();
    } else {
      onboardingPausedGame.value = false;
    }
  });
}

function skipOnboarding() {
  closeOnboarding(true);
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
  );
  return Array.from(nodes).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function focusFirstInOnboarding() {
  const modal = onboardingModalRef.value;
  if (!modal) return;

  const els = focusableElements(modal);
  if (els.length) els[0].focus();
}

function handleOnboardingKeydown(e: KeyboardEvent) {
  if (!onboardingOpen.value) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeOnboarding(true);
    return;
  }

  if (e.key !== 'Tab') return;

  const modal = onboardingModalRef.value;
  if (!modal) return;

  const els = focusableElements(modal);
  if (!els.length) {
    e.preventDefault();
    return;
  }

  const first = els[0];
  const last = els[els.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey) {
    if (!active || active === first || !modal.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!active || active === last || !modal.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }
}

watch(
  onboardingTrapActive,
  (active) => {
    if (active) document.addEventListener('keydown', handleOnboardingKeydown);
    else document.removeEventListener('keydown', handleOnboardingKeydown);
  },
  { immediate: true }
);

watch(
  () => settings.roundSeconds,
  () => {
    if (isIdle.value) timeLeft.value = settings.roundSeconds;
  }
);

watch(
  () => audio.level.value,
  (v) => {
    if (audio.state.value !== 'listening') return;
    if (v >= audio.threshold.value) {
      micBounce.value = true;
      clearMicBounceTimer();
      micBounceTimer = window.setTimeout(() => {
        micBounce.value = false;
        micBounceTimer = null;
      }, 180);
    }
  }
);

async function enableMic() {
  try {
    await audio.start();
  } catch {}
}

function disableMic() {
  audio.stop();
}

function attachResizeObservers() {
  const el = containerRef.value;
  if (!el) return;

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const cr = entry.contentRect;
      requestResizeCommit(cr.width, cr.height);
    });
    ro.observe(el);
  } else if (!windowResizeAttached) {
    window.addEventListener('resize', resizeFallback, { passive: true });
    windowResizeAttached = true;
  }

  // initial
  const r = el.getBoundingClientRect();
  resizeFromRect(r.width, r.height);
}

onMounted(async () => {
  loadSettings();
  loadOnboardingFlag();
  timeLeft.value = settings.roundSeconds;

  await nextTick();
  attachResizeObservers();

  if (!onboardingSeen.value && onboardingStep.value >= 0) {
    nextTick(() => focusFirstInOnboarding());
  }
});

onUnmounted(() => {
  if (ro) {
    ro.disconnect();
    ro = null;
  }
  if (windowResizeAttached) {
    window.removeEventListener('resize', resizeFallback);
    windowResizeAttached = false;
  }

  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;

  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  resizeRaf = null;

  clearScheduledTimers();
  clearMicBounceTimer();

  if (ownsAudio) audio.stop();
});
</script>

<template>
  <section class="mt-6" aria-label="Sound Pop Game">
    <div class="mx-auto max-w-6xl">
      <!-- Shell -->
      <div
        class="relative overflow-hidden rounded-3xl border border-sky-200/60 bg-white shadow-[0_30px_80px_rgba(2,132,199,0.14)]"
      >
        <!-- Background soft blobs -->
        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
          <div
            class="absolute -left-24 -top-28 h-[320px] w-[320px] rounded-full bg-sky-200/55 blur-3xl"
          ></div>
          <div
            class="absolute -right-28 -top-24 h-[340px] w-[340px] rounded-full bg-pink-200/50 blur-3xl"
          ></div>
          <div
            class="absolute left-1/2 top-[65%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-100/60 blur-3xl"
          ></div>
        </div>

        <!-- Header -->
        <header class="relative border-b border-sky-200/50 px-4 py-5 sm:px-6 sm:py-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-sky-200/70 bg-white/70 shadow-sm backdrop-blur"
                  aria-hidden="true"
                >
                  <span class="h-2 w-2 rounded-full bg-sky-400"></span>
                </span>
                <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  Sound Pop
                </h2>
              </div>

              <p class="mt-2 max-w-[72ch] text-xs text-slate-600 sm:text-sm">
                Лопай пузыри с буквами. Ошибок нет — только мягкие подсказки. Раунд 30–60 секунд.
              </p>
            </div>

            <!-- Compact Stats (ровные карточки) -->
            <div class="grid w-full grid-cols-3 gap-2 sm:w-auto sm:gap-3">
              <div
                class="flex min-h-[52px] items-center gap-3 rounded-2xl border border-sky-200/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
              >
                <span class="h-2 w-2 rounded-full bg-sky-400" aria-hidden="true"></span>
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold text-slate-500">Время</p>
                  <p class="text-sm font-extrabold text-slate-900">{{ Math.ceil(timeLeft) }}с</p>
                </div>
              </div>

              <div
                class="flex min-h-[52px] items-center gap-3 rounded-2xl border border-pink-200/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
              >
                <span class="h-2 w-2 rounded-full bg-pink-400" aria-hidden="true"></span>
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold text-slate-500">Счёт</p>
                  <p class="text-sm font-extrabold text-slate-900">{{ score }}</p>
                </div>
              </div>

              <div
                class="flex min-h-[52px] items-center gap-3 rounded-2xl border border-sky-200/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
              >
                <span class="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true"></span>
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold text-slate-500">Серия</p>
                  <p class="text-sm font-extrabold text-slate-900">{{ streak }}</p>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="rewardText"
            class="mt-4 flex items-start gap-3 rounded-2xl border border-pink-200/60 bg-white/75 px-4 py-3 shadow-sm backdrop-blur"
          >
            <span
              class="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-200 to-sky-200 shadow-sm"
              aria-hidden="true"
            ></span>
            <p class="text-sm font-extrabold text-slate-900" aria-live="polite">
              {{ rewardText }}
            </p>
          </div>
        </header>

        <!-- Content grid -->
        <div class="relative grid grid-cols-1 gap-0 lg:grid-cols-12 lg:items-stretch">
          <!-- Game column -->
          <div class="lg:col-span-8 p-4 sm:p-6 flex flex-col h-full">
            <!-- Top Controls (desktop/tablet) -->
            <div class="hidden flex-wrap items-center gap-2 sm:flex">
              <!-- Primary -->
              <button
                type="button"
                class="group relative inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-200 to-sky-100 px-5 py-3 font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
                data-magnetic="true"
                @click="isIdle ? startRound() : isRunning ? pauseRound() : resumeRound()"
                :disabled="onboardingOpen"
                :aria-label="isIdle ? 'Начать' : isRunning ? 'Пауза' : 'Продолжить'"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none absolute -inset-24 opacity-0 blur-2xl transition group-hover:opacity-100"
                  style="
                    background:
                      radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.55), transparent 55%),
                      radial-gradient(circle at 70% 40%, rgba(244, 114, 182, 0.35), transparent 60%);
                  "
                ></span>
                <span class="relative">
                  {{ isIdle ? 'Старт' : isRunning ? 'Пауза' : 'Продолжить' }}
                </span>
              </button>

              <!-- Ghost -->
              <button
                type="button"
                class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-white/70 px-4 py-3 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                data-magnetic="true"
                @click="stopRound(false)"
                :disabled="isIdle"
                aria-label="Остановить"
              >
                Стоп
              </button>

              <button
                type="button"
                class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-pink-200/70 bg-white/70 px-4 py-3 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98]"
                data-magnetic="true"
                @click="openOnboardingIfNeeded"
                aria-label="Показать подсказки"
              >
                Подсказки
              </button>

              <!-- Perf pills -->
              <div class="ml-auto hidden items-center gap-2 md:flex">
                <div
                  class="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
                >
                  <span class="text-xs font-semibold text-slate-500">FPS</span>
                  <span class="text-xs font-extrabold text-slate-900">{{ Math.round(fps) }}</span>
                </div>
                <div
                  class="inline-flex items-center gap-2 rounded-full border border-pink-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
                >
                  <span class="text-xs font-semibold text-slate-500">Bubbles</span>
                  <span class="text-xs font-extrabold text-slate-900">{{ maxBubbles }}</span>
                </div>
              </div>
            </div>

            <!-- Game Field -->
            <div class="mt-4 flex-1">
              <div
                ref="containerRef"
                class="relative overflow-hidden rounded-3xl border border-sky-200/70 bg-white shadow-[0_18px_60px_rgba(14,165,233,0.14)] h-[calc(100dvh-290px)] min-h-[320px] sm:h-auto sm:min-h-[520px] lg:h-full lg:min-h-0"
                style="touch-action: none"
                role="region"
                aria-label="Игровое поле Sound Pop"
              >
                <!-- Field background -->
                <div aria-hidden="true" class="pointer-events-none absolute inset-0">
                  <div
                    class="absolute inset-0"
                    style="
                      background:
                        radial-gradient(
                          520px 260px at 18% 10%,
                          rgba(56, 189, 248, 0.25),
                          transparent 60%
                        ),
                        radial-gradient(
                          520px 280px at 88% 16%,
                          rgba(244, 114, 182, 0.2),
                          transparent 62%
                        ),
                        radial-gradient(
                          700px 320px at 50% 110%,
                          rgba(186, 230, 253, 0.25),
                          transparent 60%
                        ),
                        linear-gradient(
                          180deg,
                          rgba(255, 255, 255, 0.82),
                          rgba(255, 255, 255, 0.96)
                        );
                    "
                  ></div>
                  <div
                    class="absolute left-6 top-6 h-2 w-2 rounded-full bg-sky-300/70 blur-[1px]"
                  ></div>
                  <div
                    class="absolute right-10 top-10 h-3 w-3 rounded-full bg-pink-300/60 blur-[1px]"
                  ></div>
                </div>

                <!-- Bubbles -->
                <div class="absolute inset-0">
                  <button
                    v-for="b in bubbles"
                    :key="b.id"
                    type="button"
                    class="absolute left-0 top-0 touch-none disabled:pointer-events-none"
                    :style="bubbleStyle(b)"
                    :disabled="!b.alive || b.popped || !isRunning || interactionsLocked"
                    @pointerdown="onBubblePointerDown(b, $event)"
                    :aria-label="`Пузырь с буквой ${b.letter === 'SH' ? 'Ш' : b.letter}`"
                  >
                    <div
                      class="relative size-[80px] rounded-full border border-sky-200/70 bg-white/75 shadow-[0_18px_50px_rgba(2,132,199,0.16)] backdrop-blur"
                      :class="[
                        b.popped ? 'animate-pop' : '',
                        b.smile ? 'ring-4 ring-pink-200/70' : '',
                      ]"
                    >
                      <!-- Glass highlight -->
                      <div
                        aria-hidden="true"
                        class="absolute inset-0 rounded-full"
                        style="
                          background:
                            radial-gradient(
                              circle at 30% 25%,
                              rgba(255, 255, 255, 0.75),
                              transparent 48%
                            ),
                            radial-gradient(
                              circle at 75% 80%,
                              rgba(56, 189, 248, 0.18),
                              transparent 58%
                            );
                        "
                      ></div>

                      <div
                        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-slate-900"
                      >
                        {{ b.letter === 'SH' ? 'Ш' : b.letter }}
                      </div>

                      <div
                        v-if="b.smile"
                        class="absolute left-1/2 top-[70%] -translate-x-1/2 text-[11px] font-semibold text-slate-700 animate-driftUp"
                      >
                        Хи-хи 🙂
                      </div>
                    </div>
                  </button>
                </div>

                <!-- Particles -->
                <div v-if="!reducedMotion" class="absolute inset-0 pointer-events-none">
                  <div
                    v-for="p in particles"
                    :key="p.id"
                    class="absolute size-2 rounded-full shadow"
                    :style="{
                      transform: `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`,
                      opacity: String(Math.max(0, Math.min(1, p.alpha))),
                      background: 'rgba(244,114,182,0.75)',
                      boxShadow: '0 14px 35px rgba(244,114,182,0.18)',
                    }"
                  ></div>
                </div>

                <!-- Idle overlay -->
                <div v-if="isIdle" class="absolute inset-0 flex items-center justify-center p-4">
                  <div
                    class="rounded-3xl border border-sky-200/70 bg-white/75 px-6 py-5 shadow-sm backdrop-blur"
                  >
                    <p class="text-sm font-extrabold text-slate-900">Готов?</p>
                    <p class="mt-1 text-xs text-slate-600">Нажми “Старт” — и лови звук.</p>
                  </div>
                </div>

                <!-- Onboarding -->
                <div v-if="onboardingStep >= 0" class="absolute inset-0 z-20">
                  <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"></div>

                  <div
                    ref="onboardingModalRef"
                    class="absolute left-1/2 top-1/2 w-[92%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh-120px)] overflow-hidden rounded-3xl border border-sky-200/70 bg-white/85 p-5 shadow-[0_30px_80px_rgba(2,132,199,0.20)] backdrop-blur sm:p-6 sm:max-h-[80vh]"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Подсказки"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-extrabold text-slate-900">Подсказки</p>
                        <p class="mt-1 text-xs text-slate-600">2–3 шага, минимум текста</p>
                      </div>

                      <button
                        type="button"
                        class="inline-flex min-h-[40px] items-center justify-center rounded-2xl border border-pink-200/70 bg-white/70 px-3 py-2 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98]"
                        data-magnetic="true"
                        @click="skipOnboarding"
                      >
                        Пропустить
                      </button>
                    </div>

                    <div
                      class="mt-4 rounded-3xl border border-sky-200/70 bg-white/70 p-4 backdrop-blur"
                    >
                      <p v-if="onboardingStep === 0" class="text-sm font-semibold text-slate-900">
                        1) Нажимай на пузыри с нужной буквой.
                      </p>
                      <p
                        v-else-if="onboardingStep === 1"
                        class="text-sm font-semibold text-slate-900"
                      >
                        2) Если нажал не туда — это не ошибка. Будет мягкая подсказка.
                      </p>
                      <p v-else class="text-sm font-semibold text-slate-900">
                        3) Можно включить микрофон: мы распознаём произнесённые “Р”, “Л”, “Ш”, чтобы
                        лопать пузыри. Мы не сохраняем аудио — распознавание работает в браузере.
                      </p>
                    </div>

                    <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div
                        class="rounded-2xl border border-pink-200/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur"
                      >
                        <p class="text-xs font-semibold text-slate-600">Шаг</p>
                        <p class="text-sm font-extrabold text-slate-900">
                          {{ onboardingStep + 1 }}/3
                        </p>
                      </div>

                      <button
                        type="button"
                        class="group relative inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-gradient-to-br from-pink-200 to-sky-200 px-5 py-3 font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98]"
                        data-magnetic="true"
                        @click="nextOnboarding"
                      >
                        <span
                          aria-hidden="true"
                          class="pointer-events-none absolute -inset-24 opacity-0 blur-2xl transition group-hover:opacity-100"
                          style="
                            background:
                              radial-gradient(
                                circle at 30% 30%,
                                rgba(244, 114, 182, 0.55),
                                transparent 55%
                              ),
                              radial-gradient(
                                circle at 70% 40%,
                                rgba(56, 189, 248, 0.4),
                                transparent 60%
                              );
                          "
                        ></span>
                        <span class="relative">Дальше</span>
                      </button>
                    </div>

                    <p class="mt-3 text-[11px] text-slate-500">
                      Доступность: Tab/Shift+Tab остаются внутри окна, Escape закрывает подсказки.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile controls (in-flow, not fixed) -->
            <div class="mt-4 sm:hidden">
              <div
                class="rounded-3xl border border-sky-200/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur"
              >
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="group relative inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-200 to-sky-100 px-5 py-3 font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
                    @click="isIdle ? startRound() : isRunning ? pauseRound() : resumeRound()"
                    :disabled="onboardingOpen"
                    :aria-label="isIdle ? 'Начать' : isRunning ? 'Пауза' : 'Продолжить'"
                  >
                    <span
                      aria-hidden="true"
                      class="pointer-events-none absolute -inset-24 opacity-0 blur-2xl transition group-hover:opacity-100"
                      style="
                        background:
                          radial-gradient(
                            circle at 30% 30%,
                            rgba(56, 189, 248, 0.55),
                            transparent 55%
                          ),
                          radial-gradient(
                            circle at 70% 40%,
                            rgba(244, 114, 182, 0.35),
                            transparent 60%
                          );
                      "
                    ></span>
                    <span class="relative">
                      {{ isIdle ? 'Старт' : isRunning ? 'Пауза' : 'Продолжить' }}
                    </span>
                  </button>

                  <button
                    type="button"
                    class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-white/70 px-4 py-3 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                    @click="stopRound(false)"
                    :disabled="isIdle"
                    aria-label="Остановить"
                  >
                    Стоп
                  </button>
                </div>

                <div class="mt-2 flex items-center gap-2">
                  <div
                    class="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
                  >
                    <span class="text-xs font-semibold text-slate-500">FPS</span>
                    <span class="text-xs font-extrabold text-slate-900">{{ Math.round(fps) }}</span>
                  </div>
                  <div
                    class="inline-flex items-center gap-2 rounded-full border border-pink-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
                  >
                    <span class="text-xs font-semibold text-slate-500">Bubbles</span>
                    <span class="text-xs font-extrabold text-slate-900">{{ maxBubbles }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls column -->
          <aside
            class="lg:col-span-4 border-t border-sky-200/50 bg-white/55 p-4 backdrop-blur sm:p-6 lg:border-l lg:border-t-0 h-full flex flex-col"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-extrabold text-slate-900">Настройки</p>
              <button
                type="button"
                class="sm:hidden inline-flex min-h-[40px] items-center justify-center rounded-2xl border border-pink-200/70 bg-white/70 px-3 py-2 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98]"
                @click="openOnboardingIfNeeded"
              >
                Подсказки
              </button>
            </div>

            <!-- Mobile accordions -->
            <div class="mt-3 space-y-2 sm:hidden">
              <details
                class="overflow-hidden rounded-3xl border border-pink-200/70 bg-white/70 shadow-sm backdrop-blur"
              >
                <summary
                  class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-slate-900"
                >
                  Микрофон
                </summary>
                <div class="space-y-3 px-4 pb-4">
                  <p class="text-xs text-slate-600">
                    Мы используем микрофон для распознавания “Р”, “Л”, “Ш”, чтобы лопать пузыри.
                    Аудио не сохраняется.
                  </p>

                  <div class="flex flex-wrap gap-2">
                    <button
                      v-if="audio.state.value !== 'listening'"
                      type="button"
                      class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-200 to-sky-100 px-4 py-3 font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98]"
                      @click="enableMic"
                    >
                      Включить
                    </button>

                    <button
                      v-else
                      type="button"
                      class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-white/70 px-4 py-3 font-semibold text-slate-900 shadow-sm backdrop-blur transition active:scale-[0.98]"
                      @click="disableMic"
                    >
                      Выключить
                    </button>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-semibold text-slate-600">Шкала громкости</p>
                      <p class="text-xs font-extrabold text-slate-900">
                        {{ Math.round(audio.level.value * 100) }}%
                      </p>
                    </div>
                    <div class="mt-2 h-3 overflow-hidden rounded-full bg-sky-100">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-sky-300 to-pink-300"
                        :style="{ width: `${Math.round(audio.level.value * 100)}%` }"
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-semibold text-slate-600">Порог</p>
                      <p class="text-xs font-extrabold text-slate-900">
                        {{ Math.round(audio.threshold.value * 100) }}%
                      </p>
                    </div>
                    <input
                      class="mt-2 w-full accent-pink-400"
                      type="range"
                      min="0.05"
                      max="0.5"
                      step="0.01"
                      :value="audio.threshold.value"
                      @input="audio.setThreshold(Number(($event.target as HTMLInputElement).value))"
                      aria-label="Порог громкости"
                    />
                  </div>

                  <p v-if="audio.state.value === 'error'" class="text-xs text-slate-600">
                    {{ audio.errorMessage.value }}
                  </p>
                </div>
              </details>

              <details
                class="overflow-hidden rounded-3xl border border-sky-200/70 bg-white/70 shadow-sm backdrop-blur"
              >
                <summary
                  class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-slate-900"
                >
                  Режим
                </summary>
                <div class="px-4 pb-4">
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                      :class="
                        settings.mode === 'target'
                          ? 'bg-gradient-to-br from-sky-200/70 to-white/60 font-extrabold'
                          : ''
                      "
                      :aria-pressed="settings.mode === 'target'"
                      @click="setMode('target')"
                      :disabled="!isIdle"
                    >
                      Лови звук
                    </button>
                    <button
                      type="button"
                      class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                      :class="
                        settings.mode === 'mixed'
                          ? 'bg-gradient-to-br from-sky-200/70 to-white/60 font-extrabold'
                          : ''
                      "
                      :aria-pressed="settings.mode === 'mixed'"
                      @click="setMode('mixed')"
                      :disabled="!isIdle"
                    >
                      Смешанный
                    </button>
                  </div>
                </div>
              </details>

              <details
                class="overflow-hidden rounded-3xl border border-pink-200/70 bg-white/70 shadow-sm backdrop-blur"
              >
                <summary
                  class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-slate-900"
                >
                  Буквы
                </summary>
                <div class="space-y-3 px-4 pb-4">
                  <div>
                    <p class="text-xs font-semibold text-slate-600">Целевой звук</p>
                    <div class="mt-2 grid grid-cols-3 gap-2">
                      <button
                        v-for="s in ['R', 'L', 'SH'] as const"
                        :key="s"
                        type="button"
                        class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                        :class="
                          settings.targetSound === s
                            ? 'bg-gradient-to-br from-pink-200/70 to-white/60 font-extrabold border-pink-200/70'
                            : ''
                        "
                        :aria-pressed="settings.targetSound === s"
                        @click="setTarget(s)"
                        :disabled="!isIdle"
                      >
                        {{ s === 'SH' ? 'Ш' : s }}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p class="text-xs font-semibold text-slate-600">Звуки (multi-select)</p>
                    <div class="mt-2 grid grid-cols-3 gap-2">
                      <button
                        v-for="s in ['R', 'L', 'SH'] as const"
                        :key="s"
                        type="button"
                        class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                        :class="
                          settings.selectedSounds.includes(s)
                            ? 'bg-gradient-to-br from-sky-200/70 to-white/60 font-extrabold'
                            : ''
                        "
                        :aria-pressed="settings.selectedSounds.includes(s)"
                        @click="toggleSound(s)"
                        :disabled="!isIdle"
                      >
                        {{ s === 'SH' ? 'Ш' : s }}
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              <details
                class="overflow-hidden rounded-3xl border border-sky-200/70 bg-white/70 shadow-sm backdrop-blur"
              >
                <summary
                  class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-slate-900"
                >
                  Сложность и время
                </summary>
                <div class="space-y-3 px-4 pb-4">
                  <div>
                    <p class="text-xs font-semibold text-slate-600">Уровень</p>
                    <div class="mt-2 grid grid-cols-3 gap-2">
                      <button
                        v-for="lv in [1, 2, 3] as const"
                        :key="lv"
                        type="button"
                        class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                        :class="
                          settings.level === lv
                            ? 'bg-gradient-to-br from-pink-200/70 to-white/60 font-extrabold border-pink-200/70'
                            : ''
                        "
                        :aria-pressed="settings.level === lv"
                        @click="setLevel(lv)"
                        :disabled="!isIdle"
                      >
                        {{ lv }}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-semibold text-slate-600">Длина раунда</p>
                      <p class="text-xs font-extrabold text-slate-900">
                        {{ settings.roundSeconds }}с
                      </p>
                    </div>
                    <input
                      class="mt-2 w-full accent-sky-400"
                      type="range"
                      min="30"
                      max="60"
                      step="1"
                      :value="settings.roundSeconds"
                      @input="setRoundSeconds(Number(($event.target as HTMLInputElement).value))"
                      :disabled="!isIdle"
                      aria-label="Длина раунда"
                    />
                  </div>
                </div>
              </details>
            </div>

            <!-- Desktop/tablet controls (no accordions) -->
            <div class="mt-4 hidden space-y-3 sm:block">
              <!-- Tablet: 2 columns, Desktop: 1 column -->

              <div
                class="rounded-3xl border border-pink-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"
              >
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p class="text-xs font-extrabold text-slate-900">Микрофон</p>
                    <p class="mt-1 text-xs text-slate-600">
                      Мы измеряем лишь уровень громкости. Никаких записей, распознавания речи и
                      сохранения аудио.
                    </p>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <button
                      v-if="audio.state.value !== 'listening'"
                      type="button"
                      class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-200 to-sky-100 px-4 py-3 font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98]"
                      @click="enableMic"
                    >
                      Включить
                    </button>

                    <button
                      v-else
                      type="button"
                      class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-white/70 px-4 py-3 font-semibold text-slate-900 shadow-sm backdrop-blur transition active:scale-[0.98]"
                      @click="disableMic"
                    >
                      Выключить
                    </button>
                  </div>
                </div>

                <div class="mt-3">
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold text-slate-600">Шкала громкости</p>
                    <p class="text-xs font-extrabold text-slate-900">
                      {{ Math.round(audio.level.value * 100) }}%
                    </p>
                  </div>
                  <div class="mt-2 h-3 overflow-hidden rounded-full bg-sky-100">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-sky-300 to-pink-300"
                      :style="{ width: `${Math.round(audio.level.value * 100)}%` }"
                    ></div>
                  </div>
                </div>

                <div class="mt-4">
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold text-slate-600">Порог</p>
                    <p class="text-xs font-extrabold text-slate-900">
                      {{ Math.round(audio.threshold.value * 100) }}%
                    </p>
                  </div>
                  <input
                    class="mt-2 w-full accent-pink-400"
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.01"
                    :value="audio.threshold.value"
                    @input="audio.setThreshold(Number(($event.target as HTMLInputElement).value))"
                    aria-label="Порог громкости"
                  />
                </div>

                <p v-if="audio.state.value === 'error'" class="mt-2 text-xs text-slate-600">
                  {{ audio.errorMessage.value }}
                </p>
              </div>

              <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1">
                <div
                  class="rounded-3xl border border-sky-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"
                >
                  <p class="text-xs font-extrabold text-slate-900">Режим</p>
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                      :class="
                        settings.mode === 'target'
                          ? 'bg-gradient-to-br from-sky-200/70 to-white/60 font-extrabold'
                          : ''
                      "
                      :aria-pressed="settings.mode === 'target'"
                      @click="setMode('target')"
                      :disabled="!isIdle"
                    >
                      Лови звук
                    </button>
                    <button
                      type="button"
                      class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                      :class="
                        settings.mode === 'mixed'
                          ? 'bg-gradient-to-br from-sky-200/70 to-white/60 font-extrabold'
                          : ''
                      "
                      :aria-pressed="settings.mode === 'mixed'"
                      @click="setMode('mixed')"
                      :disabled="!isIdle"
                    >
                      Смешанный
                    </button>
                  </div>
                </div>

                <div
                  class="rounded-3xl border border-pink-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"
                >
                  <p class="text-xs font-extrabold text-slate-900">Сложность и время</p>

                  <p class="mt-3 text-xs font-semibold text-slate-600">Уровень</p>
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <button
                      v-for="lv in [1, 2, 3] as const"
                      :key="lv"
                      type="button"
                      class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                      :class="
                        settings.level === lv
                          ? 'bg-gradient-to-br from-pink-200/70 to-white/60 font-extrabold border-pink-200/70'
                          : ''
                      "
                      :aria-pressed="settings.level === lv"
                      @click="setLevel(lv)"
                      :disabled="!isIdle"
                    >
                      {{ lv }}
                    </button>
                  </div>

                  <div class="mt-4">
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-semibold text-slate-600">Длина раунда</p>
                      <p class="text-xs font-extrabold text-slate-900">
                        {{ settings.roundSeconds }}с
                      </p>
                    </div>
                    <input
                      class="mt-2 w-full accent-sky-400"
                      type="range"
                      min="30"
                      max="60"
                      step="1"
                      :value="settings.roundSeconds"
                      @input="setRoundSeconds(Number(($event.target as HTMLInputElement).value))"
                      :disabled="!isIdle"
                      aria-label="Длина раунда"
                    />
                  </div>
                </div>
              </div>

              <div
                class="rounded-3xl border border-sky-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"
              >
                <p class="text-xs font-extrabold text-slate-900">Буквы</p>

                <p class="mt-3 text-xs font-semibold text-slate-600">Целевой звук</p>
                <div class="mt-2 grid grid-cols-3 gap-2">
                  <button
                    v-for="s in ['R', 'L', 'SH'] as const"
                    :key="s"
                    type="button"
                    class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                    :class="
                      settings.targetSound === s
                        ? 'bg-gradient-to-br from-pink-200/70 to-white/60 font-extrabold border-pink-200/70'
                        : ''
                    "
                    :aria-pressed="settings.targetSound === s"
                    @click="setTarget(s)"
                    :disabled="!isIdle"
                  >
                    {{ s === 'SH' ? 'Ш' : s }}
                  </button>
                </div>

                <p class="mt-3 text-xs font-semibold text-slate-600">Звуки (multi-select)</p>
                <div class="mt-2 grid grid-cols-3 gap-2">
                  <button
                    v-for="s in ['R', 'L', 'SH'] as const"
                    :key="s"
                    type="button"
                    class="min-h-[44px] rounded-2xl border border-sky-200/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur active:scale-[0.98] disabled:opacity-60"
                    :class="
                      settings.selectedSounds.includes(s)
                        ? 'bg-gradient-to-br from-sky-200/70 to-white/60 font-extrabold'
                        : ''
                    "
                    :aria-pressed="settings.selectedSounds.includes(s)"
                    @click="toggleSound(s)"
                    :disabled="!isIdle"
                  >
                    {{ s === 'SH' ? 'Ш' : s }}
                  </button>
                </div>

                <p class="mt-3 text-[12px] text-slate-500">
                  В “Смешанном” режиме цель остаётся выбранной — это сохраняет фокус “Лови звук”.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </section>
</template>
