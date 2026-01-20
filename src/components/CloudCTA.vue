<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  kind?: 'primary' | 'secondary';
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'press'): void;
}>();

/**
 * Touch-first:
 * - дублируем onTouchStart, чтобы на планшетах ощущалось мгновенно
 * - при этом сохраняем click (мышь/клавиатура)
 */
function press() {
  emit('press');
}

const base =
  'select-none inline-flex items-center justify-center gap-2 rounded-3xl px-6 py-4 min-w-[176px] min-h-[56px] ' +
  'text-base font-semibold tracking-tight transition-transform duration-150 ' +
  'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/20';

const classes = computed(() => {
  if (props.kind === 'secondary') {
    return (
      base +
      ' bg-white text-ink shadow-xl border border-ink/10 ' +
      'hover:shadow-2xl hover:-translate-y-[1px]'
    );
  }

  return base + ' bg-mint text-ink shadow-2xl ' + 'hover:shadow-2xl hover:-translate-y-[1px]';
});
</script>

<template>
  <button
    data-magnetic
    type="button"
    :class="classes"
    :aria-label="ariaLabel || label"
    @click="press"
    @touchstart.passive="press"
  >
    <span class="relative">
      {{ label }}
      <span
        v-if="kind !== 'secondary'"
        class="absolute -right-3 -top-3 size-3 rounded-full bg-sunny shadow"
        aria-hidden="true"
      />
    </span>
  </button>
</template>
