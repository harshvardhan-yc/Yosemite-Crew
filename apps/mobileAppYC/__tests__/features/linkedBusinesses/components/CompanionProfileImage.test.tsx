import React from 'react';
import {act} from '@testing-library/react-native';
import {mockTheme} from '../setup/mockTheme';
import {render, screen} from '@testing-library/react-native';
import {CompanionProfileImage} from '../../../../src/features/linkedBusinesses/components/CompanionProfileImage';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    cat: {uri: 'mock-cat-image-uri'},
  },
}));

jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: (uri: string | null) => uri,
}));

describe('CompanionProfileImage', () => {
  it('renders name and breedName', () => {
    render(
      <CompanionProfileImage
        name="Fluffy"
        breedName="Persian"
        profileImage="https://example.com/fluffy.jpg"
        size={150}
      />,
    );
    expect(screen.getByText('Fluffy')).toBeTruthy();
    expect(screen.getByText('Persian')).toBeTruthy();
  });

  it('renders Image when profileImage URI is provided', () => {
    const {UNSAFE_getAllByType} = render(
      <CompanionProfileImage
        name="Fluffy"
        profileImage="https://example.com/fluffy.jpg"
      />,
    );
    const {Image} = require('react-native');
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('renders initials fallback when profileImage is null', () => {
    render(<CompanionProfileImage name="Luna" profileImage={null} />);
    expect(screen.getByText('L')).toBeTruthy();
  });

  it('renders "C" when name is empty string', () => {
    render(<CompanionProfileImage name="" profileImage={null} />);
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('renders "C" when name is only whitespace', () => {
    render(<CompanionProfileImage name="   " profileImage={null} />);
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('renders fallback breed "Unknown Breed" when breedName is not provided', () => {
    render(<CompanionProfileImage name="Stray" />);
    expect(screen.getByText('Unknown Breed')).toBeTruthy();
  });

  it('uses uppercase initial from name', () => {
    render(<CompanionProfileImage name="bella" profileImage={null} />);
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('shows initials fallback after image load error', () => {
    const {UNSAFE_getAllByType, getByText} = render(
      <CompanionProfileImage
        name="Max"
        profileImage="https://broken-url.com/img.jpg"
      />,
    );
    const {Image} = require('react-native');
    const img = UNSAFE_getAllByType(Image)[0];
    act(() => {
      img.props.onError();
    });
    expect(getByText('M')).toBeTruthy();
  });

  it('resets loadFailed when profileImage URI changes', () => {
    const {rerender, UNSAFE_getAllByType} = render(
      <CompanionProfileImage
        name="Rex"
        profileImage="https://broken-url.com/rex.jpg"
      />,
    );
    const {Image} = require('react-native');
    act(() => {
      UNSAFE_getAllByType(Image)[0].props.onError();
    });

    rerender(
      <CompanionProfileImage
        name="Rex"
        profileImage="https://new-url.com/rex.jpg"
      />,
    );
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('accepts custom size prop', () => {
    expect(() =>
      render(<CompanionProfileImage name="Dog" size={200} />),
    ).not.toThrow();
  });
});
