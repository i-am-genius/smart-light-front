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
              :title="zoneCount <= 1 ? '当前仅一个区域' : '上一个区域'"
              @click.stop="switchZone(-1)"
            >
              ‹
            </button>
            <div
              class="zone-current-label"
              :style="{ '--zone-name-length': activeZoneNameLength }"
            >
              <strong :title="activeZone.zoneName">{{ activeZone.zoneName }}</strong>
              <span>{{ activeZoneIndex + 1 }} / {{ zoneCount }}</span>
            </div>
            <button
              class="zone-arrow-btn"
              type="button"
              aria-label="下一个区域"
              :disabled="zoneCount <= 1"
              :title="zoneCount <= 1 ? '当前仅一个区域' : '下一个区域'"
              @click.stop="switchZone(1)"
            >
              ›
            </button>
          </div>
        </div>

        <div class="scene-edit-actions slot-toolbar workbench-glass">
          <span class="scene-slot-count">
            <span class="toolbar-label-full">{{ slotCountLabel }}</span>
            <span class="toolbar-label-compact">{{ layoutState.lamps.length }}</span>
          </span>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <button
            class="toolbar-action primary-action-btn"
            type="button"
            aria-label="添加灯位"
            title="添加灯位"
            @click.stop="addManualSlot"
          >
            <span aria-hidden="true">＋</span>
            <span class="toolbar-label-full">添加灯位</span>
          </button>
          <button
            class="toolbar-action layout-action-btn"
            type="button"
            aria-label="均匀排列"
            :disabled="layoutState.lamps.length <= 1"
            :title="layoutState.lamps.length <= 1 ? '至少两个灯位' : '均匀排列'"
            @click.stop="handleArrangeSlotsEvenly"
          >
            <span class="toolbar-label-full">均匀排列</span>
            <span class="toolbar-label-compact">均排</span>
          </button>
        </div>

        <div class="view-mode-switch workbench-glass" role="group" aria-label="场景视角">
          <button
            class="view-mode-btn view-toggle-btn"
            :class="{ 'is-active': cameraViewMode === 'display' }"
            type="button"
            aria-label="展示视角"
            title="展示视角"
            :aria-pressed="cameraViewMode === 'display'"
            @click.stop="setCameraViewMode('display')"
          >
            <span class="toolbar-label-full">展示</span>
            <span class="toolbar-label-compact">展</span>
          </button>
          <button
            class="view-mode-btn view-toggle-btn"
            :class="{ 'is-active': cameraViewMode === 'adjust' }"
            type="button"
            aria-label="调节视角"
            title="调节视角"
            :aria-pressed="cameraViewMode === 'adjust'"
            @click.stop="setCameraViewMode('adjust')"
          >
            <span class="toolbar-label-full">调节</span>
            <span class="toolbar-label-compact">调</span>
          </button>
        </div>
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
              :title="canMoveSelectedLeft ? '左移' : '已在最左'"
              @click.stop="moveSelectedSlot(-1)"
            >
              ← 左移
            </button>
            <button
              class="context-action"
              type="button"
              aria-label="灯位右移"
              :disabled="!canMoveSelectedRight"
              :title="canMoveSelectedRight ? '右移' : '已在最右'"
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

    <div class="zone-quick-manager" aria-label="快速管理分区">
      <div class="zone-quick-add">
        <input
          v-model="newZoneName"
          class="zone-name-input"
          type="text"
          maxlength="24"
          placeholder="新增分区"
          :disabled="zoneManagementPending"
          @keydown.enter.prevent="submitZoneAdd"
        >
        <button
          class="zone-manager-btn zone-add-btn"
          type="button"
          aria-label="新增分区"
          title="新增分区"
          :disabled="zoneAddDisabled"
          @click="submitZoneAdd"
        >
          ＋
        </button>
      </div>

      <span class="zone-manager-current" :title="activeZone.zoneName">
        {{ activeZone.zoneName }}
      </span>

      <div class="zone-manager-actions" role="group" aria-label="调整当前分区">
        <button
          class="zone-manager-btn"
          type="button"
          aria-label="分区前移"
          title="分区前移"
          :disabled="!canMoveActiveZoneLeft"
          @click="requestZoneMove(-1)"
        >
          ←
        </button>
        <button
          class="zone-manager-btn"
          type="button"
          aria-label="分区后移"
          title="分区后移"
          :disabled="!canMoveActiveZoneRight"
          @click="requestZoneMove(1)"
        >
          →
        </button>
        <button
          class="zone-manager-btn zone-delete-btn"
          type="button"
          aria-label="删除当前分区"
          :title="activeZoneDeleteTitle"
          :disabled="!canDeleteActiveZone"
          @click="requestActiveZoneDelete"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { DeviceItem, GarmentPart } from '../../types/device'
import { isCameraDevice, isLampDevice, normalizeDeviceType } from '../../utils/device'
import {
  ZONE_DEFINITION_STORAGE_KEY,
  ZONE_LAYOUT_STORAGE_KEY,
} from '../../utils/deviceZoneStorage'
import {
  UNASSIGNED_ZONE_NAME,
  normalizeZoneName,
  sortDevicesByNumber,
} from '../../utils/deviceZones'
import {
  clamp,
  colorTemperatureToHex,
  resolveDisplayedColorTemperature,
  resolveFiniteNumber,
} from '../../utils/helpers'
import {
  garmentSignature,
  getDisplayGarments,
} from '../../utils/garmentRecognition'
import { locateDevice } from '../../api/device'
import {
  createBoutiqueMaterialLibrary,
  loadBoutiqueTextures,
  type BoutiqueMaterialLibrary,
} from './threeBoutiqueMaterials'
import {
  createBoutiqueTextureLoadCoordinator,
  type BoutiqueTextureLoadCoordinator,
} from './threeBoutiqueTextureLoadCoordinator'
import {
  GARMENT_DISPLAY_METRICS,
  createGarmentDisplay,
  disposeGarmentDisplay,
  syncGarmentDisplayInScene,
} from './threeGarmentModels'
import { selectSpotShadowSlotIds } from './threeSpotShadowBudget'

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
  garments: GarmentPart[]
  garmentSignature: string
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

type ZoneMutationTarget = {
  zoneId: string
  zoneName: string
}

type ZoneMoveIntent = ZoneMutationTarget & {
  direction: -1 | 1
}

type DeviceNumberSwapIntent = {
  firstDeviceId: string | number
  secondDeviceId: string | number
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
  garmentDisplay: THREE.Group
}

const props = withDefaults(defineProps<{
  devices?: DeviceLike[]
  zones?: StoreZoneLike[]
  active?: boolean
  activeZoneId?: string
  zoneManagementPending?: boolean
}>(), {
  devices: () => [],
  active: true,
  zoneManagementPending: false,
})

const emit = defineEmits<{
  (event: 'selection-change', value: SelectionInfo): void
  (event: 'zone-add', name: string): void
  (event: 'zone-delete', target: ZoneMutationTarget): void
  (event: 'zone-move', intent: ZoneMoveIntent): void
  (event: 'update:activeZoneId', zoneId: string): void
  (event: 'swap-device-numbers', intent: DeviceNumberSwapIntent): void
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const cameraViewMode = ref<CameraViewMode>('display')
const activeZoneIndex = ref(0)
const selectedSlotId = ref('')
const locatingSlotId = ref('')
const newZoneName = ref('')

const zonesAreAuthoritative = computed(() => props.zones !== undefined)
const zoneOptions = computed(() => normalizeZones(props.zones))
const zoneCount = computed(() => zoneOptions.value.length)
const activeZone = computed(() => zoneOptions.value[activeZoneIndex.value] || createDefaultZoneOption())
const activeZoneNameLength = computed(() => Math.max(Array.from(activeZone.value.zoneName).length, 1))
const namedZoneOptions = computed(() => zoneOptions.value.filter(zone => zone.zoneName !== UNASSIGNED_ZONE_NAME))
const normalizedNewZoneName = computed(() => normalizeZoneName(newZoneName.value))
const zoneAddDisabled = computed(() => {
  if (props.zoneManagementPending) return true
  if (!newZoneName.value.trim() || normalizedNewZoneName.value === UNASSIGNED_ZONE_NAME) return true
  return zoneOptions.value.some(zone => normalizeZoneName(zone.zoneName) === normalizedNewZoneName.value)
})
const canDeleteActiveZone = computed(() =>
  !props.zoneManagementPending && activeZone.value.zoneName !== UNASSIGNED_ZONE_NAME,
)
const activeZoneDeleteTitle = computed(() =>
  activeZone.value.zoneName === UNASSIGNED_ZONE_NAME ? '未分区不可删除' : '删除当前分区',
)
const activeNamedZoneIndex = computed(() =>
  namedZoneOptions.value.findIndex(zone => zone.zoneId === activeZone.value.zoneId),
)
const canMoveActiveZoneLeft = computed(() =>
  !props.zoneManagementPending && activeNamedZoneIndex.value > 0,
)
const canMoveActiveZoneRight = computed(() =>
  !props.zoneManagementPending
  && activeNamedZoneIndex.value >= 0
  && activeNamedZoneIndex.value < namedZoneOptions.value.length - 1,
)
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
  { slotId: 'mock-1', order: 0, name: '新品展示区', lampX: -2.15, targetX: -2.15, brightness: 72, temperature: 3000, clothingColor: '#d45a48', garments: createMockUpperGarments('#d45a48'), garmentSignature: 'upper:upper' },
  { slotId: 'mock-2', order: 1, name: '主通道区', lampX: 0, targetX: 0, brightness: 88, temperature: 4000, clothingColor: '#8fb95a', garments: createMockUpperGarments('#8fb95a'), garmentSignature: 'upper:upper' },
  { slotId: 'mock-3', order: 2, name: '橱窗区', lampX: 2.05, targetX: 2.05, brightness: 56, temperature: 6000, clothingColor: '#4d86d9', garments: createMockUpperGarments('#4d86d9'), garmentSignature: 'upper:upper' },
]

function createMockUpperGarments(color: string): GarmentPart[] {
  return [{
    position: 'upper',
    category: 'upper',
    categoryConfidence: null,
    fabric: '',
    mainColorRgb: color,
    maskArea: 0,
  }]
}

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
let boutiqueMaterials: BoutiqueMaterialLibrary | null = null
let pmremGenerator: THREE.PMREMGenerator | null = null
let environmentRenderTarget: THREE.WebGLRenderTarget | null = null
let boutiqueTextureLoadCoordinator: BoutiqueTextureLoadCoordinator | null = null
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
let renderedZoneId = ''

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -layoutState.track.z)
const dragPoint = new THREE.Vector3()
const beamAxis = new THREE.Vector3(0, -1, 0)
const displayWallZ = -2.42
const garmentBaseY = GARMENT_DISPLAY_METRICS.baseY
const garmentAimY = 1.26
const wallLightSpotZ = displayWallZ + 0.065
const STORE_SCENE_SIGNATURE = 'boutique-clothing-store'

/** A slot is "visible" (renders a lamp model) unless it's a pure placeholder (no device link, not manual). */
function isSlotVisible(slot: { boundLampDeviceId?: string | number | ''; sourceDeviceId?: string | number; isManual?: boolean }) {
  if (slot.isManual) return true
  if (slot.boundLampDeviceId) return true
  if (slot.sourceDeviceId) return true
  return false
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
watch(() => props.active, async (isActive) => {
  if (isActive && !document.hidden) {
    await nextTick()
    if (!props.active || document.hidden) return
    handleResize()
    startRenderLoop()
  } else if (!isActive) {
    stopRenderLoop()
  }
})

watch(
  () => props.devices,
  () => {
    syncRequestedActiveZoneIndex(props.activeZoneId)
    syncActiveZoneLampCount()
    syncDevicesToLayout()
  },
  { deep: true, immediate: true },
)

watch(
  () => props.zones,
  () => {
    const renderedZoneStillExists = !renderedZoneId
      || zoneOptions.value.some(zone => zone.zoneId === renderedZoneId)
    syncRequestedActiveZoneIndex(props.activeZoneId)
    if (renderedZoneStillExists) saveActiveZoneLayout()
    rebuildActiveZoneLayout()
  },
  { deep: true, immediate: true },
)

watch(
  () => props.activeZoneId,
  (zoneId, previousZoneId) => {
    if (zoneId === undefined || zoneId === previousZoneId) return
    saveActiveZoneLayout()
    syncRequestedActiveZoneIndex(zoneId)
    if (renderedZoneId === activeZone.value.zoneId) return
    clearSelectedSlot()
    rebuildActiveZoneLayout()
    animateCameraTo(cameraViewPresets.display)
  },
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
  const hasAuthoritativeZones = inputZones !== undefined
  const storedZones = hasAuthoritativeZones ? inputZones : loadStoredZoneDefinitions()
  const source = storedZones.length > 0
    ? storedZones
    : hasAuthoritativeZones ? [] : createDeviceZoneDefinitions()
  const seenNames = new Set<string>()

  const zones = source.flatMap((zone, index) => {
    const zoneName = normalizeZoneName(zone.name)
    if (zoneName === UNASSIGNED_ZONE_NAME || seenNames.has(zoneName)) return []
    seenNames.add(zoneName)
    return [{
      zoneId: String(zone.id || `zone-${index + 1}`),
      zoneName,
    }]
  })

  return [...zones, createDefaultZoneOption()]
}

function createDeviceZoneDefinitions(): StoreZoneLike[] {
  const zoneNames: string[] = []
  const seen = new Set<string>()

  for (const device of props.devices || []) {
    if (!isLayoutLampDevice(device)) continue

    const zoneName = normalizeZoneName(device.displayName)
    if (zoneName === UNASSIGNED_ZONE_NAME) continue
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
    zoneId: 'unassigned-zone',
    zoneName: UNASSIGNED_ZONE_NAME,
  }
}

function syncRequestedActiveZoneIndex(controlledZoneId?: string) {
  if (controlledZoneId === undefined) {
    syncActiveZoneIndex()
    return
  }

  const count = zoneCount.value
  if (count <= 0) {
    activeZoneIndex.value = 0
    return
  }

  const previousZoneId = renderedZoneId || activeZone.value.zoneId
  const controlledIndex = zoneOptions.value.findIndex(zone => zone.zoneId === controlledZoneId)
  activeZoneIndex.value = controlledIndex >= 0
    ? controlledIndex
    : clamp(Math.floor(activeZoneIndex.value), 0, count - 1)
  if (activeZone.value.zoneId !== previousZoneId) clearSelectedSlot()
}

function syncActiveZoneIndex() {
  const previousZoneId = renderedZoneId || activeZone.value.zoneId
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
  } else {
    const previousIndex = zoneOptions.value.findIndex(zone => zone.zoneId === previousZoneId)
    if (previousIndex >= 0) {
      activeZoneIndex.value = previousIndex
    }
  }

  activeZoneIndex.value = clamp(Math.floor(activeZoneIndex.value), 0, count - 1)
  if (activeZone.value.zoneId !== previousZoneId) {
    clearSelectedSlot()
  }
}

function switchZone(direction: -1 | 1) {
  if (zoneCount.value <= 1 || dragState) return

  saveActiveZoneLayout()
  const nextIndex = (activeZoneIndex.value + direction + zoneCount.value) % zoneCount.value
  const nextZone = zoneOptions.value[nextIndex]
  emit('update:activeZoneId', nextZone.zoneId)
  if (props.activeZoneId !== undefined) return

  activeZoneIndex.value = nextIndex
  clearSelectedSlot()
  rebuildActiveZoneLayout()
  animateCameraTo(cameraViewPresets.display)
}

function submitZoneAdd() {
  if (zoneAddDisabled.value) return
  emit('zone-add', normalizedNewZoneName.value)
  newZoneName.value = ''
}

function requestActiveZoneDelete() {
  if (!canDeleteActiveZone.value) return
  emit('zone-delete', {
    zoneId: activeZone.value.zoneId,
    zoneName: activeZone.value.zoneName,
  })
}

function requestZoneMove(direction: -1 | 1) {
  const canMove = direction === -1 ? canMoveActiveZoneLeft.value : canMoveActiveZoneRight.value
  if (!canMove) return
  emit('zone-move', {
    zoneId: activeZone.value.zoneId,
    zoneName: activeZone.value.zoneName,
    direction,
  })
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
      garments: mock.garments.map(garment => ({ ...garment })),
      name: slot.isManual ? `${zone.zoneName} · 未绑定灯位` : `${zone.zoneName} · 灯具-${index + 1}`,
    }
  })
  renderedZoneId = zone.zoneId

  if (!layoutState.lamps.some(lamp => lamp.slotId === selectedSlotId.value)) {
    clearSelectedSlot()
  }

  saveActiveZoneLayout()
  syncLampObjectsWithState()
  syncDevicesToLayout()
  updateLayoutVisuals()
}

function buildZoneSlots(stored: StoredZoneLayout | undefined, zoneLampDevices: DeviceLike[]) {
  const storedSlots = normalizeStoredSlots(stored, zoneLampDevices)
    .sort((left, right) => left.order - right.order)
  const deviceSlots: ZoneSlot[] = []

  zoneLampDevices.forEach((device, index) => {
    const sourceDeviceId = getDeviceId(device)
    const slotId = `device-${sourceDeviceId || index + 1}`
    const fallbackX = getDefaultSlotX(index, Math.max(zoneLampDevices.length, 1))

    deviceSlots.push({
      slotId,
      order: index,
      lampX: fallbackX,
      targetX: fallbackX,
      boundLampDeviceId: '',
      sourceDeviceId,
      isManual: false,
    })
  })

  return mergeDeviceSlotsWithManualOrder(deviceSlots, storedSlots)
}

function mergeDeviceSlotsWithManualOrder(deviceSlots: ZoneSlot[], storedSlots: ZoneSlot[]) {
  const mergedSlots: ZoneSlot[] = []
  let deviceIndex = 0

  for (const storedSlot of storedSlots) {
    if (storedSlot.isManual) {
      mergedSlots.push(storedSlot)
      continue
    }

    const deviceSlot = deviceSlots[deviceIndex]
    if (!deviceSlot) continue
    mergedSlots.push(deviceSlot)
    deviceIndex += 1
  }

  mergedSlots.push(...deviceSlots.slice(deviceIndex))

  return mergedSlots.map((slot, index, slots) => {
    if (slot.isManual) return { ...slot, order: index }

    const fallbackX = getDefaultSlotX(index, slots.length)
    return {
      ...slot,
      order: index,
      lampX: fallbackX,
      targetX: fallbackX,
    }
  })
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
  const normalizedZoneName = normalizeZoneName(zoneName)

  const lamps = (props.devices || []).filter(isLayoutLampDevice)
  return sortDevicesByNumber(
    lamps.filter(device => normalizeZoneName(device.displayName) === normalizedZoneName),
  )
}

function getStoredLayouts() {
  try {
    const raw = localStorage.getItem(ZONE_LAYOUT_STORAGE_KEY)
    const defaultValue = { version: 1, activeZoneId: '', zoneLayouts: {} as Record<string, StoredZoneLayout> }
    if (!raw) return defaultValue
    const parsed = JSON.parse(raw)
    if (parsed?.version === 1 && parsed.zoneLayouts && typeof parsed.zoneLayouts === 'object') {
      return {
        version: 1,
        activeZoneId: String(parsed.activeZoneId || ''),
        zoneLayouts: parsed.zoneLayouts as Record<string, StoredZoneLayout>,
      }
    }
    return defaultValue
  } catch (error) {
    console.warn('3D 分区布局读取失败', error)
  }

  return { version: 1, activeZoneId: '', zoneLayouts: {} as Record<string, StoredZoneLayout> }
}

function getStoredZoneLayout(zoneId: string) {
  return getStoredLayouts().zoneLayouts[zoneId]
}

function saveActiveZoneLayout() {
  if (!renderedZoneId) return
  if (
    typeof zonesAreAuthoritative !== 'undefined'
    && zonesAreAuthoritative.value
    && !zoneOptions.value.some(zone => zone.zoneId === renderedZoneId)
  ) return

  const stored = getStoredLayouts()
  stored.activeZoneId = activeZone.value.zoneId
  stored.zoneLayouts[renderedZoneId] = {
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
}

function syncLampObjectsWithState() {
  if (!scene) return

  const disposedGeometries = new Set<THREE.BufferGeometry>()
  const disposedMaterials = new Set<THREE.Material>()
  for (const objects of lampObjects.values()) {
    scene.remove(objects.group, objects.spot, objects.spotTarget, objects.garmentDisplay, objects.beam)
    disposeLampObjects(objects, disposedGeometries, disposedMaterials)
  }
  lampObjects.clear()
  removeLampPickables()

  for (const lamp of layoutState.lamps) {
    if (!isSlotVisible(lamp)) continue
    const objects = createLampObjects(lamp)
    lampObjects.set(lamp.slotId, objects)
    scene.add(objects.group, objects.spot, objects.spotTarget, objects.garmentDisplay)
  }

  updateSpotShadowBudget()
}

function updateSpotShadowBudget() {
  const shadowIds = selectSpotShadowSlotIds(layoutState.lamps, selectedSlotId.value)
  for (const [slotId, objects] of lampObjects) {
    objects.spot.castShadow = shadowIds.has(slotId)
  }
}

function syncActiveZoneLampCount() {
  const hasActiveZoneChanged = renderedZoneId !== '' && renderedZoneId !== activeZone.value.zoneId
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
  const hasStaleDeviceSlot = existingDeviceSlotIds.some(slotId => !expectedSlotIds.has(slotId))
  const hasDeviceOrderChanged = deviceSlotIds.some(
    (slotId, index) => existingDeviceSlotIds[index] !== slotId,
  )

  if (!hasActiveZoneChanged && !hasNewDeviceSlot && !hasStaleDeviceSlot && !hasDeviceOrderChanged) return

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
    garments: mock.garments.map(garment => ({ ...garment })),
  })

  arrangeSlotsEvenly()
  selectSlot(slotId)
  syncLampObjectsWithState()
  updateLayoutVisuals()
  saveActiveZoneLayout()
}

function selectSlot(slotId: string) {
  selectedSlotId.value = slotId
  updateLayoutVisuals()
  updateSpotShadowBudget()
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
  updateSpotShadowBudget()
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

  applySlotOrderLayout()
  syncLampObjectsWithState()
  updateLayoutVisuals()
  saveActiveZoneLayout()
}

function moveSelectedSlot(direction: -1 | 1) {
  if (!selectedSlotId.value || !selectedSlot.value || props.zoneManagementPending) return

  const next = [...layoutState.lamps].sort((a, b) => a.order - b.order)
  const index = next.findIndex(slot => slot.slotId === selectedSlotId.value)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= layoutState.lamps.length) return

  const current = next[index]
  const target = next[targetIndex]
  if (isRealDeviceSlot(current) && isRealDeviceSlot(target)) {
    emit('swap-device-numbers', {
      firstDeviceId: current.deviceId ?? current.sourceDeviceId!,
      secondDeviceId: target.deviceId ?? target.sourceDeviceId!,
    })
    return
  }

  next[index] = next[targetIndex]
  next[targetIndex] = current
  layoutState.lamps = next
  applySlotOrderLayout()
}

function isRealDeviceSlot(slot: LampLayout) {
  return !slot.isManual && Boolean(slot.deviceId ?? slot.sourceDeviceId)
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
  updateSpotShadowBudget()
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

function disposeObject(
  object: THREE.Object3D,
  disposedGeometries = new Set<THREE.BufferGeometry>(),
  disposedMaterials = new Set<THREE.Material>(),
) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (!disposedGeometries.has(child.geometry)) {
        disposedGeometries.add(child.geometry)
        child.geometry.dispose()
      }
      disposeMaterial(child.material, disposedMaterials)
    }
  })
}

function disposeLampObjects(
  objects: LampObjects,
  disposedGeometries = new Set<THREE.BufferGeometry>(),
  disposedMaterials = new Set<THREE.Material>(),
) {
  disposeObject(objects.group, disposedGeometries, disposedMaterials)
  disposeGarmentDisplay(objects.garmentDisplay)
  disposeObject(objects.beam, disposedGeometries, disposedMaterials)
  objects.spot.dispose()
}

function initThreeScene() {
  const host = viewportRef.value
  if (!host) return

  scene = new THREE.Scene()
  scene.userData.signature = STORE_SCENE_SIGNATURE
  scene.background = new THREE.Color('#b7b1aa')
  scene.fog = new THREE.Fog('#b7b1aa', 7, 16)

  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100)
  camera.position.copy(cameraViewPresets.display.position)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(host.clientWidth, host.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)

  pmremGenerator = new THREE.PMREMGenerator(renderer)
  const roomEnvironment = new RoomEnvironment()
  environmentRenderTarget = pmremGenerator.fromScene(roomEnvironment, 0.04)
  roomEnvironment.dispose()
  scene.environment = environmentRenderTarget.texture
  scene.environmentIntensity = 0.25
  requireBoutiqueMaterials()

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

  startBoutiqueTextureLoad(renderer)

  renderer.domElement.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  if (props.active && !document.hidden) startRenderLoop()
}

function startBoutiqueTextureLoad(renderer: THREE.WebGLRenderer) {
  boutiqueTextureLoadCoordinator = createBoutiqueTextureLoadCoordinator({
    loader: () => loadBoutiqueTextures(renderer.capabilities.getMaxAnisotropy()),
    getLibrary: () => boutiqueMaterials,
    warn: error => console.warn('[three-boutique] texture loading failed', error),
  })
  void boutiqueTextureLoadCoordinator.start()
}

function createStoreSpace() {
  if (!scene) return

  createBoutiqueFloor()
  createClothingDisplayWall()
  createWarmRetailLighting()
}

function createBoutiqueFloor() {
  if (!scene || !boutiqueMaterials) return

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.1, 6.1),
    new THREE.MeshStandardMaterial({ color: '#4d3327', roughness: 0.72 }),
  )
  foundation.position.set(0, -0.07, 0.35)
  foundation.receiveShadow = true

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8.84, 6.02, 1, 1),
    boutiqueMaterials.floor,
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, -0.012, 0.35)
  floor.receiveShadow = true

  const rearThreshold = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.035, 0.08),
    boutiqueMaterials.darkMetal,
  )
  rearThreshold.position.set(0, 0.018, -2.65)
  rearThreshold.castShadow = true
  scene.add(foundation, floor, rearThreshold)
}

function createClothingDisplayWall() {
  if (!scene || !boutiqueMaterials) return

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 3.7, 0.12),
    boutiqueMaterials.wall,
  )
  wall.position.set(0, 1.85, displayWallZ - 0.07)
  wall.receiveShadow = true
  scene.add(wall)

  for (const x of [-4.45, 4.45]) {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 3.35, 5.7),
      boutiqueMaterials.wall,
    )
    sideWall.position.set(x, 1.675, 0.18)
    sideWall.receiveShadow = true
    scene.add(sideWall)
  }

  const ceilingReveal = new THREE.Mesh(
    new THREE.BoxGeometry(8.1, 0.11, 0.22),
    boutiqueMaterials.coveGlow,
  )
  ceilingReveal.position.set(0, 2.78, displayWallZ + 0.08)
  scene.add(ceilingReveal)

  for (const x of [-2.25, 0, 2.25]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 2.02, 0.045),
      boutiqueMaterials.wallInset,
    )
    panel.position.set(x, 1.5, displayWallZ + 0.035)
    panel.receiveShadow = true

    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.045, 0.055),
      boutiqueMaterials.champagneMetal,
    )
    topFrame.position.set(x, 2.53, displayWallZ + 0.074)
    topFrame.castShadow = true
    const bottomFrame = topFrame.clone()
    bottomFrame.position.y = 0.47

    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 2.105, 0.055),
      boutiqueMaterials.champagneMetal,
    )
    leftFrame.position.set(x - 0.91, 1.5, displayWallZ + 0.074)
    leftFrame.castShadow = true
    const rightFrame = leftFrame.clone()
    rightFrame.position.x = x + 0.91

    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 1.34, 20),
      boutiqueMaterials.darkMetal,
    )
    rail.position.set(x, GARMENT_DISPLAY_METRICS.railWorldY, displayWallZ + 0.14)
    rail.rotation.z = Math.PI / 2
    rail.castShadow = true

    const leftBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.1),
      boutiqueMaterials.darkMetal,
    )
    leftBracket.position.set(x - 0.67, 1.98, displayWallZ + 0.085)
    const rightBracket = leftBracket.clone()
    rightBracket.position.x = x + 0.67

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.18, 0.32),
      boutiqueMaterials.plinthWood,
    )
    plinth.position.set(x, 0.34, displayWallZ + 0.2)
    plinth.castShadow = true
    plinth.receiveShadow = true

    const plinthTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.018, 0.36),
      boutiqueMaterials.champagneMetal,
    )
    plinthTop.position.set(
      x,
      GARMENT_DISPLAY_METRICS.plinthTopWorldY - 0.018 / 2,
      displayWallZ + 0.2,
    )
    plinthTop.castShadow = true

    scene.add(
      panel,
      topFrame,
      bottomFrame,
      leftFrame,
      rightFrame,
      rail,
      leftBracket,
      rightBracket,
      plinth,
      plinthTop,
    )
  }
}

function createWarmRetailLighting() {
  if (!scene) return

  const ambient = new THREE.HemisphereLight('#fff8ec', '#5e4a3e', 0.58)
  const key = new THREE.DirectionalLight('#fff0d4', 0.46)
  key.position.set(-3.8, 4.8, 3.2)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -5
  key.shadow.camera.right = 5
  key.shadow.camera.top = 4
  key.shadow.camera.bottom = -1

  const neutralFill = new THREE.AmbientLight('#e7e4de', 0.42)
  neutralFill.castShadow = false
  scene.add(ambient, key, neutralFill)
}

function requireBoutiqueMaterials() {
  boutiqueMaterials ??= createBoutiqueMaterialLibrary()
  return boutiqueMaterials
}

function createOwnedGarmentMaterial(color: THREE.ColorRepresentation) {
  const materials = requireBoutiqueMaterials()
  const material = materials.createFabricMaterial(color)
  material.userData.releaseGarmentMaterial = () => materials.releaseMaterial(material)
  return material
}

function createTrack() {
  if (!scene) return
  const materials = requireBoutiqueMaterials()

  railMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.18), materials.darkMetal)
  railMesh.castShadow = true
  scene.add(railMesh)

  railGrooveMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.024, 0.19), materials.darkMetal)
  railGrooveMesh.castShadow = true
  scene.add(railGrooveMesh)

  railHighlightMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.014, 0.028), materials.champagneMetal)
  scene.add(railHighlightMesh)

  const supportMaterial = materials.darkMetal
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
    if (!isSlotVisible(lamp)) continue
    const objects = createLampObjects(lamp)
    lampObjects.set(lamp.slotId, objects)
    scene.add(objects.group, objects.spot, objects.spotTarget, objects.garmentDisplay)
  }
  updateSpotShadowBudget()
}

function createLampObjects(lamp: LampLayout): LampObjects {
  const materials = requireBoutiqueMaterials()
  const group = new THREE.Group()
  group.userData.dragType = 'lamp'
  group.userData.lampId = lamp.slotId

  const mountMaterial = materials.darkMetal
  const hingeMaterial = materials.darkMetal
  const darkMetalMaterial = materials.darkMetal
  const rimMaterial = materials.champagneMetal

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
    darkMetalMaterial,
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
  const rightArm = new THREE.Mesh(sideBracketGeometry.clone(), hingeMaterial)
  rightArm.position.set(0.285, -0.19, 0)

  const leftArmFoot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.07), hingeMaterial)
  leftArmFoot.position.set(-0.285, -0.365, 0)
  const rightArmFoot = leftArmFoot.clone()
  rightArmFoot.position.set(0.285, -0.365, 0)

  const hingeAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.52, 18),
    rimMaterial,
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

  const reflectorCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.19, 0.11, 40, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#f2d8a3',
      roughness: 0.12,
      metalness: 0.92,
      side: THREE.DoubleSide,
    }),
  )
  reflectorCup.position.set(0, -0.34, 0)
  reflectorCup.userData.ignorePickable = true

  const aperture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.018, 40),
    new THREE.MeshStandardMaterial({
      color: colorTemperatureToHex(lamp.temperature),
      emissive: colorTemperatureToHex(lamp.temperature),
      emissiveIntensity: 0.9,
    }),
  )
  aperture.position.set(0, -0.37, 0)

  const heatSink = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.21, 0.16, 40),
    new THREE.MeshStandardMaterial({ color: '#22211f', roughness: 0.36, metalness: 0.72 }),
  )
  heatSink.position.set(0, 0.17, 0)
  heatSink.userData.ignorePickable = true

  const heatSinkFinMaterial = materials.darkMetal
  for (let index = 0; index < 6; index += 1) {
    const heatSinkFin = new THREE.Mesh(
      new THREE.TorusGeometry(0.208, 0.008, 6, 40),
      heatSinkFinMaterial,
    )
    heatSinkFin.rotation.x = Math.PI / 2
    heatSinkFin.position.y = -0.06 + index * 0.024
    heatSinkFin.userData.ignorePickable = true
    heatSink.add(heatSinkFin)
  }

  const champagneRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.246, 0.018, 10, 40),
    rimMaterial,
  )
  champagneRing.rotation.x = Math.PI / 2
  champagneRing.position.set(0, -0.385, 0)
  champagneRing.userData.ignorePickable = true

  const lensMaterial = materials.opticalGlass.clone()
  const lensGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.187, 0.187, 0.022, 40),
    lensMaterial,
  )
  lensGlass.position.set(0, -0.388, 0)
  lensGlass.userData.ignorePickable = true

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

  const leftBodyPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 24), rimMaterial)
  leftBodyPivot.rotation.z = Math.PI / 2
  leftBodyPivot.position.set(-0.255, 0, 0)
  const rightBodyPivot = leftBodyPivot.clone()
  rightBodyPivot.position.set(0.255, 0, 0)

  pitchBody.add(
    barrel,
    rearCap,
    barrelRim,
    reflectorCup,
    heatSink,
    aperture,
    champagneRing,
    lensGlass,
    selectionRing,
    selectionMarker,
    leftBodyPivot,
    rightBodyPivot,
  )
  yokeFrame.add(neckBlock, yokeTopBlock, leftArm, rightArm, leftArmFoot, rightArmFoot, hingeAxle, leftPivot, rightPivot, pitchBody)
  yawGroup.add(yawDisk, yawDiskLower, yawIndicator, shortNeck, yokeFrame)
  group.add(mount, mountInset, yawGroup)
  markLampPickable(group, lamp.slotId)

  const target = new THREE.Object3D()
  const spot = new THREE.SpotLight(colorTemperatureToHex(lamp.temperature), 2.2, 6.5, Math.PI / 6, 0.42, 1.2)
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


  const garmentDisplay = createGarmentDisplay(
    lamp.garments,
    createOwnedGarmentMaterial,
  )
  return { group, body: group, head: pitchBody, yawGroup, yokeFrame, pitchBody, spot, spotTarget: target, beam, aperture, selectionRing, selectionMarker, garmentDisplay }
}
function createCameraNode() {
  if (!scene) return
  const materials = requireBoutiqueMaterials()

  const camGroup = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.22),
    materials.cameraShell,
  )
  const lensMaterial = materials.opticalGlass.clone()
  lensMaterial.color.set('#7aa7c7')
  lensMaterial.emissive = new THREE.Color('#1d4ed8')
  lensMaterial.emissiveIntensity = 0.08
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.09, 24),
    lensMaterial,
  )
  lens.position.set(0, 0, -0.155)
  lens.rotation.x = Math.PI / 2
  lens.userData.ignorePickable = true
  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12),
    materials.darkMetal,
  )
  bracket.position.set(0, 0.31, 0)
  const statusLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 12, 8),
    new THREE.MeshStandardMaterial({
      color: '#85b9a0',
      emissive: '#4ade80',
      emissiveIntensity: 0.18,
      roughness: 0.35,
    }),
  )
  statusLight.position.set(0.12, 0.055, -0.116)
  statusLight.userData.ignorePickable = true
  camGroup.add(body, lens, bracket, statusLight)
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
      lamp.garments = mock.garments.map(garment => ({ ...garment }))
      lamp.garmentSignature = mock.garmentSignature
      lamp.online = undefined
      return
    }

    lamp.deviceId = device.id ?? device.chipId
    lamp.chipId = device.chipId
    lamp.name = resolveDeviceName(device, mock.name)
    lamp.brightness = resolveDeviceBrightness(device, lamp.brightness || mock.brightness)
    lamp.temperature = resolveDeviceTemperature(device, lamp.temperature || mock.temperature)
    lamp.clothingColor = normalizeDeviceColor(resolveDeviceColorValue(device), lamp.clothingColor || mock.clothingColor)
    const garments = getDisplayGarments(device)
    lamp.garments = garments
    lamp.garmentSignature = garmentSignature(garments)
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

  updateSpotShadowBudget()
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
  return isLampDevice({ deviceType: normalizeLayoutDeviceType(device) })
}

function isLayoutCameraDevice(device: DeviceLike) {
  return isCameraDevice({ deviceType: normalizeLayoutDeviceType(device) })
}

function normalizeLayoutDeviceType(device: DeviceLike) {
  return normalizeDeviceType(String(device.deviceType ?? device.type ?? ''))
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
  return resolveDisplayedColorTemperature(
    device.temp,
    device.recommendedTemp,
    isTruthy(device.autoMode),
    fallback || 4000,
  )
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
  const garmentX = lamp.targetX

  objects.group.position.set(lamp.lampX, lampY, lampZ)
  syncGarmentDisplay(objects, lamp)
  objects.garmentDisplay.position.set(garmentX, garmentBaseY, wallLightSpotZ)

  const beamEnd = new THREE.Vector3(garmentX, garmentAimY, wallLightSpotZ + 0.02)
  objects.group.updateWorldMatrix(true, true)

  const beamStart = new THREE.Vector3()
  objects.aperture.getWorldPosition(beamStart)
  const beamDirection = beamEnd.clone().sub(beamStart)
  const normalizedDirection = beamDirection.clone().normalize()
  applyLampAim(objects, beamDirection)

  const color = new THREE.Color(colorTemperatureToHex(lamp.temperature))
  const intensity = 0.7 + lamp.brightness / 100 * 10.8
  const opacity = 0.04 + lamp.brightness / 100 * 0.12

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

function syncGarmentDisplay(objects: LampObjects, lamp: LampLayout) {
  if (!scene) return
  syncGarmentDisplayInScene(
    scene,
    objects,
    lamp.garments,
    lamp.garmentSignature,
    createOwnedGarmentMaterial,
  )
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
    handleResize()
    startRenderLoop()
  }
}

function handleResize() {
  const host = viewportRef.value
  if (!host || !renderer || !camera) return
  const width = host.clientWidth
  const height = host.clientHeight
  if (width <= 0 || height <= 0) return
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
  boutiqueTextureLoadCoordinator?.invalidate()
  boutiqueTextureLoadCoordinator = null
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

  const disposedGeometries = new Set<THREE.BufferGeometry>()
  const disposedMaterials = new Set<THREE.Material>()
  for (const objects of lampObjects.values()) {
    disposeLampObjects(objects, disposedGeometries, disposedMaterials)
  }
  if (scene) disposeObject(scene, disposedGeometries, disposedMaterials)

  boutiqueMaterials?.dispose()
  boutiqueMaterials = null
  environmentRenderTarget?.dispose()
  environmentRenderTarget = null
  pmremGenerator?.dispose()
  pmremGenerator = null

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

function disposeMaterial(
  material: THREE.Material | THREE.Material[],
  disposedMaterials = new Set<THREE.Material>(),
) {
  if (Array.isArray(material)) {
    material.forEach(item => disposeMaterial(item, disposedMaterials))
    return
  }

  if (disposedMaterials.has(material)) return
  disposedMaterials.add(material)
  if (boutiqueMaterials?.releaseMaterial(material)) return
  if (boutiqueMaterials?.ownsMaterial(material)) return
  material.dispose()
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  container-type: inline-size;
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.zone-quick-manager {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--workbench-border);
  padding: 5px 2px 0;
  color: var(--workbench-text);
}

.zone-quick-add,
.zone-manager-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zone-quick-add {
  min-width: 0;
}

.zone-name-input {
  width: 112px;
  height: 30px;
  box-sizing: border-box;
  border: 1px solid var(--workbench-border);
  border-radius: 6px;
  outline: none;
  padding: 0 8px;
  background: transparent;
  color: var(--workbench-text);
  font: inherit;
  font-size: 11px;
}

.zone-name-input:focus {
  border-color: var(--workbench-blue);
}

.zone-name-input::placeholder {
  color: var(--workbench-muted);
}

.zone-manager-current {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--workbench-muted);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-manager-btn {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: var(--workbench-blue-soft);
  color: var(--workbench-blue);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.zone-manager-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.18);
}

.zone-manager-btn:focus-visible,
.zone-name-input:focus-visible {
  outline: 2px solid var(--workbench-blue);
  outline-offset: 1px;
}

.zone-manager-btn:disabled,
.zone-name-input:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.zone-add-btn {
  background: var(--workbench-blue);
  color: #fff;
}

.zone-delete-btn {
  background: rgba(220, 38, 38, 0.08);
  color: var(--workbench-danger);
}

.three-viewport-wrap {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  min-width: 0;
  max-width: calc(100% - 28px);
  box-sizing: border-box;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.zone-cluster,
.scene-edit-actions,
.view-mode-switch {
  min-width: 0;
  pointer-events: none;
}

.zone-cluster button,
.scene-edit-actions button,
.view-mode-switch button,
.scene-context-bar button {
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
  width: 34px;
  height: 34px;
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

.toolbar-label-compact {
  display: none;
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
  min-height: 34px;
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
  pointer-events: none;
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
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 430px;
  min-height: 430px;
}

.three-layout-viewport :deep(canvas) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
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

:global(.app-container.night-mode .three-layout-shell .three-viewport-wrap) {
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9)),
    radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.18), transparent 32%);
}

:global(.app-container.night-mode .three-layout-shell .workbench-glass) {
  box-shadow: 0 14px 32px rgba(2, 6, 23, 0.34);
}

:global(.app-container.night-mode .three-layout-shell .zone-arrow-btn) {
  background: #2563eb;
  color: #fff;
}

:global(.app-container.night-mode .three-layout-shell .layout-action-btn) {
  background: #2563eb;
  color: #fff;
}

:global(.app-container.night-mode .three-layout-shell .context-action) {
  background: #2563eb;
  color: #fff;
}

:global(.app-container.night-mode .three-layout-shell .context-action.danger) {
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

@container (max-width: 620px) {
  .scene-toolbar {
    top: 8px;
    right: 8px;
    left: 8px;
    grid-template-areas: "zone actions view";
    grid-template-columns: 38% minmax(0, 1fr) auto;
    gap: 4px;
  }

  .zone-cluster {
    grid-area: zone;
    min-width: 0;
    justify-self: stretch;
    border-radius: 12px;
    padding: 3px;
  }

  .zone-switcher {
    width: 100%;
    justify-content: space-between;
    gap: 3px;
  }

  .zone-arrow-btn {
    width: 32px;
    height: 32px;
  }

  .zone-current-label {
    container-type: inline-size;
    min-width: 0;
    flex: 1;
    max-width: none;
  }

  .zone-current-label strong {
    overflow: hidden;
    font-size: clamp(10px, calc(96cqi / var(--zone-name-length)), 13px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .view-mode-switch {
    grid-area: view;
    gap: 2px;
    border-radius: 12px;
    padding: 3px;
  }

  .view-mode-btn {
    min-width: 32px;
    min-height: 32px;
    padding: 0;
  }

  .scene-edit-actions {
    grid-area: actions;
    width: auto;
    box-sizing: border-box;
    justify-self: end;
    flex-wrap: nowrap;
    gap: 3px;
    padding: 3px;
  }

  .scene-slot-count {
    margin-right: 0;
    padding: 0 3px;
  }

  .toolbar-action {
    min-height: 32px;
    padding: 0 6px;
  }

  .primary-action-btn {
    width: 32px;
    padding: 0;
  }

  .layout-action-btn {
    min-width: 40px;
    white-space: nowrap;
  }

  .toolbar-label-full {
    display: none;
  }

  .toolbar-divider {
    display: none;
  }

  .toolbar-label-compact {
    display: inline;
  }
}

@container (min-width: 22rem) and (max-width: 38.75rem) {
  .layout-action-btn .toolbar-label-full,
  .view-mode-btn .toolbar-label-full {
    display: inline;
  }

  .layout-action-btn .toolbar-label-compact,
  .view-mode-btn .toolbar-label-compact {
    display: none;
  }

  .layout-action-btn,
  .view-mode-switch .view-mode-btn {
    min-width: max-content;
    padding-right: 0.375rem;
    padding-left: 0.375rem;
  }
}

@media (max-width: 768px) {
  .three-viewport-wrap,
  .three-layout-viewport {
    min-height: 280px;
    aspect-ratio: 16 / 10;
  }

  .three-viewport-wrap {
    border-radius: 16px;
  }

  .three-layout-viewport {
    height: clamp(280px, 78vw, 360px);
  }

  .zone-arrow-btn,
  .view-mode-btn,
  .toolbar-action {
    min-width: 40px;
    min-height: 40px;
  }

  .primary-action-btn {
    width: 44px;
    min-width: 44px;
    min-height: 44px;
  }

  .context-action {
    min-width: 44px;
    min-height: 44px;
  }

  .view-mode-btn {
    padding: 0 10px;
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

  .zone-quick-manager {
    gap: 5px;
  }

  .zone-name-input {
    width: 92px;
  }

  .zone-manager-btn {
    width: 40px;
    height: 40px;
  }

  .zone-name-input {
    width: 72px;
    height: 40px;
  }
}

@container (max-width: 22rem) {
  .zone-switcher .zone-arrow-btn {
    width: 1.5rem;
    min-width: 1.5rem;
  }
}

@media (max-width: 480px) {
  .scene-toolbar {
    max-width: calc(100% - 16px);
    grid-template-columns: 38% minmax(0, 1fr) auto;
  }

  .toolbar-label-full {
    display: none;
  }

  .toolbar-label-compact {
    display: inline;
  }

  .layout-action-btn,
  .view-mode-switch .view-mode-btn {
    min-width: 40px;
    padding-right: 4px;
    padding-left: 4px;
  }

  .zone-switcher .zone-arrow-btn {
    width: 40px;
    min-width: 40px;
  }

  .primary-action-btn {
    width: 44px;
    min-width: 44px;
  }
}

@media (max-width: 380px) {
  .scene-toolbar {
    grid-template-areas:
      "zone zone view"
      "actions actions actions";
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  }

  .scene-edit-actions {
    justify-self: end;
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





























