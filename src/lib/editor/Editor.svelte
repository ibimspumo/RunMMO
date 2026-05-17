<script lang="ts" context="module">
  export type TargetId =
    | "ladder"
    | "tacho"
    | "hp"
    | "skillbar"
    | "wheel"
    | "buffbar"
    | "multiplier";

  export interface EditTarget {
    id: TargetId;
    label: string;
    // DOM-Element des Overlays (für Bbox-Messung in Screen-px).
    getElement: () => HTMLElement | undefined;
    // Aktuelle Layout-Werte (Referenz-450px-Raum).
    getLayout: () => { x: number; y: number };
    // Anwenden eines Layout-Updates (Referenz-450px-Raum).
    move: (x: number, y: number) => void;
    // Skalierung: entweder uniform (ladder/tacho) ODER w/h (hp).
    kind: "uniform" | "wh";
    // Für uniform: aktuelle Skala + setter.
    getScale?: () => number;
    setScale?: (s: number) => void;
    // Für wh: aktuelle ref-Breite/Höhe + setter.
    getSize?: () => { w: number; h: number };
    setSize?: (w: number, h: number) => void;
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";

  export let targets: EditTarget[];
  // Toggle für nicht-permanent sichtbare Overlay-Elemente (z.B. das Glücksrad,
  // das normalerweise nur beim Spin angezeigt wird). Wenn aktiv, werden diese
  // Elemente während des Edit-Modus sichtbar gemacht, damit sie verschoben
  // und skaliert werden können.
  export let showTemporary = false;

  const dispatch = createEventDispatcher<{ done: void }>();

  const REFERENCE_WIDTH = 450;
  let windowWidth = window.innerWidth || REFERENCE_WIDTH;
  let windowHeight = window.innerHeight || 800;
  $: autoScale = windowWidth / REFERENCE_WIDTH;

  // BBox eines Targets in Screen-px (gemessen vom DOM, robust gegen scale/transform).
  type Rect = { left: number; top: number; width: number; height: number };
  let bboxes: Record<string, Rect> = {};

  let selectedId: TargetId | null = null;
  let hoverId: TargetId | null = null;

  // Drag/Resize-State
  type DragMode =
    | { type: "idle" }
    | {
        type: "move";
        id: TargetId;
        startX: number;
        startY: number;
        startLayoutX: number;
        startLayoutY: number;
        startBbox: Rect;
      }
    | {
        type: "resize";
        id: TargetId;
        handle: "nw" | "ne" | "sw" | "se";
        startX: number;
        startY: number;
        startLayoutX: number;
        startLayoutY: number;
        startScale?: number;
        startW?: number;
        startH?: number;
        startBbox: Rect;
      };
  let drag: DragMode = { type: "idle" };

  // === Snapping ===
  let snapEnabled = true;
  const SNAP_THRESHOLD_PX = 6;
  type Guide = { axis: "x" | "y"; pos: number };
  let activeGuides: Guide[] = [];

  function measure() {
    const next: Record<string, Rect> = {};
    for (const t of targets) {
      const el = t.getElement();
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[t.id] = { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    bboxes = next;
  }

  function onWindowResize() {
    windowWidth = window.innerWidth || REFERENCE_WIDTH;
    windowHeight = window.innerHeight || 800;
    measure();
  }

  // Bei jedem Tick neu messen — Overlays können sich durch Drag/Resize ändern.
  let rafHandle: number | null = null;
  function measureLoop() {
    measure();
    rafHandle = requestAnimationFrame(measureLoop);
  }

  onMount(async () => {
    await tick();
    measure();
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    rafHandle = requestAnimationFrame(measureLoop);
  });
  onDestroy(() => {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  });

  function startMove(e: PointerEvent, id: TargetId) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = id;
    const t = targets.find((x) => x.id === id);
    if (!t) return;
    const { x, y } = t.getLayout();
    const bbox = bboxes[id];
    if (!bbox) return;
    drag = {
      type: "move",
      id,
      startX: e.clientX,
      startY: e.clientY,
      startLayoutX: x,
      startLayoutY: y,
      startBbox: { ...bbox },
    };
  }

  function startResize(e: PointerEvent, id: TargetId, handle: "nw" | "ne" | "sw" | "se") {
    e.preventDefault();
    e.stopPropagation();
    selectedId = id;
    const t = targets.find((x) => x.id === id);
    if (!t) return;
    const { x, y } = t.getLayout();
    const bbox = bboxes[id];
    if (!bbox) return;
    drag = {
      type: "resize",
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startLayoutX: x,
      startLayoutY: y,
      startScale: t.kind === "uniform" ? t.getScale?.() : undefined,
      startW: t.kind === "wh" ? t.getSize?.().w : undefined,
      startH: t.kind === "wh" ? t.getSize?.().h : undefined,
      startBbox: { ...bbox },
    };
  }

  // === Snap-Berechnung ===
  // Sammelt Snap-Kandidaten in Screen-px:
  //  - Fenster: 0, mitte, max
  //  - Andere Bboxes: left, center, right (bzw. top/middle/bottom)
  function collectCandidates(ignoreId: TargetId): { xs: number[]; ys: number[] } {
    const xs = [0, windowWidth / 2, windowWidth];
    const ys = [0, windowHeight / 2, windowHeight];
    for (const t of targets) {
      if (t.id === ignoreId) continue;
      const b = bboxes[t.id];
      if (!b) continue;
      xs.push(b.left, b.left + b.width / 2, b.left + b.width);
      ys.push(b.top, b.top + b.height / 2, b.top + b.height);
    }
    return { xs, ys };
  }

  // Findet die beste Snap-Offset (Distanz < Schwelle) zwischen einer der `lines`
  // und einem der `candidates`. Gibt null zurück, wenn nichts snapt.
  function bestSnap(
    lines: number[],
    candidates: number[],
  ): { offset: number; pos: number } | null {
    let best: { offset: number; pos: number } | null = null;
    for (const line of lines) {
      for (const cand of candidates) {
        const offset = cand - line;
        const abs = Math.abs(offset);
        if (abs <= SNAP_THRESHOLD_PX && (best === null || abs < Math.abs(best.offset))) {
          best = { offset, pos: cand };
        }
      }
    }
    return best;
  }

  // Snap eines Boxes (left, top, w, h) → liefert Offset und Guides.
  function computeBoxSnap(
    left: number,
    top: number,
    w: number,
    h: number,
    ownId: TargetId,
  ): { offsetX: number; offsetY: number; guides: Guide[] } {
    const { xs, ys } = collectCandidates(ownId);
    const xLines = [left, left + w / 2, left + w];
    const yLines = [top, top + h / 2, top + h];
    const sx = bestSnap(xLines, xs);
    const sy = bestSnap(yLines, ys);
    const guides: Guide[] = [];
    if (sx) guides.push({ axis: "x", pos: sx.pos });
    if (sy) guides.push({ axis: "y", pos: sy.pos });
    return { offsetX: sx?.offset ?? 0, offsetY: sy?.offset ?? 0, guides };
  }

  // Snap eines einzelnen Punktes (für Resize-Handle-Ecken).
  function computePointSnap(
    px: number,
    py: number,
    ownId: TargetId,
  ): { offsetX: number; offsetY: number; guides: Guide[] } {
    const { xs, ys } = collectCandidates(ownId);
    const sx = bestSnap([px], xs);
    const sy = bestSnap([py], ys);
    const guides: Guide[] = [];
    if (sx) guides.push({ axis: "x", pos: sx.pos });
    if (sy) guides.push({ axis: "y", pos: sy.pos });
    return { offsetX: sx?.offset ?? 0, offsetY: sy?.offset ?? 0, guides };
  }

  function onPointerMove(e: PointerEvent) {
    if (drag.type === "idle") return;
    const dragId = drag.id;
    const t = targets.find((x) => x.id === dragId);
    if (!t) return;

    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;
    const dxRef = dxScreen / autoScale;
    const dyRef = dyScreen / autoScale;

    if (drag.type === "move") {
      // Vorläufige neue Screen-Position des Bbox.
      let newLeftScreen = drag.startBbox.left + dxScreen;
      let newTopScreen = drag.startBbox.top + dyScreen;
      const w = drag.startBbox.width;
      const h = drag.startBbox.height;

      if (snapEnabled) {
        const snapResult = computeBoxSnap(newLeftScreen, newTopScreen, w, h, dragId);
        newLeftScreen += snapResult.offsetX;
        newTopScreen += snapResult.offsetY;
        activeGuides = snapResult.guides;
      } else {
        activeGuides = [];
      }

      const newX = drag.startLayoutX + (newLeftScreen - drag.startBbox.left) / autoScale;
      const newY = drag.startLayoutY + (newTopScreen - drag.startBbox.top) / autoScale;
      t.move(newX, newY);
      return;
    }

    if (drag.type === "resize") {
      const { handle, startBbox, startLayoutX, startLayoutY } = drag;

      if (t.kind === "uniform" && t.setScale && drag.startScale !== undefined) {
        // Anker = gegenüberliegende Ecke des Original-Bbox.
        const anchorX =
          handle === "nw" || handle === "sw" ? startBbox.left + startBbox.width : startBbox.left;
        const anchorY =
          handle === "nw" || handle === "ne" ? startBbox.top + startBbox.height : startBbox.top;

        const startDx = drag.startX - anchorX;
        const startDy = drag.startY - anchorY;
        const startDist = Math.hypot(startDx, startDy);
        const nowDx = e.clientX - anchorX;
        const nowDy = e.clientY - anchorY;
        // Vorzeichen-Check: wenn Maus über Anker hinausgeht, schrumpft das Element zu 0.
        const nowDist = Math.hypot(nowDx, nowDy);
        // Behalte die ursprüngliche Orientierung: Projektion auf Start-Vektor.
        const dot = (nowDx * startDx + nowDy * startDy) / Math.max(1e-6, startDist);
        const signedDist = Math.max(0, dot < 0 ? 0 : nowDist);
        const factor = startDist > 1e-6 ? signedDist / startDist : 1;
        const newScale = Math.max(0.05, Math.min(8, drag.startScale * factor));
        t.setScale(newScale);

        // Anker fixieren: das Element-Top-Left wandert so, dass der Anker im Screen-Raum gleich bleibt.
        // anchor_screen_x = (startLayoutX + offsetToAnchorInsideElementRef) * autoScale + ladderX*autoScale
        // Einfacher: berechne neuen Top-Left, sodass die Position des Ankers im Bbox konstant bleibt.
        // anchorX_screen = newLeftScreen + anchorFracX * newWidthScreen
        const anchorFracX = startBbox.width > 0 ? (anchorX - startBbox.left) / startBbox.width : 0;
        const anchorFracY = startBbox.height > 0 ? (anchorY - startBbox.top) / startBbox.height : 0;
        const newWidthScreen = startBbox.width * (newScale / drag.startScale);
        const newHeightScreen = startBbox.height * (newScale / drag.startScale);
        const newLeftScreen = anchorX - anchorFracX * newWidthScreen;
        const newTopScreen = anchorY - anchorFracY * newHeightScreen;
        // Differenz zum alten Top-Left in Screen-Px → in Ref-Px umrechnen.
        const deltaLeftRef = (newLeftScreen - startBbox.left) / autoScale;
        const deltaTopRef = (newTopScreen - startBbox.top) / autoScale;
        t.move(startLayoutX + deltaLeftRef, startLayoutY + deltaTopRef);
        return;
      }

      if (t.kind === "wh" && t.setSize && drag.startW !== undefined && drag.startH !== undefined) {
        // Snap der bewegten Ecke in Screen-px → zurück in Ref-px.
        let snapDxRef = dxRef;
        let snapDyRef = dyRef;
        if (snapEnabled) {
          // Screen-Position der bewegten Ecke (Start + delta).
          const movingCornerX =
            handle === "ne" || handle === "se"
              ? startBbox.left + startBbox.width + dxScreen
              : startBbox.left + dxScreen;
          const movingCornerY =
            handle === "sw" || handle === "se"
              ? startBbox.top + startBbox.height + dyScreen
              : startBbox.top + dyScreen;
          const snap = computePointSnap(movingCornerX, movingCornerY, dragId);
          snapDxRef = (dxScreen + snap.offsetX) / autoScale;
          snapDyRef = (dyScreen + snap.offsetY) / autoScale;
          activeGuides = snap.guides;
        } else {
          activeGuides = [];
        }

        let nx = startLayoutX;
        let ny = startLayoutY;
        let nw = drag.startW;
        let nh = drag.startH;
        const minW = 20;
        const minH = 8;
        if (handle === "se") {
          nw = Math.max(minW, drag.startW + snapDxRef);
          nh = Math.max(minH, drag.startH + snapDyRef);
        } else if (handle === "ne") {
          nw = Math.max(minW, drag.startW + snapDxRef);
          nh = Math.max(minH, drag.startH - snapDyRef);
          ny = startLayoutY + (drag.startH - nh);
        } else if (handle === "sw") {
          nw = Math.max(minW, drag.startW - snapDxRef);
          nx = startLayoutX + (drag.startW - nw);
          nh = Math.max(minH, drag.startH + snapDyRef);
        } else if (handle === "nw") {
          nw = Math.max(minW, drag.startW - snapDxRef);
          nx = startLayoutX + (drag.startW - nw);
          nh = Math.max(minH, drag.startH - snapDyRef);
          ny = startLayoutY + (drag.startH - nh);
        }
        t.move(nx, ny);
        t.setSize(nw, nh);
        return;
      }
    }
  }

  function onPointerUp() {
    drag = { type: "idle" };
    activeGuides = [];
  }

  function onBackdropPointerDown(e: PointerEvent) {
    if (e.target === e.currentTarget) {
      selectedId = null;
    }
  }

  // === Toolbar-Aktionen für selektiertes Target ===
  function withSelected(fn: (t: EditTarget, bbox: Rect) => void) {
    if (!selectedId) return;
    const t = targets.find((x) => x.id === selectedId);
    if (!t) return;
    const bbox = bboxes[selectedId];
    if (!bbox) return;
    fn(t, bbox);
  }

  function centerHorizontal() {
    withSelected((t, bbox) => {
      // Neuer left in Screen-px → (windowWidth - bboxWidth) / 2
      const newLeftScreen = (windowWidth - bbox.width) / 2;
      // Delta zum alten left in Ref-px.
      const deltaRef = (newLeftScreen - bbox.left) / autoScale;
      const { x, y } = t.getLayout();
      t.move(x + deltaRef, y);
    });
  }
  function centerVertical() {
    withSelected((t, bbox) => {
      const newTopScreen = (windowHeight - bbox.height) / 2;
      const deltaRef = (newTopScreen - bbox.top) / autoScale;
      const { x, y } = t.getLayout();
      t.move(x, y + deltaRef);
    });
  }
  function centerBoth() {
    centerHorizontal();
    // Nach H-Center erneut messen, damit V-Center die richtige Bbox sieht.
    measure();
    centerVertical();
  }
  function resetScale() {
    withSelected((t) => {
      if (t.kind === "uniform" && t.setScale) t.setScale(1);
    });
  }

  function done() {
    dispatch("done");
  }

  // Hilfsfunktion für die Cursor-Klasse der Handles.
  type Handle = "nw" | "ne" | "sw" | "se";
  function cursorForHandle(h: Handle): string {
    return h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize";
  }
  const HANDLES: Handle[] = ["nw", "ne", "sw", "se"];
</script>

<div class="editor-root" on:pointerdown={onBackdropPointerDown}>
  <!-- Klick-Zonen pro Target -->
  {#each targets as t (t.id)}
    {@const b = bboxes[t.id]}
    {#if b}
      <button
        type="button"
        class="hitzone"
        class:selected={selectedId === t.id}
        class:hovered={hoverId === t.id && selectedId !== t.id}
        style="
          left: {b.left}px;
          top: {b.top}px;
          width: {b.width}px;
          height: {b.height}px;
        "
        on:pointerenter={() => (hoverId = t.id)}
        on:pointerleave={() => (hoverId = null)}
        on:pointerdown={(e) => startMove(e, t.id)}
        aria-label={t.label}
      >
        <span class="tag">{t.label}</span>
      </button>

      {#if selectedId === t.id}
        {#each HANDLES as h}
          {@const isLeft = h === "nw" || h === "sw"}
          {@const isTop = h === "nw" || h === "ne"}
          <div
            class="handle"
            style="
              left: {isLeft ? b.left : b.left + b.width}px;
              top: {isTop ? b.top : b.top + b.height}px;
              cursor: {cursorForHandle(h)};
            "
            on:pointerdown={(e) => startResize(e, t.id, h)}
          ></div>
        {/each}
      {/if}
    {/if}
  {/each}

  <!-- Toolbar -->
  <div class="toolbar" on:pointerdown|stopPropagation>
    <div class="title">
      Edit-Modus
      {#if selectedId}
        <span class="sel-tag">· {targets.find((t) => t.id === selectedId)?.label}</span>
      {/if}
    </div>
    <div class="tools">
      <button class="tb-btn" disabled={!selectedId} on:click={centerHorizontal} title="Horizontal zentrieren">
        ⇔
      </button>
      <button class="tb-btn" disabled={!selectedId} on:click={centerVertical} title="Vertikal zentrieren">
        ⇕
      </button>
      <button class="tb-btn" disabled={!selectedId} on:click={centerBoth} title="In Mitte zentrieren">
        ⊕
      </button>
      <button
        class="tb-btn"
        disabled={!selectedId || targets.find((t) => t.id === selectedId)?.kind !== "uniform"}
        on:click={resetScale}
        title="Skalierung zurücksetzen (1.0x)"
      >
        1:1
      </button>
      <div class="sep"></div>
      <button
        class="tb-btn snap"
        class:active={snapEnabled}
        on:click={() => (snapEnabled = !snapEnabled)}
        title="Snapping ein/aus (Magnet zu Mittellinien & anderen Elementen)"
      >
        Snap
      </button>
      <button
        class="tb-btn snap"
        class:active={showTemporary}
        on:click={() => (showTemporary = !showTemporary)}
        title="Temporäre Elemente einblenden (z.B. Glücksrad)"
      >
        Temp
      </button>
      <div class="sep"></div>
      <button class="tb-btn primary" on:click={done} title="Fertig (E / ESC)">✓ Fertig</button>
    </div>
    <div class="hint">Klick auf ein Element zum Auswählen · Ziehen verschiebt · Ecken skalieren · E/ESC schließt</div>
  </div>

  <!-- Snap-Guides (während Drag) -->
  {#each activeGuides as g}
    {#if g.axis === "x"}
      <div class="guide-v" style="left: {g.pos}px"></div>
    {:else}
      <div class="guide-h" style="top: {g.pos}px"></div>
    {/if}
  {/each}
</div>

<style>
  .editor-root {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(0.5px);
    cursor: default;
  }

  .hitzone {
    position: absolute;
    background: transparent;
    border: 2px dashed rgba(255, 255, 255, 0.35);
    border-radius: 4px;
    padding: 0;
    color: white;
    font-family: var(--font-ui, system-ui, sans-serif);
    cursor: move;
    transition: border-color 100ms, background 100ms;
    box-sizing: border-box;
  }
  .hitzone:hover,
  .hitzone.hovered {
    border-color: rgba(120, 200, 255, 0.85);
    background: rgba(120, 200, 255, 0.08);
  }
  .hitzone.selected {
    border: 2px solid #38bdf8;
    background: rgba(56, 189, 248, 0.1);
  }
  .tag {
    position: absolute;
    top: -22px;
    left: 0;
    font-size: 11px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.75);
    color: #e0f2fe;
    padding: 2px 6px;
    border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
  }

  .handle {
    position: absolute;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    margin-top: -7px;
    background: white;
    border: 2px solid #38bdf8;
    border-radius: 3px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }

  .toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px 10px 6px;
    color: white;
    font-family: var(--font-ui, system-ui, sans-serif);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    min-width: 280px;
    max-width: calc(100% - 24px);
    backdrop-filter: blur(8px);
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: #cbd5e1;
    text-align: center;
    margin-bottom: 6px;
  }
  .sel-tag {
    color: #38bdf8;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }
  .tb-btn {
    min-width: 34px;
    height: 30px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background 100ms, border-color 100ms;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tb-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .tb-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .tb-btn.primary {
    background: #38bdf8;
    color: #0f172a;
    border-color: #38bdf8;
    font-weight: 600;
    font-size: 12px;
  }
  .tb-btn.primary:hover {
    background: #7dd3fc;
    border-color: #7dd3fc;
  }
  .tb-btn.snap {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .tb-btn.snap.active {
    background: rgba(244, 114, 182, 0.18);
    border-color: rgba(244, 114, 182, 0.6);
    color: #fbcfe8;
  }
  .tb-btn.snap.active:hover {
    background: rgba(244, 114, 182, 0.28);
  }

  .guide-v,
  .guide-h {
    position: absolute;
    pointer-events: none;
    background: #f472b6;
    box-shadow: 0 0 4px rgba(244, 114, 182, 0.7);
    z-index: 60;
  }
  .guide-v {
    top: 0;
    bottom: 0;
    width: 1px;
    margin-left: -0.5px;
  }
  .guide-h {
    left: 0;
    right: 0;
    height: 1px;
    margin-top: -0.5px;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 4px;
  }
  .hint {
    margin-top: 6px;
    font-size: 10px;
    color: #94a3b8;
    text-align: center;
  }
</style>
