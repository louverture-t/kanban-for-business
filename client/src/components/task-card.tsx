import { motion } from 'framer-motion';
import { Calendar, CheckSquare, Archive, Trash2, RotateCcw, ArchiveRestore } from 'lucide-react';

import type { ITask, IUser } from '@shared/types';
import { TaskPriority } from '@shared/types';
import { cn } from '@client/lib/utils';
import { Badge } from '@client/components/ui/badge';
import { Button } from '@client/components/ui/button';

// ─── Avatar color palette ──────────────────────────────────

const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-pink-500',
  'bg-indigo-500',
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

// ─── Priority helpers ──────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  [TaskPriority.HIGH]: {
    label: 'High',
    className: 'border-transparent bg-red-500/15 text-red-700 dark:text-red-400',
  },
  [TaskPriority.MEDIUM]: {
    label: 'Medium',
    className: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  [TaskPriority.LOW]: {
    label: 'Low',
    className: 'border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
};

// ─── Date helpers ──────────────────────────────────────────

/** Parse date that may be an epoch-ms string or ISO string. */
function parseDate(value: string): Date {
  const n = Number(value);
  if (!isNaN(n)) return new Date(n);
  return new Date(value);
}

function isValidDate(value: string): boolean {
  return !isNaN(parseDate(value).getTime());
}

function isOverdue(dueDate: string): boolean {
  return isValidDate(dueDate) && parseDate(dueDate) < new Date();
}

function formatDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function daysUntilPurge(deletedAt: string): number {
  const deleteDate = new Date(deletedAt);
  const purgeDate = new Date(deleteDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((purgeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function daysSinceDeleted(deletedAt: string): number {
  const deleteDate = new Date(deletedAt);
  const now = new Date();
  return Math.floor((now.getTime() - deleteDate.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Props ─────────────────────────────────────────────────

export interface TaskCardProps {
  task: ITask;
  subtaskTotal?: number;
  subtaskCompleted?: number;
  showTrashCountdown?: boolean;
  onRestore?: () => void;
  onUnarchive?: () => void;
  onClick?: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function TaskCard({
  task,
  subtaskTotal = 0,
  subtaskCompleted = 0,
  showTrashCountdown = false,
  onRestore,
  onUnarchive,
  onClick,
}: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority];
  const overdue = task.dueDate && !task.completedAt && isOverdue(task.dueDate);
  const assignee: IUser | undefined = task.assignee;
  const daysLeft = showTrashCountdown && task.deletedAt ? daysUntilPurge(task.deletedAt) : null;
  const daysAgo = showTrashCountdown && task.deletedAt ? daysSinceDeleted(task.deletedAt) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg border bg-card p-3 text-card-foreground shadow-sm',
        'hover:shadow-md hover:border-primary/30 transition-shadow',
      )}
    >
      {/* Top row: priority badge + archived/trash badge */}
      <div className="flex items-center gap-2 mb-2">
        <Badge className={cn('text-[10px] px-1.5 py-0', priority.className)}>
          {priority.label}
        </Badge>

        {task.archivedAt && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
            <Archive className="h-3 w-3" />
            Archived
          </Badge>
        )}

        {daysLeft !== null && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
            <Trash2 className="h-3 w-3" />
            Deleted {daysAgo}d ago — {daysLeft}d until purge
          </Badge>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium leading-snug line-clamp-2 mb-2">
        {task.title}
      </h3>

      {/* Bottom row: metadata */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {/* Due date */}
        {task.dueDate && isValidDate(task.dueDate) && (
          <span
            className={cn(
              'inline-flex items-center gap-1',
              overdue && 'text-red-600 dark:text-red-400 font-medium',
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* Subtask count */}
        {subtaskTotal > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {subtaskCompleted}/{subtaskTotal}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Assignee avatar */}
        {assignee && (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white',
                avatarColorFromId(assignee._id),
              )}
              title={assignee.username}
            >
              {assignee.username.charAt(0).toUpperCase()}
            </span>
            <span className="max-w-[72px] truncate">{assignee.username}</span>
          </div>
        )}
      </div>

      {/* Restore button — shown in trash panel */}
      {showTrashCountdown && onRestore && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full text-xs"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
        >
          <RotateCcw className="mr-1.5 h-3 w-3" />
          Restore
        </Button>
      )}

      {/* Unarchive button — shown on archived tasks in Kanban columns */}
      {task.archivedAt && onUnarchive && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-6 w-full px-2 text-xs"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onUnarchive();
          }}
        >
          <ArchiveRestore className="mr-1 h-3 w-3" />
          Unarchive
        </Button>
      )}
    </motion.div>
  );
}
