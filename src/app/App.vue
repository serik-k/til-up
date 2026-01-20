<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
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

const SoundPopGame = defineAsyncComponent(() => import('../components/SoundPopGame.vue'));

const { reducedMotion } = useReducedMotion();
const { isCoarse } = usePointerCoarse();

const cursorEnabled = computed(() => !isCoarse.value && !reducedMotion());

type Mode = 'kids' | 'parents';
const mode = ref<Mode>('kids');
const isKids = computed(() => mode.value === 'kids');

// parent gate: long-press to switch (no accidental taps for kids)
const holding = ref(false);
const holdProgress = ref(0);
const holdMs = 1400;
let holdTimer: number | null = null;
let holdRaf: number | null = null;
let holdStart = 0;

function startHoldToParents() {
  if (mode.value === 'parents') return;
  if (holding.value) return;

  holding.value = true;
  holdProgress.value = 0;
  holdStart = performance.now();

  const tick = () => {
    const elapsed = performance.now() - holdStart;
    holdProgress.value = Math.min(1, elapsed / holdMs);

    if (elapsed >= holdMs) {
      stopHold();
      mode.value = 'parents';
      return;
    }
    holdRaf = window.requestAnimationFrame(tick);
  };

  holdRaf = window.requestAnimationFrame(tick);

  holdTimer = window.setTimeout(() => {
    stopHold();
    mode.value = 'parents';
  }, holdMs + 50);
}

function stopHold() {
  holding.value = false;
  holdProgress.value = 0;
  if (holdTimer !== null) {
    window.clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (holdRaf !== null) {
    window.cancelAnimationFrame(holdRaf);
    holdRaf = null;
  }
}

function backToKids() {
  stopHold();
  mode.value = 'kids';
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

function onBookDiagnostics() {
  // For prototype: open WhatsApp (fastest conversion channel)
  window.open('https://www.whatsapp.com/', '_blank', 'noopener,noreferrer');
}

function onTouchStart(e: TouchEvent) {
  if (mode.value === 'parents') return;
  if (e.touches && e.touches.length >= 2) {
    mode.value = 'parents';
  }
}

onMounted(() => {
  window.addEventListener('touchstart', onTouchStart, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('touchstart', onTouchStart);
  stopHold();
});

const modeLabel = computed(() => (isKids.value ? t('app.kidsMode') : t('app.parentsMode')));
</script>

<template>
  <div class="min-h-screen bg-blue-100 text-ink">
    <CustomCursor v-if="cursorEnabled" :enabled="true" />

    <div class="mx-auto max-w-[1120px] px-4 pt-5 pb-24 sm:pt-8">
      <header class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="til-logo" aria-hidden="true">
            <span class="til-logo-dot" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-extrabold tracking-tight text-ink">{{ t('app.brand') }}</p>
            <p class="text-xs text-ink/60 truncate">{{ t('app.tagline') }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="hidden sm:flex items-center gap-1 rounded-2xl bg-white/70 backdrop-blur border border-ink/10 p-1">
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

          <button
            v-if="!isKids"
            type="button"
            class="til-chip-btn"
            @click="backToKids"
            :aria-label="t('app.backToKids')"
          >
            {{ t('app.backToKids') }}
          </button>

          <div class="til-mode" :aria-label="t('app.modeAria', { mode: modeLabel })">
            <p class="text-[11px] font-semibold text-ink/55">{{ t('app.modeLabel') }}</p>
            <button
              type="button"
              class="til-mode-btn"
              @mousedown="startHoldToParents"
              @mouseup="stopHold"
              @mouseleave="stopHold"
              @touchstart.passive="startHoldToParents"
              @touchend.passive="stopHold"
              @touchcancel.passive="stopHold"
            >
              <span class="til-mode-btn-text">{{ modeLabel }}</span>
              <span class="til-mode-progress" aria-hidden="true">
                <span class="til-mode-progress-bar" :style="{ width: `${Math.round(holdProgress * 100)}%` }" />
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
              <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h2 id="game-title" class="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                    {{ t('game.title') }}
                  </h2>
                  <p class="mt-2 text-ink/70 leading-relaxed max-w-[72ch]">
                    {{ t('game.subtitle') }}
                  </p>
                </div>

                <a
                  class="til-chip-btn"
                  href="https://www.tiktok.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="t('game.tiktokAria')"
                >
                  {{ t('game.openTikTok') }}
                </a>
              </div>

              <div class="mt-6">
                <SoundPopGame v-if="gameVisible" :reduced-motion="reducedMotion()" :analytics="{ track: () => {} }" />
                <div v-else class="til-skeleton" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <ParentsTrustSection v-if="!isKids" @book-diagnostics="onBookDiagnostics" />

        <section v-else class="mt-10 sm:mt-14">
          <div class="rounded-3xl bg-white/70 backdrop-blur border border-ink/10 shadow-soft px-5 py-7 sm:px-10">
            <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              {{ t('kids.parentsHintTitle') }}
            </h2>
            <p class="mt-2 text-ink/70 leading-relaxed max-w-[70ch]">
              {{ t('kids.parentsHintText') }}
            </p>
            <div class="mt-5 flex flex-wrap gap-2">
              <a
                class="til-chip-btn"
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
              <a
                class="til-chip-btn"
                href="https://www.whatsapp.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                class="til-chip-btn"
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
    0 24px 70px rgba(15, 23, 42, 0.10),
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
  border: 1px solid rgba(46, 46, 56, 0.10);
}

.til-lang {
  border-radius: 16px;
  padding: 8px 10px;
  min-height: 40px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(46, 46, 56, 0.70);
}

.til-lang--active {
  background: rgba(126, 200, 255, 0.20);
  border: 1px solid rgba(46, 46, 56, 0.10);
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
  border: 1px solid rgba(46, 46, 56, 0.10);
  backdrop-filter: blur(10px);
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.til-chip-btn:hover {
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
}

.til-chip-btn:active {
  transform: scale(0.98);
}

.til-mode {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(46, 46, 56, 0.10);
  backdrop-filter: blur(10px);
  min-width: 160px;
}

.til-mode-btn {
  position: relative;
  border-radius: 18px;
  background: rgba(207, 245, 231, 0.65);
  border: 1px solid rgba(46, 46, 56, 0.10);
  min-height: 44px;
  padding: 10px 12px;
  overflow: hidden;
}

.til-mode-btn-text {
  position: relative;
  z-index: 1;
  font-size: 13px;
  font-weight: 900;
  color: rgba(46, 46, 56, 0.92);
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
  background: linear-gradient(90deg, rgba(126, 200, 255, 0.55), rgba(255, 214, 232, 0.60));
  width: 0%;
}

.til-skeleton {
  height: 520px;
  border-radius: 28px;
  background: linear-gradient(90deg, rgba(126, 200, 255, 0.10), rgba(255, 214, 232, 0.12), rgba(126, 200, 255, 0.10));
  background-size: 200% 100%;
  animation: tiltup-shimmer 1.2s ease-in-out infinite;
}

@keyframes tiltup-shimmer {
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}
</style>
