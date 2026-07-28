# SmartConfig BSSID Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Android SmartConfig from entering a false sending state when the current Wi-Fi BSSID is unavailable, and produce an installable APK whose web assets contain the fix.

**Architecture:** Keep the existing Vue-to-JavaScript-interface boundary. The Vue panel requires current Wi-Fi identity before enabling provisioning, while the Java bridge independently validates permissions, location, current SSID, and BSSID before constructing `EsptouchTask`; packaged Capacitor assets are regenerated only after focused tests and the frontend build pass.

**Tech Stack:** Vue 3, TypeScript, Capacitor 8, Java 21, Android SDK 36, `lib-esptouch-android:1.1.1`, Node test runner, Gradle.

## Global Constraints

- Provision only the Wi-Fi network currently connected on the Android phone.
- Do not add Wi-Fi scanning or allow manual SSID-only provisioning.
- Do not change the ESP8266 firmware or redefine backend connectivity as SmartConfig success.
- Preserve all unrelated working-tree changes; do not commit implementation files because the same files already contain user-owned uncommitted edits.
- Keep `lib-esptouch-android` at version `1.1.1`.

---

### Task 1: Add failing SmartConfig guard tests

**Files:**
- Modify: `tests/smartConfigAndroidBridge.test.ts`
- Test: `tests/smartConfigAndroidBridge.test.ts`

**Interfaces:**
- Consumes: text of `SmartConfigPanel.vue`, `AndroidSmartConfigBridge.java`, and `android/app/build.gradle`.
- Produces: regression assertions that define frontend BSSID eligibility, native preflight order, precise statuses, non-manual copy, and APK version progression.

- [ ] **Step 1: Write the failing frontend tests**

Add assertions to the existing integration suite:

```ts
it('requires a detected BSSID before enabling provisioning', () => {
  assert.match(smartConfigPanel, /if \(!bssid\.value\.trim\(\)\) return false/)
  assert.match(smartConfigPanel, /bssid_required: 'WiFi BSSID 不可用'/)
  assert.doesNotMatch(smartConfigPanel, /自动获取 WiFi 失败不代表不能配网/)
})
```

- [ ] **Step 2: Write the failing native preflight test**

```ts
it('rejects invalid current WiFi identity before creating EsptouchTask', () => {
  assert.match(smartConfigBridge, /private boolean isValidBssid\(String value\)/)
  assert.match(smartConfigBridge, /return json\("bssid_required"/)
  assert.match(smartConfigBridge, /return json\("wifi_changed"/)
  const guardIndex = smartConfigBridge.indexOf('return json("bssid_required"')
  const taskIndex = smartConfigBridge.indexOf('new EsptouchTask(')
  assert.ok(guardIndex >= 0 && guardIndex < taskIndex)
})
```

- [ ] **Step 3: Add APK version fixture and failing assertion**

Read `android/app/build.gradle` into `androidBuildGradle`, then add:

```ts
it('increments the corrected Android build version', () => {
  const versionCode = androidBuildGradle.match(/versionCode\s+(\d+)/)
  assert.ok(versionCode)
  assert.ok(Number(versionCode[1]) > 1)
  assert.match(androidBuildGradle, /versionName\s+"1\.0\.1"/)
})
```

- [ ] **Step 4: Run the focused test and verify RED**

Run: `node --test tests/smartConfigAndroidBridge.test.ts`

Expected: the new BSSID guard and version tests fail, and the existing packaged-asset hash test remains red because Android assets have not yet been synchronized.

---

### Task 2: Enforce current-Wi-Fi identity in the native bridge

**Files:**
- Modify: `android/app/src/main/java/com/genius/smartlight/AndroidSmartConfigBridge.java:112-315`
- Test: `tests/smartConfigAndroidBridge.test.ts`

**Interfaces:**
- Consumes: Android `WifiManager`, `WifiInfo`, permission helpers, `cleanSsid(String)`, and `EsptouchTask`.
- Produces: `isValidBssid(String): boolean`; synchronous statuses `permission_denied`, `location_disabled`, `not_connected_to_wifi`, `wifi_changed`, and `bssid_required` before any SDK task is created.

- [ ] **Step 1: Centralize BSSID validation**

Add the helper near the existing text normalization helpers:

```java
private boolean isValidBssid(String value) {
    String normalized = normalizeText(value);
    return !TextUtils.isEmpty(normalized)
            && !"02:00:00:00:00:00".equalsIgnoreCase(normalized)
            && !"00:00:00:00:00:00".equalsIgnoreCase(normalized)
            && normalized.matches("(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}");
}
```

Replace the duplicate BSSID checks in `getWifiInfo()` with `isValidBssid(bssid)`.

- [ ] **Step 2: Add native preflight before the multicast lock**

In `startSmartConfig()`, after confirming Wi-Fi is enabled and before acquiring the multicast lock:

```java
if (!ensureWifiPermissions()) {
    pendingAction = "getWifiInfo";
    return json("permission_denied", "权限未授权，请允许定位 / 附近设备权限后重新获取当前 WiFi");
}

if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && !isLocationEnabled()) {
    return json("location_disabled", "系统定位未开启，请打开定位后重新获取当前 WiFi");
}

WifiInfo info = getConnectionInfo();
String currentSsid = info == null ? "" : cleanSsid(info.getSSID());
if (info == null || TextUtils.isEmpty(currentSsid) || info.getIpAddress() == 0) {
    return json("not_connected_to_wifi", "手机未连接 WiFi，请先连接目标 2.4G WiFi");
}
if (!targetSsid.equals(currentSsid)) {
    return json("wifi_changed", "当前 WiFi 已变化，请重新获取 WiFi 信息后再配网");
}

String bssid = normalizeText(info.getBSSID());
if (!isValidBssid(bssid)) {
    return json("bssid_required", "无法获取当前 WiFi BSSID，请确认权限和定位已开启，并重新连接目标 2.4G WiFi");
}
```

Remove the misleading log that says an empty BSSID will broadcast to all APs.

- [ ] **Step 3: Run the focused test**

Run: `node --test tests/smartConfigAndroidBridge.test.ts`

Expected: the native preflight assertions pass; frontend, version, and asset synchronization assertions remain red.

---

### Task 3: Prevent frontend manual bypass and surface preflight errors

**Files:**
- Modify: `src/components/settings/SmartConfigPanel.vue:32-206`
- Modify: `src/components/settings/SmartConfigPanel.vue:367-550`
- Test: `tests/smartConfigAndroidBridge.test.ts`

**Interfaces:**
- Consumes: native `getWifiInfo()` results and `startSmartConfig()` status strings.
- Produces: start eligibility requiring `bssid`; read-only current-Wi-Fi field; actionable `bssid_required` and `wifi_changed` messages.

- [ ] **Step 1: Make current Wi-Fi read-only and require BSSID**

Remove `manualSsidMode`, `manualSsidEdited`, and `onSsidManualInput`. Make the SSID input `readonly`. Update eligibility:

```ts
const canStartConfig = computed(() => {
  if (taskActive.value) return false
  if (!bridgeReady.value) return false
  if (!getEspTouchPlugin()) return false
  if (!ssid.value.trim()) return false
  if (!bssid.value.trim()) return false
  if (!password.value) return false
  return true
})
```

- [ ] **Step 2: Clear stale Wi-Fi identity on detection failures**

Add:

```ts
function clearWifiIdentity() {
  ssid.value = ''
  bssid.value = ''
}
```

Call it for disabled Wi-Fi, disconnected Wi-Fi, denied permission, disabled location, failed SSID, and failed BSSID paths. Treat `bssid_failed` and `bssid_required` as the same actionable UI state.

- [ ] **Step 3: Add status labels and start error messages**

Add `bssid_required: 'WiFi BSSID 不可用'` and `wifi_changed: '当前 WiFi 已变化'` to the status map. Add matching messages to `startSmartConfig()`'s `errorMessages`. Replace the manual fallback tip with:

```html
<p>配网仅支持手机当前连接的 2.4G WiFi；切换网络后请重新获取 WiFi 信息。</p>
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/smartConfigAndroidBridge.test.ts`

Expected: frontend and native guard assertions pass; version and packaged-asset synchronization assertions remain red.

---

### Task 4: Version, build, and synchronize Android assets

**Files:**
- Modify: `android/app/build.gradle:10-16`
- Regenerate: `dist/`
- Regenerate: `android/app/src/main/assets/public/`
- Test: `tests/smartConfigAndroidBridge.test.ts`

**Interfaces:**
- Consumes: completed Vue and Java changes.
- Produces: Android `versionCode 2`, `versionName "1.0.1"`, matching `dist`/Android asset hashes, and a buildable Android project.

- [ ] **Step 1: Increment Android version**

```gradle
versionCode 2
versionName "1.0.1"
```

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`

Expected: `vue-tsc -b` and Vite complete successfully.

- [ ] **Step 3: Synchronize Capacitor Android resources**

Run: `npx cap sync android`

Expected: `dist` is copied into `android/app/src/main/assets/public` and Capacitor reports Android sync success.

- [ ] **Step 4: Run focused and project tests**

Run: `node --test tests/smartConfigAndroidBridge.test.ts`

Expected: all tests pass, including matching script and stylesheet asset hashes.

Run: `npm test -- --runInBand` only if the repository defines an `npm test` script; otherwise run `node --test tests/*.test.ts`.

Expected: all applicable project tests pass.

- [ ] **Step 5: Assemble the corrected debug APK**

Run from `android/`: `.\gradlew.bat assembleDebug`

Expected: `BUILD SUCCESSFUL` and `android/app/build/outputs/apk/debug/app-debug.apk` has a new modification time.

- [ ] **Step 6: Verify the APK payload**

Open the APK as a ZIP and confirm `assets/public/index.html` references the same hashed JavaScript bundle as `dist/index.html`. Confirm that bundle contains `bssid_required` and that the APK manifest reports version code `2` and version name `1.0.1`.

---

### Task 5: Final regression review

**Files:**
- Review: `android/app/src/main/java/com/genius/smartlight/AndroidSmartConfigBridge.java`
- Review: `src/components/settings/SmartConfigPanel.vue`
- Review: `tests/smartConfigAndroidBridge.test.ts`

**Interfaces:**
- Consumes: all task outputs.
- Produces: evidence that no packet-sending task can start without a valid current Wi-Fi BSSID and that unrelated working-tree changes remain intact.

- [ ] **Step 1: Inspect the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git diff -- android/app/src/main/java/com/genius/smartlight/AndroidSmartConfigBridge.java src/components/settings/SmartConfigPanel.vue tests/smartConfigAndroidBridge.test.ts android/app/build.gradle`

Expected: only the approved SmartConfig guard, regression tests, and version increment are present in the reviewed hunks, alongside pre-existing user changes that have been preserved.

- [ ] **Step 2: Confirm runtime status boundaries**

Verify by inspection that `bssid_required`, `wifi_changed`, and other preflight statuses return before `new EsptouchTask(...)`, while `task_started` remains after `currentThread.start()`.

- [ ] **Step 3: Record the manual-device verification gap**

If no Android device with ADB is attached, report that real-radio verification remains outstanding. Do not claim that physical SmartConfig transmission was observed without Logcat and ESP8266 serial evidence.
