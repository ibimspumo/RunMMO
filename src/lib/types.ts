// Geteilte Typen für Settings und State

export type RGBA = { r: number; g: number; b: number; a: number };

// Eintrag in der globalen Sound-Bibliothek. Sounds werden einmal pro Datei
// importiert und überall referenziert über "sound:<id>". Pfad bleibt der
// User-Pfad (via Tauri-Dialog), wird zum Abspielen mit convertFileSrc gelöst.
export interface SoundEntry {
  id: string;     // stabile id (z.B. "snd_1700000000_abc"), kollisionsarm
  name: string;   // anzeigbarer Name (default = Dateiname ohne Extension)
  path: string;   // absolutter User-Pfad
}

// Format-Konvention für Sound-Verweise:
//  - null      → kein Sound (kein Fallback, außer das jeweilige Feld hat einen)
//  - "sound:<id>" → Bibliothekseintrag (Standard für neue Verweise)
//  - sonst     → roher User-Pfad (legacy aus alten Configs; wird beim
//                Speichern bei Bedarf in die Bibliothek migriert)
export type SoundRef = string | null;

export interface LevelAssets {
  // Wenn null → Default-Asset für dieses Level verwenden (falls vorhanden)
  imagePath: string | null;
  soundPath: SoundRef;
  // Offset zur Master-Lautstärke in dB für diesen Slot. 0 = unverändert.
  // Wird nur angewendet, wenn der Slot einen eigenen Sound hat — sonst
  // greifen die Fallback-Up/Down-Offsets.
  soundVolumeDb: number;
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
  // Globale Sound-Bibliothek. Sounds werden einmal hochgeladen und überall
  // per "sound:<id>" referenziert. Verwaltet im Audio-Tab; Picker in allen
  // anderen Sections (Skills, Level, Stream-HP, …) greifen auf dieselbe Liste.
  soundLibrary: SoundEntry[];
  // Optional globale Up/Down Sounds (legacy aus Godot); spielen falls Level-Sound leer
  fallbackUpSoundPath: SoundRef;
  fallbackUpSoundVolumeDb: number;
  fallbackDownSoundPath: SoundRef;
  fallbackDownSoundVolumeDb: number;

  // Timer
  levelDurationSeconds: number;
  showTimer: boolean;

  // Webhook
  webhookPort: number;
  webhookEnabled: boolean;
  webhookBindAllInterfaces: boolean;
  // Verarbeitung eingehender Effekt-Webhooks (gift/heal/damage/skill):
  //  - "immediate": Effekt + HP-Update + Sound + Animation sofort beim Eintreffen
  //  - "queued":    Events in FIFO, einer pro `webhookQueueIntervalMs` raus
  // up/down/reset/status laufen IMMER sofort, unabhängig davon.
  webhookProcessingMode: "immediate" | "queued";
  // Nur relevant im queued-Modus: Mindest-Abstand zwischen zwei Pops.
  webhookQueueIntervalMs: number;

  // Balken-Farben (12)
  levelColors: RGBA[];

  // Text-Styling — Level-Text (Leiter)
  levelTextSize: number;
  textShadowEnabled: boolean;
  textShadowColor: RGBA;
  textShadowOffsetX: number;
  textShadowOffsetY: number;
  textShadowBlur: number;
  textOutlineEnabled: boolean;
  textOutlineColor: RGBA;
  textOutlineSize: number;

  // Text-Styling — Timer-Text (eigene Werte, nicht mit Level-Text geteilt)
  timerTextSize: number;
  timerShadowEnabled: boolean;
  timerShadowColor: RGBA;
  timerShadowOffsetX: number;
  timerShadowOffsetY: number;
  timerShadowBlur: number;
  timerOutlineEnabled: boolean;
  timerOutlineColor: RGBA;
  timerOutlineSize: number;

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
  tachoInactiveSegmentOpacity: number; // 0..1, Deckkraft der inaktiven Segmente
  tachoInactiveLabelOpacity: number;   // 0..1, Deckkraft der inaktiven Labels + Ticks
  // Mittiger KMH-Text: eigenständig stylebar im Design-Modus.
  tachoTextColor: RGBA;
  tachoTextSize: number;               // 0 = auto (aus levelTextSize)
  tachoTextShadowEnabled: boolean;
  tachoTextShadowColor: RGBA;
  tachoTextShadowOffsetX: number;
  tachoTextShadowOffsetY: number;
  tachoTextShadowBlur: number;
  tachoTextOutlineEnabled: boolean;
  tachoTextOutlineColor: RGBA;
  tachoTextOutlineSize: number;

  // Stream-HP (nur im MMO-Modus aktiv)
  streamHpEnabled: boolean;
  streamHpMax: number;                  // Start-HP, z.B. 100
  streamHpSecondsPerHpByLevel: number[];// 12 Werte: Sekunden pro -1 HP je KMH-Level
  streamHpShowDecayRate: boolean;       // aktuelle Drain-Rate unter dem Balken anzeigen
  streamHpDeathSoundPath: SoundRef;// optional: eigener Death-Sound
  streamHpDeathSoundVolumeDb: number;
  streamHpHealSoundPath: SoundRef; // Sound bei /heal
  streamHpHealSoundVolumeDb: number;
  streamHpDamageSoundPath: SoundRef;// Sound bei /damage
  streamHpDamageSoundVolumeDb: number;
  streamHpFillColor: RGBA;
  streamHpBgColor: RGBA;
  streamHpBorderColor: RGBA;
  streamHpShowNumbers: boolean;
  streamHpBorderRadius: number;         // px (0 = eckig, hoch = Pille)

  // HP-Balken — Schatten & Umrandung (Container-Box)
  streamHpBorderEnabled: boolean;
  streamHpBorderWidth: number;
  streamHpShadowEnabled: boolean;
  streamHpShadowColor: RGBA;
  streamHpShadowOffsetX: number;
  streamHpShadowOffsetY: number;
  streamHpShadowBlur: number;

  // HP-Text (HP-Zahlen + Decay-Rate). Eigene Styling-Werte je Element.
  streamHpTextColor: RGBA;
  streamHpTextSize: number;             // px im 450-Referenzraum
  streamHpTextShadowEnabled: boolean;
  streamHpTextShadowColor: RGBA;
  streamHpTextShadowOffsetX: number;
  streamHpTextShadowOffsetY: number;
  streamHpTextShadowBlur: number;
  streamHpTextOutlineEnabled: boolean;
  streamHpTextOutlineColor: RGBA;
  streamHpTextOutlineSize: number;

  // Extraleben: Globaler Cap + Style der Herz-Anzeige über der HP-Leiste.
  // Per-Skill (im `extraLife`-Effekt) wird Revive-HP% und Anzahl pro Trigger
  // konfiguriert. 0 = Feature aus.
  streamHpExtraLivesMax: number;
  streamHpExtraLifeHeartColor: RGBA;
  streamHpExtraLifeHeartSize: number;     // px im 450-Referenzraum
  streamHpExtraLifeHeartGap: number;      // px Abstand zwischen Herzen
  streamHpExtraLifeHeartOffsetY: number;  // px Abstand nach oben vom HP-Balken
  streamHpExtraLifeReviveSoundPath: SoundRef; // optional: Sound beim Einlösen
  streamHpExtraLifeReviveSoundVolumeDb: number;
  // Sound, der gespielt wird, wenn ein Extraleben durch den
  // `consumeExtraLife`-Skill-Effekt vom Stack entfernt wird (ohne Revive).
  streamHpExtraLifeLostSoundPath: SoundRef;
  streamHpExtraLifeLostSoundVolumeDb: number;

  // Skills für den MMO-Modus. Liste von Webhook-getriggerten Effekten mit
  // Bedingungen, Regeln und optionaler Wahrscheinlichkeit. Webhook:
  // GET /skill?id=<Skill.id>.
  skills: Skill[];

  // Separate Skill-Liste für den Simple-Modus. Inhalt-getrennt, aber Position
  // und Stil der Skill-Leiste (skillBarX/Y, Slot-Größe, Design-Schemas) sind
  // mit dem MMO-Modus geteilt. HP-bezogene Effekte (heal/damage/HoT/DoT/
  // freeze/extraLife) werden im Simple-Modus stillschweigend ignoriert —
  // dort gibt es keine HP-Leiste. Sinnvoll bleiben Level-Effekte, Multi-
  // plikator, Glücksrad und Niete.
  skillsSimple: Skill[];

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

  // Orientierung: bestimmt, ob Slots horizontal nebeneinander oder vertikal
  // untereinander gestackt werden. Beeinflusst auch die Bedeutung von
  // `skillBarAlign` (horizontal: links/mitte/rechts, vertikal: oben/mitte/unten).
  skillBarOrientation: "horizontal" | "vertical";

  // Ausrichtung relativ zum Anker (skillBarX/Y). Bestimmt, in welche Richtung
  // sich die Leiste ausbreitet, wenn Skills hinzu-/wegkommen:
  //  - horizontal: "left"|"center"|"right"  → Anker links / mittig / rechts
  //  - vertikal:   "left"|"center"|"right"  → Anker oben / mittig / unten
  // (Wert wird zwischen den Achsen geteilt, damit kein zweites Feld nötig ist.)
  skillBarAlign: "left" | "center" | "right";

  // Glücksrad (Overlay-Element). Wird nur sichtbar, wenn gerade gedreht wird,
  // oder im Edit-Modus mit "Temporäre Elemente"-Toggle.
  wheelX: number;
  wheelY: number;
  wheelSize: number;          // Durchmesser
  wheelSpinDurationMs: number;
  // Tick-Sound, der beim Vorbeilaufen des Pointers an einer Sektor-Grenze
  // (Segments) bzw. an einem Speichen-Tick (Chance) abgespielt wird. Wird
  // dynamisch per Web Audio erzeugt (keine Datei nötig). 0 = aus.
  // Skala 0..100, multipliziert mit dem Master-Volume (volumeDb).
  wheelTickVolume: number;

  // Globale Optik der Skill-Slot-Texte. Drei feste Elemente pro Slot:
  //  - Icon (Mitte, immer)
  //  - Status-Effekt-Text (z.B. "+250", "Lvl ↑") — nur wenn ein Wert vorhanden
  //  - Chance-Pille (Mini-Rad + "%") — nur wenn Wahrscheinlichkeit < 100
  skillValueText: SkillTextStyle;
  skillChanceText: SkillTextStyle;
  skillMiniWheelEnabled: boolean;

  // Globaler Style für das Gift-Overlay (Bildpfad pro Skill in Skill.giftIconPath).
  skillGiftStyle: SkillGiftStyle;

  // ===== Buff-Leiste =====
  // Zeigt aktive temporäre Status-Effekte als Pills/Badges (Multiplikator-
  // Timer + temporärer Level-Override). Nur sichtbar, wenn mindestens ein
  // Effekt aktiv ist, oder im Edit-Modus mit "Temp"-Toggle.
  buffBarX: number;
  buffBarY: number;
  buffBarSize: number;       // Pill-Höhe in 450-Referenzraum-px
  buffBarGap: number;        // Abstand zwischen Pills
  buffBarBgColor: RGBA;      // Hintergrund der Pill
  buffBarShowIcon: boolean;  // ✕/↑ Mini-Icon links anzeigen

  // Pill-Container — Schatten & Umrandung
  buffBarBorderColor: RGBA;
  buffBarBorderEnabled: boolean;
  buffBarBorderWidth: number;
  buffBarShadowEnabled: boolean;
  buffBarShadowColor: RGBA;
  buffBarShadowOffsetX: number;
  buffBarShadowOffsetY: number;
  buffBarShadowBlur: number;

  // Pill-Text
  buffBarTextColor: RGBA;
  buffBarTextSize: number;  // px im 450-Referenzraum (0 = auto aus Pill-Höhe)
  buffBarTextShadowEnabled: boolean;
  buffBarTextShadowColor: RGBA;
  buffBarTextShadowOffsetX: number;
  buffBarTextShadowOffsetY: number;
  buffBarTextShadowBlur: number;
  buffBarTextOutlineEnabled: boolean;
  buffBarTextOutlineColor: RGBA;
  buffBarTextOutlineSize: number;

  // ===== Multiplikator-Anzeige =====
  // Dreizeiliger Widget über dem Overlay: Faktor ("X2"), Restzeit ("0:32"),
  // betroffene Wirkungen ("(HEILUNG, SCHADEN)"). Position + uniforme Skalierung
  // werden im Edit-Modus gesetzt; Stil je Zeile im Design-Modus.
  multiplierX: number;
  multiplierY: number;
  multiplierScale: number;
  multiplierFactorText: MultiplierTextStyle;
  multiplierTimerText: MultiplierTextStyle;
  multiplierTargetsText: MultiplierTextStyle;
}

// Stil-Block für eine der drei Multiplikator-Textzeilen. Jede Zeile ist
// unabhängig stylebar (Schriftgröße, Farbe, Schatten, Umrandung).
export interface MultiplierTextStyle {
  fontSize: number;       // px im 450-Referenzraum
  color: RGBA;
  shadowEnabled: boolean;
  shadowColor: RGBA;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  outlineEnabled: boolean;
  outlineColor: RGBA;
  outlineSize: number;
}

// Eine Bedingungs-Gruppe (UND-verknüpft innerhalb). Felder mit null werden
// ignoriert. Mehrere Gruppen pro Rule sind ODER-verknüpft.
export interface ConditionGroup {
  minKmh: number | null;    // 1..12 (inklusive)
  maxKmh: number | null;
  minHpPct: number | null;  // 0..100 (inklusive)
  maxHpPct: number | null;
  minExtraLives: number | null; // Anzahl aktuell gehaltener Extraleben
  maxExtraLives: number | null;
}

export type SkillEffectKind =
  | "heal"
  | "damage"
  | "levelUp"
  | "levelDown"
  | "levelReset"
  | "setLevel"
  | "multiplier"
  | "wheel"
  | "freezeHp"        // HP-Drain für durationSec stoppen
  | "healOverTime"    // amount HP/s für durationSec
  | "damageOverTime"  // amount HP/s für durationSec
  | "extraLife"       // +1..N Extraleben mit Revive bei `amount`% HP (global gecapt)
  | "consumeExtraLife" // -1..N Extraleben vom Stack entfernen (HP bleibt unverändert)
  | "none";

// Ein Effekt im Skill-Baukasten. Alle Felder sind immer vorhanden (auch wenn
// sie für das jeweilige `kind` keine Bedeutung haben) — vereinfacht die
// UI-Bindung und das JSON-Schema, kostet ein paar Bytes pro Effekt.
//  - heal/damage:        amount = HP-Wert (durch Multiplier skalierbar)
//  - levelUp/Down/Reset: alle weiteren Felder werden ignoriert
//  - setLevel:           level (1..12) + durationSec (0 = einmalig)
//  - multiplier:         factor + durationSec + multipliedKinds (welche Kinds
//                        sollen durch diesen Buff multipliziert werden)
//  - wheel:              segments[] — eine eigene Glücksrad-Drehung mit Sektoren
//                        je eigener Wahrscheinlichkeit + eigenen Folge-Effekten
//  - freezeHp:           durationSec — HP-Drain ist für die Dauer pausiert
//  - healOverTime:       amount = HP pro Sekunde, durationSec = Gesamtdauer
//  - damageOverTime:     amount = HP pro Sekunde, durationSec = Gesamtdauer
//  - extraLife:          amount = Revive-HP% (0..100), level = Leben pro Trigger
//                        (Stack wird global durch streamHpExtraLivesMax gecapt)
//  - consumeExtraLife:   level = Anzahl Extraleben, die vom Stack genommen
//                        werden (kein-op wenn keins da). HP bleibt unangetastet.
//  - none:               Niete (keine Wirkung) — primär als Wheel-Segment nutzbar
export interface SkillEffect {
  kind: SkillEffectKind;

  // heal/damage
  amount: number;

  // setLevel
  level: number;          // 1..12
  durationSec: number;    // 0 = einmalig (kein Override-Timer)

  // multiplier
  factor: number;         // z.B. 2 = doppelte Werte
  multipliedKinds: SkillEffectKind[]; // welche Kinds dieser Buff anfasst

  // wheel
  segments: WheelSegment[];
  // Optionales Label (z.B. an Niete oder zur Anzeige im Skill-Slot)
  label: string;

  // Override-Sound für diesen einzelnen Effekt. Kaskade beim Abspielen:
  //   effect.soundPath  >  wheelSegment.soundPath  >  skill.soundPath  >  ∅
  // null = kein Override (es greift der nächsthöhere in der Kaskade).
  soundPath: SoundRef;
  // Offset zur Master-Lautstärke in dB, gilt nur wenn dieser Effekt seinen
  // eigenen Sound liefert (also soundPath gesetzt ist). Sonst greift der
  // Offset des nächsthöheren Cascade-Members (Segment/Skill).
  soundVolumeDb: number;
}

// Ein Sektor des Glücksrads als Action. Wahrscheinlichkeiten werden vom System
// auf 100% normiert — d.h. ein Sektor mit weight=2 ist doppelt so wahrschein-
// lich wie einer mit weight=1. Wenn das Segment fällt, werden seine effects
// ausgeführt (kann auch leer / "none" sein für Niete).
export interface WheelSegment {
  label: string;       // sichtbarer Text im Sektor (kurz)
  color: RGBA;         // Sektor-Farbe
  weight: number;      // > 0
  effects: SkillEffect[];
  // Sound, der einmal beim "Sektor-Treffer" abgespielt wird (Stufe zwischen
  // Skill- und Effekt-Sound). null = Skill-Sound greift (oder kein Sound).
  soundPath: SoundRef;
  // Offset für den Segment-Sound. Greift nur, wenn das Segment auch
  // einen eigenen soundPath liefert.
  soundVolumeDb: number;
}

// Globaler Text-Stil für die zwei festen Text-Elemente auf jedem Skill-Slot
// (Status-Effekt-Wert und Wahrscheinlichkeits-Text). Jedes Element hat
// dieselben Stil-Optionen — Farbe, Umrandung, Schatten, Position.
export interface SkillTextStyle {
  enabled: boolean;
  fontSize: number;     // px im 450-Referenzraum
  weight: number;       // 100..900
  color: RGBA;
  // Umrandung
  outlineEnabled: boolean;
  outlineColor: RGBA;
  outlineSize: number;  // 0..6 px text-stroke
  // Schatten — Offsets in px, Blur ersetzt früheres `shadowSize` (semantisch identisch).
  shadowEnabled: boolean;
  shadowColor: RGBA;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowSize: number;   // = Blur in px (Name aus Kompat-Gründen)
  // Position als Bruch (0..1) im Slot. 0.5 = Mitte, > 1 = außerhalb darunter.
  offsetX: number;
  offsetY: number;
}

// Globaler Stil für das optionale TikTok-Gift-Overlay auf jedem Skill-Slot.
// Pro Skill steckt der Bildpfad in `giftIconPath`; hier sind nur die globalen
// Anzeige-Parameter (Größe als Slot-Bruch, Position, Deckkraft, Schatten).
export interface SkillGiftStyle {
  enabled: boolean;
  // Größe als Bruch der Slot-Höhe (0.1..1.5). 0.4 = 40% Slot-Höhe.
  sizeFrac: number;
  // Position als Bruch (0..1) im Slot. 0.5 = Mitte. >1 = außerhalb.
  offsetX: number;
  offsetY: number;
  opacity: number;       // 0..1
  // Schatten — Offsets in px, Blur ersetzt früheres `shadowSize` (semantisch identisch).
  shadowEnabled: boolean;
  shadowColor: RGBA;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowSize: number;    // = Blur in px (Name aus Kompat-Gründen)
}

// Erste passende Rule feuert (Reihenfolge in `rules` = Priorität).
export interface SkillRule {
  // Leer = immer aktiv. Sonst: mindestens eine Gruppe muss erfüllt sein.
  conditions: ConditionGroup[];
  effects: SkillEffect[];
  probability: number;  // 0..100; 100 = immer, < 100 = Rad
  // Sounds für den Chance-Roll (nur relevant wenn probability < 100). Werden
  // EINMAL pro Roll am Ende des Spins gespielt, parallel zur Effekt-Kaskade:
  //  - Erfolg → successSoundPath (zusätzlich zu Effekt-Sounds)
  //  - Fehlschlag → failureSoundPath
  // null = kein Sound. Bei probability == 100 werden beide ignoriert.
  successSoundPath: SoundRef;
  successSoundVolumeDb: number;
  failureSoundPath: SoundRef;
  failureSoundVolumeDb: number;
}

export interface Skill {
  id: number;             // = ?id= im Webhook /skill?id=N (eindeutig)
  name: string;
  iconPath: string | null;
  // Optionales TikTok-Gift-Bild für den Slot, damit Zuschauer sehen, welches
  // Geschenk diesen Skill triggert. Format wie iconPath:
  //  - null            → kein Overlay
  //  - "gift:<key>"    → Eintrag aus der TikTok-Gift-Bibliothek
  //  - sonst           → User-Pfad (eigenes Bild)
  giftIconPath: string | null;
  rules: SkillRule[];
  cooldownSec: number;
  // Eigener Text für die Status-Anzeige im Skill-Slot. Leer ("") = aus dem
  // (Preview-)Effekt der Regel automatisch ableiten (z.B. "+250" für Heal).
  // Beliebiger Text, wird mit dem globalen skillValueText-Stil gerendert.
  valueTextOverride: string;
  // Default-Sound für alle Effekte dieses Skills. Wird abgespielt, sobald
  // ein Effekt feuert, sofern weder Effekt noch Wheel-Segment einen
  // eigenen Sound vorgeben (siehe Kaskade an SkillEffect.soundPath).
  soundPath: SoundRef;
  // Offset für den Skill-Sound (greift nur wenn soundPath gesetzt ist).
  soundVolumeDb: number;
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
