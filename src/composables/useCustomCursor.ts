import { onMounted, onUnmounted, ref } from 'vue';

type CursorConfig = {
  enabled: boolean;
  reducedMotion: boolean;
};

function isTouchDevice() {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/**
 * Custom cursor:
 * - выключаем на touch и при prefers-reduced-motion (motion-safety)
 * - lerp-follow (мягкое следование)
 * - magnetic эффект: элементы с [data-magnetic="true"] притягивают курсор и слегка “скейлят” курсор
 */
export function useCustomCursor(cfg: CursorConfig) {
  const active = ref(false);

  const x = ref(0);
  const y = ref(0);

  const tx = ref(0);
  const ty = ref(0);

  const scale = ref(1);
  const visible = ref(false);

  let rafId: number | null = null;
  let hoveredEl: HTMLElement | null = null;
  let rect: DOMRect | null = null;

  function startRaf() {
    if (rafId !== null) return;

    const tick = () => {
      // lerp
      const lerp = cfg.reducedMotion ? 1 : 0.18;
      x.value += (tx.value - x.value) * lerp;
      y.value += (ty.value - y.value) * lerp;

      if (hoveredEl && rect) {
        // магнит: курсор слегка тянется к центру элемента
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (cx - tx.value) * 0.12;
        const dy = (cy - ty.value) * 0.12;
        x.value += dx;
        y.value += dy;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  }

  function stopRaf() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onMove(e: MouseEvent) {
    tx.value = e.clientX;
    ty.value = e.clientY;
    visible.value = true;
  }

  function onEnter() {
    visible.value = true;
  }

  function onLeave() {
    visible.value = false;
    hoveredEl = null;
    rect = null;
    scale.value = 1;
  }

  function findMagneticTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return null;
    const el = target.closest('[data-magnetic="true"]') as HTMLElement | null;
    return el;
  }

  function onOver(e: MouseEvent) {
    const el = findMagneticTarget(e.target);
    if (!el) return;
    hoveredEl = el;
    rect = el.getBoundingClientRect();
    scale.value = 1.35;
  }

  function onOut(e: MouseEvent) {
    const el = findMagneticTarget(e.target);
    if (!el) return;
    hoveredEl = null;
    rect = null;
    scale.value = 1;
  }

  function onDown() {
    scale.value = clamp(scale.value * 0.9, 0.8, 1.6);
  }

  function onUp() {
    scale.value = hoveredEl ? 1.35 : 1;
  }

  onMounted(() => {
    if (!cfg.enabled) return;
    if (cfg.reducedMotion) return;
    if (isTouchDevice()) return;

    active.value = true;
    startRaf();

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseenter', onEnter, { passive: true });
    window.addEventListener('mouseleave', onLeave, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('mouseout', onOut, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
  });

  onUnmounted(() => {
    stopRaf();
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseenter', onEnter);
    window.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('mouseover', onOver);
    window.removeEventListener('mouseout', onOut);
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
  });

  return {
    active,
    x,
    y,
    scale,
    visible,
  };
}
