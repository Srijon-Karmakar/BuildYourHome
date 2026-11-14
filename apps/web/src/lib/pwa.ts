import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';

/** The browser's "install this app" offer (Chrome / Edge / Android). */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** False while the device has no internet (the app keeps working; sign-in and sharing wait). */
  online: boolean;
  offer: InstallPrompt | null;
  /** Running as an installed app (home-screen icon) rather than in a browser tab. */
  installed: boolean;
}

export const usePwa = create<PwaState>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  offer: null,
  installed: typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true),
}));

/** Ask the browser to install the app. Resolves true when the person accepted. */
export async function installApp(): Promise<boolean> {
  const offer = usePwa.getState().offer;
  if (!offer) return false;
  await offer.prompt();
  const { outcome } = await offer.userChoice;
  usePwa.setState({ offer: null });
  return outcome === 'accepted';
}

/** Once, at start-up: follow the connection, catch the install offer and (in the built app) register the service worker. */
export function startPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => usePwa.setState({ online: true }));
  window.addEventListener('offline', () => usePwa.setState({ online: false }));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwa.setState({ offer: e as InstallPrompt });
  });
  window.addEventListener('appinstalled', () => usePwa.setState({ offer: null, installed: true }));
  // Not inside the phone app (ADR-037): its files are already on the device.
  if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* the app works without it */
      });
    });
  }
}
