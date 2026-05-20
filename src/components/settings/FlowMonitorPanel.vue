<template>
  <div class="settings-card flow-monitor-panel">
    <div class="flow-header">
      <div>
        <h3 class="settings-title">人流监测结果</h3>

      </div>
    </div>

    <div v-if="camLampDevices.length" class="flow-list">
      <div
        v-for="device in camLampDevices"
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
        </div>

        <div class="flow-chart-box">
          人流图形显示区域
        </div>
      </div>
    </div>

    <div v-else class="empty-flow">
      暂无摄像头灯设备
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceItem } from '../../types/device'
import { normalizeDeviceType } from '../../utils/device'

const props = defineProps<{
  devices: DeviceItem[]
}>()

const camLampDevices = computed(() => {
  return props.devices.filter((device) => {
    return normalizeDeviceType(device.deviceType) === 'camlamp'
  })
})

function getPersonCount(device: DeviceItem) {
  const count =
    (device as any).personCount ??
    (device as any).peopleCount ??
    (device as any).flowPersonCount

  if (count === undefined || count === null) return '暂无'
  return `${count} 人`
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
  .settings-title {
    font-size: 16px;
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