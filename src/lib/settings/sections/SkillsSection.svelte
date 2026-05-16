<script lang="ts">
  import type {
    AppSettings,
    Skill,
    SkillRule,
    SkillEffect,
    SkillEffectKind,
    SkillTextStyle,
  } from "../../types";
  import {
    Button,
    Callout,
    Card,
    ColorField,
    Field,
    NumberInput,
    SectionHeader,
    SkillIconPicker,
    Toggle,
  } from "../../ui";

  export let cfg: AppSettings;

  const effectKindOptions: {
    value: SkillEffectKind;
    label: string;
    hasAmount: boolean;
  }[] = [
    { value: "heal", label: "Heilen (+HP)", hasAmount: true },
    { value: "damage", label: "Schaden (−HP)", hasAmount: true },
    { value: "levelUp", label: "Level hoch", hasAmount: false },
    { value: "levelDown", label: "Level runter", hasAmount: false },
    { value: "levelReset", label: "Level reset", hasAmount: false },
  ];

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
      rules: [newRule()],
      cooldownSec: 0,
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
    cfg.skills[skillIdx].rules[ruleIdx].effects.push({ kind: "heal", amount: 100 });
    bumpSkills();
  }

  function removeEffect(skillIdx: number, ruleIdx: number, effIdx: number) {
    cfg.skills[skillIdx].rules[ruleIdx].effects.splice(effIdx, 1);
    bumpSkills();
  }


  function effectHasAmount(kind: SkillEffectKind): boolean {
    return kind === "heal" || kind === "damage";
  }

  function describeEffect(e: SkillEffect): string {
    switch (e.kind) {
      case "heal":
        return `+${e.amount} HP`;
      case "damage":
        return `−${e.amount} HP`;
      case "levelUp":
        return "Level +1";
      case "levelDown":
        return "Level −1";
      case "levelReset":
        return "Level → 1";
    }
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

        <Field label="Icon" hint="Bibliothek mit über 60 Default-Icons oder eigenes Bild hochladen.">
          <SkillIconPicker
            value={skill.iconPath}
            on:change={(e) => {
              skill.iconPath = e.detail;
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
              <div class="effect-row">
                <select
                  class="eff-kind"
                  bind:value={eff.kind}
                  on:change={bumpSkills}
                >
                  {#each effectKindOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
                {#if effectHasAmount(eff.kind)}
                  <NumberInput
                    bind:value={eff.amount}
                    min={1}
                    max={100000}
                    suffix="HP"
                    width="100px"
                  />
                {:else}
                  <span class="eff-spacer"></span>
                {/if}
                <button
                  class="mini-btn danger"
                  on:click={() => removeEffect(sIdx, rIdx, eIdx)}
                  title="Effekt entfernen"
                >✕</button>
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

<Card
  title="Skill-Slot Optik"
  hint="Globale Einstellungen für die zwei festen Text-Elemente auf jedem Skill-Slot. Das Icon liegt immer mittig, der Status-Effekt-Text zeigt den Heal/Damage-Wert bzw. die Level-Aktion, die Chance-Pille unten zeigt die Wahrscheinlichkeit als Mini-Rad + Text (nur unter 100%)."
>
  <Field
    label="Darstellung"
    hint={`Framed = Slots mit Rahmen und Hintergrund (MMORPG-Look). Clean = nur Icon und Texte, transparent.`}
  >
    <div class="seg-row">
      <button
        class="seg"
        class:active={cfg.skillBarStyle === "framed"}
        on:click={() => (cfg.skillBarStyle = "framed")}
        type="button"
      >Framed</button>
      <button
        class="seg"
        class:active={cfg.skillBarStyle === "clean"}
        on:click={() => (cfg.skillBarStyle = "clean")}
        type="button"
      >Clean</button>
    </div>
  </Field>

  <div class="rules-head">
    <span class="rules-title">Status-Effekt-Text</span>
    <span class="rules-hint">z.B. „+250", „−100", „Lvl ↑"</span>
  </div>

  <Field>
    <Toggle bind:checked={cfg.skillValueText.enabled} label="Anzeigen" />
  </Field>

  <div class="overlay-pos-row">
    <div class="overlay-pos-cell">
      <span class="cond-label">X</span>
      <NumberInput
        bind:value={cfg.skillValueText.offsetX}
        min={-0.5}
        max={1.5}
        step={0.05}
        width="84px"
      />
      <span class="cond-from">0 = links · 1 = rechts</span>
    </div>
    <div class="overlay-pos-cell">
      <span class="cond-label">Y</span>
      <NumberInput
        bind:value={cfg.skillValueText.offsetY}
        min={-0.5}
        max={2.0}
        step={0.05}
        width="84px"
      />
      <span class="cond-from">0 = oben · 1 = unten</span>
    </div>
  </div>

  <div class="overlay-pos-row">
    <div class="overlay-pos-cell">
      <span class="cond-label">Größe</span>
      <NumberInput
        bind:value={cfg.skillValueText.fontSize}
        min={6}
        max={120}
        step={1}
        suffix="px"
        width="84px"
      />
    </div>
    <div class="overlay-pos-cell">
      <span class="cond-label">Gewicht</span>
      <NumberInput
        bind:value={cfg.skillValueText.weight}
        min={100}
        max={900}
        step={100}
        width="84px"
      />
    </div>
  </div>

  <Field label="Farbe" inline>
    <ColorField bind:value={cfg.skillValueText.color} />
  </Field>
  <Field label="Umrandung" inline>
    <ColorField bind:value={cfg.skillValueText.outlineColor} />
  </Field>
  <Field label="Umrandung-Breite" hint="0 = keine Umrandung">
    <NumberInput
      bind:value={cfg.skillValueText.outlineSize}
      min={0}
      max={6}
      step={0.5}
      suffix="px"
    />
  </Field>
  <Field label="Schatten" inline>
    <ColorField bind:value={cfg.skillValueText.shadowColor} />
  </Field>
  <Field label="Schatten-Größe" hint="Blur-Radius. 0 = kein Schatten.">
    <NumberInput
      bind:value={cfg.skillValueText.shadowSize}
      min={0}
      max={16}
      step={0.5}
      suffix="px"
    />
  </Field>

  <div class="rules-head">
    <span class="rules-title">Chance-Pille</span>
    <span class="rules-hint">
      Mini-Glücksrad + Prozent. Wird nur angezeigt wenn Chance &lt; 100%.
    </span>
  </div>

  <Field>
    <Toggle bind:checked={cfg.skillChanceText.enabled} label="Anzeigen" />
  </Field>
  <Field>
    <Toggle bind:checked={cfg.skillMiniWheelEnabled} label="Mini-Rad anzeigen" />
  </Field>

  <div class="overlay-pos-row">
    <div class="overlay-pos-cell">
      <span class="cond-label">X</span>
      <NumberInput
        bind:value={cfg.skillChanceText.offsetX}
        min={-0.5}
        max={1.5}
        step={0.05}
        width="84px"
      />
      <span class="cond-from">0 = links · 1 = rechts</span>
    </div>
    <div class="overlay-pos-cell">
      <span class="cond-label">Y</span>
      <NumberInput
        bind:value={cfg.skillChanceText.offsetY}
        min={-0.5}
        max={2.0}
        step={0.05}
        width="84px"
      />
      <span class="cond-from">0 = oben · 1 = unten</span>
    </div>
  </div>

  <div class="overlay-pos-row">
    <div class="overlay-pos-cell">
      <span class="cond-label">Größe</span>
      <NumberInput
        bind:value={cfg.skillChanceText.fontSize}
        min={6}
        max={64}
        step={1}
        suffix="px"
        width="84px"
      />
    </div>
    <div class="overlay-pos-cell">
      <span class="cond-label">Gewicht</span>
      <NumberInput
        bind:value={cfg.skillChanceText.weight}
        min={100}
        max={900}
        step={100}
        width="84px"
      />
    </div>
  </div>

  <Field label="Farbe" inline>
    <ColorField bind:value={cfg.skillChanceText.color} />
  </Field>
  <Field label="Umrandung" inline>
    <ColorField bind:value={cfg.skillChanceText.outlineColor} />
  </Field>
  <Field label="Umrandung-Breite">
    <NumberInput
      bind:value={cfg.skillChanceText.outlineSize}
      min={0}
      max={6}
      step={0.5}
      suffix="px"
    />
  </Field>
  <Field label="Schatten" inline>
    <ColorField bind:value={cfg.skillChanceText.shadowColor} />
  </Field>
  <Field label="Schatten-Größe">
    <NumberInput
      bind:value={cfg.skillChanceText.shadowSize}
      min={0}
      max={16}
      step={0.5}
      suffix="px"
    />
  </Field>
</Card>

<Callout variant="info">
  Position und Größe der <strong>Skill-Leiste</strong> und des
  <strong>Glücksrads</strong> werden im Edit-Modus (Taste <code>E</code>)
  eingestellt. Für das Rad zusätzlich den <code>Temp</code>-Toggle
  in der Editor-Toolbar aktivieren, damit es sichtbar wird.
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
  .eff-spacer {
    width: 100px;
  }

  .overlay-pos-row {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .overlay-pos-cell {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1;
    min-width: 0;
  }

  .seg-row {
    display: inline-flex;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    overflow: hidden;
  }
  .seg {
    background: transparent;
    color: var(--c-text-muted);
    border: none;
    padding: 6px 14px;
    font-size: var(--fs-sm);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--duration), color var(--duration);
  }
  .seg:hover {
    background: var(--c-bg-4);
    color: var(--c-text);
  }
  .seg.active {
    background: var(--c-accent);
    color: white;
  }
</style>
