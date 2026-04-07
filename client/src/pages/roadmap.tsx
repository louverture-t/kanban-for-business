import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskDialog } from '@client/components/task-dialog';
import { cn } from '@client/lib/utils';
import { TaskPriority } from '@shared/types';
import type { ITask } from '@shared/types';

// ─── Date helpers ─────────────────────────────────────────

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Priority colors ──────────────────────────────────────

const BAR_COLOR: Record<string, string> = {
  [TaskPriority.HIGH]:   'bg-red-500 hover:bg-red-400',
  [TaskPriority.MEDIUM]: 'bg-amber-400 hover:bg-amber-300',
  [TaskPriority.LOW]:    'bg-blue-400 hover:bg-blue-300',
};

const DOT_COLOR: Record<string, string> = {
  [TaskPriority.HIGH]:   'bg-red-500',
  [TaskPriority.MEDIUM]: 'bg-amber-400',
  [TaskPriority.LOW]:    'bg-blue-400',
};

// ─── Component ────────────────────────────────────────────

export function RoadmapPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [viewMode, setViewMode] = useState<'month' | 'quarter'>('month');
  const [currentPeriodStart, setCurrentPeriodStart] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [openTaskId, setOpenTaskId] = useState<string | undefined>();

  const { data, loading } = useQuery<{ tasks: ITask[] }>(TASKS_QUERY, {
    variables: { projectId, includeArchived: false },
    skip: !projectId,
  });

  const tasks = (data?.tasks ?? []).filter(
    (t) => !t.deletedAt && (t.startDate || t.dueDate),
  );

  // ─── Day grid ─────────────────────────────────────────

  const DAY_WIDTH = viewMode === 'month' ? 36 : 18;

  // Generate every day in the visible period
  const days = useMemo<Date[]>(() => {
    const result: Date[] = [];
    const monthCount = viewMode === 'month' ? 1 : 3;
    for (let m = 0; m < monthCount; m++) {
      const month = addMonths(currentPeriodStart, m);
      const daysInMonth = getDaysInMonth(month);
      for (let d = 1; d <= daysInMonth; d++) {
        result.push(new Date(month.getFullYear(), month.getMonth(), d));
      }
    }
    return result;
  }, [viewMode, currentPeriodStart]);

  const totalWidth = days.length * DAY_WIDTH;
  const periodStartMs = currentPeriodStart.getTime();
  const periodEndMs = periodStartMs + days.length * DAY_MS;

  // Today index within the current period
  const today = new Date();
  const todayLocalMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayDayIndex = Math.round((todayLocalMs - periodStartMs) / DAY_MS);
  const todayInView = todayDayIndex >= 0 && todayDayIndex < days.length;
  const todayLinePx = todayDayIndex * DAY_WIDTH + DAY_WIDTH / 2;

  // Month segments for quarter view header
  const monthSegments = useMemo(() => {
    if (viewMode !== 'quarter') return [];
    return [0, 1, 2].map((i) => {
      const m = addMonths(currentPeriodStart, i);
      return {
        label: `Q${Math.floor(m.getMonth() / 3) + 1} ${m.getFullYear()}`,
        days: getDaysInMonth(m),
        widthPx: getDaysInMonth(m) * DAY_WIDTH,
      };
    });
  }, [viewMode, currentPeriodStart, DAY_WIDTH]);

  // Period label (center nav)
  const periodLabel =
    viewMode === 'month'
      ? currentPeriodStart.toLocaleString('default', { month: 'long', year: 'numeric' })
      : `${currentPeriodStart.toLocaleString('default', { month: 'short' })} – ${addMonths(currentPeriodStart, 2).toLocaleString('default', { month: 'short', year: 'numeric' })}`;

  // ─── Date parsing ─────────────────────────────────────

  function parseTaskDate(val?: string | null): number | null {
    if (val == null || val === '') return null;
    // GraphQL String scalar serializes Date via isFinite → timestamp string e.g. "1775606400000"
    const n = Number(val);
    if (!isNaN(n)) return n;
    const d = new Date(val).getTime();
    return isNaN(d) ? null : d;
  }

  // ─── Bar positioning (pixel-based on day grid) ─────────

  function getBarStyle(task: ITask): React.CSSProperties | null {
    const s = parseTaskDate(task.startDate);
    const e = parseTaskDate(task.dueDate);
    if (s == null && e == null) return null;

    const start = s ?? e!;
    const end   = e ?? s!;

    if (start > periodEndMs || end < periodStartMs) return null;

    const clampedStart = Math.max(start, periodStartMs);
    const clampedEnd   = Math.min(end, periodEndMs);

    // Day offsets (fractional for sub-day precision, but dates are midnight UTC)
    const leftDays  = (clampedStart - periodStartMs) / DAY_MS;
    // Add 1 day to end so a single-day task covers its full cell
    const widthDays = Math.max((clampedEnd - clampedStart) / DAY_MS + 1, 1);

    return {
      left:  `${leftDays * DAY_WIDTH}px`,
      width: `${widthDays * DAY_WIDTH}px`,
    };
  }

  function getBarTooltip(task: ITask): string {
    const s = parseTaskDate(task.startDate);
    const e = parseTaskDate(task.dueDate);
    const fmtDate = (ms: number | null) =>
      ms != null ? new Date(ms).toLocaleDateString() : '—';
    return `${task.title} | ${task.status} | ${fmtDate(s)} → ${fmtDate(e)}`;
  }

  // ─── Navigation ────────────────────────────────────────

  const STEP = viewMode === 'month' ? 1 : 3;

  function goToToday() {
    const d = new Date();
    setCurrentPeriodStart(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top toolbar: title + toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h1 className="text-xl font-semibold">Roadmap</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              'px-3 py-1 rounded text-sm border',
              viewMode === 'month'
                ? 'bg-secondary text-secondary-foreground border-border'
                : 'border-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('quarter')}
            className={cn(
              'px-3 py-1 rounded text-sm border',
              viewMode === 'quarter'
                ? 'bg-secondary text-secondary-foreground border-border'
                : 'border-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            Quarter
          </button>
        </div>
      </div>

      {/* Body: sticky sidebar + scrollable day grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Sticky task-name sidebar ── */}
        <div className="sticky left-0 z-20 bg-background border-r shrink-0 w-48 flex flex-col">

          {/* Nav row (matches grid header height) */}
          <div
            className={cn(
              'flex items-center justify-between px-2 border-b shrink-0 bg-background',
              viewMode === 'quarter' ? 'h-[3.75rem]' : 'h-10',
            )}
          >
            <button
              onClick={() => setCurrentPeriodStart((p) => addMonths(p, -STEP))}
              className="text-base px-1 rounded hover:bg-muted leading-none"
              aria-label="Previous"
            >
              ‹
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-semibold leading-tight text-center truncate max-w-[8rem]">
                {periodLabel}
              </span>
              <button
                onClick={goToToday}
                className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 leading-none"
              >
                Today
              </button>
            </div>
            <button
              onClick={() => setCurrentPeriodStart((p) => addMonths(p, STEP))}
              className="text-base px-1 rounded hover:bg-muted leading-none"
              aria-label="Next"
            >
              ›
            </button>
          </div>

          {/* Task name rows */}
          {tasks.length === 0 ? (
            <div className="h-10" />
          ) : (
            tasks.map((task) => (
              <div
                key={task._id}
                className="h-10 flex items-center px-2 text-sm border-b shrink-0"
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mr-2 shrink-0',
                    DOT_COLOR[task.priority] ?? 'bg-slate-400',
                  )}
                />
                <span className="truncate">{task.title}</span>
              </div>
            ))
          )}
        </div>

        {/* ── Scrollable day grid ── */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative">

          {/* Sticky header block */}
          <div className="sticky top-0 z-10 bg-background" style={{ minWidth: totalWidth }}>

            {/* Quarter mode: month labels row */}
            {viewMode === 'quarter' && (
              <div className="flex h-6 border-b">
                {monthSegments.map(({ label, widthPx }) => (
                  <div
                    key={label}
                    style={{ width: widthPx, minWidth: widthPx }}
                    className="flex items-center justify-center text-[11px] font-medium text-muted-foreground border-r shrink-0"
                  >
                    {label}
                  </div>
                ))}
              </div>
            )}

            {/* Day numbers row */}
            <div className="flex h-9 border-b">
              {days.map((day, i) => {
                const isToday = i === todayDayIndex;
                // Show day 1 or the number always; hide on very narrow cells
                const showLabel = DAY_WIDTH >= 18;
                return (
                  <div
                    key={i}
                    style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    className={cn(
                      'flex items-center justify-center text-[11px] border-r shrink-0 select-none',
                      isToday
                        ? 'bg-primary/10 font-bold text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    {showLabel ? day.getDate() : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task bars container */}
          <div className="relative" style={{ width: totalWidth }}>

            {/* Today column highlight */}
            {todayInView && (
              <div
                className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none z-0"
                style={{ left: todayDayIndex * DAY_WIDTH, width: DAY_WIDTH }}
              />
            )}

            {/* Day grid lines */}
            {days.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-r border-border/20 pointer-events-none"
                style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
              />
            ))}

            {/* Today vertical line */}
            {todayInView && (
              <div
                className="absolute top-0 bottom-0 w-px bg-primary/60 z-10 pointer-events-none"
                style={{ left: todayLinePx }}
              />
            )}

            {/* Empty state */}
            {tasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No tasks with dates assigned
              </div>
            ) : (
              tasks.map((task) => {
                const barStyle = getBarStyle(task);
                return (
                  <div key={task._id} className="relative h-10 border-b flex items-center z-[1]">
                    {barStyle && (
                      <div
                        className={cn(
                          'absolute h-6 rounded text-xs text-white flex items-center px-1.5',
                          'cursor-pointer truncate transition-colors z-[2]',
                          BAR_COLOR[task.priority] ?? 'bg-slate-400',
                        )}
                        style={barStyle}
                        onClick={() => setOpenTaskId(task._id)}
                        title={getBarTooltip(task)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setOpenTaskId(task._id)}
                      >
                        {task.title}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <TaskDialog
        open={!!openTaskId}
        onOpenChange={(open) => { if (!open) setOpenTaskId(undefined); }}
        mode="edit"
        taskId={openTaskId}
        projectId={projectId ?? ''}
      />
    </div>
  );
}
