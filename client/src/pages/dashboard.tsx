import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Pencil, Trash2, FolderPlus, Plus } from 'lucide-react';

import {
  PROJECTS_QUERY,
  TASKS_QUERY,
  FOLDERS_QUERY,
  CREATE_FOLDER_MUTATION,
  UPDATE_FOLDER_MUTATION,
  DELETE_FOLDER_MUTATION,
  DELETE_PROJECT_MUTATION,
} from '@client/graphql/operations';
import { TaskCard } from '@client/components/task-card';
import { TaskDialog } from '@client/components/task-dialog';
import { ProjectDialog } from '@client/components/project-dialog';
import { useAuth } from '@client/hooks/use-auth';
import { useToast } from '@client/hooks/use-toast';
import { cn } from '@client/lib/utils';
import type { ITask, IProject, IProjectFolder } from '@shared/types';
import { TaskStatus, TaskPriority } from '@shared/types';

import { Card, CardContent, CardHeader, CardTitle } from '@client/components/ui/card';
import { Progress } from '@client/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/components/ui/dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';

// ─── Constants ───────────────────────────────────────────

type FilterStatus = 'complete' | 'active' | 'overdue' | null;

const PRESET_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

const STATUS_CHART_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: '#94a3b8',
  [TaskStatus.ACTIVE]: '#3b82f6',
  [TaskStatus.REVIEW]: '#f59e0b',
  [TaskStatus.COMPLETE]: '#10b981',
};

const PRIORITY_CHART_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.HIGH]: '#ef4444',
  [TaskPriority.MEDIUM]: '#f59e0b',
  [TaskPriority.LOW]: '#3b82f6',
};

// ─── Folder Dialog ────────────────────────────────────────

interface FolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  folder?: IProjectFolder;
}

function FolderFormDialog({ open, onOpenChange, mode, folder }: FolderDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(folder?.name ?? '');
  const [color, setColor] = useState(folder?.color ?? PRESET_COLORS[0]);

  // Sync form state when dialog opens
  useEffect(() => {
    if (open) {
      setName(mode === 'edit' && folder ? folder.name : '');
      setColor(mode === 'edit' && folder ? folder.color : PRESET_COLORS[0]);
    }
  }, [open, mode, folder]);

  const [createFolder, { loading: creating }] = useMutation(CREATE_FOLDER_MUTATION, {
    refetchQueries: [{ query: FOLDERS_QUERY }, { query: PROJECTS_QUERY }],
    onCompleted: () => {
      toast({ title: 'Folder created' });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: 'Failed to create folder', description: err.message, variant: 'destructive' }),
  });

  const [updateFolder, { loading: updating }] = useMutation(UPDATE_FOLDER_MUTATION, {
    refetchQueries: [{ query: FOLDERS_QUERY }],
    onCompleted: () => {
      toast({ title: 'Folder updated' });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: 'Failed to update folder', description: err.message, variant: 'destructive' }),
  });

  const loading = creating || updating;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create') {
      createFolder({ variables: { name: name.trim(), color } });
    } else {
      updateFolder({ variables: { id: folder!._id, name: name.trim(), color } });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Folder' : 'Edit Folder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select color ${c}`}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                    color === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stat Card ────────────────────────────────────────────

interface StatCardProps {
  label: string;
  count: number;
  filterKey: FilterStatus;
  activeFilter: FilterStatus;
  onClick: (key: FilterStatus) => void;
  colorClass: string;
}

function StatCard({ label, count, filterKey, activeFilter, onClick, colorClass }: StatCardProps) {
  const isActive = activeFilter === filterKey;
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isActive && 'ring-2 ring-primary',
      )}
      onClick={() => onClick(isActive ? null : filterKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(isActive ? null : filterKey); }}
      aria-pressed={isActive}
    >
      <CardHeader className="pb-2">
        <CardTitle className={cn('text-3xl font-bold', colorClass)}>{count}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Page ───────────────────────────────────────

export function DashboardPage() {
  const { isManagerOrAbove } = useAuth();
  const { toast } = useToast();

  // ── State ────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(null);
  const [openTaskId, setOpenTaskId] = useState<string | undefined>();
  const [openTaskProjectId, setOpenTaskProjectId] = useState<string>('');

  // Folder CRUD state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<'create' | 'edit'>('create');
  const [editingFolder, setEditingFolder] = useState<IProjectFolder | undefined>();
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<IProjectFolder | null>(null);

  // Project CRUD state
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
  const [editingProject, setEditingProject] = useState<IProject | undefined>();
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<IProject | null>(null);

  // ── Queries ──────────────────────────────────────────────
  const { data: projectsData, loading: loadingProjects } = useQuery<{ projects: IProject[] }>(PROJECTS_QUERY);
  const { data: tasksData, loading: loadingTasks } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
    variables: { includeArchived: false },
  });
  const { data: foldersData, loading: loadingFolders } = useQuery<{ folders: IProjectFolder[] }>(FOLDERS_QUERY);

  // ── Mutations ────────────────────────────────────────────
  const [deleteFolder, { loading: deletingFolder }] = useMutation(DELETE_FOLDER_MUTATION, {
    refetchQueries: [{ query: FOLDERS_QUERY }, { query: PROJECTS_QUERY }],
    onCompleted: () => {
      toast({ title: 'Folder deleted', description: 'Projects moved to No Folder.' });
      setDeleteFolderTarget(null);
    },
    onError: (err) => toast({ title: 'Failed to delete folder', description: err.message, variant: 'destructive' }),
  });

  const [deleteProject, { loading: deletingProject }] = useMutation(DELETE_PROJECT_MUTATION, {
    refetchQueries: [{ query: PROJECTS_QUERY }, { query: TASKS_QUERY }],
    onCompleted: () => {
      toast({ title: 'Project deleted' });
      setDeleteProjectTarget(null);
    },
    onError: (err) => toast({ title: 'Failed to delete project', description: err.message, variant: 'destructive' }),
  });

  // ── Data ─────────────────────────────────────────────────
  const projects: IProject[] = projectsData?.projects ?? [];
  const folders: IProjectFolder[] = foldersData?.folders ?? [];
  const allTasks: ITask[] = tasksData?.tasks ?? [];
  const activeTasks = allTasks.filter((t) => !t.deletedAt && !t.archivedAt);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Stats ────────────────────────────────────────────────
  const totalCount = activeTasks.length;
  const completedCount = activeTasks.filter((t) => t.status === TaskStatus.COMPLETE).length;
  const activeCount = activeTasks.filter((t) => t.status === TaskStatus.ACTIVE).length;
  const overdueCount = activeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== TaskStatus.COMPLETE,
  ).length;

  // ── Chart data ───────────────────────────────────────────
  const statusChartData = [
    { name: 'Backlog', value: activeTasks.filter((t) => t.status === TaskStatus.BACKLOG).length, color: STATUS_CHART_COLORS[TaskStatus.BACKLOG] },
    { name: 'Active', value: activeTasks.filter((t) => t.status === TaskStatus.ACTIVE).length, color: STATUS_CHART_COLORS[TaskStatus.ACTIVE] },
    { name: 'Review', value: activeTasks.filter((t) => t.status === TaskStatus.REVIEW).length, color: STATUS_CHART_COLORS[TaskStatus.REVIEW] },
    { name: 'Complete', value: activeTasks.filter((t) => t.status === TaskStatus.COMPLETE).length, color: STATUS_CHART_COLORS[TaskStatus.COMPLETE] },
  ].filter((d) => d.value > 0);

  const priorityChartData = [
    { name: 'High', value: activeTasks.filter((t) => t.priority === TaskPriority.HIGH).length, fill: PRIORITY_CHART_COLORS[TaskPriority.HIGH] },
    { name: 'Medium', value: activeTasks.filter((t) => t.priority === TaskPriority.MEDIUM).length, fill: PRIORITY_CHART_COLORS[TaskPriority.MEDIUM] },
    { name: 'Low', value: activeTasks.filter((t) => t.priority === TaskPriority.LOW).length, fill: PRIORITY_CHART_COLORS[TaskPriority.LOW] },
  ];

  // ── Section C — Task list ────────────────────────────────
  const PRIORITY_ORDER = { [TaskPriority.HIGH]: 0, [TaskPriority.MEDIUM]: 1, [TaskPriority.LOW]: 2 };

  let displayTasks: ITask[];
  if (filterStatus === 'complete') {
    displayTasks = activeTasks.filter((t) => t.status === TaskStatus.COMPLETE);
  } else if (filterStatus === 'active') {
    displayTasks = activeTasks.filter((t) => t.status === TaskStatus.ACTIVE);
  } else if (filterStatus === 'overdue') {
    displayTasks = activeTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== TaskStatus.COMPLETE,
    );
  } else {
    displayTasks = activeTasks
      .filter((t) => t.status !== TaskStatus.COMPLETE)
      .sort((a, b) => {
        const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (pDiff !== 0) return pDiff;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      })
      .slice(0, 10);
  }

  // ── Section D — Folder/project grouping ──────────────────
  const projectsByFolder = new Map<string | null, IProject[]>();
  projectsByFolder.set(null, []);
  for (const folder of folders) {
    projectsByFolder.set(folder._id, []);
  }
  for (const project of projects) {
    const key = project.folderId ?? null;
    if (!projectsByFolder.has(key)) {
      projectsByFolder.set(null, [...(projectsByFolder.get(null) ?? [])]);
    }
    const list = projectsByFolder.get(key) ?? projectsByFolder.get(null)!;
    if (key === null || projectsByFolder.has(key)) {
      list.push(project);
    }
  }

  function getProjectTaskCounts(projectId: string) {
    const pts = activeTasks.filter((t) => t.projectId === projectId);
    const total = pts.length;
    const completed = pts.filter((t) => t.status === TaskStatus.COMPLETE).length;
    return { total, completed };
  }

  const loading = loadingProjects || loadingTasks || loadingFolders;

  // ── Handlers ─────────────────────────────────────────────
  function handleTaskClick(task: ITask) {
    setOpenTaskId(task._id);
    setOpenTaskProjectId(task.projectId);
  }

  function handleEditFolder(folder: IProjectFolder) {
    setEditingFolder(folder);
    setFolderDialogMode('edit');
    setFolderDialogOpen(true);
  }

  function handleNewFolder() {
    setEditingFolder(undefined);
    setFolderDialogMode('create');
    setFolderDialogOpen(true);
  }

  function handleEditProject(project: IProject) {
    setEditingProject(project);
    setProjectDialogMode('edit');
    setProjectDialogOpen(true);
  }

  function handleNewProject() {
    setEditingProject(undefined);
    setProjectDialogMode('create');
    setProjectDialogOpen(true);
  }

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8 md:space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* ── Section A — Stats ────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Tasks"
            count={totalCount}
            filterKey={null}
            activeFilter={filterStatus}
            onClick={setFilterStatus}
            colorClass="text-foreground"
          />
          <StatCard
            label="Completed"
            count={completedCount}
            filterKey="complete"
            activeFilter={filterStatus}
            onClick={setFilterStatus}
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Active"
            count={activeCount}
            filterKey="active"
            activeFilter={filterStatus}
            onClick={setFilterStatus}
            colorClass="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            label="Overdue"
            count={overdueCount}
            filterKey="overdue"
            activeFilter={filterStatus}
            onClick={setFilterStatus}
            colorClass="text-red-600 dark:text-red-400"
          />
        </div>
      </section>

      {/* ── Section B — Charts ───────────────────────────── */}
      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Status donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {statusChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Priority bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={priorityChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section C — Priority Task List ───────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {filterStatus === 'complete' && 'Completed Tasks'}
            {filterStatus === 'active' && 'Active Tasks'}
            {filterStatus === 'overdue' && 'Overdue Tasks'}
            {filterStatus === null && 'Top Priority Tasks'}
          </h2>
          {filterStatus !== null && (
            <Button variant="ghost" size="sm" onClick={() => setFilterStatus(null)}>
              Clear filter
            </Button>
          )}
        </div>

        {displayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks to display.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onClick={() => handleTaskClick(task)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section D — Folder / Project Progress ────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Progress</h2>
          {isManagerOrAbove && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleNewFolder}>
                <FolderPlus className="mr-1.5 h-4 w-4" />
                New Folder
              </Button>
              <Button variant="outline" size="sm" onClick={handleNewProject}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Project
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Folders with projects */}
          {folders.map((folder) => {
            const folderProjects = projectsByFolder.get(folder._id) ?? [];
            return (
              <div key={folder._id}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: folder.color }}
                  />
                  <h3 className="font-medium">{folder.name}</h3>
                  <span className="text-xs text-muted-foreground">({folderProjects.length} projects)</span>
                  {isManagerOrAbove && (
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleEditFolder(folder)}
                        aria-label={`Edit folder ${folder.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-destructive hover:text-destructive"
                        onClick={() => setDeleteFolderTarget(folder)}
                        aria-label={`Delete folder ${folder.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {folderProjects.length === 0 ? (
                  <p className="ml-5 text-sm text-muted-foreground">No projects in this folder.</p>
                ) : (
                  <div className="ml-5 space-y-3">
                    {folderProjects.map((project) => {
                      const { total, completed } = getProjectTaskCounts(project._id);
                      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                      return (
                        <div key={project._id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                            <span className="flex-1 truncate text-sm font-medium" title={project.name}>
                              {project.name}
                            </span>
                            <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
                              {completed}/{total}
                            </span>
                            {isManagerOrAbove && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5"
                                  onClick={() => handleEditProject(project)}
                                  aria-label={`Edit project ${project.name}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteProjectTarget(project)}
                                  aria-label={`Delete project ${project.name}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* No Folder section */}
          {(projectsByFolder.get(null) ?? []).length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground/40" />
                <h3 className="font-medium text-muted-foreground">No Folder</h3>
                <span className="text-xs text-muted-foreground">
                  ({(projectsByFolder.get(null) ?? []).length} projects)
                </span>
              </div>
              <div className="ml-5 space-y-3">
                {(projectsByFolder.get(null) ?? []).map((project) => {
                  const { total, completed } = getProjectTaskCounts(project._id);
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <div key={project._id} className="flex items-center gap-3">
                      <span
                        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="w-40 flex-shrink-0 truncate text-sm font-medium" title={project.name}>
                        {project.name}
                      </span>
                      <Progress value={pct} className="flex-1" />
                      <span className="w-20 flex-shrink-0 text-right text-xs text-muted-foreground">
                        {completed}/{total} tasks
                      </span>
                      {isManagerOrAbove && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5"
                            onClick={() => handleEditProject(project)}
                            aria-label={`Edit project ${project.name}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-destructive hover:text-destructive"
                            onClick={() => setDeleteProjectTarget(project)}
                            aria-label={`Delete project ${project.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          )}
        </div>
      </section>

      {/* ── Folder Form Dialog ───────────────────────────── */}
      <FolderFormDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        mode={folderDialogMode}
        folder={editingFolder}
      />

      {/* ── Project Dialog ───────────────────────────────── */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        mode={projectDialogMode}
        project={editingProject}
        folders={folders}
      />

      {/* ── Delete Folder Confirm ────────────────────────── */}
      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(open) => { if (!open) setDeleteFolderTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder "{deleteFolderTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This folder will be deleted. Projects inside will be moved to No Folder. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFolder}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingFolder}
              onClick={() => deleteFolderTarget && deleteFolder({ variables: { id: deleteFolderTarget._id } })}
            >
              {deletingFolder ? 'Deleting...' : 'Delete Folder'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Project Confirm ───────────────────────── */}
      <AlertDialog open={!!deleteProjectTarget} onOpenChange={(open) => { if (!open) setDeleteProjectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project "{deleteProjectTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              All tasks in this project will also be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingProject}
              onClick={() => deleteProjectTarget && deleteProject({ variables: { id: deleteProjectTarget._id } })}
            >
              {deletingProject ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Task Dialog ──────────────────────────────────── */}
      <TaskDialog
        open={!!openTaskId}
        onOpenChange={(open) => { if (!open) { setOpenTaskId(undefined); setOpenTaskProjectId(''); } }}
        mode="edit"
        taskId={openTaskId}
        projectId={openTaskProjectId}
        onSuccess={() => { /* tasks refetch via Apollo cache */ }}
      />
    </div>
  );
}
