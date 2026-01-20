import { createI18n } from 'vue-i18n';

import ru from '../locales/ru.json';
import kz from '../locales/kz.json';
import en from '../locales/en.json';

export type AppLocale = 'ru' | 'kz' | 'en';

function safeDetectLocale(): AppLocale {
  try {
    const stored = localStorage.getItem('tilup_locale') as AppLocale | null;
    if (stored === 'ru' || stored === 'kz' || stored === 'en') return stored;
  } catch {
    // ignore
  }

  const nav = (navigator.language || 'ru').toLowerCase();
  if (nav.startsWith('kk') || nav.startsWith('kz')) return 'kz';
  if (nav.startsWith('en')) return 'en';
  return 'ru';
}

export const DEFAULT_LOCALE: AppLocale = safeDetectLocale();

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'ru',
  messages: {
    ru,
    kz,
    en,
  },
});

export function persistLocale(locale: AppLocale) {
  try {
    localStorage.setItem('tilup_locale', locale);
  } catch {
    // ignore
  }
}
