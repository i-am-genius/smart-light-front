<template>
  <nav class="sidebar" ref="sidebarRef">
    <div
      class="indicator"
      :class="'phase-' + phase"
      :style="indicatorStyle"
    />
    <ul>
      <li
        v-for="tab in tabs"
        :key="tab.key"
        :ref="el => setTabRef(tab.key, el)"
        class="sidebar-item sidebar-nav-item"
        :class="{ active: modelValue === tab.key }"
        @click="handleTabClick(tab.key)"
      >
        <span class="sidebar-nav-text">{{ tab.label }}</span>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DashboardTab } from '../../types/device'

const props = defineProps<{
  modelValue: DashboardTab
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: DashboardTab): void
}>()

const route = useRoute()
const router = useRouter()
const sidebarRef = ref<HTMLElement | null>(null)

const tabs: { key: DashboardTab; label: string }[] = [
  { key: 'main', label: '实时灯控' },
  { key: 'flow', label: '数据仪表盘' },
  { key: 'settings', label: '设置' },
  { key: 'firmware', label: '固件管理' },
]

const tabRefs = ref<Record<string, HTMLElement | null>>({})
const phase = ref<'idle' | 'collapse' | 'slide' | 'expand'>('idle')
const targetKey = ref(props.modelValue)
const domReady = ref(false)

function setTabRef(key: DashboardTab, el: unknown) {
  tabRefs.value[key] = el as HTMLElement | null
}

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

function onResize() {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  nextTick(() => {
    domReady.value = true
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

const isMobile = computed(() => windowWidth.value <= 768)

function getTabRect(key: DashboardTab) {
  const el = tabRefs.value[key]
  const sidebar = sidebarRef.value
  if (!el || !sidebar) return null
  const tabRect = el.getBoundingClientRect()
  const sidebarRect = sidebar.getBoundingClientRect()
  if (isMobile.value) {
    return {
      cx: tabRect.left - sidebarRect.left + tabRect.width / 2,
      cy: tabRect.top - sidebarRect.top + tabRect.height,
      w: tabRect.width,
    }
  }
  return {
    cx: 0,
    cy: tabRect.top - sidebarRect.top + tabRect.height / 2,
    w: 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const indicatorStyle = computed<any>(() => {
  void domReady.value
  const rect = getTabRect(targetKey.value)
  if (!rect) return { visibility: 'hidden' }
  if (isMobile.value) {
    return {
      left: `${rect.cx}px`,
      bottom: '6px',
      width: phase.value === 'collapse' || phase.value === 'slide' ? '4px' : `${rect.w * 0.6}px`,
      height: phase.value === 'collapse' || phase.value === 'slide' ? '4px' : '3px',
      borderRadius: phase.value === 'collapse' || phase.value === 'slide' ? '50%' : '999px',
      transform: 'translateX(-50%)',
    }
  }
  return {
    left: '-2px',
    top: `${rect.cy}px`,
    width: '4px',
    height: phase.value === 'collapse' || phase.value === 'slide' ? '4px' : `${Math.round((tabRefs.value[targetKey.value]?.offsetHeight ?? 40) * 0.6)}px`,
    borderRadius: phase.value === 'collapse' || phase.value === 'slide' ? '50%' : '2px',
    transform: 'translateY(-50%)',
  }
})

let phaseTimer: number | undefined

function handleTabClick(key: DashboardTab) {
  if (route.name !== 'smartlightdashboard' || route.query.tab !== key) {
    router.push({ path: '/smartlightdashboard', query: { tab: key } })
  } else {
    emit('update:modelValue', key)
  }
  animateIndicator(key)
}

function animateIndicator(key: DashboardTab) {
  if (phaseTimer) clearTimeout(phaseTimer)

  phase.value = 'collapse'
  phaseTimer = window.setTimeout(() => {
    targetKey.value = key
    phase.value = 'slide'
    phaseTimer = window.setTimeout(() => {
      phase.value = 'expand'
      phaseTimer = window.setTimeout(() => {
        phase.value = 'idle'
      }, 200)
    }, 380)
  }, 150)
}

watch(() => props.modelValue, (key) => {
  if (key !== targetKey.value) {
    nextTick(() => animateIndicator(key))
  }
}, { flush: 'post' })


</script>

<style scoped>
.sidebar {
  width: 180px;

  position: fixed;
  left: 24px;
  top: 24px;
  z-index: 100;

  height: calc(100vh - 48px);
  min-height: auto;

  padding: 28px 10px;

  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);

  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar ul {
  width: 100%;
  list-style: none;
  padding: 0;
  margin: 0;

  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sidebar li {
  position: relative;
  width: 90%;
  margin: 8px auto;
  padding: 11px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.2s;
  color: #333;
}

.sidebar li.active,
.sidebar li:hover {
  background: rgba(64, 158, 255, 0.12);
  color: var(--primary);
}

.indicator {
  position: absolute;
  z-index: 5;
  background: var(--primary, #2563eb);
  pointer-events: none;
}

.phase-idle {
  transition:
    top 0.15s cubic-bezier(0.25, 0.1, 0.25, 1),
    left 0.15s cubic-bezier(0.25, 0.1, 0.25, 1),
    height 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    border-radius 0.2s ease;
}

.phase-collapse {
  transition:
    height 0.15s cubic-bezier(0.55, 0, 1, 0.45),
    border-radius 0.12s ease,
    width 0.15s cubic-bezier(0.55, 0, 1, 0.45);
}

.phase-slide {
  transition:
    top 0.38s cubic-bezier(0.34, 1.56, 0.64, 1.0),
    left 0.38s cubic-bezier(0.34, 1.56, 0.64, 1.0);
}

.phase-expand {
  transition:
    height 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    border-radius 0.15s ease,
    width 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.sidebar li:hover {
  transform: translateX(2px);
}

:global(.night-mode) .sidebar {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.night-mode) .sidebar li {
  color: rgba(226, 232, 240, 0.82);
  opacity: 1;
}

:global(.night-mode) .sidebar li:hover {
  background: rgba(59, 130, 246, 0.12);
  color: rgba(248, 250, 252, 0.96);
}

:global(.night-mode) .sidebar li.active {
  background: rgba(64, 158, 255, 0.2);
  color: #eaf2ff;
}

:global(.night-mode) .indicator {
  background: #60a5fa;
}

@media (max-width: 768px) {
  .sidebar {
    position: relative;
    left: auto;
    top: auto;
    z-index: auto;
    width: calc(100% - 24px);
    height: auto;
    min-height: 0;
    margin: 12px;
    padding: 8px;
    border-radius: 14px;

    display: block;
  }

  .sidebar ul {
    width: 100%;
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 0;
    margin: 0;
  }

  .sidebar li {
    flex: 1;
    width: auto;
    margin: 0;
    padding: 10px 6px;
    border-radius: 12px;
    text-align: center;
    font-size: 12px;
  }

  .sidebar li:hover {
    transform: none;
  }

  .indicator {
    position: absolute;
    background: var(--primary, #2563eb);
  }
}
</style>
