<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Eraser, Undo2, Pen, Hand, ZoomIn, ZoomOut } from "lucide-vue-next";
import type { Stroke } from "../api/journal";

const props = defineProps<{
  strokes: Stroke[];
  readonly: boolean;
}>();

const emit = defineEmits<{
  "update:strokes": [strokes: Stroke[]];
  focus: [];
}>();

// ── State ───────────────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapperRef = ref<HTMLDivElement | null>(null);
const currentStrokes = ref<Stroke[]>([...props.strokes]);
const activeStroke = ref<Stroke | null>(null);
const selectedColor = ref("#1a1a1a");
const brushWidth = ref(3);
const activeTool = ref<"pen" | "eraser" | "hand">("pen");
const isFullscreen = ref(false);

// Popups
const showColorPicker = ref(false);
const showSizePicker = ref(false);

// Zoom & pan
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
let panStart = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let rafId: number | null = null;

const COLORS = [
  "#1a1a1a", "#c0392b", "#2471a3",
  "#27ae60", "#8e5b2a", "#e67e22",
];

const WIDTHS = [
  { value: 3, label: "S" },
  { value: 6, label: "M" },
  { value: 12, label: "L" },
  { value: 22, label: "XL" },
];

// ── Canvas rendering ────────────────────────────────────────────────────────

function getCtx(): CanvasRenderingContext2D | null {
  return canvasRef.value?.getContext("2d") ?? null;
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  const wrapper = wrapperRef.value;
  if (!canvas || !wrapper) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = wrapper.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  redrawAll();
}

function redrawAll() {
  const canvas = canvasRef.value;
  const ctx = getCtx();
  if (!canvas || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  // Reset transform & clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply zoom + pan
  const z = zoom.value;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, panX.value * dpr, panY.value * dpr);

  // White background (fill the visible area)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-panX.value / z, -panY.value / z, w / z, h / z);

  for (const stroke of currentStrokes.value) {
    drawStroke(ctx, stroke, w, h);
  }
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
) {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;

  if (stroke.eraser) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }

  ctx.beginPath();
  const p0 = stroke.points[0];
  ctx.moveTo(p0.x * w, p0.y * h);

  for (let i = 1; i < stroke.points.length - 1; i++) {
    const curr = stroke.points[i];
    const next = stroke.points[i + 1];
    const mx = ((curr.x + next.x) / 2) * w;
    const my = ((curr.y + next.y) / 2) * h;
    ctx.quadraticCurveTo(curr.x * w, curr.y * h, mx, my);
  }

  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x * w, last.y * h);
  ctx.stroke();
  ctx.restore();
}

// ── Coordinate conversion (screen → world) ─────────────────────────────────

function getCanvasPoint(e: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  // Screen pixel relative to canvas element
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Convert to world coordinates accounting for zoom + pan
  const worldX = (sx - panX.value) / zoom.value;
  const worldY = (sy - panY.value) / zoom.value;

  return {
    x: worldX / w,
    y: worldY / h,
  };
}

// ── Pointer handling ────────────────────────────────────────────────────────

function onPointerDown(e: PointerEvent) {
  if (props.readonly) return;
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.setPointerCapture(e.pointerId);

  // Close popups on canvas interaction
  showColorPicker.value = false;
  showSizePicker.value = false;

  if (activeTool.value === "hand") {
    isPanning.value = true;
    panStart = { x: e.clientX, y: e.clientY };
    panStartOffset = { x: panX.value, y: panY.value };
    return;
  }

  emit("focus");
  const pt = getCanvasPoint(e);
  if (!pt) return;

  const isEraser = activeTool.value === "eraser";
  activeStroke.value = {
    id: crypto.randomUUID(),
    points: [pt],
    color: isEraser ? "#000" : selectedColor.value,
    width: isEraser ? Math.max(brushWidth.value * 2.5, 15) : brushWidth.value,
    eraser: isEraser,
  };
}

let lastPoint: { x: number; y: number } | null = null;

function scheduleRedraw() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    redrawAll();
  });
}

function onPointerMove(e: PointerEvent) {
  if (isPanning.value) {
    panX.value = panStartOffset.x + (e.clientX - panStart.x);
    panY.value = panStartOffset.y + (e.clientY - panStart.y);
    scheduleRedraw();
    return;
  }

  if (!activeStroke.value) return;
  const pt = getCanvasPoint(e);
  if (!pt) return;

  if (lastPoint) {
    const dx = pt.x - lastPoint.x;
    const dy = pt.y - lastPoint.y;
    if (Math.sqrt(dx * dx + dy * dy) < 0.002) return;
  }
  lastPoint = pt;

  activeStroke.value.points.push(pt);

  const ctx = getCtx();
  const canvas = canvasRef.value;
  if (!ctx || !canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const z = zoom.value;
  const points = activeStroke.value.points;

  ctx.save();
  ctx.setTransform(dpr * z, 0, 0, dpr * z, panX.value * dpr, panY.value * dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = activeStroke.value.width;

  if (activeStroke.value.eraser) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = activeStroke.value.color;
  }

  if (points.length >= 3) {
    const prev = points[points.length - 3];
    const curr = points[points.length - 2];
    const next = points[points.length - 1];
    ctx.beginPath();
    ctx.moveTo(((prev.x + curr.x) / 2) * w, ((prev.y + curr.y) / 2) * h);
    ctx.quadraticCurveTo(
      curr.x * w,
      curr.y * h,
      ((curr.x + next.x) / 2) * w,
      ((curr.y + next.y) / 2) * h,
    );
    ctx.stroke();
  } else if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    ctx.beginPath();
    ctx.moveTo(p0.x * w, p0.y * h);
    ctx.lineTo(p1.x * w, p1.y * h);
    ctx.stroke();
  }
  ctx.restore();
}

function onPointerUp() {
  if (isPanning.value) {
    isPanning.value = false;
    return;
  }

  if (!activeStroke.value) return;
  lastPoint = null;

  if (activeStroke.value.points.length >= 2) {
    currentStrokes.value.push(activeStroke.value);
    emit("update:strokes", [...currentStrokes.value]);
  }
  activeStroke.value = null;
  redrawAll();
}

// ── Zoom ────────────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

function zoomIn() {
  zoom.value = Math.min(MAX_ZOOM, +(zoom.value + 0.1).toFixed(2));
  redrawAll();
}

function zoomOut() {
  zoom.value = Math.max(MIN_ZOOM, +(zoom.value - 0.1).toFixed(2));
  redrawAll();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();

  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const oldZoom = zoom.value;
  // Pinch-to-zoom sends smaller deltas, regular wheel sends larger
  const step = e.ctrlKey ? 0.05 : 0.1;
  const delta = e.deltaY > 0 ? -step : step;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(oldZoom + delta).toFixed(2)));

  // Zoom toward mouse position
  panX.value = mx - (mx - panX.value) * (newZoom / oldZoom);
  panY.value = my - (my - panY.value) * (newZoom / oldZoom);
  zoom.value = newZoom;
  redrawAll();
}

// ── Tools ───────────────────────────────────────────────────────────────────

function selectColor(color: string) {
  selectedColor.value = color;
  activeTool.value = "pen";
  showColorPicker.value = false;
}

function selectWidth(w: number) {
  brushWidth.value = w;
  showSizePicker.value = false;
}

function undo() {
  if (currentStrokes.value.length === 0) return;
  currentStrokes.value.pop();
  emit("update:strokes", [...currentStrokes.value]);
  redrawAll();
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  nextTick(() => resizeCanvas());
}

function togglePopup(which: "color" | "size") {
  if (which === "color") {
    showColorPicker.value = !showColorPicker.value;
    showSizePicker.value = false;
  } else {
    showSizePicker.value = !showSizePicker.value;
    showColorPicker.value = false;
  }
}

function closePopups() {
  showColorPicker.value = false;
  showSizePicker.value = false;
}

defineExpose({ toggleFullscreen, isFullscreen });

// ── Lifecycle ───────────────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null;

watch(
  () => props.strokes,
  (newStrokes) => {
    currentStrokes.value = [...newStrokes];
    redrawAll();
  },
);

onMounted(() => {
  resizeCanvas();
  resizeObserver = new ResizeObserver(() => resizeCanvas());
  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
  // Non-passive wheel listener for pinch-to-zoom
  canvasRef.value?.addEventListener("wheel", onWheel, { passive: false });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  canvasRef.value?.removeEventListener("wheel", onWheel);
});
</script>

<template>
  <div
    ref="wrapperRef"
    class="drawing-wrapper"
    :class="{
      'drawing-wrapper--fullscreen': isFullscreen,
      'drawing-wrapper--readonly': readonly,
    }"
  >
    <!-- Toolbar -->
    <div class="drawing-toolbar">
      <!-- Color picker -->
      <div class="toolbar-popup-anchor">
        <button
          class="tool-btn"
          title="Couleur"
          @click="togglePopup('color')"
        >
          <span class="color-swatch" :style="{ background: selectedColor }" />
        </button>
        <div v-if="showColorPicker" class="popup color-popup">
          <button
            v-for="color in COLORS"
            :key="color"
            class="color-btn"
            :class="{ active: selectedColor === color }"
            :style="{ '--swatch': color }"
            @click="selectColor(color)"
          />
        </div>
      </div>

      <!-- Size picker -->
      <div class="toolbar-popup-anchor">
        <button
          class="tool-btn"
          title="Taille"
          @click="togglePopup('size')"
        >
          <span
            class="width-dot"
            :style="{
              width: Math.min(brushWidth, 16) + 'px',
              height: Math.min(brushWidth, 16) + 'px',
            }"
          />
        </button>
        <div v-if="showSizePicker" class="popup size-popup">
          <button
            v-for="w in WIDTHS"
            :key="w.value"
            class="size-option"
            :class="{ active: brushWidth === w.value }"
            @click="selectWidth(w.value)"
          >
            <span
              class="width-dot"
              :style="{
                width: Math.min(w.value, 16) + 'px',
                height: Math.min(w.value, 16) + 'px',
              }"
            />
            <span class="size-label">{{ w.label }}</span>
          </button>
        </div>
      </div>

      <div class="toolbar-sep" />

      <!-- Tools: pen / eraser / hand -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'pen' }"
        title="Crayon"
        @click="activeTool = 'pen'; closePopups()"
      >
        <Pen :size="18" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'eraser' }"
        title="Gomme"
        @click="activeTool = 'eraser'; closePopups()"
      >
        <Eraser :size="18" />
      </button>
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'hand' }"
        title="Déplacer"
        @click="activeTool = 'hand'; closePopups()"
      >
        <Hand :size="18" />
      </button>

      <div class="toolbar-sep" />

      <!-- Undo -->
      <button
        class="tool-btn"
        title="Annuler"
        :disabled="currentStrokes.length === 0"
        @click="undo"
      >
        <Undo2 :size="18" />
      </button>

      <!-- Zoom -->
      <button class="tool-btn" title="Dézoomer" :disabled="zoom <= 0.5" @click="zoomOut">
        <ZoomOut :size="18" />
      </button>
      <span v-if="zoom !== 1" class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <button class="tool-btn" title="Zoomer" :disabled="zoom >= 4" @click="zoomIn">
        <ZoomIn :size="18" />
      </button>

    </div>

    <!-- Canvas -->
    <canvas
      ref="canvasRef"
      class="drawing-canvas"
      :class="{
        'cursor-crosshair': activeTool === 'pen',
        'cursor-eraser': activeTool === 'eraser',
        'cursor-grab': activeTool === 'hand' && !isPanning,
        'cursor-grabbing': isPanning,
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />

    <!-- Readonly overlay -->
    <div v-if="readonly" class="readonly-overlay">
      Verrouillé en édition
    </div>
  </div>
</template>

<style scoped>
.drawing-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: #fff;
}

.drawing-wrapper--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 999;
  border-radius: 0;
  border: none;
}

.drawing-wrapper--readonly {
  opacity: 0.7;
}

/* ── Toolbar ── */

.drawing-toolbar {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.5rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.toolbar-sep {
  width: 1px;
  height: 22px;
  background: var(--border);
  flex-shrink: 0;
}

/* ── Tool buttons ── */

.tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--text);
  transition: background 120ms, border-color 120ms, color 120ms;
  flex-shrink: 0;
}

.tool-btn:hover {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.tool-btn.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.tool-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* ── Color swatch (in toolbar button) ── */

.color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--text) 25%, transparent);
}

/* ── Width dot ── */

.width-dot {
  border-radius: 50%;
  background: var(--text);
  display: block;
}

/* ── Popup anchor ── */

.toolbar-popup-anchor {
  position: relative;
}

.popup {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  padding: 0.45rem;
}

/* ── Color popup ── */

.color-popup {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
  min-width: 100px;
}

.color-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: var(--swatch);
  cursor: pointer;
  padding: 0;
  transition: border-color 120ms, transform 120ms;
}

.color-btn:hover {
  transform: scale(1.15);
}

.color-btn.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

/* ── Size popup ── */

.size-popup {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 80px;
}

.size-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}

.size-option:hover {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.size-option.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.size-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
}

/* ── Zoom label ── */

.zoom-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  min-width: 2.2rem;
  text-align: center;
  flex-shrink: 0;
}

/* ── Canvas ── */

.drawing-canvas {
  flex: 1;
  display: block;
  touch-action: none;
}

.cursor-crosshair { cursor: crosshair; }
.cursor-eraser { cursor: cell; }
.cursor-grab { cursor: grab; }
.cursor-grabbing { cursor: grabbing; }

/* ── Readonly overlay ── */

.readonly-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.08);
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
  pointer-events: none;
}
</style>
