<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

type Item = {
  key: 'instagram' | 'whatsapp' | 'tiktok';
  title: string;
  subtitle: string;
  href: string;
};

const { t } = useI18n();

const items = computed<Item[]>(() => [
  {
    key: 'instagram',
    title: t('social.instagram'),
    subtitle: t('social.instagramHint'),
    href: 'https://www.instagram.com/',
  },
  {
    key: 'whatsapp',
    title: t('social.whatsapp'),
    subtitle: t('social.whatsappHint'),
    href: 'https://www.whatsapp.com/',
  },
  {
    key: 'tiktok',
    title: t('social.tiktok'),
    subtitle: t('social.tiktokHint'),
    href: 'https://www.tiktok.com/',
  },
]);

function iconPath(key: Item['key']) {
  if (key === 'instagram') {
    return 'M7 2C4.239 2 2 4.239 2 7v10c0 2.761 2.239 5 5 5h10c2.761 0 5-2.239 5-5V7c0-2.761-2.239-5-5-5H7zm0 2h10c1.657 0 3 1.343 3 3v10c0 1.657-1.343 3-3 3H7c-1.657 0-3-1.343-3-3V7c0-1.657 1.343-3 3-3zm11 1a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z';
  }
  if (key === 'whatsapp') {
    return 'M12 2a10 10 0 00-8.664 15.007L2 22l5.153-1.291A10 10 0 1012 2zm0 2a8 8 0 017.01 11.856l-.329.59.004.004-1.055 1.91-.62-.322a8.02 8.02 0 01-3.597 1.146l-.68.05a8 8 0 01-3.66-.89l-.56-.28-2.997.751.75-2.896-.29-.584A8 8 0 0112 4zm-3.2 4.9c-.2.02-.5.15-.72.38-.22.23-.8.78-.8 1.9 0 1.12.82 2.2.93 2.35.12.15 1.58 2.52 3.9 3.43 1.93.76 2.33.61 2.75.57.42-.04 1.36-.56 1.55-1.1.2-.54.2-1.01.14-1.1-.05-.1-.2-.15-.42-.26-.22-.11-1.36-.67-1.57-.75-.2-.08-.35-.11-.5.11-.15.22-.57.75-.7.9-.13.15-.26.17-.48.06-.22-.11-.93-.34-1.77-1.09-.66-.58-1.1-1.29-1.23-1.51-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.08-.15.04-.28-.02-.39-.06-.11-.5-1.26-.7-1.72-.17-.42-.36-.42-.5-.41z';
  }
  return 'M12.53.02C13.84 5.17 18 5.33 18 5.33v3.34s-2.73-.24-5.47-1.63V15.5a4.5 4.5 0 11-5.5-4.41V14.5a1.5 1.5 0 101.5 1.5v-16h3.53z';
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <a
      v-for="it in items"
      :key="it.key"
      :href="it.href"
      target="_blank"
      rel="noopener noreferrer"
      class="til-pill"
      :aria-label="t('social.openAria', { name: it.title })"
    >
      <span class="til-pill-icon" :class="`til-pill-icon--${it.key}`" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="size-5">
          <path :d="iconPath(it.key)" fill="currentColor" />
        </svg>
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-extrabold text-ink">{{ it.title }}</span>
        <span class="block text-xs text-ink/65">{{ it.subtitle }}</span>
      </span>
    </a>
  </div>
</template>

<style scoped>
.til-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 18px;
  padding: 12px 12px;
  min-height: 56px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(46, 46, 56, 0.1);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;
}

.til-pill:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.14);
}

.til-pill:active {
  transform: scale(0.99);
}

.til-pill-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  border-radius: 14px;
  border: 1px solid rgba(46, 46, 56, 0.1);
  flex-shrink: 0;
}

.til-pill-icon--instagram {
  background: linear-gradient(135deg, rgba(255, 214, 232, 0.95), rgba(126, 200, 255, 0.9));
  color: rgba(46, 46, 56, 0.8);
}

.til-pill-icon--whatsapp {
  background: linear-gradient(135deg, rgba(207, 245, 231, 0.95), rgba(126, 200, 255, 0.9));
  color: rgba(46, 46, 56, 0.8);
}

.til-pill-icon--tiktok {
  background: linear-gradient(135deg, rgba(255, 241, 168, 0.95), rgba(255, 214, 232, 0.9));
  color: rgba(46, 46, 56, 0.8);
}

.til-pill-arrow {
  margin-left: auto;
  font-weight: 900;
  color: rgba(46, 46, 56, 0.55);
}
</style>
