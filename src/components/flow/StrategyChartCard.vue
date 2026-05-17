<template>
  <div class="chart-card">
    <div class="card-title">亮度策略实时对比图</div>
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip)

const props = defineProps<{
  labels: string[]
  fixedSeries: number[]
  smartSeries: number[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function renderChart() {
  if (!canvasRef.value) return

  if (chart) {
    chart.destroy()
  }

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
    renderChart()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (chart) chart.destroy()
})
</script>