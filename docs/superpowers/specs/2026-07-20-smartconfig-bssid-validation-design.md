# Android SmartConfig BSSID Validation Design

## Goal

Fix the Android SmartConfig flow so it never reports that provisioning has started when the ESP-Touch SDK cannot send packets, and require a valid BSSID for the phone's currently connected 2.4 GHz Wi-Fi network before provisioning begins.

## Root Cause

`lib-esptouch-android:1.1.1` rejects an empty BSSID in the `EsptouchTask` constructor. The current UI allows users to continue after automatic Wi-Fi detection fails and enables provisioning with only an SSID and password. The native bridge then passes an empty BSSID to `EsptouchTask`, which throws before the background sender thread starts. No UDP provisioning packets reach the ESP8266.

## Selected Approach

Provision only the Wi-Fi network to which the Android phone is currently connected. A valid SSID and BSSID must come from Android `WifiInfo`; manual SSID-only provisioning is not supported because the installed ESP-Touch SDK cannot encode a correct payload without the target AP BSSID.

Nearby access-point scanning is intentionally out of scope. Android scan throttling, location restrictions, and ambiguous duplicate SSIDs would add failure modes without improving the normal current-network provisioning workflow.

## Data Flow

1. The page waits for `window.AndroidSmartConfig` and requests current Wi-Fi information.
2. Android requests the required location and nearby-Wi-Fi permissions when needed.
3. Android returns the current SSID, BSSID, and IP only when Wi-Fi is connected, location services are usable, and the BSSID is neither empty nor a masked/all-zero address.
4. The page stores the SSID and BSSID. The start button remains disabled until the bridge, SSID, BSSID, and password are all valid.
5. `startSmartConfig()` performs the same permission, location, connection, SSID, and BSSID checks again so JavaScript cannot bypass the native boundary.
6. Android constructs `EsptouchTask`, starts its worker thread, and only then returns `task_started`.
7. Existing `smartconfig-status` events report sending, waiting, success, timeout, cancellation, or a precise preflight failure.

## Error Handling

- Missing permissions: return `permission_denied` and direct the user to grant location/nearby-Wi-Fi access.
- Permanently denied permissions: keep the existing `permission_denied_permanent` path to application settings.
- Location disabled: return `location_disabled` before creating the ESP-Touch task.
- Phone not connected to Wi-Fi: return `not_connected_to_wifi`.
- Empty, masked, malformed, or all-zero BSSID: return `bssid_required` with a message explaining that the phone must reconnect to the target 2.4 GHz Wi-Fi and refresh Wi-Fi information.
- SDK construction failure: retain `smartconfig_task_create_failed`, but it should no longer be the normal response to missing BSSID.
- The UI must not claim that manual SSID entry can recover from failed BSSID detection.

## Files

- `src/components/settings/SmartConfigPanel.vue`: make BSSID part of the start eligibility, remove the misleading manual fallback, and present actionable BSSID errors.
- `android/app/src/main/java/com/genius/smartlight/AndroidSmartConfigBridge.java`: add native preflight validation before constructing `EsptouchTask`.
- `tests/smartConfigAndroidBridge.test.ts`: add regression coverage for the native BSSID guard and frontend eligibility/copy.
- `android/app/src/main/assets/public/`: regenerate with `npm run android:sync` after tests pass.
- `android/app/build.gradle`: increment the APK version so the corrected build is distinguishable and installable as an update.

## Tests And Verification

1. Run the focused Node integration test and first observe failures for the missing BSSID safeguards.
2. Implement the minimum frontend and native changes needed to make the focused test pass.
3. Run the complete frontend build.
4. Run `npm run android:sync` and verify packaged web asset hashes match `dist`.
5. Assemble a debug APK and verify the ESP-Touch dependency and corrected web bundle are packaged.
6. On a real Android device, verify denied permission, disabled location, disconnected Wi-Fi, masked BSSID, cancellation, timeout, and successful provisioning states. A successful start must log `EsptouchTask created=true` followed by `task_started` before the ESP8266 receives credentials.

## Non-Goals

- Wi-Fi scanning or selecting a network other than the phone's current Wi-Fi.
- Changing the ESP8266 SmartConfig implementation.
- Treating backend/WebSocket connectivity as part of SmartConfig success.
- Refactoring unrelated frontend or Android code.
