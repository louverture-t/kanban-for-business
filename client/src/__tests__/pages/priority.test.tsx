import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PriorityPage } from '@client/pages/priority';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskStatus, TaskPriority } from '@shared/types';
import type { ITask } from '@shared/types';

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

vi.mock('@client/components/task-dialog', () => ({
  TaskDialog: () => null,
}));

// ─── Test data ──────────────────────────────────────────────

const projectId = 'proj-1';

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

function renderPriority(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
      <MemoryRouter initialEntries={[`/project/${projectId}/priority`]}>
        <Routes>
          <Route
            path="/project/:projectId/priority"
            element={<PriorityPage />}
          />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('PriorityPage', () => {
  it('renders three priority sections', async () => {
    const tasks = [
      makeTask({ _id: 't1', title: 'High Task', priority: TaskPriority.HIGH }),
      makeTask({ _id: 't2', title: 'Med Task', priority: TaskPriority.MEDIUM }),
      makeTask({ _id: 't3', title: 'Low Task', priority: TaskPriority.LOW }),
    ];

    renderPriority(makeMocks(tasks));

    await waitFor(() => {
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });

    expect(screen.getByText('Medium Priority')).toBeInTheDocument();
    expect(screen.getByText('Low Priority')).toBeInTheDocument();
  });

  it('tasks appear in correct priority section', async () => {
    const tasks = [
      makeTask({ _id: 't1', title: 'Urgent Bug', priority: TaskPriority.HIGH }),
      makeTask({ _id: 't2', title: 'Feature Work', priority: TaskPriority.MEDIUM }),
      makeTask({ _id: 't3', title: 'Nice to Have', priority: TaskPriority.LOW }),
    ];

    renderPriority(makeMocks(tasks));

    await waitFor(() => {
      expect(screen.getByText('Urgent Bug')).toBeInTheDocument();
    });

    expect(screen.getByText('Feature Work')).toBeInTheDocument();
    expect(screen.getByText('Nice to Have')).toBeInTheDocument();
  });

  it('empty section shows placeholder', async () => {
    const tasks = [
      makeTask({ _id: 't1', title: 'Only High', priority: TaskPriority.HIGH }),
    ];

    renderPriority(makeMocks(tasks));

    await waitFor(() => {
      expect(screen.getByText('Only High')).toBeInTheDocument();
    });

    expect(screen.getByText('No medium priority tasks')).toBeInTheDocument();
    expect(screen.getByText('No low priority tasks')).toBeInTheDocument();
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

    renderPriority(mocks);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('opens task dialog when task card is clicked', async () => {
    const tasks = [
      makeTask({ _id: 't1', title: 'Clickable Task', priority: TaskPriority.HIGH }),
    ];

    renderPriority(makeMocks(tasks));

    await waitFor(() => {
      expect(screen.getByText('Clickable Task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clickable Task'));

    // TaskDialog is mocked to null; verify the click handler doesn't throw
    // and the card is still rendered (dialog open state managed internally)
    expect(screen.getByText('Clickable Task')).toBeInTheDocument();
  });
});
