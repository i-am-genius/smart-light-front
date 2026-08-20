<template>
  <section class="capture-config-section">
    <div class="section-title-row">
      <div>
        <h4>拍摄对位配置</h4>
        <p>区域判断已由各灯具 ToF 接管；这里仅配置拍摄目标和滑轨位置。</p>
      </div>
      <span>{{ ready ? '已配置' : '待配置' }}</span>
    </div>

    <div class="config-block">
      <label>
        <span>滑轨控制灯</span>
        <BaseSelect
          v-model="draft.sliderLampChipId"
          :options="targetOptions"
          placeholder="选择实际连接滑轨电机的灯具"
        />
      </label>
    </div>

    <div class="target-list">
      <div v-for="target in draft.targets" :key="target.index" class="target-card">
        <div class="target-title">拍摄目标 {{ target.index }}</div>
        <label>
          <span>目标灯</span>
          <BaseSelect
            v-model="target.lampChipId"
            :options="targetOptions"
            placeholder="选择射灯设备"
          />
        </label>
        <div class="target-grid">
          <label>
            <span>Slider 滑轨</span>
            <div class="unit-input">
              <input v-model.number="target.sliderMm" type="number" min="0" max="2500" step="1" />
              <small>mm</small>
            </div>
          </label>
          <label>
            <span>移动时间</span>
            <div class="move-time-row">
              <BaseSelect
                v-model="speedSelection[target.index]"
                :options="speedOptions"
              />
              <div class="unit-input">
                <input
                  v-model.number="target.moveTimes[speedSelection[target.index]]"
                  type="number"
                  min="0"
                  max="3600"
                  step="0.1"
                  inputmode="decimal"
                />
                <small>s</small>
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <p v-if="message" class="config-message" :class="{ error: messageIsError }">{{ message }}</p>
    <div class="actions">
      <button class="btn-secondary" type="button" :disabled="loading" @click="load">
        {{ loading ? '读取中...' : '重新读取' }}
      </button>
      <button class="btn-primary" type="button" :disabled="saving" @click="save">
        {{ saving ? '保存中...' : '保存拍摄配置' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BaseSelect from '../common/BaseSelect.vue'
import { getCamCaptureConfig, saveCamCaptureConfig } from '../../api/device'
import type {
  CamCaptureConfig,
  CamCaptureTargetConfig,
  CamSliderMoveTimes,
  DeviceItem,
} from '../../types/device'
import { getErrorMessage } from '../../utils/error'
import { getTargetDeviceLabel } from '../../utils/cameraRoi'

const props = defineProps<{
  camChipId: string
  targetDevices?: DeviceItem[]
}>()

const emit = defineEmits<{
  (e: 'loaded', value: CamCaptureConfig): void
}>()

const draft = ref<CamCaptureConfig>(createDefaultConfig(''))
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const messageIsError = ref(false)

const speedOptions: { label: string; value: keyof CamSliderMoveTimes }[] = [
  { label: '慢速', value: 'slow' },
  { label: '中速', value: 'normal' },
  { label: '快速', value: 'fast' },
]

const speedSelection = reactive<Record<number, keyof CamSliderMoveTimes>>({
  1: 'normal',
  2: 'normal',
  3: 'normal',
})

const targetOptions = computed(() => (props.targetDevices || []).flatMap((target, index) => {
  if (!target.chipId) return []
  return [{ label: getTargetDeviceLabel(target, index + 1), value: target.chipId }]
}))

const ready = computed(() => Boolean(
  draft.value.sliderLampChipId &&
  draft.value.targets.length === 3 &&
  draft.value.targets.every(target => target.lampChipId),
))

function createDefaultTarget(index: number): CamCaptureTargetConfig {
  return {
    index,
    lampChipId: '',
    sliderMm: 0,
    moveTimes: { slow: 0, normal: 0, fast: 0 },
  }
}

function createDefaultConfig(camChipId: string): CamCaptureConfig {
  return {
    camChipId,
    sliderLampChipId: '',
    configured: false,
    targets: [1, 2, 3].map(createDefaultTarget),
  }
}

function normalizeTime(value: unknown) {
  const numeric = Number(value)
  const clamped = Math.max(0, Math.min(3600, Number.isFinite(numeric) ? numeric : 0))
  return Math.round(clamped * 1000) / 1000
}

function normalizeConfig(value: Partial<CamCaptureConfig> | null | undefined): CamCaptureConfig {
  const source = Array.isArray(value?.targets) ? value.targets : []
  const targets = [1, 2, 3].map((index) => {
    const input = source.find(target => Number(target?.index) === index)
    const slider = Number(input?.sliderMm ?? 0)
    return {
      index,
      lampChipId: String(input?.lampChipId || '').trim(),
      sliderMm: Math.round(Math.max(0, Math.min(2500, Number.isFinite(slider) ? slider : 0))),
      moveTimes: {
        slow: normalizeTime(input?.moveTimes?.slow),
        normal: normalizeTime(input?.moveTimes?.normal),
        fast: normalizeTime(input?.moveTimes?.fast),
      },
    }
  })
  const result: CamCaptureConfig = {
    camChipId: props.camChipId,
    sliderLampChipId: String(value?.sliderLampChipId || '').trim(),
    targets,
  }
  result.configured = Boolean(
    result.sliderLampChipId && result.targets.every(target => target.lampChipId),
  )
  return result
}

async function load() {
  if (!props.camChipId || loading.value) return
  loading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    draft.value = normalizeConfig(await getCamCaptureConfig(props.camChipId))
    emit('loaded', draft.value)
  } catch (error) {
    message.value = getErrorMessage(error, '拍摄配置读取失败')
    messageIsError.value = true
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.camChipId || saving.value) return
  saving.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const payload = normalizeConfig(draft.value)
    draft.value = normalizeConfig(await saveCamCaptureConfig(props.camChipId, payload))
    emit('loaded', draft.value)
    if (!draft.value.sliderLampChipId) {
      message.value = '配置已保存，但还未绑定滑轨控制灯'
      messageIsError.value = true
    } else if (!draft.value.targets.every(target => target.lampChipId)) {
      message.value = '配置已保存，但仍有拍摄目标未绑定灯具'
      messageIsError.value = true
    } else {
      message.value = '拍摄对位配置已保存'
    }
  } catch (error) {
    message.value = getErrorMessage(error, '拍摄配置保存失败')
    messageIsError.value = true
  } finally {
    saving.value = false
  }
}

watch(
  () => props.camChipId,
  (chipId) => {
    draft.value = createDefaultConfig(chipId || '')
    if (chipId) void load()
  },
  { immediate: true },
)
</script>

<style scoped>
.capture-config-section {
  margin: 12px 0;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.section-title-row h4 { margin: 0; color: #0f172a; }
.section-title-row p { margin: 5px 0 0; color: #64748b; font-size: 12px; line-height: 1.45; }
.section-title-row > span { color: #64748b; font-size: 12px; white-space: nowrap; }
.config-block, .target-card {
  margin-top: 10px;
  padding: 10px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
}
.target-list { display: grid; gap: 10px; }
.target-title { color: #0f172a; font-size: 14px; font-weight: 800; }
label { display: block; margin-top: 8px; }
label > span { display: block; margin-bottom: 4px; color: #64748b; font-size: 12px; font-weight: 700; }
.target-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
input { width: 100%; min-height: 38px; box-sizing: border-box; border: 1px solid #dbe3f0; border-radius: 10px; padding: 0 10px; }
.unit-input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.unit-input small { color: #64748b; font-weight: 700; }
.move-time-row { display: grid; grid-template-columns: minmax(72px, .8fr) minmax(0, 1.2fr); gap: 6px; align-items: center; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.actions button { min-height: 36px; border: none; border-radius: 10px; cursor: pointer; font-weight: 800; padding: 8px 12px; }
.btn-secondary { color: #2563eb; background: #eef4ff; }
.btn-primary { color: #fff; background: linear-gradient(135deg, #3b82f6, #2563eb); }
.actions button:disabled { cursor: not-allowed; opacity: .55; }
.config-message { margin: 10px 0 0; padding: 9px 10px; border-radius: 10px; background: #eef4ff; color: #2563eb; font-size: 13px; }
.config-message.error { background: #fff1f0; color: #b91c1c; }
@media (max-width: 520px) { .target-grid { grid-template-columns: 1fr; } }
</style>
