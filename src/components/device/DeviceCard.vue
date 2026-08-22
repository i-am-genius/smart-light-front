<template>
  <CameraDeviceCard
    v-if="isCamera"
    :device="device"
    :deleting="deleting"
    :target-devices="targetLampDevices"
    :capture-controller-devices="captureControllerDevices"
    :cam-index="camIndex"
    @update-realtime="$emit('update-realtime', $event)"
    @delete="$emit('delete', $event)"
  />

  <LampDeviceCard
    v-else-if="isLampLike"
    :device="device"
    :deleting="deleting"
    :all-devices="allDevices"
    :zones="zones"
    @update-realtime="$emit('update-realtime', $event)"
    @delete="$emit('delete', $event)"
  />

  <article v-else class="unknown-device-card" :class="{ offline: !device.online }">
    <header class="unknown-device-header">
      <div>
        <h3>{{ displayName }}</h3>
        <p>{{ deviceTypeText }}</p>
      </div>
      <span class="status-badge" :class="{ online: device.online, offline: !device.online }">
        {{ device.online ? '在线' : '离线' }}
      </span>
    </header>

    <dl class="unknown-device-grid">
      <div>
        <dt>Chip ID</dt>
        <dd>{{ device.chipId || '-' }}</dd>
      </div>
      <div>
        <dt>IP</dt>
        <dd>{{ device.ip || '-' }}</dd>
      </div>
      <div>
        <dt>固件版本</dt>
        <dd>{{ firmwareVersionText }}</dd>
      </div>
      <div>
        <dt>OTA 状态</dt>
        <dd>{{ device.otaStatus || 'idle' }}</dd>
      </div>
    </dl>

    <section v-if="isCaptureController" class="capture-ota-panel">
      <div class="capture-ota-heading">
        <strong>固件升级</strong>
        <span :class="`is-${otaStatusValue}`">{{ otaStatusText }}</span>
      </div>

      <label class="capture-ota-channel">
        <span>固件通道</span>
        <BaseSelect
          v-model="firmwareChannel"
          :options="firmwareChannelOptions"
          :disabled="otaChecking || otaStarting || otaStatusValue === 'updating'"
        />
      </label>

      <div v-if="otaStatusValue === 'updating'" class="capture-ota-progress">
        <div class="capture-ota-progress-head">
          <span>正在更新</span>
          <strong>{{ otaProgress }}%</strong>
        </div>
        <div class="capture-ota-progress-track" aria-hidden="true">
          <div class="capture-ota-progress-fill" :style="{ width: `${otaProgress}%` }"></div>
        </div>
      </div>

      <p v-if="otaMessage" class="capture-ota-message" :class="{ error: otaMessageIsError }">
        {{ otaMessage }}
      </p>
      <div v-else-if="otaCheckResult" class="capture-ota-result">
        <strong>{{ otaUpdateText }}</strong>
        <small v-if="otaCheckResult.changelog">{{ otaCheckResult.changelog }}</small>
      </div>

      <div class="capture-ota-actions">
        <button
          type="button"
          class="btn-secondary"
          :disabled="otaChecking || otaStarting || otaStatusValue === 'updating'"
          @click="handleCheckFirmwareUpdate"
        >
          {{ otaChecking ? '检查中...' : '检查更新' }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="!canStartOta"
          @click="handleStartOtaUpdate"
        >
          {{ otaStarting ? '下发中...' : '确认更新' }}
        </button>
      </div>
    </section>

    <div class="unknown-device-actions">
      <button class="btn-danger" :disabled="deleting" @click="$emit('delete', device.id)">
        {{ deleting ? '删除中...' : '删除' }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseSelect from '../common/BaseSelect.vue'
import CameraDeviceCard from './CameraDeviceCard.vue'
import LampDeviceCard from './LampDeviceCard.vue'
import { checkFirmwareUpdate, startOtaUpdate } from '../../api/device'
import type { DeviceItem, FirmwareChannel, OtaCheckResult } from '../../types/device'
import { isCameraDevice, isCaptureControllerDevice, isLampDevice } from '../../utils/device'
import { getErrorMessage } from '../../utils/error'
import type { LampRealtimeUpdateEnvelope } from '../../utils/garmentRecognition'
import type { ZoneDefinition } from '../../utils/deviceZones'

const props = defineProps<{
  device: DeviceItem
  deleting?: boolean
  allDevices?: DeviceItem[]
  zones: ZoneDefinition[]
}>()

defineEmits<{
  (e: 'update-realtime', value: LampRealtimeUpdateEnvelope): void
  (e: 'delete', id: number): void
}>()

const isCamera = computed(() => isCameraDevice(props.device))
const isLampLike = computed(() => isLampDevice(props.device))
const isCaptureController = computed(() => isCaptureControllerDevice(props.device))
const targetLampDevices = computed(() => (props.allDevices || []).filter(isLampDevice))
const captureControllerDevices = computed(() => (props.allDevices || []).filter(isCaptureControllerDevice))
const camIndex = computed(() => {
  const cameras = (props.allDevices || []).filter(isCameraDevice)
  const index = cameras.findIndex((item) => {
    if (props.device.id != null && item.id === props.device.id) return true
    return Boolean(props.device.chipId && item.chipId === props.device.chipId)
  })
  return index >= 0 ? index + 1 : 1
})

const displayName = computed(() => {
  return props.device.displayName?.trim() || props.device.chipId || '未知设备'
})

const deviceTypeText = computed(() => {
  if (isCaptureControllerDevice(props.device)) return '拍照控制器 · cam_capture'
  return props.device.deviceType || 'unknown'
})

const firmwareVersionText = computed(() => {
  const version = props.device.firmwareVersion || 'unknown'
  const code = props.device.firmwareVersionCode
  return code == null ? version : `${version} (${code})`
})

const firmwareChannelOptions = [
  { label: '正式版', value: 'stable' },
  { label: '测试版', value: 'test' },
]
const firmwareChannel = ref<FirmwareChannel>(
  props.device.firmwareChannel === 'test' ? 'test' : 'stable',
)
const otaChecking = ref(false)
const otaStarting = ref(false)
const otaCheckResult = ref<OtaCheckResult | null>(null)
const otaMessage = ref('')
const otaMessageIsError = ref(false)

const otaStatusValue = computed(() => props.device.otaStatus || 'idle')
const otaProgress = computed(() => {
  const value = Number(props.device.otaProgress)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
})
const otaStatusText = computed(() => {
  const labels: Record<string, string> = {
    idle: '空闲',
    updating: '更新中',
    success: '更新成功',
    failed: '更新失败',
  }
  return labels[otaStatusValue.value] || otaStatusValue.value
})
const otaUpdateText = computed(() => {
  const result = otaCheckResult.value
  if (!result?.latestVersion) return '当前通道暂无可用固件'
  if (!result.hasUpdate) return '当前已是该通道最新版本'
  return `发现新版本 ${result.latestVersion}`
})
const canStartOta = computed(() => Boolean(
  props.device.online &&
  otaCheckResult.value?.hasUpdate &&
  otaCheckResult.value.firmwareId &&
  !otaChecking.value &&
  !otaStarting.value &&
  otaStatusValue.value !== 'updating',
))

watch(
  () => props.device.firmwareChannel,
  (channel) => {
    firmwareChannel.value = channel === 'test' ? 'test' : 'stable'
  },
)

watch(firmwareChannel, () => {
  otaCheckResult.value = null
  otaMessage.value = ''
})

async function handleCheckFirmwareUpdate() {
  if (!props.device.chipId) return
  otaChecking.value = true
  otaMessage.value = ''
  otaMessageIsError.value = false
  otaCheckResult.value = null
  try {
    otaCheckResult.value = await checkFirmwareUpdate(
      props.device.chipId,
      firmwareChannel.value,
    )
  } catch (error) {
    otaMessageIsError.value = true
    otaMessage.value = getErrorMessage(error, '检查更新失败')
  } finally {
    otaChecking.value = false
  }
}

async function handleStartOtaUpdate() {
  const firmwareId = otaCheckResult.value?.firmwareId
  if (!props.device.chipId || !firmwareId || !props.device.online) return
  const version = otaCheckResult.value?.latestVersion || '所选版本'
  if (!window.confirm(`确认将拍照控制器更新到 ${version} 吗？`)) return

  otaStarting.value = true
  otaMessage.value = ''
  otaMessageIsError.value = false
  try {
    await startOtaUpdate(props.device.chipId, firmwareId, firmwareChannel.value)
    otaCheckResult.value = null
    otaMessage.value = '更新指令已下发，请保持设备供电和网络连接'
  } catch (error) {
    otaMessageIsError.value = true
    otaMessage.value = getErrorMessage(error, 'OTA 更新指令下发失败')
  } finally {
    otaStarting.value = false
  }
}
</script>

<style scoped>
.unknown-device-card {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 20px;
  border: 1px solid rgba(226, 232, 240, 0.86);
  border-radius: var(--border-radius);
  background: var(--card-bg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.unknown-device-card.offline {
  opacity: 0.82;
}

.unknown-device-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.unknown-device-header h3 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
}

.unknown-device-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.status-badge {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 800;
}

.status-badge.online {
  color: #16a34a;
  background: #ecfdf3;
}

.status-badge.offline {
  color: #dc2626;
  background: #fff1f2;
}

.unknown-device-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 16px 0 0;
}

.unknown-device-grid div {
  min-width: 0;
}

.unknown-device-grid dt {
  color: #64748b;
  font-size: 12px;
}

.unknown-device-grid dd {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  word-break: break-all;
}

.capture-ota-panel {
  display: grid;
  gap: 12px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.76);
}

.capture-ota-heading,
.capture-ota-progress-head,
.capture-ota-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.capture-ota-heading > strong {
  color: #0f172a;
  font-size: 14px;
}

.capture-ota-heading > span {
  border-radius: 999px;
  padding: 3px 8px;
  color: #64748b;
  background: #e2e8f0;
  font-size: 11px;
  font-weight: 800;
}

.capture-ota-heading > span.is-updating {
  color: #1d4ed8;
  background: #dbeafe;
}

.capture-ota-heading > span.is-success {
  color: #15803d;
  background: #dcfce7;
}

.capture-ota-heading > span.is-failed {
  color: #b91c1c;
  background: #fee2e2;
}

.capture-ota-channel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.capture-ota-progress,
.capture-ota-result {
  display: grid;
  gap: 7px;
}

.capture-ota-progress-head {
  color: #475569;
  font-size: 12px;
}

.capture-ota-progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #dbeafe;
}

.capture-ota-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
  transition: width 0.3s ease;
}

.capture-ota-message,
.capture-ota-result {
  margin: 0;
  color: #166534;
  font-size: 12px;
  line-height: 1.5;
}

.capture-ota-message.error {
  color: #b91c1c;
}

.capture-ota-result strong,
.capture-ota-result small {
  display: block;
}

.capture-ota-result small {
  color: #64748b;
}

.capture-ota-actions {
  justify-content: flex-end;
}

.capture-ota-actions button {
  min-height: 36px;
}

.unknown-device-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 16px;
}

@media (max-width: 520px) {
  .unknown-device-card {
    height: auto;
  }

  .unknown-device-actions {
    margin-top: 16px;
    padding-top: 0;
  }

  .unknown-device-grid {
    grid-template-columns: 1fr;
  }

  .capture-ota-channel {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .capture-ota-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
