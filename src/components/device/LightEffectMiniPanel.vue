<template>
  <div class="light-effect-mini-card">
    <div class="mini-header">
      <div>
        <div class="mini-title">灯效控制</div>
        <div class="mini-subtitle">按区域快速调整灯光效果</div>
      </div>
    </div>

    <div class="scope-field">
      <span class="mini-label">范围</span>
      <BaseSelect
        v-model="selectedScope"
        :options="scopeOptions"
        placeholder="请选择范围"
      />
    </div>

    <div class="effect-action-grid">
      <button
        v-for="action in quickActions"
        :key="action.key"
        class="effect-action-btn"
        :class="[`effect-${action.key}`, { active: activeEffect === action.key }]"
        type="button"
        :disabled="submitting || targetDevices.length === 0"
        @click="handleQuickAction(action.key)"
      >
        <strong>{{ action.label }}</strong>
        <span>{{ action.desc }}</span>
      </button>
    </div>

    <div class="effect-brightness-control">
      <div class="effect-brightness-header">
        <span class="mini-label">灯效亮度</span>
        <strong :class="{ 'brightness-active': effectBrightnessInteracting }">{{ effectBrightness }}%</strong>
      </div>
      <input
        class="effect-brightness-slider"
        type="range"
        min="0"
        max="100"
        :value="effectBrightness"
        @input="handleEffectBrightnessInput"
      />
      <p class="effect-brightness-hint">{{ effectBrightnessHint }}</p>
    </div>

    <div class="mini-status">
      {{ statusText }}
    </div>

    <Teleport to="body">
      <div
        v-if="showSettings"
        class="effect-modal-overlay"
        :class="{ 'effect-modal-night': isNightMode() }"
        @click.self="closeSettings"
      >
        <div class="effect-modal-card">
          <div class="effect-modal-header">
            <div>
              <h3>循环设置</h3>
              <p>调整当前范围内灯具的流水参数</p>
            </div>
            <button class="modal-close-btn" type="button" @click="closeSettings">关闭</button>
          </div>

          <div class="effect-form">
            <div class="form-field temp-range-field">
              <div class="temp-range-header">
                <span class="mini-label">色温范围</span>
                <strong class="temp-range-value">{{ minTemp }}K - {{ maxTemp }}K</strong>
              </div>
              <div
                class="dual-temp-slider"
                :class="{
                  'dragging-min': activeTempHandle === 'min',
                  'dragging-max': activeTempHandle === 'max',
                }"
              >
                <div class="dual-temp-track"></div>
                <div class="dual-temp-selected" :style="tempRangeStyle"></div>
                <input
                  class="dual-temp-input dual-temp-min"
                  type="range"
                  :min="TEMP_MIN"
                  :max="TEMP_MAX"
                  :step="100"
                  :value="minTemp"
                  @pointerdown="setActiveTempHandle('min')"
                  @input="handleMinTempInput"
                />
                <input
                  class="dual-temp-input dual-temp-max"
                  type="range"
                  :min="TEMP_MIN"
                  :max="TEMP_MAX"
                  :step="100"
                  :value="maxTemp"
                  @pointerdown="setActiveTempHandle('max')"
                  @input="handleMaxTempInput"
                />
              </div>
            </div>
            <label class="form-field">
              <span class="mini-label">基础色温</span>
              <input
                v-model.number="baseTemp"
                class="mini-input"
                type="number"
                min="2700"
                max="6500"
              />
            </label>

            <label class="form-field">
              <span class="mini-label">波动范围</span>
              <input
                v-model.number="range"
                class="mini-input"
                type="number"
                min="0"
                max="1900"
              />
            </label>

            <label class="form-field">
              <span class="mini-label">亮度</span>
              <input
                v-model.number="brightness"
                class="mini-input"
                type="number"
                min="0"
                max="100"
              />
            </label>

            <label class="form-field">
              <div class="effect-brightness-header">
                <span class="mini-label">速度</span>
                <strong>{{ speed.toFixed(1) }}</strong>
              </div>
              <input
                v-model.number="speed"
                class="effect-brightness-slider"
                type="range"
                min="0.2"
                max="5"
                step="0.1"
              />
            </label>

            <label class="form-field">
              <span class="mini-label">相位间隔</span>
              <input
                v-model.number="phaseGap"
                class="mini-input"
                type="number"
                min="0"
                max="3"
                step="0.1"
              />
            </label>
          </div>

          <div class="effect-modal-actions">
            <button class="modal-btn secondary" type="button" @click="saveSettings">
              保存设置
            </button>
            <button
              class="modal-btn primary"
              type="button"
              :disabled="submitting || targetDevices.length === 0"
              @click="startWave"
            >
              开启循环
            </button>
            <button
              class="modal-btn danger"
              type="button"
              :disabled="submitting || targetDevices.length === 0"
              @click="stopWave"
            >
              停止循环
            </button>
            <button class="modal-btn ghost" type="button" @click="closeSettings">
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { updateDevice } from '../../api/device'
import {
  closeLightEffectState,
  getLightEffectState,
  saveLightEffectState,
  type LightEffectState,
} from '../../api/lightEffect'
import type { DeviceCreatePayload, DeviceItem } from '../../types/device'
import { getErrorMessage } from '../../utils/error'
import BaseSelect from '../common/BaseSelect.vue'

const props = defineProps<{
  devices: DeviceItem[]
  serverState?: LightEffectState | null
}>()

type ActiveEffect = 'warm' | 'neutral' | 'cool' | 'auto' | 'loop' | null
type QuickActionKey = NonNullable<ActiveEffect> | 'settings'

const selectedScope = ref('all')
const baseTemp = ref(4600)
const range = ref(1900)
const brightness = ref(70)
const effectBrightness = ref(70)
const minTemp = ref(2700)
const maxTemp = ref(6500)
const speed = ref(1)
const phaseIndex = ref(0)
const phaseGap = ref(0.8)
const submitting = ref(false)
const showSettings = ref(false)
const activeEffect = ref<ActiveEffect>(null)
const statusText = ref('未启动')
const effectBrightnessInteracting = ref(false)
const applyingServerState = ref(false)
const activeTempHandle = ref<'min' | 'max' | null>(null)

const EFFECT_BRIGHTNESS_PRESET_KEY = 'smartlight_effect_brightness_preset'
const EFFECT_BRIGHTNESS_DEBOUNCE_MS = 300
const TEMP_MIN = 2700
const TEMP_MAX = 6500
const TEMP_GAP_MIN = 500

let brightnessTimer: number | undefined
let brightnessInteractionTimer: number | undefined
let scopeTimer: number | undefined
let tempHandleTimer: number | undefined

interface EffectBrightnessPresetStore {
  global?: number
  scopes?: Record<string, number>
}

const quickActions: Array<{ key: QuickActionKey; label: string; desc: string }> = [
  { key: 'warm', label: '暖光', desc: '3000K' },
  { key: 'neutral', label: '中性白', desc: '4000K' },
  { key: 'cool', label: '冷白', desc: '6000K' },
  { key: 'auto', label: '自动模式', desc: '智能调节' },
  { key: 'loop', label: '循环效果', desc: '动态流光' },
  { key: 'settings', label: '循环设置', desc: '参数配置' },
]

const zoneNames = computed(() => {
  const set = new Set<string>()

  for (const device of props.devices || []) {
    set.add(getZoneName(device))
  }

  return Array.from(set)
})

const scopeOptions = computed(() => {
  return [
    {
      label: '全局',
      value: 'all',
    },
    ...zoneNames.value.map(zone => ({
      label: zone,
      value: zone,
    })),
  ]
})

const targetDevices = computed(() => {
  const list = props.devices || []

  if (selectedScope.value === 'all') {
    return [...list].sort((a, b) => {
      const zoneA = getZoneName(a)
      const zoneB = getZoneName(b)
      const zoneCompare = zoneA.localeCompare(zoneB, 'zh-Hans-CN')
      if (zoneCompare !== 0) return zoneCompare

      return Number(a.deviceNo || 9999) - Number(b.deviceNo || 9999)
    })
  }

  return list
    .filter(device => getZoneName(device) === selectedScope.value)
    .sort((a, b) => Number(a.deviceNo || 9999) - Number(b.deviceNo || 9999))
})

const effectBrightnessHint = computed(() => {
  if (activeEffect.value && targetDevices.value.length === 0) {
    return '当前范围暂无可同步灯具，亮度会先保存为预设'
  }
  if (activeEffect.value) {
    return '拖动后将同步当前灯效范围内灯具亮度'
  }
  return '当前为灯效预设亮度，下次开启灯效时生效'
})

const tempRangeStyle = computed(() => {
  const left = ((minTemp.value - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100
  const right = ((maxTemp.value - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100
  return {
    left: `${left}%`,
    width: `${Math.max(right - left, 0)}%`,
  }
})

function getZoneName(device: DeviceItem) {
  return device.displayName?.trim() || '未分区'
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max)
}

function syncWaveBaseFromTempRange() {
  baseTemp.value = Math.round((minTemp.value + maxTemp.value) / 2)
  range.value = Math.round((maxTemp.value - minTemp.value) / 2)
}

function setTempRangeFromBaseAndRange(nextBaseTemp: number, nextRange: number) {
  const base = clamp(Math.round(nextBaseTemp), TEMP_MIN, TEMP_MAX)
  const waveRange = Math.max(0, Math.round(nextRange))
  let nextMin = clamp(base - waveRange, TEMP_MIN, TEMP_MAX)
  let nextMax = clamp(base + waveRange, TEMP_MIN, TEMP_MAX)

  if (nextMax - nextMin < TEMP_GAP_MIN) {
    nextMin = Math.round(base - TEMP_GAP_MIN / 2)
    nextMax = nextMin + TEMP_GAP_MIN

    if (nextMin < TEMP_MIN) {
      nextMin = TEMP_MIN
      nextMax = TEMP_MIN + TEMP_GAP_MIN
    }
    if (nextMax > TEMP_MAX) {
      nextMax = TEMP_MAX
      nextMin = TEMP_MAX - TEMP_GAP_MIN
    }
  }

  minTemp.value = clamp(nextMin, TEMP_MIN, TEMP_MAX - TEMP_GAP_MIN)
  maxTemp.value = clamp(nextMax, TEMP_MIN + TEMP_GAP_MIN, TEMP_MAX)
  syncWaveBaseFromTempRange()
}

function setActiveTempHandle(handle: 'min' | 'max') {
  activeTempHandle.value = handle
  if (tempHandleTimer) {
    window.clearTimeout(tempHandleTimer)
  }
}

function scheduleClearActiveTempHandle() {
  if (tempHandleTimer) {
    window.clearTimeout(tempHandleTimer)
  }
  tempHandleTimer = window.setTimeout(() => {
    activeTempHandle.value = null
  }, 160)
}

function handleMinTempInput(event: Event) {
  setActiveTempHandle('min')
  const target = event.target as HTMLInputElement
  const currentMin = minTemp.value
  const rawMin = clamp(Number(target.value), TEMP_MIN, TEMP_MAX)
  let nextMin = clamp(rawMin, TEMP_MIN, TEMP_MAX - TEMP_GAP_MIN)
  let nextMax = maxTemp.value

  if (nextMin > nextMax - TEMP_GAP_MIN) {
    const boundaryMin = nextMax - TEMP_GAP_MIN
    const delta = nextMin - boundaryMin
    if (nextMax + delta <= TEMP_MAX) {
      nextMax += delta
    } else {
      nextMax = TEMP_MAX
      nextMin = TEMP_MAX - TEMP_GAP_MIN
    }
  }

  minTemp.value = Math.round(nextMin)
  maxTemp.value = Math.round(nextMax)
  target.value = String(minTemp.value)
  if (minTemp.value === currentMin && rawMin < currentMin) {
    target.value = String(currentMin)
  }
  syncWaveBaseFromTempRange()
  scheduleClearActiveTempHandle()
}

function handleMaxTempInput(event: Event) {
  setActiveTempHandle('max')
  const target = event.target as HTMLInputElement
  const currentMax = maxTemp.value
  const rawMax = clamp(Number(target.value), TEMP_MIN, TEMP_MAX)
  let nextMax = clamp(rawMax, TEMP_MIN + TEMP_GAP_MIN, TEMP_MAX)
  let nextMin = minTemp.value

  if (nextMax < nextMin + TEMP_GAP_MIN) {
    const boundaryMax = nextMin + TEMP_GAP_MIN
    const delta = boundaryMax - nextMax
    if (nextMin - delta >= TEMP_MIN) {
      nextMin -= delta
    } else {
      nextMin = TEMP_MIN
      nextMax = TEMP_MIN + TEMP_GAP_MIN
    }
  }

  minTemp.value = Math.round(nextMin)
  maxTemp.value = Math.round(nextMax)
  target.value = String(maxTemp.value)
  if (maxTemp.value === currentMax && rawMax > currentMax) {
    target.value = String(currentMax)
  }
  syncWaveBaseFromTempRange()
  scheduleClearActiveTempHandle()
}

function normalizeBrightness(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return clamp(Math.round(value), 0, 100)
}

function readEffectBrightnessPresetStore(): EffectBrightnessPresetStore {
  try {
    const raw = localStorage.getItem(EFFECT_BRIGHTNESS_PRESET_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as EffectBrightnessPresetStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getEffectBrightnessPreset(scope = selectedScope.value): number | undefined {
  const store = readEffectBrightnessPresetStore()
  const globalValue = normalizeBrightness(store.global)

  if (scope === 'all') {
    return globalValue
  }

  const scopeValue = normalizeBrightness(store.scopes?.[scope])
  return scopeValue ?? globalValue
}

function saveEffectBrightnessPreset(value: number, scope = selectedScope.value) {
  const nextValue = clamp(Math.round(value), 0, 100)
  const store = readEffectBrightnessPresetStore()

  if (scope === 'all') {
    store.global = nextValue
  } else {
    store.scopes = {
      ...(store.scopes || {}),
      [scope]: nextValue,
    }
  }

  localStorage.setItem(EFFECT_BRIGHTNESS_PRESET_KEY, JSON.stringify(store))
}

function resolveEffectBrightness() {
  return getEffectBrightnessPreset()
    ?? normalizeBrightness(targetDevices.value[0]?.brightness)
    ?? 70
}

function syncEffectBrightnessFromScope() {
  const nextValue = resolveEffectBrightness()
  effectBrightness.value = nextValue
  brightness.value = nextValue
}

function prepareEffectBrightnessForEffect() {
  const nextValue = resolveEffectBrightness()
  effectBrightness.value = nextValue
  brightness.value = nextValue
  return nextValue
}

function buildDevicePayload(device: DeviceItem, next: Partial<DeviceCreatePayload>): DeviceCreatePayload {
  return {
    chipId: device.chipId || '',
    ip: device.ip || '',
    displayName: device.displayName || '',
    deviceType: device.deviceType || '',
    deviceNo: device.deviceNo || '',
    brightness: next.brightness ?? device.brightness ?? 70,
    temp: next.temp ?? device.temp ?? 4000,
    autoMode: next.autoMode ?? device.autoMode ?? false,
    recommendedBrightness: next.recommendedBrightness ?? device.recommendedBrightness ?? 70,
    recommendedTemp: next.recommendedTemp ?? device.recommendedTemp ?? 4000,
    fabric: device.fabric || '',
    mainColorRgb: device.mainColorRgb || '',
  }
}

function buildWavePayload(enabled = activeEffect.value === 'loop') {
  syncWaveBaseFromTempRange()
  return {
    effect: 'wave',
    enabled,
    minTemp: clamp(minTemp.value, 2700, 6500),
    maxTemp: clamp(maxTemp.value, 2700, 6500),
    baseTemp: clamp(baseTemp.value, 2700, 6500),
    range: clamp(range.value, 0, 1900),
    speed: clamp(speed.value, 0.2, 5),
    brightness: clamp(effectBrightness.value, 0, 100),
    phaseIndex: phaseIndex.value,
    phaseGap: clamp(phaseGap.value, 0, 3),
    selectedScope: selectedScope.value || 'all',
  }
}

function applyLightEffectState(state?: LightEffectState | null) {
  if (!state) return

  applyingServerState.value = true
  selectedScope.value = state.selectedScope || 'all'
  const stateMinTemp = Number(state.minTemp)
  const stateMaxTemp = Number(state.maxTemp)
  if (Number.isFinite(stateMinTemp) && Number.isFinite(stateMaxTemp)) {
    const low = clamp(Math.min(stateMinTemp, stateMaxTemp), TEMP_MIN, TEMP_MAX - TEMP_GAP_MIN)
    const high = clamp(Math.max(stateMinTemp, stateMaxTemp), TEMP_MIN + TEMP_GAP_MIN, TEMP_MAX)
    minTemp.value = Math.round(Math.min(low, high - TEMP_GAP_MIN))
    maxTemp.value = Math.round(Math.max(high, minTemp.value + TEMP_GAP_MIN))
    syncWaveBaseFromTempRange()
  } else {
    baseTemp.value = clamp(Number(state.baseTemp ?? 4600), 2700, 6500)
    range.value = clamp(Number(state.amplitude ?? state.range ?? 1900), 0, 1900)
    setTempRangeFromBaseAndRange(baseTemp.value, range.value)
  }
  speed.value = clamp(Number(state.speed ?? 1), 0.2, 5)
  phaseIndex.value = Number(state.phaseIndex ?? 0)
  phaseGap.value = clamp(Number(state.phaseGap ?? 0.8), 0, 3)

  const nextBrightness = clamp(Number(state.brightness ?? 70), 0, 100)
  effectBrightness.value = nextBrightness
  brightness.value = nextBrightness
  saveEffectBrightnessPreset(nextBrightness, selectedScope.value)

  activeEffect.value = state.enabled && state.effect === 'wave' ? 'loop' : null
  statusText.value = state.enabled && state.effect === 'wave'
    ? `Wave 灯效运行中，phase ${Math.round(phaseIndex.value)}`
    : '灯效未开启'

  window.setTimeout(() => {
    applyingServerState.value = false
  }, 0)
}

async function loadLightEffectState() {
  try {
    applyLightEffectState(await getLightEffectState())
  } catch (error) {
    console.error('load light effect state error =', error)
  }
}

async function handleQuickAction(action: QuickActionKey) {
  if (action === 'settings') {
    showSettings.value = true
    return
  }

  if (activeEffect.value === action) {
    await cancelEffect(action)
    return
  }

  const presetBrightness = prepareEffectBrightnessForEffect()

  if (action === 'loop') {
    await startWave()
    return
  }

  if (action === 'auto') {
    await applyDeviceMode({
      autoMode: true,
      brightness: presetBrightness,
      recommendedBrightness: presetBrightness,
      recommendedTemp: baseTemp.value,
    }, '自动模式', 'auto')
    return
  }

  const tempMap: Record<'warm' | 'neutral' | 'cool', number> = {
    warm: 3000,
    neutral: 4000,
    cool: 6000,
  }

  const labelMap: Record<'warm' | 'neutral' | 'cool', string> = {
    warm: '暖光',
    neutral: '中性白',
    cool: '冷白',
  }

  await applyDeviceMode({
    temp: tempMap[action],
    brightness: presetBrightness,
    autoMode: false,
    recommendedTemp: tempMap[action],
    recommendedBrightness: presetBrightness,
  }, labelMap[action], action)
}

async function cancelEffect(effect: NonNullable<ActiveEffect>) {
  if (effect === 'loop') {
    await stopWave()
    return
  }

  if (effect === 'auto') {
    await applyDeviceMode({ autoMode: false }, '自动模式已关闭', null)
    return
  }

  const labelMap: Record<'warm' | 'neutral' | 'cool', string> = {
    warm: '暖光',
    neutral: '中性白',
    cool: '冷白',
  }

  activeEffect.value = null
  statusText.value = `已取消${labelMap[effect]}`
}

async function applyDeviceMode(
  next: Partial<DeviceCreatePayload>,
  label: string,
  nextActiveEffect: ActiveEffect,
) {
  submitting.value = true

  try {
    if (activeEffect.value === 'loop') {
      const state = await closeLightEffectState()
      applyLightEffectState(state)
    }

    for (const device of targetDevices.value) {
      if (!device.id) continue
      await updateDevice(device.id, buildDevicePayload(device, next), { lightControl: true })
      if (typeof next.temp === 'number') device.temp = next.temp
      if (typeof next.brightness === 'number') device.brightness = next.brightness
      if (typeof next.autoMode === 'boolean') device.autoMode = next.autoMode
      if (typeof next.recommendedTemp === 'number') device.recommendedTemp = next.recommendedTemp
      if (typeof next.recommendedBrightness === 'number') device.recommendedBrightness = next.recommendedBrightness
    }

    activeEffect.value = nextActiveEffect
    statusText.value = nextActiveEffect === null
      ? label
      : `${label}已应用 ${targetDevices.value.length} 盏`
  } catch (error) {
    console.error('apply device mode error =', error)
    statusText.value = nextActiveEffect === null
      ? getErrorMessage(error, '关闭失败')
      : getErrorMessage(error, `${label}应用失败`)
  } finally {
    submitting.value = false
  }
}

async function saveSettings() {
  syncWaveBaseFromTempRange()
  effectBrightness.value = clamp(effectBrightness.value, 0, 100)
  brightness.value = effectBrightness.value
  saveEffectBrightnessPreset(effectBrightness.value)
  if (activeEffect.value === 'loop') {
    try {
      const state = await saveLightEffectState(buildWavePayload(true))
      applyLightEffectState(state)
      statusText.value = 'Wave 灯效设置已同步'
      return
    } catch (error) {
      console.error('save wave settings error =', error)
      statusText.value = getErrorMessage(error, 'Wave 灯效设置同步失败')
      return
    }
  }
  statusText.value = '循环设置已保存'
}

function closeSettings() {
  showSettings.value = false
}

function isNightMode() {
  return localStorage.getItem('SMART_LIGHT_NIGHT_MODE') === '1'
}

async function startWave() {
  submitting.value = true
  const waveBrightness = prepareEffectBrightnessForEffect()

  try {
    effectBrightness.value = waveBrightness
    brightness.value = waveBrightness
    const state = await saveLightEffectState(buildWavePayload(true))
    applyLightEffectState(state)
    activeEffect.value = 'loop'
    statusText.value = `Wave 灯效已启动，${targetDevices.value.length} 盏`
    return
    statusText.value = `循环已启动 ${targetDevices.value.length} 盏`
  } catch (error) {
    console.error('start wave effect error =', error)
    statusText.value = getErrorMessage(error, '开启失败')
  } finally {
    submitting.value = false
  }
}

async function stopWave() {
  submitting.value = true

  try {
    const state = await closeLightEffectState()
    applyLightEffectState(state)
    activeEffect.value = null
    statusText.value = 'Wave 灯效已停止'
    return
    statusText.value = '循环已停止'
  } catch (error) {
    console.error('stop wave effect error =', error)
    statusText.value = getErrorMessage(error, '停止失败')
  } finally {
    submitting.value = false
  }
}

function handleEffectBrightnessInput(event: Event) {
  const target = event.target as HTMLInputElement
  const nextValue = clamp(Number(target.value), 0, 100)

  effectBrightness.value = nextValue
  brightness.value = nextValue
  effectBrightnessInteracting.value = true
  saveEffectBrightnessPreset(nextValue)

  if (brightnessInteractionTimer) {
    window.clearTimeout(brightnessInteractionTimer)
  }
  brightnessInteractionTimer = window.setTimeout(() => {
    effectBrightnessInteracting.value = false
  }, EFFECT_BRIGHTNESS_DEBOUNCE_MS + 120)

  if (brightnessTimer) {
    window.clearTimeout(brightnessTimer)
  }

  if (!activeEffect.value) {
    return
  }

  brightnessTimer = window.setTimeout(() => {
    if (!activeEffect.value) return
    if (!targetDevices.value.length) return
    submitEffectBrightness(nextValue)
  }, EFFECT_BRIGHTNESS_DEBOUNCE_MS)
}

async function submitEffectBrightness(value: number) {
  if (!activeEffect.value) {
    return
  }

  if (activeEffect.value === 'loop') {
    const previousBrightness = effectBrightness.value
    try {
      brightness.value = value
      effectBrightness.value = value
      const state = await saveLightEffectState({
        ...buildWavePayload(true),
        brightness: value,
      })
      applyLightEffectState(state)
      statusText.value = 'Wave 灯效亮度已同步'
    } catch (error) {
      console.error('update wave brightness error =', error)
      effectBrightness.value = previousBrightness
      brightness.value = previousBrightness
      statusText.value = getErrorMessage(error, 'Wave 灯效亮度更新失败，请稍后重试')
    }
    return
  }

  const devices = targetDevices.value
  if (devices.length === 0) {
    return
  }

  const previousBrightness = normalizeBrightness(devices[0]?.brightness) ?? resolveEffectBrightness()

  try {
    for (const device of devices) {
      if (!device.id) continue
      await updateDevice(
        device.id,
        buildDevicePayload(device, {
          brightness: value,
          recommendedBrightness: value,
        }),
        { lightControl: true },
      )
      device.brightness = value
      device.recommendedBrightness = value
    }

    brightness.value = value
    statusText.value = `灯效亮度已同步 ${devices.length} 盏`
  } catch (error) {
    console.error('update effect brightness error =', error)
    effectBrightness.value = previousBrightness
    brightness.value = previousBrightness
    statusText.value = getErrorMessage(error, '灯效亮度更新失败，请稍后重试')
  }
}

watch(
  () => props.serverState,
  (state) => {
    applyLightEffectState(state)
  },
)

watch(
  () => [
    selectedScope.value,
    targetDevices.value[0]?.id,
    targetDevices.value[0]?.brightness,
    targetDevices.value.length,
  ],
  () => {
    if (!effectBrightnessInteracting.value && activeEffect.value !== 'loop') {
      syncEffectBrightnessFromScope()
    }
  },
  { immediate: true },
)

watch(
  () => selectedScope.value,
  () => {
    if (applyingServerState.value || activeEffect.value !== 'loop') {
      return
    }
    if (scopeTimer) {
      window.clearTimeout(scopeTimer)
    }
    scopeTimer = window.setTimeout(() => {
      saveLightEffectState(buildWavePayload(true))
        .then(applyLightEffectState)
        .catch((error) => {
          console.error('update wave scope error =', error)
          statusText.value = getErrorMessage(error, 'Wave 灯效范围更新失败')
        })
    }, EFFECT_BRIGHTNESS_DEBOUNCE_MS)
  },
)

onMounted(() => {
  loadLightEffectState()
})

onBeforeUnmount(() => {
  if (brightnessTimer) {
    window.clearTimeout(brightnessTimer)
  }
  if (brightnessInteractionTimer) {
    window.clearTimeout(brightnessInteractionTimer)
  }
  if (tempHandleTimer) {
    window.clearTimeout(tempHandleTimer)
  }
  if (scopeTimer) {
    window.clearTimeout(scopeTimer)
  }
})
</script>

<style scoped>
.light-effect-mini-card {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.10);
}

.mini-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.mini-title {
  font-size: 22px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.2;
}

.mini-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
  font-weight: 700;
}

.scope-field {
  display: block;
  margin-bottom: 12px;
}

.effect-action-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.effect-action-btn {
  position: relative;
  min-height: 70px;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  color: #1e293b;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;
}

.effect-action-btn strong,
.effect-action-btn span {
  position: relative;
  z-index: 1;
  display: block;
}

.effect-action-btn strong {
  font-size: 15px;
  line-height: 1.15;
  font-weight: 900;
}

.effect-action-btn span {
  margin-top: 7px;
  color: rgba(71, 85, 105, 0.82);
  font-size: 12px;
  line-height: 1.15;
  font-weight: 800;
}

.effect-action-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 12px 22px rgba(37, 99, 235, 0.13);
}

.effect-action-btn.active {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.52);
  box-shadow:
    0 12px 26px rgba(37, 99, 235, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.56);
}

.effect-action-btn.active::before {
  content: "已启用";
  position: absolute;
  right: 10px;
  bottom: 9px;
  z-index: 2;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #ffffff;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 900;
  pointer-events: none;
}

.effect-warm {
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95), rgba(251, 191, 36, 0.28));
  border-color: rgba(245, 158, 11, 0.28);
}

.effect-warm.active {
  border-color: rgba(245, 158, 11, 0.75);
  box-shadow:
    0 12px 28px rgba(245, 158, 11, 0.25),
    0 0 0 2px rgba(245, 158, 11, 0.12);
}

.effect-neutral {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(226, 232, 240, 0.65));
  border-color: rgba(148, 163, 184, 0.28);
}

.effect-neutral.active {
  border-color: rgba(100, 116, 139, 0.65);
  box-shadow:
    0 12px 26px rgba(100, 116, 139, 0.18),
    0 0 0 2px rgba(100, 116, 139, 0.1);
}

.effect-cool {
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.98), rgba(147, 197, 253, 0.32));
  border-color: rgba(59, 130, 246, 0.26);
}

.effect-cool.active {
  border-color: rgba(59, 130, 246, 0.7);
  box-shadow:
    0 12px 28px rgba(59, 130, 246, 0.22),
    0 0 0 2px rgba(59, 130, 246, 0.11);
}

.effect-auto {
  background: linear-gradient(135deg, rgba(238, 242, 255, 0.96), rgba(129, 140, 248, 0.28));
  border-color: rgba(99, 102, 241, 0.24);
}

.effect-auto::after {
  content: "AUTO";
  position: absolute;
  right: 10px;
  top: 9px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.14);
  color: #4f46e5;
  font-size: 10px;
  font-weight: 900;
}

.effect-auto.active {
  border-color: rgba(99, 102, 241, 0.72);
  box-shadow:
    0 12px 28px rgba(99, 102, 241, 0.24),
    0 0 0 2px rgba(99, 102, 241, 0.12);
}

.effect-loop {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.16), rgba(168, 85, 247, 0.22), rgba(14, 165, 233, 0.16));
  border-color: rgba(99, 102, 241, 0.28);
}

.effect-loop::after {
  content: "";
  position: absolute;
  right: 12px;
  top: 14px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid rgba(99, 102, 241, 0.48);
  border-left-color: transparent;
}

.effect-loop.active {
  position: relative;
  overflow: hidden;
  border-color: rgba(99, 102, 241, 0.72);
  background: linear-gradient(120deg, rgba(59, 130, 246, 0.22), rgba(168, 85, 247, 0.26), rgba(14, 165, 233, 0.22), rgba(59, 130, 246, 0.22));
  background-size: 220% 220%;
  animation: loopFlow 3s ease infinite;
  box-shadow: 0 14px 34px rgba(99, 102, 241, 0.28);
}

.effect-loop.active::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 320%;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%) rotate(0deg);
  transform-origin: 50% 50%;
  z-index: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(59, 130, 246, 0.12),
    rgba(168, 85, 247, 0.45),
    rgba(14, 165, 233, 0.38),
    rgba(59, 130, 246, 0.12)
  );
  animation: loopBorderSpin 3s linear infinite;
  opacity: 0.48;
  pointer-events: none;
}

.effect-loop.active::after {
  display: none;
}

.effect-loop.active > * {
  position: relative;
  z-index: 1;
}

.effect-settings {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.92), rgba(219, 234, 254, 0.52));
  border-color: rgba(148, 163, 184, 0.24);
}

.effect-settings.active::before {
  display: none;
}

@keyframes loopFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes loopBorderSpin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.effect-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.effect-brightness-control {
  margin-top: 14px;
  padding: 13px 14px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.88);
}

.effect-brightness-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.effect-brightness-header .mini-label {
  margin: 0;
}

.effect-brightness-header strong {
  color: #2563eb;
  font-size: 13px;
  font-weight: 900;
  transition: transform 0.15s ease, color 0.15s ease;
}

.effect-brightness-header strong.brightness-active {
  transform: scale(1.4);
  color: #1d4ed8;
}

.effect-brightness-slider {
  width: 100%;
  margin: 9px 0 0;
  accent-color: #2563eb;
}

.effect-brightness-hint {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 700;
}

.mini-status {
  margin-top: 10px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  font-weight: 700;
}

.effect-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.42);
}

.effect-modal-card {
  width: min(480px, 100%);
  max-height: min(640px, calc(100vh - 48px));
  overflow-y: auto;
  box-sizing: border-box;
  padding: 22px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.98);
  box-shadow: 0 28px 78px rgba(15, 23, 42, 0.32);
}

.effect-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.effect-modal-header h3 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  font-weight: 900;
}

.effect-modal-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.modal-close-btn {
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.92);
  color: #475569;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.effect-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-field:last-child {
  grid-column: 1 / -1;
}

.form-field {
  min-width: 0;
}

.effect-form > .form-field:nth-child(2),
.effect-form > .form-field:nth-child(3),
.effect-form > .form-field:nth-child(4) {
  display: none;
}

.temp-range-field {
  grid-column: 1 / -1;
}

.temp-range-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.temp-range-value {
  color: #2563eb;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.dual-temp-slider {
  position: relative;
  height: 42px;
  padding: 0 15px;
}

.dual-temp-track,
.dual-temp-selected {
  position: absolute;
  left: 15px;
  right: 15px;
  top: 18px;
  height: 6px;
  border-radius: 999px;
  pointer-events: none;
}

.dual-temp-track {
  background: rgba(203, 213, 225, 0.9);
}

.dual-temp-selected {
  right: auto;
  background: linear-gradient(90deg, #f59e0b, #3b82f6);
}

.dual-temp-input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: transparent;
  pointer-events: none;
  appearance: none;
  -webkit-appearance: none;
}

.dual-temp-input::-webkit-slider-runnable-track {
  height: 6px;
  background: transparent;
}

.dual-temp-input::-webkit-slider-thumb {
  width: 30px;
  height: 20px;
  margin-top: -7px;
  border-radius: 9px;
  border: 3px solid #ffffff;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0) 45%),
    #2563eb;
  box-shadow:
    0 7px 16px rgba(37, 99, 235, 0.32),
    inset 0 -2px 4px rgba(15, 23, 42, 0.18);
  pointer-events: auto;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.dual-temp-input::-moz-range-track {
  height: 6px;
  background: transparent;
}

.dual-temp-input::-moz-range-thumb {
  width: 30px;
  height: 20px;
  border-radius: 9px;
  border: 3px solid #ffffff;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0) 45%),
    #2563eb;
  box-shadow:
    0 7px 16px rgba(37, 99, 235, 0.32),
    inset 0 -2px 4px rgba(15, 23, 42, 0.18);
  pointer-events: auto;
  cursor: pointer;
}

.dual-temp-min {
  z-index: 2;
}

.dual-temp-max {
  z-index: 3;
}

.dual-temp-slider.dragging-min .dual-temp-min {
  z-index: 5;
}

.dual-temp-slider.dragging-max .dual-temp-max {
  z-index: 5;
}

.effect-form > .form-field:nth-child(6) > .mini-label {
  font-size: 0;
}

.effect-form > .form-field:nth-child(6) > .mini-label::after {
  content: "灯间延迟";
  font-size: 12px;
}

.effect-form > .form-field:nth-child(6)::after {
  content: "用于控制多盏灯之间波动的错开程度，数值越大，流水感越明显。";
  display: block;
  margin-top: 7px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 700;
}

.mini-label {
  display: block;
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
}

.mini-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  border-radius: 11px;
  border: 1px solid #dbe3ef;
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  font-size: 14px;
  outline: none;
}

.effect-modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.modal-btn {
  border: none;
  border-radius: 999px;
  padding: 10px 15px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.modal-btn.primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}

.modal-btn.secondary {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.modal-btn.danger {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.modal-btn.ghost {
  background: rgba(100, 116, 139, 0.12);
  color: #475569;
}

.modal-btn:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

:global(.app-container.night-mode) .light-effect-mini-card {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.app-container.night-mode) .mini-title {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .mini-subtitle,
:global(.app-container.night-mode) .mini-status,
:global(.app-container.night-mode) .mini-label {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .effect-action-btn {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(148, 163, 184, 0.22);
  color: rgba(226, 232, 240, 0.9);
  box-shadow: none;
}

:global(.app-container.night-mode) .effect-action-btn span {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .effect-action-btn:hover,
:global(.app-container.night-mode) .effect-action-btn.active {
  background: rgba(37, 99, 235, 0.24);
  border-color: rgba(96, 165, 250, 0.42);
  color: #bfdbfe;
}

:global(.app-container.night-mode) .effect-action-btn.active::before {
  background: rgba(191, 219, 254, 0.14);
  color: #dbeafe;
}

:global(.app-container.night-mode) .effect-action-btn.active span {
  color: rgba(219, 234, 254, 0.82);
}

:global(.app-container.night-mode) .effect-brightness-control {
  background: rgba(30, 41, 59, 0.62);
  border-color: rgba(148, 163, 184, 0.2);
}

:global(.app-container.night-mode) .effect-brightness-header strong {
  color: #bfdbfe;
}

:global(.app-container.night-mode) .effect-brightness-slider {
  accent-color: #60a5fa;
}

:global(.app-container.night-mode) .effect-brightness-hint {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .effect-warm {
  background: linear-gradient(135deg, rgba(67, 42, 12, 0.9), rgba(245, 158, 11, 0.22));
  border-color: rgba(245, 158, 11, 0.34);
}

:global(.app-container.night-mode) .effect-warm.active {
  border-color: rgba(251, 191, 36, 0.66);
  box-shadow:
    0 12px 28px rgba(245, 158, 11, 0.25),
    0 0 0 2px rgba(251, 191, 36, 0.14);
}

:global(.app-container.night-mode) .effect-neutral {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(71, 85, 105, 0.42));
  border-color: rgba(148, 163, 184, 0.26);
}

:global(.app-container.night-mode) .effect-cool {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(37, 99, 235, 0.26));
  border-color: rgba(96, 165, 250, 0.34);
}

:global(.app-container.night-mode) .effect-auto {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(99, 102, 241, 0.28));
  border-color: rgba(129, 140, 248, 0.34);
}

:global(.app-container.night-mode) .effect-auto::after {
  background: rgba(129, 140, 248, 0.22);
  color: #c7d2fe;
}

:global(.app-container.night-mode) .effect-loop {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.24), rgba(168, 85, 247, 0.28), rgba(14, 165, 233, 0.2));
  border-color: rgba(129, 140, 248, 0.4);
}

:global(.app-container.night-mode) .effect-loop::after {
  border-color: rgba(191, 219, 254, 0.68);
  border-left-color: transparent;
}

:global(.app-container.night-mode) .effect-loop.active {
  background: linear-gradient(120deg, rgba(37, 99, 235, 0.3), rgba(168, 85, 247, 0.34), rgba(14, 165, 233, 0.26), rgba(37, 99, 235, 0.3));
  background-size: 220% 220%;
  box-shadow: 0 14px 34px rgba(99, 102, 241, 0.32);
}

:global(.app-container.night-mode) .effect-settings {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(51, 65, 85, 0.58));
  border-color: rgba(148, 163, 184, 0.26);
}

.effect-modal-night .effect-modal-card {
  background: rgba(15, 23, 42, 0.99);
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
}

.effect-modal-night .effect-modal-header h3 {
  color: rgba(248, 250, 252, 0.96);
}

.effect-modal-night .effect-modal-header p,
.effect-modal-night .mini-label {
  color: rgba(203, 213, 225, 0.72);
}

.effect-modal-night .mini-input {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.28);
  color: rgba(226, 232, 240, 0.92);
}

.effect-modal-night .dual-temp-track {
  background: rgba(51, 65, 85, 0.92);
}

.effect-modal-night .temp-range-value,
.effect-modal-night .effect-form > .form-field:nth-child(6)::after {
  color: rgba(191, 219, 254, 0.9);
}

.effect-modal-night .modal-close-btn,
.effect-modal-night .modal-btn.ghost {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}

.effect-modal-night .modal-btn.secondary {
  background: rgba(37, 99, 235, 0.24);
  color: #bfdbfe;
}

.effect-modal-night .modal-btn.danger {
  background: rgba(127, 29, 29, 0.28);
  color: #fecaca;
}

@media (max-width: 768px) {
  .light-effect-mini-card {
    padding: 12px 14px;
    border-radius: 16px;
  }

  .mini-header {
    margin-bottom: 8px;
  }

  .mini-title {
    font-size: 15px;
    font-weight: 700;
  }

  .mini-subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.3;
    font-weight: 400;
  }

  .scope-field {
    margin-bottom: 8px;
  }

  .effect-action-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    margin-top: 12px;
  }

  .effect-form {
    grid-template-columns: 1fr;
  }

  .effect-action-btn {
    min-height: 56px;
    padding: 8px 10px;
    border-radius: 14px;
  }

  .effect-action-btn strong {
    font-size: 11px;
  }

  .effect-action-btn span {
    margin-top: 3px;
    font-size: 9px;
  }

  .effect-action-btn.active::before {
    right: 5px;
    bottom: 4px;
    padding: 1px 4px;
    font-size: 7px;
  }

  .effect-auto::after {
    right: 6px;
    top: 6px;
    padding: 1px 4px;
    font-size: 8px;
  }

  .effect-loop::after {
    right: 8px;
    top: 10px;
    width: 14px;
    height: 14px;
  }

  .effect-brightness-control {
    margin-top: 8px;
    padding: 8px;
    border-radius: 14px;
  }

  .effect-brightness-header strong {
    font-size: 11px;
  }

  .effect-brightness-hint {
    font-size: 9px;
    margin-top: 2px;
  }

  .mini-status {
    margin-top: 6px;
    font-size: 10px;
  }

  .effect-modal-card {
    padding: 16px;
  }

  .effect-modal-actions {
    justify-content: stretch;
  }

  .modal-btn {
    flex: 1 1 140px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .effect-loop.active,
  .effect-loop.active::before {
    animation: none;
  }
}
</style>
