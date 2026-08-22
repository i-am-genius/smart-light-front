<template>
  <div class="app-container" :class="{ 'night-mode': storeSettings.isNightMode }">
    <SidebarNav v-model="activeTab" />

    <div class="main-content">
      <div
        class="page-switcher"
        :class="{ 'is-switching': pageSwitching }"
        :style="pageSwitcherStyle"
        @touchstart="onSwipeTouchStart"
        @touchmove="onSwipeTouchMove"
        @touchend="onSwipeTouchEnd"
      >
      <Transition
        :name="pageTransitionName"
        @before-leave="measurePagePushDistance"
        @before-enter="beginPageSwitch"
      >
      <section
        v-if="mountedTabs.has('main')"
        v-show="activeTab === 'main'"
        key="main"
        class="page-section"
      >
        <TopStatusBar
          :current-time="currentTime"
          :week-info="weekInfo"
          :date-info="dateInfo"
          :weather-text="weatherText"
          :weather-icon-type="topBarWeatherIcon"
          :weather-intensity="topBarWeatherIntensity"
        />

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

        <h1>视界随光</h1>

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
            <span>{{ connectionStatusText }}</span>
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

          <div class="layout-card store-layout-main">
            <div class="layout-header">
              <div>
                <h2>店铺灯具布局</h2>
              </div>
            </div>
            <div class="three-layout-mvp-panel">
              <ThreeLightingLayout
                v-model:active-zone-id="activeZoneId"
                :devices="devices"
                :zones="zoneDefinitions"
                :active="activeTab === 'main'"
                :zone-management-pending="zoneManagementPending || deviceMutationPending"
                @zone-add="handleZoneAdd"
                @zone-delete="handleZoneDelete"
                @zone-move="handleZoneMove"
                @swap-device-numbers="handleDeviceNumberSwap"
              />
            </div>
          </div>
        </div>

        <DeviceGrid
          :devices="devices"
          :zones="zoneDefinitions"
          :loading="loading"
          :deleting-id="deletingId"
          @refresh="loadDevices"
          @update-realtime="handleRealtimeUpdate"
          @delete="handleDeleteDevice"
        />

      </section>
      </Transition>

      <Transition
        :name="pageTransitionName"
        @before-leave="measurePagePushDistance"
        @before-enter="beginPageSwitch"
      >
      <section
        v-if="mountedTabs.has('flow')"
        v-show="activeTab === 'flow'"
        key="flow"
        class="page-section"
      >
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
      </Transition>

    <Transition
      :name="pageTransitionName"
      @before-leave="measurePagePushDistance"
      @before-enter="beginPageSwitch"
    >
    <section
      v-if="mountedTabs.has('settings')"
      v-show="activeTab === 'settings'"
      key="settings"
      class="page-section"
    >
      <div class="settings-layout">
        <StoreSettingsPanel
          v-model="storeSettings"
          :store-name="currentStoreName"
          @logout="handleLogout"
          @open-store-settings="goStoreSettings"
        />

        <div class="settings-group-card">
          <h2 class="settings-group-title">设备功能</h2>
          <div class="settings-group-grid settings-device-grid">
            <div class="settings-panel-slot">
              <ArmControlPanel
                :devices="devices"
              />
            </div>
            <div class="settings-panel-slot">
              <GarmentAimCalibrationPanel
                :devices="devices"
              />
            </div>
          </div>
        </div>

        <div class="settings-group-card">
          <h2 class="settings-group-title">数据分析</h2>
          <div class="settings-group-grid settings-data-grid">
            <div class="settings-panel-slot settings-flow-slot">
              <FlowMonitorPanel
                :devices="devices"
              />
            </div>
            <div class="settings-panel-slot settings-duration-slot">
              <DurationQueryPanel />
            </div>
          </div>
        </div>

        <div class="settings-smartconfig-bottom">
          <SmartConfigPanel />
        </div>
      </div>
    </section>
    </Transition>

    <Transition
      :name="pageTransitionName"
      @before-leave="measurePagePushDistance"
      @before-enter="beginPageSwitch"
    >
    <section
      v-if="mountedTabs.has('firmware')"
      v-show="activeTab === 'firmware'"
      key="firmware"
      class="page-section"
    >
      <FirmwareManagePanel />
    </section>
    </Transition>
      </div>

  <DeviceAddModal
    v-if="showAddDeviceModal"
    :submitting="creating"
    :initial-data="pendingScannedDevice"
    :zones="zoneDefinitions"
    :devices="devices"
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
import ThreeLightingLayout from '../components/device/ThreeLightingLayout.vue'
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
import { getPersonFlowRecent } from '../api/personFlow'
import { mergeCaptureTask } from '../utils/cameraCaptureTasks'
import type {
  DashboardTab,
  DeviceCreatePayload,
  DeviceItem,
  DeviceOnlineItem,
  GarmentState,
} from '../types/device'
import DurationQueryPanel from '../components/settings/DurationQueryPanel.vue'
import ArmControlPanel from '../components/settings/ArmControlPanel.vue'
import GarmentAimCalibrationPanel from '../components/settings/GarmentAimCalibrationPanel.vue'
import StoreSettingsPanel from '../components/settings/StoreSettingsPanel.vue'
import type { StoreSettingsValue } from '../components/settings/StoreSettingsPanel.vue'
import FlowOverview from '../components/flow/FlowOverview.vue'
import FirmwareManagePanel from '../components/firmware/FirmwareManagePanel.vue'
import OdometerRoll from '../components/common/OdometerRoll.vue'
import TopStatusBar from '../components/layout/TopStatusBar.vue'
import { regions } from '../constants/china-region'
import { STORE_STYLE_MAP } from '../constants/store'
import { getErrorMessage } from '../utils/error'
import { isLampDevice, normalizeDeviceType } from '../utils/device'
import {
  buildLampRealtimeUpdateEnvelope,
  mergeLampRealtimeDeviceState,
  normalizeGarmentState,
} from '../utils/garmentRecognition'
import { mergeDeviceListSnapshot } from '../utils/deviceListMerge'
import {
  FabricImageAssembler,
  type CompletedFabricImage,
} from '../utils/fabricImageBinary'
import {
  UNASSIGNED_ZONE_NAME,
  deriveZoneDefinitions,
  normalizeZoneName,
  type ZoneDefinition,
} from '../utils/deviceZones'
import {
  loadZoneDefinitions,
  removeStoredZoneLayout,
  saveZoneDefinitions,
} from '../utils/deviceZoneStorage'
import { migrateDevicesToZone, swapDeviceNumbers } from '../utils/deviceZoneMutations'
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
const mountedTabs = ref(new Set<DashboardTab>([activeTab.value]))
const dashboardTabOrder: DashboardTab[] = ['main', 'flow', 'settings', 'firmware']
const PAGE_PUSH_GAP_PX = 28
const PAGE_SWITCH_CLEANUP_DELAY_MS = 500
const pageTransitionName = ref('tab-page-next')
const pageSwitching = ref(false)
const pageNumberMotionReady = ref(true)
const pagePushDistance = ref(0)
const pageSwitchHeight = ref(0)
const tabScrollPositions = new Map<DashboardTab, number>()
let pendingTabScrollTop = 0
let pageSwitchCleanupTimer: number | null = null
let pageSwitchGeneration = 0
const devices = ref<DeviceItem[]>([])
const initialDevicesLoaded = ref(false)
const fabricImageCapabilityDeclared = ref(false)
const assembler = new FabricImageAssembler()
let fabricImageCleanupTimer: number | null = null
const zoneDefinitions = ref<ZoneDefinition[]>(loadZoneDefinitions())
const activeZoneId = ref('')
const zoneManagementPending = ref(false)
const deviceMutationPending = ref(false)
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
  const token = (localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN') || '').trim()
  return token ? ['smartlight.v1', token] : []
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
  window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack)
  fabricImageCleanupTimer = window.setInterval(() => {
    assembler.clearExpired()
  }, 5_000)
  const ok = await loadCurrentStore()
  if (!ok) return
  window.addEventListener('person-flow-updated', handlePersonFlowUpdatedEvent)
  await loadDevices()
  void loadPeopleCount()
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
  const camDevice = devices.value.find(d => normalizeDeviceType(d.deviceType) === 'cam' && d.chipId)
  const legacyCamLampDevice = devices.value.find(d => normalizeDeviceType(d.deviceType) === 'camlamp' && d.chipId)
  return camDevice?.chipId || legacyCamLampDevice?.chipId
}

function hasRequiredFlowCache() {
  const chipId = getFlowChipId()
  const hasDuration = flowCache.value.durationSummary != null
  const hasLux = flowCache.value.luxTrend != null
  const hasChipTrend = !chipId || flowCache.value.tempPeopleTrend != null
  const hasStrategy = flowCache.value.strategyCompare != null
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
        getStrategyCompare(chipId),
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

const topBarWeatherIcon = computed<'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder' | undefined>(() => {
  const map: Record<WeatherIconType, 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'> = {
    'sunny': 'clear',
    'partly-cloudy': 'partly',
    'cloudy': 'cloudy',
    'rain': 'rain',
    'snow': 'snow',
    'fog': 'fog',
    'thunder': 'thunder',
  }
  return map[weatherIconType.value]
})

const topBarWeatherIntensity = computed<'light' | 'normal' | 'heavy'>(() => {
  // return 'normal'
  return mapOpenMeteoCodeToIntensity(envInfo.value.weatherCode)
})

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

function mapOpenMeteoCodeToIntensity(weatherCode?: number | null): 'light' | 'normal' | 'heavy' {
  const c = Number(weatherCode)
  // Drizzle / slight showers → light; moderate → normal; dense / heavy → heavy
  if ([51, 61, 80].includes(c)) return 'light'
  if ([55, 65, 82].includes(c)) return 'heavy'
  if ([53, 63, 81].includes(c)) return 'normal'
  // Snow: 71 light, 73 normal, 75 heavy, 77 (grains) normal
  if (c === 71) return 'light'
  if (c === 75) return 'heavy'
  if ([73, 77].includes(c)) return 'normal'
  // Thunder: 95 normal, 96/99 with hail → heavy
  if (c === 95) return 'normal'
  if ([96, 99].includes(c)) return 'heavy'
  return 'normal'
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
      if (!isLampDevice(device) || !device.autoMode) continue

      const nextPayload: DeviceCreatePayload = {
        chipId: device.chipId || '',
        ip: device.ip || '',
        displayName: device.displayName || '',
        brightness: device.brightness ?? 50,
        temp: device.temp ?? 4000,
        autoMode: device.autoMode ?? false,
        garmentAimEnabled: device.garmentAimEnabled ?? false,
        garmentDefaultPan: device.garmentDefaultPan ?? 0,
        garmentDefaultTilt: device.garmentDefaultTilt ?? 20,
        personDefaultPan: device.personDefaultPan ?? 0,
        personDefaultTilt: device.personDefaultTilt ?? -30,
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
  if (!mountedTabs.value.has(tab)) {
    mountedTabs.value = new Set(mountedTabs.value).add(tab)
  }

  const nextIndex = dashboardTabOrder.indexOf(tab)
  const oldIndex = dashboardTabOrder.indexOf(oldTab)
  pageTransitionName.value = oldIndex >= 0 && nextIndex < oldIndex ? 'tab-page-prev' : 'tab-page-next'
  if (oldTab && tab !== oldTab) {
    tabScrollPositions.set(oldTab, window.scrollY)
    pendingTabScrollTop = tabScrollPositions.get(tab) ?? 0
    pageNumberMotionReady.value = false
  }

  if (tab === 'flow') {
    void preloadFlowData(false)
  }
})

function beginPageSwitch(el: Element) {
  pageNumberMotionReady.value = false
  applyPendingTabScroll(el)
  if (pagePushDistance.value <= 0) {
    const viewportDistance = getViewportPagePushDistance()
    pageSwitchHeight.value = viewportDistance
    pagePushDistance.value = viewportDistance
  }
  pageSwitching.value = true
  schedulePageSwitchCleanup()
}

function schedulePageSwitchCleanup() {
  pageSwitchGeneration += 1
  const generation = pageSwitchGeneration
  if (pageSwitchCleanupTimer !== null) {
    window.clearTimeout(pageSwitchCleanupTimer)
    pageSwitchCleanupTimer = null
  }
  requestAnimationFrame(() => {
    if (generation !== pageSwitchGeneration) return
    requestAnimationFrame(() => {
      if (generation !== pageSwitchGeneration) return
      pageSwitchCleanupTimer = window.setTimeout(() => {
        if (generation !== pageSwitchGeneration) return
        endPageSwitch()
      }, PAGE_SWITCH_CLEANUP_DELAY_MS)
    })
  })
}

function endPageSwitch() {
  pageSwitchCleanupTimer = null
  pageSwitching.value = false
  pagePushDistance.value = 0
  pageSwitchHeight.value = 0
  pageNumberMotionReady.value = true
}

// ── Mobile swipe to switch tabs ──
const PAGE_SWIPE_BLOCK_SELECTOR = [
  'input, select, textarea, button, a',
  '[role="slider"], [role="switch"]',
  '[data-page-swipe-lock]',
].join(', ')
let swipeStartX = 0
let swipeStartY = 0
let swipeStartTime = 0
let swipeTracking = false

function shouldBlockPageSwipe(target: EventTarget | null) {
  if (!target || typeof (target as Element).closest !== 'function') return false
  return Boolean((target as Element).closest(PAGE_SWIPE_BLOCK_SELECTOR))
}

function onSwipeTouchStart(e: TouchEvent) {
  swipeTracking = false
  if (pageSwitching.value || e.touches.length !== 1) return
  if (shouldBlockPageSwipe(e.target)) return
  const touch = e.touches[0]
  swipeStartX = touch.clientX
  swipeStartY = touch.clientY
  swipeStartTime = Date.now()
  swipeTracking = true
}

function onSwipeTouchMove(e: TouchEvent) {
  if (!swipeTracking) return
  const touch = e.touches[0]
  const dx = Math.abs(touch.clientX - swipeStartX)
  const dy = Math.abs(touch.clientY - swipeStartY)
  // If vertical movement dominates, cancel swipe tracking (allow scroll)
  if (dy > dx * 1.2) {
    swipeTracking = false
  }
}

function onSwipeTouchEnd(e: TouchEvent) {
  if (!swipeTracking) return
  swipeTracking = false
  const touch = e.changedTouches[0]
  const dx = touch.clientX - swipeStartX
  const dy = Math.abs(touch.clientY - swipeStartY)
  const elapsed = Date.now() - swipeStartTime

  // Require minimum distance, prefer horizontal, and be quick enough
  const SWIPE_THRESHOLD = 50
  const SWIPE_MAX_TIME = 400
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < dy || elapsed > SWIPE_MAX_TIME) return

  const currentIndex = dashboardTabOrder.indexOf(activeTab.value)
  if (dx < 0 && currentIndex < dashboardTabOrder.length - 1) {
    // Swipe left → next tab
    activeTab.value = dashboardTabOrder[currentIndex + 1]
  } else if (dx > 0 && currentIndex > 0) {
    // Swipe right → previous tab
    activeTab.value = dashboardTabOrder[currentIndex - 1]
  }
}

const NATIVE_BACK_EVENT = 'smartlight-native-back'
const NATIVE_BACK_CLOSE_SELECTOR = [
  '.device-detail-overlay .detail-close-btn',
  '.modal-overlay .btn-cancel',
  '.effect-modal-overlay .modal-close-btn',
  '.detect-lightbox-overlay .detect-lightbox-close',
  '.calibration-modal-backdrop .modal-close',
  '.region-mask .region-close',
].join(', ')

function findVisibleModalCloseButton() {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>(NATIVE_BACK_CLOSE_SELECTOR))
  return buttons.reverse().find(button => button.getClientRects().length > 0) || null
}

function handleNativeBack(event: Event) {
  const modalCloseButton = findVisibleModalCloseButton()
  if (modalCloseButton) {
    event.preventDefault()
    modalCloseButton.click()
    return
  }

  if (activeTab.value !== 'main') {
    event.preventDefault()
    activeTab.value = 'main'
    void router.replace({
      query: {
        ...route.query,
        tab: 'main',
      },
    })
  }
}

function getViewportPagePushDistance() {
  const mainContent = document.querySelector('.main-content')
  const rect = mainContent?.getBoundingClientRect()
  const top = Math.max(rect?.top ?? 0, 0)
  return Math.max(window.innerHeight - top, 1)
}

function getPageMaxScroll(el: Element) {
  const section = el as HTMLElement
  const mainContent = document.querySelector<HTMLElement>('.main-content')
  const mainRect = mainContent?.getBoundingClientRect()
  const mainTop = Math.max(mainRect?.top ?? 0, 0)
  const mainStyle = mainContent ? window.getComputedStyle(mainContent) : null
  const paddingBottom = mainStyle ? Number.parseFloat(mainStyle.paddingBottom || '0') || 0 : 0
  const pageBottom = mainTop + section.scrollHeight + paddingBottom

  return Math.max(pageBottom - window.innerHeight, 0)
}

function applyPendingTabScroll(el: Element) {
  const targetTop = Math.min(Math.max(pendingTabScrollTop, 0), getPageMaxScroll(el))
  window.scrollTo(0, targetTop)
}

function measurePagePushDistance(el: Element) {
  const section = el as HTMLElement
  const sectionRect = section.getBoundingClientRect()
  const baseDistance = getViewportPagePushDistance()
  pageSwitchHeight.value = baseDistance

  // Use section bottom relative to viewport — avoids per-element getBoundingClientRect
  const sectionBottom = sectionRect.bottom
  const viewportBottom = window.innerHeight
  const distance = Math.max(baseDistance, sectionBottom > viewportBottom ? viewportBottom - sectionRect.top : baseDistance)

  pagePushDistance.value = Math.ceil(distance + PAGE_PUSH_GAP_PX)
}

function normalizeChipId(value?: string) {
  return String(value || '').trim().toUpperCase()
}

// ── 统一设备唯一键 ──
// 优先级：chipId > deviceId > id
// 不要只用 id，因为扫描出来的设备可能还没有数据库 id
function getDeviceKey(device: Partial<DeviceItem> & { deviceId?: string | number }): string {
  const chipId = (device as any).chipId
  const deviceId = (device as any).deviceId
  const id = (device as any).id
  // chipId 和 deviceId 都做 trim + toUpperCase，避免大小写/空格导致同一设备出现多条
  if (chipId != null && String(chipId).trim() !== '') return normalizeChipId(chipId)
  if (deviceId != null && String(deviceId).trim() !== '') return String(deviceId).trim().toUpperCase()
  if (id != null && String(id).trim() !== '') return String(id).trim()
  return ''
}

const garmentAiKeys: Array<keyof DeviceItem> = [
  'resultVersion',
  'clothDetected',
  'segmentationFallback',
  'outfitType',
  'garments',
  'fabric',
  'label',
  'mainColorRgb',
]

const normalizedGarmentKeys: Array<keyof DeviceItem> = [
  'resultVersion',
  'clothDetected',
  'segmentationFallback',
  'outfitType',
  'garments',
]

function hasExplicitGarmentData(source: Partial<DeviceItem>): boolean {
  return garmentAiKeys.some(key => Object.prototype.hasOwnProperty.call(source, key))
}

function normalizeGarmentIncoming<T extends Partial<DeviceItem>>(source: T): T & Partial<DeviceItem> {
  if (!hasExplicitGarmentData(source)) return source

  const incoming: Partial<DeviceItem> = { ...source }
  for (const key of normalizedGarmentKeys) {
    delete incoming[key]
  }

  return {
    ...incoming,
    ...normalizeGarmentState(source),
  } as T & Partial<DeviceItem>
}

function syncZoneDefinitions() {
  const next = deriveZoneDefinitions(zoneDefinitions.value, devices.value)
  const unchanged = next.length === zoneDefinitions.value.length && next.every((zone, index) => (
    zone.id === zoneDefinitions.value[index]?.id && zone.name === zoneDefinitions.value[index]?.name
  ))
  if (unchanged) return

  zoneDefinitions.value = next
  saveZoneDefinitions(next)
}

// ── 服务端全量列表合并（用于 loadDevices / silentRefreshDeviceList）──
// 服务端返回的列表是权威的：不在列表中的设备会被移除，本地额外字段保留
function mergeDeviceList(list: DeviceItem[]) {
  const map = new Map<string, DeviceItem>()

  for (const device of list) {
    const key = getDeviceKey(device)
    if (!key) continue

    // 查找本地已有设备，保留服务端可能不返回的字段
    const existing = devices.value.find(item => getDeviceKey(item) === key)
    const normalizedDevice = normalizeGarmentIncoming(device)
    map.set(key, mergeDeviceListSnapshot(existing, device, normalizedDevice))
  }

  // 不在服务端列表中的旧设备自动移除
  const nextDevices = Array.from(map.values())
  const nextKeys = new Set(nextDevices.map(device => getDeviceKey(device)))
  devices.value.forEach(device => {
    if (!nextKeys.has(getDeviceKey(device))) {
      releaseFabricImageBlobUrl(device)
    }
  })
  devices.value = nextDevices
  syncZoneDefinitions()
}

// ── 单设备 upsert（用于 WebSocket 推送 / 添加设备）──
// 只合并或追加，不删除其他设备
function upsertDevice(device: DeviceItem) {
  const key = getDeviceKey(device)
  if (!key) return

  const index = devices.value.findIndex(item => getDeviceKey(item) === key)
  if (index >= 0) {
    devices.value[index] = { ...devices.value[index], ...device }
  } else {
    devices.value.push(device)
  }
  syncZoneDefinitions()
}

// ── 静默刷新：不显示 loading，不闪烁 ──
async function silentRefreshDeviceList() {
  try {
    const [deviceList, onlineList] = await Promise.all([
      getMyDeviceListApi(),
      getOnlineList(),
    ])
    mergeDeviceList(mergeDeviceOnline(deviceList, onlineList))

    if (!scanning.value) {
      scanStatus.value = `已加载 ${devices.value.length} 台设备`
    }

    await loadLatestLux()
  } catch (error) {
    console.error('silentRefreshDeviceList error =', error)
  }
}

async function refreshDeviceListStrict() {
  const [deviceList, onlineList] = await Promise.all([
    getMyDeviceListApi(),
    getOnlineList(),
  ])
  mergeDeviceList(mergeDeviceOnline(deviceList, onlineList))
}

function mergeDeviceOnline(deviceList: DeviceItem[], onlineList: DeviceOnlineItem[]) {
  const onlineMap = new Map(
    (onlineList || []).map(item => [normalizeChipId(item.chipId), item]),
  )

  return (deviceList || []).map(device => {
    const onlineInfo = onlineMap.get(normalizeChipId(device.chipId))
    const online = onlineInfo?.online === true

    return {
      ...device,
      online,
      lastSeen: onlineInfo?.lastSeen ?? device.lastSeen,
      lastSeenAt: onlineInfo?.lastSeenAt || device.lastSeenAt,
      ip: onlineInfo?.ip || device.ip,
      selfTestJson: online ? device.selfTestJson : undefined,
      selfTestTime: online ? device.selfTestTime : undefined,
      garmentDetectionStatus: onlineInfo?.garmentDetectionStatus ?? device.garmentDetectionStatus,
      lampProximityState: online && onlineInfo?.nearby != null
        ? { chipId: device.chipId, nearby: onlineInfo.nearby }
        : undefined,
      lastTakenAt: onlineInfo?.lastTakenAt ?? device.lastTakenAt,
      trackingStatus: onlineInfo?.trackingStatus
        ? {
            ...device.trackingStatus,
            chipId: device.chipId,
            status: onlineInfo.trackingStatus,
          }
        : device.trackingStatus,
    }
  })
}

async function loadDevices() {
  // 只有首次进入且列表为空时才显示 loading，避免刷新闪烁
  const isFirstLoad = devices.value.length === 0
  if (isFirstLoad) {
    loading.value = true
  }
  if (!scanning.value && !scanFinished.value) {
    scanStatus.value = isFirstLoad ? '加载中...' : scanStatus.value
  }

  try {
    const [deviceList, onlineList] = await Promise.all([
      getMyDeviceListApi(),
      getOnlineList(),
    ])

    // 静默合并，不清空列表，不闪烁
    mergeDeviceList(mergeDeviceOnline(deviceList, onlineList))
    initialDevicesLoaded.value = true

    if (!scanning.value) {
      scanStatus.value = `已加载 ${devices.value.length} 台设备`
    }

    await loadLatestLux()
  } catch (error) {
    console.error('loadDevices error =', error)
    if (isFirstLoad) {
      scanStatus.value = '设备加载失败'
    }
  } finally {
    if (isFirstLoad) {
      loading.value = false
    }
  }
}

async function loadPeopleCount() {
  try {
    const records = await getPersonFlowRecent(1)
    if (records.length > 0) {
      envInfo.value.people = records[0].personCount || 0
    } else {
      envInfo.value.people = 0
    }
  } catch {
    console.warn('Failed to load people count for realtime overview')
  }
}

function handlePersonFlowUpdatedEvent(event: Event) {
  const detail = event instanceof CustomEvent ? event.detail : null
  const count = Number(detail?.personCount ?? detail?.count)
  if (Number.isFinite(count)) {
    envInfo.value.people = Math.max(0, count)
    return
  }

  void loadPeopleCount()
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

    // 使用 upsert 而非 push，避免与 WebSocket / 接口刷新产生重复
    const isLampLike = isLampDevice({ deviceType: payload.deviceType })
    upsertDevice({
      id: Number(result),
      chipId: payload.chipId || '',
      ip: payload.ip || '',
      displayName: payload.displayName || '',
      deviceType: payload.deviceType || '',
      deviceNo: payload.deviceNo || '',
      ...(isLampLike
        ? {
            brightness: payload.brightness ?? 50,
            temp: payload.temp ?? 4000,
            autoMode: payload.autoMode ?? false,
            garmentAimEnabled: payload.garmentAimEnabled ?? false,
            recommendedBrightness: payload.recommendedBrightness ?? 50,
            recommendedTemp: payload.recommendedTemp ?? 4000,
            fabric: payload.fabric || '',
            mainColorRgb: payload.mainColorRgb || '',
          }
        : {}),
      online: false,
    } as DeviceItem)

    // 后台静默同步一次，不闪烁
    await silentRefreshDeviceList()
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

const updateTimerMap = new Map<string, RealtimeUpdateState>()
const exclusivelyMutatingDeviceIds = new Set<string>()

type RealtimeUpdateRequest = {
  id: number
  payload: DeviceCreatePayload
  garmentState?: GarmentState
  lightControl?: boolean
}

function handleRealtimeUpdate({ id, payload, garmentState, lightControl }: RealtimeUpdateRequest) {
  const realtimeUpdate = buildLampRealtimeUpdateEnvelope({
    id,
    payload,
    garmentState,
    lightControl,
  })
  const safePayload = realtimeUpdate.payload
  const deviceKey = String(id)
  if (exclusivelyMutatingDeviceIds.has(String(id))) {
    toast.show('设备信息正在更新，请稍后再试', 'error')
    return
  }

  const deviceIndex = devices.value.findIndex(item => String(item.id) === String(id))
  if (deviceIndex >= 0) {
    devices.value[deviceIndex] = mergeLampRealtimeDeviceState(
      devices.value[deviceIndex],
      realtimeUpdate,
    )
  }

  let state = updateTimerMap.get(deviceKey)
  if (!state) {
    state = {
      version: 0,
      inFlight: false,
      flushAfterFlight: false,
      payload: safePayload,
      lightControl,
    }
    updateTimerMap.set(deviceKey, state)
  }

  state.version += 1
  state.payload = safePayload
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

async function flushRealtimeUpdate(id: number | string, version: number) {
  const deviceKey = String(id)
  const state = updateTimerMap.get(deviceKey)
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
      updateTimerMap.delete(deviceKey)
    }
  }
}

type ZoneMutationTarget = {
  zoneId: string
  zoneName: string
}

type ZoneMoveRequest = ZoneMutationTarget & {
  direction: -1 | 1
}

type DeviceNumberSwapRequest = {
  firstDeviceId: string | number
  secondDeviceId: string | number
}

function handleZoneAdd(value: string) {
  const name = String(value || '').trim()
  if (!name || name === UNASSIGNED_ZONE_NAME) return
  if (zoneDefinitions.value.some(zone => normalizeZoneName(zone.name) === normalizeZoneName(name))) {
    toast.show('分区名称已存在', 'error')
    return
  }

  const zone = { id: `zone-${Date.now()}-${zoneDefinitions.value.length + 1}`, name }
  zoneDefinitions.value = [...zoneDefinitions.value, zone]
  saveZoneDefinitions(zoneDefinitions.value)
  activeZoneId.value = zone.id
}

function handleZoneMove({ zoneId, direction }: ZoneMoveRequest) {
  const currentIndex = zoneDefinitions.value.findIndex(zone => zone.id === zoneId)
  const targetIndex = currentIndex + direction
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= zoneDefinitions.value.length) return

  const next = [...zoneDefinitions.value]
  const current = next[currentIndex]
  next[currentIndex] = next[targetIndex]
  next[targetIndex] = current
  zoneDefinitions.value = next
  saveZoneDefinitions(next)
}

function lockDeviceMutations(ids: Array<string | number>) {
  ids.forEach(id => exclusivelyMutatingDeviceIds.add(String(id)))
}

function unlockDeviceMutations(ids: Array<string | number>) {
  ids.forEach(id => exclusivelyMutatingDeviceIds.delete(String(id)))
}

async function flushRealtimeUpdatesFor(ids: Array<string | number>) {
  const deviceKeys = [...new Set(ids.map(String))]

  for (const deviceKey of deviceKeys) {
    while (updateTimerMap.has(deviceKey)) {
      const state = updateTimerMap.get(deviceKey)
      if (!state) break

      if (state.timer) {
        window.clearTimeout(state.timer)
        state.timer = undefined
      }

      if (state.inFlight) {
        await new Promise(resolve => window.setTimeout(resolve, 16))
        continue
      }

      await flushRealtimeUpdate(deviceKey, state.version)
    }
  }
}

async function handleZoneDelete({ zoneId, zoneName }: ZoneMutationTarget) {
  if (zoneManagementPending.value || deviceMutationPending.value) return
  if (normalizeZoneName(zoneName) === UNASSIGNED_ZONE_NAME) return
  if (!window.confirm(`确认删除分区「${zoneName}」吗？该分区灯具将移至未分区。`)) return

  const movingDevices = devices.value.filter(device => (
    isLampDevice(device) && normalizeZoneName(device.displayName) === normalizeZoneName(zoneName)
  ))
  const movingIds = movingDevices.map(device => device.id)
  zoneManagementPending.value = true
  lockDeviceMutations(movingIds)

  try {
    await flushRealtimeUpdatesFor(movingIds)
    const updatedDevices = await migrateDevicesToZone(
      movingDevices,
      devices.value,
      UNASSIGNED_ZONE_NAME,
      (id, payload) => updateDevice(id, payload),
    )
    updatedDevices.forEach(upsertDevice)

    zoneDefinitions.value = zoneDefinitions.value.filter(zone => zone.id !== zoneId)
    saveZoneDefinitions(zoneDefinitions.value)
    removeStoredZoneLayout(zoneId)
    activeZoneId.value = zoneDefinitions.value[0]?.id || ''
    await silentRefreshDeviceList()
  } catch (error) {
    console.error('delete zone error =', error)
    try {
      await refreshDeviceListStrict()
    } catch (refreshError) {
      console.error('refresh after delete zone error =', refreshError)
    }
    toast.show(getErrorMessage(error, '删除分区失败'), 'error')
  } finally {
    unlockDeviceMutations(movingIds)
    zoneManagementPending.value = false
  }
}

async function handleDeviceNumberSwap({ firstDeviceId, secondDeviceId }: DeviceNumberSwapRequest) {
  if (deviceMutationPending.value || zoneManagementPending.value) return

  const first = devices.value.find(device => String(device.id) === String(firstDeviceId))
  const second = devices.value.find(device => String(device.id) === String(secondDeviceId))
  if (!first || !second || normalizeZoneName(first.displayName) !== normalizeZoneName(second.displayName)) return

  const targetIds = [first.id, second.id]
  const zoneDevices = devices.value.filter(device => (
    isLampDevice(device) && normalizeZoneName(device.displayName) === normalizeZoneName(first.displayName)
  ))
  deviceMutationPending.value = true
  lockDeviceMutations(targetIds)

  try {
    await flushRealtimeUpdatesFor(targetIds)
    const updatedDevices = await swapDeviceNumbers(
      first,
      second,
      zoneDevices,
      (id, payload) => updateDevice(id, payload),
    )
    updatedDevices.forEach(upsertDevice)
    await silentRefreshDeviceList()
  } catch (error) {
    console.error('swap device number error =', error)
    try {
      await refreshDeviceListStrict()
    } catch (refreshError) {
      console.error('refresh after device number swap error =', refreshError)
    }
    toast.show(getErrorMessage(error, '交换灯具编号失败'), 'error')
  } finally {
    unlockDeviceMutations(targetIds)
    deviceMutationPending.value = false
  }
}

async function handleDeleteDevice(id: number) {
  // 乐观删除：先保存被删设备（不是整个列表），立即从 UI 移除，失败时只恢复该设备
  const deletedDevice = devices.value.find(d => String(d.id) === String(id))
  deletingId.value = id

  devices.value = devices.value.filter(d => String(d.id) !== String(id))

  try {
    await deleteDevice(id)
    if (deletedDevice) {
      releaseFabricImageBlobUrl(deletedDevice)
    }
    // 后台静默同步一次
    await silentRefreshDeviceList()
  } catch (error) {
    console.error('deleteDevice error =', error)
    // 删除失败 → 只恢复被删除的设备，不覆盖期间 WebSocket 对其它设备的更新
    if (deletedDevice) {
      upsertDevice(deletedDevice)
    }
    toast.show(getErrorMessage(error, '删除设备失败'), 'error')
    shakeControls()
  } finally {
    deletingId.value = null
  }
}

function updateDeviceByIncoming(incoming: Partial<DeviceItem>) {
  // 优先用统一 key 查找，找不到再用 id 匹配
  const key = getDeviceKey(incoming)
  let index = -1
  if (key) {
    index = devices.value.findIndex(item => getDeviceKey(item) === key)
  }
  if (index < 0 && incoming.id != null) {
    index = devices.value.findIndex(item => String(item.id) === String(incoming.id))
  }

  const previous = index >= 0 ? devices.value[index] : undefined
  const nextIncoming = { ...incoming }
  const incomingDeviceType = normalizeDeviceType(nextIncoming.deviceType || previous?.deviceType)
  if (incomingDeviceType === 'cam') {
    stripLampOnlyFields(nextIncoming)
  }
  if (!Object.prototype.hasOwnProperty.call(incoming, 'lastSeen')) {
    nextIncoming.lastSeen = previous?.lastSeen
  }
  if (!Object.prototype.hasOwnProperty.call(incoming, 'lastSeenAt')) {
    nextIncoming.lastSeenAt = previous?.lastSeenAt
  }
  const hasSelfTestPayload = Object.prototype.hasOwnProperty.call(incoming, 'selfTestJson')
    || Object.prototype.hasOwnProperty.call(incoming, 'selfTestTime')

  if (incoming.online === false) {
    nextIncoming.selfTestJson = undefined
    nextIncoming.selfTestTime = undefined
  } else if (incoming.online === true && previous?.online !== true && !hasSelfTestPayload) {
    nextIncoming.selfTestJson = undefined
    nextIncoming.selfTestTime = undefined
  }

  if (index >= 0) {
    devices.value[index] = {
      ...devices.value[index],
      ...nextIncoming,
    }
  } else if (key) {
    // 有 key 才 upsert，避免无 key 时产生重复
    upsertDevice(nextIncoming as DeviceItem)
  }
  // 没有 key 且没找到匹配 → 不添加（无法去重）
}

function stripLampOnlyFields(device: Partial<DeviceItem>) {
  const lampOnlyKeys: Array<keyof DeviceItem> = [
    'brightness',
    'temp',
    'autoMode',
    'garmentAimEnabled',
    'garmentDefaultPan',
    'garmentDefaultTilt',
    'personDefaultPan',
    'personDefaultTilt',
    'recommendedBrightness',
    'recommendedTemp',
    'fabric',
    'label',
    'confidence',
    'fabricConfidence',
    'mainColorRgb',
    'resultVersion',
    'segmentationFallback',
    'outfitType',
    'garments',
    'clothDetected',
    'clothX',
    'clothY',
    'clothW',
    'clothH',
    'originalImageUrl',
    'annotatedImageUrl',
    'annotatedImageBlobUrl',
    'annotatedImageId',
    'combinedImageUrl',
    'lampClothState',
    'lampProximityState',
    'garmentDetectionStatus',
    'lastTakenAt',
  ]

  for (const key of lampOnlyKeys) {
    delete device[key]
  }
}

function findDeviceByChipId(chipId?: string) {
  const normalizedChipId = normalizeChipId(chipId)
  if (!normalizedChipId) return undefined
  return devices.value.find(item => normalizeChipId(item.chipId) === normalizedChipId)
}

function releaseFabricImageBlobUrl(device?: Partial<DeviceItem>) {
  const url = device?.annotatedImageBlobUrl
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
  if (device) {
    device.annotatedImageBlobUrl = undefined
    device.annotatedImageId = undefined
  }
}

function applyCompletedFabricImage(image: CompletedFabricImage) {
  const device = findDeviceByChipId(image.chipId)
  if (!device || !isLampDevice(device) || device.annotatedImageId === image.imageId) {
    return
  }
  const nextUrl = URL.createObjectURL(image.blob)
  releaseFabricImageBlobUrl(device)
  updateDeviceByIncoming({
    chipId: image.chipId,
    annotatedImageId: image.imageId,
    annotatedImageBlobUrl: nextUrl,
  })
}

function handleFabricImageBinary(frame: ArrayBuffer) {
  try {
    const image = assembler.accept(frame)
    if (image) {
      applyCompletedFabricImage(image)
    }
  } catch (error) {
    console.warn('WS fabric image frame ignored:', error)
  }
}

function hasOwnValue(source: any, key: string) {
  return source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined
}

function buildLampAiIncomingFromCaptureResult(data: any): Partial<DeviceItem> {
  const aiSource = data?.aiResult || data?.fabricResult || data?.recognizeResult || {}
  const incoming: Partial<DeviceItem> = {}

  const fabric = hasOwnValue(aiSource, 'fabric')
    ? aiSource.fabric
    : hasOwnValue(data, 'fabric')
      ? data.fabric
      : (hasOwnValue(aiSource, 'label') ? aiSource.label : data?.label)
  if (fabric !== undefined) incoming.fabric = fabric || ''

  const confidence = hasOwnValue(aiSource, 'confidence') ? aiSource.confidence : data?.confidence
  if (confidence !== undefined) incoming.confidence = Number(confidence)

  const fabricConfidence = hasOwnValue(aiSource, 'fabricConfidence') ? aiSource.fabricConfidence : data?.fabricConfidence
  if (fabricConfidence !== undefined) incoming.fabricConfidence = Number(fabricConfidence)

  const aiKeys: Array<keyof DeviceItem> = [
    'mainColorRgb',
    'recommendedBrightness',
    'resultVersion',
    'segmentationFallback',
    'outfitType',
    'garments',
    'recommendedTemp',
    'clothDetected',
    'clothX',
    'clothY',
    'clothW',
    'clothH',
    'originalImageUrl',
    'annotatedImageUrl',
    'combinedImageUrl',
  ]

  for (const key of aiKeys) {
    if (hasOwnValue(aiSource, key)) {
      ;(incoming as any)[key] = aiSource[key]
    } else if (hasOwnValue(data, key)) {
      ;(incoming as any)[key] = data[key]
    }
  }

  return normalizeGarmentIncoming(incoming)
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
    updateDeviceByIncoming(normalizeGarmentIncoming(message.data))
    return
  }

  if (message.type === 'lightEffectState' && message.data) {
    lightEffectState.value = message.data
    return
  }

  if (message.type === 'onlineStatus' && message.data) {
    const incoming: Partial<DeviceItem> = {
      chipId: message.data.chipId,
      ip: message.data.ip,
      online: message.data.online,
      lastSeen: message.data.lastSeen,
      garmentDetectionStatus: message.data.garmentDetectionStatus,
      lampProximityState: message.data.online === true && message.data.nearby != null
        ? {
            chipId: message.data.chipId,
            nearby: Boolean(message.data.nearby),
            updateTime: message.data.updateTime,
          }
        : undefined,
      lastTakenAt: message.data.lastTakenAt,
      trackingStatus: message.data.trackingStatus
        ? {
            chipId: message.data.chipId,
            status: message.data.trackingStatus,
            timestamp: message.data.updateTime,
          }
        : undefined,
    }
    if (message.data.lastSeenAt != null) {
      incoming.lastSeenAt = message.data.lastSeenAt
    }
    updateDeviceByIncoming(incoming)
    return
  }

  if (message.type === 'garmentDetectionStatus' && message.data) {
    const status = message.data.status ?? message.data.garmentDetectionStatus
    devices.value
      .filter(device => isLampDevice(device))
      .forEach(device => updateDeviceByIncoming({
        chipId: device.chipId,
        garmentDetectionStatus: status,
      }))
    return
  }

  if (message.type === 'lampProximityState' && message.data) {
    const chipId = String(message.data.chipId ?? '').trim()
    if (!chipId) return
    updateDeviceByIncoming({
      chipId,
      lampProximityState: {
        chipId,
        nearby: Boolean(message.data.nearby),
        updateTime: message.data.updateTime ?? message.data.timestamp,
      },
    })
    return
  }

  if (message.type === 'fabricRecognize' && message.data) {
    const chipId = String(
      message.data.targetChipId ??
      message.data.lampChipId ??
      message.data.chipId ??
      '',
    ).trim()
    if (!chipId) return

    const targetDevice = findDeviceByChipId(chipId)
    if (!targetDevice) {
      console.warn('fabricRecognize target lamp not found:', chipId)
      return
    }
    if (!isLampDevice(targetDevice)) {
      console.warn('fabricRecognize target is not lamp device:', chipId)
      return
    }

    updateDeviceByIncoming({
      chipId,
      label: message.data.label,
      ...buildLampAiIncomingFromCaptureResult(message.data),
    })
    return
  }

  if (message.type === 'deviceDeleted' && message.data) {
    const deletedId = message.data.id
    const deletedChipId = message.data.chipId
    const deletedDevice = devices.value.find(item => {
      if (deletedId != null && String(item.id) === String(deletedId)) return true
      return Boolean(
        deletedChipId
        && normalizeChipId(item.chipId) === normalizeChipId(deletedChipId),
      )
    })
    releaseFabricImageBlobUrl(deletedDevice)

    devices.value = devices.value.filter(item => {
      if (deletedId != null && String(item.id) === String(deletedId)) return false
      if (deletedChipId && normalizeChipId(item.chipId) === normalizeChipId(deletedChipId)) return false
      return true
    })
    return
  }

  if (
    ['personFlowUpdated', 'personFlowRecord', 'camFlowPhoto', 'camFlow'].includes(String(message.type)) &&
    message.data
  ) {
    const count = Number(message.data.personCount ?? message.data.count ?? 0)
    if (Number.isFinite(count)) {
      envInfo.value.people = Math.max(0, count)
    }

    const chipId = String(message.data.camChipId ?? message.data.chipId ?? '').trim()
    const timestamp = message.data.detectTime ?? message.data.timestamp ?? message.data.updateTime ?? new Date().toISOString()

    if (chipId) {
      const incoming: Partial<DeviceItem> = {
        chipId,
        personCount: Number.isFinite(count) ? count : undefined,
        peopleCount: Number.isFinite(count) ? count : undefined,
        flowPersonCount: Number.isFinite(count) ? count : undefined,
        personDetected: Number.isFinite(count) ? count > 0 : undefined,
        hasPerson: Number.isFinite(count) ? count > 0 : undefined,
        personDetectTime: timestamp,
        flowDetectTime: timestamp,
        detectTime: timestamp,
      }

      if (message.data.confidence != null) {
        incoming.personConfidence = Number(message.data.confidence)
      }
      if (message.data.processingTime != null) {
        incoming.flowProcessingTime = Number(message.data.processingTime)
      }
      if (message.data.imageName) {
        incoming.flowImageName = message.data.imageName
      }

      updateDeviceByIncoming(incoming)
    }

    window.dispatchEvent(new CustomEvent('person-flow-updated', {
      detail: Number.isFinite(count) ? { personCount: count } : undefined,
    }))

    if (flowCache.value.tempPeopleTrend != null) {
      flowCache.value.tempPeopleTrend = null
    }

    return
  }

  if (message.type === 'personDetection' && message.data) {
    const count = Number(message.data.count ?? 0)
    if (Number.isFinite(count)) {
      envInfo.value.people = Math.max(0, count)
    }

    const chipId = String(message.data.camChipId ?? message.data.chipId ?? '').trim()

    if (chipId) {
      const timestamp = message.data.timestamp ?? new Date().toISOString()
      const incoming: Partial<DeviceItem> = {
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
      }
      if (message.data.imageName) {
        incoming.flowImageName = message.data.imageName
      }

      updateDeviceByIncoming(incoming)
    }

    window.dispatchEvent(new CustomEvent('person-flow-updated', {
      detail: Number.isFinite(count) ? { personCount: count } : undefined,
    }))

    if (flowCache.value.tempPeopleTrend != null) {
      flowCache.value.tempPeopleTrend = null
    }

    return
  }

  if (message.type === 'camStatus' && message.data) {
    const camChipId = String(message.data.camChipId ?? message.data.chipId ?? '').trim()
    if (!camChipId) return

    const currentCam = findDeviceByChipId(camChipId)
    const nextWorkStatus = message.data.workStatus ?? message.data.status
    const recoveredFromTerminalTracking = ['monitoring', 'stopped', 'returning_center']
      .includes(String(nextWorkStatus || '').toLowerCase())
      && ['lost', 'timeout'].includes(String(currentCam?.trackingStatus?.status || '').toLowerCase())
    const incoming: Partial<DeviceItem> = {
      chipId: camChipId,
      camWorkStatus: nextWorkStatus,
      camStatusMessage: message.data.message,
      camActiveTargetIndex: message.data.targetIndex ?? message.data.activeTargetIndex,
      camActiveTargetChipId: message.data.targetChipId ?? message.data.activeTargetChipId,
      detectTime: message.data.detectTime ?? message.data.timestamp ?? message.data.updateTime,
      ...(recoveredFromTerminalTracking
        ? {
            tracking: false,
            trackingStatus: {
              ...currentCam?.trackingStatus,
              status: 'monitoring',
              timestamp: message.data.timestamp ?? message.data.updateTime,
            },
          }
        : {}),
    }

    if (message.data.personCount != null) {
      incoming.personCount = message.data.personCount
      incoming.peopleCount = message.data.personCount
      incoming.flowPersonCount = message.data.personCount
      incoming.flowDetectTime = message.data.detectTime ?? message.data.timestamp ?? message.data.updateTime
    }
    if (message.data.confidence != null) {
      incoming.personConfidence = Number(message.data.confidence)
    }
    if (message.data.imageName) {
      incoming.flowImageName = message.data.imageName
    }

    updateDeviceByIncoming(incoming)

    const recoveredTargetChipId = currentCam?.trackingStatus?.targetChipId
    if (recoveredFromTerminalTracking && recoveredTargetChipId) {
      updateDeviceByIncoming({
        chipId: recoveredTargetChipId,
        tracking: false,
        trackingStatus: {
          ...currentCam?.trackingStatus,
          status: 'monitoring',
          timestamp: message.data.timestamp ?? message.data.updateTime,
        },
      })
    }

    if (message.data.personCount != null) {
      window.dispatchEvent(new CustomEvent('person-flow-updated', {
        detail: { personCount: Number(message.data.personCount) },
      }))
      if (flowCache.value.tempPeopleTrend != null) {
        flowCache.value.tempPeopleTrend = null
      }
    }
    return
  }

  if (message.type === 'camPresence' && message.data) {
    const camChipId = String(message.data.camChipId ?? message.data.chipId ?? '').trim()
    if (!camChipId) return

    const areas = Array.isArray(message.data.areas) ? message.data.areas : []
    const hasPerson = areas.some((area: any) => Boolean(area?.present))
    const personCount = message.data.personCount

    const incoming: Partial<DeviceItem> = {
      chipId: camChipId,
      camPresence: {
        camChipId,
        workStatus: message.data.workStatus,
        configured: message.data.configured,
        personCount,
        confidence: message.data.confidence,
        updateTime: message.data.updateTime ?? message.data.timestamp,
        areas,
      },
      camWorkStatus: message.data.workStatus ?? (hasPerson ? 'presence' : 'monitoring'),
      personDetected: hasPerson,
      hasPerson,
      personDetectTime: message.data.updateTime ?? message.data.timestamp,
      flowDetectTime: message.data.updateTime ?? message.data.timestamp,
    }
    if (personCount != null) {
      incoming.personCount = personCount
      incoming.peopleCount = personCount
      incoming.flowPersonCount = personCount
    }
    updateDeviceByIncoming(incoming)
    if (personCount != null) {
      window.dispatchEvent(new CustomEvent('person-flow-updated', {
        detail: { personCount: Number(personCount) },
      }))
      if (flowCache.value.tempPeopleTrend != null) {
        flowCache.value.tempPeopleTrend = null
      }
    }
    return
  }

  if (message.type === 'cameraCaptureTask' && message.data) {
    const camChipId = String(message.data.camChipId ?? '').trim()
    if (!camChipId) return
    const currentDevice = findDeviceByChipId(camChipId)
    const captureStatus = String(message.data.status || '')
    const captureTasks = message.data.batchId
      ? mergeCaptureTask(currentDevice?.camCaptureTasks || [], message.data)
      : currentDevice?.camCaptureTasks

    updateDeviceByIncoming({
      chipId: camChipId,
      camWorkStatus: ['waiting_motion', 'capturing', 'uploading'].includes(captureStatus)
        ? captureStatus
        : (currentDevice?.camWorkStatus || 'capturing'),
      camStatusMessage: message.data.message || 'capture task created',
      camActiveTargetIndex: message.data.targetIndex,
      camActiveTargetChipId: message.data.targetChipId,
      camLastCapture: message.data,
      ...(captureTasks ? { camCaptureTasks: captureTasks } : {}),
    })
    return
  }

  if (message.type === 'cameraCaptureResult' && message.data) {
    const camChipId = String(message.data.camChipId ?? '').trim()
    if (!camChipId) return
    const captureStatus = String(message.data.status || '')
    const currentDevice = findDeviceByChipId(camChipId)
    const captureTasks = message.data.batchId
      ? mergeCaptureTask(currentDevice?.camCaptureTasks || [], message.data)
      : currentDevice?.camCaptureTasks
    const aiOnlyStatus = ['image_received', 'ai_processing', 'ai_done', 'photo_saved_ai_failed']
      .includes(captureStatus)
    const camWorkStatus = aiOnlyStatus
      ? (currentDevice?.camWorkStatus || 'monitoring')
      : (['timeout', 'upload_failed'].includes(captureStatus) ? 'error' : (captureStatus || 'error'))

    updateDeviceByIncoming({
      chipId: camChipId,
      camWorkStatus,
      camStatusMessage: message.data.message || message.data.status,
      camActiveTargetIndex: message.data.targetIndex,
      camActiveTargetChipId: message.data.targetChipId,
      camLastCapture: message.data,
      ...(captureTasks ? { camCaptureTasks: captureTasks } : {}),
    })

    const targetChipId = String(message.data.targetChipId ?? message.data.lampChipId ?? '').trim()
    const targetDevice = findDeviceByChipId(targetChipId)
    const lampAiIncoming = buildLampAiIncomingFromCaptureResult(message.data)
    const hasLampAiIncoming = Object.keys(lampAiIncoming).length > 0

    if (hasLampAiIncoming && targetChipId) {
      if (!targetDevice) {
        console.warn('cameraCaptureResult target lamp not found:', targetChipId)
      } else if (!isLampDevice(targetDevice)) {
        console.warn('cameraCaptureResult target is not lamp device:', targetChipId)
      } else {
        updateDeviceByIncoming({
          chipId: targetChipId,
          ...lampAiIncoming,
        })
      }
    }
    return
  }

  if (message.type === 'lampClothState' && message.data) {
    const chipId = String(message.data.chipId ?? message.data.targetChipId ?? '').trim()
    if (!chipId) return

    updateDeviceByIncoming({
      chipId,
      lampClothState: {
        chipId,
        clothStatus: message.data.clothStatus ?? message.data.clothState,
        lastTakenAt: message.data.lastTakenAt,
        tracking: message.data.tracking,
        updateTime: message.data.updateTime ?? message.data.timestamp,
      },
      lastTakenAt: message.data.lastTakenAt,
      tracking: message.data.tracking,
    })
    return
  }

  if (message.type === 'trackingStatus' && message.data) {
    const chipId = String(message.data.chipId ?? message.data.camChipId ?? message.data.targetChipId ?? message.data.lampChipId ?? '').trim()
    if (!chipId) return

    const trackingStatus = {
      chipId: message.data.chipId,
      camChipId: message.data.camChipId,
      targetChipId: message.data.targetChipId ?? message.data.lampChipId,
      targetIndex: message.data.targetIndex,
      status: message.data.status ?? message.data.trackingStatus,
      message: message.data.message,
      timestamp: message.data.timestamp ?? message.data.updateTime,
    }

    updateDeviceByIncoming({
      chipId,
      trackingStatus,
      tracking: trackingStatus.status === 'tracking',
      camWorkStatus: message.data.camChipId ? trackingStatus.status : undefined,
      camStatusMessage: message.data.message,
      camActiveTargetIndex: message.data.targetIndex,
      camActiveTargetChipId: trackingStatus.targetChipId,
    })

    if (trackingStatus.targetChipId && normalizeChipId(trackingStatus.targetChipId) !== normalizeChipId(chipId)) {
      updateDeviceByIncoming({
        chipId: trackingStatus.targetChipId,
        trackingStatus,
        tracking: trackingStatus.status === 'tracking',
      })
    }
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

const { connected, send } = useWebSocket(
  wsUrl,
  handleWsMessage,
  wsProtocol,
  handleFabricImageBinary,
)

watch(
  [connected, initialDevicesLoaded],
  ([isConnected, devicesLoaded]) => {
    if (!isConnected) {
      fabricImageCapabilityDeclared.value = false
      assembler.reset()
      return
    }
    if (!devicesLoaded || fabricImageCapabilityDeclared.value) return
    if (send({
      type: 'capabilities',
      data: {
        fabricImageBinary: true,
        version: 1,
      },
    })) {
      fabricImageCapabilityDeclared.value = true
    }
  },
  { immediate: true },
)

const connectionStatusClass = computed(() => ({
  'ws-connected': connected.value,
  'ws-scanning': scanning.value,
  'ws-offline': !connected.value,
}))

const connectionStatusText = computed(() => {
  const prefix = connected.value ? 'WS 已连接' : 'WS 未连接'
  return scanning.value || scanFinished.value ? `${prefix} · ${scanStatus.value}` : prefix
})

watch(connected, (val) => {
  if (scanning.value || scanFinished.value) return

  if (val) {
    scanStatus.value = '实时连接已建立'
  } else {
    scanStatus.value = 'WebSocket 未连接'
  }
})

onBeforeUnmount(() => {
  pageSwitchGeneration += 1
  if (pageSwitchCleanupTimer !== null) {
    window.clearTimeout(pageSwitchCleanupTimer)
    pageSwitchCleanupTimer = null
  }
  window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack)
  window.removeEventListener('person-flow-updated', handlePersonFlowUpdatedEvent)
  clearScanTimers()
  if (fabricImageCleanupTimer !== null) {
    window.clearInterval(fabricImageCleanupTimer)
    fabricImageCleanupTimer = null
  }
  assembler.reset()
  devices.value.forEach(releaseFabricImageBlobUrl)

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
  z-index: 0;
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
  z-index: 1;
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
}

.page-switcher.is-switching .page-section {
  will-change: transform, opacity;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
}

/* Performance: disable heavy effects during page transition */
.page-switcher.is-switching :deep(.env-card),
.page-switcher.is-switching :deep(.scan-panel),
.page-switcher.is-switching :deep(.settings-group-card),
.page-switcher.is-switching :deep(#controls),
.page-switcher.is-switching :deep(.store-layout-main) {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.page-switcher.is-switching :deep(.env-card),
.page-switcher.is-switching :deep(.scan-panel),
.page-switcher.is-switching :deep(.settings-group-card),
.page-switcher.is-switching :deep(#controls),
.page-switcher.is-switching :deep(.store-layout-main),
.page-switcher.is-switching :deep(.settings-full-card) {
  transition-property: opacity, transform !important;
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
  align-items: stretch;
}

.settings-panel-slot {
  min-width: 0;
  height: 100%;
}

.settings-device-grid :deep(.settings-card) {
  height: 100%;
  box-sizing: border-box;
}

@media (min-width: 901px) {
  .settings-device-grid :deep(.settings-card) {
    padding: 18px;
  }

  .settings-device-grid :deep(.panel-desc) {
    margin-top: 3px;
    line-height: 1.35;
  }

  .settings-device-grid :deep(.form-row) {
    margin-top: 10px;
  }

  .settings-device-grid :deep(.gimbal-self-test) {
    margin-top: 8px;
    padding: 8px 10px;
  }

  .settings-device-grid :deep(.joystick-section) {
    margin-top: 8px;
  }

  .settings-device-grid :deep(.gimbal-control-row) {
    grid-template-columns: 230px minmax(0, 1fr);
    column-gap: 20px;
    margin: 6px 0 0;
  }

  .settings-device-grid :deep(.device-pair-grid) {
    gap: 9px 10px;
    margin-top: 11px;
  }

  .settings-device-grid :deep(.calibration-progress),
  .settings-device-grid :deep(.target-card),
  .settings-device-grid :deep(.motor-card),
  .settings-device-grid :deep(.sample-list) {
    margin-top: 9px;
    padding: 10px;
  }

  .settings-device-grid :deep(.workflow-grid) {
    gap: 10px;
  }

  .settings-device-grid :deep(.target-plane) {
    height: 112px;
    margin-top: 8px;
  }

  .settings-device-grid :deep(.empty-hint) {
    min-height: 112px;
  }

  .settings-device-grid :deep(.motor-row) {
    margin-top: 8px;
  }

  .settings-device-grid :deep(.calibration-actions) {
    margin-top: 9px;
  }

  .settings-device-grid :deep(.sample-list) {
    max-height: 126px;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
}

.settings-data-grid {
  grid-auto-rows: clamp(560px, 58vh, 680px);
}

.settings-data-grid .settings-panel-slot {
  min-height: 0;
  overflow: hidden;
}

.settings-data-grid :deep(.settings-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.settings-flow-slot :deep(.flow-list) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-gutter: stable;
}

.settings-flow-slot :deep(.empty-flow) {
  flex: 1;
  min-height: 0;
}

/* ROI 区域状态暂未接入本页，保留并显示人流图形区域。 */
.settings-flow-slot :deep(.flow-presence-list),
.settings-flow-slot :deep(.flow-roi-warning) {
  display: none;
}

.settings-duration-slot :deep(.result-block) {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}

.settings-duration-slot :deep(.empty-block) {
  min-height: 100%;
  box-sizing: border-box;
}

.settings-smartconfig-bottom {
  width: 100%;
  min-width: 0;
}

.settings-smartconfig-bottom :deep(.smart-config-section) {
  margin: 4px 0 32px;
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
.app-container :deep(.smart-card),
.app-container :deep(.layout-card),
.app-container :deep(.light-effect-mini-card),
.app-container :deep(.sidebar),
.app-container :deep(.chart-card),
.app-container :deep(#controls) {
  transition: background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease, color 0.5s ease;
}

.app-container .settings-group-card {
  transition: background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease, backdrop-filter 0.35s ease, color 0.35s ease;
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
.app-container.night-mode :deep(.smart-card),
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

/* 夜间模式：设置页分组大卡片 */
.app-container.night-mode .settings-group-card {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(30, 41, 59, 0.58));
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 夜间模式：设置页内部小卡片 */
.app-container.night-mode :deep(.flow-card),
.app-container.night-mode :deep(.flow-data-item),
.app-container.night-mode :deep(.flow-chart-box),
.app-container.night-mode :deep(.empty-flow),
.app-container.night-mode :deep(.smart-step),
.app-container.night-mode :deep(.smart-status),
.app-container.night-mode :deep(.smart-message) {
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
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.ios-panel-leave-active {
  transition:
    opacity 260ms cubic-bezier(0.4, 0, 1, 1),
    transform 260ms cubic-bezier(0.4, 0, 1, 1);
  will-change: opacity, transform;
}

.ios-panel-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.965);
}

.ios-panel-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.ios-panel-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.ios-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
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
  position: relative;
  z-index: 2;
  min-height: 100vh;
  margin-left: 228px;
  width: auto;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 24px 24px 48px 0;
  overflow-x: hidden;
}

/* ---- 3D layout card chrome (migrated from StoreLightLayout) ---- */
.layout-card {
  margin: 0;
  padding: 18px;
  border-radius: 24px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.14);
}

.layout-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.layout-header > div:first-child {
  flex: 1 1 200px;
  min-width: 0;
}

.layout-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 900;
  color: #111827;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.three-layout-mvp-panel {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
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
    padding: 10px clamp(10px, 3.5vw, 16px);
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

  .section-space-top {
    margin-top: 6px;
  }

  .env-layout {
    gap: 0;
    margin-bottom: 8px;
  }

  .env-card {
    min-width: 0;
    flex: 1 1 100%;
    padding: 8px 12px;
  }

  .env-card:first-child {
    border-radius: 14px 14px 0 0;
    padding-bottom: 5px;
  }

  .env-card:last-child {
    display: flex;
    align-items: center;
    border-radius: 0 0 14px 14px;
    border-top: 1px solid rgba(203, 213, 225, 0.5);
    padding: 5px 12px 7px;
  }

  .env-card h4 {
    margin: 0 0 4px;
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
    padding: 2px 4px;
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
    padding: 2px 4px;
    text-align: center;
    border-right: 1px solid rgba(203, 213, 225, 0.4);
  }

  .lux-display {
    flex: 1 1 0;
    margin-top: 0;
    padding: 2px 4px;
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

  .layout-card {
    padding: 12px 14px;
    border-radius: 16px;
  }

  .layout-header {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    margin-bottom: 8px;
  }

  .layout-header > div:first-child {
    flex: none;
  }

  .layout-header h2 {
    font-size: 15px;
    font-weight: 700;
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
    gap: 14px;
  }

  .settings-data-grid {
    grid-auto-rows: auto;
  }

  .settings-data-grid .settings-panel-slot {
    height: auto;
    overflow: visible;
  }

  .settings-data-grid :deep(.settings-card) {
    height: auto;
    overflow: visible;
  }

  .settings-flow-slot :deep(.flow-list) {
    overflow: visible;
    padding-right: 0;
  }

  .settings-duration-slot :deep(.result-block) {
    max-height: 360px;
  }

  .settings-group-card {
    margin-top: 18px;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-radius: 0;
  }

  .app-container.night-mode .settings-group-card {
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .settings-group-title {
    font-size: 15px;
    margin-bottom: 14px;
    padding-bottom: 10px;
  }
}

@media (max-width: 768px) {
  .settings-layout {
    gap: 0;
  }

  .settings-group-grid {
    gap: 10px;
  }

  .settings-group-card {
    margin-top: 8px;
  }

  .settings-group-title {
    margin-bottom: 8px;
    padding-bottom: 6px;
  }

  .settings-smartconfig-bottom :deep(.smart-config-section) {
    margin-top: 8px;
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
