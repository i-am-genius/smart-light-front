<template>
  <Teleport to="body">
    <Transition name="modal-overlay-fade" appear @after-leave="handleOverlayAfterLeave">
      <div v-if="overlayVisible" class="modal-overlay" @click.self="handleClose">
        <Transition name="ios-modal-card" appear @after-leave="handleCardAfterLeave">
          <div v-if="visible" class="modal-card">
          <h3>{{ initialData ? '添加扫描到的设备' : '手动添加设备' }}</h3>

            <template v-if="initialData">
              <div class="readonly-grid compact-readonly-grid">
                <div class="readonly-item">
                  <div class="readonly-label">设备编码</div>
                  <div class="readonly-value">{{ form.chipId || '未获取' }}</div>
                </div>

                <div class="readonly-item">
                  <div class="readonly-label">设备类型</div>
                  <div class="readonly-value">{{ form.deviceType || '未知' }}</div>
                </div>

                <div class="readonly-item readonly-item-full">
                  <div class="readonly-label">设备 IP</div>
                  <div class="readonly-value">{{ form.ip || '未获取' }}</div>
                </div>
              </div>
            </template>

            <template v-else>
              <label class="modal-label">设备编码</label>
              <input
                v-model.trim="form.chipId"
                class="modal-input"
                type="text"
                placeholder="如 1237461B"
              />

              <label class="modal-label">设备 IP</label>
              <input
                v-model.trim="form.ip"
                class="modal-input"
                type="text"
                placeholder="如 192.168.1.105"
              />

              <label class="modal-label">设备类型</label>
                <BaseSelect
                  v-model="form.deviceType"
                  :options="deviceTypeOptions"
                  placeholder="请选择设备类型"
                />
            </template>

            <label class="modal-label">显示名称</label>
            <input
              v-model.trim="form.displayName"
              class="modal-input"
              type="text"
              placeholder="如 橱窗灯1"
            />

            <label class="modal-label">设备编号</label>
            <input
              v-model.trim="form.deviceNo"
              class="modal-input"
              type="text"
              placeholder="如 LIGHT-001"
            />

          <div class="modal-actions">
            <button class="btn-confirm" :disabled="submitting" @click="submit">
              {{ submitting ? '提交中...' : '确认添加' }}
            </button>
            <button class="btn-cancel" :disabled="submitting" @click="handleClose">
              取消
            </button>
          </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { DeviceCreatePayload } from '../../types/device'
import { isLampDevice } from '../../utils/device'
import BaseSelect from '../common/BaseSelect.vue'
type DeviceAddInitialData = {
  chipId?: string
  ip?: string
  deviceType?: string
  displayName?: string
  deviceNo?: string
} | null
const deviceTypeOptions = [
  { label: '射灯节点（lamp）', value: 'lamp' },
  { label: '摄像头节点（cam）', value: 'cam' },
  { label: '旧摄像头灯节点（camlamp）', value: 'camlamp' },
]
const props = defineProps<{
  submitting?: boolean
  initialData?: DeviceAddInitialData
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', value: DeviceCreatePayload): void
}>()

const overlayVisible = ref(false)
const visible = ref(false)
const closing = ref(false)

const form = reactive<DeviceCreatePayload>({
  chipId: '',
  ip: '',
  displayName: '',
  deviceType: '',
  deviceNo: '',
  brightness: 50,
  temp: 4000,
  autoMode: false,
  recommendedBrightness: 50,
  recommendedTemp: 4000,
  fabric: '',
  mainColorRgb: '',
})

function resetForm() {
  form.chipId = ''
  form.ip = ''
  form.displayName = ''
  form.deviceType = ''
  form.deviceNo = ''
  form.brightness = 50
  form.temp = 4000
  form.autoMode = false
  form.recommendedBrightness = 50
  form.recommendedTemp = 4000
  form.fabric = ''
  form.mainColorRgb = ''
}

function buildDefaultDisplayName(chipId?: string) {
  const code = chipId?.trim?.() || ''
  if (!code) return ''
  return `设备-${code}`
}

function fillFormByInitialData(data?: DeviceAddInitialData) {
  resetForm()
  if (!data) return

  form.chipId = data.chipId?.trim?.() || ''
  form.ip = data.ip?.trim?.() || ''
  form.deviceType = data.deviceType?.trim?.() || ''
  form.deviceNo = data.deviceNo?.trim?.() || ''
  form.displayName =
    data.displayName?.trim?.() ||
    buildDefaultDisplayName(data.chipId)
}

function submit() {
  if (!form.chipId) return
  const basePayload: DeviceCreatePayload = {
    chipId: form.chipId,
    ip: form.ip,
    displayName: form.displayName,
    deviceType: form.deviceType,
    deviceNo: form.deviceNo,
  }

  if (isLampDevice({ deviceType: form.deviceType })) {
    emit('submit', { ...form })
    return
  }

  emit('submit', basePayload)
}

function handleClose() {
  if (closing.value) return
  closing.value = true
  visible.value = false
}

function handleCardAfterLeave() {
  overlayVisible.value = false
}

function handleOverlayAfterLeave() {
  emit('close')
  closing.value = false
}

onMounted(() => {
  fillFormByInitialData(props.initialData)
  overlayVisible.value = true
  nextTick(() => {
    visible.value = true
  })
})

watch(
  () => props.initialData,
  (val) => {
    fillFormByInitialData(val)
  },
  { immediate: true },
)

watch(
  () => props.submitting,
  (val, oldVal) => {
    if (oldVal === true && val === false) {
      fillFormByInitialData(props.initialData)
    }
  },
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: overlay-fade-in 220ms ease-out;
}

.modal-card {
  position: relative;
  z-index: 2001;
  background: #fff;
  width: 360px;
  max-width: 92vw;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.modal-card h3 {
  margin-bottom: 16px;
}

.modal-label {
  display: block;
  margin: 12px 0 6px;
  font-size: 14px;
  color: #606266;
}

.modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn-confirm,
.btn-cancel {
  flex: 1;
  border: none;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
}

.btn-confirm {
  background: #409eff;
  color: #fff;
}

.btn-cancel {
  background: #f2f3f5;
  color: #303133;
}

/* iOS 风格：扫描卡片 */
@keyframes overlay-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.ios-modal-card-enter-active,
.ios-modal-card-leave-active {
  transition:
    opacity 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform, filter;
}

.ios-modal-card-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.4, 0, 1, 1),
    transform 240ms cubic-bezier(0.4, 0, 1, 1),
    filter 240ms cubic-bezier(0.4, 0, 1, 1);
}

.ios-modal-card-enter-from {
  opacity: 0;
  transform: translateY(28px) scale(0.94);
  filter: blur(10px);
}

.ios-modal-card-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.ios-modal-card-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.ios-modal-card-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
  filter: blur(8px);
}

.modal-overlay-fade-enter-active,
.modal-overlay-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.modal-overlay-fade-enter-from,
.modal-overlay-fade-leave-to {
  opacity: 0;
}

.modal-overlay-fade-enter-to,
.modal-overlay-fade-leave-from {
  opacity: 1;
}

.compact-readonly-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
  margin-bottom: 12px;
}

.readonly-item {
  padding: 8px 10px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.readonly-item-full {
  grid-column: 1 / -1;
}

.readonly-label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 3px;
  line-height: 1.2;
}

.readonly-value {
  font-size: 13px;
  color: #0f172a;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-all;
}

:global(body:has(.app-container.night-mode)) .modal-overlay {
  background: rgba(2, 6, 23, 0.66);
}

:global(body:has(.app-container.night-mode)) .modal-card {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: rgba(226, 232, 240, 0.9);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(body:has(.app-container.night-mode)) .modal-card h3 {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .modal-label,
:global(body:has(.app-container.night-mode)) .readonly-label {
  color: rgba(203, 213, 225, 0.72);
}

:global(body:has(.app-container.night-mode)) .modal-input {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.28);
  color: rgba(226, 232, 240, 0.92);
}

:global(body:has(.app-container.night-mode)) .modal-input::placeholder {
  color: rgba(203, 213, 225, 0.58);
}

:global(body:has(.app-container.night-mode)) .modal-input:focus {
  border-color: rgba(96, 165, 250, 0.72);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
}

:global(body:has(.app-container.night-mode)) .readonly-item {
  background: rgba(15, 23, 42, 0.62);
  border-color: rgba(148, 163, 184, 0.18);
}

:global(body:has(.app-container.night-mode)) .readonly-value {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .btn-cancel {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}
</style>
