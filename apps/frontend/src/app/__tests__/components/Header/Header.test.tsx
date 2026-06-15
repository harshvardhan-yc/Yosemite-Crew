import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/app/ui/layout/Header/GuestHeader/GuestHeader', () => () => (
  <div data-testid="guest-header">Guest Header</div>
));

jest.mock('@/app/ui/layout/Header/UserHeader/UserHeader', () => () => (
  <div data-testid="user-header">User Header</div>
));

import Header from '@/app/ui/layout/Header/Header';

describe('Header', () => {
  it('renders GuestHeader by default', () => {
    const { container } = render(<Header />);

    expect(screen.getByTestId('guest-header')).toBeInTheDocument();
    expect(screen.queryByTestId('user-header')).not.toBeInTheDocument();

    const header = container.querySelector('header');
    expect(header).toHaveClass('bg-(--whitebg)');
  });

  it('renders UserHeader when user is true', () => {
    const { container } = render(<Header user />);

    expect(screen.getByTestId('user-header')).toBeInTheDocument();
    expect(screen.queryByTestId('guest-header')).not.toBeInTheDocument();

    const header = container.querySelector('header');
    expect(header).toHaveClass('yc-user-header-shell');
  });
});
