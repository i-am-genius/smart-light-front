<template>
  <div class="settings-card flow-monitor-panel">
    <div class="flow-header">
      <div>
        <h3 class="settings-title">人流监测结果</h3>

      </div>
    </div>

    <div class="detect-upload-card">
      <div class="detect-upload-header">
        <span class="detect-upload-title">上传图片检测</span>
        <span class="detect-upload-hint">支持 JPG、JPEG、PNG 格式</span>
      </div>

      <div class="detect-upload-body">
        <div class="detect-preview-col">
          <div v-if="!selectedImage" class="detect-placeholder" @click="triggerFileInput">
            <span class="detect-placeholder-icon">+</span>
            <span>点击选择图片</span>
          </div>
          <div v-else class="detect-image-preview">
            <img :src="selectedImageUrl" alt="上传原图" />
            <button class="detect-reselect-btn" @click="clearImage">重新选择</button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            style="display: none"
            @change="handleFileSelect"
          />
        </div>

        <div class="detect-action-col">
          <button
            class="detect-btn"
            :disabled="!selectedImage || detecting"
            @click="startDetect"
          >
            <span v-if="detecting" class="detect-btn-loading"></span>
            {{ detecting ? '检测中...' : '开始检测' }}
          </button>

          <div v-if="detectError" class="detect-error">{{ detectError }}</div>

          <div v-if="detectResult" class="detect-result-grid">
            <div class="detect-result-item">
              <span class="detect-result-label">检测人数</span>
              <strong class="detect-result-value">{{ detectResult.count }}</strong>
            </div>
            <div class="detect-result-item">
              <span class="detect-result-label">置信度</span>
              <strong class="detect-result-value">{{ (detectResult.confidence * 100).toFixed(1) }}%</strong>
            </div>
            <div class="detect-result-item">
              <span class="detect-result-label">处理时间</span>
              <strong class="detect-result-value">{{ detectResult.processing_time }} ms</strong>
            </div>
            <div class="detect-result-item">
              <span class="detect-result-label">检测时间</span>
              <strong class="detect-result-value">{{ detectResult.timestamp }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div v-if="detectResult?.annotated_image_base64" class="detect-annotated-section">
        <h4 class="detect-annotated-title">YOLO 标注图</h4>
        <div class="detect-annotated-preview" @click="openLightbox">
          <img
            class="detect-annotated-img"
            :src="annotatedImageSrc"
            alt="YOLO 人流检测标注图"
          />
          <span class="detect-annotated-hint">点击查看大图</span>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-if="lightboxOpen"
          class="detect-lightbox-overlay"
          @click.self="closeLightbox"
        >
          <div class="detect-lightbox-container">
            <button class="detect-lightbox-close" @click="closeLightbox">&times;</button>
            <img
              class="detect-lightbox-img"
              :src="annotatedImageSrc"
              alt="YOLO 人流检测标注图"
            />
          </div>
        </div>
      </Teleport>
    </div>

    <div v-if="cameraDevices.length" class="flow-list">
      <div
        v-for="device in cameraDevices"
        :key="device.id"
        class="flow-card"
      >
        <div class="flow-card-top">
          <div>
            <div class="flow-device-name">
              {{ device.displayName || device.deviceNo || device.chipId }}
            </div>
            <div class="flow-device-sub">
              {{ device.chipId }} · {{ device.online ? '在线' : '离线' }}
            </div>
          </div>

          <span
            class="flow-status"
            :class="{ active: getHasPerson(device) }"
          >
            {{ getHasPerson(device) ? '检测到人员' : '暂无人员' }}
          </span>
        </div>

        <div class="flow-data-grid">
          <div class="flow-data-item">
            <span>检测人数</span>
            <strong>{{ getPersonCount(device) }}</strong>
          </div>

          <div class="flow-data-item">
            <span>最近检测</span>
            <strong>{{ getDetectTime(device) }}</strong>
          </div>

          <div class="flow-data-item">
            <span>置信度</span>
            <strong>{{ getConfidenceText(device) }}</strong>
          </div>
        </div>

        <div v-if="isCamDevice(device)" class="flow-presence-list">
          <div
            v-for="area in getPresenceRows(device)"
            :key="area.targetIndex"
            class="flow-presence-item"
            :class="{ active: area.present, ready: area.trackingReady, muted: area.inactive }"
          >
            <span>{{ area.label }}</span>
            <strong>{{ area.statusText }}</strong>
          </div>
        </div>

        <p v-if="isCamDevice(device) && !isRoiConfigured(device)" class="flow-roi-warning">
          ROI 未配置，请先完成区域标定
        </p>

        <div class="flow-chart-box">
          人流图形显示区域
        </div>
      </div>
    </div>

    <div v-else class="empty-flow">
      暂无摄像头设备
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeviceItem } from '../../types/device'
import { normalizeDeviceType } from '../../utils/device'
import { detectPeopleByImage } from '../../api/ai'
import type { PersonDetectRespVO } from '../../api/ai'

const props = defineProps<{
  devices: DeviceItem[]
}>()

const cameraDevices = computed(() => {
  const cams = props.devices.filter((device) => {
    return normalizeDeviceType(device.deviceType) === 'cam'
  })
  if (cams.length) return cams

  return props.devices.filter((device) => {
    return normalizeDeviceType(device.deviceType) === 'camlamp'
  })
})

function isCamDevice(device: DeviceItem) {
  return normalizeDeviceType(device.deviceType) === 'cam'
}

function isRoiConfigured(device: DeviceItem) {
  if (!isCamDevice(device)) return true
  if (device.camRoiConfig?.configured != null) return Boolean(device.camRoiConfig.configured)
  const areas = device.camPresence?.areas || []
  if (device.camPresence?.configured != null) return Boolean(device.camPresence.configured)
  return areas.length >= 3 && areas.every(area => Boolean(area.targetChipId))
}

function getPresenceRows(device: DeviceItem) {
  const areas = device.camPresence?.areas || []
  const rois = device.camRoiConfig?.rois || []
  const roiConfigured = isRoiConfigured(device)
  const activeRoi = roiConfigured && isCenterMonitoringDevice(device)
  return [1, 2, 3].map((index) => {
    const area = areas.find(item => Number(item.targetIndex) === index)
    const roi = rois.find(item => Number(item.targetIndex) === index)
    const targetChipId = area?.targetChipId || roi?.targetChipId
    const areaLabel = area?.areaName || roi?.areaName || `区域 ${index}`
    const targetLamp = findTargetLamp(targetChipId)
    const present = activeRoi && Boolean(area?.present)
    const trackingReady = Boolean(present && targetLamp?.online && isLampClothTaken(targetLamp))
    return {
      targetIndex: index,
      label: getPresenceLabel(areaLabel, targetChipId, index),
      present,
      trackingReady,
      inactive: !activeRoi,
      statusText: getPresenceStatusText(present, targetLamp, trackingReady, activeRoi, roiConfigured),
    }
  })
}

function getPresenceLabel(areaLabel: string, targetChipId: string | undefined, fallbackIndex: number) {
  const targetLabel = getTargetLampLabel(targetChipId, fallbackIndex)
  return targetLabel ? `${areaLabel} · ${targetLabel}` : areaLabel
}

function getTargetLampLabel(chipId: string | undefined, fallbackIndex: number) {
  const target = findTargetLamp(chipId)
  if (!target) return chipId || `灯具-${fallbackIndex}`
  return target.displayName || target.deviceNo || target.chipId || `灯具-${fallbackIndex}`
}

function findTargetLamp(chipId: string | undefined) {
  if (!chipId) return undefined
  const normalizedChipId = normalizeChipId(chipId)
  return props.devices.find((item) => {
    const type = normalizeDeviceType(item.deviceType)
    return (type === 'lamp' || type === 'camlamp') && normalizeChipId(item.chipId) === normalizedChipId
  })
}

function isLampClothTaken(target?: DeviceItem) {
  const status = String(target?.lampClothState?.clothStatus || '').trim().toLowerCase()
  return ['taken', 'removed', 'off_rack', 'offrack'].includes(status)
}

function isCenterMonitoringDevice(device: DeviceItem) {
  if (!device.online) return false
  const trackingStatus = normalizeCamWorkStatus(device.trackingStatus?.status)
  if (['tracking', 'lost', 'timeout', 'error'].includes(trackingStatus)) return false
  const status = normalizeCamWorkStatus(device.camWorkStatus || device.camPresence?.workStatus || 'monitoring')
  return status === 'monitoring' || status === 'presence'
}

function normalizeCamWorkStatus(status?: string) {
  const value = String(status || '').trim().toLowerCase()
  if (['centered', 'center_done', 'centered_monitoring', 'returned_center', 'returned_to_center', 'home', 'homed', 'idle'].includes(value)) {
    return 'monitoring'
  }
  if (['returning', 'returningcenter', 'returning_center', 'return_to_center', 'homing', 'stopping', 'stopped'].includes(value)) {
    return 'returning_center'
  }
  return value || 'monitoring'
}

function getPresenceStatusText(
  present: boolean,
  target: DeviceItem | undefined,
  trackingReady: boolean,
  activeRoi = true,
  roiConfigured = true,
) {
  if (!activeRoi) return roiConfigured ? '暂停' : '未配置'
  if (!present) return '无人'
  if (!target) return '目标缺失'
  if (!target.online) return '灯具离线'
  if (trackingReady) return '可追踪'
  return '未取下'
}

function normalizeChipId(value?: string) {
  return String(value || '').trim().toUpperCase()
}

const fileInput = ref<HTMLInputElement | null>(null)
const selectedImage = ref<File | null>(null)
const selectedImageUrl = ref<string>('')
const detecting = ref(false)
const detectResult = ref<PersonDetectRespVO | null>(null)
const detectError = ref<string>('')
const lightboxOpen = ref(false)

const annotatedImageSrc = computed(() => {
  if (!detectResult.value?.annotated_image_base64) return ''
  const b64 = detectResult.value.annotated_image_base64
  if (b64.startsWith('data:')) return b64
  return `data:image/jpeg;base64,${b64}`
})

function openLightbox() {
  lightboxOpen.value = true
}

function closeLightbox() {
  lightboxOpen.value = false
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png']
  if (!allowedTypes.includes(file.type)) {
    detectError.value = '仅支持 JPG、JPEG、PNG 格式图片'
    return
  }

  detectError.value = ''
  detectResult.value = null
  selectedImage.value = file

  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value)
  }
  selectedImageUrl.value = URL.createObjectURL(file)
}

function clearImage() {
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value)
  }
  selectedImage.value = null
  selectedImageUrl.value = ''
  detectResult.value = null
  detectError.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function startDetect() {
  if (!selectedImage.value || detecting.value) return

  detectError.value = ''
  detectResult.value = null
  detecting.value = true

  try {
    const result = await detectPeopleByImage(selectedImage.value)
    detectResult.value = result
  } catch (error: any) {
    const msg = error?.message || error?.toString() || '检测失败'
    if (msg.includes('Network Error') || msg.includes('timeout') || msg.includes('超时')) {
      detectError.value = '人流检测服务不可用，请稍后重试'
    } else {
      detectError.value = msg
    }
  } finally {
    detecting.value = false
  }
}

function getPersonCount(device: DeviceItem) {
  const count =
    (device as any).personCount ??
    (device as any).peopleCount ??
    (device as any).flowPersonCount

  if (count === undefined || count === null) return '暂无'
  return `${count} 人`
}

function getConfidenceText(device: DeviceItem) {
  const value =
    device.camPresence?.confidence ??
    (device as any).personConfidence ??
    (device as any).confidence ??
    (device as any).flowConfidence

  if (value === undefined || value === null || value === '') return '暂无'

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return `${Math.round(Math.max(0, Math.min(1, numeric)) * 100)}%`
}

function getHasPerson(device: DeviceItem) {
  const count =
    (device as any).personCount ??
    (device as any).peopleCount ??
    (device as any).flowPersonCount

  if (count !== undefined && count !== null) {
    return Number(count) > 0
  }

  const hasPerson =
    (device as any).hasPerson ??
    (device as any).personDetected

  return Boolean(hasPerson)
}

function getDetectTime(device: DeviceItem) {
  const value =
    (device as any).flowDetectTime ||
    (device as any).personDetectTime ||
    (device as any).detectTime ||
    ''

  if (!value) return '暂无'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')

  return `${y}-${m}-${d} ${hh}:${mm}`
}
</script>

<style scoped>
.flow-monitor-panel {
  width: 100%;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.detect-upload-card {
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  padding: 16px;
  background: #f7f8fa;
  margin-bottom: 16px;
}

.detect-upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.detect-upload-title {
  font-size: 14px;
  font-weight: 700;
  color: #1d2129;
}

.detect-upload-hint {
  font-size: 12px;
  color: #86909c;
}

.detect-upload-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.detect-preview-col {
  flex-shrink: 0;
  width: 200px;
}

.detect-placeholder {
  width: 200px;
  height: 150px;
  border: 2px dashed #c9cdd4;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #fff;
  cursor: pointer;
  color: #86909c;
  font-size: 13px;
  transition: border-color 0.2s, color 0.2s;
}

.detect-placeholder:hover {
  border-color: #1677ff;
  color: #1677ff;
}

.detect-placeholder-icon {
  font-size: 32px;
  line-height: 1;
  font-weight: 300;
}

.detect-image-preview {
  position: relative;
}

.detect-image-preview img {
  width: 200px;
  height: 150px;
  object-fit: cover;
  border-radius: 12px;
  display: block;
}

.detect-reselect-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  padding: 4px 10px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.detect-action-col {
  flex: 1;
  min-width: 0;
}

.detect-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 22px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #1677ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.detect-btn:hover:not(:disabled) {
  background: #4096ff;
}

.detect-btn:disabled {
  background: #a0c4ff;
  cursor: not-allowed;
}

.detect-btn-loading {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: detect-spin 0.6s linear infinite;
}

@keyframes detect-spin {
  to { transform: rotate(360deg); }
}

.detect-error {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #f53f3f;
  font-size: 13px;
}

.detect-result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}

.detect-result-item {
  background: #fff;
  border-radius: 10px;
  padding: 10px;
}

.detect-result-label {
  display: block;
  margin-bottom: 4px;
  color: #86909c;
  font-size: 12px;
}

.detect-result-value {
  color: #1d2129;
  font-size: 15px;
  word-break: break-all;
}

.detect-annotated-section {
  margin-top: 16px;
}

.detect-annotated-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  margin-bottom: 10px;
}

.detect-annotated-preview {
  position: relative;
  max-height: 280px;
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e5e6eb;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.detect-annotated-preview:hover {
  border-color: #1677ff;
}

.detect-annotated-img {
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  display: block;
}

.detect-annotated-hint {
  position: absolute;
  bottom: 8px;
  right: 10px;
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  border-radius: 6px;
  pointer-events: none;
  transition: background 0.2s;
}

.detect-annotated-preview:hover .detect-annotated-hint {
  background: rgba(0, 0, 0, 0.65);
}

.detect-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.detect-lightbox-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detect-lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
}

.detect-lightbox-close {
  position: absolute;
  top: -36px;
  right: -36px;
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.detect-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.flow-subtitle {
  margin: -8px 0 16px;
  color: #86909c;
  font-size: 13px;
}

.flow-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.flow-card {
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  padding: 14px;
  background: #f7f8fa;
}

.flow-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.flow-device-name {
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
}

.flow-device-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}

.flow-status {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #eef4ff;
  color: #1677ff;
}

.flow-status.active {
  background: #fff1f0;
  color: #f53f3f;
}

.flow-data-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.flow-data-item {
  background: #fff;
  border-radius: 12px;
  padding: 10px;
}

.flow-data-item span {
  display: block;
  margin-bottom: 4px;
  color: #86909c;
  font-size: 12px;
}

.flow-data-item strong {
  color: #1d2129;
  font-size: 15px;
}

.flow-presence-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.flow-presence-item {
  min-width: 0;
  padding: 8px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e5e6eb;
}

.flow-presence-item span,
.flow-presence-item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-presence-item span {
  color: #86909c;
  font-size: 11px;
}

.flow-presence-item strong {
  margin-top: 2px;
  color: #86909c;
  font-size: 13px;
  font-weight: 800;
}

.flow-presence-item.active {
  border-color: rgba(245, 63, 63, 0.28);
  background: #fff7f7;
}

.flow-presence-item.active strong {
  color: #f53f3f;
}

.flow-presence-item.ready {
  border-color: rgba(22, 163, 74, 0.34);
  background: #f0fdf4;
}

.flow-presence-item.ready strong {
  color: #16a34a;
}

.flow-presence-item.muted {
  opacity: 0.58;
}

.flow-roi-warning {
  margin: 10px 0 0;
  color: #d97706;
  font-size: 12px;
  line-height: 1.4;
}

.flow-chart-box {
  height: 160px;
  margin-top: 12px;
  border-radius: 12px;
  border: 1px dashed #c9cdd4;
  background: #fff;
  color: #86909c;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.empty-flow {
  padding: 30px;
  border-radius: 14px;
  background: #f7f8fa;
  color: #86909c;
  text-align: center;
}

@media (max-width: 768px) {
  .flow-monitor-panel {
    padding: 12px;
  }

  .settings-title {
    margin-bottom: 10px;
    font-size: 16px;
  }

  .detect-upload-card {
    margin-bottom: 10px;
    padding: 10px 12px;
    border-radius: 12px;
  }

  .detect-upload-header {
    margin-bottom: 8px;
  }

  .detect-upload-body {
    flex-direction: column;
    gap: 8px;
  }

  .detect-preview-col {
    width: 100%;
  }

  .detect-placeholder {
    width: 100%;
    height: 120px;
    gap: 4px;
  }

  .detect-placeholder-icon {
    font-size: 26px;
  }

  .detect-image-preview img {
    width: 100%;
    height: auto;
    max-height: 160px;
  }

  .detect-result-grid {
    grid-template-columns: 1fr 1fr;
  }

  .detect-annotated-preview {
    max-height: 160px;
  }

  .detect-annotated-img {
    max-height: 160px;
  }

  .detect-lightbox-overlay {
    padding: 20px;
  }

  .detect-lightbox-close {
    top: -32px;
    right: 0;
  }

  .flow-list {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .flow-card {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .flow-card-top {
    margin-bottom: 8px;
    gap: 8px;
  }

  .flow-device-name {
    font-size: 13px;
  }

  .flow-device-sub {
    margin-top: 2px;
    font-size: 11px;
  }

  .flow-status {
    padding: 3px 8px;
    font-size: 11px;
  }

  .flow-data-grid {
    gap: 6px;
  }

  .flow-data-item {
    padding: 8px;
    border-radius: 10px;
  }

  .flow-data-item span {
    font-size: 11px;
    margin-bottom: 2px;
  }

  .flow-data-item strong {
    font-size: 13px;
  }

  .flow-chart-box {
    height: 120px;
    margin-top: 8px;
    font-size: 12px;
    border-radius: 10px;
  }

  .empty-flow {
    padding: 20px;
  }

}

</style>
