package com.genius.smartlight;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.text.TextUtils;
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
    private static final int WIFI_PERMISSION_REQUEST_CODE = 2107;

    private final Activity activity;
    private final WebView webView;
    private final WifiManager wifiManager;
    private volatile EsptouchTask currentTask;
    private volatile Thread currentThread;

    public AndroidSmartConfigBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.wifiManager = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    }

    @JavascriptInterface
    public String getWifiInfo() {
        try {
            if (!ensureWifiPermissions()) {
                return json("failed", "请先授权定位 / 附近设备权限后再获取 WiFi 信息");
            }

            WifiInfo info = getConnectionInfo();
            if (info == null) {
                return json("failed", "当前未连接 WiFi");
            }

            String ssid = cleanSsid(info.getSSID());
            String bssid = normalizeText(info.getBSSID());

            JSONObject result = new JSONObject();
            result.put("status", TextUtils.isEmpty(ssid) ? "failed" : "success");
            result.put("ssid", ssid);
            result.put("bssid", bssid);
            result.put("ip", formatIp(info.getIpAddress()));
            if (TextUtils.isEmpty(ssid)) {
                result.put("message", "获取 WiFi 失败，请确认手机已连接 WiFi，并开启定位 / 附近设备权限");
            } else {
                result.put("message", "已获取当前 WiFi");
            }
            return result.toString();
        } catch (Exception e) {
            return json("failed", "获取 WiFi 信息失败：" + e.getMessage());
        }
    }

    @JavascriptInterface
    public String startSmartConfig(String ssid, String password, String serverHost, int serverPort) {
        String targetSsid = normalizeText(ssid);
        String targetPassword = password == null ? "" : password;
        String targetServerHost = normalizeText(serverHost);
        int targetServerPort = serverPort > 0 ? serverPort : 3000;

        if (TextUtils.isEmpty(targetSsid)) {
            return json("failed", "SSID 不能为空");
        }
        if (TextUtils.isEmpty(targetServerHost)) {
            return json("failed", "服务器地址不能为空");
        }
        if (isLocalOnlyHost(targetServerHost)) {
            return json("failed", "Android 真机不能使用 127.0.0.1 / localhost / 10.0.2.2，请填写电脑局域网 IP");
        }
        if (!ensureWifiPermissions()) {
            return json("failed", "请先授权定位 / 附近设备权限后再开始配网");
        }

        WifiInfo info = getConnectionInfo();
        String bssid = info == null ? "" : normalizeText(info.getBSSID());
        if (TextUtils.isEmpty(bssid) || "02:00:00:00:00:00".equals(bssid)) {
            return json("failed", "无法获取当前 WiFi BSSID，请确认权限已授权且手机已连接 WiFi");
        }

        stopRunningTask(false);
        dispatchStatus("preparing", "正在准备 SmartConfig", null);

        currentThread = new Thread(() -> runSmartConfig(
                targetSsid,
                targetPassword,
                bssid,
                targetServerHost,
                targetServerPort
        ), "AndroidSmartConfig");
        currentThread.start();

        return json("preparing", "正在准备 SmartConfig");
    }

    @JavascriptInterface
    public String stopSmartConfig() {
        stopRunningTask(true);
        return json("stopped", "已取消配网");
    }

    private void runSmartConfig(
            String ssid,
            String password,
            String bssid,
            String serverHost,
            int serverPort
    ) {
        try {
            dispatchStatus("sending", "正在发送 WiFi 配置信息", null);

            EsptouchTask task = new EsptouchTask(ssid, bssid, password, activity.getApplicationContext());
            currentTask = task;
            task.setPackageBroadcast(true);
            task.setEsptouchListener(new IEsptouchListener() {
                @Override
                public void onEsptouchResultAdded(IEsptouchResult result) {
                    dispatchResult("waiting", "发现设备响应，等待最终结果", result, serverHost, serverPort);
                }
            });

            dispatchStatus("waiting", "等待设备连接 WiFi", null);
            List<IEsptouchResult> results = task.executeForResults(1);

            if (results == null || results.isEmpty()) {
                dispatchStatus("failed", "配网失败，未收到设备响应", null);
                return;
            }

            IEsptouchResult first = results.get(0);
            if (first.isCancelled()) {
                dispatchStatus("stopped", "已取消配网", null);
                return;
            }

            if (first.isSuc()) {
                dispatchResult("success", "配网成功，设备正在连接服务器", first, serverHost, serverPort);
            } else {
                dispatchResult("failed", "配网失败，请确认 WiFi 密码和设备配网模式", first, serverHost, serverPort);
            }
        } catch (NoClassDefFoundError e) {
            dispatchStatus("failed", "缺少 ESPTouch 原生库或依赖未接入", null);
        } catch (Throwable e) {
            dispatchStatus("failed", "SmartConfig 执行失败：" + e.getMessage(), null);
        } finally {
            currentTask = null;
            currentThread = null;
        }
    }

    private void stopRunningTask(boolean dispatch) {
        EsptouchTask task = currentTask;
        if (task != null) {
            task.interrupt();
        }

        Thread thread = currentThread;
        if (thread != null) {
            thread.interrupt();
        }

        currentTask = null;
        currentThread = null;

        if (dispatch) {
            dispatchStatus("stopped", "已取消配网", null);
        }
    }

    private WifiInfo getConnectionInfo() {
        if (wifiManager == null) {
            return null;
        }
        return wifiManager.getConnectionInfo();
    }

    private boolean ensureWifiPermissions() {
        List<String> permissions = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(activity, Manifest.permission.NEARBY_WIFI_DEVICES)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES);
        }

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(
                    activity,
                    permissions.toArray(new String[0]),
                    WIFI_PERMISSION_REQUEST_CODE
            );
            return false;
        }

        return true;
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
            // JSONObject with static keys should not fail.
        }
    }

    private void dispatchStatus(JSONObject detail) {
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
