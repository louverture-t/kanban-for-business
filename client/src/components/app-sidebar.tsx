import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { Plus } from 'lucide-react';
import { useAuth } from '@client/hooks/use-auth';
import { PROJECTS_QUERY, NOTIFICATIONS_QUERY, FOLDERS_QUERY } from '@client/graphql/operations';
import { ProjectDialog } from '@client/components/project-dialog';
import { NotificationBell } from '@client/components/notification-bell';
import { Button } from '@client/components/ui/button';
import type { IProject, INotification, IProjectFolder } from '@shared/types';

const PROJECT_VIEWS = [
  { label: 'Kanban', path: 'kanban' },
  { label: 'Priority', path: 'priority' },
  { label: 'Roadmap', path: 'roadmap' },
  { label: 'Team', path: 'team' },
] as const;

export function AppSidebar() {
  const { user, isManagerOrAbove, isSuperadmin, logout } = useAuth();
  const location = useLocation();

  const { data: projectsData } = useQuery(PROJECTS_QUERY);
  const { data: notifData, refetch } = useQuery(NOTIFICATIONS_QUERY, {
    pollInterval: 30000,
  });
  const { data: foldersData } = useQuery(FOLDERS_QUERY, {
    skip: !isManagerOrAbove,
  });

  const projects: IProject[] = (projectsData as any)?.projects ?? [];
  const notifications: INotification[] = (notifData as any)?.notifications ?? [];
  const folders: IProjectFolder[] = (foldersData as any)?.folders ?? [];

  const isActive = (path: string) => location.pathname === path;

  // Derive active project from current path
  const activeProjectId = projects.find((p) =>
    location.pathname.startsWith(`/project/${p._id}`),
  )?._id;

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

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
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </h3>
            {isManagerOrAbove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setProjectDialogOpen(true)}
                aria-label="New Project"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {projects.length > 0 && (
            <ul className="space-y-1">
              {projects.map((project) => {
                const isExpanded =
                  expandedProjects.has(project._id) || activeProjectId === project._id;
                const isProjectActive = location.pathname.startsWith(`/project/${project._id}`);

                return (
                  <li key={project._id}>
                    <button
                      onClick={() => toggleProject(project._id)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        isProjectActive
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="flex-1 truncate text-left">{project.name}</span>
                      <svg
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    {isExpanded && (
                      <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                        {PROJECT_VIEWS.map(({ label, path }) => (
                          <li key={path}>
                            <Link
                              to={`/project/${project._id}/${path}`}
                              className={`block rounded-md px-2 py-1.5 text-xs ${
                                location.pathname === `/project/${project._id}/${path}`
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                              }`}
                            >
                              {label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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

      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        mode="create"
        folders={folders}
      />
    </aside>
  );
}
