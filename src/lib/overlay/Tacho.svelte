<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AppSettings, LadderState } from "../types";
  import { rgbaToCss } from "../defaults";

  export let cfg: AppSettings;
  export let state: LadderState;
  export let editMode = false;

  let innerEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return innerEl;
  }

  // Basisgröße des Tachos (px im Referenz-450-Raum). Skalierung via tachoScale.
  const TACHO_BASE_SIZE = 360;

  const REFERENCE_WIDTH = 450;
  let windowWidth = REFERENCE_WIDTH;

  function updateSize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
  }
  onMount(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
  });
  onDestroy(() => window.removeEventListener("resize", updateSize));

  // Lebendiges Nadel-Wackeln (zwei inkommensurable Sinus + leichte Drift).
  // Amplitude wächst mit KMH-Level (1 KMH = ruhig, 12 KMH = vibriert mehr).
  let wobbleDeg = 0;
  let wobbleHandle: number | null = null;
  const wobbleStart = performance.now();

  onMount(() => {
    const loop = () => {
      const t = (performance.now() - wobbleStart) / 1000;
      // Level-abhängige Amplitude: 0.8° @ 1 KMH .. 3.2° @ 12 KMH
      const levelFactor = (currentLevel1Based - 1) / 11; // 0..1
      const amp = 0.8 + levelFactor * 2.4;
      const a = amp * Math.sin(t * 2.3);
      const b = amp * 0.45 * Math.sin(t * 6.1 + 1.7);
      wobbleDeg = a + b;
      wobbleHandle = requestAnimationFrame(loop);
    };
    wobbleHandle = requestAnimationFrame(loop);
  });
  onDestroy(() => {
    if (wobbleHandle !== null) cancelAnimationFrame(wobbleHandle);
  });

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: effectiveScale = cfg.tachoScale * autoScale;
  $: effectiveOffsetLeft = cfg.tachoX * autoScale;
  $: effectiveOffsetTop = cfg.tachoY * autoScale;

  // Bogenform: arcDeg = Öffnungswinkel des Bogens (180=Halbkreis, 270=Auto-Tacho).
  // Start-Winkel links unten, Sweep im Uhrzeigersinn nach rechts unten.
  $: arcDeg = Math.max(120, Math.min(300, cfg.tachoArcDegrees));
  // Math-Konvention: 0° = +x, gegen Uhrzeigersinn positiv.
  // Wir wollen den Bogen symmetrisch um 90° (oben) zentriert: von (90 + arc/2) nach (90 - arc/2).
  $: startAngle = 90 + arcDeg / 2;  // erstes Level (1 KMH) links
  $: endAngle = 90 - arcDeg / 2;    // letztes Level (12 KMH) rechts

  // ViewBox: quadratisch, Zentrum (200,200), Radius 160. Bei < 360° schneiden wir unten ab.
  const CX = 200;
  const CY = 200;
  const R = 160;                    // Mittelpunkt des Bogens
  $: thickness = cfg.tachoThickness;
  $: rOuter = R + thickness / 2;
  $: rInner = R - thickness / 2;
  $: rLabel = R + thickness / 2 + 18;
  $: rTickIn = R - thickness / 2 - 4;
  $: rTickOut = R - thickness / 2 - 14;
  $: rNeedle = R - thickness / 2 - 6;

  $: currentLevel1Based = Math.max(1, Math.min(12, state.currentLevel + 1));

  function angleForLevel(level: number): number {
    // level: 1..12 → 0..1
    const f = (level - 1) / 11;
    // startAngle → endAngle (startAngle ist größer, da gegen Uhrzeigersinn)
    return startAngle - f * (startAngle - endAngle);
  }

  function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  // Segment-Bogen pro Level (für die 12 farbigen Abschnitte).
  function arcPath(level: number): string {
    const segWidth = (startAngle - endAngle) / 12;
    const a1 = startAngle - (level - 1) * segWidth;
    const a2 = a1 - segWidth;
    // Kleine Lücke zwischen Segmenten
    const gap = 0.6;
    const aa1 = a1 - gap / 2;
    const aa2 = a2 + gap / 2;

    const p1Outer = polar(CX, CY, rOuter, aa1);
    const p2Outer = polar(CX, CY, rOuter, aa2);
    const p1Inner = polar(CX, CY, rInner, aa1);
    const p2Inner = polar(CX, CY, rInner, aa2);

    const largeArc = Math.abs(aa1 - aa2) > 180 ? 1 : 0;
    // sweep-flag 0 = gegen Uhrzeigersinn (in SVG-koordinaten, da y invertiert)
    // Wir gehen vom kleineren Winkel zum größeren visuell im Uhrzeigersinn? Test: SVG y-flipped.
    // Da wir y invertieren in polar(), entspricht "gegen Uhrzeigersinn in math" einem
    // "gegen Uhrzeigersinn in SVG" — sweep=0.
    return [
      `M ${p1Outer.x} ${p1Outer.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${p2Outer.x} ${p2Outer.y}`,
      `L ${p2Inner.x} ${p2Inner.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 1 ${p1Inner.x} ${p1Inner.y}`,
      "Z",
    ].join(" ");
  }

  // Tick + Label pro Level
  $: levels = Array.from({ length: 12 }, (_, i) => {
    const lvl = i + 1;
    const ang = angleForLevel(lvl);
    const tickIn = polar(CX, CY, rTickIn, ang);
    const tickOut = polar(CX, CY, rTickOut, ang);
    const labelPos = polar(CX, CY, rLabel, ang);
    return { lvl, ang, tickIn, tickOut, labelPos };
  });

  // Needle: smooth zwischen Level-Positionen → CSS rotation reicht.
  $: needleAngle = angleForLevel(currentLevel1Based);
  // SVG rotate ist im Uhrzeigersinn, Math-Winkel im Gegenuhrzeigersinn → negieren.
  // Needle wird "nach oben" gezeichnet (von CY zu CY - rNeedle) und dann rotiert.
  // "Nach oben" entspricht 90° in math → wir wollen rotation = 90 - needleAngle.
  $: needleRotation = 90 - needleAngle;

  $: textShadow = cfg.textShadowEnabled
    ? `${cfg.textShadowOffsetX}px ${cfg.textShadowOffsetY}px 0 ${rgbaToCss(cfg.textShadowColor)}`
    : "none";
  $: outlineStyle = cfg.textOutlineEnabled
    ? buildOutline(cfg.textOutlineSize, rgbaToCss(cfg.textOutlineColor))
    : "none";
  function buildOutline(size: number, color: string): string {
    const out: string[] = [];
    for (let dx = -size; dx <= size; dx++) {
      for (let dy = -size; dy <= size; dy++) {
        if (dx === 0 && dy === 0) continue;
        out.push(`${dx}px ${dy}px 0 ${color}`);
      }
    }
    return out.join(", ");
  }

  // Layout: ViewBox an Bogenform anpassen, damit nichts abgeschnitten wird.
  // Bei arcDeg <= 180 reicht die obere Hälfte; sonst brauchen wir mehr unten.
  $: viewBoxY = arcDeg <= 180 ? 30 : 30;
  $: viewBoxHeight = (() => {
    if (arcDeg <= 180) return 220; // obere Hälfte + Pivot
    // Bei größerem Winkel: berechne untersten Punkt des Bogens
    const lowestAng = endAngle; // (oder startAngle, symmetrisch)
    const p = polar(CX, CY, rLabel, lowestAng);
    return Math.max(220, p.y - viewBoxY + 30);
  })();
</script>

<div class="tacho-wrap" data-tauri-drag-region={editMode ? null : true}>
  <div
    class="tacho"
    bind:this={innerEl}
    data-tauri-drag-region={editMode ? null : true}
    style="
      width: {TACHO_BASE_SIZE}px;
      transform: translate({effectiveOffsetLeft}px, {effectiveOffsetTop}px) scale({effectiveScale});
    "
  >
    <svg
      viewBox="0 {viewBoxY} 400 {viewBoxHeight}"
      width="100%"
      preserveAspectRatio="xMidYMin meet"
    >
      <!-- 12 farbige Segmente -->
      {#each levels as l}
        {@const isActive = l.lvl === currentLevel1Based}
        {@const isPast = l.lvl < currentLevel1Based}
        <path
          d={arcPath(l.lvl)}
          fill={rgbaToCss(cfg.levelColors[l.lvl - 1])}
          opacity={isActive ? 1 : isPast ? 0.9 : 0.28}
          stroke={isActive ? rgbaToCss(cfg.activeOutlineColor) : "none"}
          stroke-width={isActive ? cfg.activeBarOutlineWidth : 0}
        />
      {/each}

      <!-- Ticks (über den Segmenten) -->
      {#each levels as l}
        <line
          x1={l.tickIn.x}
          y1={l.tickIn.y}
          x2={l.tickOut.x}
          y2={l.tickOut.y}
          stroke={rgbaToCss(cfg.textColor)}
          stroke-width={l.lvl === currentLevel1Based ? 3 : 1.5}
          opacity={l.lvl === currentLevel1Based ? 1 : 0.55}
        />
      {/each}

      <!-- Labels 1..12 -->
      {#if cfg.tachoShowLabels}
        {#each levels as l}
          <text
            x={l.labelPos.x}
            y={l.labelPos.y}
            fill={rgbaToCss(cfg.textColor)}
            font-size={cfg.levelTextSize * 0.55}
            font-family="LuckiestGuy, system-ui, sans-serif"
            text-anchor="middle"
            dominant-baseline="central"
            opacity={l.lvl === currentLevel1Based ? 1 : 0.75}
            style="paint-order: stroke; stroke: rgba(0,0,0,0.85); stroke-width: 3px;"
          >
            {l.lvl}
          </text>
        {/each}
      {/if}

      <!-- Nadel: außen = Level-Sprung mit Spring-Transition,
                  innen = kontinuierliches Wackeln (kein transition). -->
      <g
        class="needle"
        style="transform: rotate({needleRotation}deg); transform-origin: {CX}px {CY}px;"
      >
        <g style="transform: rotate({wobbleDeg}deg); transform-origin: {CX}px {CY}px;">
          <!-- Schatten -->
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - rNeedle}
            stroke="rgba(0,0,0,0.6)"
            stroke-width="8"
            stroke-linecap="round"
            transform="translate(2,2)"
          />
          <!-- Nadel selbst -->
          <line
            x1={CX}
            y1={CY + 14}
            x2={CX}
            y2={CY - rNeedle}
            stroke={rgbaToCss(cfg.tachoNeedleColor)}
            stroke-width="5"
            stroke-linecap="round"
          />
          <!-- Spitze -->
          <polygon
            points={`${CX - 4},${CY - rNeedle + 8} ${CX + 4},${CY - rNeedle + 8} ${CX},${CY - rNeedle - 8}`}
            fill={rgbaToCss(cfg.tachoNeedleColor)}
          />
        </g>
      </g>

      <!-- Pivot (Nabe) -->
      <circle cx={CX} cy={CY} r="14" fill={rgbaToCss(cfg.tachoDialBgColor)} stroke={rgbaToCss(cfg.tachoNeedleColor)} stroke-width="2.5" />
      <circle cx={CX} cy={CY} r="5" fill={rgbaToCss(cfg.tachoNeedleColor)} />
    </svg>

    {#if cfg.tachoShowCenterValue}
      <div
        class="center-value"
        style="
          color: {rgbaToCss(cfg.textColor)};
          font-size: {cfg.levelTextSize * 1.6}px;
          text-shadow: {textShadow}, {outlineStyle};
        "
      >
        {currentLevel1Based}<span class="unit">KMH</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .tacho-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .tacho {
    position: relative;
    transform-origin: top left;
    line-height: 0;
  }
  .tacho svg {
    display: block;
    overflow: visible;
  }
  .needle {
    transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .center-value {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 18%;
    text-align: center;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    letter-spacing: 1px;
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }
  .center-value .unit {
    font-size: 0.45em;
    margin-left: 0.25em;
    opacity: 0.85;
  }
</style>
