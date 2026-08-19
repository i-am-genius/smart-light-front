<template>
  <div class="smart-lighting-launcher" :class="[`phase-${phase}`]">
    <button
      type="button"
      class="smart-lighting-button"
      :disabled="running"
      :title="buttonTitle"
      @click="runSmartLighting"
    >
      <span class="smart-lighting-pattern" aria-hidden="true"></span>
      <span class="smart-lighting-sheen" aria-hidden="true"></span>
      <span class="smart-lighting-icon" aria-hidden="true">✦</span>
      <span class="smart-lighting-copy">
        <strong>{{ buttonLabel }}</strong>
        <small v-if="running">{{ progressText }}</small>
      </span>
      <span v-if="running" class="smart-lighting-orbit" aria-hidden="true"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  createCamCaptureBatch,
  getCamRoiConfig,
  updateDevice,
} from '../../api/device'
import type { DeviceItem } from '../../types/device'
import { useToast } from '../../composables/useToast'
import { getErrorMessage } from '../../utils/error'
import {
  buildSmartLightingLampPayload,
  getSmartLightingBatchTasks,
  getSmartLightingCamera,
  getSmartLightingLamps,
  isSmartLightingTaskDone,
  isSmartLightingTaskFailed,
  normalizeSmartLightingChipId,
} from '../../utils/smartLighting'

type SmartLightingPhase =
  | 'idle'
  | 'preparing'
  | 'enabling'
  | 'capturing'
  | 'ai'
  | 'success'
  | 'error'

const props = defineProps<{
  devices: DeviceItem[]
}>()

const toast = useToast()
const phase = ref<SmartLightingPhase>('idle')
const activeCamChipId = ref('')
const activeBatchId = ref('')
const activeTaskIds = ref<string[]>([])
const completedCount = ref(0)
const failedMessage = ref('')
let watchdogTimer: number | null = null
let resetTimer: number | null = null

const running = computed(() => ['preparing', 'enabling', 'capturing', 'ai'].includes(phase.value))
const buttonLabel = computed(() => {
  if (phase.value === 'success') return '布光完成'
  if (phase.value === 'error') return '布光未完成'
  if (running.value) return '智能布光中'
  return '智能布光'
})
const progressText = computed(() => {
  if (phase.value === 'preparing') return '环境检查'
  if (phase.value === 'enabling') return '切换自动模式'
  if (phase.value === 'capturing') return '全区域拍摄'
  if (phase.value === 'ai') return `AI 处理中 ${completedCount.value}/3`
  return ''
})
const buttonTitle = computed(() => failedMessage.value || '全区域拍摄并开启所有灯具自动模式与服装追随')

function clearTimers() {
  if (watchdogTimer != null) {
    window.clearTimeout(watchdogTimer)
    watchdogTimer = null
  }
  if (resetTimer != null) {
    window.clearTimeout(resetTimer)
    resetTimer = null
  }
}

function scheduleReset(delay = 2600) {
  if (resetTimer != null) window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    phase.value = 'idle'
    failedMessage.value = ''
    activeCamChipId.value = ''
    activeBatchId.value = ''
    activeTaskIds.value = []
    completedCount.value = 0
    resetTimer = null
  }, delay)
}

function fail(message: string) {
  clearTimers()
  failedMessage.value = message
  phase.value = 'error'
  toast.show(message, 'error')
  scheduleReset(3600)
}

function findDeviceByChipId(chipId?: string) {
  const normalized = normalizeSmartLightingChipId(chipId)
  return props.devices.find(device => normalizeSmartLightingChipId(device.chipId) === normalized)
}

async function validateBeforeRun() {
  const camera = getSmartLightingCamera(props.devices)
  if (!camera?.chipId) throw new Error('未配置独立摄像头，无法启动智能布光')
  if (!camera.online) throw new Error('摄像头离线，无法启动智能布光')

  const busyStatuses = new Set([
    'waiting_motion', 'capturing', 'uploading', 'returning_center',
    'returning_target_2', 'ready_tracking', 'tracking',
  ])
  if (busyStatuses.has(String(camera.camWorkStatus || '').toLowerCase())) {
    throw new Error('摄像头当前忙碌，请等待当前任务结束')
  }

  const lamps = getSmartLightingLamps(props.devices)
  if (lamps.length === 0) throw new Error('当前店铺没有可参与智能布光的灯具')
  const offlineLamp = lamps.find(lamp => !lamp.online)
  if (offlineLamp) {
    throw new Error(`${offlineLamp.displayName || offlineLamp.chipId || '灯具'} 离线，请先恢复连接`)
  }

  const roi = await getCamRoiConfig(camera.chipId)
  const targets = (roi.rois || []).slice(0, 3)
  if (!roi.configured || targets.length < 3 || targets.some(item => !item.targetChipId)) {
    throw new Error('三个区域尚未完整配置，请先完成摄像头区域标定')
  }
  if (!roi.sliderLampChipId) throw new Error('尚未绑定滑轨控制灯')

  const sliderLamp = findDeviceByChipId(roi.sliderLampChipId)
  if (!sliderLamp) throw new Error('滑轨控制灯不存在')
  if (!sliderLamp.online) throw new Error('滑轨控制灯离线')

  for (const target of targets) {
    const lamp = findDeviceByChipId(target.targetChipId)
    if (!lamp) throw new Error(`区域 ${target.targetIndex} 的目标灯不存在`)
    if (!lamp.online) throw new Error(`区域 ${target.targetIndex} 的目标灯离线`)
  }

  return { camera, lamps }
}

async function runSmartLighting() {
  if (running.value) return
  clearTimers()
  failedMessage.value = ''
  completedCount.value = 0
  phase.value = 'preparing'

  try {
    const { camera, lamps } = await validateBeforeRun()
    phase.value = 'enabling'

    await Promise.all(lamps.map(lamp => updateDevice(
      lamp.id,
      buildSmartLightingLampPayload(lamp),
      { lightControl: true },
    )))

    phase.value = 'capturing'
    const batch = await createCamCaptureBatch({ camChipId: camera.chipId })
    if (!batch?.batchId || !Array.isArray(batch.tasks) || batch.tasks.length === 0) {
      throw new Error('全区域拍摄任务创建失败')
    }

    activeCamChipId.value = camera.chipId
    activeBatchId.value = batch.batchId
    activeTaskIds.value = batch.tasks.map(task => task.taskId).filter(Boolean)

    watchdogTimer = window.setTimeout(() => {
      fail('智能布光等待超时，请检查摄像头、滑轨和 AI 服务状态')
    }, 180_000)
  } catch (error) {
    fail(getErrorMessage(error, '智能布光启动失败'))
  }
}

watch(
  () => props.devices,
  () => {
    if (!running.value || !activeBatchId.value || !activeCamChipId.value) return
    const camera = findDeviceByChipId(activeCamChipId.value)
    const tasks = getSmartLightingBatchTasks(camera, activeBatchId.value, activeTaskIds.value)
    if (tasks.length === 0) return

    const failed = tasks.find(isSmartLightingTaskFailed)
    if (failed) {
      fail(`区域 ${failed.targetIndex || '?'} 布光失败：${failed.message || failed.status || '任务异常'}`)
      return
    }

    completedCount.value = tasks.filter(isSmartLightingTaskDone).length
    if (completedCount.value > 0 || tasks.some(task => ['image_received', 'ai_processing'].includes(String(task.status || '')))) {
      phase.value = 'ai'
    }

    if (activeTaskIds.value.length >= 3 && completedCount.value >= activeTaskIds.value.length) {
      clearTimers()
      phase.value = 'success'
      toast.show('智能布光完成：全区域识别结果已应用', 'success')
      scheduleReset()
    }
  },
  { deep: true },
)

onBeforeUnmount(clearTimers)
</script>

<style>
#controls .smart-lighting-launcher {
  order: 20;
  margin-left: auto;
  display: flex;
  align-items: center;
}

#controls .ws-status-pill {
  order: 30;
}

#controls .smart-lighting-button {
  position: relative;
  isolation: isolate;
  min-width: 154px;
  min-height: 42px;
  padding: 7px 17px 7px 15px;
  overflow: hidden;
  border: 1px solid rgba(178, 125, 54, 0.38);
  border-radius: 999px;
  background:
    radial-gradient(circle at 18% 25%, rgba(255,255,255,.96) 0 8%, transparent 28%),
    radial-gradient(circle at 78% 75%, rgba(223,171,103,.30), transparent 34%),
    linear-gradient(120deg, #fff8ea 0%, #f5dfba 38%, #f9eee0 66%, #e8c68e 100%);
  color: #6f4a1f;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.92),
    inset 0 -1px 0 rgba(133,83,24,.10),
    0 7px 18px rgba(148, 96, 30, .16);
  cursor: pointer;
  transition: transform .22s ease, box-shadow .22s ease, filter .22s ease;
}

#controls .smart-lighting-button:hover:not(:disabled) {
  background:
    radial-gradient(circle at 18% 25%, rgba(255,255,255,.98) 0 8%, transparent 28%),
    radial-gradient(circle at 78% 75%, rgba(223,171,103,.38), transparent 34%),
    linear-gradient(120deg, #fffaf1 0%, #f4dcae 38%, #fbefe0 66%, #e7c180 100%);
  transform: translateY(-1px) scale(1.012);
  box-shadow: 0 9px 24px rgba(148, 96, 30, .22);
}

#controls .smart-lighting-button:disabled {
  cursor: default;
  opacity: 1;
}

.smart-lighting-pattern {
  position: absolute;
  inset: -40% -10%;
  z-index: -2;
  opacity: .5;
  background:
    repeating-radial-gradient(ellipse at 20% 40%, transparent 0 11px, rgba(139,91,32,.14) 12px 13px, transparent 14px 22px),
    repeating-radial-gradient(ellipse at 78% 62%, transparent 0 16px, rgba(255,255,255,.58) 17px 18px, transparent 19px 29px);
  transform: rotate(-7deg);
}

.smart-lighting-sheen {
  position: absolute;
  inset: -30% auto -30% -45%;
  z-index: -1;
  width: 42%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.82), transparent);
  transform: skewX(-18deg);
  opacity: .45;
}

.phase-preparing .smart-lighting-pattern,
.phase-enabling .smart-lighting-pattern,
.phase-capturing .smart-lighting-pattern,
.phase-ai .smart-lighting-pattern {
  animation: smartLightingPatternFlow 4.2s linear infinite;
}

.phase-preparing .smart-lighting-sheen,
.phase-enabling .smart-lighting-sheen,
.phase-capturing .smart-lighting-sheen,
.phase-ai .smart-lighting-sheen {
  animation: smartLightingSheen 1.75s ease-in-out infinite;
}

.smart-lighting-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,.55);
  box-shadow: inset 0 0 0 1px rgba(135,83,25,.12);
  font-size: 13px;
  vertical-align: middle;
}

.smart-lighting-copy {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  vertical-align: middle;
  line-height: 1.05;
}

.smart-lighting-copy strong {
  font-size: 14px;
  letter-spacing: .04em;
  white-space: nowrap;
}

.smart-lighting-copy small {
  margin-top: 3px;
  font-size: 9px;
  font-weight: 600;
  color: rgba(111,74,31,.68);
  white-space: nowrap;
}

.smart-lighting-orbit {
  position: absolute;
  right: 9px;
  top: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fffaf0;
  box-shadow: 0 0 8px rgba(151,92,25,.65);
  transform-origin: -14px 13px;
  animation: smartLightingOrbit 1.45s linear infinite;
}

.phase-success .smart-lighting-button {
  background: linear-gradient(120deg, #fbf7e8, #e5dbad 52%, #f8efd2);
  color: #59612d;
  border-color: rgba(112,122,48,.32);
}

.phase-error .smart-lighting-button {
  background: linear-gradient(120deg, #fff5ed, #f0d1bc 55%, #f8e5d6);
  color: #8d4b31;
  border-color: rgba(157,78,51,.28);
}

@keyframes smartLightingPatternFlow {
  from { transform: translateX(-4%) rotate(-7deg); }
  to { transform: translateX(14%) rotate(-7deg); }
}

@keyframes smartLightingSheen {
  0% { left: -45%; opacity: 0; }
  28% { opacity: .55; }
  70% { opacity: .32; }
  100% { left: 118%; opacity: 0; }
}

@keyframes smartLightingOrbit {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  #controls .smart-lighting-launcher {
    margin-left: 0;
    order: 20;
    width: 100%;
  }

  #controls .smart-lighting-button {
    width: 100%;
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .smart-lighting-pattern,
  .smart-lighting-sheen,
  .smart-lighting-orbit {
    animation: none !important;
  }
}
</style>
