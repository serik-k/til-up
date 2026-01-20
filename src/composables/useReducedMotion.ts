import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Motion-safety:
 * 1) уважает prefers-reduced-motion
 * 2) позволяет пользователю принудительно включить “меньше анимаций” в Parents Mode
 *
 * Важно: в детских интерфейсах “лишние” движения могут перегружать или вызывать дискомфорт.
 * Поэтому reducedMotion — базовый глобальный флаг.
 */
export function useReducedMotion() {
  const prefersReduced = ref(false);
  const userReducedOverride = ref<boolean | null>(null);

  let media: MediaQueryList | null = null;
  const onChange = () => {
    prefersReduced.value = Boolean(media?.matches);
  };

  const reducedMotion = () => {
    if (userReducedOverride.value !== null) return userReducedOverride.value;
    return prefersReduced.value;
  };

  const setUserReducedOverride = (v: boolean) => {
    userReducedOverride.value = v;
    try {
      localStorage.setItem('tilup_reduced_motion', v ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const hydrateFromStorage = () => {
    try {
      const raw = localStorage.getItem('tilup_reduced_motion');
      if (raw === '1') userReducedOverride.value = true;
      if (raw === '0') userReducedOverride.value = false;
    } catch {
      // ignore
    }
  };

  onMounted(() => {
    hydrateFromStorage();
    media = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReduced.value = media.matches;

    if ('addEventListener' in media) media.addEventListener('change', onChange);
    else media.addListener(onChange);
  });

  onUnmounted(() => {
    if (!media) return;
    if ('removeEventListener' in media) media.removeEventListener('change', onChange);
    else media.removeListener(onChange);
  });

  return {
    prefersReduced,
    userReducedOverride,
    reducedMotion,
    setUserReducedOverride,
  };
}
