import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const scrollRefs = useRef<Record<string, HTMLDivElement>>({});

  const { data, loading, error } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
    variables: { projectId, includeArchived: false },
    skip: !projectId,
  });

  const scrollLeft = (key: string) => {
    scrollRefs.current[key]?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = (key: string) => {
    scrollRefs.current[key]?.scrollBy({ left: 300, behavior: 'smooth' });
  };

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
                <div className="relative">
                  {/* Left fade gradient */}
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-background to-transparent z-10" />

                  {/* Right fade gradient */}
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-background to-transparent z-10" />

                  {/* Left arrow button */}
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full border bg-background shadow-sm p-1 hover:bg-accent"
                    onClick={() => scrollLeft(value)}
                    aria-label={`Scroll ${label} left`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Right arrow button */}
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full border bg-background shadow-sm p-1 hover:bg-accent"
                    onClick={() => scrollRight(value)}
                    aria-label={`Scroll ${label} right`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Scroll container */}
                  <div
                    ref={(el) => { if (el) scrollRefs.current[value] = el; }}
                    className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {sectionTasks.map((task) => (
                      <div key={task._id} className="w-72 flex-shrink-0">
                        <TaskCard task={task} onClick={() => setOpenTaskId(task._id)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
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
