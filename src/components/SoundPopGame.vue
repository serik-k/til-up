<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  triggerRef,
  watch,
} from 'vue';
import { useAudioLevel } from '../composables/useAudioLevel';
import { useAudioLevelInjected } from '../composables/useAudioLevelProvider';
import { useI18n } from 'vue-i18n';

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

  popped: boolean;
  smile: boolean;

  removeAt: number | null; // ms timestamp
  tf: string; // cached transform style
};

type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // ms
  born: number; // ms
  alpha: number; // 0..1
  style: string; // cached style (transform+opacity)
};

const props = defineProps<{ reducedMotion: boolean }>();

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
const width = ref(0);
const height = ref(0);

const BUBBLE_SIZE = 80;
const BUBBLE_R = BUBBLE_SIZE / 2;

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
const rewardText = ref<string>('');

const bubbles = shallowRef<Bubble[]>([]);
const particles = shallowRef<Particle[]>([]);

const MAX_BUBBLES = 12;

let rafId: number | null = null;
let lastTs = 0;
let spawnAcc = 0;

let aliveBubblesCount = 0;

let timeLeftMs = settings.roundSeconds * 1000;
let lastUiTimeUpdateTs = 0;

let lastSweepTs = 0;

/** ====== Dirty commit only when needed ====== */
let dirtyBubbles = false;
let dirtyParticles = false;

function markDirtyB() {
  dirtyBubbles = true;
}
function markDirtyP() {
  dirtyParticles = true;
}
function commitFrame() {
  if (dirtyBubbles) {
    dirtyBubbles = false;
    triggerRef(bubbles);
  }
  if (dirtyParticles) {
    dirtyParticles = false;
    triggerRef(particles);
  }
}

/** mic */
const injectedAudio = useAudioLevelInjected();
const ownsAudio = !injectedAudio;
const audio = injectedAudio ?? useAudioLevel();

/** onboarding */
const onboardingStep = ref(-1);
const onboardingOpen = computed(() => onboardingStep.value >= 0);
const interactionsLocked = computed(() => onboardingOpen.value);

const onboardingModalRef = ref<HTMLElement | null>(null);
const onboardingPausedGame = ref(false);

function safeNow() {
  return performance.now();
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

const SOUND_LABEL: Record<Sound, string> = { R: 'Р', L: 'Л', SH: 'Ш' };
function soundLabel(s: Sound) {
  return SOUND_LABEL[s] ?? s;
}

/** computed for template */
const timeLeftCeil = computed(() => Math.ceil(timeLeft.value));

const audioPercent = computed(() => {
  const v = Number(audio.level.value);
  if (!Number.isFinite(v)) return 0;
  return Math.round(clamp(v, 0, 1) * 100);
});

const primaryActionText = computed(() =>
  isIdle.value ? 'Старт' : isRunning.value ? 'Пауза' : 'Продолжить'
);
const primaryActionAria = computed(() =>
  isIdle.value ? 'Начать' : isRunning.value ? 'Пауза' : 'Продолжить'
);

function onPrimaryActionClick() {
  if (isIdle.value) startRound();
  else if (isRunning.value) pauseRound();
  else resumeRound();
}

/** ids */
let idSeq = 0;
function uid(prefix: string) {
  idSeq += 1;
  return `${prefix}_${idSeq}`;
}

/** ====== resize (batched) ====== */
let ro: ResizeObserver | null = null;
let roRaf: number | null = null;
let pendingW = 0;
let pendingH = 0;

function updateAllBubbleTransforms() {
  if (!bubbles.value.length) return;
  for (let i = 0; i < bubbles.value.length; i++) {
    updateBubbleTransform(bubbles.value[i]!);
  }
  markDirtyB();

  if (!isRunning.value) {
    dirtyBubbles = false;
    triggerRef(bubbles);
  }
}

function flushSize() {
  width.value = pendingW;
  height.value = pendingH;
  roRaf = null;

  updateAllBubbleTransforms();
}

function attachResizeObservers() {
  const el = containerRef.value;
  if (!el) return;

  ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const cr = entry.contentRect;
    pendingW = cr.width;
    pendingH = cr.height;
    if (roRaf === null) roRaf = requestAnimationFrame(flushSize);
  });

  ro.observe(el);

  const r = el.getBoundingClientRect();
  pendingW = r.width;
  pendingH = r.height;
  flushSize();
}

/** ====== pools ====== */
const particlePool: Particle[] = [];
const bubblePool: Bubble[] = [];

function getParticle(): Particle {
  return (
    particlePool.pop() ?? {
      id: '',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      born: 0,
      alpha: 1,
      style: '',
    }
  );
}
function recycleParticle(p: Particle) {
  if (particlePool.length < 800) particlePool.push(p);
}

function getBubble(): Bubble {
  return (
    bubblePool.pop() ?? {
      id: '',
      x: 0,
      y: 0,
      vy: 0,
      letter: 'R',
      alive: true,
      popped: false,
      smile: false,
      removeAt: null,
      tf: '',
    }
  );
}
function recycleBubble(b: Bubble) {
  if (bubblePool.length < 200) bubblePool.push(b);
}

/** ====== helpers ====== */
function containerPointFromClient(clientX: number, clientY: number) {
  const el = containerRef.value;
  if (!el) return { x: clientX, y: clientY };
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function bubbleClientCenter(b: Bubble) {
  const el = containerRef.value;
  if (!el) return { clientX: 0, clientY: 0 };

  const rect = el.getBoundingClientRect();
  const safeW = width.value || rect.width || BUBBLE_SIZE;

  const px = b.x * (safeW - BUBBLE_SIZE) + BUBBLE_R;
  const py = b.y + BUBBLE_R;

  return { clientX: rect.left + px, clientY: rect.top + py };
}

function updateBubbleTransform(b: Bubble) {
  const safeW = width.value > 0 ? width.value : BUBBLE_SIZE;
  const left = (b.x * (safeW - BUBBLE_SIZE) + 0.5) | 0;
  const top = (b.y + 0.5) | 0;
  b.tf = `transform: translate3d(${left}px, ${top}px, 0);`;
}

function updateParticleStyle(p: Particle) {
  const x = (p.x + 0.5) | 0;
  const y = (p.y + 0.5) | 0;
  const a = clamp(p.alpha, 0, 1);
  p.style = `transform: translate3d(${x}px, ${y}px, 0); opacity: ${a};`;
}

/** ====== gameplay ====== */
function spawnPool(): Sound[] {
  if (settings.mode === 'target') return [settings.targetSound];
  return settings.selectedSounds.length ? settings.selectedSounds : (['R', 'L', 'SH'] as Sound[]);
}

function pickLetter(): Sound {
  const pool = spawnPool();
  return pool[(Math.random() * pool.length) | 0] as Sound;
}

function computeDifficultyMultiplier(): number {
  if (settings.level === 1) return 1.0;
  if (settings.level === 2) return 1.18;
  return 1.35;
}

function spawnBubble(m: number) {
  if (!isRunning.value) return;
  if (!width.value || !height.value) return;
  if (aliveBubblesCount >= MAX_BUBBLES) return;

  const b = getBubble();
  b.id = uid('b');
  b.x = Math.random();
  b.y = -BUBBLE_SIZE;
  b.vy = (70 + Math.random() * 40) * m;
  b.letter = pickLetter();
  b.alive = true;
  b.smile = false;
  b.popped = false;
  b.removeAt = null;
  updateBubbleTransform(b);

  bubbles.value.push(b);
  aliveBubblesCount += 1;

  markDirtyB();
}

function killBubble(b: Bubble, now: number, keepMs: number, smile: boolean) {
  if (b.popped) return;

  b.popped = true;
  b.smile = smile;

  if (b.alive) {
    b.alive = false;
    aliveBubblesCount = aliveBubblesCount > 0 ? aliveBubblesCount - 1 : 0;
  }

  b.removeAt = now + keepMs;
  markDirtyB();
}

function sweepDeadInPlace(now: number) {
  const arrB = bubbles.value;
  let wB = 0;

  for (let i = 0; i < arrB.length; i++) {
    const b = arrB[i]!;
    if (b.alive) {
      arrB[wB++] = b;
      continue;
    }
    if (b.removeAt !== null && now < b.removeAt) {
      arrB[wB++] = b;
      continue;
    }
    recycleBubble(b);
  }
  arrB.length = wB;

  const arrP = particles.value;
  let wP = 0;

  for (let i = 0; i < arrP.length; i++) {
    const p = arrP[i]!;
    if (now - p.born < p.life) {
      arrP[wP++] = p;
    } else {
      recycleParticle(p);
    }
  }
  arrP.length = wP;

  markDirtyB();
  markDirtyP();
}

function clearAllEntitiesToPool() {
  for (let i = 0; i < bubbles.value.length; i++) recycleBubble(bubbles.value[i]!);
  bubbles.value.length = 0;

  for (let i = 0; i < particles.value.length; i++) recycleParticle(particles.value[i]!);
  particles.value.length = 0;

  aliveBubblesCount = 0;

  dirtyBubbles = false;
  dirtyParticles = false;
  triggerRef(bubbles);
  triggerRef(particles);
}

function addParticles(clientX: number, clientY: number) {
  if (props.reducedMotion) return;

  const now = safeNow();
  const pt = containerPointFromClient(clientX, clientY);

  const count = 14;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 160;

    const p = getParticle();
    p.id = uid('p');
    p.x = pt.x;
    p.y = pt.y;
    p.vx = Math.cos(ang) * sp;
    p.vy = Math.sin(ang) * sp - 60;
    p.life = 650 + Math.random() * 350;
    p.born = now;
    p.alpha = 1;
    updateParticleStyle(p);

    particles.value.push(p);
  }

  markDirtyP();
}

function isCorrectBubble(b: Bubble): boolean {
  if (settings.mode === 'mixed') return settings.selectedSounds.includes(b.letter);
  return b.letter === settings.targetSound;
}

function applyWrongTapFeedback(b: Bubble) {
  rewardText.value = '';

  const now = safeNow();
  const hintMs = props.reducedMotion ? 0 : 420;

  killBubble(b, now, hintMs, true);
}

function popBubbleAsCorrect(b: Bubble, clientX: number, clientY: number) {
  if (!isRunning.value) return;
  if (interactionsLocked.value) return;
  if (b.popped) return;

  const now = safeNow();
  const popMs = props.reducedMotion ? 0 : 220;

  killBubble(b, now, popMs, false);

  score.value += 1;
  rewardText.value = '';

  addParticles(clientX, clientY);
}

async function ensureSizeBeforeLoop() {
  await nextTick();
  const el = containerRef.value;
  if (!el) return;

  if (!width.value || !height.value) {
    const r = el.getBoundingClientRect();
    width.value = r.width;
    height.value = r.height;
  }
}

function resetRoundState() {
  rewardText.value = '';
  score.value = 0;

  timeLeftMs = settings.roundSeconds * 1000;
  timeLeft.value = settings.roundSeconds;
  lastUiTimeUpdateTs = 0;

  clearAllEntitiesToPool();

  spawnAcc = 0;
  lastTs = 0;
  lastSweepTs = 0;

  dirtyBubbles = false;
  dirtyParticles = false;
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
  lastTs = 0;
  rafId = requestAnimationFrame(loop);
}

function stopRound(showReward: boolean) {
  if (isIdle.value) return;

  gameState.value = 'idle';

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  clearAllEntitiesToPool();

  if (showReward) {
    rewardText.value =
      score.value >= 8 ? 'Супер!' : score.value >= 4 ? 'Класс!' : 'Отлично получилось!';
  } else {
    rewardText.value = '';
    score.value = 0;

    timeLeftMs = settings.roundSeconds * 1000;
    timeLeft.value = settings.roundSeconds;
    lastUiTimeUpdateTs = 0;

    spawnAcc = 0;
    lastTs = 0;
    lastSweepTs = 0;
  }
}

function loop(ts: number) {
  if (!isRunning.value) return;

  if (lastTs === 0) lastTs = ts;

  const dtRaw = Math.max(0, (ts - lastTs) / 1000);
  const dtMotion = Math.min(0.05, Math.max(0.001, dtRaw));
  lastTs = ts;

  // real time
  timeLeftMs = Math.max(0, timeLeftMs - dtRaw * 1000);

  // ui time (10fps)
  if (lastUiTimeUpdateTs === 0 || ts - lastUiTimeUpdateTs >= 100) {
    lastUiTimeUpdateTs = ts;
    timeLeft.value = Math.max(0, timeLeftMs / 1000);
  }

  if (timeLeftMs <= 0) {
    timeLeft.value = 0;
    stopRound(true);
    return;
  }

  const now = ts;

  // spawn
  const m = computeDifficultyMultiplier();
  const baseSpawn = 0.85 / m;

  spawnAcc += dtMotion;
  while (spawnAcc >= baseSpawn) {
    spawnAcc -= baseSpawn;
    spawnBubble(m);
  }

  // bubbles
  let touchedB = false;
  for (let i = 0; i < bubbles.value.length; i++) {
    const b = bubbles.value[i]!;
    if (!b.alive) continue;

    b.y += b.vy * dtMotion;

    if (b.y > height.value + BUBBLE_SIZE) {
      killBubble(b, now, 50, false);
      touchedB = true;
    } else {
      updateBubbleTransform(b);
      touchedB = true;
    }
  }
  if (touchedB) markDirtyB();

  // particles
  if (!props.reducedMotion && particles.value.length) {
    let touchedP = false;

    for (let i = 0; i < particles.value.length; i++) {
      const p = particles.value[i]!;
      const age = now - p.born;

      p.x += p.vx * dtMotion;
      p.y += p.vy * dtMotion;
      p.vy += 420 * dtMotion;

      const tLife = clamp(age / p.life, 0, 1);
      p.alpha = 1 - tLife;
      updateParticleStyle(p);

      touchedP = true;
    }

    if (touchedP) markDirtyP();
  }

  // sweep (time-based)
  if (
    lastSweepTs === 0 ||
    ts - lastSweepTs >= 120 ||
    bubbles.value.length > 64 ||
    particles.value.length > 512
  ) {
    lastSweepTs = ts;
    sweepDeadInPlace(now);
  }

  commitFrame();
  rafId = requestAnimationFrame(loop);
}

function onBubblePointerDown(b: Bubble, e: PointerEvent) {
  if (!isRunning.value) return;
  if (interactionsLocked.value) return;
  if (b.popped) return;

  e.preventDefault();
  e.stopPropagation();

  if (isCorrectBubble(b)) popBubbleAsCorrect(b, e.clientX, e.clientY);
  else applyWrongTapFeedback(b);
}

function onBubbleKeydown(b: Bubble, e: KeyboardEvent) {
  if (!isRunning.value) return;
  if (interactionsLocked.value) return;
  if (b.popped) return;

  if (e.key !== 'Enter' && e.key !== ' ') return;

  e.preventDefault();
  e.stopPropagation();

  const c = bubbleClientCenter(b);
  if (isCorrectBubble(b)) popBubbleAsCorrect(b, c.clientX, c.clientY);
  else applyWrongTapFeedback(b);
}

/** settings */
function toggleSound(sound: Sound) {
  const set = new Set(settings.selectedSounds);
  set.has(sound) ? set.delete(sound) : set.add(sound);

  const next = Array.from(set) as Sound[];
  settings.selectedSounds = next.length ? next : (['R', 'L', 'SH'] as Sound[]);
}
function setTarget(sound: Sound) {
  settings.targetSound = sound;
}
function setLevel(v: Level) {
  settings.level = v;
}
function setMode(v: GameMode) {
  settings.mode = v;
}
function setRoundSeconds(v: number) {
  settings.roundSeconds = clamp(Math.round(v), 30, 60);
}

/** onboarding */
function focusOnboarding() {
  onboardingModalRef.value?.focus();
}

function openOnboardingIfNeeded() {
  if (onboardingStep.value < 0) onboardingStep.value = 0;

  nextTick(() => focusOnboarding());

  onboardingPausedGame.value = false;
  if (isRunning.value) {
    onboardingPausedGame.value = true;
    pauseRound();
  }
}

function nextOnboarding() {
  if (onboardingStep.value < 2) {
    onboardingStep.value += 1;
    nextTick(() => focusOnboarding());
  } else {
    closeOnboarding();
  }
}

function closeOnboarding() {
  const shouldResume = onboardingPausedGame.value;
  onboardingStep.value = -1;

  nextTick(() => {
    if (shouldResume && isPaused.value && onboardingStep.value < 0) {
      onboardingPausedGame.value = false;
      resumeRound();
    } else {
      onboardingPausedGame.value = false;
    }
  });
}

function skipOnboarding() {
  closeOnboarding();
}

function handleOnboardingKeydown(e: KeyboardEvent) {
  if (!onboardingOpen.value) return;
  if (e.key !== 'Escape') return;
  e.preventDefault();
  closeOnboarding();
}

watch(
  onboardingOpen,
  (open) => {
    if (open) document.addEventListener('keydown', handleOnboardingKeydown);
    else document.removeEventListener('keydown', handleOnboardingKeydown);
  },
  { immediate: true }
);

watch(
  () => settings.roundSeconds,
  () => {
    if (isIdle.value) {
      timeLeftMs = settings.roundSeconds * 1000;
      timeLeft.value = settings.roundSeconds;
      lastUiTimeUpdateTs = 0;
    }
  }
);

/** mic */
async function enableMic() {
  try {
    await audio.start();
  } catch {
    // ignore
  }
}
function disableMic() {
  audio.stop();
}

/** visibility auto-pause */
function handleVisibilityChange() {
  if (document.hidden && isRunning.value) pauseRound();
}

/** lifecycle */
onMounted(async () => {
  timeLeftMs = settings.roundSeconds * 1000;
  timeLeft.value = settings.roundSeconds;

  await nextTick();
  attachResizeObservers();

  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  ro?.disconnect();
  ro = null;

  if (roRaf !== null) {
    cancelAnimationFrame(roRaf);
    roRaf = null;
  }

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (ownsAudio) audio.stop();

  document.removeEventListener('keydown', handleOnboardingKeydown);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  clearAllEntitiesToPool();
});
</script>

<template>
  <section class="mt-6" aria-label="Sound Pop Game">
    <div class="mx-auto max-w-6xl">
      <div
        class="relative overflow-hidden rounded-3xl border border-sky-200/60 bg-white shadow-[0_30px_80px_rgba(2,132,199,0.14)]"
      >
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
                  {{ t('game.title') }}
                </h2>
              </div>

              <p class="mt-2 max-w-[72ch] text-xs text-slate-600 sm:text-sm">
                {{ t('game.subtitle') }}
              </p>
              <p class="mt-2 max-w-[72ch] text-xs text-slate-600 sm:text-sm">
                Лопай пузыри с буквами. Раунд 30–60 секунд.
              </p>
            </div>

            <div class="grid w-full grid-cols-2 gap-2 sm:w-auto sm:gap-3">
              <div
                class="flex min-h-[52px] items-center gap-3 rounded-2xl border border-sky-200/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur"
              >
                <span class="h-2 w-2 rounded-full bg-sky-400" aria-hidden="true"></span>
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold text-slate-500">Время</p>
                  <p class="text-sm font-extrabold text-slate-900">{{ timeLeftCeil }}с</p>
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
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="group relative inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-200 to-sky-100 px-5 py-3 font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
              @click="onPrimaryActionClick"
              :aria-label="primaryActionAria"
              :disabled="onboardingOpen"
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
              <span class="relative">{{ primaryActionText }}</span>
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

            <button
              type="button"
              class="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-pink-200/70 bg-white/70 px-4 py-3 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98]"
              @click="openOnboardingIfNeeded"
              aria-label="Показать подсказки"
            >
              Подсказки
            </button>
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

        <div class="relative grid grid-cols-1 gap-0 lg:grid-cols-12 lg:items-stretch">
          <div class="lg:col-span-8 p-4 sm:p-6 flex flex-col h-full">
            <div class="flex-1">
              <div
                ref="containerRef"
                class="relative overflow-hidden rounded-3xl border border-sky-200/70 bg-white shadow-[0_18px_60px_rgba(14,165,233,0.14)] h-[calc(100dvh-290px)] min-h-[320px] sm:h-auto sm:min-h-[520px] lg:h-full lg:min-h-0"
                style="touch-action: none"
                role="region"
                aria-label="Игровое поле Sound Pop"
              >
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
                </div>

                <div class="absolute inset-0">
                  <button
                    v-for="b in bubbles"
                    :key="b.id"
                    type="button"
                    class="absolute left-0 top-0 touch-none disabled:pointer-events-none"
                    :style="b.tf"
                    :disabled="b.popped || !isRunning || interactionsLocked"
                    @pointerdown="onBubblePointerDown(b, $event)"
                    @keydown="onBubbleKeydown(b, $event)"
                    :aria-label="`Пузырь с буквой ${soundLabel(b.letter)}`"
                  >
                    <div
                      class="relative size-[80px] rounded-full border border-sky-200/70 bg-white/75 shadow-[0_18px_50px_rgba(2,132,199,0.16)] backdrop-blur"
                      :class="[
                        b.popped ? 'animate-pop' : '',
                        b.smile ? 'ring-4 ring-pink-200/70' : '',
                      ]"
                    >
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
                        {{ soundLabel(b.letter) }}
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

                <div v-if="!props.reducedMotion" class="absolute inset-0 pointer-events-none">
                  <div
                    v-for="p in particles"
                    :key="p.id"
                    class="particle-dot absolute size-2 rounded-full"
                    :style="p.style"
                  ></div>
                </div>

                <div v-if="isIdle" class="absolute inset-0 flex items-center justify-center p-4">
                  <div
                    class="rounded-3xl border border-sky-200/70 bg-white/75 px-6 py-5 shadow-sm backdrop-blur"
                  >
                    <p class="text-sm font-extrabold text-slate-900">Готов?</p>
                    <p class="mt-1 text-xs text-slate-600">Нажми “Старт” — и лови звук.</p>
                  </div>
                </div>

                <div v-if="onboardingStep >= 0" class="absolute inset-0 z-20">
                  <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"></div>

                  <div
                    ref="onboardingModalRef"
                    class="absolute left-1/2 top-1/2 w-[92%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh-120px)] overflow-hidden rounded-3xl border border-sky-200/70 bg-white/85 p-5 shadow-[0_30px_80px_rgba(2,132,199,0.20)] backdrop-blur sm:p-6 sm:max-h-[80vh]"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Подсказки"
                    tabindex="-1"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-extrabold text-slate-900">Подсказки</p>
                        <p class="mt-1 text-xs text-slate-600">2–3 шага, минимум текста</p>
                      </div>

                      <button
                        type="button"
                        class="inline-flex min-h-[40px] items-center justify-center rounded-2xl border border-pink-200/70 bg-white/70 px-3 py-2 font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98]"
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
                        3) Можно включить микрофон: мы показываем шкалу громкости. Аудио не
                        сохраняется.
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

                    <p class="mt-3 text-[11px] text-slate-500">Escape закрывает подсказки.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside
            class="lg:col-span-4 border-t border-sky-200/50 bg-white/55 p-4 backdrop-blur sm:p-6 lg:border-l lg:border-t-0 h-full"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-extrabold text-slate-900">Настройки</p>
            </div>

            <div class="mt-3 space-y-2">
              <details
                open
                class="overflow-hidden rounded-3xl border border-pink-200/70 bg-white/70 shadow-sm backdrop-blur"
              >
                <summary
                  class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-slate-900"
                >
                  Микрофон
                </summary>
                <div class="space-y-3 px-4 pb-4">
                  <p class="text-xs text-slate-600">
                    Мы показываем уровень громкости микрофона. Аудио не сохраняется.
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
                      <p class="text-xs font-extrabold text-slate-900">{{ audioPercent }}%</p>
                    </div>
                    <div class="mt-2 h-3 overflow-hidden rounded-full bg-sky-100">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-sky-300 to-pink-300"
                        :style="{ width: `${audioPercent}%` }"
                      ></div>
                    </div>
                  </div>

                  <p v-if="audio.state.value === 'error'" class="text-xs text-slate-600">
                    {{ audio.errorMessage.value }}
                  </p>
                </div>
              </details>

              <details
                open
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
                open
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
                        {{ soundLabel(s) }}
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
                        {{ soundLabel(s) }}
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

                  <p class="text-[12px] text-slate-500">
                    В “Смешанном” режиме пузыри появляются из выбранных звуков — и все они
                    засчитываются.
                  </p>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.particle-dot {
  background: rgba(244, 114, 182, 0.75);
  box-shadow: 0 14px 35px rgba(244, 114, 182, 0.18);
}
</style>
