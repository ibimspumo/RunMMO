<script lang="ts">
  import type {
    AppSettings,
    Skill,
    SkillRule,
    SkillEffect,
    SkillEffectKind,
    WheelSegment,
  } from "../../types";
  import {
    Button,
    Callout,
    Card,
    ColorField,
    Field,
    GiftPicker,
    NumberInput,
    SectionHeader,
    SkillIconPicker,
    SoundPicker,
    Toggle,
  } from "../../ui";

  export let cfg: AppSettings;

  // Effect-Kinds, die im Skill-Editor auswählbar sind. Die `inWheel`-Flag
  // steuert, ob ein Kind auch innerhalb eines Wheel-Sektors angeboten wird —
  // verschachteltes "Rad im Rad" wird absichtlich ausgeschlossen, damit der
  // Editor übersichtlich bleibt.
  const effectKindOptions: {
    value: SkillEffectKind;
    label: string;
    inWheel: boolean;
  }[] = [
    { value: "heal", label: "Heilen (+HP)", inWheel: true },
    { value: "damage", label: "Schaden (−HP)", inWheel: true },
    { value: "healOverTime", label: "Heilung pro Sekunde", inWheel: true },
    { value: "damageOverTime", label: "Schaden pro Sekunde", inWheel: true },
    { value: "freezeHp", label: "Leben einfrieren", inWheel: true },
    { value: "extraLife", label: "Extraleben (Revive)", inWheel: true },
    { value: "levelUp", label: "Level hoch", inWheel: true },
    { value: "levelDown", label: "Level runter", inWheel: true },
    { value: "levelReset", label: "Level reset", inWheel: true },
    { value: "setLevel", label: "Level X setzen", inWheel: true },
    { value: "multiplier", label: "Multiplikator (×)", inWheel: true },
    { value: "wheel", label: "Glücksrad", inWheel: false },
    { value: "none", label: "Niete (keine Wirkung)", inWheel: true },
  ];

  // Basis-Skelett mit allen Pflicht-Feldern. Wir füllen dann pro Kind die
  // Felder, die wirklich relevant sind, mit sinnvollen Werten.
  function blankEffect(kind: SkillEffectKind): SkillEffect {
    return {
      kind,
      amount: 0,
      level: 1,
      durationSec: 0,
      factor: 1,
      multipliedKinds: [],
      segments: [],
      label: "",
      soundPath: null,
    };
  }

  // Effekt-Defaults beim Anlegen eines neuen Effekts pro Kind.
  function defaultEffectFor(kind: SkillEffectKind): SkillEffect {
    const base = blankEffect(kind);
    switch (kind) {
      case "heal":
      case "damage":
        return { ...base, amount: 100 };
      case "healOverTime":
      case "damageOverTime":
        return { ...base, amount: 10, durationSec: 10 };
      case "freezeHp":
        return { ...base, durationSec: 10 };
      case "extraLife":
        return { ...base, amount: 50, level: 1 };
      case "setLevel":
        return { ...base, level: 6, durationSec: 30 };
      case "multiplier":
        return {
          ...base,
          factor: 2,
          durationSec: 60,
          multipliedKinds: ["heal", "damage"],
        };
      case "wheel":
        return {
          ...base,
          segments: [
            { label: "Heal", color: { r: 0.13, g: 0.77, b: 0.37, a: 1 }, weight: 1, effects: [{ ...blankEffect("heal"), amount: 200 }], soundPath: null },
            { label: "Damage", color: { r: 0.94, g: 0.27, b: 0.27, a: 1 }, weight: 1, effects: [{ ...blankEffect("damage"), amount: 100 }], soundPath: null },
            { label: "Niete", color: { r: 0.4, g: 0.4, b: 0.45, a: 1 }, weight: 2, effects: [blankEffect("none")], soundPath: null },
          ],
        };
      default:
        return base;
    }
  }

  // Beim Kind-Wechsel: nur das `kind` und die kind-spezifischen Defaults
  // ersetzen, alle anderen Werte vom alten Effekt durchreichen.
  function applyKindChange(eff: SkillEffect, next: SkillEffectKind): SkillEffect {
    const fresh = defaultEffectFor(next);
    // Bei Wechsel auf wheel: Default-Segmente vorgeben (statt leerem Array).
    const segments = next === "wheel" && eff.segments.length === 0
      ? fresh.segments
      : eff.segments;
    return {
      ...eff,
      kind: next,
      // Beim Wechsel auf einen Buff-/Setter-Kind: ggf. sinnvolle Mindestwerte
      // einsetzen, wenn der bisherige Effekt keine relevanten Werte hatte.
      level: eff.level || fresh.level,
      durationSec: eff.durationSec || fresh.durationSec,
      factor: eff.factor || fresh.factor,
      multipliedKinds:
        eff.multipliedKinds.length > 0 ? eff.multipliedKinds : fresh.multipliedKinds,
      segments,
    };
  }

  let expanded: Record<number, boolean> = {};

  function bumpSkills() {
    cfg.skills = cfg.skills;
  }

  function nextSkillId(): number {
    const used = new Set(cfg.skills.map((s) => s.id));
    let id = 1;
    while (used.has(id)) id++;
    return id;
  }

  function newRule(): SkillRule {
    return { conditions: [], effects: [], probability: 100 };
  }

  function newSkill(): Skill {
    const id = nextSkillId();
    return {
      id,
      name: `Skill ${id}`,
      iconPath: null,
      giftIconPath: null,
      rules: [newRule()],
      cooldownSec: 0,
      valueTextOverride: "",
      soundPath: null,
    };
  }

  function addSkill() {
    const s = newSkill();
    cfg.skills = [...cfg.skills, s];
    expanded = { ...expanded, [s.id]: true };
  }

  function removeSkill(idx: number) {
    const s = cfg.skills[idx];
    if (!confirm(`Skill "${s.name}" wirklich löschen?`)) return;
    cfg.skills = cfg.skills.filter((_, i) => i !== idx);
  }

  function moveSkill(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= cfg.skills.length) return;
    const arr = [...cfg.skills];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    cfg.skills = arr;
  }

  function addRule(skillIdx: number) {
    cfg.skills[skillIdx].rules.push(newRule());
    bumpSkills();
  }

  function removeRule(skillIdx: number, ruleIdx: number) {
    cfg.skills[skillIdx].rules.splice(ruleIdx, 1);
    bumpSkills();
  }

  function moveRule(skillIdx: number, ruleIdx: number, dir: -1 | 1) {
    const rules = cfg.skills[skillIdx].rules;
    const j = ruleIdx + dir;
    if (j < 0 || j >= rules.length) return;
    [rules[ruleIdx], rules[j]] = [rules[j], rules[ruleIdx]];
    bumpSkills();
  }

  function addCondition(skillIdx: number, ruleIdx: number) {
    cfg.skills[skillIdx].rules[ruleIdx].conditions.push({
      minKmh: null,
      maxKmh: null,
      minHpPct: null,
      maxHpPct: null,
    });
    bumpSkills();
  }

  function removeCondition(skillIdx: number, ruleIdx: number, condIdx: number) {
    cfg.skills[skillIdx].rules[ruleIdx].conditions.splice(condIdx, 1);
    bumpSkills();
  }

  function addEffect(skillIdx: number, ruleIdx: number) {
    cfg.skills[skillIdx].rules[ruleIdx].effects.push(defaultEffectFor("heal"));
    bumpSkills();
  }

  function removeEffect(skillIdx: number, ruleIdx: number, effIdx: number) {
    cfg.skills[skillIdx].rules[ruleIdx].effects.splice(effIdx, 1);
    bumpSkills();
  }

  function describeEffect(e: SkillEffect): string {
    switch (e.kind) {
      case "heal":
        return `+${e.amount} HP`;
      case "damage":
        return `−${e.amount} HP`;
      case "healOverTime":
        return `+${e.amount}/s · ${e.durationSec}s`;
      case "damageOverTime":
        return `−${e.amount}/s · ${e.durationSec}s`;
      case "freezeHp":
        return `❄ ${e.durationSec}s`;
      case "extraLife":
        return `+${e.level ?? 1} ❤ → ${e.amount ?? 50}%`;
      case "levelUp":
        return "Level +1";
      case "levelDown":
        return "Level −1";
      case "levelReset":
        return "Level → 1";
      case "setLevel":
        return `→${e.level ?? "?"} KMH${(e.durationSec ?? 0) > 0 ? ` ${e.durationSec}s` : ""}`;
      case "multiplier":
        return `${e.factor ?? 1}× ${e.durationSec ?? 0}s`;
      case "wheel":
        return `Rad (${(e.segments ?? []).length} Sektoren)`;
      case "none":
        return "Niete";
    }
  }

  // === Wheel-Segment-Helpers ===
  function addSegment(eff: SkillEffect) {
    if (!eff.segments) eff.segments = [];
    eff.segments.push({
      label: "Sektor",
      color: { r: 0.4, g: 0.5, b: 0.8, a: 1 },
      weight: 1,
      effects: [blankEffect("none")],
      soundPath: null,
    });
    bumpSkills();
  }
  function removeSegment(eff: SkillEffect, idx: number) {
    if (!eff.segments) return;
    eff.segments.splice(idx, 1);
    bumpSkills();
  }
  function moveSegment(eff: SkillEffect, idx: number, dir: -1 | 1) {
    if (!eff.segments) return;
    const j = idx + dir;
    if (j < 0 || j >= eff.segments.length) return;
    [eff.segments[idx], eff.segments[j]] = [eff.segments[j], eff.segments[idx]];
    bumpSkills();
  }
  function totalWeight(segs: WheelSegment[]): number {
    return segs.reduce(
      (a, s) => a + (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0),
      0,
    );
  }
  function segmentPct(segs: WheelSegment[], i: number): number {
    const tot = totalWeight(segs);
    if (tot <= 0) return 0;
    const w = Number.isFinite(segs[i].weight) && segs[i].weight > 0 ? segs[i].weight : 0;
    return (w / tot) * 100;
  }

  // Effekte innerhalb eines Sektors. Eigener Helper-Set, damit nicht das
  // top-level Skill-Array tangiert wird.
  function addSegmentEffect(seg: WheelSegment) {
    seg.effects.push(defaultEffectFor("heal"));
    bumpSkills();
  }
  function removeSegmentEffect(seg: WheelSegment, idx: number) {
    seg.effects.splice(idx, 1);
    bumpSkills();
  }

  // Multiplier-Kinds: nur Werte-tragende Effekt-Kinds machen Sinn als
  // "multiplizierbar". Aktuell heal + damage. Level-Effekte werden bewusst
  // nicht angeboten (haben keinen Wert, der skaliert).
  const MULTIPLIABLE_KINDS: { value: SkillEffectKind; label: string }[] = [
    { value: "heal", label: "Heilung-Beträge" },
    { value: "damage", label: "Schaden-Beträge" },
    { value: "healOverTime", label: "Heilung/s-Beträge" },
    { value: "damageOverTime", label: "Schaden/s-Beträge" },
    { value: "freezeHp", label: "Freeze-Dauer" },
  ];

  function toggleMultiplierKind(eff: SkillEffect, kind: SkillEffectKind) {
    if (!eff.multipliedKinds) eff.multipliedKinds = [];
    const idx = eff.multipliedKinds.indexOf(kind);
    if (idx >= 0) eff.multipliedKinds.splice(idx, 1);
    else eff.multipliedKinds.push(kind);
    bumpSkills();
  }

  // Helpers für inline-Event-Handler: Type-Casts im Template machen den
  // Svelte-Parser unglücklich, also delegieren wir.
  function changeEffectKind(
    arr: SkillEffect[],
    idx: number,
    selectEl: EventTarget | null,
  ) {
    if (!(selectEl instanceof HTMLSelectElement)) return;
    const k = selectEl.value as SkillEffectKind;
    arr[idx] = applyKindChange(arr[idx], k);
    bumpSkills();
  }

  function ruleSummary(r: SkillRule): string {
    const eff =
      r.effects.length === 0
        ? "Keine Effekte"
        : r.effects.map(describeEffect).join(", ");
    const cond =
      r.conditions.length === 0
        ? "immer"
        : `${r.conditions.length} Gruppe(n)`;
    const prob = r.probability < 100 ? ` · ${r.probability}%` : "";
    return `${eff}  ·  ${cond}${prob}`;
  }

  // Native input → null bei leer
  function toNullableNumber(v: string): number | null {
    return v === "" ? null : Number(v);
  }

  $: idCounts = (() => {
    const c: Record<number, number> = {};
    for (const s of cfg.skills) c[s.id] = (c[s.id] || 0) + 1;
    return c;
  })();
  $: hasDuplicateIds = Object.values(idCounts).some((c) => c > 1);
</script>

<SectionHeader
  title="Skills"
  description="Baukasten für Webhook-Effekte mit Bedingungen, Effekten und optionaler Wahrscheinlichkeit. Jeder Skill hat eine eindeutige ID und wird über GET /skill?id=N getriggert. Mehrere Regeln pro Skill werden in Reihenfolge geprüft — die erste, deren Bedingungen erfüllt sind, feuert."
/>

{#if cfg.mode !== "mmo"}
  <Callout variant="warn">
    Skills sind nur im <strong>MMO-Modus</strong> aktiv. Im aktuellen Modus
    werden sie ignoriert.
  </Callout>
{/if}

{#if hasDuplicateIds}
  <Callout variant="warn">
    Mehrere Skills teilen sich eine ID. Webhook-Calls treffen dann immer den
    ersten in der Liste — Duplikate vergeben oder löschen.
  </Callout>
{/if}

<Card>
  <div class="add-row">
    <Button variant="primary" size="md" on:click={addSkill}>+ Neuer Skill</Button>
    <span class="hint-text">
      {cfg.skills.length === 0
        ? "Noch keine Skills angelegt."
        : `${cfg.skills.length} Skill${cfg.skills.length === 1 ? "" : "s"}`}
    </span>
  </div>
</Card>

{#each cfg.skills as skill, sIdx (skill.id + "-" + sIdx)}
  {@const dup = idCounts[skill.id] > 1}
  <Card>
    <div class="skill-head">
      <button
        class="skill-toggle"
        on:click={() =>
          (expanded = { ...expanded, [skill.id]: !expanded[skill.id] })}
        title={expanded[skill.id] ? "Einklappen" : "Aufklappen"}
      >
        <span class="chev" class:open={expanded[skill.id]}>▶</span>
        <span class="skill-id" class:dup>#{skill.id}</span>
        <span class="skill-name">{skill.name || "Unbenannter Skill"}</span>
      </button>

      <div class="skill-actions">
        <button
          class="mini-btn"
          on:click={() => moveSkill(sIdx, -1)}
          disabled={sIdx === 0}
          title="Nach oben"
        >▲</button>
        <button
          class="mini-btn"
          on:click={() => moveSkill(sIdx, 1)}
          disabled={sIdx === cfg.skills.length - 1}
          title="Nach unten"
        >▼</button>
        <button
          class="mini-btn danger"
          on:click={() => removeSkill(sIdx)}
          title="Skill löschen"
        >✕</button>
      </div>
    </div>

    {#if !expanded[skill.id]}
      <div class="skill-preview">
        {#each skill.rules as r, i}
          <span class="rule-chip">
            <span class="rule-chip-i">{i + 1}.</span>
            {ruleSummary(r)}
          </span>
        {:else}
          <span class="muted">Keine Regeln</span>
        {/each}
      </div>
    {/if}

    {#if expanded[skill.id]}
      <div class="skill-body">
        <Field label="Name">
          <input
            type="text"
            class="text-input"
            bind:value={skill.name}
            placeholder="z.B. Heilung"
          />
        </Field>

        <Field
          label="Skill-ID"
          hint="Wird vom Webhook-Aufruf verwendet: /skill?id={skill.id}"
        >
          <NumberInput bind:value={skill.id} min={1} max={9999} />
        </Field>

        <Field label="Icon" hint="Bibliothek mit allen Stil-Varianten — Klick zum Wechseln. Oder eigenes Bild hochladen.">
          <SkillIconPicker
            value={skill.iconPath}
            on:change={(e) => {
              skill.iconPath = e.detail;
              bumpSkills();
            }}
          />
        </Field>

        <Field
          label="TikTok-Gift"
          hint="Optionales Geschenk-Bild, das auf dem Slot eingeblendet wird, damit Zuschauer sehen, welches Gift diesen Skill triggert. ~590 TikTok-Gifts in der Bibliothek oder eigenes Bild."
        >
          <GiftPicker
            value={skill.giftIconPath}
            on:change={(e) => {
              skill.giftIconPath = e.detail;
              bumpSkills();
            }}
          />
        </Field>

        <Field
          label="Cooldown"
          hint="Sekunden Sperrzeit nach Auslösung. 0 = kein Cooldown."
        >
          <NumberInput
            bind:value={skill.cooldownSec}
            min={0}
            max={3600}
            step={1}
            suffix="s"
          />
        </Field>

        <Field
          label="Sound"
          hint={"Wird bei jedem Effekt dieses Skills gespielt. Effekt- oder Wheel-Segment-Sounds überschreiben diesen (Kaskade: Effekt > Segment > Skill)."}
        >
          <SoundPicker
            value={skill.soundPath}
            placeholder="Kein Sound"
            on:change={(e) => {
              skill.soundPath = e.detail;
              bumpSkills();
            }}
          />
        </Field>

        <Field
          label="Slot-Text"
          hint="Eigener Text unter dem Icon (z.B. „Rad“, „BOOM“, „+200“). Leer = automatisch aus dem Effekt der ersten Regel ableiten."
        >
          <input
            type="text"
            class="text-input"
            bind:value={skill.valueTextOverride}
            placeholder="Auto"
          />
        </Field>

        <div class="rules-head">
          <span class="rules-title">Regeln</span>
          <span class="rules-hint">Erste passende Regel feuert.</span>
        </div>

        {#each skill.rules as rule, rIdx (rIdx)}
          <div class="rule">
            <div class="rule-head">
              <span class="rule-num">Regel {rIdx + 1}</span>
              <div class="rule-actions">
                <button
                  class="mini-btn"
                  on:click={() => moveRule(sIdx, rIdx, -1)}
                  disabled={rIdx === 0}
                  title="Nach oben"
                >▲</button>
                <button
                  class="mini-btn"
                  on:click={() => moveRule(sIdx, rIdx, 1)}
                  disabled={rIdx === skill.rules.length - 1}
                  title="Nach unten"
                >▼</button>
                <button
                  class="mini-btn danger"
                  on:click={() => removeRule(sIdx, rIdx)}
                  disabled={skill.rules.length <= 1}
                  title="Regel löschen"
                >✕</button>
              </div>
            </div>

            <div class="sub-head">
              <span class="sub-title">Bedingungen</span>
              <span class="sub-hint">
                {rule.conditions.length === 0
                  ? "Leer = immer erfüllt."
                  : "Mehrere Gruppen sind ODER-verknüpft."}
              </span>
            </div>

            {#each rule.conditions as cond, cIdx (cIdx)}
              <div class="cond-group">
                <div class="cond-row">
                  <span class="cond-label">KMH</span>
                  <span class="cond-from">von</span>
                  <input
                    type="number"
                    class="cond-input"
                    min="1"
                    max="12"
                    placeholder="—"
                    value={cond.minKmh ?? ""}
                    on:input={(e) =>
                      ((cond.minKmh = toNullableNumber(e.currentTarget.value)),
                      bumpSkills())}
                  />
                  <span class="cond-from">bis</span>
                  <input
                    type="number"
                    class="cond-input"
                    min="1"
                    max="12"
                    placeholder="—"
                    value={cond.maxKmh ?? ""}
                    on:input={(e) =>
                      ((cond.maxKmh = toNullableNumber(e.currentTarget.value)),
                      bumpSkills())}
                  />
                </div>
                <div class="cond-row">
                  <span class="cond-label">HP %</span>
                  <span class="cond-from">von</span>
                  <input
                    type="number"
                    class="cond-input"
                    min="0"
                    max="100"
                    placeholder="—"
                    value={cond.minHpPct ?? ""}
                    on:input={(e) =>
                      ((cond.minHpPct = toNullableNumber(e.currentTarget.value)),
                      bumpSkills())}
                  />
                  <span class="cond-from">bis</span>
                  <input
                    type="number"
                    class="cond-input"
                    min="0"
                    max="100"
                    placeholder="—"
                    value={cond.maxHpPct ?? ""}
                    on:input={(e) =>
                      ((cond.maxHpPct = toNullableNumber(e.currentTarget.value)),
                      bumpSkills())}
                  />
                  <button
                    class="mini-btn danger group-rm"
                    on:click={() => removeCondition(sIdx, rIdx, cIdx)}
                    title="ODER-Gruppe entfernen"
                  >✕</button>
                </div>
              </div>
            {/each}

            <Button
              variant="ghost"
              size="sm"
              on:click={() => addCondition(sIdx, rIdx)}
            >
              + {rule.conditions.length === 0 ? "Bedingung" : "ODER-Bedingung"}
            </Button>

            <div class="sub-head">
              <span class="sub-title">Effekte</span>
              <span class="sub-hint">Werden in Reihenfolge ausgeführt.</span>
            </div>

            {#each rule.effects as eff, eIdx (eIdx)}
              <div class="effect-block">
                <div class="effect-row">
                  <select
                    class="eff-kind"
                    value={eff.kind}
                    on:change={(e) => changeEffectKind(rule.effects, eIdx, e.currentTarget)}
                  >
                    {#each effectKindOptions as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                  <button
                    class="mini-btn danger"
                    on:click={() => removeEffect(sIdx, rIdx, eIdx)}
                    title="Effekt entfernen"
                  >✕</button>
                </div>

                <!-- Pro Effekt-Kind: passendes Parameter-Set. -->
                {#if eff.kind === "heal" || eff.kind === "damage"}
                  <div class="param-row">
                    <span class="param-label">Betrag</span>
                    <NumberInput
                      bind:value={eff.amount}
                      min={1}
                      max={100000}
                      suffix="HP"
                      width="120px"
                    />
                  </div>
                {:else if eff.kind === "healOverTime" || eff.kind === "damageOverTime"}
                  <div class="param-row">
                    <span class="param-label">Betrag</span>
                    <NumberInput
                      bind:value={eff.amount}
                      min={0.1}
                      max={10000}
                      step={0.5}
                      suffix="HP/s"
                      width="120px"
                    />
                  </div>
                  <div class="param-row">
                    <span class="param-label">Dauer</span>
                    <NumberInput
                      bind:value={eff.durationSec}
                      min={1}
                      max={600}
                      step={1}
                      suffix="s"
                      width="100px"
                    />
                    <span class="param-hint">
                      Gesamtwirkung: {(eff.amount * eff.durationSec).toFixed(0)} HP
                    </span>
                  </div>
                {:else if eff.kind === "freezeHp"}
                  <div class="param-row">
                    <span class="param-label">Dauer</span>
                    <NumberInput
                      bind:value={eff.durationSec}
                      min={1}
                      max={600}
                      step={1}
                      suffix="s"
                      width="100px"
                    />
                    <span class="param-hint">
                      HP-Drain ist für diese Zeit pausiert. Multiplier auf
                      „Freeze-Dauer" skaliert sie.
                    </span>
                  </div>
                {:else if eff.kind === "extraLife"}
                  <div class="param-row">
                    <span class="param-label">Revive bei</span>
                    <NumberInput
                      bind:value={eff.amount}
                      min={1}
                      max={100}
                      step={1}
                      suffix="%"
                      width="100px"
                    />
                    <span class="param-hint">
                      Prozent vom Max-HP, auf das beim Verbrauch eines Lebens
                      aufgefüllt wird.
                    </span>
                  </div>
                  <div class="param-row">
                    <span class="param-label">Leben pro Auslösung</span>
                    <NumberInput
                      bind:value={eff.level}
                      min={1}
                      max={20}
                      step={1}
                      width="80px"
                    />
                    <span class="param-hint">
                      Cap & Anzeige werden in den Stream-HP-Settings konfiguriert
                      (max. {cfg.streamHpExtraLivesMax} aktiv).
                    </span>
                  </div>
                {:else if eff.kind === "setLevel"}
                  <div class="param-row">
                    <span class="param-label">Ziel-Level</span>
                    <NumberInput
                      bind:value={eff.level}
                      min={1}
                      max={12}
                      width="80px"
                      suffix="KMH"
                    />
                  </div>
                  <div class="param-row">
                    <span class="param-label">Dauer</span>
                    <NumberInput
                      bind:value={eff.durationSec}
                      min={0}
                      max={3600}
                      step={1}
                      suffix="s"
                      width="100px"
                    />
                    <span class="param-hint">
                      {(eff.durationSec ?? 0) === 0
                        ? "0 = einmaliger Sprung (kein Rücksprung)"
                        : "Nach Ablauf zurück auf das nachgehaltene Level"}
                    </span>
                  </div>
                {:else if eff.kind === "multiplier"}
                  <div class="param-row">
                    <span class="param-label">Faktor</span>
                    <NumberInput
                      bind:value={eff.factor}
                      min={0.1}
                      max={20}
                      step={0.1}
                      suffix="×"
                      width="100px"
                    />
                  </div>
                  <div class="param-row">
                    <span class="param-label">Dauer</span>
                    <NumberInput
                      bind:value={eff.durationSec}
                      min={1}
                      max={3600}
                      step={1}
                      suffix="s"
                      width="100px"
                    />
                  </div>
                  <div class="param-row col">
                    <span class="param-label">Wirkt auf</span>
                    <div class="multi-kinds">
                      {#each MULTIPLIABLE_KINDS as mk}
                        <label class="kind-chip">
                          <input
                            type="checkbox"
                            checked={(eff.multipliedKinds ?? []).includes(mk.value)}
                            on:change={() => toggleMultiplierKind(eff, mk.value)}
                          />
                          <span>{mk.label}</span>
                        </label>
                      {/each}
                    </div>
                    <span class="param-hint">
                      Level↑/↓/Reset, SetLevel und andere Skills werden nicht
                      multipliziert (sie haben keinen Wert).
                    </span>
                  </div>
                {:else if eff.kind === "wheel"}
                  {@const segs = eff.segments ?? []}
                  {@const tot = totalWeight(segs)}
                  <div class="wheel-editor">
                    <div class="sub-head">
                      <span class="sub-title">Glücksrad-Sektoren</span>
                      <span class="sub-hint">
                        Gewichte werden auf {tot > 0 ? "100%" : "?"} normiert.
                      </span>
                    </div>

                    {#each segs as seg, segIdx (segIdx)}
                      <div class="segment">
                        <div class="segment-head">
                          <div
                            class="seg-color-dot"
                            style="background: rgb({Math.round(seg.color.r * 255)}, {Math.round(seg.color.g * 255)}, {Math.round(seg.color.b * 255)});"
                          ></div>
                          <input
                            type="text"
                            class="text-input seg-label-input"
                            bind:value={seg.label}
                            placeholder="Sektor-Label"
                          />
                          <span class="seg-pct">{segmentPct(segs, segIdx).toFixed(0)}%</span>
                          <div class="rule-actions">
                            <button
                              class="mini-btn"
                              on:click={() => moveSegment(eff, segIdx, -1)}
                              disabled={segIdx === 0}
                              title="Nach oben"
                            >▲</button>
                            <button
                              class="mini-btn"
                              on:click={() => moveSegment(eff, segIdx, 1)}
                              disabled={segIdx === segs.length - 1}
                              title="Nach unten"
                            >▼</button>
                            <button
                              class="mini-btn danger"
                              on:click={() => removeSegment(eff, segIdx)}
                              title="Sektor löschen"
                            >✕</button>
                          </div>
                        </div>

                        <div class="param-row">
                          <span class="param-label">Farbe</span>
                          <ColorField bind:value={seg.color} withAlpha={false} />
                        </div>
                        <div class="param-row">
                          <span class="param-label">Gewicht</span>
                          <NumberInput
                            bind:value={seg.weight}
                            min={0}
                            max={1000}
                            step={0.5}
                            width="100px"
                          />
                          <span class="param-hint">
                            Je höher, desto wahrscheinlicher.
                          </span>
                        </div>

                        <div class="param-row">
                          <span class="param-label">Sound</span>
                          <div class="sound-picker-wrap">
                            <SoundPicker
                              value={seg.soundPath}
                              placeholder="Skill-Sound nutzen"
                              on:change={(e) => {
                                seg.soundPath = e.detail;
                                bumpSkills();
                              }}
                            />
                          </div>
                          <span class="param-hint">
                            Übersteuert den Skill-Sound für diesen Sektor.
                          </span>
                        </div>

                        <div class="sub-head">
                          <span class="sub-title">Effekte bei Treffer</span>
                          <span class="sub-hint">
                            Leer / nur "Niete" = nichts passiert.
                          </span>
                        </div>

                        {#each seg.effects as segEff, sefIdx (sefIdx)}
                          <div class="effect-row inner">
                            <select
                              class="eff-kind"
                              value={segEff.kind}
                              on:change={(e) => changeEffectKind(seg.effects, sefIdx, e.currentTarget)}
                            >
                              {#each effectKindOptions.filter((o) => o.inWheel) as opt}
                                <option value={opt.value}>{opt.label}</option>
                              {/each}
                            </select>
                            {#if segEff.kind === "heal" || segEff.kind === "damage"}
                              <NumberInput
                                bind:value={segEff.amount}
                                min={1}
                                max={100000}
                                suffix="HP"
                                width="100px"
                              />
                            {:else if segEff.kind === "healOverTime" || segEff.kind === "damageOverTime"}
                              <NumberInput
                                bind:value={segEff.amount}
                                min={0.1}
                                max={10000}
                                step={0.5}
                                suffix="HP/s"
                                width="100px"
                              />
                              <NumberInput
                                bind:value={segEff.durationSec}
                                min={1}
                                max={600}
                                suffix="s"
                                width="80px"
                              />
                            {:else if segEff.kind === "freezeHp"}
                              <NumberInput
                                bind:value={segEff.durationSec}
                                min={1}
                                max={600}
                                suffix="s"
                                width="80px"
                              />
                            {:else if segEff.kind === "extraLife"}
                              <NumberInput
                                bind:value={segEff.amount}
                                min={1}
                                max={100}
                                suffix="% HP"
                                width="100px"
                              />
                              <NumberInput
                                bind:value={segEff.level}
                                min={1}
                                max={20}
                                suffix="❤"
                                width="80px"
                              />
                            {:else if segEff.kind === "setLevel"}
                              <NumberInput
                                bind:value={segEff.level}
                                min={1}
                                max={12}
                                suffix="KMH"
                                width="90px"
                              />
                              <NumberInput
                                bind:value={segEff.durationSec}
                                min={0}
                                max={3600}
                                suffix="s"
                                width="90px"
                              />
                            {:else if segEff.kind === "multiplier"}
                              <NumberInput
                                bind:value={segEff.factor}
                                min={0.1}
                                max={20}
                                step={0.1}
                                suffix="×"
                                width="80px"
                              />
                              <NumberInput
                                bind:value={segEff.durationSec}
                                min={1}
                                max={3600}
                                suffix="s"
                                width="90px"
                              />
                            {/if}
                            <button
                              class="mini-btn danger"
                              on:click={() => removeSegmentEffect(seg, sefIdx)}
                              title="Effekt entfernen"
                            >✕</button>
                          </div>
                          {#if segEff.kind === "multiplier"}
                            <div class="param-row col inner-extra">
                              <span class="param-label">Wirkt auf</span>
                              <div class="multi-kinds">
                                {#each MULTIPLIABLE_KINDS as mk}
                                  <label class="kind-chip">
                                    <input
                                      type="checkbox"
                                      checked={(segEff.multipliedKinds ?? []).includes(mk.value)}
                                      on:change={() => toggleMultiplierKind(segEff, mk.value)}
                                    />
                                    <span>{mk.label}</span>
                                  </label>
                                {/each}
                              </div>
                            </div>
                          {/if}
                        {/each}

                        <Button
                          variant="ghost"
                          size="sm"
                          on:click={() => addSegmentEffect(seg)}
                        >+ Effekt</Button>
                      </div>
                    {/each}

                    <Button variant="secondary" size="sm" on:click={() => addSegment(eff)}>
                      + Sektor
                    </Button>
                  </div>
                {/if}

                <!-- Pro-Effekt-Sound (Override). Greift gegen den Skill-Sound. -->
                {#if eff.kind !== "wheel"}
                  <div class="param-row">
                    <span class="param-label">Sound</span>
                    <div class="sound-picker-wrap">
                      <SoundPicker
                        value={eff.soundPath}
                        placeholder="Skill-Sound nutzen"
                        on:change={(e) => {
                          eff.soundPath = e.detail;
                          bumpSkills();
                        }}
                      />
                    </div>
                  </div>
                {/if}
              </div>
            {/each}

            <Button
              variant="ghost"
              size="sm"
              on:click={() => addEffect(sIdx, rIdx)}
            >
              + Effekt
            </Button>

            <Field
              label="Wahrscheinlichkeit"
              hint={rule.probability >= 100
                ? "Immer auslösen."
                : "Rad-Animation entscheidet — Sektoren werden anhand des Wertes gerendert."}
            >
              <NumberInput
                bind:value={rule.probability}
                min={0}
                max={100}
                step={1}
                suffix="%"
              />
            </Field>
          </div>
        {/each}

        <Button variant="secondary" size="sm" on:click={() => addRule(sIdx)}>
          + Regel
        </Button>
      </div>
    {/if}
  </Card>
{/each}

<Card title="Anzeige">
  <Field>
    <Toggle
      bind:checked={cfg.skillBarShowInactive}
      label="Inaktive Slots ausgegraut anzeigen"
    />
  </Field>

  <Field
    label="Ausrichtung"
    hint={'Bestimmt, in welche Richtung die Leiste wächst, wenn Skills hinzu-/wegkommen. „Mittig" hält den Anker zentriert — ideal für zentrierte Platzierung.'}
  >
    <div class="align-row">
      <label class="align-chip" class:active={cfg.skillBarAlign === "left"}>
        <input type="radio" bind:group={cfg.skillBarAlign} value="left" />
        <span>← Links</span>
      </label>
      <label class="align-chip" class:active={cfg.skillBarAlign === "center"}>
        <input type="radio" bind:group={cfg.skillBarAlign} value="center" />
        <span>↔ Mittig</span>
      </label>
      <label class="align-chip" class:active={cfg.skillBarAlign === "right"}>
        <input type="radio" bind:group={cfg.skillBarAlign} value="right" />
        <span>Rechts →</span>
      </label>
    </div>
  </Field>
</Card>

<Callout variant="info">
  Optik der Skill-Leiste (Framed/Clean, Abstand, Status-Effekt-Text, Chance-Pille,
  Mini-Rad, Gift-Overlay) stellst du im <strong>Design-Modus</strong> (Taste <code>D</code>) ein —
  Klick auf einen Slot, auf den Wert-Text, die Chance-Pille oder das Gift-Bild öffnet das passende Panel.
  Position und Größe der Leiste sowie des Glücksrads sind im
  <strong>Edit-Modus</strong> (Taste <code>E</code>); für das Rad zusätzlich den
  <code>Temp</code>-Toggle in der Editor-Toolbar aktivieren.
  Trigger über Webhook: <code>GET /skill?id=N</code>.
</Callout>

<style>
  .add-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .hint-text {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
  }

  .skill-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .skill-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    background: transparent;
    border: none;
    color: var(--c-text);
    cursor: pointer;
    padding: 4px 0;
    text-align: left;
    min-width: 0;
  }
  .chev {
    display: inline-block;
    font-size: 10px;
    color: var(--c-text-dim);
    transition: transform var(--duration);
    width: 12px;
    flex-shrink: 0;
  }
  .chev.open {
    transform: rotate(90deg);
  }
  .skill-id {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: var(--c-bg-3);
    color: var(--c-text-muted);
    padding: 2px 6px;
    border-radius: var(--r-sm);
    flex-shrink: 0;
  }
  .skill-id.dup {
    background: var(--c-danger-soft);
    color: var(--c-danger);
  }
  .skill-name {
    font-weight: 600;
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-actions {
    display: inline-flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .mini-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--c-border);
    background: var(--c-bg-3);
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    cursor: pointer;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--duration), color var(--duration);
  }
  .mini-btn:hover:not(:disabled) {
    background: var(--c-bg-4);
    color: var(--c-text);
  }
  .mini-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .mini-btn.danger:hover:not(:disabled) {
    background: var(--c-danger-soft);
    color: var(--c-danger);
    border-color: var(--c-danger);
  }

  .skill-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: var(--sp-2);
  }
  .rule-chip {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 3px 8px;
    font-family: var(--font-mono);
  }
  .rule-chip-i {
    color: var(--c-accent);
    margin-right: 4px;
  }
  .muted {
    color: var(--c-text-dim);
    font-size: var(--fs-xs);
    font-style: italic;
  }

  .skill-body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    margin-top: var(--sp-3);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--c-border);
  }

  .text-input {
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 8px;
    font-size: var(--fs-sm);
    font-family: var(--font-ui);
    width: 100%;
  }
  .text-input:focus {
    outline: none;
    border-color: var(--c-accent);
    background: var(--c-bg-2);
  }

  .rules-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    margin-top: var(--sp-2);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--c-border);
  }
  .rules-title {
    font-weight: 600;
    font-size: var(--fs-sm);
  }
  .rules-hint {
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
  }

  .rule {
    background: var(--c-bg-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .rule-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .rule-num {
    font-weight: 600;
    font-size: var(--fs-sm);
    color: var(--c-accent);
  }
  .rule-actions {
    display: inline-flex;
    gap: 2px;
  }
  .sub-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    margin-top: var(--sp-2);
  }
  .sub-title {
    font-weight: 600;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--c-text-muted);
  }
  .sub-hint {
    font-size: 10px;
    color: var(--c-text-dim);
  }

  .cond-group {
    background: var(--c-bg-0);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cond-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .cond-label {
    width: 48px;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    font-weight: 600;
  }
  .cond-from {
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
  }
  .cond-input {
    width: 64px;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 6px;
    font-size: var(--fs-sm);
    font-family: var(--font-ui);
  }
  .cond-input:focus {
    outline: none;
    border-color: var(--c-accent);
  }
  .group-rm {
    margin-left: auto;
  }

  .effect-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .eff-kind {
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 8px;
    font-size: var(--fs-sm);
    font-family: var(--font-ui);
    flex: 1;
  }
  .eff-kind:focus {
    outline: none;
    border-color: var(--c-accent);
  }

  /* Effekt-Block: Hülle um Select + alle Kind-spezifischen Parameter. */
  .effect-block {
    background: var(--c-bg-0);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .param-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .param-row.col {
    flex-direction: column;
    align-items: stretch;
  }
  .param-label {
    width: 92px;
    flex-shrink: 0;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    font-weight: 600;
  }
  .param-hint {
    font-size: 11px;
    color: var(--c-text-dim);
  }
  .multi-kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  /* SoundPicker greift seine Breite vom Container — innerhalb einer param-row
     soll der Picker den verfügbaren Platz neben Label und Hint einnehmen. */
  .sound-picker-wrap {
    flex: 1;
    min-width: 200px;
  }
  .kind-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: var(--fs-xs);
    color: var(--c-text);
    cursor: pointer;
  }
  .kind-chip input {
    margin: 0;
  }

  /* Glücksrad-Editor */
  .wheel-editor {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .segment {
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .segment-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .seg-color-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.5);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }
  .seg-label-input {
    flex: 1;
    min-width: 100px;
  }
  .seg-pct {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    background: var(--c-bg-3);
    border-radius: var(--r-sm);
    padding: 2px 6px;
    flex-shrink: 0;
  }
  .effect-row.inner {
    background: var(--c-bg-0);
    border: 1px dashed var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 6px;
  }
  /* Zusätzliche Parameter (z.B. Multiplier-„Wirkt auf"), die unter einer
     Inline-Effekt-Zeile im Sektor erscheinen. Visuell gleicher Stil wie die
     Zeile darüber, aber ohne Border-Top, damit sie als Fortsetzung wirken. */
  .inner-extra {
    background: var(--c-bg-0);
    border: 1px dashed var(--c-border);
    border-top: none;
    border-radius: 0 0 var(--r-sm) var(--r-sm);
    margin-top: -8px;
    padding: 6px 8px 8px;
  }

  /* Radio-Chip-Gruppe für Skill-Bar-Ausrichtung */
  .align-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .align-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 12px;
    font-size: var(--fs-sm);
    color: var(--c-text);
    cursor: pointer;
    transition: background var(--duration), border-color var(--duration);
  }
  .align-chip:hover {
    background: var(--c-bg-3);
  }
  .align-chip.active {
    background: var(--c-accent-soft, rgba(56, 189, 248, 0.18));
    border-color: var(--c-accent);
    color: var(--c-accent);
  }
  .align-chip input {
    /* Native radio versteckt — die Chip-Box ist das visuelle Element. */
    appearance: none;
    -webkit-appearance: none;
    width: 0;
    height: 0;
    margin: 0;
  }

</style>
