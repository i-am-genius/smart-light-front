<template>
  <nav class="sidebar" ref="sidebarRef" @pointerdown.capture="onSidebarPointerDown">
    <ul>
      <li
        v-for="tab in tabs"
        :key="tab.key"
        :ref="el => setTabRef(tab.key, el)"
        class="sidebar-item sidebar-nav-item"
        :class="{ active: targetKey === tab.key }"
        @click="handleTabClick(tab.key, $event)"
      >
        <span class="sidebar-icon" :class="animatedTab === tab.key ? 'anim-' + tab.key : ''" v-html="tab.icon"></span>
        <span class="sidebar-nav-text">{{ tab.label }}</span>
      </li>
    </ul>

    <!-- Canvas refraction layer — pixel-level lens + RGB split at pill edges -->
    <canvas
      ref="refractionCanvas"
      class="refraction-canvas"
    />

    <!-- Glass pill — above tabs, draggable, snaps with spring overshoot -->
    <div
      ref="pillRef"
      class="pill-indicator"
      :class="{
        'pill-dragging': isDragging,
        'pill-snapping': isSnapping,
      }"
      :style="pillStyle"
      @pointerdown.prevent="onPillDown"
    />
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DashboardTab } from '../../types/device'
import { formatRgbColor, getRefractionSceneBaseColor } from '../../utils/sidebarRefraction'

const props = defineProps<{
  modelValue: DashboardTab
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: DashboardTab): void
}>()

const route = useRoute()
const router = useRouter()
const sidebarRef = ref<HTMLElement | null>(null)
const pillRef = ref<HTMLElement | null>(null)

const tabs: { key: DashboardTab; label: string; icon: string }[] = [
  { key: 'main', label: '实时灯控', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path class="icon-sun-ray ray-1" d="M12 2v2"/><path class="icon-sun-ray ray-2" d="M12 20v2"/><path class="icon-sun-ray ray-3" d="M4.93 4.93l1.41 1.41"/><path class="icon-sun-ray ray-4" d="M17.66 17.66l1.41 1.41"/><path class="icon-sun-ray ray-5" d="M2 12h2"/><path class="icon-sun-ray ray-6" d="M20 12h2"/><path class="icon-sun-ray ray-7" d="M6.34 17.66l-1.41 1.41"/><path class="icon-sun-ray ray-8" d="M19.07 4.93l-1.41 1.41"/><circle class="icon-sun-core" cx="12" cy="12" r="5"/></svg>' },
  { key: 'flow', label: '数据仪表', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect class="icon-bar icon-bar-1" x="3" y="12" width="4" height="9" rx="1"/><rect class="icon-bar icon-bar-2" x="10" y="7" width="4" height="14" rx="1"/><rect class="icon-bar icon-bar-3" x="17" y="3" width="4" height="18" rx="1"/></svg>' },
  { key: 'settings', label: '设置', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle class="icon-gear-center" cx="12" cy="12" r="3"/><path class="icon-gear-tooth" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
  { key: 'firmware', label: '固件管理', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect class="icon-device-body" x="4" y="2" width="16" height="20" rx="2"/><path class="icon-device-top-line" d="M9 6h6"/><path class="icon-device-dot" d="M12 18h.01"/></svg>' },
]

const tabRefs = ref<Record<string, HTMLElement | null>>({})
const targetKey = ref(props.modelValue)
const domReady = ref(false)
const animatedTab = ref<string | null>(null)
let animTimer: number | undefined

function setTabRef(key: DashboardTab, el: unknown) {
  tabRefs.value[key] = el as HTMLElement | null
}

function triggerTabAnimation(key: DashboardTab) {
  animatedTab.value = key as string
  if (animTimer) clearTimeout(animTimer)
  animTimer = window.setTimeout(() => { animatedTab.value = null }, 420)
}

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

function onResize() {
  windowWidth.value = window.innerWidth
  nextTick(() => rebuildScene())
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  nextTick(() => {
    domReady.value = true
    initRefractionCanvas()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (animTimer) clearTimeout(animTimer)
  stopRefractionTracking()
  cleanupDrag()
})

const isMobile = computed(() => windowWidth.value <= 768)

/* ============================================================
   Pill geometry
   ============================================================ */

function getPillRectForKey(key: DashboardTab) {
  const el = tabRefs.value[key]
  const sidebar = sidebarRef.value
  if (!el || !sidebar) return null
  const tr = el.getBoundingClientRect()
  const sr = sidebar.getBoundingClientRect()
  const pad = isMobile.value ? -4 : -7
  return {
    x: tr.left - sr.left + pad,
    y: tr.top - sr.top + pad,
    w: tr.width - pad * 2,
    h: tr.height - pad * 2,
  }
}

/** Get the pill rect as currently rendered (drag position or target tab position) */
function currentPillRect() {
  if (isDragging.value && dragRect.value) return dragRect.value
  return getPillRectForKey(targetKey.value)
}

/* ============================================================
   Pill style
   ============================================================ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pillStyle = computed<any>(() => {
  if (isDragging.value && dragRect.value) {
    return {
      left: `${dragRect.value.x}px`,
      top: `${dragRect.value.y}px`,
      width: `${dragRect.value.w}px`,
      height: `${dragRect.value.h}px`,
      '--pill-drag-scale-x': dragScaleX.value.toFixed(3),
      '--pill-drag-scale-y': dragScaleY.value.toFixed(3),
      transition: 'transform 90ms cubic-bezier(0.2, 0.82, 0.2, 1)',
    }
  }
  const rect = getPillRectForKey(targetKey.value)
  if (!rect) return { visibility: 'hidden' }
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    transition: isSnapping.value
      ? 'left 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.35s cubic-bezier(0.34, 1.3, 0.64, 1), height 0.35s cubic-bezier(0.34, 1.3, 0.64, 1), transform 0.45s cubic-bezier(0.22, 1.32, 0.36, 1)'
      : 'left 0.35s cubic-bezier(0.34, 1.3, 0.64, 1), top 0.35s cubic-bezier(0.34, 1.3, 0.64, 1), width 0.3s ease, height 0.3s ease, transform 0.3s cubic-bezier(0.22, 1.2, 0.36, 1)',
  }
})

/* ============================================================
   Drag
   ============================================================ */

const isDragging = ref(false)
const isSnapping = ref(false)
const dragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const dragScaleX = ref(0.94)
const dragScaleY = ref(1.08)
type PillRect = { x: number; y: number; w: number; h: number }
type RefractionMode = 'static' | 'drag'
const DRAG_SCALE_X = 0.94
const DRAG_SCALE_Y = 1.08
let dragOffsetX = 0
let dragOffsetY = 0
let dragPillW = 0
let dragPillH = 0
let lastDragClientX = 0
let lastDragClientY = 0
let lastDragSampleAt = 0
let refractionRaf: number | undefined
let dragPaintRaf: number | undefined
let refractionStopAt = 0
let lastRefractionRect: PillRect | null = null
let refractionRunId = 0
let refractionQueueId = 0
let suppressNextClick = false

function onSidebarPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (isDragging.value) return

  const rect = getRenderedPillRect() || currentPillRect()
  const sidebar = sidebarRef.value
  if (!rect || !sidebar) return

  const sr = sidebar.getBoundingClientRect()
  const x = e.clientX - sr.left
  const y = e.clientY - sr.top
  const hitPad = isMobile.value ? 8 : 6
  const insidePill =
    x >= rect.x - hitPad &&
    x <= rect.x + rect.w + hitPad &&
    y >= rect.y - hitPad &&
    y <= rect.y + rect.h + hitPad

  if (!insidePill) return

  e.preventDefault()
  e.stopPropagation()
  suppressNextClick = true
  onPillDown(e)
}

function onPillDown(e: PointerEvent) {
  const pill = pillRef.value
  const sidebar = sidebarRef.value
  if (!pill || !sidebar) return

  try {
    pill.setPointerCapture(e.pointerId)
  } catch {
    // Window-level listeners below keep dragging reliable when the pointerdown
    // originated from text layered above the glass pill.
  }

  const pr = pill.getBoundingClientRect()
  const sr = sidebar.getBoundingClientRect()

  dragOffsetX = e.clientX - pr.left
  dragOffsetY = e.clientY - pr.top
  dragPillW = pr.width
  dragPillH = pr.height
  lastDragClientX = e.clientX
  lastDragClientY = e.clientY
  lastDragSampleAt = performance.now()
  dragScaleX.value = DRAG_SCALE_X
  dragScaleY.value = DRAG_SCALE_Y

  isDragging.value = true
  isSnapping.value = false

  const oldRect = currentPillRect()
  dragRect.value = { x: pr.left - sr.left, y: pr.top - sr.top, w: pr.width, h: pr.height }

  window.addEventListener('pointermove', onPillMove)
  window.addEventListener('pointerup', onPillUp)
  window.addEventListener('pointercancel', onPillUp)

  // Clear old refraction before drag visuals start.
  if (oldRect && !lastRefractionRect) clearRefractionCanvas()
  scheduleDragRefractionPaint(dragRect.value)
}

function onPillMove(e: PointerEvent) {
  if (!isDragging.value || !sidebarRef.value) return
  const sr = sidebarRef.value.getBoundingClientRect()
  updateDragVelocityScale(e)

  let nx = e.clientX - sr.left - dragOffsetX
  let ny = e.clientY - sr.top - dragOffsetY

  const pad = isMobile.value ? 10 : 12
  nx = Math.max(pad, Math.min(nx, sr.width - dragPillW - pad))
  ny = Math.max(pad, Math.min(ny, sr.height - dragPillH - pad))

  dragRect.value = { x: nx, y: ny, w: dragPillW, h: dragPillH }

  if (!lastRefractionRect) clearRefractionCanvas()
  scheduleDragRefractionPaint(dragRect.value)
}

function onPillUp(_e: PointerEvent) {
  const releasedRect = dragRect.value
  stopDragRefractionPaint()
  window.removeEventListener('pointermove', onPillMove)
  window.removeEventListener('pointerup', onPillUp)
  window.removeEventListener('pointercancel', onPillUp)

  if (!releasedRect || !sidebarRef.value) {
    cleanupDrag()
    return
  }

  const pillCX = releasedRect.x + releasedRect.w / 2
  const pillCY = releasedRect.y + releasedRect.h / 2

  let bestKey: DashboardTab = targetKey.value
  let bestDist = Infinity

  for (const tab of tabs) {
    const rect = getPillRectForKey(tab.key)
    if (!rect) continue
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const dist = (pillCX - cx) ** 2 + (pillCY - cy) ** 2
    if (dist < bestDist) { bestDist = dist; bestKey = tab.key }
  }

  const snapRect = getPillRectForKey(bestKey)

  isDragging.value = false
  isSnapping.value = true
  const oldDragRect = { ...releasedRect }
  dragRect.value = null

  targetKey.value = bestKey
  if (bestKey !== props.modelValue) {
    triggerTabAnimation(bestKey)
    emit('update:modelValue', bestKey)
  }

  if (snapRect) {
    queueRefractionTracking(500, oldDragRect)
  }

  window.setTimeout(() => { suppressNextClick = false }, 120)

  setTimeout(() => {
    isSnapping.value = false
    // Final render at settled position
    const final = getPillRectForKey(bestKey)
    if (final) {
      rebuildScene()
      renderRefractionAtRect(final)
    }
  }, 500)
}

function cleanupDrag() {
  stopRefractionTracking()
  stopDragRefractionPaint()
  isDragging.value = false
  dragRect.value = null
  dragScaleX.value = DRAG_SCALE_X
  dragScaleY.value = DRAG_SCALE_Y
  window.removeEventListener('pointermove', onPillMove)
  window.removeEventListener('pointerup', onPillUp)
  window.removeEventListener('pointercancel', onPillUp)
}

function getRenderedPillRect() {
  const pill = pillRef.value
  const sidebar = sidebarRef.value
  if (!pill || !sidebar) return null
  const pr = pill.getBoundingClientRect()
  const sr = sidebar.getBoundingClientRect()
  return {
    x: pr.left - sr.left,
    y: pr.top - sr.top,
    w: pr.width,
    h: pr.height,
  }
}

function getDragVisualRect(rect: PillRect): PillRect {
  const w = rect.w * dragScaleX.value
  const h = rect.h * dragScaleY.value
  return {
    x: rect.x + (rect.w - w) / 2,
    y: rect.y + (rect.h - h) / 2,
    w,
    h,
  }
}

function scheduleDragRefractionPaint(fallbackRect?: PillRect | null) {
  if (dragPaintRaf) cancelAnimationFrame(dragPaintRaf)
  dragPaintRaf = requestAnimationFrame(() => {
    dragPaintRaf = undefined
    const renderedRect = getRenderedPillRect()
    const rect = renderedRect || (fallbackRect ? getDragVisualRect(fallbackRect) : null)
    if (rect) paintRefractionRect(rect, 'drag')
  })
}

function updateDragVelocityScale(e: PointerEvent) {
  const now = performance.now()
  const dt = Math.max(16, now - lastDragSampleAt)
  const dx = e.clientX - lastDragClientX
  const dy = e.clientY - lastDragClientY
  const distance = Math.sqrt(dx * dx + dy * dy)
  const speed = distance / dt
  const speedIntensity = clamp((speed - 0.025) / 0.48, 0, 1)
  const distanceIntensity = clamp((distance - 1.5) / 8, 0, 1)
  const intensity = Math.max(speedIntensity, distanceIntensity)
  const horizontal = Math.abs(dx) > Math.abs(dy)

  const targetX = horizontal
    ? DRAG_SCALE_X + intensity * 0.34
    : DRAG_SCALE_X - intensity * 0.13
  const targetY = horizontal
    ? DRAG_SCALE_Y - intensity * 0.13
    : DRAG_SCALE_Y + intensity * 0.28

  dragScaleX.value += (targetX - dragScaleX.value) * 0.68
  dragScaleY.value += (targetY - dragScaleY.value) * 0.68
  lastDragClientX = e.clientX
  lastDragClientY = e.clientY
  lastDragSampleAt = now
}

function stopDragRefractionPaint() {
  if (dragPaintRaf) {
    cancelAnimationFrame(dragPaintRaf)
    dragPaintRaf = undefined
  }
}

function clearRefractionCanvas() {
  const vis = refractionCanvas.value
  if (!vis) return
  const ctx = vis.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, SW, SH)
}

function paintRefractionRect(rect: PillRect, mode: RefractionMode = 'static') {
  clearRefractionCanvas()
  renderRefractionAtRect(rect, mode)
  lastRefractionRect = { ...rect }
}

function clearTrackedRefraction() {
  clearRefractionCanvas()
  lastRefractionRect = null
}

function queueRefractionTracking(duration = 420, _fallbackRestore?: PillRect, mode: RefractionMode = 'static') {
  const queueId = ++refractionQueueId
  nextTick(() => {
    if (queueId !== refractionQueueId) return
    startRefractionTracking(duration, mode)
  })
}

function queueStaticRefractionPaint() {
  const queueId = refractionQueueId
  nextTick(() => {
    if (queueId !== refractionQueueId || isDragging.value) return
    if (refractionRaf) return
    refreshRefractionSources()
    const rect = currentPillRect()
    if (rect) paintRefractionRect(rect)
  })
}

function startRefractionTracking(duration = 420, mode: RefractionMode = 'static') {
  stopRefractionTracking()
  const runId = ++refractionRunId
  clearTrackedRefraction()
  refreshRefractionSources()
  refractionStopAt = performance.now() + duration

  const tick = () => {
    if (runId !== refractionRunId) return

    const rect = getRenderedPillRect() || currentPillRect()
    if (rect) paintRefractionRect(rect, mode)

    if (performance.now() < refractionStopAt) {
      refractionRaf = requestAnimationFrame(tick)
      return
    }

    const finalRect = currentPillRect()
    if (finalRect) paintRefractionRect(finalRect)
    if (runId === refractionRunId) refractionRaf = undefined
  }

  tick()
}

function stopRefractionTracking() {
  refractionRunId++
  if (refractionRaf) {
    cancelAnimationFrame(refractionRaf)
    refractionRaf = undefined
  }
}

/* ============================================================
   Tab click
   ============================================================ */

function handleTabClick(key: DashboardTab, e?: MouseEvent) {
  if (suppressNextClick) {
    e?.preventDefault()
    e?.stopPropagation()
    suppressNextClick = false
    return
  }

  if (route.name !== 'smartlightdashboard' || route.query.tab !== key) {
    router.push({ path: '/smartlightdashboard', query: { tab: key } })
  } else {
    emit('update:modelValue', key)
  }
  const oldRect = currentPillRect()
  targetKey.value = key
  if (key !== props.modelValue) {
    triggerTabAnimation(key)
  }
  queueRefractionTracking(420, oldRect || undefined)
}

watch(() => props.modelValue, (key) => {
  if (key !== targetKey.value && !isDragging.value) {
    const oldRect = currentPillRect()
    targetKey.value = key
    triggerTabAnimation(key)
    queueRefractionTracking(420, oldRect || undefined)
  } else {
    queueStaticRefractionPaint()
  }
})

/* ============================================================
   Canvas refraction — pixel displacement + RGB chromatic split
   ============================================================ */

const refractionCanvas = ref<HTMLCanvasElement | null>(null)
let bgCanvas: HTMLCanvasElement | null = null
let bgCtx: CanvasRenderingContext2D | null = null
let dragBgCanvas: HTMLCanvasElement | null = null
let dragBgCtx: CanvasRenderingContext2D | null = null
let baseCanvas: HTMLCanvasElement | null = null
let baseCtx: CanvasRenderingContext2D | null = null
const iconImageCache = new Map<string, HTMLImageElement>()
let SW = 0
let SH = 0
const REFRACTION_PAD = 12
const MAX_BEND = 38
const CHROMA = 1.15
const EDGE_BAND = 8
const DRAG_DEPTH_RATIO = 0.42
const DRAG_BEND_RATIO = 0.5

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function smoothstepR(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function getRoundedRectSDF(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number, radius: number,
): { distance: number; nx: number; ny: number } {
  const cx = rx + rw / 2
  const cy = ry + rh / 2
  const dx = Math.abs(px - cx) - (rw / 2 - radius)
  const dy = Math.abs(py - cy) - (rh / 2 - radius)
  const mx = Math.max(dx, 0)
  const my = Math.max(dy, 0)
  const outside = Math.sqrt(mx * mx + my * my)
  const inside = Math.min(Math.max(dx, dy), 0)
  const distance = outside + inside - radius
  let nx = 0, ny = 0
  if (outside > 0.001) {
    nx = mx > 0 ? (px > cx ? mx : -mx) : 0
    ny = my > 0 ? (py > cy ? my : -my) : 0
    const len = Math.sqrt(nx * nx + ny * ny)
    if (len > 0) { nx /= len; ny /= len }
  } else {
    if (dx > dy) { nx = px > cx ? 1 : -1 } else { ny = py > cy ? 1 : -1 }
  }
  return { distance, nx, ny }
}

function sampleChannelBilinear(
  img: ImageData, x: number, y: number, channel: number,
): number {
  const w = img.width, h = img.height
  x = clamp(x, 0, w - 1)
  y = clamp(y, 0, h - 1)
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1)
  const tx = x - x0, ty = y - y0
  const i00 = (y0 * w + x0) * 4 + channel
  const i10 = (y0 * w + x1) * 4 + channel
  const i01 = (y1 * w + x0) * 4 + channel
  const i11 = (y1 * w + x1) * 4 + channel
  const top = img.data[i00] * (1 - tx) + img.data[i10] * tx
  const bottom = img.data[i01] * (1 - tx) + img.data[i11] * tx
  return top * (1 - ty) + bottom * ty
}

function initRefractionCanvas() {
  const sidebar = sidebarRef.value
  if (!sidebar) return
  const rect = sidebar.getBoundingClientRect()
  SW = Math.round(rect.width)
  SH = Math.round(rect.height)

  // Visible canvas
  const vis = refractionCanvas.value
  if (vis) {
    vis.width = SW
    vis.height = SH
  }

  // Offscreen background scene canvas
  if (!bgCanvas) {
    bgCanvas = document.createElement('canvas')
    bgCtx = bgCanvas.getContext('2d')!
  }
  if (!dragBgCanvas) {
    dragBgCanvas = document.createElement('canvas')
    dragBgCtx = dragBgCanvas.getContext('2d')!
  }
  if (!baseCanvas) {
    baseCanvas = document.createElement('canvas')
    baseCtx = baseCanvas.getContext('2d')!
  }
  bgCanvas.width = SW
  bgCanvas.height = SH
  dragBgCanvas.width = SW
  dragBgCanvas.height = SH
  baseCanvas.width = SW
  baseCanvas.height = SH

  rebuildScene()
}

function rebuildScene() {
  const sidebar = sidebarRef.value
  if (!sidebar || !bgCtx || !bgCanvas || !dragBgCtx || !dragBgCanvas || !baseCtx || !baseCanvas) return
  const rect = sidebar.getBoundingClientRect()
  SW = Math.round(rect.width)
  SH = Math.round(rect.height)
  bgCanvas.width = SW
  bgCanvas.height = SH
  dragBgCanvas.width = SW
  dragBgCanvas.height = SH
  baseCanvas.width = SW
  baseCanvas.height = SH

  // Also resize visible canvas
  const vis = refractionCanvas.value
  if (vis) { vis.width = SW; vis.height = SH }

  refreshRefractionSources()

  // Keep the visible canvas transparent outside refraction pixels.
  const visCtx = refractionCanvas.value?.getContext('2d')
  if (visCtx) {
    visCtx.clearRect(0, 0, SW, SH)
  }

  // Render refraction at current pill position
  const pillRect = currentPillRect()
  if (pillRect) {
    renderRefractionAtRect(pillRect)
    lastRefractionRect = { ...pillRect }
  } else {
    lastRefractionRect = null
  }
}

function refreshRefractionSources() {
  if (!baseCtx || !bgCtx || !dragBgCtx) return
  drawRefractionScene(baseCtx, false)
  drawRefractionScene(bgCtx, true, false)
  drawRefractionScene(dragBgCtx, true, true)
}

function isNightScene(): boolean {
  return !!sidebarRef.value?.closest('.night-mode')
}

function drawRefractionScene(ctx: CanvasRenderingContext2D, includeNavContent: boolean, includeIcons = false) {
  ctx.clearRect(0, 0, SW, SH)

  const night = isNightScene()
  const sceneMode = includeIcons ? 'drag' : 'static'
  ctx.fillStyle = formatRgbColor(getRefractionSceneBaseColor(night, 0, sceneMode))
  ctx.fillRect(0, 0, SW, SH)

  ctx.fillStyle = night ? 'rgba(148,163,184,0.05)' : 'rgba(148,163,184,0.025)'
  for (let i = 0; i < 280; i++) {
    const dx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * SW
    const dy = ((Math.sin(i * 78.233) * 24634.6345) % 1 + 1) % 1 * SH
    ctx.beginPath()
    ctx.arc(dx, dy, 0.55 + ((i * 37) % 7) * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }

  if (!includeNavContent) return

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const sidebarRect = sidebarRef.value?.getBoundingClientRect()
  if (!sidebarRect) return

  for (const tab of tabs) {
    const item = tabRefs.value[tab.key]
    const isActive = tab.key === targetKey.value
    const navColor = getStableNavColor(night, isActive)
    if (includeIcons) drawIconToRefractionScene(ctx, item, sidebarRect, navColor)

    const textEl = item?.querySelector<HTMLElement>('.sidebar-nav-text')
    if (!textEl) continue

    const textRect = textEl.getBoundingClientRect()
    const textStyle = window.getComputedStyle(textEl)
    ctx.fillStyle = navColor
    ctx.font = `${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`
    ctx.fillText(
      tab.label,
      textRect.left - sidebarRect.left,
      textRect.top - sidebarRect.top + textRect.height / 2,
    )
  }

  ctx.textAlign = 'start'
}

function getStableNavColor(night: boolean, active: boolean) {
  if (active) return night ? '#93c5fd' : '#1d4ed8'
  return night ? 'rgba(226, 232, 240, 0.72)' : '#475569'
}

function drawIconToRefractionScene(
  ctx: CanvasRenderingContext2D,
  item: HTMLElement | null | undefined,
  sidebarRect: DOMRect,
  colorOverride?: string,
) {
  const iconEl = item?.querySelector<HTMLElement>('.sidebar-icon')
  const svgEl = iconEl?.querySelector<SVGSVGElement>('svg')
  if (!iconEl || !svgEl) return

  const iconRect = iconEl.getBoundingClientRect()
  const iconStyle = window.getComputedStyle(iconEl)
  const itemStyle = item ? window.getComputedStyle(item) : iconStyle
  const color = colorOverride || iconStyle.color || itemStyle.color || '#64748b'
  const opacity = Number.parseFloat(iconStyle.opacity || '1')
  const svgText = prepareSvgForCanvas(svgEl.outerHTML, color)
  const cacheKey = `${color}|${svgText}`
  let img = iconImageCache.get(cacheKey)

  if (!img) {
    img = new Image()
    img.onload = () => rebuildScene()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
    iconImageCache.set(cacheKey, img)
  }

  if (!img.complete || img.naturalWidth <= 0) return

  ctx.save()
  ctx.globalAlpha *= Number.isFinite(opacity) ? opacity : 1
  ctx.drawImage(
    img,
    iconRect.left - sidebarRect.left,
    iconRect.top - sidebarRect.top,
    iconRect.width,
    iconRect.height,
  )
  ctx.restore()
}

function prepareSvgForCanvas(svgText: string, color: string): string {
  let prepared = svgText
  if (!prepared.includes('xmlns=')) {
    prepared = prepared.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  }
  return prepared.replace('<svg ', `<svg color="${escapeSvgAttr(color)}" `)
}

function escapeSvgAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getAdjacentReflectionTargets(rect: PillRect) {
  const sidebarRect = sidebarRef.value?.getBoundingClientRect()
  if (!sidebarRect) return null

  let topY: number | undefined
  let topDistance = Infinity
  let bottomY: number | undefined
  let bottomDistance = Infinity
  const rectTop = rect.y
  const rectBottom = rect.y + rect.h

  for (const tab of tabs) {
    const item = tabRefs.value[tab.key]
    if (!item) continue

    const itemRect = item.getBoundingClientRect()
    const textRect = item.querySelector<HTMLElement>('.sidebar-nav-text')?.getBoundingClientRect()
    const iconRect = item.querySelector<HTMLElement>('.sidebar-icon')?.getBoundingClientRect()
    const contentTop = Math.min(
      textRect?.top ?? itemRect.top,
      iconRect?.top ?? itemRect.top,
    ) - sidebarRect.top
    const contentBottom = Math.max(
      textRect?.bottom ?? itemRect.bottom,
      iconRect?.bottom ?? itemRect.bottom,
    ) - sidebarRect.top

    if (contentBottom < rectTop - 2) {
      const distance = rectTop - contentBottom
      if (distance < topDistance) {
        topDistance = distance
        topY = contentBottom
      }
    }
    if (contentTop > rectBottom + 2) {
      const distance = contentTop - rectBottom
      if (distance < bottomDistance) {
        bottomDistance = distance
        bottomY = contentTop
      }
    }
  }

  return { topY, topDistance, bottomY, bottomDistance }
}

function renderRefractionAtRect(rect: PillRect, mode: RefractionMode = 'static') {
  const vis = refractionCanvas.value
  if (!vis || !bgCanvas || !dragBgCanvas || !baseCtx) return
  const ctx = vis.getContext('2d')
  if (!ctx) return

  const sourceCtx = mode === 'drag' ? dragBgCtx : bgCtx
  if (!sourceCtx) return
  const bgImage = sourceCtx.getImageData(0, 0, SW, SH)
  const dragDepth = clamp(rect.h * DRAG_DEPTH_RATIO, 14, 24)
  const dragMaxBend = clamp(rect.h * DRAG_BEND_RATIO, 18, 30)
  const dragFoldDepth = dragDepth * 0.56
  const maxDepth = mode === 'drag' ? dragFoldDepth : EDGE_BAND

  const pad = REFRACTION_PAD
  const minX = Math.floor(clamp(rect.x - pad, 0, SW))
  const maxX = Math.ceil(clamp(rect.x + rect.w + pad, 0, SW))
  const minY = Math.floor(clamp(rect.y - pad, 0, SH))
  const maxY = Math.ceil(clamp(rect.y + rect.h + pad, 0, SH))

  const pillRadius = Math.min(rect.w, rect.h) / 2
  const outW = maxX - minX
  const outH = maxY - minY
  const outData = ctx.createImageData(outW, outH)
  const reflectionTargets = mode === 'drag' ? getAdjacentReflectionTargets(rect) : null

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const sdf = getRoundedRectSDF(x, y, rect.x, rect.y, rect.w, rect.h, pillRadius)
      const d = sdf.distance

      if (d > 0 || d < -maxDepth) continue

      const insideDepth = Math.max(0, -d)

      const lens = mode === 'drag'
        ? 1 - smoothstepR(0, dragFoldDepth, insideDepth)
        : 1 - smoothstepR(0, EDGE_BAND, insideDepth)
      const bend = mode === 'drag'
        ? -(lens * dragMaxBend)
        : lens * MAX_BEND

      const capSqueezeRelief = mode === 'drag'
        ? smoothstepR(0.35, 0.95, Math.abs(sdf.nx)) * 0.55
        : 0
      const nx = sdf.nx * (1 - capSqueezeRelief)
      const ny = sdf.ny
      const tx = -ny
      const ty = nx
      const ripple = Math.sin(x * 0.055 + y * 0.035) * lens * 1.4

      const baseX = mode === 'drag'
        ? x + nx * bend + tx * ripple
        : x - nx * bend + tx * ripple
      const baseY = mode === 'drag'
        ? y + ny * bend + ty * ripple
        : y - ny * bend + ty * ripple

      // RGB chromatic split — index.html original direction
      const bendLimit = mode === 'drag' ? dragMaxBend : MAX_BEND
      const distortionStrength = clamp(Math.abs(bend) / bendLimit, 0, 1)
      const overDistort = mode === 'drag'
        ? smoothstepR(0.58, 1, distortionStrength) * lens
        : 0
      const chroma = mode === 'drag'
        ? lens * CHROMA + overDistort * 1.65
        : lens * CHROMA
      const tangentChroma = mode === 'drag'
        ? overDistort * 0.32
        : lens * 0.3

      const r = mode === 'drag'
        ? sampleChannelBilinear(bgImage, baseX + nx * chroma + tx * tangentChroma, baseY + ny * chroma + ty * tangentChroma, 0)
        : sampleChannelBilinear(bgImage, baseX - nx * chroma + tx * tangentChroma, baseY - ny * chroma + ty * tangentChroma, 0)
      const g = sampleChannelBilinear(bgImage, baseX, baseY, 1)
      const b = mode === 'drag'
        ? sampleChannelBilinear(bgImage, baseX - nx * chroma - tx * tangentChroma, baseY - ny * chroma - ty * tangentChroma, 2)
        : sampleChannelBilinear(bgImage, baseX + nx * chroma - tx * tangentChroma, baseY + ny * chroma - ty * tangentChroma, 2)
      const edgeReflection = mode === 'drag'
        ? (1 - smoothstepR(0, 2.4, insideDepth)) * 0.68
        : 0
      const fallbackReflectionDistance = mode === 'drag' ? clamp(rect.h * 0.22, 7, 13) : 4.8
      const adjacentReflectionReach = mode === 'drag' ? clamp(rect.h * 0.46, 18, 26) : 0
      const verticalReflection = mode === 'drag' && Math.abs(sdf.ny) >= Math.abs(sdf.nx)
      let reflectedX = x + sdf.nx * fallbackReflectionDistance
      let reflectedY = y + sdf.ny * fallbackReflectionDistance
      let reflectionProximity = 0

      if (
        verticalReflection &&
        sdf.ny < -0.2 &&
        reflectionTargets?.topY != null &&
        reflectionTargets.topDistance <= adjacentReflectionReach
      ) {
        reflectedX = x
        reflectionProximity = 1 - smoothstepR(4, adjacentReflectionReach, reflectionTargets.topDistance)
        const sampleInset = 2.5 + Math.pow(reflectionProximity, 0.65) * 4.5
        reflectedY = reflectionTargets.topY - sampleInset
      } else if (
        verticalReflection &&
        sdf.ny > 0.2 &&
        reflectionTargets?.bottomY != null &&
        reflectionTargets.bottomDistance <= adjacentReflectionReach
      ) {
        reflectedX = x
        reflectionProximity = 1 - smoothstepR(4, adjacentReflectionReach, reflectionTargets.bottomDistance)
        const sampleInset = 2.5 + Math.pow(reflectionProximity, 0.65) * 4.5
        reflectedY = reflectionTargets.bottomY + sampleInset
      }

      const reflectionCurve = Math.pow(reflectionProximity, 0.58)
      const reflectionDistanceStrength = mode === 'drag'
        ? clamp(0.24 + reflectionCurve * 0.92, 0, 1.16)
        : 0
      const outerReflection = edgeReflection * reflectionDistanceStrength
      const reflectionSpread = mode === 'drag'
        ? 3.2 + reflectionCurve * 2.4
        : 0
      const reflectedNearX = reflectedX - sdf.nx * reflectionSpread
      const reflectedNearY = reflectedY - sdf.ny * reflectionSpread
      const reflectedFarX = reflectedX + sdf.nx * reflectionSpread
      const reflectedFarY = reflectedY + sdf.ny * reflectionSpread
      const reflectedR = Math.min(
        sampleChannelBilinear(bgImage, reflectedNearX, reflectedNearY, 0),
        sampleChannelBilinear(bgImage, reflectedX, reflectedY, 0),
        sampleChannelBilinear(bgImage, reflectedFarX, reflectedFarY, 0),
      )
      const reflectedG = Math.min(
        sampleChannelBilinear(bgImage, reflectedNearX, reflectedNearY, 1),
        sampleChannelBilinear(bgImage, reflectedX, reflectedY, 1),
        sampleChannelBilinear(bgImage, reflectedFarX, reflectedFarY, 1),
      )
      const reflectedB = Math.min(
        sampleChannelBilinear(bgImage, reflectedNearX, reflectedNearY, 2),
        sampleChannelBilinear(bgImage, reflectedX, reflectedY, 2),
        sampleChannelBilinear(bgImage, reflectedFarX, reflectedFarY, 2),
      )
      const finalR = r * (1 - outerReflection) + reflectedR * outerReflection
      const finalG = g * (1 - outerReflection) + reflectedG * outerReflection
      const finalB = b * (1 - outerReflection) + reflectedB * outerReflection
      const refractionAlpha = mode === 'drag'
        ? 255
        : Math.round(clamp(lens * 210, 0, 210))

      const idx = ((y - minY) * outW + (x - minX)) * 4
      outData.data[idx]     = clamp(Math.round(finalR), 0, 255)
      outData.data[idx + 1] = clamp(Math.round(finalG), 0, 255)
      outData.data[idx + 2] = clamp(Math.round(finalB), 0, 255)
      outData.data[idx + 3] = refractionAlpha
    }
  }

  ctx.putImageData(outData, minX, minY)
}

// Watch pill position changes during snap animation
watch([isDragging, isSnapping], () => {
  if (!isDragging.value && !isSnapping.value) {
    // Animation settled — ensure refraction is at final position
    nextTick(() => {
      const rect = currentPillRect()
      if (rect) {
        rebuildScene()
      }
    })
  }
})
</script>

<style scoped>
/* ============================================================
   Sidebar
   ============================================================ */

.sidebar {
  width: 180px;
  position: fixed;
  left: 24px;
  top: 24px;
  z-index: 100;
  height: calc(100vh - 48px);
  padding: 28px 10px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  touch-action: none;
  overflow: hidden;
}

.sidebar ul {
  width: 100%;
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  z-index: 3;
}

.sidebar li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 90%;
  margin: 6px auto;
  padding: 11px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease;
  color: #475569;
  user-select: none;
}

.sidebar li.active {
  color: #1d4ed8;
  font-weight: 650;
  cursor: grab;
}

.sidebar li:hover {
  color: #2563eb;
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0.65;
  transition: opacity 0.2s, transform 0.2s;
}

.sidebar li.active .sidebar-icon {
  opacity: 1;
  transform: scale(1.08);
}

.sidebar-nav-text {
  white-space: nowrap;
  line-height: 1;
}

/* ============================================================
   Canvas refraction layer
   ============================================================ */

.refraction-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 4;
  pointer-events: none;
  border-radius: 14px;
}

/* ============================================================
   Glass pill
   ============================================================ */

.pill-indicator {
  position: absolute;
  z-index: 5;
  border-radius: 999px;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  transform-origin: center;
  will-change: left, top, width, height, transform;

  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;

  box-shadow:
    0 18px 42px rgba(15, 23, 42, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.38),
    inset 0 1px 2px rgba(255, 255, 255, 0.5);
}

.pill-indicator:active {
  cursor: grabbing;
}

.sidebar:has(.pill-dragging) li.active {
  cursor: grabbing;
}

.pill-snapping {
  transform: scaleX(1) scaleY(1);
  animation: pillTensionRelease 0.48s cubic-bezier(0.2, 0.82, 0.24, 1) both;
}

.pill-dragging {
  transform: scaleX(var(--pill-drag-scale-x, 0.94)) scaleY(var(--pill-drag-scale-y, 1.08));
  animation: pillTensionPress 0.28s cubic-bezier(0.2, 0.82, 0.2, 1) both;
  box-shadow:
    0 24px 58px rgba(15, 23, 42, 0.16),
    inset 0 0 0 1px rgba(255, 255, 255, 0.44),
    inset 0 1px 2px rgba(255, 255, 255, 0.58);
  z-index: 6;
}

@keyframes pillTensionPress {
  0% { transform: scaleX(1) scaleY(1); }
  58% { transform: scaleX(0.915) scaleY(1.12); }
  100% { transform: scaleX(var(--pill-drag-scale-x, 0.94)) scaleY(var(--pill-drag-scale-y, 1.08)); }
}

@keyframes pillTensionRelease {
  0% { transform: scaleX(0.94) scaleY(1.08); }
  56% { transform: scaleX(1.025) scaleY(0.985); }
  100% { transform: scaleX(1) scaleY(1); }
}

/* ============================================================
   Icon click animations
   ============================================================ */

.anim-main :deep(.icon-sun-core) {
  animation: navSunBurst 0.3s cubic-bezier(.2,.8,.2,1) both;
  transform-box: fill-box;
  transform-origin: center;
}
.anim-main :deep(.icon-sun-ray) {
  animation: navSunRays 0.34s cubic-bezier(.2,.8,.2,1) both;
  transform-box: view-box;
  transform-origin: 12px 12px;
}
.anim-main :deep(.ray-1) { animation-delay: 0s; }
.anim-main :deep(.ray-2) { animation-delay: 0.025s; }
.anim-main :deep(.ray-3) { animation-delay: 0.05s; }
.anim-main :deep(.ray-4) { animation-delay: 0.075s; }
.anim-main :deep(.ray-5) { animation-delay: 0.1s; }
.anim-main :deep(.ray-6) { animation-delay: 0.125s; }
.anim-main :deep(.ray-7) { animation-delay: 0.15s; }
.anim-main :deep(.ray-8) { animation-delay: 0.175s; }

.anim-flow :deep(.icon-bar) {
  animation: navBarPulse 0.34s cubic-bezier(.2,.8,.2,1) both;
  transform-box: fill-box;
  transform-origin: bottom;
}
.anim-flow :deep(.icon-bar-1) { animation-delay: 0s; }
.anim-flow :deep(.icon-bar-2) { animation-delay: 0.08s; }
.anim-flow :deep(.icon-bar-3) { animation-delay: 0.16s; }

.anim-settings :deep(.icon-gear-center),
.anim-settings :deep(.icon-gear-tooth) {
  animation: navGearTurn 0.42s cubic-bezier(.2,.7,.15,1) both;
  transform-box: fill-box;
  transform-origin: center;
}

.anim-firmware :deep(.icon-device-top-line) {
  animation: firmwareTopLineGrow 0.4s cubic-bezier(.34,.6,.15,1) both;
  transform-box: fill-box;
  transform-origin: left center;
}
.anim-firmware :deep(.icon-device-dot) {
  animation: firmwareDotConfirm 0.28s cubic-bezier(.2,.8,.2,1) 0.22s both;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes navSunBurst {
  0% { transform: scale(0.88); }
  55% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes navSunRays {
  0% { transform: scale(0.35); opacity: 0.25; }
  65% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes navBarPulse {
  0% { transform: scaleY(0.3); }
  55% { transform: scaleY(1.12); }
  100% { transform: scaleY(1); }
}
@keyframes navGearTurn {
  0% { transform: rotate(0deg); }
  85% { transform: rotate(140deg); }
  100% { transform: rotate(135deg); }
}
@keyframes firmwareTopLineGrow {
  0% { transform: scaleX(0.18); opacity: 0.45; }
  16% { opacity: 1; }
  80% { transform: scaleX(1.08); opacity: 1; }
  100% { transform: scaleX(1); opacity: 1; }
}
@keyframes firmwareDotConfirm {
  0% { transform: scale(0.75); opacity: 0.45; }
  45% { transform: scale(1.7); opacity: 1; }
  100% { transform: scale(1); opacity: 0.9; }
}

/* ============================================================
   Night mode
   ============================================================ */

:global(.night-mode) .sidebar {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.night-mode) .sidebar li {
  color: rgba(226, 232, 240, 0.72);
}

:global(.night-mode) .sidebar li.active {
  color: #93c5fd;
}

:global(.night-mode) .sidebar li:hover {
  color: #bfdbfe;
}

:global(.night-mode) .pill-indicator {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    inset 0 1px 2px rgba(255, 255, 255, 0.36);
}

:global(.night-mode) .pill-dragging {
  box-shadow:
    0 24px 58px rgba(0, 0, 0, 0.34),
    inset 0 0 0 1px rgba(255, 255, 255, 0.34),
    inset 0 1px 2px rgba(255, 255, 255, 0.42);
}

/* ============================================================
   Mobile
   ============================================================ */

@media (max-width: 768px) {
  .sidebar {
    position: relative;
    left: auto;
    top: auto;
    z-index: auto;
    width: calc(100% - 24px);
    height: auto;
    margin: 12px;
    padding: 10px 6px;
    border-radius: 14px;
    display: block;
  }

  .sidebar ul {
    flex-direction: row;
    gap: 4px;
  }

  .sidebar li {
    flex: 1;
    flex-direction: column;
    gap: 3px;
    width: auto;
    margin: 0;
    padding: 8px 4px;
    border-radius: 14px;
    text-align: center;
    font-size: 12px;
  }

  .sidebar-icon { width: 18px; height: 18px; }

  .pill-indicator { border-radius: 999px; }
}
</style>
