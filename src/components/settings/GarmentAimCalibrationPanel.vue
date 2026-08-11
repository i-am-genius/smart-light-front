<template>
  <div class="settings-card calibration-panel">
    <div class="panel-header">
      <div>
        <h2 class="settings-title">🧭 服装照射标定</h2>
        <p class="panel-desc">
          移动服装并重新拍摄，手动把灯调准后确认。样本会自动拟合图像位置到电机位置。
        </p>
      </div>
      <span class="model-badge" :class="{ ready: calibration?.modelReady }">
        {{ calibration?.modelReady ? '模型已启用' : '采集中' }}
      </span>
    </div>

    <div class="device-pair-grid">
      <label>
        <span>拍摄 Camera</span>
        <BaseSelect
          v-model="selectedCamChipId"
          :options="cameraOptions"
          placeholder="选择 Camera"
        />
      </label>
      <label>
        <span>目标 Lamp</span>
        <BaseSelect
          v-model="selectedLampChipId"
          :options="lampOptions"
          placeholder="选择 Lamp"
        />
      </label>
      <label>
        <span>Camera 目标区域</span>
        <BaseSelect v-model="targetIndex" :options="targetOptions" />
      </label>
      <button
        type="button"
        class="btn-secondary capture-btn"
        :disabled="!canCapture || captureLoading"
        @click="captureNewPosition"
      >
        {{ captureLoading ? '等待识别...' : '拍摄并识别新位置' }}
      </button>
    </div>

    <div class="calibration-progress">
      <div class="progress-head">
        <strong>{{ calibration?.sampleCount || 0 }} / {{ calibration?.recommendedSampleCount || 6 }} 个推荐样本</strong>
        <span>{{ calibration?.statusMessage || '请选择 Lamp 读取标定状态' }}</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <span :style="{ width: `${progressPercent}%` }"></span>
      </div>
      <div v-if="calibration" class="coverage-row">
        <span>横向覆盖 {{ percent(calibration.horizontalCoverage) }}</span>
        <span>纵向覆盖 {{ percent(calibration.verticalCoverage) }}</span>
        <span v-if="calibration.modelReady">Pan 误差 {{ format(calibration.rmsePan) }}°</span>
        <span v-if="calibration.modelReady">Tilt 误差 {{ format(calibration.rmseTilt) }}°</span>
      </div>
    </div>

    <div class="workflow-grid">
      <section class="target-card" :class="{ empty: !calibration?.currentTargetValid }">
        <div class="section-title-row">
          <div>
            <strong>当前服装识别点</strong>
            <small v-if="calibration?.currentRecognizedAt">
              {{ formatTime(calibration.currentRecognizedAt) }}
            </small>
          </div>
          <span v-if="calibration?.currentTargetSampled" class="sampled-badge">已采样</span>
        </div>
        <div v-if="calibration?.currentTargetValid" class="target-plane">
          <span
            class="target-dot"
            :style="targetDotStyle"
            title="服装框中心"
          ></span>
          <i class="axis-horizontal"></i>
          <i class="axis-vertical"></i>
        </div>
        <p v-if="calibration?.currentTargetValid" class="coordinate-text">
          X {{ format(calibration.currentCenterX, 3) }} · Y {{ format(calibration.currentCenterY, 3) }}
        </p>
        <p v-else class="empty-hint">先拍摄并完成一次有效服装识别</p>
      </section>

      <section class="motor-card">
        <div class="section-title-row">
          <div>
            <strong>手动调准 Lamp</strong>
            <small>滑动后松手即下发精确位置</small>
          </div>
          <button
            type="button"
            class="text-btn"
            :disabled="!canTestPrediction"
            @click="testPrediction"
          >
            测试拟合位置
          </button>
        </div>

        <div v-for="axis in axes" :key="axis.key" class="motor-row">
          <div class="motor-label">
            <span>{{ axis.label }}</span>
            <strong>{{ position[axis.key] }} {{ axis.unit }}</strong>
          </div>
          <div class="motor-control">
            <button type="button" :disabled="!canMoveLamp" @click="nudge(axis.key, -axis.step)">−</button>
            <input
              v-model.number="position[axis.key]"
              type="range"
              :min="axis.min"
              :max="axis.max"
              :step="axis.step"
              :disabled="!canMoveLamp"
              @change="sendCurrentPosition"
            />
            <button type="button" :disabled="!canMoveLamp" @click="nudge(axis.key, axis.step)">＋</button>
            <input
              v-model.number="position[axis.key]"
              class="motor-number"
              type="number"
              :min="axis.min"
              :max="axis.max"
              :step="axis.step"
              :disabled="!canMoveLamp"
              @change="sendCurrentPosition"
            />
          </div>
        </div>
      </section>
    </div>

    <div class="calibration-actions">
      <button
        type="button"
        class="btn-primary"
        :disabled="!canConfirmSample || sampleLoading"
        @click="confirmSample"
      >
        {{ sampleLoading ? '保存并拟合中...' : calibration?.currentTargetSampled ? '该位置已确认' : '照射正确，确认本次样本' }}
      </button>
      <button
        type="button"
        class="btn-danger"
        :disabled="!calibration?.sampleCount || clearLoading"
        @click="clearSamples"
      >
        {{ clearLoading ? '清空中...' : '重置标定' }}
      </button>
    </div>

    <div v-if="recentSamples.length" class="sample-list">
      <div class="sample-list-head">
        <strong>最近样本</strong>
        <small>应尽量覆盖画面左、右、上、下和中心</small>
      </div>
      <div v-for="(sample, index) in recentSamples" :key="sample.id" class="sample-row">
        <span>#{{ (calibration?.sampleCount || 0) - index }}</span>
        <span>图像 {{ format(sample.centerX, 2) }}, {{ format(sample.centerY, 2) }}</span>
        <span>Pan {{ format(sample.pan, 1) }}°</span>
        <span>Tilt {{ format(sample.tilt, 1) }}°</span>
        <span>滑轨 {{ format(sample.slider, 0) }} mm</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  addGarmentAimCalibrationSample,
  clearGarmentAimCalibration,
  createCamCaptureTask,
  getGarmentAimCalibration,
  sendArmPosition,
} from '../../api/device'
import type {
  DeviceItem,
  GarmentAimCalibrationStatus,
} from '../../types/device'
import { normalizeDeviceType } from '../../utils/device'
import { getErrorMessage } from '../../utils/error'
import { useToast } from '../../composables/useToast'
import BaseSelect from '../common/BaseSelect.vue'

type AxisKey = 'pan' | 'tilt' | 'slider'

const props = defineProps<{ devices: DeviceItem[] }>()
const toast = useToast()

const selectedCamChipId = ref('')
const selectedLampChipId = ref('')
const targetIndex = ref('1')
const calibration = ref<GarmentAimCalibrationStatus | null>(null)
const loading = ref(false)
const captureLoading = ref(false)
const sampleLoading = ref(false)
const clearLoading = ref(false)
const position = reactive<Record<AxisKey, number>>({ pan: 0, tilt: 20, slider: 0 })
let recognitionPoll: ReturnType<typeof setInterval> | null = null
let recognitionPollCount = 0
let lastSyncedRecognition = ''

const axes: Array<{
  key: AxisKey
  label: string
  unit: string
  min: number
  max: number
  step: number
}> = [
  { key: 'pan', label: 'Pan 水平', unit: '°', min: -90, max: 90, step: 1 },
  { key: 'tilt', label: 'Tilt 俯仰', unit: '°', min: -90, max: 90, step: 1 },
  { key: 'slider', label: 'Slider 滑轨', unit: 'mm', min: 0, max: 1200, step: 10 },
]

const cameraDevices = computed(() => props.devices.filter((device) => {
  const type = normalizeDeviceType(device.deviceType)
  return type === 'cam' || type === 'camlamp'
}))

const lampDevices = computed(() => props.devices.filter((device) => {
  const type = normalizeDeviceType(device.deviceType)
  return type === 'lamp' || type === 'camlamp'
}))

const cameraOptions = computed(() => cameraDevices.value.map(device => ({
  label: deviceLabel(device),
  value: device.chipId,
})))

const lampOptions = computed(() => lampDevices.value.map(device => ({
  label: deviceLabel(device),
  value: device.chipId,
})))

const targetOptions = [1, 2, 3].map(value => ({ label: `区域 ${value}`, value: String(value) }))

const selectedCamera = computed(() => cameraDevices.value.find(
  device => device.chipId === selectedCamChipId.value,
))
const selectedLamp = computed(() => lampDevices.value.find(
  device => device.chipId === selectedLampChipId.value,
))

const canCapture = computed(() => Boolean(
  selectedCamera.value?.online && selectedLamp.value?.online,
))
const canMoveLamp = computed(() => Boolean(selectedLamp.value?.online) && !loading.value)
const canConfirmSample = computed(() => Boolean(
  canMoveLamp.value
  && calibration.value?.currentTargetValid
  && !calibration.value?.currentTargetSampled,
))
const canTestPrediction = computed(() => Boolean(
  canMoveLamp.value
  && calibration.value?.currentTargetValid
  && calibration.value?.modelReady,
))
const progressPercent = computed(() => {
  const target = calibration.value?.recommendedSampleCount || 6
  return Math.min(100, Math.round(((calibration.value?.sampleCount || 0) / target) * 100))
})
const recentSamples = computed(() => calibration.value?.samples?.slice(0, 6) || [])
const targetDotStyle = computed(() => ({
  left: `${Math.max(0, Math.min(1, calibration.value?.currentCenterX || 0)) * 100}%`,
  top: `${Math.max(0, Math.min(1, calibration.value?.currentCenterY || 0)) * 100}%`,
}))

watch(cameraOptions, (options) => {
  if (!options.some(option => option.value === selectedCamChipId.value)) {
    selectedCamChipId.value = options[0]?.value || ''
  }
}, { immediate: true })

watch(lampOptions, (options) => {
  if (!options.some(option => option.value === selectedLampChipId.value)) {
    selectedLampChipId.value = options[0]?.value || ''
  }
}, { immediate: true })

watch(selectedLampChipId, () => {
  lastSyncedRecognition = ''
  void loadCalibration(true)
})

watch(
  () => selectedLamp.value?.updateTime,
  (value, previous) => {
    if (value && value !== previous) void loadCalibration(false)
  },
)

onBeforeUnmount(stopRecognitionPoll)

function deviceLabel(device: DeviceItem) {
  const name = device.displayName || '未分区'
  const no = device.deviceNo ? `-${device.deviceNo}` : ''
  return `${name}${no} · ${device.chipId}${device.online ? '' : '（离线）'}`
}

async function loadCalibration(forceSync: boolean) {
  if (!selectedLampChipId.value) {
    calibration.value = null
    return
  }
  loading.value = true
  try {
    const result = await getGarmentAimCalibration(selectedLampChipId.value)
    calibration.value = result
    syncSuggestedPosition(result, forceSync)
  } catch (error) {
    toast.show(getErrorMessage(error, '读取标定状态失败'), 'error')
  } finally {
    loading.value = false
  }
}

function syncSuggestedPosition(result: GarmentAimCalibrationStatus, force: boolean) {
  const recognition = result.currentRecognizedAt || ''
  if (!force && recognition === lastSyncedRecognition) return
  if (result.suggestedPan != null) position.pan = Math.round(result.suggestedPan)
  if (result.suggestedTilt != null) position.tilt = Math.round(result.suggestedTilt)
  if (result.suggestedSlider != null) position.slider = Math.round(result.suggestedSlider / 10) * 10
  lastSyncedRecognition = recognition
}

async function captureNewPosition() {
  if (!selectedCamChipId.value || !selectedLampChipId.value) return
  stopRecognitionPoll()
  captureLoading.value = true
  const previousRecognition = calibration.value?.currentRecognizedAt || ''
  try {
    await createCamCaptureTask({
      camChipId: selectedCamChipId.value,
      targetChipId: selectedLampChipId.value,
      targetIndex: Number(targetIndex.value),
    })
    toast.show('拍摄任务已下发，请等待识别完成', 'success')
    recognitionPollCount = 0
    recognitionPoll = setInterval(async () => {
      recognitionPollCount += 1
      await loadCalibration(false)
      if (calibration.value?.currentRecognizedAt
          && calibration.value.currentRecognizedAt !== previousRecognition) {
        captureLoading.value = false
        stopRecognitionPoll()
      } else if (recognitionPollCount >= 24) {
        captureLoading.value = false
        stopRecognitionPoll()
        toast.show('等待识别超时，请检查 Camera 状态后重试', 'error')
      }
    }, 2000)
  } catch (error) {
    captureLoading.value = false
    toast.show(getErrorMessage(error, '创建拍摄任务失败'), 'error')
  }
}

function stopRecognitionPoll() {
  if (recognitionPoll) clearInterval(recognitionPoll)
  recognitionPoll = null
  recognitionPollCount = 0
}

async function sendCurrentPosition() {
  if (!selectedLampChipId.value || !canMoveLamp.value) return
  normalizePosition()
  try {
    await sendArmPosition(selectedLampChipId.value, { ...position })
  } catch (error) {
    toast.show(getErrorMessage(error, 'Lamp 位置下发失败'), 'error')
  }
}

function nudge(key: AxisKey, amount: number) {
  const axis = axes.find(item => item.key === key)
  if (!axis) return
  position[key] = Math.max(axis.min, Math.min(axis.max, position[key] + amount))
  void sendCurrentPosition()
}

function normalizePosition() {
  for (const axis of axes) {
    const value = Number(position[axis.key])
    position[axis.key] = Math.max(axis.min, Math.min(axis.max, Number.isFinite(value) ? value : 0))
  }
}

async function confirmSample() {
  if (!selectedLampChipId.value || !canConfirmSample.value) return
  sampleLoading.value = true
  normalizePosition()
  try {
    const result = await addGarmentAimCalibrationSample(
      selectedLampChipId.value,
      { ...position },
    )
    calibration.value = result
    toast.show(
      result.modelReady
        ? '样本已保存，标定模型已自动更新'
        : '样本已保存，请移动服装后继续采集',
      'success',
    )
  } catch (error) {
    toast.show(getErrorMessage(error, '保存标定样本失败'), 'error')
  } finally {
    sampleLoading.value = false
  }
}

async function testPrediction() {
  const value = calibration.value
  if (!value || value.suggestedPan == null || value.suggestedTilt == null
      || value.suggestedSlider == null) return
  position.pan = Math.round(value.suggestedPan)
  position.tilt = Math.round(value.suggestedTilt)
  position.slider = Math.round(value.suggestedSlider / 10) * 10
  await sendCurrentPosition()
  toast.show('已下发当前识别点的拟合位置', 'success')
}

async function clearSamples() {
  if (!selectedLampChipId.value || !calibration.value?.sampleCount) return
  if (!window.confirm('确定清空这盏 Lamp 的全部标定样本和拟合模型吗？')) return
  clearLoading.value = true
  try {
    calibration.value = await clearGarmentAimCalibration(selectedLampChipId.value)
    toast.show('标定数据已清空，Lamp 将回退到默认坐标换算', 'success')
  } catch (error) {
    toast.show(getErrorMessage(error, '清空标定数据失败'), 'error')
  } finally {
    clearLoading.value = false
  }
}

function percent(value?: number) {
  return `${Math.round(Math.max(0, value || 0) * 100)}%`
}

function format(value?: number, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '--'
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
</script>

<style scoped>
.calibration-panel {
  min-width: 0;
}

.panel-header,
.section-title-row,
.progress-head,
.sample-list-head,
.motor-label,
.calibration-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header {
  align-items: flex-start;
}

.panel-desc {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.model-badge,
.sampled-badge {
  flex: none;
  padding: 5px 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.model-badge.ready,
.sampled-badge {
  background: #dcfce7;
  color: #15803d;
}

.device-pair-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.device-pair-grid label > span {
  display: block;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.capture-btn {
  align-self: end;
}

.calibration-progress,
.target-card,
.motor-card,
.sample-list {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
}

.progress-head {
  align-items: flex-start;
}

.progress-head span,
.section-title-row small,
.sample-list-head small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.progress-head span {
  max-width: 66%;
  text-align: right;
}

.progress-track {
  height: 7px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #2563eb);
  transition: width 220ms ease;
}

.coverage-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 9px;
  color: #64748b;
  font-size: 11px;
}

.workflow-grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(280px, 1.3fr);
  gap: 12px;
}

.section-title-row > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.target-plane {
  position: relative;
  height: 150px;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  background:
    linear-gradient(rgba(148, 163, 184, 0.11) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.11) 1px, transparent 1px),
    #fff;
  background-size: 25% 25%;
}

.axis-horizontal,
.axis-vertical {
  position: absolute;
  background: rgba(59, 130, 246, 0.2);
}

.axis-horizontal { left: 0; right: 0; top: 50%; height: 1px; }
.axis-vertical { top: 0; bottom: 0; left: 50%; width: 1px; }

.target-dot {
  position: absolute;
  z-index: 1;
  width: 16px;
  height: 16px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2), 0 5px 12px rgba(15, 23, 42, 0.25);
  transform: translate(-50%, -50%);
}

.coordinate-text,
.empty-hint {
  margin: 9px 0 0;
  color: #475569;
  font-size: 12px;
  text-align: center;
}

.empty-hint {
  display: grid;
  min-height: 150px;
  place-items: center;
  color: #94a3b8;
}

.motor-row {
  margin-top: 12px;
}

.motor-label {
  color: #475569;
  font-size: 12px;
}

.motor-label strong {
  color: #2563eb;
}

.motor-control {
  display: grid;
  grid-template-columns: 34px minmax(80px, 1fr) 34px 72px;
  gap: 7px;
  align-items: center;
  margin-top: 5px;
}

.motor-control button,
.text-btn {
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  background: #eff6ff;
  color: #2563eb;
  cursor: pointer;
  font-weight: 800;
}

.motor-control button {
  min-height: 34px;
}

.motor-control input[type='range'] {
  width: 100%;
  accent-color: #2563eb;
}

.motor-number {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: 7px;
  background: #fff;
  color: #0f172a;
}

.text-btn {
  padding: 6px 9px;
  font-size: 11px;
}

.calibration-actions {
  justify-content: flex-end;
  margin-top: 14px;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  min-height: 38px;
  border: none;
  border-radius: 10px;
  padding: 8px 13px;
  cursor: pointer;
  font-weight: 800;
}

.btn-primary { color: #fff; background: linear-gradient(135deg, #3b82f6, #2563eb); }
.btn-secondary { color: #2563eb; background: #eef4ff; }
.btn-danger { color: #dc2626; background: #fff1f2; }

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.sample-list-head {
  align-items: flex-start;
}

.sample-row {
  display: grid;
  grid-template-columns: 38px 1.2fr repeat(3, 1fr);
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  color: #475569;
  font-size: 11px;
}

:global(.app-container.night-mode) .calibration-progress,
:global(.app-container.night-mode) .target-card,
:global(.app-container.night-mode) .motor-card,
:global(.app-container.night-mode) .sample-list {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.58);
}

:global(.app-container.night-mode) .target-plane,
:global(.app-container.night-mode) .motor-number {
  border-color: rgba(148, 163, 184, 0.28);
  background-color: rgba(30, 41, 59, 0.9);
  color: #e2e8f0;
}

:global(.app-container.night-mode) .motor-label,
:global(.app-container.night-mode) .coordinate-text,
:global(.app-container.night-mode) .sample-row {
  color: rgba(203, 213, 225, 0.84);
}

@media (max-width: 768px) {
  .calibration-panel { padding: 12px; }
  .device-pair-grid,
  .workflow-grid { grid-template-columns: 1fr; }
  .progress-head { flex-direction: column; gap: 4px; }
  .progress-head span { max-width: none; text-align: left; }
  .target-plane { height: 130px; }
  .sample-row { grid-template-columns: 30px 1fr 1fr; }
  .sample-row span:nth-child(4),
  .sample-row span:nth-child(5) { grid-column: auto; }
}
</style>
