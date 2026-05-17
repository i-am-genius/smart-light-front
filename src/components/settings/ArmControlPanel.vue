<template>
  <div class="settings-card gimbal-panel" :class="{ shake: shaking }">
    <div class="panel-header">
      <div>
        <h2 class="settings-title">🎯 云台控制</h2>
        <p class="panel-desc">
          根据设备类型控制灯光照射云台或独立摄像头云台
        </p>
      </div>
    </div>

    <div class="form-row">
      <label>选择设备：</label>
      <BaseSelect
        v-model="selectedDeviceCode"
        :options="armDeviceOptions"
        placeholder="请选择 lamp / cam / camlamp 设备"
      />
    </div>

    <div v-if="selectedDevice" class="device-meta selected-meta">
      当前类型：{{ selectedDeviceTypeText }}
    </div>

    <div class="form-row">
      <label>动作速度：</label>
      <div class="speed-tabs">
        <button
          v-for="item in speedOptions"
          :key="item.value"
          class="speed-tab"
          :class="{ active: speed === item.value }"
          @click="speed = item.value"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="gimbal-layout">
      <div class="direction-pad">
        <button class="dir-btn up" :disabled="isActionDisabled" @click="send('up')">
          ⬆
        </button>

        <button class="dir-btn left" :disabled="isActionDisabled" @click="send('left')">
          ⬅
        </button>

        <button class="dir-btn center" :disabled="isActionDisabled" @click="send('center')">
          居中
        </button>

        <button class="dir-btn right" :disabled="isActionDisabled" @click="send('right')">
          ➡
        </button>

        <button class="dir-btn down" :disabled="isActionDisabled" @click="send('down')">
          ⬇
        </button>
      </div>

      <div v-if="selectedDeviceType === 'lamp'" class="action-panel">
        <button
          v-for="item in presetActions"
          :key="item.action"
          class="preset-btn"
          :disabled="isActionDisabled"
          @click="send(item.action)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.desc }}</span>
        </button>
      </div>

      <div v-else-if="isCamDevice" class="cam-control-panel">
        <div class="action-panel cam-preset-panel">
          <button
            v-for="item in camPresetActions"
            :key="item.action"
            class="preset-btn"
            :disabled="isActionDisabled"
            @click="send(item.action)"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.desc }}</span>
          </button>
        </div>

        <div class="slider-card">
          <div class="slider-card-header">
            <strong>滑轨位置</strong>
            <span>{{ sliderPosition }} mm</span>
          </div>

          <input
            v-model.number="sliderPosition"
            class="slider-range"
            type="range"
            :min="SLIDER_MIN"
            :max="SLIDER_MAX"
            :step="SLIDER_STEP"
            :disabled="isActionDisabled"
          />

          <div class="slider-actions">
            <button
              class="compact-btn primary"
              :disabled="isActionDisabled"
              @click="sendSliderPosition"
            >
              移动到当前位置
            </button>
            <button
              class="compact-btn"
              :disabled="isActionDisabled"
              @click="send('slide_stop')"
            >
              停止
            </button>
          </div>

          <div class="lamp-shortcuts">
            <button
              v-for="item in lampShortcutActions"
              :key="item.action"
              class="shortcut-btn"
              :disabled="isActionDisabled"
              @click="send(item.action)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="result-block">
      <div class="device-meta">{{ statusText }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { armControl, type ArmControlSpeed } from '../../api/device'
import type { DeviceItem } from '../../types/device'
import { getErrorMessage } from '../../utils/error'
import BaseSelect from '../common/BaseSelect.vue'
import { useToast } from '../../composables/useToast'
import { useShake } from '../../composables/useShake'

const toast = useToast()
const { shaking, trigger: doShake } = useShake()

const props = defineProps<{
  devices: DeviceItem[]
}>()

type ArmDeviceType = 'lamp' | 'cam' | 'camlamp'
type ArmAction = {
  action: string
  label: string
  desc: string
}

const selectedDeviceCode = ref('')
const speed = ref<ArmControlSpeed>('normal')
const sliderPosition = ref(0)
const submitting = ref(false)
const errorText = ref('')
const statusText = ref('请选择设备后发送云台控制指令')

const SLIDER_MIN = 0
const SLIDER_MAX = 500
const SLIDER_STEP = 10

const speedOptions: { label: string; value: ArmControlSpeed }[] = [
  { label: '慢', value: 'slow' },
  { label: '中', value: 'normal' },
  { label: '快', value: 'fast' },
]

const commonActions: ArmAction[] = [
  { action: 'home', label: '归位', desc: '回到默认初始位置' },
  { action: 'stop', label: '停止', desc: '停止或保持当前位置' },
]

const lampActions: ArmAction[] = [
  { action: 'aim_person', label: '一键照人', desc: '灯光云台转到照人预设角度' },
  { action: 'aim_cloth', label: '一键照服装', desc: '灯光云台转到服装预设角度' },
  ...commonActions,
]

const camPresetActions: ArmAction[] = [
  { action: 'cam_person', label: '对人角度', desc: '摄像头转到对人预设角度' },
  { action: 'cam_cloth', label: '对服装角度', desc: '摄像头转到对服装预设角度' },
  ...commonActions,
]

const lampShortcutActions: ArmAction[] = [
  { action: 'go_lamp_1', label: '灯1', desc: '移动到灯1旁指定位置' },
  { action: 'go_lamp_2', label: '灯2', desc: '移动到灯2旁指定位置' },
  { action: 'go_lamp_3', label: '灯3', desc: '移动到灯3旁指定位置' },
]

const armDevices = computed(() => {
  return (props.devices || []).filter(device => {
    return normalizeDeviceType(device.deviceType) !== ''
  })
})

const armDeviceOptions = computed(() => {
  return armDevices.value.map(device => ({
    label: buildDeviceLabel(device),
    value: getDeviceCode(device),
  }))
})

const selectedDevice = computed(() => {
  return armDevices.value.find(device => getDeviceCode(device) === selectedDeviceCode.value)
})

const selectedDeviceType = computed<ArmDeviceType | ''>(() => {
  return normalizeDeviceType(selectedDevice.value?.deviceType)
})

const selectedDeviceTypeText = computed(() => {
  const type = selectedDeviceType.value
  if (type === 'lamp') return 'lamp'
  if (type === 'cam') return 'cam'
  if (type === 'camlamp') return 'camlamp（按 cam 控制）'
  return '未知'
})

const isCamDevice = computed(() => {
  return selectedDeviceType.value === 'cam' || selectedDeviceType.value === 'camlamp'
})

const presetActions = computed(() => {
  if (selectedDeviceType.value === 'lamp') {
    return lampActions
  }
  return []
})

const isActionDisabled = computed(() => submitting.value || !selectedDevice.value)

watch(
  armDeviceOptions,
  (options) => {
    if (!selectedDeviceCode.value && options.length > 0) {
      selectedDeviceCode.value = String(options[0].value)
      return
    }

    if (
      selectedDeviceCode.value &&
      !options.some(option => String(option.value) === selectedDeviceCode.value)
    ) {
      selectedDeviceCode.value = options[0] ? String(options[0].value) : ''
    }
  },
  { immediate: true },
)

function normalizeDeviceType(deviceType?: string): ArmDeviceType | '' {
  const type = String(deviceType || '')
    .replace(/[-_\s]/g, '')
    .toLowerCase()

  if (type === 'lamp' || type === 'cam' || type === 'camlamp') {
    return type
  }

  return ''
}

function getDeviceCode(device: Partial<DeviceItem> | any) {
  return String(device?.chipId || device?.deviceCode || '').trim()
}

function buildDeviceLabel(device: DeviceItem) {
  const zoneName = device.displayName || '未分区'
  const no = device.deviceNo ? `灯具-${device.deviceNo}` : '未编号'
  const chipId = device.chipId || '未知芯片'
  const type = device.deviceType || '未知类型'

  return `${zoneName} · ${no} · ${type} · ${chipId}`
}

function getActionText(action: string) {
  const map: Record<string, string> = {
    up: '上',
    down: '下',
    left: '左',
    right: '右',
    center: '居中',
    home: '归位',
    stop: '停止',
    aim_person: '一键照人',
    aim_cloth: '一键照服装',
    slide_left: '滑轨左移',
    slide_right: '滑轨右移',
    slide_stop: '滑轨停止',
    slider_position: '滑轨位置',
    cam_person: '对人角度',
    cam_cloth: '对服装角度',
    go_lamp_1: '到灯1旁',
    go_lamp_2: '到灯2旁',
    go_lamp_3: '到灯3旁',
  }

  return map[action] || action
}

async function send(action: string, position?: number) {
  errorText.value = ''

  if (!selectedDevice.value || !selectedDeviceCode.value) {
    errorText.value = '请先选择设备'
    toast.show('请先选择设备', 'error')
    doShake()
    return
  }

  submitting.value = true

  try {
    await armControl(selectedDeviceCode.value, action, speed.value, position)

    const positionText = position === undefined ? '' : ` / ${position} mm`
    statusText.value = `已发送：${selectedDeviceTypeText.value} / ${getActionText(action)} / ${speed.value}${positionText}`
  } catch (error) {
    console.error('gimbal control error =', error)
    const msg = getErrorMessage(error, '发送云台控制指令失败')
    errorText.value = msg
    toast.show(msg, 'error')
    doShake()
  } finally {
    submitting.value = false
  }
}

async function sendSliderPosition() {
  await send('slider_position', sliderPosition.value)
}
</script>

<style scoped>
.gimbal-panel {
  overflow: visible;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-desc {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.form-row label {
  flex: 0 0 88px;
  color: #606266;
  font-size: 14px;
}

.selected-meta {
  margin-top: 8px;
  padding-left: 100px;
}

.speed-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.speed-tab {
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.86);
  color: #475569;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.speed-tab:hover {
  transform: translateY(-1px);
}

.speed-tab.active {
  background: rgba(64, 158, 255, 0.14);
  border-color: rgba(64, 158, 255, 0.55);
  color: #2563eb;
}

.gimbal-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
}

.direction-pad {
  display: grid;
  grid-template-columns: repeat(3, 64px);
  grid-template-rows: repeat(3, 52px);
  gap: 8px;
  justify-content: center;
  align-content: center;
  padding: 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.dir-btn {
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: #2563eb;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.dir-btn:hover {
  transform: translateY(-1px);
  background: #fff;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.14);
}

.dir-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.dir-btn.up {
  grid-column: 2;
  grid-row: 1;
}

.dir-btn.left {
  grid-column: 1;
  grid-row: 2;
}

.dir-btn.center {
  grid-column: 2;
  grid-row: 2;
  font-size: 13px;
}

.dir-btn.right {
  grid-column: 3;
  grid-row: 2;
}

.dir-btn.down {
  grid-column: 2;
  grid-row: 3;
}

.action-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  align-content: start;
}

.cam-control-panel {
  display: grid;
  gap: 12px;
  align-content: start;
}

.cam-preset-panel {
  grid-template-columns: repeat(2, minmax(140px, 1fr));
}

.preset-btn {
  width: 100%;
  min-height: 72px;
  text-align: left;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  padding: 12px 13px;
  background: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.preset-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(64, 158, 255, 0.45);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.1);
}

.preset-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preset-btn strong {
  display: block;
  color: #1e293b;
  font-size: 14px;
  font-weight: 900;
}

.preset-btn span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.slider-card {
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  padding: 13px;
  background: rgba(248, 250, 252, 0.82);
}

.slider-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #1e293b;
  font-size: 14px;
}

.slider-card-header span {
  color: #2563eb;
  font-weight: 800;
}

.slider-range {
  width: 100%;
  margin: 12px 0 10px;
}

.slider-actions,
.lamp-shortcuts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lamp-shortcuts {
  margin-top: 10px;
}

.compact-btn,
.shortcut-btn {
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.compact-btn.primary {
  background: rgba(64, 158, 255, 0.12);
  border-color: rgba(64, 158, 255, 0.45);
  color: #2563eb;
}

.shortcut-btn {
  flex: 1 1 76px;
}

.compact-btn:hover,
.shortcut-btn:hover {
  border-color: rgba(64, 158, 255, 0.48);
  color: #2563eb;
}

.compact-btn:disabled,
.shortcut-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.result-block {
  margin-top: 14px;
}

.device-meta {
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    gap: 8px;
  }

  .settings-title {
    font-size: 16px;
  }

  .panel-desc {
    margin: 2px 0 0;
    font-size: 11px;
  }

  .form-row {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    margin-top: 10px;
  }

  .form-row label {
    flex: none;
    font-size: 12px;
  }

  .selected-meta {
    padding-left: 0;
    margin-top: 4px;
    font-size: 12px;
  }

  .gimbal-layout {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 12px;
  }

  .direction-pad {
    grid-template-columns: repeat(3, 56px);
    grid-template-rows: repeat(3, 44px);
    gap: 6px;
    padding: 14px 24px;
    justify-self: center;
  }

  .dir-btn {
    position: relative;
    font-size: 0;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  }

  .dir-btn::after {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    width: 0;
    height: 0;
  }

  .dir-btn.up::after {
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-bottom: 16px solid currentColor;
  }

  .dir-btn.down::after {
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-top: 16px solid currentColor;
  }

  .dir-btn.left::after {
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    border-right: 16px solid currentColor;
  }

  .dir-btn.right::after {
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    border-left: 16px solid currentColor;
  }

  .dir-btn.center {
    font-size: 11px;
  }

  .dir-btn.center::after {
    display: none;
  }

  .action-panel {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .cam-preset-panel {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .preset-btn {
    min-height: 46px;
    padding: 8px;
  }

  .preset-btn strong {
    font-size: 11px;
  }

  .preset-btn span {
    margin-top: 2px;
    font-size: 9px;
  }

  .slider-card {
    padding: 8px;
  }

  .slider-card-header {
    font-size: 11px;
  }

  .speed-tabs {
    gap: 6px;
  }

  .speed-tab {
    padding: 8px 14px;
    font-size: 13px;
  }

  .compact-btn,
  .shortcut-btn {
    padding: 5px 8px;
    font-size: 10px;
  }

  .result-block {
    margin-top: 10px;
  }
}

:global(.app-container.night-mode) .panel-desc,
:global(.app-container.night-mode) .form-row label,
:global(.app-container.night-mode) .device-meta,
:global(.app-container.night-mode) .preset-btn span {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .speed-tab,
:global(.app-container.night-mode) .dir-btn,
:global(.app-container.night-mode) .preset-btn,
:global(.app-container.night-mode) .slider-card,
:global(.app-container.night-mode) .compact-btn,
:global(.app-container.night-mode) .shortcut-btn {
  background: rgba(15, 23, 42, 0.68);
  border-color: rgba(148, 163, 184, 0.2);
  color: rgba(226, 232, 240, 0.9);
  box-shadow: none;
}

:global(.app-container.night-mode) .direction-pad {
  background: rgba(15, 23, 42, 0.62);
  border-color: rgba(148, 163, 184, 0.18);
}

:global(.app-container.night-mode) .preset-btn strong,
:global(.app-container.night-mode) .slider-card-header {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .slider-card-header span,
:global(.app-container.night-mode) .dir-btn,
:global(.app-container.night-mode) .speed-tab.active,
:global(.app-container.night-mode) .compact-btn.primary {
  color: #93c5fd;
}

:global(.app-container.night-mode) .speed-tab.active,
:global(.app-container.night-mode) .compact-btn.primary {
  background: rgba(37, 99, 235, 0.26);
  border-color: rgba(96, 165, 250, 0.45);
}

:global(.app-container.night-mode) .preset-btn:hover,
:global(.app-container.night-mode) .dir-btn:hover,
:global(.app-container.night-mode) .compact-btn:hover,
:global(.app-container.night-mode) .shortcut-btn:hover {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(96, 165, 250, 0.45);
  color: #bfdbfe;
}
</style>
