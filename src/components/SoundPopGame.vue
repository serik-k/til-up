<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { CARD_SETS, GAME_COPY, type Locale, type SoundKey } from '../content';
import { useSpeechRecognition } from '../composables/useSpeechRecognition';

const props = defineProps<{ locale: Locale }>();

type Phase = 'ready' | 'playing' | 'celebrating' | 'complete';
type GameStats = { sessions: number; words: number; bySound: Record<SoundKey, number> };

const goal = 5;
const statsKey = 'tilup_game_stats_v1';
const phase = ref<Phase>('ready');
const selectedSound = ref<SoundKey>('L');
const progress = ref(0);
const cardRound = ref(0);
const feedback = ref('');
const actionLocked = ref(false);
let celebrationTimer: ReturnType<typeof setTimeout> | null = null;
let lastVoiceMatchAt = 0;

function emptyStats(): GameStats {
  return { sessions: 0, words: 0, bySound: { L: 0, R: 0, SH: 0 } };
}

function loadStats(): GameStats {
  try {
    const stored = JSON.parse(localStorage.getItem(statsKey) || 'null');
    if (!stored || typeof stored !== 'object') return emptyStats();
    return {
      sessions: Number.isFinite(stored.sessions) ? Math.max(0, stored.sessions) : 0,
      words: Number.isFinite(stored.words) ? Math.max(0, stored.words) : 0,
      bySound: {
        L: Number.isFinite(stored.bySound?.L) ? Math.max(0, stored.bySound.L) : 0,
        R: Number.isFinite(stored.bySound?.R) ? Math.max(0, stored.bySound.R) : 0,
        SH: Number.isFinite(stored.bySound?.SH) ? Math.max(0, stored.bySound.SH) : 0,
      },
    };
  } catch {
    return emptyStats();
  }
}

const stats = ref<GameStats>(loadStats());
const copy = computed(() => GAME_COPY[props.locale]);
const cardDecks = computed(() => CARD_SETS[props.locale]);
const activeDeck = computed(() => cardDecks.value[selectedSound.value]);
const activeCard = computed(() => activeDeck.value[cardRound.value % activeDeck.value.length]);
const speechLang = computed(() => (props.locale === 'kz' ? 'kk-KZ' : 'ru-RU'));

const speech = useSpeechRecognition({
  lang: speechLang,
  autoRestart: true,
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  onFinal: (text) => handleSpeech(text),
  onInterim: (text) => handleSpeech(text),
});

const statusText = computed(() => {
  if (phase.value === 'complete') return copy.value.complete;
  if (phase.value === 'celebrating') return copy.value.heard;
  if (phase.value === 'ready') return copy.value.ready;
  return copy.value.namePicture;
});

const micText = computed(() => {
  if (speech.state.value === 'unsupported') return copy.value.micUnsupported;
  if (speech.state.value === 'listening') return copy.value.micListening;
  if (speech.state.value === 'starting') return copy.value.micStarting;
  if (speech.state.value === 'error') {
    if (speech.errorMessage.value === 'permission_denied') return copy.value.micPermission;
    if (speech.errorMessage.value === 'audio_capture') return copy.value.micNoDevice;
    if (speech.errorMessage.value === 'network') return copy.value.micNetwork;
    if (speech.errorMessage.value === 'in_app_browser_audio_blocked' || speech.errorMessage.value === 'unstable_recognition') return copy.value.micBrowser;
    return copy.value.micError;
  }
  return copy.value.micIdle;
});

const manualFallback = computed(() =>
  speech.state.value === 'unsupported' || speech.state.value === 'error',
);

function saveStats(completedSession: boolean) {
  const sound = selectedSound.value;
  stats.value = {
    sessions: stats.value.sessions + (completedSession ? 1 : 0),
    words: stats.value.words + 1,
    bySound: { ...stats.value.bySound, [sound]: stats.value.bySound[sound] + 1 },
  };
  try {
    localStorage.setItem(statsKey, JSON.stringify(stats.value));
  } catch {
    // The game continues when storage is unavailable.
  }
}

function resetStats() {
  stats.value = emptyStats();
  try {
    localStorage.removeItem(statsKey);
  } catch {
    // The in-memory counters are still reset.
  }
}

function normalizedWords(value: string): string[] {
  const matches = String(value || '')
    .toLocaleLowerCase(props.locale === 'kz' ? 'kk-KZ' : 'ru-RU')
    .replace(/ё/g, 'е')
    .match(/[\p{L}]+/gu);
  return matches ? [...matches] : [];
}

function handleSpeech(text: string) {
  if (phase.value !== 'playing' || actionLocked.value) return;
  const expected = normalizedWords(activeCard.value.name)[0];
  if (!expected || !normalizedWords(text).includes(expected)) return;

  const now = Date.now();
  if (now - lastVoiceMatchAt < 900) return;
  lastVoiceMatchAt = now;
  completeTurn();
}

function clearCelebrationTimer() {
  if (celebrationTimer) clearTimeout(celebrationTimer);
  celebrationTimer = null;
}

function selectSound(sound: SoundKey) {
  if (phase.value === 'celebrating') return;
  selectedSound.value = sound;
  stopSession();
}

async function startSession() {
  clearCelebrationTimer();
  progress.value = 0;
  cardRound.value = 0;
  feedback.value = '';
  actionLocked.value = false;
  phase.value = 'playing';
  if (speech.supported()) await speech.start();
}

function stopSession() {
  clearCelebrationTimer();
  speech.stop();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  phase.value = 'ready';
  progress.value = 0;
  cardRound.value = 0;
  feedback.value = '';
  actionLocked.value = false;
}

function completeTurn() {
  if (phase.value !== 'playing' || actionLocked.value) return;
  actionLocked.value = true;
  phase.value = 'celebrating';
  feedback.value = copy.value.repeat;
  progress.value += 1;
  saveStats(progress.value >= goal);

  clearCelebrationTimer();
  celebrationTimer = setTimeout(() => {
    if (progress.value >= goal) {
      phase.value = 'complete';
      speech.stop();
    } else {
      cardRound.value += 1;
      phase.value = 'playing';
    }
    feedback.value = '';
    actionLocked.value = false;
  }, 920);
}

function speakExample() {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(activeCard.value.name);
  phrase.lang = speechLang.value;
  phrase.rate = 0.78;
  phrase.pitch = 1.08;
  window.speechSynthesis.speak(phrase);
}

function burstStyle(index: number) {
  return {
    '--angle': `${index * 30}deg`,
    '--distance': `${118 + (index % 3) * 22}px`,
    '--delay': `${(index % 4) * 18}ms`,
    '--particle-color': ['#ff806c', '#ffd258', '#55c9b9', '#63b4ed'][index % 4],
  };
}

watch(() => props.locale, stopSession);
onBeforeUnmount(() => {
  clearCelebrationTimer();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
});
</script>

<template>
  <div class="game-shell">
    <div class="sound-picker" :aria-label="copy.soundPicker">
      <button
        v-for="(deck, key) in cardDecks"
        :key="key"
        type="button"
        class="sound-button"
        :class="{ active: selectedSound === key }"
        :style="{ '--sound-color': deck[0].color, '--sound-soft': deck[0].softColor }"
        :aria-pressed="selectedSound === key"
        :aria-label="`${copy.chooseSound} ${deck[0].letter}`"
        @click="selectSound(key as SoundKey)"
      >
        <b>{{ deck[0].letter }}</b>
        <span>{{ deck[0].stretch }}</span>
      </button>
    </div>

    <section
      class="game-card"
      :style="{ '--active-color': activeCard.color, '--active-soft': activeCard.softColor }"
      :aria-label="`${copy.trainSound} ${activeCard.letter}`"
    >
      <header class="game-topline">
        <div>
          <span>{{ copy.trainSound }}</span>
          <strong>{{ activeCard.letter }}</strong>
        </div>
        <div class="star-track" :aria-label="`${copy.starsAria}: ${progress} / ${goal}`">
          <i v-for="star in goal" :key="star" :class="{ earned: star <= progress }" aria-hidden="true">★</i>
        </div>
      </header>

      <div class="game-layout">
        <aside class="tongue-tip">
          <span aria-hidden="true">👅</span>
          <div><b>{{ copy.tongueHint }}</b><p>{{ activeCard.tongueTip }}</p></div>
        </aside>

        <div class="play-zone">
          <p class="game-status" aria-live="polite">{{ statusText }}</p>

          <div v-if="phase !== 'complete'" class="picture-stage" :class="{ celebrating: phase === 'celebrating' }">
            <button
              :key="`${props.locale}-${selectedSound}-${cardRound}`"
              type="button"
              class="picture-bubble"
              :class="{ 'bubble-pop': phase === 'celebrating' }"
              :disabled="phase !== 'playing' || !manualFallback"
              :aria-label="manualFallback
                ? `${copy.pictureAria}: ${activeCard.name}. ${copy.pictureAction}`
                : `${copy.pictureAria}: ${activeCard.name}. ${copy.sayPicture}`"
              @click="completeTurn"
            >
              <span class="bubble-shine" aria-hidden="true" />
              <img v-if="activeCard.image" :src="activeCard.image" :alt="activeCard.name" width="320" height="320" draggable="false" />
              <span v-else class="card-emoji" aria-hidden="true">{{ activeCard.emoji }}</span>
            </button>

            <div v-if="phase === 'celebrating'" class="burst-fx" aria-hidden="true">
              <span class="burst-ring burst-ring-one" />
              <span class="burst-ring burst-ring-two" />
              <i v-for="particle in 12" :key="particle" class="burst-particle" :style="burstStyle(particle - 1)" />
            </div>

            <strong class="picture-name">{{ activeCard.name }}</strong>
            <p v-if="feedback" class="feedback" aria-live="polite">{{ feedback }}</p>
          </div>

          <div v-else class="finish-card" role="status">
            <span aria-hidden="true">🌟</span>
            <h3>{{ copy.finishTitle }}</h3>
            <p>{{ copy.finishText }}</p>
            <button type="button" @click="startSession">{{ copy.again }}</button>
          </div>

          <template v-if="phase === 'ready'">
            <button type="button" class="start-button" @click="startSession">{{ copy.start }}</button>
          </template>
          <template v-else-if="phase !== 'complete'">
            <button type="button" class="listen-button" @click="speakExample"><span aria-hidden="true">🔊</span> {{ copy.listen }}</button>
            <p class="mic-status" :class="speech.state.value"><span aria-hidden="true">●</span> {{ micText }}</p>
            <p v-if="manualFallback" class="tap-hint">{{ copy.tapHint }}</p>
          </template>
        </div>
      </div>

      <p class="game-note"><strong>{{ copy.noteStrong }}</strong> {{ copy.note }}</p>
    </section>

    <aside class="parent-stats" :aria-label="copy.statsTitle">
      <div><strong>{{ copy.statsTitle }}</strong><span>{{ copy.statsSessions }}: {{ stats.sessions }}</span><span>{{ copy.statsWords }}: {{ stats.words }}</span></div>
      <div class="sound-stats" aria-hidden="true"><span>Л · {{ stats.bySound.L }}</span><span>Р · {{ stats.bySound.R }}</span><span>Ш · {{ stats.bySound.SH }}</span></div>
      <button v-if="stats.words" type="button" @click="resetStats">{{ copy.statsReset }}</button>
    </aside>
  </div>
</template>

<style scoped>
.game-shell{width:min(980px,100%);margin-inline:auto}.sound-picker{display:flex;justify-content:center;gap:12px;margin-bottom:18px}.sound-button{display:flex;align-items:center;gap:10px;min-width:114px;padding:10px 16px;border:2px solid transparent;border-radius:19px;color:#526080;background:rgba(255,255,255,.78);box-shadow:0 8px 24px rgba(49,65,105,.09);transition:transform .18s ease,border-color .18s ease,background .18s ease}.sound-button:hover{transform:translateY(-2px)}.sound-button b{display:grid;width:36px;height:36px;place-items:center;border-radius:12px;color:var(--sound-color);background:var(--sound-soft);font-size:1.3rem;font-weight:950}.sound-button span{font-size:.7rem;font-weight:900}.sound-button.active{border-color:var(--sound-color);background:#fff;transform:translateY(-3px);box-shadow:0 12px 28px color-mix(in srgb,var(--sound-color) 22%,transparent)}
.game-card{overflow:hidden;border:1px solid rgba(37,52,91,.09);border-radius:36px;background:rgba(255,255,255,.78);box-shadow:0 28px 70px rgba(57,75,118,.13);backdrop-filter:blur(16px)}.game-topline{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:19px 25px;border-bottom:1px solid rgba(37,52,91,.07);background:linear-gradient(90deg,var(--active-soft),rgba(255,255,255,.7))}.game-topline>div:first-child{display:flex;align-items:center;gap:9px;color:#687596;font-size:.75rem;font-weight:850}.game-topline strong{display:grid;width:37px;height:37px;place-items:center;border-radius:12px;color:#fff;background:var(--active-color);font-size:1.2rem}.star-track{display:flex;gap:5px}.star-track i{color:#dfe5ef;font-size:1.24rem;font-style:normal;transition:color .2s ease,transform .3s cubic-bezier(.2,1.8,.4,1)}.star-track i.earned{color:#ffc94f;transform:scale(1.2) rotate(8deg);text-shadow:0 4px 10px rgba(255,190,50,.35)}
.game-layout{display:grid;grid-template-columns:210px minmax(0,1fr);min-height:570px}.tongue-tip{display:flex;align-items:flex-start;gap:11px;padding:28px 22px;border-right:1px solid rgba(37,52,91,.07);color:#687596;background:rgba(255,250,241,.6)}.tongue-tip>span{display:grid;flex:0 0 auto;width:42px;height:42px;place-items:center;border-radius:14px;background:#fff;box-shadow:0 7px 20px rgba(57,75,118,.08)}.tongue-tip b{display:block;margin-top:3px;color:#25345b;font-size:.76rem}.tongue-tip p{margin-top:7px;font-size:.72rem;line-height:1.55;font-weight:650}.play-zone{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;padding:28px 24px 32px;text-align:center}.game-status{min-height:25px;color:#687596;font-size:.8rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.picture-stage{position:relative;display:flex;min-height:382px;flex-direction:column;align-items:center;justify-content:center;isolation:isolate}.picture-bubble{position:relative;z-index:2;display:grid;width:280px;height:280px;place-items:center;overflow:hidden;border:3px solid rgba(255,255,255,.9);border-radius:50%;background:radial-gradient(circle at 30% 25%,#fff 0 12%,var(--active-soft) 58%,color-mix(in srgb,var(--active-color) 28%,white));box-shadow:0 25px 55px color-mix(in srgb,var(--active-color) 25%,transparent),inset 0 -15px 30px rgba(37,52,91,.05);cursor:pointer;transform-style:preserve-3d;will-change:transform,filter,opacity;animation:card-arrive .66s cubic-bezier(.18,1.35,.34,1) both,card-float 3.4s ease-in-out .66s infinite}.picture-bubble:disabled{cursor:default}.picture-bubble img{position:relative;z-index:2;width:86%;height:86%;object-fit:contain;filter:drop-shadow(0 14px 12px rgba(40,51,80,.12));pointer-events:none;will-change:transform,filter,opacity}.bubble-shine{position:absolute;top:12%;left:18%;z-index:3;width:28%;height:13%;border-radius:50%;background:rgba(255,255,255,.72);filter:blur(3px);transform:rotate(-24deg)}.picture-name{z-index:4;margin-top:10px;color:#25345b;font-size:1.5rem;font-weight:950;text-transform:capitalize}.feedback{position:absolute;z-index:5;bottom:18px;padding:8px 14px;border-radius:14px;color:#fff;background:#50bba9;box-shadow:0 9px 20px rgba(80,187,169,.25);font-size:.76rem;font-weight:900;animation:feedback-in .3s ease-out both}
.picture-bubble.bubble-pop{pointer-events:none;animation:bubble-exit .84s cubic-bezier(.33,.02,.25,1) forwards}.picture-bubble.bubble-pop img{animation:image-exit .84s cubic-bezier(.2,.75,.25,1) forwards}.burst-fx{position:absolute;top:50%;left:50%;z-index:1;width:20px;height:20px;pointer-events:none}.burst-ring{position:absolute;inset:-90px;border:8px solid var(--active-color);border-radius:50%;opacity:0;animation:ring-burst .72s ease-out forwards}.burst-ring-two{border-width:3px;animation-delay:.1s}.burst-particle{position:absolute;top:5px;left:5px;width:11px;height:18px;border-radius:8px;background:var(--particle-color);box-shadow:0 4px 9px color-mix(in srgb,var(--particle-color) 40%,transparent);transform:rotate(var(--angle)) translateY(-25px);animation:particle-burst .68s cubic-bezier(.17,.67,.28,1) var(--delay) forwards}.celebrating .picture-name{animation:name-away .55s ease-in forwards}
.start-button,.finish-card button{min-height:52px;padding:13px 23px;border-radius:18px;color:#fff;background:linear-gradient(135deg,var(--active-color),#ff7180);box-shadow:0 13px 26px color-mix(in srgb,var(--active-color) 28%,transparent);font-weight:950;transition:transform .16s ease}.start-button:hover,.finish-card button:hover{transform:translateY(-2px)}.listen-button{margin-top:2px;padding:8px 13px;border-radius:13px;color:#526080;background:#eef7ff;font-size:.72rem;font-weight:850}.mic-status{margin-top:12px;color:#8993ad;font-size:.69rem;font-weight:750}.mic-status span{color:#aab2c4}.mic-status.listening span{color:#42b99f;animation:mic-pulse 1.3s ease-in-out infinite}.mic-status.error span{color:#ff806c}.tap-hint{margin-top:5px;color:#98a1b6;font-size:.64rem}.game-note{padding:14px 22px;border-top:1px solid rgba(37,52,91,.07);color:#7b87a4;background:rgba(246,251,255,.7);font-size:.68rem;text-align:center}.game-note strong{color:#526080}.finish-card{display:flex;min-height:382px;flex-direction:column;align-items:center;justify-content:center}.finish-card>span{font-size:4.5rem;animation:finish-in .6s cubic-bezier(.2,1.5,.35,1) both}.finish-card h3{margin-top:10px;font-size:2rem;font-weight:950}.finish-card p{margin:7px 0 22px;color:#687596;font-weight:700}
@keyframes card-arrive{0%{opacity:0;filter:blur(11px);transform:perspective(800px) translateY(85px) scale(.32) rotate(-12deg) rotateY(22deg)}68%{opacity:1;filter:blur(0);transform:perspective(800px) translateY(-7px) scale(1.05) rotate(2deg) rotateY(-4deg)}100%{transform:perspective(800px) translateY(0) scale(1) rotate(0) rotateY(0)}}@keyframes card-float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-9px) rotate(1deg)}}@keyframes bubble-exit{0%{opacity:1;filter:blur(0);transform:perspective(800px) translateY(0) scale(1) rotate(0)}18%{transform:perspective(800px) translateY(9px) scale(.88) rotate(2deg)}44%{opacity:1;transform:perspective(800px) translateY(-4px) scale(1.13) rotate(-6deg)}72%{opacity:.76;filter:blur(1px);transform:perspective(800px) translateY(-36px) scale(.68) rotate(11deg) rotateY(18deg)}100%{opacity:0;filter:blur(12px);transform:perspective(800px) translateY(-130px) scale(.04) rotate(32deg) rotateY(75deg)}}@keyframes image-exit{0%,18%{filter:drop-shadow(0 14px 12px rgba(40,51,80,.12));transform:scale(1) rotate(0)}48%{transform:scale(1.16) rotate(-7deg)}100%{filter:blur(9px);opacity:0;transform:translateY(-45px) scale(.15) rotate(42deg)}}@keyframes ring-burst{0%{opacity:.85;transform:scale(.18)}100%{opacity:0;transform:scale(1.8)}}@keyframes particle-burst{0%{opacity:1;transform:rotate(var(--angle)) translateY(-20px) scale(.5)}70%{opacity:1}100%{opacity:0;transform:rotate(var(--angle)) translateY(calc(var(--distance) * -1)) scale(1) rotate(210deg)}}@keyframes name-away{to{opacity:0;filter:blur(5px);transform:translateY(20px) scale(.8)}}@keyframes feedback-in{from{opacity:0;transform:translateY(8px) scale(.8)}}@keyframes mic-pulse{50%{opacity:.35}}@keyframes finish-in{from{opacity:0;transform:scale(.25) rotate(-25deg)}}
.picture-bubble{background:#fff;border-color:rgba(255,255,255,.95)}
.picture-bubble img{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}
.card-emoji{position:relative;z-index:2;font-size:clamp(6rem,16vw,9rem);line-height:1;filter:drop-shadow(0 14px 12px rgba(40,51,80,.14))}
.bubble-shine{top:8%;left:15%;width:31%;height:12%;background:rgba(255,255,255,.58);filter:blur(4px)}
.parent-stats{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:18px;padding:16px 20px;border:1px solid rgba(37,52,91,.08);border-radius:22px;color:#687596;background:rgba(255,255,255,.68);font-size:.72rem}.parent-stats>div:first-child{display:flex;align-items:center;flex-wrap:wrap;gap:7px 16px}.parent-stats strong{color:#25345b;font-size:.8rem}.sound-stats{display:flex;gap:8px}.sound-stats span{padding:5px 8px;border-radius:9px;background:#fff;font-weight:850}.parent-stats button{color:#687596;text-decoration:underline;text-underline-offset:3px}
@media(max-width:720px){.game-layout{grid-template-columns:1fr}.tongue-tip{order:2;margin:0 16px 18px;padding:14px 16px;border:0;border-radius:18px}.play-zone{padding-inline:14px}.picture-bubble{width:min(250px,72vw);height:min(250px,72vw)}.picture-stage{min-height:355px}.game-topline{padding-inline:17px}.sound-button{min-width:0;flex:1;justify-content:center;padding-inline:8px}.sound-button span{display:none}}@media(max-width:430px){.sound-picker{gap:7px}.sound-button b{width:34px;height:34px}.game-card{border-radius:28px}.star-track{gap:2px}.star-track i{font-size:1rem}.game-topline>div:first-child>span{display:none}.picture-stage{min-height:330px}}
@media(max-width:640px){.parent-stats{align-items:flex-start;flex-direction:column}.sound-stats{order:2}.parent-stats button{order:3}}
@media(prefers-reduced-motion:reduce){.picture-bubble,.picture-bubble.bubble-pop,.picture-bubble.bubble-pop img,.burst-ring,.burst-particle,.celebrating .picture-name,.feedback,.finish-card>span,.mic-status.listening span{animation:none}.sound-button,.start-button,.finish-card button{transition:none}}
</style>
