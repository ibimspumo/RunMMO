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
