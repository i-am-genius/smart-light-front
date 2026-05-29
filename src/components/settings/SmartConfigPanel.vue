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
            <input
              v-model="ssid"
              :placeholder="ssidPlaceholder"
              :disabled="taskActive"
              @input="onSsidManualInput"
            />
            <button class="btn-secondary" :disabled="taskActive" @click="getCurrentWifi">
              获取 WiFi
            </button>
          </div>
          <p v-if="wifiHint" class="field-hint">{{ wifiHint }}</p>
          <p v-else class="field-hint placeholder">占位</p>
        </div>

        <div class="form-row password-field">
          <label>WiFi 密码</label>
          <div class="password-row">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入当前 WiFi 密码"
              :disabled="taskActive"
            />
            <button class="btn-light" :disabled="taskActive" @click="showPassword = !showPassword">
              {{ showPassword ? '隐藏密码' : '显示密码' }}
            </button>
          </div>
          <p class="field-hint placeholder">占位</p>
        </div>
      </div>

      <div class="smart-actions">
        <button
          class="btn-primary"
          :disabled="!canStartConfig"
          @click="startSmartConfig"
        >
          {{ configButtonLabel }}
        </button>

        <button v-if="taskActive" class="btn-danger" @click="cancelSmartConfig">
          取消配网
        </button>
      </div>

      <div v-if="message" class="smart-message" :class="statusClass">
        <div class="message-title">{{ statusLabel }}</div>
        <div class="message-body">{{ message }}</div>
        <div v-if="currentStatus === 'location_disabled'" class="message-action">
          <button class="btn-secondary" @click="openLocationSettings">打开定位设置</button>
        </div>
        <div v-if="currentStatus === 'permission_denied'" class="message-action">
          <button class="btn-secondary" @click="getCurrentWifi">重新获取权限</button>
        </div>
        <div v-if="currentStatus === 'permission_denied_permanent'" class="message-action">
          <button class="btn-secondary" @click="openAppSettings">打开系统设置</button>
        </div>
      </div>

      <div class="smart-tips">
        <p v-if="envWarning">{{ envWarning }}</p>
        <p>建议手机连接 2.4G WiFi，部分 ESP8266 / ESP32 不支持 5G WiFi。</p>
        <p>SmartConfig 需要 Android 真机环境和原生插件支持，浏览器 / 模拟器无法完成配网。</p>
        <p v-if="currentStatus === 'ssid_failed' || manualSsidMode">
          SmartConfig 自动获取 WiFi 失败不代表不能配网，只要手机连接目标 2.4G WiFi，并正确输入 WiFi 名称和密码，仍可尝试配网。
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// ---- State ----

const ssid = ref('')
const bssid = ref('')
const password = ref('')
const serverPort = ref(Number(import.meta.env.VITE_DEVICE_SERVER_PORT || 80))
const serverHost = ref(resolveDefaultServerHost())

const message = ref('')
const showPassword = ref(false)
const smartStatus = ref('idle')
const envWarning = ref('')
const wifiHint = ref('')
const locationEnabled = ref(true)
const envChecked = ref(false)
const manualSsidMode = ref(false)
const manualSsidEdited = ref(false)
const deviceIp = ref('')

// ---- Status maps ----

const statusLabelMap: Record<string, string> = {
  idle: '待配网',
  checking_native: '正在检查 SmartConfig 能力...',
  task_started: 'SmartConfig 任务已启动',
  sending: '正在发送配网信息',
  waiting: '等待设备连接 WiFi',
  device_found: '发现设备响应',
  success: '配网成功',
  timeout: '配网超时',
  failed: '配网失败',
  cancelled: '已取消配网',
  stopped: '已取消配网',
  unsupported: '环境不支持',
  permission_denied: '权限未授权',
  permission_denied_permanent: '权限被永久拒绝',
  location_disabled: '定位已关闭',
  wifi_disabled: 'WiFi 已关闭',
  not_connected_to_wifi: '未连接 WiFi',
  ssid_failed: '获取 WiFi 失败，可手动输入',
  bssid_failed: '获取 WiFi BSSID 失败',
  no_wifi: '未连接 WiFi',
  ssid_empty: 'SSID 为空',
  password_empty: '密码为空',
  multicast_lock_failed: '多播锁获取失败',
  smartconfig_sdk_missing: '缺少 ESP-Touch SDK',
  smartconfig_task_create_failed: '创建配网任务失败',
  smartconfig_start_failed: '启动配网任务失败',
  exception: '配网异常',
  unknown_error: '获取 WiFi 异常',
}

const statusClass = computed(() => {
  const s = currentStatus.value
  if (s === 'checking_native' || s === 'sending' || s === 'waiting' || s === 'device_found' || s === 'task_started') return { active: true }
  if (s === 'success') return { success: true }
  if (s === 'cancelled' || s === 'stopped') return { stopped: true }
  if (s === 'unsupported' || s === 'permission_denied' || s === 'location_disabled') return { warning: true }
  return { error: true }
})

const currentStatus = computed(() => smartStatus.value || 'idle')
const statusLabel = computed(() => statusLabelMap[currentStatus.value] || currentStatus.value)

// taskActive: true whenever a provisioning flow is in progress (including checking_native)
const taskActive = computed(() => {
  const s = currentStatus.value
  return s === 'checking_native' || s === 'task_started' || s === 'sending' || s === 'waiting' || s === 'device_found'
})

const configButtonLabel = computed(() => {
  if (currentStatus.value === 'checking_native') return '正在检查...'
  if (taskActive.value) return '配网中...'
  return '开始配网'
})

// ---- Computed ----

const ssidPlaceholder = computed(() => {
  if (manualSsidMode.value) return '请手动输入当前连接的 2.4G WiFi 名称'
  return '请先获取当前 WiFi，或直接手动输入'
})

const canStartConfig = computed(() => {
  if (taskActive.value) return false
  if (!getEspTouchPlugin()) return false
  if (!ssid.value.trim()) return false
  if (!password.value) return false
  return true
})

// ---- Helpers ----

function setMessage(msg: string, status?: string) {
  message.value = msg
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
  if (isLocalOnlyHost(host)) return ''
  return host
}

function isLocalOnlyHost(host: string) {
  const normalized = host.trim().toLowerCase()
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '10.0.2.2'
}

function onSsidManualInput() {
  if (!manualSsidEdited.value && ssid.value.trim()) {
    manualSsidEdited.value = true
    manualSsidMode.value = true
    console.log('[SmartConfig] user manually typed SSID:', ssid.value.trim())
  }
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

// ---- SmartConfig status event handler (async results from Java background thread) ----

function handleSmartConfigStatus(event: Event) {
  const detail = (event as CustomEvent).detail || {}
  const status = String(detail.status || '')
  const msg = detail.message || ''

  console.log('[SmartConfig] event received — status=%s, message=%s', status, msg)

  // Terminal states from the background thread
  if (status === 'success') {
    deviceIp.value = detail.deviceIp || ''
    console.log('[SmartConfig] provisioning SUCCESS, deviceIp=%s', deviceIp.value)
    setMessage(
      msg || '配网成功，设备正在连接服务器。设备 IP: ' + deviceIp.value + '，请稍后到设备列表查看上线状态。',
      'success',
    )
    return
  }

  if (status === 'timeout') {
    console.log('[SmartConfig] provisioning TIMEOUT')
    setMessage(
      msg || '手机已发送 SmartConfig 信息，但未收到设备响应。请确认设备已进入配网模式、手机连接 2.4G WiFi，且 WiFi 名称和密码正确。',
      'timeout',
    )
    return
  }

  if (status === 'failed') {
    console.log('[SmartConfig] provisioning FAILED')
    setMessage(msg || '配网失败，请确认 WiFi 密码正确且设备处于 SmartConfig 配网模式。', 'failed')
    return
  }

  if (status === 'cancelled' || status === 'stopped') {
    console.log('[SmartConfig] provisioning CANCELLED')
    setMessage(msg || '已取消配网。', 'cancelled')
    return
  }

  // Intermediate states from background thread
  if (status === 'sending' || status === 'waiting' || status === 'device_found') {
    console.log('[SmartConfig] intermediate state: %s', status)
    setMessage(msg, status)
    return
  }
}

// ---- WiFi ----

async function getCurrentWifi() {
  const esptouch = getEspTouchPlugin()

  if (!esptouch) {
    setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 真机中使用。浏览器 / 模拟器无法完成配网。', 'unsupported')
    return
  }

  console.log('[SmartConfig] getCurrentWifi called')
  setMessage('正在获取当前 WiFi...', 'idle')

  try {
    const res = await normalizeBridgeResult(esptouch.getWifiInfo())
    console.log('[SmartConfig] getWifiInfo result:', JSON.stringify(res))

    const status = res?.status || 'failed'
    const msg = res?.message || '获取 WiFi 失败'

    if (status === 'success') {
      ssid.value = res?.ssid || ''
      bssid.value = res?.bssid || ''
      wifiHint.value = ''
      setMessage(msg, 'idle')
      return
    }

    if (status === 'wifi_disabled') {
      wifiHint.value = '请先打开系统 WiFi 开关，并连接 2.4G WiFi'
      setMessage(msg || 'WiFi 未开启，请打开 WiFi 并连接 2.4G 网络。', 'wifi_disabled')
      return
    }

    if (status === 'not_connected_to_wifi' || status === 'no_wifi') {
      wifiHint.value = '请先连接 2.4G WiFi 网络'
      manualSsidMode.value = true
      setMessage(msg || '手机未连接 WiFi，请先连接 2.4G WiFi。', 'not_connected_to_wifi')
      return
    }

    if (status === 'permission_denied') {
      wifiHint.value = '需要授权权限后才能获取 WiFi，请点击"获取 WiFi"重新申请'
      setMessage(msg || '权限未授权，请允许定位 / 附近设备权限。', 'permission_denied')
      return
    }

    if (status === 'permission_denied_permanent') {
      wifiHint.value = '权限被永久拒绝，请进入系统设置手动开启权限'
      setMessage(msg || '权限已被拒绝且不再询问，请进入系统设置手动开启权限。', 'permission_denied_permanent')
      return
    }

    if (status === 'location_disabled') {
      wifiHint.value = '请先打开系统定位服务'
      setMessage(msg || '系统定位未开启，请打开定位后重新获取 WiFi。', 'location_disabled')
      return
    }

    if (status === 'bssid_failed') {
      // SSID ok but BSSID invalid — still useful, fill SSID but warn
      ssid.value = res?.ssid || ''
      bssid.value = res?.bssid || ''
      wifiHint.value = '已获取 WiFi 名称，但 BSSID 获取失败。请确认权限和系统定位已开启后重试。'
      setMessage(msg || '获取 WiFi BSSID 失败，ESP-Touch 需要当前路由器 BSSID 才能启动配网。请确认权限和系统定位已开启。', 'bssid_failed')
      return
    }

    if (status === 'ssid_failed') {
      wifiHint.value = '自动获取失败，请手动输入当前连接的 2.4G WiFi 名称'
      manualSsidMode.value = true
      setMessage(
        msg || '获取 WiFi 名称失败，请确认权限、定位和 WiFi 连接状态。',
        'ssid_failed',
      )
      return
    }

    // unknown_error or any unhandled status — show error, allow manual input
    wifiHint.value = '自动获取失败，请手动输入 WiFi 名称'
    manualSsidMode.value = true
    setMessage(msg || '获取 WiFi 信息异常。', 'unknown_error')
  } catch (e) {
    console.error('[SmartConfig] getCurrentWifi error:', e)
    setMessage('调用获取 WiFi 接口失败，请确认 App 配置了 AndroidSmartConfig bridge。', 'ssid_failed')
  }
}

// ---- SmartConfig ----

async function startSmartConfig() {
  const esptouch = getEspTouchPlugin()

  console.log('[SmartConfig] startSmartConfig clicked')
  console.log('[SmartConfig]   bridge exists=%s', !!esptouch)
  console.log('[SmartConfig]   ssid=%s', ssid.value.trim())
  console.log('[SmartConfig]   password.length=%d', password.value.length)
  console.log('[SmartConfig]   manualSsidMode=%s', manualSsidMode.value)

  if (!esptouch) {
    setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 真机中使用。浏览器 / 模拟器无法完成配网。', 'unsupported')
    return
  }

  if (!ssid.value.trim()) {
    setMessage('SSID 不能为空，请先获取或手动输入当前 WiFi 名称。', 'ssid_empty')
    return
  }

  if (!password.value) {
    setMessage('请输入 WiFi 密码。', 'password_empty')
    return
  }

  const host = serverHost.value.trim()
  const port = Number(serverPort.value) || 80

  if (!host) {
    setMessage('设备服务器地址未配置，请检查 VITE_DEVICE_SERVER_HOST。', 'unsupported')
    return
  }

  if (isLocalOnlyHost(host)) {
    setMessage('设备服务器地址不能是 127.0.0.1 / localhost / 10.0.2.2，请填写电脑局域网 IP。', 'unsupported')
    return
  }

  // ---- Enter checking_native: WAIT for Java to confirm ----
  console.log('[SmartConfig] entering checking_native state, calling bridge.startSmartConfig...')
  setMessage('正在检查手机 SmartConfig 能力...', 'checking_native')

  let res: any
  try {
    res = await normalizeBridgeResult(
      esptouch.startSmartConfig(ssid.value.trim(), password.value, host, port),
    )
  } catch (e) {
    console.error('[SmartConfig] bridge call threw exception:', e)
    setMessage('调用 SmartConfig 失败，请检查 AndroidSmartConfig bridge 是否正常注册。', 'exception')
    return
  }

  const status = String(res?.status || 'exception')
  const msg = res?.message || ''
  console.log('[SmartConfig] native returned — status=%s, message=%s', status, msg)

  // ---- Only task_started means the Java background thread is really running ----
  if (status === 'task_started') {
    console.log('[SmartConfig] Java confirmed task_started, transitioning to sending')
    wifiHint.value = '请确保手机与设备均连接 2.4G WiFi，5G 频段不支持 ESP 配网'
    // Don't set message here — the background thread will dispatch 'sending' event
    return
  }

  // ---- All other statuses are failures — do NOT enter provisioning ----
  const errorMessages: Record<string, string> = {
    ssid_empty: 'SSID 不能为空，请先获取或手动输入当前 WiFi 名称。',
    password_empty: '密码不能为空。',
    wifi_disabled: 'WiFi 未开启，请先打开 WiFi 开关。',
    not_connected_to_wifi: '手机未连接 WiFi，请先连接到 2.4G WiFi 网络。',
    bssid_required_but_empty: '无法获取 WiFi BSSID，请确认权限已授权且手机已连接 WiFi。',
    multicast_lock_failed: '无法获取多播锁，SmartConfig 需要多播网络权限。',
    smartconfig_sdk_missing: '缺少 ESP-Touch 原生库，当前 App 版本不支持 SmartConfig。',
    smartconfig_task_create_failed: msg || '无法创建 SmartConfig 任务，请检查设备兼容性。',
    smartconfig_start_failed: msg || '无法启动 SmartConfig 后台任务。',
    exception: msg || 'SmartConfig 发生异常。',
    config_validation: msg || '配网参数校验失败。',
    permission_denied: '请先授权定位 / 附近设备权限后再开始配网。',
    location_disabled: '请先打开系统定位服务。',
  }

  const fallbackMsg = errorMessages[status] || (msg || 'SmartConfig 启动失败，status=' + status)
  console.log('[SmartConfig] provisioning blocked — status=%s, reason=%s', status, fallbackMsg)
  setMessage(fallbackMsg, status || 'failed')
}

async function cancelSmartConfig() {
  const esptouch = getEspTouchPlugin()
  console.log('[SmartConfig] cancel clicked')

  try {
    if (esptouch?.stopSmartConfig) {
      const res = await normalizeBridgeResult(esptouch.stopSmartConfig())
      console.log('[SmartConfig] cancel result:', JSON.stringify(res))
      setMessage(res?.message || '已取消配网。', 'cancelled')
    } else {
      setMessage('当前环境不支持取消配网操作。', 'unsupported')
    }
  } catch (e) {
    console.error('[SmartConfig] cancel error:', e)
    setMessage('取消配网失败。', 'failed')
  }
}

function openLocationSettings() {
  const esptouch = getEspTouchPlugin()
  if (esptouch?.openLocationSettings) {
    esptouch.openLocationSettings()
  }
}

function openAppSettings() {
  const esptouch = getEspTouchPlugin()
  if (esptouch?.openAppSettings) {
    esptouch.openAppSettings()
  }
}

// ---- Environment check ----

async function checkEnvironment() {
  const esptouch = getEspTouchPlugin()

  if (!esptouch) {
    envWarning.value = 'SmartConfig 需要真机 App 和原生插件支持，浏览器 / 模拟器无法完成配网。'
    setMessage(envWarning.value, 'unsupported')
    return
  }

  if (esptouch.checkEnvironment) {
    try {
      const env = await normalizeBridgeResult(esptouch.checkEnvironment())
      console.log('[SmartConfig] checkEnvironment:', JSON.stringify(env))

      locationEnabled.value = env?.locationServiceEnabled !== false
      envChecked.value = true

      if (!env?.esptouchSdkAvailable) {
        envWarning.value = 'ESP-Touch SDK 不可用，SmartConfig 功能无法使用。'
      } else if (!env?.wifiServiceAvailable) {
        envWarning.value = 'WiFi 服务不可用，请确认设备支持 WiFi。'
      } else if (!env?.locationServiceEnabled) {
        envWarning.value = '系统定位服务已关闭，Android 10+ 需要开启定位才能获取 WiFi 名称。请打开系统定位后重试。'
      } else if (!env?.hasFineLocation && !env?.hasCoarseLocation && !env?.hasNearbyWifi) {
        envWarning.value = '定位 / 附近设备权限未授权，获取 WiFi 名称需要授权相关权限。'
      } else {
        envWarning.value = ''
      }
    } catch {
      envWarning.value = ''
    }
  }
}

// ---- Lifecycle ----

onMounted(() => {
  window.addEventListener('smartconfig-status', handleSmartConfigStatus)
  checkEnvironment()

  if (!getEspTouchPlugin()) {
    setMessage('当前浏览器环境不支持 SmartConfig，请在 Android App 真机中使用。浏览器 / 模拟器无法完成配网。', 'unsupported')
  } else if (!serverHost.value) {
    setMessage('请填写电脑局域网 IP，Android 真机不能使用 127.0.0.1 / localhost。', 'idle')
  }

  console.log('[SmartConfig] component mounted, bridge=%s, serverHost=%s', !!getEspTouchPlugin(), serverHost.value)
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

.message-action {
  margin-top: 8px;
}

.message-action .btn-secondary {
  font-size: 12px;
  min-height: 32px;
  padding: 0 12px;
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

/* Night mode */
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
