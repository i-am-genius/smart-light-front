<template>
  <div class="store-profile-page">
    <div class="store-profile-shell">
      <div class="page-header">
        <div>
          <h1>店铺设置</h1>
          <p>修改门店基础信息，保存后将同步更新系统展示与推荐配置。</p>
        </div>

        <button type="button" class="btn-secondary" @click="goBack">
          返回设置页
        </button>
      </div>

      <div class="profile-card">
        <div class="form-grid">
          <div class="form-item">
            <label>店铺名称</label>
            <input
              v-model.trim="form.storeName"
              type="text"
              placeholder="请输入店铺名称"
            />
          </div>

          <div class="form-item">
            <label>店铺面积（㎡）</label>
            <input
              v-model.number="form.area"
              type="number"
              min="1"
              step="0.1"
              placeholder="请输入店铺面积，如 80"
            />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-item">
            <label>省份</label>
            <BaseSelect
              v-model="regionValue.province"
              :options="provinceOptions"
              placeholder="请选择省份"
              @change="handleProvinceChange"
            />
          </div>

          <div class="form-item">
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
          <div class="form-item">
            <label>店铺风格</label>
            <BaseSelect
              v-model="form.storeStyle"
              :options="storeStyleOptions"
              placeholder="请选择店铺风格"
            />
          </div>
        </div>

        <div v-if="errorText" class="error-text">{{ errorText }}</div>
        <div v-if="successText" class="success-text">{{ successText }}</div>

        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            :disabled="loading"
            @click="resetForm"
          >
            重置
          </button>

          <button
            type="button"
            class="btn-primary"
            :disabled="loading"
            @click="handleSave"
          >
            {{ loading ? '保存中...' : '保存店铺设置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseSelect from '../components/common/BaseSelect.vue'
import type { RegionCity, RegionProvince, RegionValue } from '../constants/china-region'
import { regions } from '../constants/china-region'
import { STORE_STYLE_OPTIONS, STORE_STYLE_MAP } from '../constants/store'
import { getCurrentStoreApi, setupCurrentStoreApi } from '../api/store'

const router = useRouter()
const loading = ref(false)
const errorText = ref('')
const successText = ref('')

const form = reactive({
  storeName: '',
  area: '' as number | string,
  storeStyle: '',
})

const initialForm = reactive({
  storeName: '',
  area: '' as number | string,
  storeStyle: '',
})

const regionValue = reactive<RegionValue>({
  province: '',
  provinceLabel: '',
  city: '',
  cityLabel: '',
})

const initialRegion = reactive<RegionValue>({
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

function findRegionValue(provinceLabel: string, cityLabel: string): RegionValue {
  const province = regions.find(item => item.label === provinceLabel)
  if (!province) {
    return {
      province: '',
      provinceLabel: provinceLabel || '',
      city: '',
      cityLabel: cityLabel || '',
    }
  }

  const city = province.cities.find(item => item.label === cityLabel)

  return {
    province: province.value,
    provinceLabel: province.label,
    city: city?.value || '',
    cityLabel: city?.label || cityLabel || '',
  }
}

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
    errorText.value = '请输入店铺名称'
    return false
  }
  if (form.area === '' || form.area === null || Number(form.area) <= 0) {
    errorText.value = '请输入正确的店铺面积'
    return false
  }
  if (!regionValue.provinceLabel) {
    errorText.value = '请选择省份'
    return false
  }
  if (!regionValue.cityLabel) {
    errorText.value = '请选择城市'
    return false
  }
  if (!form.storeStyle) {
    errorText.value = '请选择店铺风格'
    return false
  }
  return true
}

async function loadStore() {
  loading.value = true
  errorText.value = ''
  try {
    const store = await getCurrentStoreApi()
    if (!store) {
      errorText.value = '店铺信息为空'
      return
    }

    const region = findRegionValue(store.province || '', store.city || '')

    form.storeName = store.storeName || ''
    form.area = Number(store.area || '')
    form.storeStyle = store.storeStyle || ''

    initialForm.storeName = form.storeName
    initialForm.area = form.area
    initialForm.storeStyle = form.storeStyle

    regionValue.province = region.province
    regionValue.provinceLabel = region.provinceLabel
    regionValue.city = region.city
    regionValue.cityLabel = region.cityLabel

    initialRegion.province = region.province
    initialRegion.provinceLabel = region.provinceLabel
    initialRegion.city = region.city
    initialRegion.cityLabel = region.cityLabel
  } catch (error: any) {
    console.error('loadStore error =', error)
    const msg = error?.response?.data?.msg || error?.message || '加载店铺信息失败'
    errorText.value = msg
  } finally {
    loading.value = false
  }
}

function resetForm() {
  errorText.value = ''
  successText.value = ''

  form.storeName = initialForm.storeName
  form.area = initialForm.area
  form.storeStyle = initialForm.storeStyle

  regionValue.province = initialRegion.province
  regionValue.provinceLabel = initialRegion.provinceLabel
  regionValue.city = initialRegion.city
  regionValue.cityLabel = initialRegion.cityLabel
}

async function handleSave() {
  errorText.value = ''
  successText.value = ''

  if (!validateForm()) return

  loading.value = true
  try {
    const coordinates = regionValue.provinceLabel && regionValue.city
      ? parseCityCoordinates(regionValue.city)
      : {}
    const data = await setupCurrentStoreApi({
      storeName: form.storeName,
      area: Number(form.area),
      storeStyle: form.storeStyle,
      province: regionValue.provinceLabel,
      city: regionValue.cityLabel,
      ...coordinates,
    })

    const storage = localStorage.getItem('TOKEN') ? localStorage : sessionStorage
    const rawUserInfo =
      localStorage.getItem('USER_INFO') || sessionStorage.getItem('USER_INFO')

    storage.setItem(
      'storeSetup',
      JSON.stringify({
        configured: true,
        skipped: false,
        storeId: data?.id,
        storeName: data?.storeName ?? form.storeName,
        storeStyle: data?.storeStyle ?? form.storeStyle,
        province: data?.province ?? regionValue.provinceLabel,
        city: data?.city ?? regionValue.cityLabel,
        latitude: data?.latitude ?? coordinates.latitude,
        longitude: data?.longitude ?? coordinates.longitude,
        area: data?.area ?? Number(form.area),
      }),
    )

    if (rawUserInfo) {
      try {
        const userInfo = JSON.parse(rawUserInfo)
        userInfo.storeConfigured = true
        userInfo.storeId = data?.id
        userInfo.storeName = data?.storeName ?? form.storeName
        userInfo.storeStyle = data?.storeStyle ?? form.storeStyle
        userInfo.storeStyleLabel =
          STORE_STYLE_MAP[data?.storeStyle ?? form.storeStyle] || ''
        userInfo.province = data?.province ?? regionValue.provinceLabel
        userInfo.city = data?.city ?? regionValue.cityLabel
        userInfo.latitude = data?.latitude ?? coordinates.latitude
        userInfo.longitude = data?.longitude ?? coordinates.longitude
        storage.setItem('USER_INFO', JSON.stringify(userInfo))
      } catch (e) {
        console.error('USER_INFO 更新失败', e)
      }
    }

    initialForm.storeName = form.storeName
    initialForm.area = form.area
    initialForm.storeStyle = form.storeStyle

    initialRegion.province = regionValue.province
    initialRegion.provinceLabel = regionValue.provinceLabel
    initialRegion.city = regionValue.city
    initialRegion.cityLabel = regionValue.cityLabel

    successText.value = '店铺设置已保存'
  } catch (error: any) {
    console.error('save store error =', error)
    errorText.value = error?.response?.data?.msg || error?.message || '保存失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({
    path: '/smartlightdashboard',
    query: {
      tab: 'settings',
    },
  })
}

onMounted(() => {
  loadStore()
})
</script>

<style scoped>
.store-profile-page {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(79, 70, 229, 0.16), transparent 28%),
    radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.14), transparent 28%),
    linear-gradient(135deg, #f5f7fb 0%, #eef2ff 100%);
  box-sizing: border-box;
}

.store-profile-shell {
  max-width: 1080px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 30px;
  color: #111827;
}

.page-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.7;
}

.profile-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.single-row {
  grid-template-columns: 1fr;
}

.form-item {
  margin-bottom: 18px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.form-item input {
  width: 100%;
  height: 46px;
  border-radius: 14px;
  border: 1px solid #dbe3f0;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  transition: all 0.2s ease;
}

.form-item input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
}

.form-item :deep(.base-select) {
  width: 100%;
}

.form-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-primary,
.btn-secondary {
  height: 46px;
  padding: 0 22px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  color: #fff;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.22);
}

.btn-secondary {
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid #dbe3f0;
}

.error-text {
  color: #e74c3c;
  margin-top: 6px;
  margin-bottom: 6px;
}

.success-text {
  color: #16a34a;
  margin-top: 6px;
  margin-bottom: 6px;
}

@media (max-width: 768px) {
  .store-profile-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
  }

  .profile-card {
    padding: 20px;
    border-radius: 18px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
