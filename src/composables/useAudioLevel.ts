import { onUnmounted, ref } from 'vue';

type MicState = 'off' | 'listening' | 'error';

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * WebAudio: ONLY volume level (no recording, no speech recognition).
 * - Создаём AudioContext + AnalyserNode
 * - Считаем RMS по time-domain буферу -> нормализуем в 0..1
 * - Никаких данных не сохраняем
 * - Полный cleanup: rAF + треки + AudioContext.close()
 */
export function useAudioLevel() {
  const state = ref<MicState>('off');
  const level = ref<number>(0); // 0..1
  const threshold = ref<number>(0.18); // “порог громкости”
  const errorMessage = ref<string>('');

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;
  let rafId: number | null = null;
  let data: Uint8Array | null = null;

  function stopInternal() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }

    source = null;
    analyser = null;
    data = null;

    if (audioCtx) {
      const ctx = audioCtx;
      audioCtx = null;
      try {
        // close может бросать в некоторых окружениях — безопасно игнорируем
        ctx.close();
      } catch {
        // ignore
      }
    }

    level.value = 0;
  }

  async function start() {
    if (state.value === 'listening') return;

    errorMessage.value = '';
    state.value = 'off';

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      stream = media;

      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;

      source = audioCtx.createMediaStreamSource(media);
      source.connect(analyser);

      data = new Uint8Array(analyser.fftSize);

      state.value = 'listening';

      const tick = () => {
        if (!analyser || !data) return;

        analyser.getByteTimeDomainData(data);

        // RMS по центру 128
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const x = (data[i] - 128) / 128;
          sumSq += x * x;
        }
        const rms = Math.sqrt(sumSq / data.length);

        // Нормализация: rms обычно маленький, мягко усилим
        const normalized = clamp01(rms * 3.2);
        level.value = normalized;

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    } catch (e: any) {
      stopInternal();
      state.value = 'error';
      errorMessage.value =
        typeof e?.message === 'string'
          ? e.message
          : 'Не удалось получить доступ к микрофону. Можно продолжить без него.';
    }
  }

  function stop() {
    stopInternal();
    state.value = 'off';
  }

  function setThreshold(v: number) {
    threshold.value = clamp01(v);
  }

  onUnmounted(() => {
    stopInternal();
  });

  return {
    state,
    level,
    threshold,
    errorMessage,
    start,
    stop,
    setThreshold,
  };
}
