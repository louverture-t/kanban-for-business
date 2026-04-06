import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TASKS_QUERY } from '@client/graphql/operations';
import { PriorityPage } from '@client/pages/priority';

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => React.createElement('div', { className: props.className, onClick: props.onClick }, props.children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('minimal', () => {
  it('renders loading', () => {
    const mocks = [{
      request: { query: TASKS_QUERY, variables: { projectId: 'proj-1', includeArchived: false } },
      result: { data: { tasks: [] } },
      delay: Infinity,
    }];
    render(
      <MockedProvider mocks={mocks} {...{ addTypename: false } as any}>
        <MemoryRouter initialEntries={['/project/proj-1/priority']}>
          <Routes>
            <Route path="/project/:projectId/priority" element={<PriorityPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
