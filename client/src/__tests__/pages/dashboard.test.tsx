import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '@client/pages/dashboard';
import { PROJECTS_QUERY, TASKS_QUERY, FOLDERS_QUERY } from '@client/graphql/operations';
import { TaskStatus, TaskPriority, ProjectStatus } from '@shared/types';
import type { ITask, IProject, IProjectFolder } from '@shared/types';

// ─── Mocks ──────────────────────────────────────────────────

let mockIsManagerOrAbove = true;

vi.mock('@client/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { _id: 'user-1', username: 'joe', role: mockIsManagerOrAbove ? 'manager' : 'user' },
    isManagerOrAbove: mockIsManagerOrAbove,
    isSuperadmin: false,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refetchUser: vi.fn(),
  }),
}));

vi.mock('@client/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => React.createElement('div', { className: props.className, onClick: props.onClick }, props.children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@client/components/task-dialog', () => ({ TaskDialog: () => null }));
vi.mock('@client/components/project-dialog', () => ({ ProjectDialog: () => null }));

vi.mock('@client/components/task-card', () => ({
  TaskCard: ({ task }: { task: ITask }) =>
    React.createElement('div', { 'data-testid': `task-card-${task._id}` }, task.title),
}));

// Mock recharts — jsdom can't render SVG charts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  PieChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// ─── Test data ──────────────────────────────────────────────

function makeTask(overrides: Partial<ITask>): ITask {
  return {
    _id: 'task-default',
    projectId: 'proj-1',
    title: 'Default Task',
    status: TaskStatus.BACKLOG,
    priority: TaskPriority.MEDIUM,
    position: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const sampleTasks: ITask[] = [
  makeTask({ _id: 't1', title: 'Task Alpha', projectId: 'proj-1', status: TaskStatus.ACTIVE, priority: TaskPriority.HIGH }),
  makeTask({ _id: 't2', title: 'Task Beta', projectId: 'proj-1', status: TaskStatus.COMPLETE, priority: TaskPriority.MEDIUM }),
  makeTask({ _id: 't3', title: 'Task Gamma', projectId: 'proj-2', status: TaskStatus.BACKLOG, priority: TaskPriority.LOW }),
  makeTask({ _id: 't4', title: 'Task Delta', projectId: 'proj-2', status: TaskStatus.ACTIVE, priority: TaskPriority.HIGH }),
];

const sampleProjects: IProject[] = [
  {
    _id: 'proj-1',
    name: 'Project One',
    status: ProjectStatus.ACTIVE,
    color: '#3b82f6',
    folderId: 'folder-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    _id: 'proj-2',
    name: 'Project Two',
    status: ProjectStatus.ACTIVE,
    color: '#10b981',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const sampleFolders: IProjectFolder[] = [
  { _id: 'folder-1', name: 'Clinical', color: '#3b82f6', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
];

// ─── Mock builders ──────────────────────────────────────────

function makeMocks(
  tasks: ITask[] = sampleTasks,
  projects: IProject[] = sampleProjects,
  folders: IProjectFolder[] = sampleFolders,
): MockedResponse[] {
  // delay: 0 overrides Apollo Client v4's default realisticDelay (20–50ms random).
  // All three responses resolve via setTimeout(fn, 0) — the same macrotask queue
  // tick — so a single act(async () => { await setTimeout(0) }) drains them all.
  return [
    {
      request: { query: PROJECTS_QUERY },
      result: { data: { projects } },
      delay: 0,
    },
    {
      request: { query: TASKS_QUERY, variables: { includeArchived: false } },
      result: { data: { tasks } },
      delay: 0,
    },
    {
      request: { query: FOLDERS_QUERY },
      result: { data: { folders } },
      delay: 0,
    },
  ];
}

function renderDashboard(mocks: MockedResponse[] = makeMocks()) {
  return render(
    <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('DashboardPage', () => {
  afterEach(() => {
    mockIsManagerOrAbove = true;
  });

  it('shows loading state while queries are in flight', () => {
    const mocks = makeMocks().map((m) => ({ ...m, delay: Infinity }));
    renderDashboard(mocks);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('renders stat cards with correct counts', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // 4 tasks total, 1 complete, 2 active, 0 overdue (no dueDate set)
    expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();

    // Stat values — use role="button" cards to scope assertions
    const buttons = screen.getAllByRole('button');
    const statCards = buttons.filter((b) => b.getAttribute('aria-pressed') !== null);
    expect(statCards).toHaveLength(4);

    // Total count = 4, Completed = 1, Active = 2, Overdue = 0
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders progress bar section with correct project progress', async () => {
    renderDashboard();

    // Apollo MockedProvider delivers each response via setTimeout(fn, 0).
    // Awaiting a single setTimeout(0) inside act() drains all three pending
    // query callbacks in one batch — deterministic, no retry-lottery needed.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('Project Progress')).toBeInTheDocument();
    expect(screen.getByText('Clinical')).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
    // Project One is in "Clinical" folder → renders "{completed}/{total}" (no "tasks" suffix)
    expect(screen.getByText('1/2')).toBeInTheDocument();
    // Project Two is in "No Folder" section → renders "{completed}/{total} tasks"
    expect(screen.getByText('0/2 tasks')).toBeInTheDocument();
  });

  it('renders folder sections with project progress bars', async () => {
    renderDashboard();

    // All assertions inside waitFor so the retry loop catches folder data arriving
    // after the tasks query settles (which unblocks the loading gate).
    await waitFor(() => {
      expect(screen.getByText('Clinical')).toBeInTheDocument();
      // Folder count indicator
      expect(screen.getAllByText('(1 projects)').length).toBeGreaterThan(0);
      // No Folder section should contain Project Two (no folderId)
      expect(screen.getByText('No Folder')).toBeInTheDocument();
    });
  });

  it('renders chart section titles', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Status Distribution')).toBeInTheDocument();
      expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
    });
  });

  it('shows "No tasks yet" when there are no tasks for status chart', async () => {
    const emptyMocks = makeMocks([], sampleProjects, sampleFolders);
    renderDashboard(emptyMocks);

    await waitFor(() => {
      expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    });
  });

  it('shows top priority tasks section heading', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Top Priority Tasks')).toBeInTheDocument();
    });
  });

  it('clicking a stat card filters the task list and toggles aria-pressed', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Wait for data to settle
    await waitFor(() => {
      expect(screen.getByText('Top Priority Tasks')).toBeInTheDocument();
    });

    // Default view: non-complete tasks shown; Task Beta (complete) is absent
    expect(screen.queryByTestId('task-card-t2')).not.toBeInTheDocument();

    // "Completed" stat card starts unpressed
    const completedCard = screen.getByRole('button', { name: /Completed/i });
    expect(completedCard).toHaveAttribute('aria-pressed', 'false');

    // Click to activate the "complete" filter
    await user.click(completedCard);

    // aria-pressed flips to true
    expect(completedCard).toHaveAttribute('aria-pressed', 'true');

    // Only the complete task (Task Beta) appears; active tasks are gone
    expect(screen.getByTestId('task-card-t2')).toBeInTheDocument();
    expect(screen.queryByTestId('task-card-t1')).not.toBeInTheDocument();

    // "Clear filter" button becomes visible
    expect(screen.getByRole('button', { name: /clear filter/i })).toBeInTheDocument();

    // Click the same card again to deselect
    await user.click(completedCard);
    expect(completedCard).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Top Priority Tasks')).toBeInTheDocument();
  });

  it('shows empty state when Overdue filter is active and no tasks have a due date', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Wait for data to settle — sampleTasks have no dueDate, so overdue count = 0
    await waitFor(() => {
      expect(screen.getByText('Top Priority Tasks')).toBeInTheDocument();
    });

    const overdueCard = screen.getByRole('button', { name: /Overdue/i });
    await user.click(overdueCard);

    // Section heading changes to reflect active filter
    expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();

    // No task cards — all sampleTasks lack dueDate so none qualify
    expect(screen.getByText('No tasks to display.')).toBeInTheDocument();
  });

  describe('RBAC visibility', () => {
    it('shows New Folder and New Project buttons for Manager+', async () => {
      mockIsManagerOrAbove = true;
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new folder/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();
    });

    it('hides New Folder and New Project buttons for regular User', async () => {
      mockIsManagerOrAbove = false;
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Project Progress')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /new folder/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument();
    });

    it('hides folder edit and delete buttons for regular User', async () => {
      mockIsManagerOrAbove = false;
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Clinical')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /edit folder clinical/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete folder clinical/i })).not.toBeInTheDocument();
    });

    it('hides project edit and delete buttons for regular User', async () => {
      mockIsManagerOrAbove = false;
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Project One')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /edit project project one/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete project project one/i })).not.toBeInTheDocument();
    });

    it('shows folder edit and delete buttons for Manager+', async () => {
      mockIsManagerOrAbove = true;
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit folder clinical/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /delete folder clinical/i })).toBeInTheDocument();
    });

    it('shows project edit and delete buttons for Manager+', async () => {
      mockIsManagerOrAbove = true;
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit project project one/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /delete project project one/i })).toBeInTheDocument();
    });
  });
});
