/* Zentraler Audio-Pool für Effekt-Sounds (Heal/Damage/Skill/Level/Death).
 *
 * Ziele:
 *  - 100+ Trigger/Sekunde aushalten, ohne dass der Browser am `new Audio()`-
 *    Allokationen erstickt oder der Arbeitsspeicher hochläuft.
 *  - Pro Kategorie eine harte Obergrenze gleichzeitig laufender Stimmen;
 *    bei Überlauf wird die älteste Stimme gestoppt und die neue gespielt,
 *    damit Feedback nie komplett verschluckt wird.
 *  - Web Audio API mit einmal dekodierten Buffern statt N HTMLAudioElement-
 *    Instanzen pro Sound. Buffer werden URL-basiert gecacht.
 *  - HTMLAudio-Fallback, falls eine URL nicht via fetch/decode geht.
 */

export type AudioCategory =
  | "heal"
  | "damage"
  | "skill"
  | "level"
  | "death";

// Wie viele Stimmen pro Kategorie dürfen gleichzeitig laufen?
// Death = 1 (sonst peinlich), Level/Skill mittel, Heal/Damage großzügiger
// für Burst-Szenarien (40+/s).
const MAX_VOICES: Record<AudioCategory, number> = {
  heal: 12,
  damage: 12,
  skill: 8,
  level: 4,
  death: 1,
};

let ctx: AudioContext | null = null;
let ctxFailed = false;

function getCtx(): AudioContext | null {
  if (ctx || ctxFailed) return ctx;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) {
      ctxFailed = true;
      return null;
    }
    ctx = new Ctor();
  } catch {
    ctxFailed = true;
  }
  return ctx;
}

// Buffer-Cache pro URL. Promise<AudioBuffer | null> — null markiert URLs,
// die nicht dekodiert werden konnten (z.B. unbekanntes Format), damit wir
// nicht bei jedem Trigger neu fetchen.
const bufferCache = new Map<string, Promise<AudioBuffer | null>>();

function loadBuffer(url: string): Promise<AudioBuffer | null> {
  let p = bufferCache.get(url);
  if (p) return p;
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((arr) => c.decodeAudioData(arr.slice(0)))
    .catch((err) => {
      console.warn("audio decode failed for", url, err);
      return null as AudioBuffer | null;
    });
  bufferCache.set(url, p);
  return p;
}

// Laufende Stimmen pro Kategorie als FIFO (älteste vorne).
type Voice = { src: AudioBufferSourceNode; gain: GainNode };
const voices: Record<AudioCategory, Voice[]> = {
  heal: [],
  damage: [],
  skill: [],
  level: [],
  death: [],
};

// HTMLAudio-Pool als Fallback. Reusen wir, damit wir nicht pro Trigger
// `new Audio()` machen müssen. Pro Kategorie ringbufferartig begrenzt.
const htmlPool: Record<AudioCategory, HTMLAudioElement[]> = {
  heal: [],
  damage: [],
  skill: [],
  level: [],
  death: [],
};

function dbToLinear(db: number): number {
  return Math.max(0, Math.min(1, Math.pow(10, db / 20)));
}

function killOldest(cat: AudioCategory) {
  const v = voices[cat].shift();
  if (!v) return;
  try {
    v.src.stop();
  } catch {
    /* schon zu Ende */
  }
}

function playViaWebAudio(
  c: AudioContext,
  buf: AudioBuffer,
  cat: AudioCategory,
  volume: number,
): boolean {
  if (voices[cat].length >= MAX_VOICES[cat]) killOldest(cat);
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(c.destination);
    const voice: Voice = { src, gain };
    voices[cat].push(voice);
    src.onended = () => {
      const idx = voices[cat].indexOf(voice);
      if (idx >= 0) voices[cat].splice(idx, 1);
    };
    src.start();
    return true;
  } catch (err) {
    console.warn("webaudio play failed", err);
    return false;
  }
}

function playViaHtml(url: string, cat: AudioCategory, volume: number) {
  // Reuse: erstes nicht-aktives Element aus dem Pool nehmen, sonst neues
  // anlegen — Pool wird auf MAX_VOICES begrenzt, älteste wird verdrängt.
  const pool = htmlPool[cat];
  let el: HTMLAudioElement | null = null;
  for (const candidate of pool) {
    if (candidate.paused || candidate.ended) {
      el = candidate;
      break;
    }
  }
  if (!el) {
    if (pool.length >= MAX_VOICES[cat]) {
      el = pool.shift()!;
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    } else {
      el = new Audio();
    }
    pool.push(el);
  }
  el.src = url;
  el.volume = volume;
  el.currentTime = 0;
  el.play().catch((err) => console.warn("html audio failed", err));
}

/**
 * Spielt einen Sound aus dem Pool ab. Sofortiger Return, kein Await nötig.
 * Bei Überlauf wird die älteste Stimme der Kategorie gekillt.
 */
export function playPooled(
  url: string | null | undefined,
  volumeDb: number,
  cat: AudioCategory,
): void {
  if (!url) return;
  const volume = dbToLinear(volumeDb);
  const c = getCtx();
  if (!c) {
    playViaHtml(url, cat, volume);
    return;
  }
  // Suspended AudioContext (Autoplay-Policy) — best-effort resume.
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  loadBuffer(url).then((buf) => {
    if (!buf) {
      playViaHtml(url, cat, volume);
      return;
    }
    const ok = playViaWebAudio(c, buf, cat, volume);
    if (!ok) playViaHtml(url, cat, volume);
  });
}

/** Wird beim Programmstart aufgerufen, um den AudioContext bei der ersten
 *  User-Interaktion „aufzuwecken". Tauri-Webviews sind meist nicht so streng,
 *  aber kostet uns nichts. */
export function primeAudioContext(): void {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}
