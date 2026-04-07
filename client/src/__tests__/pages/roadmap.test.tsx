import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { RoadmapPage } from '@client/pages/roadmap';
import { TASKS_QUERY } from '@client/graphql/operations';
import { TaskStatus, TaskPriority } from '@shared/types';
import type { ITask } from '@shared/types';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => React.createElement('div', { className: props.className, onClick: props.onClick }, props.children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@client/components/task-dialog', () => ({ TaskDialog: () => null }));

// ─── Test data ──────────────────────────────────────────────

const projectId = 'proj-roadmap';

// Dates in April 2026 — current month at time of writing (2026-04-06)
// Using local midnight timestamps so bar positioning matches component's own calculations
const APR_5_MS  = String(new Date(2026, 3, 5).getTime());   // April 5
const APR_15_MS = String(new Date(2026, 3, 15).getTime());  // April 15
const APR_20_MS = String(new Date(2026, 3, 20).getTime());  // April 20
const APR_25_MS = String(new Date(2026, 3, 25).getTime());  // April 25

// Far-future month — task should NOT appear in current month view
const JUL_1_MS = String(new Date(2026, 6, 1).getTime());

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

const visibleTasks: ITask[] = [
  makeTask({ _id: 't1', title: 'Bar Task Alpha', startDate: APR_5_MS, dueDate: APR_15_MS, priority: TaskPriority.HIGH }),
  makeTask({ _id: 't2', title: 'Bar Task Beta', startDate: APR_20_MS, dueDate: APR_25_MS, priority: TaskPriority.LOW }),
];

// ─── Mock builders ──────────────────────────────────────────

function makeMocks(tasks: ITask[] = visibleTasks): MockedResponse[] {
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

function renderRoadmap(mocks: MockedResponse[] = makeMocks()) {
  return render(
    <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
      <MemoryRouter initialEntries={[`/project/${projectId}/roadmap`]}>
        <Routes>
          <Route path="/project/:projectId/roadmap" element={<RoadmapPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────

describe('RoadmapPage', () => {
  it('shows loading state while query is in flight', () => {
    const mocks = makeMocks().map((m) => ({ ...m, delay: Infinity }));
    renderRoadmap(mocks);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders roadmap heading and toolbar buttons', async () => {
    renderRoadmap();

    await waitFor(() => {
      expect(screen.getByText('Roadmap')).toBeInTheDocument();
    });

    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Quarter')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders task bars in correct positions for tasks with dates in current period', async () => {
    renderRoadmap();

    await waitFor(() => {
      // Task titles appear both in the sidebar list and inside bars
      expect(screen.getAllByText('Bar Task Alpha').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Bar Task Beta').length).toBeGreaterThan(0);

    // Bars are rendered as role="button" — verify they appear
    const barButtons = screen.getAllByRole('button', { name: /Bar Task/ });
    expect(barButtons.length).toBeGreaterThan(0);
  });

  it('applies correct left/width style to task bars based on dates', async () => {
    renderRoadmap();

    await waitFor(() => {
      expect(screen.getAllByText('Bar Task Alpha').length).toBeGreaterThan(0);
    });

    // Find the bar button for Bar Task Alpha and verify it has inline positioning styles
    const alphaBar = screen.getAllByRole('button').find(
      (el) => el.getAttribute('title')?.startsWith('Bar Task Alpha'),
    );
    expect(alphaBar).toBeDefined();
    // Bar should have a left offset (starts on April 5, not April 1)
    expect(alphaBar!.style.left).not.toBe('0px');
    // Bar should have a positive width
    const widthPx = parseFloat(alphaBar!.style.width);
    expect(widthPx).toBeGreaterThan(0);
  });

  it('does not render task bars for tasks outside the current period', async () => {
    const futureTasks = [
      makeTask({ _id: 'tf1', title: 'Future Task', startDate: JUL_1_MS, dueDate: JUL_1_MS }),
    ];
    renderRoadmap(makeMocks(futureTasks));

    await waitFor(() => {
      // Task name appears in sidebar list
      expect(screen.getByText('Future Task')).toBeInTheDocument();
    });

    // But no bar button for it (since it's outside the visible period)
    const barButtons = screen.queryAllByRole('button', { name: /Future Task/ });
    expect(barButtons).toHaveLength(0);
  });

  it('Today button navigates to the current month', async () => {
    renderRoadmap();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    // Navigate backward one month first
    const prevButton = screen.getByRole('button', { name: /Previous/i });
    fireEvent.click(prevButton);

    // Now click Today — should jump back to current month (April 2026)
    const todayButton = screen.getByText('Today');
    fireEvent.click(todayButton);

    // Period label should contain the current month name
    const currentMonthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    expect(screen.getByText(currentMonthLabel)).toBeInTheDocument();
  });

  it('view toggle switches between month and quarter', async () => {
    renderRoadmap();

    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument();
    });

    // Default is month view — period label shows a single month
    const initialLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    expect(screen.getByText(initialLabel)).toBeInTheDocument();

    // Switch to quarter view
    fireEvent.click(screen.getByText('Quarter'));

    // Quarter view period label uses "Mon – Mon YYYY" format (short months with dash)
    // The label no longer shows the full long month name
    expect(screen.queryByText(initialLabel)).not.toBeInTheDocument();

    // Switch back to month view
    fireEvent.click(screen.getByText('Month'));
    expect(screen.getByText(initialLabel)).toBeInTheDocument();
  });
});
