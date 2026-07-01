<template>
  <div class="chart-card">
    <div class="card-title">每盏灯亮度分布</div>

    <div v-if="lampDevices.length === 0" class="empty-block">暂无灯具亮度数据</div>

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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DeviceItem } from '../../types/device'
import { isLampDevice } from '../../utils/device'

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
const lampDevices = computed(() => props.devices.filter(isLampDevice))

function renderChart() {
  if (chart) {
    chart.destroy()
    chart = null
  }

  if (!canvasRef.value || lampDevices.value.length === 0) return

  chart = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels: lampDevices.value.map(item => item.displayName || item.chipId || '灯具'),
      datasets: [
        {
          label: '亮度',
          data: lampDevices.value.map(item => item.brightness ?? 0),
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
      scales: {
        x: { grid: { display: false } },
        y: { grid: { display: false } },
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
