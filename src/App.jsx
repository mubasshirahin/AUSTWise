import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoutineProvider } from './context/RoutineProvider';
import { PomodoroProvider } from './context/PomodoroProvider';
import Sidebar from './layout/Sidebar';
import TopNavbar from './layout/TopNavbar';
import SearchModal from './layout/SearchModal';
import MobileNav from './layout/MobileNav';
import ErrorBoundary from './components/ErrorBoundary';
import RoleAccessControlCard from './features/admin/RoleAccessControlCard';
import { ADMIN_PAGE_CONFIG } from './features/admin/SidebarPageAccessPanel';
import { useRoleAccess } from './hooks/useRoleAccess';
import { usePageAvailability } from './features/admin/PageAvailabilityPanel';
import { prefetchRoutesIdle } from './utils/routePrefetch';
import { getAccessRole } from './utils/accessRole';
import { StalkProvider } from './features/stalk-road/StalkContext';
const StalkRoadOverlay = lazy(() => import('./features/stalk-road/StalkRoadOverlay'));
const AuthPage = lazy(() => import('./features/auth/AuthPage'));
const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const CinematicLandingPage = lazy(() => import('./features/landing/cinematic/CinematicLandingPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const AboutUsPage = lazy(() => import('./pages/AboutUsPage'));
const NotificationRunner = lazy(() => import('./components/NotificationRunner'));
const FloatingBackground = lazy(() => import('./components/FloatingBackground'));
const ActiveMembersSidebar = lazy(() => import('./features/active-members/ActiveMembersSidebar'));
const MemberProfilePage = lazy(() => import('./features/active-members/MemberProfilePage'));

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const RoutineTemplatesPage = lazy(() => import('./features/dashboard/RoutineTemplatesPage'));
const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage'));
const VaultPage = lazy(() => import('./features/vault/VaultPage'));
const NotebookPage = lazy(() => import('./features/vault/NotebookPage'));
const CheatsheetsPage = lazy(() => import('./features/vault/CheatsheetsPage'));
const CampusPage = lazy(() => import('./features/campus/CampusPage'));
const CommunityPage = lazy(() => import('./features/community/CommunityPage'));
const MarketplacePage = lazy(() => import('./features/marketplace/index.jsx'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPanelPage = lazy(() => import('./features/admin/AdminPanelPage'));
const MessagesPage = lazy(() => import('./features/messages/MessagesPage'));
const TerminalPage = lazy(() => import('./features/terminal/TerminalPage'));
const WorkspacePage = lazy(() => import('./features/workspace/WorkspacePage'));
const StudyRoomPage = lazy(() => import('./features/study-room/StudyRoomPage'));
const ZenStudyRoom = lazy(() => import('./features/study-room/ZenStudyRoom'));
const CPHubPage = lazy(() => import('./features/cp-hub/CPHubPage'));
const MoneyTrackerPage = lazy(() => import('./features/money-tracker/MoneyTrackerPage'));
const QuestionBankAnalyzerPage = lazy(() => import('./features/question-bank-analyzer/QuestionBankAnalyzerPage'));

const CoverPageGeneratorPage = lazy(() => import('./features/cover-page-generator/CoverPageGeneratorPage'));
const ChillZonePage = lazy(() => import('./features/chill-zone/ChillZonePage'));
const RoastCVPage = lazy(() => import('./features/roast-cv/RoastCVPage'));
const CertificatePage = lazy(() => import('./features/certificate/CertificatePage'));
const AutoAlarmPage = lazy(() => import('./features/auto-alarm/AutoAlarmPage'));
const AustedditPage = lazy(() => import('./features/austeddit/AustedditPage'));
const ShadowPage = lazy(() => import('./features/shadow/ShadowPage'));
const ProPage = lazy(() => import('./features/pro/ProPage'));
const ProductivityPage = lazy(() => import('./features/productivity/ProductivityPage'));
const DailyLifePage = lazy(() => import('./features/daily-life/DailyLifePage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'));
const RoleMatrixPreview = lazy(() => import('./features/admin/RoleMatrixPreview'));
const AccessRequestsPanel = lazy(() => import('./features/admin/AccessRequestsPanel'));
const AcceptInvitePage = lazy(() => import('./features/auth/AcceptInvitePage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));

import './App.css';

const CANONICAL_ACCESS_PATHS = {
  '/gradelab': '/analytics', '/insideaust': '/campus', '/resource-vault': '/vault',
  '/connectbox': '/messages', '/question-bank': '/question-bank-analyzer',
  '/downtime': '/chill-zone', '/see-plans': '/pro', '/code-pulse': '/cp-hub',
  '/takagelokoi': '/money-tracker', '/study-time': '/study-room', '/wakemeup': '/auto-alarm',
  '/cheat-sheets': '/cheatsheets',
};

function getAccessPath(pathname) {
  const entry = Object.entries(CANONICAL_ACCESS_PATHS).find(([canonical]) => pathname === canonical || pathname.startsWith(`${canonical}/`));
  return entry ? entry[1] : pathname;
}

// Admin Route - admins see the student dashboard like everyone else
function AdminRoute() {
  return <DashboardPage />;
}

function CanonicalRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}

function LegacyAdminRedirect() {
  const location = useLocation();
  const section = location.pathname.replace(/^\/admin\/?/, '') || 'overview';
  const aliases = { users: 'accounts', 'cr-sr-directory': 'representatives' };
  return <Navigate to={`/admin-panel/${aliases[section] || section}`} replace />;
}

// Protected Admin Route - client check + server verification
function ProtectedAdminRoute({ children }) {
  const { hasRole, isRoleMocked } = useAuth();
  const [serverVerified, setServerVerified] = useState(null); // null=loading, true=ok, false=blocked
  const isAdmin = hasRole?.('admin') || hasRole?.('moderator');

  useEffect(() => {
    if (import.meta.env.DEV && isRoleMocked) {
      setServerVerified(true);
      return;
    }
    if (!isAdmin) {
      setServerVerified(false);
      return;
    }
    // Double-check with server — the JWT is the source of truth
    fetch('/api/auth/admin', { credentials: 'same-origin' })
      .then(r => {
        if (r.status === 200) setServerVerified(true);
        else setServerVerified(false);
      })
      .catch(() => setServerVerified(false));
  }, [isAdmin, isRoleMocked]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  // Show nothing while server verification is pending
  if (serverVerified === null) {
    return <div className="page-loading"><div className="page-loading-spinner" /><span>Verifying…</span></div>;
  }
  if (serverVerified === false) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Main App Content Component (authenticated routes)
function AppContent() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole ? hasRole('admin') || hasRole('moderator') : false;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(() => {
    try { return localStorage.getItem('aust-members-open-v1') === 'true'; }
    catch { return false; }
  });
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const location = useLocation();

  // Track desktop/mobile breakpoint + persist the members panel preference
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('aust-members-open-v1', String(membersOpen));
  }, [membersOpen]);

  // Reset scroll to top on route change so new pages always open at the top
  // instead of inheriting the previous page's scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Warm the route chunks while the browser is idle so the first click on a nav
  // item doesn't wait for a network round-trip. prefetchRoutesIdle staggers them
  // (one per idle slice) so this never competes with first paint.
  useEffect(() => {
    prefetchRoutesIdle([
      '/dashboard/quickstats', '/dashboard/routine', '/dashboard/semester-view', '/dashboard/zero-hour', '/dashboard/attendance', '/gradelab', '/insideaust', '/resource-vault', '/notebook', '/community',
      '/connectbox', '/marketplace', '/settings', '/productivity',
      '/daily-life', '/downtime', '/shadow', '/cheatsheets',
      '/workspace', '/study-time', '/code-pulse', '/takagelokoi', '/cheat-sheets',
      '/question-bank',
      '/cover-page-generator', '/roast-cv', '/certificate',
      '/wakemeup', '/austeddit', '/see-plans', '/routine-templates', '/zen-study-room',
      ...(isAdmin ? ['/admin'] : []),
    ]);
  }, [isAdmin]);

  function PageGuard({ children }) {
    const { user, hasRole } = useAuth();
    const accessPath = getAccessPath(location.pathname);
    const availability = usePageAvailability(accessPath);
    // Call the access hook unconditionally so the hook order never changes
    // between routes (self-gated pages / staff included). It reads the SAME
    // key as the page's own gate and the admin card.
    const { config, loading } = useRoleAccess(accessPath);
    const isStaff = hasRole?.('admin') || hasRole?.('moderator');
    if (!isStaff && availability.loading) return <div className="page-loading"><div className="page-loading-spinner" /><span>Loading page…</span></div>;
    if (!isStaff && !availability.enabled) return <div className="glass-card-static" style={{ margin: '32px auto', maxWidth: '560px', padding: '32px', textAlign: 'center' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>🚧</div><h2 style={{ margin: '0 0 8px' }}>Coming soon</h2><p style={{ margin: 0, color: 'var(--text-secondary)' }}>This page is being prepared and will be available soon.</p></div>;
    // Skip guard for pages that gate their own content internally — their hero
    // box + glider tab bar must stay visible at all times (like the dashboard),
    // with only the content box below the tabs hidden for feature-hidden roles.
    const skipPaths = ['/', '/cover-page-generator', '/daily-life', '/analytics', '/campus', '/community', '/marketplace', '/vault', '/notebook', '/settings', '/messages', '/productivity', '/chill-zone', '/shadow'];
    const canonicalSkipPaths = ['/gradelab', '/insideaust', '/resource-vault', '/connectbox', '/question-bank', '/downtime', '/see-plans', '/code-pulse', '/takagelokoi', '/study-time', '/wakemeup', '/cheat-sheets'];
    const isSkipped = skipPaths.includes(location.pathname) || canonicalSkipPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`)) || location.pathname.startsWith('/dashboard/') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/members/');
    if (isSkipped) return children;
    // Admin/moderator always see the page shell (hero + GliderTabs). Pages hide
    // their own feature boxes via the role-access config.
    if (isStaff) return children;
    if (loading) return children;
    const hidden = (config.featureHidden || []).includes(getAccessRole(user));
    if (hidden) return null;
    return children;
  }

  return (
    <StalkProvider>
      <RoutineProvider key={user?.id || 'guest'}>
        <Suspense fallback={null}>
          <NotificationRunner />
          <FloatingBackground />
        </Suspense>
        <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        <div className="app-layout">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}${membersOpen && isDesktop ? ' members-open' : ''}`}>
            <TopNavbar
              onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              onSearchOpen={setIsSearchOpen}
              membersOpen={membersOpen}
              onMembersToggle={() => setMembersOpen((o) => !o)}
            />
            <div className="page-wrapper">
              <ErrorBoundary>
                <PageGuard>
                  <Suspense fallback={
                  <div className="page-loading">
                    <div className="page-loading-spinner" />
                    <span>Loading…</span>
                  </div>
                }>
                  <Routes>
                  <Route path="/" element={<Navigate to="/dashboard/quickstats" replace />} />
                  <Route path="/dashboard" element={<Navigate to="/dashboard/quickstats" replace />} />
                  <Route path="/dashboard/:section" element={<DashboardPage />} />
                  <Route path="/routine-templates" element={<RoutineTemplatesPage />} />
                  <Route path="/gradelab" element={<AnalyticsPage />} />
                  <Route path="/gradelab/:section" element={<AnalyticsPage />} />
                  <Route path="/analytics" element={<CanonicalRedirect to="/gradelab" />} />
                  <Route path="/resource-vault" element={<VaultPage />} />
                  <Route path="/vault" element={<CanonicalRedirect to="/resource-vault" />} />
                  <Route path="/notebook" element={<NotebookPage />} />
                  <Route path="/cheat-sheets" element={<CheatsheetsPage />} />
                  <Route path="/cheatsheets" element={<CanonicalRedirect to="/cheat-sheets" />} />
                  <Route path="/insideaust" element={<CampusPage />} />
                  <Route path="/campus" element={<CanonicalRedirect to="/insideaust" />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/marketplace" element={<MarketplacePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/members/:memberId" element={<MemberProfilePage />} />
                  <Route path="/accept-invite" element={<AcceptInvitePage />} />
                  <Route path="/connectbox" element={<MessagesPage />} />
                  <Route path="/messages" element={<CanonicalRedirect to="/connectbox" />} />
                  <Route path="/admin-panel" element={<Navigate to="/admin-panel/overview" replace />} />
                  <Route path="/admin-panel/role-preview" element={import.meta.env.DEV ? <RoleMatrixPreview /> : <ProtectedAdminRoute><RoleMatrixPreview /></ProtectedAdminRoute>} />
                  <Route path="/admin-panel/:section" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                  <Route path="/admin" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/overview" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/canteen" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/library" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/users" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/academic" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/availability" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/templates" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/auditorium" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/cheatsheets" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/campus-map" element={<LegacyAdminRedirect />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/admin/applications" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/cr-sr-directory" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/bhara-koto" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/attendance" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/features" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/question-bank" element={<LegacyAdminRedirect />} />
                  <Route path="/admin/access-requests" element={<Navigate to="/admin-panel/access-requests" replace />} />
                  <Route path="/admin/role-preview" element={<Navigate to="/admin-panel/role-preview" replace />} />
                  <Route path="/admin/*" element={<LegacyAdminRedirect />} />
                  <Route path="/admin-panel/access-requests" element={<ProtectedAdminRoute><AccessRequestsPanel /></ProtectedAdminRoute>} />
                  <Route path="/workspace" element={<WorkspacePage />} />
                  <Route path="/study-time" element={<StudyRoomPage />} />
                  <Route path="/study-room" element={<CanonicalRedirect to="/study-time" />} />
                  <Route path="/code-pulse" element={<CPHubPage />} />
                  <Route path="/cp-hub" element={<CanonicalRedirect to="/code-pulse" />} />
                  <Route path="/takagelokoi" element={<MoneyTrackerPage />} />
                  <Route path="/money-tracker" element={<CanonicalRedirect to="/takagelokoi" />} />
                  <Route path="/question-bank" element={<QuestionBankAnalyzerPage />} />
                  <Route path="/question-bank-analyzer" element={<CanonicalRedirect to="/question-bank" />} />

                  <Route path="/aust-bhara" element={<Navigate to="/campus" replace />} />
                  <Route path="/cover-page-generator" element={<CoverPageGeneratorPage />} />
                  <Route path="/empty-classroom" element={<Navigate to="/campus" replace />} />
                  <Route path="/downtime" element={<ChillZonePage />} />
                  <Route path="/chill-zone" element={<CanonicalRedirect to="/downtime" />} />
                  <Route path="/roast-cv" element={<RoastCVPage />} />
                  <Route path="/certificate" element={<CertificatePage />} />
                  <Route path="/wakemeup" element={<AutoAlarmPage />} />
                  <Route path="/auto-alarm" element={<CanonicalRedirect to="/wakemeup" />} />
                  <Route path="/austeddit" element={<AustedditPage />} />
                  <Route path="/shadow" element={<ShadowPage />} />
                  <Route path="/daily-life" element={<DailyLifePage />} />
                  <Route path="/see-plans" element={<ProPage />} />
                  <Route path="/pro" element={<CanonicalRedirect to="/see-plans" />} />
                  <Route path="/productivity" element={<ProductivityPage />} />
                  <Route path="/payment/success" element={<PaymentSuccessPage />} />
                  <Route path="/payment/cancel" element={<PaymentCancelPage />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
                </PageGuard>
              </ErrorBoundary>
              {isAdmin && !location.pathname.startsWith('/dashboard') && !['/', '/daily-life', '/analytics', '/question-bank-analyzer'].includes(getAccessPath(location.pathname)) && !ADMIN_PAGE_CONFIG[getAccessPath(location.pathname)] && !location.pathname.startsWith('/admin') && (
                <div style={{ padding: '0 24px 24px' }}>
                  {/* One card per page, keyed by the route path — the same key
                      the page's internal content gate reads. */}
                  <RoleAccessControlCard pageKey={getAccessPath(location.pathname)} />
                </div>
              )}
            </div>
          </div>
          <Suspense fallback={null}>
            <ActiveMembersSidebar
              open={membersOpen}
              isDesktop={isDesktop}
              onClose={() => setMembersOpen(false)}
              onToggle={() => setMembersOpen((o) => !o)}
            />
          </Suspense>
          <MobileNav />
        </div>
        <Suspense fallback={null}>
          <StalkRoadOverlay />
        </Suspense>
      </RoutineProvider>
    </StalkProvider>
  );
}

// Root App Shell with Auth Check — no BrowserRouter here, uses parent's single instance
function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/dashboard/quickstats': 'Quick Stats',
    '/dashboard/routine': 'Routine',
    '/dashboard/semester-view': 'Semester View',
    '/dashboard/zero-hour': 'Zero Hour',
    '/dashboard/attendance': 'Attendance',
    '/routine-templates': 'Routine Templates',
    '/gradelab': 'GradeLab',
    '/analytics': 'GradeLab',
    '/resource-vault': 'Resource Vault',
    '/vault': 'Resource Vault',
    '/notebook': 'Notebook',
    '/cheatsheets': 'Cheat Sheets',
    '/cheat-sheets': 'Cheat Sheets',
    '/insideaust': 'InsideAUST',
    '/campus': 'InsideAUST',
    '/community': 'Community',
    '/marketplace': 'Marketplace',
    '/settings': 'Settings',
    '/see-plans': 'See Plans',
    '/connectbox': 'ConnectBox',
    '/messages': 'ConnectBox',
    '/admin/role-preview': 'Live Role Access Preview',
    '/admin-panel': 'Admin Panel',
    '/admin': 'Admin Panel',
    '/terminal': 'Terminal',
    '/shadow': 'Shadow',
    '/workspace': 'Workspace',
    '/zen': 'Zen Study Room',
    '/zen-study-room': 'Zen Study Room',
    '/study-time': 'Study Time',
    '/study-room': 'Study Time',
    '/code-pulse': 'Code Pulse',
    '/cp-hub': 'Code Pulse',
    '/takagelokoi': 'TakaGeloKoi',
    '/money-tracker': 'TakaGeloKoi',
    '/question-bank': 'Question Bank',
    '/question-bank-analyzer': 'Question Bank',

    '/cover-page-generator': 'Cover Page Generator',
    '/downtime': 'DownTime',
    '/chill-zone': 'DownTime',
    '/roast-cv': 'Roast CV',
    '/certificate': 'Certificate',
    '/wakemeup': 'WakeMeUp',
    '/auto-alarm': 'WakeMeUp',
    '/austeddit': 'Austeddit',
    '/daily-life': 'Daily Life',
  };
  const pageName = pageTitles[location.pathname] || Object.entries(pageTitles).find(([path]) => path.length > 1 && location.pathname.startsWith(`${path}/`))?.[1] || 'Dashboard';
  useEffect(() => { document.title = `AUSTWise — ${pageName}`; }, [location.pathname]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#08090a',
        color: '#a1a1aa',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Terminal / Zen routes — full screen overlays outside main layout
  if (isAuthenticated && (location.pathname === '/terminal' || location.pathname === '/zen' || location.pathname === '/zen-study-room')) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/zen" element={<Navigate to="/zen-study-room" replace />} />
          <Route path="/zen-study-room" element={<ZenStudyRoom
            onExit={() => { window.location.href = '/study-time'; }}
          />} />
        </Routes>
      </Suspense>
    );
  }

  // If not authenticated, show landing page at / and auth page at /login
  if (!isAuthenticated) {
    return (
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#08090a', color: '#a1a1aa', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
          <div>Loading...</div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cinematic" element={<CinematicLandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/*" element={<Navigate to="/login" replace />} />
          <Route path="/admin-panel/*" element={<Navigate to="/login" replace />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about-us" element={<AboutUsPage />} />
          <Route path="/about" element={<CanonicalRedirect to="/about-us" />} />
          {import.meta.env.DEV && <Route path="/admin/role-preview" element={<RoleMatrixPreview />} />}
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/cancel" element={<PaymentCancelPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // If authenticated, show the full app
  return <AppContent />;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PomodoroProvider>
            <AppShell />
          </PomodoroProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
