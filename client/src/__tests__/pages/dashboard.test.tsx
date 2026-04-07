import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '@client/pages/dashboard';
import { PROJECTS_QUERY, TASKS_QUERY, FOLDERS_QUERY } from '@client/graphql/operations';
import { TaskStatus, TaskPriority, ProjectStatus } from '@shared/types';
import type { ITask, IProject, IProjectFolder } from '@shared/types';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('@client/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { _id: 'user-1', username: 'joe', role: 'manager' },
    isManagerOrAbove: true,
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
  return [
    {
      request: { query: PROJECTS_QUERY },
      result: { data: { projects } },
    },
    {
      request: { query: TASKS_QUERY, variables: { includeArchived: false } },
      result: { data: { tasks } },
    },
    {
      request: { query: FOLDERS_QUERY },
      result: { data: { folders } },
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

    // Wait for all three queries (projects + tasks + folders) to settle.
    // Using 'Clinical' as the sentinel because it comes from FOLDERS_QUERY,
    // which is the last to arrive when the loading gate passes early on tasks.
    await waitFor(() => {
      expect(screen.getByText('Project Progress')).toBeInTheDocument();
      expect(screen.getByText('Clinical')).toBeInTheDocument();
      expect(screen.getByText('Project One')).toBeInTheDocument();
      expect(screen.getByText('Project Two')).toBeInTheDocument();
      // Project One: 1 complete / 2 total → "1/2 tasks"
      expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
      // Project Two: 0 complete / 2 total → "0/2 tasks"
      expect(screen.getByText('0/2 tasks')).toBeInTheDocument();
    });
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
});
