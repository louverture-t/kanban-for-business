import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskCard } from '@client/components/task-card';
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

  const tasks: ITask[] = data?.tasks ?? [];

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Priority View</h1>

      <div className="space-y-8">
        {PRIORITY_SECTIONS.map(({ value, label, color }) => {
          const sectionTasks = tasks.filter((t) => t.priority === value);

          return (
            <section key={value}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className={`text-lg font-semibold ${color}`}>{label}</h2>
                <Badge variant="secondary">{sectionTasks.length}</Badge>
              </div>

              {sectionTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No {label.toLowerCase()} tasks</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionTasks.map((task) => (
                    <TaskCard key={task._id} task={task} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
