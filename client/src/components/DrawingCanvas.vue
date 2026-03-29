<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Eraser, Undo2, Minus, Circle, Maximize, Minimize, Pen } from "lucide-vue-next";
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
const brushWidth = ref(3); // default = S
const isEraser = ref(false);
const isFullscreen = ref(false);

const COLORS = [
  "#1a1a1a", // noir
  "#c0392b", // rouge
  "#2471a3", // bleu
  "#27ae60", // vert
  "#8e5b2a", // marron
  "#e67e22", // orange
];

const WIDTHS = [
  { value: 3, label: "S" },
  { value: 6, label: "M" },
  { value: 12, label: "L" },
  { value: 22, label: "XL" },
  { value: 36, label: "XXL" },
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
  const ctx = getCtx();
  if (ctx) ctx.scale(dpr, dpr);
  redrawAll();
}

function redrawAll() {
  const canvas = canvasRef.value;
  const ctx = getCtx();
  if (!canvas || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  // White background
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  for (const stroke of currentStrokes.value) {
    drawStroke(ctx, stroke, w, h);
  }
  ctx.restore();
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number
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

  // Use quadratic curves for smoothness
  for (let i = 1; i < stroke.points.length - 1; i++) {
    const curr = stroke.points[i];
    const next = stroke.points[i + 1];
    const mx = ((curr.x + next.x) / 2) * w;
    const my = ((curr.y + next.y) / 2) * h;
    ctx.quadraticCurveTo(curr.x * w, curr.y * h, mx, my);
  }

  // Last point
  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x * w, last.y * h);
  ctx.stroke();
  ctx.restore();
}

// ── Pointer handling ────────────────────────────────────────────────────────

function getCanvasPoint(e: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  };
}

function onPointerDown(e: PointerEvent) {
  if (props.readonly) return;
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.setPointerCapture(e.pointerId);
  emit("focus");

  const pt = getCanvasPoint(e);
  if (!pt) return;

  activeStroke.value = {
    id: crypto.randomUUID(),
    points: [pt],
    color: isEraser.value ? "#000" : selectedColor.value,
    width: isEraser.value ? Math.max(brushWidth.value * 2.5, 15) : brushWidth.value,
    eraser: isEraser.value,
  };
}

let lastPoint: { x: number; y: number } | null = null;

function onPointerMove(e: PointerEvent) {
  if (!activeStroke.value) return;
  const pt = getCanvasPoint(e);
  if (!pt) return;

  // Skip if too close to last point (perf optimization)
  if (lastPoint) {
    const dx = pt.x - lastPoint.x;
    const dy = pt.y - lastPoint.y;
    if (Math.sqrt(dx * dx + dy * dy) < 0.002) return;
  }
  lastPoint = pt;

  activeStroke.value.points.push(pt);

  // Draw incrementally for real-time feedback
  const ctx = getCtx();
  const canvas = canvasRef.value;
  if (!ctx || !canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const points = activeStroke.value.points;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      ((curr.y + next.y) / 2) * h
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
  if (!activeStroke.value) return;
  lastPoint = null;

  if (activeStroke.value.points.length >= 2) {
    currentStrokes.value.push(activeStroke.value);
    emit("update:strokes", [...currentStrokes.value]);
  }
  activeStroke.value = null;
  // Full redraw for clean rendering
  redrawAll();
}

// ── Tools ───────────────────────────────────────────────────────────────────

function selectColor(color: string) {
  selectedColor.value = color;
  isEraser.value = false;
}

function toggleEraser() {
  isEraser.value = !isEraser.value;
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

// ── Lifecycle ───────────────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null;

watch(
  () => props.strokes,
  (newStrokes) => {
    currentStrokes.value = [...newStrokes];
    redrawAll();
  }
);

onMounted(() => {
  resizeCanvas();
  resizeObserver = new ResizeObserver(() => resizeCanvas());
  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="wrapperRef"
    class="drawing-wrapper"
    :class="{ 'drawing-wrapper--fullscreen': isFullscreen, 'drawing-wrapper--readonly': readonly }"
  >
    <!-- Toolbar -->
    <div class="drawing-toolbar">
      <div class="toolbar-group colors">
        <button
          v-for="color in COLORS"
          :key="color"
          class="color-btn"
          :class="{ active: selectedColor === color && !isEraser }"
          :style="{ '--swatch': color }"
          @click="selectColor(color)"
        />
      </div>

      <div class="toolbar-sep" />

      <div class="toolbar-group widths">
        <button
          v-for="w in WIDTHS"
          :key="w.value"
          class="width-btn"
          :class="{ active: brushWidth === w.value }"
          :title="w.label"
          @click="brushWidth = w.value"
        >
          <span class="width-dot" :style="{ width: Math.min(w.value, 16) + 'px', height: Math.min(w.value, 16) + 'px' }" />
        </button>
      </div>

      <div class="toolbar-sep" />

      <div class="toolbar-group tools">
        <button class="tool-btn" :class="{ active: !isEraser }" title="Crayon" @click="isEraser = false">
          <Pen :size="18" />
        </button>
        <button class="tool-btn" :class="{ active: isEraser }" title="Gomme" @click="toggleEraser">
          <Eraser :size="18" />
        </button>
        <button class="tool-btn" title="Annuler" :disabled="currentStrokes.length === 0" @click="undo">
          <Undo2 :size="18" />
        </button>
      </div>

      <div class="toolbar-sep" />

      <button class="tool-btn" :title="isFullscreen ? 'Réduire' : 'Plein écran'" @click="toggleFullscreen">
        <Minimize v-if="isFullscreen" :size="18" />
        <Maximize v-else :size="18" />
      </button>
    </div>

    <!-- Canvas -->
    <canvas
      ref="canvasRef"
      class="drawing-canvas"
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
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.toolbar-sep {
  width: 1px;
  height: 22px;
  background: var(--border);
  flex-shrink: 0;
}

/* Colors */
.color-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: var(--swatch);
  cursor: pointer;
  padding: 0;
  transition: border-color 120ms, transform 120ms;
  flex-shrink: 0;
}

.color-btn:hover {
  transform: scale(1.15);
}

.color-btn.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

/* Widths */
.width-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 120ms, border-color 120ms;
}

.width-btn:hover {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.width-btn.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.width-dot {
  border-radius: 50%;
  background: var(--text);
}

/* Tools */
.tool-btn {
  width: 36px;
  height: 36px;
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

/* ── Canvas ── */

.drawing-canvas {
  flex: 1;
  display: block;
  touch-action: none;
  cursor: crosshair;
}

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
