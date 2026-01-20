<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

/**
 * Custom Cursor:
 * - Только для desktop (на touch/off)
 * - LERP следование
 * - Magnetic effect на [data-magnetic]
 * - Отключение при reducedMotion
 *
 * Как пользоваться магнитом:
 * - добавь атрибут data-magnetic на любую кнопку/ссылку (мы добавим в CloudCTA ниже).
 */

const props = defineProps<{
  enabled: boolean; // уже учтены touch + reduced motion снаружи
}>();

const cursorEl = ref<HTMLDivElement | null>(null);
const ringEl = ref<HTMLDivElement | null>(null);

const pos = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
const ring = { x: 0, y: 0 };

const magneticOffset = { x: 0, y: 0 };
const magneticStrength = 0.28; // сила притяжения

let raf: number | null = null;
let visible = false;

const opacityClass = computed(() => (props.enabled && visible ? 'opacity-100' : 'opacity-0'));

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function onMouseMove(e: MouseEvent) {
  target.x = e.clientX;
  target.y = e.clientY;
  visible = true;
}

function onMouseLeave() {
  visible = false;
}

function findMagneticTarget(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;

  const targetEl = el.closest('[data-magnetic]') as HTMLElement | null;
  return targetEl;
}

function updateMagnet() {
  const magnetEl = findMagneticTarget(target.x, target.y);
  if (!magnetEl) {
    magneticOffset.x = lerp(magneticOffset.x, 0, 0.18);
    magneticOffset.y = lerp(magneticOffset.y, 0, 0.18);
    return;
  }

  const rect = magnetEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const dx = target.x - cx;
  const dy = target.y - cy;

  magneticOffset.x = lerp(magneticOffset.x, -dx * magneticStrength, 0.22);
  magneticOffset.y = lerp(magneticOffset.y, -dy * magneticStrength, 0.22);
}

function loop() {
  if (!props.enabled) {
    raf = window.requestAnimationFrame(loop);
    return;
  }

  updateMagnet();

  // основной “точечный” курсор
  pos.x = lerp(pos.x, target.x + magneticOffset.x, 0.22);
  pos.y = lerp(pos.y, target.y + magneticOffset.y, 0.22);

  // внешний “ring” чуть медленнее
  ring.x = lerp(ring.x, target.x + magneticOffset.x, 0.12);
  ring.y = lerp(ring.y, target.y + magneticOffset.y, 0.12);

  if (cursorEl.value) {
    cursorEl.value.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  }
  if (ringEl.value) {
    ringEl.value.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
  }

  raf = window.requestAnimationFrame(loop);
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('mouseleave', onMouseLeave, { passive: true });

  // init — чтобы не прыгал с (0,0)
  target.x = window.innerWidth / 2;
  target.y = window.innerHeight / 2;
  pos.x = target.x;
  pos.y = target.y;
  ring.x = target.x;
  ring.y = target.y;

  raf = window.requestAnimationFrame(loop);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseleave', onMouseLeave);
  if (raf !== null) window.cancelAnimationFrame(raf);
});
</script>

<template>
  <div v-if="enabled" class="pointer-events-none fixed inset-0 z-[100]">
    <!-- ring -->
    <div
      ref="ringEl"
      class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/25"
      :class="opacityClass"
      style="width: 44px; height: 44px; transition: opacity 140ms ease"
      aria-hidden="true"
    />
    <!-- dot -->
    <div
      ref="cursorEl"
      class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sunny shadow-xl"
      :class="opacityClass"
      style="width: 14px; height: 14px; transition: opacity 140ms ease"
      aria-hidden="true"
    />
  </div>
</template>
