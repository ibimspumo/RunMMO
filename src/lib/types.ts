// Geteilte Typen für Settings und State

export type RGBA = { r: number; g: number; b: number; a: number };

export interface LevelAssets {
  // Wenn null → Default-Asset für dieses Level verwenden (falls vorhanden)
  imagePath: string | null;
  soundPath: string | null;
}

export type AppMode = "simple" | "mmo";

export interface AppSettings {
  // App-Modus
  // - "simple": Klassische Leiter mit Timer und Geschenk-Icons (Godot-1:1)
  // - "mmo":   Reine Leiter ohne Timer/Icons, Steuerung ausschließlich über Webhooks
  mode: AppMode;

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

  // Overlay-Positionierung (relativ zum Fenster — wichtig für Fullscreen-Overlay)
  overlayScale: number;       // 0.1 .. 2.0
  overlayOffsetLeft: number;  // px
  overlayOffsetTop: number;   // px
}

export interface LadderState {
  currentLevel: number; // 0..11
  timeLeft: number;     // Sekunden
  isRunning: boolean;
}

export type WebhookEvent =
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "gift"; level: number }
  | { kind: "reset" }
  | { kind: "status" };
