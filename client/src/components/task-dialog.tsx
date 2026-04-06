import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/components/ui/tabs';
import { Button } from '@client/components/ui/button';
import { Label } from '@client/components/ui/label';
import { Input } from '@client/components/ui/input';
import { Textarea } from '@client/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import {
  TASK_QUERY,
  CREATE_TASK_MUTATION,
  UPDATE_TASK_MUTATION,
  MOVE_TASK_TO_TRASH_MUTATION,
  SUBTASKS_QUERY,
  COMMENTS_QUERY,
  TASK_TAGS_QUERY,
  TAGS_QUERY,
  AUDIT_LOGS_QUERY,
  PROJECT_MEMBERS_QUERY,
} from '@client/graphql/operations';
import { toast } from '@client/hooks/use-toast';
import { TaskStatus, TaskPriority } from '@shared/types';

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  taskId?: string;
  projectId: string;
  onSuccess: () => void;
}

// ─── Create Mode ──────────────────────────────────────────

function CreateForm({
  projectId,
  onOpenChange,
  onSuccess,
}: {
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.BACKLOG);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  const [createTask, { loading }] = useMutation(CREATE_TASK_MUTATION);

  async function handleSubmit() {
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    await createTask({
      variables: {
        input: {
          projectId,
          title,
          description: description || undefined,
          status,
          priority,
          assigneeId: undefined,
          startDate: undefined,
          dueDate: undefined,
        },
      },
    });

    onSuccess();
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New Task</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label htmlFor="task-title">Title *</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TaskStatus.BACKLOG}>Backlog</SelectItem>
              <SelectItem value={TaskStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={TaskStatus.REVIEW}>Review</SelectItem>
              <SelectItem value={TaskStatus.COMPLETE}>Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
              <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
              <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          Create Task
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Edit Mode ────────────────────────────────────────────

function EditForm({
  taskId,
  projectId,
  onOpenChange,
  onSuccess,
}: {
  taskId: string;
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: taskData } = useQuery(TASK_QUERY, {
    variables: { id: taskId },
    skip: !taskId,
  });

  useQuery(SUBTASKS_QUERY, { variables: { taskId }, skip: !taskId });
  useQuery(COMMENTS_QUERY, { variables: { taskId }, skip: !taskId });
  useQuery(TASK_TAGS_QUERY, { variables: { taskId }, skip: !taskId });
  useQuery(TAGS_QUERY);
  useQuery(AUDIT_LOGS_QUERY, { variables: { taskId }, skip: !taskId });
  useQuery(PROJECT_MEMBERS_QUERY, { variables: { projectId }, skip: !projectId });

  const [updateTask, { loading: saving }] = useMutation(UPDATE_TASK_MUTATION);
  const [moveToTrash] = useMutation(MOVE_TASK_TO_TRASH_MUTATION);

  useEffect(() => {
    if (taskData?.task) {
      setTitle(taskData.task.title ?? '');
      setDescription(taskData.task.description ?? '');
    }
  }, [taskData]);

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    await updateTask({
      variables: {
        id: taskId,
        input: {
          title,
          description: description || undefined,
        },
      },
    });

    onSuccess();
    onOpenChange(false);
  }

  async function handleTrash() {
    await moveToTrash({ variables: { id: taskId } });
    onSuccess();
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Task</DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="details" className="mt-2">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subtasks">
          <div className="py-4 text-sm text-muted-foreground">No subtasks yet.</div>
        </TabsContent>

        <TabsContent value="comments">
          <div className="py-4 text-sm text-muted-foreground">No comments yet.</div>
        </TabsContent>

        <TabsContent value="tags">
          <div className="py-4 text-sm text-muted-foreground">No tags yet.</div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="py-4 text-sm text-muted-foreground">No activity yet.</div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="destructive" onClick={handleTrash}>
          Move to Trash
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          Save Changes
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── TaskDialog ───────────────────────────────────────────

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  taskId,
  projectId,
  onSuccess,
}: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {mode === 'create' ? (
          <CreateForm
            projectId={projectId}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : taskId ? (
          <EditForm
            taskId={taskId}
            projectId={projectId}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
