<template>
  <div class="region-picker">
    <div class="region-input" @click="openPopup">
      <span v-if="displayText">{{ displayText }}</span>
      <span v-else class="region-placeholder">请选择省份 / 城市</span>
      <span class="region-arrow">▾</span>
    </div>

    <div v-if="visible" class="region-mask" @click.self="closePopup">
      <div class="region-dialog">
        <div class="region-dialog-header">
          <div class="region-dialog-title">选择省市</div>
          <button class="region-close" @click="closePopup">×</button>
        </div>

        <div class="region-dialog-body">
          <div class="region-province-list">
            <div
              v-for="province in regions"
              :key="province.value"
              class="region-province-item"
              :class="{ active: currentProvince?.value === province.value }"
              @click="selectProvince(province.value)"
            >
              {{ province.label }}
            </div>
          </div>

          <div class="region-city-list">
            <div class="region-city-title">
              {{ currentProvince?.label || '请选择省份' }}
            </div>

            <div class="region-city-grid">
              <div
                v-for="city in currentCities"
                :key="city.value"
                class="region-city-item"
                :class="{ active: modelValue.city === city.value }"
                @click="selectCity(city.value)"
              >
                {{ city.label }}
              </div>
            </div>
          </div>
        </div>

        <div class="region-dialog-footer">
          <button class="btn-secondary" @click="closePopup">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { regions } from '../../constants/china-region'
import type { RegionValue } from '../../constants/china-region'

const props = defineProps<{
  modelValue: RegionValue
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RegionValue): void
}>()

const visible = ref(false)
const selectedProvinceValue = ref(props.modelValue.province || regions[0].value)

watch(
  () => props.modelValue.province,
  (val) => {
    if (val) {
      selectedProvinceValue.value = val
    }
  },
)

const currentProvince = computed(() => {
  return regions.find(item => item.value === selectedProvinceValue.value) || regions[0]
})

const currentCities = computed(() => currentProvince.value?.cities || [])

const displayText = computed(() => {
  if (!props.modelValue.provinceLabel || !props.modelValue.cityLabel) return ''
  return `${props.modelValue.provinceLabel} / ${props.modelValue.cityLabel}`
})

function openPopup() {
  visible.value = true
}

function closePopup() {
  visible.value = false
}

function selectProvince(provinceValue: string) {
  selectedProvinceValue.value = provinceValue
}

function selectCity(cityValue: string) {
  const province = currentProvince.value
  if (!province) return

  const city = province.cities.find(item => item.value === cityValue)
  if (!city) return

  emit('update:modelValue', {
    province: province.value,
    provinceLabel: province.label,
    city: city.value,
    cityLabel: city.label,
  })

  closePopup()
}
</script>

<style scoped>
.region-input {
  min-width: 170px;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.region-placeholder {
  color: #909399;
}

.region-arrow {
  color: #909399;
}

.region-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1200;
}

.region-dialog {
  width: 760px;
  max-width: 92vw;
  height: 520px;
  max-height: 86vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.region-dialog-header {
  height: 60px;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ebeef5;
}

.region-dialog-title {
  font-size: 18px;
  font-weight: 600;
}

.region-close {
  border: none;
  background: transparent;
  font-size: 26px;
  cursor: pointer;
  color: #909399;
}

.region-dialog-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.region-province-list {
  width: 220px;
  border-right: 1px solid #ebeef5;
  overflow-y: auto;
  background: #fafafa;
}

.region-province-item {
  padding: 14px 18px;
  cursor: pointer;
  transition: background 0.2s;
}

.region-province-item:hover,
.region-province-item.active {
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.region-city-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.region-city-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.region-city-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.region-city-item {
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background: #fff;
}

.region-city-item:hover,
.region-city-item.active {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.08);
  color: #409eff;
}

.region-dialog-footer {
  height: 60px;
  padding: 0 20px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-top: 1px solid #ebeef5;
}

.region-picker {
  min-width: 170px;
}
</style>