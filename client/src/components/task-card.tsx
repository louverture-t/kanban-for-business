import { motion } from 'framer-motion';
import { Calendar, CheckSquare, Archive, Trash2 } from 'lucide-react';

import type { ITask, IUser } from '@shared/types';
import { TaskPriority } from '@shared/types';
import { cn } from '@client/lib/utils';
import { Badge } from '@client/components/ui/badge';

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

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
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

// ─── Props ─────────────────────────────────────────────────

export interface TaskCardProps {
  task: ITask;
  subtaskTotal?: number;
  subtaskCompleted?: number;
  showTrashCountdown?: boolean;
  onClick?: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function TaskCard({
  task,
  subtaskTotal = 0,
  subtaskCompleted = 0,
  showTrashCountdown = false,
  onClick,
}: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority];
  const overdue = task.dueDate && !task.completedAt && isOverdue(task.dueDate);
  const assignee: IUser | undefined = task.assignee;
  const trashDays = showTrashCountdown && task.deletedAt ? daysUntilPurge(task.deletedAt) : null;

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

        {trashDays !== null && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
            <Trash2 className="h-3 w-3" />
            {trashDays}d left
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
        {task.dueDate && (
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
    </motion.div>
  );
}
