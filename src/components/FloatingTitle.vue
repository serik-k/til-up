<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  text: string;
}>();

const letters = computed(() => props.text.split(''));

function letterStyle(i: number) {
  const delay = (i % 9) * 0.08;
  const duration = 5.6 + (i % 7) * 0.35;
  const amp = 2 + (i % 4) * 0.7;
  const rot = ((i % 5) - 2) * 0.15;

  return {
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    '--float-amp': `${amp}px`,
    '--float-rot': `${rot}deg`,
  } as Record<string, string>;
}
</script>

<template>
  <h1
    class="text-[32px] leading-[0.95] sm:text-[32px] md:text-[32px] font-black tracking-tight text-ink"
    aria-label="Til Up"
  >
    <span class="sr-only">{{ text }}</span>

    <span aria-hidden="true" class="inline-flex">
      <span
        v-for="(ch, i) in letters"
        :key="i"
        class="inline-block will-change-transform floaty"
        :style="letterStyle(i)"
      >
        {{ ch === ' ' ? '\u00A0' : ch }}
      </span>
    </span>
  </h1>
</template>

<style scoped>
.floaty {
  animation-name: floatySoft;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  transform: translate3d(0, 0, 0);
}

@keyframes floatySoft {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
    opacity: 1;
    filter: blur(0px);
  }
  35% {
    transform: translate3d(0, calc(var(--float-amp) * -0.55), 0)
      rotate(calc(var(--float-rot) * 0.6));
    opacity: 0.985;
    filter: blur(0px);
  }
  50% {
    transform: translate3d(0, calc(var(--float-amp) * -1), 0) rotate(var(--float-rot));
    opacity: 0.98;
    filter: blur(0.15px);
  }
  65% {
    transform: translate3d(0, calc(var(--float-amp) * -0.55), 0)
      rotate(calc(var(--float-rot) * 0.6));
    opacity: 0.985;
    filter: blur(0px);
  }
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
    opacity: 1;
    filter: blur(0px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .floaty {
    animation: none !important;
    transform: none !important;
    filter: none !important;
  }
}
</style>
