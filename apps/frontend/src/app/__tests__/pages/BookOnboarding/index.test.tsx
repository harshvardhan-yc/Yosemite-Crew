import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedBookOnboarding from '@/app/features/onboarding/pages/BookOnboarding';

jest.mock('@/app/ui/overlays/CalEmbedFrame', () => ({
  __esModule: true,
  default: ({ title, className }: { title: string; className: string }) => (
    <div aria-label={title} data-testid="cal-embed-frame" className={className} />
  ),
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="org-guard">{children}</div>
  ),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe('BookOnboarding Page', () => {
  it('renders the onboarding Cal embed within protected guards', () => {
    render(<ProtectedBookOnboarding />);

    const protectedRoute = screen.getByTestId('protected-route');
    const orgGuard = screen.getByTestId('org-guard');
    const frame = screen.getByTestId('cal-embed-frame');

    expect(protectedRoute).toContainElement(orgGuard);
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
    expect(frame).toHaveClass('min-h-[calc(100vh-120px)]', 'w-full', 'border-0');
  });
});
