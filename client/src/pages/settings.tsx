import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTheme } from '@client/components/theme-provider';
import { ProjectDialog } from '@client/components/project-dialog';
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/components/ui/alert-dialog';
import { PROJECTS_QUERY, DELETE_PROJECT_MUTATION, FOLDERS_QUERY } from '@client/graphql/operations';

type Theme = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Clean white background' },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
  { value: 'system', label: 'System', description: 'Follow OS preference' },
];

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{ _id: string; name: string; description?: string } | null>(null);

  const { data, refetch } = useQuery(PROJECTS_QUERY);
  const { data: foldersData } = useQuery(FOLDERS_QUERY);
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const folders = useMemo(() => foldersData?.folders ?? [], [foldersData]);

  const [deleteProject] = useMutation(DELETE_PROJECT_MUTATION, {
    onCompleted: () => refetch(),
  });

  function openEdit(project: { _id: string; name: string; description?: string }) {
    setEditingProject(project);
    setProjectDialogOpen(true);
  }

  function closeDialog() {
    setProjectDialogOpen(false);
    setEditingProject(null);
    refetch();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your preferences and projects.</p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how K4B looks on your device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {THEME_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-1 flex-col rounded-lg border-2 p-3 text-left transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your account security.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/change-password">Change Password</a>
          </Button>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle>My Projects</CardTitle>
          <CardDescription>Edit or delete projects you own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          )}
          {projects.map((project: { _id: string; name: string; description?: string }) => (
            <div
              key={project._id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">{project.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the project and all its tasks. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProject({ variables: { id: project._id } })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {projectDialogOpen && (
        <ProjectDialog
          open={projectDialogOpen}
          onOpenChange={(open) => { if (!open) closeDialog(); }}
          mode="edit"
          project={editingProject ?? undefined}
          folders={folders}
          onSuccess={closeDialog}
        />
      )}
    </div>
  );
}
