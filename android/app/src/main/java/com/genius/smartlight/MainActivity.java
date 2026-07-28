package com.genius.smartlight;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private AndroidSmartConfigBridge smartConfigBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        smartConfigBridge = new AndroidSmartConfigBridge(this, webView);
        webView.addJavascriptInterface(smartConfigBridge, "AndroidSmartConfig");
        smartConfigBridge.notifyBridgeReady();
        webView.postDelayed(() -> {
            if (smartConfigBridge != null) {
                smartConfigBridge.notifyBridgeReady();
            }
        }, 300);
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
        if (smartConfigBridge != null) {
            smartConfigBridge.stopSmartConfig();
        }
        super.onDestroy();
    }
}
