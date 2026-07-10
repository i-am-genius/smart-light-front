<template>
  <div class="three-layout-shell">
    <div class="three-viewport-wrap">
      <div class="scene-toolbar" @pointerdown.stop>
        <div class="zone-cluster workbench-glass">
          <div class="zone-switcher">
            <button
              class="zone-arrow-btn"
              type="button"
              aria-label="上一个区域"
              :disabled="zoneCount <= 1"
              @click.stop="switchZone(-1)"
            >
              ‹
            </button>
            <div class="zone-current-label">
              <strong :title="activeZone.zoneName">{{ activeZone.zoneName }}</strong>
              <span>{{ activeZoneIndex + 1 }} / {{ zoneCount }}</span>
            </div>
            <button
              class="zone-arrow-btn"
              type="button"
              aria-label="下一个区域"
              :disabled="zoneCount <= 1"
              @click.stop="switchZone(1)"
            >
              ›
            </button>
          </div>
        </div>

        <div class="scene-edit-actions slot-toolbar workbench-glass">
          <span class="scene-slot-count">{{ slotCountLabel }}</span>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <button class="toolbar-action primary-action-btn" type="button" @click.stop="addManualSlot">
            <span aria-hidden="true">＋</span> 添加灯位
          </button>
          <button
            class="toolbar-action layout-action-btn"
            type="button"
            :disabled="layoutState.lamps.length <= 1"
            @click.stop="handleArrangeSlotsEvenly"
          >
            均匀排列
          </button>
        </div>

        <div class="view-mode-switch workbench-glass" role="group" aria-label="场景视角">
          <button
            class="view-mode-btn view-toggle-btn"
            :class="{ 'is-active': cameraViewMode === 'display' }"
            type="button"
            :aria-pressed="cameraViewMode === 'display'"
            @click.stop="setCameraViewMode('display')"
          >
            展示
          </button>
          <button
            class="view-mode-btn view-toggle-btn"
            :class="{ 'is-active': cameraViewMode === 'adjust' }"
            type="button"
            :aria-pressed="cameraViewMode === 'adjust'"
            @click.stop="setCameraViewMode('adjust')"
          >
            调节
          </button>
        </div>
      </div>

      <div class="scene-overlay" aria-hidden="true">
        <span>精品服装灯光</span>
        <small>轨道编排工作台</small>
      </div>

      <div ref="viewportRef" class="three-layout-viewport"></div>

      <div class="scene-context-layer" aria-live="polite" @pointerdown.stop>
        <div v-if="selectedSlot" class="scene-context-bar workbench-glass">
          <div class="selected-slot-summary">
            <span class="selection-dot" aria-hidden="true"></span>
            <span class="selected-slot-copy">
              <strong>{{ selectedSlotLabel }}</strong>
              <small v-if="selectedSlotStatusLabel">{{ selectedSlotStatusLabel }}</small>
            </span>
          </div>
          <div class="context-actions">
            <button
              class="context-action"
              type="button"
              aria-label="灯位左移"
              :disabled="!canMoveSelectedLeft"
              @click.stop="moveSelectedSlot(-1)"
            >
              ← 左移
            </button>
            <button
              class="context-action"
              type="button"
              aria-label="灯位右移"
              :disabled="!canMoveSelectedRight"
              @click.stop="moveSelectedSlot(1)"
            >
              右移 →
            </button>
            <span class="context-divider" aria-hidden="true"></span>
            <button
              class="context-action danger"
              type="button"
              :disabled="!canDeleteSelectedSlot"
              :title="deleteSlotTitle"
              @click.stop="deleteSelectedSlot"
            >
              删除
            </button>
          </div>
        </div>

        <div v-else class="scene-empty-hint workbench-glass">
          <strong>点击射灯后可编辑位置</strong>
          <small>拖动射灯调整陈列焦点</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { DeviceItem } from '../../types/device'
import { normalizeDeviceType } from '../../utils/device'
import { clamp, colorTemperatureToHex, resolveFiniteNumber } from '../../utils/helpers'
import { locateDevice } from '../../api/device'

type LampTemperature = number

type LampLayout = {
  slotId: string
  order: number
  lampX: number
  targetX: number
  boundLampDeviceId?: string | number | ''
  sourceDeviceId?: string | number
  isManual?: boolean
  deviceId?: string | number
  chipId?: string
  name: string
  brightness: number
  temperature: LampTemperature
  clothingColor: string
  online?: boolean
}

type ZoneSlot = {
  slotId: string
  order: number
  lampX: number
  targetX: number
  boundLampDeviceId?: string | number | ''
  sourceDeviceId?: string | number
  isManual?: boolean
}

type CameraLayout = {
  x: number
  y: number
  z: number
  deviceId?: string | number
  chipId?: string
  name: string
  online?: boolean
}

type SelectionInfo = {
  selected: boolean
  label: string
  slotId?: string
  isManual?: boolean
  canDelete: boolean
  deleteDisabledReason?: string
}

type DeviceLike = Partial<DeviceItem> & {
  name?: string
  type?: string
  mainColorRGB?: unknown
  mainColor?: unknown
}

type StoreZoneLike = {
  id?: string | number
  name?: string
}

type TrackLayout = {
  startX: number
  endX: number
  y: number
  z: number
}

type ThreeZoneOption = {
  zoneId: string
  zoneName: string
}

type StoredZoneLayout = {
  track?: Partial<TrackLayout>
  slots?: Array<Partial<ZoneSlot>>
  lamps?: Array<{
    slotId?: string
    x?: number
    targetX?: number
    boundLampDeviceId?: string | number | ''
  }>
}

type TrackHandle = 'left' | 'right'
type CameraViewMode = 'display' | 'adjust'

type CameraViewPreset = {
  position: THREE.Vector3
  target: THREE.Vector3
}

type DragState =
  | { type: 'track'; handle: TrackHandle }
  | { type: 'lamp'; lampId: string }

type LampObjects = {
  group: THREE.Group
  body: THREE.Group
  head: THREE.Group
  yawGroup: THREE.Group
  yokeFrame: THREE.Group
  pitchBody: THREE.Group
  spot: THREE.SpotLight
  spotTarget: THREE.Object3D
  beam: THREE.Mesh
  aperture: THREE.Mesh
  selectionRing: THREE.Mesh
  selectionMarker: THREE.Mesh
  shirt: THREE.Group
}

const props = withDefaults(defineProps<{
  devices?: DeviceLike[]
  zones?: StoreZoneLike[]
  active?: boolean
}>(), {
  devices: () => [],
  zones: () => [],
  active: true,
})

const emit = defineEmits<{
  (event: 'selection-change', value: SelectionInfo): void
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const cameraViewMode = ref<CameraViewMode>('display')
const activeZoneIndex = ref(0)
const selectedSlotId = ref('')
const locatingSlotId = ref('')

const zoneOptions = computed(() => normalizeZones(props.zones))
const zoneCount = computed(() => zoneOptions.value.length)
const activeZone = computed(() => zoneOptions.value[activeZoneIndex.value] || createDefaultZoneOption())
const selectedSlot = computed(() => layoutState.lamps.find(lamp => lamp.slotId === selectedSlotId.value) || null)
const selectedSlotIndex = computed(() => selectedSlot.value ? layoutState.lamps.findIndex(lamp => lamp.slotId === selectedSlot.value?.slotId) : -1)
const canMoveSelectedLeft = computed(() => selectedSlotId.value !== '' && selectedSlotIndex.value > 0)
const canMoveSelectedRight = computed(() =>
  selectedSlotId.value !== '' &&
  selectedSlotIndex.value >= 0 &&
  selectedSlotIndex.value < layoutState.lamps.length - 1,
)
const selectedSlotLabel = computed(() => {
  if (!selectedSlotId.value || !selectedSlot.value) return '请先点击选择一盏灯'
  return `已选中：${selectedSlot.value.name || `灯位 ${selectedSlotIndex.value + 1}`}`
})
const slotCountLabel = computed(() => `${layoutState.lamps.length} 个灯位`)
const selectedSlotStatusLabel = computed(() => {
  const slot = selectedSlot.value
  if (!slot) return ''
  if (slot.isManual) return '手动灯位'
  if (slot.online === true) return '在线'
  if (slot.online === false) return '离线'
  return ''
})
const canDeleteSelectedSlot = computed(() =>
  selectedSlotId.value !== '' &&
  Boolean(selectedSlot.value) &&
  isDeletableSlot(selectedSlot.value),
)
const deleteSlotTitle = computed(() => {
  if (!selectedSlotId.value || !selectedSlot.value) return '请先点击选择未绑定灯位'
  if (!isDeletableSlot(selectedSlot.value)) return '真实设备灯位暂不能删除'
  return '删除当前未绑定灯位'
})

const mockLampLayouts: LampLayout[] = [
  { slotId: 'mock-1', order: 0, name: '新品展示区', lampX: -2.15, targetX: -2.15, brightness: 72, temperature: 3000, clothingColor: '#d45a48' },
  { slotId: 'mock-2', order: 1, name: '主通道区', lampX: 0, targetX: 0, brightness: 88, temperature: 4000, clothingColor: '#8fb95a' },
  { slotId: 'mock-3', order: 2, name: '橱窗区', lampX: 2.05, targetX: 2.05, brightness: 56, temperature: 6000, clothingColor: '#4d86d9' },
]

const mockCameraLayout: CameraLayout = {
  x: 4.05,
  y: 2.05,
  z: -1.88,
  name: '模拟摄像头',
}

const layoutState = reactive<{
  track: TrackLayout
  lamps: LampLayout[]
  camera: CameraLayout
}>({
  track: {
    startX: -3.2,
    endX: 3.2,
    y: 3.35,
    z: -1.05,
  },
  lamps: mockLampLayouts.map(item => ({ ...item })),
  camera: { ...mockCameraLayout },
})

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationFrame = 0
let cameraAnimationFrame = 0
let railMesh: THREE.Mesh | null = null
let railGrooveMesh: THREE.Mesh | null = null
let railHighlightMesh: THREE.Mesh | null = null
const railSupportMeshes: THREE.Mesh[] = []
let leftHandleMesh: THREE.Mesh | null = null
let rightHandleMesh: THREE.Mesh | null = null
let dragState: DragState | null = null
let hasRestoredActiveZone = false
let cachedStoredLayouts: { version: number; activeZoneId: string; zoneLayouts: Record<string, StoredZoneLayout> } | null = null

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -layoutState.track.z)
const dragPoint = new THREE.Vector3()
const beamAxis = new THREE.Vector3(0, -1, 0)
const displayWallZ = -2.42
const shirtBaseY = 0.72
const shirtAimY = 1.26
const wallLightSpotZ = displayWallZ + 0.065
const ZONE_LAYOUT_STORAGE_KEY = 'SMART_LIGHT_THREE_ZONE_LAYOUTS_V1'
const ZONE_DEFINITION_STORAGE_KEY = 'SMART_LIGHT_LAYOUT_ZONES'
const MIN_VISIBLE_SLOTS = 3

/** A slot is "visible" (renders a lamp model) unless it's a pure placeholder (no device link, not manual). */
function isSlotVisible(slot: { boundLampDeviceId?: string | number | ''; sourceDeviceId?: string | number; isManual?: boolean }) {
  if (slot.isManual) return true
  if (slot.boundLampDeviceId) return true
  if (slot.sourceDeviceId) return true
  return false
}

/** Pad layoutState.lamps with invisible placeholders to reach MIN_VISIBLE_SLOTS total. */
function ensureMinVisibleSlots(zoneId: string) {
  while (layoutState.lamps.length < MIN_VISIBLE_SLOTS) {
    const idx = layoutState.lamps.length
    const placeholder: LampLayout = {
      slotId: `placeholder-${zoneId}-${idx}`,
      order: idx,
      lampX: getDefaultSlotX(idx, MIN_VISIBLE_SLOTS),
      targetX: getDefaultSlotX(idx, MIN_VISIBLE_SLOTS),
      boundLampDeviceId: '',
      isManual: false,
      name: '',
      brightness: 72,
      temperature: 4000,
      clothingColor: '#8fb95a',
    }
    layoutState.lamps.push(placeholder)
  }
}

function loadStoredZoneDefinitions(): StoreZoneLike[] {
  try {
    const raw = localStorage.getItem(ZONE_DEFINITION_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (error) {
    console.warn('3D 分区布局读取失败', error)
  }
  return []
}
const pickableObjects: THREE.Object3D[] = []
const lampObjects = new Map<string, LampObjects>()
const cameraViewPresets: Record<CameraViewMode, CameraViewPreset> = {
  display: {
    position: new THREE.Vector3(3.8, 2.8, 4.2),
    target: new THREE.Vector3(0, 1.35, -2.1),
  },
  adjust: {
    position: new THREE.Vector3(0, 3.4, 2.2),
    target: new THREE.Vector3(0, 2, -2.1),
  },
}

onMounted(() => {
  initThreeScene()
})

onBeforeUnmount(() => {
  cleanupThreeScene()
})

// Stop render loop immediately when parent tab switches away
watch(() => props.active, (isActive) => {
  if (isActive && !document.hidden) {
    startRenderLoop()
  } else if (!isActive) {
    stopRenderLoop()
  }
})

watch(
  () => props.devices,
  () => {
    syncActiveZoneIndex()
    syncActiveZoneLampCount()
    syncDevicesToLayout()
  },
  { deep: true, immediate: true },
)

watch(
  () => props.zones,
  () => {
    syncActiveZoneIndex()
    rebuildActiveZoneLayout()
  },
  { deep: true, immediate: true },
)

const selectedSlotInfo = computed<SelectionInfo>(() => {
  if (!selectedSlotId.value || !selectedSlot.value) {
    return {
      selected: false,
      label: '未选中灯位，点击 3D 射灯后可排序或删除',
      canDelete: false,
      deleteDisabledReason: '请先点击选择未绑定灯位',
    }
  }

  const canDelete = isDeletableSlot(selectedSlot.value)
  return {
    selected: true,
    label: selectedSlotLabel.value,
    slotId: selectedSlot.value.slotId,
    isManual: selectedSlot.value.isManual,
    canDelete,
    deleteDisabledReason: canDelete ? '' : '真实设备灯位暂不能删除，可在设备列表中解绑或移动分区',
  }
})

watch(
  () => selectedSlotInfo.value,
  value => emit('selection-change', value),
  { immediate: true },
)

function normalizeZones(inputZones: StoreZoneLike[] | undefined): ThreeZoneOption[] {
  const source = (inputZones && inputZones.length > 0)
    ? inputZones
    : loadStoredZoneDefinitions()
  const deviceZones = createDeviceZoneDefinitions()
  const normalizedSource = source.length > 0
    ? source
    : deviceZones

  const zones = normalizedSource
    .map((zone, index) => ({
      zoneId: String(zone.id || `zone-${index + 1}`),
      zoneName: String(zone.name || '').trim() || '未命名分区',
    }))
    .filter(zone => zone.zoneId)

  return zones.length > 0 ? zones : [createDefaultZoneOption()]
}

function createDeviceZoneDefinitions(): StoreZoneLike[] {
  const zoneNames: string[] = []
  const seen = new Set<string>()

  for (const device of props.devices || []) {
    if (!isLayoutLampDevice(device)) continue

    const zoneName = normalizeZoneText(device.displayName)
    if (!zoneName || zoneName === '未分区' || zoneName === '-') continue
    if (seen.has(zoneName)) continue

    seen.add(zoneName)
    zoneNames.push(zoneName)
  }

  return zoneNames.map(zoneName => ({
    id: `device-zone-${zoneName}`,
    name: zoneName,
  }))
}

function createDefaultZoneOption(): ThreeZoneOption {
  return {
    zoneId: 'default-zone',
    zoneName: '默认展示区',
  }
}

function syncActiveZoneIndex() {
  const previousZoneId = activeZone.value.zoneId
  const count = zoneCount.value
  if (count <= 0) {
    activeZoneIndex.value = 0
    return
  }

  if (!hasRestoredActiveZone) {
    const storedActiveZoneId = getStoredLayouts().activeZoneId
    const storedIndex = zoneOptions.value.findIndex(zone => zone.zoneId === storedActiveZoneId)
    if (storedIndex >= 0) {
      activeZoneIndex.value = storedIndex
    }
    hasRestoredActiveZone = true
  }

  activeZoneIndex.value = clamp(Math.floor(activeZoneIndex.value), 0, count - 1)
  if (activeZone.value.zoneId !== previousZoneId) {
    clearSelectedSlot()
  }
}

function switchZone(direction: -1 | 1) {
  if (zoneCount.value <= 1 || dragState) return

  saveActiveZoneLayout()
  activeZoneIndex.value = (activeZoneIndex.value + direction + zoneCount.value) % zoneCount.value
  clearSelectedSlot()
  rebuildActiveZoneLayout()
  animateCameraTo(cameraViewPresets.display)
}

function rebuildActiveZoneLayout() {
  const zone = activeZone.value
  const stored = getStoredZoneLayout(zone.zoneId)
  const zoneLampDevices = getLampDevicesForZone(zone.zoneName)
  const slots = buildZoneSlots(stored, zoneLampDevices)
  const defaultTrack = getDefaultTrackLayout()

  layoutState.track = {
    startX: resolveFiniteNumber(stored?.track?.startX, defaultTrack.startX),
    endX: resolveFiniteNumber(stored?.track?.endX, defaultTrack.endX),
    y: resolveFiniteNumber(stored?.track?.y, defaultTrack.y),
    z: resolveFiniteNumber(stored?.track?.z, defaultTrack.z),
  }

  layoutState.lamps = slots.map((slot, index) => {
    const mock = mockLampLayouts[index % mockLampLayouts.length]

    return {
      ...mock,
      ...slot,
      name: slot.isManual ? `${zone.zoneName} · 未绑定灯位` : `${zone.zoneName} · 灯具-${index + 1}`,
    }
  })

  ensureMinVisibleSlots(zone.zoneId)

  if (!layoutState.lamps.some(lamp => lamp.slotId === selectedSlotId.value)) {
    clearSelectedSlot()
  }

  saveActiveZoneLayout()
  syncLampObjectsWithState()
  syncDevicesToLayout()
  updateLayoutVisuals()
}

function buildZoneSlots(stored: StoredZoneLayout | undefined, zoneLampDevices: DeviceLike[]) {
  const currentDeviceIds = getDeviceIdSet(zoneLampDevices)
  const storedSlots = normalizeStoredSlots(stored, zoneLampDevices)
    .filter(slot => shouldKeepStoredSlot(slot, currentDeviceIds))
  const manualSlots = storedSlots.filter(slot => slot.isManual)
  const deviceSlots: ZoneSlot[] = []

  zoneLampDevices.forEach((device, index) => {
    const sourceDeviceId = getDeviceId(device)
    const slotId = `device-${sourceDeviceId || index + 1}`
    const existing = findStoredSlotForDevice(storedSlots, device, slotId)
    const order = existing?.order ?? index
    const fallbackX = getDefaultSlotX(index, Math.max(zoneLampDevices.length, 1))

    deviceSlots.push({
      slotId,
      order,
      lampX: existing?.lampX ?? fallbackX,
      targetX: existing?.targetX ?? fallbackX,
      boundLampDeviceId: existing?.boundLampDeviceId || '',
      sourceDeviceId,
      isManual: false,
    })
  })

  if (zoneLampDevices.length === 0 && deviceSlots.length === 0) {
    const slotId = 'mock-fallback'
    deviceSlots.push({
      slotId,
      order: 0,
      lampX: 0,
      targetX: 0,
      boundLampDeviceId: '',
      isManual: false,
    })
  }

  return [...deviceSlots, ...manualSlots]
    .sort((a, b) => a.order - b.order)
    .map((slot, index, list) => ({
      ...slot,
      order: index,
      lampX: resolveFiniteNumber(slot.lampX, getDefaultSlotX(index, list.length)),
      targetX: resolveFiniteNumber(slot.targetX, getDefaultSlotX(index, list.length)),
    }))
}

function normalizeStoredSlots(stored: StoredZoneLayout | undefined, zoneLampDevices: DeviceLike[]): ZoneSlot[] {
  if (Array.isArray(stored?.slots) && stored.slots.length > 0) {
    return stored.slots.map((slot, index, list) => {
      const fallbackX = getDefaultSlotX(index, list.length)
      return {
        slotId: String(slot.slotId || `manual-${index + 1}`),
        order: resolveFiniteNumber(slot.order, index),
        lampX: resolveFiniteNumber(slot.lampX, fallbackX),
        targetX: resolveFiniteNumber(slot.targetX, fallbackX),
        boundLampDeviceId: slot.boundLampDeviceId || '',
        sourceDeviceId: slot.sourceDeviceId,
        isManual: Boolean(slot.isManual),
      }
    })
  }

  if (Array.isArray(stored?.lamps) && stored.lamps.length > 0) {
    return stored.lamps.flatMap((lamp, index, list) => {
      const sourceDeviceId = getDeviceId(zoneLampDevices[index])
      if (!sourceDeviceId && !lamp.boundLampDeviceId) return []

      const fallbackX = getDefaultSlotX(index, list.length)
      return [{
        slotId: sourceDeviceId ? `device-${sourceDeviceId}` : String(lamp.slotId || `manual-${index + 1}`),
        order: index,
        lampX: resolveFiniteNumber(lamp.x, fallbackX),
        targetX: resolveFiniteNumber(lamp.targetX, fallbackX),
        boundLampDeviceId: lamp.boundLampDeviceId || '',
        sourceDeviceId,
        isManual: false,
      }]
    })
  }

  return []
}

function getDeviceIdSet(devices: DeviceLike[]) {
  const ids = new Set<string>()
  devices.forEach((device) => {
    addDeviceId(ids, device.id)
    addDeviceId(ids, device.chipId)
    addDeviceId(ids, getDeviceId(device))
  })
  return ids
}

function addDeviceId(ids: Set<string>, value: unknown) {
  if (value === undefined || value === null || value === '') return
  ids.add(String(value))
}

function shouldKeepStoredSlot(slot: ZoneSlot, currentDeviceIds: Set<string>) {
  if (slot.isManual) return true
  if (hasStoredDeviceMatch(slot.sourceDeviceId, currentDeviceIds)) return true
  if (hasStoredDeviceMatch(slot.boundLampDeviceId, currentDeviceIds)) return true
  return false
}

function hasStoredDeviceMatch(value: string | number | undefined, currentDeviceIds: Set<string>) {
  if (value === undefined || value === null || value === '') return false
  return currentDeviceIds.has(String(value))
}

function findStoredSlotForDevice(storedSlots: ZoneSlot[], device: DeviceLike, slotId: string) {
  return storedSlots.find(slot =>
    slot.slotId === slotId ||
    isStoredSlotLinkedToDevice(slot, device),
  )
}

function isStoredSlotLinkedToDevice(slot: ZoneSlot, device: DeviceLike) {
  return Boolean(
    (slot.sourceDeviceId && isSameDeviceId(device, slot.sourceDeviceId)) ||
    (slot.boundLampDeviceId && isSameDeviceId(device, slot.boundLampDeviceId)),
  )
}

function getDefaultTrackLayout(): TrackLayout {
  return {
    startX: -3.2,
    endX: 3.2,
    y: 3.35,
    z: -1.05,
  }
}

function getDefaultSlotX(index: number, count: number) {
  if (count <= 1) return 0
  const start = -2.2
  const end = 2.2
  return start + (end - start) * (index / (count - 1))
}

function getLampDevicesForZone(zoneName: string) {
  const normalizedZoneName = normalizeZoneText(zoneName)
  if (!normalizedZoneName) return []

  const lamps = (props.devices || []).filter(isLayoutLampDevice)
  return lamps.filter(device => normalizeZoneText(device.displayName) === normalizedZoneName)
}

function normalizeZoneText(value: unknown) {
  return String(value || '').trim()
}

function getStoredLayouts() {
  if (cachedStoredLayouts) return cachedStoredLayouts

  try {
    const raw = localStorage.getItem(ZONE_LAYOUT_STORAGE_KEY)
    const defaultValue = { version: 1, activeZoneId: '', zoneLayouts: {} as Record<string, StoredZoneLayout> }
    if (!raw) {
      cachedStoredLayouts = defaultValue
      return cachedStoredLayouts
    }
    const parsed = JSON.parse(raw)
    if (parsed?.version === 1 && parsed.zoneLayouts && typeof parsed.zoneLayouts === 'object') {
      cachedStoredLayouts = {
        version: 1,
        activeZoneId: String(parsed.activeZoneId || ''),
        zoneLayouts: parsed.zoneLayouts as Record<string, StoredZoneLayout>,
      }
      return cachedStoredLayouts
    }
    cachedStoredLayouts = defaultValue
    return cachedStoredLayouts
  } catch (error) {
    console.warn('3D 分区布局读取失败', error)
  }

  cachedStoredLayouts = { version: 1, activeZoneId: '', zoneLayouts: {} as Record<string, StoredZoneLayout> }
  return cachedStoredLayouts
}

function getStoredZoneLayout(zoneId: string) {
  return getStoredLayouts().zoneLayouts[zoneId]
}

function saveActiveZoneLayout() {
  const zone = activeZone.value
  const stored = getStoredLayouts()
  stored.activeZoneId = zone.zoneId
  stored.zoneLayouts[zone.zoneId] = {
    track: { ...layoutState.track },
    slots: layoutState.lamps
      .filter(isSlotVisible)
      .map(lamp => ({
        slotId: lamp.slotId,
        order: lamp.order,
        lampX: round(lamp.lampX),
        targetX: round(lamp.targetX),
        boundLampDeviceId: lamp.boundLampDeviceId || '',
        sourceDeviceId: lamp.sourceDeviceId,
        isManual: lamp.isManual || false,
      })),
  }
  localStorage.setItem(ZONE_LAYOUT_STORAGE_KEY, JSON.stringify(stored))
  cachedStoredLayouts = stored
}

function syncLampObjectsWithState() {
  if (!scene) return

  for (const objects of lampObjects.values()) {
    scene.remove(objects.group, objects.spot, objects.spotTarget, objects.shirt, objects.beam)
    disposeObject(objects.group)
    disposeObject(objects.shirt)
    objects.beam.geometry.dispose()
    disposeMaterial(objects.beam.material)
  }
  lampObjects.clear()
  removeLampPickables()

  for (const lamp of layoutState.lamps) {
    if (!isSlotVisible(lamp)) continue
    const objects = createLampObjects(lamp)
    lampObjects.set(lamp.slotId, objects)
    scene.add(objects.group, objects.spot, objects.spotTarget, objects.shirt)
  }
}

function syncActiveZoneLampCount() {
  const zoneLampDevices = getLampDevicesForZone(activeZone.value.zoneName)
  const deviceSlotIds = zoneLampDevices
    .map(device => `device-${getDeviceId(device)}`)
    .filter(slotId => slotId !== 'device-')
  const expectedSlotIds = new Set(deviceSlotIds)
  const existingSlotIds = new Set(layoutState.lamps.map(lamp => lamp.slotId))
  const existingDeviceSlotIds = layoutState.lamps
    .filter(lamp => !lamp.isManual)
    .map(lamp => lamp.slotId)
  const hasNewDeviceSlot = deviceSlotIds.some(slotId => !existingSlotIds.has(slotId))
  const hasStaleDeviceSlot = existingDeviceSlotIds.some((slotId) => {
    if (zoneLampDevices.length === 0) return slotId !== 'mock-fallback'
    return !expectedSlotIds.has(slotId)
  })

  if (!hasNewDeviceSlot && !hasStaleDeviceSlot) return

  saveActiveZoneLayout()
  rebuildActiveZoneLayout()
}

function addManualSlot() {
  if (dragState) return

  const index = layoutState.lamps.length
  const mock = mockLampLayouts[index % mockLampLayouts.length]
  const slotId = `manual-${Date.now()}`
  const x = getDefaultSlotX(index, index + 1)

  layoutState.lamps.push({
    ...mock,
    slotId,
    order: index,
    lampX: x,
    targetX: x,
    boundLampDeviceId: '',
    sourceDeviceId: '',
    isManual: true,
    deviceId: undefined,
    chipId: undefined,
    name: `${activeZone.value.zoneName} · 未绑定灯位`,
  })

  ensureMinVisibleSlots(activeZone.value.zoneId)
  arrangeSlotsEvenly()
  selectSlot(slotId)
  syncLampObjectsWithState()
  updateLayoutVisuals()
  saveActiveZoneLayout()
}

function selectSlot(slotId: string) {
  selectedSlotId.value = slotId
  updateLayoutVisuals()
  silentLocateSlot(slotId)
}

async function silentLocateSlot(slotId: string) {
  const lamp = layoutState.lamps.find(l => l.slotId === slotId)
  if (!lamp || !lamp.chipId) return
  if (locatingSlotId.value === lamp.chipId) return
  locatingSlotId.value = lamp.chipId
  try {
    await locateDevice(String(lamp.chipId))
  } catch {
    // silent
  } finally {
    locatingSlotId.value = ''
  }
}

function clearSelectedSlot() {
  selectedSlotId.value = ''
  updateLayoutVisuals()
}

function isDeletableSlot(slot: LampLayout | null) {
  if (!slot) return false
  return Boolean(slot.isManual || (!slot.sourceDeviceId && !slot.deviceId && !slot.chipId))
}

function deleteSelectedSlot() {
  if (!canDeleteSelectedSlot.value || !selectedSlot.value) return

  const slotId = selectedSlot.value.slotId
  layoutState.lamps = layoutState.lamps.filter(slot => slot.slotId !== slotId)
  clearSelectedSlot()

  if (layoutState.lamps.length === 0) {
    const mock = mockLampLayouts[0]
    layoutState.lamps = [{
      ...mock,
      slotId: 'mock-fallback',
      order: 0,
      lampX: 0,
      targetX: 0,
      boundLampDeviceId: '',
      sourceDeviceId: '',
      isManual: false,
      deviceId: undefined,
      chipId: undefined,
      name: `${activeZone.value.zoneName} · 未绑定灯位`,
    }]
  } else {
    applySlotOrderLayout()
  }

  ensureMinVisibleSlots(activeZone.value.zoneId)
  syncLampObjectsWithState()
  updateLayoutVisuals()
  saveActiveZoneLayout()
}

function moveSelectedSlot(direction: -1 | 1) {
  if (!selectedSlotId.value || !selectedSlot.value) return

  const next = [...layoutState.lamps].sort((a, b) => a.order - b.order)
  const index = next.findIndex(slot => slot.slotId === selectedSlotId.value)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= layoutState.lamps.length) return

  const current = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = current
  layoutState.lamps = next
  applySlotOrderLayout()
}

function applySlotOrderLayout() {
  const count = layoutState.lamps.length
  layoutState.lamps.forEach((slot, index) => {
    const x = getDefaultSlotX(index, count)
    slot.order = index
    slot.lampX = x
    slot.targetX = x
  })
  updateLayoutVisuals()
  saveActiveZoneLayout()
}

function arrangeSlotsEvenly() {
  layoutState.lamps = [...layoutState.lamps].sort((a, b) => a.order - b.order)
  applySlotOrderLayout()
}

function handleArrangeSlotsEvenly() {
  arrangeSlotsEvenly()
}

function removeLampPickables() {
  for (let index = pickableObjects.length - 1; index >= 0; index -= 1) {
    if (pickableObjects[index].userData.dragType === 'lamp') {
      pickableObjects.splice(index, 1)
    }
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      disposeMaterial(child.material)
    }
  })
}

function initThreeScene() {
  const host = viewportRef.value
  if (!host) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef4fb')
  scene.fog = new THREE.Fog('#eef4fb', 7, 16)

  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100)
  camera.position.copy(cameraViewPresets.display.position)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 3.4
  controls.maxDistance = 8.5
  controls.enablePan = false
  controls.minPolarAngle = Math.PI / 5
  controls.maxPolarAngle = Math.PI / 2.35
  controls.minAzimuthAngle = -Math.PI / 5
  controls.maxAzimuthAngle = Math.PI / 5
  controls.target.copy(cameraViewPresets.display.target)

  createStoreSpace()
  createTrack()
  createMockLamps()
  createCameraNode()
  updateLayoutVisuals()

  renderer.domElement.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  if (props.active && !document.hidden) startRenderLoop()
}

function createStoreSpace() {
  if (!scene) return

  const ambient = new THREE.HemisphereLight('#fafcff', '#d8c5ad', 1.55)
  scene.add(ambient)

  const fill = new THREE.DirectionalLight('#ffffff', 0.52)
  fill.position.set(-3.2, 4.8, 4.1)
  fill.castShadow = true
  scene.add(fill)

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.08, 6.1),
    new THREE.MeshStandardMaterial({ color: '#d9c9b8', roughness: 0.7 }),
  )
  floor.position.set(0, -0.04, 0.35)
  floor.receiveShadow = true
  scene.add(floor)

  const floorInset = new THREE.Mesh(
    new THREE.BoxGeometry(7.75, 0.012, 4.45),
    new THREE.MeshStandardMaterial({ color: '#ecdecc', roughness: 0.82 }),
  )
  floorInset.position.set(0, 0.012, 0.42)
  floorInset.receiveShadow = true
  scene.add(floorInset)


  const seamMaterial = new THREE.MeshBasicMaterial({ color: '#a18e78', transparent: true, opacity: 0.1 })
  for (const z of [-1.85, -1.05, -0.25, 0.55, 1.35, 2.15]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.009, 0.007), seamMaterial)
    seam.position.set(0, 0.03, z)
    scene.add(seam)
  }
  for (const x of [-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.009, 4.28), seamMaterial)
    seam.position.set(x, 0.031, 0.42)
    scene.add(seam)
  }

  const floorWashMaterial = new THREE.MeshBasicMaterial({ color: '#fff6e8', transparent: true, opacity: 0.055 })
  const floorWash = new THREE.Mesh(new THREE.BoxGeometry(7.15, 0.006, 3.6), floorWashMaterial)
  floorWash.position.set(0.15, 0.038, 0.34)
  scene.add(floorWash)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#f2eee8', roughness: 0.86 })
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.9, 3.6, 0.1), wallMaterial)
  backWall.position.set(0, 1.8, displayWallZ - 0.055)
  backWall.receiveShadow = true
  scene.add(backWall)

  const ceilingStrip = new THREE.Mesh(
    new THREE.BoxGeometry(8.05, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.72 }),
  )
  ceilingStrip.position.set(0, 2.72, displayWallZ + 0.03)
  scene.add(ceilingStrip)

  const coveShadow = new THREE.Mesh(
    new THREE.BoxGeometry(8.05, 0.018, 0.04),
    new THREE.MeshBasicMaterial({ color: '#d6c7b8', transparent: true, opacity: 0.2 }),
  )
  coveShadow.position.set(0, 2.62, displayWallZ + 0.065)
  scene.add(coveShadow)

  const wallLineMaterial = new THREE.MeshBasicMaterial({ color: '#d7c8b8', transparent: true, opacity: 0.24 })
  for (const x of [-3.35, -1.12, 1.12, 3.35]) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.018, 2.42, 0.026), wallLineMaterial)
    divider.position.set(x, 1.47, displayWallZ + 0.025)
    scene.add(divider)
  }

  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#fff8ef', roughness: 0.74 })
  const panelBorderMaterial = new THREE.MeshStandardMaterial({ color: '#dcc9b3', roughness: 0.64, metalness: 0.03 })
  const rackMaterial = new THREE.MeshStandardMaterial({ color: '#7b8794', roughness: 0.36, metalness: 0.46 })
  const displayXs = [-2.25, 0, 2.25]

  for (const x of displayXs) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.85, 0.04), panelMaterial)
    panel.position.set(x, 1.45, displayWallZ + 0.04)
    panel.receiveShadow = true
    scene.add(panel)

    const topBorder = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.035, 0.035), panelBorderMaterial)
    topBorder.position.set(x, 2.39, displayWallZ + 0.072)
    topBorder.castShadow = true
    scene.add(topBorder)

    const labelPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.105, 0.026),
      new THREE.MeshStandardMaterial({ color: '#efe3d3', roughness: 0.7 }),
    )
    labelPlate.position.set(x, 2.2, displayWallZ + 0.086)
    scene.add(labelPlate)

    const accentLine = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.018, 0.02),
      new THREE.MeshBasicMaterial({ color: '#c7a987', transparent: true, opacity: 0.34 }),
    )
    accentLine.position.set(x, 2.115, displayWallZ + 0.092)
    scene.add(accentLine)

    const bottomBorder = topBorder.clone()
    bottomBorder.position.y = 0.51
    scene.add(bottomBorder)

    for (const sideX of [-0.86, 0.86]) {
      const sideBorder = new THREE.Mesh(new THREE.BoxGeometry(0.032, 1.84, 0.034), panelBorderMaterial)
      sideBorder.position.set(x + sideX, 1.45, displayWallZ + 0.072)
      sideBorder.castShadow = true
      scene.add(sideBorder)
    }

    const rack = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.18, 18), rackMaterial)
    rack.position.set(x, 1.92, displayWallZ + 0.16)
    rack.rotation.z = Math.PI / 2
    rack.castShadow = true
    scene.add(rack)

    const hangerHook = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.009, 8, 20, Math.PI), rackMaterial)
    hangerHook.position.set(x, 1.84, displayWallZ + 0.18)
    hangerHook.rotation.x = Math.PI / 2
    hangerHook.castShadow = true
    scene.add(hangerHook)
  }

  const sideWallMaterial = new THREE.MeshStandardMaterial({ color: '#eee4da', roughness: 0.88 })
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.25, 5.65), sideWallMaterial)
  leftWall.position.set(-4.45, 1.62, 0.2)
  leftWall.receiveShadow = true
  scene.add(leftWall)

  const rightWall = leftWall.clone()
  rightWall.position.x = 4.45
  scene.add(rightWall)


  const cabinetMaterial = new THREE.MeshStandardMaterial({ color: '#c4ad91', roughness: 0.72 })
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.38, 0.42), cabinetMaterial)
  cabinet.position.set(0, 0.19, displayWallZ + 0.36)
  cabinet.castShadow = true
  cabinet.receiveShadow = true
  scene.add(cabinet)

  const cabinetTop = new THREE.Mesh(
    new THREE.BoxGeometry(7.18, 0.045, 0.46),
    new THREE.MeshStandardMaterial({ color: '#dac7ad', roughness: 0.68 }),
  )
  cabinetTop.position.set(0, 0.405, displayWallZ + 0.36)
  cabinetTop.castShadow = true
  scene.add(cabinetTop)

  const drawerLineMaterial = new THREE.MeshBasicMaterial({ color: '#8f765d', transparent: true, opacity: 0.2 })
  const cabinetEdgeMaterial = new THREE.MeshBasicMaterial({ color: '#f0dcc0', transparent: true, opacity: 0.28 })
  const cabinetShadowMaterial = new THREE.MeshBasicMaterial({ color: '#7d6045', transparent: true, opacity: 0.16 })

  const topEdge = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.018, 0.012), cabinetEdgeMaterial)
  topEdge.position.set(0, 0.398, displayWallZ + 0.59)
  scene.add(topEdge)

  const bottomShadow = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.022, 0.012), cabinetShadowMaterial)
  bottomShadow.position.set(0, 0.02, displayWallZ + 0.585)
  scene.add(bottomShadow)

  const horizontalDrawerLine = new THREE.Mesh(new THREE.BoxGeometry(6.85, 0.014, 0.012), drawerLineMaterial)
  horizontalDrawerLine.position.set(0, 0.215, displayWallZ + 0.575)
  scene.add(horizontalDrawerLine)

  for (const y of [0.12, 0.31]) {
    const woodLine = new THREE.Mesh(
      new THREE.BoxGeometry(6.72, 0.008, 0.01),
      new THREE.MeshBasicMaterial({ color: '#9a8066', transparent: true, opacity: 0.12 }),
    )
    woodLine.position.set(0, y, displayWallZ + 0.578)
    scene.add(woodLine)
  }

  for (const x of [-2.35, 0, 2.35]) {
    const drawerLine = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.012), drawerLineMaterial)
    drawerLine.position.set(x, 0.19, displayWallZ + 0.574)
    scene.add(drawerLine)
  }
}

function createTrack() {
  if (!scene) return

  railMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.1, 0.18),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.42, metalness: 0.28 }),
  )
  railMesh.castShadow = true
  scene.add(railMesh)

  railGrooveMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.024, 0.19),
    new THREE.MeshStandardMaterial({ color: '#172033', roughness: 0.36, metalness: 0.42 }),
  )
  railGrooveMesh.castShadow = true
  scene.add(railGrooveMesh)

  railHighlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.014, 0.028),
    new THREE.MeshBasicMaterial({ color: '#93a4b8', transparent: true, opacity: 0.42 }),
  )
  scene.add(railHighlightMesh)

  const supportMaterial = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.42, metalness: 0.32 })
  for (let index = 0; index < 3; index += 1) {
    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 12), supportMaterial)
    support.castShadow = true
    railSupportMeshes.push(support)
    scene.add(support)
  }

  const handleGeometry = new THREE.SphereGeometry(0.15, 24, 16)
  const handleMaterial = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.35, metalness: 0.1 })
  leftHandleMesh = new THREE.Mesh(handleGeometry, handleMaterial)
  rightHandleMesh = new THREE.Mesh(handleGeometry.clone(), handleMaterial.clone())
  leftHandleMesh.userData.dragType = 'track-left'
  rightHandleMesh.userData.dragType = 'track-right'
  leftHandleMesh.castShadow = true
  rightHandleMesh.castShadow = true
  scene.add(leftHandleMesh, rightHandleMesh)
  pickableObjects.push(leftHandleMesh, rightHandleMesh)
}

function createMockLamps() {
  if (!scene) return
  for (const lamp of layoutState.lamps) {
    const objects = createLampObjects(lamp)
    lampObjects.set(lamp.slotId, objects)
    scene.add(objects.group, objects.spot, objects.spotTarget, objects.shirt)
  }
}

const sharedMountMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.38, metalness: 0.34 })
const sharedHingeMaterial = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.42, metalness: 0.42 })
const sharedDarkMetalMaterial = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55, metalness: 0.48 })
const sharedRimMaterial = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.55 })

function createLampObjects(lamp: LampLayout): LampObjects {
  const group = new THREE.Group()
  group.userData.dragType = 'lamp'
  group.userData.lampId = lamp.slotId

  const mountMaterial = sharedMountMaterial
  const hingeMaterial = sharedHingeMaterial
  const darkMetalMaterial = sharedDarkMetalMaterial
  const rimMaterial = sharedRimMaterial

  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.15, 0.36), mountMaterial)
  mount.position.set(0, -0.11, 0)

  const mountInset = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.024, 0.2),
    new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.34 }),
  )
  mountInset.position.set(0, -0.028, 0.02)

  const yawGroup = new THREE.Group()
  yawGroup.position.set(0, -0.22, 0)

  const yawDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.055, 40),
    new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.34, metalness: 0.38 }),
  )
  yawDisk.position.set(0, 0, 0)

  const yawDiskLower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.17, 0.045, 40),
    mountMaterial,
  )
  yawDiskLower.position.set(0, -0.055, 0)

  const yawIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.018, 0.16),
    new THREE.MeshBasicMaterial({ color: '#9fb3c8', transparent: true, opacity: 0.34 }),
  )
  yawIndicator.position.set(0, 0.036, -0.125)

  const shortNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.045, 0.14, 18),
    hingeMaterial,
  )
  shortNeck.position.set(0, -0.13, 0)

  const yokeFrame = new THREE.Group()
  yokeFrame.position.set(0, -0.31, 0.04)

  const yokeTopBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.065, 0.12),
    hingeMaterial,
  )
  yokeTopBlock.position.set(0, 0, 0)

  const neckBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.055, 0.11),
    mountMaterial,
  )
  neckBlock.position.set(0, 0.078, 0)

  const sideBracketGeometry = new THREE.BoxGeometry(0.042, 0.34, 0.058)
  const leftArm = new THREE.Mesh(sideBracketGeometry, hingeMaterial)
  leftArm.position.set(-0.285, -0.19, 0)
  const rightArm = new THREE.Mesh(sideBracketGeometry.clone(), hingeMaterial.clone())
  rightArm.position.set(0.285, -0.19, 0)

  const leftArmFoot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.07), hingeMaterial)
  leftArmFoot.position.set(-0.285, -0.365, 0)
  const rightArmFoot = leftArmFoot.clone()
  rightArmFoot.position.set(0.285, -0.365, 0)

  const hingeAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.52, 18),
    new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.36, metalness: 0.5 }),
  )
  hingeAxle.rotation.z = Math.PI / 2
  hingeAxle.position.set(0, -0.365, 0)

  const leftPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.032, 24), rimMaterial)
  leftPivot.rotation.z = Math.PI / 2
  leftPivot.position.set(-0.31, -0.365, 0)
  const rightPivot = leftPivot.clone()
  rightPivot.position.set(0.31, -0.365, 0)

  const pitchBody = new THREE.Group()
  pitchBody.position.set(0, -0.365, 0)

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.58, 40),
    darkMetalMaterial,
  )
  barrel.position.set(0, -0.02, 0)

  const rearCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.19, 0.04, 40),
    mountMaterial,
  )
  rearCap.position.set(0, 0.27, 0)

  const barrelRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.045, 40),
    rimMaterial,
  )
  barrelRim.position.set(0, -0.335, 0)

  const aperture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.018, 40),
    new THREE.MeshStandardMaterial({
      color: colorTemperatureToHex(lamp.temperature),
      emissive: colorTemperatureToHex(lamp.temperature),
      emissiveIntensity: 0.9,
    }),
  )
  aperture.position.set(0, -0.37, 0)

  const selectionRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.022, 12, 64),
    new THREE.MeshBasicMaterial({
      color: '#2f7cff',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  )
  selectionRing.rotation.x = Math.PI / 2
  selectionRing.position.set(0, -0.425, 0)
  selectionRing.renderOrder = 24
  selectionRing.userData.ignorePickable = true
  selectionRing.visible = false

  const selectionMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.018, 10, 40),
    new THREE.MeshBasicMaterial({
      color: '#2f7cff',
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      depthTest: false,
    }),
  )
  selectionMarker.rotation.x = Math.PI / 2
  selectionMarker.position.set(0, -0.58, 0)
  selectionMarker.renderOrder = 30
  selectionMarker.userData.ignorePickable = true
  selectionMarker.visible = false

  const leftBodyPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 24), rimMaterial.clone())
  leftBodyPivot.rotation.z = Math.PI / 2
  leftBodyPivot.position.set(-0.255, 0, 0)
  const rightBodyPivot = leftBodyPivot.clone()
  rightBodyPivot.position.set(0.255, 0, 0)

  pitchBody.add(barrel, rearCap, barrelRim, aperture, selectionRing, selectionMarker, leftBodyPivot, rightBodyPivot)
  yokeFrame.add(neckBlock, yokeTopBlock, leftArm, rightArm, leftArmFoot, rightArmFoot, hingeAxle, leftPivot, rightPivot, pitchBody)
  yawGroup.add(yawDisk, yawDiskLower, yawIndicator, shortNeck, yokeFrame)
  group.add(mount, mountInset, yawGroup)
  markLampPickable(group, lamp.slotId)

  const target = new THREE.Object3D()
  const spot = new THREE.SpotLight(colorTemperatureToHex(lamp.temperature), 2.2, 6.5, Math.PI / 6, 0.42, 1.2)
  spot.castShadow = true
  spot.shadow.mapSize.set(1024, 1024)
  spot.target = target

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.48, 1, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorTemperatureToHex(lamp.temperature),
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    }),
  )


  const shirt = createShirt(lamp.clothingColor)
  return { group, body: group, head: pitchBody, yawGroup, yokeFrame, pitchBody, spot, spotTarget: target, beam, aperture, selectionRing, selectionMarker, shirt }
}

function createShirt(color: string) {
  const shirt = new THREE.Group()
  const baseColor = new THREE.Color(color)
  const trimColor = baseColor.clone().lerp(new THREE.Color('#f1eadf'), 0.22)
  shirt.userData.clothingColor = normalizeDeviceColor(color, color)

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.8,
    metalness: 0.01,
    side: THREE.DoubleSide,
  })

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.88,
    metalness: 0,
  })

  const outline = new THREE.Shape()
  outline.moveTo(-0.38, 0.03)
  outline.quadraticCurveTo(-0.18, -0.015, 0.02, 0)
  outline.quadraticCurveTo(0.19, -0.018, 0.4, 0.04)
  outline.bezierCurveTo(0.36, 0.25, 0.35, 0.45, 0.43, 0.64)
  outline.bezierCurveTo(0.52, 0.63, 0.61, 0.59, 0.67, 0.53)
  outline.quadraticCurveTo(0.72, 0.62, 0.75, 0.73)
  outline.quadraticCurveTo(0.61, 0.84, 0.43, 0.9)
  outline.bezierCurveTo(0.34, 0.93, 0.25, 0.96, 0.17, 1.02)
  outline.quadraticCurveTo(0.09, 0.965, 0, 0.965)
  outline.quadraticCurveTo(-0.09, 0.965, -0.18, 1.025)
  outline.bezierCurveTo(-0.26, 0.96, -0.35, 0.93, -0.44, 0.9)
  outline.quadraticCurveTo(-0.62, 0.84, -0.76, 0.72)
  outline.quadraticCurveTo(-0.72, 0.61, -0.67, 0.52)
  outline.bezierCurveTo(-0.6, 0.59, -0.51, 0.63, -0.43, 0.64)
  outline.bezierCurveTo(-0.36, 0.44, -0.37, 0.24, -0.38, 0.03)

  const extrudeOptions = {
    depth: 0.058,
    bevelEnabled: true,
    bevelSize: 0.007,
    bevelThickness: 0.006,
    bevelSegments: 2,
  }
  const geometry = new THREE.ExtrudeGeometry(outline, extrudeOptions)
  geometry.translate(0, 0, -0.029)


  const body = new THREE.Mesh(geometry, bodyMaterial)
  body.userData.shirtBody = true
  body.castShadow = true
  body.receiveShadow = true

  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.125, 0.952, 0.042),
    new THREE.Vector3(-0.055, 0.91, 0.048),
    new THREE.Vector3(0.03, 0.908, 0.048),
    new THREE.Vector3(0.118, 0.95, 0.042),
  ])
  const collar = new THREE.Mesh(
    new THREE.TubeGeometry(collarCurve, 24, 0.008, 8, false),
    trimMaterial,
  )
  collar.userData.shirtTrim = true

  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.014, 0.012), trimMaterial)
  hem.position.set(0.02, 0.055, 0.072)
  hem.rotation.z = 0.025
  hem.userData.shirtTrim = true

  const leftCuff = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.013, 0.012), trimMaterial)
  leftCuff.position.set(-0.62, 0.61, 0.072)
  leftCuff.rotation.z = -0.43
  leftCuff.userData.shirtTrim = true

  const rightCuff = leftCuff.clone()
  rightCuff.position.set(0.62, 0.615, 0.046)
  rightCuff.rotation.z = 0.38
  rightCuff.userData.shirtTrim = true


  const hanger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: '#a3adb8', roughness: 0.48, metalness: 0.24 }),
  )
  hanger.position.set(0, 1.075, -0.014)
  hanger.rotation.z = Math.PI / 2

  shirt.add(body, collar, hem, leftCuff, rightCuff, hanger)
  shirt.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = false
    }
  })
  return shirt
}
function createCameraNode() {
  if (!scene) return

  const camGroup = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.5, metalness: 0.12 }),
  )
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.09, 24),
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#1d4ed8', emissiveIntensity: 0.16 }),
  )
  lens.position.set(0, 0, -0.155)
  lens.rotation.x = Math.PI / 2
  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12),
    new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.46, metalness: 0.32 }),
  )
  bracket.position.set(0, 0.31, 0)
  camGroup.add(body, lens, bracket)
  camGroup.position.set(layoutState.camera.x, layoutState.camera.y, layoutState.camera.z)
  camGroup.lookAt(0, 1.35, displayWallZ + 0.08)
  camGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true
  })
  scene.add(camGroup)
}

function syncDevicesToLayout() {
  const devices = props.devices || []
  const lampDevices = getLampDevicesForZone(activeZone.value.zoneName)
  const cameraDevice = devices.find(isLayoutCameraDevice)

  layoutState.lamps.forEach((lamp, index) => {
    const mock = mockLampLayouts[index % mockLampLayouts.length]
    const device = findDeviceForSlot(lamp, lampDevices)

    if (!device) {
      lamp.deviceId = undefined
      lamp.chipId = undefined
      lamp.name = lamp.isManual ? `${activeZone.value.zoneName} · 未绑定灯位` : `${activeZone.value.zoneName} · ${mock.name}`
      lamp.brightness = mock.brightness
      lamp.temperature = mock.temperature
      lamp.clothingColor = mock.clothingColor
      lamp.online = undefined
      return
    }

    lamp.deviceId = device.id ?? device.chipId
    lamp.chipId = device.chipId
    lamp.name = resolveDeviceName(device, mock.name)
    lamp.brightness = resolveDeviceBrightness(device, lamp.brightness || mock.brightness)
    lamp.temperature = resolveDeviceTemperature(device, lamp.temperature || mock.temperature)
    lamp.clothingColor = normalizeDeviceColor(resolveDeviceColorValue(device), lamp.clothingColor || mock.clothingColor)
    lamp.online = device.online
  })

  if (cameraDevice) {
    layoutState.camera.deviceId = cameraDevice.id ?? cameraDevice.chipId
    layoutState.camera.chipId = cameraDevice.chipId
    layoutState.camera.name = resolveDeviceName(cameraDevice, mockCameraLayout.name)
    layoutState.camera.online = cameraDevice.online
  } else {
    layoutState.camera.deviceId = undefined
    layoutState.camera.chipId = undefined
    layoutState.camera.name = mockCameraLayout.name
    layoutState.camera.online = undefined
  }

  updateLayoutVisuals()
}

function findDeviceForSlot(slot: ZoneSlot, devices: DeviceLike[]) {
  const boundLampDeviceId = slot.boundLampDeviceId || ''
  if (boundLampDeviceId) {
    const boundDevice = devices.find(device => isSameDeviceId(device, boundLampDeviceId))
    if (boundDevice) return boundDevice
  }

  const sourceDeviceId = slot.sourceDeviceId || ''
  if (sourceDeviceId) {
    const sourceDevice = devices.find(device => isSameDeviceId(device, sourceDeviceId))
    if (sourceDevice) return sourceDevice
  }

  return undefined
}

function isLayoutLampDevice(device: DeviceLike) {
  const type = normalizeLayoutDeviceType(device)
  if (type) return type === 'lamp'

  const text = getDeviceSearchText(device)
  return text.includes('lamp')
    && !text.includes('camlamp')
    && !text.includes('camera')
    && !text.includes('cam')
}

function isLayoutCameraDevice(device: DeviceLike) {
  const type = normalizeLayoutDeviceType(device)
  if (type) return type === 'cam' || type === 'camera' || type === 'camlamp'

  const text = getDeviceSearchText(device)
  return text.includes('camlamp') || text.includes('camera') || text.includes('cam')
}

function normalizeLayoutDeviceType(device: DeviceLike) {
  return normalizeDeviceType(String(device.deviceType ?? device.type ?? ''))
}

function getDeviceSearchText(device: DeviceLike) {
  return [
    device.id,
    device.chipId,
    device.displayName,
    device.name,
    device.deviceType,
    device.type,
  ]
    .filter(value => value != null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase()
}

function getDeviceId(device: DeviceLike | undefined) {
  if (!device) return ''
  return device.id ?? device.chipId ?? ''
}

function isSameDeviceId(device: DeviceLike, value: string | number | '') {
  if (value === '') return false
  const text = String(value)
  return String(device.id ?? '') === text || String(device.chipId ?? '') === text
}

function resolveDeviceName(device: DeviceLike, fallback: string) {
  return String(
    device.displayName ||
    device.name ||
    device.id ||
    device.chipId ||
    fallback,
  )
}

function resolveDeviceBrightness(device: DeviceLike, fallback: number) {
  const autoMode = isTruthy(device.autoMode)
  const value = autoMode
    ? (device.recommendedBrightness ?? device.brightness)
    : device.brightness
  return clamp(resolveFiniteNumber(value, fallback || 70), 0, 100)
}

function resolveDeviceTemperature(device: DeviceLike, fallback: number) {
  const autoMode = isTruthy(device.autoMode)
  const value = autoMode
    ? (device.recommendedTemp ?? device.temp)
    : device.temp
  return clamp(resolveFiniteNumber(value, fallback || 4000), 2700, 6500)
}

function resolveDeviceColorValue(device: DeviceLike) {
  return device.mainColorRgb ?? device.mainColorRGB ?? device.mainColor
}

function normalizeDeviceColor(value: unknown, fallback: string) {
  const fallbackColor = normalizeHexColor(fallback) || '#8fb95a'

  if (Array.isArray(value) && value.length >= 3) {
    return rgbToHex(value[0], value[1], value[2]) || fallbackColor
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return rgbToHex(record.r ?? record.red, record.g ?? record.green, record.b ?? record.blue) || fallbackColor
  }

  if (typeof value !== 'string') return fallbackColor

  const text = value.trim()
  if (!text) return fallbackColor

  const hexColor = normalizeHexColor(text)
  if (hexColor) return hexColor

  const rgbMatch = text.match(/^rgba?\(([^)]+)\)$/i)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,\s/]+/).filter(Boolean)
    return rgbToHex(parts[0], parts[1], parts[2]) || fallbackColor
  }

  const csvMatch = text.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/)
  if (csvMatch) {
    return rgbToHex(csvMatch[1], csvMatch[2], csvMatch[3]) || fallbackColor
  }

  return fallbackColor
}

function normalizeHexColor(value: string) {
  const text = value.trim()
  const shortHex = text.match(/^#([0-9a-f]{3})$/i)
  if (shortHex) {
    return `#${shortHex[1].split('').map(char => `${char}${char}`).join('')}`.toLowerCase()
  }

  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return text.toLowerCase()
  }

  return ''
}

function rgbToHex(red: unknown, green: unknown, blue: unknown) {
  const channels = [red, green, blue].map(value => Number(value))
  if (channels.some(value => !Number.isFinite(value))) return ''

  return `#${channels
    .map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}


function isTruthy(value: unknown) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true'
}

function markLampPickable(group: THREE.Group, lampId: string) {
  group.traverse((child) => {
    if (child.userData.ignorePickable) return
    child.userData.dragType = 'lamp'
    child.userData.lampId = lampId
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = false
      pickableObjects.push(child)
    }
  })
}

function updateLayoutVisuals() {
  updateTrackVisuals()
  for (const lamp of layoutState.lamps) {
    updateLampVisuals(lamp)
  }
  updateSelectedLampVisuals()
}

function updateSelectedLampVisuals() {
  for (const [slotId, objects] of lampObjects.entries()) {
    const selected = selectedSlotId.value === slotId
    objects.selectionRing.visible = selected
    objects.selectionMarker.visible = selected
  }
}

function updateTrackVisuals() {
  const { startX, endX, y, z } = layoutState.track
  const length = Math.max(0.1, endX - startX)
  const centerX = startX + length / 2

  if (railMesh) {
    railMesh.scale.set(length, 1, 1)
    railMesh.position.set(centerX, y, z)
  }
  if (railGrooveMesh) {
    railGrooveMesh.scale.set(Math.max(0.1, length - 0.18), 1, 1)
    railGrooveMesh.position.set(centerX, y - 0.052, z)
  }
  if (railHighlightMesh) {
    railHighlightMesh.scale.set(Math.max(0.1, length - 0.34), 1, 1)
    railHighlightMesh.position.set(centerX, y + 0.058, z - 0.058)
  }
  railSupportMeshes.forEach((support, index) => {
    const t = railSupportMeshes.length === 1 ? 0.5 : index / (railSupportMeshes.length - 1)
    const supportX = startX + length * t
    support.position.set(supportX, y + 0.28, z)
  })
  if (leftHandleMesh) leftHandleMesh.position.set(startX, y, z)
  if (rightHandleMesh) rightHandleMesh.position.set(endX, y, z)

  for (const lamp of layoutState.lamps) {
    lamp.lampX = clamp(lamp.lampX, startX, endX)
  }
}

function updateLampVisuals(lamp: LampLayout) {
  const objects = lampObjects.get(lamp.slotId)
  if (!objects || !scene) return

  const lampY = layoutState.track.y
  const lampZ = layoutState.track.z
  const shirtX = lamp.targetX

  objects.group.position.set(lamp.lampX, lampY, lampZ)
  objects.shirt.position.set(shirtX, shirtBaseY, wallLightSpotZ)
  updateShirtColor(objects.shirt, lamp.clothingColor)

  const beamEnd = new THREE.Vector3(shirtX, shirtAimY, wallLightSpotZ + 0.02)
  objects.group.updateWorldMatrix(true, true)

  const beamStart = new THREE.Vector3()
  objects.aperture.getWorldPosition(beamStart)
  const beamDirection = beamEnd.clone().sub(beamStart)
  const normalizedDirection = beamDirection.clone().normalize()
  applyLampAim(objects, beamDirection)

  const color = new THREE.Color(colorTemperatureToHex(lamp.temperature))
  const intensity = 0.45 + lamp.brightness / 100 * 3.4
  const opacity = 0.028 + lamp.brightness / 100 * 0.085

  objects.spot.color.copy(color)
  objects.spot.intensity = intensity
  objects.spot.position.copy(beamStart)
  objects.spotTarget.position.copy(beamEnd)
  objects.spot.target = objects.spotTarget

  const visibleBeamEnd = beamStart.clone().add(beamDirection.clone().multiplyScalar(1.02))
  const visibleBeamDistance = Math.max(0.1, visibleBeamEnd.distanceTo(beamStart))
  objects.beam.position.copy(beamStart.clone().add(visibleBeamEnd).multiplyScalar(0.5))
  objects.beam.scale.set(1, visibleBeamDistance, 1)
  objects.beam.quaternion.setFromUnitVectors(beamAxis, normalizedDirection)
  const beamMaterial = objects.beam.material
  if (beamMaterial instanceof THREE.MeshBasicMaterial) {
    beamMaterial.color.copy(color)
    beamMaterial.opacity = opacity
  }
  if (!objects.beam.parent) scene.add(objects.beam)


  const apertureMaterial = objects.aperture.material
  const selected = selectedSlotId.value === lamp.slotId
  if (apertureMaterial instanceof THREE.MeshStandardMaterial) {
    const apertureColor = selected
      ? color.clone().lerp(new THREE.Color('#60a5fa'), 0.55)
      : color
    apertureMaterial.color.copy(apertureColor)
    apertureMaterial.emissive.copy(apertureColor)
    apertureMaterial.emissiveIntensity = 0.45 + lamp.brightness / 100 * 1.2 + (selected ? 0.85 : 0)
  }
}

function applyLampAim(objects: LampObjects, direction: THREE.Vector3) {
  const horizontalLength = Math.hypot(direction.x, direction.z)
  const yaw = horizontalLength > 0.001
    ? Math.atan2(-direction.x / horizontalLength, -direction.z / horizontalLength)
    : 0
  const pitch = Math.atan2(horizontalLength, Math.max(0.001, -direction.y))

  objects.yawGroup.rotation.set(0, yaw, 0)
  objects.pitchBody.rotation.set(pitch, 0, 0)
}

function updateShirtColor(shirt: THREE.Group, color: string) {
  const normalizedColor = normalizeDeviceColor(color, '#8fb95a')
  if (shirt.userData.clothingColor === normalizedColor) return

  const baseColor = new THREE.Color(normalizedColor)
  const trimColor = baseColor.clone().lerp(new THREE.Color('#f1eadf'), 0.22)

  shirt.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const material = child.material
    if (!(material instanceof THREE.MeshStandardMaterial)) return

    if (child.userData.shirtBody) {
      material.color.copy(baseColor)
    } else if (child.userData.shirtTrim) {
      material.color.copy(trimColor)
    }
  })

  shirt.userData.clothingColor = normalizedColor
}

function handlePointerDown(event: PointerEvent) {
  if (!renderer || !camera) return

  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(pickableObjects, false)
  const hit = hits.find(item => item.object.userData.dragType)
  if (!hit) {
    clearSelectedSlot()
    return
  }

  const dragType = hit.object.userData.dragType
  if (dragType === 'track-left') {
    clearSelectedSlot()
    dragState = { type: 'track', handle: 'left' }
  } else if (dragType === 'track-right') {
    clearSelectedSlot()
    dragState = { type: 'track', handle: 'right' }
  } else if (dragType === 'lamp') {
    selectSlot(hit.object.userData.lampId)
    dragState = { type: 'lamp', lampId: hit.object.userData.lampId }
  }

  if (!dragState) return
  event.preventDefault()
  renderer.domElement.setPointerCapture(event.pointerId)
  if (controls) controls.enabled = false
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState || !camera) return
  updatePointer(event)
  raycaster.setFromCamera(pointer, camera)
  if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return

  const x = dragPoint.x
  if (dragState.type === 'track') {
    updateDraggedTrack(dragState.handle, x)
  } else {
    updateDraggedLamp(dragState.lampId, x)
  }
  updateLayoutVisuals()
}

function handlePointerUp(event: PointerEvent) {
  if (!dragState) return
  if (renderer?.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId)
  }
  dragState = null
  if (controls) controls.enabled = true
  saveActiveZoneLayout()
}

function updateDraggedTrack(handle: TrackHandle, x: number) {
  const minLength = 2.6
  const maxLeft = layoutState.track.endX - minLength
  const minRight = layoutState.track.startX + minLength
  if (handle === 'left') {
    layoutState.track.startX = clamp(x, -4, maxLeft)
  } else {
    layoutState.track.endX = clamp(x, minRight, 4)
  }
}

function updateDraggedLamp(lampId: string, x: number) {
  const lamp = layoutState.lamps.find(item => item.slotId === lampId)
  if (!lamp) return
  lamp.lampX = clamp(x, layoutState.track.startX, layoutState.track.endX)
}

function updatePointer(event: PointerEvent) {
  if (!renderer) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

let renderRunning = false

function renderLoop() {
  if (!renderRunning || !renderer || !scene || !camera) return
  animationFrame = requestAnimationFrame(renderLoop)
  controls?.update()
  renderer.render(scene, camera)
}

function startRenderLoop() {
  if (renderRunning) return
  renderRunning = true
  renderLoop()
}

function stopRenderLoop() {
  renderRunning = false
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopRenderLoop()
  } else if (props.active) {
    startRenderLoop()
  }
}

function handleResize() {
  const host = viewportRef.value
  if (!host || !renderer || !camera) return
  const width = host.clientWidth
  const height = host.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function setCameraViewMode(mode: CameraViewMode) {
  if (mode === cameraViewMode.value) return
  toggleCameraView()
}

function toggleCameraView() {
  if (dragState || !camera || !controls) return
  const nextMode: CameraViewMode = cameraViewMode.value === 'display' ? 'adjust' : 'display'
  cameraViewMode.value = nextMode
  animateCameraTo(cameraViewPresets[nextMode])
}

function animateCameraTo(preset: CameraViewPreset) {
  if (!camera || !controls) return
  if (cameraAnimationFrame) cancelAnimationFrame(cameraAnimationFrame)
  startRenderLoop()

  const startPosition = camera.position.clone()
  const startTarget = controls.target.clone()
  const endPosition = preset.position.clone()
  const endTarget = preset.target.clone()
  const startedAt = performance.now()
  const duration = 620

  const step = (now: number) => {
    if (!camera || !controls) return
    const progress = clamp((now - startedAt) / duration, 0, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.lerpVectors(startPosition, endPosition, eased)
    controls.target.lerpVectors(startTarget, endTarget, eased)
    controls.update()

    if (progress < 1) {
      cameraAnimationFrame = requestAnimationFrame(step)
    } else {
      cameraAnimationFrame = 0
      if (!props.active) stopRenderLoop()
    }
  }

  cameraAnimationFrame = requestAnimationFrame(step)
}
function cleanupThreeScene() {
  stopRenderLoop()
  if (cameraAnimationFrame) {
    cancelAnimationFrame(cameraAnimationFrame)
    cameraAnimationFrame = 0
  }
  renderer?.domElement.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  controls?.dispose()

  if (scene) {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose()
        disposeMaterial(object.material)
      }
    })
  }

  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }

  pickableObjects.length = 0
  lampObjects.clear()
  scene = null
  camera = null
  renderer = null
  controls = null
  railMesh = null
  railGrooveMesh = null
  railHighlightMesh = null
  railSupportMeshes.length = 0
  leftHandleMesh = null
  rightHandleMesh = null
  dragState = null
  cameraAnimationFrame = 0
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach(item => item.dispose())
  } else {
    material.dispose()
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
</script>

<style scoped>
.three-layout-shell {
  --workbench-blue: #2563eb;
  --workbench-blue-soft: rgba(37, 99, 235, 0.1);
  --workbench-gold: #c8a56c;
  --workbench-danger: #dc2626;
  --workbench-text: #0f172a;
  --workbench-muted: #64748b;
  --workbench-panel: rgba(255, 255, 255, 0.86);
  --workbench-border: rgba(148, 163, 184, 0.25);
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.three-viewport-wrap {
  position: relative;
  min-height: 430px;
  overflow: hidden;
  border: 1px solid var(--workbench-border);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(239, 246, 255, 0.92)),
    radial-gradient(circle at 30% 20%, rgba(96, 165, 250, 0.18), transparent 32%);
}

.workbench-glass {
  border: 1px solid var(--workbench-border);
  background: var(--workbench-panel);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.13);
  backdrop-filter: blur(16px) saturate(130%);
}

.scene-toolbar {
  position: absolute;
  z-index: 4;
  top: 14px;
  right: 14px;
  left: 14px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.zone-cluster,
.scene-edit-actions,
.view-mode-switch {
  pointer-events: auto;
}

.zone-cluster {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  padding: 5px;
}

.zone-cluster::after {
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--workbench-gold), transparent);
  content: '';
  opacity: 0.78;
}

.zone-switcher {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.zone-arrow-btn {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--workbench-blue-soft);
  color: #2563eb;
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.zone-current-label {
  display: flex;
  min-width: 116px;
  max-width: 154px;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  line-height: 1;
}

.zone-current-label strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--workbench-text);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-current-label span {
  color: var(--workbench-muted);
  font-size: 11px;
  font-weight: 700;
}

.scene-edit-actions {
  display: inline-flex;
  justify-self: end;
  align-items: center;
  gap: 6px;
  border-radius: 16px;
  padding: 5px;
}

.scene-slot-count {
  padding: 0 6px;
  color: var(--workbench-muted);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.toolbar-divider,
.context-divider {
  width: 1px;
  height: 20px;
  background: var(--workbench-border);
}

.slot-toolbar button {
  color: #2563eb;
}

.toolbar-action {
  min-height: 32px;
  border: 0;
  border-radius: 10px;
  padding: 0 10px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.primary-action-btn {
  background: var(--workbench-blue);
  color: #fff;
  box-shadow: 0 7px 16px rgba(37, 99, 235, 0.22);
}

.slot-toolbar .primary-action-btn {
  color: #fff;
}

.layout-action-btn {
  background: var(--workbench-blue-soft);
}

.view-mode-switch {
  display: inline-flex;
  gap: 3px;
  border-radius: 14px;
  padding: 4px;
}

.view-toggle-btn {
  color: #2563eb;
}

.view-mode-btn {
  min-width: 48px;
  min-height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--workbench-muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.view-mode-btn.is-active {
  background: var(--workbench-blue);
  color: #fff;
  box-shadow: 0 7px 16px rgba(37, 99, 235, 0.2);
}

.scene-overlay {
  position: absolute;
  z-index: 2;
  top: 78px;
  left: 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
  color: #fff1d6;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 12px rgba(48, 25, 9, 0.86);
}

.scene-overlay span {
  font-size: 13px;
  font-weight: 900;
}

.scene-overlay small {
  color: rgba(255, 241, 214, 0.78);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.scene-context-layer {
  position: absolute;
  z-index: 4;
  right: 14px;
  bottom: 14px;
  left: 14px;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.scene-context-bar {
  display: flex;
  max-width: min(680px, 100%);
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-radius: 18px;
  padding: 7px 8px 7px 12px;
  pointer-events: auto;
}

.selected-slot-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.selection-dot {
  width: 8px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--workbench-blue);
  box-shadow: 0 0 16px rgba(37, 99, 235, 0.48);
}

.selected-slot-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.selected-slot-copy strong {
  overflow: hidden;
  color: var(--workbench-text);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-slot-copy small {
  color: var(--workbench-muted);
  font-size: 11px;
  font-weight: 700;
}

.context-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.context-action {
  min-height: 34px;
  border: 0;
  border-radius: 10px;
  padding: 0 10px;
  background: var(--workbench-blue-soft);
  color: var(--workbench-blue);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.context-action.danger {
  background: rgba(220, 38, 38, 0.08);
  color: var(--workbench-danger);
}

.scene-empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-radius: 15px;
  padding: 8px 14px;
  color: var(--workbench-text);
}

.scene-empty-hint strong {
  font-size: 12px;
  font-weight: 800;
}

.scene-empty-hint small {
  color: var(--workbench-muted);
  font-size: 10px;
  font-weight: 700;
}

.zone-arrow-btn:hover:not(:disabled),
.layout-action-btn:hover:not(:disabled),
.context-action:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.18);
  transform: translateY(-1px);
}

.primary-action-btn:hover:not(:disabled),
.view-mode-btn.is-active:hover {
  transform: translateY(-1px);
}

.context-action.danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.14);
}

.zone-arrow-btn:disabled,
.toolbar-action:disabled,
.context-action:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.zone-arrow-btn:focus-visible,
.toolbar-action:focus-visible,
.view-mode-btn:focus-visible,
.context-action:focus-visible {
  outline: 2px solid var(--workbench-blue);
  outline-offset: 2px;
}

.three-layout-viewport {
  width: 100%;
  height: 430px;
  min-height: 430px;
}

.three-layout-viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.three-layout-viewport :deep(canvas:active) {
  cursor: grabbing;
}

:global(.app-container.night-mode .three-layout-shell) {
  --workbench-blue-soft: rgba(96, 165, 250, 0.15);
  --workbench-text: #f8fafc;
  --workbench-muted: #cbd5e1;
  --workbench-panel: rgba(15, 23, 42, 0.82);
  --workbench-border: rgba(148, 163, 184, 0.22);
}

:global(.app-container.night-mode .three-viewport-wrap) {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9)),
    radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.18), transparent 32%);
}

:global(.app-container.night-mode .workbench-glass) {
  box-shadow: 0 14px 32px rgba(2, 6, 23, 0.34);
}

:global(.app-container.night-mode .zone-arrow-btn) {
  background: #2563eb;
  color: #fff;
}

:global(.app-container.night-mode .layout-action-btn) {
  background: #2563eb;
  color: #fff;
}

:global(.app-container.night-mode .context-action) {
  background: #2563eb;
  color: #fff;
}

:global(.app-container.night-mode .context-action.danger) {
  background: #dc2626;
  color: #fff;
}

@media (max-width: 1180px) {
  .scene-toolbar {
    grid-template-columns: auto minmax(230px, 1fr) auto;
  }

  .scene-edit-actions {
    max-width: 100%;
    flex-wrap: wrap;
  }

  .scene-context-bar {
    width: min(620px, 100%);
  }
}

@media (max-width: 768px) {
  .three-viewport-wrap,
  .three-layout-viewport {
    min-height: 360px;
  }

  .three-layout-viewport {
    height: 360px;
  }

  .scene-toolbar {
    top: 10px;
    right: 10px;
    left: 10px;
    grid-template-areas:
      "zone view"
      "actions actions";
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .zone-cluster {
    grid-area: zone;
    min-width: 0;
    justify-self: stretch;
  }

  .zone-switcher {
    width: 100%;
    justify-content: space-between;
  }

  .zone-current-label {
    min-width: 0;
    max-width: 128px;
  }

  .view-mode-switch {
    grid-area: view;
  }

  .scene-edit-actions {
    grid-area: actions;
    width: 100%;
    box-sizing: border-box;
    justify-self: stretch;
    justify-content: flex-end;
  }

  .scene-slot-count {
    margin-right: auto;
  }

  .zone-arrow-btn,
  .view-mode-btn,
  .toolbar-action,
  .context-action {
    min-width: 44px;
    min-height: 44px;
  }

  .view-mode-btn {
    padding: 0 10px;
  }

  .scene-overlay {
    display: none;
  }

  .scene-context-layer {
    right: 10px;
    bottom: 10px;
    left: 10px;
  }

  .scene-context-bar {
    width: 100%;
    box-sizing: border-box;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
  }

  .selected-slot-summary {
    flex: 1 1 150px;
  }

  .context-actions {
    flex: 1 1 auto;
    justify-content: flex-end;
  }

  .scene-empty-hint {
    max-width: calc(100% - 20px);
    box-sizing: border-box;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zone-arrow-btn,
  .toolbar-action,
  .view-mode-btn,
  .context-action {
    transition: none;
  }
}
</style>





























