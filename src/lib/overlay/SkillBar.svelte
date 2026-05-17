<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type {
    AppSettings,
    LadderState,
    Skill,
    SkillEffect,
    SkillRule,
    SkillTextStyle,
  } from "../types";
  import { rgbaToCss } from "../defaults";
  import {
    skillIconUrl,
    skillGiftUrl,
    skillRuntime,
    findMatchingRule,
  } from "../stores";

  export let cfg: AppSettings;
  export let state: LadderState;
  export let editMode = false;
  export let designMode = false;

  let rootEl: HTMLDivElement;
  export function getElement(): HTMLDivElement | undefined {
    return rootEl;
  }

  const REFERENCE_WIDTH = 450;
  let windowWidth = REFERENCE_WIDTH;
  function updateSize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
  }

  let cooldownTick = 0;
  let rafHandle: number | null = null;
  function tick() {
    cooldownTick = Date.now();
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

  $: autoScale = windowWidth / REFERENCE_WIDTH;
  $: slotPx = Math.round(cfg.skillBarSlotSize * autoScale);
  $: gapPx = Math.round(cfg.skillBarGap * autoScale);
  $: leftPx = Math.round(cfg.skillBarX * autoScale);
  $: topPx = Math.round(cfg.skillBarY * autoScale);

  type SlotInfo = {
    skill: Skill;
    matchedRule: SkillRule | null;
    previewRule: SkillRule | null;
    active: boolean;
    cooldownFrac: number;
    cooldownLeftMs: number;
  };

  function computeSlotInfo(
    skill: Skill,
    state: LadderState,
    cfg: AppSettings,
    runtime: Record<number, { cooldownUntilMs: number }>,
    _tick: number,
  ): SlotInfo {
    const level1 = state.currentLevel + 1;
    const hpPct =
      cfg.streamHpEnabled
        ? (Math.max(0, state.hp) / Math.max(1, cfg.streamHpMax)) * 100
        : 100;
    const matched = findMatchingRule(skill, level1, hpPct);
    const preview = matched ?? skill.rules[0] ?? null;
    const rt = runtime[skill.id];
    const now = Date.now();
    const left = rt ? Math.max(0, rt.cooldownUntilMs - now) : 0;
    const totalMs = Math.max(1, skill.cooldownSec * 1000);
    const frac = totalMs > 0 ? Math.min(1, left / totalMs) : 0;
    return {
      skill,
      matchedRule: matched,
      previewRule: preview,
      active: matched !== null && left === 0,
      cooldownFrac: frac,
      cooldownLeftMs: left,
    };
  }

  $: runtime = $skillRuntime;
  $: slots = cfg.skills
    .map((s) => computeSlotInfo(s, state, cfg, runtime, cooldownTick))
    .filter((info) => cfg.skillBarShowInactive || info.matchedRule !== null);

  // === Status-Effekt-Text aus dem ersten Effekt der (Preview-)Regel ===
  function valueTextFor(rule: SkillRule | null): string | null {
    if (!rule || rule.effects.length === 0) return null;
    const e: SkillEffect = rule.effects[0];
    switch (e.kind) {
      case "heal":
        return `+${e.amount}`;
      case "damage":
        return `−${e.amount}`;
      case "levelUp":
        return "Lvl ↑";
      case "levelDown":
        return "Lvl ↓";
      case "levelReset":
        return "Reset";
      case "setLevel":
        return `→${e.level ?? "?"}`;
      case "multiplier":
        return `${e.factor ?? 1}×`;
      case "wheel":
        return "🎰";
      case "none":
        return "—";
    }
  }

  // Text skaliert mit der Slot-Größe (nicht nur mit der Window-Breite). 64px
  // ist die kanonische Default-Slot-Größe — bei dieser Größe gilt
  // style.fontSize 1:1, bei 128px werden Text/Outline/Shadow doppelt so groß.
  // Damit bleibt das Verhältnis Icon ↔ Text konstant, wenn man im Edit-Modus
  // skaliert.
  const SLOT_REF_SIZE = 64;
  function textStyleCss(style: SkillTextStyle, slotPx: number): string {
    const slotScale = slotPx / SLOT_REF_SIZE;
    const fontPx = Math.max(8, style.fontSize * slotScale);
    const outlinePx = style.outlineEnabled ? Math.max(0, style.outlineSize * slotScale) : 0;
    const stroke = style.outlineEnabled
      ? `${outlinePx}px ${rgbaToCss(style.outlineColor)}`
      : "0 transparent";
    const shadow = style.shadowEnabled
      ? `${style.shadowOffsetX * slotScale}px ${style.shadowOffsetY * slotScale}px ${Math.max(0, style.shadowSize * slotScale)}px ${rgbaToCss(style.shadowColor)}`
      : "none";
    return `
      font-size: ${fontPx}px;
      font-weight: ${style.weight};
      color: ${rgbaToCss(style.color)};
      -webkit-text-stroke: ${stroke};
      text-shadow: ${shadow};
    `;
  }

  function textPositionCss(style: SkillTextStyle, slot: number): string {
    const left = style.offsetX * slot;
    const top = style.offsetY * slot;
    return `
      left: ${left}px;
      top: ${top}px;
      transform: translate(-50%, -50%);
    `;
  }
</script>

<div
  class="skill-bar"
  bind:this={rootEl}
  data-tauri-drag-region={editMode || designMode ? null : true}
  style="
    left: {leftPx}px;
    top: {topPx}px;
    gap: {gapPx}px;
  "
>
  {#each slots as info (info.skill.id)}
    {@const skill = info.skill}
    {@const rule = info.previewRule}
    {@const iconUrl = skillIconUrl(skill)}
    {@const inactive = !info.active}
    {@const override = (skill.valueTextOverride ?? "").trim()}
    {@const valueTxt = override !== "" ? override : valueTextFor(rule)}
    {@const chance = rule?.probability ?? 100}
    {@const showChance = chance < 100 && cfg.skillChanceText.enabled}
    {@const wheelDeg = Math.max(0, Math.min(360, chance * 3.6))}
    <div
      class="slot"
      class:inactive
      class:on-cooldown={info.cooldownLeftMs > 0}
      class:framed={cfg.skillBarStyle !== "clean"}
      class:clean={cfg.skillBarStyle === "clean"}
      data-design-target={designMode ? "skill.slot" : null}
      style="width: {slotPx}px; height: {slotPx}px;"
      title={skill.name}
    >
      {#if cfg.skillBarStyle !== "clean"}
        <div class="slot-bg"></div>
      {/if}

      {#if iconUrl}
        <img class="slot-icon" src={iconUrl} alt={skill.name} draggable="false" />
      {:else}
        <div class="slot-fallback">
          <span class="slot-id">#{skill.id}</span>
        </div>
      {/if}

      {#if info.cooldownLeftMs > 0}
        <div
          class="cooldown-sweep"
          style="
            background: conic-gradient(
              from 0deg,
              rgba(0,0,0,0.78) {info.cooldownFrac * 360}deg,
              rgba(0,0,0,0) {info.cooldownFrac * 360}deg
            );
          "
        ></div>
        <span class="cooldown-text" style="font-size: {Math.max(11, slotPx * 0.3)}px;">
          {(info.cooldownLeftMs / 1000).toFixed(1)}
        </span>
      {/if}

      {#if info.matchedRule === null && cfg.skillBarShowInactive && cfg.skillBarStyle !== "clean"}
        <div class="locked-veil"></div>
      {/if}

      <!-- Gift-Overlay (zeigt das TikTok-Geschenk, das diesen Skill triggert) -->
      {#if cfg.skillGiftStyle.enabled}
        {@const giftUrl = skillGiftUrl(skill)}
        {#if giftUrl}
          {@const giftPx = Math.max(4, slotPx * cfg.skillGiftStyle.sizeFrac)}
          {@const giftLeft = cfg.skillGiftStyle.offsetX * slotPx}
          {@const giftTop = cfg.skillGiftStyle.offsetY * slotPx}
          {@const gs = cfg.skillGiftStyle}
          {@const sc = gs.shadowColor}
          {@const giftFilter = gs.shadowEnabled
            ? `drop-shadow(${gs.shadowOffsetX}px ${gs.shadowOffsetY}px ${Math.max(0, gs.shadowSize)}px rgba(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)},${sc.a}))`
            : 'none'}
          <img
            class="slot-gift"
            data-design-target={designMode ? "skill.gift" : null}
            src={giftUrl}
            alt=""
            draggable="false"
            style="
              width: {giftPx}px;
              height: {giftPx}px;
              left: {giftLeft}px;
              top: {giftTop}px;
              opacity: {gs.opacity};
              filter: {giftFilter};
            "
          />
        {/if}
      {/if}

      <!-- Status-Effekt-Text -->
      {#if cfg.skillValueText.enabled && valueTxt}
        <span
          class="slot-text value-text"
          data-design-target={designMode ? "skill.valueText" : null}
          style="
            {textStyleCss(cfg.skillValueText, slotPx)}
            {textPositionCss(cfg.skillValueText, slotPx)}
          "
        >
          {valueTxt}
        </span>
      {/if}

      <!-- Wahrscheinlichkeits-Pille: Mini-Rad + Text -->
      {#if showChance}
        <div
          class="slot-text chance-pill"
          class:cleanChance={cfg.skillBarStyle === "clean"}
          data-design-target={designMode ? "skill.chanceText" : null}
          style="
            {textStyleCss(cfg.skillChanceText, slotPx)}
            {textPositionCss(cfg.skillChanceText, slotPx)}
          "
        >
          {#if cfg.skillMiniWheelEnabled}
            <span
              class="mini-wheel"
              style="
                width: {Math.max(10, slotPx * 0.22)}px;
                height: {Math.max(10, slotPx * 0.22)}px;
                background: conic-gradient(
                  from -90deg,
                  #22c55e 0deg,
                  #22c55e {wheelDeg}deg,
                  #ef4444 {wheelDeg}deg,
                  #ef4444 360deg
                );
              "
            ></span>
          {/if}
          <span class="chance-text">{chance}%</span>
        </div>
      {/if}
    </div>
  {/each}

  {#if slots.length === 0 && editMode}
    <div class="slot empty-placeholder" style="width: {slotPx}px; height: {slotPx}px;">
      <span class="placeholder-text">Skills</span>
    </div>
  {/if}
</div>

<style>
  .skill-bar {
    position: absolute;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    pointer-events: none;
    z-index: 6;
  }
  .slot {
    position: relative;
    flex-shrink: 0;
    border-radius: 14%;
    overflow: visible;
    isolation: isolate;
    transition: filter 180ms, opacity 180ms;
  }
  .slot.inactive {
    filter: grayscale(0.85) brightness(0.55);
    opacity: 0.7;
  }
  .slot.on-cooldown .slot-icon {
    filter: brightness(0.75);
  }
  /* Clean-Modus: kein Kasten/Hintergrund, Icon füllt den ganzen Slot. */
  .slot.clean .slot-icon {
    inset: 0;
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
  }
  .slot-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        circle at 30% 22%,
        rgba(255, 255, 255, 0.18) 0%,
        rgba(255, 255, 255, 0) 60%
      ),
      linear-gradient(155deg, #25344a 0%, #0e1623 100%);
    border: 2px solid rgba(255, 255, 255, 0.18);
    border-radius: 14%;
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      inset 0 -3px 6px rgba(0, 0, 0, 0.4);
  }
  .slot-icon {
    position: absolute;
    inset: 6%;
    width: 88%;
    height: 88%;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
  }
  /* Gift-Badge: per absolute Position + offset gesteuert (Design-Modus). */
  .slot-gift {
    position: absolute;
    object-fit: contain;
    transform: translate(-50%, -50%);
    user-select: none;
    pointer-events: none;
    z-index: 2;
  }
  .slot-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.55);
    font-family: var(--font-mono, monospace);
  }
  .slot-id {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .cooldown-sweep {
    position: absolute;
    inset: 0;
    border-radius: 14%;
    pointer-events: none;
  }
  .cooldown-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    font-weight: 800;
    text-shadow:
      0 0 6px rgba(0, 0, 0, 0.9),
      2px 2px 0 rgba(0, 0, 0, 0.9);
    -webkit-text-stroke: 1px rgba(0, 0, 0, 0.8);
    user-select: none;
    pointer-events: none;
  }
  .locked-veil {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(
        45deg,
        rgba(0, 0, 0, 0) 0 6px,
        rgba(0, 0, 0, 0.25) 6px 12px
      );
    border-radius: 14%;
    pointer-events: none;
  }

  .slot-text {
    position: absolute;
    white-space: nowrap;
    font-family: "LuckiestGuy", var(--font-display, system-ui), sans-serif;
    line-height: 1;
    user-select: none;
    pointer-events: none;
  }

  .chance-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(15, 23, 42, 0.78);
    padding: 2px 7px 2px 4px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
  }
  /* Clean-Modus: kein Pillen-Hintergrund, nur Mini-Rad + Text. */
  .chance-pill.cleanChance {
    background: transparent;
    border-color: transparent;
    padding: 0;
  }
  .mini-wheel {
    flex-shrink: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.92);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.7),
      0 1px 2px rgba(0, 0, 0, 0.5);
    display: inline-block;
  }
  .chance-text {
    display: inline-block;
  }

  .empty-placeholder {
    background: rgba(0, 0, 0, 0.3);
    border: 1px dashed rgba(255, 255, 255, 0.3);
    border-radius: 14%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .placeholder-text {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-family: var(--font-ui, system-ui);
  }
</style>
