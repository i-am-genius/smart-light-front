<template>
  <div class="device-grid">
    <div class="section-header">
      <h2>已绑定设备</h2>
      <button class="refresh-btn" @click="$emit('refresh')">刷新</button>
    </div>

    <div v-if="loading" class="empty-block">设备加载中...</div>
    <div v-else-if="devices.length === 0" class="empty-block">暂无设备</div>

    <TransitionGroup v-else name="card-list" tag="div" id="deviceContainer">
      <DeviceCard
        v-for="device in sortedDevices"
        :key="device.chipId || (device as any).deviceId || device.id"
        :device="device"
        :all-devices="sortedDevices"
        :zones="zones"
        :deleting="deletingId === device.id"
        @update-realtime="$emit('update-realtime', $event)"
        @delete="$emit('delete', $event)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DeviceCard from './DeviceCard.vue'
import type { DeviceItem } from '../../types/device'
import type { LampRealtimeUpdateEnvelope } from '../../utils/garmentRecognition'
import { sortBoundDevices, type ZoneDefinition } from '../../utils/deviceZones'

const props = defineProps<{
  devices: DeviceItem[]
  zones: ZoneDefinition[]
  loading: boolean
  deletingId?: number | null
}>()

const sortedDevices = computed(() => sortBoundDevices(props.devices, props.zones))

defineEmits<{
  (e: 'refresh'): void
  (e: 'update-realtime', value: LampRealtimeUpdateEnvelope): void
  (e: 'delete', id: number): void
}>()
</script>

<style>
.card-list-enter-active {
  transition:
    opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.card-list-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.98);
  filter: blur(6px);
}

.card-list-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.card-list-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.card-list-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

.card-list-move {
  transition: transform 0.3s ease;
}
</style>
