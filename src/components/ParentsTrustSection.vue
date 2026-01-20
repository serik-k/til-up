<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{ (e: 'book-diagnostics'): void }>();

const { t } = useI18n();

const cards = computed(() => [
  { icon: '🎓', title: t('parents.card1Title'), text: t('parents.card1Text') },
  { icon: '🔒', title: t('parents.card2Title'), text: t('parents.card2Text') },
  { icon: '⏱', title: t('parents.card3Title'), text: t('parents.card3Text') },
  { icon: '📈', title: t('parents.card4Title'), text: t('parents.card4Text') },
]);

function book() {
  emit('book-diagnostics');
}
</script>

<template>
  <section class="mt-10 sm:mt-14" aria-labelledby="parents-title">
    <div class="rounded-3xl bg-white border border-ink/10 shadow-soft overflow-hidden">
      <div class="relative px-5 py-8 sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -top-10 -right-12 size-72 rounded-full bg-blue-300/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-12 -left-14 size-72 rounded-full bg-pink-300/20 blur-3xl"
        />

        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div class="max-w-[60ch]">
            <h2
              id="parents-title"
              class="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"
            >
              {{ t('parents.title') }}
            </h2>
            <p class="mt-3 text-ink/70 leading-relaxed">
              {{ t('parents.subtitle') }}
            </p>

            <div
              class="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-100 border border-ink/10 px-4 py-2"
            >
              <span class="size-2.5 rounded-full bg-mint-300" aria-hidden="true" />
              <p class="text-xs font-semibold text-ink/70">{{ t('parents.safetyNote') }}</p>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <a
              class="til-btn-secondary"
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t('parents.socialAria', { name: t('social.instagram') })"
            >
              {{ t('parents.ctaInstagram') }}
            </a>

            <button
              type="button"
              class="til-btn-primary"
              @click="book"
              :aria-label="t('parents.bookAria')"
            >
              {{ t('parents.ctaBook') }}
            </button>
          </div>
        </div>

        <div class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="c in cards" :key="c.title" class="til-card">
            <div class="til-card-icon" aria-hidden="true">{{ c.icon }}</div>
            <p class="mt-3 font-extrabold text-ink">{{ c.title }}</p>
            <p class="mt-2 text-sm text-ink/70 leading-relaxed">{{ c.text }}</p>
          </div>
        </div>

        <div
          class="mt-8 rounded-3xl bg-gradient-to-br from-blue-100 via-white to-pink-100 border border-ink/10 p-5 sm:p-6"
        >
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="max-w-[62ch]">
              <p class="text-lg font-extrabold text-ink">{{ t('parents.bottomTitle') }}</p>
              <p class="mt-1 text-sm text-ink/70">{{ t('parents.bottomText') }}</p>
            </div>
            <div class="flex gap-2">
              <a
                class="til-btn-soft til-btn-soft--wa"
                href="https://www.whatsapp.com/"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="t('parents.socialAria', { name: t('social.whatsapp') })"
              >
                WhatsApp
              </a>
              <a
                class="til-btn-soft til-btn-soft--tt"
                href="https://www.tiktok.com/"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="t('parents.socialAria', { name: t('social.tiktok') })"
              >
                TikTok
              </a>
            </div>
          </div>
        </div>

        <p class="mt-4 text-xs text-ink/55">
          {{ t('parents.disclaimer') }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.shadow-soft {
  box-shadow:
    0 24px 70px rgba(15, 23, 42, 0.1),
    0 6px 20px rgba(15, 23, 42, 0.08);
}

.til-card {
  border-radius: 22px;
  border: 1px solid rgba(46, 46, 56, 0.1);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  padding: 16px;
}

.til-card-icon {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(126, 200, 255, 0.25);
  border: 1px solid rgba(46, 46, 56, 0.1);
  font-size: 20px;
}

.til-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  padding: 14px 18px;
  min-height: 52px;
  font-weight: 900;
  background: linear-gradient(135deg, rgba(126, 200, 255, 0.9), rgba(255, 214, 232, 0.95));
  border: 1px solid rgba(46, 46, 56, 0.12);
  color: rgba(46, 46, 56, 0.95);
  box-shadow:
    0 12px 32px rgba(126, 200, 255, 0.2),
    0 10px 26px rgba(255, 214, 232, 0.2);
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;
}

.til-btn-primary:active {
  transform: scale(0.98);
}

.til-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  padding: 14px 18px;
  min-height: 52px;
  font-weight: 900;
  background: rgba(234, 246, 255, 0.85);
  border: 1px solid rgba(46, 46, 56, 0.1);
  color: rgba(46, 46, 56, 0.85);
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;
}

.til-btn-secondary:active {
  transform: scale(0.98);
}

.til-btn-soft {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  padding: 12px 14px;
  min-height: 48px;
  font-weight: 900;
  border: 1px solid rgba(46, 46, 56, 0.1);
  background: rgba(255, 255, 255, 0.8);
  transition: transform 140ms ease;
}

.til-btn-soft:active {
  transform: scale(0.98);
}

.til-btn-soft--wa {
  box-shadow: 0 14px 26px rgba(126, 200, 255, 0.18);
}

.til-btn-soft--tt {
  box-shadow: 0 14px 26px rgba(255, 214, 232, 0.18);
}
</style>
