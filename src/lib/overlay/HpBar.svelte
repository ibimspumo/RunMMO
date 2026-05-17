<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AppSettings, LadderState } from "../types";
  import { rgbaToCss } from "../defaults";
  import {
    hpPulse,
    activeHpFreezes,
    activeHpDots,
    skillRuntime,
    settings,
    extraLives,
  } from "../stores";

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
  //
  // Burst-Schutz: harter Cap auf MAX_PARTICLES. Bei Überlauf wird der
  // älteste Partikel verdrängt — kein unbeschränktes Array, kein
  // setTimeout pro Spawn (=> keine 1000 GC-Timer bei Webhook-Bursts).
  type Particle = {
    id: number;
    x: number;
    size: number;
    drift: number;
    dur: number;
    startMs: number;
  };
  const MAX_PARTICLES = 60;
  let particles: Particle[] = [];
  let nextParticleId = 0;
  let particleGcHandle: number | null = null;

  function scheduleParticleGc() {
    if (particleGcHandle !== null || particles.length === 0) return;
    const tick = () => {
      const now = performance.now();
      const before = particles.length;
      particles = particles.filter((p) => now - p.startMs < p.dur * 1.4 + 100);
      if (particles.length !== before) particles = particles; // reaktiv
      if (particles.length > 0) {
        particleGcHandle = requestAnimationFrame(tick);
      } else {
        particleGcHandle = null;
      }
    };
    particleGcHandle = requestAnimationFrame(tick);
  }

  function spawnHealParticles(amount: number) {
    if (!barWidth || !barHeight) return;
    // Effekte skalieren mit %-Anteil am Max-HP, nicht mit absoluter Menge —
    // sonst sieht ein /heal?amount=50 bei Max=100 und Max=1000 völlig unterschiedlich aus.
    const ratio = Math.min(1, amount / Math.max(1, cfg.streamHpMax));
    const count = Math.max(3, Math.min(18, 3 + Math.round(ratio * 30)));
    const baseSize = Math.max(14, barHeight * 0.75);
    const sizeBoost = Math.min(1.8, 1 + ratio * 1.6);
    const dur = 900 + Math.min(600, ratio * 800);
    const now = performance.now();
    const fresh: Particle[] = [];
    for (let i = 0; i < count; i++) {
      fresh.push({
        id: ++nextParticleId,
        x: Math.random() * barWidth,
        size: baseSize * sizeBoost * (0.85 + Math.random() * 0.3),
        drift: (Math.random() - 0.5) * 30 * autoScale,
        dur: dur * (0.85 + Math.random() * 0.3),
        startMs: now,
      });
    }
    let next = particles.concat(fresh);
    if (next.length > MAX_PARTICLES) {
      next = next.slice(next.length - MAX_PARTICLES);
    }
    particles = next;
    scheduleParticleGc();
  }

  // Damage-FX: max. eine laufende Schüttel/Flash-Animation gleichzeitig.
  // Bursts collapsen — keine 200 parallel laufenden WAAPI-Animations, die
  // sich gegenseitig zerstückeln.
  let damageFlashAnim: Animation | null = null;
  let damageShakeAnim: Animation | null = null;

  function triggerDamageFx(amount: number) {
    const ratio = Math.min(1, amount / Math.max(1, cfg.streamHpMax));
    const intensity = Math.min(1, 0.45 + ratio * 3.5);
    if (flashEl?.animate) {
      if (damageFlashAnim) {
        try { damageFlashAnim.cancel(); } catch { /* ignore */ }
      }
      damageFlashAnim = flashEl.animate(
        [
          { opacity: intensity, background: `rgba(255, 40, 40, ${intensity})` },
          { opacity: intensity * 0.6, background: `rgba(255, 60, 60, ${intensity * 0.6})`, offset: 0.3 },
          { opacity: 0, background: "rgba(255, 40, 40, 0)" },
        ],
        { duration: 480, easing: "ease-out" },
      );
      damageFlashAnim.onfinish = () => { damageFlashAnim = null; };
    }
    if (innerEl?.animate) {
      const mag = Math.min(8, 3 + ratio * 12) * autoScale;
      if (damageShakeAnim) {
        try { damageShakeAnim.cancel(); } catch { /* ignore */ }
      }
      damageShakeAnim = innerEl.animate(
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
      damageShakeAnim.onfinish = () => { damageShakeAnim = null; };
    }
  }

  // Pulse-Subscription: ignoriert den initialen null-Wert. Pulses kommen
  // schon vor-aggregiert (max. 1 pro Kind pro Frame, siehe stores.ts).
  const unsubPulse = hpPulse.subscribe((p) => {
    if (!p) return;
    if (p.kind === "heal") spawnHealParticles(p.amount);
    else if (p.kind === "damage") triggerDamageFx(p.amount);
  });

  // Eigene Uhr für Countdown-Reaktivität (Freeze-Restdauer, Skill-Cooldown).
  let nowMs = Date.now();
  let clockHandle: number | null = null;
  function tickClock() {
    nowMs = Date.now();
    clockHandle = requestAnimationFrame(tickClock);
  }

  // Quelle des aktuellen / zuletzt aktiven Freeze, damit wir nach Ablauf
  // weiter den Skill-Cooldown auf der Bar anzeigen können.
  let lastFreezeSourceId: number | null = null;
  const unsubFreezes = activeHpFreezes.subscribe((list) => {
    let latestExp = 0;
    let latestSrc: number | null = null;
    for (const f of list) {
      if (f.expiresAtMs > latestExp && typeof f.sourceSkillId === "number") {
        latestExp = f.expiresAtMs;
        latestSrc = f.sourceSkillId;
      }
    }
    if (latestSrc !== null) lastFreezeSourceId = latestSrc;
  });

  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
    clockHandle = requestAnimationFrame(tickClock);
  });
  onDestroy(() => {
    window.removeEventListener("resize", updateSize);
    unsubPulse();
    unsubFreezes();
    if (clockHandle !== null) cancelAnimationFrame(clockHandle);
    if (particleGcHandle !== null) {
      cancelAnimationFrame(particleGcHandle);
      particleGcHandle = null;
    }
    try { damageFlashAnim?.cancel(); } catch { /* ignore */ }
    try { damageShakeAnim?.cancel(); } catch { /* ignore */ }
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
  // Text-Größe: explizit aus Settings, oder 0 = auto aus Balkenhöhe.
  $: textPx =
    cfg.streamHpTextSize > 0
      ? cfg.streamHpTextSize * autoScale
      : Math.max(12, barHeight * 0.65);

  // Text-Schatten + Outline (eigene Werte pro Text-Element)
  $: hpTextShadow = cfg.streamHpTextShadowEnabled
    ? `${cfg.streamHpTextShadowOffsetX}px ${cfg.streamHpTextShadowOffsetY}px ${cfg.streamHpTextShadowBlur}px ${rgbaToCss(cfg.streamHpTextShadowColor)}`
    : "none";
  $: hpTextOutlineStroke = cfg.streamHpTextOutlineEnabled
    ? `${cfg.streamHpTextOutlineSize}px ${rgbaToCss(cfg.streamHpTextOutlineColor)}`
    : "0 transparent";

  // Container-Schatten (box-shadow)
  $: hpBoxShadow = cfg.streamHpShadowEnabled
    ? `${cfg.streamHpShadowOffsetX}px ${cfg.streamHpShadowOffsetY}px ${cfg.streamHpShadowBlur}px ${rgbaToCss(cfg.streamHpShadowColor)}`
    : "none";
  // Container-Umrandung
  $: hpBorderWidthPx = cfg.streamHpBorderEnabled
    ? Math.max(0, cfg.streamHpBorderWidth)
    : 0;

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

  // Extraleben-Anzeige: nur Herzen für aktive Leben, rechtsbündig über der Bar.
  $: livesCount = $extraLives;
  $: heartSizePx = Math.max(8, cfg.streamHpExtraLifeHeartSize * autoScale);
  $: heartGapPx = Math.max(0, cfg.streamHpExtraLifeHeartGap * autoScale);
  $: heartOffsetYPx = Math.max(0, cfg.streamHpExtraLifeHeartOffsetY * autoScale);
  $: heartColorCss = rgbaToCss(cfg.streamHpExtraLifeHeartColor);
  $: showLives = cfg.streamHpExtraLivesMax > 0 && livesCount > 0;

  // Aktive Freeze + HoT/DoT — Reaktivität wird durch nowMs-Abhängigkeit
  // erzwungen, damit Restzeit-Balken frame-genau aktualisieren.
  $: frozen = (() => {
    void nowMs;
    return $activeHpFreezes.some((f) => f.expiresAtMs > nowMs);
  })();
  $: activeHot = (() => {
    void nowMs;
    return $activeHpDots.find(
      (d) => d.kind === "healOverTime" && d.expiresAtMs > nowMs,
    );
  })();
  $: activeDot = (() => {
    void nowMs;
    return $activeHpDots.find(
      (d) => d.kind === "damageOverTime" && d.expiresAtMs > nowMs,
    );
  })();

  // Skill-Cooldown des zuletzt freezenden Skills — sichtbar nach Ablauf des
  // Freeze, solange der Skill noch auf Cooldown ist (sonst 0 / nichts).
  $: skillCooldownFrac = (() => {
    void nowMs;
    if (lastFreezeSourceId === null) return 0;
    const rt = $skillRuntime[lastFreezeSourceId];
    if (!rt) return 0;
    // HpBar rendert nur im MMO-Modus, daher cfg.skills hier definitiv die
    // richtige Liste (Freeze-Effekte sind im Simple-Modus deaktiviert).
    const sk = $settings.skills.find((s) => s.id === lastFreezeSourceId);
    if (!sk || sk.cooldownSec <= 0) return 0;
    const total = sk.cooldownSec * 1000;
    const left = rt.cooldownUntilMs - nowMs;
    return Math.max(0, Math.min(1, left / total));
  })();
  // Streifen wird nach Ende des Freeze gezeigt, nicht überlagert.
  $: showCooldownStrip = !frozen && skillCooldownFrac > 0;
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
  {#if showLives}
    <div
      class="hp-lives"
      data-design-target={designMode ? "hp.lives" : null}
      style="
        gap: {heartGapPx}px;
        bottom: calc(100% + {heartOffsetYPx}px);
        --heart-size: {heartSizePx}px;
        --heart-color: {heartColorCss};
      "
    >
      {#each Array(livesCount) as _, i (i)}
        <svg
          class="hp-heart"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 21s-7.5-4.7-9.5-9.1C1 8.6 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3.3.4.7.6 1 .6.3 0 .7-.2 1-.6C13.2 6.1 14.5 5 16.5 5 19.9 5 22 8.6 21.5 11.9 19.5 16.3 12 21 12 21z"
          />
        </svg>
      {/each}
    </div>
  {/if}
  <div
    class="hp-track"
    data-design-target={designMode ? "hp.bar" : null}
    style="
      height: {barHeight}px;
      background: {rgbaToCss(cfg.streamHpBgColor)};
      border-color: {rgbaToCss(cfg.streamHpBorderColor)};
      border-width: {hpBorderWidthPx}px;
      border-radius: {radiusPx}px;
      box-shadow: {hpBoxShadow};
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

    {#if activeHot}
      <div
        class="hot-aura"
        style="border-radius: {innerRadius}px;"
        title="Heilung pro Sekunde"
      ></div>
    {/if}

    {#if activeDot}
      <div
        class="dot-aura"
        style="border-radius: {innerRadius}px;"
        title="Schaden pro Sekunde"
      ></div>
    {/if}

    {#if frozen}
      <div
        class="freeze-overlay"
        style="border-radius: {innerRadius}px;"
        title="Leben eingefroren"
      >
        <span class="snowflake sf-1">❄</span>
        <span class="snowflake sf-2">❅</span>
        <span class="snowflake sf-3">❄</span>
        <span class="snowflake sf-4">❅</span>
        <span class="snowflake sf-5">❄</span>
      </div>
    {/if}

    {#if showCooldownStrip}
      <div
        class="freeze-cooldown"
        style="
          width: {Math.max(0, Math.round(barWidth * skillCooldownFrac))}px;
          border-radius: {innerRadius}px;
        "
      ></div>
    {/if}

    {#if cfg.streamHpShowNumbers}
      <span
        class="hp-text"
        style="
          color: {rgbaToCss(cfg.streamHpTextColor)};
          font-size: {textPx}px;
          text-shadow: {hpTextShadow};
          -webkit-text-stroke: {hpTextOutlineStroke};
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
        text-shadow: {hpTextShadow};
        -webkit-text-stroke: {hpTextOutlineStroke};
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
    overflow: hidden;
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
  /* Frost-Overlay während Freeze: kühler Cyan-Wash, leuchtender Rand,
     dezentes Atmen + ein paar floatende Schneeflocken. */
  .freeze-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        180deg,
        rgba(186, 230, 253, 0.55) 0%,
        rgba(125, 211, 252, 0.42) 50%,
        rgba(56, 189, 248, 0.5) 100%
      );
    box-shadow:
      inset 0 0 18px rgba(186, 230, 253, 0.95),
      0 0 14px rgba(56, 189, 248, 0.7);
    mix-blend-mode: screen;
    overflow: hidden;
    pointer-events: none;
    animation: freeze-pulse 1.6s ease-in-out infinite;
  }
  @keyframes freeze-pulse {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 1; }
  }
  .snowflake {
    position: absolute;
    top: 50%;
    color: #f0f9ff;
    font-size: 78%;
    line-height: 1;
    text-shadow:
      0 0 6px rgba(186, 230, 253, 0.95),
      0 0 2px rgba(255, 255, 255, 0.9);
    transform: translateY(-50%);
    animation: sf-drift 4.2s linear infinite;
    will-change: transform, opacity;
    user-select: none;
  }
  .sf-1 { left: 8%;  animation-delay: 0s; }
  .sf-2 { left: 28%; animation-delay: -0.9s; font-size: 62%; }
  .sf-3 { left: 50%; animation-delay: -1.8s; }
  .sf-4 { left: 72%; animation-delay: -2.6s; font-size: 62%; }
  .sf-5 { left: 90%; animation-delay: -3.4s; }
  @keyframes sf-drift {
    0%   { transform: translate(0, -50%) rotate(0deg); opacity: 0.55; }
    25%  { transform: translate(-4px, -65%) rotate(120deg); opacity: 1; }
    50%  { transform: translate(2px, -40%) rotate(220deg); opacity: 0.75; }
    75%  { transform: translate(5px, -60%) rotate(310deg); opacity: 1; }
    100% { transform: translate(0, -50%) rotate(360deg); opacity: 0.55; }
  }
  /* Cooldown-Streifen nach Freeze: dünner Cyan-Strip am unteren Rand der Bar,
     schrumpft synchron zum Skill-Cooldown. */
  .freeze-cooldown {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 18%;
    min-height: 3px;
    background:
      linear-gradient(
        90deg,
        rgba(56, 189, 248, 0.85) 0%,
        rgba(186, 230, 253, 0.95) 100%
      );
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.85);
    transition: width 100ms linear;
    pointer-events: none;
  }
  /* HoT-Aura: sanfter grüner Glow am Rand, regelmäßig pulsierend. */
  .hot-aura {
    position: absolute;
    inset: 0;
    box-shadow:
      inset 0 0 14px rgba(110, 231, 183, 0.7),
      0 0 12px rgba(34, 197, 94, 0.55);
    mix-blend-mode: screen;
    pointer-events: none;
    animation: hot-pulse 1.2s ease-in-out infinite;
  }
  @keyframes hot-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  /* DoT-Aura: roter Glow, etwas hektischeres Pulsieren. */
  .dot-aura {
    position: absolute;
    inset: 0;
    box-shadow:
      inset 0 0 14px rgba(248, 113, 113, 0.65),
      0 0 12px rgba(239, 68, 68, 0.6);
    mix-blend-mode: screen;
    pointer-events: none;
    animation: dot-pulse 0.9s ease-in-out infinite;
  }
  @keyframes dot-pulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 1; }
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
    user-select: none;
  }
  .decay-text-inner {
    display: inline-block;
  }
  /* Extraleben: Herzen rechtsbündig direkt über dem HP-Balken. */
  .hp-lives {
    position: absolute;
    right: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    pointer-events: none;
    user-select: none;
  }
  .hp-heart {
    width: var(--heart-size);
    height: var(--heart-size);
    fill: var(--heart-color);
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.55));
    animation: heart-pop 240ms ease-out;
    will-change: transform;
  }
  @keyframes heart-pop {
    0% { transform: scale(0.4); opacity: 0; }
    60% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
