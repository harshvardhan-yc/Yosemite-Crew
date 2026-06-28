import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Next from '@/app/ui/primitives/Icons/Next';

jest.mock('react-icons/io5', () => ({
  IoChevronForward: () => <span data-testid="icon-next" />,
}));

describe('Next icon button', () => {
  it('renders with aria-label Next', () => {
    render(<Next onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Next onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Next onClick={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<Next onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Next onClick={jest.fn()} className="custom-class" />);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('custom-class');
  });

  it('does not call onClick when disabled', () => {
    const onClick = jest.fn();
    render(<Next onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
