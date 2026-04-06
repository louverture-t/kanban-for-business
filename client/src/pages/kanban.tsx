import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

import { TASKS_QUERY, ARCHIVE_SWEEP_MUTATION } from '@client/graphql/operations';
import { TaskCard } from '@client/components/task-card';
import { TaskDialog } from '@client/components/task-dialog';
import { Badge } from '@client/components/ui/badge';
import { Button } from '@client/components/ui/button';
import { TaskStatus } from '@shared/types';
import type { ITask } from '@shared/types';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: TaskStatus.BACKLOG, label: 'Backlog' },
  { status: TaskStatus.ACTIVE, label: 'Active' },
  { status: TaskStatus.REVIEW, label: 'Review' },
  { status: TaskStatus.COMPLETE, label: 'Complete' },
];

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();

  const { data, loading, error } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
    variables: { projectId, includeArchived },
    skip: !projectId,
  });

  const [archiveSweep] = useMutation(ARCHIVE_SWEEP_MUTATION);

  useEffect(() => {
    if (projectId) {
      archiveSweep().catch(() => {});
    }
  }, [projectId]);

  const onDragEnd = (_result: DropResult) => {
    // drag-and-drop reordering handled here in full implementation
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
        <p className="text-destructive">Failed to load tasks</p>
      </div>
    );
  }

  const allTasks: ITask[] = data?.tasks ?? [];
  const visibleTasks = showTrash
    ? allTasks.filter((t) => t.deletedAt)
    : allTasks.filter((t) => !t.deletedAt);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kanban Board</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeArchived((prev) => !prev)}
          >
            {includeArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTrash((prev) => !prev)}
          >
            {showTrash ? 'Hide Trash' : 'Show Trash'}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedTaskId(undefined);
              setDialogOpen(true);
            }}
          >
            New Task
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(({ status, label }) => {
            const columnTasks = visibleTasks
              .filter((t) => t.status === status)
              .sort((a, b) => a.position - b.position);

            return (
              <div key={status} className="w-72 flex-shrink-0">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-semibold">{label}</h2>
                  <Badge variant="secondary">{columnTasks.length}</Badge>
                </div>

                <Droppable droppableId={status}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="min-h-[100px] space-y-2"
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task._id} draggableId={task._id} index={index}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                            >
                              <TaskCard
                                task={task}
                                onClick={() => {
                                  setSelectedTaskId(task._id);
                                  setDialogOpen(true);
                                }}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={selectedTaskId ? 'edit' : 'create'}
        taskId={selectedTaskId}
        projectId={projectId ?? ''}
        onSuccess={() => setDialogOpen(false)}
      />
    </div>
  );
}
