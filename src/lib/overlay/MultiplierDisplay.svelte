<script lang="ts">
  // Multiplikator-Anzeige: drei zentrierte Zeilen — Faktor ("X2"),
  // Restzeit ("0:32"), betroffene Wirkungen ("(HEILUNG, SCHADEN)").
  // Position + uniforme Skalierung kommen aus dem Edit-Modus; Stil je
  // Zeile aus dem Design-Modus. Es ist immer höchstens **ein** Buff
  // aktiv (siehe registerMultiplier).

  import { onMount, onDestroy } from "svelte";
  import type { AppSettings, MultiplierTextStyle, SkillEffectKind } from "../types";
  import { rgbaToCss } from "../defaults";
  import { activeMultipliers } from "../stores";

  export let cfg: AppSettings;
  export let editMode = false;
  export let designMode = false;
  export let showInEditMode = false;

  let rootEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return rootEl;
  }

  const REFERENCE_WIDTH = 450;
  let windowWidth = REFERENCE_WIDTH;
  function updateSize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
  }

  // Frame-genauer Countdown.
  let nowMs = Date.now();
  let rafHandle: number | null = null;
  function tick() {
    nowMs = Date.now();
    rafHandle = requestAnimationFrame(tick);
  }

  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
    rafHandle = requestAnimationFrame(tick);
  });
  onDestroy(() => {
    window.removeEventListener("resize", updateSize);
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  });

  function formatMs(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return `0:${String(s).padStart(2, "0")}`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
  }

  // Deutschsprachige Kurz-Labels für die "Wirkt auf"-Zeile. Uppercase, weil
  // das gesamte Widget im LuckiestGuy-Display-Look gerendert wird.
  const KIND_DE: Record<SkillEffectKind, string> = {
    heal: "HEILUNG",
    damage: "SCHADEN",
    healOverTime: "HEILUNG/S",
    damageOverTime: "SCHADEN/S",
    freezeHp: "FREEZE",
    levelUp: "LEVEL ↑",
    levelDown: "LEVEL ↓",
    levelReset: "RESET",
    setLevel: "LEVEL",
    multiplier: "MULT",
    wheel: "RAD",
    extraLife: "EXTRALEBEN",
    none: "—",
  };
  function germanKindList(kinds: SkillEffectKind[]): string {
    if (!kinds || kinds.length === 0) return "—";
    return kinds.map((k) => KIND_DE[k] ?? String(k).toUpperCase()).join(", ");
  }

  // Aktuell aktiver Buff (max. einer). nowMs in der Closure triggert das
  // reaktive Re-Render pro Frame, damit der Timer flüssig läuft.
  $: active = (() => {
    void nowMs;
    return $activeMultipliers.find((m) => m.expiresAtMs > nowMs) ?? null;
  })();

  $: factorText = active ? `${active.factor}×` : "X2";
  $: timerText = active ? formatMs(active.expiresAtMs - nowMs) : "0:30";
  $: targetsText = active
    ? `(${germanKindList(active.multipliedKinds)})`
    : "(HEILUNG, SCHADEN)";

  // Sichtbarkeit: nur wenn aktiv, oder im Edit-Modus mit Temp-Toggle.
  $: showFully = active !== null || (editMode && showInEditMode);

  // Skalierung: identisches Muster wie die Leiter — autoScale (Fenster)
  // mal multiplierScale (User-Resize im Edit-Modus). transform-origin
  // top-left, damit X/Y im Referenz-450-Raum die linke obere Ecke bleiben.
  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: effectiveScale = cfg.multiplierScale * autoScale;
  $: leftPx = Math.round(cfg.multiplierX * autoScale);
  $: topPx = Math.round(cfg.multiplierY * autoScale);

  function shadowCss(s: MultiplierTextStyle): string {
    return s.shadowEnabled
      ? `${s.shadowOffsetX}px ${s.shadowOffsetY}px ${s.shadowBlur}px ${rgbaToCss(s.shadowColor)}`
      : "none";
  }
  function outlineCss(s: MultiplierTextStyle): string {
    return s.outlineEnabled
      ? `${s.outlineSize}px ${rgbaToCss(s.outlineColor)}`
      : "0 transparent";
  }

  $: factorStyle = `
    font-size: ${cfg.multiplierFactorText.fontSize}px;
    color: ${rgbaToCss(cfg.multiplierFactorText.color)};
    text-shadow: ${shadowCss(cfg.multiplierFactorText)};
    -webkit-text-stroke: ${outlineCss(cfg.multiplierFactorText)};
  `;
  $: timerStyle = `
    font-size: ${cfg.multiplierTimerText.fontSize}px;
    color: ${rgbaToCss(cfg.multiplierTimerText.color)};
    text-shadow: ${shadowCss(cfg.multiplierTimerText)};
    -webkit-text-stroke: ${outlineCss(cfg.multiplierTimerText)};
  `;
  $: targetsStyle = `
    font-size: ${cfg.multiplierTargetsText.fontSize}px;
    color: ${rgbaToCss(cfg.multiplierTargetsText.color)};
    text-shadow: ${shadowCss(cfg.multiplierTargetsText)};
    -webkit-text-stroke: ${outlineCss(cfg.multiplierTargetsText)};
  `;
</script>

<div
  class="multiplier"
  class:hidden={!showFully}
  class:placeholder={!active && showFully}
  bind:this={rootEl}
  data-tauri-drag-region={editMode || designMode ? null : true}
  style="
    left: {leftPx}px;
    top: {topPx}px;
    transform: scale({effectiveScale});
  "
>
  <span class="line factor" style={factorStyle}>
    <span
      class="line-inner"
      data-design-target={designMode ? "multiplier.factor" : null}
    >{factorText}</span>
  </span>
  <span class="line timer" style={timerStyle}>
    <span
      class="line-inner"
      data-design-target={designMode ? "multiplier.timer" : null}
    >{timerText}</span>
  </span>
  <span class="line targets" style={targetsStyle}>
    <span
      class="line-inner"
      data-design-target={designMode ? "multiplier.targets" : null}
    >{targetsText}</span>
  </span>
</div>

<style>
  .multiplier {
    position: absolute;
    z-index: 7;
    transform-origin: top left;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    user-select: none;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    line-height: 1;
    text-align: center;
    transition: opacity 220ms ease-out;
  }
  .multiplier.hidden {
    opacity: 0;
  }
  /* Im Edit-Modus ohne echten Buff dimmen wir die Vorschau leicht, damit
     klar ist, dass es ein Platzhalter ist. */
  .multiplier.placeholder {
    opacity: 0.75;
  }
  .line {
    display: block;
  }
  .line + .line {
    margin-top: 0.18em;
  }
  /* Inner-Span = echte Text-Bbox für den Design-Klick. Sonst würde die
     volle Zeilen-Breite die Hit-Box sein. */
  .line-inner {
    display: inline-block;
  }
</style>
