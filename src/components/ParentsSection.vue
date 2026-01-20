<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AppLocale } from '../app/i18n';
import CloudCTA from './CloudCTA.vue';

const props = defineProps<{
  reducedMotion: boolean;
  analyticsEnabled: boolean;
  locale: AppLocale;
}>();

const emit = defineEmits<{
  (e: 'toggleReducedMotion', v: boolean): void;
  (e: 'toggleAnalytics', v: boolean): void;
  (e: 'changeLocale', v: AppLocale): void;
  (e: 'book'): void;
}>();

const { t } = useI18n();

const instagram = 'https://www.instagram.com/til_up_logoped?igsh=MXNxeWplNWF2cmpwNg==';
const whatsapp = '87057770777';

function openInstagram() {
  window.open(instagram, '_blank', 'noopener,noreferrer');
}

function openWhatsApp() {
  const url = `https://wa.me/${whatsapp}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <section class="mt-8">
    <div
      class="rounded-3xl border border-ink/10 shadow-2xl bg-white/70 backdrop-blur-md p-6 sm:p-8"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight text-ink">{{ t('parents.title') }}</h2>
          <p class="mt-2 text-sm text-ink/65 max-w-[70ch]">
            {{ t('parents.intro') }}
          </p>
        </div>

        <div class="flex flex-col gap-3 items-end">
          <label class="inline-flex items-center gap-2 text-sm text-ink/70 select-none">
            <input
              type="checkbox"
              class="size-5 accent-ink"
              :checked="reducedMotion"
              @change="emit('toggleReducedMotion', ($event.target as HTMLInputElement).checked)"
              :aria-label="t('parents.reducedMotion')"
            />
            {{ t('parents.reducedMotion') }}
          </label>

          <label class="inline-flex items-center gap-2 text-sm text-ink/70 select-none">
            <input
              type="checkbox"
              class="size-5 accent-ink"
              :checked="analyticsEnabled"
              @change="emit('toggleAnalytics', ($event.target as HTMLInputElement).checked)"
              :aria-label="t('parents.analytics')"
            />
            {{ t('parents.analytics') }}
          </label>

          <div class="flex items-center gap-2">
            <span class="text-sm text-ink/70">{{ t('parents.language') }}:</span>
            <select
              class="rounded-3xl border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink shadow"
              :value="locale"
              @change="
                emit('changeLocale', ($event.target as HTMLSelectElement).value as AppLocale)
              "
              aria-label="Language"
            >
              <option value="ru">RU</option>
              <option value="kz">KZ</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-3xl border border-ink/10 bg-white p-5">
          <h3 class="text-base font-bold text-ink">{{ t('parents.methodTitle') }}</h3>
          <ul class="mt-2 text-sm text-ink/65 space-y-1">
            <li>• {{ t('parents.method1') }}</li>
            <li>• {{ t('parents.method2') }}</li>
            <li>• {{ t('parents.method3') }}</li>
          </ul>
        </div>

        <div class="rounded-3xl border border-ink/10 bg-white p-5">
          <h3 class="text-base font-bold text-ink">{{ t('parents.diagTitle') }}</h3>
          <ol class="mt-2 text-sm text-ink/65 space-y-1 list-decimal list-inside">
            <li>{{ t('parents.diag1') }}</li>
            <li>{{ t('parents.diag2') }}</li>
            <li>{{ t('parents.diag3') }}</li>
          </ol>
        </div>

        <div class="rounded-3xl border border-ink/10 bg-white p-5">
          <h3 class="text-base font-bold text-ink">{{ t('parents.privacyTitle') }}</h3>
          <p class="mt-2 text-sm text-ink/65">
            {{ t('parents.privacyText') }}
          </p>
        </div>

        <div class="rounded-3xl border border-ink/10 bg-white p-5">
          <h3 class="text-base font-bold text-ink">{{ t('parents.contactsTitle') }}</h3>
          <div class="mt-3 flex flex-wrap gap-3">
            <CloudCTA
              :label="t('parents.instagram')"
              kind="secondary"
              :aria-label="t('parents.instagram')"
              @press="openInstagram"
            />
            <CloudCTA
              :label="t('parents.whatsapp')"
              kind="primary"
              :aria-label="t('parents.whatsapp')"
              @press="openWhatsApp"
            />
          </div>
          <p class="mt-3 text-xs text-ink/50">
            WhatsApp: <a class="underline" :href="`tel:${whatsapp}`">{{ whatsapp }}</a>
          </p>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-3 items-center justify-between">
        <div class="rounded-3xl bg-sunny/60 border border-ink/10 px-4 py-3">
          <p class="text-sm font-semibold text-ink">{{ t('parents.readyTitle') }}</p>
          <p class="text-xs text-ink/60">{{ t('parents.readyText') }}</p>
        </div>
        <CloudCTA :label="t('parents.book')" kind="primary" @press="emit('book')" />
      </div>
    </div>
  </section>
</template>
