export type Sound = 'R' | 'L' | 'SH';
export type GameMode = 'target' | 'mixed';
export type Level = 1 | 2 | 3;

export type AnalyticsEvent =
  | {
      name: 'start_game';
      payload: {
        selectedSounds: Sound[];
        level: Level;
        mode: GameMode;
        roundSeconds: number;
        targetSound: Sound;
      };
    }
  | { name: 'pop_bubble'; payload: { sound: Sound; wasTarget: boolean } }
  | { name: 'enable_mic'; payload: { success: boolean; fallbackUsed: boolean } }
  | { name: 'book_diagnostics'; payload: { source: 'parents_cta' | 'hero_cta' | 'other' } };

export type AnalyticsReturn = {
  enabled: { value: boolean };
  setEnabled: (v: boolean) => void;
  track: <E extends AnalyticsEvent>(event: E) => void;
};
