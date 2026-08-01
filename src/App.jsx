import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoutineProvider } from './context/RoutineContext';
import { PomodoroProvider } from './context/PomodoroContext';
import Sidebar from './layout/Sidebar';
import TopNavbar from './layout/TopNavbar';
import SearchModal from './layout/SearchModal';
import MobileNav from './layout/MobileNav';
import AuthPage from './features/auth/AuthPage';
import LandingPage from './features/landing/LandingPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import CookiePolicyPage from './pages/CookiePolicyPage';
import DocsPage from './pages/DocsPage';
import BlogPage from './pages/BlogPage';
import ChangelogPage from './pages/ChangelogPage';
import FeedbackPage from './pages/FeedbackPage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import AboutUsPage from './pages/AboutUsPage';
import NotificationRunner from './components/NotificationRunner';
import QuotePopup from './features/dashboard/QuotePopup';
import FloatingBackground from './components/FloatingBackground';

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const RoutineTemplatesPage = lazy(() => import('./features/dashboard/RoutineTemplatesPage'));
const TranscriptTemplatesPage = lazy(() => import('./features/dashboard/TranscriptTemplatesPage'));
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
const ExamChecklistPage = lazy(() => import('./features/exam-checklist/ExamChecklistPage'));
const CPHubPage = lazy(() => import('./features/cp-hub/CPHubPage'));
const MoneyTrackerPage = lazy(() => import('./features/money-tracker/MoneyTrackerPage'));

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

import './App.css';

// Admin Route - redirects admin/moderator users to admin panel
function AdminRoute() {
  const { user, hasRole } = useAuth();
  if (hasRole?.('admin') || hasRole?.('moderator')) {
    return <Navigate to="/admin" replace />;
  }
  return <DashboardPage />;
}

// Protected Admin Route - client check + server verification
function ProtectedAdminRoute({ children }) {
  const { hasRole } = useAuth();
  const [serverVerified, setServerVerified] = useState(null); // null=loading, true=ok, false=blocked
  const isAdmin = hasRole?.('admin') || hasRole?.('moderator');

  useEffect(() => {
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
  }, [isAdmin]);

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  return (
    <RoutineProvider>
      <QuotePopup />
      <NotificationRunner />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <FloatingBackground />
      <div className="app-layout">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <TopNavbar onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)} onSearchOpen={setIsSearchOpen} />
          <div className="page-wrapper" key={location.pathname}>
            <Suspense fallback={
              <div className="page-loading">
                <div className="page-loading-spinner" />
                <span>Loading…</span>
              </div>
            }>
              <Routes>
                <Route path="/" element={<AdminRoute />} />
                <Route path="/templates" element={<RoutineTemplatesPage />} />
                <Route path="/admin/transcript-templates" element={<TranscriptTemplatesPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/vault" element={<VaultPage />} />
                <Route path="/notebook" element={<NotebookPage />} />
                <Route path="/cheatsheets" element={<CheatsheetsPage />} />
                <Route path="/campus" element={<CampusPage />} />
                <Route path="/community" element={<CommunityPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/admin" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/overview" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/notice-board" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/canteen" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/library" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/users" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/applications" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/admin/cr-sr-directory" element={<ProtectedAdminRoute><AdminPanelPage /></ProtectedAdminRoute>} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/study-room" element={<StudyRoomPage />} />
                <Route path="/exam-checklist" element={<ExamChecklistPage />} />
                <Route path="/cp-hub" element={<CPHubPage />} />
                <Route path="/money-tracker" element={<MoneyTrackerPage />} />

                <Route path="/aust-bhara" element={<Navigate to="/campus" replace />} />
                <Route path="/cover-page-generator" element={<CoverPageGeneratorPage />} />
                <Route path="/empty-classroom" element={<Navigate to="/campus" replace />} />
                <Route path="/chill-zone" element={<ChillZonePage />} />
                <Route path="/roast-cv" element={<RoastCVPage />} />
                <Route path="/certificate" element={<CertificatePage />} />
                <Route path="/auto-alarm" element={<AutoAlarmPage />} />
                <Route path="/austeddit" element={<AustedditPage />} />
                <Route path="/shadow" element={<ShadowPage />} />
                <Route path="/daily-life" element={<DailyLifePage />} />
                <Route path="/pro" element={<ProPage />} />
                <Route path="/productivity" element={<ProductivityPage />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
        <MobileNav />
      </div>
    </RoutineProvider>
  );
}

// Root App Shell with Auth Check — no BrowserRouter here, uses parent's single instance
function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/templates': 'Routine Templates',
    '/analytics': 'Grade Lab',
    '/vault': 'Vault',
    '/notebook': 'Notebook',
    '/cheatsheets': 'Cheat Sheets',
    '/campus': 'InsideAUST',
    '/community': 'Community',
    '/marketplace': 'Marketplace',
    '/settings': 'Settings',
    '/messages': 'ConnectBox',
    '/admin': 'Admin Panel',
    '/terminal': 'Terminal',
    '/shadow': 'Shadow',
    '/workspace': 'Workspace',
    '/zen': 'Zen Study Room',
    '/study-room': 'Study Time',
    '/exam-checklist': 'Exam Checklist',
    '/cp-hub': 'Code Pulse',
    '/money-tracker': 'TiyaHodeJargoi',

    '/cover-page-generator': 'Cover Page Generator',
    '/chill-zone': 'DownTime',
    '/roast-cv': 'Roast CV',
    '/certificate': 'Certificate',
    '/auto-alarm': 'WakeMeUp',
    '/austeddit': 'Austeddit',
    '/daily-life': 'Daily Life',
  };
  const pageName = Object.entries(pageTitles).find(([path]) => location.pathname.startsWith(path))?.[1] || 'Dashboard';
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
  if (isAuthenticated && (location.pathname === '/terminal' || location.pathname === '/zen')) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/zen" element={<ZenStudyRoom
            onExit={() => { window.location.href = '/study-room'; }}
          />} />
        </Routes>
      </Suspense>
    );
  }

  // If not authenticated, show landing page at / and auth page at /login
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookie-policy" element={<CookiePolicyPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutUsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
