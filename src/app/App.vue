<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import CustomCursor from '../components/CustomCursor.vue';
import HeroPlayZone from '../components/HeroPlayZone.vue';
import ParentsTrustSection from '../components/ParentsTrustSection.vue';
import SocialDock from '../components/SocialDock.vue';

import { useReducedMotion } from '../composables/useReducedMotion';
import { usePointerCoarse } from '../composables/usePointerCoarse';
import { useIntersectionOnce } from '../composables/useIntersectionOnce';
import { useSeo } from '../composables/useSeo';

import type { AppLocale } from './i18n';
import { persistLocale } from './i18n';

const { t, locale } = useI18n();
useSeo({ t, locale } as any);

const { reducedMotion } = useReducedMotion();
const { isCoarse } = usePointerCoarse();
const cursorEnabled = computed(() => !isCoarse.value && !reducedMotion());

type Mode = 'kids' | 'parents';
const mode = ref<Mode>('parents');
const isKids = computed(() => mode.value === 'kids');

const holding = ref(false);
const holdProgress = ref(0);
const holdMs = 1400;

let holdRaf: number | null = null;
let holdStart = 0;

const targetMode = ref<Mode | null>(null);

const holdPointerId = ref<number | null>(null);
const holdStartX = ref(0);
const holdStartY = ref(0);
const moveCancelPx = 12;

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function stopHold() {
  holding.value = false;
  holdProgress.value = 0;
  targetMode.value = null;
  holdPointerId.value = null;

  if (holdRaf !== null) {
    window.cancelAnimationFrame(holdRaf);
    holdRaf = null;
  }
}

function startHoldToggleMode() {
  if (holding.value) return;

  const next: Mode = mode.value === 'kids' ? 'parents' : 'kids';
  targetMode.value = next;

  holding.value = true;
  holdProgress.value = 0;
  holdStart = performance.now();

  const tick = () => {
    const elapsed = performance.now() - holdStart;
    holdProgress.value = Math.min(1, elapsed / holdMs);

    if (elapsed >= holdMs) {
      const to = targetMode.value;
      stopHold();
      if (to) mode.value = to;
      return;
    }

    holdRaf = window.requestAnimationFrame(tick);
  };

  holdRaf = window.requestAnimationFrame(tick);
}

function onHoldDown(e: PointerEvent) {
  if (!e.isPrimary) return;

  if (e.pointerType === 'mouse' && e.button !== 0) return;

  holdPointerId.value = e.pointerId;
  holdStartX.value = e.clientX;
  holdStartY.value = e.clientY;

  try {
    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  } catch {
    // ignore
  }

  startHoldToggleMode();
}

function onHoldMove(e: PointerEvent) {
  if (!holding.value) return;
  if (holdPointerId.value === null) return;
  if (e.pointerId !== holdPointerId.value) return;

  const dx = e.clientX - holdStartX.value;
  const dy = e.clientY - holdStartY.value;
  const dist = Math.hypot(dx, dy);

  if (dist > moveCancelPx) {
    stopHold();
  }
}

function onHoldUp(e?: PointerEvent) {
  if (e?.currentTarget && typeof e.pointerId === 'number') {
    try {
      (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  }
  stopHold();
}

function onKeyDownStart(e: KeyboardEvent) {
  if ((e as any).repeat) return;
  startHoldToggleMode();
}

function onKeyUpStop() {
  stopHold();
}

function setLocale(v: AppLocale) {
  locale.value = v;
  persistLocale(v);
}

const gameAnchor = ref<HTMLElement | null>(null);
const { visible: gameVisible } = useIntersectionOnce(gameAnchor, '240px');

function scrollToGame() {
  const el = gameAnchor.value;
  if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

const GameLoading = defineComponent({
  name: 'GameLoading',
  setup() {
    return () => h('div', { class: 'til-skeleton', 'aria-hidden': 'true' });
  },
});

const GameError = defineComponent({
  name: 'GameError',
  props: {
    error: { type: Object, required: false },
    retry: { type: Function as unknown as () => () => void, required: true },
    attempts: { type: Number, required: true },
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class:
            'rounded-3xl border border-ink/10 bg-white/80 backdrop-blur px-5 py-6 sm:px-7 sm:py-7',
          role: 'alert',
        },
        [
          h(
            'p',
            { class: 'text-base font-extrabold tracking-tight text-ink' },
            'Не удалось загрузить игру'
          ),
          h(
            'p',
            { class: 'mt-2 text-sm leading-relaxed text-ink/70' },
            'Проверьте интернет и попробуйте ещё раз.'
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'til-chip-btn til-chip-btn--xs sm:til-chip-btn--xs-reset mt-4',
              onClick: () => props.retry(),
            },
            props.attempts >= 3 ? 'Попробовать снова' : 'Повторить загрузку'
          ),
        ]
      );
  },
});

const SoundPopGame = defineAsyncComponent({
  loader: () => import('../components/SoundPopGame.vue'),
  delay: 120,
  timeout: 15000,
  loadingComponent: GameLoading,
  errorComponent: GameError,
  onError(error, retry, fail, attempts) {
    if (attempts <= 2) retry();
    else fail();
  },
});

function onBookDiagnostics() {
  window.open('https://www.whatsapp.com/', '_blank', 'noopener,noreferrer');
}

onUnmounted(() => {
  stopHold();
});

const modeLabel = computed(() => (isKids.value ? t('app.kidsMode') : t('app.parentsMode')));
const holdHint = computed(() =>
  mode.value === 'kids' ? t('app.holdToParents') : t('app.holdToKids')
);
</script>

<template>
  <div class="min-h-screen bg-blue-100 text-ink overflow-x-hidden">
    <CustomCursor v-if="cursorEnabled" :enabled="true" />

    <div class="mx-auto max-w-[1120px] px-4 pt-5 pb-24 sm:pt-8">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="til-logo shrink-0" aria-hidden="true">
            <span class="til-logo-dot" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-extrabold tracking-tight text-ink">{{ t('app.brand') }}</p>
            <p class="text-xs text-ink/60 truncate">{{ t('app.tagline') }}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto min-w-0">
          <div
            class="hidden sm:flex items-center gap-1 rounded-2xl bg-white/70 backdrop-blur border border-ink/10 p-1 shrink-0"
          >
            <button
              type="button"
              class="til-lang"
              :class="{ 'til-lang--active': locale === 'ru' }"
              @click="setLocale('ru')"
              aria-label="Русский"
            >
              RU
            </button>
            <button
              type="button"
              class="til-lang"
              :class="{ 'til-lang--active': locale === 'en' }"
              @click="setLocale('en')"
              aria-label="English"
            >
              EN
            </button>
            <button
              type="button"
              class="til-lang"
              :class="{ 'til-lang--active': locale === 'kz' }"
              @click="setLocale('kz')"
              aria-label="Қазақша"
            >
              KZ
            </button>
          </div>

          <div class="sm:hidden w-full flex items-center justify-end">
            <div class="til-langbar" aria-label="Language switcher">
              <button
                type="button"
                class="til-lang til-lang--xs"
                :class="{ 'til-lang--active': locale === 'ru' }"
                @click="setLocale('ru')"
                aria-label="Русский"
              >
                RU
              </button>
              <button
                type="button"
                class="til-lang til-lang--xs"
                :class="{ 'til-lang--active': locale === 'en' }"
                @click="setLocale('en')"
                aria-label="English"
              >
                EN
              </button>
              <button
                type="button"
                class="til-lang til-lang--xs"
                :class="{ 'til-lang--active': locale === 'kz' }"
                @click="setLocale('kz')"
                aria-label="Қазақша"
              >
                KZ
              </button>
            </div>
          </div>

          <div
            class="til-mode w-full sm:w-auto"
            :aria-label="`${t('app.modeLabel')}: ${modeLabel}. ${holdHint}`"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-semibold text-ink/55">{{ t('app.modeLabel') }}</p>
              <p class="text-[11px] font-semibold text-ink/45 truncate">
                {{ holdHint }}
              </p>
            </div>

            <button
              type="button"
              class="til-mode-btn"
              @pointerdown="onHoldDown"
              @pointermove="onHoldMove"
              @pointerup="onHoldUp"
              @pointercancel="onHoldUp"
              @pointerleave="onHoldUp"
              @keydown.space.prevent="onKeyDownStart"
              @keyup.space.prevent="onKeyUpStop"
              @keydown.enter.prevent="onKeyDownStart"
              @keyup.enter.prevent="onKeyUpStop"
            >
              <span class="til-mode-btn-text">{{ modeLabel }}</span>
              <span class="til-mode-progress" aria-hidden="true">
                <span
                  class="til-mode-progress-bar"
                  :style="{ width: `${Math.round(holdProgress * 100)}%` }"
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <main class="mt-6 sm:mt-8">
        <HeroPlayZone @start-play="scrollToGame" />

        <section ref="gameAnchor" class="mt-10 sm:mt-14" aria-labelledby="game-title">
          <div class="rounded-3xl bg-white border border-ink/10 shadow-soft overflow-hidden">
            <div class="px-5 py-7 sm:px-10 sm:py-9">
              <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 min-w-0">
                <div class="min-w-0">
                  <h2
                    id="game-title"
                    class="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"
                  >
                    {{ t('game.title') }}
                  </h2>
                  <p class="mt-2 text-ink/70 leading-relaxed max-w-[72ch]">
                    {{ t('game.subtitle') }}
                  </p>
                </div>

                <a
                  class="til-chip-btn til-chip-btn--xs sm:til-chip-btn--xs-reset shrink-0"
                  href="https://www.tiktok.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="t('game.tiktokAria')"
                >
                  {{ t('game.openTikTok') }}
                </a>
              </div>

              <div class="mt-6">
                <SoundPopGame v-if="gameVisible" :reduced-motion="reducedMotion()" />
                <div v-else class="til-skeleton" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <ParentsTrustSection v-if="!isKids" @book-diagnostics="onBookDiagnostics" />

        <section v-else class="mt-10 sm:mt-14">
          <div
            class="rounded-3xl bg-white/70 backdrop-blur border border-ink/10 shadow-soft px-5 py-7 sm:px-10"
          >
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              {{ t('kids.parentsHintTitle') }}
            </h2>
            <p class="mt-2 text-ink/70 leading-relaxed max-w-[70ch]">
              {{ t('kids.parentsHintText') }}
            </p>
            <div class="mt-5 flex flex-wrap gap-2">
              <a
                class="til-chip-btn til-chip-btn--xs sm:til-chip-btn--xs-reset"
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
              <a
                class="til-chip-btn til-chip-btn--xs sm:til-chip-btn--xs-reset"
                href="https://www.whatsapp.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                class="til-chip-btn til-chip-btn--xs sm:til-chip-btn--xs-reset"
                href="https://www.tiktok.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                TikTok
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>

    <SocialDock />
  </div>
</template>

<style scoped>
.shadow-soft {
  box-shadow:
    0 24px 70px rgba(15, 23, 42, 0.1),
    0 6px 20px rgba(15, 23, 42, 0.08);
}

.til-logo {
  width: 44px;
  height: 44px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(126, 200, 255, 0.9), rgba(255, 214, 232, 0.95));
  border: 1px solid rgba(46, 46, 56, 0.12);
  box-shadow:
    0 12px 26px rgba(126, 200, 255, 0.22),
    0 10px 22px rgba(255, 214, 232, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
}

.til-logo-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(46, 46, 56, 0.1);
}

.til-langbar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(46, 46, 56, 0.1);
  backdrop-filter: blur(10px);
  max-width: 100%;
}

.til-lang {
  border-radius: 16px;
  padding: 8px 10px;
  min-height: 40px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(46, 46, 56, 0.7);
  white-space: nowrap;
}

.til-lang--xs {
  padding: 7px 9px;
  min-height: 36px;
  font-size: 12px;
}

.til-lang--active {
  background: rgba(126, 200, 255, 0.2);
  border: 1px solid rgba(46, 46, 56, 0.1);
  color: rgba(46, 46, 56, 0.95);
}

.til-chip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  padding: 12px 14px;
  min-height: 48px;
  font-weight: 900;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(46, 46, 56, 0.1);
  backdrop-filter: blur(10px);
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;
  max-width: 100%;
}

.til-chip-btn:hover {
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
}

.til-chip-btn:active {
  transform: scale(0.98);
}

.til-chip-btn--xs {
  padding: 10px 12px;
  min-height: 42px;
  font-size: 13px;
}

@media (min-width: 640px) {
  .til-chip-btn--xs-reset {
    padding: 12px 14px;
    min-height: 48px;
    font-size: 14px;
  }
}

.til-mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(46, 46, 56, 0.1);
  backdrop-filter: blur(10px);
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 639px) {
  .til-mode {
    width: 100%;
  }
}

@media (min-width: 640px) {
  .til-mode {
    min-width: 200px;
  }
}

.til-mode-btn {
  position: relative;
  border-radius: 18px;
  background: rgba(207, 245, 231, 0.65);
  border: 1px solid rgba(46, 46, 56, 0.1);
  min-height: 44px;
  padding: 10px 12px;
  overflow: hidden;
  width: 100%;
  touch-action: manipulation;
}

.til-mode-btn-text {
  position: relative;
  z-index: 1;
  font-size: 13px;
  font-weight: 900;
  color: rgba(46, 46, 56, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.til-mode-progress {
  position: absolute;
  inset: 0;
  opacity: 0.75;
}

.til-mode-progress-bar {
  position: absolute;
  inset: 0;
  height: 100%;
  background: linear-gradient(90deg, rgba(126, 200, 255, 0.55), rgba(255, 214, 232, 0.6));
  width: 0%;
}

.til-skeleton {
  height: 520px;
  border-radius: 28px;
  background: linear-gradient(
    90deg,
    rgba(126, 200, 255, 0.1),
    rgba(255, 214, 232, 0.12),
    rgba(126, 200, 255, 0.1)
  );
  background-size: 200% 100%;
  animation: tiltup-shimmer 1.2s ease-in-out infinite;
}

@keyframes tiltup-shimmer {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 200% 0%;
  }
}
</style>
