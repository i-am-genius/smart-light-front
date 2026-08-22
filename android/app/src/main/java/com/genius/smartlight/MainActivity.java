package com.genius.smartlight;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long BACK_EXIT_INTERVAL_MS = 2_000L;

    private AndroidSmartConfigBridge smartConfigBridge;
    private long lastBackPressedAt;
    private Toast backExitToast;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        installBackHandler(webView);
        smartConfigBridge = new AndroidSmartConfigBridge(this, webView);
        webView.addJavascriptInterface(smartConfigBridge, "AndroidSmartConfig");
        smartConfigBridge.notifyBridgeReady();
        webView.postDelayed(() -> {
            if (smartConfigBridge != null) {
                smartConfigBridge.notifyBridgeReady();
            }
        }, 300);
    }

    private void installBackHandler(WebView webView) {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchBackToWeb(webView);
            }
        });
    }

    private void dispatchBackToWeb(WebView webView) {
        String script = "(function(){"
                + "var event=new CustomEvent('smartlight-native-back',{cancelable: true});"
                + "return window.dispatchEvent(event);"
                + "})()";

        webView.evaluateJavascript(script, result -> {
            if ("false".equals(result)) {
                lastBackPressedAt = 0L;
                return;
            }
            handleNativeBackFallback(webView);
        });
    }

    private void handleNativeBackFallback(WebView webView) {
        if (webView.canGoBack()) {
            lastBackPressedAt = 0L;
            webView.goBack();
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastBackPressedAt <= BACK_EXIT_INTERVAL_MS) {
            if (backExitToast != null) {
                backExitToast.cancel();
                backExitToast = null;
            }
            finish();
            return;
        }

        lastBackPressedAt = now;
        backExitToast = Toast.makeText(this, "再按一次退出应用", Toast.LENGTH_SHORT);
        backExitToast.show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == AndroidSmartConfigBridge.WIFI_PERMISSION_REQUEST_CODE
                && smartConfigBridge != null) {
            smartConfigBridge.onPermissionResult(requestCode, permissions, grantResults);
        }
    }

    public void openLocationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            startActivity(intent);
        } catch (Exception e) {
            // fallback: open general settings
        }
    }

    @Override
    public void onDestroy() {
        if (backExitToast != null) {
            backExitToast.cancel();
            backExitToast = null;
        }
        if (smartConfigBridge != null) {
            smartConfigBridge.stopSmartConfig();
        }
        super.onDestroy();
    }
}
