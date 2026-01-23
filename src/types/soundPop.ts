// ../types/soundPop.ts
export type Sound = 'R' | 'L' | 'SH';

export type GameMode = 'target' | 'mixed';
export type Level = 1 | 2 | 3;

export type Bubble = {
  id: string;
  x: number;
  y: number;
  vy: number;
  letter: Sound;
  word: string;

  alive: boolean;

  popped: boolean;

  removeAt: number | null;
  tf: string;
};

export type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  born: number;
  alpha: number;
  style: string; //
};

export type DetectorState = 'idle' | 'listening' | 'error';

export type DetectorFeatures = {
  transcriptRaw: string;
  token: string;
  isFinal: boolean;
  lang: string;
  matchedSound: Sound | null;
};

export type DetectorConfig = {
  lang: string;

  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  stableFrames: number;
  stableMinConf: number;

  words: Record<string, Record<Sound, string[]>>;
};
