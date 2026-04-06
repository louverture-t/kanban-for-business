import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { TASKS_QUERY, PROJECT_MEMBERS_QUERY } from '@client/graphql/operations';
import { TaskCard } from '@client/components/task-card';
import { TaskDialog } from '@client/components/task-dialog';
import { Badge } from '@client/components/ui/badge';
import type { ITask, IProjectMember } from '@shared/types';

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

// ─── Types ─────────────────────────────────────────────────

interface AssigneeGroup {
  userId: string;
  name: string;
  tasks: ITask[];
}

function groupByAssignee(tasks: ITask[]): AssigneeGroup[] {
  const map = new Map<string, AssigneeGroup>();

  for (const task of tasks) {
    if (task.assignee) {
      const key = task.assignee._id;
      if (!map.has(key)) {
        map.set(key, { userId: key, name: task.assignee.username, tasks: [] });
      }
      map.get(key)!.tasks.push(task);
    } else {
      if (!map.has('unassigned')) {
        map.set('unassigned', { userId: 'unassigned', name: 'Unassigned', tasks: [] });
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
  const [openTaskId, setOpenTaskId] = useState<string | undefined>();

  const { data, loading, error } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
    variables: { projectId, includeArchived: false },
    skip: !projectId,
  });

  const { data: membersData } = useQuery<{ projectMembers: IProjectMember[] }>(PROJECT_MEMBERS_QUERY, {
    variables: { projectId },
    skip: !projectId,
  });

  if (loading || !projectId) {
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

  // Merge in project members who have no tasks
  const allMembers = (membersData?.projectMembers ?? [])
    .map((m) => m.user)
    .filter((u): u is NonNullable<typeof u> => u != null);

  const groupedUserIds = new Set(
    groups.filter((g) => g.userId !== 'unassigned').map((g) => g.userId),
  );

  for (const member of allMembers) {
    if (!groupedUserIds.has(member._id)) {
      const insertAt = groups.length - (groups.at(-1)?.userId === 'unassigned' ? 1 : 0);
      groups.splice(insertAt, 0, {
        userId: member._id,
        name: member.username,
        tasks: [],
      });
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Team View</h1>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.userId}>
              <div className="mb-3 flex items-center gap-3">
                {group.userId !== 'unassigned' ? (
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${avatarColorFromId(group.userId)}`}
                  >
                    {group.name[0]?.toUpperCase()}
                  </span>
                ) : (
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    ?
                  </span>
                )}
                <h2 className="text-lg font-semibold">{group.name}</h2>
                {group.userId === 'unassigned' ? (
                  <Badge
                    variant={group.tasks.length > 10 ? 'destructive' : 'secondary'}
                    className={
                      group.tasks.length > 5 && group.tasks.length <= 10
                        ? 'bg-amber-500 text-white hover:bg-amber-500'
                        : undefined
                    }
                  >
                    {group.tasks.length}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{group.tasks.length}</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tasks.map((task) => (
                  <TaskCard key={task._id} task={task} onClick={() => setOpenTaskId(task._id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <TaskDialog
        open={!!openTaskId}
        onOpenChange={(open) => {
          if (!open) setOpenTaskId(undefined);
        }}
        mode="edit"
        taskId={openTaskId}
        projectId={projectId}
        onSuccess={() => {}}
      />
    </div>
  );
}
