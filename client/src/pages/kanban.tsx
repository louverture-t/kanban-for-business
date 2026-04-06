import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Plus,
  Archive,
  Trash2,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import type { ITask } from '@shared/types';
import { TaskStatus } from '@shared/types';
import { cn } from '@client/lib/utils';
import { Button } from '@client/components/ui/button';
import { Badge } from '@client/components/ui/badge';
import { TaskCard } from '@client/components/task-card';
import { TaskDialog } from '@client/components/task-dialog';
import { useAuth } from '@client/hooks/use-auth';
import { useToast } from '@client/hooks/use-toast';
import {
  TASKS_QUERY,
  UPDATE_TASK_MUTATION,
  RESTORE_TASK_MUTATION,
  ARCHIVE_SWEEP_MUTATION,
  TRASHED_TASKS_QUERY,
} from '@client/graphql/operations';

// ─── Column config ──────────────────────────────────────────

const COLUMNS = [
  { status: TaskStatus.BACKLOG, label: 'Backlog', color: 'bg-slate-500' },
  { status: TaskStatus.ACTIVE, label: 'Active', color: 'bg-blue-500' },
  { status: TaskStatus.REVIEW, label: 'Review', color: 'bg-amber-500' },
  { status: TaskStatus.COMPLETE, label: 'Complete', color: 'bg-emerald-500' },
] as const;

// ─── Kanban Page ────────────────────────────────────────────

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { isManagerOrAbove } = useAuth();
  const { toast } = useToast();

  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogTaskId, setDialogTaskId] = useState<string | undefined>();
  const [dialogDefaultStatus, setDialogDefaultStatus] = useState<TaskStatus>(
    TaskStatus.BACKLOG,
  );

  // ─── Queries ────────────────────────────────────────────

  const {
    data: tasksData,
    loading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery(TASKS_QUERY, {
    variables: { projectId, includeArchived: showArchived },
    skip: !projectId,
  });

  const {
    data: trashedData,
    loading: trashedLoading,
    refetch: refetchTrashed,
  } = useQuery(TRASHED_TASKS_QUERY, {
    skip: !showTrash,
  });

  // ─── Mutations ──────────────────────────────────────────

  const [updateTask] = useMutation(UPDATE_TASK_MUTATION);
  const [restoreTask] = useMutation(RESTORE_TASK_MUTATION);
  const [archiveSweep] = useMutation(ARCHIVE_SWEEP_MUTATION);

  // Run archive sweep once on mount
  useEffect(() => {
    if (projectId) {
      archiveSweep().catch(() => {
        // Sweep is best-effort; don't block the page
      });
    }
  }, [projectId, archiveSweep]);

  // ─── Task grouping ─────────────────────────────────────

  const allTasks: ITask[] = (tasksData as { tasks?: ITask[] })?.tasks ?? [];
  const trashedTasks: ITask[] = (trashedData as { trashedTasks?: ITask[] })?.trashedTasks ?? [];

  const tasksByColumn = COLUMNS.map((col) => ({
    ...col,
    tasks: allTasks
      .filter((t) => t.status === col.status && !t.deletedAt)
      .sort((a, b) => a.position - b.position),
  }));

  // ─── Drag and drop ─────────────────────────────────────

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      const newStatus = destination.droppableId as TaskStatus;
      const newPosition = destination.index;

      try {
        await updateTask({
          variables: {
            id: draggableId,
            input: { status: newStatus, position: newPosition },
          },
        });
        await refetchTasks();
      } catch {
        toast({
          title: 'Move failed',
          description: 'Could not update task position.',
          variant: 'destructive',
        });
      }
    },
    [updateTask, refetchTasks, toast],
  );

  // ─── Task dialog handlers ──────────────────────────────

  const openCreateDialog = (status: TaskStatus) => {
    setDialogMode('create');
    setDialogTaskId(undefined);
    setDialogDefaultStatus(status);
    setDialogOpen(true);
  };

  const openEditDialog = (taskId: string) => {
    setDialogMode('edit');
    setDialogTaskId(taskId);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    refetchTasks();
    if (showTrash) refetchTrashed();
  };

  // ─── Restore handler ───────────────────────────────────

  const handleRestore = async (taskId: string) => {
    try {
      await restoreTask({ variables: { id: taskId } });
      toast({ title: 'Task restored' });
      refetchTasks();
      refetchTrashed();
    } catch {
      toast({
        title: 'Restore failed',
        description: 'Could not restore the task.',
        variant: 'destructive',
      });
    }
  };

  // ─── Loading state ─────────────────────────────────────

  if (tasksLoading && !tasksData) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
        <h1 className="text-lg font-semibold truncate">Kanban Board</h1>

        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="mr-1.5 h-4 w-4" />
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>

          <Button
            variant={showTrash ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowTrash((v) => !v)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {showTrash ? 'Hide Trash' : 'Show Trash'}
          </Button>
        </div>
      </div>

      {/* Columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto p-4 min-h-0">
          {tasksByColumn.map((col) => (
            <div
              key={col.status}
              className="flex flex-col min-w-[280px] w-full rounded-lg border bg-muted/40"
            >
              {/* Column header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
                <div className="flex items-center gap-2">
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full', col.color)}
                  />
                  <span className="text-sm font-medium">{col.label}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 min-w-[20px] justify-center"
                  >
                    {col.tasks.length}
                  </Badge>
                </div>

                {isManagerOrAbove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openCreateDialog(col.status)}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">
                      Add task to {col.label}
                    </span>
                  </Button>
                )}
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex flex-col gap-2 p-2 flex-1 overflow-y-auto transition-colors',
                      snapshot.isDraggingOver && 'bg-primary/5',
                    )}
                  >
                    {col.tasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No tasks
                      </p>
                    )}

                    {col.tasks.map((task, index) => (
                      <Draggable
                        key={task._id}
                        draggableId={task._id}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(
                              dragSnapshot.isDragging && 'opacity-90 rotate-1',
                            )}
                          >
                            <TaskCard
                              task={task}
                              onClick={() => openEditDialog(task._id)}
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
          ))}
        </div>
      </DragDropContext>

      {/* Trash panel */}
      {showTrash && (
        <div className="border-t">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setShowTrash((v) => !v)}
          >
            <Trash2 className="h-4 w-4" />
            Trash
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 min-w-[20px] justify-center"
            >
              {trashedTasks.length}
            </Badge>
            <span className="flex-1" />
            {showTrash ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>

          <div className="px-4 pb-4">
            {trashedLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : trashedTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Trash is empty
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {trashedTasks.map((task) => (
                  <div key={task._id} className="relative">
                    <TaskCard
                      task={task}
                      showTrashCountdown
                      onClick={() => openEditDialog(task._id)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(task._id);
                      }}
                    >
                      <RotateCcw className="mr-1.5 h-3 w-3" />
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task dialog */}
      {projectId && (
        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={dialogMode}
          taskId={dialogTaskId}
          projectId={projectId}
          defaultStatus={dialogDefaultStatus}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}
