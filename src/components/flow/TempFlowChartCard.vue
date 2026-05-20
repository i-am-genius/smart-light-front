<template>
  <div class="flow-page">
    <div class="chart-grid">
      <HeatmapCard :rows="durationRows" />

      <LuxTrendCard
        :labels="luxLabels"
        :datasets="luxDatasets"
      />

      <TempPeopleTrendCard
        :labels="tempPeopleLabels"
        :temp-series="tempSeries"
        :people-series="peopleSeries"
      />

      <StrategyCompareCard
        :labels="strategyLabels"
        :fixed-series="fixedSeries"
        :smart-series="smartSeries"
      />

      <DistributionChartCard :devices="devices" />

      <div class="info-card">
        <div class="card-title">实时统计</div>
        <p>当前光照：<strong>{{ latestLux ?? '-' }} lux</strong></p>
        <p>在线设备数：<strong>{{ onlineCount }}</strong></p>
        <p>平均亮度：<strong>{{ avgBrightness }}</strong></p>
        <p>店铺面积：<strong>{{ currentArea }} ㎡</strong></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import HeatmapCard from './HeatmapCard.vue'
import LuxTrendCard from './LuxTrendCard.vue'
import TempPeopleTrendCard from './TempPeopleTrendCard.vue'
import StrategyCompareCard from './StrategyCompareCard.vue'
import DistributionChartCard from './DistributionChartCard.vue'
import { getDurationSummary } from '../../api/duration'
import { getMultiLux } from '../../api/lux'
import { getStrategyCompare, getTempPeopleTrend } from '../../api/analytics'
import type { DeviceItem } from '../../types/device'
import type { DurationSummaryItem } from '../../types/duration'
import type { MultiLuxRespVO } from '../../api/lux'
import type { StrategyCompareData, TempPeopleTrendData } from '../../types/analytics'
import { formatDate } from '../../utils/format'

const props = defineProps<{
  devices: DeviceItem[]
  latestLux: number | null
  currentArea: number
}>()

const durationRows = ref<DurationSummaryItem[]>([])
const luxTrendData = ref<MultiLuxRespVO | null>(null)
const tempPeopleData = ref<TempPeopleTrendData | null>(null)
const strategyData = ref<StrategyCompareData | null>(null)

const analyticsChipId = computed(() => {
  return props.devices.find(item => item.chipId)?.chipId
})

function getDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}

async function loadDurationSummary() {
  try {
    const range = getDateRange()
    durationRows.value = await getDurationSummary(range.startDate, range.endDate)
  } catch (error) {
    console.error('loadDurationSummary error =', error)
    durationRows.value = []
  }
}

async function loadMultiLux() {
  luxTrendData.value = await getMultiLux()
}

async function loadTempPeopleTrend() {
  tempPeopleData.value = await getTempPeopleTrend(analyticsChipId.value)
}

async function loadStrategyCompare() {
  strategyData.value = await getStrategyCompare(analyticsChipId.value)
}

const luxLabels = computed(() => luxTrendData.value?.labels || [])
const luxDatasets = computed(() => luxTrendData.value?.datasets || [])

const tempPeopleLabels = computed(() => tempPeopleData.value?.labels || [])
const tempSeries = computed(() => tempPeopleData.value?.tempSeries || [])
const peopleSeries = computed(() => tempPeopleData.value?.peopleSeries || [])

const strategyLabels = computed(() => strategyData.value?.labels || [])
const fixedSeries = computed(() => strategyData.value?.fixedSeries || [])
const smartSeries = computed(() => strategyData.value?.smartSeries || [])

const onlineCount = computed(() => {
  return props.devices.filter(item => item.online).length
})

const avgBrightness = computed(() => {
  if (props.devices.length === 0) return 0
  const sum = props.devices.reduce((acc, item) => acc + (item.brightness ?? 0), 0)
  return Math.round(sum / props.devices.length)
})

watch(
  analyticsChipId,
  (chipId, oldChipId) => {
    if (chipId && chipId !== oldChipId) {
      loadTempPeopleTrend()
      loadStrategyCompare()
    }
  },
)

onMounted(() => {
  loadDurationSummary()
  loadMultiLux()
  loadTempPeopleTrend()
  loadStrategyCompare()
})
</script>
