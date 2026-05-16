<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AppSettings, LadderState } from "../types";
  import { rgbaToCss } from "../defaults";
  import { hpPulse } from "../stores";

  export let cfg: AppSettings;
  export let state: LadderState;
  // Design-Modus: setzt data-design-target an die Sub-Bereiche, damit das
  // Design-Overlay sie findet und Hit-Boxen rendern kann.
  export let designMode: boolean = false;

  // DOM-Refs für Editor-Bbox + Effekt-Animationen.
  let innerEl: HTMLDivElement;
  let flashEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return innerEl;
  }

  // Auto-Skalierung analog zur Ladder (Referenz 450px breit = 1.0)
  const REFERENCE_WIDTH = 450;
  let windowWidth = REFERENCE_WIDTH;

  function updateSize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
  }

  // Floating "+"-Partikel beim Heilen. Pro Heal-Pulse werden mehrere mit
  // leichten Zufalls-Variationen gespawnt; Anzahl/Größe wachsen mit der Menge.
  type Particle = {
    id: number;
    x: number;
    size: number;
    drift: number;
    dur: number;
  };
  let particles: Particle[] = [];
  let nextParticleId = 0;

  function spawnHealParticles(amount: number) {
    if (!barWidth || !barHeight) return;
    // Effekte skalieren mit %-Anteil am Max-HP, nicht mit absoluter Menge —
    // sonst sieht ein /heal?amount=50 bei Max=100 und Max=1000 völlig unterschiedlich aus.
    const ratio = Math.min(1, amount / Math.max(1, cfg.streamHpMax));
    const count = Math.max(3, Math.min(18, 3 + Math.round(ratio * 30)));
    const baseSize = Math.max(14, barHeight * 0.75);
    const sizeBoost = Math.min(1.8, 1 + ratio * 1.6);
    const dur = 900 + Math.min(600, ratio * 800);
    const ids: number[] = [];
    const fresh: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const id = ++nextParticleId;
      ids.push(id);
      fresh.push({
        id,
        x: Math.random() * barWidth,
        size: baseSize * sizeBoost * (0.85 + Math.random() * 0.3),
        drift: (Math.random() - 0.5) * 30 * autoScale,
        dur: dur * (0.85 + Math.random() * 0.3),
      });
    }
    particles = [...particles, ...fresh];
    setTimeout(() => {
      particles = particles.filter((p) => !ids.includes(p.id));
    }, dur * 1.4 + 100);
  }

  function triggerDamageFx(amount: number) {
    const ratio = Math.min(1, amount / Math.max(1, cfg.streamHpMax));
    const intensity = Math.min(1, 0.45 + ratio * 3.5);
    if (flashEl?.animate) {
      flashEl.animate(
        [
          { opacity: intensity, background: `rgba(255, 40, 40, ${intensity})` },
          { opacity: intensity * 0.6, background: `rgba(255, 60, 60, ${intensity * 0.6})`, offset: 0.3 },
          { opacity: 0, background: "rgba(255, 40, 40, 0)" },
        ],
        { duration: 480, easing: "ease-out" },
      );
    }
    if (innerEl?.animate) {
      const mag = Math.min(8, 3 + ratio * 12) * autoScale;
      innerEl.animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(${-mag}px)` },
          { transform: `translateX(${mag}px)` },
          { transform: `translateX(${-mag * 0.6}px)` },
          { transform: `translateX(${mag * 0.4}px)` },
          { transform: "translateX(0)" },
        ],
        { duration: 280, easing: "ease-out" },
      );
    }
  }

  // Pulse-Subscription: ignoriert den initialen null-Wert.
  const unsubPulse = hpPulse.subscribe((p) => {
    if (!p) return;
    if (p.kind === "heal") spawnHealParticles(p.amount);
    else if (p.kind === "damage") triggerDamageFx(p.amount);
  });

  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
  });
  onDestroy(() => {
    window.removeEventListener("resize", updateSize);
    unsubPulse();
  });

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: barWidth = cfg.hpWidth * autoScale;
  $: barHeight = cfg.hpHeight * autoScale;
  $: leftPx = Math.round(cfg.hpX * autoScale);
  $: topPx = Math.round(cfg.hpY * autoScale);
  // Radius mit autoScale skalieren, aber auf halbe Höhe begrenzen (sonst Render-Artefakte).
  $: radiusPx = Math.max(0, Math.min(barHeight / 2, cfg.streamHpBorderRadius * autoScale));
  // Innenradius leicht kleiner, damit Fill nicht über den Rand des Tracks ragt.
  $: innerRadius = Math.max(0, radiusPx - 2);

  $: maxHp = Math.max(1, cfg.streamHpMax);
  $: hpPct = Math.max(0, Math.min(1, state.hp / maxHp));
  $: fillPx = Math.max(0, barWidth * hpPct);

  $: fillBase = rgbaToCss(cfg.streamHpFillColor);
  // Sanftes Highlight (helleres Grün oben) für den MMO-Look
  $: fillGradient = `linear-gradient(to bottom,
      rgba(255,255,255,0.35) 0%,
      ${fillBase} 45%,
      ${fillBase} 100%)`;

  $: hpText = `${Math.ceil(state.hp)} / ${maxHp}`;
  $: textPx = Math.max(12, barHeight * 0.65);

  // Aktuelle Decay-Rate für das laufende Level — smart formatiert.
  $: currentLevel1Based = Math.max(1, Math.min(12, state.currentLevel + 1));
  $: secondsPerHp = (() => {
    const v = cfg.streamHpSecondsPerHpByLevel?.[currentLevel1Based - 1];
    return typeof v === "number" && v > 0 ? v : 0;
  })();
  $: decayText = formatDecay(secondsPerHp);
  $: decayPx = Math.max(10, barHeight * 0.38);

  function formatDecay(s: number): string {
    if (!s || !isFinite(s) || s <= 0) return "";
    if (s <= 1) {
      // Schnell: HP pro Sekunde
      const hpPerSec = 1 / s;
      const formatted = hpPerSec >= 10
        ? hpPerSec.toFixed(0)
        : hpPerSec.toFixed(1).replace(/\.0$/, "");
      return `−${formatted} HP/s`;
    }
    // Langsam: 1 HP pro X Sekunden
    const formatted = s >= 10 ? s.toFixed(0) : s.toFixed(1).replace(/\.0$/, "");
    return `−1 HP / ${formatted}s`;
  }

  // Anstieg der Heal-Partikel relativ zur Balkenhöhe (autoScale).
  $: particleRiseY = -(barHeight + 40 * autoScale);
</script>

<div
  class="hp-wrap"
  bind:this={innerEl}
  style="
    left: {leftPx}px;
    top: {topPx}px;
    width: {barWidth}px;
  "
>
  <div
    class="hp-track"
    data-design-target={designMode ? "hp.bar" : null}
    style="
      height: {barHeight}px;
      background: {rgbaToCss(cfg.streamHpBgColor)};
      border-color: {rgbaToCss(cfg.streamHpBorderColor)};
      border-radius: {radiusPx}px;
    "
  >
    <div
      class="hp-fill"
      style="
        width: {fillPx}px;
        background: {fillGradient};
        border-radius: {innerRadius}px;
      "
    ></div>
    <div
      class="damage-flash"
      bind:this={flashEl}
      style="border-radius: {innerRadius}px;"
    ></div>
    {#if cfg.streamHpShowNumbers}
      <span
        class="hp-text"
        style="
          color: {rgbaToCss(cfg.streamHpTextColor)};
          font-size: {textPx}px;
        "
      >
        <span
          class="hp-text-inner"
          data-design-target={designMode ? "hp.text" : null}
        >
          {hpText}
        </span>
      </span>
    {/if}
  </div>

  <div
    class="heal-particles"
    style="
      width: {barWidth}px;
      height: {barHeight}px;
    "
  >
    {#each particles as p (p.id)}
      <span
        class="heal-plus"
        style="
          left: {p.x}px;
          font-size: {p.size}px;
          --drift: {p.drift}px;
          --rise: {particleRiseY}px;
          animation-duration: {p.dur}ms;
        "
      >+</span>
    {/each}
  </div>

  {#if cfg.streamHpShowDecayRate && decayText}
    <span
      class="decay-text"
      style="
        color: {rgbaToCss(cfg.streamHpTextColor)};
        font-size: {decayPx}px;
      "
    >
      <span
        class="decay-text-inner"
        data-design-target={designMode ? "hp.text" : null}
      >
        {decayText}
      </span>
    </span>
  {/if}
</div>

<style>
  .hp-wrap {
    position: absolute;
    pointer-events: none;
    z-index: 5;
  }
  .hp-track {
    position: relative;
    width: 100%;
    border-style: solid;
    border-width: 2px;
    overflow: hidden;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  }
  .hp-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    transition: width 120ms linear;
    box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.25);
  }
  .damage-flash {
    position: absolute;
    inset: 0;
    background: rgba(255, 40, 40, 0);
    opacity: 0;
    mix-blend-mode: screen;
    pointer-events: none;
  }
  .hp-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    letter-spacing: 1px;
    line-height: 1;
    text-shadow:
      2px 2px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.6),
      0 0 4px rgba(0, 0, 0, 0.5);
    -webkit-text-stroke: 1px rgba(0, 0, 0, 0.85);
    user-select: none;
  }
  /* Inner span = exakte Text-Bbox. So bekommt der Design-Modus nur die
     tatsächliche Text-Größe als Hit-Zone, nicht den ganzen Balken. */
  .hp-text-inner {
    display: inline-block;
  }
  .heal-particles {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
  }
  .heal-plus {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%) scale(0.6);
    color: #5cf28a;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    font-weight: 900;
    line-height: 1;
    text-shadow:
      0 0 10px rgba(80, 255, 120, 0.9),
      0 0 4px rgba(80, 255, 120, 0.7),
      2px 2px 0 rgba(0, 0, 0, 0.85),
      -1px -1px 0 rgba(0, 0, 0, 0.6);
    -webkit-text-stroke: 1px rgba(0, 40, 10, 0.9);
    opacity: 0;
    animation-name: heal-rise;
    animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1);
    animation-fill-mode: forwards;
    will-change: transform, opacity;
  }
  @keyframes heal-rise {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    18% {
      opacity: 1;
      transform: translate(-50%, calc(-50% - 6px)) scale(1.15);
    }
    100% {
      opacity: 0;
      transform: translate(calc(-50% + var(--drift)), calc(-50% + var(--rise))) scale(0.9);
    }
  }
  .decay-text {
    display: block;
    margin-top: 6px;
    text-align: center;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    letter-spacing: 0.5px;
    line-height: 1;
    opacity: 0.92;
    text-shadow:
      1px 1px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.55),
      0 0 3px rgba(0, 0, 0, 0.5);
    -webkit-text-stroke: 1px rgba(0, 0, 0, 0.75);
    user-select: none;
  }
  .decay-text-inner {
    display: inline-block;
  }
</style>
