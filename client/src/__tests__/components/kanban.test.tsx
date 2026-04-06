import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import KanbanPage from '@client/pages/kanban';
import {
  TASKS_QUERY,
  ARCHIVE_SWEEP_MUTATION,
} from '@client/graphql/operations';
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

vi.mock('@client/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() }),
}));

vi.mock('@client/components/task-dialog', () => ({
  TaskDialog: () => null,
}));

vi.mock('@client/components/task-card', () => {
  const R = require('react');
  return {
    TaskCard: ({ task, onClick }: any) =>
      R.createElement('div', { 'data-testid': `task-${task._id}`, onClick }, task.title),
  };
});

vi.mock('@hello-pangea/dnd', () => {
  const R = require('react');
  return {
    DragDropContext: ({ children }: any) => R.createElement('div', null, children),
    Droppable: ({ children, droppableId }: any) =>
      R.createElement(
        'div',
        { 'data-droppable': droppableId },
        children(
          { innerRef: () => {}, droppableProps: {}, placeholder: null },
          { isDraggingOver: false },
        ),
      ),
    Draggable: ({ children, draggableId }: any) =>
      R.createElement(
        'div',
        { 'data-draggable': draggableId },
        children(
          { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
          { isDragging: false },
        ),
      ),
  };
});

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

const sampleTasks: ITask[] = [
  makeTask({ _id: 't1', title: 'Backlog Task 1', status: TaskStatus.BACKLOG, position: 0 }),
  makeTask({ _id: 't2', title: 'Backlog Task 2', status: TaskStatus.BACKLOG, position: 1 }),
  makeTask({ _id: 't3', title: 'Active Task', status: TaskStatus.ACTIVE, position: 0 }),
  makeTask({ _id: 't4', title: 'Review Task', status: TaskStatus.REVIEW, position: 0 }),
  makeTask({ _id: 't5', title: 'Complete Task', status: TaskStatus.COMPLETE, position: 0 }),
];

const archivedTask = makeTask({
  _id: 't6',
  title: 'Archived Task',
  status: TaskStatus.COMPLETE,
  position: 1,
  archivedAt: '2026-03-01T00:00:00Z',
});

// ─── Mock builders ──────────────────────────────────────────

function makeBaseMocks(tasks: ITask[] = sampleTasks): MockedResponse[] {
  return [
    {
      request: {
        query: TASKS_QUERY,
        variables: { projectId, includeArchived: false },
      },
      result: { data: { tasks } },
    },
    {
      request: { query: ARCHIVE_SWEEP_MUTATION },
      result: { data: { archiveSweep: 0 } },
    },
  ];
}

function renderKanban(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <MemoryRouter initialEntries={[`/projects/${projectId}/kanban`]}>
        <Routes>
          <Route
            path="/projects/:projectId/kanban"
            element={<KanbanPage />}
          />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('KanbanPage', () => {
  it('renders four columns with correct headers', async () => {
    renderKanban(makeBaseMocks());

    await waitFor(() => {
      expect(screen.getByText('Backlog')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('renders task count badges for each column', async () => {
    renderKanban(makeBaseMocks());

    await waitFor(() => {
      expect(screen.getByText('Backlog')).toBeInTheDocument();
    });

    // Backlog has 2, Active 1, Review 1, Complete 1
    const badges = screen.getAllByText(/^[0-2]$/);
    expect(badges.length).toBeGreaterThanOrEqual(4);
  });

  it('places tasks in correct columns based on status', async () => {
    renderKanban(makeBaseMocks());

    await waitFor(() => {
      expect(screen.getByText('Backlog Task 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Backlog Task 2')).toBeInTheDocument();
    expect(screen.getByText('Active Task')).toBeInTheDocument();
    expect(screen.getByText('Review Task')).toBeInTheDocument();
    expect(screen.getByText('Complete Task')).toBeInTheDocument();
  });

  it('shows "Show Archived" button and toggles archived tasks', async () => {
    const user = userEvent.setup();

    const mocks: MockedResponse[] = [
      ...makeBaseMocks(),
      {
        request: {
          query: TASKS_QUERY,
          variables: { projectId, includeArchived: true },
        },
        result: { data: { tasks: [...sampleTasks, archivedTask] } },
      },
    ];

    renderKanban(mocks);

    await waitFor(() => {
      expect(screen.getByText('Backlog Task 1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Archived Task')).not.toBeInTheDocument();

    const archiveBtn = screen.getByRole('button', { name: /show archived/i });
    await user.click(archiveBtn);

    await waitFor(() => {
      expect(screen.getByText('Archived Task')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /hide archived/i })).toBeInTheDocument();
  });

  it('shows "Show Trash" button', async () => {
    renderKanban(makeBaseMocks());

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show trash/i })).toBeInTheDocument();
    });
  });

  it('renders "Kanban Board" heading', async () => {
    renderKanban(makeBaseMocks());

    await waitFor(() => {
      expect(screen.getByText('Kanban Board')).toBeInTheDocument();
    });
  });
});
