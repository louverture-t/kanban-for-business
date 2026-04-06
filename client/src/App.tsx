import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@client/lib/apolloClient';
import { AuthProvider, useAuth } from '@client/hooks/use-auth';
import { ThemeProvider } from '@client/components/theme-provider';
import { AppSidebar } from '@client/components/app-sidebar';
import { NoPhiBanner } from '@client/components/no-phi-banner';
import { ErrorBoundary } from '@client/components/error-boundary';
import { LoginPage } from '@client/pages/login';
import { RegisterPage } from '@client/pages/register';
import { ChangePasswordPage } from '@client/pages/change-password';
import { PriorityPage } from '@client/pages/priority';
import { TeamPage } from '@client/pages/team';

// Placeholder pages — replaced with real implementations in later days
function DashboardPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Dashboard</h1></div>;
}

function KanbanPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Kanban Board</h1></div>;
}

function RoadmapPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Roadmap</h1></div>;
}

function AdminPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Admin Panel</h1></div>;
}

function SettingsPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Settings</h1></div>;
}

function NotFoundPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
      </div>
    </div>
  );
}

// ─── Protected Route Wrapper ──────────────────────────────

function ProtectedRoute() {
  const { isAuthenticated, loading, user } = useAuth();

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
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <NoPhiBanner />
        <Outlet />
      </main>
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
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
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
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;
