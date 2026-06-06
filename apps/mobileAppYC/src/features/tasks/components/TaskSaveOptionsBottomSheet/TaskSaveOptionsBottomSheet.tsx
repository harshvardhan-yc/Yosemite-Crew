import React, {forwardRef} from 'react';
import {
  TaskRecurringActionSheet,
  type TaskRecurringActionSheetRef,
} from '@/features/tasks/components/TaskRecurringActionSheet/TaskRecurringActionSheet';

export type TaskSaveOptionsBottomSheetRef = TaskRecurringActionSheetRef;

interface TaskSaveOptionsBottomSheetProps {
  onSaveAll: () => Promise<void> | void;
  onSaveForDay: () => Promise<void> | void;
  onCancel?: () => void;
}

export const TaskSaveOptionsBottomSheet = forwardRef<
  TaskSaveOptionsBottomSheetRef,
  TaskSaveOptionsBottomSheetProps
>(({onSaveAll, onSaveForDay, onCancel}, ref) => (
  <TaskRecurringActionSheet
    ref={ref}
    title="Save changes"
    message="How would you like to apply your changes?"
    primaryLabel="Save for all occurrences"
    primaryLoadingLabel="Saving..."
    onPrimary={onSaveAll}
    secondaryLabel="Save for this day only"
    secondaryLoadingLabel="Saving..."
    onSecondary={onSaveForDay}
    onCancel={onCancel}
  />
));

TaskSaveOptionsBottomSheet.displayName = 'TaskSaveOptionsBottomSheet';

export default TaskSaveOptionsBottomSheet;
