<template>
  <div class="setup-page">
    <div class="setup-shell">
      <div class="setup-side">
        <div>
          <div class="brand-badge">STORE SETUP</div>
          <h1>完善你的门店信息</h1>
          <p class="side-desc">
            为了生成更适合你店铺风格与展示场景的智能照明方案，
            请先完成门店基础信息配置。
          </p>
        </div>

        <div class="feature-list">
          <div class="feature-card">
            <h3>店铺基础档案</h3>
            <p>设置门店名称、面积、城市，便于后续统一管理</p>
          </div>
          <div class="feature-card">
            <h3>风格智能适配</h3>
            <p>根据门店风格与经营场景，推荐更合适的灯光策略</p>
          </div>
          <div class="feature-card">
            <h3>后续设备联动</h3>
            <p>完成初始化后，可继续接入灯具、传感器与摄像头设备</p>
          </div>
          <div class="feature-card">
            <h3>支持稍后完善</h3>
            <p>你也可以先进入系统，之后再到设置页补充信息</p>
          </div>
        </div>

        <div class="tag-group">
          <span>门店配置</span>
          <span>风格适配</span>
          <span>场景推荐</span>
          <span>策略定制</span>
        </div>
      </div>

      <div class="setup-main">
        <div class="form-card" :class="{ shake: shakingFormCard }">
          <div class="form-header">
            <h2>完善店铺信息</h2>
            <p>填写完成后即可进入系统首页</p>
          </div>

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

            <div class="form-grid">
              <div class="form-item" :class="{ shake: shakingStoreStyle }">
                <label>店铺风格</label>
                  <BaseSelect
                    v-model="form.storeStyle"
                    :options="storeStyleOptions"
                    placeholder="请选择店铺风格"
                  />
              </div>

              <div class="form-item">
                <label>经营场景</label>
                  <BaseSelect
                    v-model="form.businessScene"
                    :options="businessSceneOptions"
                    placeholder="请选择经营场景"
                  />
              </div>
            </div>

            <div class="form-actions">
              <button class="secondary-btn" type="button" @click="handleSkip">
                稍后完善
              </button>
              <button class="primary-btn" type="submit" :disabled="loading">
                {{ loading ? '保存中...' : '保存并进入系统' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
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

const businessSceneOptions = [
  { label: '日常营业', value: 'daily' },
  { label: '橱窗展示', value: 'window' },
  { label: '主题陈列', value: 'display' },
  { label: '直播展示', value: 'live' },
]
const form = reactive({
  storeName: '',
  storeArea: '' as number | string,
  storeStyle: '',
  businessScene: '',
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
.setup-page {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(79, 70, 229, 0.16), transparent 28%),
    radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.14), transparent 28%),
    linear-gradient(135deg, #f5f7fb 0%, #eef2ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.setup-shell {
  width: 1180px;
  min-height: 720px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 28px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
  display: grid;
  grid-template-columns: 1.02fr 0.98fr;
}

.setup-side {
  padding: 56px 48px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.95), rgba(79, 70, 229, 0.92));
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.brand-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 12px;
  letter-spacing: 1px;
  margin-bottom: 18px;
}

.setup-side h1 {
  margin: 0 0 14px;
  font-size: 34px;
  line-height: 1.25;
}

.side-desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: rgba(255,255,255,0.9);
}

.feature-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 36px 0;
}

.feature-card {
  padding: 18px 16px;
  border-radius: 18px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.14);
}

.feature-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.feature-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(255,255,255,0.88);
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-group span {
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.18);
}

.setup-main {
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-card {
  width: 100%;
  max-width: 520px;
  padding: 36px 34px;
  border-radius: 24px;
  background: rgba(255,255,255,0.92);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.form-header h2 {
  margin: 0 0 8px;
  font-size: 28px;
  color: #111827;
}

.form-header p {
  margin: 0 0 28px;
  color: #6b7280;
  font-size: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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

.form-item input,
.form-item select {
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

.form-item input:focus,
.form-item select:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
}

.form-item select:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.primary-btn,
.secondary-btn {
  height: 46px;
  padding: 0 22px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
}

.primary-btn {
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  color: #fff;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.22);
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.secondary-btn {
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid #dbe3f0;
}

@media (max-width: 960px) {
  .setup-shell {
    grid-template-columns: 1fr;
  }

  .feature-list {
    grid-template-columns: 1fr;
  }

  .setup-side {
    padding: 36px 28px;
  }

  .setup-main {
    padding: 24px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .form-actions {
    flex-direction: column;
  }

  .primary-btn,
  .secondary-btn {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .setup-side {
    padding: 28px 20px;
  }

  .brand-badge {
    font-size: 10px;
    padding: 4px 10px;
    margin-bottom: 12px;
  }

  .setup-side h1 {
    font-size: 20px;
  }

  .side-desc {
    font-size: 11px;
    line-height: 1.4;
  }

  .feature-list {
    gap: 10px;
    margin: 20px 0;
  }

  .feature-card {
    padding: 14px;
  }

  .feature-card h3 {
    font-size: 13px;
  }

  .feature-card p {
    font-size: 11px;
  }

  .tag-group {
    gap: 6px;
  }

  .tag-group span {
    font-size: 10px;
    padding: 4px 8px;
  }

  .setup-main {
    padding: 16px;
  }

  .form-card {
    padding: 24px 20px;
  }

  .form-header h2 {
    font-size: 20px;
  }

  .form-header p {
    font-size: 12px;
    margin-bottom: 20px;
  }

  .form-item {
    margin-bottom: 14px;
  }

  .form-item label {
    font-size: 11px;
    margin-bottom: 4px;
  }

  .form-item input,
  .form-item select {
    height: 40px;
    font-size: 13px;
    border-radius: 10px;
    padding: 0 10px;
  }

  .primary-btn,
  .secondary-btn {
    height: 42px;
    font-size: 13px;
    border-radius: 10px;
  }
}
</style>
