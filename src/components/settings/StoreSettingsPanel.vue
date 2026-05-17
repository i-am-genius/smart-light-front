<template>
  <div class="settings-card store-toolbar-card">
    <div class="store-toolbar">
      <div class="store-toolbar-left">
        <h2 class="settings-title"> 店铺概览</h2>

        <div class="store-meta">
          <span class="meta-chip">
            <span class="meta-key">店铺</span>
            <span class="meta-value">{{ storeNameText }}</span>
          </span>

          <span class="meta-chip">
            <span class="meta-key">城市</span>
            <span class="meta-value">{{ cityText }}</span>
          </span>

          <span class="meta-chip">
            <span class="meta-key">风格</span>
            <span class="meta-value">{{ storeTypeText }}</span>
          </span>
        </div>
      </div>

      <div class="store-toolbar-actions">
        <button type="button" class="btn-primary" @click="toggleMode">
          {{ isNightMode ? '日间模式' : '夜间模式' }}
        </button>

        <button type="button" class="btn-secondary" @click="handleOpenStoreSettings">
          店铺设置
        </button>

        <button type="button" class="btn-logout" @click="handleLogout">
          退出登录
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RegionValue } from '../../constants/china-region'

export interface StoreSettingsValue {
  region: RegionValue
  storeType: string
  storeSize: string
  isNightMode: boolean
}

const props = defineProps<{
  modelValue: StoreSettingsValue
  storeName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: StoreSettingsValue): void
  (e: 'logout'): void
  (e: 'open-store-settings'): void
}>()

const isNightMode = computed(() => props.modelValue.isNightMode)

const storeNameText = computed(() => {
  return props.storeName || '未设置'
})

const cityText = computed(() => {
  return props.modelValue.region?.cityLabel || '未设置'
})

const storeTypeText = computed(() => {
  const raw = props.modelValue.storeType || ''
  return raw.split(',')[0] || '未设置'
})

function toggleMode() {
  emit('update:modelValue', {
    ...props.modelValue,
    isNightMode: !props.modelValue.isNightMode,
  })
}

function handleLogout() {
  emit('logout')
}

function handleOpenStoreSettings() {
  emit('open-store-settings')
}
</script>

<style scoped>
.store-toolbar-card {
  padding: 20px 22px;
}

.store-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.store-toolbar-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.settings-title {
  margin: 0;
  font-size: 18px;
}

.store-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.meta-key {
  font-size: 13px;
  color: #64748b;
  line-height: 1.2;
}

.meta-value {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.2;
}

.store-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-logout {
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  background: #fff1f0;
  color: #f53f3f;
  font-weight: 600;
  cursor: pointer;
}

.btn-logout:hover {
  background: #ffe4e1;
}

@media (max-width: 960px) {
  .store-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .store-toolbar-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .store-toolbar-card {
    padding: 14px 16px;
  }

  .store-toolbar-left {
    gap: 8px;
  }

  .settings-title {
    font-size: 16px;
  }

  .meta-chip {
    flex: 1 1 0;
    min-height: 28px;
    padding: 0 8px;
    gap: 5px;
    justify-content: center;
  }

  .meta-key {
    font-size: 10px;
  }

  .meta-value {
    font-size: 11px;
  }

  .store-toolbar-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .store-toolbar-actions .btn-primary,
  .store-toolbar-actions .btn-secondary,
  .store-toolbar-actions .btn-logout {
    flex: 1 1 0;
    min-width: 0;
    padding: 7px 10px;
    font-size: 13px;
    white-space: nowrap;
  }
}
</style>