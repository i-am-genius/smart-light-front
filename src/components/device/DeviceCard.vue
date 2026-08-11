<template>
  <CameraDeviceCard
    v-if="isCamera"
    :device="device"
    :deleting="deleting"
    :target-devices="targetLampDevices"
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
        <p>{{ device.deviceType || 'unknown' }}</p>
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

    <div class="unknown-device-actions">
      <button class="btn-danger" :disabled="deleting" @click="$emit('delete', device.id)">
        {{ deleting ? '删除中...' : '删除' }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CameraDeviceCard from './CameraDeviceCard.vue'
import LampDeviceCard from './LampDeviceCard.vue'
import type { DeviceItem } from '../../types/device'
import { isCameraDevice, isLampDevice } from '../../utils/device'
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
const targetLampDevices = computed(() => (props.allDevices || []).filter(isLampDevice))
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

const firmwareVersionText = computed(() => {
  const version = props.device.firmwareVersion || 'unknown'
  const code = props.device.firmwareVersionCode
  return code == null ? version : `${version} (${code})`
})
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
}
</style>
