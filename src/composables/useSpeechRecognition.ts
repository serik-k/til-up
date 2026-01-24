import { onUnmounted, ref, watch, type Ref } from "vue";

export type SpeechRecState =
  | "idle"
  | "starting"
  | "listening"
  | "error"
  | "unsupported";

type RecAlternative = {
  transcript: string;
  confidence?: number;
};

type RecResult = {
  isFinal: boolean;
  length: number;
  item(index: number): RecAlternative;
  [index: number]: RecAlternative;
};

type RecResultList = {
  length: number;
  item(index: number): RecResult;
  [index: number]: RecResult;
};

type RecEvent = Event & {
  resultIndex: number;
  results: RecResultList;
};

type RecErrorEvent = Event & {
  error?: string;
  message?: string;
  name?: string;
  code?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onresult: ((ev: RecEvent) => void) | null;
  onerror: ((ev: RecErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;

  start(): void;
  stop(): void;
  abort(): void;
};

function getSpeechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

function normalizeErrorCode(codeRaw: string): string {
  const code = String(codeRaw || "").trim();
  if (!code) return "";
  return code.toLowerCase();
}

function mapSpeechError(evOrErr: any): string {
  const code = normalizeErrorCode(
    String(evOrErr?.error || evOrErr?.name || evOrErr?.code || ""),
  );

  if (code === "not-allowed" || code === "service-not-allowed")
    return "permission_denied";
  if (code === "audio-capture") return "audio_capture";
  if (code === "no-speech") return "no_speech";
  if (code === "network") return "network";
  if (code === "aborted") return "aborted";
  if (code === "bad-grammar") return "bad_grammar";
  if (code === "language-not-supported") return "language_not_supported";

  if (code === "notallowederror" || code === "securityerror")
    return "permission_denied";
  if (code === "notfounderror" || code === "devicesnotfounderror")
    return "audio_capture";
  if (code === "invalidstateerror") return "invalid_state";
  if (code === "aborterror") return "aborted";
  if (code === "networkerror") return "network";
  if (code === "notsupportederror") return "unsupported";

  return code || "speech_error";
}

function isFatalError(mapped: string): boolean {
  return (
    mapped === "permission_denied" ||
    mapped === "audio_capture" ||
    mapped === "unsupported" ||
    mapped === "language_not_supported"
  );
}

export function useSpeechRecognition(opts: {
  lang: Ref<string>;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  autoRestart?: boolean;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}) {
  const state = ref<SpeechRecState>("idle");
  const errorMessage = ref<string>("");

  let rec: SpeechRecognitionLike | null = null;

  let wantRunning = false;
  let pendingLangRestart = false;

  // защита от повторных start()
  let isStartingOrListening = false;

  // backoff
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let restartDelay = 250;

  // защита от “устаревших” таймеров/инстансов
  let instanceId = 0;
  let timerToken = 0;

  function supported(): boolean {
    return Boolean(getSpeechCtor());
  }

  function clearRestartTimer() {
    if (restartTimer !== null) {
      try {
        globalThis.clearTimeout(restartTimer);
      } catch {
        // ignore
      }
      restartTimer = null;
    }
    timerToken += 1;
  }

  function destroyRecognizer() {
    clearRestartTimer();
    pendingLangRestart = false;
    isStartingOrListening = false;

    const r = rec;
    rec = null;
    if (!r) return;

    try {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
    } catch {
      // ignore
    }

    try {
      r.abort();
    } catch {
      // ignore
    }
  }

  function ensureRecognizer(): SpeechRecognitionLike | null {
    if (rec) return rec;

    const Ctor = getSpeechCtor();
    if (!Ctor) {
      state.value = "unsupported";
      errorMessage.value = "";
      return null;
    }

    instanceId += 1;
    const myInstance = instanceId;

    const r = new Ctor();
    r.lang = String(opts.lang.value || "ru-RU");
    r.continuous = opts.continuous ?? true;
    r.interimResults = opts.interimResults ?? true;
    r.maxAlternatives = opts.maxAlternatives ?? 1;

    r.onresult = (ev: RecEvent) => {
      if (!wantRunning) return;
      if (myInstance !== instanceId) return;

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (!res) continue;

        const alt = res[0];
        const text = String(alt?.transcript || "").trim();
        if (!text) continue;

        if (res.isFinal) opts.onFinal(text);
        else opts.onInterim?.(text);
      }
    };

    r.onerror = (ev: RecErrorEvent) => {
      if (myInstance !== instanceId) return;

      const mapped = mapSpeechError(ev);

      // КЛЮЧЕВОЕ: если пользователь/компонент уже остановил распознавание,
      // не переводим UI в "error" из-за abort()/stop().
      if (!wantRunning) return;

      errorMessage.value = mapped;
      isStartingOrListening = false;
      state.value = "error";

      if (isFatalError(mapped)) {
        wantRunning = false;
        pendingLangRestart = false;
        clearRestartTimer();

        try {
          r.abort();
        } catch {
          // ignore
        }

        // освобождаем ресурсы, чтобы в будущем можно было “чисто” стартануть
        destroyRecognizer();
      }
    };

    r.onend = () => {
      if (myInstance !== instanceId) return;

      isStartingOrListening = false;

      if (!wantRunning) {
        state.value = state.value === "unsupported" ? "unsupported" : "idle";
        pendingLangRestart = false;
        return;
      }

      if (pendingLangRestart) {
        pendingLangRestart = false;
        restartDelay = 250;
        tryStart();
        return;
      }

      if (!opts.autoRestart) {
        state.value = "idle";
        return;
      }

      clearRestartTimer();
      const delay = restartDelay;
      restartDelay = Math.min(1500, Math.floor(restartDelay * 1.25 + 20));

      const myToken = timerToken;
      restartTimer = globalThis.setTimeout(() => {
        if (!wantRunning) return;
        if (myToken !== timerToken) return;
        tryStart();
      }, delay);
    };

    rec = r;
    return r;
  }

  function tryStart() {
    if (!supported()) {
      state.value = "unsupported";
      errorMessage.value = "";
      wantRunning = false;
      pendingLangRestart = false;
      isStartingOrListening = false;
      return;
    }

    const r = ensureRecognizer();
    if (!r) return;

    const nextLang = String(opts.lang.value || "ru-RU");
    if (r.lang !== nextLang) r.lang = nextLang;

    if (isStartingOrListening) return;

    try {
      clearRestartTimer();
      state.value = "starting";
      errorMessage.value = "";

      isStartingOrListening = true;
      r.start();

      state.value = "listening";
      restartDelay = 250;
    } catch (e: any) {
      isStartingOrListening = false;

      const mapped = mapSpeechError(e);
      state.value = "error";
      errorMessage.value = mapped;

      if (
        mapped === "invalid_state" &&
        wantRunning &&
        (opts.autoRestart ?? false)
      ) {
        clearRestartTimer();
        const myToken = timerToken;

        restartTimer = globalThis.setTimeout(() => {
          if (!wantRunning) return;
          if (myToken !== timerToken) return;

          try {
            r.abort();
          } catch {
            // ignore
          }
          tryStart();
        }, 120);

        return;
      }

      if (isFatalError(mapped)) {
        wantRunning = false;
        pendingLangRestart = false;
        clearRestartTimer();
        destroyRecognizer();
      }
    }
  }

  function start() {
    if (!supported()) {
      state.value = "unsupported";
      errorMessage.value = "";
      return;
    }

    wantRunning = true;
    pendingLangRestart = false;
    clearRestartTimer();
    tryStart();
  }

  function stop() {
    wantRunning = false;
    pendingLangRestart = false;
    clearRestartTimer();
    isStartingOrListening = false;

    const r = rec;
    if (r) {
      // stop → затем abort (в разных браузерах поведение отличается)
      try {
        r.stop();
      } catch {
        // ignore
      }
      try {
        r.abort();
      } catch {
        // ignore
      }
    }

    state.value = state.value === "unsupported" ? "unsupported" : "idle";
  }

  function restartForLangChange() {
    if (!wantRunning) return;

    const r = ensureRecognizer();
    if (!r) return;

    pendingLangRestart = true;
    clearRestartTimer();
    isStartingOrListening = false;

    try {
      r.abort();
    } catch {
      pendingLangRestart = false;
      tryStart();
    }
  }

  watch(
    () => String(opts.lang.value || ""),
    () => {
      restartForLangChange();
    },
  );

  onUnmounted(() => {
    stop();
    destroyRecognizer();
  });

  return {
    state,
    errorMessage,
    start,
    stop,
    supported,
  };
}
