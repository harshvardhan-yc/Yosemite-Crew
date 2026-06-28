import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BookDemo from '@/app/features/marketing/pages/BookDemo/BookDemo';

jest.mock('@/app/ui/overlays/CalEmbedFrame', () => ({
  __esModule: true,
  default: ({ title, className }: { title: string; className: string }) => (
    <div aria-label={title} data-testid="cal-embed-frame" className={className} />
  ),
}));

describe('BookDemo Page', () => {
  it('renders a full-size Cal embed for demo booking', () => {
    render(<BookDemo />);

    expect(screen.getByRole('heading', { level: 1, name: 'Book a demo' })).toBeInTheDocument();
    const frame = screen.getByTestId('cal-embed-frame');

    expect(frame).toHaveClass('size-full', 'border-0');
  });
});
