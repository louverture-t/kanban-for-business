import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { useAuth } from '@client/hooks/use-auth';
import { PROJECTS_QUERY, NOTIFICATIONS_QUERY } from '@client/graphql/operations';
import type { IProject, INotification } from '@shared/types';

export function AppSidebar() {
  const { user, isSuperadmin, logout } = useAuth();
  const location = useLocation();

  const { data: projectsData } = useQuery(PROJECTS_QUERY);
  const { data: notifData } = useQuery(NOTIFICATIONS_QUERY, {
    pollInterval: 30000,
  });

  const projects: IProject[] = (projectsData as any)?.projects ?? [];
  const notifications: INotification[] = (notifData as any)?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="border-b border-border p-4">
        <Link to="/" className="text-lg font-bold text-foreground">
          K4B
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          <li>
            <Link
              to="/"
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                isActive('/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              Dashboard
            </Link>
          </li>

          {isSuperadmin && (
            <li>
              <Link
                to="/admin"
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive('/admin')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Admin
              </Link>
            </li>
          )}
        </ul>

        {/* Projects */}
        {projects.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </h3>
            <ul className="space-y-1">
              {projects.map((project) => (
                <li key={project._id}>
                  <Link
                    to={`/project/${project._id}/kanban`}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      location.pathname.startsWith(`/project/${project._id}`)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-4">
        {/* Notification bell */}
        <Link
          to="/notifications"
          className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Link>

        {/* User info */}
        <div className="flex items-center justify-between px-3">
          <div>
            <p className="text-sm font-medium text-foreground">{user?.username}</p>
            <p className="text-xs text-muted-foreground">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
