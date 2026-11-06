// App-only detection for AUSTWise APK / installed PWA.
// Web / desktop browser (Chrome, Edge, Firefox) must NOT see the assistive
// bubble. Only APK users (or installed-app / standalone PWA) get the option.
export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  try {
    // Capacitor / Cordova native bridge
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return true;
  } catch {}
  if (window.__AUSTWISE_NATIVE__ || window.Android || window.webkit?.messageHandlers?.AUSTWise) return true;

  try {
    const params = new URLSearchParams(window.location.search);
    const appParam = params.get('app');
    if (appParam === '1' || appParam === 'austwise' || appParam === 'apk') {
      try { localStorage.setItem('austwise-app-mode', '1'); } catch {}
      return true;
    }
  } catch {}

  try {
    if (localStorage.getItem('austwise-app-mode') === '1') return true;
  } catch {}

  try {
    if (typeof document !== 'undefined' && document.referrer && document.referrer.startsWith('android-app://')) return true;
  } catch {}

  try {
    const ua = navigator.userAgent || '';
    // Android WebView / TWA with our custom token
    if (/AUSTWiseApp|AUSTWise\/|AUSTWiseBubble/i.test(ua)) return true;
    // Installed PWA (display: standalone)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    // iOS installed PWA
    if (navigator.standalone) return true;
  } catch {}

  return false;
}

export function isAssistiveEnabled() {
  try {
    const v = localStorage.getItem('aust-assistive-enabled');
    // App users see the bubble by default; toggle in Settings can turn it off.
    return v === null ? true : v === '1';
  } catch { return true; }
}

export function setAssistiveEnabled(enabled) {
  try { localStorage.setItem('aust-assistive-enabled', enabled ? '1' : '0'); } catch {}
  try { window.dispatchEvent(new Event('aust-assistive-toggle')); } catch {}
}
