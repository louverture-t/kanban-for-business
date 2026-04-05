import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  Trash2,
  Plus,
  X,
  Sparkles,
  MessageSquare,
  Tag,
  Activity,
  CheckSquare,
  Loader2,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/components/ui/dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import { Badge } from '@client/components/ui/badge';
import { Separator } from '@client/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@client/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/components/ui/tooltip';

import { useAuth } from '@client/hooks/use-auth';
import { toast } from '@client/hooks/use-toast';
import { cn } from '@client/lib/utils';

import {
  TASK_QUERY,
  CREATE_TASK_MUTATION,
  UPDATE_TASK_MUTATION,
  DELETE_TASK_MUTATION,
  SUBTASKS_QUERY,
  CREATE_SUBTASK_MUTATION,
  UPDATE_SUBTASK_MUTATION,
  DELETE_SUBTASK_MUTATION,
  COMMENTS_QUERY,
  CREATE_COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION,
  TAGS_QUERY,
  TASK_TAGS_QUERY,
  CREATE_TAG_MUTATION,
  ADD_TAG_TO_TASK_MUTATION,
  REMOVE_TAG_FROM_TASK_MUTATION,
  AUDIT_LOGS_QUERY,
  PROJECT_MEMBERS_QUERY,
  AI_GENERATE_SUBTASKS_MUTATION,
  TASKS_QUERY,
} from '@client/graphql/operations';

import type {
  ITask,
  ISubtask,
  IComment,
  ITag,
  IAuditLog,
  IProjectMember,
} from '@shared/types';
import { TaskStatus, TaskPriority } from '@shared/types';

// ─── Props ─────────────────────────────────────────────────

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  taskId?: string;
  projectId: string;
  defaultStatus?: string;
  onSuccess?: () => void;
}

// ─── Avatar color helper ───────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-cyan-500',
];

function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Helpers ───────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: TaskStatus.BACKLOG, label: 'Backlog' },
  { value: TaskStatus.ACTIVE, label: 'Active' },
  { value: TaskStatus.REVIEW, label: 'Review' },
  { value: TaskStatus.COMPLETE, label: 'Complete' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: TaskPriority.HIGH, label: 'High' },
  { value: TaskPriority.MEDIUM, label: 'Medium' },
  { value: TaskPriority.LOW, label: 'Low' },
];

// ─── Component ─────────────────────────────────────────────

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  taskId,
  projectId,
  defaultStatus,
  onSuccess,
}: TaskDialogProps) {
  const { user, isManagerOrAbove } = useAuth();
  const isEdit = mode === 'edit';

  // ── Form state ──────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(
    (defaultStatus as TaskStatus) || TaskStatus.BACKLOG,
  );
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // ── Subtask input ───────────────────────────────────────
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // ── Comment input ───────────────────────────────────────
  const [commentText, setCommentText] = useState('');

  // ── Tag input ───────────────────────────────────────────
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string>('');

  // ── Submitting state ────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Queries (edit mode) ─────────────────────────────────
  const { data: taskData, loading: taskLoading } = useQuery(TASK_QUERY, {
    variables: { id: taskId },
    skip: !isEdit || !taskId,
    fetchPolicy: 'network-only',
  });

  const { data: subtasksData, refetch: refetchSubtasks } = useQuery(SUBTASKS_QUERY, {
    variables: { taskId },
    skip: !isEdit || !taskId,
  });

  const { data: commentsData, refetch: refetchComments } = useQuery(COMMENTS_QUERY, {
    variables: { taskId },
    skip: !isEdit || !taskId,
  });

  const { data: taskTagsData, refetch: refetchTaskTags } = useQuery(TASK_TAGS_QUERY, {
    variables: { taskId },
    skip: !isEdit || !taskId,
  });

  const { data: allTagsData } = useQuery(TAGS_QUERY, {
    skip: !isEdit,
  });

  const { data: auditData } = useQuery(AUDIT_LOGS_QUERY, {
    variables: { taskId },
    skip: !isEdit || !taskId,
  });

  const { data: membersData } = useQuery(PROJECT_MEMBERS_QUERY, {
    variables: { projectId },
  });

  // ── Mutations ───────────────────────────────────────────
  const [createTask] = useMutation(CREATE_TASK_MUTATION);
  const [updateTask] = useMutation(UPDATE_TASK_MUTATION);
  const [deleteTask] = useMutation(DELETE_TASK_MUTATION);
  const [createSubtask] = useMutation(CREATE_SUBTASK_MUTATION);
  const [updateSubtask] = useMutation(UPDATE_SUBTASK_MUTATION);
  const [deleteSubtask] = useMutation(DELETE_SUBTASK_MUTATION);
  const [createComment] = useMutation(CREATE_COMMENT_MUTATION);
  const [deleteComment] = useMutation(DELETE_COMMENT_MUTATION);
  const [createTag] = useMutation(CREATE_TAG_MUTATION);
  const [addTagToTask] = useMutation(ADD_TAG_TO_TASK_MUTATION);
  const [removeTagFromTask] = useMutation(REMOVE_TAG_FROM_TASK_MUTATION);
  const [aiGenerateSubtasks, { loading: aiGenerating }] = useMutation(
    AI_GENERATE_SUBTASKS_MUTATION,
  );

  // ── Derived data ────────────────────────────────────────
  const task: ITask | undefined = (taskData as any)?.task;
  const subtasks: ISubtask[] = (subtasksData as any)?.subtasks ?? [];
  const comments: IComment[] = (commentsData as any)?.comments ?? [];
  const taskTags: ITag[] = (taskTagsData as any)?.taskTags ?? [];
  const allTags: ITag[] = (allTagsData as any)?.tags ?? [];
  const auditLogs: IAuditLog[] = (auditData as any)?.auditLogs ?? [];
  const members: IProjectMember[] = (membersData as any)?.projectMembers ?? [];

  // Tags available to add (not already on this task)
  const availableTags = allTags.filter(
    (t) => !taskTags.some((tt) => tt._id === t._id),
  );

  // ── Populate form on task load ──────────────────────────
  useEffect(() => {
    if (isEdit && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId ?? '');
      setStartDate(toInputDate(task.startDate));
      setDueDate(toInputDate(task.dueDate));
    }
  }, [isEdit, task]);

  // ── Reset form when dialog opens in create mode ─────────
  useEffect(() => {
    if (open && !isEdit) {
      setTitle('');
      setDescription('');
      setStatus((defaultStatus as TaskStatus) || TaskStatus.BACKLOG);
      setPriority(TaskPriority.MEDIUM);
      setAssigneeId('');
      setStartDate('');
      setDueDate('');
    }
  }, [open, isEdit, defaultStatus]);

  // ── Handlers ────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId: assigneeId || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      };

      if (isEdit && taskId) {
        await updateTask({
          variables: { id: taskId, input },
          refetchQueries: [{ query: TASKS_QUERY, variables: { projectId } }],
        });
        toast({ title: 'Task updated' });
      } else {
        await createTask({
          variables: { input },
          refetchQueries: [{ query: TASKS_QUERY, variables: { projectId } }],
        });
        toast({ title: 'Task created' });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: isEdit ? 'Failed to update task' : 'Failed to create task',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    description,
    status,
    priority,
    assigneeId,
    startDate,
    dueDate,
    projectId,
    taskId,
    isEdit,
    createTask,
    updateTask,
    onOpenChange,
    onSuccess,
  ]);

  const handleTrash = useCallback(async () => {
    if (!taskId) return;
    try {
      await deleteTask({
        variables: { id: taskId },
        refetchQueries: [{ query: TASKS_QUERY, variables: { projectId } }],
      });
      toast({ title: 'Task moved to trash' });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Failed to trash task',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [taskId, projectId, deleteTask, onOpenChange, onSuccess]);

  // ── Subtask handlers ────────────────────────────────────

  const handleAddSubtask = useCallback(async () => {
    if (!newSubtaskTitle.trim() || !taskId) return;
    try {
      await createSubtask({
        variables: { taskId, title: newSubtaskTitle.trim() },
      });
      setNewSubtaskTitle('');
      refetchSubtasks();
    } catch (err: any) {
      toast({
        title: 'Failed to add subtask',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [newSubtaskTitle, taskId, createSubtask, refetchSubtasks]);

  const handleToggleSubtask = useCallback(
    async (subtask: ISubtask) => {
      try {
        await updateSubtask({
          variables: { id: subtask._id, completed: !subtask.completed },
        });
        refetchSubtasks();
      } catch (err: any) {
        toast({
          title: 'Failed to update subtask',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [updateSubtask, refetchSubtasks],
  );

  const handleDeleteSubtask = useCallback(
    async (id: string) => {
      try {
        await deleteSubtask({ variables: { id } });
        refetchSubtasks();
      } catch (err: any) {
        toast({
          title: 'Failed to delete subtask',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [deleteSubtask, refetchSubtasks],
  );

  const handleAiGenerate = useCallback(async () => {
    if (!taskId) return;
    try {
      const { data } = await aiGenerateSubtasks({ variables: { taskId } });
      const suggestions: string[] = (data as any)?.aiGenerateSubtasks ?? [];
      for (const s of suggestions) {
        await createSubtask({ variables: { taskId, title: s } });
      }
      refetchSubtasks();
      toast({ title: `Generated ${suggestions.length} subtasks` });
    } catch (err: any) {
      toast({
        title: 'AI generation failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [taskId, aiGenerateSubtasks, createSubtask, refetchSubtasks]);

  // ── Comment handlers ────────────────────────────────────

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !taskId) return;
    try {
      await createComment({
        variables: { taskId, content: commentText.trim() },
      });
      setCommentText('');
      refetchComments();
    } catch (err: any) {
      toast({
        title: 'Failed to add comment',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [commentText, taskId, createComment, refetchComments]);

  const handleDeleteComment = useCallback(
    async (id: string) => {
      try {
        await deleteComment({ variables: { id } });
        refetchComments();
      } catch (err: any) {
        toast({
          title: 'Failed to delete comment',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [deleteComment, refetchComments],
  );

  // ── Tag handlers ────────────────────────────────────────

  const handleAddTag = useCallback(async () => {
    if (!selectedTagId || !taskId) return;
    try {
      await addTagToTask({ variables: { taskId, tagId: selectedTagId } });
      setSelectedTagId('');
      refetchTaskTags();
    } catch (err: any) {
      toast({
        title: 'Failed to add tag',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [selectedTagId, taskId, addTagToTask, refetchTaskTags]);

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!taskId) return;
      try {
        await removeTagFromTask({ variables: { taskId, tagId } });
        refetchTaskTags();
      } catch (err: any) {
        toast({
          title: 'Failed to remove tag',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [taskId, removeTagFromTask, refetchTaskTags],
  );

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    try {
      const { data } = await createTag({
        variables: { name: newTagName.trim() },
        refetchQueries: [{ query: TAGS_QUERY }],
      });
      setNewTagName('');
      // Auto-add to task if in edit mode
      if (taskId && (data as any)?.createTag?._id) {
        await addTagToTask({
          variables: { taskId, tagId: (data as any).createTag._id },
        });
        refetchTaskTags();
      }
    } catch (err: any) {
      toast({
        title: 'Failed to create tag',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [newTagName, taskId, createTag, addTagToTask, refetchTaskTags]);

  // ── Loading state ───────────────────────────────────────

  if (isEdit && taskLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Render ──────────────────────────────────────────────

  const detailsTab = (
    <div className="grid gap-4">
      {/* Title */}
      <div className="grid gap-2">
        <Label htmlFor="task-title">Title *</Label>
        <Input
          id="task-title"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          placeholder="Describe this task..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Status + Priority row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Priority</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TaskPriority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignee */}
      <div className="grid gap-2">
        <Label>Assignee</Label>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.user?.username ?? m.userId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="task-start-date">Start date</Label>
          <Input
            id="task-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="task-due-date">Due date</Label>
          <Input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const subtasksTab = (
    <div className="grid gap-3">
      {/* AI generate button (Manager+) */}
      {isManagerOrAbove && (
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAiGenerate}
                disabled={aiGenerating}
              >
                {aiGenerating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                AI Generate
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate subtasks with AI</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Subtask list */}
      {subtasks.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No subtasks yet.</p>
      )}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {subtasks.map((st) => (
          <div
            key={st._id}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={st.completed}
              onChange={() => handleToggleSubtask(st)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span
              className={cn(
                'flex-1 truncate',
                st.completed && 'line-through text-muted-foreground',
              )}
            >
              {st.title}
            </span>
            <button
              onClick={() => handleDeleteSubtask(st._id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label={`Delete subtask: ${st.title}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add subtask */}
      <div className="flex gap-2">
        <Input
          placeholder="New subtask..."
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddSubtask();
            }
          }}
        />
        <Button variant="outline" size="icon" onClick={handleAddSubtask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const commentsTab = (
    <div className="grid gap-3">
      {/* Comment list */}
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No comments yet.</p>
      )}
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {comments.map((c) => {
          const authorId = c.author?._id ?? c.authorId;
          const authorName = c.author?.username ?? 'Unknown';
          const isOwnComment = user?._id === authorId;
          return (
            <div key={c._id} className="flex gap-2">
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white',
                  avatarColorFromId(authorId),
                )}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </span>
                  {isOwnComment && (
                    <button
                      onClick={() => handleDeleteComment(c._id)}
                      className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete comment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add comment */}
      <Separator />
      <div className="flex gap-2">
        <Input
          placeholder="Write a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddComment();
            }
          }}
        />
        <Button variant="outline" size="icon" onClick={handleAddComment}>
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const tagsTab = (
    <div className="grid gap-3">
      {/* Current tags */}
      {taskTags.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No tags assigned.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {taskTags.map((tag) => (
          <Badge
            key={tag._id}
            variant="secondary"
            className="gap-1 pr-1"
            style={tag.color ? { backgroundColor: tag.color + '30', color: tag.color } : undefined}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag._id)}
              className="ml-0.5 hover:text-destructive transition-colors"
              aria-label={`Remove tag: ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Add existing tag */}
      {availableTags.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedTagId} onValueChange={setSelectedTagId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a tag..." />
            </SelectTrigger>
            <SelectContent>
              {availableTags.map((tag) => (
                <SelectItem key={tag._id} value={tag._id}>
                  <span className="flex items-center gap-2">
                    {tag.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleAddTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create new tag */}
      <Separator />
      <div className="flex gap-2">
        <Input
          placeholder="New tag name..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreateTag();
            }
          }}
        />
        <Button variant="outline" size="sm" onClick={handleCreateTag}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create
        </Button>
      </div>
    </div>
  );

  const activityTab = (
    <div className="grid gap-1.5 max-h-64 overflow-y-auto">
      {auditLogs.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No activity yet.</p>
      )}
      {auditLogs.map((log) => (
        <div
          key={log._id}
          className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
        >
          <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">{log.userName}</span>{' '}
            <span className="text-muted-foreground">{log.action}</span>
            {log.changes && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {log.changes}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateTime(log.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );

  // Handle "Unassigned" sentinel for the select
  const effectiveAssigneeId = assigneeId === '__none__' ? '' : assigneeId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update task details, manage subtasks, comments, and tags.'
              : 'Fill in the details to create a new task.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isEdit ? (
            <Tabs defaultValue="details">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="subtasks" className="gap-1">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Subtasks
                </TabsTrigger>
                <TabsTrigger value="comments" className="gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comments
                </TabsTrigger>
                <TabsTrigger value="tags" className="gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-1">
                  <Activity className="h-3.5 w-3.5" />
                  Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details">{detailsTab}</TabsContent>
              <TabsContent value="subtasks">{subtasksTab}</TabsContent>
              <TabsContent value="comments">{commentsTab}</TabsContent>
              <TabsContent value="tags">{tagsTab}</TabsContent>
              <TabsContent value="activity">{activityTab}</TabsContent>
            </Tabs>
          ) : (
            detailsTab
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isEdit && (
            <Button
              variant="destructive"
              size="sm"
              className="mr-auto"
              onClick={handleTrash}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Move to Trash
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
