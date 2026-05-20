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
        <button
          type="button"
          class="store-action-btn store-action-btn--theme"
          :class="{ 'is-night': isNightMode }"
          :aria-pressed="isNightMode"
          aria-label="切换日间夜间模式"
          @click="toggleMode"
        >
          <span class="theme-mode-icon" aria-hidden="true">
            <span class="theme-mode-symbol theme-mode-symbol--sun">☀</span>
            <span class="theme-mode-symbol theme-mode-symbol--moon">☾</span>
          </span>
          <span class="theme-mode-text">{{ isNightMode ? '夜间' : '日间' }}</span>
        </button>

        <button
          type="button"
          class="store-action-btn store-action-btn--neutral btn-secondary"
          @click="handleOpenStoreSettings"
        >
          <span class="store-action-text">店铺设置</span>
        </button>

        <button
          type="button"
          class="store-action-btn store-action-btn--danger btn-logout"
          @click="handleLogout"
        >
          <span class="store-action-text">退出登录</span>
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
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  justify-content: flex-end;
  flex-shrink: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.store-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex: 0 0 auto;
  width: 104px;
  height: 38px;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 16px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
  backdrop-filter: blur(12px);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition:
    background .22s ease,
    border-color .22s ease,
    box-shadow .22s ease,
    color .22s ease;
}

.store-action-btn:hover {
  border-color: rgba(203, 213, 225, 0.96);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.065);
}

.store-action-btn:active {
  background: rgba(248, 250, 252, 0.82);
}

.store-action-btn:focus-visible {
  outline: none;
  border-color: rgba(148, 163, 184, 0.9);
  box-shadow:
    0 8px 20px rgba(15, 23, 42, 0.045),
    0 0 0 3px rgba(148, 163, 184, 0.18);
}

.store-action-btn--theme {
  width: 104px;
  padding: 0 14px;
  color: #475569;
}

.store-action-btn--neutral {
  color: #334155;
}

.store-action-btn--danger {
  border-color: rgba(248, 113, 113, 0.2);
  color: #ef4444;
}

.store-action-btn--danger:hover,
.store-action-btn--danger:focus-visible {
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(254, 242, 242, 0.72);
  color: #dc2626;
}

.theme-mode-icon {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.theme-mode-symbol {
  grid-area: 1 / 1;
  font-size: 18px;
  line-height: 1;
  opacity: 1;
  transform: scale(1) rotate(0deg);
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    color 0.22s ease;
}

.theme-mode-symbol--sun {
  color: #c26a14;
  opacity: 0.82;
}

.theme-mode-symbol--moon {
  color: #6366f1;
  opacity: 0;
  transform: scale(0.65) rotate(-24deg);
}

.store-action-btn--theme.is-night .theme-mode-symbol--sun {
  opacity: 0;
  transform: scale(0.65) rotate(30deg);
}

.store-action-btn--theme.is-night .theme-mode-symbol--moon {
  opacity: 0.86;
  transform: scale(1) rotate(0deg);
}

.theme-mode-text,
.store-action-text {
  line-height: 1;
}

:global(.app-container.night-mode) .store-action-btn {
  border-color: rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

:global(.app-container.night-mode) .store-action-btn:hover,
:global(.app-container.night-mode) .store-action-btn:focus-visible {
  border-color: rgba(203, 213, 225, 0.32);
  background: rgba(255, 255, 255, 0.16);
}

:global(.app-container.night-mode) .store-action-btn--danger {
  color: #f87171;
}

:global(.app-container.night-mode) .store-action-btn--danger:hover,
:global(.app-container.night-mode) .store-action-btn--danger:focus-visible {
  background: rgba(127, 29, 29, 0.2);
  color: #fca5a5;
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
    flex-wrap: nowrap;
    width: 100%;
    gap: 8px;
  }

  .store-toolbar-actions .store-action-btn {
    flex: 1 1 0;
    min-width: 0;
    height: 40px;
    padding: 0 10px;
    font-size: 13px;
    white-space: nowrap;
  }

  .store-toolbar-actions .store-action-btn--theme {
    flex: 1 1 0;
  }
}
</style>
