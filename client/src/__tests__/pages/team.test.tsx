import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { TeamPage } from '@client/pages/team';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskStatus, TaskPriority, UserRole } from '@shared/types';
import type { ITask, IUser } from '@shared/types';

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

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => React.createElement('div', { className: props.className, onClick: props.onClick }, props.children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// ─── Test data ──────────────────────────────────────────────

const projectId = 'proj-1';

const alice: IUser = {
  _id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  role: UserRole.USER,
  active: true,
  failedAttempts: 0,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const bob: IUser = {
  _id: 'u2',
  username: 'bob',
  email: 'bob@example.com',
  role: UserRole.USER,
  active: true,
  failedAttempts: 0,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeTask(overrides: Partial<ITask>): ITask {
  return {
    _id: 'task-default',
    projectId,
    title: 'Default Task',
    status: TaskStatus.BACKLOG,
    priority: TaskPriority.MEDIUM,
    position: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const teamTasks: ITask[] = [
  makeTask({ _id: 't1', title: 'Alice Task 1', assigneeId: 'u1', assignee: alice }),
  makeTask({ _id: 't2', title: 'Alice Task 2', assigneeId: 'u1', assignee: alice }),
  makeTask({ _id: 't3', title: 'Bob Task 1', assigneeId: 'u2', assignee: bob }),
  makeTask({ _id: 't4', title: 'Unassigned Task' }),
];

// ─── Mock builders ──────────────────────────────────────────

function makeMocks(tasks: ITask[]): MockedResponse[] {
  return [
    {
      request: {
        query: TASKS_QUERY,
        variables: { projectId, includeArchived: false },
      },
      result: { data: { tasks } },
    },
  ];
}

function renderTeam(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <MemoryRouter initialEntries={[`/project/${projectId}/team`]}>
        <Routes>
          <Route
            path="/project/:projectId/team"
            element={<TeamPage />}
          />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('TeamPage', () => {
  it('renders section per assignee and Unassigned section', async () => {
    renderTeam(makeMocks(teamTasks));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'alice', level: 2 })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'bob', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows correct task count per assignee', async () => {
    renderTeam(makeMocks(teamTasks));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'alice', level: 2 })).toBeInTheDocument();
    });

    // Each section heading has a sibling Badge with the count.
    // alice = 2, bob = 1, Unassigned = 1
    const sections = screen.getAllByRole('heading', { level: 2 });

    const aliceSection = sections.find((h) => h.textContent === 'alice')!;
    const aliceContainer = aliceSection.closest('div')!;
    expect(within(aliceContainer).getByText('2')).toBeInTheDocument();

    const bobSection = sections.find((h) => h.textContent === 'bob')!;
    const bobContainer = bobSection.closest('div')!;
    expect(within(bobContainer).getByText('1')).toBeInTheDocument();

    const unassignedSection = sections.find((h) => h.textContent === 'Unassigned')!;
    const unassignedContainer = unassignedSection.closest('div')!;
    expect(within(unassignedContainer).getByText('1')).toBeInTheDocument();
  });

  it('unassigned tasks grouped correctly', async () => {
    renderTeam(makeMocks(teamTasks));

    await waitFor(() => {
      expect(screen.getByText('Unassigned Task')).toBeInTheDocument();
    });

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: TASKS_QUERY,
          variables: { projectId, includeArchived: false },
        },
        result: { data: { tasks: [] } },
        delay: Infinity,
      },
    ];

    renderTeam(mocks);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
