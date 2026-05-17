<template>
  <div class="chart-card">
    <div class="card-title">每盏灯亮度分布</div>

    <div v-if="devices.length === 0" class="empty-block">暂无设备数据</div>

    <div v-else class="chart-canvas-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from 'chart.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DeviceItem } from '../../types/device'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
)

const props = defineProps<{
  devices: DeviceItem[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function renderChart() {
  if (!canvasRef.value || props.devices.length === 0) return

  if (chart) {
    chart.destroy()
  }

  chart = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels: props.devices.map(item => item.chipId),
      datasets: [
        {
          label: '亮度',
          data: props.devices.map(item => item.brightness ?? 0),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
      },
    },
  })
}

onMounted(renderChart)

watch(
  () => props.devices,
  () => {
    renderChart()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (chart) chart.destroy()
})
</script>