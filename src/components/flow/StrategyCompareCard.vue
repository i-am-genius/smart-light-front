<template>
  <div class="chart-card">
    <div class="card-title">亮度策略对比</div>

    <div v-if="!hasData" class="empty-block">暂无策略对比历史数据</div>
    <canvas v-else ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from 'chart.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
)

const props = defineProps<{
  labels: string[]
  fixedSeries: number[]
  smartSeries: number[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const hasData = computed(() => {
  return props.labels.length > 0 && (props.fixedSeries.length > 0 || props.smartSeries.length > 0)
})

function renderChart() {
  if (!canvasRef.value || !hasData.value) return

  if (chart) chart.destroy()

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: props.labels,
      datasets: [
        {
          label: '恒定策略',
          data: props.fixedSeries,
          tension: 0.35,
        },
        {
          label: '智能策略',
          data: props.smartSeries,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  })
}

onMounted(renderChart)

watch(
  () => [props.labels, props.fixedSeries, props.smartSeries],
  () => {
    if (chart) {
      chart.destroy()
      chart = null
    }
    renderChart()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (chart) chart.destroy()
})
</script>