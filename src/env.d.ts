/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    AndroidSmartConfig?: {
      getWifiInfo: () => Promise<any> | any
      startSmartConfig: (
        ssid: string,
        password: string,
        serverHost?: string,
        serverPort?: number,
      ) => Promise<any> | any
      stopSmartConfig: () => Promise<any> | any
    }
  }
}
