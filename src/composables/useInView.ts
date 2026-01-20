import { onMounted, onUnmounted, ref } from 'vue';

export function useInView(options?: IntersectionObserverInit) {
  const el = ref<HTMLElement | null>(null);
  const inView = ref(false);

  let io: IntersectionObserver | null = null;

  onMounted(() => {
    io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      inView.value = Boolean(entry?.isIntersecting);
    }, options);

    if (el.value) io.observe(el.value);
  });

  onUnmounted(() => {
    if (io && el.value) io.unobserve(el.value);
    io?.disconnect();
    io = null;
  });

  return { el, inView };
}
