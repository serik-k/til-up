<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  text: string;
  reducedMotion: boolean;
}>();

/**
 * Каждая буква — отдельный span.
 * В Этапе 1: лёгкая CSS idle-анимация (без Framer Motion).
 * В Этапе 3: заменим на motion.span с “хаотичным floating”.
 */
const letters = computed(() => props.text.split(''));

function letterStyle(i: number) {
  // маленькая “хаотичность” через разные задержки/длительности
  const delay = (i % 7) * 0.12;
  const duration = 3.8 + (i % 5) * 0.35;
  return {
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  };
}
</script>

<template>
  <h1
    class="text-[52px] leading-[0.95] sm:text-[64px] md:text-[76px] font-black tracking-tight text-ink"
    aria-label="Til Up"
  >
    <span class="sr-only">{{ text }}</span>
    <span aria-hidden="true" class="inline-flex">
      <span
        v-for="(ch, i) in letters"
        :key="i"
        class="inline-block"
        :class="reducedMotion ? '' : 'animate-floaty'"
        :style="reducedMotion ? undefined : letterStyle(i)"
      >
        {{ ch === ' ' ? '\u00A0' : ch }}
      </span>
    </span>
  </h1>
</template>
