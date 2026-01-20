import { computed, watchEffect } from 'vue';
import { useHead } from '@vueuse/head';
import type { Composer } from 'vue-i18n';

export function useSeo(i18n: Composer) {
  const title = computed(() => i18n.t('seo.title'));
  const description = computed(() => i18n.t('seo.description'));

  const locale = computed(() => String(i18n.locale.value || 'ru'));
  const lang = computed(() =>
    locale.value === 'kz' ? 'kk-KZ' : locale.value === 'en' ? 'en-US' : 'ru-RU'
  );

  // Текущий URL (для canonical/og:url)
  const url = computed(() => {
    try {
      return window.location.href;
    } catch {
      return '';
    }
  });

  watchEffect(() => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Til Up',
      url: url.value || undefined,
      sameAs: ['https://www.instagram.com/til_up_logoped?igsh=MXNxeWplNWF2cmpwNg=='],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          telephone: '+7-705-777-0777',
          availableLanguage: ['ru', 'kk', 'en'],
        },
      ],
    };

    useHead({
      htmlAttrs: {
        lang: lang.value,
      },
      title: title.value,
      meta: [
        { name: 'description', content: description.value },

        { property: 'og:title', content: title.value },
        { property: 'og:description', content: description.value },
        { property: 'og:type', content: 'website' },
        ...(url.value ? [{ property: 'og:url', content: url.value }] : []),

        { name: 'twitter:card', content: 'summary' },
      ],
      link: [...(url.value ? [{ rel: 'canonical', href: url.value }] : [])],
      script: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(jsonLd),
        },
      ],
    });
  });
}
