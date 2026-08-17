<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHead } from '@vueuse/head';
import Mascot from '../components/Mascot.vue';
import SoundPopGame from '../components/SoundPopGame.vue';
import { APP_COPY, SEO_COPY, type Locale } from '../content';

function initialLocale(): Locale {
  try {
    if (new URLSearchParams(window.location.search).get('lang') === 'kz') return 'kz';
    return localStorage.getItem('tilup_locale') === 'kz' ? 'kz' : 'ru';
  } catch {
    return 'ru';
  }
}

const locale = ref<Locale>(initialLocale());
const copy = computed(() => APP_COPY[locale.value]);
const seo = computed(() => SEO_COPY[locale.value]);

const siteUrl = (() => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.href;
})();

const localeUrl = computed(() => {
  if (!siteUrl) return '';
  const url = new URL(siteUrl);
  if (locale.value === 'kz') url.searchParams.set('lang', 'kz');
  return url.href;
});

function languageUrl(next: Locale) {
  if (!siteUrl) return next === 'kz' ? '?lang=kz' : './';
  const url = new URL(siteUrl);
  if (next === 'kz') url.searchParams.set('lang', 'kz');
  return url.href;
}

const headData = computed(() => {
  const lang = locale.value === 'kz' ? 'kk' : 'ru';
  const ogLocale = locale.value === 'kz' ? 'kk_KZ' : 'ru_RU';
  const previewPath = locale.value === 'kz' ? '/images/speech-cards/goat-kz.png' : '/images/speech-cards/lion.png';
  const previewImage = siteUrl ? new URL(previewPath, siteUrl).href : '';

  return {
    htmlAttrs: { lang },
    title: seo.value.title,
    meta: [
      { name: 'description', content: seo.value.description },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { name: 'theme-color', content: '#fff7ed' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: ogLocale },
      { property: 'og:locale:alternate', content: locale.value === 'kz' ? 'ru_RU' : 'kk_KZ' },
      { property: 'og:site_name', content: 'Til Up' },
      { property: 'og:title', content: seo.value.title },
      { property: 'og:description', content: seo.value.description },
      ...(localeUrl.value ? [{ property: 'og:url', content: localeUrl.value }] : []),
      ...(previewImage ? [{ property: 'og:image', content: previewImage }] : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: seo.value.title },
      { name: 'twitter:description', content: seo.value.description },
      ...(previewImage ? [{ name: 'twitter:image', content: previewImage }] : []),
    ],
    link: localeUrl.value
      ? [
          { rel: 'canonical', href: localeUrl.value },
          { rel: 'alternate', hreflang: 'ru', href: languageUrl('ru') },
          { rel: 'alternate', hreflang: 'kk-KZ', href: languageUrl('kz') },
          { rel: 'alternate', hreflang: 'x-default', href: languageUrl('ru') },
        ]
      : [],
    script: localeUrl.value
      ? [{
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Til Up',
            url: localeUrl.value,
            description: seo.value.description,
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Any modern browser',
            inLanguage: lang,
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'KZT' },
            audience: { '@type': 'PeopleAudience', suggestedMinAge: 3, suggestedMaxAge: 9 },
          }),
        }]
      : [],
  };
});

useHead(headData);

function setLocale(next: Locale) {
  locale.value = next;
  try {
    localStorage.setItem('tilup_locale', next);
    window.history.replaceState({}, '', languageUrl(next));
  } catch {
    // Storage can be unavailable in privacy mode.
  }
}
</script>

<template>
  <div class="kids-app">
    <i class="shape shape-one" aria-hidden="true" />
    <i class="shape shape-two" aria-hidden="true" />

    <header class="topbar">
      <a class="brand" href="#top" :aria-label="copy.homeAria">
        <span class="brand-face" aria-hidden="true"><i /><i /><b /></span>
        <span><strong>Til Up</strong><small>{{ copy.brandHint }}</small></span>
      </a>

      <div class="lang-switch" aria-label="Тіл / Язык">
        <a :href="languageUrl('ru')" :class="{ active: locale === 'ru' }" :aria-current="locale === 'ru' ? 'page' : undefined" @click.prevent="setLocale('ru')">RU</a>
        <a :href="languageUrl('kz')" :class="{ active: locale === 'kz' }" :aria-current="locale === 'kz' ? 'page' : undefined" @click.prevent="setLocale('kz')">KZ</a>
      </div>
    </header>

    <main id="top">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow"><span aria-hidden="true">●</span> {{ copy.eyebrow }}</p>
          <h1 id="hero-title">{{ copy.heroLine }}<br /><em>{{ copy.heroAccent }}</em></h1>
          <p class="hero-text">{{ copy.heroText }}</p>
          <a class="hero-button" href="#play">{{ copy.start }} <span aria-hidden="true">↓</span></a>
          <div class="hero-steps" :aria-label="copy.stepsAria">
            <span v-for="(step, index) in copy.steps" :key="step"><b>{{ index + 1 }}</b> {{ step }}</span>
          </div>
        </div>

        <div class="hero-mascot" :aria-label="copy.mascotAria"><Mascot /></div>
      </section>

      <section id="play" class="play-section" aria-labelledby="play-title">
        <div class="section-heading">
          <p class="eyebrow"><span aria-hidden="true">●</span> {{ copy.exerciseEyebrow }}</p>
          <h2 id="play-title">{{ copy.exerciseTitle }}</h2>
          <p>{{ copy.exerciseText }}</p>
        </div>
        <SoundPopGame :locale="locale" />
      </section>
    </main>

    <footer>
      <span aria-hidden="true">★</span>
      <p><strong>Til Up</strong> {{ copy.footer }}</p>
      <p>{{ copy.disclaimer }}</p>
    </footer>
  </div>
</template>

<style scoped>
.kids-app{--ink:#25345b;--muted:#687596;position:relative;min-height:100vh;overflow:hidden;color:var(--ink);background:radial-gradient(circle at 8% 5%,rgba(255,225,138,.5),transparent 25rem),radial-gradient(circle at 92% 16%,rgba(181,225,255,.65),transparent 28rem),linear-gradient(180deg,#fffaf1 0%,#f6fbff 52%,#fff8ee 100%)}
.topbar,.hero,.play-section,footer{position:relative;z-index:2;width:min(1160px,calc(100% - 32px));margin-inline:auto}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:22px}.brand{display:inline-flex;align-items:center;gap:12px;color:inherit;text-decoration:none}.brand strong,.brand small{display:block}.brand strong{font-size:1.45rem;line-height:1;font-weight:950;letter-spacing:-.04em}.brand small{margin-top:4px;color:var(--muted);font-size:.72rem;font-weight:750}
.brand-face{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;width:48px;height:48px;border:2px solid rgba(37,52,91,.08);border-radius:18px;background:linear-gradient(145deg,#ffd45e,#ff9f78);box-shadow:0 10px 22px rgba(245,139,102,.22)}.brand-face i{width:5px;height:7px;margin-top:-5px;border-radius:99px;background:var(--ink)}.brand-face b{position:absolute;bottom:11px;width:16px;height:8px;border-bottom:3px solid var(--ink);border-radius:0 0 20px 20px}
.lang-switch{display:flex;gap:4px;padding:4px;border:1px solid rgba(37,52,91,.09);border-radius:16px;background:rgba(255,255,255,.7);box-shadow:0 8px 22px rgba(55,71,115,.08)}.lang-switch a{display:grid;min-width:43px;min-height:38px;place-items:center;border-radius:12px;color:var(--muted);font-size:.75rem;font-weight:950;text-decoration:none;transition:background .16s ease,transform .16s ease}.lang-switch a:hover{transform:translateY(-1px)}.lang-switch a.active{color:#fff;background:#ff806c;box-shadow:0 6px 14px rgba(255,128,108,.25)}
.hero{display:grid;grid-template-columns:minmax(0,1.03fr) minmax(350px,.97fr);align-items:center;gap:54px;min-height:650px;padding-block:38px 72px}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:#ef7f69;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.eyebrow span{font-size:.65rem}h1{max-width:720px;margin-top:18px;font-size:clamp(3.15rem,7vw,6.6rem);line-height:.91;font-weight:950;letter-spacing:-.075em}h1 em{color:#ff806c;font-style:normal}.hero-text{max-width:560px;margin-top:25px;color:var(--muted);font-size:clamp(1rem,2vw,1.18rem);line-height:1.65;font-weight:650}
.hero-button{display:inline-flex;align-items:center;justify-content:center;gap:14px;min-height:58px;margin-top:30px;padding:14px 24px;border:2px solid rgba(37,52,91,.08);border-radius:22px;color:#fff;background:linear-gradient(135deg,#ff8a73,#ff6d75);box-shadow:0 16px 34px rgba(255,109,117,.28);font-weight:900;text-decoration:none;transition:transform .16s ease}.hero-button:hover{transform:translateY(-3px)}.hero-steps{display:flex;flex-wrap:wrap;gap:12px 20px;margin-top:26px;color:var(--muted);font-size:.78rem;font-weight:800}.hero-steps span{display:inline-flex;align-items:center;gap:7px}.hero-steps b{display:grid;width:25px;height:25px;place-items:center;border-radius:9px;background:#fff;box-shadow:0 5px 15px rgba(55,71,115,.1);font-size:.68rem}
.hero-mascot{position:relative;max-width:560px;padding:40px 20px 10px}.hero-mascot:before{position:absolute;inset:12% 2% 5%;z-index:-1;border-radius:45% 55% 48% 52%;background:linear-gradient(145deg,rgba(206,236,255,.85),rgba(255,222,228,.7));content:'';transform:rotate(-5deg)}
.play-section{padding-block:70px 90px}.section-heading{max-width:720px;margin:0 auto 30px;text-align:center}.section-heading h2{margin-top:12px;font-size:clamp(2rem,5vw,3.35rem);line-height:1.03;font-weight:950;letter-spacing:-.055em}.section-heading>p:last-child{margin-top:13px;color:var(--muted);font-weight:650}footer{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 18px;padding-block:25px 34px;border-top:1px solid rgba(37,52,91,.08);color:var(--muted);font-size:.78rem;text-align:center}footer>span{color:#f2b84b}footer p:last-child{opacity:.72}
.shape{position:absolute;z-index:1;border-radius:999px;opacity:.7}.shape-one{top:190px;left:-50px;width:110px;height:110px;background:#dff3dc}.shape-two{top:480px;right:-65px;width:150px;height:150px;background:#ffe6ab}
@media(max-width:820px){.hero{grid-template-columns:1fr;gap:18px;padding-top:50px;text-align:center}.hero-copy{display:flex;flex-direction:column;align-items:center;min-width:0;width:100%}.hero-mascot{width:min(100%,520px);margin-inline:auto}}
@media(max-width:560px){.topbar,.hero,.play-section,footer{width:min(100% - 22px,1160px)}.hero{min-height:auto;padding-top:34px;padding-bottom:46px}h1{width:100%;max-width:100%;font-size:clamp(2.45rem,11.5vw,3.4rem);letter-spacing:-.055em}.hero-text{max-width:100%;font-size:.9rem}.hero-steps{display:grid;grid-template-columns:1fr;justify-items:start;width:max-content;max-width:100%;margin-inline:auto}.hero-mascot{width:100%;padding-inline:0}.play-section{padding-block:56px 68px}}
@media(prefers-reduced-motion:reduce){.hero-button,.lang-switch a{transition:none}}
</style>
