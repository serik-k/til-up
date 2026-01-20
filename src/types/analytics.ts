export type AnalyticsEvent =
  | {
      name: 'start_game';
      payload: { selectedSounds: string[]; level: 1 | 2 | 3; mode: 'target' | 'mixed' };
    }
  | { name: 'pop_bubble'; payload: { sound: string; wasTarget: boolean } }
  | { name: 'enable_mic'; payload: { success: boolean; fallbackUsed: boolean } }
  | { name: 'book_diagnostics'; payload: { source: 'parents_cta' | 'hero_cta' | 'other' } };

export type AnalyticsReturn = {
  enabled: { value: boolean };
  setEnabled: (v: boolean) => void;
  track: <E extends AnalyticsEvent>(event: E) => void;
};
