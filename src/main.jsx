import './guest/bootGuestSandbox'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './layout/StudioLayout.css'
import './layout/ResponsiveShell.css'
import './styles/mobileMenuSheet.css'
import { installMobileMenuSheet } from './utils/mobileMenuSheet'
import App from './App.jsx'

installMobileMenuSheet()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: auto-update + reload the tab the instant a new service worker takes
// control. Without this, a tab left open across a deploy keeps running the
// old index.html, whose hashed chunks vanish on the new build → dynamic
// import() 404s → blank page until a manual refresh.
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW: () => {
      navigator.serviceWorker?.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    },
  });
  // Tell the service worker whether this window is the installed app or a
  // browser tab, so tapping a push notification opens the app window.
  const reportDisplayMode = () => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    navigator.serviceWorker?.ready.then((reg) => {
      const sw = navigator.serviceWorker.controller || reg.active;
      sw?.postMessage({ type: 'austwise-display-mode', standalone });
    }).catch(() => {});
  };
  reportDisplayMode();
  navigator.serviceWorker?.addEventListener('controllerchange', reportDisplayMode);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reportDisplayMode(); });
} else if ('serviceWorker' in navigator) {
  // A previously installed production worker can serve stale role logic to
  // development preview iframes. Dev should always load the current Vite code.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    return Promise.all(registrations.map((registration) => registration.unregister()));
  }).then(() => {
    // A worker can still control this page briefly after unregistering (or
    // when its registration has already disappeared). Reload once to release
    // that controller before mounting the role preview.
    if (navigator.serviceWorker.controller) window.location.reload();
  }).catch(() => {});
}
