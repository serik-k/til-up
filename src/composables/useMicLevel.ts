import { onUnmounted, ref } from "vue";

export type MicState =
  | "idle"
  | "starting"
  | "listening"
  | "error"
  | "unsupported";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function clamp01(v: number) {
  return clamp(v, 0, 1);
}

function getAudioContextCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.AudioContext || w.webkitAudioContext || null) as
    | (new () => AudioContext)
    | null;
}

function isSecureContextLikelyOk(): boolean {
  if (typeof window === "undefined") return false;
  const isSecure = Boolean((window as any).isSecureContext);
  const proto = window.location?.protocol || "";
  const host = window.location?.hostname || "";
  const localhostLike =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return isSecure || proto === "https:" || localhostLike;
}

function mapMicError(e: any): string {
  const name = String(e?.name || "");
  const msg = String(e?.message || "");
  const lower = msg.toLowerCase();

  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "permission_denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "device_not_found";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "device_busy";
  if (name === "AbortError") return "aborted";
  if (name === "SecurityError") return "security_error";
  if (name === "OverconstrainedError") return "constraints_not_satisfied";
  if (name === "NotSupportedError") return "unsupported";

  if (lower.includes("secure") || lower.includes("insecure"))
    return "insecure_context";

  return name || msg || "mic_error";
}

export function useMicLevel() {
  const state = ref<MicState>("idle");
  const errorMessage = ref<string>("");
  const level = ref<number>(0);
  const starting = ref<boolean>(false);

  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let srcNode: MediaStreamAudioSourceNode | null = null;
  let zeroGain: GainNode | null = null;

  let dataF32: Float32Array | null = null;
  let dataU8: Uint8Array | null = null;
  let useFloatTimeDomain = true;

  let raf: number | null = null;
  let smooth = 0;
  let sessionToken = 0;

  function supported(): boolean {
    const AC = getAudioContextCtor();
    const gUM =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    return Boolean(AC && gUM);
  }

  function bumpSession() {
    sessionToken += 1;
    return sessionToken;
  }

  function stopTracks(localStream?: MediaStream | null) {
    const s = localStream ?? stream;
    if (!s) return;
    const tracks = s.getTracks();
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i];
      if (!tr) continue;
      try {
        tr.stop();
      } catch {
        // ignore
      }
    }
  }

  function resetMeter() {
    smooth = 0;
    level.value = 0;
  }

  // Важно: синхронная очистка (без await), чтобы не ломать user-gesture цепочку.
  function cleanupAudioGraph(options?: { keepState?: boolean }) {
    if (raf !== null) {
      try {
        cancelAnimationFrame(raf);
      } catch {
        // ignore
      }
      raf = null;
    }

    const localStream = stream;
    stream = null;

    try {
      stopTracks(localStream);
    } catch {
      // ignore
    }

    try {
      try {
        srcNode?.disconnect();
      } catch {
        // ignore
      }
      srcNode = null;

      try {
        analyser?.disconnect();
      } catch {
        // ignore
      }
      analyser = null;

      try {
        zeroGain?.disconnect();
      } catch {
        // ignore
      }
      zeroGain = null;
    } finally {
      dataF32 = null;
      dataU8 = null;
      useFloatTimeDomain = true;
      resetMeter();

      if (!options?.keepState && state.value !== "unsupported") {
        state.value = "idle";
      }

      const localCtx = ctx;
      ctx = null;

      if (localCtx) {
        try {
          void localCtx.close();
        } catch {
          // ignore
        }
      }
    }
  }

  function stop() {
    bumpSession();
    starting.value = false;
    cleanupAudioGraph();
  }

  function tick(token: number) {
    if (token !== sessionToken) return;
    const a = analyser;
    if (!a) return;

    try {
      let rms = 0;

      if (useFloatTimeDomain) {
        const buf = dataF32;
        if (!buf) return;

        // Некоторые рантаймы могут не иметь getFloatTimeDomainData.
        const fn = (a as any).getFloatTimeDomainData;
        if (typeof fn !== "function") {
          useFloatTimeDomain = false;
          dataF32 = null;
          dataU8 = new Uint8Array(a.fftSize);
          rms = 0;
        } else {
          fn.call(a, buf);

          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const x = buf[i] ?? 0;
            sum += x * x;
          }
          rms = Math.sqrt(sum / Math.max(1, buf.length));
        }
      }

      if (!useFloatTimeDomain) {
        const buf = dataU8;
        if (!buf) return;

        a.getByteTimeDomainData(buf);

        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const x = (buf[i]! - 128) / 128;
          sum += x * x;
        }
        rms = Math.sqrt(sum / Math.max(1, buf.length));
      }

      const raw = clamp01(rms * 8);

      if (raw > smooth) smooth = smooth * 0.65 + raw * 0.35;
      else smooth = smooth * 0.9 + raw * 0.1;

      level.value = clamp01(smooth);
    } catch {
      level.value = 0;
      return;
    }

    raf = requestAnimationFrame(() => tick(token));
  }

  async function start() {
    if (!supported()) {
      state.value = "unsupported";
      errorMessage.value = "";
      starting.value = false;
      return;
    }

    if (
      starting.value ||
      state.value === "starting" ||
      state.value === "listening"
    ) {
      return;
    }

    if (!isSecureContextLikelyOk()) {
      state.value = "error";
      errorMessage.value = "insecure_context";
      starting.value = false;
      return;
    }

    // Важно: сначала отменяем прошлую сессию, но НЕ сбрасываем state в idle (иначе дергается UI).
    const token = bumpSession();
    cleanupAudioGraph({ keepState: true });

    errorMessage.value = "";
    starting.value = true;
    state.value = "starting";

    const AC = getAudioContextCtor();
    if (!AC) {
      state.value = "unsupported";
      errorMessage.value = "";
      starting.value = false;
      return;
    }

    let localStream: MediaStream | null = null;
    let localCtx: AudioContext | null = null;
    let localSrc: MediaStreamAudioSourceNode | null = null;
    let localAnalyser: AnalyserNode | null = null;
    let localZeroGain: GainNode | null = null;

    try {
      // Создаем AudioContext максимально рано (до ожиданий), чтобы было стабильнее в Safari/iOS.
      localCtx = new AC();

      // Пытаемся резюмить. Важно: сам вызов resume происходит в рамках user gesture (клик).
      if (localCtx.state === "suspended") {
        try {
          await localCtx.resume();
        } catch {
          // ignore
        }
      }

      // Теперь просим доступ к микрофону.
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      if (token !== sessionToken) {
        stopTracks(localStream);
        try {
          await localCtx.close();
        } catch {
          // ignore
        }
        starting.value = false;
        return;
      }

      // Если контекст все еще suspended — считаем это ошибкой.
      if (localCtx.state === "suspended") {
        stopTracks(localStream);
        try {
          await localCtx.close();
        } catch {
          // ignore
        }
        state.value = "error";
        errorMessage.value = "audio_context_suspended";
        starting.value = false;
        return;
      }

      localSrc = localCtx.createMediaStreamSource(localStream);

      localAnalyser = localCtx.createAnalyser();
      localAnalyser.fftSize = 2048;
      // Чтобы не “двойне-сглаживать”: оставляем встроенное сглаживание нулевым и контролируем сами.
      localAnalyser.smoothingTimeConstant = 0;

      localZeroGain = localCtx.createGain();
      localZeroGain.gain.value = 0;

      localSrc.connect(localAnalyser);
      localAnalyser.connect(localZeroGain);
      localZeroGain.connect(localCtx.destination);

      if (token !== sessionToken) {
        stopTracks(localStream);
        try {
          localSrc.disconnect();
        } catch {
          // ignore
        }
        try {
          localAnalyser.disconnect();
        } catch {
          // ignore
        }
        try {
          localZeroGain.disconnect();
        } catch {
          // ignore
        }
        try {
          await localCtx.close();
        } catch {
          // ignore
        }
        starting.value = false;
        return;
      }

      // Коммитим “живые” ссылки только в конце — после всех проверок токена.
      stream = localStream;
      ctx = localCtx;
      srcNode = localSrc;
      analyser = localAnalyser;
      zeroGain = localZeroGain;

      // Буфер под time-domain. Если float недоступен — fallback в tick переключит на byte.
      useFloatTimeDomain =
        typeof (localAnalyser as any).getFloatTimeDomainData === "function";
      if (useFloatTimeDomain) {
        dataF32 = new Float32Array(localAnalyser.fftSize);
        dataU8 = null;
      } else {
        dataF32 = null;
        dataU8 = new Uint8Array(localAnalyser.fftSize);
      }

      resetMeter();
      state.value = "listening";
      starting.value = false;

      raf = requestAnimationFrame(() => tick(token));
    } catch (e: any) {
      try {
        stopTracks(localStream);
      } catch {
        // ignore
      }

      try {
        localSrc?.disconnect();
      } catch {
        // ignore
      }
      try {
        localAnalyser?.disconnect();
      } catch {
        // ignore
      }
      try {
        localZeroGain?.disconnect();
      } catch {
        // ignore
      }
      try {
        if (localCtx) await localCtx.close();
      } catch {
        // ignore
      }

      bumpSession();
      cleanupAudioGraph({ keepState: true });

      state.value = "error";
      errorMessage.value = mapMicError(e);
      starting.value = false;
    }
  }

  onUnmounted(() => {
    stop();
  });

  return {
    state,
    errorMessage,
    level,
    starting,
    start,
    stop,
    supported,
  };
}
