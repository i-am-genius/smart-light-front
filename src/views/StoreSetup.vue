<template>
  <div :class="{ shake: shakingFormCard }">
    <AuthShell title="完善店铺信息" subtitle="用于系统展示、区域天气与照明推荐计算。">
      <form class="form-body" @submit.prevent="handleSave">
        <div class="form-grid">
          <div class="form-item">
            <label>店铺名称</label>
            <input
              v-model.trim="form.storeName"
              type="text"
              placeholder="请输入店铺名称"
              :class="{ shake: shakingStoreName }"
            />
          </div>

          <div class="form-item">
            <label>店铺面积（㎡）</label>
            <input
              v-model.number="form.storeArea"
              type="number"
              min="1"
              step="0.1"
              placeholder="请输入店铺面积，如 80"
              :class="{ shake: shakingStoreArea }"
            />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-item" :class="{ shake: shakingProvince }">
            <label>省份</label>
            <BaseSelect
              v-model="regionValue.province"
              :options="provinceOptions"
              placeholder="请选择省份"
              @change="handleProvinceChange"
            />
          </div>

          <div class="form-item" :class="{ shake: shakingCity }">
            <label>城市</label>
            <BaseSelect
              v-model="regionValue.city"
              :options="citySelectOptions"
              placeholder="请选择城市"
              :disabled="!citySelectOptions.length"
              @change="handleCityChange"
            />
          </div>
        </div>

        <div class="form-grid single-row">
          <div class="form-item" :class="{ shake: shakingStoreStyle }">
            <label>店铺风格</label>
            <BaseSelect
              v-model="form.storeStyle"
              :options="storeStyleOptions"
              placeholder="请选择店铺风格"
            />
          </div>
        </div>

        <p class="setup-note">
          店铺地区会用于天气关联，店铺风格会影响推荐照明策略。
        </p>

        <div class="form-actions">
          <button class="secondary-btn" type="button" @click="handleSkip">
            稍后完善
          </button>
          <button class="primary-btn" type="submit" :disabled="loading">
            {{ loading ? '保存中...' : '保存并进入系统' }}
          </button>
        </div>
      </form>
    </AuthShell>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/http'
import type { RegionCity, RegionProvince, RegionValue } from '../constants/china-region'
import { regions } from '../constants/china-region'
import { STORE_STYLE_OPTIONS, STORE_STYLE_MAP } from '../constants/store'
import BaseSelect from '../components/common/BaseSelect.vue'
import AuthShell from '../components/auth/AuthShell.vue'
import { useToast } from '../composables/useToast'
import { useShake } from '../composables/useShake'

const router = useRouter()
const loading = ref(false)
const toast = useToast()
const { shaking: shakingStoreName, trigger: shakeStoreName } = useShake()
const { shaking: shakingStoreArea, trigger: shakeStoreArea } = useShake()
const { shaking: shakingProvince, trigger: shakeProvince } = useShake()
const { shaking: shakingCity, trigger: shakeCity } = useShake()
const { shaking: shakingStoreStyle, trigger: shakeStoreStyle } = useShake()
const { shaking: shakingFormCard, trigger: shakeFormCard } = useShake()

const STORE_SETUP_URL = '/api/store/setup'
const provinceOptions = computed(() => {
  return regions.map(item => ({
    label: item.label,
    value: item.value,
  }))
})

const citySelectOptions = computed(() => {
  return cityOptions.value.map(item => ({
    label: item.label,
    value: item.value,
  }))
})

const storeStyleOptions = computed(() => {
  return STORE_STYLE_OPTIONS.map(item => ({
    label: item.label,
    value: item.value,
  }))
})

const form = reactive({
  storeName: '',
  storeArea: '' as number | string,
  storeStyle: '',
})

const regionValue = reactive<RegionValue>({
  province: '',
  provinceLabel: '',
  city: '',
  cityLabel: '',
})

const selectedProvince = computed<RegionProvince | undefined>(() => {
  return regions.find(item => item.value === regionValue.province)
})

const cityOptions = computed<RegionCity[]>(() => {
  return selectedProvince.value?.cities ?? []
})

const selectedStoreStyleLabel = computed(() => {
  return STORE_STYLE_MAP[form.storeStyle] || ''
})

function handleProvinceChange() {
  const province = regions.find(item => item.value === regionValue.province)
  regionValue.provinceLabel = province?.label ?? ''
  regionValue.city = ''
  regionValue.cityLabel = ''
}

function handleCityChange() {
  const city = cityOptions.value.find(item => item.value === regionValue.city)
  regionValue.cityLabel = city?.label ?? ''
}

function parseCityCoordinates(value: string): { latitude?: number; longitude?: number } {
  const [latitude, longitude] = String(value || '').split(',').map(Number)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {}
  }
  return {
    latitude,
    longitude,
  }
}

function validateForm() {
  if (!form.storeName) {
    toast.show('请输入店铺名称', 'error')
    shakeStoreName()
    return false
  }
  if (form.storeArea === '' || form.storeArea === null || Number(form.storeArea) <= 0) {
    toast.show('请输入正确的店铺面积', 'error')
    shakeStoreArea()
    return false
  }
  if (!regionValue.provinceLabel) {
    toast.show('请选择省份', 'error')
    shakeProvince()
    return false
  }
  if (!regionValue.cityLabel) {
    toast.show('请选择城市', 'error')
    shakeCity()
    return false
  }
  if (!form.storeStyle) {
    toast.show('请选择店铺风格', 'error')
    shakeStoreStyle()
    return false
  }
  return true
}

async function handleSave() {
  if (!validateForm()) return

  loading.value = true
  try {
   const coordinates = regionValue.provinceLabel && regionValue.city
    ? parseCityCoordinates(regionValue.city)
    : {}
   const saveRes = await http.post(STORE_SETUP_URL, {
    storeName: form.storeName,
    area: Number(form.storeArea),
    storeStyle: form.storeStyle,
    province: regionValue.provinceLabel,
    city: regionValue.cityLabel,
    ...coordinates,
  })

    const data = saveRes.data?.data ?? saveRes.data

    localStorage.setItem(
      'storeSetup',
      JSON.stringify({
        configured: true,
        storeId: data?.id,
        storeName: data?.storeName ?? form.storeName,
        storeArea: data?.area ?? Number(form.storeArea),
        storeStyle: data?.storeStyle ?? form.storeStyle,
        storeStyleLabel: STORE_STYLE_MAP[data?.storeStyle ?? form.storeStyle] || selectedStoreStyleLabel.value,
        province: data?.province ?? regionValue.provinceLabel,
        city: data?.city ?? regionValue.cityLabel,
        latitude: data?.latitude ?? coordinates.latitude,
        longitude: data?.longitude ?? coordinates.longitude,
      }),
    )

    const rawUserInfo = localStorage.getItem('USER_INFO')
    if (rawUserInfo) {
      try {
        const userInfo = JSON.parse(rawUserInfo)
        userInfo.storeConfigured = true
        userInfo.storeId = data?.id
        userInfo.storeName = data?.storeName ?? form.storeName
        userInfo.storeStyle = data?.storeStyle ?? form.storeStyle
        userInfo.storeStyleLabel =
          STORE_STYLE_MAP[data?.storeStyle ?? form.storeStyle] || selectedStoreStyleLabel.value
        userInfo.province = data?.province ?? regionValue.provinceLabel
        userInfo.city = data?.city ?? regionValue.cityLabel
        userInfo.latitude = data?.latitude ?? coordinates.latitude
        userInfo.longitude = data?.longitude ?? coordinates.longitude
        localStorage.setItem('USER_INFO', JSON.stringify(userInfo))
      } catch (e) {
        console.error('USER_INFO 更新失败', e)
      }
    }

    router.push('/smartlightdashboard')
  } catch (error: any) {
    console.error(error)
    toast.show(error.message || '保存失败，请稍后重试', 'error')
    shakeFormCard()
  } finally {
    loading.value = false
  }
}

function handleSkip() {
  localStorage.setItem(
    'storeSetup',
    JSON.stringify({
      configured: false,
      skipped: true,
    }),
  )
  router.push('/smartlightdashboard')
}
</script>

<style scoped>
/* Override auth-shell width for the wider setup form */
:deep(.auth-shell) {
  width: min(100%, 720px);
}

/* Override form-header: add border-bottom, adjust margin */
:deep(.form-header) {
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(203, 213, 225, 0.45);
}

:deep(.form-header p) {
  margin: 0;
}

/* ===== Form grid layout ===== */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.single-row {
  grid-template-columns: 1fr;
}

/* ===== BaseSelect styles — match the new input design ===== */
.form-item :deep(.base-select) {
  width: 100%;
}

.form-item :deep(.select-trigger) {
  min-height: 46px;
  border-radius: 13px;
  border: 1.5px solid rgba(203, 213, 225, 0.85);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: none;
  font-size: 14px;
  color: #0f172a;
}

.form-item :deep(.select-trigger:hover) {
  border-color: #93c5fd;
}

.form-item :deep(.open .select-trigger) {
  border-color: #60a5fa;
  background: #fff;
  box-shadow:
    0 0 0 3px rgba(96, 165, 250, 0.15),
    0 0 0 1px rgba(37, 99, 235, 0.08);
}

.form-item :deep(.select-text.placeholder) {
  color: #94a3b8;
}

.form-item :deep(.select-option.active) {
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  color: #fff;
}

/* ===== Setup note ===== */
.setup-note {
  margin: 0 0 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
}

/* ===== Form actions & buttons ===== */
.form-actions {
  padding-top: 18px;
  border-top: 1px solid rgba(203, 213, 225, 0.45);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Use higher specificity to override AuthShell's :deep(.primary-btn) */
.form-actions .primary-btn,
.form-actions .secondary-btn,
.secondary-btn {
  height: 44px;
  padding: 0 20px;
  border-radius: 13px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-sizing: border-box;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
}

.form-actions .primary-btn {
  width: auto;
  border: 1px solid #2563eb;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow:
    0 8px 22px rgba(37, 99, 235, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.form-actions .primary-btn:hover:not(:disabled) {
  border-color: #1d4ed8;
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
  box-shadow:
    0 10px 26px rgba(37, 99, 235, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset;
  transform: translateY(-1px);
}

.form-actions .primary-btn:active:not(:disabled) {
  transform: translateY(0);
}

.form-actions .primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-actions .secondary-btn,
.secondary-btn {
  border: 1.5px solid rgba(203, 213, 225, 0.85);
  background: rgba(255, 255, 255, 0.66);
  color: #475569;
}

.form-actions .secondary-btn:hover,
.secondary-btn:hover {
  border-color: #94a3b8;
  background: #fff;
  color: #334155;
  transform: translateY(-1px);
}

.form-actions .secondary-btn:active,
.secondary-btn:active {
  transform: translateY(0);
}

/* ===== Night mode overrides ===== */
:global(.app-container.night-mode) :deep(.form-header),
:global(body:has(.app-container.night-mode)) :deep(.form-header) {
  border-bottom-color: rgba(71, 85, 105, 0.35);
}

:global(.app-container.night-mode) :deep(.select-trigger),
:global(body:has(.app-container.night-mode)) :deep(.select-trigger) {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(71, 85, 105, 0.45);
  color: #e2e8f0;
}

:global(.app-container.night-mode) :deep(.select-trigger:hover),
:global(body:has(.app-container.night-mode)) :deep(.select-trigger:hover) {
  border-color: rgba(96, 165, 250, 0.45);
}

:global(.app-container.night-mode) :deep(.open .select-trigger),
:global(body:has(.app-container.night-mode)) :deep(.open .select-trigger) {
  border-color: #60a5fa;
  background: rgba(30, 41, 59, 0.9);
  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.2),
    0 0 0 1px rgba(96, 165, 250, 0.12);
}

:global(.app-container.night-mode) :deep(.select-text.placeholder),
:global(body:has(.app-container.night-mode)) :deep(.select-text.placeholder) {
  color: #64748b;
}

:global(.app-container.night-mode) .setup-note,
:global(body:has(.app-container.night-mode)) .setup-note {
  color: #94a3b8;
}

:global(.app-container.night-mode) .form-actions,
:global(body:has(.app-container.night-mode)) .form-actions {
  border-top-color: rgba(71, 85, 105, 0.35);
}

:global(.app-container.night-mode) .form-actions .secondary-btn,
:global(body:has(.app-container.night-mode)) .form-actions .secondary-btn,
:global(.app-container.night-mode) .secondary-btn,
:global(body:has(.app-container.night-mode)) .secondary-btn {
  background: rgba(30, 41, 59, 0.55);
  border-color: rgba(71, 85, 105, 0.4);
  color: #cbd5e1;
}

:global(.app-container.night-mode) .form-actions .secondary-btn:hover,
:global(body:has(.app-container.night-mode)) .form-actions .secondary-btn:hover,
:global(.app-container.night-mode) .secondary-btn:hover,
:global(body:has(.app-container.night-mode)) .secondary-btn:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(148, 163, 184, 0.5);
  color: #e2e8f0;
}

/* ===== Responsive: 760px ===== */
@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions .primary-btn,
  .form-actions .secondary-btn,
  .secondary-btn {
    width: 100%;
    height: 43px;
  }
}
</style>
