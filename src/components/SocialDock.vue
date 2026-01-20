<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const links = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' },
  { key: 'whatsapp', label: 'WhatsApp', href: 'https://www.whatsapp.com/' },
  { key: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/' },
] as const;

function iconPath(key: (typeof links)[number]['key']) {
  if (key === 'instagram') {
    return 'M7 2C4.239 2 2 4.239 2 7v10c0 2.761 2.239 5 5 5h10c2.761 0 5-2.239 5-5V7c0-2.761-2.239-5-5-5H7zm0 2h10c1.657 0 3 1.343 3 3v10c0 1.657-1.343 3-3 3H7c-1.657 0-3-1.343-3-3V7c0-1.657 1.343-3 3-3zm11 1a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z';
  }
  if (key === 'whatsapp') {
    return 'M12 2a10 10 0 00-8.664 15.007L2 22l5.153-1.291A10 10 0 1012 2zm0 2a8 8 0 017.01 11.856l-.329.59.004.004-1.055 1.91-.62-.322a8.02 8.02 0 01-3.597 1.146l-.68.05a8 8 0 01-3.66-.89l-.56-.28-2.997.751.75-2.896-.29-.584A8 8 0 0112 4z';
  }
  return 'M12 2a10 10 0 00-3.08 19.52c-.02-.69-.01-1.53.17-2.22.19-.75 1.23-5.2 1.23-5.2s-.3-.6-.3-1.5c0-1.4.8-2.44 1.8-2.44.86 0 1.27.65 1.27 1.42 0 .87-.55 2.17-.84 3.38-.24 1.02.5 1.85 1.49 1.85 1.79 0 3-2.3 3-5.03 0-2.08-1.4-3.64-3.95-3.64-2.88 0-4.67 2.16-4.67 4.57 0 .83.25 1.41.65 1.87.18.2.2.29.14.53-.05.18-.16.63-.21.8-.07.26-.28.35-.52.25-.98-.4-1.44-1.46-1.44-2.66 0-2.97 1.66-5.66 6.18-5.66 3.64 0 6.04 2.64 6.04 5.48 0 3.75-2.08 6.56-5.15 6.56-1.04 0-2.02-.56-2.35-1.2 0 0-.56 2.25-.68 2.68-.2.7-.6 1.5-.96 2.08A10 10 0 1012 2z';
}
</script>

<template>
  <div class="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6">
    <div class="mx-auto max-w-[1120px]">
      <div
        class="rounded-3xl border border-ink/10 bg-white/75 backdrop-blur shadow-soft px-3 py-2 flex items-center justify-between gap-2"
        role="navigation"
        :aria-label="t('social.dockAria')"
      >
        <div class="min-w-0">
          <p class="text-xs font-extrabold text-ink">{{ t('social.dockTitle') }}</p>
          <p class="text-[11px] text-ink/60 truncate">{{ t('social.dockSubtitle') }}</p>
        </div>

        <div class="flex items-center gap-2">
          <a
            v-for="l in links"
            :key="l.key"
            class="til-dock-btn"
            :class="`til-dock-btn--${l.key}`"
            :href="l.href"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('social.openAria', { name: l.label })"
          >
            <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
              <path :d="iconPath(l.key)" fill="currentColor" />
            </svg>
            <span class="hidden sm:inline text-sm font-extrabold">{{ l.label }}</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shadow-soft {
  box-shadow:
    0 18px 44px rgba(15, 23, 42, 0.12),
    0 4px 16px rgba(15, 23, 42, 0.10);
}

.til-dock-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 20px;
  padding: 10px 12px;
  min-height: 44px;
  border: 1px solid rgba(46, 46, 56, 0.10);
  color: rgba(46, 46, 56, 0.85);
  font-weight: 900;
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.til-dock-btn:active {
  transform: scale(0.98);
}

.til-dock-btn--instagram {
  background: rgba(255, 214, 232, 0.55);
}

.til-dock-btn--whatsapp {
  background: rgba(207, 245, 231, 0.7);
}

.til-dock-btn--tiktok {
  background: rgba(191, 228, 255, 0.65);
}

.til-dock-btn:hover {
  box-shadow:
    0 14px 30px rgba(15, 23, 42, 0.10),
    0 2px 12px rgba(15, 23, 42, 0.08);
}
</style>
