import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  CREATE_PROJECT_MUTATION,
  UPDATE_PROJECT_MUTATION,
  PROJECTS_QUERY,
} from '@client/graphql/operations';
import { useToast } from '@client/hooks/use-toast';
import { cn } from '@client/lib/utils';
import type {
  IProject,
  IProjectFolder,
  ProjectInput,
} from '@shared/types';
import { ProjectStatus, ProjectCategory } from '@shared/types';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/components/ui/dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { Textarea } from '@client/components/ui/textarea';

// ─── Constants ───────────────────────────────────────────

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: 'Active',
  [ProjectStatus.PAUSED]: 'Paused',
  [ProjectStatus.COMPLETED]: 'Completed',
};

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  [ProjectCategory.CLINICAL]: 'Clinical',
  [ProjectCategory.BUSINESS]: 'Business',
  [ProjectCategory.HR]: 'HR',
  [ProjectCategory.COMPLIANCE]: 'Compliance',
  [ProjectCategory.IT]: 'IT',
};

// ─── Types ───────────────────────────────────────────────

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  project?: IProject;
  folders: IProjectFolder[];
  onSuccess?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────

function toDateInputValue(iso?: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

const NONE_VALUE = '__none__';

// ─── Component ───────────────────────────────────────────

export function ProjectDialog({
  open,
  onOpenChange,
  mode,
  project,
  folders,
  onSuccess,
}: ProjectDialogProps) {
  const { toast } = useToast();

  // ── Form state ──────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.ACTIVE);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [category, setCategory] = useState<ProjectCategory | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [folderId, setFolderId] = useState('');

  // ── Populate form when editing ──────────────────────────
  useEffect(() => {
    if (mode === 'edit' && project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setStatus(project.status);
      setColor(project.color);
      setCategory(project.category ?? '');
      setStartDate(toDateInputValue(project.startDate));
      setEndDate(toDateInputValue(project.endDate));
      setFolderId(project.folderId ?? '');
    } else if (mode === 'create') {
      setName('');
      setDescription('');
      setStatus(ProjectStatus.ACTIVE);
      setColor(PRESET_COLORS[0]);
      setCategory('');
      setStartDate('');
      setEndDate('');
      setFolderId('');
    }
  }, [mode, project, open]);

  // ── Mutations ───────────────────────────────────────────
  const [createProject, { loading: creating }] = useMutation(
    CREATE_PROJECT_MUTATION,
    {
      refetchQueries: [{ query: PROJECTS_QUERY }],
      onCompleted: () => {
        toast({ title: 'Project created' });
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast({ title: 'Failed to create project', description: err.message, variant: 'destructive' });
      },
    },
  );

  const [updateProject, { loading: updating }] = useMutation(
    UPDATE_PROJECT_MUTATION,
    {
      refetchQueries: [{ query: PROJECTS_QUERY }],
      onCompleted: () => {
        toast({ title: 'Project updated' });
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        toast({ title: 'Failed to update project', description: err.message, variant: 'destructive' });
      },
    },
  );

  const loading = creating || updating;

  // ── Submit ──────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const input: ProjectInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      color,
      category: category || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      folderId: folderId || undefined,
    };

    if (mode === 'create') {
      createProject({ variables: { input } });
    } else {
      updateProject({ variables: { id: project!._id, input } });
    }
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New Project' : 'Edit Project'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description"
              rows={3}
            />
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ProjectStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ProjectStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category || NONE_VALUE}
                onValueChange={(v) =>
                  setCategory(v === NONE_VALUE ? '' : (v as ProjectCategory))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {Object.values(ProjectCategory).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="project-start">Start Date</Label>
              <Input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="project-end">End Date</Label>
              <Input
                id="project-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Folder */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select
                value={folderId || NONE_VALUE}
                onValueChange={(v) =>
                  setFolderId(v === NONE_VALUE ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No Folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f._id} value={f._id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: f.color }}
                        />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select color ${c}`}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                    color === c
                      ? 'border-foreground scale-110'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : mode === 'create'
                  ? 'Create Project'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
