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
            <svg class="theme-mode-svg" viewBox="0 0 24 24" focusable="false">
              <defs>
                <mask
                  id="theme-crescent-mask"
                  maskUnits="userSpaceOnUse"
                  maskContentUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="24"
                  height="24"
                >
                  <rect width="24" height="24" fill="white" />
                  <circle
                    class="theme-mask-cutout"
                    cx="15.2"
                    cy="9.2"
                    r="4.85"
                    fill="black"
                  />
                </mask>
              </defs>

              <g class="theme-sun-rays">
                <line class="theme-sun-ray" x1="12" y1="1.75" x2="12" y2="4.25" />
                <line class="theme-sun-ray" x1="12" y1="19.75" x2="12" y2="22.25" />
                <line class="theme-sun-ray" x1="1.75" y1="12" x2="4.25" y2="12" />
                <line class="theme-sun-ray" x1="19.75" y1="12" x2="22.25" y2="12" />
                <line class="theme-sun-ray" x1="4.75" y1="4.75" x2="6.5" y2="6.5" />
                <line class="theme-sun-ray" x1="17.5" y1="17.5" x2="19.25" y2="19.25" />
                <line class="theme-sun-ray" x1="4.75" y1="19.25" x2="6.5" y2="17.5" />
                <line class="theme-sun-ray" x1="17.5" y1="6.5" x2="19.25" y2="4.75" />
              </g>

              <circle
                class="theme-orb"
                cx="12"
                cy="12"
                r="6.1"
                mask="url(#theme-crescent-mask)"
              />
              <path class="theme-star" d="M19.15 4.65v2.7M17.8 6h2.7" />
            </svg>
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
  align-items: center;
  gap: 0;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  background: none;
  border: none;
  border-radius: 0;
  white-space: nowrap;
}

.meta-chip + .meta-chip::before {
  content: '';
  display: inline-block;
  width: 1px;
  height: 16px;
  margin: 0 12px;
  background: #cbd5e1;
}

.meta-key {
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
}

.meta-value {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
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
  --theme-morph-duration: 420ms;
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.theme-mode-svg {
  display: block;
  width: 22px;
  height: 22px;
  overflow: visible;
  color: #d97706;
  transform: rotate(0deg) scale(1);
  transition:
    color 300ms ease,
    transform var(--theme-morph-duration) cubic-bezier(.34, 1.56, .64, 1);
}

.theme-sun-rays,
.theme-orb,
.theme-mask-cutout,
.theme-star {
  transform-box: view-box;
  transform-origin: 12px 12px;
}

.theme-sun-rays {
  opacity: 0.92;
  transform: rotate(0deg) scale(1);
  transition:
    opacity 180ms ease 120ms,
    transform 320ms cubic-bezier(.34, 1.56, .64, 1) 100ms;
}

.theme-sun-ray {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.theme-orb {
  fill: currentColor;
  transform: scale(1);
  transition: transform var(--theme-morph-duration) cubic-bezier(.34, 1.56, .64, 1);
}

.theme-mask-cutout {
  opacity: 0;
  transform: translate(6.5px, -6.5px) scale(0.65);
  transform-origin: 15.2px 9.2px;
  transition:
    opacity 120ms ease,
    transform 300ms cubic-bezier(.4, 0, .2, 1);
}

.theme-star {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  opacity: 0;
  transform: translate(-1.4px, 1.4px) rotate(-20deg) scale(0.25);
  transform-origin: 19.15px 6px;
  transition:
    opacity 120ms ease,
    transform 220ms cubic-bezier(.34, 1.56, .64, 1);
}

.store-action-btn--theme.is-night .theme-mode-svg {
  color: #818cf8;
  transform: rotate(-5deg) scale(1.01);
}

.store-action-btn--theme.is-night .theme-sun-rays {
  opacity: 0;
  transform: rotate(38deg) scale(0.28);
  transition-delay: 0ms;
}

.store-action-btn--theme.is-night .theme-orb {
  transform: scale(1.03);
}

.store-action-btn--theme.is-night .theme-mask-cutout {
  opacity: 1;
  transform: translate(0, 0) scale(1);
  transition-delay: 70ms;
}

.store-action-btn--theme.is-night .theme-star {
  opacity: 1;
  transform: translate(0, 0) rotate(0deg) scale(1);
  transition-delay: 220ms, 190ms;
}

.theme-mode-text,
.store-action-text {
  line-height: 1;
}

.theme-mode-text {
  transition: color 240ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .theme-mode-svg,
  .theme-sun-rays,
  .theme-orb,
  .theme-mask-cutout,
  .theme-star,
  .theme-mode-text {
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
}

:global(.app-container.night-mode) .meta-key {
  color: #94a3b8;
}

:global(.app-container.night-mode) .meta-value {
  color: #e2e8f0;
}

.meta-chip + .meta-chip::before {
  background: #cbd5e1;
}

:global(.app-container.night-mode) .meta-chip + .meta-chip::before {
  background: rgba(148, 163, 184, 0.4);
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
    padding: 10px 12px;
  }

  .store-toolbar {
    gap: 8px;
  }

  .store-toolbar-left {
    gap: 5px;
  }

  .settings-title {
    margin-bottom: 0;
    font-size: 16px;
  }

  .meta-chip {
    gap: 3px;
    padding: 1px 0;
    white-space: nowrap;
  }

  .meta-key {
    font-size: 11px;
  }

  .meta-value {
    font-size: 12px;
  }

  .meta-chip + .meta-chip::before {
    height: 13px;
    margin: 0 8px;
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
