import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.genius.smartlight',
  appName: 'SmartLight',
  webDir: 'dist',

  server: {
    androidScheme: 'http',
    cleartext: true,
  },

  android: {
    allowMixedContent: true,
  },
}

export default config