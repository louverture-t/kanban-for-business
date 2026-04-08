/**
 * SearchCommand — Global Ctrl+K / Cmd+K search dialog
 *
 * Usage: Mount once inside ProtectedRoute (App.tsx).
 * The keyboard listener is document-level so it works from any page.
 *
 * <SearchCommand />
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { useLazyQuery } from '@apollo/client/react';
import { Search, X } from 'lucide-react';
import { cn } from '@client/lib/utils';
import { SEARCH_TASKS_QUERY } from '@client/graphql/operations';
import { TaskStatus } from '@shared/types';

// ─── Local search result shape (subset of ITask with project) ────────────────

interface SearchTask {
  _id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  archivedAt?: string | null;
  project?: {
    _id: string;
    name: string;
    color: string;
  };
}

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: 'bg-gray-100 text-gray-700 border-gray-200',
  [TaskStatus.ACTIVE]: 'bg-blue-100 text-blue-700 border-blue-200',
  [TaskStatus.REVIEW]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [TaskStatus.COMPLETE]: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: 'Backlog',
  [TaskStatus.ACTIVE]: 'Active',
  [TaskStatus.REVIEW]: 'Review',
  [TaskStatus.COMPLETE]: 'Complete',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchCommand() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Debounce input → debouncedQuery (300 ms) ──────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // ── Apollo lazy query ─────────────────────────────────────────────────────
  const [runSearch, { data, loading, error }] = useLazyQuery<{
    searchTasks: SearchTask[];
  }>(SEARCH_TASKS_QUERY, { fetchPolicy: 'network-only' });

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      runSearch({ variables: { query: debouncedQuery } });
    }
  }, [debouncedQuery, runSearch]);

  const results: SearchTask[] = data?.searchTasks ?? [];

  // ── Global Ctrl+K / Cmd+K listener ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Sidebar button trigger (open-search custom event) ────────────────────
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('open-search', handler);
    return () => document.removeEventListener('open-search', handler);
  }, []);

  // ── Reset state on close ─────────────────────────────────────────────────
  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (!value) {
      setInputValue('');
      setDebouncedQuery('');
    }
  }, []);

  // ── Focus trap ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // ── Navigate on result select ─────────────────────────────────────────────
  const handleSelect = useCallback(
    (task: SearchTask) => {
      navigate(`/project/${task.projectId}/kanban`);
      handleOpenChange(false);
    },
    [navigate, handleOpenChange],
  );

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={() => handleOpenChange(false)}
    >
      {/* Dialog panel — stop clicks propagating to backdrop */}
      <div
        ref={dialogRef}
        className="w-full max-w-xl mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global task search"
      >
        <Command
          shouldFilter={false}
          className="flex flex-col"
        >
          {/* Input row */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <Command.Input
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="Search tasks..."
              autoFocus
              className={cn(
                'flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
                'outline-none border-none focus:ring-0',
              )}
              aria-label="Search tasks"
            />
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <Command.List className="max-h-80 overflow-y-auto py-2">
            {/* Loading state */}
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div
                role="alert"
                className="px-4 py-6 text-center text-sm text-destructive"
              >
                Search failed. Please try again.
              </div>
            )}

            {/* Prompt when query is too short */}
            {!loading && !error && debouncedQuery.length < 2 && inputValue.length > 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && debouncedQuery.length >= 2 && results.length === 0 && (
              <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
                No tasks found for &quot;{debouncedQuery}&quot;
              </Command.Empty>
            )}

            {/* Initial idle state */}
            {!loading && !error && inputValue.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Start typing to search tasks across all projects
              </div>
            )}

            {/* Results */}
            {!loading && !error && results.length > 0 && (
              <Command.Group heading="Tasks" className="px-2">
                {results.map((task) => (
                  <Command.Item
                    key={task._id}
                    value={task._id}
                    onSelect={() => handleSelect(task)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
                      'text-sm text-foreground',
                      'hover:bg-accent hover:text-accent-foreground',
                      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                      'transition-colors',
                    )}
                    aria-label={`Go to task: ${task.title}`}
                  >
                    {/* Project color dot */}
                    <span
                      className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: task.project?.color ?? '#6b7280' }}
                      aria-hidden="true"
                    />

                    {/* Title + badges */}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium leading-snug">
                        {task.title}
                      </span>
                      {task.project && (
                        <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                          {task.project.name}
                        </span>
                      )}
                    </span>

                    {/* Status + archived badges */}
                    <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                          STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-700 border-gray-200',
                        )}
                      >
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                      {task.archivedAt && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Archived
                        </span>
                      )}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↵</kbd>
              open
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
