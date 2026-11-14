import type { CapacitorConfig } from '@capacitor/cli';

/** ADR-037: the phone apps wrap the built web app (apps/web/dist). */
const config: CapacitorConfig = {
  appId: 'in.senevon.plotframer',
  appName: 'PlotFramer',
  webDir: '../web/dist',
  backgroundColor: '#131116',
  android: {
    // Real https origin inside the app (IndexedDB, crypto and Supabase need a secure context).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Hidden by the web app once its own splash has painted (lib/native.ts), so there is no blank flash.
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: '#131116',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#131116',
    },
  },
};

export default config;
