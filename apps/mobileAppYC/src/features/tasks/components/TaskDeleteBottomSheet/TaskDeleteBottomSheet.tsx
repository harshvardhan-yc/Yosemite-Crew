import React, {forwardRef} from 'react';
import {
  TaskRecurringActionSheet,
  type TaskRecurringActionSheetRef,
} from '@/features/tasks/components/TaskRecurringActionSheet/TaskRecurringActionSheet';

export type TaskDeleteBottomSheetRef = TaskRecurringActionSheetRef;

interface TaskDeleteBottomSheetProps {
  taskTitle?: string;
  onDeleteAll: () => Promise<void> | void;
  onDeleteForDay: () => Promise<void> | void;
  onCancel?: () => void;
}

export const TaskDeleteBottomSheet = forwardRef<
  TaskDeleteBottomSheetRef,
  TaskDeleteBottomSheetProps
>(({taskTitle, onDeleteAll, onDeleteForDay, onCancel}, ref) => (
  <TaskRecurringActionSheet
    ref={ref}
    title="Delete task"
    message={
      taskTitle ? `How would you like to delete "${taskTitle}"?` : undefined
    }
    primaryLabel="Delete all occurrences"
    primaryLoadingLabel="Deleting..."
    onPrimary={onDeleteAll}
    secondaryLabel="Delete for this day only"
    secondaryLoadingLabel="Deleting..."
    onSecondary={onDeleteForDay}
    onCancel={onCancel}
  />
));

TaskDeleteBottomSheet.displayName = 'TaskDeleteBottomSheet';

export default TaskDeleteBottomSheet;
