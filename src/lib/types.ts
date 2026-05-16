// Geteilte Typen für Settings und State

export type RGBA = { r: number; g: number; b: number; a: number };

export interface LevelAssets {
  // Wenn null → Default-Asset für dieses Level verwenden (falls vorhanden)
  imagePath: string | null;
  soundPath: string | null;
}

export type AppMode = "simple" | "mmo";

// Anzeigeart des Overlays (nur im MMO-Modus relevant; Simple nutzt immer "ladder").
export type OverlayStyle = "ladder" | "tacho";

export interface AppSettings {
  // App-Modus
  // - "simple": Klassische Leiter mit Timer und Geschenk-Icons (Godot-1:1)
  // - "mmo":   Reine Leiter ohne Timer/Icons, Steuerung ausschließlich über Webhooks
  mode: AppMode;

  // Anzeigeart (nur MMO): "ladder" = Balken, "tacho" = Halbkreis-Gauge.
  overlayStyle: OverlayStyle;

  // Geschenke + Sounds pro Level (12 Slots)
  levels: LevelAssets[];

  // Audio
  volumeDb: number; // -80 .. 24
  // Optional globale Up/Down Sounds (legacy aus Godot); spielen falls Level-Sound leer
  fallbackUpSoundPath: string | null;
  fallbackDownSoundPath: string | null;

  // Timer
  levelDurationSeconds: number;
  showTimer: boolean;

  // Webhook
  webhookPort: number;
  webhookEnabled: boolean;
  webhookBindAllInterfaces: boolean;

  // Balken-Farben (12)
  levelColors: RGBA[];

  // Text-Styling
  levelTextSize: number;
  timerTextSize: number;
  textShadowEnabled: boolean;
  textShadowColor: RGBA;
  textShadowOffsetX: number;
  textShadowOffsetY: number;
  textOutlineEnabled: boolean;
  textOutlineColor: RGBA;
  textOutlineSize: number;

  // Sonstige Farben
  inactiveBarColor: RGBA;
  activeOutlineColor: RGBA;
  textColor: RGBA;
  timerColor: RGBA;

  // Layout
  barBaseWidth: number;
  barWidthIncrement: number;
  barHeight: number;
  barBorderRadius: number;
  barPaddingTop: number;
  barPaddingBottom: number;
  barPaddingLeft: number;
  barPaddingRight: number;
  iconSize: number;
  spacingBetweenLevels: number;
  activeBarOutlineWidth: number;

  // Editor-Layout: Position + Skalierung pro Overlay-Element.
  // Werte in Referenz-450px-Raum (autoScale multipliziert beim Render).
  // Verwaltet durch den Edit-Modus (Taste "E"), nicht durch Settings-Tab.
  ladderX: number;
  ladderY: number;
  ladderScale: number;

  tachoX: number;
  tachoY: number;
  tachoScale: number;

  hpX: number;
  hpY: number;
  hpWidth: number;
  hpHeight: number;

  // Tacho (nur MMO + overlayStyle="tacho")
  tachoArcDegrees: number;       // 180 = Halbkreis, 270 = klassischer Auto-Tacho
  tachoThickness: number;        // Dicke des farbigen Bogens in px
  tachoShowLabels: boolean;      // 1..12 Beschriftungen am Bogen
  tachoShowCenterValue: boolean; // großes "XX KMH" in der Mitte
  tachoNeedleColor: RGBA;
  tachoDialBgColor: RGBA;        // Hintergrund des Gauge-Kreises

  // Stream-HP (nur im MMO-Modus aktiv)
  streamHpEnabled: boolean;
  streamHpMax: number;                  // Start-HP, z.B. 100
  streamHpSecondsPerHpByLevel: number[];// 12 Werte: Sekunden pro -1 HP je KMH-Level
  streamHpShowDecayRate: boolean;       // aktuelle Drain-Rate unter dem Balken anzeigen
  streamHpDeathSoundPath: string | null;// optional: eigener Death-Sound
  streamHpHealSoundPath: string | null; // Sound bei /heal
  streamHpDamageSoundPath: string | null;// Sound bei /damage
  streamHpFillColor: RGBA;
  streamHpBgColor: RGBA;
  streamHpBorderColor: RGBA;
  streamHpTextColor: RGBA;
  streamHpShowNumbers: boolean;
  streamHpBorderRadius: number;         // px (0 = eckig, hoch = Pille)

  // Skills (nur MMO-Modus). Liste von Webhook-getriggerten Effekten mit
  // Bedingungen, Regeln und optionaler Wahrscheinlichkeit. Webhook:
  // GET /skill?id=<Skill.id>.
  skills: Skill[];

  // Skill-Leiste (Overlay-Element, Edit-Mode). Werte in 450px-Referenzraum.
  skillBarX: number;
  skillBarY: number;
  skillBarSlotSize: number;   // Höhe/Breite eines Slots
  skillBarGap: number;        // Abstand zwischen Slots
  skillBarShowInactive: boolean;  // ausgegraute Slots anzeigen, wenn Bedingung nicht erfüllt

  // Anzeigemodus der Skill-Leiste:
  //  - "framed": Slot mit dunklem Kasten/Rand (klassischer MMORPG-Look)
  //  - "clean":  Nur Icon + Texte, keine Kästen/Hintergründe (transparent)
  skillBarStyle: "framed" | "clean";

  // Glücksrad (Overlay-Element). Wird nur sichtbar, wenn gerade gedreht wird,
  // oder im Edit-Modus mit "Temporäre Elemente"-Toggle.
  wheelX: number;
  wheelY: number;
  wheelSize: number;          // Durchmesser
  wheelSpinDurationMs: number;

  // Globale Optik der Skill-Slot-Texte. Drei feste Elemente pro Slot:
  //  - Icon (Mitte, immer)
  //  - Status-Effekt-Text (z.B. "+250", "Lvl ↑") — nur wenn ein Wert vorhanden
  //  - Chance-Pille (Mini-Rad + "%") — nur wenn Wahrscheinlichkeit < 100
  skillValueText: SkillTextStyle;
  skillChanceText: SkillTextStyle;
  skillMiniWheelEnabled: boolean;
}

// Eine Bedingungs-Gruppe (UND-verknüpft innerhalb). Felder mit null werden
// ignoriert. Mehrere Gruppen pro Rule sind ODER-verknüpft.
export interface ConditionGroup {
  minKmh: number | null;    // 1..12 (inklusive)
  maxKmh: number | null;
  minHpPct: number | null;  // 0..100 (inklusive)
  maxHpPct: number | null;
}

export type SkillEffectKind =
  | "heal"
  | "damage"
  | "levelUp"
  | "levelDown"
  | "levelReset";

// Heal/Damage nutzen amount; levelUp/Down/Reset ignorieren ihn.
export interface SkillEffect {
  kind: SkillEffectKind;
  amount: number;
}

// Globaler Text-Stil für die zwei festen Text-Elemente auf jedem Skill-Slot
// (Status-Effekt-Wert und Wahrscheinlichkeits-Text). Jedes Element hat
// dieselben Stil-Optionen — Farbe, Umrandung, Schatten, Position.
export interface SkillTextStyle {
  enabled: boolean;
  fontSize: number;     // px im 450-Referenzraum
  weight: number;       // 100..900
  color: RGBA;
  outlineColor: RGBA;
  outlineSize: number;  // 0..6 px text-stroke
  shadowColor: RGBA;
  shadowSize: number;   // 0..16 px blur
  // Position als Bruch (0..1) im Slot. 0.5 = Mitte, > 1 = außerhalb darunter.
  offsetX: number;
  offsetY: number;
}

// Erste passende Rule feuert (Reihenfolge in `rules` = Priorität).
export interface SkillRule {
  // Leer = immer aktiv. Sonst: mindestens eine Gruppe muss erfüllt sein.
  conditions: ConditionGroup[];
  effects: SkillEffect[];
  probability: number;  // 0..100; 100 = immer, < 100 = Rad
}

export interface Skill {
  id: number;             // = ?id= im Webhook /skill?id=N (eindeutig)
  name: string;
  iconPath: string | null;
  rules: SkillRule[];
  cooldownSec: number;
}

export interface LadderState {
  currentLevel: number; // 0..11
  timeLeft: number;     // Sekunden
  isRunning: boolean;
  hp: number;           // Stream-HP (0..streamHpMax)
}

export type WebhookEvent =
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "gift"; level: number }
  | { kind: "reset" }
  | { kind: "heal"; amount: number }
  | { kind: "damage"; amount: number }
  | { kind: "status" };
