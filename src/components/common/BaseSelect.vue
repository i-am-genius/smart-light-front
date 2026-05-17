<template>
  <div
    ref="rootRef"
    class="base-select"
    :class="{ open, disabled }"
  >
    <button
      type="button"
      class="select-trigger"
      :disabled="disabled"
      @click.stop="toggleOpen"
    >
      <span class="select-text" :class="{ placeholder: !selectedOption }">
        {{ selectedOption ? selectedOption.label : placeholder }}
      </span>
      <span class="select-arrow">⌄</span>
    </button>

    <Teleport to="body">
      <transition name="select-fade">
        <div
          v-if="open"
          ref="dropdownRef"
          class="select-dropdown"
          :style="dropdownStyle"
        >
        <div
          v-for="item in options"
          :key="String(item.value)"
          class="select-option"
          :class="{
            active: item.value === modelValue,
            disabled: item.disabled,
          }"
          @click.stop="handleSelect(item)"
        >
          {{ item.label }}
        </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface BaseSelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    options: BaseSelectOption[]
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '请选择',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', value: string | number): void
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedOption = computed(() => {
  return props.options.find(item => item.value === props.modelValue)
})

function toggleOpen() {
  if (props.disabled) return
  open.value = !open.value
}

function closeOpen() {
  open.value = false
}

function updateDropdownPosition() {
  if (!rootRef.value) return

  const rect = rootRef.value.getBoundingClientRect()
  const gap = 8
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const spaceBelow = viewportHeight - rect.bottom - gap
  const spaceAbove = rect.top - gap
  const maxHeight = Math.min(240, Math.max(160, Math.max(spaceBelow, spaceAbove) - 12))
  const openUp = spaceBelow < 180 && spaceAbove > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    top: openUp ? 'auto' : `${rect.bottom + gap}px`,
    bottom: openUp ? `${viewportHeight - rect.top + gap}px` : 'auto',
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '99999',
  }
}

function handleSelect(item: BaseSelectOption) {
  if (item.disabled) return
  emit('update:modelValue', item.value)
  emit('change', item.value)
  closeOpen()
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node | null
  if (!rootRef.value || !target) return
  if (!rootRef.value.contains(target) && !dropdownRef.value?.contains(target)) {
    closeOpen()
  }
}

watch(open, async (value) => {
  if (!value) return
  await nextTick()
  updateDropdownPosition()
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', updateDropdownPosition)
  window.addEventListener('orientationchange', updateDropdownPosition)
  window.addEventListener('scroll', updateDropdownPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('orientationchange', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})
</script>

<style scoped>
.base-select {
  position: relative;
  width: 100%;
  z-index: 1;
}
.base-select.open {
  z-index: 9999;
}

.select-trigger {
  width: 100%;
  min-height: 44px;
  padding: 0 42px 0 14px;
  border: 1px solid #dbe3f0;
  border-radius: 14px;
  background: #fff;
  color: #111827;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.2s ease;
  position: relative;
}

.select-trigger:hover {
  border-color: #c7d2e3;
}

.open .select-trigger {
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
}

.select-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-text.placeholder {
  color: #9ca3af;
}

.select-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: #6b7280;
  transition: transform 0.2s ease;
  pointer-events: none;
}

.open .select-arrow {
  transform: translateY(-50%) rotate(180deg);
}

.select-dropdown {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  padding: 8px;
  overflow-y: auto;
  box-sizing: border-box;
}

.select-option {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  color: #111827;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.select-option:hover {
  background: #f3f4f6;
}

.select-option.active {
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  color: #fff;
  font-weight: 600;
}

.select-option.disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.disabled .select-trigger {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

:global(.app-container.night-mode) .select-trigger,
:global(body:has(.app-container.night-mode)) .select-trigger {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.28);
  color: rgba(226, 232, 240, 0.92);
}

:global(.app-container.night-mode) .select-trigger:hover,
:global(body:has(.app-container.night-mode)) .select-trigger:hover {
  border-color: rgba(96, 165, 250, 0.5);
}

:global(.app-container.night-mode) .open .select-trigger,
:global(body:has(.app-container.night-mode)) .open .select-trigger {
  border-color: rgba(96, 165, 250, 0.72);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
}

:global(.app-container.night-mode) .select-text.placeholder,
:global(body:has(.app-container.night-mode)) .select-text.placeholder {
  color: rgba(203, 213, 225, 0.58);
}

:global(.app-container.night-mode) .select-arrow,
:global(body:has(.app-container.night-mode)) .select-arrow {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .select-dropdown,
:global(body:has(.app-container.night-mode)) .select-dropdown {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.48);
}

:global(.app-container.night-mode) .select-option,
:global(body:has(.app-container.night-mode)) .select-option {
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .select-option:hover,
:global(body:has(.app-container.night-mode)) .select-option:hover {
  background: rgba(30, 41, 59, 0.92);
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .select-option.active,
:global(body:has(.app-container.night-mode)) .select-option.active {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
}

:global(.app-container.night-mode) .select-option.disabled,
:global(body:has(.app-container.night-mode)) .select-option.disabled,
:global(.app-container.night-mode) .disabled .select-trigger,
:global(body:has(.app-container.night-mode)) .disabled .select-trigger {
  color: rgba(148, 163, 184, 0.62);
}

:global(.app-container.night-mode) .disabled .select-trigger,
:global(body:has(.app-container.night-mode)) .disabled .select-trigger {
  background: rgba(15, 23, 42, 0.48);
  border-color: rgba(148, 163, 184, 0.16);
}

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .select-trigger {
    min-height: 46px;
    border-radius: 12px;
  }

  .select-dropdown {
    border-radius: 14px;
  }

  .select-option {
    min-height: 44px;
  }
}
</style>
