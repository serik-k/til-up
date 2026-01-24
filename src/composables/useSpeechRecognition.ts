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

function mapSpeechError(ev: any): string {
  const code = String(ev?.error || "");
  if (!code) return "speech_error";

  if (code === "not-allowed" || code === "service-not-allowed")
    return "permission_denied";
  if (code === "audio-capture") return "audio_capture";
  if (code === "no-speech") return "no_speech";
  if (code === "network") return "network";
  if (code === "aborted") return "aborted";
  if (code === "bad-grammar") return "bad_grammar";
  if (code === "language-not-supported") return "language_not_supported";

  return code;
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

  let restartTimer: number | null = null;
  let restartDelay = 250;

  function supported(): boolean {
    return Boolean(getSpeechCtor());
  }

  function clearRestartTimer() {
    if (restartTimer !== null) {
      try {
        clearTimeout(restartTimer);
      } catch {
        // ignore
      }
      restartTimer = null;
    }
  }

  function destroyRecognizer() {
    clearRestartTimer();
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

    const r = new Ctor();
    r.lang = String(opts.lang.value || "ru-RU");
    r.continuous = opts.continuous ?? true;
    r.interimResults = opts.interimResults ?? true;
    r.maxAlternatives = opts.maxAlternatives ?? 1;

    r.onresult = (ev: RecEvent) => {
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
      state.value = "error";
      errorMessage.value = mapSpeechError(ev);
    };

    r.onend = () => {
      if (!wantRunning) {
        state.value = state.value === "unsupported" ? "unsupported" : "idle";
        return;
      }

      if (!opts.autoRestart) {
        state.value = "idle";
        return;
      }

      clearRestartTimer();
      const delay = restartDelay;
      restartDelay = Math.min(1500, Math.floor(restartDelay * 1.25 + 20));

      restartTimer = window.setTimeout(() => {
        if (!wantRunning) return;
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
      return;
    }

    const r = ensureRecognizer();
    if (!r) return;

    const nextLang = String(opts.lang.value || "ru-RU");
    if (r.lang !== nextLang) r.lang = nextLang;

    try {
      state.value = "starting";
      errorMessage.value = "";
      r.start();
      state.value = "listening";
      restartDelay = 250;
    } catch (e: any) {
      state.value = "error";
      errorMessage.value = mapSpeechError(e);
    }
  }

  function start() {
    wantRunning = true;
    clearRestartTimer();
    tryStart();
  }

  function stop() {
    wantRunning = false;
    clearRestartTimer();

    const r = rec;
    if (r) {
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

  watch(
    () => String(opts.lang.value || ""),
    () => {
      if (!wantRunning) return;
      stop();
      start();
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
