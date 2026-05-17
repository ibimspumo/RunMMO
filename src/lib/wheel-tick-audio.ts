/* Dynamische Glücksrad-Ticks via Web Audio API.
   Kein Sample, kein Asset — pro Tick ein kurzer Oszillator-Klick mit
   exponentiellem Decay. Lautstärke skaliert mit Master-Volume (dB) und
   dem separaten Tick-Volume-Slider (0..100).

   AudioContext wird lazy beim ersten Tick erstellt und wiederverwendet. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch (e) {
    console.warn("AudioContext nicht verfügbar", e);
    return null;
  }
}

function masterLinear(volumeDb: number): number {
  return Math.max(0, Math.min(2, Math.pow(10, volumeDb / 20)));
}

// pitchHint: 0..1 — schnell drehender Anfang vs. zähes Ende. Beeinflusst die
// Tonhöhe leicht, damit der Tick zum Schluss „spannender" klingt (höher).
export function playWheelTick(
  volumeDb: number,
  tickVolume: number,
  pitchHint: number = 0.5,
): void {
  if (tickVolume <= 0) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }

  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();

  // Anfangs 1600 Hz, am Ende des Spins ~2200 Hz — leicht ansteigend.
  const baseFreq = 1600 + 600 * Math.max(0, Math.min(1, pitchHint));
  osc.type = "square";
  osc.frequency.setValueAtTime(baseFreq, now);
  // Kurzer Pitch-Drop für den „Klick"-Charakter.
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(200, baseFreq * 0.4),
    now + 0.025,
  );

  const peak =
    0.28 * masterLinear(volumeDb) * Math.max(0, Math.min(1, tickVolume / 100));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}
