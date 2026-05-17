<template>
  <div class="device-card-wrapper">
  <div class="lamp-card">
    <div class="card-header clickable-header" @click="handleHeaderClick">
      <div class="device-title-block">
        <h3>{{ displayNameText }}</h3>
        <p class="last-seen-under-name">
          上次在线：{{ !device.online ? (lastSeenText || '未知') : '当前在线' }}
        </p>
      </div>

      <span class="status-badge" :class="{ online: device.online, offline: !device.online }">
        {{ device.online ? '在线' : '离线' }}
      </span>
    </div>

    <label class="field-label">亮度：{{ displayBrightness }}</label>
    <input
      :value="sliderBrightnessValue"
      type="range"
      min="0"
      max="100"
      :disabled="!!localForm.autoMode"
      @input="handleBrightnessInput"
    />

    <label class="field-label">色温：{{ displayTemp }}</label>
    <input
      :value="sliderTempValue"
      type="range"
      min="2700"
      max="6500"
      step="100"
      :disabled="!!localForm.autoMode"
      @input="handleTempInput"
    />

    <label class="checkbox-row">
      <input
        v-model="localForm.autoMode"
        type="checkbox"
        @change="handleAutoModeChange"
      />
      自动模式
    </label>

    <label class="field-label">面料：{{ localForm.fabric || '未设置' }}</label>

<div
  class="color-box"
  :style="{
    background: rgbStyle,
    color: textColor,
  }"
>
  {{ "RGB(" + (localForm.mainColorRgb || '暂无主色') + ")" }}
</div>

<div class="ai-actions">
  <template v-if="isLamp">
    <input
      ref="fabricInputRef"
      class="hidden-file-input"
      type="file"
      accept="image/*"
      @change="handleFabricFileChange"
    />

    <button
      class="btn-ai"
      :disabled="fabricLoading"
      @click.stop="openFabricUpload"
    >
      {{ fabricLoading ? '识别中...' : '上传服装图片' }}
    </button>
    <button
      v-if="annotatedImageBase64"
      class="btn-ai btn-preview"
      type="button"
      @click.stop="openClothPreviewModal"
    >
      查看分割图
    </button>
  </template>

  <template v-if="isCamLamp">
    <button
      class="btn-ai"
      :class="{ active: flowEnabled }"
      :disabled="flowLoading"
      @click.stop="handleToggleFlowUpload"
    >
      {{
        flowLoading
          ? '下发中...'
          : flowEnabled
            ? '停止人流监测'
            : '开启人流监测'
      }}
    </button>
  </template>
</div>

<div class="card-actions">
      <button class="btn-secondary" @click="resetForm">重置</button>
      <button class="btn-danger" :disabled="deleting" @click="handleDelete">
        {{ deleting ? '删除中...' : '删除' }}
      </button>
    </div>
  </div>

<Teleport to="body">
  <Transition name="detail-overlay-fade">
    <div
      v-if="showDetailModal"
      class="device-detail-overlay"
      @click.self="closeDetailModal"
    >
      <Transition name="detail-card-pop" appear>
        <div class="device-detail-modal">
          <div class="detail-modal-header">
            <div>
              <h3>{{ displayNameText }}</h3>
              <p class="detail-subtitle">{{ device.online ? '在线' : '离线' }}</p>
            </div>
            <button class="detail-close-btn" @click="closeDetailModal">×</button>
          </div>

          <div class="detail-modal-body">
            <div class="detail-info-item">
              <span class="detail-label">设备类型</span>
              <span class="detail-value">{{ displayDeviceType }}</span>
            </div>

            <section class="firmware-section">
              <h4>固件升级</h4>

              <label class="modal-label">固件通道</label>
              <BaseSelect
                v-model="firmwareChannel"
                :options="firmwareChannelOptions"
                :disabled="otaStarting || otaStatusValue === 'updating'"
              />

              <div class="firmware-info-grid">
                <div class="firmware-info-item">
                  <span>当前固件</span>
                  <strong>{{ firmwareVersionText }}</strong>
                </div>

                <div class="firmware-info-item">
                  <span>OTA状态</span>
                  <strong>{{ otaStatusText }}</strong>
                </div>
              </div>

              <div
                v-if="showOtaProgress || otaCheckResult || otaMessage"
                class="ota-feedback-slot"
              >
                <div v-if="showOtaProgress" class="ota-progress-box" :class="otaProgressBoxClass">
                  <div class="ota-progress-head">
                    <span>{{ otaProgressTitle }}</span>
                    <strong>{{ otaProgressText }}</strong>
                  </div>
                  <div class="ota-progress-track" aria-hidden="true">
                    <div
                      class="ota-progress-fill"
                      :style="{ width: `${otaProgressFillWidth}%` }"
                    ></div>
                  </div>
                  <div class="ota-progress-sub">{{ otaProgressSubText }}</div>
                </div>

                <p v-else-if="otaMessage" class="ota-error-msg">
                  {{ otaMessage }}
                </p>

                <div v-else-if="otaCheckResult" class="ota-result">
                  <div>{{ otaUpdateText }}</div>
                  <div v-if="otaCheckResult.changelog" class="modal-hint">
                    更新说明：{{ otaCheckResult.changelog }}
                  </div>
                </div>
              </div>

              <div class="detail-modal-actions ota-actions">
                <button class="btn-secondary" :disabled="otaChecking" @click="handleCheckFirmwareUpdate">
                  {{ otaChecking ? '检查中...' : '检查更新' }}
                </button>
                <button
                  class="btn-primary"
                  :disabled="!canStartOta"
                  @click="handleStartOtaUpdate"
                >
                  {{ otaStarting ? '下发中...' : '确认更新' }}
                </button>
              </div>
            </section>

            <div class="detail-info-item">
              <span class="detail-label">IP</span>
              <span class="detail-value">{{ localForm.ip || '未设置' }}</span>
            </div>

            <label class="modal-label">所属分区</label>
            <input
              v-model.trim="localForm.displayName"
              class="modal-input"
              type="text"
              placeholder="如 新品展示区、橱窗区、主通道区"
            />

            <label class="modal-label">分区内编号</label>
            <input
              v-model.trim="localForm.deviceNo"
              class="modal-input"
              type="text"
              inputmode="numeric"
              pattern="[1-9][0-9]*"
              placeholder="从 1 开始，如 1、2、3"
            />

            <!-- <p class="modal-hint">
              编号从 1 开始，同一分区内不能重复。
            </p> -->

            <p v-if="deviceNoError" class="modal-error">
              {{ deviceNoError }}
            </p>
          </div>

          <div class="detail-modal-actions detail-modal-footer">
            <button class="btn-secondary" @click="closeDetailModal">取消</button>
            <button class="btn-primary" @click="saveDeviceBaseInfo">保存</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</Teleport>
<Teleport to="body">
  <Transition name="detail-overlay-fade">
    <div
      v-if="showClothPreviewModal"
      class="device-detail-overlay"
      @click.self="closeClothPreviewModal"
    >
      <Transition name="detail-card-pop" appear>
        <div class="cloth-preview-modal">
        <div class="detail-modal-header">
          <div>
            <h3>服装区域分割结果</h3>
            <p class="detail-subtitle">
              {{ clothDetected === false ? '未检测到明确服装区域，已使用回退结果' : '已分割服装区域' }}
            </p>
          </div>
          <button class="detail-close-btn" @click="closeClothPreviewModal">×</button>
        </div>

        <div class="cloth-preview-content">
          <div class="cloth-preview-image-wrap">
            <img
              class="cloth-preview-image"
              :src="annotatedImageSrc"
              alt="服装区域分割结果"
            />
          </div>

          <div class="ai-reason-card">
            <div class="ai-reason-title">AI推荐理由</div>

            <template v-if="lightRecommendationHasData">
              <div class="ai-reason-section">
                <span class="ai-reason-label">主色分析</span>
                <p>{{ lightRecommendationReason.colorTone }}</p>
              </div>

              <div class="ai-reason-section">
                <span class="ai-reason-label">面料特征</span>
                <p>{{ lightRecommendationReason.fabricFeature }}</p>
              </div>

              <div class="ai-reason-section">
                <span class="ai-reason-label">亮度建议</span>
                <p>{{ lightRecommendationReason.brightnessReason }}</p>
              </div>

              <div class="ai-reason-section">
                <span class="ai-reason-label">色温建议</span>
                <p>{{ lightRecommendationReason.tempReason }}</p>
              </div>
            </template>

            <div class="ai-reason-summary">{{ lightRecommendationReason.summary }}</div>
          </div>
        </div>

        <div class="detail-modal-actions">
          <button class="btn-secondary" @click="closeClothPreviewModal">关闭</button>
        </div>
      </div>
      </Transition>
    </div>
  </Transition>
</Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import BaseSelect from '../common/BaseSelect.vue'
import type {
  DeviceCreatePayload,
  DeviceItem,
  FirmwareChannel,
  OtaCheckResult,
} from '../../types/device'
import { fabricRecognize } from '../../api/ai'
import {
  setFlowUpload,
  locateDevice,
  checkFirmwareUpdate,
  startOtaUpdate,
} from '../../api/device'
import { generateLightRecommendationReason } from '../../utils/lightRecommendationReason'
import { getErrorMessage } from '../../utils/error'

const props = defineProps<{
  device: DeviceItem
  deleting?: boolean
  allDevices?: DeviceItem[]
}>()

const emit = defineEmits<{
  (e: 'update-realtime', value: { id: number; payload: DeviceCreatePayload; lightControl?: boolean }): void
  (e: 'delete', id: number): void
}>()

const localForm = reactive<DeviceCreatePayload>({
  chipId: '',
  ip: '',
  displayName: '',
  deviceType: '',
  deviceNo: '',
  brightness: 50,
  temp: 4000,
  autoMode: false,
  recommendedBrightness: 50,
  recommendedTemp: 4000,
  fabric: '',
  mainColorRgb: '',
})

const showDetailModal = ref(false)
const fabricInputRef = ref<HTMLInputElement | null>(null)
const fabricLoading = ref(false)
const flowLoading = ref(false)
const flowEnabled = ref(false)
const annotatedImageBase64 = ref('')
function normalizeBase64ImageSrc(value: string) {
  const rawValue = value.trim()
  if (!rawValue) {
    return ''
  }

  const dataUriMatch = rawValue.match(/^(data:image\/[a-zA-Z0-9.+-]+;base64,)([\s\S]*)$/i)
  if (dataUriMatch) {
    const base64Value = dataUriMatch[2].replace(/\s/g, '')
    return base64Value ? `${dataUriMatch[1]}${base64Value}` : ''
  }

  const base64Value = rawValue.replace(/\s/g, '')

  if (!base64Value) {
    return ''
  }

  return `data:image/jpeg;base64,${base64Value}`
}

const annotatedImageSrc = computed(() => {
  const value = annotatedImageBase64.value
  if (!value) {
    return ''
  }
  return normalizeBase64ImageSrc(value)
})
const lightRecommendationHasData = computed(() => {
  return Boolean(
    localForm.fabric?.trim() ||
    localForm.mainColorRgb?.trim() ||
    props.device.recommendedBrightness !== undefined ||
    props.device.recommendedTemp !== undefined ||
    localForm.recommendedBrightness !== 50 ||
    localForm.recommendedTemp !== 4000,
  )
})
const lightRecommendationReason = computed(() => {
  const hasData = lightRecommendationHasData.value

  return generateLightRecommendationReason({
    fabric: localForm.fabric,
    mainColorRgb: localForm.mainColorRgb,
    recommendedBrightness: hasData ? localForm.recommendedBrightness : null,
    recommendedTemp: hasData ? localForm.recommendedTemp : null,
  })
})
const clothDetected = ref<boolean | null>(null)
const showClothPreviewModal = ref(false)
const firmwareChannel = ref<FirmwareChannel>('stable')
const otaChecking = ref(false)
const otaStarting = ref(false)
const otaCheckResult = ref<OtaCheckResult | null>(null)
const otaMessage = ref('')
const hideOldOtaTerminalStatus = ref(false)

const localOtaUpdating = ref(false)
const realOtaProgress = computed(() => clampProgress(props.device.otaProgress))
const displayOtaProgress = ref(0)
const displayOtaProgressFloat = ref(0)
const displaySpeed = ref(0)
const estimatedRealProgress = ref(0)
const lastRealProgress = ref(0)
const lastRealProgressAt = ref(0)
const estimatedMsPerPercent = ref(800)
const hasRealOtaProgress = ref(false)
type OtaProgressMode = 'normal' | 'crawl' | 'wait' | 'catchup'
const progressMode = ref<OtaProgressMode>('normal')
let otaProgressTimer: ReturnType<typeof setInterval> | null = null
let lastTickAt = 0

function clampProgress(value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(numericValue)))
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.max(min, Math.min(max, value))
}

function clampMsPerPercent(value: number, realProgress = lastRealProgress.value) {
  if (!Number.isFinite(value)) {
    return realProgress < 10 ? 800 : realProgress < 20 ? 500 : 500
  }
  const minMs = realProgress < 10 ? 800 : realProgress < 20 ? 500 : 120
  return Math.max(minMs, Math.min(1500, value))
}

function resolveNormalSpeed(realProgress: number) {
  const maxSpeed = realProgress < 10 ? 0.8 : realProgress < 20 ? 1.5 : 2.5
  return clampNumber(1000 / estimatedMsPerPercent.value, 0.4, maxSpeed)
}

function resolveTargetSpeed(currentDisplay: number, realProgress: number, softMaxAllowed: number, hardMaxAllowed: number) {
  if (!hasRealOtaProgress.value) {
    progressMode.value = currentDisplay < 3 ? 'crawl' : 'wait'
    return currentDisplay < 3 ? 0.25 : 0
  }

  if (currentDisplay >= hardMaxAllowed) {
    progressMode.value = 'wait'
    return 0
  }

  const realGap = realProgress - currentDisplay
  if (realGap >= 20) {
    progressMode.value = 'catchup'
    return 4
  }
  if (realGap >= 10) {
    progressMode.value = 'catchup'
    return 3
  }

  if (progressMode.value === 'crawl') {
    if (currentDisplay < softMaxAllowed - 1) {
      progressMode.value = 'normal'
    } else if (currentDisplay >= hardMaxAllowed) {
      progressMode.value = 'wait'
    }
  } else if (progressMode.value === 'wait') {
    if (currentDisplay < softMaxAllowed - 1) {
      progressMode.value = 'normal'
    } else if (currentDisplay < hardMaxAllowed - 1) {
      progressMode.value = 'crawl'
    }
  } else if (currentDisplay > softMaxAllowed + 1) {
    progressMode.value = 'crawl'
  } else if (currentDisplay < softMaxAllowed - 1) {
    progressMode.value = 'normal'
  }

  if (progressMode.value === 'crawl') {
    return realProgress < 10 ? 0.2 : realProgress < 20 ? 0.28 : 0.35
  }
  if (progressMode.value === 'wait') {
    return 0
  }

  const normalSpeed = resolveNormalSpeed(realProgress)
  const softGap = softMaxAllowed - currentDisplay
  if (softGap >= 8) {
    progressMode.value = 'catchup'
    return Math.min(realProgress < 20 ? 2 : 3, Math.max(normalSpeed, 2))
  }
  progressMode.value = 'normal'
  return normalSpeed
}

function resetOtaProgressState(keepLocalUpdating = false) {
  stopOtaProgressTimer()
  if (!keepLocalUpdating) {
    localOtaUpdating.value = false
  }
  displayOtaProgress.value = 0
  displayOtaProgressFloat.value = 0
  displaySpeed.value = 0
  estimatedRealProgress.value = 0
  lastRealProgress.value = 0
  lastRealProgressAt.value = 0
  estimatedMsPerPercent.value = 800
  hasRealOtaProgress.value = false
  progressMode.value = 'normal'
  lastTickAt = 0
}

function startOtaProgressTimer() {
  if (otaProgressTimer) {
    return
  }
  const now = Date.now()
  if (!lastRealProgressAt.value) {
    lastRealProgressAt.value = now
  }
  lastTickAt = now
  otaProgressTimer = setInterval(tickOtaProgress, 200)
}

function stopOtaProgressTimer() {
  if (!otaProgressTimer) {
    return
  }
  clearInterval(otaProgressTimer)
  otaProgressTimer = null
}

function calibrateRealOtaProgress(realProgress: number) {
  const now = Date.now()
  const previousReal = lastRealProgress.value
  const previousAt = lastRealProgressAt.value

  if (!hasRealOtaProgress.value) {
    hasRealOtaProgress.value = true
    lastRealProgress.value = realProgress
    lastRealProgressAt.value = now
    estimatedRealProgress.value = Math.max(estimatedRealProgress.value, realProgress)
    return
  }

  if (realProgress > previousReal) {
    const elapsed = now - previousAt
    const delta = realProgress - previousReal
    if (elapsed > 0 && delta > 0) {
      const segmentMsPerPercent = clampMsPerPercent(elapsed / delta, realProgress)
      estimatedMsPerPercent.value = clampMsPerPercent(
        estimatedMsPerPercent.value * 0.65 + segmentMsPerPercent * 0.35,
        realProgress,
      )
    }
    lastRealProgress.value = realProgress
    lastRealProgressAt.value = now
    estimatedRealProgress.value = Math.max(estimatedRealProgress.value, realProgress)
    return
  }

  lastRealProgressAt.value = previousAt || now
}

function tickOtaProgress() {
  const status = otaStatusValue.value
  const realProgress = realOtaProgress.value

  if (status === 'success' || realProgress >= 100) {
    displayOtaProgress.value = 100
    displayOtaProgressFloat.value = 100
    displaySpeed.value = 0
    estimatedRealProgress.value = 100
    hideOldOtaTerminalStatus.value = false
    localOtaUpdating.value = false
    stopOtaProgressTimer()
    return
  }

  if (status === 'failed') {
    const retainedProgress = clampProgress(Math.max(realProgress, displayOtaProgress.value, lastRealProgress.value))
    displayOtaProgress.value = Math.max(displayOtaProgress.value, retainedProgress)
    displayOtaProgressFloat.value = Math.max(displayOtaProgressFloat.value, displayOtaProgress.value)
    estimatedRealProgress.value = Math.max(estimatedRealProgress.value, retainedProgress)
    displaySpeed.value = 0
    hideOldOtaTerminalStatus.value = false
    localOtaUpdating.value = false
    stopOtaProgressTimer()
    return
  }

  if (status === 'idle') {
    resetOtaProgressState()
    return
  }

  const now = Date.now()
  const dt = lastTickAt > 0 ? Math.max(0.05, Math.min(1, (now - lastTickAt) / 1000)) : 0.2
  lastTickAt = now

  const currentDisplay = displayOtaProgressFloat.value
  const elapsed = Math.max(0, now - (lastRealProgressAt.value || now))
  const rawEstimate = hasRealOtaProgress.value
    ? lastRealProgress.value + elapsed / estimatedMsPerPercent.value
    : 0

  estimatedRealProgress.value = Math.max(
    estimatedRealProgress.value,
    lastRealProgress.value,
    Math.min(99, lastRealProgress.value + 8, rawEstimate),
  )

  const softMaxAllowed = hasRealOtaProgress.value
    ? Math.min(99, Math.max(realProgress, estimatedRealProgress.value + 2))
    : 3
  const hardMaxAllowed = hasRealOtaProgress.value
    ? Math.min(99, Math.max(softMaxAllowed, realProgress + 8, estimatedRealProgress.value + 4))
    : 3

  const targetSpeed = resolveTargetSpeed(currentDisplay, realProgress, softMaxAllowed, hardMaxAllowed)
  displaySpeed.value = displaySpeed.value * 0.85 + targetSpeed * 0.15

  let nextFloat = currentDisplay + displaySpeed.value * dt
  if (currentDisplay < hardMaxAllowed) {
    nextFloat = Math.min(nextFloat, hardMaxAllowed)
  } else {
    nextFloat = currentDisplay
  }
  nextFloat = Math.min(99, nextFloat)

  displayOtaProgressFloat.value = Math.max(displayOtaProgressFloat.value, nextFloat)
  displayOtaProgress.value = Math.max(displayOtaProgress.value, Math.floor(displayOtaProgressFloat.value))
}

function syncOtaProgressState(status: string, realProgress: number, previousStatus?: string) {
  if (status === 'success' || realProgress >= 100) {
    displayOtaProgress.value = 100
    displayOtaProgressFloat.value = 100
    displaySpeed.value = 0
    estimatedRealProgress.value = 100
    lastRealProgress.value = 100
    lastRealProgressAt.value = Date.now()
    hideOldOtaTerminalStatus.value = false
    localOtaUpdating.value = false
    stopOtaProgressTimer()
    return
  }

  if (status === 'failed') {
    const retainedProgress = clampProgress(Math.max(realProgress, displayOtaProgress.value, lastRealProgress.value))
    displayOtaProgress.value = Math.max(displayOtaProgress.value, retainedProgress)
    displayOtaProgressFloat.value = Math.max(displayOtaProgressFloat.value, displayOtaProgress.value)
    estimatedRealProgress.value = Math.max(estimatedRealProgress.value, retainedProgress)
    lastRealProgress.value = retainedProgress
    lastRealProgressAt.value = Date.now()
    displaySpeed.value = 0
    hideOldOtaTerminalStatus.value = false
    localOtaUpdating.value = false
    stopOtaProgressTimer()
    return
  }

  if (status === 'idle') {
    resetOtaProgressState()
    return
  }

  if (status === 'updating' || localOtaUpdating.value) {
    if (status === 'updating') {
      hideOldOtaTerminalStatus.value = false
    }
    if (previousStatus !== 'updating' && realProgress === 0) {
      displayOtaProgress.value = 0
      displayOtaProgressFloat.value = 0
      displaySpeed.value = 0
      estimatedRealProgress.value = 0
      lastRealProgress.value = 0
      estimatedMsPerPercent.value = 800
      hasRealOtaProgress.value = false
      progressMode.value = 'normal'
      lastTickAt = Date.now()
    }
    calibrateRealOtaProgress(realProgress)
    startOtaProgressTimer()
  }
}

const otaProgressFillWidth = computed(() => {
  return Math.max(displayOtaProgress.value, Math.min(100, displayOtaProgressFloat.value))
})

const showOtaProgress = computed(() => {
  const status = otaStatusValue.value
  if (localOtaUpdating.value) return true
  if (status === 'updating') return true
  if ((status === 'success' || status === 'failed') && !hideOldOtaTerminalStatus.value) {
    return true
  }
  return false
})

const otaProgressText = computed(() => `${clampProgress(displayOtaProgress.value)}%`)

const otaProgressTitle = computed(() => {
  if (otaStatusValue.value === 'success' || realOtaProgress.value >= 100) {
    return '更新成功'
  }
  if (otaStatusValue.value === 'failed') {
    return '更新失败'
  }
  return 'OTA 更新中'
})

const otaProgressSubText = computed(() => {
  if (otaStatusValue.value === 'success' || realOtaProgress.value >= 100) {
    return '固件已写入完成，设备将自动重启'
  }
  if (otaStatusValue.value === 'failed') {
    return '更新失败，请检查设备供电和网络后重试'
  }
  return '设备正在下载并写入固件，请保持供电和网络连接'
})

const otaProgressBoxClass = computed(() => ({
  success: otaStatusValue.value === 'success' || realOtaProgress.value >= 100,
  failed: otaStatusValue.value === 'failed',
}))

const firmwareChannelOptions = [
  { label: '正式版', value: 'stable' },
  { label: '测试版', value: 'test' },
]

function openClothPreviewModal() {
  showClothPreviewModal.value = true
}

function closeClothPreviewModal() {
  showClothPreviewModal.value = false
}

function openDetailModal() {
  showDetailModal.value = true
}

function closeDetailModal() {
  showDetailModal.value = false
}

const locating = ref(false)

async function silentLocateDevice() {
  const chipId = localForm.chipId || props.device.chipId

  if (!chipId) return
  if (locating.value) return

  locating.value = true

  try {
    await locateDevice(chipId)
  } catch (error) {
    console.warn('静默定位失败，可能设备离线：', error)
  } finally {
    locating.value = false
  }
}

function handleHeaderClick() {
  openDetailModal()
  silentLocateDevice()
}

const deviceNoError = computed(() => {
  const zoneName = localForm.displayName?.trim()
  const deviceNo = localForm.deviceNo?.trim()

  if (!zoneName) {
    return '所属分区不能为空'
  }

  if (!deviceNo) {
    return '分区内编号不能为空'
  }

  if (!/^[1-9]\d*$/.test(deviceNo)) {
    return '分区内编号必须是从 1 开始的正整数'
  }

  const duplicated = (props.allDevices || []).some(item => {
    if (item.id === props.device.id) return false

    const sameZone = (item.displayName || '').trim() === zoneName
    const sameNo = (item.deviceNo || '').trim() === deviceNo

    return sameZone && sameNo
  })

  if (duplicated) {
    return `「${zoneName}」分区内已经存在编号 ${deviceNo}`
  }

  return ''
})

function saveDeviceBaseInfo() {
  if (deviceNoError.value) {
    window.alert(deviceNoError.value)
    return
  }

  emitRealtimeUpdate()
  showDetailModal.value = false
}

const lastSeenText = computed(() => {
  const value = props.device.lastSeen
  if (!value) return ''

  const timestamp = value < 1e12 ? value * 1000 : value
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')

  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
})

const firmwareVersionText = computed(() => {
  const version = props.device.firmwareVersion || 'unknown'
  const code = props.device.firmwareVersionCode
  return code == null ? version : `${version} (${code})`
})

const otaStatusValue = computed(() => props.device.otaStatus || 'idle')

const otaStatusText = computed(() => {
  const map: Record<string, string> = {
    idle: '空闲',
    updating: '更新中',
    success: '更新成功',
    failed: '更新失败',
  }
  return map[otaStatusValue.value] || otaStatusValue.value
})

const otaUpdateText = computed(() => {
  const result = otaCheckResult.value
  if (!result) return ''
  if (!result.latestVersion) return '当前通道暂无可用固件'
  if (!result.hasUpdate) {
    return '当前已是该通道最新版本'
  }
  return `发现新版本 ${result.latestVersion}`
})

const canStartOta = computed(() => {
  return Boolean(
    otaCheckResult.value?.hasUpdate &&
    otaCheckResult.value.firmwareId &&
    !otaChecking.value &&
    !otaStarting.value &&
    otaStatusValue.value !== 'updating' &&
    !localOtaUpdating.value,
  )
})

async function handleCheckFirmwareUpdate() {
  if (!localForm.chipId) return
  stopOtaProgressTimer()
  localOtaUpdating.value = false
  hideOldOtaTerminalStatus.value = true
  otaChecking.value = true
  otaMessage.value = ''
  otaCheckResult.value = null

  try {
    otaCheckResult.value = await checkFirmwareUpdate(localForm.chipId, firmwareChannel.value)
  } catch (error) {
    console.error('checkFirmwareUpdate error =', error)
    otaMessage.value = getErrorMessage(error, '检查更新失败')
  } finally {
    otaChecking.value = false
  }
}

async function handleStartOtaUpdate() {
  if (!localForm.chipId || !otaCheckResult.value?.firmwareId) return

  const firmwareId = otaCheckResult.value.firmwareId
  const target = otaCheckResult.value.latestVersion || 'selected firmware'
  if (!window.confirm(`确认更新到 ${target} 吗？`)) return

  otaStarting.value = true
  otaMessage.value = ''

  try {
    await startOtaUpdate(
      localForm.chipId,
      firmwareId,
      firmwareChannel.value,
    )
    otaCheckResult.value = null
    otaMessage.value = ''
    hideOldOtaTerminalStatus.value = false
    localOtaUpdating.value = true
    resetOtaProgressState(true)
    startOtaProgressTimer()
  } catch (error) {
    console.error('startOtaUpdate error =', error)
    localOtaUpdating.value = false
    stopOtaProgressTimer()
    otaMessage.value = getErrorMessage(error, 'OTA更新指令下发失败')
  } finally {
    otaStarting.value = false
  }
}

function syncFromProps() {
  localForm.chipId = props.device.chipId
  localForm.ip = props.device.ip || ''
  localForm.displayName = props.device.displayName || ''
  localForm.deviceType = props.device.deviceType || ''
  localForm.deviceNo = props.device.deviceNo || ''
  localForm.brightness = props.device.brightness ?? 50
  localForm.temp = props.device.temp ?? 4000
  localForm.autoMode = props.device.autoMode ?? false
  localForm.recommendedBrightness = props.device.recommendedBrightness ?? 50
  localForm.recommendedTemp = props.device.recommendedTemp ?? 4000
  localForm.fabric = props.device.fabric || ''
  localForm.mainColorRgb = props.device.mainColorRgb || ''
  firmwareChannel.value = props.device.firmwareChannel === 'test' ? 'test' : 'stable'
  flowEnabled.value = Boolean(
  (props.device as any).flowEnabled ??
  (props.device as any).flowAutoUpload ??
  false
  )
}

watch(
  () => props.device,
  () => {
    syncFromProps()
  },
  { immediate: true, deep: true },
)

watch(
  () => props.device.chipId,
  () => {
    resetOtaProgressState()
  },
)

watch(
  [otaStatusValue, realOtaProgress],
  ([status, progress], oldValue) => {
    const previousStatus = Array.isArray(oldValue) ? oldValue[0] : undefined
    syncOtaProgressState(status, progress, previousStatus)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopOtaProgressTimer()
})

function resetForm() {
  syncFromProps()
}

function emitRealtimeUpdate(lightControl = false) {
  emit('update-realtime', {
    id: props.device.id,
    lightControl,
    payload: {
      chipId: localForm.chipId,
      ip: localForm.ip || '',
      displayName: localForm.displayName || '',
      deviceType: localForm.deviceType || '',
      deviceNo: localForm.deviceNo || '',
      brightness: localForm.brightness ?? 50,
      temp: localForm.temp ?? 4000,
      autoMode: localForm.autoMode ?? false,
      recommendedBrightness: localForm.recommendedBrightness ?? 50,
      recommendedTemp: localForm.recommendedTemp ?? 4000,
      fabric: localForm.fabric || '',
      mainColorRgb: localForm.mainColorRgb || '',
      
    },
  })
}

function handleBrightnessInput(event: Event) {
  if (localForm.autoMode) return
  const target = event.target as HTMLInputElement
  localForm.brightness = Number(target.value)
  emitRealtimeUpdate(true)
}

function handleTempInput(event: Event) {
  if (localForm.autoMode) return
  const target = event.target as HTMLInputElement
  localForm.temp = Number(target.value)
  emitRealtimeUpdate(true)
}

function handleAutoModeChange() {
  emitRealtimeUpdate(true)
}

function openFabricUpload() {
  fabricInputRef.value?.click()
}

const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB

async function handleFabricFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  if (file.size > MAX_IMAGE_SIZE) {
    window.alert('图片大小不能超过 20MB，请压缩后再上传')
    input.value = ''
    return
  }

  if (!localForm.chipId) {
    window.alert('设备缺少 chipId，无法上传面料识别图片')
    input.value = ''
    return
  }

  fabricLoading.value = true

  try {
    const result = await fabricRecognize(file, localForm.chipId)

    const fabricName = result.fabric || result.label || ''

    if (fabricName) {
      localForm.fabric = fabricName
    }

    if (result.mainColorRgb !== undefined) {
      localForm.mainColorRgb = result.mainColorRgb || ''
    }

    if (result.recommendedBrightness !== undefined) {
      localForm.recommendedBrightness = result.recommendedBrightness
    }

    if (result.recommendedTemp !== undefined) {
      localForm.recommendedTemp = result.recommendedTemp
    }

    if (result.annotatedImageBase64) {
      annotatedImageBase64.value = result.annotatedImageBase64
    }

    if (result.clothDetected !== undefined) {
      clothDetected.value = result.clothDetected
    }

    emitRealtimeUpdate()
  } catch (error) {
    console.error('面料识别失败：', error)
    const message = error instanceof Error && error.message
      ? error.message
      : '面料识别失败，请稍后重试'
    window.alert(message)
  } finally {
    fabricLoading.value = false
    input.value = ''
  }
}

async function handleToggleFlowUpload() {
  if (!localForm.chipId) {
    //window.alert('设备缺少芯片ID，无法下发人流监测命令')
    return
  }

  const nextEnabled = !flowEnabled.value
  flowLoading.value = true

  try {
    await setFlowUpload(localForm.chipId, nextEnabled)

    flowEnabled.value = nextEnabled

    //window.alert(nextEnabled ? '已开启人流监测' : '已停止人流监测')
  } catch (error) {
    console.error('人流监测命令下发失败：', error)
    //window.alert('人流监测命令下发失败')
  } finally {
    flowLoading.value = false
  }
}

function handleDelete() {
  const targetName = displayNameText.value || displayDeviceNo.value || '该设备'
  if (!window.confirm(`确认删除设备 ${targetName} 吗？`)) return
  emit('delete', props.device.id)
}

const displayNameText = computed(() => {
  const zoneName = props.device.displayName?.trim() || '未分区'
  const deviceNo = props.device.deviceNo?.trim()

  if (deviceNo) {
    return `${zoneName} · 灯具-${deviceNo}`
  }

  return zoneName
})

const displayDeviceNo = computed(() => {
  return props.device.deviceNo?.trim() || '未设置'
})

const displayDeviceType = computed(() => {
  return props.device.deviceType?.trim() || '未知'
})
const normalizedDeviceType = computed(() => {
  return String(localForm.deviceType || props.device.deviceType || '')
    .replace(/[-_\s]/g, '')
    .toLowerCase()
})

const isLamp = computed(() => normalizedDeviceType.value === 'lamp')
const isCamLamp = computed(() => normalizedDeviceType.value === 'camlamp')

const displayBrightness = computed(() => {
  return localForm.autoMode
    ? (localForm.recommendedBrightness ?? localForm.brightness ?? 0)
    : (localForm.brightness ?? 0)
})

const displayTemp = computed(() => {
  return localForm.autoMode
    ? (localForm.recommendedTemp ?? localForm.temp ?? 4000)
    : (localForm.temp ?? 4000)
})

const sliderBrightnessValue = computed(() => {
  return localForm.autoMode
    ? (localForm.recommendedBrightness ?? localForm.brightness ?? 0)
    : (localForm.brightness ?? 0)
})

const sliderTempValue = computed(() => {
  return localForm.autoMode
    ? (localForm.recommendedTemp ?? localForm.temp ?? 4000)
    : (localForm.temp ?? 4000)
})

const rgbStyle = computed(() => {
  const raw = localForm.mainColorRgb
  if (!raw) return '#888'
  if (raw.startsWith('rgb')) return raw
  return `rgb(${raw})`
})

const textColor = computed(() => {
  const raw = localForm.mainColorRgb
  if (!raw) return '#fff'

  const nums = raw.match(/\d+/g)
  if (!nums || nums.length < 3) return '#fff'

  const [r, g, b] = nums.map(Number)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 186 ? '#000' : '#fff'
})
</script>

<style scoped>

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.device-title-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.device-title-block h3 {
  margin: 0;
}

.last-seen-under-name {
  margin: 6px 0 0;
  font-size: 14px;
  color: #8a8a8a;
  line-height: 1.4;
}

.status-badge {
  flex-shrink: 0;
  white-space: nowrap;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.online {
  background: #e8f7ed;
  color: #18a058;
  animation: breathe 2s ease-in-out infinite;
}

.status-badge.offline {
  background: #fef0f0;
  color: #f56c6c;
}

@keyframes breathe {
  0%, 100% { opacity: 0.9; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.08); }
}


.clickable-header {
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.clickable-header:hover {
  transform: translateY(-1px);
  opacity: 0.96;
}

.device-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
}

.device-detail-modal {
  position: relative;
  z-index: 2001;
  width: 420px;
  max-width: 92vw;
  max-height: calc(100vh - 80px);
  overflow: hidden;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}

.detail-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 14px;
  flex-shrink: 0;
}

.detail-modal-header h3 {
  margin: 0;
}

.detail-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: #8a8a8a;
}

.detail-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 22px 16px;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.detail-modal-footer {
  position: sticky;
  bottom: 0;
  flex-shrink: 0;
  margin-top: 0;
  padding: 14px 22px 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), #ffffff 34%);
  border-top: 1px solid #eef2f7;
}

.detail-close-btn {
  border: none;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #333;
}

.detail-info-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 12px;
}

.detail-label {
  color: #64748b;
}

.detail-value {
  color: #0f172a;
  font-weight: 600;
}

.detail-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.firmware-section {
  margin: 12px 0;
  padding: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.firmware-section h4 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
}

.firmware-info-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.firmware-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #eef2f7;
}

.firmware-info-item span {
  color: #64748b;
  font-size: 13px;
}

.firmware-info-item strong {
  color: #0f172a;
  font-size: 13px;
  text-align: right;
  word-break: break-all;
}

.ota-feedback-slot {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ota-result {
  padding: 9px 10px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 13px;
  line-height: 1.5;
  max-height: 92px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.ota-progress-box {
  padding: 10px 12px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 12px;
  background: #eef4ff;
  color: #1d4ed8;
}

.ota-progress-box.success {
  border-color: rgba(22, 163, 74, 0.22);
  background: #ecfdf3;
  color: #15803d;
}

.ota-progress-box.failed {
  border-color: rgba(220, 38, 38, 0.22);
  background: #fff1f2;
  color: #b91c1c;
}

.ota-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
}

.ota-progress-head strong {
  font-size: 14px;
  color: inherit;
}

.ota-progress-track {
  height: 8px;
  margin-top: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.16);
}

.ota-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  transition: width 180ms ease;
}

.ota-progress-box.success .ota-progress-track {
  background: rgba(22, 163, 74, 0.16);
}

.ota-progress-box.success .ota-progress-fill {
  background: linear-gradient(90deg, #86efac, #16a34a);
}

.ota-progress-box.failed .ota-progress-track {
  background: rgba(220, 38, 38, 0.14);
}

.ota-progress-box.failed .ota-progress-fill {
  background: linear-gradient(90deg, #fca5a5, #dc2626);
}

.ota-progress-sub {
  margin-top: 7px;
  color: rgba(30, 64, 175, 0.78);
  font-size: 12px;
  line-height: 1.45;
}

.ota-progress-box.success .ota-progress-sub {
  color: rgba(21, 128, 61, 0.78);
}

.ota-progress-box.failed .ota-progress-sub {
  color: rgba(185, 28, 28, 0.78);
}

.ota-error-msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff1f0;
  border: 1px solid rgba(245, 63, 63, 0.18);
  color: #b91c1c;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.ota-actions {
  margin-top: 10px;
  flex-wrap: wrap;
}
/* 遮罩：只淡入淡出 */
.detail-overlay-fade-enter-active,
.detail-overlay-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.detail-overlay-fade-enter-from,
.detail-overlay-fade-leave-to {
  opacity: 0;
}

.detail-overlay-fade-enter-to,
.detail-overlay-fade-leave-from {
  opacity: 1;
}

.lamp-card,
.placeholder-card {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.lamp-card h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

.color-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  min-width: 180px;
  height: 40px;
  text-align: center;
  border-radius: 12px;
  border: 1px solid #ccc;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.08);
  padding: 0 12px;
}

.lamp-card input[type='range'] {
  width: 100%;
  margin-top: 6px;
}

.lamp-card input[type='range']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-label {
  display: block;
  margin-top: 12px;
  margin-bottom: 6px;
  font-size: 14px;
  color: #606266;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: #606266;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

/* 卡片：单独弹入弹出 */
.detail-card-pop-enter-active {
  transition:
    opacity 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.detail-card-pop-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.4, 0, 1, 1),
    transform 240ms cubic-bezier(0.4, 0, 1, 1),
    filter 240ms cubic-bezier(0.4, 0, 1, 1);
}

.detail-card-pop-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.94);
  filter: blur(10px);
}

.detail-card-pop-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.detail-card-pop-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.detail-card-pop-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
  filter: blur(8px);
}

.ai-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  margin-bottom: 4px;
}

.hidden-file-input {
  display: none;
}

.btn-ai {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  background: #eef4ff;
  color: #1677ff;
  transition: all 0.2s ease;
}


.btn-ai:hover {
  background: #dbeafe;
}

.btn-ai.active {
  background: #fff1f0;
  color: #f53f3f;
}

.btn-ai:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-preview {
  margin-left: 8px;
}

.cloth-preview-modal {
  position: relative;
  z-index: 2001;
  width: min(980px, 92vw);
  max-height: 88vh;
  overflow: auto;
  background: #fff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.24);
}

.cloth-preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.9fr);
  gap: 16px;
  align-items: start;
  margin-top: 14px;
}

.cloth-preview-image-wrap {
  min-width: 0;
}

.cloth-preview-image {
  width: 100%;
  max-height: 560px;
  object-fit: contain;
  border-radius: 14px;
  background: #f6f7f9;
}

.ai-reason-card {
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  max-height: 560px;
  overflow-y: auto;
}

.ai-reason-title {
  margin-bottom: 10px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
}

.ai-reason-section {
  margin-top: 10px;
}

.ai-reason-label {
  display: inline-flex;
  margin-bottom: 4px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.ai-reason-section p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.ai-reason-summary {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eef4ff;
  color: #1d4ed8;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 820px) {
  .cloth-preview-content {
    grid-template-columns: 1fr;
  }

  .ai-reason-card {
    max-height: none;
  }
}

.modal-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.modal-error {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff1f0;
  color: #f53f3f;
  font-size: 13px;
  line-height: 1.5;
}

.modal-label {
  display: block;
  margin: 14px 0 7px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.modal-input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  color: #0f172a;
  font-size: 14px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.modal-input:focus {
  border-color: #409eff;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.14);
}

.modal-input::placeholder {
  color: #94a3b8;
}
:global(body:has(.app-container.night-mode)) .device-detail-overlay {
  background: rgba(2, 6, 23, 0.68);
}

:global(body:has(.app-container.night-mode)) .device-detail-modal,
:global(body:has(.app-container.night-mode)) .cloth-preview-modal {
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: rgba(226, 232, 240, 0.9);
  box-shadow: 0 26px 70px rgba(0, 0, 0, 0.5);
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(body:has(.app-container.night-mode)) .detail-modal-header h3,
:global(body:has(.app-container.night-mode)) .firmware-section h4,
:global(body:has(.app-container.night-mode)) .detail-value,
:global(body:has(.app-container.night-mode)) .firmware-info-item strong {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .detail-subtitle,
:global(body:has(.app-container.night-mode)) .detail-label,
:global(body:has(.app-container.night-mode)) .modal-label,
:global(body:has(.app-container.night-mode)) .modal-hint,
:global(body:has(.app-container.night-mode)) .firmware-info-item span {
  color: rgba(203, 213, 225, 0.72);
}

:global(body:has(.app-container.night-mode)) .detail-close-btn {
  color: rgba(226, 232, 240, 0.9);
}

:global(body:has(.app-container.night-mode)) .detail-info-item,
:global(body:has(.app-container.night-mode)) .firmware-section,
:global(body:has(.app-container.night-mode)) .firmware-info-item {
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.18);
}


:global(body:has(.app-container.night-mode)) .ota-progress-box {
  background: rgba(30, 41, 59, 0.76);
  border-color: rgba(96, 165, 250, 0.24);
  color: rgba(191, 219, 254, 0.96);
}

:global(body:has(.app-container.night-mode)) .ota-progress-box.success {
  border-color: rgba(74, 222, 128, 0.24);
  color: rgba(187, 247, 208, 0.96);
}

:global(body:has(.app-container.night-mode)) .ota-progress-box.failed {
  border-color: rgba(248, 113, 113, 0.24);
  color: rgba(254, 202, 202, 0.96);
}

:global(body:has(.app-container.night-mode)) .ota-progress-sub {
  color: rgba(191, 219, 254, 0.72);
}

:global(body:has(.app-container.night-mode)) .ota-progress-box.success .ota-progress-sub {
  color: rgba(187, 247, 208, 0.72);
}

:global(body:has(.app-container.night-mode)) .ota-progress-box.failed .ota-progress-sub {
  color: rgba(254, 202, 202, 0.72);
}

:global(body:has(.app-container.night-mode)) .modal-input {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.28);
  color: rgba(226, 232, 240, 0.92);
}

:global(body:has(.app-container.night-mode)) .modal-input:focus {
  background: rgba(15, 23, 42, 0.86);
  border-color: rgba(96, 165, 250, 0.72);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
}

:global(body:has(.app-container.night-mode)) .modal-input::placeholder {
  color: rgba(203, 213, 225, 0.58);
}

:global(body:has(.app-container.night-mode)) .ota-result {
  background: rgba(30, 64, 175, 0.24);
  border: 1px solid rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
}

:global(body:has(.app-container.night-mode)) .modal-error,
:global(body:has(.app-container.night-mode)) .ota-error-msg {
  background: rgba(127, 29, 29, 0.26);
  border: 1px solid rgba(248, 113, 113, 0.22);
  color: #fecaca;
}

:global(body:has(.app-container.night-mode)) .cloth-preview-image {
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

:global(body:has(.app-container.night-mode)) .ai-reason-card {
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

:global(body:has(.app-container.night-mode)) .ai-reason-title {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .ai-reason-label {
  color: #93c5fd;
}

:global(body:has(.app-container.night-mode)) .ai-reason-section p {
  color: rgba(203, 213, 225, 0.78);
}

:global(body:has(.app-container.night-mode)) .ai-reason-summary {
  background: rgba(30, 64, 175, 0.24);
  border: 1px solid rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
}

:global(body:has(.app-container.night-mode)) .btn-secondary {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}

:global(body:has(.app-container.night-mode)) .btn-danger {
  background: rgba(127, 29, 29, 0.28);
  color: #fecaca;
}

:global(.app-container.night-mode) .lamp-card,
:global(.app-container.night-mode) .placeholder-card {
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: rgba(226, 232, 240, 0.88);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}

:global(.app-container.night-mode) .lamp-card h3,
:global(.app-container.night-mode) .device-title-block h3 {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .last-seen-under-name,
:global(.app-container.night-mode) .field-label,
:global(.app-container.night-mode) .checkbox-row {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .status-badge.online {
  background: rgba(6, 95, 70, 0.28);
  border: 1px solid rgba(52, 211, 153, 0.22);
  color: #a7f3d0;
}

:global(.app-container.night-mode) .status-badge.offline {
  background: rgba(127, 29, 29, 0.28);
  border: 1px solid rgba(248, 113, 113, 0.22);
  color: #fecaca;
}

:global(.app-container.night-mode) .btn-ai {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .btn-ai:hover {
  background: rgba(37, 99, 235, 0.26);
  border-color: rgba(96, 165, 250, 0.45);
  color: #bfdbfe;
}

:global(.app-container.night-mode) .btn-ai.active {
  background: rgba(127, 29, 29, 0.28);
  border-color: rgba(248, 113, 113, 0.22);
  color: #fecaca;
}

:global(.app-container.night-mode) .color-box {
  border-color: rgba(148, 163, 184, 0.28);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.22);
}

</style>
