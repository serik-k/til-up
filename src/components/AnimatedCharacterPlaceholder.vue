<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  reducedMotion: boolean;
  audioLevel?: number; // 0..1
  isListening?: boolean;
}>();

/**
 * Реакция на громкость:
 * - если isListening = true и audioLevel выше порога → “прыжок”
 * - no-fail: никакой “ошибки”, только позитив
 */

const level = computed(() => Math.max(0, Math.min(1, props.audioLevel ?? 0)));

const bounce = computed(() => {
  if (props.reducedMotion) return 0;
  if (!props.isListening) return 0;
  return level.value > 0.35 ? 1 : 0; // порог можно калибровать в UI
});

const faceSmile = computed(() => {
  if (!props.isListening) return 'border-ink/25';
  return bounce.value ? 'border-ink/40' : 'border-ink/25';
});

const glow = computed(() => {
  if (!props.isListening) return 0;
  return Math.round(level.value * 18); // 0..18px
});
</script>

<template>
  <div class="rounded-3xl shadow-2xl bg-white border border-ink/10 p-6 til-soft">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-ink/70">Дружок Til</p>
        <p class="text-xs text-ink/50">Контейнер легко заменяется на Three.js / Spline</p>
      </div>

      <span
        class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-ink border border-ink/10"
        :class="isListening ? 'bg-mint/60' : 'bg-white'"
      >
        {{ isListening ? 'Listening' : 'Off' }}
      </span>
    </div>

    <div class="mt-6 flex items-center justify-center">
      <div
        class="relative size-[220px] sm:size-[260px] rounded-full bg-mint shadow-2xl border border-ink/10 transition-transform duration-200"
        :class="reducedMotion ? '' : 'animate-breathe'"
        :style="{
          transform: bounce ? 'translateY(-10px) scale(1.03)' : undefined,
          boxShadow: isListening
            ? `0 30px 80px -30px rgba(15, 23, 42, 0.35), 0 0 ${glow}px rgba(152, 255, 237, 0.8)`
            : undefined,
        }"
        aria-label="Персонаж"
        role="img"
      >
        <!-- Глаза -->
        <div
          class="absolute left-[28%] top-[38%] size-10 rounded-full bg-white shadow"
          aria-hidden="true"
        >
          <div class="absolute left-3 top-3 size-4 rounded-full bg-ink/90"></div>
        </div>
        <div
          class="absolute right-[28%] top-[38%] size-10 rounded-full bg-white shadow"
          aria-hidden="true"
        >
          <div class="absolute left-3 top-3 size-4 rounded-full bg-ink/90"></div>
        </div>

        <!-- Улыбка -->
        <div
          class="absolute left-1/2 top-[62%] h-8 w-20 -translate-x-1/2 rounded-b-full border-b-4"
          :class="faceSmile"
          aria-hidden="true"
        ></div>

        <!-- Блик -->
        <div
          class="absolute left-10 top-10 size-16 rounded-full bg-white/35 blur-[1px]"
          aria-hidden="true"
        ></div>

        <!-- Шкала громкости (мягкая, без текста) -->
        <div v-if="isListening" class="absolute left-1/2 bottom-5 -translate-x-1/2 w-[70%]">
          <div class="h-2 w-full rounded-full bg-ink/10 overflow-hidden">
            <div
              class="h-full rounded-full bg-sunny"
              :style="{ width: `${Math.round(level * 100)}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="isListening" class="mt-4 text-xs text-ink/55">
      Мы измеряем только громкость. Ничего не записываем.
    </p>
  </div>
</template>
