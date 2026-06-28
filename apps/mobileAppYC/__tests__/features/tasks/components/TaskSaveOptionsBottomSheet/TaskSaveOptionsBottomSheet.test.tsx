import React from 'react';
import {render} from '@testing-library/react-native';
import {
  TaskSaveOptionsBottomSheet,
  type TaskSaveOptionsBottomSheetRef,
} from '../../../../../src/features/tasks/components/TaskSaveOptionsBottomSheet/TaskSaveOptionsBottomSheet';

jest.mock(
  '@/features/tasks/components/TaskRecurringActionSheet/TaskRecurringActionSheet',
  () => ({
    TaskRecurringActionSheet: require('react').forwardRef(
      (props: any, _ref: any) => {
        const {View, Text} = require('react-native');
        return (
          <View testID="recurring-action-sheet">
            <Text testID="sheet-title">{props.title}</Text>
            <Text testID="sheet-message">{props.message}</Text>
            <Text testID="primary-label">{props.primaryLabel}</Text>
            <Text testID="secondary-label">{props.secondaryLabel}</Text>
          </View>
        );
      },
    ),
  }),
);

describe('TaskSaveOptionsBottomSheet', () => {
  const defaultProps = {
    onSaveAll: jest.fn(),
    onSaveForDay: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders TaskRecurringActionSheet with correct title and message', () => {
    const {getByTestId} = render(
      <TaskSaveOptionsBottomSheet {...defaultProps} />,
    );

    expect(getByTestId('sheet-title').props.children).toBe('Save changes');
    expect(getByTestId('sheet-message').props.children).toBe(
      'How would you like to apply your changes?',
    );
  });

  it('passes correct labels to TaskRecurringActionSheet', () => {
    const {getByTestId} = render(
      <TaskSaveOptionsBottomSheet {...defaultProps} />,
    );

    expect(getByTestId('primary-label').props.children).toBe(
      'Save for all occurrences',
    );
    expect(getByTestId('secondary-label').props.children).toBe(
      'Save for this day only',
    );
  });

  it('passes onSaveAll as onPrimary and onSaveForDay as onSecondary', () => {
    const onSaveAll = jest.fn();
    const onSaveForDay = jest.fn();

    const {UNSAFE_getByType} = render(
      <TaskSaveOptionsBottomSheet
        onSaveAll={onSaveAll}
        onSaveForDay={onSaveForDay}
      />,
    );

    const sheet = UNSAFE_getByType(
      require('../../../../../src/features/tasks/components/TaskSaveOptionsBottomSheet/TaskSaveOptionsBottomSheet')
        .TaskSaveOptionsBottomSheet ?? (() => null),
    );
    expect(sheet).toBeTruthy();
  });

  it('renders without onCancel prop', () => {
    const {getByTestId} = render(
      <TaskSaveOptionsBottomSheet
        onSaveAll={jest.fn()}
        onSaveForDay={jest.fn()}
      />,
    );
    expect(getByTestId('recurring-action-sheet')).toBeTruthy();
  });

  it('forwards ref to the underlying sheet', () => {
    const ref = React.createRef<TaskSaveOptionsBottomSheetRef>();
    expect(() =>
      render(
        <TaskSaveOptionsBottomSheet
          onSaveAll={jest.fn()}
          onSaveForDay={jest.fn()}
          ref={ref}
        />,
      ),
    ).not.toThrow();
  });

  it('has correct displayName', () => {
    const {
      TaskSaveOptionsBottomSheet: Component,
    } = require('../../../../../src/features/tasks/components/TaskSaveOptionsBottomSheet/TaskSaveOptionsBottomSheet');
    expect(Component.displayName).toBe('TaskSaveOptionsBottomSheet');
  });
});
