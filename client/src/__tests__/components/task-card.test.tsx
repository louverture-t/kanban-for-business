import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskCard } from '@client/components/task-card';
import type { ITask } from '@shared/types';
import { TaskStatus, TaskPriority } from '@shared/types';

// Framer Motion: render as plain divs in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function makeTask(overrides: Partial<ITask> = {}): ITask {
  return {
    _id: 'task-1',
    projectId: 'proj-1',
    title: 'Fix login bug',
    status: TaskStatus.ACTIVE,
    priority: TaskPriority.HIGH,
    position: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TaskCard', () => {
  it('renders title and priority badge', () => {
    render(<TaskCard task={makeTask()} />);

    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders medium and low priority badges', () => {
    const { rerender } = render(
      <TaskCard task={makeTask({ priority: TaskPriority.MEDIUM })} />,
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(<TaskCard task={makeTask({ priority: TaskPriority.LOW })} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders assignee name and avatar initial', () => {
    render(
      <TaskCard
        task={makeTask({
          assignee: {
            _id: 'user-1',
            username: 'joe',
            role: 'manager' as any,
            active: true,
            failedAttempts: 0,
            mustChangePassword: false,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        })}
      />,
    );

    expect(screen.getByText('joe')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('shows "Archived" badge when archivedAt is set', () => {
    render(
      <TaskCard task={makeTask({ archivedAt: '2026-03-01T00:00:00Z' })} />,
    );

    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('does not show "Archived" badge when archivedAt is not set', () => {
    render(<TaskCard task={makeTask()} />);

    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  });

  it('shows overdue styling when dueDate is in the past', () => {
    render(
      <TaskCard task={makeTask({ dueDate: '2020-06-15T12:00:00Z' })} />,
    );

    // The date span containing the formatted date should have red overdue class
    const dateEl = screen.getByText(/Jun/);
    expect(dateEl.className).toMatch(/text-red/);
  });

  it('does not show overdue styling when task is completed', () => {
    render(
      <TaskCard
        task={makeTask({
          dueDate: '2020-06-15T12:00:00Z',
          completedAt: '2020-06-16T12:00:00Z',
        })}
      />,
    );

    const dateEl = screen.getByText(/Jun/);
    expect(dateEl.className).not.toMatch(/text-red/);
  });

  it('renders subtask count when provided', () => {
    render(
      <TaskCard task={makeTask()} subtaskTotal={5} subtaskCompleted={3} />,
    );

    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('does not render subtask count when total is 0', () => {
    render(<TaskCard task={makeTask()} subtaskTotal={0} />);

    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<TaskCard task={makeTask()} onClick={handleClick} />);

    await user.click(screen.getByText('Fix login bug'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('shows trash countdown when showTrashCountdown and deletedAt are set', () => {
    // Deleted "now" — should show ~7d left
    const now = new Date().toISOString();
    render(
      <TaskCard
        task={makeTask({ deletedAt: now })}
        showTrashCountdown
      />,
    );

    expect(screen.getByText(/Deleted \d+d ago — \d+d until purge/)).toBeInTheDocument();
  });
});
