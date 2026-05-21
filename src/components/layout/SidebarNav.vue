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
        <span class="sidebar-icon" :class="animatedTab === tab.key ? 'anim-' + tab.key : ''" v-html="tab.icon"></span>
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

const tabs: { key: DashboardTab; label: string; icon: string }[] = [
  { key: 'main', label: '实时灯控', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path class="icon-sun-ray ray-1" d="M12 2v2"/><path class="icon-sun-ray ray-2" d="M12 20v2"/><path class="icon-sun-ray ray-3" d="M4.93 4.93l1.41 1.41"/><path class="icon-sun-ray ray-4" d="M17.66 17.66l1.41 1.41"/><path class="icon-sun-ray ray-5" d="M2 12h2"/><path class="icon-sun-ray ray-6" d="M20 12h2"/><path class="icon-sun-ray ray-7" d="M6.34 17.66l-1.41 1.41"/><path class="icon-sun-ray ray-8" d="M19.07 4.93l-1.41 1.41"/><circle class="icon-sun-core" cx="12" cy="12" r="5"/></svg>' },
  { key: 'flow', label: '数据仪表盘', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect class="icon-bar icon-bar-1" x="3" y="12" width="4" height="9" rx="1"/><rect class="icon-bar icon-bar-2" x="10" y="7" width="4" height="14" rx="1"/><rect class="icon-bar icon-bar-3" x="17" y="3" width="4" height="18" rx="1"/></svg>' },
  { key: 'settings', label: '设置', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle class="icon-gear-center" cx="12" cy="12" r="3"/><path class="icon-gear-tooth" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
  { key: 'firmware', label: '固件管理', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect class="icon-device-body" x="4" y="2" width="16" height="20" rx="2"/><path class="icon-device-top-line" d="M9 6h6"/><path class="icon-device-dot" d="M12 18h.01"/></svg>' },
]

const tabRefs = ref<Record<string, HTMLElement | null>>({})
const phase = ref<'idle' | 'collapse' | 'slide' | 'expand'>('idle')
const targetKey = ref(props.modelValue)
const domReady = ref(false)
const animatedTab = ref<string | null>(null)
let animTimer: number | undefined

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
  if (animTimer) clearTimeout(animTimer)
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
  if (key !== targetKey.value) {
    animatedTab.value = key as string
    if (animTimer) clearTimeout(animTimer)
    animTimer = window.setTimeout(() => {
      animatedTab.value = null
    }, 420)
  }
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
    animatedTab.value = key as string
    if (animTimer) clearTimeout(animTimer)
    animTimer = window.setTimeout(() => {
      animatedTab.value = null
    }, 420)
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
  display: flex;
  align-items: center;
  gap: 12px;
  width: 90%;
  margin: 8px auto;
  padding: 11px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.2s;
  color: #333;
  user-select: none;
}

.sidebar li.active,
.sidebar li:hover {
  background: rgba(64, 158, 255, 0.12);
  color: var(--primary);
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.2s, transform 0.2s;
}

.sidebar li:hover .sidebar-icon {
  opacity: 0.9;
}

.sidebar li.active .sidebar-icon {
  opacity: 1;
  transform: scale(1.08);
}

.sidebar-nav-text {
  white-space: nowrap;
  line-height: 1;
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

.sidebar li:active {
  transform: translateX(2px) scale(0.98);
}

/* ---- per-tab icon click animations ---- */

/* main: sun burst — core subtle pulse, rays expand from center */
.anim-main :deep(.icon-sun-core) {
  animation: navSunBurst 0.3s cubic-bezier(.2,.8,.2,1) both;
  transform-box: fill-box;
  transform-origin: center;
}

.anim-main :deep(.icon-sun-ray) {
  animation: navSunRays 0.34s cubic-bezier(.2,.8,.2,1) both;
  transform-box: view-box;
  transform-origin: 12px 12px;
}

.anim-main :deep(.ray-1) { animation-delay: 0s; }
.anim-main :deep(.ray-2) { animation-delay: 0.025s; }
.anim-main :deep(.ray-3) { animation-delay: 0.05s; }
.anim-main :deep(.ray-4) { animation-delay: 0.075s; }
.anim-main :deep(.ray-5) { animation-delay: 0.1s; }
.anim-main :deep(.ray-6) { animation-delay: 0.125s; }
.anim-main :deep(.ray-7) { animation-delay: 0.15s; }
.anim-main :deep(.ray-8) { animation-delay: 0.175s; }

/* flow: bar pulse — bars bounce up from bottom with stagger */
.anim-flow :deep(.icon-bar) {
  animation: navBarPulse 0.34s cubic-bezier(.2,.8,.2,1) both;
  transform-box: fill-box;
  transform-origin: bottom;
}

.anim-flow :deep(.icon-bar-1) { animation-delay: 0s; }
.anim-flow :deep(.icon-bar-2) { animation-delay: 0.08s; }
.anim-flow :deep(.icon-bar-3) { animation-delay: 0.16s; }

/* settings: gear turn 90deg — 8-tooth symmetry, no visible snap-back */
.anim-settings :deep(.icon-gear-center),
.anim-settings :deep(.icon-gear-tooth) {
  animation: navGearTurn 0.42s cubic-bezier(.2,.7,.15,1) both;
  transform-box: fill-box;
  transform-origin: center;
}

/* firmware: top line grows from left, then dot flashes */
.anim-firmware :deep(.icon-device-top-line) {
  animation: firmwareTopLineGrow 0.4s cubic-bezier(.34,.6,.15,1) both;
  transform-box: fill-box;
  transform-origin: left center;
}

.anim-firmware :deep(.icon-device-dot) {
  animation: firmwareDotConfirm 0.28s cubic-bezier(.2,.8,.2,1) 0.22s both;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes navSunBurst {
  0% { transform: scale(0.88); }
  55% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

@keyframes navSunRays {
  0% { transform: scale(0.35); opacity: 0.25; }
  65% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes navBarPulse {
  0% { transform: scaleY(0.3); }
  55% { transform: scaleY(1.12); }
  100% { transform: scaleY(1); }
}

@keyframes navGearTurn {
  0% { transform: rotate(0deg); }
  85% { transform: rotate(140deg); }
  100% { transform: rotate(135deg); }
}

@keyframes firmwareTopLineGrow {
  0% { transform: scaleX(0.18); opacity: 0.45; }
  16% { opacity: 1; }
  80% { transform: scaleX(1.08); opacity: 1; }
  100% { transform: scaleX(1); opacity: 1; }
}

@keyframes firmwareDotConfirm {
  0% { transform: scale(0.75); opacity: 0.45; }
  45% { transform: scale(1.7); opacity: 1; }
  100% { transform: scale(1); opacity: 0.9; }
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
    padding: 10px 10px;
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
    flex-direction: column;
    gap: 3px;
    width: auto;
    margin: 0;
    padding: 8px 6px;
    border-radius: 14px;
    text-align: center;
    font-size: 12px;
  }

  .sidebar li:hover {
    transform: none;
  }

  .sidebar li:active {
    transform: scale(0.96);
  }

  .sidebar-icon {
    width: 18px;
    height: 18px;
  }

  .indicator {
    position: absolute;
    background: var(--primary, #2563eb);
  }
}
</style>
