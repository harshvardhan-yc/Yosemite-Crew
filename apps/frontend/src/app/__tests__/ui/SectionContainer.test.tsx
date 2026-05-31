import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';

describe('SectionContainer', () => {
  it('renders the title', () => {
    render(<SectionContainer title="Pricing">content</SectionContainer>);
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <SectionContainer title="Test">
        <span data-testid="child">child</span>
      </SectionContainer>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies nested font size class when nested=true', () => {
    const { container } = render(
      <SectionContainer title="Nested" nested>
        child
      </SectionContainer>
    );
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-[16px]');
  });

  it('applies outer font size class when nested=false (default)', () => {
    const { container } = render(<SectionContainer title="Outer">child</SectionContainer>);
    const titleEl = container.querySelector('span');
    expect(titleEl?.className).toContain('text-[20px]');
  });

  it('applies additional className', () => {
    const { container } = render(
      <SectionContainer title="Test" className="extra-class">
        child
      </SectionContainer>
    );
    expect(container.firstChild).toHaveClass('extra-class');
  });
});
