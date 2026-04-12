import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskCard } from '@client/components/task-card';
import { TaskDialog } from '@client/components/task-dialog';
import { Badge } from '@client/components/ui/badge';
import { TaskPriority } from '@shared/types';
import type { ITask } from '@shared/types';

const PRIORITY_SECTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: TaskPriority.HIGH, label: 'High Priority', color: 'text-red-600 dark:text-red-400' },
  { value: TaskPriority.MEDIUM, label: 'Medium Priority', color: 'text-amber-600 dark:text-amber-400' },
  { value: TaskPriority.LOW, label: 'Low Priority', color: 'text-blue-600 dark:text-blue-400' },
];

export function PriorityPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [openTaskId, setOpenTaskId] = useState<string | undefined>();

  const { data, loading, error } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
    variables: { projectId, includeArchived: false },
    skip: !projectId,
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">Failed to load tasks: {error.message}</p>
      </div>
    );
  }

  if (!projectId) return null;

  const tasks: ITask[] = data?.tasks ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <h1 className="text-xl font-semibold">Priority View</h1>
      </div>

      {/* 3-column kanban layout */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {PRIORITY_SECTIONS.map(({ value, label, color }) => {
          const sectionTasks = tasks.filter((t) => t.priority === value);

          return (
            <div key={value} className="flex flex-col flex-1 min-w-[280px] max-w-sm rounded-lg border bg-muted/30 overflow-hidden">
              {/* Column header */}
              <div className="px-3 py-2.5 border-b shrink-0 flex items-center gap-2">
                <h2 className={`font-semibold text-sm ${color}`}>{label}</h2>
                <Badge variant="secondary">{sectionTasks.length}</Badge>
              </div>

              {/* Scrollable card list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sectionTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No tasks</p>
                ) : (
                  sectionTasks.map((task) => (
                    <TaskCard key={task._id} task={task} onClick={() => setOpenTaskId(task._id)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={!!openTaskId}
        onOpenChange={(open) => { if (!open) setOpenTaskId(undefined); }}
        mode="edit"
        taskId={openTaskId}
        projectId={projectId}
        onSuccess={() => { /* tasks refetch via Apollo cache */ }}
      />
    </div>
  );
}
