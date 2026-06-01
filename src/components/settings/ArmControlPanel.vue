<template>
  <div class="settings-card gimbal-panel" :class="{ shake: shaking }">
    <div class="panel-header">
      <div>
        <h2 class="settings-title">🎯 云台控制</h2>
        <p class="panel-desc">
          按住摇杆持续转动，松开即停。精确模式可设置具体角度。
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
          @click="changeSpeed(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <!-- ===== 精确模式切换 ===== -->
    <div class="form-row">
      <label>控制模式：</label>
      <button
        class="mode-toggle-btn"
        :class="{ active: isPrecisionMode }"
        :disabled="isActionDisabled"
        @click="togglePrecisionMode"
      >
        {{ isPrecisionMode ? '📐 返回摇杆模式' : '🎯 精确角度调节' }}
      </button>
    </div>

        <!-- ===== 摇杆模式 (默认) ===== -->
    <div v-if="!isPrecisionMode" class="joystick-section">
      <div class="gimbal-control-block">
        <div class="gimbal-control-row">
          <!-- 左侧：摇杆安全盒子 -->
          <div class="joystick-side">
            <div
              ref="joystickBaseRef"
              class="joystick-container"
              @pointerdown="startJoystick"
              @pointermove="moveJoystick"
              @pointerup="stopJoystick"
              @pointercancel="stopJoystick"
              @lostpointercapture="stopJoystick"
            >
              <div class="joystick-around">
                <div class="joystick-handle">
                  <div
                    class="joystick-button"
                    :class="{ active: joystickActive }"
                    :style="knobStyle"
                  >
                    <div class="joystick-inside">
                      <span class="joystick-dot"></span>
                      <span class="joystick-dot"></span>
                      <span class="joystick-dot"></span>
                      <span class="joystick-dot"></span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SVG 箭头 (安全盒子内部) -->
              <svg class="joystick-icon joystick-icon-up" :class="{ active: joystickActive && joystickY > 0.3 }" viewBox="0 0 30 30">
                <path d="M15,3 L28,26 L2,26 Z" />
              </svg>
              <svg class="joystick-icon joystick-icon-right" :class="{ active: joystickActive && joystickX > 0.3 }" viewBox="0 0 30 30">
                <path d="M4,2 L26,15 L4,28 Z" />
              </svg>
              <svg class="joystick-icon joystick-icon-down" :class="{ active: joystickActive && joystickY < -0.3 }" viewBox="0 0 30 30">
                <path d="M2,4 L15,28 L28,4 Z" />
              </svg>
              <svg class="joystick-icon joystick-icon-left" :class="{ active: joystickActive && joystickX < -0.3 }" viewBox="0 0 30 30">
                <path d="M26,4 L4,15 L26,26 Z" />
              </svg>
            </div>
          </div>

          <!-- 右侧：预设动作按钮 -->
          <div v-if="presetActions.length > 0" class="gimbal-preset-side">
            <button
              v-for="item in presetActions"
              :key="item.action"
              class="preset-card"
              :disabled="isActionDisabled"
              @click="sendPreset(item.action)"
            >
              <strong>{{ item.label }}</strong>
              <span>{{ item.desc }}</span>
            </button>
          </div>
        </div>

      </div>
    </div>

<!-- ===== 精确模式 (二级菜单) ===== -->
    <div v-else class="precision-section">
      <div class="precision-card">
        <div class="precision-row">
          <label>Pan 水平：<strong>{{ armPosition.pan }}°</strong></label>
          <input
            v-model.number="armPosition.pan"
            class="precision-slider"
            type="range"
            :min="PAN_MIN"
            :max="PAN_MAX"
            :step="1"
            :disabled="isActionDisabled"
            @change="onPrecisionChange('pan')"
          />
        </div>
        <div class="precision-row">
          <label>Tilt 俯仰：<strong>{{ armPosition.tilt }}°</strong></label>
          <input
            v-model.number="armPosition.tilt"
            class="precision-slider"
            type="range"
            :min="TILT_MIN"
            :max="TILT_MAX"
            :step="1"
            :disabled="isActionDisabled"
            @change="onPrecisionChange('tilt')"
          />
        </div>
        <div class="precision-row">
          <label>Slider 滑轨：<strong>{{ armPosition.slider }} mm</strong></label>
          <input
            v-model.number="armPosition.slider"
            class="precision-slider"
            type="range"
            :min="precisionSliderMin"
            :max="precisionSliderMax"
            :step="10"
            :disabled="isActionDisabled"
            @change="onPrecisionChange('slider')"
          />
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue'
import {
  sendArmSpeed,
  sendArmAction,
  sendArmJoystick,
  sendArmStop,
  sendArmPosition,
  type ArmControlSpeed,
} from '../../api/device'
import type { DeviceItem } from '../../types/device'
import { getErrorMessage } from '../../utils/error'
import { normalizeDeviceType as normDeviceType } from '../../utils/device'
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
const submitting = ref(false)
const errorText = ref('')
const statusText = ref('拖动摇杆或点击精确模式开始控制')

// 摇杆状态
const isPrecisionMode = ref(false)
const armPosition = reactive({
  pan: 0,
  tilt: 0,
  slider: 0,
})

// 真实摇杆
const joystickBaseRef = ref<HTMLElement | null>(null)
const joystickActive = ref(false)
const joystickX = ref(0)
const joystickY = ref(0)
const knobX = ref(0)
const knobY = ref(0)
let joystickTimer: ReturnType<typeof setInterval> | null = null

const JOYSTICK_RADIUS = 24
const JOYSTICK_KNOB_RADIUS = 0
const JOYSTICK_MAX_DISTANCE = JOYSTICK_RADIUS - JOYSTICK_KNOB_RADIUS

const knobStyle = computed(() => ({
  transform: `
    translate(${knobX.value}px, ${knobY.value}px)
    rotateX(${(-joystickY.value * 8).toFixed(2)}deg)
    rotateY(${(joystickX.value * 8).toFixed(2)}deg)
  `
}))

const PAN_MIN = -90
const PAN_MAX = 90
const TILT_MIN = -45
const TILT_MAX = 45
const SLIDER_MIN = 0
const SLIDER_MAX_LAMP = 1200
const SLIDER_MAX_CAM = 500
const JOYSTICK_RENEW_INTERVAL = 150
const JOYSTICK_DURATION_MS = 300

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
  if (selectedDeviceType.value === 'lamp') return lampActions
  if (isCamDevice.value) return camPresetActions
  return []
})

const isActionDisabled = computed(() => submitting.value || !selectedDevice.value)

const precisionSliderMin = computed(() => SLIDER_MIN)
const precisionSliderMax = computed(() => {
  if (selectedDeviceType.value === 'lamp') return SLIDER_MAX_LAMP
  return SLIDER_MAX_CAM
})

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

// 切换设备时停止摇杆
watch(selectedDeviceCode, () => {
  stopJoystick()
})

// 组件卸载时停止
onBeforeUnmount(() => {
  stopJoystick()
})

function normalizeDeviceType(deviceType?: string): ArmDeviceType | '' {
  const type = normDeviceType(deviceType)
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

// ===== 速度切换 =====
async function changeSpeed(nextSpeed: ArmControlSpeed) {
  speed.value = nextSpeed
  if (!selectedDevice.value || !selectedDeviceCode.value) return
  try {
    await sendArmSpeed(selectedDeviceCode.value, nextSpeed)
    statusText.value = `已发送：${selectedDeviceTypeText.value} / 速度切换为 ${nextSpeed}`
  } catch (error) {
    console.error('arm speed error =', error)
    const msg = getErrorMessage(error, '发送速度指令失败')
    toast.show(msg, 'error')
  }
}

// 坐标转换函数放在 startJoystick 前面
function updateJoystickFromPointer(event: PointerEvent) {
  const base = joystickBaseRef.value
  if (!base) return

  const rect = base.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  let dx = event.clientX - centerX
  let dy = event.clientY - centerY

  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance > JOYSTICK_MAX_DISTANCE) {
    const scale = JOYSTICK_MAX_DISTANCE / distance
    dx *= scale
    dy *= scale
  }

  knobX.value = dx
  knobY.value = dy

  joystickX.value = Number((dx / JOYSTICK_MAX_DISTANCE).toFixed(2))
  joystickY.value = Number((-dy / JOYSTICK_MAX_DISTANCE).toFixed(2))
}

function sendJoystickRenew() {
  if (!selectedDeviceCode.value) return
  sendArmJoystick(
    selectedDeviceCode.value,
    joystickX.value,
    joystickY.value,
    JOYSTICK_DURATION_MS,
  ).catch(() => {})
  statusText.value = `摇杆 X=${joystickX.value.toFixed(2)} Y=${joystickY.value.toFixed(2)}`
}

function startJoystick(event: PointerEvent) {
  if (!selectedDevice.value || !selectedDeviceCode.value) {
    toast.show('请先选择设备', 'error')
    doShake()
    return
  }
  joystickActive.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)

  updateJoystickFromPointer(event)
  sendJoystickRenew()

  clearJoystickTimer()
  joystickTimer = setInterval(() => {
    if (joystickActive.value) {
      sendJoystickRenew()
    }
  }, JOYSTICK_RENEW_INTERVAL)
}

// pointermove：只更新本地位置，不发请求
function moveJoystick(event: PointerEvent) {
  if (!joystickActive.value) return
  updateJoystickFromPointer(event)
}

// pointerup / pointercancel / lostpointercapture：停止
function stopJoystick() {
  if (!joystickActive.value) return
  joystickActive.value = false

  clearJoystickTimer()

  joystickX.value = 0
  joystickY.value = 0
  knobX.value = 0
  knobY.value = 0

  if (selectedDeviceCode.value) {
    sendArmStop(selectedDeviceCode.value).catch(() => {})
  }
  statusText.value = '摇杆已停止'
}

function clearJoystickTimer() {
  if (joystickTimer !== null) {
    clearInterval(joystickTimer)
    joystickTimer = null
  }
}

// ===== 精确模式 =====
function togglePrecisionMode() {
  if (!selectedDevice.value || !selectedDeviceCode.value) {
    toast.show('请先选择设备', 'error')
    doShake()
    return
  }
  if (!isPrecisionMode.value) {
    // 进入精确模式：先停止摇杆
    stopJoystick()
  }
  isPrecisionMode.value = !isPrecisionMode.value
  statusText.value = isPrecisionMode.value ? '精确模式：拖动滑条设置角度' : '摇杆模式：拖动摇杆头转动'
}

async function doSendPosition(pos: { pan?: number; tilt?: number; slider?: number }) {
  if (!selectedDeviceCode.value) return
  try {
    await sendArmPosition(selectedDeviceCode.value, pos)
  } catch (error) {
    console.error('arm_position error =', error)
    const msg = getErrorMessage(error, '发送位置失败')
    toast.show(msg, 'error')
  }
}

function onPrecisionChange(field: 'pan' | 'tilt' | 'slider') {
  if (!selectedDeviceCode.value) return
  const pos: Record<string, number> = {}
  pos[field] = armPosition[field]
  doSendPosition(pos)
  statusText.value = `精确：${field}=${armPosition[field]}°${field === 'slider' ? ' mm' : ''}`
}

// ===== 预设动作 (保留兼容) =====
async function sendPreset(action: string) {
  errorText.value = ''
  if (!selectedDevice.value || !selectedDeviceCode.value) {
    errorText.value = '请先选择设备'
    toast.show('请先选择设备', 'error')
    doShake()
    return
  }
  submitting.value = true
  try {
    await sendArmAction(selectedDeviceCode.value, action)
    const label = presetActions.value.find(a => a.action === action)?.label || action
    statusText.value = `已发送：${selectedDeviceTypeText.value} / ${label}`
  } catch (error) {
    console.error('preset error =', error)
    const msg = getErrorMessage(error, '发送预设动作失败')
    errorText.value = msg
    toast.show(msg, 'error')
    doShake()
  } finally {
    submitting.value = false
  }
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

/* 速度按钮 */
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
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.speed-tab:hover {
  transform: translateY(-1px);
}

.speed-tab.active {
  background: rgba(64, 158, 255, 0.14);
  border-color: rgba(64, 158, 255, 0.55);
  color: #2563eb;
}

/* 模式切换按钮 */
.mode-toggle-btn {
  border: 1px solid rgba(64, 158, 255, 0.55);
  border-radius: 12px;
  padding: 10px 18px;
  background: rgba(64, 158, 255, 0.08);
  color: #2563eb;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.mode-toggle-btn:hover {
  background: rgba(64, 158, 255, 0.16);
}

.mode-toggle-btn.active {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.55);
  color: #16a34a;
}

.mode-toggle-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ===== 五层拟物摇杆 (参考 UI) ===== */
.joystick-section {
  margin-top: 18px;
}

/* 外层容器 */
.gimbal-control-block {
  width: 100%;
}

/* 左右布局：grid 230px 安全盒子 + 1fr 按钮区 */
.gimbal-control-row {
  display: grid;
  grid-template-columns: 230px 1fr;
  align-items: center;
  column-gap: 34px;
  width: 100%;
  max-width: 620px;
  margin: 16px 0 12px;
}

/* 摇杆安全盒子：固定 230px，包含箭头 */
.joystick-side {
  width: 230px;
  min-width: 230px;
  height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 230px;
}

/* 摇杆容器：pointer 事件 + 箭头定位上下文 */
.joystick-container {
  position: relative;
  width: 230px;
  height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.joystick-container:active {
  cursor: grabbing;
}

/* 按钮区：2×2 均分占满右侧 */
.gimbal-preset-side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  align-self: center;
}

/* 第一层：外圈 */
.joystick-around {
  position: relative;
  width: 170px;
  height: 170px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background-image: linear-gradient(0deg, #f5f8fa, #9da4a8);
}

/* 第二层：凹槽 */
.joystick-handle {
  width: 132px;
  height: 132px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background: #c5d1da;
  box-shadow:
    0 0 10px rgba(0, 0, 0, 0.5),
    0 10px 10px rgba(0, 0, 0, 0.2),
    inset 0 0 16px rgba(0, 0, 0, 0.85),
    inset 0 0 24px rgba(0, 0, 0, 0.75),
    inset 0 0 48px rgba(0, 0, 0, 0.2);
  perspective: 300px;
}

/* 第三层：摇杆按钮 (flex 居中，translate 位移) */
.joystick-button {
  width: 88px;
  height: 88px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background-image: linear-gradient(0deg, #86969c, #eff1f1);
  box-shadow:
    0 9px 14px rgba(0, 0, 0, 0.5),
    0 19px 8px -2px rgba(0, 0, 0, 0.2),
    0 33px 8px rgba(0, 0, 0, 0.4),
    0 -12px 10px rgba(255, 255, 255, 0.5),
    inset 0 3px 3px rgba(255, 255, 255, 0.6),
    inset 0 -3px 3px rgba(89, 91, 92, 0.6);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  pointer-events: none;
}

.joystick-button.active {
  transition: none;
}

/* 第四层：内圈 */
.joystick-inside {
  position: relative;  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-image: linear-gradient(180deg, #adb9bf, #d4dbdd);
  box-shadow:
    inset 0 3px 6px rgba(152, 160, 163, 0.4),
    inset 0 -3px 6px rgba(238, 244, 246, 0.4);
}

/* 第五层：四个定位点 */
.joystick-dot {
  position: absolute;
  transform: translate(-50%, -50%);  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e7ecef;
  box-shadow:
    0 2px 2px rgba(0, 0, 0, 0.3),
    inset 0 -2px 2px rgba(0, 0, 0, 0.2);
}

.joystick-dot:nth-child(1) {
  left: 50%;
  top: 10%;
}

.joystick-dot:nth-child(2) {
  left: 90%;
  top: 50%;
}

.joystick-dot:nth-child(3) {
  left: 50%;
  top: 90%;
}

.joystick-dot:nth-child(4) {
  left: 10%;
  top: 50%;
}

/* SVG 箭头 (安全盒子内部，像素定位) */
.joystick-icon {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 22px;
  fill: #b4b9bd;
  opacity: 0.72;
  pointer-events: none;
}

.joystick-icon-up {
  top: 27px;
  left: 50%;
  transform: translateX(-50%);
}

.joystick-icon-right {
  top: 50%;
  left: auto;
  right: 16px;
}

.joystick-icon-down {
  top: auto;
  bottom: 16px;
  left: 50%;
}

.joystick-icon-left {
  top: 50%;
  left: 27px;
  transform: translateY(-50%);
}

.joystick-icon.active {
  fill: #e3a560;
  opacity: 1;
  filter: brightness(0.9)
    drop-shadow(0 0 2px #e3a15b)
    drop-shadow(0 0 1px #fff);
}

/* ===== 精确模式 ===== */
.precision-section {
  margin-top: 18px;
}

.precision-card {
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 14px;
  padding: 16px;
  background: rgba(248, 250, 252, 0.82);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.precision-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.precision-row label {
  color: #1e293b;
  font-size: 14px;
  font-weight: 700;
}

.precision-row label strong {
  color: #2563eb;
  margin-left: 4px;
}

.precision-slider {
  width: 100%;
  accent-color: #2563eb;
}

/* 预设动作卡片 */
.preset-card {
  width: 100%;
  min-height: 68px;
  padding: 12px 14px;
  border-radius: 14px;
  text-align: left;
  background: #fff;
  border: 1px solid #e8edf5;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.preset-card:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
}

.preset-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preset-card strong {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.preset-card span {
  display: block;
  font-size: 12px;
  line-height: 1.4;
  color: #94a3b8;
}

.device-meta {
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 768px) {
  .gimbal-control-row {
    grid-template-columns: 1fr;
    row-gap: 16px;
    max-width: 100%;
  }

  .joystick-side {
    justify-self: center;
    width: 200px;
    min-width: 200px;
    height: 200px;
    flex: 0 0 200px;
  }

  .joystick-container {
    width: 200px;
    height: 200px;
  }

  .gimbal-preset-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .joystick-around {
    width: 150px;
    height: 150px;
  }

  .joystick-handle {
    width: 116px;
    height: 116px;
  }

  .joystick-button {
    width: 76px;
    height: 76px;
  }

  .joystick-inside {
    width: 62px;
    height: 62px;
  }

  .joystick-dot {
    width: 6px;
    height: 6px;
  }

  .joystick-icon {
    width: 24px;
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

}

@media (max-width: 480px) {
  .gimbal-preset-side {
    grid-template-columns: 1fr;
  }
}

:global(.app-container.night-mode) .panel-desc,
:global(.app-container.night-mode) .form-row label,
:global(.app-container.night-mode) .device-meta,
/* 暗夜模式微调 */
:global(.app-container.night-mode) .joystick-container,
:global(.app-container.night-mode) .joystick-around {
  background-image: linear-gradient(0deg, #1e2832, #3a424a);
}

:global(.app-container.night-mode) .joystick-handle {
  background: #2a333b;
}

:global(.app-container.night-mode) .joystick-button {
  background-image: linear-gradient(0deg, #3a454e, #5a646b);
}

:global(.app-container.night-mode) .joystick-inside {
  background-image: linear-gradient(180deg, #4a555e, #5e6972);
}

:global(.app-container.night-mode) .joystick-dot {
  background: #5a646c;
}

:global(.app-container.night-mode) .joystick-icon.active {
  fill: #e3a560;
}

:global(.app-container.night-mode) .preset-card strong,
:global(.app-container.night-mode) .precision-row label {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .speed-tab.active {
  color: #93c5fd;
}

:global(.app-container.night-mode) .speed-tab.active {
  background: rgba(37, 99, 235, 0.26);
  border-color: rgba(96, 165, 250, 0.45);
}
</style>
