<template>
  <div class="device-card-wrapper">
  <div
    class="lamp-card"
    :class="{
      'is-online': device.online,
      'is-offline': !device.online,
      'online-flash': onlineFlash,
    }"
  >
    <div class="card-header clickable-header" @click="handleHeaderClick">
      <div class="device-title-block">
        <h3>{{ displayNameText }}</h3>
        <p class="last-seen-under-name">
          上次在线：{{ !device.online ? (lastSeenText || '未知') : '当前在线' }}
        </p>
      </div>

      <div class="card-status-stack">
        <span class="status-badge" :class="{ online: device.online, offline: !device.online }">
          {{ device.online ? '在线' : '离线' }}
        </span>
        <span class="self-test-badge" :class="selfTestBadgeClass">
          {{ selfTestBadgeText }}
        </span>
      </div>
    </div>

    <label class="field-label">亮度：{{ displayBrightness }}</label>
    <input
      :value="sliderBrightnessValue"
      type="range"
      min="0"
      max="100"
      :disabled="!!localForm.autoMode"
      @pointerdown="beginSliderInteraction('brightness')"
      @pointerup="endSliderInteraction('brightness')"
      @pointercancel="endSliderInteraction('brightness')"
      @lostpointercapture="endSliderInteraction('brightness')"
      @input="handleBrightnessInput"
      @change="endSliderInteraction('brightness')"
    />

    <label class="field-label">色温：{{ displayTemp }}</label>
    <input
      :value="sliderTempValue"
      class="temperature-slider"
      :style="temperatureSliderStyle"
      type="range"
      min="2700"
      max="6500"
      step="100"
      :disabled="!!localForm.autoMode"
      @pointerdown="beginSliderInteraction('temp')"
      @pointerup="endSliderInteraction('temp')"
      @pointercancel="endSliderInteraction('temp')"
      @lostpointercapture="endSliderInteraction('temp')"
      @input="handleTempInput"
      @change="endSliderInteraction('temp')"
    />

    <div class="mode-switch-row">
      <label class="mode-switch">
        <span class="mode-switch-text">自动模式</span>
        <input
          v-model="localForm.autoMode"
          class="mode-switch-input"
          type="checkbox"
          role="switch"
          @change="handleAutoModeChange"
        />
        <span class="mode-switch-track" aria-hidden="true">
          <span class="mode-switch-thumb"></span>
        </span>
      </label>

      <label
        class="mode-switch"
        :title="localForm.garmentAimEnabled ? '使用最新服装识别位置' : '使用默认预设位置'"
      >
        <span class="mode-switch-text">服装追随</span>
        <input
          v-model="localForm.garmentAimEnabled"
          class="mode-switch-input"
          type="checkbox"
          role="switch"
          @change="handleGarmentAimModeChange"
        />
        <span class="mode-switch-track" aria-hidden="true">
          <span class="mode-switch-thumb"></span>
        </span>
      </label>
    </div>

    <section class="cloth-state-strip">
      <div>
        <span>服装状态</span>
        <strong>{{ clothStateText }}</strong>
      </div>
      <div>
        <span>人员靠近</span>
        <strong>{{ proximityStateText }}</strong>
      </div>
      <div>
        <span>最近取下</span>
        <strong>{{ lastTakenAtText }}</strong>
      </div>
      <div>
        <span>跟随追踪</span>
        <strong>{{ trackingText }}</strong>
      </div>
    </section>

    <template v-if="displayGarments.length">
      <div class="garment-details">
        <div
          v-for="garment in displayGarments"
          :key="`${garment.position}-${garment.category}`"
          class="garment-detail-row"
        >
          <span class="garment-kind">{{ GARMENT_LABELS[garment.category] }}</span>
          <span class="garment-fabric">{{ garment.fabric || '未识别面料' }}</span>
          <span v-if="garment.fabricConfidence != null" class="garment-confidence">
            {{ Math.round(garment.fabricConfidence * 100) }}%
          </span>
        </div>
      </div>
      <div
        class="garment-color-bar"
        :class="{ 'is-split': displayGarments.length === 2 }"
      >
        <div
          v-for="garment in displayGarments"
          :key="`color-${garment.position}-${garment.category}`"
          class="garment-color-segment"
          :style="{
            backgroundColor: garmentRgbCss(garment.mainColorRgb),
            color: garmentTextColor(garment.mainColorRgb),
            width: displayGarments.length === 2 ? '50%' : '100%',
          }"
        >
          RGB({{ garment.mainColorRgb || '暂无主色' }})
        </div>
      </div>
    </template>
    <p v-else class="garment-empty-state">未识别服装</p>

<div class="ai-actions" :class="{ shake: shakingAiActions }">
  <template v-if="isLamp">
    <input
      ref="fabricInputRef"
      class="hidden-file-input"
      type="file"
      accept="image/*"
      @change="handleFabricFileChange"
      @cancel="handleFabricPickerCancel"
    />

    <button
      class="btn-ai"
      :disabled="fabricLoading"
      @click.stop="openFabricUpload"
    >
      {{ fabricLoading ? '识别中...' : '上传服装图片' }}
    </button>
    <button
      v-if="annotatedImageSrc"
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
            <section class="device-info-section">
              <div class="device-info-head">
                <div>
                  <h4>设备信息</h4>
                  <p>Chip ID：{{ device.chipId || '未知' }}</p>
                </div>
                <span class="device-info-status" :class="{ online: device.online, offline: !device.online }">
                  {{ device.online ? '在线' : '离线' }}
                </span>
              </div>

              <div class="device-overview-grid">
                <div class="device-info-cell">
                  <span>设备类型</span>
                  <strong>{{ displayDeviceType }}</strong>
                </div>
                <div class="device-info-cell">
                  <span>IP</span>
                  <strong>{{ localForm.ip || '未设置' }}</strong>
                </div>
                <div class="device-info-cell editable zone-select-cell">
                  <span>所属分区</span>
                  <BaseSelect
                    class="zone-cell-select"
                    :model-value="localForm.displayName"
                    :options="zoneOptions"
                    placeholder="请选择分区"
                    @change="handleZoneChange"
                  />
                </div>
                <label class="device-info-cell editable">
                  <span>分区内编号</span>
                  <input
                    v-model.trim="localForm.deviceNo"
                    :class="{ shake: shakingDeviceNo }"
                    type="text"
                    inputmode="numeric"
                    pattern="[1-9][0-9]*"
                    placeholder="如 1"
                  />
                </label>
              </div>
            </section>

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

            <section class="aim-preset-section">
              <div class="aim-preset-heading">
                <div>
                  <h4>默认照射角度</h4>
                  <p>追随结束后，灯具会回到对应场景的默认位置。</p>
                </div>
                <span class="aim-preset-badge">追踪回位</span>
              </div>

              <div class="aim-preset-list">
                <div class="aim-preset-row garment-preset">
                  <div class="aim-preset-meta">
                    <span class="aim-preset-icon" aria-hidden="true">衣</span>
                    <div>
                      <strong>服装默认位</strong>
                      <small>服装追随结束后回位</small>
                    </div>
                  </div>
                  <div class="aim-axis-grid">
                    <label class="aim-axis-field">
                      <span>Pan</span>
                      <span class="aim-angle-input">
                        <input
                          v-model.number="localForm.garmentDefaultPan"
                          aria-label="默认服装 Pan"
                          type="number"
                          min="-90"
                          max="90"
                          step="1"
                        />
                        <em>°</em>
                      </span>
                    </label>
                    <label class="aim-axis-field">
                      <span>Tilt</span>
                      <span class="aim-angle-input">
                        <input
                          v-model.number="localForm.garmentDefaultTilt"
                          aria-label="默认服装 Tilt"
                          type="number"
                          min="-90"
                          max="90"
                          step="1"
                        />
                        <em>°</em>
                      </span>
                    </label>
                  </div>
                </div>

                <div class="aim-preset-row person-preset">
                  <div class="aim-preset-meta">
                    <span class="aim-preset-icon" aria-hidden="true">人</span>
                    <div>
                      <strong>照人默认位</strong>
                      <small>照人追踪结束后回位</small>
                    </div>
                  </div>
                  <div class="aim-axis-grid">
                    <label class="aim-axis-field">
                      <span>Pan</span>
                      <span class="aim-angle-input">
                        <input
                          v-model.number="localForm.personDefaultPan"
                          aria-label="默认照人 Pan"
                          type="number"
                          min="-90"
                          max="90"
                          step="1"
                        />
                        <em>°</em>
                      </span>
                    </label>
                    <label class="aim-axis-field">
                      <span>Tilt</span>
                      <span class="aim-angle-input">
                        <input
                          v-model.number="localForm.personDefaultTilt"
                          aria-label="默认照人 Tilt"
                          type="number"
                          min="-90"
                          max="90"
                          step="1"
                        />
                        <em>°</em>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section class="self-test-section">
              <div class="self-test-head">
                <h4>设备自检</h4>
                <span class="self-test-badge" :class="selfTestBadgeClass">
                  {{ selfTestBadgeText }}
                </span>
              </div>

              <div class="self-test-summary">
                <span>最近自检</span>
                <strong>{{ selfTestTimeText }}</strong>
              </div>

              <div class="self-test-grid">
                <div
                  v-for="item in selfTestRows"
                  :key="item.label"
                  class="self-test-row"
                  :class="item.okClass"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.text }}</strong>
                </div>
              </div>
            </section>

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

        <p v-if="garmentState.segmentationFallback" class="segmentation-fallback-hint">
          未检测到明确区域，已按上装整图识别
        </p>

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

            <div class="ai-reason-summary">{{ garmentRecommendationSummary }}</div>
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
  GarmentState,
  OtaCheckResult,
} from '../../types/device'
import { fabricRecognize } from '../../api/ai'
import {
  createCaptureLightingSessionId,
  startCaptureLighting,
  stopCaptureLighting,
} from '../../api/garmentCalibration'
import {
  setFlowUpload,
  locateDevice,
  checkFirmwareUpdate,
  startOtaUpdate,
} from '../../api/device'
import { generateLightRecommendationReason } from '../../utils/lightRecommendationReason'
import {
  buildLampRealtimeUpdateEnvelope,
  normalizeGarmentState,
  getDisplayGarments,
  GARMENT_LABELS,
  garmentRgbCss,
  garmentTextColor,
} from '../../utils/garmentRecognition'
import { getErrorMessage } from '../../utils/error'
import { clamp, colorTemperatureToHex } from '../../utils/helpers'
import { isLampDevice, normalizeDeviceType } from '../../utils/device'
import {
  garmentDetectionStatusText,
  lampProximityStatusText,
  lampTrackingStatusText,
} from '../../utils/lampRuntimeStatus'
import {
  buildZoneSelectOptions,
  findSmallestAvailableDeviceNo,
  normalizeZoneName,
  type ZoneDefinition,
} from '../../utils/deviceZones'
import { useToast } from '../../composables/useToast'
import { useShake } from '../../composables/useShake'

const props = defineProps<{
  device: DeviceItem
  deleting?: boolean
  allDevices?: DeviceItem[]
  zones: ZoneDefinition[]
}>()

const zoneOptions = computed(() => buildZoneSelectOptions(props.zones))

type SelfTestValue = boolean | string | number | null | undefined
type SelfTestResult = {
  done?: boolean
  overall?: boolean
  fs?: boolean
  wifi?: boolean
  ws?: boolean
  bh1750?: boolean
  tof?: boolean
  nano?: boolean
  nanoHoming?: boolean
  nanoHallStatus?: boolean
  nanoStatus?: string
  hall?: {
    pan?: string
    tilt?: string
    slider?: string
  }
}

const emit = defineEmits<{
  (e: 'update-realtime', value: {
    id: number
    payload: DeviceCreatePayload
    garmentState?: GarmentState
    lightControl?: boolean
  }): void
  (e: 'delete', id: number): void
}>()

const toast = useToast()
const { shaking: shakingDeviceNo, trigger: shakeDeviceNo } = useShake()
const { shaking: shakingAiActions, trigger: shakeAiActions } = useShake()

const onlineFlash = ref(false)
let onlineFlashTimer: ReturnType<typeof setTimeout> | null = null
const brightnessInteracting = ref(false)
const tempInteracting = ref(false)
let brightnessInteractionTimer: ReturnType<typeof setTimeout> | null = null
let tempInteractionTimer: ReturnType<typeof setTimeout> | null = null

type LightSliderKind = 'brightness' | 'temp'
const SLIDER_WS_SYNC_GRACE_MS = 900

function triggerOnlineFlash() {
  onlineFlash.value = false
  if (onlineFlashTimer) {
    clearTimeout(onlineFlashTimer)
  }

  requestAnimationFrame(() => {
    onlineFlash.value = true
    onlineFlashTimer = setTimeout(() => {
      onlineFlash.value = false
      onlineFlashTimer = null
    }, 900)
  })
}

function clearSliderInteractionTimer(kind: LightSliderKind) {
  if (kind === 'brightness') {
    if (brightnessInteractionTimer) {
      clearTimeout(brightnessInteractionTimer)
      brightnessInteractionTimer = null
    }
    return
  }

  if (tempInteractionTimer) {
    clearTimeout(tempInteractionTimer)
    tempInteractionTimer = null
  }
}

function beginSliderInteraction(kind: LightSliderKind) {
  clearSliderInteractionTimer(kind)
  if (kind === 'brightness') {
    brightnessInteracting.value = true
    return
  }

  tempInteracting.value = true
}

function endSliderInteraction(kind: LightSliderKind) {
  clearSliderInteractionTimer(kind)
  const timer = setTimeout(() => {
    if (kind === 'brightness') {
      brightnessInteracting.value = false
      brightnessInteractionTimer = null
      return
    }

    tempInteracting.value = false
    tempInteractionTimer = null
  }, SLIDER_WS_SYNC_GRACE_MS)

  if (kind === 'brightness') {
    brightnessInteractionTimer = timer
  } else {
    tempInteractionTimer = timer
  }
}

const localForm = reactive<DeviceCreatePayload>({
  chipId: '',
  ip: '',
  displayName: '',
  deviceType: '',
  deviceNo: '',
  brightness: 50,
  temp: 4000,
  autoMode: false,
  garmentAimEnabled: false,
  garmentDefaultPan: 0,
  garmentDefaultTilt: 20,
  personDefaultPan: 0,
  personDefaultTilt: -30,
  recommendedBrightness: 50,
  recommendedTemp: 4000,
  fabric: '',
  mainColorRgb: '',
})

const garmentState = ref<GarmentState>({
  garments: [],
})
const displayGarments = computed(() => getDisplayGarments({
  ...garmentState.value,
  fabric: localForm.fabric,
  mainColorRgb: localForm.mainColorRgb,
}))
const showDetailModal = ref(false)
const fabricInputRef = ref<HTMLInputElement | null>(null)
const fabricLoading = ref(false)
let fabricCaptureLightingLamp = ''
let fabricCaptureLightingSession = ''
let fabricPickerFocusHandler: (() => void) | null = null
let fabricPickerReturnTimer: ReturnType<typeof setTimeout> | null = null
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
  if (props.device.annotatedImageBlobUrl) {
    return props.device.annotatedImageBlobUrl
  }
  if (annotatedImageBase64.value) {
    return normalizeBase64ImageSrc(annotatedImageBase64.value)
  }
  return props.device.annotatedImageUrl || ''
})
const lightRecommendationHasData = computed(() => {
  return Boolean(
    displayGarments.value.length > 0 ||
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
  const primaryGarment = displayGarments.value[0]

  return generateLightRecommendationReason({
    fabric: primaryGarment?.fabric || localForm.fabric,
    mainColorRgb: primaryGarment?.mainColorRgb || localForm.mainColorRgb,
    recommendedBrightness: hasData ? localForm.recommendedBrightness : null,
    recommendedTemp: hasData ? localForm.recommendedTemp : null,
  })
})
const garmentRecommendationSummary = computed(() => {
  if (displayGarments.value.length === 0) {
    return lightRecommendationReason.value.summary
  }

  const descriptions = displayGarments.value.map(
    garment => `${GARMENT_LABELS[garment.category]}：${garment.fabric || '未识别面料'}，主色 RGB(${garment.mainColorRgb || '暂无主色'})`,
  )
  const weighting = displayGarments.value.length === 2
    ? '；最终亮度和色温按服装区域面积加权'
    : ''

  return `${descriptions.join('；')}${weighting}。${lightRecommendationReason.value.summary}`
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

  const duplicated = (props.allDevices || []).filter(isLampDevice).some(item => {
    if (String(item.id) === String(props.device.id)) return false

    const sameZone = (item.displayName || '').trim() === zoneName
    const sameNo = (item.deviceNo || '').trim() === deviceNo
    return sameZone && sameNo
  })

  if (duplicated) {
    return `「${zoneName}」分区内已经存在编号 ${deviceNo}`
  }

  return ''
})

function handleZoneChange(value: string | number) {
  const zoneName = String(value)
  if (normalizeZoneName(zoneName) === normalizeZoneName(localForm.displayName)) return

  localForm.displayName = zoneName
  localForm.deviceNo = findSmallestAvailableDeviceNo(
    props.allDevices || [],
    zoneName,
    String(props.device.id),
  )
}

function saveDeviceBaseInfo() {
  if (deviceNoError.value) {
    toast.show(deviceNoError.value, 'error')
    shakeDeviceNo()
    return
  }

  emitRealtimeUpdate()
  showDetailModal.value = false
}

const lastSeenText = computed(() => {
  if (props.device.lastSeenAt) {
    return formatMinuteDateTime(props.device.lastSeenAt)
  }

  const value = props.device.lastSeen
  if (!value) return ''

  const timestamp = value < 1e12 ? value * 1000 : value
  return formatMinuteDateTime(timestamp)
})

function formatMinuteDateTime(value?: string | number | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function formatDateTime(value?: string | number | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

function parseSelfTestJson(value?: string | null): SelfTestResult | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function statusText(value: SelfTestValue) {
  if (value === true) return '正常'
  if (value === false) return '异常'
  if (value === 'triggered') return '触发'
  if (value === 'clear') return '未触发'
  if (value === 'disabled') return '已禁用'
  if (value === 'unknown' || value == null || value === '') return '未知'
  return String(value)
}

function statusClass(value: SelfTestValue) {
  if (value === true || value === 'clear' || value === 'triggered') return 'ok'
  if (value === false) return 'bad'
  return 'unknown'
}

const selfTest = computed(() => {
  if (!props.device.online) return null
  return parseSelfTestJson(props.device.selfTestJson)
})

const enabledSelfTestValues = computed(() => {
  const data = selfTest.value
  if (!data) return []
  return [data.wifi, data.ws, data.fs, data.bh1750, data.tof]
})

const enabledSelfTestState = computed<'ok' | 'bad' | 'unknown'>(() => {
  if (!selfTest.value) return 'unknown'
  if (enabledSelfTestValues.value.some(value => value === false)) return 'bad'
  if (enabledSelfTestValues.value.every(value => value === true)) return 'ok'
  return 'unknown'
})

const selfTestBadgeClass = computed(() => enabledSelfTestState.value)

const selfTestBadgeText = computed(() => {
  if (!selfTest.value) return '未自检'
  if (enabledSelfTestState.value === 'ok') return '自检正常'
  if (enabledSelfTestState.value === 'bad') return '自检异常'
  return '自检未完成'
})

const selfTestTimeText = computed(() => {
  if (!props.device.online || !selfTest.value) return '暂无记录'
  return formatDateTime(props.device.selfTestTime) || '暂无记录'
})

const selfTestRows = computed(() => {
  const data = selfTest.value
  return [
    { label: '网络 WiFi', text: statusText(data?.wifi), okClass: statusClass(data?.wifi) },
    { label: 'WebSocket', text: statusText(data?.ws), okClass: statusClass(data?.ws) },
    { label: '文件系统', text: statusText(data?.fs), okClass: statusClass(data?.fs) },
    { label: 'BH1750 光照', text: statusText(data?.bh1750), okClass: statusClass(data?.bh1750) },
    { label: 'ToF 传感器', text: statusText(data?.tof), okClass: statusClass(data?.tof) },
  ]
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
  const keepBrightness = brightnessInteracting.value
  const keepTemp = tempInteracting.value

  localForm.chipId = props.device.chipId
  localForm.ip = props.device.ip || ''
  localForm.displayName = props.device.displayName || ''
  localForm.deviceType = props.device.deviceType || ''
  localForm.deviceNo = props.device.deviceNo || ''
  if (!keepBrightness) {
    localForm.brightness = props.device.brightness ?? 50
  }
  if (!keepTemp) {
    localForm.temp = props.device.temp ?? 4000
  }
  localForm.autoMode = props.device.autoMode ?? false
  localForm.garmentAimEnabled = props.device.garmentAimEnabled ?? false
  localForm.garmentDefaultPan = props.device.garmentDefaultPan ?? 0
  localForm.garmentDefaultTilt = props.device.garmentDefaultTilt ?? 20
  localForm.personDefaultPan = props.device.personDefaultPan ?? 0
  localForm.personDefaultTilt = props.device.personDefaultTilt ?? -30
  localForm.recommendedBrightness = props.device.recommendedBrightness ?? 50
  localForm.recommendedTemp = props.device.recommendedTemp ?? 4000
  localForm.fabric = props.device.fabric || ''
  localForm.mainColorRgb = props.device.mainColorRgb || ''
  garmentState.value = normalizeGarmentState(props.device)
  clothDetected.value = garmentState.value.clothDetected ?? null
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
  () => props.device.online,
  (isOnline, wasOnline) => {
    if (wasOnline === false && isOnline === true) {
      triggerOnlineFlash()
    }
  },
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
  if (onlineFlashTimer) {
    clearTimeout(onlineFlashTimer)
  }
  clearSliderInteractionTimer('brightness')
  clearSliderInteractionTimer('temp')
  clearFabricPickerReturnFallback()
  void releaseFabricCaptureLighting()
})

function resetForm() {
  syncFromProps()
}

function emitRealtimeUpdate(lightControl = false) {
  emit('update-realtime', buildLampRealtimeUpdateEnvelope({
    id: props.device.id,
    lightControl,
    garmentState: garmentState.value,
    payload: {
      chipId: localForm.chipId,
      ip: localForm.ip || '',
      displayName: localForm.displayName || '',
      deviceType: localForm.deviceType || '',
      deviceNo: localForm.deviceNo || '',
      brightness: localForm.brightness ?? 50,
      temp: localForm.temp ?? 4000,
      autoMode: localForm.autoMode ?? false,
      garmentAimEnabled: localForm.garmentAimEnabled ?? false,
      garmentDefaultPan: localForm.garmentDefaultPan ?? 0,
      garmentDefaultTilt: localForm.garmentDefaultTilt ?? 20,
      personDefaultPan: localForm.personDefaultPan ?? 0,
      personDefaultTilt: localForm.personDefaultTilt ?? -30,
      recommendedBrightness: localForm.recommendedBrightness ?? 50,
      recommendedTemp: localForm.recommendedTemp ?? 4000,
      fabric: localForm.fabric || '',
      mainColorRgb: localForm.mainColorRgb || '',
      
    },
  }))
}

function handleBrightnessInput(event: Event) {
  if (localForm.autoMode) return
  beginSliderInteraction('brightness')
  const target = event.target as HTMLInputElement
  localForm.brightness = Number(target.value)
  emitRealtimeUpdate(true)
}

function handleTempInput(event: Event) {
  if (localForm.autoMode) return
  beginSliderInteraction('temp')
  const target = event.target as HTMLInputElement
  localForm.temp = Number(target.value)
  emitRealtimeUpdate(true)
}

function handleAutoModeChange() {
  emitRealtimeUpdate(true)
}

function handleGarmentAimModeChange() {
  emitRealtimeUpdate()
}

async function openFabricUpload() {
  if (fabricLoading.value || fabricCaptureLightingSession) return
  const lampChipId = localForm.chipId || props.device.chipId
  if (!lampChipId) {
    toast.show('设备缺少 chipId，无法开启拍摄标准光照', 'error')
    shakeAiActions()
    return
  }

  clearFabricPickerReturnFallback()
  await releaseFabricCaptureLighting()
  const sessionId = createCaptureLightingSessionId('PHONE')
  fabricCaptureLightingLamp = lampChipId
  fabricCaptureLightingSession = sessionId

  try {
    await startCaptureLighting(lampChipId, sessionId)
    if (!fabricInputRef.value) {
      await releaseFabricCaptureLighting()
      return
    }
    fabricInputRef.value.value = ''
    armFabricPickerReturnFallback()
    fabricInputRef.value.click()
  } catch (error) {
    clearFabricPickerReturnFallback()
    await releaseFabricCaptureLighting()
    toast.show(getErrorMessage(error, '启用拍摄标准光照失败'), 'error')
    shakeAiActions()
  }
}

function armFabricPickerReturnFallback() {
  clearFabricPickerReturnFallback()
  fabricPickerFocusHandler = () => {
    if (fabricPickerReturnTimer) clearTimeout(fabricPickerReturnTimer)
    fabricPickerReturnTimer = setTimeout(() => {
      fabricPickerReturnTimer = null
      void handleFabricPickerCancel()
    }, 300)
  }
  window.addEventListener('focus', fabricPickerFocusHandler, { once: true })
}

function clearFabricPickerReturnFallback() {
  if (fabricPickerFocusHandler) {
    window.removeEventListener('focus', fabricPickerFocusHandler)
    fabricPickerFocusHandler = null
  }
  if (fabricPickerReturnTimer) {
    clearTimeout(fabricPickerReturnTimer)
    fabricPickerReturnTimer = null
  }
}

async function releaseFabricCaptureLighting() {
  const lampChipId = fabricCaptureLightingLamp
  const sessionId = fabricCaptureLightingSession
  fabricCaptureLightingLamp = ''
  fabricCaptureLightingSession = ''
  if (!lampChipId || !sessionId) return
  try {
    await stopCaptureLighting(lampChipId, sessionId)
  } catch (error) {
    console.warn('[lamp-device-card] capture lighting stop failed', error)
  }
}

async function handleFabricPickerCancel() {
  clearFabricPickerReturnFallback()
  await releaseFabricCaptureLighting()
  if (fabricInputRef.value) fabricInputRef.value.value = ''
}

const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB

async function handleFabricFileChange(event: Event) {
  clearFabricPickerReturnFallback()
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  await releaseFabricCaptureLighting()

  if (!file) {
    input.value = ''
    return
  }

  if (file.size > MAX_IMAGE_SIZE) {
    toast.show('图片大小不能超过 20MB，请压缩后再上传', 'error')
    shakeAiActions()
    input.value = ''
    return
  }

  if (!localForm.chipId) {
    toast.show('设备缺少 chipId，无法上传面料识别图片', 'error')
    shakeAiActions()
    input.value = ''
    return
  }

  fabricLoading.value = true

  try {
    const result = await fabricRecognize(file, localForm.chipId)
    garmentState.value = normalizeGarmentState(result)
    clothDetected.value = garmentState.value.clothDetected ?? null

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

    emitRealtimeUpdate()
  } catch (error) {
    console.error('面料识别失败：', error)
    const message = error instanceof Error && error.message
      ? error.message
      : '面料识别失败，请稍后重试'
    toast.show(message, 'error')
    shakeAiActions()
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
const normalizedDeviceType = computed(() => normalizeDeviceType(localForm.deviceType || props.device.deviceType))

const isLamp = computed(() => normalizedDeviceType.value === 'lamp')
const isCamLamp = computed(() => normalizedDeviceType.value === 'camlamp')

const clothStateText = computed(() => {
  return garmentDetectionStatusText(props.device.garmentDetectionStatus)
})

const proximityStateText = computed(() => {
  return lampProximityStatusText(
    props.device.online === true,
    props.device.lampProximityState?.nearby,
  )
})

const lastTakenAtText = computed(() => {
  const value = props.device.lampClothState?.lastTakenAt ?? props.device.lastTakenAt
  return formatMinuteDateTime(value) || '暂无'
})

const trackingText = computed(() => {
  if (props.device.online !== true) return '未跟随'
  return lampTrackingStatusText(props.device.trackingStatus?.status)
})

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

const temperatureSliderStyle = computed<Record<string, string>>(() => {
  const rawTemperature = Number(sliderTempValue.value)
  const temperature = clamp(Number.isFinite(rawTemperature) ? rawTemperature : 4000, 2700, 6500)
  const progress = (temperature - 2700) / (6500 - 2700) * 100

  return {
    '--temperature-color': colorTemperatureToHex(temperature),
    '--temperature-progress': `${progress}%`,
  }
})

</script>

<style scoped>
.device-card-wrapper {
  height: 100%;
  min-width: 0;
}


.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
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

.card-status-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-badge::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
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

.self-test-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.self-test-badge::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
}

.self-test-badge.ok {
  background: #ecfdf3;
  color: #16a34a;
}

.self-test-badge.bad {
  background: #fff1f2;
  color: #dc2626;
}

.self-test-badge.unknown {
  background: #f1f5f9;
  color: #64748b;
}

@keyframes breathe {
  0%, 100% { opacity: 0.9; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.08); }
}

@keyframes onlineCardFlash {
  0% {
    transform: translateY(0);
  }
  35% {
    transform: translateY(-2px);
    box-shadow:
      0 18px 36px rgba(34, 197, 94, 0.16),
      0 0 0 1px rgba(34, 197, 94, 0.2);
  }
  100% {
    transform: translateY(0);
  }
}

@keyframes onlineCardSweep {
  0% {
    opacity: 0;
    transform: translateX(-100%);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(100%);
  }
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
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 22px 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior: contain;
}

.detail-modal-body::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
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

.device-info-section {
  margin-bottom: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.device-info-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.device-info-head h4 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

.device-info-head p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.25;
  word-break: break-all;
}

.device-info-status {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.device-info-status.online {
  background: #ecfdf3;
  color: #16a34a;
}

.device-info-status.offline {
  background: #fff1f2;
  color: #dc2626;
}

.device-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 14px;
}

.device-info-cell {
  min-width: 0;
  padding: 0;
}

.device-info-cell span {
  display: block;
  margin-bottom: 3px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
}

.device-info-cell strong {
  display: block;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  word-break: break-all;
}

.device-info-cell.editable {
  cursor: text;
}

.zone-select-cell {
  cursor: pointer;
}

.zone-cell-select :deep(.select-trigger) {
  min-height: 0;
  padding: 0 20px 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  box-shadow: none;
}

.zone-cell-select :deep(.select-trigger:hover),
.zone-cell-select :deep(.select-trigger:focus) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.zone-cell-select :deep(.select-arrow) {
  right: 0;
}

.device-info-cell input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: none;
  outline: none;
  padding: 0;
  background: transparent;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
}

.device-info-cell input::placeholder {
  color: #94a3b8;
  font-weight: 600;
}

.device-info-cell:focus-within {
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.08);
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

.firmware-section,
.aim-preset-section {
  margin: 12px 0;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.aim-preset-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.aim-preset-heading h4 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
}

.aim-preset-heading p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.aim-preset-badge {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.3;
}

.aim-preset-list {
  display: flex;
  flex-direction: column;
}

.aim-preset-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
}

.aim-preset-row + .aim-preset-row {
  border-top: 1px solid rgba(15, 23, 42, 0.07);
}

.aim-preset-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.aim-preset-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 900;
}

.person-preset .aim-preset-icon {
  background: #eefbf3;
  color: #16a34a;
}

.aim-preset-meta strong,
.aim-preset-meta small {
  display: block;
}

.aim-preset-meta strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.3;
}

.aim-preset-meta small {
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
}

.aim-axis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.aim-axis-field {
  min-width: 0;
}

.aim-axis-field > span:first-child {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.aim-angle-input {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #dbe3ee;
  border-radius: 9px;
  background: #ffffff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.aim-angle-input:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
}

.aim-angle-input input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  text-align: right;
}

.aim-angle-input em {
  color: #64748b;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.self-test-section {
  margin: 12px 0;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.self-test-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.self-test-head h4 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
}

.self-test-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #64748b;
  font-size: 13px;
}

.self-test-summary strong {
  color: #0f172a;
  text-align: right;
}

.self-test-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.self-test-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #eef2f7;
  font-size: 13px;
}

.self-test-row span {
  color: #64748b;
}

.self-test-row strong {
  text-align: right;
}

.self-test-row.ok strong {
  color: #16a34a;
}

.self-test-row.bad strong {
  color: #dc2626;
}

.self-test-row.unknown strong {
  color: #64748b;
}

.self-test-status-line {
  margin: 10px 0 0;
  padding: 9px 10px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-all;
}

@media (max-width: 520px) {
  .device-overview-grid,
  .self-test-grid {
    grid-template-columns: 1fr;
  }

  .aim-preset-row {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .aim-axis-grid {
    padding-left: 42px;
  }
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
  border-radius: 999px;
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
  position: relative;
  overflow: hidden;
  background: var(--card-bg);
  border: 1px solid rgba(226, 232, 240, 0.86);
  border-radius: var(--border-radius);
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.lamp-card {
  --lamp-divider: rgba(15, 23, 42, 0.06);

  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

.lamp-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background:
    linear-gradient(115deg, transparent 0%, rgba(34, 197, 94, 0.14) 45%, transparent 58%);
  opacity: 0;
  transform: translateX(-100%);
}

.lamp-card.is-online {
  border-color: rgba(34, 197, 94, 0.26);
  box-shadow:
    0 8px 22px rgba(15, 23, 42, 0.06),
    0 0 0 1px rgba(34, 197, 94, 0.08);
}

.lamp-card.is-offline {
  opacity: 0.82;
  border-color: rgba(226, 232, 240, 0.9);
}

.lamp-card.online-flash {
  animation: onlineCardFlash 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.lamp-card.online-flash::after {
  animation: onlineCardSweep 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.lamp-card h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

.garment-details {
  display: grid;
  align-content: center;
  min-height: 66px;
  gap: 0;
  margin-top: 12px;
}

.garment-detail-row {
  display: grid;
  grid-template-columns: minmax(52px, 0.7fr) minmax(0, 1.4fr) minmax(36px, auto);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 2px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #475569;
  font-size: 12px;
}

.garment-detail-row + .garment-detail-row {
  border-top: 1px solid var(--lamp-divider);
}

.garment-kind {
  color: #0f172a;
  font-weight: 800;
}

.garment-fabric {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.garment-confidence {
  justify-self: end;
  color: #2563eb;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.garment-color-bar {
  display: flex;
  width: 100%;
  min-height: 38px;
  margin-top: 6px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #d6dde8;
  border-radius: 10px;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.08);
}

.garment-color-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 8px;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 700;
}

.garment-color-segment + .garment-color-segment {
  border-left: 1px solid rgba(255, 255, 255, 0.62);
}

.garment-empty-state {
  display: grid;
  place-items: center;
  min-height: 110px;
  margin: 12px 0 0;
  padding: 9px 2px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.lamp-card input[type='range'] {
  width: 100%;
  margin-top: 6px;
}

.temperature-slider {
  --temperature-color: #ffe9cf;
  --temperature-progress: 34.21%;

  height: 22px;
  padding: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  accent-color: var(--temperature-color);
}

.temperature-slider::-webkit-slider-runnable-track {
  height: 6px;
  border: 1px solid color-mix(in srgb, var(--temperature-color) 26%, #cbd5e1);
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--temperature-color) 0 var(--temperature-progress),
    color-mix(in srgb, var(--temperature-color) 24%, #e2e8f0) var(--temperature-progress) 100%
  );
}

.temperature-slider::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border: 2px solid #fff;
  border-radius: 50%;
  appearance: none;
  -webkit-appearance: none;
  background: var(--temperature-color);
  box-shadow:
    0 1px 4px rgba(15, 23, 42, 0.2),
    0 0 0 3px color-mix(in srgb, var(--temperature-color) 22%, transparent);
}

.temperature-slider::-moz-range-track {
  height: 6px;
  border: 1px solid color-mix(in srgb, var(--temperature-color) 26%, #cbd5e1);
  border-radius: 999px;
  background: color-mix(in srgb, var(--temperature-color) 24%, #e2e8f0);
}

.temperature-slider::-moz-range-progress {
  height: 6px;
  border-radius: 999px;
  background: var(--temperature-color);
}

.temperature-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--temperature-color);
  box-shadow:
    0 1px 4px rgba(15, 23, 42, 0.2),
    0 0 0 3px color-mix(in srgb, var(--temperature-color) 22%, transparent);
}

.lamp-card input[type='range']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lamp-card input.temperature-slider:disabled {
  opacity: 0.76;
}

.field-label {
  display: block;
  margin-top: 12px;
  margin-bottom: 6px;
  font-size: 14px;
  color: #606266;
}

.mode-switch-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--lamp-divider);
}

.mode-switch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  min-height: 40px;
  padding: 4px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.mode-switch-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-switch-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.mode-switch-track {
  position: relative;
  flex: 0 0 auto;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #cbd5e1;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.16);
  transition:
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.mode-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.28);
  transition: transform 180ms ease;
}

.mode-switch-input:checked + .mode-switch-track {
  background: #3b82f6;
  box-shadow: inset 0 1px 2px rgba(29, 78, 216, 0.3);
}

.mode-switch-input:checked + .mode-switch-track .mode-switch-thumb {
  transform: translateX(16px);
}

.mode-switch-input:focus-visible + .mode-switch-track {
  outline: 3px solid rgba(59, 130, 246, 0.24);
  outline-offset: 2px;
}

.cloth-state-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 12px 0 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lamp-divider);
}

.cloth-state-strip div {
  min-width: 0;
  padding: 8px 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.cloth-state-strip div:nth-child(odd) {
  border-right: 1px solid var(--lamp-divider);
}

.cloth-state-strip div:nth-child(n + 3) {
  border-top: 1px solid var(--lamp-divider);
}

.cloth-state-strip span,
.cloth-state-strip strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloth-state-strip span {
  color: #64748b;
  font-size: 11px;
}

.cloth-state-strip strong {
  margin-top: 2px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--lamp-divider);
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
  margin-top: auto;
  margin-bottom: 4px;
  padding-top: 12px;
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

.segmentation-fallback-hint {
  margin: 12px 0 0;
  padding: 9px 12px;
  border: 1px solid rgba(245, 158, 11, 0.24);
  border-radius: 10px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
  line-height: 1.5;
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
:global(body:has(.app-container.night-mode)) .aim-preset-heading h4,
:global(body:has(.app-container.night-mode)) .detail-value,
:global(body:has(.app-container.night-mode)) .firmware-info-item strong {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .detail-subtitle,
:global(body:has(.app-container.night-mode)) .detail-label,
:global(body:has(.app-container.night-mode)) .modal-label,
:global(body:has(.app-container.night-mode)) .modal-hint,
:global(body:has(.app-container.night-mode)) .aim-preset-heading p,
:global(body:has(.app-container.night-mode)) .aim-preset-meta small,
:global(body:has(.app-container.night-mode)) .aim-axis-field > span:first-child,
:global(body:has(.app-container.night-mode)) .firmware-info-item span {
  color: rgba(203, 213, 225, 0.72);
}

:global(body:has(.app-container.night-mode)) .detail-close-btn {
  color: rgba(226, 232, 240, 0.9);
}

:global(body:has(.app-container.night-mode)) .detail-info-item,
:global(body:has(.app-container.night-mode)) .device-info-section,
:global(body:has(.app-container.night-mode)) .device-info-cell,
:global(body:has(.app-container.night-mode)) .firmware-section,
:global(body:has(.app-container.night-mode)) .aim-preset-section,
:global(body:has(.app-container.night-mode)) .self-test-section,
:global(body:has(.app-container.night-mode)) .self-test-row,
:global(body:has(.app-container.night-mode)) .firmware-info-item {
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

:global(body:has(.app-container.night-mode)) .self-test-head h4,
:global(body:has(.app-container.night-mode)) .device-info-head h4,
:global(body:has(.app-container.night-mode)) .device-info-cell strong,
:global(body:has(.app-container.night-mode)) .aim-preset-meta strong,
:global(body:has(.app-container.night-mode)) .self-test-summary strong {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .self-test-summary,
:global(body:has(.app-container.night-mode)) .device-info-head p,
:global(body:has(.app-container.night-mode)) .device-info-cell span,
:global(body:has(.app-container.night-mode)) .self-test-row span {
  color: rgba(203, 213, 225, 0.72);
}

:global(body:has(.app-container.night-mode)) .device-info-cell input {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .aim-preset-row + .aim-preset-row {
  border-top-color: rgba(148, 163, 184, 0.16);
}

:global(body:has(.app-container.night-mode)) .aim-preset-badge,
:global(body:has(.app-container.night-mode)) .aim-preset-icon {
  background: rgba(37, 99, 235, 0.22);
  color: #bfdbfe;
}

:global(body:has(.app-container.night-mode)) .person-preset .aim-preset-icon {
  background: rgba(22, 163, 74, 0.2);
  color: #bbf7d0;
}

:global(body:has(.app-container.night-mode)) .aim-angle-input {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(30, 41, 59, 0.78);
}

:global(body:has(.app-container.night-mode)) .aim-angle-input input {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .aim-angle-input em {
  color: rgba(203, 213, 225, 0.72);
}

:global(body:has(.app-container.night-mode)) .zone-cell-select :deep(.select-trigger) {
  background: transparent;
  border: 0;
  box-shadow: none;
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .zone-cell-select :deep(.select-trigger:hover),
:global(body:has(.app-container.night-mode)) .zone-cell-select :deep(.select-trigger:focus),
:global(body:has(.app-container.night-mode)) .zone-cell-select.open :deep(.select-trigger) {
  background: transparent;
  border: 0;
  box-shadow: none;
}

:global(body:has(.app-container.night-mode)) .device-info-cell input::placeholder {
  color: rgba(203, 213, 225, 0.58);
}

:global(body:has(.app-container.night-mode)) .self-test-status-line {
  background: rgba(30, 64, 175, 0.24);
  border: 1px solid rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
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
  --lamp-divider: rgba(148, 163, 184, 0.12);

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
:global(.app-container.night-mode) .field-label {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .mode-switch {
  border-color: transparent;
  background: transparent;
  color: rgba(226, 232, 240, 0.86);
}

:global(body:has(.app-container.night-mode)) .temperature-slider::-webkit-slider-runnable-track {
  border-color: color-mix(in srgb, var(--temperature-color) 34%, #475569);
  background: linear-gradient(
    to right,
    var(--temperature-color) 0 var(--temperature-progress),
    color-mix(in srgb, var(--temperature-color) 28%, #334155) var(--temperature-progress) 100%
  );
}

:global(body:has(.app-container.night-mode)) .temperature-slider::-webkit-slider-thumb {
  border-color: #0f172a;
}

:global(body:has(.app-container.night-mode)) .temperature-slider::-moz-range-track {
  border-color: color-mix(in srgb, var(--temperature-color) 34%, #475569);
  background: color-mix(in srgb, var(--temperature-color) 28%, #334155);
}

:global(body:has(.app-container.night-mode)) .temperature-slider::-moz-range-progress {
  background: var(--temperature-color);
}

:global(body:has(.app-container.night-mode)) .temperature-slider::-moz-range-thumb {
  border-color: #0f172a;
  background: var(--temperature-color);
}

:global(.app-container.night-mode) .mode-switch-track {
  background: rgba(100, 116, 139, 0.76);
}

:global(.app-container.night-mode) .mode-switch-input:checked + .mode-switch-track {
  background: #3b82f6;
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

:global(.app-container.night-mode) .garment-detail-row,
:global(.app-container.night-mode) .garment-empty-state {
  background: transparent;
  border-color: var(--lamp-divider);
  color: rgba(203, 213, 225, 0.78);
}

:global(.app-container.night-mode) .cloth-state-strip span {
  color: rgba(148, 163, 184, 0.86);
}

:global(.app-container.night-mode) .cloth-state-strip strong {
  color: rgba(248, 250, 252, 0.94);
}

:global(.app-container.night-mode) .garment-kind {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .garment-color-bar {
  border-color: rgba(148, 163, 184, 0.28);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.22);
}

:global(body:has(.app-container.night-mode)) .segmentation-fallback-hint {
  border-color: rgba(251, 191, 36, 0.24);
  background: rgba(120, 53, 15, 0.28);
  color: #fde68a;
}

@media (max-width: 768px) {
  .device-card-wrapper,
  .lamp-card {
    height: auto;
  }

  .lamp-card,
  .placeholder-card {
    padding: clamp(12px, 3.5vw, 16px);
    border-radius: 14px;
  }

  .card-header {
    gap: 10px;
    margin-bottom: 12px;
  }

  .lamp-card h3 {
    margin-bottom: 0;
    font-size: 16px;
    line-height: 1.25;
  }

  .last-seen-under-name {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.3;
  }

  .card-status-stack {
    gap: 4px;
  }

  .status-badge,
  .self-test-badge {
    gap: 4px;
    padding: 3px 7px;
    font-size: 11px;
  }

  .status-badge::before,
  .self-test-badge::before {
    width: 6px;
    height: 6px;
  }

  .field-label {
    margin-top: 7px;
    margin-bottom: 2px;
    font-size: 12px;
    line-height: 1.3;
  }

  .lamp-card input[type='range'] {
    height: 28px;
    margin-top: 0;
  }

  .mode-switch-row {
    gap: 16px;
    margin-top: 12px;
    padding-top: 12px;
  }

  .mode-switch {
    min-height: 36px;
    padding: 2px 0;
    font-size: 13px;
  }

  .cloth-state-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
    margin: 12px 0 0;
    padding-bottom: 12px;
  }

  .cloth-state-strip div {
    padding: 8px 6px;
    border-radius: 0;
    text-align: left;
  }

  .cloth-state-strip span {
    font-size: 10px;
  }

  .cloth-state-strip strong {
    font-size: 12px;
  }

  .garment-details {
    align-content: normal;
    min-height: 0;
    gap: 0;
    margin-top: 12px;
  }

  .garment-detail-row {
    grid-template-columns: minmax(48px, 0.65fr) minmax(0, 1.35fr) auto;
    gap: 5px;
    padding: 7px 2px;
    font-size: 11px;
  }

  .garment-color-bar {
    min-height: 34px;
    margin-top: 4px;
    border-radius: 9px;
  }

  .garment-color-segment {
    padding: 0 5px;
    font-size: 12px;
  }

  .garment-empty-state {
    display: block;
    min-height: 0;
    margin-top: 12px;
  }

  .ai-actions,
  .card-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: 8px;
    margin-bottom: 0;
  }

  .ai-actions {
    padding-top: 0;
  }

  .card-actions {
    margin-top: 12px;
    padding-top: 12px;
  }

  .btn-ai,
  .btn-secondary,
  .btn-danger {
    min-height: 44px;
    padding: 7px 9px;
    font-size: 12px;
  }

  .btn-preview {
    margin-left: 0;
  }
}

</style>
