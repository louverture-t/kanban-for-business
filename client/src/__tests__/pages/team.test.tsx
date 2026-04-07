import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { TeamPage } from '@client/pages/team';
import { TASKS_QUERY, PROJECT_MEMBERS_QUERY } from '@client/graphql/operations';
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

vi.mock('@client/components/task-dialog', () => ({ TaskDialog: () => null }));

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

const mockProjectMembers = [
  { _id: 'pm1', projectId, userId: 'u1', user: { _id: 'u1', username: 'alice' }, addedAt: '2026-01-01T00:00:00Z' },
  { _id: 'pm2', projectId, userId: 'u2', user: { _id: 'u2', username: 'bob' }, addedAt: '2026-01-01T00:00:00Z' },
];

// ─── Mock builders ──────────────────────────────────────────

function makeMocks(tasks: ITask[], members = mockProjectMembers): MockedResponse[] {
  return [
    {
      request: {
        query: TASKS_QUERY,
        variables: { projectId, includeArchived: false },
      },
      result: { data: { tasks } },
    },
    {
      request: {
        query: PROJECT_MEMBERS_QUERY,
        variables: { projectId },
      },
      result: { data: { projectMembers: members } },
    },
  ];
}

function renderTeam(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
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
      {
        request: {
          query: PROJECT_MEMBERS_QUERY,
          variables: { projectId },
        },
        result: { data: { projectMembers: [] } },
        delay: Infinity,
      },
    ];

    renderTeam(mocks);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows avatar circle with initial in section header', async () => {
    renderTeam(makeMocks(teamTasks));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'alice', level: 2 })).toBeInTheDocument();
    });

    // Avatar span with initial 'A' for alice
    const avatarSpans = screen.getAllByText('A');
    expect(avatarSpans.length).toBeGreaterThan(0);
    // The avatar span should have rounded-full in its class
    const avatarEl = avatarSpans.find((el) => el.classList.contains('rounded-full'));
    expect(avatarEl).toBeInTheDocument();
  });

  it('shows amber warning badge when unassigned count > 5', async () => {
    const manyUnassigned = Array.from({ length: 6 }, (_, i) =>
      makeTask({ _id: `u-task-${i}`, title: `Unassigned ${i}` }),
    );

    renderTeam(makeMocks(manyUnassigned, []));

    await waitFor(() => {
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    const unassignedHeading = screen.getByRole('heading', { name: 'Unassigned', level: 2 });
    const container = unassignedHeading.closest('div')!;
    const badge = within(container).getByText('6');
    expect(badge).toBeInTheDocument();
    // Amber badge should have the amber background class
    expect(badge.className).toMatch(/amber/);
  });

  it('shows destructive badge when unassigned count > 10', async () => {
    const manyUnassigned = Array.from({ length: 11 }, (_, i) =>
      makeTask({ _id: `u-task-${i}`, title: `Unassigned ${i}` }),
    );

    renderTeam(makeMocks(manyUnassigned, []));

    await waitFor(() => {
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    const unassignedHeading = screen.getByRole('heading', { name: 'Unassigned', level: 2 });
    const container = unassignedHeading.closest('div')!;
    const badge = within(container).getByText('11');
    expect(badge).toBeInTheDocument();
    // Destructive variant adds destructive classes
    expect(badge.className).toMatch(/destructive/);
  });

  it('opens task dialog when task card is clicked', async () => {
    renderTeam(makeMocks(teamTasks));

    await waitFor(() => {
      expect(screen.getByText('Alice Task 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Alice Task 1'));
    // TaskDialog is mocked to null — just verify click doesn't throw
    // and the component stays rendered
    expect(screen.getByText('Team View')).toBeInTheDocument();
  });

  it('shows members with zero tasks when projectMembers returns extra members', async () => {
    const charlie = { _id: 'pm3', projectId, userId: 'u3', user: { _id: 'u3', username: 'charlie' }, addedAt: '2026-01-01T00:00:00Z' };
    const extendedMembers = [...mockProjectMembers, charlie];

    renderTeam(makeMocks(teamTasks, extendedMembers));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'charlie', level: 2 })).toBeInTheDocument();
    });

    const charlieHeading = screen.getByRole('heading', { name: 'charlie', level: 2 });
    const container = charlieHeading.closest('div')!;
    expect(within(container).getByText('0')).toBeInTheDocument();
  });
});
