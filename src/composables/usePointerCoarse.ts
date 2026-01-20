import { onMounted, onUnmounted, ref } from 'vue';

export function usePointerCoarse() {
  const isCoarse = ref(false);

  let mql: MediaQueryList | null = null;
  const update = () => {
    isCoarse.value = Boolean(mql?.matches);
  };

  onMounted(() => {
    mql = window.matchMedia('(pointer: coarse)');
    isCoarse.value = mql.matches;

    if ('addEventListener' in mql) mql.addEventListener('change', update);
    else mql.addListener(update);
  });

  onUnmounted(() => {
    if (!mql) return;
    if ('removeEventListener' in mql) mql.removeEventListener('change', update);
    else mql.removeListener(update);
  });

  return { isCoarse };
}
