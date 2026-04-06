import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';

import { TaskDialog } from '@client/components/task-dialog';
import {
  CREATE_TASK_MUTATION,
  TASK_QUERY,
  SUBTASKS_QUERY,
  COMMENTS_QUERY,
  CREATE_COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION,
  TASK_TAGS_QUERY,
  TAGS_QUERY,
  ADD_TAG_TO_TASK_MUTATION,
  REMOVE_TAG_FROM_TASK_MUTATION,
  CREATE_TAG_MUTATION,
  AUDIT_LOGS_QUERY,
  PROJECT_MEMBERS_QUERY,
  TASKS_QUERY,
} from '@client/graphql/operations';
import { TaskStatus, TaskPriority, UserRole } from '@shared/types';

// ─── UI Mocks ───────────────────────────────────────────────

// Mock Shadcn Dialog (avoids Radix portal issues in jsdom)
vi.mock('@client/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock Shadcn Select (avoids Radix portal)
vi.mock('@client/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

// Mock Shadcn Tabs
vi.mock('@client/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => <div data-tab={defaultValue}>{children}</div>,
  TabsList: ({ children, className }: any) => <div role="tablist" className={className}>{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button role="tab" data-value={value}>{children}</button>,
  TabsContent: ({ children, value }: any) => <div role="tabpanel" data-value={value}>{children}</div>,
}));

// Mock Shadcn Tooltip
vi.mock('@client/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: any) => <>{children}</>,
}));

// Mock Shadcn Separator
vi.mock('@client/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

// ─── App Mocks ──────────────────────────────────────────────

const mockUser = {
  _id: 'user-1',
  username: 'joe',
  email: 'joe@test.com',
  role: UserRole.MANAGER,
  active: true,
  failedAttempts: 0,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

vi.mock('@client/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mockUser,
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

// ─── Apollo mocks ───────────────────────────────────────────

const projectId = 'proj-1';
const taskId = 'task-1';

const editTask = {
  _id: taskId,
  projectId,
  title: 'Existing Task',
  description: 'Some description',
  status: TaskStatus.ACTIVE,
  priority: TaskPriority.HIGH,
  startDate: null,
  dueDate: null,
  assigneeId: null,
  assignee: null,
  position: 0,
  createdBy: 'user-1',
  archivedAt: null,
  completedAt: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeEditMocks(): MockedResponse[] {
  return [
    {
      request: { query: TASK_QUERY, variables: { id: taskId } },
      result: { data: { task: editTask } },
    },
    {
      request: { query: SUBTASKS_QUERY, variables: { taskId } },
      result: { data: { subtasks: [] } },
    },
    {
      request: { query: COMMENTS_QUERY, variables: { taskId } },
      result: { data: { comments: [] } },
    },
    {
      request: { query: TASK_TAGS_QUERY, variables: { taskId } },
      result: { data: { taskTags: [] } },
    },
    {
      request: { query: TAGS_QUERY },
      result: { data: { tags: [] } },
    },
    {
      request: { query: AUDIT_LOGS_QUERY, variables: { taskId } },
      result: { data: { auditLogs: [] } },
    },
    {
      request: { query: PROJECT_MEMBERS_QUERY, variables: { projectId } },
      result: { data: { projectMembers: [] } },
    },
  ];
}

function makeCreateMocks(): MockedResponse[] {
  return [
    {
      request: { query: PROJECT_MEMBERS_QUERY, variables: { projectId } },
      result: { data: { projectMembers: [] } },
    },
  ];
}

function renderDialog(
  mode: 'create' | 'edit',
  extraMocks: MockedResponse[] = [],
) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const mocks =
    mode === 'edit'
      ? [...makeEditMocks(), ...extraMocks]
      : [...makeCreateMocks(), ...extraMocks];

  const result = render(
    <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
      <TaskDialog
        open={true}
        onOpenChange={onOpenChange}
        mode={mode}
        taskId={mode === 'edit' ? taskId : undefined}
        projectId={projectId}
        onSuccess={onSuccess}
      />
    </MockedProvider>,
  );

  return { ...result, onOpenChange, onSuccess };
}

// ─── Tests ──────────────────────────────────────────────────

describe('TaskDialog', () => {
  describe('create mode', () => {
    it('shows "New Task" title', () => {
      renderDialog('create');
      expect(screen.getByText('New Task')).toBeInTheDocument();
    });

    it('shows only the Details form (no tabs)', () => {
      renderDialog('create');

      // Details form fields should be present
      expect(screen.getByLabelText('Title *')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();

      // Tabs for edit-only sections should NOT be present
      expect(screen.queryByRole('tab', { name: /subtasks/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /comments/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /tags/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /activity/i })).not.toBeInTheDocument();
    });

    it('shows "Create Task" button', () => {
      renderDialog('create');
      expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
    });

    it('submits form with correct values', async () => {
      const user = userEvent.setup();
      const createMutationMock: MockedResponse = {
        request: {
          query: CREATE_TASK_MUTATION,
          variables: {
            input: {
              projectId,
              title: 'New Feature',
              description: undefined,
              status: TaskStatus.BACKLOG,
              priority: TaskPriority.MEDIUM,
              assigneeId: undefined,
              startDate: undefined,
              dueDate: undefined,
            },
          },
        },
        result: {
          data: {
            createTask: {
              _id: 'new-1',
              projectId,
              title: 'New Feature',
              description: null,
              status: TaskStatus.BACKLOG,
              priority: TaskPriority.MEDIUM,
              startDate: null,
              dueDate: null,
              assigneeId: null,
              position: 0,
              createdAt: '2026-01-01T00:00:00Z',
            },
          },
        },
      };

      const refetchMock: MockedResponse = {
        request: {
          query: TASKS_QUERY,
          variables: { projectId },
        },
        result: { data: { tasks: [] } },
      };

      const { onOpenChange } = renderDialog('create', [
        createMutationMock,
        refetchMock,
      ]);

      const titleInput = screen.getByLabelText('Title *');
      await user.type(titleInput, 'New Feature');
      await user.click(screen.getByRole('button', { name: /create task/i }));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('shows toast error when title is empty on submit', async () => {
      const { toast: mockToast } = await import('@client/hooks/use-toast');
      const user = userEvent.setup();

      renderDialog('create');

      await user.click(screen.getByRole('button', { name: /create task/i }));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Title is required',
          variant: 'destructive',
        }),
      );
    });
  });

  describe('edit mode', () => {
    it('shows "Edit Task" title', async () => {
      renderDialog('edit');

      await waitFor(() => {
        expect(screen.getByText('Edit Task')).toBeInTheDocument();
      });
    });

    it('shows all tabs: Details, Subtasks, Comments, Tags, Activity', async () => {
      renderDialog('edit');

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /subtasks/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /comments/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tags/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
    });

    it('shows "Save Changes" and "Move to Trash" buttons', async () => {
      renderDialog('edit');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /move to trash/i })).toBeInTheDocument();
    });

    it('populates form with existing task data', async () => {
      renderDialog('edit');

      await waitFor(() => {
        expect(screen.getByLabelText('Title *')).toHaveValue('Existing Task');
      });

      expect(screen.getByLabelText('Description')).toHaveValue('Some description');
    });

    describe('activity tab', () => {
      it('renders audit log entries with action and actor', async () => {
        const log = {
          _id: 'log-1',
          taskId,
          action: 'created task',
          userId: 'user-1',
          userName: 'joe',
          changes: null,
          createdAt: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago
        };

        const mocks = makeEditMocks().map((m) =>
          m.request.query === AUDIT_LOGS_QUERY
            ? { ...m, result: { data: { auditLogs: [log] } } }
            : m,
        );

        render(
          <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
            <TaskDialog open={true} onOpenChange={vi.fn()} mode="edit" taskId={taskId} projectId={projectId} />
          </MockedProvider>,
        );

        await waitFor(() => {
          expect(screen.getByText('joe')).toBeInTheDocument();
        });
        expect(screen.getByText('created task')).toBeInTheDocument();
        // relative time rendered
        expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
      });

      it('renders changes summary when available', async () => {
        const log = {
          _id: 'log-2',
          taskId,
          action: 'updated task',
          userId: 'user-1',
          userName: 'joe',
          changes: 'status: BACKLOG → ACTIVE',
          createdAt: new Date().toISOString(),
        };

        const mocks = makeEditMocks().map((m) =>
          m.request.query === AUDIT_LOGS_QUERY
            ? { ...m, result: { data: { auditLogs: [log] } } }
            : m,
        );

        render(
          <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
            <TaskDialog open={true} onOpenChange={vi.fn()} mode="edit" taskId={taskId} projectId={projectId} />
          </MockedProvider>,
        );

        await waitFor(() => {
          expect(screen.getByText('status: BACKLOG → ACTIVE')).toBeInTheDocument();
        });
      });

      it('shows empty state when no logs', async () => {
        renderDialog('edit');

        await waitFor(() => {
          expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
        });
      });
    });

    describe('comments tab', () => {
      it('renders existing comments with author name and content', async () => {
        const comment = {
          _id: 'c-1',
          taskId,
          content: 'Great progress!',
          authorId: 'user-1',
          author: { _id: 'user-1', username: 'joe' },
          createdAt: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago
        };

        const mocks = [
          ...makeEditMocks().map((m) =>
            m.request.query === COMMENTS_QUERY
              ? { ...m, result: { data: { comments: [comment] } } }
              : m,
          ),
        ];

        render(
          <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
            <TaskDialog
              open={true}
              onOpenChange={vi.fn()}
              mode="edit"
              taskId={taskId}
              projectId={projectId}
            />
          </MockedProvider>,
        );

        await waitFor(() => {
          expect(screen.getByText('joe')).toBeInTheDocument();
        });
        expect(screen.getByText('Great progress!')).toBeInTheDocument();
        // relative time rendered (some form of "ago" or "just now")
        expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
      });

      it('shows delete button for own comment', async () => {
        const comment = {
          _id: 'c-1',
          taskId,
          content: 'My comment',
          authorId: 'user-1', // same as mockUser._id
          author: { _id: 'user-1', username: 'joe' },
          createdAt: new Date().toISOString(),
        };

        const mocks = [
          ...makeEditMocks().map((m) =>
            m.request.query === COMMENTS_QUERY
              ? { ...m, result: { data: { comments: [comment] } } }
              : m,
          ),
        ];

        render(
          <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
            <TaskDialog
              open={true}
              onOpenChange={vi.fn()}
              mode="edit"
              taskId={taskId}
              projectId={projectId}
            />
          </MockedProvider>,
        );

        await waitFor(() => {
          expect(screen.getByText('My comment')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
      });

      it('shows delete button for Manager+ on others comments', async () => {
        const comment = {
          _id: 'c-2',
          taskId,
          content: 'Other user comment',
          authorId: 'other-user', // different user
          author: { _id: 'other-user', username: 'alice' },
          createdAt: new Date().toISOString(),
        };

        const mocks = [
          ...makeEditMocks().map((m) =>
            m.request.query === COMMENTS_QUERY
              ? { ...m, result: { data: { comments: [comment] } } }
              : m,
          ),
        ];

        render(
          <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
            <TaskDialog
              open={true}
              onOpenChange={vi.fn()}
              mode="edit"
              taskId={taskId}
              projectId={projectId}
            />
          </MockedProvider>,
        );

        // mockUser is MANAGER (isManagerOrAbove=true), so delete button should appear
        await waitFor(() => {
          expect(screen.getByText('Other user comment')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
      });

      it('renders textarea for adding comments', async () => {
        renderDialog('edit');

        await waitFor(() => {
          expect(screen.getByPlaceholderText(/write a comment/i)).toBeInTheDocument();
        });

        // Should be a textarea element
        const commentInput = screen.getByPlaceholderText(/write a comment/i);
        expect(commentInput.tagName.toLowerCase()).toBe('textarea');
      });

      it('submits new comment via CREATE_COMMENT_MUTATION', async () => {
        const { within } = await import('@testing-library/react');
        const user = userEvent.setup();

        const commentMutationMock: MockedResponse = {
          request: {
            query: CREATE_COMMENT_MUTATION,
            variables: { taskId, content: 'Hello world' },
          },
          result: {
            data: {
              createComment: {
                _id: 'c-new',
                taskId,
                content: 'Hello world',
                authorId: 'user-1',
                author: { _id: 'user-1', username: 'joe' },
                createdAt: new Date().toISOString(),
              },
            },
          },
        };

        const refetchMock: MockedResponse = {
          request: { query: COMMENTS_QUERY, variables: { taskId } },
          result: { data: { comments: [] } },
        };

        renderDialog('edit', [commentMutationMock, refetchMock]);

        const textarea = await screen.findByPlaceholderText(/write a comment/i);
        await user.type(textarea, 'Hello world');

        // The send button has no text label — find it inside the same flex container as the textarea
        const sendButton = within(textarea.closest('div') as HTMLElement).getByRole('button');
        await user.click(sendButton);

        await waitFor(() => {
          expect(screen.getByPlaceholderText(/write a comment/i)).toHaveValue('');
        });
      });
    });
  });
});
