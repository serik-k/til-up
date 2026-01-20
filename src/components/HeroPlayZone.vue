<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Mascot from './Mascot.vue';
import SocialPills from './SocialPills.vue';

const emit = defineEmits<{ (e: 'start-play'): void }>();

const { t } = useI18n();

const pressed = ref(false);

const title = computed(() => t('hero.kidsTitle'));
const subtitle = computed(() => t('hero.kidsSubtitle'));

function startPlay() {
  emit('start-play');
}
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-100 via-white to-pink-100 border border-ink/10 shadow-soft"
  >
    <!-- decorative blobs -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-12 -left-14 size-72 rounded-full bg-blue-300/35 blur-3xl"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-16 -right-10 size-80 rounded-full bg-pink-300/40 blur-3xl"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute top-8 right-10 size-28 rounded-full bg-yellow-300/55 blur-2xl"
    />

    <div class="relative grid items-center gap-8 px-5 py-8 sm:px-10 sm:py-10 lg:grid-cols-2">
      <div>
        <div
          class="inline-flex items-center gap-2 rounded-2xl bg-white/70 backdrop-blur border border-ink/10 px-4 py-2 shadow-sm"
        >
          <span class="size-2.5 rounded-full bg-mint-300" />
          <p class="text-xs font-semibold text-ink/70">{{ t('hero.kidsBadge') }}</p>
        </div>

        <h1 class="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink">
          {{ title }}
        </h1>
        <p class="mt-3 text-base sm:text-lg text-ink/70 leading-relaxed max-w-[52ch]">
          {{ subtitle }}
        </p>

        <div class="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            class="til-btn til-btn-primary"
            @pointerdown="pressed = true"
            @pointerup="pressed = false"
            @pointercancel="pressed = false"
            @click="startPlay"
            :aria-label="t('hero.startPlayAria')"
          >
            <span class="text-lg">{{ t('hero.startPlay') }}</span>
            <span aria-hidden="true" class="til-spark" :class="{ 'til-spark-on': pressed }">★</span>
          </button>

          <div
            class="rounded-2xl bg-white/70 backdrop-blur border border-ink/10 px-4 py-3 shadow-sm"
          >
            <p class="text-sm font-semibold text-ink">{{ t('hero.noFailTitle') }}</p>
            <p class="text-xs text-ink/65 mt-1">{{ t('hero.noFailSubtitle') }}</p>
          </div>
        </div>

        <div class="mt-6">
          <SocialPills />
        </div>
      </div>

      <div class="relative">
        <div
          class="rounded-3xl bg-white/70 backdrop-blur border border-ink/10 shadow-soft p-4 sm:p-6"
        >
          <Mascot />
          <div class="mt-4 grid grid-cols-3 gap-2">
            <div class="til-mini-card bg-blue-100">
              <p class="til-mini-title">{{ t('hero.mini1Title') }}</p>
              <p class="til-mini-text">{{ t('hero.mini1Text') }}</p>
            </div>
            <div class="til-mini-card bg-pink-100">
              <p class="til-mini-title">{{ t('hero.mini2Title') }}</p>
              <p class="til-mini-text">{{ t('hero.mini2Text') }}</p>
            </div>
            <div class="til-mini-card bg-mint-100">
              <p class="til-mini-title">{{ t('hero.mini3Title') }}</p>
              <p class="til-mini-text">{{ t('hero.mini3Text') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.shadow-soft {
  box-shadow:
    0 20px 60px rgba(15, 23, 42, 0.1),
    0 4px 18px rgba(15, 23, 42, 0.08);
}

.til-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 20px;
  padding: 14px 18px;
  min-height: 54px;
  font-weight: 800;
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;
  user-select: none;
}

.til-btn:active {
  transform: scale(0.98);
}

.til-btn-primary {
  background: linear-gradient(135deg, rgba(126, 200, 255, 0.9), rgba(255, 214, 232, 0.95));
  border: 1px solid rgba(46, 46, 56, 0.12);
  box-shadow:
    0 12px 32px rgba(126, 200, 255, 0.22),
    0 10px 26px rgba(255, 214, 232, 0.22);
}

.til-btn-primary:hover {
  box-shadow:
    0 16px 44px rgba(126, 200, 255, 0.26),
    0 12px 32px rgba(255, 214, 232, 0.26);
}

.til-spark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(46, 46, 56, 0.1);
  transform: translateY(0);
  transition: transform 180ms ease;
}

.til-spark-on {
  transform: translateY(-2px) rotate(-10deg);
}

.til-mini-card {
  border-radius: 18px;
  padding: 12px;
  border: 1px solid rgba(46, 46, 56, 0.1);
}

.til-mini-title {
  font-weight: 900;
  font-size: 12px;
  color: rgba(46, 46, 56, 0.9);
}

.til-mini-text {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.25;
  color: rgba(46, 46, 56, 0.65);
}
</style>
