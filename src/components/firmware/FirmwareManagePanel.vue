<template>
  <section class="firmware-panel">
    <header class="page-hero">
      <div>
        <h1>OTA 固件管理</h1>
        <p>上传 ESP8266/ESP32 可下载的 firmware.bin，并维护 stable/test 历史版本</p>
      </div>
    </header>

    <div class="firmware-layout">
      <section class="manage-card upload-card">
        <div class="card-header">
          <div>
            <h2>上传固件</h2>
            <p>保持原有上传接口参数，上传成功后自动刷新历史版本。</p>
          </div>
        </div>

        <form class="firmware-form" @submit.prevent="handleSubmit">
          <label class="form-field file-field" :class="{ shake: shakingFile }">
            <span>固件文件</span>
            <input
              ref="fileInputRef"
              type="file"
              accept=".bin,application/octet-stream"
              @change="handleFileChange"
            />
          </label>

          <div class="form-grid">
            <div class="form-field" :class="{ shake: shakingDeviceType }">
              <span>设备类型</span>
              <BaseSelect
                v-model="deviceType"
                :options="uploadDeviceTypeOptions"
              />
            </div>

            <div class="form-field" :class="{ shake: shakingChannel }">
              <span>发布通道</span>
              <BaseSelect
                v-model="channel"
                :options="channelOptions"
              />
            </div>

            <label class="form-field" :class="{ shake: shakingVersion }">
              <span>版本号</span>
              <input v-model.trim="version" type="text" placeholder="1.0.1" />
            </label>

            <label class="form-field" :class="{ shake: shakingVersionCode }">
              <span>版本数字</span>
              <input v-model.number="versionCode" type="number" min="1" placeholder="10001" />
            </label>
          </div>

          <label class="form-field">
            <span>更新说明</span>
            <textarea v-model.trim="changelog" rows="4" placeholder="可选，说明本次固件变化"></textarea>
          </label>

          <label class="form-field">
            <span>MD5</span>
            <input v-model.trim="md5" type="text" placeholder="可选" />
          </label>

          <button class="submit-btn" type="submit" :class="{ shake: shakingSubmitBtn }" :disabled="uploading">
            {{ uploading ? '上传中...' : '上传固件' }}
          </button>
        </form>

        <section v-if="uploadResult" class="result-panel">
          <h3>上传结果</h3>
          <dl>
            <div>
              <dt>文件地址</dt>
              <dd class="url-actions">
                <button type="button" class="text-btn" @click="copyUrl(uploadResult.fileUrl)">复制地址</button>
                <button type="button" class="text-btn" @click="openUrl(uploadResult.fileUrl)">打开/下载</button>
              </dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>{{ uploadResult.version }} ({{ uploadResult.versionCode }})</dd>
            </div>
            <div>
              <dt>通道</dt>
              <dd>{{ formatChannel(uploadResult.channel) }}</dd>
            </div>
            <div>
              <dt>更新说明</dt>
              <dd>{{ uploadResult.changelog || '-' }}</dd>
            </div>
          </dl>

          <p class="lan-tip">
            请确认文件地址使用的是电脑局域网 IP，不是 localhost 或 127.0.0.1，否则 ESP8266 无法下载。
          </p>
        </section>
      </section>

      <section class="manage-card history-card">
        <div class="card-header history-header">
          <div>
            <h2>历史固件版本</h2>
            <p>按设备类型和发布通道查看 ota_firmware 记录。</p>
          </div>

          <button class="refresh-btn" type="button" :disabled="historyLoading" @click="loadFirmwareHistory">
            {{ historyLoading ? '刷新中...' : '刷新' }}
          </button>
        </div>

        <div class="history-filters">
          <div class="form-field">
            <span>设备类型</span>
            <BaseSelect
              v-model="historyDeviceType"
              :options="historyDeviceTypeOptions"
            />
          </div>

          <div class="form-field">
            <span>发布通道</span>
            <BaseSelect
              v-model="historyChannel"
              :options="historyChannelOptions"
            />
          </div>
        </div>

        <div v-if="historyError" class="message error-message">
          {{ historyError }}
        </div>

        <div v-if="copyMessage" class="message success-message">
          {{ copyMessage }}
        </div>

        <div v-if="historyLoading" class="empty-state">
          正在加载历史版本...
        </div>

        <div v-else-if="firmwareHistory.length === 0" class="empty-state">
          暂无固件版本
        </div>

        <div v-else class="history-table-wrap">
          <table class="history-table">
            <thead>
              <tr>
                <th>设备类型</th>
                <th>通道</th>
                <th>版本号</th>
                <th>版本数字</th>
                <th>状态</th>
                <th>更新说明</th>
                <th>文件地址</th>
                <th>创建时间</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in firmwareHistory" :key="item.id">
                <td>{{ formatDeviceType(item.deviceType) }}</td>
                <td>{{ formatChannel(item.channel) }}</td>
                <td>{{ item.version }}</td>
                <td>{{ item.versionCode }}</td>
                <td>
                  <span class="enabled-badge" :class="{ disabled: !item.enabled }">
                    {{ item.enabled ? 'enabled' : 'disabled' }}
                  </span>
                </td>
                <td class="changelog-cell">{{ item.changelog || '-' }}</td>
                <td>
                  <div class="url-actions">
                    <button type="button" class="text-btn" @click="copyUrl(item.fileUrl)">复制地址</button>
                    <button type="button" class="text-btn" @click="openUrl(item.fileUrl)">打开/下载</button>
                  </div>
                </td>
                <td>{{ formatTime(item.createTime) }}</td>
                <td>{{ formatTime(item.updateTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import BaseSelect from '../common/BaseSelect.vue'
import { getFirmwareHistory, uploadFirmware } from '../../api/device'
import { getErrorMessage } from '../../utils/error'
import { useToast } from '../../composables/useToast'
import { useShake } from '../../composables/useShake'
import type {
  FirmwareChannel,
  FirmwareDeviceType,
  FirmwareItem,
  FirmwareUploadResult,
} from '../../types/device'

type UploadDeviceType = FirmwareDeviceType
type FilterDeviceType = UploadDeviceType | ''
type FilterChannel = FirmwareChannel | ''

const uploadDeviceTypeOptions = [
  { label: '灯光节点', value: 'lamp' },
  { label: '摄像头节点', value: 'cam' },
  { label: '拍照控制器', value: 'cam_capture' },
  { label: '旧摄像头灯节点', value: 'camlamp' },
]

const historyDeviceTypeOptions = [
  { label: '全部类型', value: '' },
  ...uploadDeviceTypeOptions,
]

const channelOptions = [
  { label: '正式版', value: 'stable' },
  { label: '测试版', value: 'test' },
]

const historyChannelOptions = [
  { label: '全部通道', value: '' },
  ...channelOptions,
]

const toast = useToast()
const { shaking: shakingFile, trigger: shakeFile } = useShake()
const { shaking: shakingDeviceType, trigger: shakeDeviceType } = useShake()
const { shaking: shakingChannel, trigger: shakeChannel } = useShake()
const { shaking: shakingVersion, trigger: shakeVersion } = useShake()
const { shaking: shakingVersionCode, trigger: shakeVersionCode } = useShake()
const { shaking: shakingSubmitBtn, trigger: shakeSubmitBtn } = useShake()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const deviceType = ref<UploadDeviceType>('lamp')
const channel = ref<FirmwareChannel>('stable')
const version = ref('')
const versionCode = ref<number | null>(null)
const changelog = ref('')
const md5 = ref('')
const uploading = ref(false)
const uploadResult = ref<FirmwareUploadResult | null>(null)

const historyDeviceType = ref<FilterDeviceType>('lamp')
const historyChannel = ref<FilterChannel>('stable')
const firmwareHistory = ref<FirmwareItem[]>([])
const historyLoading = ref(false)
const historyError = ref('')
const copyMessage = ref('')
const suppressHistoryWatch = ref(false)

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

const VALIDATION_SHAKE_MAP: Record<string, () => void> = {
  'firmware.bin': shakeFile,
  '.bin': shakeFile,
  '设备类型': shakeDeviceType,
  '发布通道': shakeChannel,
  '版本号不能为空': shakeVersion,
  '版本数字': shakeVersionCode,
}

function validateForm() {
  if (!selectedFile.value) {
    return '请选择 firmware.bin 文件'
  }

  if (!selectedFile.value.name.toLowerCase().endsWith('.bin')) {
    return '固件文件必须是 .bin 文件'
  }

  if (!['lamp', 'cam', 'camlamp', 'cam_capture'].includes(deviceType.value)) {
    return '设备类型只能是 lamp、cam、camlamp 或 cam_capture'
  }

  if (channel.value !== 'stable' && channel.value !== 'test') {
    return '发布通道只能是 stable 或 test'
  }

  if (!version.value.trim()) {
    return '版本号不能为空'
  }

  if (!versionCode.value || versionCode.value <= 0) {
    return '版本数字必须大于 0'
  }

  return ''
}

function shakeForError(msg: string) {
  for (const [key, trigger] of Object.entries(VALIDATION_SHAKE_MAP)) {
    if (msg.includes(key)) {
      trigger()
      return
    }
  }
}

async function handleSubmit() {
  const validationError = validateForm()
  if (validationError) {
    toast.show(validationError, 'error')
    shakeForError(validationError)
    return
  }

  const formData = new FormData()
  formData.append('file', selectedFile.value as File)
  formData.append('deviceType', deviceType.value)
  formData.append('channel', channel.value)
  formData.append('version', version.value.trim())
  formData.append('versionCode', String(versionCode.value))
  if (changelog.value.trim()) {
    formData.append('changelog', changelog.value.trim())
  }
  if (md5.value.trim()) {
    formData.append('md5', md5.value.trim())
  }

  uploading.value = true

  try {
    uploadResult.value = await uploadFirmware(formData)
    toast.show('固件上传成功', 'success')
    selectedFile.value = null
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
    suppressHistoryWatch.value = true
    historyDeviceType.value = deviceType.value
    historyChannel.value = channel.value
    await nextTick()
    suppressHistoryWatch.value = false
    await loadFirmwareHistory()
  } catch (error) {
    const message = getErrorMessage(error)
    toast.show(message, 'error')
    shakeSubmitBtn()
  } finally {
    uploading.value = false
  }
}

async function loadFirmwareHistory() {
  historyLoading.value = true
  historyError.value = ''
  copyMessage.value = ''

  try {
    firmwareHistory.value = await getFirmwareHistory({
      deviceType: historyDeviceType.value,
      channel: historyChannel.value,
    })
  } catch (error) {
    const message = getErrorMessage(error, '固件历史版本加载失败')
    historyError.value = message
    toast.show(message, 'error')
    firmwareHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

function getBrowserDownloadUrl(url?: string) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' && parsed.hostname === 'api.genius.show') {
      parsed.protocol = 'https:'
      parsed.port = ''
      return parsed.toString()
    }
    return url
  } catch {
    return url
  }
}

async function copyUrl(url?: string) {
  const browserUrl = getBrowserDownloadUrl(url)
  if (!browserUrl) return
  copyMessage.value = ''

  try {
    await navigator.clipboard.writeText(browserUrl)
    copyMessage.value = '固件下载地址已复制'
  } catch {
    copyMessage.value = '复制失败，请手动复制地址'
  }
}

function openUrl(url?: string) {
  const browserUrl = getBrowserDownloadUrl(url)
  if (!browserUrl) return
  window.open(browserUrl, '_blank', 'noopener,noreferrer')
}

function formatDeviceType(type?: string) {
  const map: Record<string, string> = {
    lamp: '灯光节点',
    cam: '摄像头节点',
    cam_capture: '拍照控制器',
    camlamp: '旧摄像头灯节点',
  }
  return type ? map[type] || type : '-'
}

function formatChannel(value?: string) {
  const map: Record<string, string> = {
    stable: '正式版',
    test: '测试版',
  }
  return value ? map[value] || value : '-'
}

function formatTime(value?: string) {
  if (!value) return '-'
  const normalized = value.replace('T', ' ')
  return normalized.length > 19 ? normalized.slice(0, 19) : normalized
}

onMounted(() => {
  loadFirmwareHistory()
})

watch([historyDeviceType, historyChannel], () => {
  if (suppressHistoryWatch.value) return
  loadFirmwareHistory()
})
</script>

<style scoped>
.firmware-panel {
  width: 100%;
  min-width: 0;
}

.page-hero {
  margin-bottom: 20px;
  padding: 22px 24px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
}

.page-hero h1 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
}

.page-hero p {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.6;
}

.firmware-layout {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(0, 1.4fr);
  gap: 20px;
  align-items: start;
}

.manage-card {
  min-width: 0;
  padding: 22px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.card-header h2 {
  margin: 0;
  color: #111827;
  font-size: 20px;
  font-weight: 900;
}

.card-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.firmware-form {
  display: grid;
  gap: 16px;
}

.form-grid,
.history-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.history-filters {
  margin-bottom: 16px;
}

.form-field {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: #303133;
  font-weight: 700;
}

.form-field span {
  color: #475569;
  font-size: 13px;
}

.form-field input,
.form-field textarea {
  width: 100%;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  padding: 11px 12px;
  font: inherit;
  color: #0f172a;
  background: #fff;
  font-weight: 400;
  outline: none;
}

.form-field input[type='file'] {
  padding: 10px;
  background: #f8fafc;
}

.form-field textarea {
  resize: vertical;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.14);
}

.submit-btn,
.refresh-btn,
.text-btn {
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
}

.submit-btn {
  width: fit-content;
  padding: 11px 18px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
}

.refresh-btn {
  padding: 9px 15px;
  color: #1d4ed8;
  background: #eff6ff;
}

.text-btn {
  padding: 7px 10px;
  color: #2563eb;
  background: #eef4ff;
}

.submit-btn:disabled,
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.message {
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
}

.error-message {
  background: #fff1f0;
  color: #c45656;
}

.success-message {
  background: #f0f9eb;
  color: #529b2e;
}

.result-panel {
  margin-top: 22px;
  border-top: 1px solid #e2e8f0;
  padding-top: 18px;
}

.result-panel h3 {
  margin: 0 0 14px;
  font-size: 17px;
  color: #111827;
}

.result-panel dl {
  display: grid;
  gap: 10px;
}

.result-panel dl > div {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.result-panel dt {
  color: #64748b;
  font-size: 13px;
}

.result-panel dd {
  min-width: 0;
  margin: 0;
  word-break: break-word;
}

.lan-tip {
  margin-top: 16px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
}

.history-card {
  overflow: hidden;
}

.history-header {
  align-items: center;
}

.history-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.history-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 13px;
}

.history-table th,
.history-table td {
  padding: 11px 12px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  vertical-align: top;
}

.history-table th {
  color: #475569;
  background: #f8fafc;
  font-weight: 900;
  white-space: nowrap;
}

.history-table td {
  color: #334155;
}

.history-table tr:last-child td {
  border-bottom: none;
}

.changelog-cell {
  max-width: 220px;
  word-break: break-word;
}

.url-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.enabled-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  color: #047857;
  background: #ecfdf5;
  font-weight: 900;
}

.enabled-badge.disabled {
  color: #b91c1c;
  background: #fef2f2;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  border: 1px dashed #cbd5e1;
  border-radius: 16px;
  color: #64748b;
  background: #f8fafc;
}

:global(body:has(.app-container.night-mode)) .page-hero,
:global(body:has(.app-container.night-mode)) .manage-card,
:global(.app-container.night-mode) .firmware-panel .page-hero,
:global(.app-container.night-mode) .firmware-panel .manage-card {
  background: rgba(15, 23, 42, 0.82);
  border-color: rgba(148, 163, 184, 0.18);
  color: rgba(226, 232, 240, 0.9);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(body:has(.app-container.night-mode)) .page-hero h1,
:global(body:has(.app-container.night-mode)) .card-header h2,
:global(body:has(.app-container.night-mode)) .result-panel h3,
:global(.app-container.night-mode) .firmware-panel .page-hero h1,
:global(.app-container.night-mode) .firmware-panel .card-header h2,
:global(.app-container.night-mode) .firmware-panel .result-panel h3 {
  color: rgba(248, 250, 252, 0.96);
}

:global(body:has(.app-container.night-mode)) .page-hero p,
:global(body:has(.app-container.night-mode)) .card-header p,
:global(body:has(.app-container.night-mode)) .form-field span,
:global(body:has(.app-container.night-mode)) .result-panel dt,
:global(.app-container.night-mode) .firmware-panel .page-hero p,
:global(.app-container.night-mode) .firmware-panel .card-header p,
:global(.app-container.night-mode) .firmware-panel .form-field span,
:global(.app-container.night-mode) .firmware-panel .result-panel dt {
  color: rgba(203, 213, 225, 0.72);
}

:global(body:has(.app-container.night-mode)) .form-field input,
:global(body:has(.app-container.night-mode)) .form-field textarea,
:global(.app-container.night-mode) .firmware-panel .form-field input,
:global(.app-container.night-mode) .firmware-panel .form-field textarea {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.28);
  color: rgba(226, 232, 240, 0.92);
}

:global(body:has(.app-container.night-mode)) .form-field input::placeholder,
:global(body:has(.app-container.night-mode)) .form-field textarea::placeholder,
:global(.app-container.night-mode) .firmware-panel .form-field input::placeholder,
:global(.app-container.night-mode) .firmware-panel .form-field textarea::placeholder {
  color: rgba(203, 213, 225, 0.58);
}

:global(body:has(.app-container.night-mode)) .history-table-wrap,
:global(body:has(.app-container.night-mode)) .result-panel,
:global(.app-container.night-mode) .firmware-panel .history-table-wrap,
:global(.app-container.night-mode) .firmware-panel .result-panel {
  border-color: rgba(148, 163, 184, 0.2);
}

:global(body:has(.app-container.night-mode)) .history-table th,
:global(.app-container.night-mode) .firmware-panel .history-table th {
  background: rgba(15, 23, 42, 0.72);
  color: rgba(226, 232, 240, 0.9);
}

:global(body:has(.app-container.night-mode)) .history-table td,
:global(.app-container.night-mode) .firmware-panel .history-table td {
  border-color: rgba(148, 163, 184, 0.14);
  color: rgba(226, 232, 240, 0.88);
}

:global(body:has(.app-container.night-mode)) .refresh-btn,
:global(body:has(.app-container.night-mode)) .text-btn,
:global(.app-container.night-mode) .firmware-panel .refresh-btn,
:global(.app-container.night-mode) .firmware-panel .text-btn {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: #bfdbfe;
}

:global(body:has(.app-container.night-mode)) .lan-tip,
:global(.app-container.night-mode) .firmware-panel .lan-tip {
  background: rgba(120, 53, 15, 0.26);
  border-color: rgba(245, 158, 11, 0.24);
  color: #fde68a;
}

:global(body:has(.app-container.night-mode)) .empty-state,
:global(.app-container.night-mode) .firmware-panel .empty-state {
  background: rgba(15, 23, 42, 0.58);
  border-color: rgba(148, 163, 184, 0.22);
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-trigger) {
  background: rgba(15, 23, 42, 0.76) !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: rgba(226, 232, 240, 0.92) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-trigger:hover) {
  border-color: rgba(96, 165, 250, 0.5) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.open .select-trigger) {
  border-color: rgba(96, 165, 250, 0.72) !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-text.placeholder) {
  color: rgba(203, 213, 225, 0.58) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-arrow) {
  color: rgba(203, 213, 225, 0.72) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-dropdown) {
  background: rgba(15, 23, 42, 0.96) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.48) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-option) {
  color: rgba(226, 232, 240, 0.9) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-option:hover) {
  background: rgba(30, 41, 59, 0.92) !important;
  color: rgba(248, 250, 252, 0.96) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-option.active) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
  color: #fff !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.select-option.disabled),
:global(.app-container.night-mode) .firmware-panel :deep(.disabled .select-trigger) {
  color: rgba(148, 163, 184, 0.62) !important;
}

:global(.app-container.night-mode) .firmware-panel :deep(.disabled .select-trigger) {
  background: rgba(15, 23, 42, 0.48) !important;
  border-color: rgba(148, 163, 184, 0.16) !important;
}

:global(.app-container.night-mode) .firmware-panel .form-field input[type='file']::file-selector-button {
  margin-right: 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  background: rgba(30, 41, 59, 0.88);
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .firmware-panel .history-table-wrap {
  background: rgba(15, 23, 42, 0.48);
}

:global(.app-container.night-mode) .firmware-panel .enabled-badge {
  background: rgba(6, 95, 70, 0.28);
  color: #a7f3d0;
}

:global(.app-container.night-mode) .firmware-panel .enabled-badge.disabled {
  background: rgba(127, 29, 29, 0.28);
  color: #fecaca;
}

:global(.app-container.night-mode) .firmware-panel .error-message {
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
}

:global(.app-container.night-mode) .firmware-panel .success-message {
  background: rgba(6, 95, 70, 0.22);
  color: #a7f3d0;
}

:global(.app-container.night-mode .firmware-panel .page-hero),
:global(.app-container.night-mode .firmware-panel .manage-card) {
  background: rgba(15, 23, 42, 0.82) !important;
  border: 1px solid rgba(148, 163, 184, 0.18) !important;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35) !important;
  color: rgba(226, 232, 240, 0.86) !important;
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

:global(.app-container.night-mode .firmware-panel h1),
:global(.app-container.night-mode .firmware-panel h2),
:global(.app-container.night-mode .firmware-panel h3) {
  color: rgba(248, 250, 252, 0.96) !important;
}

:global(.app-container.night-mode .firmware-panel .page-hero p),
:global(.app-container.night-mode .firmware-panel .card-header p),
:global(.app-container.night-mode .firmware-panel .result-panel dt) {
  color: rgba(203, 213, 225, 0.72) !important;
}

:global(.app-container.night-mode .firmware-panel .form-field),
:global(.app-container.night-mode .firmware-panel .form-field span) {
  color: rgba(226, 232, 240, 0.84) !important;
}

:global(.app-container.night-mode .firmware-panel input),
:global(.app-container.night-mode .firmware-panel textarea) {
  background: rgba(15, 23, 42, 0.7) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: rgba(248, 250, 252, 0.92) !important;
}

:global(.app-container.night-mode .firmware-panel input::placeholder),
:global(.app-container.night-mode .firmware-panel textarea::placeholder) {
  color: rgba(148, 163, 184, 0.65) !important;
}

:global(.app-container.night-mode .firmware-panel input[type='file']::file-selector-button) {
  border: 1px solid rgba(148, 163, 184, 0.24) !important;
  border-radius: 10px;
  background: rgba(30, 41, 59, 0.88) !important;
  color: rgba(226, 232, 240, 0.9) !important;
}

:global(.app-container.night-mode .firmware-panel .history-table-wrap),
:global(.app-container.night-mode .firmware-panel .history-table) {
  background: rgba(15, 23, 42, 0.58) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
}

:global(.app-container.night-mode .firmware-panel .history-table th) {
  background: rgba(15, 23, 42, 0.82) !important;
  color: rgba(226, 232, 240, 0.9) !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(.app-container.night-mode .firmware-panel .history-table td) {
  background: transparent !important;
  color: rgba(226, 232, 240, 0.86) !important;
  border-color: rgba(148, 163, 184, 0.14) !important;
}

:global(.app-container.night-mode .firmware-panel .select-trigger) {
  background: rgba(15, 23, 42, 0.7) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: rgba(248, 250, 252, 0.92) !important;
}

:global(.app-container.night-mode .firmware-panel .select-dropdown) {
  background: rgba(15, 23, 42, 0.96) !important;
  border-color: rgba(148, 163, 184, 0.24) !important;
}

:global(.app-container.night-mode .firmware-panel .select-option) {
  color: rgba(226, 232, 240, 0.9) !important;
}

:global(.app-container.night-mode .firmware-panel .select-option:hover) {
  background: rgba(30, 41, 59, 0.92) !important;
  color: rgba(248, 250, 252, 0.96) !important;
}

:global(.app-container.night-mode .firmware-panel .refresh-btn),
:global(.app-container.night-mode .firmware-panel .text-btn) {
  background: rgba(30, 41, 59, 0.82) !important;
  border: 1px solid rgba(148, 163, 184, 0.24) !important;
  color: #bfdbfe !important;
}

:global(.app-container.night-mode .firmware-panel .empty-state) {
  background: rgba(15, 23, 42, 0.58) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
  color: rgba(203, 213, 225, 0.72) !important;
}

:global(.app-container.night-mode .firmware-panel .result-panel) {
  border-color: rgba(148, 163, 184, 0.2) !important;
}

@media (max-width: 1200px) {
  .firmware-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-hero {
    padding: 14px 16px;
    border-radius: 16px;
    margin-bottom: 12px;
  }

  .page-hero h1 {
    font-size: 22px;
  }

  .page-hero p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.4;
  }

  .manage-card {
    padding: 14px 16px;
    border-radius: 16px;
  }

  .card-header {
    margin-bottom: 12px;
    gap: 10px;
  }

  .card-header h2 {
    font-size: 17px;
  }

  .card-header p {
    margin: 3px 0 0;
    font-size: 12px;
  }

  .firmware-form {
    gap: 12px;
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .history-filters {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .form-field span {
    font-size: 12px;
  }

  .form-field input,
  .form-field textarea {
    padding: 9px 10px;
    font-size: 13px;
    border-radius: 10px;
  }

  .submit-btn {
    width: 100%;
    padding: 10px 16px;
    font-size: 14px;
  }

  .result-panel {
    margin-top: 14px;
    padding-top: 12px;
  }

  .result-panel h3 {
    font-size: 15px;
    margin-bottom: 10px;
  }

  .result-panel dl > div {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .history-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .lan-tip {
    margin-top: 10px;
    padding: 8px 10px;
    font-size: 12px;
  }

  .empty-state {
    min-height: 100px;
  }
}
</style>

