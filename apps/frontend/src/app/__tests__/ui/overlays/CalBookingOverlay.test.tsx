import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalBookingOverlay from '@/app/ui/overlays/CalBookingOverlay';

jest.mock('@/app/ui/overlays/CalEmbedFrame', () => ({
  __esModule: true,
  default: ({ title, className }: { title: string; className: string }) => (
    <div aria-label={title} data-testid="cal-embed-frame" className={className} />
  ),
}));

describe('CalBookingOverlay', () => {
  it('does not mount while closed', () => {
    render(<CalBookingOverlay open={false} onClose={jest.fn()} />);

    expect(screen.queryByTitle('Book onboarding call')).not.toBeInTheDocument();
  });

  it('renders a dark full-screen overlay with a full-size Cal embed surface', () => {
    render(<CalBookingOverlay open onClose={jest.fn()} />);

    const overlay = document.body.querySelector('[data-cal-booking-overlay="true"]');
    const frame = screen.getByTestId('cal-embed-frame');

    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-[10000]', 'bg-black/60');
    expect(
      screen.queryByRole('heading', { name: 'Book an onboarding call' })
    ).not.toBeInTheDocument();
    expect(frame).toHaveClass('size-full', 'border-0');
  });

  it('closes from the close button and Escape key', () => {
    const onClose = jest.fn();

    render(<CalBookingOverlay open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close booking overlay' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
