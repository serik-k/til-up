export type Sound = 'R' | 'L' | 'SH';

export type GameMode = 'target' | 'mixed';
export type Level = 1 | 2 | 3;

export type Bubble = {
  id: string;
  x: number; // 0..1
  y: number; // px
  vy: number; // px/s
  letter: Sound;
  alive: boolean;

  popped: boolean;
  smile: boolean;

  removeAt: number | null; // ms timestamp
  tf: string; // cached transform style
};

export type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // ms
  born: number; // ms
  alpha: number; // 0..1
  style: string; // cached style (transform+opacity)
};

export type DetectorState = 'idle' | 'listening' | 'error';

export type DetectorFeatures = {
  rms: number;
  zcr: number;
  low: number;
  mid: number;
  high: number;
  flatness: number;
  pitchHz: number;
  pitchConf: number;
  noiseFloorRms: number;
};

export type DetectorConfig = {
  fps: number; // частота обновления анализа
  fftSize: 1024 | 2048 | 4096;
  smoothingTimeConstant: number;

  // getUserMedia
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;

  // калибровка шума
  enableNoiseCalibration: boolean;
  calibrationMs: number;
  noiseMarginRms: number;

  // гейты
  baseMinRms: number; // абсолютный минимум (даже если noiseFloor маленький)
  minConfToReport: number; // минимальная уверенность, чтобы вообще репортить звук (raw)

  // стабилизация (stable*)
  stableFrames: number;
  stableMinConf: number;

  // EMA сглаживание фич
  emaAlpha: number; // 0..1, больше = быстрее реагирует, меньше = стабильнее
};
