import { registerSW } from 'virtual:pwa-register';
export const PWA_UPDATE_READY = 'novo-hiper-update-ready';
export let updateReady = false;
export const updateApp = typeof window !== 'undefined' && 'serviceWorker' in navigator
  ? registerSW({ immediate: true, onNeedRefresh() { updateReady = true; window.dispatchEvent(new Event(PWA_UPDATE_READY)); } })
  : async () => {};
