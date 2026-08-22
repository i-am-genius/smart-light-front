<template>
  <div class="camera-shell">
    <CameraDeviceCard
      :device="adaptedDevice"
      :deleting="deleting"
      :target-devices="adaptedTargetDevices"
      :capture-controller-devices="captureControllerDevices"
      :cam-index="camIndex"
      @update-realtime="$emit('update-realtime', $event)"
      @delete="$emit('delete', $event)"
    />

    <button
      type="button"
      class="capture-config-trigger"
      @click.stop="showCaptureConfig = true"
    >
      拍摄配置
    </button>

    <Teleport to="body">
      <div
        v-if="showCaptureConfig"
        class="capture-config-overlay"
        @click.self="showCaptureConfig = false"
      >
        <div class="capture-config-modal">
          <div class="capture-config-header">
            <div>
              <h3>拍摄对位配置</h3>
              <p>{{ device.chipId }}</p>
            </div>
            <button type="button" @click="showCaptureConfig = false">×</button>
          </div>
          <div class="capture-config-body">
            <CameraCaptureConfigPanel
              :cam-chip-id="device.chipId"
              :target-devices="adaptedTargetDevices"
              :capture-controller-devices="captureControllerDevices"
              @loaded="handleCaptureConfigLoaded"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CameraDeviceCard from './CameraDeviceCard.vue'
import CameraCaptureConfigPanel from './CameraCaptureConfigPanel.vue'
import { getCamCaptureConfig } from '../../api/device'
import type {
  CamCaptureConfig,
  CamPresenceArea,
  CamRoiConfig,
  DeviceItem,
} from '../../types/device'
import { captureConfigToLegacyCameraCard } from '../../utils/cameraCaptureConfig'
import type { LampRealtimeUpdateEnvelope } from '../../utils/garmentRecognition'

const props = defineProps<{
  device: DeviceItem
  deleting?: boolean
  targetDevices?: DeviceItem[]
  captureControllerDevices?: DeviceItem[]
  camIndex?: number
}>()

defineEmits<{
  (e: 'update-realtime', value: LampRealtimeUpdateEnvelope): void
  (e: 'delete', id: number): void
}>()

const showCaptureConfig = ref(false)
const captureConfig = ref<CamCaptureConfig | null>(null)

const adaptedTargetDevices = computed(() => (props.targetDevices || []).map(target => ({
  ...target,
  lampClothState: target.lampClothState
    ? {
        ...target.lampClothState,
        clothStatus: target.lampClothState.clothStatus || target.lampClothState.clothState,
      }
    : target.lampClothState,
})))

const compatibilityRoiConfig = computed<CamRoiConfig>(() => {
  const config = captureConfig.value || props.device.camCaptureConfig
  if (config) return captureConfigToLegacyCameraCard(config)
  return captureConfigToLegacyCameraCard({
    camChipId: props.device.chipId,
    sliderLampChipId: '',
    captureControllerChipId: '',
    flowUploadEnabled: false,
    flowUploadIntervalSeconds: 30,
    configured: false,
    targets: [],
  })
})

const tofAreas = computed<CamPresenceArea[]>(() => compatibilityRoiConfig.value.rois.map(roi => {
  const lamp = adaptedTargetDevices.value.find(item => sameChipId(item.chipId, roi.targetChipId))
  return {
    targetIndex: roi.targetIndex,
    targetChipId: roi.targetChipId,
    areaName: `拍摄目标 ${roi.targetIndex}`,
    present: Boolean(lamp?.lampProximityState?.nearby),
    updateTime: lamp?.lampProximityState?.updateTime,
  }
}))

const adaptedDevice = computed<DeviceItem>(() => ({
  ...props.device,
  camCaptureConfig: captureConfig.value || props.device.camCaptureConfig,
  camRoiConfig: compatibilityRoiConfig.value,
  camPresence: {
    camChipId: props.device.chipId,
    ...(props.device.camPresence || {}),
    areas: tofAreas.value,
  },
  trackingStatus: props.device.trackingStatus
    ? {
        ...props.device.trackingStatus,
        targetChipId: props.device.trackingStatus.targetChipId || props.device.trackingStatus.lampChipId,
      }
    : props.device.trackingStatus,
}))

function sameChipId(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toUpperCase() === right.trim().toUpperCase())
}

function handleCaptureConfigLoaded(value: CamCaptureConfig) {
  captureConfig.value = value
}

async function loadCaptureConfig() {
  if (!props.device.chipId) return
  try {
    captureConfig.value = await getCamCaptureConfig(props.device.chipId)
  } catch {
    captureConfig.value = null
  }
}

onMounted(() => void loadCaptureConfig())
watch(() => props.device.chipId, () => void loadCaptureConfig())
</script>

<style scoped>
.camera-shell {
  position: relative;
  min-width: 0;
  height: 100%;
}
.capture-config-trigger {
  position: absolute;
  z-index: 5;
  right: 20px;
  bottom: 18px;
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  background: #eff6ff;
  color: #2563eb;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}
.capture-config-overlay {
  position: fixed;
  inset: 0;
  z-index: 2600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.35);
}
.capture-config-modal {
  width: 460px;
  max-width: 94vw;
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.2);
}
.capture-config-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 10px;
}
.capture-config-header h3 { margin: 0; color: #0f172a; }
.capture-config-header p { margin: 5px 0 0; color: #64748b; font-size: 12px; }
.capture-config-header button { border: 0; background: transparent; font-size: 28px; cursor: pointer; }
.capture-config-body { overflow-y: auto; padding: 0 18px 18px; }
@media (max-width: 768px) {
  .camera-shell { height: auto; }
  .capture-config-trigger { right: 12px; bottom: 12px; }
}
</style>

<style>
/* Legacy ROI editor is intentionally retired. Capture configuration lives in
   CameraCaptureConfigPanel and person-area state comes from Lamp ToF. */
.roi-section,
.camera-roi-warning {
  display: none !important;
}
</style>
