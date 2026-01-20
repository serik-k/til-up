import { inject, provide } from 'vue';
// Важно: нужен value-import, т.к. мы используем typeof useAudioLevel в ReturnType.
import { useAudioLevel } from './useAudioLevel';

export type AudioLevelApi = ReturnType<typeof useAudioLevel>;

const AudioLevelKey: unique symbol = Symbol('TilUpAudioLevel');

export function provideAudioLevel(api: AudioLevelApi) {
  provide(AudioLevelKey, api);
}

export function useAudioLevelInjected(): AudioLevelApi | null {
  return inject<AudioLevelApi | null>(AudioLevelKey, null);
}
