import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';

import { ProjectDialog } from '@client/components/project-dialog';

// ─── UI Mocks ───────────────────────────────────────────────

vi.mock('@client/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@client/components/ui/select', () => ({
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

vi.mock('@client/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ─── useAuth mock — controlled per test via mockReturnValue ──

const mockUseAuth = vi.fn();
vi.mock('@client/hooks/use-auth', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

// ─── Tests ──────────────────────────────────────────────────

describe('ProjectDialog', () => {
  it('renders null for non-manager user', () => {
    mockUseAuth.mockReturnValue({ isManagerOrAbove: false });

    const { container } = render(
      <MockedProvider mocks={[]}>
        <ProjectDialog
          open={true}
          onOpenChange={vi.fn()}
          mode="create"
          folders={[]}
        />
      </MockedProvider>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders form for manager user', () => {
    mockUseAuth.mockReturnValue({ isManagerOrAbove: true });

    render(
      <MockedProvider mocks={[]}>
        <ProjectDialog
          open={true}
          onOpenChange={vi.fn()}
          mode="create"
          folders={[]}
        />
      </MockedProvider>,
    );

    expect(screen.getByText('New Project')).toBeInTheDocument();
  });
});
