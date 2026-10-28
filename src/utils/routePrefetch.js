/**
 * Route prefetching — warm the lazy route chunks before the user clicks.
 *
 * Each `React.lazy(() => import(...))` route in App.jsx produces a separate
 * chunk. Without prefetching, the first click pays the full network round-trip
 * (prod) or Vite transform (dev) before the page can render. Hovering a nav
 * link or idling on the page now triggers the same dynamic import, so the
 * chunk is already in the browser cache by the time it is needed.
 *
 * Module specifiers MUST stay static (literal strings) so Vite/Rollup can
 * resolve them at build time.
 */

const routeImports = {
  '/dashboard/quickstats': () => import('../features/dashboard/DashboardPage'),
  '/dashboard/routine': () => import('../features/dashboard/DashboardPage'),
  '/dashboard/semester-view': () => import('../features/dashboard/DashboardPage'),
  '/dashboard/zero-hour': () => import('../features/dashboard/DashboardPage'),
  '/dashboard/attendance': () => import('../features/dashboard/DashboardPage'),
  '/daily-life': () => import('../features/daily-life/DailyLifePage'),
  '/analytics': () => import('../features/analytics/AnalyticsPage'),
  '/gradelab': () => import('../features/analytics/AnalyticsPage'),
  '/campus': () => import('../features/campus/CampusPage'),
  '/insideaust': () => import('../features/campus/CampusPage'),
  '/vault': () => import('../features/vault/VaultPage'),
  '/resource-vault': () => import('../features/vault/VaultPage'),
  '/notebook': () => import('../features/vault/NotebookPage'),
  '/community': () => import('../features/community/CommunityPage'),
  '/messages': () => import('../features/messages/MessagesPage'),
  '/connectbox': () => import('../features/messages/MessagesPage'),
  '/productivity': () => import('../features/productivity/ProductivityPage'),
  '/marketplace': () => import('../features/marketplace/index.jsx'),
  '/chill-zone': () => import('../features/chill-zone/ChillZonePage'),
  '/downtime': () => import('../features/chill-zone/ChillZonePage'),
  '/shadow': () => import('../features/shadow/ShadowPage'),
  '/settings': () => import('../features/settings/SettingsPage'),
  '/pro': () => import('../features/pro/ProPage'),
  '/see-plans': () => import('../features/pro/ProPage'),
  '/admin': () => import('../features/admin/AdminPanelPage'),
  '/admin-panel/overview': () => import('../features/admin/AdminPanelPage'),
  '/routine-templates': () => import('../features/dashboard/RoutineTemplatesPage'),
  '/cheatsheets': () => import('../features/vault/CheatsheetsPage'),
  '/cheat-sheets': () => import('../features/vault/CheatsheetsPage'),
  '/workspace': () => import('../features/workspace/WorkspacePage'),
  '/study-room': () => import('../features/study-room/StudyRoomPage'),
  '/study-time': () => import('../features/study-room/StudyRoomPage'),
  '/cp-hub': () => import('../features/cp-hub/CPHubPage'),
  '/code-pulse': () => import('../features/cp-hub/CPHubPage'),
  '/money-tracker': () => import('../features/money-tracker/MoneyTrackerPage'),
  '/takagelokoi': () => import('../features/money-tracker/MoneyTrackerPage'),
  '/question-bank-analyzer': () => import('../features/question-bank-analyzer/QuestionBankAnalyzerPage'),
  '/question-bank': () => import('../features/question-bank-analyzer/QuestionBankAnalyzerPage'),
  '/cover-page-generator': () => import('../features/cover-page-generator/CoverPageGeneratorPage'),
  '/roast-cv': () => import('../features/roast-cv/RoastCVPage'),
  '/certificate': () => import('../features/certificate/CertificatePage'),
  '/auto-alarm': () => import('../features/auto-alarm/AutoAlarmPage'),
  '/wakemeup': () => import('../features/auto-alarm/AutoAlarmPage'),
  '/austeddit': () => import('../features/austeddit/AustedditPage'),
  '/terminal': () => import('../features/terminal/TerminalPage'),
  '/zen': () => import('../features/study-room/ZenStudyRoom'),
  '/zen-study-room': () => import('../features/study-room/ZenStudyRoom'),
  '/payment/success': () => import('../pages/PaymentSuccessPage'),
  '/payment/cancel': () => import('../pages/PaymentCancelPage'),
};

const prefetched = new Set();

/** Kick off a lazy route's chunk import (idempotent, errors swallowed). */
export function prefetchRoute(path) {
  if (!path || prefetched.has(path)) return;
  const load = routeImports[path];
  if (!load) return;
  prefetched.add(path);
  // Fire-and-forget; a failed prefetch must never break navigation.
  Promise.resolve().then(load).catch(() => { prefetched.delete(path); });
}

/**
 * Prefetch several routes once the browser is idle.
 *
 * The routes are spread one-per-idle-slice, with a small gap between them,
 * rather than fired as one burst: a full route list is ~20 dynamic imports,
 * and issuing them all at once competes with the in-flight data fetches that
 * make the page useful in the first seconds after load. Spreading them keeps
 * the network calm while still warming every chunk well before it is clicked.
 */
export function prefetchRoutesIdle(paths) {
  if (typeof window === 'undefined') return;
  // Data-saver / 2G users explicitly asked not to burn bandwidth; prefetching
  // ~20 chunks there would be actively hostile.
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
    return;
  }
  const queue = [...paths];
  const idle = 'requestIdleCallback' in window
    ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn) => setTimeout(fn, 300);
  const GAP_MS = 120; // let each chunk land before starting the next
  const step = () => {
    const next = queue.shift();
    if (next === undefined) return;
    prefetchRoute(next);
    setTimeout(() => idle(step), GAP_MS);
  };
  idle(step);
}

export default prefetchRoute;
