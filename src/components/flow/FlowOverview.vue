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
        :data="strategyData"
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
import type { StrategyCompareData } from '../../types/analytics'
import { isLampDevice } from '../../utils/device'

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
const strategyData = ref<StrategyCompareData | null>(null)

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

const onlineCount = computed(() => {
  return props.devices.filter(item => item.online).length
})

const lampDevices = computed(() => props.devices.filter(isLampDevice))

const avgBrightness = computed(() => {
  if (lampDevices.value.length === 0) return 0
  const sum = lampDevices.value.reduce((acc, item) => acc + (item.brightness ?? 0), 0)
  return Math.round(sum / lampDevices.value.length)
})
</script>
