<template>
  <div class="settings-card calibration-panel">
    <input
      ref="phoneInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="handlePhoneFileChange"
      @cancel="handlePhonePickerCancel"
    />

    <div class="panel-header">
      <div>
        <h2 class="settings-title">🧭 服装照射标定</h2>
        <p class="panel-desc">
          按拍摄设备分别保存识别点和标定模型；Camera 保持原自动对位拍摄流程，手机使用人工图片上传。
        </p>
      </div>
      <span class="model-badge" :class="{ ready: calibration?.modelReady }">
        {{ calibration?.modelReady ? '模型已启用' : calibration?.legacyMigrationRequired ? '待迁移' : '采集中' }}
      </span>
    </div>

    <div class="device-pair-grid">
      <label>
        <span>拍摄设备</span>
        <BaseSelect v-model="selectedCaptureDevice" :options="captureDeviceOptions" placeholder="选择拍摄设备" />
      </label>
      <label>
        <span>目标 Lamp</span>
        <BaseSelect v-model="selectedLampChipId" :options="lampOptions" placeholder="选择 Lamp" />
      </label>
    </div>

    <section v-if="calibration?.legacyMigrationRequired" class="legacy-card">
      <div>
        <strong>发现旧版标定数据 {{ calibration.legacySampleCount || 0 }} 条</strong>
        <p>请选择这些数据原来的拍摄设备。迁移只归类现有样本，不会重新计算 Pan/Tilt。</p>
      </div>
      <div class="migration-actions">
        <BaseSelect v-model="legacySourceSelection" :options="captureDeviceOptions" placeholder="选择原始拍摄设备" />
        <button type="button" class="btn-primary" :disabled="!legacySourceSelection || migrationLoading" @click="migrateLegacy">
          {{ migrationLoading ? '迁移中...' : '迁移旧数据' }}
        </button>
      </div>
    </section>

    <template v-else>
      <div class="calibration-progress">
        <div class="progress-head">
          <strong>{{ calibration?.sampleCount || 0 }} / {{ calibration?.recommendedSampleCount || 6 }} 个推荐样本</strong>
          <span>{{ calibration?.statusMessage || '请选择 Lamp 读取标定状态' }}</span>
        </div>
        <div class="progress-track" aria-hidden="true"><span :style="{ width: `${progressPercent}%` }"></span></div>
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
              <small v-if="calibration?.currentRecognizedAt">{{ formatTime(calibration.currentRecognizedAt) }}</small>
            </div>
            <span v-if="calibration?.currentTargetSampled" class="sampled-badge">已采样</span>
          </div>
          <div v-if="calibration?.currentTargetValid" class="target-plane">
            <span class="target-dot" :style="targetDotStyle" title="服装框中心"></span>
            <i class="axis-horizontal"></i><i class="axis-vertical"></i>
          </div>
          <p v-if="calibration?.currentTargetValid" class="coordinate-text">
            X {{ format(calibration.currentCenterX, 3) }} · Y {{ format(calibration.currentCenterY, 3) }}
          </p>
          <p v-else class="empty-hint">
            {{ selectedCaptureDevice === 'PHONE' ? '当前手机来源暂无识别点，请先用手机拍摄并识别' : '当前 Camera 暂无识别点，请先拍摄并识别' }}
          </p>
        </section>

        <section class="motor-card">
          <div class="section-title-row">
            <div><strong>手动调准 Lamp</strong><small>滑动后松手即下发精确位置</small></div>
            <button type="button" class="text-btn" :disabled="!canTestPrediction" @click="testPrediction">测试拟合位置</button>
          </div>
          <div v-for="axis in axes" :key="axis.key" class="motor-row">
            <div class="motor-label"><span>{{ axis.label }}</span><strong>{{ position[axis.key] }} {{ axis.unit }}</strong></div>
            <div class="motor-control">
              <button type="button" :disabled="!canMoveLamp" @click="nudge(axis.key, -axis.step)">−</button>
              <input v-model.number="position[axis.key]" type="range" :min="axis.min" :max="axis.max" :step="axis.step" :disabled="!canMoveLamp" @change="sendCurrentPosition" />
              <button type="button" :disabled="!canMoveLamp" @click="nudge(axis.key, axis.step)">＋</button>
              <input v-model.number="position[axis.key]" class="motor-number" type="number" :min="axis.min" :max="axis.max" :step="axis.step" :disabled="!canMoveLamp" @change="sendCurrentPosition" />
            </div>
          </div>
        </section>
      </div>

      <div class="calibration-actions">
        <button type="button" class="btn-secondary" :disabled="!canCapture || captureLoading" @click="captureNewPosition">
          {{ captureLoading ? '等待识别...' : '拍摄并识别新位置' }}
        </button>
        <button type="button" class="btn-primary" :disabled="!canConfirmSample || sampleLoading" @click="confirmSample">
          {{ sampleLoading ? '保存并拟合中...' : calibration?.currentTargetSampled ? '该位置已确认' : '照射正确，确认本次样本' }}
        </button>
        <button type="button" class="btn-danger" :disabled="!calibration?.sampleCount || clearLoading" @click="clearSamples">
          {{ clearLoading ? '清空中...' : '重置当前来源标定' }}
        </button>
      </div>

      <section v-if="calibration?.sampleCount" class="copy-card">
        <div class="sample-list-head">
          <div>
            <strong>复制标定到其他 Lamp</strong>
            <small>仅复制当前“{{ selectedSourceLabel }}”的标定 Profile；目标 Lamp 使用自己的默认服装角度。</small>
          </div>
          <button type="button" class="btn-secondary" :disabled="!copyTargetLampIds.length || copyLoading" @click="copyCalibration(false)">
            {{ copyLoading ? '复制中...' : '复制标定' }}
          </button>
        </div>
        <div class="copy-target-grid">
          <label v-for="lamp in copyTargetLamps" :key="lamp.chipId" class="copy-target">
            <input v-model="copyTargetLampIds" type="checkbox" :value="lamp.chipId" />
            <span>{{ deviceLabel(lamp) }}</span>
          </label>
        </div>
      </section>

      <div v-if="recentSamples.length" class="sample-list">
        <div class="sample-list-head"><strong>最近样本 · {{ selectedSourceLabel }}</strong><small>应尽量覆盖画面左、右、上、下和中心</small></div>
        <div v-for="(sample, index) in recentSamples" :key="sample.id" class="sample-row">
          <span>#{{ (calibration?.sampleCount || 0) - index }}</span>
          <span>图像 {{ format(sample.centerX, 2) }}, {{ format(sample.centerY, 2) }}</span>
          <span>Pan {{ format(sample.pan, 1) }}°</span><span>Tilt {{ format(sample.tilt, 1) }}°</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { createCamCaptureTask, sendArmPosition } from '../../api/device'
import { fabricRecognize } from '../../api/ai'
import {
  addSourceGarmentAimCalibrationSample,
  cameraSourceKey,
  clearSourceGarmentAimCalibration,
  copyGarmentAimCalibration,
  getSourceGarmentAimCalibration,
  migrateLegacyGarmentAimCalibration,
  phoneSourceKey,
  startCaptureLighting,
  stopCaptureLighting,
} from '../../api/garmentCalibration'
import type { GarmentCaptureSourceKey, SourceAwareGarmentAimCalibrationStatus } from '../../api/garmentCalibration'
import type { DeviceItem } from '../../types/device'
import { normalizeDeviceType } from '../../utils/device'
import { getErrorMessage } from '../../utils/error'
import { useToast } from '../../composables/useToast'
import BaseSelect from '../common/BaseSelect.vue'

type AxisKey = 'pan' | 'tilt'
const props = defineProps<{ devices: DeviceItem[] }>()
const toast = useToast()
const selectedCaptureDevice = ref<GarmentCaptureSourceKey>(phoneSourceKey())
const selectedLampChipId = ref('')
const calibration = ref<SourceAwareGarmentAimCalibrationStatus | null>(null)
const legacySourceSelection = ref<GarmentCaptureSourceKey>(phoneSourceKey())
const copyTargetLampIds = ref<string[]>([])
const phoneInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const captureLoading = ref(false)
const sampleLoading = ref(false)
const clearLoading = ref(false)
const migrationLoading = ref(false)
const copyLoading = ref(false)
const position = reactive<Record<AxisKey, number>>({ pan: 0, tilt: 20 })
let recognitionPoll: ReturnType<typeof setInterval> | null = null
let recognitionPollCount = 0
let lastSyncedRecognition = ''
let phoneCaptureLightingLamp = ''

const axes = [
  { key: 'pan' as const, label: 'Pan 水平', unit: '°', min: -90, max: 90, step: 1 },
  { key: 'tilt' as const, label: 'Tilt 俯仰', unit: '°', min: -90, max: 90, step: 1 },
]
const cameraDevices = computed(() => props.devices.filter((device) => ['cam', 'camlamp'].includes(normalizeDeviceType(device.deviceType))))
const lampDevices = computed(() => props.devices.filter((device) => ['lamp', 'camlamp'].includes(normalizeDeviceType(device.deviceType))))
const captureDeviceOptions = computed(() => [
  { label: '手机', value: phoneSourceKey() },
  ...cameraDevices.value.map(device => ({ label: `Camera · ${deviceLabel(device)}`, value: cameraSourceKey(device.chipId) })),
])
const lampOptions = computed(() => lampDevices.value.map(device => ({ label: deviceLabel(device), value: device.chipId })))
const selectedLamp = computed(() => lampDevices.value.find(device => device.chipId === selectedLampChipId.value))
const selectedCamera = computed(() => {
  if (!selectedCaptureDevice.value.startsWith('CAMERA:')) return undefined
  const chipId = selectedCaptureDevice.value.substring('CAMERA:'.length)
  return cameraDevices.value.find(device => device.chipId === chipId)
})
const copyTargetLamps = computed(() => lampDevices.value.filter(device => device.chipId !== selectedLampChipId.value))
const selectedSourceLabel = computed(() => selectedCaptureDevice.value === 'PHONE'
  ? '手机'
  : selectedCamera.value ? deviceLabel(selectedCamera.value) : selectedCaptureDevice.value.replace('CAMERA:', ''))
const canCapture = computed(() => selectedLamp.value?.online && (selectedCaptureDevice.value === 'PHONE' || selectedCamera.value?.online))
const canMoveLamp = computed(() => Boolean(selectedLamp.value?.online) && !loading.value && !calibration.value?.legacyMigrationRequired)
const canConfirmSample = computed(() => Boolean(canMoveLamp.value && calibration.value?.currentTargetValid && !calibration.value?.currentTargetSampled))
const canTestPrediction = computed(() => Boolean(canMoveLamp.value && calibration.value?.currentTargetValid && calibration.value?.modelReady))
const progressPercent = computed(() => Math.min(100, Math.round(((calibration.value?.sampleCount || 0) / (calibration.value?.recommendedSampleCount || 6)) * 100)))
const recentSamples = computed(() => calibration.value?.samples?.slice(0, 6) || [])
const targetDotStyle = computed(() => ({
  left: `${Math.max(0, Math.min(1, calibration.value?.currentCenterX || 0)) * 100}%`,
  top: `${Math.max(0, Math.min(1, calibration.value?.currentCenterY || 0)) * 100}%`,
}))

watch(lampOptions, (options) => {
  if (!options.some(option => option.value === selectedLampChipId.value)) selectedLampChipId.value = options[0]?.value || ''
}, { immediate: true })
watch([selectedLampChipId, selectedCaptureDevice], () => {
  stopRecognitionPoll(); void releasePhoneCaptureLighting()
  copyTargetLampIds.value = []; lastSyncedRecognition = ''
  position.pan = Math.round(selectedLamp.value?.garmentDefaultPan ?? 0)
  position.tilt = Math.round(selectedLamp.value?.garmentDefaultTilt ?? 20)
  void loadCalibration(true)
})
watch(() => selectedLamp.value?.updateTime, (value, previous) => { if (value && value !== previous) void loadCalibration(false) })
onBeforeUnmount(() => { stopRecognitionPoll(); void releasePhoneCaptureLighting() })

function deviceLabel(device: DeviceItem) {
  const name = device.displayName || '未分区'; const no = device.deviceNo ? `-${device.deviceNo}` : ''
  return `${name}${no} · ${device.chipId}${device.online ? '' : '（离线）'}`
}
async function loadCalibration(forceSync: boolean) {
  if (!selectedLampChipId.value) { calibration.value = null; return }
  loading.value = true
  try {
    const result = await getSourceGarmentAimCalibration(selectedLampChipId.value, selectedCaptureDevice.value)
    calibration.value = result
    if (result.legacyMigrationRequired && !legacySourceSelection.value) legacySourceSelection.value = phoneSourceKey()
    syncSuggestedPosition(result, forceSync)
  } catch (error) { toast.show(getErrorMessage(error, '读取标定状态失败'), 'error') }
  finally { loading.value = false }
}
function syncSuggestedPosition(result: SourceAwareGarmentAimCalibrationStatus, force: boolean) {
  const recognition = result.currentRecognizedAt || ''
  if (!force && recognition === lastSyncedRecognition) return
  if (result.suggestedPan != null) position.pan = Math.round(result.suggestedPan)
  if (result.suggestedTilt != null) position.tilt = Math.round(result.suggestedTilt)
  lastSyncedRecognition = recognition
}
async function captureNewPosition() {
  if (!selectedLampChipId.value || !canCapture.value) return
  stopRecognitionPoll()
  if (selectedCaptureDevice.value === 'PHONE') {
    captureLoading.value = true
    try {
      await startCaptureLighting(selectedLampChipId.value)
      phoneCaptureLightingLamp = selectedLampChipId.value
      phoneInputRef.value?.click()
    } catch (error) {
      captureLoading.value = false
      toast.show(getErrorMessage(error, '启用拍摄标准光照失败'), 'error')
    }
    return
  }
  const camera = selectedCamera.value; if (!camera) return
  captureLoading.value = true
  const previousRecognition = calibration.value?.currentRecognizedAt || ''
  try {
    await createCamCaptureTask({ camChipId: camera.chipId, targetChipId: selectedLampChipId.value })
    toast.show('Camera 对位拍摄任务已下发，请等待完整画面识别完成', 'success')
    startRecognitionPoll(previousRecognition, '等待识别超时，请检查 Camera 状态后重试')
  } catch (error) { captureLoading.value = false; toast.show(getErrorMessage(error, '创建拍摄任务失败'), 'error') }
}
async function handlePhoneFileChange(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''
  await releasePhoneCaptureLighting()
  if (!file || !selectedLampChipId.value) { captureLoading.value = false; return }
  const previousRecognition = calibration.value?.currentRecognizedAt || ''
  try {
    await fabricRecognize(file, selectedLampChipId.value); await loadCalibration(false)
    if (calibration.value?.currentRecognizedAt === previousRecognition) startRecognitionPoll(previousRecognition, '手机图片已上传，但等待识别点刷新超时')
    else captureLoading.value = false
    toast.show('手机图片识别完成', 'success')
  } catch (error) { captureLoading.value = false; toast.show(getErrorMessage(error, '手机图片识别失败'), 'error') }
}
async function handlePhonePickerCancel() { await releasePhoneCaptureLighting(); captureLoading.value = false }
async function releasePhoneCaptureLighting() {
  const lampChipId = phoneCaptureLightingLamp; phoneCaptureLightingLamp = ''
  if (!lampChipId) return
  try { await stopCaptureLighting(lampChipId) } catch (error) { console.warn('[garment-calibration] capture lighting stop failed', error) }
}
function startRecognitionPoll(previousRecognition: string, timeoutMessage: string) {
  recognitionPollCount = 0
  recognitionPoll = setInterval(async () => {
    recognitionPollCount += 1; await loadCalibration(false)
    if (calibration.value?.currentRecognizedAt && calibration.value.currentRecognizedAt !== previousRecognition) { captureLoading.value = false; stopRecognitionPoll() }
    else if (recognitionPollCount >= 24) { captureLoading.value = false; stopRecognitionPoll(); toast.show(timeoutMessage, 'error') }
  }, 2000)
}
function stopRecognitionPoll() { if (recognitionPoll) clearInterval(recognitionPoll); recognitionPoll = null; recognitionPollCount = 0 }
async function sendCurrentPosition() {
  if (!selectedLampChipId.value || !canMoveLamp.value) return; normalizePosition()
  try { await sendArmPosition(selectedLampChipId.value, { ...position }) } catch (error) { toast.show(getErrorMessage(error, 'Lamp 位置下发失败'), 'error') }
}
function nudge(key: AxisKey, amount: number) { const axis = axes.find(item => item.key === key); if (!axis) return; position[key] = Math.max(axis.min, Math.min(axis.max, position[key] + amount)); void sendCurrentPosition() }
function normalizePosition() { for (const axis of axes) { const value = Number(position[axis.key]); position[axis.key] = Math.max(axis.min, Math.min(axis.max, Number.isFinite(value) ? value : 0)) } }
async function confirmSample() {
  if (!selectedLampChipId.value || !canConfirmSample.value) return; sampleLoading.value = true; normalizePosition()
  try {
    await sendArmPosition(selectedLampChipId.value, { ...position })
    calibration.value = await addSourceGarmentAimCalibrationSample(selectedLampChipId.value, selectedCaptureDevice.value, { ...position })
    toast.show(calibration.value.modelReady ? '样本已保存，当前拍摄设备的标定模型已更新' : '样本已保存，请移动服装后继续采集', 'success')
  } catch (error) { toast.show(getErrorMessage(error, '保存标定样本失败'), 'error') } finally { sampleLoading.value = false }
}
async function testPrediction() { const value = calibration.value; if (!value || value.suggestedPan == null || value.suggestedTilt == null) return; position.pan = Math.round(value.suggestedPan); position.tilt = Math.round(value.suggestedTilt); await sendCurrentPosition(); toast.show('已下发当前拍摄设备识别点的拟合位置', 'success') }
async function clearSamples() {
  if (!selectedLampChipId.value || !calibration.value?.sampleCount || !window.confirm(`确定清空 ${selectedSourceLabel.value} 在这盏 Lamp 上的标定样本吗？`)) return
  clearLoading.value = true
  try { calibration.value = await clearSourceGarmentAimCalibration(selectedLampChipId.value, selectedCaptureDevice.value); syncSuggestedPosition(calibration.value, true); toast.show('当前拍摄设备的标定数据已清空', 'success') }
  catch (error) { toast.show(getErrorMessage(error, '清空标定数据失败'), 'error') } finally { clearLoading.value = false }
}
async function migrateLegacy() {
  if (!selectedLampChipId.value || !legacySourceSelection.value) return; migrationLoading.value = true
  try { const result = await migrateLegacyGarmentAimCalibration(selectedLampChipId.value, legacySourceSelection.value); selectedCaptureDevice.value = legacySourceSelection.value; calibration.value = result; toast.show(`旧版 ${result.sampleCount} 条标定数据已迁移到所选拍摄设备`, 'success') }
  catch (error) { toast.show(getErrorMessage(error, '迁移旧版标定数据失败'), 'error') } finally { migrationLoading.value = false }
}
async function copyCalibration(overwrite: boolean) {
  if (!selectedLampChipId.value || !copyTargetLampIds.value.length) return; copyLoading.value = true
  try {
    await copyGarmentAimCalibration(selectedLampChipId.value, { sourceKey: selectedCaptureDevice.value, targetLampChipIds: [...copyTargetLampIds.value], overwrite })
    toast.show(`已把“${selectedSourceLabel.value}”标定复制到 ${copyTargetLampIds.value.length} 盏 Lamp`, 'success'); copyTargetLampIds.value = []
  } catch (error) {
    const message = getErrorMessage(error, '复制标定失败')
    if (!overwrite && message.includes('已存在') && window.confirm(`${message}\n\n是否覆盖目标 Lamp 的同来源标定数据？`)) { copyLoading.value = false; await copyCalibration(true); return }
    toast.show(message, 'error')
  } finally { copyLoading.value = false }
}
function percent(value?: number) { return `${Math.round(Math.max(0, value || 0) * 100)}%` }
function format(value?: number, digits = 2) { return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--' }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
</script>

<style scoped>
.calibration-panel{min-width:0}.hidden-file-input{display:none}.panel-header,.section-title-row,.progress-head,.sample-list-head,.motor-label,.calibration-actions,.migration-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.panel-header,.sample-list-head{align-items:flex-start}.panel-desc{margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.5}.model-badge,.sampled-badge{flex:none;padding:5px 9px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:12px;font-weight:800}.model-badge.ready,.sampled-badge{background:#dcfce7;color:#15803d}.device-pair-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.device-pair-grid label>span{display:block;margin-bottom:6px;color:#64748b;font-size:12px;font-weight:700}.legacy-card,.calibration-progress,.target-card,.motor-card,.sample-list,.copy-card{margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.legacy-card{border-color:#fde68a;background:#fffbeb}.legacy-card p{margin:5px 0 12px;color:#92400e;font-size:12px}.migration-actions{justify-content:flex-start}.progress-head{align-items:flex-start}.progress-head span,.section-title-row small,.sample-list-head small{color:#64748b;font-size:12px;line-height:1.4}.progress-head span{max-width:66%;text-align:right}.progress-track{height:7px;margin-top:10px;overflow:hidden;border-radius:999px;background:#e2e8f0}.progress-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#2563eb);transition:width 220ms ease}.coverage-row{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:9px;color:#64748b;font-size:11px}.workflow-grid{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(280px,1.3fr);gap:12px}.section-title-row>div,.sample-list-head>div{display:flex;flex-direction:column;gap:3px}.target-plane{position:relative;height:150px;margin-top:12px;overflow:hidden;border-radius:12px;border:1px solid #cbd5e1;background:linear-gradient(rgba(148,163,184,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.11) 1px,transparent 1px),#fff;background-size:25% 25%}.axis-horizontal,.axis-vertical{position:absolute;background:rgba(59,130,246,.2)}.axis-horizontal{left:0;right:0;top:50%;height:1px}.axis-vertical{top:0;bottom:0;left:50%;width:1px}.target-dot{position:absolute;z-index:1;width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.2);transform:translate(-50%,-50%)}.coordinate-text,.empty-hint{margin:9px 0 0;color:#475569;font-size:12px;text-align:center}.empty-hint{display:grid;min-height:150px;place-items:center;color:#94a3b8}.motor-row{margin-top:12px}.motor-label{color:#475569;font-size:12px}.motor-label strong{color:#2563eb}.motor-control{display:grid;grid-template-columns:34px minmax(80px,1fr) 34px 72px;gap:7px;align-items:center;margin-top:5px}.motor-control button,.text-btn{border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#2563eb;cursor:pointer;font-weight:800}.motor-control button{min-height:34px}.motor-control input[type='range']{width:100%;accent-color:#2563eb}.motor-number{width:100%;min-width:0;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:7px;background:#fff;color:#0f172a}.text-btn{padding:6px 9px;font-size:11px}.calibration-actions{justify-content:flex-end;margin-top:14px}.btn-primary,.btn-secondary,.btn-danger{min-height:38px;border:none;border-radius:10px;padding:8px 13px;cursor:pointer;font-weight:800}.btn-primary{color:#fff;background:linear-gradient(135deg,#3b82f6,#2563eb)}.btn-secondary{color:#2563eb;background:#eef4ff}.btn-danger{color:#dc2626;background:#fff1f2}button:disabled,input:disabled{cursor:not-allowed;opacity:.55}.copy-target-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.copy-target{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-size:12px}.sample-row{display:grid;grid-template-columns:38px 1.2fr repeat(2,1fr);gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;color:#475569;font-size:11px}:global(.app-container.night-mode) .legacy-card,:global(.app-container.night-mode) .calibration-progress,:global(.app-container.night-mode) .target-card,:global(.app-container.night-mode) .motor-card,:global(.app-container.night-mode) .sample-list,:global(.app-container.night-mode) .copy-card{border-color:rgba(148,163,184,.18);background:rgba(15,23,42,.58)}:global(.app-container.night-mode) .target-plane,:global(.app-container.night-mode) .motor-number,:global(.app-container.night-mode) .copy-target{border-color:rgba(148,163,184,.28);background-color:rgba(30,41,59,.9);color:#e2e8f0}:global(.app-container.night-mode) .motor-label,:global(.app-container.night-mode) .coordinate-text,:global(.app-container.night-mode) .sample-row{color:rgba(203,213,225,.84)}@media(max-width:768px){.calibration-panel{padding:12px}.device-pair-grid,.workflow-grid,.copy-target-grid{grid-template-columns:1fr}.progress-head,.migration-actions{flex-direction:column;align-items:stretch;gap:6px}.progress-head span{max-width:none;text-align:left}.target-plane{height:130px}.sample-row{grid-template-columns:30px 1fr 1fr}.calibration-actions{flex-wrap:wrap}}
</style>
