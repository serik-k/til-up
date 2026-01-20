import { inject, provide } from 'vue';
import { useAudioLevel } from './useAudioLevel';

export type AudioLevelApi = ReturnType<typeof useAudioLevel>;

const AudioLevelKey: unique symbol = Symbol('TilUpAudioLevel');

export function provideAudioLevel(api: AudioLevelApi) {
  provide(AudioLevelKey, api);
}

export function useAudioLevelInjected(): AudioLevelApi | null {
  return inject<AudioLevelApi | null>(AudioLevelKey, null);
}
