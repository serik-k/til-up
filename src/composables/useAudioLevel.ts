import { onUnmounted, ref } from 'vue';

type MicState = 'off' | 'listening' | 'error';

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * WebAudio: ONLY volume level (no recording, no speech recognition).
 * - AudioContext + AnalyserNode
 * - RMS on time-domain buffer -> normalize 0..1
 * - No persistence
 * - Full cleanup: rAF + tracks + AudioContext.close()
 */
export function useAudioLevel() {
  const state = ref<MicState>('off');
  const level = ref<number>(0); // 0..1
  const threshold = ref<number>(0.18);
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
        void ctx.close();
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

      const Ctx = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext;
      audioCtx = new Ctx();

      try {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
      } catch {
        // ignore
      }

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

        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const x = (data[i] - 128) / 128;
          sumSq += x * x;
        }
        const rms = Math.sqrt(sumSq / data.length);

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
      throw e;
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
