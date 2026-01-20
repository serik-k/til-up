<template>
  <div
    class="relative mx-auto max-w-[420px]"
    v-motion
    :initial="{ opacity: 0, y: 10 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 0.5 } }"
  >
    <div
      class="relative"
      v-motion
      :initial="{ y: 0, rotate: 0 }"
      :enter="{ y: [0, -6, 0], rotate: [0, -1.5, 0, 1.5, 0], transition: { duration: 2.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } }"
    >
      <!-- Soft 3D-ish mascot (cloud + cheek blush) -->
      <svg viewBox="0 0 520 360" class="w-full h-auto" role="img" aria-label="Til Up mascot">
        <defs>
          <linearGradient id="gBody" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#FFFFFF" />
            <stop offset="1" stop-color="#EAF6FF" />
          </linearGradient>
          <linearGradient id="gShadow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#2E2E38" stop-opacity="0.12" />
            <stop offset="1" stop-color="#2E2E38" stop-opacity="0" />
          </linearGradient>
          <filter id="fSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
            <feOffset dx="0" dy="12" result="off" />
            <feColorMatrix in="off" type="matrix" values="0 0 0 0 0.06  0 0 0 0 0.09  0 0 0 0 0.16  0 0 0 0.22 0" result="col" />
            <feMerge>
              <feMergeNode in="col" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Ground shadow -->
        <ellipse cx="260" cy="312" rx="170" ry="28" fill="url(#gShadow)" opacity="0.9" />

        <!-- Body -->
        <g filter="url(#fSoft)">
          <path
            d="M154 144c10-40 44-72 88-72 30 0 56 15 72 38 9-6 20-10 32-10 28 0 52 18 62 44 35 6 62 36 62 73 0 42-34 76-76 76H174c-44 0-80-36-80-80 0-38 26-70 60-79z"
            fill="url(#gBody)"
            stroke="#2E2E38"
            stroke-opacity="0.10"
            stroke-width="2"
          />

          <!-- Cheeks -->
          <ellipse cx="210" cy="232" rx="22" ry="14" fill="#FFD6E8" opacity="0.95" />
          <ellipse cx="310" cy="232" rx="22" ry="14" fill="#FFD6E8" opacity="0.95" />

          <!-- Eyes -->
          <circle cx="225" cy="210" r="10" fill="#2E2E38" opacity="0.85" />
          <circle cx="295" cy="210" r="10" fill="#2E2E38" opacity="0.85" />
          <circle cx="221" cy="206" r="3" fill="#FFFFFF" opacity="0.95" />
          <circle cx="291" cy="206" r="3" fill="#FFFFFF" opacity="0.95" />

          <!-- Smile -->
          <path d="M248 226c8 10 16 10 24 0" fill="none" stroke="#2E2E38" stroke-opacity="0.55" stroke-width="6" stroke-linecap="round" />

          <!-- Tiny star badge -->
          <g transform="translate(368 160)">
            <circle cx="44" cy="44" r="34" fill="#FFF1A8" opacity="0.95" />
            <path d="M44 20l6 16h17l-13 10 5 16-15-10-15 10 5-16-13-10h17z" fill="#7EC8FF" opacity="0.95" />
          </g>
        </g>

        <!-- Decorative bubbles -->
        <g opacity="0.75">
          <circle cx="92" cy="86" r="16" fill="#7EC8FF" />
          <circle cx="436" cy="88" r="12" fill="#FFD6E8" />
          <circle cx="460" cy="230" r="10" fill="#CFF5E7" />
          <circle cx="74" cy="224" r="10" fill="#FFF1A8" />
        </g>
      </svg>

      <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
        <span class="til-chip bg-blue-100">молодец</span>
        <span class="til-chip bg-pink-100">без ошибок</span>
        <span class="til-chip bg-mint-100">игра</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.til-chip {
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(46, 46, 56, 0.75);
  border: 1px solid rgba(46, 46, 56, 0.10);
}
</style>
