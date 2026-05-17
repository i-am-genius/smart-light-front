package com.genius.smartlight;

import android.os.Bundle;
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
    }

    @Override
    public void onDestroy() {
        if (smartConfigBridge != null) {
            smartConfigBridge.stopSmartConfig();
        }
        super.onDestroy();
    }
}
