<template>
  <div class="device-card-wrapper">
    <article
      class="camera-card lamp-card"
      :class="{
        'is-online': device.online,
        'is-offline': !device.online,
        'online-flash': onlineFlash,
      }"
    >
      <header class="card-header clickable-header" @click="openDetailModal">
        <div class="device-title-block">
          <h3>{{ displayNameText }}</h3>
          <p class="last-seen-under-name">
            上次在线：{{ !device.online ? (lastSeenText || '暂无记录') : '当前在线' }}
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
      </header>

      <section class="camera-state-section" @click.stop>
        <div class="camera-work-row">
          <span class="camera-work-label">当前状态</span>
          <strong class="camera-work-status" :class="workStatusClass">{{ workStatusText }}</strong>
        </div>
        <p v-if="roiWarningText" class="camera-roi-warning">{{ roiWarningText }}</p>
        <div class="presence-grid">
          <div
            v-for="area in presenceRows"
            :key="area.targetIndex"
            class="presence-item"
            :class="{ present: area.present, inactive: area.inactive, ready: area.trackingReady }"
          >
            <span>{{ area.label }}</span>
            <strong>{{ area.statusText }}</strong>
            <button
              v-if="area.targetButton"
              type="button"
              class="area-capture-btn"
              :disabled="isTargetButtonDisabled(area.targetButton)"
              :title="getTargetButtonStatusText(area.targetButton)"
              @click.stop="handleAimTarget(area.targetButton)"
            >
              <span>拍摄</span>
              <small>{{ getTargetButtonStatusText(area.targetButton) }}</small>
            </button>
          </div>
        </div>
        <p v-if="aimMessage" class="camera-message error">{{ aimMessage }}</p>
      </section>

    <section class="camera-preview" @click.stop>
      <img v-if="previewImageUrl" :src="previewImageUrl" alt="摄像头预览" />
      <div v-else class="camera-preview-placeholder">
        <span class="camera-lens"></span>
        <strong>摄像头预览</strong>
        <p>暂无实时流或最近监测图</p>
      </div>
    </section>

      <section class="camera-metrics-strip" @click.stop>
        <div>
          <span>人流人数</span>
          <strong>{{ flowPersonCountText }}</strong>
        </div>
        <div>
          <span>置信度</span>
          <strong>{{ personConfidenceText }}</strong>
        </div>
        <div>
          <span>最近监测</span>
          <strong>{{ flowDetectTimeText }}</strong>
        </div>
        <div>
          <span>最近拍摄</span>
          <strong>{{ lastCaptureSummaryText }}</strong>
        </div>
      </section>

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
                <button class="detail-close-btn" type="button" @click="closeDetailModal">x</button>
              </div>

              <div class="detail-modal-body">
                <section class="device-info-section">
                  <div class="device-info-head">
                    <div>
                      <h4>设备信息</h4>
                      <p>芯片 ID：{{ device.chipId || '未知' }}</p>
                    </div>
                    <span class="device-info-status" :class="{ online: device.online, offline: !device.online }">
                      {{ device.online ? '在线' : '离线' }}
                    </span>
                  </div>

                  <div class="device-overview-grid">
                    <div class="device-info-cell">
                      <span>设备类型</span>
                      <strong>cam</strong>
                    </div>
                    <div class="device-info-cell">
                      <span>IP 地址</span>
                      <strong>{{ localForm.ip || '未设置' }}</strong>
                    </div>
                    <label class="device-info-cell editable">
                      <span>所属分区</span>
                      <input
                        v-model.trim="localForm.displayName"
                        type="text"
                        placeholder="如 主通道区"
                      />
                    </label>
                    <label class="device-info-cell editable">
                      <span>分区内编号</span>
                      <input
                        v-model.trim="localForm.deviceNo"
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
                      <span>固件升级状态</span>
                      <strong>{{ otaStatusText }}</strong>
                    </div>
                  </div>

                  <div v-if="showOtaProgress || otaCheckResult || otaMessage" class="ota-feedback-slot">
                    <div v-if="showOtaProgress" class="ota-progress-box" :class="otaProgressBoxClass">
                      <div class="ota-progress-head">
                        <span>{{ otaProgressTitle }}</span>
                        <strong>{{ otaProgressText }}</strong>
                      </div>
                      <div class="ota-progress-track" aria-hidden="true">
                        <div class="ota-progress-fill" :style="{ width: `${otaProgressFillWidth}%` }"></div>
                      </div>
                    </div>

                    <p v-else-if="otaMessage" class="ota-error-msg">{{ otaMessage }}</p>

                    <div v-else-if="otaCheckResult" class="ota-result">
                      <div>{{ otaUpdateText }}</div>
                      <div v-if="otaCheckResult.changelog" class="modal-hint">
                        更新说明：{{ otaCheckResult.changelog }}
                      </div>
                    </div>
                  </div>

                  <div class="detail-modal-actions ota-actions">
                    <button class="btn-secondary" type="button" :disabled="otaChecking" @click="handleCheckFirmwareUpdate">
                      {{ otaChecking ? '检查中...' : '检查更新' }}
                    </button>
                    <button class="btn-primary" type="button" :disabled="!canStartOta" @click="handleStartOtaUpdate">
                      {{ otaStarting ? '下发中...' : '确认更新' }}
                    </button>
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
                      v-for="item in cameraSelfTestRows"
                      :key="item.label"
                      class="self-test-row"
                      :class="item.okClass"
                    >
                      <span>{{ item.label }}</span>
                      <strong>{{ item.text }}</strong>
                    </div>
                  </div>

                  <p v-if="selfTestNanoStatusText" class="self-test-status-line">
                    控制板返回：{{ selfTestNanoStatusText }}
                  </p>
                </section>

                <section v-if="device.camLastCapture" class="capture-section">
                  <div class="section-title-row">
                    <h4>最近拍摄</h4>
                    <span>{{ lastCaptureStatusText }}</span>
                  </div>

                  <div class="capture-info-grid">
                    <div class="capture-info-item">
                      <span>任务编号</span>
                      <strong>{{ device.camLastCapture.taskId || '暂无' }}</strong>
                    </div>
                    <div class="capture-info-item">
                      <span>目标灯</span>
                      <strong>{{ device.camLastCapture.targetChipId || '暂无' }}</strong>
                    </div>
                  </div>

                  <div v-if="captureImageUrl" class="capture-preview">
                    <img :src="captureImageUrl" alt="摄像头拍摄照片" />
                  </div>
                  <p v-else-if="device.camLastCapture.imageName" class="camera-message">
                    图片已保存：{{ device.camLastCapture.imageName }}
                  </p>
                  <p v-if="device.camLastCapture.message" class="camera-message" :class="{ error: isLastCaptureError }">
                    {{ device.camLastCapture.message }}
                  </p>
                  <div v-if="canRetryLastCapture" class="capture-retry-actions">
                    <button class="btn-secondary" type="button" :disabled="aimLoading" @click="retryLastCapture">
                      {{ aimLoading ? '重试中...' : '重试拍摄' }}
                    </button>
                  </div>
                </section>

                <section class="roi-section">
                  <div class="section-title-row">
                    <h4>ROI 区域标定</h4>
                    <span>{{ roiReady ? '已配置' : '请先完成区域标定' }}</span>
                  </div>

                  <div class="roi-calibration-layout">
                    <div
                      ref="roiCanvasRef"
                      class="roi-calibration-canvas"
                      @pointerdown="handleRoiCanvasPointerDown"
                    >
                      <img v-if="roiReferenceUrl" :src="roiReferenceUrl" alt="ROI 标定参考图" />
                      <div v-else class="roi-placeholder">
                        <strong>摄像头预览</strong>
                        <span>暂无实时流或最近监测图，可先按比例拖框</span>
                      </div>
                      <button
                        v-for="roi in roiDraft.rois"
                        :key="roi.targetIndex"
                        type="button"
                        class="roi-box"
                        :class="{ active: roi.targetIndex === activeRoiIndex }"
                        :style="getRoiBoxStyle(roi)"
                        @pointerdown.stop="startRoiDrag($event, roi, 'move')"
                      >
                        <span>{{ roi.targetIndex }}</span>
                        <i @pointerdown.stop="startRoiDrag($event, roi, 'resize')"></i>
                      </button>
                    </div>

                    <div class="roi-editor-list">
                      <div class="roi-editor-item roi-global-config">
                        <div class="roi-editor-title">追踪参数</div>
                        <div class="roi-number-grid">
                          <label>
                            <span>目标丢失超时</span>
                            <input v-model.number="roiDraft.trackingLostTimeoutSeconds" type="number" min="1" step="1" />
                          </label>
                          <label>
                            <span>默认 UDP 端口</span>
                            <input v-model.number="roiDraft.udpPort" type="number" min="1" max="65535" step="1" />
                          </label>
                        </div>
                      </div>
                      <div class="roi-editor-item roi-global-config">
                        <div class="roi-editor-title">中心监测预设</div>
                        <div class="roi-preset-grid">
                          <label>
                            <span>水平轴</span>
                            <input v-model.number="roiDraft.centerPreset.yaw" type="number" min="0" max="180" step="1" />
                          </label>
                          <label>
                            <span>垂直轴</span>
                            <input v-model.number="roiDraft.centerPreset.pitch" type="number" min="0" max="180" step="1" />
                          </label>
                          <label>
                            <span>旋转轴</span>
                            <input v-model.number="roiDraft.centerPreset.roll" type="number" min="0" max="180" step="1" />
                          </label>
                        </div>
                      </div>
                      <div
                        v-for="roi in roiDraft.rois"
                        :key="`editor-${roi.targetIndex}`"
                        class="roi-editor-item"
                        :class="{ active: roi.targetIndex === activeRoiIndex }"
                      >
                        <button type="button" class="roi-editor-title" @click="activeRoiIndex = roi.targetIndex">
                          区域 {{ roi.targetIndex }}
                        </button>
                        <label>
                          <span>目标灯</span>
                          <BaseSelect
                            v-model="roi.targetChipId"
                            :options="targetSelectOptions"
                            placeholder="选择射灯设备"
                          />
                        </label>
                        <label>
                          <span>区域名称</span>
                          <input v-model.trim="roi.areaName" type="text" placeholder="如 新品展示区" />
                        </label>
                        <div class="roi-number-grid">
                          <label>
                            <span>停留秒</span>
                            <input v-model.number="roi.dwellSeconds" type="number" min="0" step="1" />
                          </label>
                          <label>
                            <span>离开延迟</span>
                            <input v-model.number="roi.leaveDelaySeconds" type="number" min="0" step="1" />
                          </label>
                          <label>
                            <span>置信度</span>
                            <input v-model.number="roi.confidenceThreshold" type="number" min="0" max="1" step="0.05" />
                          </label>
                        </div>
                        <div class="roi-number-grid roi-network-grid">
                          <label>
                            <span>UDP 地址</span>
                            <input v-model.trim="roi.udpIp" type="text" placeholder="192.168.1.101" />
                          </label>
                          <label>
                            <span>UDP 端口</span>
                            <input v-model.number="roi.udpPort" type="number" min="1" max="65535" step="1" />
                          </label>
                        </div>
                        <div class="roi-preset-group">
                          <div class="roi-preset-title">拍摄预设</div>
                          <div class="roi-preset-grid">
                            <label>
                              <span>水平轴</span>
                              <input v-model.number="roiDraft.capturePresets[roi.targetIndex].yaw" type="number" min="0" max="180" step="1" />
                            </label>
                            <label>
                              <span>垂直轴</span>
                              <input v-model.number="roiDraft.capturePresets[roi.targetIndex].pitch" type="number" min="0" max="180" step="1" />
                            </label>
                            <label>
                              <span>旋转轴</span>
                              <input v-model.number="roiDraft.capturePresets[roi.targetIndex].roll" type="number" min="0" max="180" step="1" />
                            </label>
                          </div>
                        </div>
                        <div class="roi-preset-group">
                          <div class="roi-preset-title">追踪预设</div>
                          <div class="roi-preset-grid">
                            <label>
                              <span>水平轴</span>
                              <input v-model.number="roiDraft.trackingPresets[roi.targetIndex].yaw" type="number" min="0" max="180" step="1" />
                            </label>
                            <label>
                              <span>垂直轴</span>
                              <input v-model.number="roiDraft.trackingPresets[roi.targetIndex].pitch" type="number" min="0" max="180" step="1" />
                            </label>
                            <label>
                              <span>旋转轴</span>
                              <input v-model.number="roiDraft.trackingPresets[roi.targetIndex].roll" type="number" min="0" max="180" step="1" />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p v-if="roiMessage" class="camera-message" :class="{ error: roiMessageIsError }">{{ roiMessage }}</p>
                  <div class="detail-modal-actions">
                    <button class="btn-secondary" type="button" :disabled="roiLoading" @click="loadRoiConfig">
                      {{ roiLoading ? '读取中...' : '重新读取' }}
                    </button>
                    <button class="btn-primary" type="button" :disabled="roiSaving" @click="handleSaveRoiConfig">
                      {{ roiSaving ? '保存中...' : '保存 ROI' }}
                    </button>
                  </div>
                </section>

                <section class="ptz-section">
                  <div class="section-title-row">
                    <h4>三轴云台调试</h4>
                    <span>{{ ptzLoading ? '下发中...' : device.online ? '可控制' : '离线禁用' }}</span>
                  </div>

                  <div class="ptz-grid">
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('yaw', 'left')">左</button>
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('pitch', 'up')">上</button>
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('yaw', 'right')">右</button>
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('pitch', 'down')">下</button>
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('roll', 'ccw')">逆时针</button>
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('all', 'center')">回中</button>
                    <button type="button" :disabled="ptzDisabled" @click="sendDirectionalPtz('roll', 'cw')">顺时针</button>
                  </div>

                  <label class="step-row">
                    <span>步进</span>
                    <input v-model.number="ptzStep" type="range" min="1" max="30" />
                    <strong>{{ ptzStep }}°</strong>
                  </label>

                  <p v-if="ptzMessage" class="camera-message error">{{ ptzMessage }}</p>
                </section>
              </div>

              <div class="detail-modal-actions detail-modal-footer">
                <button class="btn-danger" type="button" :disabled="deleting" @click="handleDelete">
                  {{ deleting ? '删除中...' : '删除' }}
                </button>
                <button class="btn-secondary" type="button" @click="closeDetailModal">取消</button>
                <button class="btn-primary" type="button" @click="saveDeviceBaseInfo">保存</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
      </Teleport>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import BaseSelect from '../common/BaseSelect.vue'
import type {
  CamPresenceArea,
  CamPresetMap,
  CamPtzPreset,
  CamRoiConfig,
  CamRoiItem,
  CamWorkStatus,
  DeviceCreatePayload,
  DeviceItem,
  FirmwareChannel,
  OtaCheckResult,
  PtzAxis,
  PtzDirection,
} from '../../types/device'
import {
  checkFirmwareUpdate,
  createCamCaptureTask,
  getCamRoiConfig,
  saveCamRoiConfig,
  sendCamPtz,
  startOtaUpdate,
} from '../../api/device'
import { getPersonFlowImageObjectUrl } from '../../api/personFlow'
import { getErrorMessage } from '../../utils/error'

const props = defineProps<{
  device: DeviceItem
  deleting?: boolean
  targetDevices?: DeviceItem[]
  camIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update-realtime', value: { id: number; payload: DeviceCreatePayload; lightControl?: boolean }): void
  (e: 'delete', id: number): void
}>()

type SelfTestValue = boolean | string | number | null | undefined
type SelfTestResult = {
  done?: boolean
  overall?: boolean
  fs?: boolean
  wifi?: boolean
  ws?: boolean
  huskylens?: boolean
  camera?: boolean
  gimbal?: boolean
  nano?: boolean
  nanoHoming?: boolean
  nanoHallStatus?: boolean
  nanoStatus?: string
  hall?: {
    yaw?: string
    pitch?: string
    roll?: string
    pan?: string
    tilt?: string
  }
}

type TargetButton = {
  label: string
  targetIndex: number
  targetChipId?: string
  targetOnline?: boolean
  targetMissing?: boolean
}

type RoiDragMode = 'move' | 'resize'
type RoiDragState = {
  mode: RoiDragMode
  targetIndex: number
  startX: number
  startY: number
  startRoi: CamRoiItem
}

type SelfCheckStatusCarrier = DeviceItem & {
  selfCheckStatus?: string | boolean | number | null
  checkStatus?: string | boolean | number | null
  inspectionStatus?: string | boolean | number | null
  selfTestStatus?: string | boolean | number | null
}

const localForm = reactive<DeviceCreatePayload>({
  chipId: '',
  ip: '',
  displayName: '',
  deviceType: 'cam',
  deviceNo: '',
})

const showDetailModal = ref(false)
const firmwareChannel = ref<FirmwareChannel>('stable')
const otaChecking = ref(false)
const otaStarting = ref(false)
const otaCheckResult = ref<OtaCheckResult | null>(null)
const otaMessage = ref('')
const ptzLoading = ref(false)
const ptzMessage = ref('')
const ptzStep = ref(5)
const aimLoading = ref(false)
const aimMessage = ref('')
const localCapturePending = ref(false)
let localCapturePendingTimer: ReturnType<typeof setTimeout> | null = null
const onlineFlash = ref(false)
let onlineFlashTimer: ReturnType<typeof setTimeout> | null = null
const roiCanvasRef = ref<HTMLElement | null>(null)
const roiDraft = ref<CamRoiConfig>(createDefaultRoiConfig(''))
const roiLoading = ref(false)
const roiSaving = ref(false)
const roiMessage = ref('')
const roiMessageIsError = ref(false)
const activeRoiIndex = ref(1)
const roiDragState = ref<RoiDragState | null>(null)
const captureImageUrl = ref('')
const flowImageUrl = ref('')

const firmwareChannelOptions = [
  { label: '正式版', value: 'stable' },
  { label: '测试版', value: 'test' },
]

const displayNameText = computed(() => {
  const index = Number.isFinite(props.camIndex) && Number(props.camIndex) > 0
    ? Number(props.camIndex)
    : 1
  return `摄像头-${index}`
})

const streamUrl = computed(() => {
  return (
    props.device.cameraStreamUrl ||
    props.device.streamUrl ||
    props.device.previewUrl ||
    ''
  )
})

const previewImageUrl = computed(() => {
  return streamUrl.value || flowImageUrl.value || captureImageUrl.value
})

const roiReferenceUrl = computed(() => {
  return previewImageUrl.value
})

const targetSelectOptions = computed(() => {
  return (props.targetDevices || []).flatMap((target, index) => {
    if (!target.chipId) return []
    return [{
      label: getTargetDeviceLabel(target, index + 1),
      value: target.chipId,
    }]
  })
})

const roiReady = computed(() => {
  const configured = props.device.camRoiConfig?.configured ?? roiDraft.value.configured
  if (configured) return true
  return roiDraft.value.rois.slice(0, 3).every(isRoiReady)
})

const roiWarningText = computed(() => {
  if (!props.device.online) return ''
  if (!roiReady.value) return '区域未配置，请在详情中完成区域标定'
  if (!isCenterMonitoringStatus.value) return '非中心监测位，ROI 判断暂停'
  return ''
})

const isCenterMonitoringStatus = computed(() => {
  return ['monitoring', 'presence'].includes(normalizedWorkStatus.value)
})

const normalizedWorkStatus = computed(() => {
  if (!props.device.online) return 'offline'
  const trackingStatus = props.device.trackingStatus?.status
  if (trackingStatus === 'tracking') return 'tracking'
  if (trackingStatus === 'lost' || trackingStatus === 'timeout') return 'lost'
  if (trackingStatus === 'error') return 'error'
  const status = normalizeCamWorkStatus(props.device.camWorkStatus || props.device.camPresence?.workStatus || 'monitoring')
  if (localCapturePending.value && ['monitoring', 'presence'].includes(status)) return 'capturing'
  return status
})

const workStatusText = computed(() => {
  return getCamWorkStatusText(normalizedWorkStatus.value)
})

const workStatusClass = computed(() => {
  return {
    busy: isCamBusy.value,
    error: ['lost', 'offline', 'error'].includes(normalizedWorkStatus.value),
    active: ['presence', 'monitoring'].includes(normalizedWorkStatus.value),
  }
})

const lastCaptureStatusText = computed(() => {
  const status = props.device.camLastCapture?.status
  if (!status) return '暂无状态'
  return getCamWorkStatusText(status)
})

const flowPersonCountText = computed(() => {
  const value =
    props.device.camPresence?.personCount ??
    props.device.flowPersonCount ??
    props.device.peopleCount ??
    props.device.personCount
  if (value == null || Number.isNaN(Number(value))) return '暂无'
  return `${Math.max(0, Number(value))} 人`
})

const personConfidenceText = computed(() => {
  const value = props.device.personConfidence ?? props.device.camPresence?.confidence
  if (value == null || Number.isNaN(Number(value))) return '暂无'
  return formatConfidencePercent(Number(value))
})

const flowDetectTimeText = computed(() => {
  const value =
    props.device.flowDetectTime ??
    props.device.personDetectTime ??
    props.device.camPresence?.updateTime ??
    props.device.detectTime
  return formatMinuteDateTime(value) || '暂无'
})

const lastCaptureSummaryText = computed(() => {
  const capture = props.device.camLastCapture
  if (!capture) return '暂无'
  const targetIndex = capture.targetIndex ? `区域 ${capture.targetIndex}` : '目标灯'
  return `${targetIndex} · ${getCamWorkStatusText(capture.status || '')}`
})

const isLastCaptureError = computed(() => {
  return ['timeout', 'upload_failed', 'photo_saved_ai_failed', 'error'].includes(String(props.device.camLastCapture?.status || ''))
})

const canRetryLastCapture = computed(() => {
  return Boolean(
    isLastCaptureError.value &&
    props.device.online &&
    !isCamBusy.value &&
    props.device.camLastCapture?.targetIndex,
  )
})

const isCamBusy = computed(() => {
  return ['capturing', 'uploading', 'returning_center', 'ready_tracking', 'tracking'].includes(normalizedWorkStatus.value)
})

const presenceRows = computed(() => {
  const areas: CamPresenceArea[] = props.device.camPresence?.areas || []
  const activeRoi = roiReady.value && isCenterMonitoringStatus.value
  return [1, 2, 3].map((index) => {
    const area = areas.find(item => Number(item.targetIndex) === index)
    const roi = roiDraft.value.rois.find(item => item.targetIndex === index)
    const targetChipId = area?.targetChipId || roi?.targetChipId
    const targetLamp = findTargetDevice(targetChipId)
    const present = activeRoi && Boolean(area?.present)
    const trackingReady = Boolean(present && targetLamp?.online && isLampClothTaken(targetLamp))
    return {
      targetIndex: index,
      present,
      trackingReady,
      inactive: !activeRoi,
      confidence: area?.confidence,
      dwellSeconds: area?.dwellSeconds,
      statusText: getPresenceStatusText(present, targetLamp, trackingReady, activeRoi),
      label: getPresenceLabel(
        area?.areaName || roi?.areaName || `区域 ${index}`,
        targetChipId,
        index,
      ),
      targetButton: targetButtons.value.find(target => target.targetIndex === index),
    }
  })
})

const targetButtons = computed<TargetButton[]>(() => {
  const configuredTargets = roiDraft.value.rois.slice(0, 3).map((roi) => {
    const target = findTargetDevice(roi.targetChipId)
    return {
      label: getPresenceLabel(roi.areaName?.trim() || `区域 ${roi.targetIndex}`, roi.targetChipId, roi.targetIndex),
      targetIndex: roi.targetIndex,
      targetChipId: roi.targetChipId,
      targetOnline: target?.online,
      targetMissing: Boolean(roi.targetChipId && !target),
    }
  })

  const realTargets: TargetButton[] = configuredTargets.some(item => item.targetChipId)
    ? configuredTargets
    : (props.targetDevices || []).slice(0, 3).map((target, index) => ({
      label: getTargetDeviceLabel(target, index + 1),
      targetIndex: index + 1,
      targetChipId: target.chipId,
      targetOnline: target.online,
      targetMissing: false,
    }))

  while (realTargets.length < 3) {
    const index = realTargets.length + 1
    realTargets.push({
      label: `灯具-${index}`,
      targetIndex: index,
    })
  }

  return realTargets
})

const firmwareVersionText = computed(() => {
  const version = props.device.firmwareVersion || 'unknown'
  const code = props.device.firmwareVersionCode
  return code == null ? version : `${version} (${code})`
})

const otaStatusValue = computed(() => props.device.otaStatus || 'idle')
const otaProgress = computed(() => clampProgress(props.device.otaProgress))

const otaStatusText = computed(() => {
  const map: Record<string, string> = {
    idle: '空闲',
    updating: '更新中',
    success: '更新成功',
    failed: '更新失败',
  }
  return map[otaStatusValue.value] || otaStatusValue.value
})

const showOtaProgress = computed(() => {
  return otaStatusValue.value === 'updating' ||
    otaStatusValue.value === 'success' ||
    otaStatusValue.value === 'failed'
})

const otaProgressFillWidth = computed(() => {
  if (otaStatusValue.value === 'success') return 100
  return otaProgress.value
})

const otaProgressText = computed(() => `${otaProgressFillWidth.value}%`)

const otaProgressTitle = computed(() => {
  if (otaStatusValue.value === 'success') return '更新成功'
  if (otaStatusValue.value === 'failed') return '更新失败'
  return '固件更新中'
})

const otaProgressBoxClass = computed(() => ({
  success: otaStatusValue.value === 'success',
  failed: otaStatusValue.value === 'failed',
}))

const otaUpdateText = computed(() => {
  const result = otaCheckResult.value
  if (!result) return ''
  if (!result.latestVersion) return '当前通道暂无可用固件'
  if (!result.hasUpdate) return '当前已是该通道最新版本'
  return `发现新版本 ${result.latestVersion}`
})

const canStartOta = computed(() => {
  return Boolean(
    otaCheckResult.value?.hasUpdate &&
    otaCheckResult.value.firmwareId &&
    !otaChecking.value &&
    !otaStarting.value &&
    otaStatusValue.value !== 'updating',
  )
})

const ptzDisabled = computed(() => !props.device.online || ptzLoading.value)

const selfTest = computed(() => {
  return parseSelfTestJson(props.device.selfTestJson)
})

const fallbackSelfCheckStatus = computed(() => {
  const device = props.device as SelfCheckStatusCarrier
  return device.selfCheckStatus ??
    device.checkStatus ??
    device.inspectionStatus ??
    device.selfTestStatus ??
    null
})

const selfTestBadgeClass = computed(() => {
  if (!selfTest.value?.done) return normalizeSelfCheckStatus(fallbackSelfCheckStatus.value).className
  return selfTest.value.overall ? 'ok' : 'bad'
})

const selfTestBadgeText = computed(() => {
  if (!selfTest.value?.done) return normalizeSelfCheckStatus(fallbackSelfCheckStatus.value).text
  return selfTest.value.overall ? '自检正常' : '自检异常'
})

const selfTestTimeText = computed(() => {
  if (!props.device.online || !selfTest.value?.done) return '暂无记录'
  return formatDateTime(props.device.selfTestTime) || '暂无记录'
})

const selfTestNanoStatusText = computed(() => selfTest.value?.nanoStatus || '')

const cameraSelfTestRows = computed(() => {
  const data = selfTest.value
  if (!data) {
    return [
      { label: '整体', text: '未自检', okClass: 'unknown' },
    ]
  }

  return [
    { label: '整体', text: statusText(data.overall), okClass: statusClass(data.overall) },
    { label: '网络 WiFi', text: statusText(data.wifi), okClass: statusClass(data.wifi) },
    { label: '实时连接', text: statusText(data.ws), okClass: statusClass(data.ws) },
    { label: '视觉模块', text: statusText(data.huskylens), okClass: statusClass(data.huskylens) },
    { label: '\u6444\u50cf\u5934', text: statusText(data.camera), okClass: statusClass(data.camera) },
    { label: '\u4e09\u8f74\u4e91\u53f0', text: statusText(data.gimbal), okClass: statusClass(data.gimbal) },
    { label: '文件系统', text: statusText(data.fs), okClass: statusClass(data.fs) },
    { label: '控制板通讯', text: statusText(data.nano), okClass: statusClass(data.nano) },
    { label: '云台寻零', text: statusText(data.nanoHoming), okClass: statusClass(data.nanoHoming) },
    { label: '霍尔读取', text: statusText(data.nanoHallStatus), okClass: statusClass(data.nanoHallStatus) },
    { label: '水平轴霍尔', text: statusText(data.hall?.yaw ?? data.hall?.pan), okClass: statusClass(data.hall?.yaw ?? data.hall?.pan) },
    { label: '垂直轴霍尔', text: statusText(data.hall?.pitch ?? data.hall?.tilt), okClass: statusClass(data.hall?.pitch ?? data.hall?.tilt) },
    { label: '旋转轴霍尔', text: statusText(data.hall?.roll), okClass: statusClass(data.hall?.roll) },
  ]
})

function getTargetDeviceLabel(target: DeviceItem, fallbackIndex: number) {
  const anyTarget = target as DeviceItem & {
    name?: string
    areaName?: string
    zoneName?: string
  }
  const explicitName = anyTarget.name?.trim() || target.displayName?.trim()
  const areaName = anyTarget.areaName?.trim() || anyTarget.zoneName?.trim()

  if (areaName && explicitName) return `${areaName} · ${explicitName}`
  if (explicitName) return explicitName
  if (target.chipId) return target.chipId
  return `灯具-${fallbackIndex}`
}

function getPresenceLabel(areaLabel: string, targetChipId: string | undefined, fallbackIndex: number) {
  const targetLabel = targetChipId ? getTargetLabelByChipId(targetChipId, fallbackIndex) : ''
  return targetLabel ? `${areaLabel} · ${targetLabel}` : areaLabel
}

function getTargetLabelByChipId(chipId: string | undefined, fallbackIndex: number) {
  const target = findTargetDevice(chipId)
  return target ? getTargetDeviceLabel(target, fallbackIndex) : `灯具-${fallbackIndex}`
}

function normalizeChipId(value?: string) {
  return String(value || '').trim().toUpperCase()
}

function findTargetDevice(chipId?: string) {
  const normalizedChipId = normalizeChipId(chipId)
  if (!normalizedChipId) return undefined
  return (props.targetDevices || []).find(item => normalizeChipId(item.chipId) === normalizedChipId)
}

function isLampClothTaken(target?: DeviceItem) {
  const status = String(target?.lampClothState?.clothStatus || '').trim().toLowerCase()
  return ['taken', 'removed', 'off_rack', 'offrack'].includes(status)
}

function getPresenceStatusText(
  present: boolean,
  target: DeviceItem | undefined,
  trackingReady: boolean,
  activeRoi = true,
) {
  if (!activeRoi) return roiReady.value ? '暂停' : '未配置'
  if (!present) return '无人'
  if (!target) return '目标缺失'
  if (!target.online) return '灯具离线'
  if (trackingReady) return '可追踪'
  return '未取下'
}

function normalizeCamWorkStatus(status: CamWorkStatus): CamWorkStatus {
  const value = String(status || '').trim().toLowerCase()
  if (['centered', 'center_done', 'centered_monitoring', 'returned_center', 'returned_to_center', 'home', 'homed', 'idle'].includes(value)) {
    return 'monitoring'
  }
  if (['returning', 'returningcenter', 'returning_center', 'return_to_center', 'homing', 'stopping', 'stopped'].includes(value)) {
    return 'returning_center'
  }
  if (['lost_timeout', 'target_lost'].includes(value)) return 'lost'
  if (['capture', 'capturing_cloth'].includes(value)) return 'capturing'
  if (['upload', 'uploading_photo'].includes(value)) return 'uploading'
  return value || 'monitoring'
}

function getCamWorkStatusText(status: CamWorkStatus) {
  const normalizedStatusText = String(normalizeCamWorkStatus(status) || '')
  if (normalizedStatusText === 'upload_failed') return '\u4e0a\u4f20\u5931\u8d25'
  if (normalizedStatusText === 'ai_done') return '\u8bc6\u522b\u5df2\u5b8c\u6210'
  if (normalizedStatusText === 'photo_saved_ai_failed') return '\u8bc6\u522b\u5931\u8d25'

  const map: Record<string, string> = {
    monitoring: '顾客感知中',
    presence: '有人靠近',
    capturing: '正在拍摄服装',
    uploading: '上传照片中',
    returning_center: '回中心中',
    ready_tracking: '准备追踪',
    tracking: '追踪中',
    lost: '目标丢失',
    stopped: '回中心中',
    timeout: '目标丢失',
    ready: '准备追踪',
    offline: '离线',
    error: '异常',
  }
  return map[String(status)] || String(status || '顾客感知中')
}

function createDefaultRoiConfig(camChipId: string): CamRoiConfig {
  return {
    camChipId,
    configured: false,
    centerPreset: createDefaultPreset(),
    capturePresets: createDefaultPresetMap(),
    trackingPresets: createDefaultPresetMap(),
    trackingLostTimeoutSeconds: 5,
    udpPort: 4211,
    rois: [1, 2, 3].map(createDefaultRoi),
  }
}

function createDefaultPreset(): CamPtzPreset {
  return {
    yaw: 90,
    pitch: 90,
    roll: 90,
  }
}

function createDefaultPresetMap(): CamPresetMap {
  return [1, 2, 3].reduce<CamPresetMap>((map, index) => {
    map[String(index)] = createDefaultPreset()
    return map
  }, {})
}

function createDefaultRoi(targetIndex: number): CamRoiItem {
  const width = 0.24
  const height = 0.38
  return {
    targetIndex,
    targetChipId: '',
    areaName: `区域 ${targetIndex}`,
    x: 0.08 + (targetIndex - 1) * 0.32,
    y: 0.3,
    w: width,
    h: height,
    dwellSeconds: 2,
    leaveDelaySeconds: 3,
    confidenceThreshold: 0.65,
    udpPort: 4211,
  }
}

function normalizeRoiConfig(value: Partial<CamRoiConfig> | null | undefined, camChipId: string): CamRoiConfig {
  const sourceRois = Array.isArray(value?.rois) ? value.rois : []
  const rois = [1, 2, 3].map((index) => {
    const source = sourceRois.find(item => Number(item?.targetIndex) === index)
    return normalizeRoi(source, index)
  })
  return {
    camChipId,
    configured: Boolean(value?.configured) || rois.every(isRoiReady),
    centerPreset: normalizePreset(value?.centerPreset),
    capturePresets: normalizePresetMap(value?.capturePresets),
    trackingPresets: normalizePresetMap(value?.trackingPresets),
    trackingLostTimeoutSeconds: clampNumber(value?.trackingLostTimeoutSeconds, 5, 1),
    udpPort: clampNumber(value?.udpPort, 4211, 1, 65535),
    rois,
  }
}

function normalizePreset(value: unknown): CamPtzPreset {
  const source = isPlainObject(value) ? value : {}
  return {
    yaw: clampNumber(source.yaw, 90, 0, 180),
    pitch: clampNumber(source.pitch, 90, 0, 180),
    roll: clampNumber(source.roll, 90, 0, 180),
    configured: Boolean(source.configured),
  }
}

function normalizePresetMap(value: unknown): CamPresetMap {
  const arrayValue = Array.isArray(value) ? value : null
  const objectValue = isPlainObject(value) ? value : {}
  return [1, 2, 3].reduce<CamPresetMap>((map, index) => {
    const source = arrayValue ? arrayValue[index - 1] : objectValue[String(index)]
    map[String(index)] = normalizePreset(source)
    return map
  }, {})
}

function normalizeRoi(value: Partial<CamRoiItem> | undefined, targetIndex: number): CamRoiItem {
  const fallback = createDefaultRoi(targetIndex)
  return {
    ...fallback,
    ...value,
    targetIndex,
    targetChipId: value?.targetChipId || '',
    areaName: value?.areaName || fallback.areaName,
    x: clampUnit(value?.x ?? fallback.x),
    y: clampUnit(value?.y ?? fallback.y),
    w: clampUnit(value?.w ?? fallback.w, 0.03, 1),
    h: clampUnit(value?.h ?? fallback.h, 0.03, 1),
    dwellSeconds: Number(value?.dwellSeconds ?? fallback.dwellSeconds),
    leaveDelaySeconds: Number(value?.leaveDelaySeconds ?? fallback.leaveDelaySeconds),
    confidenceThreshold: clampUnit(value?.confidenceThreshold ?? fallback.confidenceThreshold, 0, 1),
    udpIp: value?.udpIp || fallback.udpIp,
    udpPort: clampNumber(value?.udpPort, fallback.udpPort || 4211, 1, 65535),
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isRoiReady(roi: CamRoiItem) {
  return Boolean(roi.targetChipId && roi.w >= 0.03 && roi.h >= 0.03)
}

function clampUnit(value: unknown, min = 0, max = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function clampNumber(value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

function clampRoiToBounds(roi: CamRoiItem): CamRoiItem {
  const w = clampUnit(roi.w, 0.03, 1)
  const h = clampUnit(roi.h, 0.03, 1)
  return {
    ...roi,
    w,
    h,
    x: clampUnit(roi.x, 0, 1 - w),
    y: clampUnit(roi.y, 0, 1 - h),
  }
}

function getRoiBoxStyle(roi: CamRoiItem) {
  const normalized = clampRoiToBounds(roi)
  return {
    left: `${normalized.x * 100}%`,
    top: `${normalized.y * 100}%`,
    width: `${normalized.w * 100}%`,
    height: `${normalized.h * 100}%`,
  }
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

function clampProgress(value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(100, Math.round(numericValue)))
}

function openDetailModal() {
  syncFromProps()
  showDetailModal.value = true
  void loadRoiConfig()
}

function closeDetailModal() {
  showDetailModal.value = false
}

function syncFromProps() {
  localForm.chipId = props.device.chipId || ''
  localForm.ip = props.device.ip || ''
  localForm.displayName = props.device.displayName || ''
  localForm.deviceType = 'cam'
  localForm.deviceNo = props.device.deviceNo || ''
  firmwareChannel.value = props.device.firmwareChannel === 'test' ? 'test' : 'stable'
  roiDraft.value = normalizeRoiConfig(props.device.camRoiConfig || roiDraft.value, props.device.chipId || '')
}

function saveDeviceBaseInfo() {
  emit('update-realtime', {
    id: props.device.id,
    payload: {
      chipId: localForm.chipId,
      ip: localForm.ip || '',
      displayName: localForm.displayName || '',
      deviceType: 'cam',
      deviceNo: localForm.deviceNo || '',
    },
  })
  showDetailModal.value = false
}

function handleDelete() {
  const targetName = displayNameText.value || props.device.chipId || '该设备'
  if (!window.confirm(`确认删除设备 ${targetName} 吗？`)) return
  emit('delete', props.device.id)
}

function isTargetButtonDisabled(target: TargetButton) {
  return Boolean(getTargetButtonDisabledReason(target))
}

function getTargetButtonDisabledReason(target: TargetButton) {
  if (aimLoading.value) return '任务创建中'
  if (!props.device.online) return '摄像头离线'
  if (isCamBusy.value) return '摄像头忙碌中'
  if (!target.targetChipId) return '目标灯未绑定'
  if (target.targetMissing) return '目标灯不存在'
  if (target.targetOnline === false) return '目标灯离线'
  return ''
}

function getTargetButtonStatusText(target: TargetButton) {
  const disabledReason = getTargetButtonDisabledReason(target)
  if (disabledReason) return disabledReason
  return '创建服装拍摄任务'
}

async function handleAimTarget(target: TargetButton) {
  if (!props.device.chipId || isTargetButtonDisabled(target)) {
    aimMessage.value = getTargetButtonDisabledReason(target) || '摄像头缺少 chipId，无法创建拍摄任务'
    return
  }

  await createCaptureTaskForTarget(target.targetIndex, target.targetChipId)
}

async function createCaptureTaskForTarget(targetIndex: number, targetChipId?: string) {
  if (!props.device.chipId) {
    aimMessage.value = '摄像头缺少 chipId，无法创建拍摄任务'
    return
  }

  aimLoading.value = true
  aimMessage.value = ''

  const payload: { camChipId: string; targetIndex: number; targetChipId?: string } = {
    camChipId: props.device.chipId,
    targetIndex,
  }
  if (targetChipId) {
    payload.targetChipId = targetChipId
  }

  try {
    const result = await createCamCaptureTask(payload)
    beginLocalCapturePending()
    aimMessage.value = result?.taskId ? `拍摄任务已创建：${result.taskId}` : '拍摄任务已创建'
  } catch (error) {
    aimMessage.value = getErrorMessage(error, '服装拍摄任务创建失败')
  } finally {
    aimLoading.value = false
  }
}

async function retryLastCapture() {
  const capture = props.device.camLastCapture
  if (!capture?.targetIndex || aimLoading.value || isCamBusy.value || !props.device.online) return
  await createCaptureTaskForTarget(capture.targetIndex, capture.targetChipId)
}

async function sendDirectionalPtz(axis: PtzAxis, direction: PtzDirection) {
  if (!props.device.chipId || ptzDisabled.value) return

  ptzLoading.value = true
  ptzMessage.value = ''

  try {
    await sendCamPtz({
      chipId: props.device.chipId,
      axis,
      direction,
      step: ptzStep.value,
    })
  } catch (error) {
    ptzMessage.value = getErrorMessage(error, '云台控制下发失败')
  } finally {
    ptzLoading.value = false
  }
}

async function handleCheckFirmwareUpdate() {
  if (!props.device.chipId) return
  otaChecking.value = true
  otaMessage.value = ''
  otaCheckResult.value = null

  try {
    otaCheckResult.value = await checkFirmwareUpdate(props.device.chipId, firmwareChannel.value)
  } catch (error) {
    otaMessage.value = getErrorMessage(error, '检查更新失败')
  } finally {
    otaChecking.value = false
  }
}

async function handleStartOtaUpdate() {
  if (!props.device.chipId || !otaCheckResult.value?.firmwareId) return

  const target = otaCheckResult.value.latestVersion || 'selected firmware'
  if (!window.confirm(`确认更新到 ${target} 吗？`)) return

  otaStarting.value = true
  otaMessage.value = ''

  try {
    await startOtaUpdate(props.device.chipId, otaCheckResult.value.firmwareId, firmwareChannel.value)
    otaCheckResult.value = null
  } catch (error) {
    otaMessage.value = getErrorMessage(error, 'OTA 更新指令下发失败')
  } finally {
    otaStarting.value = false
  }
}

async function loadRoiConfig() {
  if (!props.device.chipId || roiLoading.value) return

  roiLoading.value = true
  roiMessage.value = ''
  roiMessageIsError.value = false

  try {
    const result = await getCamRoiConfig(props.device.chipId)
    roiDraft.value = normalizeRoiConfig(result, props.device.chipId)
  } catch (error) {
    roiMessage.value = getErrorMessage(error, 'ROI 配置读取失败')
    roiMessageIsError.value = true
  } finally {
    roiLoading.value = false
  }
}

async function handleSaveRoiConfig() {
  if (!props.device.chipId || roiSaving.value) return

  roiSaving.value = true
  roiMessage.value = ''
  roiMessageIsError.value = false

  const payload = normalizeRoiConfig(roiDraft.value, props.device.chipId)
  payload.configured = payload.rois.every(isRoiReady)

  try {
    const result = await saveCamRoiConfig(props.device.chipId, payload)
    roiDraft.value = normalizeRoiConfig(result, props.device.chipId)
    roiMessage.value = payload.configured ? 'ROI 配置已保存' : 'ROI 已保存，但仍有区域未绑定目标灯'
    roiMessageIsError.value = !payload.configured
  } catch (error) {
    roiMessage.value = getErrorMessage(error, 'ROI 配置保存失败')
    roiMessageIsError.value = true
  } finally {
    roiSaving.value = false
  }
}

function handleRoiCanvasPointerDown(event: PointerEvent) {
  const rect = roiCanvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const index = activeRoiIndex.value || 1
  const x = clampUnit((event.clientX - rect.left) / rect.width, 0, 0.97)
  const y = clampUnit((event.clientY - rect.top) / rect.height, 0, 0.97)
  const roi = roiDraft.value.rois.find(item => item.targetIndex === index)
  if (!roi) return

  roi.x = x
  roi.y = y
  roi.w = Math.max(roi.w || 0.18, 0.18)
  roi.h = Math.max(roi.h || 0.22, 0.22)
  Object.assign(roi, clampRoiToBounds(roi))
}

function startRoiDrag(event: PointerEvent, roi: CamRoiItem, mode: RoiDragMode) {
  const rect = roiCanvasRef.value?.getBoundingClientRect()
  if (!rect) return

  activeRoiIndex.value = roi.targetIndex
  roiDragState.value = {
    mode,
    targetIndex: roi.targetIndex,
    startX: event.clientX,
    startY: event.clientY,
    startRoi: { ...roi },
  }

  window.addEventListener('pointermove', handleRoiPointerMove)
  window.addEventListener('pointerup', stopRoiDrag, { once: true })
}

function handleRoiPointerMove(event: PointerEvent) {
  const state = roiDragState.value
  const rect = roiCanvasRef.value?.getBoundingClientRect()
  if (!state || !rect) return

  const roi = roiDraft.value.rois.find(item => item.targetIndex === state.targetIndex)
  if (!roi) return

  const dx = (event.clientX - state.startX) / rect.width
  const dy = (event.clientY - state.startY) / rect.height

  if (state.mode === 'move') {
    roi.x = state.startRoi.x + dx
    roi.y = state.startRoi.y + dy
  } else {
    roi.w = state.startRoi.w + dx
    roi.h = state.startRoi.h + dy
  }

  Object.assign(roi, clampRoiToBounds(roi))
}

function stopRoiDrag() {
  roiDragState.value = null
  window.removeEventListener('pointermove', handleRoiPointerMove)
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
  if (value === 'unknown' || value == null || value === '') return '未知'
  return String(value)
}

function statusClass(value: SelfTestValue) {
  if (value === true || value === 'clear' || value === 'triggered') return 'ok'
  if (value === false) return 'bad'
  return 'unknown'
}

function normalizeSelfCheckStatus(value: SelfTestValue): { className: 'ok' | 'bad' | 'unknown'; text: string } {
  if (value === true || value === 1) return { className: 'ok', text: '自检正常' }
  if (value === false || value === 0) return { className: 'bad', text: '自检异常' }
  if (value == null || value === '') return { className: 'unknown', text: '未自检' }

  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return { className: 'unknown', text: '未自检' }
  if (
    ['ok', 'normal', 'success', 'passed', 'pass', 'healthy', 'done'].includes(normalized) ||
    normalized.includes('正常') ||
    normalized.includes('通过')
  ) {
    return { className: 'ok', text: '自检正常' }
  }
  if (
    ['bad', 'error', 'failed', 'fail', 'abnormal', 'fault'].includes(normalized) ||
    normalized.includes('异常') ||
    normalized.includes('失败') ||
    normalized.includes('故障')
  ) {
    return { className: 'bad', text: '自检异常' }
  }

  return { className: 'unknown', text: String(value) }
}

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

function formatConfidencePercent(value: number) {
  if (!Number.isFinite(value)) return '暂无'
  const normalized = value > 1 ? value / 100 : value
  return `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`
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

function clearLocalCapturePending() {
  localCapturePending.value = false
  if (localCapturePendingTimer) {
    clearTimeout(localCapturePendingTimer)
    localCapturePendingTimer = null
  }
}

function beginLocalCapturePending() {
  clearLocalCapturePending()
  localCapturePending.value = true
  localCapturePendingTimer = setTimeout(() => {
    localCapturePending.value = false
    localCapturePendingTimer = null
    if (!props.device.camWorkStatus || ['monitoring', 'presence'].includes(String(props.device.camWorkStatus))) {
      aimMessage.value = '拍摄任务已创建，等待设备响应超时，请检查摄像头状态'
    }
  }, 90000)
}

function clearCaptureImageUrl() {
  if (captureImageUrl.value) {
    URL.revokeObjectURL(captureImageUrl.value)
  }
  captureImageUrl.value = ''
}

function clearFlowImageUrl() {
  if (flowImageUrl.value) {
    URL.revokeObjectURL(flowImageUrl.value)
  }
  flowImageUrl.value = ''
}

async function loadCaptureImage(imageName?: string) {
  clearCaptureImageUrl()
  if (!imageName) return
  try {
    captureImageUrl.value = await getPersonFlowImageObjectUrl(imageName)
  } catch {
    captureImageUrl.value = ''
  }
}

async function loadFlowImage(imageName?: string) {
  clearFlowImageUrl()
  if (!imageName) return
  try {
    flowImageUrl.value = await getPersonFlowImageObjectUrl(imageName)
  } catch {
    flowImageUrl.value = ''
  }
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
    clearLocalCapturePending()
    otaCheckResult.value = null
    otaMessage.value = ''
    ptzMessage.value = ''
    aimMessage.value = ''
  },
)

watch(
  () => [props.device.camWorkStatus, props.device.camLastCapture?.status],
  ([workStatus, captureStatus]) => {
    if (workStatus || captureStatus) {
      clearLocalCapturePending()
    }
  },
)

watch(
  () => props.device.camLastCapture?.imageName,
  (imageName) => {
    void loadCaptureImage(imageName)
  },
  { immediate: true },
)

watch(
  () => props.device.flowImageName,
  (imageName) => {
    void loadFlowImage(imageName)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (onlineFlashTimer) {
    clearTimeout(onlineFlashTimer)
  }
  clearLocalCapturePending()
  clearCaptureImageUrl()
  clearFlowImageUrl()
  window.removeEventListener('pointermove', handleRoiPointerMove)
})
</script>

<style scoped>
.camera-card {
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

.camera-card::after {
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

.camera-card.is-online {
  border-color: rgba(34, 197, 94, 0.26);
  box-shadow:
    0 8px 22px rgba(15, 23, 42, 0.06),
    0 0 0 1px rgba(34, 197, 94, 0.08);
}

.camera-card.is-offline {
  opacity: 0.82;
  border-color: rgba(226, 232, 240, 0.9);
}

.camera-card.online-flash {
  animation: onlineCardFlash 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.camera-card.online-flash::after {
  animation: onlineCardSweep 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.clickable-header {
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.clickable-header:hover {
  transform: translateY(-1px);
  opacity: 0.96;
}

.device-title-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.device-title-block h3 {
  margin: 0;
  word-break: break-word;
}

.camera-card h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

.last-seen-under-name {
  margin: 6px 0 0;
  font-size: 14px;
  color: #8a8a8a;
  line-height: 1.4;
}

.card-status-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.status-badge,
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

.status-badge {
  font-weight: 600;
}

.status-badge::before,
.self-test-badge::before {
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

.device-info-status.online,
.self-test-badge.ok {
  color: #16a34a;
  background: #ecfdf3;
}

.device-info-status.offline,
.self-test-badge.bad {
  color: #dc2626;
  background: #fff1f2;
}

.self-test-badge.unknown {
  color: #64748b;
  background: #f1f5f9;
}

.camera-state-section {
  margin: 10px 0 12px;
  padding: 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.camera-work-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.camera-work-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.camera-work-status {
  color: #1677ff;
  font-size: 13px;
  font-weight: 800;
}

.camera-work-status.busy {
  color: #d97706;
}

.camera-work-status.error {
  color: #dc2626;
}

.camera-work-status.active {
  color: #16a34a;
}

.camera-roi-warning {
  margin: 7px 0 0;
  color: #d97706;
  font-size: 12px;
  line-height: 1.35;
}

.presence-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.presence-item {
  min-width: 0;
  padding: 7px 8px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.presence-item span,
.presence-item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.presence-item span {
  color: #64748b;
  font-size: 11px;
}

.presence-item strong {
  margin-top: 2px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.presence-item.present {
  border-color: rgba(245, 108, 108, 0.3);
  background: #fff7f7;
}

.presence-item.present strong {
  color: #dc2626;
}

.presence-item.ready {
  border-color: rgba(22, 163, 74, 0.34);
  background: #f0fdf4;
}

.presence-item.ready strong {
  color: #16a34a;
}

.presence-item.inactive {
  opacity: 0.62;
}

.camera-preview {
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #0f172a;
  aspect-ratio: 16 / 9;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
}

.camera-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.camera-preview-placeholder {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(226, 232, 240, 0.92);
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.92)),
    repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.08) 0 1px, transparent 1px 22px);
}

.camera-preview-placeholder strong {
  font-size: 15px;
}

.camera-preview-placeholder p {
  margin: 0;
  color: rgba(203, 213, 225, 0.7);
  font-size: 12px;
}

.camera-lens {
  width: 34px;
  height: 34px;
  border: 2px solid rgba(125, 211, 252, 0.8);
  border-radius: 50%;
  box-shadow: inset 0 0 0 8px rgba(14, 165, 233, 0.22);
}

.camera-metrics-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.camera-metrics-strip div {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #eef2f7;
}

.camera-metrics-strip span,
.camera-metrics-strip strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.camera-metrics-strip span {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}

.camera-metrics-strip strong {
  margin-top: 3px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.area-capture-btn {
  width: 100%;
  min-height: 30px;
  margin-top: 7px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fbff;
  color: #1677ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  padding: 5px 6px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.area-capture-btn span,
.area-capture-btn small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.area-capture-btn span {
  margin: 0;
  color: inherit;
  font-size: 12px;
  line-height: 1.15;
}

.area-capture-btn small {
  margin-top: 1px;
  color: #64748b;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1.1;
}

.area-capture-btn:hover:not(:disabled) {
  background: #dbeafe;
  border-color: #93c5fd;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

.area-capture-btn:disabled {
  cursor: not-allowed;
  border-color: #eef2f7;
  background: #f8fafc;
  color: #94a3b8;
  opacity: 0.82;
}

.area-capture-btn:disabled small {
  color: #94a3b8;
}

@keyframes breathe {
  0%, 100% { opacity: 0.9; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.08); }
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

.detail-modal-header,
.device-info-head,
.section-title-row,
.self-test-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-modal-header {
  gap: 16px;
  padding: 22px 22px 14px;
  flex-shrink: 0;
}

.detail-modal-header h3,
.device-info-head h4,
.firmware-section h4,
.self-test-head h4,
.section-title-row h4 {
  margin: 0;
  color: #0f172a;
  font-weight: 900;
  line-height: 1.25;
}

.detail-modal-header h3 {
  margin: 0;
}

.detail-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: #8a8a8a;
}

.detail-close-btn {
  border: none;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #333;
}

.device-info-head p,
.section-title-row span {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-all;
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

.device-info-section {
  margin-bottom: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.firmware-section,
.self-test-section,
.capture-section,
.roi-section,
.ptz-section {
  margin: 12px 0;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.roi-calibration-layout {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.roi-calibration-canvas {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #0f172a;
  aspect-ratio: 16 / 9;
  touch-action: none;
  user-select: none;
}

.roi-calibration-canvas img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.roi-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(226, 232, 240, 0.92);
}

.roi-placeholder span {
  color: rgba(203, 213, 225, 0.72);
  font-size: 12px;
}

.roi-box {
  position: absolute;
  border: 2px solid #38bdf8;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.14);
  cursor: move;
  touch-action: none;
  padding: 0;
}

.roi-box.active {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.18);
}

.roi-box span {
  position: absolute;
  left: 6px;
  top: 5px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 20px;
  text-align: center;
}

.roi-box i {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: #f59e0b;
  cursor: nwse-resize;
}

.roi-editor-list {
  display: grid;
  gap: 10px;
}

.roi-editor-item {
  padding: 10px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.roi-editor-item.active {
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.08);
}

.roi-global-config .roi-editor-title {
  cursor: default;
}

.roi-editor-title {
  border: none;
  background: transparent;
  padding: 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.roi-editor-item label {
  display: block;
  margin-top: 8px;
}

.roi-editor-item label > span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.roi-editor-item input {
  width: 100%;
  min-height: 38px;
  box-sizing: border-box;
  border: 1px solid #dbe3f0;
  border-radius: 10px;
  padding: 0 10px;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
}

.roi-number-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.roi-global-config .roi-number-grid,
.roi-network-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.roi-preset-group {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #dbe3f0;
}

.roi-preset-title {
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.roi-preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.device-info-head {
  gap: 10px;
  margin-bottom: 10px;
}

.device-info-head h4 {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

.device-info-head p {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.25;
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

.device-info-cell strong,
.device-info-cell input {
  display: block;
  width: 100%;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  word-break: break-all;
}

.device-info-cell input {
  min-width: 0;
  box-sizing: border-box;
  border: none;
  outline: none;
  padding: 0;
  background: transparent;
}

.device-info-cell.editable {
  cursor: text;
}

.device-info-cell input::placeholder {
  color: #94a3b8;
  font-weight: 600;
}

.device-info-cell:focus-within {
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.08);
}

.modal-label {
  display: block;
  margin: 12px 0 7px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.firmware-info-grid,
.self-test-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.self-test-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.firmware-info-item,
.self-test-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #eef2f7;
  font-size: 13px;
}

.firmware-info-item span,
.self-test-row span,
.self-test-summary {
  color: #64748b;
}

.firmware-info-item strong,
.self-test-row strong,
.self-test-summary strong {
  color: #0f172a;
  text-align: right;
  word-break: break-word;
}

.capture-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.capture-info-item {
  padding: 9px 10px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #eef2f7;
}

.capture-info-item span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.capture-info-item strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  word-break: break-all;
}

.capture-preview {
  overflow: hidden;
  margin-top: 10px;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #0f172a;
}

.capture-preview img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.capture-retry-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.self-test-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  font-size: 13px;
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

.self-test-status-line,
.camera-message,
.ota-result {
  margin: 10px 0 0;
  padding: 9px 10px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 13px;
  line-height: 1.5;
}

.camera-message.error,
.ota-error-msg {
  background: #fff1f0;
  color: #b91c1c;
}

.ota-feedback-slot {
  margin-top: 10px;
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
  font-weight: 800;
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

.ptz-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.ptz-grid button,
.btn-secondary,
.btn-primary,
.btn-danger {
  min-height: 36px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}

.ptz-grid button {
  color: #075985;
  background: #e0f2fe;
}

.ptz-grid button:disabled,
.btn-secondary:disabled,
.btn-primary:disabled,
.btn-danger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.step-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 42px;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.step-row input {
  width: 100%;
}

.step-row strong {
  color: #0f172a;
  text-align: right;
}

.detail-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.btn-secondary {
  padding: 8px 12px;
  color: #2563eb;
  background: #eef4ff;
}

.btn-primary {
  padding: 8px 12px;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.btn-danger {
  padding: 8px 12px;
  color: #f53f3f;
  background: #fff1f0;
}

.detail-overlay-fade-enter-active,
.detail-overlay-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.detail-overlay-fade-enter-from,
.detail-overlay-fade-leave-to {
  opacity: 0;
}

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

.detail-card-pop-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
  filter: blur(8px);
}

@keyframes onlineCardFlash {
  0% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-2px);
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
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(100%);
  }
}

:global(.app-container.night-mode) .camera-card {
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: rgba(226, 232, 240, 0.88);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}

:global(.app-container.night-mode) .device-title-block h3 {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .last-seen-under-name {
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

:global(.app-container.night-mode) .self-test-badge.ok {
  background: rgba(6, 95, 70, 0.28);
  border: 1px solid rgba(52, 211, 153, 0.22);
  color: #a7f3d0;
}

:global(.app-container.night-mode) .self-test-badge.bad {
  background: rgba(127, 29, 29, 0.28);
  border: 1px solid rgba(248, 113, 113, 0.22);
  color: #fecaca;
}

:global(.app-container.night-mode) .self-test-badge.unknown {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(203, 213, 225, 0.84);
}

:global(.app-container.night-mode) .camera-preview {
  border-color: rgba(148, 163, 184, 0.22);
}

:global(.app-container.night-mode) .camera-metrics-strip div {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(148, 163, 184, 0.18);
}

:global(.app-container.night-mode) .camera-metrics-strip span {
  color: rgba(148, 163, 184, 0.8);
}

:global(.app-container.night-mode) .camera-metrics-strip strong {
  color: rgba(226, 232, 240, 0.94);
}

:global(.app-container.night-mode) .area-capture-btn {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .area-capture-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.26);
  border-color: rgba(96, 165, 250, 0.45);
  color: #bfdbfe;
}

:global(.app-container.night-mode) .area-capture-btn:disabled {
  background: rgba(15, 23, 42, 0.56);
  border-color: rgba(148, 163, 184, 0.16);
  color: rgba(148, 163, 184, 0.78);
}

@media (max-width: 520px) {
  .device-overview-grid,
  .capture-info-grid,
  .self-test-grid,
  .roi-number-grid,
  .roi-preset-grid,
  .ptz-grid {
    grid-template-columns: 1fr;
  }
}
</style>
