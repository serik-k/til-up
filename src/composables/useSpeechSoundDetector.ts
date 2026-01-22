import { ref } from 'vue';
import { DetectorConfig, DetectorFeatures, DetectorState, Sound } from '../types/soundPop';

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function clamp01(v: number) {
  return clamp(v, 0, 1);
}

function computeRmsAndZcr(buf: Float32Array) {
  let sum = 0;
  let zc = 0;
  let prev = buf[0] ?? 0;

  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] ?? 0;
    sum += x * x;
    const s = x >= 0 ? 1 : -1;
    const ps = prev >= 0 ? 1 : -1;
    if (i > 0 && s !== ps) zc += 1;
    prev = x;
  }

  const rms = Math.sqrt(sum / Math.max(1, buf.length));
  const zcr = zc / Math.max(1, buf.length); // 0..~0.5
  return { rms, zcr };
}

function estimatePitchConfidence(buf: Float32Array, sampleRate: number) {
  const n = buf.length;
  if (n < 256) return { pitchHz: 0, conf: 0 };

  const minHz = 80;
  const maxHz = 350;

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  let energy = 0;
  for (let i = 0; i < n; i++) {
    const x = buf[i] ?? 0;
    energy += x * x;
  }
  if (energy < 1e-5) return { pitchHz: 0, conf: 0 };

  let bestLag = -1;
  let best = 0;

  // шаг по лагу 2 — быстрее
  for (let lag = minLag; lag <= maxLag; lag += 2) {
    let corr = 0;

    // шаг по i 2 — ещё быстрее, при этом стабильность voiced обычно сохраняется
    for (let i = 0; i < n - lag; i += 2) {
      corr += (buf[i] ?? 0) * (buf[i + lag] ?? 0);
    }

    const denom = Math.max(1, Math.floor((n - lag) / 2));
    corr /= denom;

    const norm = corr / Math.max(1e-6, energy / n);
    if (norm > best) {
      best = norm;
      bestLag = lag;
    }
  }

  const conf = clamp01((best - 0.2) / 0.8);
  const pitchHz = bestLag > 0 ? sampleRate / bestLag : 0;
  return { pitchHz, conf };
}

type BandIndexPlan = {
  lowA: number;
  lowB: number;
  midA: number;
  midB: number;
  highA: number;
  highB: number;
  flatA: number;
  flatB: number;
};

function makeBandPlan(freqBins: number, sampleRate: number): BandIndexPlan {
  const nyquist = sampleRate / 2;
  const binHz = nyquist / Math.max(1, freqBins - 1);

  const hzToIdx = (hz: number) => clamp(Math.round(hz / binHz), 0, freqBins - 1);

  // диапазоны (под голос/шипение)
  const LOW_A = 80;
  const LOW_B = 350;

  const MID_A = 350;
  const MID_B = 1500;

  const HIGH_A = 1500;
  const HIGH_B = 5000;

  const FLAT_A = 400;
  const FLAT_B = 6000;

  const lowA = hzToIdx(LOW_A);
  const lowB = hzToIdx(LOW_B);

  const midA = hzToIdx(MID_A);
  const midB = hzToIdx(MID_B);

  const highA = hzToIdx(HIGH_A);
  const highB = hzToIdx(HIGH_B);

  const flatA = hzToIdx(FLAT_A);
  const flatB = hzToIdx(FLAT_B);

  return { lowA, lowB, midA, midB, highA, highB, flatA, flatB };
}

function computeBandEnergiesPlanned(freq: Uint8Array, plan: BandIndexPlan) {
  let low = 0;
  let mid = 0;
  let high = 0;

  let flatSum = 0;
  let flatLogSum = 0;
  let flatN = 0;

  const binCount = freq.length;

  const sumRange = (a: number, b: number) => {
    let s = 0;
    const aa = clamp(a, 0, binCount - 1);
    const bb = clamp(b, 0, binCount - 1);
    for (let i = aa; i < bb; i++) {
      s += (freq[i] ?? 0) / 255;
    }
    return s;
  };

  low = sumRange(plan.lowA, plan.lowB);
  mid = sumRange(plan.midA, plan.midB);
  high = sumRange(plan.highA, plan.highB);

  const fa = clamp(plan.flatA, 0, binCount - 1);
  const fb = clamp(plan.flatB, 0, binCount - 1);
  for (let i = fa; i < fb; i++) {
    const mag = (freq[i] ?? 0) / 255;
    const m = Math.max(1e-6, mag);
    flatSum += m;
    flatLogSum += Math.log(m);
    flatN += 1;
  }

  const mean = flatSum / Math.max(1, flatN);
  const geo = Math.exp(flatLogSum / Math.max(1, flatN));
  const flatness = geo / Math.max(1e-6, mean);

  return { low, mid, high, flatness: clamp01(flatness) };
}

function classifySound(
  features: {
    rms: number;
    zcr: number;
    low: number;
    mid: number;
    high: number;
    flatness: number;
    pitchConf: number;
  },
  gates: { minRms: number }
): { sound: Sound | null; confidence: number } {
  const { rms, zcr, low, mid, high, flatness, pitchConf } = features;

  if (rms < gates.minRms) return { sound: null, confidence: 0 };

  const total = low + mid + high;
  if (total <= 1e-6) return { sound: null, confidence: 0 };

  const lowR = low / total;
  const midR = mid / total;
  const highR = high / total;

  // SH: шум + много верхов + низкая voiced-периодичность
  const shScore =
    clamp01((highR - 0.38) / 0.28) *
    clamp01((flatness - 0.2) / 0.35) *
    clamp01((0.55 - pitchConf) / 0.55);

  // L: voiced, меньше верхов, побольше mid, ниже zcr
  const lScore =
    clamp01((pitchConf - 0.55) / 0.35) *
    clamp01((midR - 0.28) / 0.3) *
    clamp01((0.32 - highR) / 0.24) *
    clamp01((0.12 - zcr) / 0.1);

  // R: voiced, больше низов, чуть выше zcr
  const rScore =
    clamp01((pitchConf - 0.55) / 0.35) *
    clamp01((lowR - 0.26) / 0.3) *
    clamp01((0.3 - highR) / 0.26) *
    clamp01((zcr - 0.03) / 0.1);

  const best = Math.max(shScore, lScore, rScore);
  if (best < 0.55) return { sound: null, confidence: best };

  if (best === shScore) return { sound: 'SH', confidence: best };
  if (best === lScore) return { sound: 'L', confidence: best };
  return { sound: 'R', confidence: best };
}

export function useSpeechSoundDetector(userConfig?: Partial<DetectorConfig>) {
  const cfg: DetectorConfig = {
    fps: 30,
    fftSize: 2048,
    smoothingTimeConstant: 0.6,

    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,

    enableNoiseCalibration: true,
    calibrationMs: 600,
    noiseMarginRms: 0.012,

    baseMinRms: 0.02,
    minConfToReport: 0.0,

    stableFrames: 4,
    stableMinConf: 0.72,

    emaAlpha: 0.22,

    ...(userConfig ?? {}),
  };

  const state = ref<DetectorState>('idle');
  const errorMessage = ref('');

  // UI 0..1
  const level = ref(0);

  // raw вывод (как у тебя было)
  const detectedSound = ref<Sound | null>(null);
  const confidence = ref(0);

  // stable вывод (для прод-гейтов)
  const stableDetectedSound = ref<Sound | null>(null);
  const stableConfidence = ref(0);

  // отладочные фичи (очень помогает в прод-логах/настройке)
  const features = ref<DetectorFeatures>({
    rms: 0,
    zcr: 0,
    low: 0,
    mid: 0,
    high: 0,
    flatness: 0,
    pitchHz: 0,
    pitchConf: 0,
    noiseFloorRms: 0,
  });

  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;

  let rafId: number | null = null;
  let lastUpdate = 0;

  let timeBuf: Float32Array | null = null;
  let freqBuf: Uint8Array | null = null;

  let bandPlan: BandIndexPlan | null = null;

  // шумовой пол
  let noiseFloorRms = 0;
  let calibUntil = 0;

  // EMA состояние
  let emaRms = 0;
  let emaZcr = 0;
  let emaLow = 0;
  let emaMid = 0;
  let emaHigh = 0;
  let emaFlat = 0;
  let emaPitchConf = 0;

  // stable gate внутри детектора
  let stableLast: Sound | null = null;
  let stableCount = 0;

  // handlers
  let onEndedHandler: (() => void) | null = null;

  function resetOutputs() {
    level.value = 0;

    detectedSound.value = null;
    confidence.value = 0;

    stableDetectedSound.value = null;
    stableConfidence.value = 0;

    features.value = {
      rms: 0,
      zcr: 0,
      low: 0,
      mid: 0,
      high: 0,
      flatness: 0,
      pitchHz: 0,
      pitchConf: 0,
      noiseFloorRms: 0,
    };

    noiseFloorRms = 0;
    calibUntil = 0;

    emaRms = 0;
    emaZcr = 0;
    emaLow = 0;
    emaMid = 0;
    emaHigh = 0;
    emaFlat = 0;
    emaPitchConf = 0;

    stableLast = null;
    stableCount = 0;
  }

  function cleanup() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    try {
      if (source) source.disconnect();
    } catch {}
    try {
      if (analyser) analyser.disconnect();
    } catch {}

    if (stream) {
      const tracks = stream.getTracks();
      for (const tr of tracks) {
        try {
          tr.onended = null;
        } catch {}
        try {
          tr.stop();
        } catch {}
      }
    }

    stream = null;
    source = null;
    analyser = null;

    if (ctx) {
      try {
        void ctx.close();
      } catch {}
    }
    ctx = null;

    timeBuf = null;
    freqBuf = null;
    bandPlan = null;

    onEndedHandler = null;
  }

  function updateStable(rawSound: Sound | null, rawConf: number) {
    // если не проходит порог стабильности — сброс
    if (!rawSound || rawConf < cfg.stableMinConf) {
      stableLast = null;
      stableCount = 0;
      stableDetectedSound.value = null;
      stableConfidence.value = 0;
      return;
    }

    if (stableLast === rawSound) stableCount += 1;
    else {
      stableLast = rawSound;
      stableCount = 1;
    }

    if (stableCount >= cfg.stableFrames) {
      stableDetectedSound.value = rawSound;
      stableConfidence.value = rawConf;
    } else {
      stableDetectedSound.value = null;
      stableConfidence.value = 0;
    }
  }

  function tick(now: number) {
    if (!analyser || !ctx || state.value !== 'listening') return;

    const frameMs = 1000 / Math.max(1, cfg.fps);

    if (lastUpdate === 0 || now - lastUpdate >= frameMs) {
      const dt = lastUpdate === 0 ? frameMs : now - lastUpdate;
      lastUpdate = now;

      if (timeBuf) analyser.getFloatTimeDomainData(timeBuf);
      if (freqBuf) analyser.getByteFrequencyData(freqBuf);

      if (timeBuf && freqBuf && bandPlan) {
        const { rms, zcr } = computeRmsAndZcr(timeBuf);

        // калибровка шумового пола (первые cfg.calibrationMs)
        if (cfg.enableNoiseCalibration && calibUntil > 0 && now < calibUntil) {
          // EMA на шумовой пол
          noiseFloorRms = noiseFloorRms === 0 ? rms : noiseFloorRms * 0.9 + rms * 0.1;
        }

        const minRmsDynamic = Math.max(cfg.baseMinRms, noiseFloorRms + cfg.noiseMarginRms);

        // UI level: от шумового пола
        const lvl = clamp01((rms - Math.max(0, noiseFloorRms)) / 0.18);
        level.value = lvl;

        const { pitchHz, conf: pitchConfRaw } = estimatePitchConfidence(timeBuf, ctx.sampleRate);
        const bands = computeBandEnergiesPlanned(freqBuf, bandPlan);

        // EMA сглаживание фич (прод-стабильность)
        const a = clamp01(cfg.emaAlpha);

        emaRms = emaRms === 0 ? rms : emaRms * (1 - a) + rms * a;
        emaZcr = emaZcr === 0 ? zcr : emaZcr * (1 - a) + zcr * a;

        emaLow = emaLow === 0 ? bands.low : emaLow * (1 - a) + bands.low * a;
        emaMid = emaMid === 0 ? bands.mid : emaMid * (1 - a) + bands.mid * a;
        emaHigh = emaHigh === 0 ? bands.high : emaHigh * (1 - a) + bands.high * a;

        emaFlat = emaFlat === 0 ? bands.flatness : emaFlat * (1 - a) + bands.flatness * a;
        emaPitchConf =
          emaPitchConf === 0 ? pitchConfRaw : emaPitchConf * (1 - a) + pitchConfRaw * a;

        features.value = {
          rms: emaRms,
          zcr: emaZcr,
          low: emaLow,
          mid: emaMid,
          high: emaHigh,
          flatness: emaFlat,
          pitchHz,
          pitchConf: emaPitchConf,
          noiseFloorRms,
        };

        const cls = classifySound(
          {
            rms: emaRms,
            zcr: emaZcr,
            low: emaLow,
            mid: emaMid,
            high: emaHigh,
            flatness: emaFlat,
            pitchConf: emaPitchConf,
          },
          { minRms: minRmsDynamic }
        );

        const rawConf = clamp01(cls.confidence);

        // raw вывод (совместимость)
        if (cls.sound && rawConf >= cfg.minConfToReport) {
          detectedSound.value = cls.sound;
          confidence.value = rawConf;
        } else {
          detectedSound.value = null;
          confidence.value = 0;
        }

        // stable вывод
        updateStable(detectedSound.value, confidence.value);
        void dt;
      } else {
        resetOutputs();
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  async function start() {
    if (state.value === 'listening') return;

    cleanup();
    resetOutputs();
    errorMessage.value = '';
    state.value = 'idle';

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia недоступен в этом браузере/контексте.');
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: cfg.echoCancellation,
          noiseSuppression: cfg.noiseSuppression,
          autoGainControl: cfg.autoGainControl,
          channelCount: 1,
        },
      });

      // track ended -> error + cleanup
      const track = stream.getAudioTracks()[0];
      onEndedHandler = () => {
        if (state.value === 'listening') {
          state.value = 'error';
          errorMessage.value = 'Микрофон был отключён или стал недоступен.';
          cleanup();
          resetOutputs();
        }
      };
      if (track) {
        try {
          track.onended = onEndedHandler;
        } catch {}
      }

      ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {}
      }

      analyser = ctx.createAnalyser();
      analyser.fftSize = cfg.fftSize;
      analyser.smoothingTimeConstant = cfg.smoothingTimeConstant;

      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      timeBuf = new Float32Array(analyser.fftSize);
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
      bandPlan = makeBandPlan(freqBuf.length, ctx.sampleRate);

      state.value = 'listening';
      lastUpdate = 0;

      if (cfg.enableNoiseCalibration) {
        calibUntil = performance.now() + Math.max(0, cfg.calibrationMs);
      }

      rafId = requestAnimationFrame(tick);
    } catch (e) {
      cleanup();
      resetOutputs();
      state.value = 'error';
      errorMessage.value = e instanceof Error ? e.message : 'Не удалось включить микрофон.';
    }
  }

  function stop() {
    cleanup();
    resetOutputs();
    errorMessage.value = '';
    state.value = 'idle';
  }

  return {
    state,
    errorMessage,

    level,

    // raw (как раньше)
    detectedSound,
    confidence,

    // stable (для прод-гейта)
    stableDetectedSound,
    stableConfidence,

    // полезно для настройки в проде
    features,

    start,
    stop,
  };
}
