<template>
  <div class="chart-card">
    <div class="card-title">温度 / 人流趋势</div>

    <div v-if="!hasData" class="empty-block">暂无温度 / 人流历史数据</div>

    <div v-else class="chart-canvas-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
  tempSeries: number[]
  peopleSeries: number[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function isValidValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const chartLabels = computed(() => {
  const length = Math.max(props.labels.length, props.tempSeries.length, props.peopleSeries.length)
  return Array.from({ length }, (_, index) => props.labels[index] || String(index + 1))
})

const normalizedTempSeries = computed(() => {
  return chartLabels.value.map((_, index) => {
    const value = props.tempSeries[index]
    return isValidValue(value) ? value : null
  })
})

const normalizedPeopleSeries = computed(() => {
  return chartLabels.value.map((_, index) => {
    const value = props.peopleSeries[index]
    return isValidValue(value) ? value : null
  })
})

const validTempCount = computed(() => normalizedTempSeries.value.filter(isValidValue).length)
const validPeopleCount = computed(() => normalizedPeopleSeries.value.filter(isValidValue).length)

const hasData = computed(() => {
  return chartLabels.value.length > 0 && (validTempCount.value > 0 || validPeopleCount.value > 0)
})

function destroyChart() {
  if (chart) {
    chart.destroy()
    chart = null
  }
}

function renderChart() {
  if (!canvasRef.value || !hasData.value) return

  destroyChart()

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: chartLabels.value,
      datasets: [
        {
          label: '温度',
          data: normalizedTempSeries.value,
          tension: 0.35,
          borderColor: '#409EFF',
          backgroundColor: '#409EFF',
          pointBackgroundColor: '#409EFF',
          pointBorderColor: '#409EFF',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: true,
          showLine: validTempCount.value > 1,
        },
        {
          label: '平均人数',
          data: normalizedPeopleSeries.value,
          tension: 0.35,
          borderColor: '#67C23A',
          backgroundColor: '#67C23A',
          pointBackgroundColor: '#67C23A',
          pointBorderColor: '#67C23A',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: true,
          showLine: validPeopleCount.value > 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
      },
      scales: {
        x: {
          offset: chartLabels.value.length === 1,
          grid: { display: false },
        },
        y: {
          suggestedMin: 0,
          grid: { display: false },
        },
      },
    },
  })
}

async function renderChartAfterDomUpdate() {
  destroyChart()

  if (!hasData.value) {
    return
  }

  await nextTick()
  renderChart()
}

onMounted(renderChartAfterDomUpdate)

watch(
  () => [props.labels, props.tempSeries, props.peopleSeries],
  renderChartAfterDomUpdate,
  { deep: true },
)

onBeforeUnmount(destroyChart)
</script>
