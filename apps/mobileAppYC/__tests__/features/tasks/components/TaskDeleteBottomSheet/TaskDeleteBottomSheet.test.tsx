import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {
  TaskDeleteBottomSheet,
  type TaskDeleteBottomSheetRef,
} from '../../../../../src/features/tasks/components/TaskDeleteBottomSheet/TaskDeleteBottomSheet';

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
    ({title, onPress, disabled}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID={`btn-${title}`}
          onPress={onPress}
          disabled={disabled}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
);

const defaultProps = {
  taskTitle: 'Morning Medication',
  onDeleteAll: jest.fn(),
  onDeleteForDay: jest.fn(),
  onCancel: jest.fn(),
};

describe('TaskDeleteBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title "Delete task"', () => {
    const {getByTestId} = render(<TaskDeleteBottomSheet {...defaultProps} />);
    expect(getByTestId('sheet-title').props.children).toBe('Delete task');
  });

  it('renders message including taskTitle when provided', () => {
    const {getByText} = render(<TaskDeleteBottomSheet {...defaultProps} />);
    expect(
      getByText('How would you like to delete "Morning Medication"?'),
    ).toBeTruthy();
  });

  it('does not render message when taskTitle is undefined', () => {
    const {queryByText} = render(
      <TaskDeleteBottomSheet {...defaultProps} taskTitle={undefined} />,
    );
    expect(queryByText(/How would you like to delete/)).toBeNull();
  });

  it('renders "Delete all occurrences" and "Delete for this day only" buttons', () => {
    const {getByText} = render(<TaskDeleteBottomSheet {...defaultProps} />);
    expect(getByText('Delete all occurrences')).toBeTruthy();
    expect(getByText('Delete for this day only')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('calls onDeleteAll when primary button is pressed', async () => {
    const onDeleteAll = jest.fn().mockResolvedValue(undefined);
    const {getByText} = render(
      <TaskDeleteBottomSheet {...defaultProps} onDeleteAll={onDeleteAll} />,
    );
    await act(async () => {
      fireEvent.press(getByText('Delete all occurrences'));
    });
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteForDay when secondary button is pressed', async () => {
    const onDeleteForDay = jest.fn().mockResolvedValue(undefined);
    const {getByText} = render(
      <TaskDeleteBottomSheet
        {...defaultProps}
        onDeleteForDay={onDeleteForDay}
      />,
    );
    await act(async () => {
      fireEvent.press(getByText('Delete for this day only'));
    });
    expect(onDeleteForDay).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is pressed', () => {
    const onCancel = jest.fn();
    const {getByText} = render(
      <TaskDeleteBottomSheet {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button in header is pressed', () => {
    const onCancel = jest.fn();
    const {getByTestId} = render(
      <TaskDeleteBottomSheet {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByTestId('close-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onCancel is not provided and Cancel is pressed', () => {
    const {getByText} = render(
      <TaskDeleteBottomSheet {...defaultProps} onCancel={undefined} />,
    );
    expect(() => fireEvent.press(getByText('Cancel'))).not.toThrow();
  });

  it('exposes open and close via ref', () => {
    const ref = React.createRef<TaskDeleteBottomSheetRef>();
    render(<TaskDeleteBottomSheet {...defaultProps} ref={ref} />);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.open).toBe('function');
    expect(typeof ref.current?.close).toBe('function');

    expect(() => ref.current?.open()).not.toThrow();
    expect(() => ref.current?.close()).not.toThrow();
  });

  it('has displayName set', () => {
    expect(TaskDeleteBottomSheet.displayName).toBe('TaskDeleteBottomSheet');
  });
});
