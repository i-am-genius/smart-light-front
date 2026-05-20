<template>
  <section class="smart-config-section">
    <div class="smart-card">
      <div class="smart-header">
        <div class="smart-heading">
          <h2 class="smart-title">设备 SmartConfig 配网</h2>
          <p class="smart-desc">
            为 ESP8266 / ESP32 设备配置 WiFi，让设备自动接入当前网络
          </p>
        </div>

        <span class="smart-status" :class="statusClass">
          {{ statusLabel }}
        </span>
      </div>

      <div class="smart-steps">
        <div class="smart-step">
          <span>1</span>
          <p>设备进入一键配网模式</p>
        </div>
        <div class="smart-step">
          <span>2</span>
          <p>手机连接 2.4G WiFi</p>
        </div>
        <div class="smart-step">
          <span>3</span>
          <p>输入密码并开始配网</p>
        </div>
      </div>

      <div class="smart-form">
        <div class="form-row wifi-field">
          <label>当前 WiFi</label>
          <div class="wifi-row">
            <input v-model="ssid" readonly placeholder="请先获取当前 WiFi" />
            <button class="btn-secondary" :disabled="configing" @click="getCurrentWifi">
              获取 WiFi
            </button>
          </div>
          <p class="field-hint placeholder">占位</p>
        </div>

        <div class="form-row password-field">
          <label>WiFi 密码</label>
          <div class="password-row">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入当前 WiFi 密码"
            />
            <button class="btn-light" :disabled="configing" @click="showPassword = !showPassword">
              {{ showPassword ? '隐藏密码' : '显示密码' }}
            </button>
          </div>
          <p class="field-hint placeholder">占位</p>
        </div>

      </div>

      <div class="smart-actions">
        <button class="btn-primary" :disabled="configing" @click="startSmartConfig">
          {{ configing ? '配网中...' : '开始配网' }}
        </button>

        <button v-if="configing" class="btn-danger" @click="cancelSmartConfig">
          取消配网
        </button>
      </div>

      <div v-if="message" class="smart-message" :class="statusClass">
        <div class="message-title">{{ statusLabel }}</div>
        <div class="message-body">{{ message }}</div>
      </div>

      <div class="smart-tips">
        <p>SmartConfig 需要 Android App 真机环境和原生插件支持，普通浏览器无法完成配网。</p>
        <p>建议手机连接 2.4G WiFi，部分 ESP8266 / ESP32 不支持 5G WiFi。</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const ssid = ref('')
const bssid = ref('')
const password = ref('')
const serverPort = ref(Number(import.meta.env.VITE_DEVICE_SERVER_PORT || 80))
const serverHost = ref(resolveDefaultServerHost())

const configing = ref(false)
const message = ref('')
const success = ref(false)
const showPassword = ref(false)
const smartStatus = ref('idle')

const statusMessageMap: Record<string, string> = {
  preparing: '正在准备 SmartConfig...',
  sending: '正在发送 WiFi 配置信息...',
  waiting: '等待设备连接 WiFi...',
  success: '配网成功，设备正在连接服务器，请稍后到设备列表查看上线状态。',
  failed: '配网失败，请确认 WiFi 密码和设备配网模式。',
  stopped: '已取消配网。',
}

const currentStatus = computed(() => smartStatus.value || 'idle')

const statusLabelMap: Record<string, string> = {
  idle: '待配网',
  preparing: '准备中',
  sending: '正在发送配网信息',
  waiting: '等待设备连接 WiFi',
  success: '配网成功',
  failed: '配网失败',
  stopped: '已取消配网',
  unsupported: '浏览器不支持',
}

const statusLabel = computed(() => statusLabelMap[currentStatus.value] || '待配网')
const statusClass = computed(() => ({
  active: currentStatus.value === 'preparing' || currentStatus.value === 'sending' || currentStatus.value === 'waiting',
  success: currentStatus.value === 'success',
  error: currentStatus.value === 'failed',
  warning: currentStatus.value === 'unsupported',
  stopped: currentStatus.value === 'stopped',
}))

function setMessage(msg: string, ok = false, status?: string) {
  message.value = msg
  success.value = ok
  if (status) {
    smartStatus.value = status
  }
}

function getEspTouchPlugin() {
  return window.AndroidSmartConfig || null
}

function resolveDefaultServerHost() {
  const host = String(import.meta.env.VITE_DEVICE_SERVER_HOST || '').trim()

  if (!host) return ''

  if (isLocalOnlyHost(host)) {
    return ''
  }

  return host
}

function isLocalOnlyHost(host: string) {
  const normalized = host.trim().toLowerCase()
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '10.0.2.2'
}

async function normalizeBridgeResult(value: any) {
  const resolved = await Promise.resolve(value)

  if (typeof resolved === 'string') {
    try {
      return JSON.parse(resolved)
    } catch {
      return { status: resolved }
    }
  }

  return resolved || {}
}

function handleSmartConfigStatus(event: Event) {
  const detail = (event as CustomEvent).detail || {}
  const status = String(detail.status || '')
  const ok = status === 'success'

  if (status === 'success' || status === 'failed' || status === 'stopped') {
    configing.value = false
  }

  const fallback = statusMessageMap[status] || '配网状态已更新'
  setMessage(detail.message || fallback, ok, status || undefined)
}

async function getCurrentWifi() {
  const esptouch = getEspTouchPlugin()

  if (!esptouch) {
    setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 中使用。', false, 'unsupported')
    return
  }

  setMessage('正在获取当前 WiFi...', false, 'preparing')

  try {
    const res = await normalizeBridgeResult(esptouch.getWifiInfo())

    const currentSsid = res?.ssid || res?.SSID || ''
    const currentBssid = res?.bssid || res?.BSSID || ''

    if (!currentSsid) {
      setMessage(res?.message || '获取 WiFi 失败，请确认手机已连接 WiFi，并开启定位 / 附近设备权限。', false, 'failed')
      return
    }

    ssid.value = currentSsid
    bssid.value = currentBssid
    setMessage(`已获取当前 WiFi：${currentSsid}`, false, 'idle')
  } catch (e) {
    console.error(e)
    setMessage('调用获取 WiFi 接口失败，请检查 AndroidSmartConfig bridge。', false, 'failed')
  }
}

async function startSmartConfig() {
  const esptouch = getEspTouchPlugin()

  if (!esptouch) {
    setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 中使用。', false, 'unsupported')
    return
  }

  if (!ssid.value.trim()) {
    setMessage('请先获取当前 WiFi。', false, 'failed')
    return
  }

  if (!password.value) {
    setMessage('请输入 WiFi 密码。', false, 'failed')
    return
  }

  const host = serverHost.value.trim()
  const port = Number(serverPort.value) || 80

  if (!host) {
    setMessage('设备服务器地址未配置，请检查 VITE_DEVICE_SERVER_HOST。', false, 'failed')
    return
  }

  if (isLocalOnlyHost(host)) {
    setMessage('设备服务器地址不能是 127.0.0.1 / localhost / 10.0.2.2，请检查 VITE_DEVICE_SERVER_HOST。', false, 'failed')
    return
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    setMessage('设备服务器端口配置错误，请检查 VITE_DEVICE_SERVER_PORT。', false, 'failed')
    return
  }

  configing.value = true
  setMessage('正在配网，请保持设备处于 SmartConfig 模式...', false, 'preparing')

  try {
    const res = await normalizeBridgeResult(
      esptouch.startSmartConfig(
        ssid.value.trim(),
        password.value,
        host,
        port,
      ),
    )

    if (res?.status === 'failed') {
      configing.value = false
      setMessage(res?.message || statusMessageMap.failed, false, 'failed')
      return
    }

    if (res?.status === 'success') {
      configing.value = false
      setMessage(res?.message || statusMessageMap.success, true, 'success')
      return
    }

    setMessage(
      res?.message || statusMessageMap.preparing,
      false,
      String(res?.status || 'preparing'),
    )
  } catch (e) {
    console.error(e)
    configing.value = false
    setMessage('调用 SmartConfig 失败，请检查 AndroidSmartConfig bridge。', false, 'failed')
  }
}

async function cancelSmartConfig() {
  const esptouch = getEspTouchPlugin()

  try {
    if (esptouch?.stopSmartConfig) {
      const res = await normalizeBridgeResult(esptouch.stopSmartConfig())
      setMessage(res?.message || '已取消配网。', false, 'stopped')
    } else {
      setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 中使用。', false, 'unsupported')
    }
  } catch (e) {
    console.error(e)
    setMessage('取消配网失败。', false, 'failed')
  }

  configing.value = false
}

onMounted(() => {
  window.addEventListener('smartconfig-status', handleSmartConfigStatus)

  if (!getEspTouchPlugin()) {
    setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 中使用。', false, 'unsupported')
  } else if (!serverHost.value) {
    setMessage('请填写电脑局域网 IP，Android 真机不能使用 127.0.0.1 / localhost。', false, 'idle')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('smartconfig-status', handleSmartConfigStatus)
})
</script>

<style scoped>
.smart-config-section {
  width: 100%;
  margin: 32px 0;
  padding: 28px 24px;
  box-sizing: border-box;
  min-width: 0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.smart-card {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
  min-width: 0;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    0 22px 52px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.88) inset;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.smart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.smart-heading {
  min-width: 0;
}

.smart-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #111827;
  letter-spacing: 0;
}

.smart-desc {
  margin: 8px 0 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
}

.smart-status {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid transparent;
}

.smart-status.active {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #bfdbfe;
}

.smart-status.success {
  color: #047857;
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.smart-status.error {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fecaca;
}

.smart-status.warning {
  color: #92400e;
  background: #fffbeb;
  border-color: #fde68a;
}

.smart-status.stopped {
  color: #64748b;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.smart-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 20px 0;
}

.smart-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  min-width: 0;
}

.smart-step span {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.smart-step p {
  margin: 0;
  font-size: 13px;
  color: #374151;
  line-height: 1.35;
}

.smart-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-row {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.wifi-field,
.password-field {
  grid-column: span 1;
}

.form-row label {
  font-size: 14px;
  color: #374151;
  font-weight: 600;
}

.form-row input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 12px;
  outline: none;
  font-size: 14px;
  background: #fff;
  box-sizing: border-box;
  min-width: 0;
}

.form-row input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.wifi-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  min-width: 0;
}

.password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  min-width: 0;
}

.field-hint {
  min-height: 18px;
  margin: 0;
  color: #92400e;
  font-size: 12px;
  line-height: 1.45;
}

.field-hint.placeholder {
  visibility: hidden;
}

.smart-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary,
.btn-secondary,
.btn-danger,
.btn-light {
  min-height: 42px;
  padding: 0 16px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  transition:
    transform 0.16s ease,
    opacity 0.16s ease,
    box-shadow 0.16s ease;
}

.btn-primary {
  color: #fff;
  background: #2563eb;
  box-shadow: 0 10px 18px rgba(37, 99, 235, 0.2);
}

.btn-secondary {
  color: #1d4ed8;
  background: #eff6ff;
}

.btn-light {
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.btn-danger {
  color: #b91c1c;
  background: #fee2e2;
}

.btn-primary:hover,
.btn-secondary:hover,
.btn-danger:hover,
.btn-light:hover {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.smart-message {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
}

.smart-message.success {
  color: #047857;
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.smart-message.error {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fecaca;
}

.smart-message.warning {
  color: #92400e;
  background: #fffbeb;
  border-color: #fde68a;
}

.smart-message.stopped {
  color: #64748b;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.message-title {
  font-size: 13px;
  font-weight: 900;
}

.message-body {
  margin-top: 2px;
}

.smart-tips {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
  line-height: 1.6;
}

.smart-tips p {
  margin: 4px 0;
}

@media (max-width: 899px) {
  .smart-config-section {
    margin: 28px 0;
    padding: 20px 16px;
  }

  .smart-card {
    max-width: 100%;
    padding: 20px;
  }

  .smart-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .smart-config-section {
    margin: 16px 0 0;
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .smart-card {
    width: 100%;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.72);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10);
  }

  .smart-header {
    flex-direction: column;
    gap: 8px;
  }

  .smart-title {
    font-size: 16px;
  }

  .smart-desc {
    margin: 4px 0 0;
    font-size: 12px;
  }

  .smart-status {
    align-self: flex-start;
    padding: 4px 10px;
    font-size: 11px;
  }

  .smart-steps {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin: 10px 0;
  }

  .smart-step {
    padding: 6px 5px;
    gap: 4px;
    border-radius: 10px;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .smart-step span {
    width: 22px;
    height: 22px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .smart-step p {
    font-size: 12px;
    line-height: 1.3;
  }

  .smart-form {
    gap: 10px;
  }

  .form-row label {
    font-size: 12px;
  }

  .form-row input {
    height: 38px;
    padding: 0 10px;
    font-size: 13px;
    border-radius: 10px;
  }

  .wifi-row,
  .password-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .field-hint {
    min-height: 0;
    font-size: 11px;
  }

  .field-hint.placeholder {
    display: none;
  }

  .smart-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    margin-top: 12px;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger,
  .btn-light {
    width: 100%;
    min-height: 40px;
    font-size: 13px;
  }

  .smart-message {
    margin-top: 10px;
    padding: 10px;
    font-size: 12px;
  }

  .smart-tips {
    margin-top: 10px;
    padding: 10px;
    font-size: 11px;
  }
}

:global(.app-container.night-mode) .smart-config-section {
  background: rgba(15, 23, 42, 0.58);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.app-container.night-mode) .smart-card {
  background: rgba(15, 23, 42, 0.82);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow:
    0 22px 52px rgba(0, 0, 0, 0.42),
    0 1px 0 rgba(148, 163, 184, 0.12) inset;
  filter: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.app-container.night-mode) .smart-title,
:global(.app-container.night-mode) .message-title {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .smart-desc,
:global(.app-container.night-mode) .smart-step p {
  color: rgba(203, 213, 225, 0.72);
}

:global(.app-container.night-mode) .smart-step,
:global(.app-container.night-mode) .smart-message {
  background: rgba(15, 23, 42, 0.62);
  border-color: rgba(148, 163, 184, 0.2);
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .form-row label {
  color: rgba(226, 232, 240, 0.88);
}

:global(.app-container.night-mode) .field-hint:not(.placeholder) {
  color: #fcd34d;
}

:global(.app-container.night-mode) .btn-secondary,
:global(.app-container.night-mode) .btn-light {
  background: rgba(30, 41, 59, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: rgba(226, 232, 240, 0.9);
}

:global(.app-container.night-mode) .smart-tips,
:global(.app-container.night-mode) .smart-message.warning {
  background: rgba(120, 53, 15, 0.26);
  border: 1px solid rgba(245, 158, 11, 0.24);
  color: #fde68a;
}

:global(.app-container.night-mode) .smart-message.success {
  background: rgba(6, 95, 70, 0.24);
  border-color: rgba(52, 211, 153, 0.22);
  color: #a7f3d0;
}

:global(.app-container.night-mode) .smart-message.error {
  background: rgba(127, 29, 29, 0.24);
  border-color: rgba(248, 113, 113, 0.22);
  color: #fecaca;
}

</style>
