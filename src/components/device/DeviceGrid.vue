<template>
  <div>
    <div class="section-header">
      <h2>已绑定设备</h2>
      <button class="refresh-btn" @click="$emit('refresh')">刷新</button>
    </div>

    <div v-if="loading" class="empty-block">设备加载中...</div>
    <div v-else-if="devices.length === 0" class="empty-block">暂无设备</div>

    <TransitionGroup v-else name="card-list" tag="div" id="deviceContainer">
      <DeviceCard
        v-for="device in devices"
        :key="device.id"
        :device="device"
        :all-devices="devices"
        :deleting="deletingId === device.id"
        @update-realtime="$emit('update-realtime', $event)"
        @delete="$emit('delete', $event)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import DeviceCard from './DeviceCard.vue'
import type { DeviceCreatePayload, DeviceItem } from '../../types/device'

defineProps<{
  devices: DeviceItem[]
  loading: boolean
  deletingId?: number | null
}>()

defineEmits<{
  (e: 'refresh'): void
  (e: 'update-realtime', value: { id: number; payload: DeviceCreatePayload; lightControl?: boolean }): void
  (e: 'delete', id: number): void
}>()
</script>

<style>
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
