import { onMounted, onUnmounted, ref } from 'vue';

export function useIntersectionOnce(targetRef: { value: Element | null }, rootMargin = '200px') {
  const visible = ref(false);
  let io: IntersectionObserver | null = null;

  onMounted(() => {
    const el = targetRef.value;
    if (!el) return;

    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.value = true;
            if (io) io.disconnect();
            io = null;
            break;
          }
        }
      },
      { root: null, threshold: 0.12, rootMargin }
    );

    io.observe(el);
  });

  onUnmounted(() => {
    if (io) io.disconnect();
    io = null;
  });

  return { visible };
}
