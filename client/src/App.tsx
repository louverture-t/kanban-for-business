import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { Menu } from 'lucide-react';
import { apolloClient } from '@client/lib/apolloClient';
import { AuthProvider, useAuth } from '@client/hooks/use-auth';
import { ThemeProvider } from '@client/components/theme-provider';
import { AppSidebar } from '@client/components/app-sidebar';
import { NoPhiBanner } from '@client/components/no-phi-banner';
import { ErrorBoundary } from '@client/components/error-boundary';
import { SleepOverlay } from '@client/components/sleep-overlay';
import { useIdleTimer } from '@client/hooks/use-idle-timer';
import { SearchCommand } from '@client/components/search-command';
import { Toaster } from '@client/components/toaster';

// When a new deploy replaces hashed chunk filenames, already-open tabs will
// fail to import old chunks. Detect that specific failure and force a single
// full reload so the browser fetches fresh index.html and new asset hashes.
const CHUNK_RELOAD_KEY = 'k4b:chunk-reload-attempted';

function isChunkLoadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

function lazyWithReload<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      if (isChunkLoadError(err) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<T>(() => {});
      }
      throw err;
    }),
  );
}

const LoginPage = lazyWithReload(() => import('@client/pages/login').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazyWithReload(() => import('@client/pages/register').then(m => ({ default: m.RegisterPage })));
const ChangePasswordPage = lazyWithReload(() => import('@client/pages/change-password').then(m => ({ default: m.ChangePasswordPage })));
const DashboardPage = lazyWithReload(() => import('@client/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const PriorityPage = lazyWithReload(() => import('@client/pages/priority').then(m => ({ default: m.PriorityPage })));
const TeamPage = lazyWithReload(() => import('@client/pages/team').then(m => ({ default: m.TeamPage })));
const KanbanPage = lazyWithReload(() => import('@client/pages/kanban'));
const RoadmapPage = lazyWithReload(() => import('@client/pages/roadmap').then(m => ({ default: m.RoadmapPage })));
const AdminPage = lazyWithReload(() => import('@client/pages/admin').then(m => ({ default: m.AdminPage })));
const SettingsPage = lazyWithReload(() => import('@client/pages/settings').then(m => ({ default: m.SettingsPage })));
const NotFoundPage = lazyWithReload(() => import('@client/pages/not-found').then(m => ({ default: m.NotFoundPage })));

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

// ─── Protected Route Wrapper ──────────────────────────────

function SuperadminRoute() {
  const { isSuperadmin } = useAuth();
  return isSuperadmin ? <Outlet /> : <Navigate to="/" replace />;
}

function ProtectedRoute() {
  const { isAuthenticated, loading, user } = useAuth();
  const { isIdle, resetTimer } = useIdleTimer();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Force password change if required
  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — hamburger + logo */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 md:hidden" style={{ minHeight: '52px' }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-bold text-foreground">K4B</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          <NoPhiBanner />
          <Outlet />
        </main>
      </div>

      <SearchCommand />
      {isIdle && <SleepOverlay resetTimer={resetTimer} />}
    </div>
  );
}

// ─── Public Route Wrapper ─────────────────────────────────

function PublicRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ─── App ──────────────────────────────────────────────────

function App() {
  useEffect(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }, []);

  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <Toaster />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                </Route>

                {/* Change password (needs auth but no sidebar) */}
                <Route path="/change-password" element={<ChangePasswordPage />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/project/:projectId/kanban" element={<KanbanPage />} />
                  <Route path="/project/:projectId/priority" element={<PriorityPage />} />
                  <Route path="/project/:projectId/roadmap" element={<RoadmapPage />} />
                  <Route path="/project/:projectId/team" element={<TeamPage />} />
                  <Route element={<SuperadminRoute />}>
                    <Route path="/admin" element={<AdminPage />} />
                  </Route>
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;
