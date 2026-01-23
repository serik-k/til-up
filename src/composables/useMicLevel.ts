import { onUnmounted, ref } from 'vue';

export type MicState = 'idle' | 'starting' | 'listening' | 'error' | 'unsupported';

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function clamp01(v: number) {
  return clamp(v, 0, 1);
}

function getAudioContextCtor(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return (w.AudioContext || w.webkitAudioContext || null) as (new () => AudioContext) | null;
}

function isSecureContextLikelyOk(): boolean {
  if (typeof window === 'undefined') return false;
  const isSecure = Boolean((window as any).isSecureContext);
  const proto = window.location?.protocol || '';
  const host = window.location?.hostname || '';
  const localhostLike = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  return isSecure || proto === 'https:' || localhostLike;
}

function mapMicError(e: any): string {
  const name = String(e?.name || '');
  const msg = String(e?.message || '');

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permission_denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'device_not_found';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'device_busy';
  if (name === 'AbortError') return 'aborted';
  if (name === 'SecurityError') return 'security_error';
  if (name === 'OverconstrainedError') return 'constraints_not_satisfied';

  if (msg.toLowerCase().includes('secure') || msg.toLowerCase().includes('insecure'))
    return 'insecure_context';

  return name || msg || 'mic_error';
}

export function useMicLevel() {
  const state = ref<MicState>('idle');
  const errorMessage = ref('');
  const level = ref(0);

  const starting = ref(false);

  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let srcNode: MediaStreamAudioSourceNode | null = null;

  let zeroGain: GainNode | null = null;

  let data: Float32Array<ArrayBuffer> | null = null;
  let raf: number | null = null;

  let smooth = 0;

  let sessionToken = 0;

  function supported() {
    const AC = getAudioContextCtor();
    const gUM =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function';

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
      try {
        tracks[i]!.stop();
      } catch {
        // ignore
      }
    }
  }

  function resetMeter() {
    smooth = 0;
    level.value = 0;
  }

  async function cleanupAudioGraph(options?: { keepState?: boolean }) {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }

    try {
      stopTracks();
    } finally {
      stream = null;
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

      if (ctx) {
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
    } finally {
      ctx = null;
      data = null;
      resetMeter();
      if (!options?.keepState && state.value !== 'unsupported') state.value = 'idle';
    }
  }

  async function stop() {
    bumpSession();
    starting.value = false;
    await cleanupAudioGraph();
  }

  function tick(token: number) {
    if (token !== sessionToken) return;
    if (!analyser || !data) return;

    try {
      analyser.getFloatTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const x = data[i] ?? 0;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / Math.max(1, data.length));

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
      state.value = 'unsupported';
      errorMessage.value = '';
      return;
    }

    if (starting.value || state.value === 'starting' || state.value === 'listening') return;

    if (!isSecureContextLikelyOk()) {
      state.value = 'error';
      errorMessage.value = 'insecure_context';
      return;
    }

    errorMessage.value = '';
    starting.value = true;
    state.value = 'starting';

    await stop();

    const AC = getAudioContextCtor();
    if (!AC) {
      starting.value = false;
      state.value = 'unsupported';
      errorMessage.value = '';
      return;
    }

    const token = bumpSession();

    let localStream: MediaStream | null = null;
    let localCtx: AudioContext | null = null;
    let localSrc: MediaStreamAudioSourceNode | null = null;
    let localAnalyser: AnalyserNode | null = null;
    let localZeroGain: GainNode | null = null;

    try {
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
        starting.value = false;
        return;
      }

      localCtx = new AC();

      if (localCtx.state === 'suspended') {
        try {
          await localCtx.resume();
        } catch {
          // ignore
        }
      }

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

      if (localCtx.state === 'suspended') {
        stopTracks(localStream);
        try {
          await localCtx.close();
        } catch {
          // ignore
        }
        state.value = 'error';
        errorMessage.value = 'audio_context_suspended';
        starting.value = false;
        return;
      }

      localSrc = localCtx.createMediaStreamSource(localStream);

      localAnalyser = localCtx.createAnalyser();
      localAnalyser.fftSize = 2048;
      localAnalyser.smoothingTimeConstant = 0.7;

      localZeroGain = localCtx.createGain();
      localZeroGain.gain.value = 0;

      localSrc.connect(localAnalyser);
      localAnalyser.connect(localZeroGain);
      localZeroGain.connect(localCtx.destination);

      if (token !== sessionToken) {
        stopTracks(localStream);
        try {
          localSrc.disconnect();
        } catch {}
        try {
          localAnalyser.disconnect();
        } catch {}
        try {
          localZeroGain.disconnect();
        } catch {}
        try {
          await localCtx.close();
        } catch {}
        starting.value = false;
        return;
      }

      stream = localStream;
      ctx = localCtx;
      srcNode = localSrc;
      analyser = localAnalyser;
      zeroGain = localZeroGain;

      data = new Float32Array(localAnalyser.fftSize);

      resetMeter();
      state.value = 'listening';
      starting.value = false;

      raf = requestAnimationFrame(() => tick(token));
    } catch (e: any) {
      try {
        stopTracks(localStream);
      } catch {
        // ignore
      }

      try {
        if (localSrc) localSrc.disconnect();
      } catch {}
      try {
        if (localAnalyser) localAnalyser.disconnect();
      } catch {}
      try {
        if (localZeroGain) localZeroGain.disconnect();
      } catch {}

      try {
        if (localCtx) await localCtx.close();
      } catch {
        // ignore
      }

      bumpSession();
      await cleanupAudioGraph({ keepState: true });

      state.value = 'error';
      errorMessage.value = mapMicError(e);
      starting.value = false;
    }
  }

  onUnmounted(() => {
    void stop();
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
