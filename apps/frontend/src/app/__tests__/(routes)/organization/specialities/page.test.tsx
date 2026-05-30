import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Page from '@/app/(routes)/(app)/organization/specialities/page';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('SpecialitiesRevamp')) {
        const Mock = jest.requireMock(
          '@/app/features/organization/pages/Specialities/SpecialitiesRevamp'
        ) as { default: React.FC<Record<string, unknown>> };
        return <Mock.default {...props} />;
      }
      return null;
    };
    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

jest.mock('@/app/features/organization/pages/Specialities/SpecialitiesRevamp', () => ({
  __esModule: true,
  default: () => <div data-testid="specialities-revamp">Specialities</div>,
}));

describe('Specialities page route', () => {
  it('renders the SpecialitiesRevamp component', () => {
    render(<Page />);
    expect(screen.getByTestId('specialities-revamp')).toBeInTheDocument();
  });

  it('exports page metadata with correct title', async () => {
    const mod = await import('@/app/(routes)/(app)/organization/specialities/page');
    expect((mod as any).metadata?.title).toBe('Specialities — Yosemite Crew');
  });
});
