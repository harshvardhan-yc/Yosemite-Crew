import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {
  TaskRecurringActionSheet,
  type TaskRecurringActionSheetRef,
} from '../../../../../src/features/tasks/components/TaskRecurringActionSheet/TaskRecurringActionSheet';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const {forwardRef, useImperativeHandle} = require('react');
  return forwardRef(({children}: any, ref: any) => {
    const {View} = require('react-native');
    useImperativeHandle(ref, () => ({
      snapToIndex: mockSnapToIndex,
      close: mockClose,
    }));
    return <View testID="bottom-sheet">{children}</View>;
  });
});

jest.mock(
  '@/shared/components/common/BottomSheetHeader/BottomSheetHeader',
  () => ({
    BottomSheetHeader: ({title, onClose}: any) => {
      const {TouchableOpacity, Text, View} = require('react-native');
      return (
        <View>
          <Text testID="sheet-title">{title}</Text>
          <TouchableOpacity testID="close-btn" onPress={onClose}>
            <Text>Close</Text>
          </TouchableOpacity>
        </View>
      );
    },
  }),
);

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () =>
    ({title, onPress, disabled, loading, testID}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID={testID ?? `btn-${title}`}
          onPress={onPress}
          disabled={disabled}>
          <Text>{loading ? 'loading' : title}</Text>
        </TouchableOpacity>
      );
    },
);

// --- Helpers ---

const defaultProps = {
  title: 'Test Action',
  message: 'Choose an option',
  primaryLabel: 'Primary',
  primaryLoadingLabel: 'Primary loading...',
  onPrimary: jest.fn(),
  secondaryLabel: 'Secondary',
  secondaryLoadingLabel: 'Secondary loading...',
  onSecondary: jest.fn(),
  onCancel: jest.fn(),
};

const renderSheet = (props = {}) =>
  render(<TaskRecurringActionSheet {...defaultProps} {...props} />);

// --- Tests ---

describe('TaskRecurringActionSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapToIndex.mockClear();
    mockClose.mockClear();
  });

  it('renders title and message', () => {
    const {getByTestId, getByText} = renderSheet();
    expect(getByTestId('sheet-title').props.children).toBe('Test Action');
    expect(getByText('Choose an option')).toBeTruthy();
  });

  it('renders without message when not provided', () => {
    const {queryByText} = renderSheet({message: undefined});
    expect(queryByText('Choose an option')).toBeNull();
  });

  it('renders primary and secondary buttons with correct labels', () => {
    const {getByText} = renderSheet();
    expect(getByText('Primary')).toBeTruthy();
    expect(getByText('Secondary')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('calls onPrimary when primary button pressed', async () => {
    const onPrimary = jest.fn().mockResolvedValue(undefined);
    const {getByText} = renderSheet({onPrimary});

    await act(async () => {
      fireEvent.press(getByText('Primary'));
    });

    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('calls onSecondary when secondary button pressed', async () => {
    const onSecondary = jest.fn().mockResolvedValue(undefined);
    const {getByText} = renderSheet({onSecondary});

    await act(async () => {
      fireEvent.press(getByText('Secondary'));
    });

    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button pressed', () => {
    const onCancel = jest.fn();
    const {getByTestId} = renderSheet({onCancel});

    fireEvent.press(getByTestId('close-btn'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button pressed', () => {
    const onCancel = jest.fn();
    const {getByText} = renderSheet({onCancel});

    fireEvent.press(getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onCancel is not provided and close is pressed', () => {
    const {getByTestId} = renderSheet({onCancel: undefined});
    expect(() => fireEvent.press(getByTestId('close-btn'))).not.toThrow();
  });

  it('handles primary action error gracefully', async () => {
    const error = new Error('Primary failed');
    const onPrimary = jest.fn().mockRejectedValue(error);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const {getByText} = renderSheet({onPrimary});

    await act(async () => {
      fireEvent.press(getByText('Primary'));
    });

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        '[TaskRecurringActionSheet] Primary action error:',
        error,
      );
    });

    errorSpy.mockRestore();
  });

  it('handles secondary action error gracefully', async () => {
    const error = new Error('Secondary failed');
    const onSecondary = jest.fn().mockRejectedValue(error);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const {getByText} = renderSheet({onSecondary});

    await act(async () => {
      fireEvent.press(getByText('Secondary'));
    });

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        '[TaskRecurringActionSheet] Secondary action error:',
        error,
      );
    });

    errorSpy.mockRestore();
  });

  it('exposes open and close via ref', () => {
    const ref = React.createRef<TaskRecurringActionSheetRef>();
    render(<TaskRecurringActionSheet {...defaultProps} ref={ref} />);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.open).toBe('function');
    expect(typeof ref.current?.close).toBe('function');

    expect(() => ref.current?.open()).not.toThrow();
    expect(() => ref.current?.close()).not.toThrow();
  });

  it('shows primary loading label while primary action is in flight', async () => {
    let resolvePrimary!: () => void;
    const inFlight = new Promise<void>(resolve => {
      resolvePrimary = resolve;
    });
    const onPrimary = jest.fn().mockReturnValue(inFlight);

    const {getByText} = renderSheet({onPrimary});

    act(() => {
      fireEvent.press(getByText('Primary'));
    });

    expect(getByText('loading')).toBeTruthy();

    await act(async () => {
      resolvePrimary();
    });
  });

  it('shows secondary loading label while secondary action is in flight', async () => {
    let resolveSecondary!: () => void;
    const inFlight = new Promise<void>(resolve => {
      resolveSecondary = resolve;
    });
    const onSecondary = jest.fn().mockReturnValue(inFlight);

    const {getByText} = renderSheet({onSecondary});

    act(() => {
      fireEvent.press(getByText('Secondary'));
    });

    expect(getByText('loading')).toBeTruthy();

    await act(async () => {
      resolveSecondary();
    });
  });
});
