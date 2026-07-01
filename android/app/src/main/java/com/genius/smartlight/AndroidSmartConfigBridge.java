package com.genius.smartlight;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.location.LocationManager;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.espressif.iot.esptouch.EsptouchTask;
import com.espressif.iot.esptouch.IEsptouchListener;
import com.espressif.iot.esptouch.IEsptouchResult;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class AndroidSmartConfigBridge {
    private static final String TAG = "SmartConfig";
    static final int WIFI_PERMISSION_REQUEST_CODE = 2107;

    private static final long SMARTCONFIG_TIMEOUT_MS = 90_000L;

    private final Activity activity;
    private final WebView webView;
    private final WifiManager wifiManager;
    private volatile EsptouchTask currentTask;
    private volatile WifiManager.MulticastLock currentMulticastLock;
    private volatile Thread currentThread;
    private String pendingAction;

    public AndroidSmartConfigBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.wifiManager = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    }

    // ---- Environment / capability check ----

    @JavascriptInterface
    public void openAppSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(intent);
        } catch (Exception e) {
            // fallback
        }
    }

    @JavascriptInterface
    public void openLocationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            activity.startActivity(intent);
        } catch (Exception e) {
            // fallback
        }
    }

    @JavascriptInterface
    public String checkEnvironment() {
        try {
            JSONObject result = new JSONObject();
            result.put("isAndroid", true);
            result.put("sdkVersion", Build.VERSION.SDK_INT);
            result.put("wifiServiceAvailable", wifiManager != null);
            result.put("locationServiceEnabled", isLocationEnabled());
            result.put("hasFineLocation", hasPermission(Manifest.permission.ACCESS_FINE_LOCATION));
            result.put("hasCoarseLocation", hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION));
            result.put("hasNearbyWifi", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                    || hasPermission(Manifest.permission.NEARBY_WIFI_DEVICES));
            result.put("esptouchSdkAvailable", isEsptouchSdkAvailable());
            result.put("status", "ok");
            Log.d(TAG, "checkEnvironment: " + result.toString());
            return result.toString();
        } catch (Exception e) {
            return json("failed", "环境检查失败：" + e.getMessage());
        }
    }

    // ---- WiFi info ----

    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public String getWifiInfo() {
        try {
            Log.d(TAG, "========== getWifiInfo called ==========");
            Log.d(TAG, "  device=" + Build.MANUFACTURER + " " + Build.MODEL);
            Log.d(TAG, "  Build.VERSION.SDK_INT=" + Build.VERSION.SDK_INT);
            Log.d(TAG, "  targetSdkVersion=" + activity.getApplicationInfo().targetSdkVersion);
            Log.d(TAG, "  wifiEnabled=" + (wifiManager != null && wifiManager.isWifiEnabled()));
            Log.d(TAG, "  hasFineLocation=" + hasPermission(Manifest.permission.ACCESS_FINE_LOCATION));
            Log.d(TAG, "  hasCoarseLocation=" + hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION));
            Log.d(TAG, "  hasNearbyWifi=" + (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && hasPermission(Manifest.permission.NEARBY_WIFI_DEVICES)));
            Log.d(TAG, "  locationServiceEnabled=" + isLocationEnabled());

            if (wifiManager == null || !wifiManager.isWifiEnabled()) {
                Log.d(TAG, "getWifiInfo result: wifi_disabled");
                return json("wifi_disabled", "WiFi 未开启，请打开 WiFi 并连接 2.4G 网络");
            }

            if (!ensureWifiPermissions()) {
                pendingAction = "getWifiInfo";
                Log.d(TAG, "getWifiInfo result: permission_denied (requesting permissions)");
                return json("permission_denied", "权限未授权，请允许定位 / 附近设备权限");
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    && !isLocationEnabled()) {
                Log.d(TAG, "getWifiInfo result: location_disabled");
                return json("location_disabled", "系统定位未开启，请打开定位后重新获取 WiFi");
            }

            WifiInfo info = getConnectionInfo();
            if (info == null) {
                Log.d(TAG, "getWifiInfo result: not_connected_to_wifi (connectionInfo is null)");
                return json("not_connected_to_wifi", "手机未连接 WiFi，请先连接 2.4G WiFi");
            }

            String rawSsid = info.getSSID();
            String rawBssid = info.getBSSID();
            int rawIp = info.getIpAddress();
            Log.d(TAG, "  WifiInfo: not null");
            Log.d(TAG, "  raw SSID=" + rawSsid);
            Log.d(TAG, "  raw BSSID=" + rawBssid);
            Log.d(TAG, "  raw IP=" + rawIp + " (" + formatIp(rawIp) + ")");

            String ssid = cleanSsid(rawSsid);
            String bssid = normalizeText(rawBssid);
            Log.d(TAG, "  cleaned SSID=" + (TextUtils.isEmpty(ssid) ? "(empty)" : ssid));
            Log.d(TAG, "  cleaned BSSID=" + (TextUtils.isEmpty(bssid) ? "(empty)" : bssid));

            // ---- Validate SSID ----
            boolean ssidValid = !TextUtils.isEmpty(ssid);
            if (ssidValid) {
                Log.d(TAG, "  SSID check: valid");
            } else {
                Log.d(TAG, "  SSID check: FAILED (empty or <unknown ssid>)");
            }

            // ---- Validate BSSID ----
            boolean bssidValid = !TextUtils.isEmpty(bssid)
                    && !"02:00:00:00:00:00".equals(bssid)
                    && !"00:00:00:00:00:00".equals(bssid);
            Log.d(TAG, "  BSSID check: " + (bssidValid ? "valid" : "FAILED (empty or all-zeros)"));

            JSONObject result = new JSONObject();

            if (!ssidValid) {
                result.put("status", "ssid_failed");
                result.put("ssid", ssid);
                result.put("bssid", bssid);
                result.put("message", "获取 WiFi 名称失败，请确认权限和定位已开启");
                Log.d(TAG, "getWifiInfo result: ssid_failed");
            } else if (!bssidValid) {
                result.put("status", "bssid_failed");
                result.put("ssid", ssid);
                result.put("bssid", bssid);
                result.put("message", "获取 WiFi BSSID 失败，ESP-Touch 需要当前路由器 BSSID 才能启动配网");
                Log.d(TAG, "getWifiInfo result: bssid_failed (SSID ok but BSSID invalid: " + bssid + ")");
            } else {
                result.put("status", "success");
                result.put("ssid", ssid);
                result.put("bssid", bssid);
                result.put("ip", formatIp(rawIp));
                result.put("message", "已获取当前 WiFi：" + ssid);
                Log.d(TAG, "getWifiInfo result: success");
            }

            Log.d(TAG, "========== getWifiInfo done ==========");
            return result.toString();
        } catch (Exception e) {
            Log.e(TAG, "getWifiInfo exception", e);
            return json("unknown_error", "获取 WiFi 信息异常：" + e.getMessage());
        }
    }

    // ---- SmartConfig (synchronous pre-flight checks, async execution) ----

    @JavascriptInterface
    public String startSmartConfig(String ssid, String password, String serverHost, int serverPort) {
        String targetSsid = normalizeText(ssid);
        String targetPassword = password == null ? "" : password;
        String targetServerHost = normalizeText(serverHost);
        int targetServerPort = serverPort > 0 ? serverPort : 3000;

        // ---- Check 1: SSID ----
        if (TextUtils.isEmpty(targetSsid)) {
            Log.d(TAG, "result: ssid_empty");
            return json("ssid_empty", "SSID 不能为空，请先获取或手动输入当前 WiFi 名称");
        }

        // ---- Check 2: Password ----
        if (TextUtils.isEmpty(targetPassword)) {
            Log.d(TAG, "result: password_empty");
            return json("password_empty", "密码不能为空");
        }

        // ---- Check 3: Server ----
        if (TextUtils.isEmpty(targetServerHost)) {
            Log.d(TAG, "result: config_validation (empty host)");
            return json("config_validation", "服务器地址不能为空");
        }
        if (isLocalOnlyHost(targetServerHost)) {
            Log.d(TAG, "result: config_validation (local host)");
            return json("config_validation", "Android 真机不能使用 127.0.0.1 / localhost / 10.0.2.2，请填写电脑局域网 IP");
        }

        // ---- Check 4: ESP-Touch SDK available ----
        if (!isEsptouchSdkAvailable()) {
            Log.d(TAG, "result: smartconfig_sdk_missing");
            return json("smartconfig_sdk_missing", "缺少 ESP-Touch 原生库，SmartConfig 不可用");
        }
        Log.d(TAG, "  esptouchSdkAvailable=true");

        // ---- Check 5: WiFi enabled ----
        boolean wifiEnabled = wifiManager != null && wifiManager.isWifiEnabled();
        Log.d(TAG, "  wifiEnabled=" + wifiEnabled);
        if (!wifiEnabled) {
            Log.d(TAG, "result: wifi_disabled");
            return json("wifi_disabled", "WiFi 未开启，请先打开 WiFi 开关");
        }

        // ---- Check 6: WiFi connection info ----
        @SuppressWarnings("deprecation")
        WifiInfo info = getConnectionInfo();
        boolean wifiConnected = info != null;
        Log.d(TAG, "  wifiConnected=" + wifiConnected);

        // ---- Check 7: BSSID ----
        String rawBssid = info == null ? "" : normalizeText(info.getBSSID());
        if ("02:00:00:00:00:00".equals(rawBssid)) {
            rawBssid = "";
        }
        final String bssid = rawBssid;
        Log.d(TAG, "  bssid=" + (TextUtils.isEmpty(bssid) ? "empty (SmartConfig will broadcast to all APs)" : bssid));

        // ---- Check 8: MulticastLock ----
        WifiManager.MulticastLock multicastLock = null;
        try {
            multicastLock = wifiManager.createMulticastLock("SmartConfigLock");
            multicastLock.setReferenceCounted(true);
            multicastLock.acquire();
            Log.d(TAG, "  multicastLock acquired=true");
        } catch (Exception e) {
            Log.d(TAG, "  multicastLock failed: " + e.getMessage());
            return json("multicast_lock_failed", "无法获取 MulticastLock，SmartConfig 需要多播权限");
        }

        // ---- Check 9: Create EsptouchTask ----
        final EsptouchTask task;
        try {
            task = new EsptouchTask(targetSsid, bssid, targetPassword, activity.getApplicationContext());
            task.setPackageBroadcast(true);
            Log.d(TAG, "  EsptouchTask created=true");
        } catch (Throwable e) {
            Log.e(TAG, "  EsptouchTask creation failed", e);
            if (multicastLock != null) {
                multicastLock.release();
            }
            return json("smartconfig_task_create_failed", "无法创建 SmartConfig 任务: " + e.getMessage());
        }

        // ---- Check 10: Stop previous task and start new thread ----
        stopRunningTask(false);
        final WifiManager.MulticastLock finalLock = multicastLock;

        try {
            currentMulticastLock = finalLock;
            currentTask = task;
            currentThread = new Thread(() -> runSmartConfig(task, finalLock, targetServerHost, targetServerPort),
                    "AndroidSmartConfig");
            currentThread.start();
            Log.d(TAG, "  thread started=true");
        } catch (Throwable e) {
            Log.e(TAG, "  thread start failed", e);
            currentTask = null;
            currentMulticastLock = null;
            if (finalLock != null) {
                finalLock.release();
            }
            return json("smartconfig_start_failed", "无法启动配网线程: " + e.getMessage());
        }

        // ---- ALL CHECKS PASSED ----
        Log.d(TAG, "result: task_started");
        Log.d(TAG, "========== startSmartConfig success ==========");
        return json("task_started", "SmartConfig 任务已真实启动，正在发送配网信息");
    }

    @JavascriptInterface
    public String stopSmartConfig() {
        Log.d(TAG, "stopSmartConfig called");
        stopRunningTask(true);
        return json("cancelled", "已取消配网");
    }

    // ---- Permission result relay (called from MainActivity) ----

    void onPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != WIFI_PERMISSION_REQUEST_CODE || pendingAction == null) {
            return;
        }

        boolean allGranted = true;
        if (grantResults != null) {
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
        } else {
            allGranted = false;
        }

        if (!allGranted) {
            // Check if permanently denied
            boolean permanentlyDenied = false;
            if (permissions != null && grantResults != null) {
                for (int i = 0; i < permissions.length; i++) {
                    if (grantResults[i] != PackageManager.PERMISSION_GRANTED
                            && !ActivityCompat.shouldShowRequestPermissionRationale(activity, permissions[i])) {
                        permanentlyDenied = true;
                        break;
                    }
                }
            }

            if (permanentlyDenied) {
                Log.d(TAG, "onPermissionResult: permission_denied_permanent");
                dispatchStatus("permission_denied_permanent",
                        "权限被永久拒绝，请进入系统设置手动开启定位 / 附近设备权限", null);
            } else {
                Log.d(TAG, "onPermissionResult: permission_denied");
                dispatchStatus("permission_denied", "权限未授权，请允许定位 / 附近设备权限", null);
            }
            pendingAction = null;
            return;
        }

        Log.d(TAG, "onPermissionResult: all granted, retrying pendingAction=" + pendingAction);
        String action = pendingAction;
        pendingAction = null;

        if ("getWifiInfo".equals(action)) {
            String result = getWifiInfo();
            try {
                JSONObject obj = new JSONObject(result);
                dispatchStatus(obj);
            } catch (JSONException ignored) {
                dispatchStatus("ssid_failed", "获取 WiFi 信息失败", null);
            }
        }
    }

    // ---- Internal: SmartConfig background task ----

    private void runSmartConfig(
            EsptouchTask task,
            WifiManager.MulticastLock lock,
            String serverHost,
            int serverPort
    ) {
        Log.d(TAG, "runSmartConfig: background thread started");
        long startTime = System.currentTimeMillis();

        try {
            // Notify frontend: sending packets
            dispatchStatus("sending", "正在发送 SmartConfig 配网信息...", null);
            Log.d(TAG, "  status=sending");

            task.setEsptouchListener(new IEsptouchListener() {
                @Override
                public void onEsptouchResultAdded(IEsptouchResult result) {
                    Log.d(TAG, "  onEsptouchResultAdded: bssid=" + result.getBssid()
                            + ", isSuc=" + result.isSuc()
                            + ", isCancelled=" + result.isCancelled());
                    dispatchResult("device_found", "发现设备响应", result, serverHost, serverPort);
                }
            });

            // Notify frontend: waiting for device
            dispatchStatus("waiting", "等待设备连接 WiFi...", null);
            Log.d(TAG, "  status=waiting, calling executeForResults...");

            List<IEsptouchResult> results = task.executeForResults(1);

            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, "  executeForResults returned after " + elapsed + "ms");
            Log.d(TAG, "  result count=" + (results == null ? 0 : results.size()));

            if (results == null || results.isEmpty()) {
                Log.d(TAG, "  result: timeout (no device response)");
                dispatchStatus("timeout",
                        "配网超时：手机已发送 SmartConfig 信息 " + (elapsed / 1000)
                                + " 秒，但未收到设备响应。请确认设备已进入配网模式、手机连接 2.4G WiFi，且 WiFi 名称和密码正确。",
                        null);
                return;
            }

            IEsptouchResult first = results.get(0);
            Log.d(TAG, "  first result: isSuc=" + first.isSuc()
                    + ", isCancelled=" + first.isCancelled()
                    + ", bssid=" + first.getBssid());

            if (first.isCancelled()) {
                Log.d(TAG, "  result: cancelled");
                dispatchStatus("cancelled", "已取消配网", null);
                return;
            }

            if (first.isSuc()) {
                InetAddress addr = first.getInetAddress();
                String deviceIp = addr != null ? addr.getHostAddress() : "unknown";
                Log.d(TAG, "  result: success, deviceIp=" + deviceIp + ", bssid=" + first.getBssid());
                dispatchResult("success",
                        "配网成功，设备已收到 WiFi 配置。设备 IP: " + deviceIp + "，正在等待接入云端...",
                        first, serverHost, serverPort);
            } else {
                Log.d(TAG, "  result: failed (isSuc=false)");
                dispatchResult("failed",
                        "配网失败，请确认 WiFi 密码正确且设备处于 SmartConfig 配网模式",
                        first, serverHost, serverPort);
            }
        } catch (NoClassDefFoundError e) {
            Log.e(TAG, "  exception: ESPTouch SDK missing", e);
            dispatchStatus("failed", "缺少 ESPTouch 原生库或依赖未接入", null);
        } catch (Throwable e) {
            Log.e(TAG, "  exception in runSmartConfig", e);
            dispatchStatus("failed", "SmartConfig 执行异常: " + e.getMessage(), null);
        } finally {
            // Release multicast lock
            if (lock != null && lock.isHeld()) {
                try {
                    lock.release();
                    Log.d(TAG, "  multicastLock released");
                } catch (Exception ignored) {
                }
            }
            currentTask = null;
            currentMulticastLock = null;
            currentThread = null;
            Log.d(TAG, "runSmartConfig: thread finished");
        }
    }

    private void stopRunningTask(boolean dispatch) {
        EsptouchTask task = currentTask;
        if (task != null) {
            task.interrupt();
            Log.d(TAG, "stopRunningTask: task interrupted");
        }

        Thread thread = currentThread;
        if (thread != null) {
            thread.interrupt();
        }

        WifiManager.MulticastLock lock = currentMulticastLock;
        if (lock != null && lock.isHeld()) {
            try {
                lock.release();
                Log.d(TAG, "stopRunningTask: multicastLock released");
            } catch (Exception ignored) {
            }
        }

        currentTask = null;
        currentMulticastLock = null;
        currentThread = null;

        if (dispatch) {
            dispatchStatus("cancelled", "已取消配网", null);
        }
    }

    @SuppressWarnings("deprecation")
    private WifiInfo getConnectionInfo() {
        if (wifiManager == null) {
            return null;
        }
        return wifiManager.getConnectionInfo();
    }

    private boolean ensureWifiPermissions() {
        List<String> permissions = new ArrayList<>();

        // Android 8.1 (API 27) and below: no location permission needed for WiFi SSID
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.O_MR1) {
            Log.d(TAG, "ensureWifiPermissions: API <= 27, location permission not required");
            return true;
        }

        // Android 9-12 (API 28-32): ACCESS_FINE_LOCATION required
        // Android 13+ (API 33+): NEARBY_WIFI_DEVICES + ACCESS_FINE_LOCATION both required
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.NEARBY_WIFI_DEVICES)
                    != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES);
            }
        }

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }

        // COARSE as fallback on 9-12
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        if (!permissions.isEmpty()) {
            Log.d(TAG, "ensureWifiPermissions: requesting " + permissions.size() + " permission(s)");
            ActivityCompat.requestPermissions(
                    activity,
                    permissions.toArray(new String[0]),
                    WIFI_PERMISSION_REQUEST_CODE
            );
            return false;
        }

        Log.d(TAG, "ensureWifiPermissions: all required permissions granted");
        return true;
    }

    boolean isLocationEnabled() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                LocationManager lm = (LocationManager) activity.getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    boolean gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
                    boolean networkEnabled = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
                    Log.d(TAG, "  location providers: gps=" + gpsEnabled + ", network=" + networkEnabled);
                    return lm.isLocationEnabled();
                }
            }
        } catch (Exception e) {
            Log.d(TAG, "  isLocationEnabled exception: " + e.getMessage());
        }
        return true;
    }

    private boolean hasPermission(String permission) {
        return ContextCompat.checkSelfPermission(activity, permission)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isEsptouchSdkAvailable() {
        try {
            Class.forName("com.espressif.iot.esptouch.EsptouchTask");
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    private void dispatchResult(
            String status,
            String message,
            IEsptouchResult result,
            String serverHost,
            int serverPort
    ) {
        try {
            JSONObject detail = new JSONObject();
            detail.put("status", status);
            detail.put("message", message);
            detail.put("serverHost", serverHost);
            detail.put("serverPort", serverPort);

            if (result != null) {
                detail.put("bssid", result.getBssid());
                InetAddress address = result.getInetAddress();
                if (address != null) {
                    detail.put("deviceIp", address.getHostAddress());
                }
            }

            dispatchStatus(detail);
        } catch (JSONException e) {
            dispatchStatus(status, message, null);
        }
    }

    private void dispatchStatus(String status, String message, JSONObject extra) {
        try {
            JSONObject detail = new JSONObject();
            detail.put("status", status);
            detail.put("message", message);
            if (extra != null) {
                detail.put("data", extra);
            }
            dispatchStatus(detail);
        } catch (JSONException ignored) {
        }
    }

    void dispatchStatus(JSONObject detail) {
        activity.runOnUiThread(() -> {
            String script = "window.dispatchEvent(new CustomEvent('smartconfig-status', { detail: "
                    + detail.toString()
                    + " }));";
            webView.evaluateJavascript(script, null);
        });
    }

    private String json(String status, String message) {
        try {
            JSONObject result = new JSONObject();
            result.put("status", status);
            result.put("message", message);
            return result.toString();
        } catch (JSONException e) {
            return "{\"status\":\"failed\",\"message\":\"JSON 序列化失败\"}";
        }
    }

    private String cleanSsid(String value) {
        String ssid = normalizeText(value);
        if (TextUtils.isEmpty(ssid) || "<unknown ssid>".equalsIgnoreCase(ssid)) {
            return "";
        }
        if (ssid.length() >= 2 && ssid.startsWith("\"") && ssid.endsWith("\"")) {
            return ssid.substring(1, ssid.length() - 1);
        }
        return ssid;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isLocalOnlyHost(String host) {
        String normalized = host == null ? "" : host.trim().toLowerCase(Locale.ROOT);
        return "127.0.0.1".equals(normalized)
                || "localhost".equals(normalized)
                || "10.0.2.2".equals(normalized);
    }

    private String formatIp(int ipAddress) {
        if (ipAddress == 0) {
            return "";
        }
        return String.format(
                Locale.US,
                "%d.%d.%d.%d",
                ipAddress & 0xff,
                (ipAddress >> 8) & 0xff,
                (ipAddress >> 16) & 0xff,
                (ipAddress >> 24) & 0xff
        );
    }
}
