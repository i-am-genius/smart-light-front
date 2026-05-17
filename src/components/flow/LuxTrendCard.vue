<template>
  <div class="chart-card">
    <div class="card-title">光照历史曲线</div>

    <div v-if="!hasData" class="empty-block">暂无光照历史数据</div>

    <template v-else>
      <div v-if="isSparseData" class="trend-hint">历史数据较少，暂无法形成曲线</div>
      <div class="chart-canvas-wrap">
        <canvas ref="canvasRef"></canvas>
      </div>
    </template>
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

interface LuxDataset {
  label: string
  data: Array<number | null>
}

const props = defineProps<{
  labels: string[]
  datasets: LuxDataset[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const colorPalette = [
  '#409EFF',
  '#67C23A',
  '#E6A23C',
  '#F56C6C',
  '#909399',
  '#9C27B0',
  '#00ACC1',
  '#FF7043',
  '#8D6E63',
  '#26A69A',
]

function isValidLuxValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function countValidPoints(data: Array<number | null>) {
  return data.filter(isValidLuxValue).length
}

const chartLabels = computed(() => {
  const maxDataLength = Math.max(0, ...props.datasets.map(item => item.data.length))
  const length = Math.max(props.labels.length, maxDataLength)
  return Array.from({ length }, (_, index) => props.labels[index] || String(index + 1))
})

const normalizedDatasets = computed(() => {
  return props.datasets
    .map(item => {
      const data = chartLabels.value.map((_, index) => {
        const value = item.data[index]
        return isValidLuxValue(value) ? value : null
      })

      return {
        label: item.label,
        data,
      }
    })
    .filter(item => countValidPoints(item.data) > 0)
})

const validValues = computed(() => {
  return normalizedDatasets.value.flatMap(item => item.data.filter(isValidLuxValue))
})

const validPointCount = computed(() => validValues.value.length)

const hasData = computed(() => {
  return chartLabels.value.length > 0 && normalizedDatasets.value.length > 0 && validPointCount.value > 0
})

const isSparseData = computed(() => hasData.value && validPointCount.value < 2)

const yRange = computed(() => {
  if (validValues.value.length === 0) {
    return undefined
  }

  const min = Math.min(...validValues.value)
  const max = Math.max(...validValues.value)
  const padding = Math.max((max - min) * 0.1, Math.abs(max || min) * 0.1, 1)

  return {
    suggestedMin: Math.max(0, min - padding),
    suggestedMax: max + padding,
  }
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
      datasets: normalizedDatasets.value.map((item, index) => {
        const color = colorPalette[index % colorPalette.length]
        const itemPointCount = countValidPoints(item.data)

        return {
          label: item.label,
          data: item.data,
          tension: 0.35,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointBorderColor: color,
          pointRadius: 5,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: true,
          showLine: itemPointCount > 1,
        }
      }),
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
        },
        y: yRange.value,
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
  () => [props.labels, props.datasets],
  renderChartAfterDomUpdate,
  { deep: true },
)

onBeforeUnmount(destroyChart)
</script>

<style scoped>
.trend-hint {
  margin-bottom: 8px;
  color: #909399;
  font-size: 13px;
}
</style>
