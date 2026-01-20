import { ref } from 'vue';
import type { AnalyticsEvent, AnalyticsReturn } from '../types/analytics';

function safeLoadEnabled(): boolean {
  try {
    const raw = localStorage.getItem('tilup_analytics_enabled');
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    // ignore
  }
  return true;
}

export function useAnalytics(): AnalyticsReturn {
  const enabled = ref<boolean>(safeLoadEnabled());

  function setEnabled(v: boolean) {
    enabled.value = v;
    try {
      localStorage.setItem('tilup_analytics_enabled', v ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function track<E extends AnalyticsEvent>(event: E) {
    if (!enabled.value) return;

    const record = {
      ts: Date.now(),
      name: event.name,
      payload: event.payload,
    };

    // eslint-disable-next-line no-console
    console.log('[TilUp analytics]', record);
  }

  return {
    enabled,
    setEnabled,
    track,
  };
}
