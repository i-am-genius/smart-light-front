<template>
  <div class="app-container" :class="{ 'night-mode': storeSettings.isNightMode }">
    <SidebarNav v-model="activeTab" />

    <div class="main-content">
      <div
        class="page-switcher"
        :class="{ 'is-switching': pageSwitching }"
        :style="pageSwitcherStyle"
      >
      <Transition
        :name="pageTransitionName"
        @before-leave="measurePagePushDistance"
        @before-enter="beginPageSwitch"
        @after-enter="endPageSwitch"
        @enter-cancelled="endPageSwitch"
        @leave-cancelled="endPageSwitch"
      >
      <section v-if="activeTab === 'main'" key="main" class="page-section">
        <div class="dashboard-top-status">
          <div class="current-time">{{ currentTime }}</div>
          <div class="weather-status-row">
            <span>{{ weatherText }}</span>
            <span class="weather-svg-icon" :class="`weather-${weatherIconType}`" aria-hidden="true">
              <svg viewBox="0 0 36 36" focusable="false">
                <g v-if="weatherIconType === 'sunny'" class="weather-sunny">
                  <circle class="sun-core" cx="18" cy="18" r="6.4" />
                  <path class="sun-rays" d="M18 4.5v4M18 27.5v4M4.5 18h4M27.5 18h4M8.4 8.4l2.8 2.8M24.8 24.8l2.8 2.8M27.6 8.4l-2.8 2.8M11.2 24.8l-2.8 2.8" />
                </g>

                <g v-else>
                  <g v-if="weatherIconType === 'partly-cloudy'" class="weather-sun-small">
                    <circle class="sun-core" cx="13" cy="13" r="4.4" />
                    <path class="sun-rays" d="M13 5.5v2.4M13 18.1v2.4M5.5 13h2.4M18.1 13h2.4M7.7 7.7l1.7 1.7M16.6 16.6l1.7 1.7M18.3 7.7l-1.7 1.7M9.4 16.6l-1.7 1.7" />
                  </g>

                  <path class="cloud-shape" d="M10.9 25.7h15.2a5.4 5.4 0 0 0 .4-10.8 8 8 0 0 0-15.3-1.8 6.4 6.4 0 0 0-.3 12.6Z" />

                  <g v-if="weatherIconType === 'rain'" class="rain-lines">
                    <path d="M14 28.2l-1.7 3.1M21 28.2l-1.7 3.1M27 28l-1.5 2.8" />
                  </g>

                  <g v-if="weatherIconType === 'snow'" class="snow-marks">
                    <path d="M14 29.5v3M12.7 31h2.6M22 29.5v3M20.7 31h2.6" />
                  </g>

                  <g v-if="weatherIconType === 'fog'" class="fog-lines">
                    <path d="M8.5 28.6h19M10.8 32h14.4" />
                  </g>

                  <g v-if="weatherIconType === 'thunder'" class="thunder-bolt">
                    <path d="M19.2 27.4l-3 5h3l-1.1 3.1 4.3-5.2h-3.2l.3-2.9Z" />
                  </g>
                </g>
              </svg>
            </span>
            <span>{{ weekInfo }}</span>
            <span>{{ dateInfo }}</span>
          </div>
        </div>

        <div class="env-layout card-section section-space-top">
          <div class="env-card">
            <h4>实时概况</h4>
            <div class="stat-grid">
              <div class="stat-item">
                <span class="stat-label">温度</span>
                <strong class="stat-value">
                  <OdometerRoll
                    :class="{ 'odometer-motion-pending': !pageNumberMotionReady }"
                    :value="hasWeatherData ? envInfo.temp : null"
                    :decimals="1"
                    suffix="℃"
                    :play="pageNumberMotionReady"
                  />
                </strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">体感</span>
                <strong class="stat-value">
                  <OdometerRoll
                    :class="{ 'odometer-motion-pending': !pageNumberMotionReady }"
                    :value="hasWeatherData ? envInfo.apparentTemp : null"
                    :decimals="1"
                    suffix="℃"
                    :play="pageNumberMotionReady"
                  />
                </strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">湿度</span>
                <strong class="stat-value">
                  <OdometerRoll
                    :class="{ 'odometer-motion-pending': !pageNumberMotionReady }"
                    :value="hasWeatherData ? envInfo.humidity : null"
                    :decimals="0"
                    suffix="%"
                    :play="pageNumberMotionReady"
                  />
                </strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">人流量</span>
                <strong class="stat-value">{{ envInfo.people }} 人</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">面积</span>
                <strong class="stat-value">{{ envInfo.area }} ㎡</strong>
              </div>
            </div>
          </div>

          <div class="env-card">
            <div class="meta-grid">
              <div class="meta-item">
                <span class="stat-label">节假日</span>
                <strong class="stat-value">{{ holidayValue }}</strong>
              </div>
              <div class="meta-item">
                <span class="stat-label">工作日</span>
                <strong class="stat-value">{{ workdayValue }}</strong>
              </div>
            </div>
            <div id="luxDisplay" class="lux-display">
              <span class="lux-label">
                <span class="lux-label-web">光照值：</span>
                <span class="lux-label-mobile">光照</span>
              </span>
              <OdometerRoll
                v-if="latestLux != null"
                class="lux-odometer-web"
                :class="{ 'odometer-motion-pending': !pageNumberMotionReady }"
                :value="latestLux"
                :decimals="0"
                suffix=" lux"
                :play="pageNumberMotionReady"
              />
              <OdometerRoll
                v-if="latestLux != null"
                class="lux-odometer-mobile"
                :class="{ 'odometer-motion-pending': !pageNumberMotionReady }"
                :value="latestLux"
                :decimals="0"
                :digit-height="16"
                suffix=" lux"
                :play="pageNumberMotionReady"
              />
              <span v-if="latestLux == null" class="lux-placeholder">-- lux</span>
            </div>
          </div>
        </div>

        <h1>智能灯控</h1>

        <div id="controls" :class="{ shake: shakingControls }">
          <button :disabled="scanning" @click="handleScan">
            {{ scanning ? '扫描中...' : '扫描设备' }}
          </button>
          <button @click="openManualAdd">手动添加设备</button>
          <label>
            服务器地址：
            <input v-model.trim="serverHost" type="text" placeholder="127.0.0.1" />
          </label>
          <div id="scanStatus" class="ws-status-pill" :class="connectionStatusClass">
            <span class="ws-status-dot" aria-hidden="true"></span>
            <span>{{ connected ? `WS 已连接 · ${scanStatus}` : `WS 未连接 · ${scanStatus}` }}</span>
          </div>
        </div>

<Transition name="ios-panel">
  <div
    v-if="scanning || scanFinished || scannedDevices.length > 0"
    class="scan-panel"
    :class="{ scanning }"
  >
    <div class="scan-panel-header">
      <div class="scan-panel-title">
        {{ scanPanelTitle }}
      </div>

      <button
        v-if="scannedDevices.length > 0"
        class="scan-clear-btn"
        @click="scannedDevices = []"
      >
        清空结果
      </button>
    </div>

    <div v-if="scanning" class="scan-progress">
      <div class="scan-progress-track">
        <div class="scan-progress-fill" :style="{ width: `${scanProgress}%` }"></div>
      </div>
    </div>

    <div v-if="scannedDevices.length === 0" class="scan-empty">
      <span v-if="scanning" class="scan-radar" aria-hidden="true">
        <span class="scan-radar-sweep"></span>
      </span>
      {{ scanEmptyText }}
    </div>

    <TransitionGroup name="ios-card" tag="div" class="scan-list">
      <div
        v-for="(item, index) in scannedDevices"
        :key="`${item.chipId || 'unknown'}-${index}`"
        class="scan-item"
      >
        <div class="scan-item-info">
          <div>{{ item.chipId }}</div>
          <div>IP：{{ item.ip || '未知' }}</div>
          <div>类型：{{ item.deviceType || '未知' }}</div>
        </div>

        <div class="scan-item-actions">
          <button class="scan-add-btn" @click="openAddFromScan(item)">
            添加设备
          </button>
          <button class="scan-cancel-btn" @click="removeScannedDevice(item.chipId)">
            取消
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</Transition>

       <div class="store-layout-row">
          <LightEffectMiniPanel
            class="store-effect-mini"
            :devices="devices"
            :server-state="lightEffectState"
          />

          <StoreLightLayout
            class="store-layout-main"
            :devices="devices"
            @saved="loadDevices"
          />
        </div>

        <DeviceGrid
          :devices="devices"
          :loading="loading"
          :deleting-id="deletingId"
          @refresh="loadDevices"
          @update-realtime="handleRealtimeUpdate"
          @delete="handleDeleteDevice"
        />

      </section> 


      <section v-else-if="activeTab === 'flow'" key="flow" class="page-section">
        <FlowOverview
          :devices="devices"
          :latest-lux="latestLux"
          :current-area="envInfo.area"
          :duration-refresh-key="durationRefreshKey"
          :lux-refresh-key="luxRefreshKey"
          :flow-cache="flowCache"
          :flow-data-ready="flowDataReady"
          :flow-loading="flowDataLoading"
        />
      </section>

    <section v-else-if="activeTab === 'settings'" key="settings" class="page-section">
      <div class="settings-layout">
        <StoreSettingsPanel
          v-model="storeSettings"
          :store-name="currentStoreName"
          @logout="handleLogout"
          @open-store-settings="goStoreSettings"
        />

        <div class="settings-group-card">
          <h2 class="settings-group-title">设备功能</h2>
          <div class="settings-group-grid">
            <ArmControlPanel
              :devices="devices"
            />
            <SmartConfigPanel />
          </div>
        </div>

        <div class="settings-group-card">
          <h2 class="settings-group-title">数据分析</h2>
          <div class="settings-group-grid">
            <FlowMonitorPanel
              :devices="devices"
            />
            <DurationQueryPanel />
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'firmware'" key="firmware" class="page-section">
      <FirmwareManagePanel />
    </section>
    </Transition>
      </div>

  <DeviceAddModal
    v-if="showAddDeviceModal"
    :submitting="creating"
    :initial-data="pendingScannedDevice"
    @close="closeAddDeviceModal"
    @submit="handleCreateDevice"
  />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SidebarNav from '../components/layout/SidebarNav.vue'
import DeviceGrid from '../components/device/DeviceGrid.vue'
import DeviceAddModal from '../components/device/DeviceAddModal.vue'
import FlowMonitorPanel from '../components/settings/FlowMonitorPanel.vue'
import SmartConfigPanel from '../components/settings/SmartConfigPanel.vue'
import StoreLightLayout from '../components/device/StoreLightLayout.vue'
import LightEffectMiniPanel from '../components/device/LightEffectMiniPanel.vue'
import { useClock } from '../composables/useClock'
import { useWebSocket } from '../composables/useWebSocket'
import {
  createDevice,
  deleteDevice,
  getMyDeviceListApi,
  getOnlineList,
  updateDevice,
} from '../api/device'
import { getMultiLux } from '../api/lux'
import { getDurationSummary } from '../api/duration'
import { getStrategyCompare, getTempPeopleTrend } from '../api/analytics'
import type { LightEffectState } from '../api/lightEffect'
import { getCurrentStoreApi } from '../api/store'
import { getCurrentWeather } from '../api/weather'
import type {
  DashboardTab,
  DeviceCreatePayload,
  DeviceItem,
  DeviceOnlineItem,
} from '../types/device'
import DurationQueryPanel from '../components/settings/DurationQueryPanel.vue'
import ArmControlPanel from '../components/settings/ArmControlPanel.vue'
import StoreSettingsPanel from '../components/settings/StoreSettingsPanel.vue'
import type { StoreSettingsValue } from '../components/settings/StoreSettingsPanel.vue'
import FlowOverview from '../components/flow/FlowOverview.vue'
import FirmwareManagePanel from '../components/firmware/FirmwareManagePanel.vue'
import OdometerRoll from '../components/common/OdometerRoll.vue'
import { regions } from '../constants/china-region'
import { STORE_STYLE_MAP } from '../constants/store'
import { getErrorMessage } from '../utils/error'
import { formatDate } from '../utils/format'
import { useToast } from '../composables/useToast'
import { useShake } from '../composables/useShake'
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { shaking: shakingControls, trigger: shakeControls } = useShake()

function getInitialTab(): DashboardTab {
  const tab = route.query.tab

  if (tab === 'main' || tab === 'flow' || tab === 'settings' || tab === 'firmware') {
    return tab
  }

  return 'main'
}

const activeTab = ref<DashboardTab>(getInitialTab())
const dashboardTabOrder: DashboardTab[] = ['main', 'flow', 'settings', 'firmware']
const PAGE_PUSH_GAP_PX = 28
const pageTransitionName = ref('tab-page-next')
const pageSwitching = ref(false)
const pageNumberMotionReady = ref(true)
const pagePushDistance = ref(0)
const pageSwitchHeight = ref(0)
const devices = ref<DeviceItem[]>([])
const lightEffectState = ref<LightEffectState | null>(null)
const loading = ref(false)
const creating = ref(false)
const deletingId = ref<number | null>(null)
const scanStatus = ref('未扫描')
const showAddDeviceModal = ref(false)
const currentStoreName = ref('')

const API_BASE = import.meta.env.VITE_API_BASE

const serverHost = computed(() => {
  return new URL(API_BASE).host
})

const wsUrl = computed(() => {
  return `${API_BASE.replace(/^http/, 'ws')}/ws`
})

const pageSwitcherStyle = computed(() => {
  return pagePushDistance.value > 0 || pageSwitchHeight.value > 0
    ? {
        '--page-push-distance': `${pagePushDistance.value || pageSwitchHeight.value}px`,
        '--page-switch-height': `${pageSwitchHeight.value || pagePushDistance.value}px`,
      }
    : undefined
})

const wsProtocol = computed(() => {
  return (localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN') || '').trim()
})

const scannedDevices = ref<
  Array<{
    chipId: string
    ip: string
    deviceType?: string

    mac?: string
    added?: boolean
  }>
>([])

const scanPanelTitle = computed(() => {
  if (scanning.value) return '扫描结果（进行中）'
  if (scanFinished.value) return '扫描结果（已结束）'
  return '扫描结果'
})

const scanEmptyText = computed(() => {
  if (scanning.value) return '正在等待设备广播...'
  if (scanFinished.value) return '未扫描到设备'
  return '暂无扫描结果'
})

const storeSettingsReady = ref(false)
const NIGHT_MODE_STORAGE_KEY = 'SMART_LIGHT_NIGHT_MODE'

function readPersistedNightMode() {
  return localStorage.getItem(NIGHT_MODE_STORAGE_KEY) === '1'
}

function persistNightMode(value: boolean) {
  localStorage.setItem(NIGHT_MODE_STORAGE_KEY, value ? '1' : '0')
}

function handleLogout() {
  localStorage.removeItem('TOKEN')
  localStorage.removeItem('USER_INFO')
  localStorage.removeItem('storeSetup')
  localStorage.removeItem('REMEMBER_USERNAME')

  sessionStorage.removeItem('TOKEN')
  sessionStorage.removeItem('USER_INFO')
  sessionStorage.removeItem('storeSetup')

  router.replace('/login')
}

function goStoreSettings() {
  router.push('/store-profile')
}
const STYLE_TEMP_MAP: Record<string, number> = {
  HIGH_END: 3500,
  MASS_MARKET: 4000,
  FAST_FASHION: 4500,
}

function buildStoreTypeValue(storeStyle: string) {
  const label = STORE_STYLE_MAP[storeStyle] || '大众'
  const temp = STYLE_TEMP_MAP[storeStyle] || 4000
  return `${label},${temp}`
}

function buildStoreSizeValue(area: number | string | undefined) {
  const num = Number(area || 80)
  let label = '中型'
  if (num <= 60) label = '小型'
  if (num >= 150) label = '大型'
  return `${label},${num}`
}

function findRegionValue(provinceLabel: string, cityLabel: string) {
  for (const province of regions) {
    if (province.label !== provinceLabel) continue

    const city = province.cities.find(item => item.label === cityLabel)
    if (city) {
      return {
        province: province.value,
        provinceLabel: province.label,
        city: city.value,
        cityLabel: city.label,
      }
    }

    return {
      province: province.value,
      provinceLabel: province.label,
      city: '',
      cityLabel,
    }
  }

  return {
    province: '',
    provinceLabel: provinceLabel || '',
    city: '',
    cityLabel: cityLabel || '',
  }
}

async function loadCurrentStore() {
  try {
    const store = await getCurrentStoreApi()
    if (!store?.id) {
      weatherText.value = '天气：暂无'
      envInfo.value.weather = '暂无'
      envInfo.value.temp = null
      envInfo.value.apparentTemp = null
      envInfo.value.humidity = null
      envInfo.value.weatherCode = null
      hasWeatherData.value = false
      return false
    }

    const region = findRegionValue(store.province || '', store.city || '')

    storeSettingsReady.value = false
    storeSettings.value = {
      ...storeSettings.value,
      region,
      storeType: buildStoreTypeValue(store.storeStyle || ''),
      storeSize: buildStoreSizeValue(store.area),
    }

    currentStoreName.value = store.storeName || ''
    currentStoreCityName.value = store.city || store.province || ''
    if (!hasWeatherData.value) {
      weatherText.value = '天气：暂无'
    }
    envInfo.value.area = Number(store.area || 80)
    await loadWeather(store.id)
    return true
  } catch (error: any) {
    console.error('loadCurrentStore error =', error)

    const msg = error?.response?.data?.msg || error?.message || ''
    if (msg.includes('当前用户未绑定店铺')) {
      router.push('/store-setup')
      return false
    }
    return false
  } finally {
    storeSettingsReady.value = true
  }
}

onMounted(async () => {
  const ok = await loadCurrentStore()
  if (!ok) return
  await loadDevices()
  void preloadFlowData(false)
})

function removeScannedDevice(chipId: string) {
  const targetChipId = normalizeChipId(chipId)
  scannedDevices.value = scannedDevices.value.filter(
    item => normalizeChipId(item.chipId) !== targetChipId,
  )

  if (scanning.value) {
    updateScanningStatusText()
  } else {
    scanStatus.value = `扫描结束，发现 ${scannedDevices.value.length} 台待添加设备`
  }
}

const scanning = ref(false)
const scanCountdown = ref(0)
const scanFinished = ref(false)
const SCAN_DURATION_SECONDS = 10
const pendingScannedDevice = ref<{
  chipId: string
  ip: string
  deviceType?: string
  deviceNo?: string
} | null>(null)

let scanTimer: number | null = null
let scanCountdownTimer: number | null = null
let scanResultTipTimer: number | null = null

const scanProgress = computed(() => {
  if (scanning.value) {
    return Math.max(0, Math.min(100, ((SCAN_DURATION_SECONDS - scanCountdown.value) / SCAN_DURATION_SECONDS) * 100))
  }
  return scanFinished.value ? 100 : 0
})

const { currentTime, dateInfo, weekInfo } = useClock()

const weatherText = ref('天气：暂无')
const holidayInfo = ref('是否节假日：否')
const workdayInfo = ref('是否工作日：是')
const latestLuxText = ref('光照值等待更新中...')
const latestLux = ref<number | null>(null)
const durationRefreshKey = ref(0)
const luxRefreshKey = ref(0)
const currentStoreCityName = ref('')
const FLOW_REFRESH_THROTTLE_MS = 5000
const FLOW_DATA_CACHE_MS = 60 * 1000
let lastDurationRefreshAt = 0
let lastLuxTrendRefreshAt = 0

const flowDataReady = ref(false)
const flowDataLoading = ref(false)
const lastFlowDataLoadedAt = ref(0)
const flowCache = ref<{
  durationSummary: any[] | null
  luxTrend: any | null
  tempPeopleTrend: any | null
  strategyCompare: any | null
}>({
  durationSummary: null,
  luxTrend: null,
  tempPeopleTrend: null,
  strategyCompare: null,
})

let flowPreloadPromise: Promise<void> | null = null

function getFlowDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

function getFlowChipId() {
  return devices.value.find(d => d.chipId)?.chipId
}

function hasRequiredFlowCache() {
  const chipId = getFlowChipId()
  const hasDuration = flowCache.value.durationSummary != null
  const hasLux = flowCache.value.luxTrend != null
  const hasChipTrend = !chipId || flowCache.value.tempPeopleTrend != null
  const hasStrategy = !chipId || flowCache.value.strategyCompare != null
  return hasDuration && hasLux && hasChipTrend && hasStrategy
}

async function preloadFlowData(force = false) {
  const now = Date.now()
  if (flowDataLoading.value) return
  if (flowPreloadPromise) return flowPreloadPromise

  if (!force && hasRequiredFlowCache() && now - lastFlowDataLoadedAt.value < FLOW_DATA_CACHE_MS) return

  flowDataLoading.value = true
  flowPreloadPromise = (async () => {
    try {
      const range = getFlowDateRange()
      const chipId = getFlowChipId()

      const needLux = force || flowCache.value.luxTrend == null

      const [durRes, luxRes, trendRes, stratRes] = await Promise.allSettled([
        getDurationSummary(range.startDate, range.endDate),
        needLux ? getMultiLux() : Promise.resolve(flowCache.value.luxTrend),
        chipId ? getTempPeopleTrend(chipId) : Promise.resolve(null),
        chipId ? getStrategyCompare(chipId) : Promise.resolve(null),
      ])

      if (durRes.status === 'fulfilled' && durRes.value) flowCache.value.durationSummary = durRes.value
      if (needLux && luxRes.status === 'fulfilled' && luxRes.value) flowCache.value.luxTrend = luxRes.value
      if (trendRes.status === 'fulfilled' && trendRes.value) flowCache.value.tempPeopleTrend = trendRes.value
      if (stratRes.status === 'fulfilled' && stratRes.value) flowCache.value.strategyCompare = stratRes.value

      flowDataReady.value = true
      lastFlowDataLoadedAt.value = Date.now()
    } catch (e) {
      console.error('preloadFlowData error:', e)
    } finally {
      flowDataLoading.value = false
      flowPreloadPromise = null
    }
  })()

  return flowPreloadPromise
}
const envInfo = ref({
  temp: null as number | null,
  apparentTemp: null as number | null,
  humidity: null as number | null,
  weather: '暂无',
  weatherCode: null as number | null,
  windSpeed: null as number | null,
  people: 0,
  area: 80,
})

const hasWeatherData = ref(false)
type WeatherIconType = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'

const holidayValue = computed(() => extractInfoValue(holidayInfo.value))
const workdayValue = computed(() => extractInfoValue(workdayInfo.value))
const weatherIconType = computed(() => mapOpenMeteoCodeToWeatherIcon(envInfo.value.weatherCode))

function extractInfoValue(value: string) {
  const parts = value.split(/[：:]/)
  return (parts.length > 1 ? parts[parts.length - 1] : value).trim() || '--'
}

function buildWeatherSummary() {
  const city = currentStoreCityName.value.trim()
  const weather = envInfo.value.weather || '暂无'
  return city ? `${city} · ${weather}` : weather
}

function mapOpenMeteoCodeToWeatherIcon(weatherCode?: number | null): WeatherIconType {
  if (weatherCode === 0) return 'sunny'
  if (weatherCode === 1 || weatherCode === 2) return 'partly-cloudy'
  if (weatherCode === 3) return 'cloudy'
  if (weatherCode === 45 || weatherCode === 48) return 'fog'
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(weatherCode))) return 'rain'
  if ([71, 73, 75, 77].includes(Number(weatherCode))) return 'snow'
  if ([95, 96, 99].includes(Number(weatherCode))) return 'thunder'
  return 'cloudy'
}

async function loadWeather(storeId?: string) {
  if (!storeId) {
    weatherText.value = '天气：暂无'
    envInfo.value.weather = '暂无'
    hasWeatherData.value = false
    return
  }

  try {
    const weather = await getCurrentWeather(storeId)
    envInfo.value.temp = weather.temperature ?? envInfo.value.temp
    envInfo.value.apparentTemp = weather.apparentTemperature ?? null
    envInfo.value.humidity = weather.humidity ?? null
    envInfo.value.weather = weather.weatherText || '暂无'
    envInfo.value.weatherCode = weather.weatherCode ?? null
    envInfo.value.windSpeed = weather.windSpeed ?? null
    weatherText.value = buildWeatherSummary()
    hasWeatherData.value = true
  } catch (error) {
    console.error('load weather error =', error)
    weatherText.value = '天气：暂无'
    envInfo.value.weather = '暂无'
    envInfo.value.temp = null
    envInfo.value.apparentTemp = null
    envInfo.value.humidity = null
    envInfo.value.weatherCode = null
    hasWeatherData.value = false
  }
}

function parseStoreType(value: string) {
  const [label, temp] = value.split(',')
  return {
    label,
    temp: Number(temp || 4000),
  }
}

function parseStoreSize(value: string) {
  const [label, area] = value.split(',')
  return {
    label,
    area: Number(area || 80),
  }
}

const storeSettings = ref<StoreSettingsValue>({
  region: {
    province: 'hunan',
    provinceLabel: '湖南省',
    city: '28.1894,112.9861',
    cityLabel: '长沙市',
  },
  storeType: '高端,3500',
  storeSize: '高端,80',
  isNightMode: readPersistedNightMode(),
})

watch(
  storeSettings,
  async (val) => {
    if (!storeSettingsReady.value) return

    const storeTypeInfo = parseStoreType(val.storeType)
    const storeSizeInfo = parseStoreSize(val.storeSize)

    if (!hasWeatherData.value) {
      const provinceLabel = val.region?.provinceLabel || ''
      const cityLabel = val.region?.cityLabel || ''
      currentStoreCityName.value = cityLabel || provinceLabel || ''
      weatherText.value = '天气：暂无'
    }
    envInfo.value.area = storeSizeInfo.area
    persistNightMode(val.isNightMode)

    for (const device of devices.value) {
      if (!device.autoMode) continue

      const nextPayload: DeviceCreatePayload = {
        chipId: device.chipId || '',
        ip: device.ip || '',
        displayName: device.displayName || '',
        brightness: device.brightness ?? 50,
        temp: device.temp ?? 4000,
        autoMode: device.autoMode ?? false,
        recommendedBrightness: device.recommendedBrightness ?? 50,
        recommendedTemp: storeTypeInfo.temp ?? 4000,
        fabric: device.fabric || '',
        mainColorRgb: device.mainColorRgb || '',
      }

      try {
        await updateDevice(device.id, nextPayload)
        device.recommendedTemp = storeTypeInfo.temp
      } catch (error) {
        console.error('sync recommendedTemp error =', error)
      }
    }
  },
  { deep: true },
)

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'main' || tab === 'flow' || tab === 'settings' || tab === 'firmware') {
      activeTab.value = tab
    }
  },
)
watch(activeTab, (tab, oldTab) => {
  const nextIndex = dashboardTabOrder.indexOf(tab)
  const oldIndex = dashboardTabOrder.indexOf(oldTab)
  pageTransitionName.value = oldIndex >= 0 && nextIndex < oldIndex ? 'tab-page-prev' : 'tab-page-next'
  if (oldTab && tab !== oldTab) {
    pageNumberMotionReady.value = false
  }

  if (tab === 'flow') {
    void preloadFlowData(false)
  }
})

function beginPageSwitch() {
  pageNumberMotionReady.value = false
  if (pagePushDistance.value <= 0) {
    const viewportDistance = getViewportPagePushDistance()
    pageSwitchHeight.value = viewportDistance
    pagePushDistance.value = viewportDistance
  }
  pageSwitching.value = true
}

function endPageSwitch() {
  pageSwitching.value = false
  pagePushDistance.value = 0
  pageSwitchHeight.value = 0
  pageNumberMotionReady.value = true
}

function getViewportPagePushDistance() {
  const mainContent = document.querySelector('.main-content')
  const rect = mainContent?.getBoundingClientRect()
  const top = Math.max(rect?.top ?? 0, 0)
  return Math.max(window.innerHeight - top, 1)
}

function measurePagePushDistance(el: Element) {
  const section = el as HTMLElement
  const sectionRect = section.getBoundingClientRect()
  const baseDistance = getViewportPagePushDistance()
  const viewportBottom = window.innerHeight
  let distance = baseDistance
  pageSwitchHeight.value = baseDistance

  const visibleElements = Array.from(section.querySelectorAll<HTMLElement>(
    '.env-card, #controls, .scan-panel, .store-layout-row, .device-grid, .settings-layout, .settings-full-card, .flow-page, .firmware-section, .firmware-page, .flow-card, .chart-card',
  ))

  for (const item of visibleElements) {
    const rect = item.getBoundingClientRect()
    const intersectsViewportBottom = rect.top < viewportBottom && rect.bottom > viewportBottom
    if (!intersectsViewportBottom) continue

    distance = Math.max(distance, rect.bottom - sectionRect.top)
  }

  pagePushDistance.value = Math.ceil(distance + PAGE_PUSH_GAP_PX)
}

function normalizeChipId(value?: string) {
  return String(value || '').trim().toUpperCase()
}

function mergeDeviceOnline(deviceList: DeviceItem[], onlineList: DeviceOnlineItem[]) {
  const onlineMap = new Map(
    (onlineList || []).map(item => [normalizeChipId(item.chipId), item]),
  )

  return (deviceList || []).map(device => {
    const onlineInfo = onlineMap.get(normalizeChipId(device.chipId))

    return {
      ...device,
      online: onlineInfo?.online === true,
      lastSeen: onlineInfo?.lastSeen,
      ip: onlineInfo?.ip || device.ip,
    }
  })
}

async function loadDevices() {
  loading.value = true
  if (!scanning.value && !scanFinished.value) {
    scanStatus.value = '加载中...'
  }

  try {
    const [deviceList, onlineList] = await Promise.all([
      getMyDeviceListApi(),
      getOnlineList(),
    ])

    devices.value = mergeDeviceOnline(deviceList, onlineList)

    if (!scanning.value) {
      scanStatus.value = `已加载 ${devices.value.length} 台设备`
    }

    await loadLatestLux()
  } catch (error) {
    console.error('loadDevices error =', error)
    scanStatus.value = '设备加载失败'
  } finally {
    loading.value = false
  }
}

async function loadLatestLux() {
  try {
    const trend = await getMultiLux()

    // 写入 flowCache，避免 preloadFlowData 重复请求 multi-trend
    if (trend) {
      flowCache.value.luxTrend = trend
      if (!flowDataReady.value) {
        lastFlowDataLoadedAt.value = Date.now()
      }
    }

    const datasets = trend?.datasets || []

    const latestValues = datasets
      .map(item => {
        const arr = item.data || []
        return arr.length > 0 ? Number(arr[arr.length - 1]) : null
      })
      .filter((value): value is number => value != null && !Number.isNaN(value))

    if (latestValues.length === 0) {
      latestLux.value = null
      latestLuxText.value = '暂无光照数据'
      return
    }

    const avgLux = latestValues.reduce((sum, val) => sum + val, 0) / latestValues.length
    const roundedLux = Math.round(avgLux)

    latestLux.value = roundedLux
    latestLuxText.value = `光照值：${roundedLux} lux`
  } catch (error) {
    console.error('loadLatestLux error =', error)
    latestLux.value = null
    latestLuxText.value = '光照数据加载失败'
  }
}

function clearScanTimers() {
  if (scanTimer) {
    window.clearTimeout(scanTimer)
    scanTimer = null
  }
  if (scanCountdownTimer) {
    window.clearInterval(scanCountdownTimer)
    scanCountdownTimer = null
  }
  if (scanResultTipTimer) {
    window.clearTimeout(scanResultTipTimer)
    scanResultTipTimer = null
  }
}

function getNormalScanStatusText() {
  return connected.value ? '实时连接已建立' : 'WebSocket 未连接'
}

function updateScanningStatusText() {
  const foundText = scannedDevices.value.length > 0
    ? ` · 已发现 ${scannedDevices.value.length} 台待添加设备`
    : ''
  scanStatus.value = `扫描中（${scanCountdown.value}秒）...${foundText}`
}

function finishScan() {
  scanning.value = false
  scanFinished.value = true
  scanCountdown.value = 0

  if (scanTimer) {
    window.clearTimeout(scanTimer)
    scanTimer = null
  }
  if (scanCountdownTimer) {
    window.clearInterval(scanCountdownTimer)
    scanCountdownTimer = null
  }

  if (scannedDevices.value.length > 0) {
    scanStatus.value = `扫描结束，发现 ${scannedDevices.value.length} 台待添加设备`
  } else {
    scanStatus.value = '未扫描到设备'
  }

  if (scanResultTipTimer) {
    window.clearTimeout(scanResultTipTimer)
  }
  scanResultTipTimer = window.setTimeout(() => {
    scanFinished.value = false
    scanStatus.value = getNormalScanStatusText()
    scanResultTipTimer = null
  }, 3000)
}

function handleScan() {
  clearScanTimers()
  scannedDevices.value = []
  scanning.value = true
  scanFinished.value = false
  scanCountdown.value = SCAN_DURATION_SECONDS
  updateScanningStatusText()

  scanTimer = window.setTimeout(() => {
    finishScan()
  }, 10000)

  scanCountdownTimer = window.setInterval(() => {
    if (!scanning.value) return
    scanCountdown.value = Math.max(scanCountdown.value - 1, 1)
    updateScanningStatusText()
  }, 1000)
}

function openManualAdd() {
  pendingScannedDevice.value = null
  showAddDeviceModal.value = true
}

function openAddFromScan(device: {
  chipId: string
  ip: string
  deviceType?: string
  deviceNo?: string
}) {
  pendingScannedDevice.value = {
    chipId: device.chipId || '',
    ip: device.ip || '',
    deviceType: device.deviceType || '',
    deviceNo: device.deviceNo || '',
  }
  showAddDeviceModal.value = true
}

function closeAddDeviceModal() {
  showAddDeviceModal.value = false
  pendingScannedDevice.value = null
}

async function handleCreateDevice(payload: DeviceCreatePayload) {
  creating.value = true
  try {
    const result = await createDevice(payload)

    showAddDeviceModal.value = false
    pendingScannedDevice.value = null

    const createdChipId = normalizeChipId(payload.chipId)
    scannedDevices.value = scannedDevices.value.filter(
      item => normalizeChipId(item.chipId) !== createdChipId,
    )

    // 本地插入新设备，WS 的 state 消息会补充完整数据
    devices.value.push({
      id: String(result),
      chipId: payload.chipId || '',
      ip: payload.ip || '',
      displayName: payload.displayName || '',
      deviceType: payload.deviceType || '',
      deviceNo: payload.deviceNo || '',
      brightness: payload.brightness ?? 50,
      temp: payload.temp ?? 4000,
      autoMode: payload.autoMode ?? false,
      recommendedBrightness: payload.recommendedBrightness ?? 50,
      recommendedTemp: payload.recommendedTemp ?? 4000,
      fabric: payload.fabric || '',
      mainColorRgb: payload.mainColorRgb || '',
      online: false,
    } as unknown as DeviceItem)
  } catch (error) {
    console.error('createDevice error =', error)
    toast.show(getErrorMessage(error, '添加设备失败'), 'error')
    shakeControls()
  } finally {
    creating.value = false
  }
}

const REALTIME_UPDATE_DEBOUNCE_MS = 300

interface RealtimeUpdateState {
  timer?: number
  version: number
  inFlight: boolean
  flushAfterFlight: boolean
  payload: DeviceCreatePayload
  lightControl?: boolean
}

const updateTimerMap = new Map<number, RealtimeUpdateState>()

function handleRealtimeUpdate({
  id,
  payload,
  lightControl,
}: {
  id: number
  payload: DeviceCreatePayload
  lightControl?: boolean
}) {
  let state = updateTimerMap.get(id)
  if (!state) {
    state = {
      version: 0,
      inFlight: false,
      flushAfterFlight: false,
      payload,
      lightControl,
    }
    updateTimerMap.set(id, state)
  }

  state.version += 1
  state.payload = payload
  state.lightControl = lightControl
  state.flushAfterFlight = false

  if (state.timer) {
    window.clearTimeout(state.timer)
  }

  const version = state.version
  state.timer = window.setTimeout(() => {
    void flushRealtimeUpdate(id, version)
  }, REALTIME_UPDATE_DEBOUNCE_MS)
}

async function flushRealtimeUpdate(id: number, version: number) {
  const state = updateTimerMap.get(id)
  if (!state || version !== state.version) return

  state.timer = undefined

  if (state.inFlight) {
    state.flushAfterFlight = true
    return
  }

  const sentVersion = state.version
  const payload = state.payload
  const lightControl = state.lightControl

  state.inFlight = true
  state.flushAfterFlight = false

  try {
    await updateDevice(id, payload, { lightControl })

    if (sentVersion === state.version) {
      const index = devices.value.findIndex(item => String(item.id) === String(id))
      if (index >= 0) {
        devices.value[index] = {
          ...devices.value[index],
          ...payload,
        }
      }
    }
  } catch (error) {
    console.error('realtime update error =', error)
  } finally {
    state.inFlight = false

    if (sentVersion !== state.version) {
      if (!state.timer && state.flushAfterFlight) {
        void flushRealtimeUpdate(id, state.version)
      }
      return
    }

    if (!state.timer) {
      updateTimerMap.delete(id)
    }
  }
}

async function handleDeleteDevice(id: number) {
  deletingId.value = id
  try {
    await deleteDevice(id)
    // 从本地数组中移除，触发 TransitionGroup 离场动画
    const delId = String(id)
    const idx = devices.value.findIndex(d => String(d.id) === delId)
    if (idx >= 0) {
      devices.value.splice(idx, 1)
    }
  } catch (error) {
    console.error('deleteDevice error =', error)
    toast.show(getErrorMessage(error, '删除设备失败'), 'error')
    shakeControls()
  } finally {
    deletingId.value = null
  }
}

function updateDeviceByIncoming(incoming: Partial<DeviceItem>) {
  const index = devices.value.findIndex(item => {
    if (incoming.id != null && String(item.id) === String(incoming.id)) return true
    if (incoming.chipId && String(item.chipId) === String(incoming.chipId)) return true
    return false
  })

  if (index >= 0) {
    devices.value[index] = {
      ...devices.value[index],
      ...incoming,
    }
  } else {
    devices.value.push(incoming as DeviceItem)
  }
}

function requestDurationSummaryRefresh() {
  const now = Date.now()
  if (now - lastDurationRefreshAt < FLOW_REFRESH_THROTTLE_MS) return
  lastDurationRefreshAt = now
  durationRefreshKey.value += 1
  void preloadFlowData(true)
}

function requestLuxTrendRefresh() {
  const now = Date.now()
  if (now - lastLuxTrendRefreshAt < FLOW_REFRESH_THROTTLE_MS) return
  lastLuxTrendRefreshAt = now
  luxRefreshKey.value += 1
  void preloadFlowData(true)
}

function handleWsMessage(message: any) {
  if (!message?.type) return

  if (message.type === 'state' && message.data) {
    updateDeviceByIncoming(message.data)
    return
  }

  if (message.type === 'lightEffectState' && message.data) {
    lightEffectState.value = message.data
    return
  }

  if (message.type === 'onlineStatus' && message.data) {
    updateDeviceByIncoming({
      chipId: message.data.chipId,
      ip: message.data.ip,
      online: message.data.online,
      lastSeen: message.data.lastSeen,
    })
    return
  }

  if (message.type === 'fabricRecognize' && message.data) {
    const chipId = String(message.data.chipId ?? '').trim()
    if (!chipId) return

    updateDeviceByIncoming({
      chipId,
      label: message.data.label,
      fabric: message.data.fabric ?? message.data.label,
      confidence: message.data.confidence,
      mainColorRgb: message.data.mainColorRgb,
      recommendedBrightness: message.data.recommendedBrightness,
      recommendedTemp: message.data.recommendedTemp,
      clothDetected: message.data.clothDetected,
      clothX: message.data.clothX,
      clothY: message.data.clothY,
      clothW: message.data.clothW,
      clothH: message.data.clothH,
      originalImageUrl: message.data.originalImageUrl,
      annotatedImageUrl: message.data.annotatedImageUrl,
      combinedImageUrl: message.data.combinedImageUrl,
    })
    return
  }

  if (message.type === 'deviceDeleted' && message.data) {
    const deletedId = message.data.id
    const deletedChipId = message.data.chipId

    devices.value = devices.value.filter(item => {
      if (deletedId != null && String(item.id) === String(deletedId)) return false
      if (deletedChipId && normalizeChipId(item.chipId) === normalizeChipId(deletedChipId)) return false
      return true
    })
    return
  }

  if (message.type === 'personDetection' && message.data) {
    const chipId = String(message.data.chipId ?? '').trim()
    if (!chipId) return

    const count = Number(message.data.count ?? 0)
    const timestamp = message.data.timestamp ?? new Date().toISOString()

    updateDeviceByIncoming({
      chipId,
      personCount: count,
      peopleCount: count,
      flowPersonCount: count,
      personDetected: count > 0,
      hasPerson: count > 0,
      personDetectTime: timestamp,
      flowDetectTime: timestamp,
      detectTime: timestamp,
      personConfidence: Number(message.data.confidence ?? 0),
      flowProcessingTime: Number(message.data.processingTime ?? 0),
    })
    return
  }

  if (message.type === 'durationUpdate' && message.data) {
    requestDurationSummaryRefresh()
    return
  }

  if (message.type === 'lux') {
    const luxValue = Number(
      message?.data?.luxValue ??
      message?.data?.lux ??
      message?.value ??
      0
    )

    latestLux.value = luxValue
    latestLuxText.value = `光照值：${luxValue} lux`
    requestLuxTrendRefresh()
    return
  }

  if (message.type === 'announce' && message.data) {
    if (!scanning.value) return

    const chipId = String(
      message.data.chipId ??
      message.data.deviceCode ??
      ''
    ).trim()

    if (!chipId) return

    const normalizedChipId = normalizeChipId(chipId)
    const alreadyAdded = devices.value.some(
      item => normalizeChipId(item.chipId) === normalizedChipId,
    )
    if (alreadyAdded) return

    const added = Boolean(message.data.added)
    if (added) return

    const exists = scannedDevices.value.some(
      item => normalizeChipId(item.chipId) === normalizedChipId,
    )
    if (exists) return

    scannedDevices.value = [
      ...scannedDevices.value,
      {
        chipId,
        ip: String(message.data.ip ?? '').trim(),
        deviceType: String(message.data.deviceType ?? '').trim(),
        mac: String(message.data.mac ?? '').trim(),
        added: false,
      },
    ]

    updateScanningStatusText()
    return
  }
}

const { connected } = useWebSocket(wsUrl, handleWsMessage, wsProtocol)

const connectionStatusClass = computed(() => ({
  'ws-connected': connected.value,
  'ws-scanning': scanning.value,
  'ws-offline': !connected.value,
}))

watch(connected, (val) => {
  if (scanning.value || scanFinished.value) return

  if (val) {
    scanStatus.value = '实时连接已建立'
  } else {
    scanStatus.value = 'WebSocket 未连接'
  }
})

onBeforeUnmount(() => {
  clearScanTimers()

  updateTimerMap.forEach(state => {
    if (state.timer) {
      window.clearTimeout(state.timer)
    }
  })
  updateTimerMap.clear()
})
</script>

<style scoped>

.app-container {
  position: relative;
  isolation: isolate;
  display: block;
  width: 100%;
  max-width: 100%;
  min-height: 100vh;
  background: #eef4fb;
  overflow-x: hidden;
  overflow-y: visible;
}

.app-container::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: url('/backgrounds/bg-day.png');
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  opacity: 0.95;
  filter: blur(8px);
  transform: scale(1.02);
  pointer-events: none;
  transition: opacity 0.5s ease, filter 0.5s ease;
}

.app-container::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(
      90deg,
      rgba(245, 248, 252, 0.18) 0%,
      rgba(245, 248, 252, 0.08) 45%,
      rgba(245, 248, 252, 0.02) 100%
    );
  pointer-events: none;
  transition: background 0.5s ease;
}

.app-container.night-mode::before {
  background-image: url('/backgrounds/bg-night.png');
  opacity: 1;
}

.app-container.night-mode::after {
  background:
    linear-gradient(
      90deg,
      rgba(2, 6, 23, 0.42) 0%,
      rgba(2, 6, 23, 0.22) 55%,
      rgba(2, 6, 23, 0.08) 100%
    );
}

.page-switcher {
  --page-push-distance: calc(100vh - 72px);
  --page-switch-height: calc(100vh - 72px);
  position: relative;
  min-height: calc(100vh - 72px);
  overflow: visible;
}

.page-switcher.is-switching {
  height: var(--page-switch-height);
  min-height: 0;
  overflow: hidden;
}

.page-section {
  position: relative;
  width: 100%;
  will-change: transform;
}

.page-switcher.is-switching .page-section {
  height: 100%;
  min-height: 100%;
  overflow: hidden;
}

.odometer-motion-pending {
  visibility: hidden;
}

.tab-page-next-enter-active,
.tab-page-next-leave-active,
.tab-page-prev-enter-active,
.tab-page-prev-leave-active {
  transition: transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.tab-page-next-leave-active,
.tab-page-prev-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
  pointer-events: none;
}

.tab-page-next-enter-from {
  transform: translateY(var(--page-push-distance));
}

.tab-page-next-leave-to {
  transform: translateY(calc(var(--page-push-distance) * -1));
}

.tab-page-prev-enter-from {
  transform: translateY(calc(var(--page-push-distance) * -1));
}

.tab-page-prev-leave-to {
  transform: translateY(var(--page-push-distance));
}

.dashboard-top-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 14px;
}

.current-time {
  color: #111827;
  font-size: 2rem;
  font-weight: 900;
  line-height: 1;
}

.weather-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 7px;
  color: #475569;
  font-size: 14px;
  font-weight: 800;
}

.weather-svg-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #64748b;
}

.weather-svg-icon svg {
  width: 36px;
  height: 36px;
  display: block;
}

.weather-svg-icon path,
.weather-svg-icon circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.weather-svg-icon .sun-core {
  fill: rgba(245, 158, 11, 0.18);
  stroke: #f59e0b;
}

.weather-svg-icon .sun-rays,
.weather-svg-icon.weather-sunny {
  color: #f59e0b;
}

.weather-svg-icon .weather-sun-small {
  color: #f59e0b;
}

.weather-svg-icon .cloud-shape {
  color: #64748b;
  fill: rgba(148, 163, 184, 0.14);
}

.weather-svg-icon .rain-lines {
  color: #3b82f6;
}

.weather-svg-icon .snow-marks {
  color: #60a5fa;
}

.weather-svg-icon .fog-lines {
  color: #94a3b8;
}

.weather-svg-icon .thunder-bolt path {
  color: #facc15;
  fill: rgba(250, 204, 21, 0.24);
}

.section-space-top {
  margin-top: 10px;
}

.env-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 22px;
}

.env-card {
  flex: 1 1 48%;
  min-width: 300px;
  background: #fff;
  padding: 14px 16px;
  border-radius: 16px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.env-card h4 {
  margin: 0 0 10px;
  font-size: 17px;
}
:deep(.env-card),
:deep(.lamp-card),
:deep(.settings-card),
:deep(.placeholder-card),
:deep(.empty-block),
:deep(.scan-panel),
:deep(.chart-card),
:deep(.info-card),
:deep(#controls) {
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10);
}
.env-info {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.stat-grid {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.stat-item {
  min-width: 0;
  padding: 0 18px 0 0;
  border-right: 1px solid rgba(203, 213, 225, 0.72);
}

.stat-item:last-child {
  padding-right: 0;
  border-right: none;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  width: 100%;
  gap: 0;
  margin-bottom: 14px;
}

.meta-item {
  min-width: 0;
  padding: 0 24px;
}

.meta-item:first-child {
  padding-left: 0;
}

.meta-item + .meta-item {
  border-left: 1px solid rgba(203, 213, 225, 0.72);
}

.meta-item:last-child {
  padding-right: 0;
}

.stat-label {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.2;
}

.stat-value {
  display: block;
  color: #0f172a;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 800;
}

#metaInfo {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 30px;
  row-gap: 6px;
}

.lux-display {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.72);
  border-radius: 13px;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.lux-label {
  font-weight: 600;
  color: #475569;
}

.lux-label-web {
  display: inline;
}

.lux-label-mobile {
  display: none;
}

.lux-odometer-mobile {
  display: none;
}

.lux-odometer-web {
  display: inline-flex;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 600;
  color: #0f172a;
}

:deep(.lux-odometer-web .odometer-num),
:deep(.lux-odometer-web .odometer-suffix) {
  font-weight: 600;
}

.lux-placeholder {
  font-weight: 600;
  color: #0f172a;
}

.page-section > h1 {
  margin: 26px 0 16px;
  color: #1f2937;
  font-size: 34px;
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: -0.02em;
}

#controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 28px;
  padding: 14px 18px;
  border-radius: 18px;
}

#controls > button {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  min-height: 40px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
}

#controls > button:disabled {
  opacity: 0.62;
  cursor: not-allowed;
  box-shadow: none;
}

#controls label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
}

#controls input {
  width: 178px;
  height: 36px;
  box-sizing: border-box;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 10px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.86);
  color: #334155;
  font-size: 14px;
}

#scanStatus {
  margin-left: auto;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
}

#scanStatus.ws-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid rgba(203, 213, 225, 0.82);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.86);
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    color 0.22s ease,
    box-shadow 0.22s ease;
}

.ws-status-dot {
  position: relative;
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12);
}

.ws-status-dot::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  border: 1px solid currentColor;
  opacity: 0;
}

#scanStatus.ws-connected {
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.24);
  background: rgba(240, 253, 244, 0.9);
  box-shadow: 0 8px 18px rgba(22, 163, 74, 0.08);
}

#scanStatus.ws-connected .ws-status-dot {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
}

#scanStatus.ws-connected .ws-status-dot::after,
#scanStatus.ws-scanning .ws-status-dot::after {
  animation: wsStatusPulse 1.8s ease-out infinite;
}

#scanStatus.ws-scanning {
  color: #0369a1;
  border-color: rgba(14, 165, 233, 0.28);
  background: rgba(240, 249, 255, 0.92);
}

#scanStatus.ws-scanning .ws-status-dot {
  background: #0ea5e9;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.14);
}

@keyframes wsStatusPulse {
  0% {
    opacity: 0.45;
    transform: scale(0.65);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}

.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
}

.settings-half-card {
  min-width: 0;
  height: 100%;
}

.settings-full-card {
  width: 100%;
}

.settings-group-card {
  width: 100%;
  min-width: 0;
  margin-top: 24px;
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-sizing: border-box;
}

.settings-group-title {
  font-size: 17px;
  font-weight: 700;
  color: #1d2129;
  margin: 0 0 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5e6eb;
}

.settings-group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: start;
}

.settings-group-grid > * {
  min-width: 0;
}

.settings-group-grid :deep(.smart-config-section) {
  width: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-radius: 0;
}

.settings-group-grid :deep(.smart-config-section .smart-card) {
  max-width: none;
}

.night-mode {
  background: linear-gradient(180deg, #1f2329 0%, #14181f 100%);
  color: #e5eaf3;
  transition: background 0.5s ease, color 0.5s ease;
}

.night-mode .main-content {
  background: transparent;
}

.app-container :deep(.env-card),
.app-container :deep(.lamp-card),
.app-container :deep(.settings-card),
.app-container :deep(.layout-card),
.app-container :deep(.light-effect-mini-card),
.app-container :deep(.sidebar),
.app-container :deep(.chart-card),
.app-container :deep(#controls) {
  transition: background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease, color 0.5s ease;
}

/* 夜间模式：基础文字 */
.night-mode .device-meta,
.night-mode .field-label,
.night-mode .checkbox-row,
.night-mode .settings-title,
.night-mode .settings-group-title,
.night-mode .readonly-box {
  color: #c9d1d9;
}

/* 夜间模式：光照显示 */
.night-mode .lux-display {
  background: rgba(30, 41, 59, 0.72);
}

/* 夜间模式：侧边栏激活态 */
.night-mode :deep(.sidebar li.active),
.night-mode :deep(.sidebar li:hover) {
  background: rgba(64, 158, 255, 0.18);
}

/* 夜间模式：大卡片统一 */
.app-container.night-mode :deep(.env-card),
.app-container.night-mode :deep(.lamp-card),
.app-container.night-mode :deep(.settings-card),
.app-container.night-mode :deep(.placeholder-card),
.app-container.night-mode :deep(.empty-block),
.app-container.night-mode :deep(.scan-panel),
.app-container.night-mode :deep(.chart-card),
.app-container.night-mode :deep(.info-card),
.app-container.night-mode :deep(#controls),
.app-container.night-mode :deep(.sidebar) {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #e5e7eb;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 夜间模式：设置页分组标题 */
.night-mode .settings-group-title {
  border-bottom-color: rgba(148, 163, 184, 0.22);
}

/* 夜间模式：设置页内部小卡片 */
.app-container.night-mode :deep(.flow-card),
.app-container.night-mode :deep(.flow-data-item),
.app-container.night-mode :deep(.flow-chart-box),
.app-container.night-mode :deep(.empty-flow),
.app-container.night-mode :deep(.smart-step),
.app-container.night-mode :deep(.smart-status),
.app-container.night-mode :deep(.smart-message),
.app-container.night-mode :deep(.meta-chip) {
  background: rgba(15, 23, 42, 0.62) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: #e5e7eb !important;
}

/* 夜间模式：重点文字 */
.app-container.night-mode :deep(.flow-device-name),
.app-container.night-mode :deep(.flow-data-item strong),
.app-container.night-mode :deep(.meta-value),
.app-container.night-mode :deep(.smart-title) {
  color: #f8fafc !important;
}

/* 夜间模式：辅助文字 */
.app-container.night-mode :deep(.flow-device-sub),
.app-container.night-mode :deep(.flow-data-item span),
.app-container.night-mode :deep(.meta-key),
.app-container.night-mode :deep(.smart-desc),
.app-container.night-mode :deep(.flow-chart-box),
.app-container.night-mode :deep(.smart-step p) {
  color: #94a3b8 !important;
}

/* 夜间模式：输入框、日期框、自定义下拉 */
.app-container.night-mode :deep(input),
.app-container.night-mode :deep(select),
.app-container.night-mode :deep(.date-input),
.app-container.night-mode :deep(.text-input),
.app-container.night-mode :deep(.region-input),
.app-container.night-mode :deep(.readonly-box),
.app-container.night-mode :deep(.select-trigger) {
  background: rgba(15, 23, 42, 0.76) !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: #e5e7eb !important;
}

.app-container.night-mode :deep(input::placeholder),
.app-container.night-mode :deep(.select-text.placeholder) {
  color: #64748b !important;
}

/* 夜间模式：自定义下拉展开面板 */
.app-container.night-mode :deep(.select-dropdown) {
  background: rgba(15, 23, 42, 0.96) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45) !important;
}

.app-container.night-mode :deep(.select-option) {
  color: #e5e7eb !important;
}

.app-container.night-mode :deep(.select-option:hover) {
  background: rgba(30, 41, 59, 0.9) !important;
}

/* 夜间模式：状态标签 */
.app-container.night-mode :deep(.flow-status) {
  background: rgba(37, 99, 235, 0.22) !important;
  color: #93c5fd !important;
}

.app-container.night-mode :deep(.flow-status.active) {
  background: rgba(127, 29, 29, 0.3) !important;
  color: #fecaca !important;
}

/* 夜间模式：次级按钮 */
.app-container.night-mode :deep(.btn-secondary),
.app-container.night-mode :deep(.secondary-btn),
.app-container.night-mode :deep(.scan-cancel-btn) {
  background: rgba(30, 41, 59, 0.82) !important;
  border: 1px solid rgba(148, 163, 184, 0.24) !important;
  color: #e5e7eb !important;
}

/* 夜间模式：退出 / 危险按钮 */
.app-container.night-mode :deep(.btn-logout),
.app-container.night-mode :deep(.btn-danger) {
  background: rgba(127, 29, 29, 0.26) !important;
  color: #fecaca !important;
}

/* 夜间模式：SmartConfig 提示框 */
.app-container.night-mode :deep(.smart-tips) {
  background: rgba(120, 53, 15, 0.22) !important;
  border: 1px solid rgba(245, 158, 11, 0.18) !important;
  color: #fde68a !important;
}

.app-container.night-mode :deep(.smart-message.success) {
  background: rgba(6, 95, 70, 0.22) !important;
  color: #a7f3d0 !important;
}

.app-container.night-mode :deep(.smart-message.error) {
  background: rgba(127, 29, 29, 0.22) !important;
  color: #fecaca !important;
}

/* 夜间模式：高对比可读性补强 */
.app-container.night-mode :deep(.layout-card),
.app-container.night-mode :deep(.light-effect-mini-card),
.app-container.night-mode :deep(.smart-config-section),
.app-container.night-mode :deep(.smart-card),
.app-container.night-mode :deep(.direction-pad),
.app-container.night-mode :deep(.preset-btn),
.app-container.night-mode :deep(.slider-card),
.app-container.night-mode :deep(.scan-item),
.app-container.night-mode :deep(.firmware-section),
.app-container.night-mode :deep(.firmware-info-item),
.app-container.night-mode :deep(.detail-info-item),
.app-container.night-mode :deep(.readonly-item) {
  background: rgba(15, 23, 42, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.18) !important;
  color: rgba(226, 232, 240, 0.88) !important;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35) !important;
}

.app-container.night-mode :deep(.smart-card),
.app-container.night-mode :deep(.layout-card),
.app-container.night-mode :deep(.light-effect-mini-card) {
  background: rgba(15, 23, 42, 0.82) !important;
}

.app-container.night-mode :deep(h1),
.app-container.night-mode :deep(h2),
.app-container.night-mode :deep(h3),
.app-container.night-mode :deep(h4),
.app-container.night-mode :deep(.card-title),
.app-container.night-mode :deep(.scan-panel-title),
.app-container.night-mode :deep(.layout-header h2),
.app-container.night-mode :deep(.mini-title),
.app-container.night-mode :deep(.device-title-block h3),
.app-container.night-mode :deep(.preset-btn strong),
.app-container.night-mode :deep(.slider-card-header),
.app-container.night-mode :deep(.firmware-section h4),
.app-container.night-mode :deep(.firmware-info-item strong),
.app-container.night-mode :deep(.detail-value),
.app-container.night-mode :deep(.readonly-value),
.app-container.night-mode :deep(.lamp-info strong),
.app-container.night-mode :deep(.zone-order-row strong) {
  color: rgba(248, 250, 252, 0.96) !important;
}

.app-container.night-mode :deep(.env-info),
.app-container.night-mode :deep(.stat-label),
.app-container.night-mode :deep(#metaInfo),
.app-container.night-mode :deep(#scanStatus),
.app-container.night-mode :deep(.scan-item-info),
.app-container.night-mode :deep(.field-label),
.app-container.night-mode :deep(.checkbox-row),
.app-container.night-mode :deep(.form-row label),
.app-container.night-mode :deep(.modal-label),
.app-container.night-mode :deep(.detail-label),
.app-container.night-mode :deep(.firmware-info-item span),
.app-container.night-mode :deep(.readonly-label),
.app-container.night-mode :deep(.mini-label),
.app-container.night-mode :deep(.lamp-info span),
.app-container.night-mode :deep(.zone-order-row span),
.app-container.night-mode :deep(.message-body) {
  color: rgba(226, 232, 240, 0.88) !important;
}

.app-container.night-mode :deep(.stat-item) {
  border-color: rgba(148, 163, 184, 0.22) !important;
}

.app-container.night-mode :deep(.meta-item) {
  border-color: rgba(148, 163, 184, 0.22) !important;
}

.app-container.night-mode :deep(.stat-value) {
  color: rgba(248, 250, 252, 0.96) !important;
}

.app-container.night-mode :deep(.panel-desc),
.app-container.night-mode :deep(.last-seen-under-name),
.app-container.night-mode :deep(.layout-header p),
.app-container.night-mode :deep(.mini-status),
.app-container.night-mode :deep(.preset-btn span),
.app-container.night-mode :deep(.device-meta),
.app-container.night-mode :deep(.detail-subtitle),
.app-container.night-mode :deep(.modal-hint),
.app-container.night-mode :deep(.scan-empty),
.app-container.night-mode :deep(.empty-block),
.app-container.night-mode :deep(.field-hint.placeholder) {
  color: rgba(203, 213, 225, 0.72) !important;
}

.app-container.night-mode :deep(input::placeholder),
.app-container.night-mode :deep(textarea::placeholder),
.app-container.night-mode :deep(.select-text.placeholder) {
  color: rgba(203, 213, 225, 0.58) !important;
}

.app-container.night-mode :deep(.scan-empty),
.app-container.night-mode :deep(.empty-block) {
  background: rgba(15, 23, 42, 0.58) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
}

.app-container.night-mode :deep(.speed-tab),
.app-container.night-mode :deep(.compact-btn),
.app-container.night-mode :deep(.shortcut-btn),
.app-container.night-mode :deep(.btn-light),
.app-container.night-mode :deep(.reset-layout-btn),
.app-container.night-mode :deep(.scan-clear-btn),
.app-container.night-mode :deep(.mini-btn.stop),
.app-container.night-mode :deep(.btn-ai) {
  background: rgba(30, 41, 59, 0.82) !important;
  border: 1px solid rgba(148, 163, 184, 0.24) !important;
  color: rgba(226, 232, 240, 0.9) !important;
  box-shadow: none !important;
}

.app-container.night-mode :deep(.speed-tab.active),
.app-container.night-mode :deep(.compact-btn.primary),
.app-container.night-mode :deep(.btn-ai:not(.active):hover),
.app-container.night-mode :deep(.reset-layout-btn:hover),
.app-container.night-mode :deep(.shortcut-btn:hover),
.app-container.night-mode :deep(.compact-btn:hover) {
  background: rgba(37, 99, 235, 0.26) !important;
  border-color: rgba(96, 165, 250, 0.45) !important;
  color: #bfdbfe !important;
}

.app-container.night-mode :deep(.dir-btn) {
  background: rgba(30, 41, 59, 0.88) !important;
  color: #93c5fd !important;
  border: 1px solid rgba(96, 165, 250, 0.22) !important;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28) !important;
}

.app-container.night-mode :deep(.dir-btn:hover) {
  background: rgba(37, 99, 235, 0.28) !important;
}

.app-container.night-mode :deep(.field-hint:not(.placeholder)) {
  color: #fcd34d !important;
}

.app-container.night-mode :deep(.smart-status.active) {
  background: rgba(37, 99, 235, 0.28) !important;
  border-color: rgba(96, 165, 250, 0.36) !important;
  color: #bfdbfe !important;
}

.app-container.night-mode :deep(.smart-status.success),
.app-container.night-mode :deep(.status-badge.online) {
  background: rgba(6, 95, 70, 0.28) !important;
  border-color: rgba(52, 211, 153, 0.22) !important;
  color: #a7f3d0 !important;
}

.app-container.night-mode :deep(.smart-status.error),
.app-container.night-mode :deep(.status-badge.offline),
.app-container.night-mode :deep(.btn-ai.active) {
  background: rgba(127, 29, 29, 0.28) !important;
  border-color: rgba(248, 113, 113, 0.22) !important;
  color: #fecaca !important;
}

.app-container.night-mode :deep(.smart-status.warning),
.app-container.night-mode :deep(.smart-message.warning),
.app-container.night-mode :deep(.ota-result) {
  background: rgba(120, 53, 15, 0.26) !important;
  border-color: rgba(245, 158, 11, 0.24) !important;
  color: #fde68a !important;
}

.app-container.night-mode :deep(.status-badge) {
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.app-container.night-mode :deep(.color-box),
.app-container.night-mode :deep(.lux-display),
.app-container.night-mode :deep(.zone-order-row span) {
  border-color: rgba(148, 163, 184, 0.22) !important;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.22) !important;
}

.app-container.night-mode :deep(.store-stage) {
  background: rgba(2, 6, 23, 0.78) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
}

.app-container.night-mode :deep(.store-bg) {
  filter: blur(2px) brightness(0.58) saturate(0.82) !important;
}

.app-container.night-mode :deep(.zone-box) {
  background: rgba(37, 99, 235, 0.2) !important;
  border-color: rgba(96, 165, 250, 0.72) !important;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36) !important;
}

.app-container.night-mode :deep(.zone-name-input),
.app-container.night-mode :deep(.zone-count),
.app-container.night-mode :deep(.lamp-node) {
  background: rgba(15, 23, 42, 0.9) !important;
  border-color: rgba(148, 163, 184, 0.3) !important;
  color: rgba(248, 250, 252, 0.96) !important;
}

.app-container.night-mode :deep(.lamp-node.active),
.app-container.night-mode :deep(.lamp-node.selected) {
  border-color: rgba(251, 191, 36, 0.92) !important;
  box-shadow:
    0 0 0 5px rgba(251, 191, 36, 0.18),
    0 18px 44px rgba(0, 0, 0, 0.46) !important;
}

/* 夜间模式：内容层禁止使用模糊/毛玻璃，避免整页发糊 */
.app-container.night-mode,
.app-container.night-mode .main-content,
.app-container.night-mode :deep(.sidebar),
.app-container.night-mode :deep(.env-card),
.app-container.night-mode :deep(.lamp-card),
.app-container.night-mode :deep(.settings-card),
.app-container.night-mode :deep(.placeholder-card),
.app-container.night-mode :deep(.empty-block),
.app-container.night-mode :deep(.scan-panel),
.app-container.night-mode :deep(.scan-item),
.app-container.night-mode :deep(.chart-card),
.app-container.night-mode :deep(.info-card),
.app-container.night-mode :deep(#controls),
.app-container.night-mode :deep(.layout-card),
.app-container.night-mode :deep(.light-effect-mini-card),
.app-container.night-mode :deep(.smart-config-section),
.app-container.night-mode :deep(.smart-card),
.app-container.night-mode :deep(.direction-pad),
.app-container.night-mode :deep(.preset-btn),
.app-container.night-mode :deep(.slider-card),
.app-container.night-mode :deep(.flow-card),
.app-container.night-mode :deep(.flow-data-item),
.app-container.night-mode :deep(.flow-chart-box),
.app-container.night-mode :deep(.firmware-section),
.app-container.night-mode :deep(.firmware-info-item),
.app-container.night-mode :deep(.detail-info-item),
.app-container.night-mode :deep(.readonly-item) {
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.app-container.night-mode :deep(.smart-message.success) {
  background: rgba(6, 95, 70, 0.22) !important;
  color: #a7f3d0 !important;
}

.app-container.night-mode :deep(.smart-message.error) {
  background: rgba(127, 29, 29, 0.22) !important;
  color: #fecaca !important;
}

.app-container.night-mode .current-time {
  color: rgba(248, 250, 252, 0.96);
}

.app-container.night-mode .weather-status-row {
  color: rgba(226, 232, 240, 0.82);
}

.app-container.night-mode .weather-svg-icon {
  color: rgba(226, 232, 240, 0.85);
}

.app-container.night-mode .weather-svg-icon .sun-core,
.app-container.night-mode .weather-svg-icon .sun-rays,
.app-container.night-mode .weather-svg-icon .weather-sun-small {
  color: #fbbf24;
  stroke: #fbbf24;
}

.app-container.night-mode .weather-svg-icon .sun-core {
  fill: rgba(251, 191, 36, 0.2);
}

.app-container.night-mode .weather-svg-icon .cloud-shape {
  color: rgba(226, 232, 240, 0.85);
  fill: rgba(226, 232, 240, 0.1);
}

.app-container.night-mode .weather-svg-icon .rain-lines {
  color: #60a5fa;
}

.app-container.night-mode .weather-svg-icon .snow-marks {
  color: #bfdbfe;
}

.app-container.night-mode .weather-svg-icon .fog-lines {
  color: rgba(203, 213, 225, 0.78);
}

.app-container.night-mode .weather-svg-icon .thunder-bolt path {
  color: #fde047;
  fill: rgba(253, 224, 71, 0.22);
}
.scan-panel-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

.scan-empty {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
}

.scan-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.scan-item {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px 16px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.scan-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.12);
}

.scan-item-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #334155;
  font-size: 15px;
  line-height: 1.5;
}

.scan-item-info div:first-child {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.scan-add-btn {
  align-self: flex-start;
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.scan-add-btn:hover {
  transform: translateY(-1px);
  opacity: 0.96;
}

.scan-add-btn:active {
  transform: translateY(0);
}

.scan-add-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.scan-item-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.scan-cancel-btn {
  align-self: flex-start;
  padding: 10px 18px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
}

.scan-cancel-btn:hover {
  transform: translateY(-1px);
  border-color: #94a3b8;
  opacity: 0.96;
}

.scan-panel {
  position: relative;
  overflow: hidden;
  margin: 20px 0 24px;
  padding: 20px 22px;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 22px;
  box-shadow:
    0 12px 40px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(226, 232, 240, 0.9);
  backdrop-filter: blur(18px) saturate(1.08);
  -webkit-backdrop-filter: blur(18px) saturate(1.08);
}

.scan-panel.scanning::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(115deg, transparent 0%, rgba(59, 130, 246, 0.08) 44%, transparent 58%);
  transform: translateX(-100%);
  animation: scanPanelSweep 2.6s ease-in-out infinite;
}

.scan-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.scan-panel-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.02em;
}

.scan-clear-btn {
  padding: 8px 14px;
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.scan-clear-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.scan-clear-btn:active {
  transform: scale(0.965);
}

.scan-progress {
  margin: -4px 0 14px;
}

.scan-progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.52);
}

.scan-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #2563eb);
  box-shadow: 0 0 18px rgba(37, 99, 235, 0.38);
  transition: width 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

.scan-empty {
  min-height: 92px;
  display: grid;
  align-items: center;
  justify-content: center;
  justify-items: center;
  gap: 10px;
  color: #64748b;
  background: rgba(248, 250, 252, 0.9);
  border: 1px dashed #cbd5e1;
  border-radius: 18px;
}

.scan-radar {
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, rgba(59, 130, 246, 0.26) 0 4px, transparent 5px),
    repeating-radial-gradient(circle at center, rgba(59, 130, 246, 0.14) 0 1px, transparent 1px 15px);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.18);
}

.scan-radar::before,
.scan-radar::after {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  border: 1px solid rgba(37, 99, 235, 0.18);
}

.scan-radar::after {
  inset: 18px;
}

.scan-radar-sweep {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: conic-gradient(from 0deg, rgba(37, 99, 235, 0.4), rgba(37, 99, 235, 0.04) 38%, transparent 39%);
  animation: scanRadarSweep 1.25s linear infinite;
}

.scan-list {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.scan-item {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px 16px;
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.98) 0%, rgba(238, 246, 255, 0.98) 100%);
  border: 1px solid rgba(219, 234, 254, 0.95);
  border-radius: 18px;
  box-shadow:
    0 8px 24px rgba(59, 130, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.scan-item:hover {
  transform: translateY(-2px);
  box-shadow:
    0 14px 30px rgba(59, 130, 246, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.ios-card-enter-active {
  transition:
    opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ios-card-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.ios-card-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

.ios-card-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.ios-card-move {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes scanPanelSweep {
  0% {
    transform: translateX(-105%);
  }
  55%, 100% {
    transform: translateX(105%);
  }
}

@keyframes scanRadarSweep {
  to {
    transform: rotate(360deg);
  }
}

.scan-item-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #334155;
  font-size: 15px;
  line-height: 1.5;
}

.scan-item-info div:first-child {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.scan-item-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.scan-add-btn,
.scan-cancel-btn,
#controls > button,
.btn-confirm,
.btn-cancel {
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: center;
}

.scan-add-btn:active,
.scan-cancel-btn:active,
#controls > button:active,
.btn-confirm:active,
.btn-cancel:active {
  transform: scale(0.965);
}

.scan-add-btn {
  align-self: flex-start;
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
}

.scan-add-btn:hover {
  transform: translateY(-1px);
  opacity: 0.97;
}

.scan-cancel-btn {
  align-self: flex-start;
  padding: 10px 18px;
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.scan-cancel-btn:hover {
  transform: translateY(-1px);
  opacity: 0.97;
}

/* iOS 风格：扫描面板 */
.ios-panel-enter-active {
  transition:
    opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 420ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform, filter;
}

.ios-panel-leave-active {
  transition:
    opacity 260ms cubic-bezier(0.4, 0, 1, 1),
    transform 260ms cubic-bezier(0.4, 0, 1, 1),
    filter 260ms cubic-bezier(0.4, 0, 1, 1);
  will-change: opacity, transform, filter;
}

.ios-panel-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.965);
  filter: blur(8px);
}

.ios-panel-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.ios-panel-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.ios-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(6px);
}

.text-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
}
.settings-half-card,
.settings-full-card {
  position: relative;
  z-index: 1;
}

.settings-half-card:focus-within,
.settings-full-card:focus-within {
  z-index: 50;
}

.main-content {
  min-height: 100vh;
  margin-left: 228px;
  width: auto;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 24px 24px 48px 0;
  overflow-x: hidden;
}

.store-layout-row {
  display: grid;
  grid-template-columns: minmax(320px, 0.75fr) minmax(520px, 1.55fr);
  gap: 20px;
  align-items: stretch;
  margin: 20px 0 28px;
}

.store-layout-row > * {
  min-width: 0;
}

.store-effect-mini {
  width: 100%;
  height: 100%;
}

.store-layout-main {
  min-width: 0;
  height: 100%;
}

@media (max-width: 1360px) {
  .store-layout-row {
    grid-template-columns: minmax(340px, 0.95fr) minmax(460px, 1.15fr);
  }
}

@media (max-width: 1180px) {
  .store-layout-row {
    grid-template-columns: 1fr;
  }

  .store-effect-mini {
    position: static;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .main-content {
    width: 100%;
    margin-left: 0;
    min-width: 0;
    max-width: 100%;
    padding: 12px 18px;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .page-switcher {
    --page-push-distance: calc(100vh - 90px);
    --page-switch-height: calc(100vh - 90px);
    min-height: calc(100vh - 90px);
  }

  .tab-page-next-enter-from {
    transform: translateX(100vw);
  }

  .tab-page-next-leave-to {
    transform: translateX(-100vw);
  }

  .tab-page-prev-enter-from {
    transform: translateX(-100vw);
  }

  .tab-page-prev-leave-to {
    transform: translateX(100vw);
  }

  .dashboard-top-status {
    margin-bottom: 6px;
  }

  .current-time {
    font-size: 1.4rem;
  }

  .weather-status-row {
    margin-top: 4px;
    gap: 6px;
    font-size: 12px;
  }

  .weather-svg-icon {
    width: 28px;
    height: 28px;
  }

  .weather-svg-icon svg {
    width: 28px;
    height: 28px;
  }

  .section-space-top {
    margin-top: 6px;
  }

  .env-layout {
    gap: 0;
    margin-bottom: 12px;
  }

  .env-card {
    min-width: 0;
    flex: 1 1 100%;
    padding: 12px 14px;
  }

  .env-card:first-child {
    border-radius: 14px 14px 0 0;
    padding-bottom: 8px;
  }

  .env-card:last-child {
    display: flex;
    align-items: center;
    border-radius: 0 0 14px 14px;
    border-top: 1px solid rgba(203, 213, 225, 0.5);
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .env-card h4 {
    margin: 0 0 8px;
    font-size: 15px;
  }

  .env-card:last-child h4 {
    display: none;
  }

  .stat-grid {
    gap: 0;
    flex-wrap: nowrap;
    justify-content: space-between;
  }

  .stat-item {
    flex: 1 1 0;
    min-width: 0;
    padding: 4px 8px;
    border-right: 1px solid rgba(203, 213, 225, 0.52);
    text-align: center;
  }

  .stat-item:first-child {
    padding-left: 0;
  }

  .stat-item:last-child {
    padding-right: 0;
    border-right: none;
  }

  .stat-label {
    font-size: 10px;
    margin-bottom: 2px;
  }

  .stat-value {
    font-size: 13px;
  }

  .meta-grid {
    display: flex;
    flex: 2 2 0;
    gap: 0;
    margin-bottom: 0;
  }

  .meta-item {
    flex: 1 1 0;
    padding: 4px 8px;
    text-align: center;
    border-right: 1px solid rgba(203, 213, 225, 0.4);
  }

  .lux-display {
    flex: 1 1 0;
    margin-top: 0;
    padding: 4px 8px;
    min-height: 0;
    background: transparent;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    text-align: center;
    border-right: none;
  }

  .lux-label {
    display: block;
    font-weight: 400;
    line-height: 1.2;
  }

  .lux-label-web {
    display: none;
  }

  .lux-label-mobile {
    display: block;
    font-size: 10px;
    font-weight: 400;
    color: #64748b;
    line-height: 1.2;
    white-space: nowrap;
  }

  .lux-odometer-web {
    display: none;
  }

  .lux-odometer-mobile {
    display: inline-flex;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 800;
  }

  .page-section > h1 {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    font-size: 26px;
    z-index: 1;
  }

  #controls {
    gap: 8px;
    padding: 12px 14px;
    margin: 10px 0 18px;
    border-radius: 14px;
  }

  #controls > button {
    padding: 6px 10px;
    min-height: 30px;
    font-size: 11px;
    flex-shrink: 0;
  }

  #controls label {
    flex: 1 1 100%;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    gap: 3px;
    white-space: nowrap;
    width: auto;
  }

  #controls input {
    flex: 1 1 0;
    min-width: 60px;
    width: auto;
    height: 30px;
    font-size: 12px;
    padding: 0 6px;
  }

  #scanStatus {
    width: 100%;
    margin-left: 0;
    font-size: 12px;
  }

  .store-layout-row {
    gap: 10px;
    margin: 10px 0 16px;
  }

  .scan-panel {
    margin: 12px 0 16px;
    padding: 14px 16px;
    border-radius: 18px;
  }

  .scan-panel-title {
    font-size: 18px;
    margin-bottom: 10px;
  }

  .scan-panel-header {
    margin-bottom: 10px;
  }

  .scan-list {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .scan-item {
    padding: 12px 14px;
    gap: 10px;
    border-radius: 14px;
  }

  .scan-item-info {
    gap: 4px;
    font-size: 13px;
  }

  .scan-item-info div:first-child {
    font-size: 15px;
  }

  .scan-add-btn,
  .scan-cancel-btn {
    padding: 8px 14px;
    font-size: 13px;
  }

  .scan-empty {
    min-height: 64px;
    font-size: 13px;
  }
}
@media (max-width: 900px) {
   .settings-row {
    grid-template-columns: 1fr;
  }

  .settings-half-card {
    position: relative;
  }

  .settings-half-card:focus-within {
    z-index: 80;
  }

  .settings-group-grid {
    grid-template-columns: 1fr;
  }

  .settings-group-card {
    margin-top: 18px;
  }

  .settings-group-title {
    font-size: 15px;
    margin-bottom: 14px;
    padding-bottom: 10px;
  }
}

/* 最终兜底：夜间模式内容层不允许模糊，背景图层除外 */
.app-container.night-mode,
.app-container.night-mode .main-content,
.app-container.night-mode :deep(.sidebar),
.app-container.night-mode :deep(.env-card),
.app-container.night-mode :deep(.lamp-card),
.app-container.night-mode :deep(.settings-card),
.app-container.night-mode :deep(.placeholder-card),
.app-container.night-mode :deep(.empty-block),
.app-container.night-mode :deep(.scan-panel),
.app-container.night-mode :deep(.scan-item),
.app-container.night-mode :deep(.chart-card),
.app-container.night-mode :deep(.info-card),
.app-container.night-mode :deep(#controls),
.app-container.night-mode :deep(.layout-card),
.app-container.night-mode :deep(.light-effect-mini-card),
.app-container.night-mode :deep(.smart-config-section),
.app-container.night-mode :deep(.smart-card),
.app-container.night-mode :deep(.direction-pad),
.app-container.night-mode :deep(.preset-btn),
.app-container.night-mode :deep(.slider-card),
.app-container.night-mode :deep(.flow-card),
.app-container.night-mode :deep(.flow-data-item),
.app-container.night-mode :deep(.flow-chart-box),
.app-container.night-mode :deep(.firmware-section),
.app-container.night-mode :deep(.firmware-info-item),
.app-container.night-mode :deep(.detail-info-item),
.app-container.night-mode :deep(.readonly-item) {
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
</style>
