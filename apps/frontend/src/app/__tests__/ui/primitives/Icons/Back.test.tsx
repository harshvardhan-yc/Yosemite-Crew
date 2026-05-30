import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Back from '@/app/ui/primitives/Icons/Back';

jest.mock('react-icons/io5', () => ({
  IoChevronBack: () => <span data-testid="icon-back" />,
}));

describe('Back icon button', () => {
  it('renders with aria-label Previous', () => {
    render(<Back onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Back onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Back onClick={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<Back onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Back onClick={jest.fn()} className="custom-class" />);
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveClass('custom-class');
  });

  it('does not call onClick when disabled', () => {
    const onClick = jest.fn();
    render(<Back onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
