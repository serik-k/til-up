<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';

const props = defineProps<{ reducedMotion?: boolean; ariaLabel?: string }>();

const prefersReduced = usePreferredReducedMotion();
const motionOff = computed(() => !!props.reducedMotion || prefersReduced.value === 'reduce');

const rootRef = ref<HTMLElement | null>(null);
const isBlink = ref(false);
const isTap = ref(false);
const isStarBoost = ref(false);

type BubbleId = 1 | 2 | 3 | 4;
type BubbleItem = { id: BubbleId; popped: boolean; cooldownUntil: number };
const bubbles = ref<BubbleItem[]>([
  { id: 1, popped: false, cooldownUntil: 0 },
  { id: 2, popped: false, cooldownUntil: 0 },
  { id: 3, popped: false, cooldownUntil: 0 },
  { id: 4, popped: false, cooldownUntil: 0 },
]);

type EffectKind = 'ripple' | 'spark' | 'word' | 'ring';
type SparkShape = 'star' | 'dot' | 'diamond';

type Effect = {
  id: string;
  kind: EffectKind;
  x: number;
  y: number;
  style: Record<string, string>;
  shape?: SparkShape;
  text?: string;
};

const effects = ref<Effect[]>([]);

let scheduleTimer: number | null = null;
let blinkTimer: number | null = null;
let tapResetTimer: number | null = null;
let starResetTimer: number | null = null;
let cleanupTimers: number[] = [];

let lastTapAt = 0;
let combo = 0;

function uid() {
  // Без зависимостей: достаточно для эффектов
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function clearAllTimers() {
  if (scheduleTimer != null) window.clearTimeout(scheduleTimer);
  if (blinkTimer != null) window.clearTimeout(blinkTimer);
  if (tapResetTimer != null) window.clearTimeout(tapResetTimer);
  if (starResetTimer != null) window.clearTimeout(starResetTimer);

  scheduleTimer = null;
  blinkTimer = null;
  tapResetTimer = null;
  starResetTimer = null;

  for (const t of cleanupTimers) window.clearTimeout(t);
  cleanupTimers = [];
}

function clearBlinkTimers() {
  if (scheduleTimer != null) window.clearTimeout(scheduleTimer);
  if (blinkTimer != null) window.clearTimeout(blinkTimer);
  scheduleTimer = null;
  blinkTimer = null;
  isBlink.value = false;
}

function scheduleBlink() {
  if (motionOff.value) return;
  const delay = 1800 + Math.random() * 2600;
  scheduleTimer = window.setTimeout(() => {
    isBlink.value = true;
    blinkTimer = window.setTimeout(() => {
      isBlink.value = false;
      scheduleBlink();
    }, 130);
  }, delay);
}

function setTiltVars(x: number, y: number) {
  const el = rootRef.value;
  if (!el) return;
  el.style.setProperty('--til-x', String(x));
  el.style.setProperty('--til-y', String(y));
}

function onPointerMove(e: PointerEvent) {
  const el = rootRef.value;
  if (!el || motionOff.value) return;
  const rect = el.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width - 0.5;
  const ny = (e.clientY - rect.top) / rect.height - 0.5;
  setTiltVars(clamp(nx, -0.55, 0.55), clamp(ny, -0.55, 0.55));
}

function onPointerLeave() {
  if (motionOff.value) return;
  setTiltVars(0, 0);
}

/** Координаты эффекта в px внутри rootRef */
function getLocalPoint(e: Pick<PointerEvent, 'clientX' | 'clientY'>) {
  const el = rootRef.value;
  if (!el) return { x: 0, y: 0 };
  const rect = el.getBoundingClientRect();
  return {
    x: clamp(e.clientX - rect.left, 0, rect.width),
    y: clamp(e.clientY - rect.top, 0, rect.height),
  };
}

const WORDS = ['Супер!', 'Вау!', 'Молодец!', 'Отлично!', 'Круто!', 'Так держать!'] as const;
function pickWord() {
  const i = Math.floor(Math.random() * WORDS.length);
  return WORDS[i];
}

function triggerTapAnim(strong = false) {
  if (motionOff.value) return;

  // Перезапуск “tap” анимации гарантированно
  isTap.value = false;
  requestAnimationFrame(() => {
    isTap.value = true;
    if (tapResetTimer != null) window.clearTimeout(tapResetTimer);
    tapResetTimer = window.setTimeout(
      () => {
        isTap.value = false;
      },
      strong ? 520 : 420
    );
  });
}

function triggerStarBoost() {
  if (motionOff.value) return;
  isStarBoost.value = false;
  requestAnimationFrame(() => {
    isStarBoost.value = true;
    if (starResetTimer != null) window.clearTimeout(starResetTimer);
    starResetTimer = window.setTimeout(() => {
      isStarBoost.value = false;
    }, 900);
  });
}

function pushEffect(effect: Effect, ttlMs: number) {
  effects.value.push(effect);
  const t = window.setTimeout(() => {
    effects.value = effects.value.filter((x) => x.id !== effect.id);
  }, ttlMs);
  cleanupTimers.push(t);
}

function spawnRipple(x: number, y: number, big = false) {
  const id = uid();
  pushEffect(
    {
      id,
      kind: 'ripple',
      x,
      y,
      style: {
        left: `${x}px`,
        top: `${y}px`,
        '--r': big ? '140px' : '110px',
      },
    },
    big ? 720 : 640
  );
}

function spawnRing(x: number, y: number) {
  const id = uid();
  pushEffect(
    {
      id,
      kind: 'ring',
      x,
      y,
      style: {
        left: `${x}px`,
        top: `${y}px`,
        '--r': '170px',
      },
    },
    820
  );
}

function spawnWord(x: number, y: number) {
  const id = uid();
  pushEffect(
    {
      id,
      kind: 'word',
      x,
      y,
      text: pickWord(),
      style: {
        left: `${x}px`,
        top: `${y}px`,
        '--dx': `${(Math.random() * 2 - 1) * 18}px`,
      },
    },
    950
  );
}

function spawnSparks(x: number, y: number, count: number, power: number) {
  for (let i = 0; i < count; i++) {
    const id = uid();
    const ang = Math.random() * Math.PI * 2;
    const dist = (20 + Math.random() * 46) * power;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 10 * power;
    const rot = (Math.random() * 2 - 1) * 180;
    const s = 0.75 + Math.random() * 0.7;
    const shapeRoll = Math.random();
    const shape: SparkShape = shapeRoll < 0.45 ? 'star' : shapeRoll < 0.75 ? 'diamond' : 'dot';

    pushEffect(
      {
        id,
        kind: 'spark',
        x,
        y,
        shape,
        style: {
          left: `${x}px`,
          top: `${y}px`,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
          '--rot': `${rot}deg`,
          '--s': String(s),
          '--d': `${360 + Math.random() * 160}ms`,
        },
      },
      700
    );
  }
}

/** Комбо-счётчик: быстрое нажатие подряд => больше частиц */
function updateCombo(now: number) {
  if (now - lastTapAt <= 900) combo += 1;
  else combo = 1;
  lastTapAt = now;
}

function handleTap(e: Pick<PointerEvent, 'clientX' | 'clientY'>, source: 'any' | 'badge' | 'bubble') {
  if (motionOff.value) return;

  const now = performance.now();
  updateCombo(now);

  const { x, y } = getLocalPoint(e);

  // База: всегда ripple + слово
  const strong = source === 'badge' || combo >= 3;
  const power = strong ? 1.25 : 1;

  triggerTapAnim(strong);
  spawnRipple(x, y, strong);
  spawnWord(x, y - 6);

  // Искры: усиливаем при badge и при комбо
  const baseCount = source === 'badge' ? 18 : source === 'bubble' ? 12 : 14;
  const comboBonus = combo >= 4 ? 10 : combo === 3 ? 6 : 0;
  spawnSparks(x, y, baseCount + comboBonus, power);

  // Badge: дополнительное “level-up” кольцо + усиление звезды
  if (source === 'badge') {
    triggerStarBoost();
    spawnRing(x, y);
  }
}

/** Поп пузырька */
function popBubble(id: BubbleId, e: PointerEvent) {
  e.preventDefault();
  const b = bubbles.value.find((x) => x.id === id);
  if (!b) return;

  const now = performance.now();
  if (b.popped || now < b.cooldownUntil) return;

  b.popped = true;
  b.cooldownUntil = now + 900;

  handleTap(e, 'bubble');

  const t = window.setTimeout(() => {
    b.popped = false;
  }, 1100);
  cleanupTimers.push(t);
}

/** Тап по звезде */
function tapBadge(e: PointerEvent) {
  e.preventDefault();
  handleTap(e, 'badge');
}

/** Тап по всему маскоту */
function tapAny(e: PointerEvent) {
  // если кликнули по интерактивной части, она вызовет stop, сюда не попадёт
  handleTap(e, 'any');
}

function tapFromKeyboard(e: KeyboardEvent) {
  if (e.repeat || motionOff.value) return;
  e.preventDefault();

  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  handleTap({
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }, 'any');
}

onMounted(() => {
  setTiltVars(0, 0);
  const el = rootRef.value;
  if (!el) return;

  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerleave', onPointerLeave);

  if (!motionOff.value) scheduleBlink();
});

onUnmounted(() => {
  const el = rootRef.value;
  if (el) {
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerleave', onPointerLeave);
  }
  clearAllTimers();
});

watch(motionOff, (off) => {
  if (off) {
    clearAllTimers();
    setTiltVars(0, 0);
    effects.value = [];
    isBlink.value = false;
    isTap.value = false;
    isStarBoost.value = false;
  } else {
    clearAllTimers();
    scheduleBlink();
  }
});

</script>

<template>
  <div
    ref="rootRef"
    class="til-appear relative mx-auto max-w-[420px] select-none"
    :data-motion-off="motionOff ? '1' : '0'"
    :role="motionOff ? 'img' : 'button'"
    :tabindex="motionOff ? -1 : 0"
    :aria-label="props.ariaLabel || 'Til Up mascot'"
    @keydown.enter="tapFromKeyboard"
    @keydown.space="tapFromKeyboard"
  >
    <div class="til-float relative">
      <div
        class="til-tilt"
        :class="{
          'is-blink': isBlink,
          'is-tap': isTap,
          'is-star': isStarBoost,
        }"
        @pointerdown="tapAny"
      >
        <!-- Overlay effects -->
        <div class="til-effects" aria-hidden="true">
          <div
            v-for="eff in effects"
            :key="eff.id"
            class="til-eff"
            :class="`til-eff--${eff.kind}${eff.shape ? ' til-eff--' + eff.shape : ''}`"
            :style="eff.style"
          >
            <template v-if="eff.kind === 'word'">
              {{ eff.text }}
            </template>
          </div>
        </div>

        <svg viewBox="0 0 520 360" class="w-full h-auto" aria-hidden="true">
          <defs>
            <linearGradient id="gBody" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#FFFFFF" />
              <stop offset="1" stop-color="#EAF6FF" />
            </linearGradient>
            <linearGradient id="gShadow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#2E2E38" stop-opacity="0.12" />
              <stop offset="1" stop-color="#2E2E38" stop-opacity="0" />
            </linearGradient>
            <filter id="fSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
              <feOffset dx="0" dy="12" result="off" />
              <feColorMatrix
                in="off"
                type="matrix"
                values="0 0 0 0 0.06  0 0 0 0 0.09  0 0 0 0 0.16  0 0 0 0.22 0"
                result="col"
              />
              <feMerge>
                <feMergeNode in="col" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Ground shadow -->
          <ellipse
            class="til-ground"
            cx="260"
            cy="312"
            rx="170"
            ry="28"
            fill="url(#gShadow)"
            opacity="0.9"
          />

          <!-- Body -->
          <g filter="url(#fSoft)" class="til-body">
            <path
              class="til-body-shape"
              d="M154 144c10-40 44-72 88-72 30 0 56 15 72 38 9-6 20-10 32-10 28 0 52 18 62 44 35 6 62 36 62 73 0 42-34 76-76 76H174c-44 0-80-36-80-80 0-38 26-70 60-79z"
              fill="url(#gBody)"
              stroke="#2E2E38"
              stroke-opacity="0.10"
              stroke-width="2"
            />

            <!-- Cheeks -->
            <ellipse
              class="til-cheek til-cheek--l"
              cx="210"
              cy="232"
              rx="22"
              ry="14"
              fill="#FFD6E8"
              opacity="0.95"
            />
            <ellipse
              class="til-cheek til-cheek--r"
              cx="310"
              cy="232"
              rx="22"
              ry="14"
              fill="#FFD6E8"
              opacity="0.95"
            />

            <!-- Eyes -->
            <g class="til-eye">
              <circle cx="225" cy="210" r="10" fill="#2E2E38" opacity="0.85" />
              <circle class="til-eye-shine" cx="221" cy="206" r="3" fill="#FFFFFF" opacity="0.95" />
            </g>
            <g class="til-eye">
              <circle cx="295" cy="210" r="10" fill="#2E2E38" opacity="0.85" />
              <circle class="til-eye-shine" cx="291" cy="206" r="3" fill="#FFFFFF" opacity="0.95" />
            </g>

            <!-- Smile -->
            <path
              class="til-smile"
              d="M248 226c8 10 16 10 24 0"
              fill="none"
              stroke="#2E2E38"
              stroke-opacity="0.55"
              stroke-width="6"
              stroke-linecap="round"
            />

            <!-- Tiny star badge (tap!) -->
            <g
              class="til-badge til-hit"
              transform="translate(368 160)"
              @pointerdown.stop="tapBadge"
            >
              <circle cx="44" cy="44" r="34" fill="#FFF1A8" opacity="0.95" />
              <path
                class="til-star"
                d="M44 20l6 16h17l-13 10 5 16-15-10-15 10 5-16-13-10h17z"
                fill="#7EC8FF"
                opacity="0.95"
              />
              <!-- Hit target ring (bigger touch area) -->
              <circle class="til-hit-ring" cx="44" cy="44" r="44" fill="transparent" />
            </g>
          </g>

          <!-- Decorative bubbles (tap to pop) -->
          <g opacity="0.75">
            <circle
              class="til-bubble til-bubble--1 til-hit"
              :class="{ 'is-popped': bubbles[0]?.popped }"
              cx="92"
              cy="86"
              r="16"
              fill="#7EC8FF"
              @pointerdown.stop="(e) => popBubble(1, e)"
            />
            <circle
              class="til-bubble til-bubble--2 til-hit"
              :class="{ 'is-popped': bubbles[1]?.popped }"
              cx="436"
              cy="88"
              r="12"
              fill="#FFD6E8"
              @pointerdown.stop="(e) => popBubble(2, e)"
            />
            <circle
              class="til-bubble til-bubble--3 til-hit"
              :class="{ 'is-popped': bubbles[2]?.popped }"
              cx="460"
              cy="230"
              r="10"
              fill="#CFF5E7"
              @pointerdown.stop="(e) => popBubble(3, e)"
            />
            <circle
              class="til-bubble til-bubble--4 til-hit"
              :class="{ 'is-popped': bubbles[3]?.popped }"
              cx="74"
              cy="224"
              r="10"
              fill="#FFF1A8"
              @pointerdown.stop="(e) => popBubble(4, e)"
            />
          </g>
        </svg>
      </div>

    </div>
  </div>
</template>

<style scoped>
.til-appear {
  animation: mascot-appear 500ms ease-out both;
}

.til-float {
  animation: mascot-float 2.8s ease-in-out 500ms infinite;
}

[data-motion-off='1'].til-appear,
[data-motion-off='1'] .til-float {
  animation: none;
}

@keyframes mascot-appear {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes mascot-float {
  0%, 100% { transform: translateY(0) rotate(0); }
  25% { transform: translateY(-6px) rotate(-1.5deg); }
  75% { transform: translateY(-6px) rotate(1.5deg); }
}

/* ========== tilt wrapper ========== */
.til-tilt {
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
  transition: transform 140ms ease-out;
  transform: perspective(900px) rotateX(calc(var(--til-y, 0) * -10deg))
    rotateY(calc(var(--til-x, 0) * 10deg))
    translate3d(calc(var(--til-x, 0) * 10px), calc(var(--til-y, 0) * 10px), 0);
}

.til-hit {
  cursor: pointer;
}

/* large touch ring for star (invisible) */
.til-hit-ring {
  pointer-events: all;
}

/* ========== blink ========== */
.til-eye {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 70ms linear;
}
.til-eye-shine {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 70ms linear;
}
.til-tilt.is-blink .til-eye {
  transform: scaleY(0.12);
}
.til-tilt.is-blink .til-eye-shine {
  transform: scaleY(0.15);
}

/* ========== idle animations ========== */
[data-motion-off='1'] .til-tilt,
[data-motion-off='1'] .til-body,
[data-motion-off='1'] .til-ground,
[data-motion-off='1'] .til-cheek,
[data-motion-off='1'] .til-smile,
[data-motion-off='1'] .til-star,
[data-motion-off='1'] .til-bubble,
[data-motion-off='1'] .til-eff {
  animation: none !important;
  transition: none !important;
}

/* breathe */
.til-body {
  transform-box: fill-box;
  transform-origin: center;
  animation: til-breathe 3.6s ease-in-out infinite;
}
.til-ground {
  transform-box: fill-box;
  transform-origin: center;
  animation: til-shadow 3.6s ease-in-out infinite;
}
.til-cheek {
  transform-box: fill-box;
  transform-origin: center;
  animation: til-blush 2.8s ease-in-out infinite;
}
.til-cheek--l {
  animation-delay: -0.4s;
}
.til-cheek--r {
  animation-delay: -1s;
}
.til-smile {
  transform-box: fill-box;
  transform-origin: center;
  animation: til-smile 3.2s ease-in-out infinite;
}
.til-star {
  transform-box: fill-box;
  transform-origin: center;
  animation: til-twinkle 2.2s ease-in-out infinite;
}

.til-bubble {
  transform-box: fill-box;
  transform-origin: center;
  animation: til-bubble 4.2s ease-in-out infinite;
  transition:
    transform 220ms ease,
    opacity 220ms ease;
}
.til-bubble.is-popped {
  transform: scale(0.01);
  opacity: 0;
  animation: none;
  pointer-events: none;
}
.til-bubble--1 {
  animation-duration: 4.6s;
  animation-delay: -1.1s;
}
.til-bubble--2 {
  animation-duration: 5.1s;
  animation-delay: -2.4s;
}
.til-bubble--3 {
  animation-duration: 3.9s;
  animation-delay: -0.8s;
}
.til-bubble--4 {
  animation-duration: 4.8s;
  animation-delay: -3s;
}

/* ========== tap interaction animations ========== */
.til-tilt.is-tap .til-body {
  animation: til-tap-bounce 420ms cubic-bezier(0.2, 0.9, 0.2, 1) 1;
}
.til-tilt.is-tap .til-ground {
  animation: til-tap-shadow 420ms cubic-bezier(0.2, 0.9, 0.2, 1) 1;
}
.til-tilt.is-tap .til-cheek {
  animation: til-tap-blush 420ms ease-out 1;
}
.til-tilt.is-tap .til-smile {
  animation: til-tap-smile 420ms ease-out 1;
}

/* star boost (badge tap) */
.til-tilt.is-star .til-star {
  animation: til-star-boost 900ms cubic-bezier(0.2, 0.9, 0.2, 1) 1;
}

/* ========== overlay effects ========== */
.til-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.til-eff {
  position: absolute;
  transform: translate(-50%, -50%);
  will-change: transform, opacity, filter;
}

.til-eff--ripple {
  width: var(--r, 110px);
  height: var(--r, 110px);
  border-radius: 999px;
  border: 2px solid rgba(126, 200, 255, 0.65);
  opacity: 0;
  animation: til-ripple 640ms ease-out 1;
}

.til-eff--ring {
  width: var(--r, 170px);
  height: var(--r, 170px);
  border-radius: 999px;
  border: 2px solid rgba(255, 214, 232, 0.75);
  opacity: 0;
  animation: til-ring 820ms ease-out 1;
}

.til-eff--word {
  font-weight: 900;
  font-size: 14px;
  color: rgba(46, 46, 56, 0.82);
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(46, 46, 56, 0.12);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 24px rgba(30, 35, 50, 0.12);
  opacity: 0;
  animation: til-word 950ms ease-out 1;
}

.til-eff--spark {
  width: 14px;
  height: 14px;
  opacity: 0;
  filter: drop-shadow(0 10px 20px rgba(30, 35, 50, 0.14));
  animation: til-spark var(--d, 420ms) ease-out 1;
  transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scale(var(--s, 1));
}

/* shapes */
.til-eff--spark.til-eff--dot {
  border-radius: 999px;
  background: rgba(126, 200, 255, 0.95);
}
.til-eff--spark.til-eff--diamond {
  background: rgba(255, 214, 232, 0.95);
  transform: translate(-50%, -50%) rotate(45deg) scale(var(--s, 1));
}
.til-eff--spark.til-eff--star {
  background: rgba(255, 241, 168, 0.98);
  clip-path: polygon(
    50% 0%,
    61% 34%,
    98% 35%,
    68% 57%,
    79% 91%,
    50% 72%,
    21% 91%,
    32% 57%,
    2% 35%,
    39% 34%
  );
}

/* ========== keyframes ========== */
@keyframes til-breathe {
  0% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.012);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes til-shadow {
  0% {
    transform: scaleX(1) scaleY(1);
    opacity: 0.9;
  }
  50% {
    transform: scaleX(0.965) scaleY(0.93);
    opacity: 0.72;
  }
  100% {
    transform: scaleX(1) scaleY(1);
    opacity: 0.9;
  }
}

@keyframes til-blush {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.95;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.86;
  }
}

@keyframes til-smile {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(1px) rotate(-0.6deg);
  }
}

@keyframes til-twinkle {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 0.95;
  }
  50% {
    transform: rotate(6deg) scale(1.08);
    opacity: 0.88;
  }
}

@keyframes til-bubble {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0.75;
  }
  50% {
    transform: translateY(-10px) translateX(6px) scale(1.06);
    opacity: 0.62;
  }
  100% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0.75;
  }
}

/* tap bounce */
@keyframes til-tap-bounce {
  0% {
    transform: translateY(0) scale(1);
  }
  35% {
    transform: translateY(-6px) scale(1.04, 0.98);
  }
  70% {
    transform: translateY(2px) scale(0.99, 1.03);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}
@keyframes til-tap-shadow {
  0% {
    transform: scaleX(1) scaleY(1);
    opacity: 0.9;
  }
  35% {
    transform: scaleX(0.92) scaleY(0.86);
    opacity: 0.62;
  }
  100% {
    transform: scaleX(1) scaleY(1);
    opacity: 0.9;
  }
}
@keyframes til-tap-blush {
  0% {
    transform: scale(1);
    opacity: 0.95;
  }
  45% {
    transform: scale(1.14);
    opacity: 0.9;
  }
  100% {
    transform: scale(1);
    opacity: 0.95;
  }
}
@keyframes til-tap-smile {
  0% {
    transform: translateY(0) rotate(0deg);
  }
  45% {
    transform: translateY(2px) rotate(-1deg);
  }
  100% {
    transform: translateY(0) rotate(0deg);
  }
}

@keyframes til-star-boost {
  0% {
    transform: rotate(0deg) scale(1);
    opacity: 0.95;
  }
  35% {
    transform: rotate(40deg) scale(1.22);
    opacity: 0.92;
  }
  70% {
    transform: rotate(-18deg) scale(1.1);
    opacity: 0.95;
  }
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 0.95;
  }
}

/* overlay effects */
@keyframes til-ripple {
  0% {
    transform: translate(-50%, -50%) scale(0.55);
    opacity: 0.65;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.25);
    opacity: 0;
  }
}
@keyframes til-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.45);
    opacity: 0.7;
  }
  60% {
    opacity: 0.35;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.18);
    opacity: 0;
  }
}
@keyframes til-word {
  0% {
    transform: translate(-50%, -50%) translateX(0) translateY(6px) scale(0.98);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) translateX(var(--dx, 0px)) translateY(-28px) scale(1);
    opacity: 0;
  }
}
@keyframes til-spark {
  0% {
    transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scale(var(--s, 1));
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 0px)))
      rotate(var(--rot, 0deg)) scale(calc(var(--s, 1) * 0.85));
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .til-tilt,
  .til-body,
  .til-ground,
  .til-cheek,
  .til-smile,
  .til-star,
  .til-bubble,
  .til-eff {
    animation: none !important;
    transition: none !important;
  }
}
</style>
