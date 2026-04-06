import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskCard } from '@client/components/task-card';
import { Badge } from '@client/components/ui/badge';
import type { ITask } from '@shared/types';

interface AssigneeGroup {
  name: string;
  tasks: ITask[];
}

function groupByAssignee(tasks: ITask[]): AssigneeGroup[] {
  const map = new Map<string, AssigneeGroup>();

  for (const task of tasks) {
    if (task.assignee) {
      const key = task.assignee._id;
      if (!map.has(key)) {
        map.set(key, { name: task.assignee.username, tasks: [] });
      }
      map.get(key)!.tasks.push(task);
    } else {
      if (!map.has('unassigned')) {
        map.set('unassigned', { name: 'Unassigned', tasks: [] });
      }
      map.get('unassigned')!.tasks.push(task);
    }
  }

  // Sort: assigned users alphabetically, Unassigned last
  const assigned = [...map.entries()]
    .filter(([key]) => key !== 'unassigned')
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([, group]) => group);

  const unassigned = map.get('unassigned');

  return unassigned ? [...assigned, unassigned] : assigned;
}

export function TeamPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, loading, error } = useQuery(TASKS_QUERY, {
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
  const groups = groupByAssignee(tasks);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Team View</h1>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.name}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <Badge variant="secondary">{group.tasks.length}</Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tasks.map((task) => (
                  <TaskCard key={task._id} task={task} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
