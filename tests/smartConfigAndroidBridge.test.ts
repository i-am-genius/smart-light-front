import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const smartConfigPanel = readFileSync(
  new URL('../src/components/settings/SmartConfigPanel.vue', import.meta.url),
  'utf8',
)

const mainActivity = readFileSync(
  new URL('../android/app/src/main/java/com/genius/smartlight/MainActivity.java', import.meta.url),
  'utf8',
)

const smartConfigBridge = readFileSync(
  new URL('../android/app/src/main/java/com/genius/smartlight/AndroidSmartConfigBridge.java', import.meta.url),
  'utf8',
)

const androidBuildGradle = readFileSync(
  new URL('../android/app/build.gradle', import.meta.url),
  'utf8',
)

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

function getAssetPath(indexHtml: string, assetKind: 'script' | 'stylesheet') {
  const pattern = assetKind === 'script'
    ? /<script[^>]+src="([^"]+)"/
    : /<link[^>]+href="([^"]+\.css)"/

  const match = indexHtml.match(pattern)
  assert.ok(match, `${assetKind} asset should be referenced from index.html`)
  return match[1].replace(/^\//, '')
}

describe('Android SmartConfig bridge integration', () => {
  it('front end waits for the Android bridge instead of checking once on mount', () => {
    assert.match(smartConfigPanel, /const bridgeReady = ref\(false\)/)
    assert.match(smartConfigPanel, /function waitForSmartConfigBridge/)
    assert.match(smartConfigPanel, /let bridgeWaitPromise/)
    assert.match(smartConfigPanel, /setTimeout\(tryResolveBridge,\s*SMARTCONFIG_BRIDGE_POLL_INTERVAL_MS\)/)
    assert.match(smartConfigPanel, /smartconfig-bridge-ready/)
    assert.doesNotMatch(smartConfigPanel, /onMounted\(\(\) => \{\s*window\.addEventListener\('smartconfig-status'[\s\S]*if \(!getEspTouchPlugin\(\)\)/)
  })

  it('Android notifies the WebView when AndroidSmartConfig has been injected', () => {
    assert.match(mainActivity, /addJavascriptInterface\(smartConfigBridge,\s*"AndroidSmartConfig"\)/)
    assert.match(mainActivity, /notifyBridgeReady\(\)/)
    assert.match(smartConfigBridge, /void notifyBridgeReady\(\)/)
    assert.match(smartConfigBridge, /smartconfig-bridge-ready/)
  })

  it('WiFi info results are not dispatched as provisioning success events', () => {
    assert.match(smartConfigPanel, /function handleWifiInfoResult/)
    assert.match(smartConfigPanel, /function applyWifiInfoStatus/)
    assert.match(smartConfigPanel, /status === 'wifi_info'/)
    assert.match(smartConfigPanel, /detail\.source === 'getWifiInfo'/)
    assert.match(smartConfigPanel, /ssid\.value = detail\?\.ssid \|\| ''/)
    assert.match(smartConfigPanel, /bssid\.value = detail\?\.bssid \|\| ''/)
    assert.match(smartConfigBridge, /\.put\("source", "getWifiInfo"\)/)
    assert.match(smartConfigBridge, /\.put\("status", "wifi_info"\)/)
    assert.doesNotMatch(smartConfigBridge, /dispatchStatus\(obj\);/)
  })

  it('provides an explicit build-and-sync command for Android packaged assets', () => {
    assert.equal(packageJson.scripts['android:sync'], 'npm run build && npx cap sync android')
  })

  it('requires a detected BSSID before enabling provisioning', () => {
    assert.match(smartConfigPanel, /if \(!bssid\.value\.trim\(\)\) return false/)
    assert.match(smartConfigPanel, /bssid_required: 'WiFi BSSID 不可用'/)
    assert.doesNotMatch(smartConfigPanel, /自动获取 WiFi 失败不代表不能配网/)
  })

  it('rejects invalid current WiFi identity before creating EsptouchTask', () => {
    assert.match(smartConfigBridge, /private boolean isValidBssid\(String value\)/)
    assert.match(smartConfigBridge, /return json\("bssid_required"/)
    assert.match(smartConfigBridge, /return json\("wifi_changed"/)

    const guardIndex = smartConfigBridge.indexOf('return json("bssid_required"')
    const taskIndex = smartConfigBridge.indexOf('new EsptouchTask(')
    assert.ok(guardIndex >= 0 && guardIndex < taskIndex)
  })

  it('increments the corrected Android build version', () => {
    const versionCode = androidBuildGradle.match(/versionCode\s+(\d+)/)
    assert.ok(versionCode)
    assert.ok(Number(versionCode[1]) > 1)
    assert.match(androidBuildGradle, /versionName\s+"1\.0\.1"/)
  })
})

describe('Android packaged web assets', () => {
  it('match the latest dist build output', () => {
    const distIndexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))
    const androidIndexPath = fileURLToPath(new URL('../android/app/src/main/assets/public/index.html', import.meta.url))
    const distIndex = readFileSync(distIndexPath, 'utf8')
    const androidIndex = readFileSync(androidIndexPath, 'utf8')

    const distDir = dirname(distIndexPath)
    const androidDir = dirname(androidIndexPath)

    for (const kind of ['script', 'stylesheet'] as const) {
      const distAsset = getAssetPath(distIndex, kind)
      const androidAsset = getAssetPath(androidIndex, kind)

      assert.equal(androidAsset, distAsset, `${kind} asset hash should match latest dist`)

      const distAssetPath = join(distDir, distAsset)
      const androidAssetPath = join(androidDir, androidAsset)
      assert.ok(existsSync(distAssetPath), `dist asset exists: ${distAsset}`)
      assert.ok(existsSync(androidAssetPath), `Android asset exists: ${androidAsset}`)
      assert.equal(
        readFileSync(androidAssetPath, 'utf8'),
        readFileSync(distAssetPath, 'utf8'),
        `${kind} asset content should be synced`,
      )
    }
  })
})
