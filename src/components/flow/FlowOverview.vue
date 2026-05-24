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

      <PersonFlowOverviewCard />

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
import { computed, ref, watch } from 'vue'
import HeatmapCard from './HeatmapCard.vue'
import LuxTrendCard from './LuxTrendCard.vue'
import TempPeopleTrendCard from './TempPeopleTrendCard.vue'
import StrategyCompareCard from './StrategyCompareCard.vue'
import PersonFlowOverviewCard from './PersonFlowOverviewCard.vue'
import type { DeviceItem } from '../../types/device'
import type { DurationSummaryItem } from '../../types/duration'

const props = defineProps<{
  devices: DeviceItem[]
  latestLux: number | null
  currentArea: number
  durationRefreshKey?: number
  luxRefreshKey?: number
  flowCache?: any
  flowDataReady?: boolean
  flowLoading?: boolean
}>()

const durationRows = ref<DurationSummaryItem[]>([])
const luxTrendData = ref<any>(null)
const tempPeopleData = ref<any>(null)
const strategyData = ref<any>(null)

function applyCache() {
  if (!props.flowCache) return
  if (props.flowCache.durationSummary) durationRows.value = props.flowCache.durationSummary
  if (props.flowCache.luxTrend) luxTrendData.value = props.flowCache.luxTrend
  if (props.flowCache.tempPeopleTrend) tempPeopleData.value = props.flowCache.tempPeopleTrend
  if (props.flowCache.strategyCompare) strategyData.value = props.flowCache.strategyCompare
}

watch(() => props.flowCache, () => applyCache(), { deep: true, immediate: true })

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
</script>
