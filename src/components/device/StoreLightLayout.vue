<template>
  <div class="layout-card">
    <div class="layout-header">
      <div>
        <h2>店铺灯具布局</h2>
        <p>拖动灯具进入分区，系统会自动生成分区内排序</p>
      </div>

      <div class="layout-actions">
        <button class="reset-layout-btn" @click="addZone">新增分区</button>
        <button class="reset-layout-btn" @click="resetLayout">重置布局</button>
        <button
          class="locate-btn"
          type="button"
          :disabled="!selectedDevice"
          @click.stop="handleLocateSelected"
        >
          {{ selectedDevice ? `定位：${getSelectedDeviceLabel(selectedDevice)}` : '先选择灯具' }}
        </button>
        <button class="save-layout-btn" :disabled="saving" @click="saveLayout">
          {{ saving ? '保存中...' : '保存分区排序' }}
        </button>
      </div>
    </div>

    <div ref="stageRef" class="store-stage">
      <img
        class="store-bg"
        src="/backgrounds/store-layout.png"
        alt="店铺布局"
        draggable="false"
      />

      <!-- 分区 -->
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="zone-box"
        :class="{ active: activeZoneId === zone.id }"
        :style="getZoneStyle(zone)"
        @pointerdown="handleZonePointerDown($event, zone)"
      >
        <input
          v-model.trim="zone.name"
          class="zone-name-input"
          @pointerdown.stop
          @input="saveZones"
        />

        <div class="zone-count">
          {{ getDevicesByZone(zone.name).length }} 盏灯
        </div>

        <button
          class="zone-delete-btn"
          type="button"
          title="删除分区"
          @pointerdown.stop
          @click.stop="deleteZone(zone)"
        > ×
        </button>
        <div
          class="zone-resize"
          @pointerdown.stop="handleZoneResize($event, zone)"
        ></div>
      </div>

      <!-- 灯具 -->
      <div
        v-for="(device, index) in layoutDevices"
        :key="device.id || device.chipId"
        class="lamp-node"
        :class="{
          active: draggingKey === getKey(device),
          selected: selectedDeviceId === device.id,
          offline: !device.online,
          'no-animate': zoneDragging,
        }"
        :style="getNodeStyle(device, index)"
        @pointerdown="handleLampPointerDown($event, device)"
      >
        <div class="lamp-icon">💡</div>

        <div class="lamp-info">
          <strong>{{ getLampTitle(device, index) }}</strong>
          <span>{{ getLampSubText(device) }}</span>
        </div>
        <div v-if="selectedDeviceId === device.id" class="selected-badge">
          已选中
        </div>
      </div>
    </div>

    <div class="layout-tips">
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="zone-order-row"
      >
        <strong>{{ zone.name }}</strong>
        <span
          v-for="device in getDevicesByZone(zone.name)"
          :key="device.id"
        >
          灯具-{{ getLocalDeviceNo(device) }} · {{ device.chipId }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { updateDevice, locateDevice } from '../../api/device'
import type { DeviceCreatePayload, DeviceItem } from '../../types/device'

const props = defineProps<{
  devices: DeviceItem[]
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

type Position = {
  x: number
  y: number
}

type Zone = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

type LocalDeviceState = {
  zoneName: string
  deviceNo: string
}

const stageRef = ref<HTMLElement | null>(null)
const positions = ref<Record<string, Position>>({})
const deviceState = ref<Record<number, LocalDeviceState>>({})
const zones = ref<Zone[]>([])
const draggingKey = ref('')
const activeZoneId = ref('')
const zoneDragging = ref(false)
const saving = ref(false)
const selectedDeviceId = ref<number | null>(null)

const selectedDevice = computed(() => {
  if (selectedDeviceId.value == null) return null
  return layoutDevices.value.find(device => device.id === selectedDeviceId.value) || null
})
const POSITION_STORAGE_KEY = 'SMART_LIGHT_LAYOUT_POSITIONS'
const ZONE_STORAGE_KEY = 'SMART_LIGHT_LAYOUT_ZONES'

function getKey(device: DeviceItem) {
  return String(device.id || device.chipId || device.deviceNo || '')
}

const layoutDevices = computed(() => props.devices || [])

function createId() {
  return `zone-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max)
}

function getSelectedDeviceLabel(device: DeviceItem) {
  const no = getLocalDeviceNo(device)
  const zoneName = deviceState.value[device.id]?.zoneName || '未分区'

  if (no) {
    return `${zoneName} · 灯具-${no}`
  }

  return `${zoneName} · ${device.chipId || '未知灯具'}`
}

async function handleLocateSelected() {
  if (!selectedDevice.value) {
    alert('请先点击或拖动选择一盏灯')
    return
  }

  await handleLocate(selectedDevice.value)
}

async function handleLocate(device: DeviceItem) {
  if (!device.chipId) return

  try {
    const ok = await locateDevice(device.chipId)

    if (!ok) {
      alert('设备离线，无法定位')
      return
    }
  } catch (error) {
    console.error('定位灯具失败 =', error)
    alert('设备离线或连接不可用，无法定位')
  }
}

function loadPositions() {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return
    positions.value = JSON.parse(raw)
  } catch (error) {
    console.warn('灯具布局读取失败', error)
  }
}

function syncDeviceStateByPosition() {
  for (const device of layoutDevices.value) {
    const key = getKey(device)
    const pos = positions.value[key]

    if (!pos) continue

    const zone = getZoneAtPosition(pos)

    if (zone) {
      deviceState.value[device.id] = {
        zoneName: zone.name,
        deviceNo: deviceState.value[device.id]?.deviceNo || '',
      }
    }
  }

  refreshAllZoneOrder()
}
function savePositions() {
  localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions.value))
}

function loadZones() {
  try {
    const raw = localStorage.getItem(ZONE_STORAGE_KEY)

    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        zones.value = parsed
        activeZoneId.value = zones.value[0].id
        return
      }
    }
  } catch (error) {
    console.warn('分区布局读取失败', error)
  }

  zones.value = [
    {
      id: createId(),
      name: '新品展示区',
      x: 4,
      y: 6,
      width: 44,
      height: 42,
    },
    {
      id: createId(),
      name: '主通道区',
      x: 52,
      y: 6,
      width: 42,
      height: 40,
    },
  ]

  activeZoneId.value = zones.value[0].id
  saveZones()
}

function saveZones() {
  localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(zones.value))
}

function initDeviceState() {
  const nextState: Record<number, LocalDeviceState> = {}

  for (const device of layoutDevices.value) {
    nextState[device.id] = {
      zoneName: device.displayName || '未分区',
      deviceNo: device.deviceNo || '',
    }
  }

  deviceState.value = nextState
}

let freeSpotScanY = 6
let freeSpotScanX = 4

function findFreeSpot(): { x: number; y: number } {
  const stepX = 10
  const stepY = 12
  const maxX = 80
  const maxY = 88

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const x = (freeSpotScanX + col * stepX) % maxX
      const y = (freeSpotScanY + row * stepY) % maxY
      const MARGIN = 6
      const inZone = zones.value.some(z =>
        x >= z.x - MARGIN && x <= z.x + z.width + MARGIN &&
        y >= z.y - MARGIN && y <= z.y + z.height + MARGIN,
      )
      if (!inZone) {
        freeSpotScanX = x + stepX
        freeSpotScanY = y
        if (freeSpotScanX > maxX) { freeSpotScanX = 4; freeSpotScanY += stepY }
        return { x, y }
      }
    }
  }

  freeSpotScanY = (freeSpotScanY + stepY) % maxY
  return { x: freeSpotScanX, y: freeSpotScanY }
}

function layoutZoneLamps(zoneName: string, devices?: DeviceItem[]) {
  const zone = zones.value.find(z => z.name === zoneName)
  if (!zone) return

  const list = devices ?? layoutDevices.value.filter(
    d => deviceState.value[d.id]?.zoneName === zoneName,
  )

  list.sort((a, b) => {
    const posA = positions.value[getKey(a)] || { x: 0, y: 0 }
    const posB = positions.value[getKey(b)] || { x: 0, y: 0 }
    if (Math.abs(posA.y - posB.y) > 5) return posA.y - posB.y
    return posA.x - posB.x
  })

  if (list.length === 0) return

  const stage = stageRef.value
  const stageW = stage ? stage.clientWidth : 700
  const stageH = stage ? stage.clientHeight : 400

  const cols = 1
  const rows = Math.ceil(list.length / cols)

  const LAMP_W_PX = stageW <= 500 ? 120 : 190
  const LAMP_H_PX = stageW <= 500 ? 48 : 56
  const NAME_H_PX = 44
  const GAP_PX = stageW <= 500 ? 6 : 10
  const BOTTOM_PAD_PX = stageW <= 500 ? 12 : 18

  const needWPx = cols * LAMP_W_PX + (cols + 1) * GAP_PX
  const needHPx = NAME_H_PX + rows * LAMP_H_PX + (rows + 1) * GAP_PX + BOTTOM_PAD_PX

  const needW = (needWPx / stageW) * 100
  const needH = (needHPx / stageH) * 100

  if (zone.width < needW) zone.width = Math.min(needW, 95 - zone.x)
  if (zone.height < needH) zone.height = Math.min(needH, 95 - zone.y)

  const lampAreaY = zone.y + (NAME_H_PX / stageH) * 100
  const lampAreaH = zone.height - (NAME_H_PX / stageH) * 100
  const cellW = zone.width / cols
  const cellH = lampAreaH / rows

  list.forEach((device, i) => {
    const key = getKey(device)
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.value[key] = {
      x: zone.x + cellW * (col + 0.5),
      y: lampAreaY + cellH * (row + 0.5),
    }
  })

  refreshZoneOrder(zoneName)
  saveZones()
  savePositions()
}

function initDefaultPositions() {
  const zoneGroups = new Map<string, DeviceItem[]>()
  const unzoned: DeviceItem[] = []

  for (const device of layoutDevices.value) {
    const zoneName = (device.displayName || '').trim()
    if (zoneName && zoneName !== '未分区' && zoneName !== '-') {
      if (!zoneGroups.has(zoneName)) zoneGroups.set(zoneName, [])
      zoneGroups.get(zoneName)!.push(device)
    } else {
      unzoned.push(device)
    }
  }

  for (const [zoneName, devices] of zoneGroups) {
    layoutZoneLamps(zoneName, devices)
  }

  unzoned.forEach((device) => {
    const key = getKey(device)
    if (positions.value[key]) return
    positions.value[key] = findFreeSpot()
  })

  savePositions()
}

function getZoneStyle(zone: Zone) {
  return {
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.width}%`,
    height: `${zone.height}%`,
  }
}

function getLampVisualVars(device: DeviceItem) {
  const brightnessValue = device.autoMode
    ? (device.recommendedBrightness ?? device.brightness ?? 0)
    : (device.brightness ?? 0)
  const brightnessNumber = Number(brightnessValue)
  const tempNumber = Number(device.autoMode ? (device.recommendedTemp ?? device.temp ?? 4000) : (device.temp ?? 4000))
  const brightness = Number.isFinite(brightnessNumber) ? clamp(brightnessNumber, 0, 100) : 0
  const temp = Number.isFinite(tempNumber) ? clamp(tempNumber, 2700, 6500) : 4000
  const [red, green, blue] = resolveColorTemperatureRgb(temp)
  const alpha = device.online ? Math.max(0.14, brightness / 100 * 0.45) : 0
  const glowSize = device.online ? Math.round(10 + brightness / 100 * 24) : 0

  return {
    '--lamp-glow-color': `rgba(${red}, ${green}, ${blue}, ${alpha})`,
    '--lamp-glow-size': `${glowSize}px`,
    '--lamp-icon-glow': `${Math.round(glowSize * 0.7)}px`,
    '--lamp-opacity': device.online ? '1' : '0.64',
    '--lamp-bulb-bg': `linear-gradient(135deg, rgba(${red}, ${green}, ${blue}, 0.96), rgba(255, 255, 255, 0.78))`,
  }
}

function resolveColorTemperatureRgb(temp: number): [number, number, number] {
  const stops: Array<[number, [number, number, number]]> = [
    [2700, [255, 183, 89]],
    [3500, [255, 214, 150]],
    [4500, [255, 244, 220]],
    [5500, [235, 243, 255]],
    [6500, [210, 228, 255]],
  ]

  for (let i = 0; i < stops.length - 1; i += 1) {
    const [fromTemp, fromColor] = stops[i]
    const [toTemp, toColor] = stops[i + 1]

    if (temp <= toTemp) {
      const ratio = (temp - fromTemp) / (toTemp - fromTemp)
      return [
        Math.round(fromColor[0] + (toColor[0] - fromColor[0]) * ratio),
        Math.round(fromColor[1] + (toColor[1] - fromColor[1]) * ratio),
        Math.round(fromColor[2] + (toColor[2] - fromColor[2]) * ratio),
      ]
    }
  }

  return stops[stops.length - 1][1]
}

function getNodeStyle(device: DeviceItem, index: number) {
  const key = getKey(device)
  if (positions.value[key]) {
    return {
      left: `${positions.value[key].x}%`,
      top: `${positions.value[key].y}%`,
      ...getLampVisualVars(device),
    }
  }

  const zoneName = (device.displayName || '').trim()
  if (zoneName && zoneName !== '未分区' && zoneName !== '-') {
    const zone = zones.value.find(z => z.name === zoneName)
    if (zone) {
      const zoneDevices = layoutDevices.value.filter(
        d => (d.displayName || '').trim() === zoneName && !positions.value[getKey(d)],
      )
      const zi = zoneDevices.indexOf(device)
      const nameH = 10
      const gap = 6
      return {
        left: `${zone.x + zone.width * 0.5}%`,
        top: `${zone.y + nameH + gap + zi * 12}%`,
        ...getLampVisualVars(device),
      }
    }
  }

  if (zoneDragging.value || draggingKey.value) {
    const unzonedList = layoutDevices.value.filter(
      d => !(d.displayName || '').trim() || (d.displayName || '').trim() === '未分区' || (d.displayName || '').trim() === '-',
    )
    const idx = unzonedList.indexOf(device)
    return {
      left: `${72}%`,
      top: `${6 + (idx >= 0 ? idx : index) * 12}%`,
      ...getLampVisualVars(device),
    }
  }
  const spot = findFreeSpot()
  positions.value[getKey(device)] = spot
  return { left: `${spot.x}%`, top: `${spot.y}%`, ...getLampVisualVars(device) }
}

function getLampTitle(device: DeviceItem, index: number) {
  const no = getLocalDeviceNo(device)
  return no ? `灯具-${no}` : `灯具${index + 1}`
}

function getLampSubText(device: DeviceItem) {
  const zoneName = deviceState.value[device.id]?.zoneName || '未分区'
  const online = device.online ? '在线' : '离线'
  return `${zoneName} · ${online}`
}

function getLocalDeviceNo(device: DeviceItem) {
  return deviceState.value[device.id]?.deviceNo || device.deviceNo || ''
}

function getZoneAtPosition(pos: Position) {
  return zones.value.find(zone => {
    return (
      pos.x >= zone.x &&
      pos.x <= zone.x + zone.width &&
      pos.y >= zone.y &&
      pos.y <= zone.y + zone.height
    )
  })
}

function isPositionInsideZone(pos: Position, zone: Zone) {
  return (
    pos.x >= zone.x &&
    pos.x <= zone.x + zone.width &&
    pos.y >= zone.y &&
    pos.y <= zone.y + zone.height
  )
}

function getDevicesInZone(zone: Zone) {
  return layoutDevices.value.filter(device => {
    const stateZoneName = deviceState.value[device.id]?.zoneName
    const key = getKey(device)
    const pos = positions.value[key]

    return stateZoneName === zone.name || (pos ? isPositionInsideZone(pos, zone) : false)
  })
}

function deleteZone(zone: Zone) {
  const confirmed = window.confirm(`确认删除分区「${zone.name}」吗？该分区内灯具会变为未分区。`)
  if (!confirmed) return

  const affectedDevices = getDevicesInZone(zone)

  affectedDevices.forEach(device => {
    deviceState.value[device.id] = {
      zoneName: '未分区',
      deviceNo: '',
    }
  })

  zones.value = zones.value.filter(item => item.id !== zone.id)

  if (activeZoneId.value === zone.id) {
    activeZoneId.value = zones.value[0]?.id || ''
  }

  saveZones()
  savePositions()
}

function getDevicesByZone(zoneName: string) {
  return [...layoutDevices.value]
    .filter(device => deviceState.value[device.id]?.zoneName === zoneName)
    .sort((a, b) => {
      const posA = positions.value[getKey(a)] || { x: 0, y: 0 }
      const posB = positions.value[getKey(b)] || { x: 0, y: 0 }

      if (Math.abs(posA.y - posB.y) > 5) {
        return posA.y - posB.y
      }

      return posA.x - posB.x
    })
}

function refreshZoneOrder(zoneName: string) {
  const list = getDevicesByZone(zoneName)

  list.forEach((device, index) => {
    deviceState.value[device.id] = {
      zoneName,
      deviceNo: String(index + 1),
    }
  })
}

function refreshAllZoneOrder() {
  for (const zone of zones.value) {
    refreshZoneOrder(zone.name)
  }
}

function addZone() {
  const index = zones.value.length + 1

  const zone: Zone = {
    id: createId(),
    name: `分区${index}`,
    x: 16 + ((index - 1) % 3) * 18,
    y: 16 + Math.floor((index - 1) / 3) * 18,
    width: 40,
    height: 36,
  }

  zones.value.push(zone)
  activeZoneId.value = zone.id
  saveZones()
}

function handleZonePointerDown(event: PointerEvent, zone: Zone) {
  const stage = stageRef.value
  if (!stage) return

  activeZoneId.value = zone.id
  zoneDragging.value = true

  const rect = stage.getBoundingClientRect()
  const startX = ((event.clientX - rect.left) / rect.width) * 100
  const startY = ((event.clientY - rect.top) / rect.height) * 100

  const offsetX = startX - zone.x
  const offsetY = startY - zone.y

  const originZoneX = zone.x
  const originZoneY = zone.y

  // 关键：记录分区内灯具的初始位置（仅按 deviceState 判断）
  const affectedDevices = getDevicesByZone(zone.name)
  const affectedStartPositions: Record<string, Position> = {}

  affectedDevices.forEach(device => {
    const key = getKey(device)
    const pos = positions.value[key]

    if (pos) {
      affectedStartPositions[key] = {
        x: pos.x,
        y: pos.y,
      }
    }
  })

  function move(moveEvent: PointerEvent) {
    const x = ((moveEvent.clientX - rect.left) / rect.width) * 100
    const y = ((moveEvent.clientY - rect.top) / rect.height) * 100

    const nextZoneX = clamp(x - offsetX, 0, 100 - zone.width)
    const nextZoneY = clamp(y - offsetY, 0, 100 - zone.height)

    const dx = nextZoneX - originZoneX
    const dy = nextZoneY - originZoneY

    zone.x = nextZoneX
    zone.y = nextZoneY

    Object.entries(affectedStartPositions).forEach(([key, pos]) => {
      positions.value[key] = {
        x: clamp(pos.x + dx, 5, 95),
        y: clamp(pos.y + dy, 8, 92),
      }
    })
  }

  function up() {
    zoneDragging.value = false
    refreshZoneOrder(zone.name)
    layoutZoneLamps(zone.name)
    repositionUnzoned()
    saveZones()
    savePositions()

    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function repositionUnzoned() {
  freeSpotScanX = 4
  freeSpotScanY = 6
  for (const device of layoutDevices.value) {
    const zoneName = (device.displayName || '').trim()
    if (zoneName && zoneName !== '未分区' && zoneName !== '-') continue
    const key = getKey(device)
    positions.value[key] = findFreeSpot()
  }
  savePositions()
}

function handleZoneResize(event: PointerEvent, zone: Zone) {
  event.preventDefault()

  const stage = stageRef.value
  if (!stage) return

  activeZoneId.value = zone.id

  const rect = stage.getBoundingClientRect()

  function move(moveEvent: PointerEvent) {
    const x = ((moveEvent.clientX - rect.left) / rect.width) * 100
    const y = ((moveEvent.clientY - rect.top) / rect.height) * 100

    zone.width = clamp(x - zone.x, 18, 100 - zone.x)
    zone.height = clamp(y - zone.y, 16, 100 - zone.y)
  }

  function up() {
    layoutZoneLamps(zone.name)
    repositionUnzoned()
    saveZones()

    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function handleLampPointerDown(event: PointerEvent, device: DeviceItem) {
   const stage = stageRef.value
  if (!stage) return

  selectedDeviceId.value = device.id

  const key = getKey(device)
  draggingKey.value = key

  const rect = stage.getBoundingClientRect()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)

  function move(moveEvent: PointerEvent) {
    const x = ((moveEvent.clientX - rect.left) / rect.width) * 100
    const y = ((moveEvent.clientY - rect.top) / rect.height) * 100

    positions.value[key] = {
      x: clamp(x, 5, 95),
      y: clamp(y, 8, 92),
    }
  }

  function up() {
    const pos = positions.value[key]
    const oldZoneName = deviceState.value[device.id]?.zoneName || ''

    if (pos) {
      const zone = getZoneAtPosition(pos)

      if (zone) {
        deviceState.value[device.id] = {
          zoneName: zone.name,
          deviceNo: deviceState.value[device.id]?.deviceNo || '',
        }

        layoutZoneLamps(zone.name)

        if (oldZoneName && oldZoneName !== zone.name) {
          layoutZoneLamps(oldZoneName)
        }
      } else {
        deviceState.value[device.id] = {
          zoneName: '未分区',
          deviceNo: '',
        }
        if (oldZoneName && oldZoneName !== '未分区') {
          layoutZoneLamps(oldZoneName)
        }
        positions.value[key] = findFreeSpot()
        savePositions()
      }
    }

    draggingKey.value = ''
    savePositions()

    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function resetLayout() {
  positions.value = {}
  zones.value = []

  localStorage.removeItem(POSITION_STORAGE_KEY)
  localStorage.removeItem(ZONE_STORAGE_KEY)

  loadZones()

  nextTick(() => {
    initDefaultPositions()
    initDeviceState()
  })
}


function buildUpdatePayload(
  device: DeviceItem,
  displayName: string,
  deviceNo: string,
): DeviceCreatePayload {
  return {
    chipId: device.chipId || '',
    ip: device.ip || '',
    displayName, // 这里就是分区名
    deviceType: device.deviceType || '',
    deviceNo, // 这里就是分区内编号
    brightness: device.brightness ?? 50,
    temp: device.temp ?? 4000,
    autoMode: device.autoMode ?? false,
    recommendedBrightness: device.recommendedBrightness ?? 50,
    recommendedTemp: device.recommendedTemp ?? 4000,
    fabric: device.fabric || '',
    mainColorRgb: device.mainColorRgb || '',
  }
}

async function saveLayout() {
  saving.value = true

  try {
    // 1. 保存前先根据灯具位置重新计算分区和排序
    syncDeviceStateByPosition()

    // 2. 关键：做快照，避免保存过程中被 watch / WebSocket 重置
    const stateSnapshot: Record<number, LocalDeviceState> = JSON.parse(
      JSON.stringify(deviceState.value)
    )

    const deviceSnapshot: DeviceItem[] = layoutDevices.value.map(device => ({
      ...device,
    }))

    for (const device of deviceSnapshot) {
      const state = stateSnapshot[device.id]
      if (!state) continue

      const nextDisplayName = state.zoneName || ''
      const nextDeviceNo = state.deviceNo || ''

      await updateDevice(
        device.id,
        buildUpdatePayload(device, nextDisplayName, nextDeviceNo),
      )
    }

    alert('分区排序已保存')
    emit('saved')
  } catch (error) {
    console.error('save layout error =', error)
    alert('保存分区排序失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.devices,
  () => {
    if (saving.value) return

    nextTick(() => {
      if (saving.value) return

      initDefaultPositions()
      initDeviceState()
    })
  },
  { deep: true },
)
onMounted(() => {
  loadPositions()
  loadZones()

  nextTick(() => {
    initDefaultPositions()
    initDeviceState()
  })
})
</script>

<style scoped>
.layout-card {
  margin:0;
  padding: 18px;
  border-radius: 24px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.14);
}

.layout-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.layout-header > div:first-child {
  flex: 1 1 200px;
  min-width: 0;
}

.layout-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 900;
  color: #111827;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.layout-header p {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.35;
}

.layout-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  flex: 0 1 auto;
}

.reset-layout-btn,
.save-layout-btn,
.locate-btn {
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  min-height: 40px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease,
    opacity 0.16s ease;
}

.reset-layout-btn:hover,
.save-layout-btn:hover,
.locate-btn:hover {
  transform: translateY(-1px);
}

.reset-layout-btn {
  background: rgba(64, 158, 255, 0.12);
  color: #2563eb;
}

.reset-layout-btn:hover {
  background: rgba(64, 158, 255, 0.2);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
}

.locate-btn {
  background: rgba(245, 158, 11, 0.18);
  color: #d97706;
}

.locate-btn:hover {
  background: rgba(245, 158, 11, 0.26);
  box-shadow: 0 8px 18px rgba(217, 119, 6, 0.14);
}

.locate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.save-layout-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.24);
}

.save-layout-btn:hover {
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.3);
}

.save-layout-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.zone-delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.14);
  color: #dc2626;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.zone-delete-btn:hover {
  background: rgba(239, 68, 68, 0.24);
  transform: scale(1.08);
}

.store-stage {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  height: clamp(360px, 44vh, 500px);
  min-height: 360px;
  overflow: hidden;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.9);
}


.store-bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(2px) brightness(0.72) saturate(0.9);
  transform: scale(1.02);
  user-select: none;
  pointer-events: none;
}

.zone-box {
  position: absolute;
  z-index: 2;
  padding: 12px;
  border-radius: 20px;
  background: rgba(37, 99, 235, 0.12);
  border: 2px solid rgba(37, 99, 235, 0.55);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 12px 32px rgba(15, 23, 42, 0.16);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.zone-box.active {
  background: rgba(37, 99, 235, 0.2);
  border-color: rgba(37, 99, 235, 0.95);
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, 0.16),
    0 18px 42px rgba(37, 99, 235, 0.2);
}

.zone-name-input {
  width: 140px;
  max-width: 90%;
  border: none;
  outline: none;
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
}

.zone-count {
  display: inline-flex;
  margin-top: 10px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}

.zone-resize {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 15px;
  height: 15px;
  border-right: 3px solid rgba(37, 99, 235, 0.6);
  border-bottom: 3px solid rgba(37, 99, 235, 0.6);
  cursor: nwse-resize;
}

.lamp-node {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, -50%);
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 13px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  border: 2px solid rgba(255, 255, 255, 0.95);
  opacity: var(--lamp-opacity, 1);
  box-shadow:
    0 0 var(--lamp-glow-size, 0) var(--lamp-glow-color, rgba(245, 158, 11, 0)),
    0 12px 30px rgba(15, 23, 42, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition:
    left 0.35s ease,
    top 0.35s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    opacity 0.18s ease;
}

.lamp-node.active {
  cursor: grabbing;
  transition:
    left 0s,
    top 0s,
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
  transform: translate(-50%, -50%) scale(1.08);
  background: #ffffff;
  border-color: rgba(245, 158, 11, 0.95);
  box-shadow:
    0 0 0 5px rgba(245, 158, 11, 0.22),
    0 20px 44px rgba(15, 23, 42, 0.34);
  z-index: 20;
}

.lamp-node.no-animate {
  transition:
    left 0s,
    top 0s,
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    opacity 0.18s ease;
}

.lamp-node.offline {
  border-color: rgba(148, 163, 184, 0.4);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.lamp-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--lamp-bulb-bg, linear-gradient(135deg, #fef3c7, #fde68a));
  color: #92400e;
  font-size: 18px;
  box-shadow:
    0 0 var(--lamp-icon-glow, 0) var(--lamp-glow-color, rgba(245, 158, 11, 0)),
    inset 0 0 0 1px rgba(245, 158, 11, 0.25);
  transition:
    background 0.24s ease,
    box-shadow 0.24s ease,
    filter 0.24s ease;
}

.lamp-node.offline .lamp-icon {
  filter: grayscale(0.85);
}

.lamp-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.lamp-info strong {
  font-size: 14px;
  color: #1f2937;
}

.lamp-info span {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.layout-tips {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-top: 12px;
  padding: 10px 4px;
  overflow-x: auto;
  font-size: 13px;
  color: #64748b;
}

.zone-order-row {
  display: flex;
  align-items: flex-start;
  flex: 0 0 auto;
  min-width: 220px;
  max-width: 360px;
  gap: 10px;
  padding: 0 18px;
  border-right: 1px solid rgba(203, 213, 225, 0.82);
}

.zone-order-row:first-child {
  padding-left: 0;
}

.zone-order-row:last-child {
  border-right: none;
}

.zone-order-row strong {
  flex: 0 0 auto;
  min-width: 80px;
  color: #1e293b;
  line-height: 1.35;
}

.zone-order-row span {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #475569;
  line-height: 1.35;
  white-space: nowrap;
}

.lamp-node.selected {
  border-color: rgba(37, 99, 235, 0.95);
  background: #ffffff;
  box-shadow:
    0 0 0 5px rgba(59, 130, 246, 0.2),
    0 18px 40px rgba(37, 99, 235, 0.3);
}

.selected-badge {
  position: absolute;
  top: -10px;
  right: -8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.28);
}

@media (max-width: 1200px) {
  .layout-header p {
    max-width: 100%;
  }

  .layout-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .reset-layout-btn,
  .save-layout-btn,
  .locate-btn {
    flex: 0 1 auto;
  }

  .locate-btn {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 768px) {
  .layout-card {
    padding: 12px 14px;
    border-radius: 16px;
  }

  .layout-header {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    margin-bottom: 8px;
  }

  .layout-header > div:first-child {
    flex: none;
  }

  .layout-header h2 {
    font-size: 15px;
    font-weight: 700;
  }

  .layout-header p {
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.3;
  }

  .layout-actions {
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
  }

  .reset-layout-btn,
  .save-layout-btn,
  .locate-btn {
    padding: 6px 9px;
    min-height: 28px;
    font-size: 10px;
  }

  .locate-btn {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .store-stage {
    height: 240px;
    min-height: 200px;
    border-radius: 14px;
  }

  .layout-tips {
    padding: 6px 0;
    margin-top: 8px;
    font-size: 11px;
  }

  .zone-order-row {
    min-width: 150px;
    padding: 0 8px;
  }

  .zone-order-row strong {
    min-width: 60px;
    font-size: 11px;
  }

  .zone-order-row span {
    font-size: 11px;
  }

  .lamp-node {
    min-width: 78px;
    padding: 5px 7px;
    gap: 4px;
  }

  .lamp-icon {
    width: 22px;
    height: 22px;
    flex-basis: 22px;
    font-size: 11px;
  }

  .lamp-info strong {
    font-size: 10px;
  }

  .lamp-info span {
    display: block;
    font-size: 8px;
    margin-top: 1px;
  }

  .zone-name-input {
    width: 80px;
    padding: 5px 8px;
    font-size: 11px;
  }

  .zone-count {
    margin-top: 6px;
    padding: 3px 7px;
    font-size: 10px;
  }

  .zone-box {
    padding: 8px;
    border-radius: 14px;
  }

  .zone-delete-btn {
    width: 20px;
    height: 20px;
    font-size: 15px;
    top: 4px;
    right: 4px;
  }

  .zone-resize {
    width: 12px;
    height: 12px;
    right: 4px;
    bottom: 4px;
  }
}

:global(.app-container.night-mode) .layout-card {
  background: rgba(15, 23, 42, 0.82);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.app-container.night-mode) .layout-header h2,
:global(.app-container.night-mode) .lamp-info strong,
:global(.app-container.night-mode) .zone-order-row strong {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .layout-header p,
:global(.app-container.night-mode) .layout-tips,
:global(.app-container.night-mode) .lamp-info span,
:global(.app-container.night-mode) .zone-order-row span {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .store-stage {
  background: rgba(2, 6, 23, 0.78);
  border-color: rgba(148, 163, 184, 0.22);
}

:global(.app-container.night-mode) .store-bg {
  filter: blur(2px) brightness(0.58) saturate(0.82);
}

:global(.app-container.night-mode) .reset-layout-btn,
:global(.app-container.night-mode) .zone-order-row span {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .zone-order-row {
  border-right-color: rgba(148, 163, 184, 0.24);
}

:global(.app-container.night-mode) .zone-order-row span {
  background: transparent;
  border: none;
}

:global(.app-container.night-mode) .locate-btn {
  background: rgba(120, 53, 15, 0.26);
  color: #fde68a;
}

:global(.app-container.night-mode) .zone-box {
  background: rgba(37, 99, 235, 0.2);
  border-color: rgba(96, 165, 250, 0.72);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36);
}

:global(.app-container.night-mode) .zone-name-input,
:global(.app-container.night-mode) .zone-count,
:global(.app-container.night-mode) .lamp-node {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(148, 163, 184, 0.3);
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .lamp-node.active,
:global(.app-container.night-mode) .lamp-node.selected {
  background: rgba(15, 23, 42, 0.94);
  border-color: rgba(251, 191, 36, 0.92);
  box-shadow:
    0 0 0 5px rgba(251, 191, 36, 0.18),
    0 18px 44px rgba(0, 0, 0, 0.46);
}

</style>
