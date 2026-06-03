'use client';
import React, { useState } from 'react';
import { LuArrowLeft, LuCalendarClock, LuPencil, LuPlus } from 'react-icons/lu';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  EmployeeTaskCategory,
  ScheduleTask,
  ScheduleTaskCategory,
  ScheduleTaskStatus,
} from '@/app/features/appointments/types/workspace';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';

type TasksPanelProps = {
  appointmentId: string;
};

type TaskTab = 'EMPLOYEE' | 'PARENT';

const TABS = [
  { key: 'EMPLOYEE', label: 'Employee task' },
  { key: 'PARENT', label: 'Parent task' },
];

const STATUS_CLASSES: Record<ScheduleTaskStatus, string> = {
  COMPLETED: 'border-pill-success-border bg-pill-success-bg text-pill-success-text',
  UPCOMING: 'border-pill-info-border bg-pill-info-bg text-pill-info-text',
  CANCELLED: 'border-pill-warning-border bg-pill-warning-bg text-pill-warning-text',
  PENDING: 'border-pill-neutral-border bg-pill-neutral-bg text-pill-neutral-text',
};

const STATUS_OPTIONS: { label: string; value: ScheduleTaskStatus }[] = [
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Pending', value: 'PENDING' },
];

const EMPLOYEE_CATEGORIES: { label: string; value: EmployeeTaskCategory }[] = [
  'Consultation (billable)',
  'Medication',
  'Care',
  'Treatment',
  'Diagnostic',
  'Communication',
  'Billing',
  'Record',
  'SOAP',
  'Admin',
  'Custom',
].map((c) => ({ label: c, value: c as EmployeeTaskCategory }));

const PARENT_CATEGORIES: { label: string; value: EmployeeTaskCategory }[] = [
  'Medication',
  'Care',
  'Diet',
  'Communication',
  'Billing',
  'Record',
  'Custom reminders',
].map((c) => ({ label: c, value: c as EmployeeTaskCategory }));

const EMPLOYEE_ASSIGNEES = [
  { label: 'Sarah Mitchell', value: 'usr-sarah' },
  { label: 'Dr. Tim Apple', value: 'usr-tim' },
  { label: 'John Doe', value: 'usr-john' },
];

const PARENT_ASSIGNEES = [
  { label: 'Yasmin Hadid', value: 'parent-yasmin' },
  { label: 'Co-parent', value: 'parent-co' },
];

const REPEAT_OPTIONS = ['None', 'Daily', 'Weekly', 'Monthly'].map((r) => ({ label: r, value: r }));

const StatusPill = ({ status }: { status: ScheduleTaskStatus }) => (
  <span
    className={`inline-flex rounded-2xl border px-3 py-1 text-caption-1 ${STATUS_CLASSES[status]}`}
  >
    {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
  </span>
);

const TaskRow = ({
  task,
  assigneeOptions,
  onAssign,
  onStatus,
  onEdit,
  onReschedule,
}: {
  task: ScheduleTask;
  assigneeOptions: { label: string; value: string }[];
  onAssign: (option: { label: string; value: string }) => void;
  onStatus: (status: ScheduleTaskStatus) => void;
  onEdit: () => void;
  onReschedule: () => void;
}) => (
  <li className="flex flex-col gap-2 border-b border-card-border py-3 last:border-0">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1 leading-[130%]">
        <span className="text-[12px] font-medium text-pill-success-text">
          {task.startDate ? formatStampDate(task.startDate) : '24 Apr, 2026'}
        </span>
        <span className="text-[12px] text-text-secondary">{task.category}</span>
        <span className="text-body-4 text-text-primary">{task.description}</span>
      </div>
      <div className="flex items-center gap-2">
        <CircleIconButton
          icon={<LuPencil size={16} aria-hidden="true" />}
          label={`Edit ${task.description}`}
          variant="dark"
          onClick={onEdit}
        />
        <CircleIconButton
          icon={<LuCalendarClock size={16} aria-hidden="true" />}
          label={`Reschedule ${task.description}`}
          onClick={onReschedule}
        />
      </div>
    </div>
    <div className="flex items-center justify-between gap-3">
      <div className="w-44">
        <LabelDropdown
          placeholder="Assigned to"
          options={assigneeOptions}
          defaultOption={task.assignedToId ?? task.assignedToName}
          searchable={false}
          onSelect={(option) => onAssign({ label: option.label, value: option.value })}
        />
      </div>
      <button
        type="button"
        aria-label={`Change status for ${task.description}`}
        onClick={() => {
          const order: ScheduleTaskStatus[] = ['UPCOMING', 'COMPLETED', 'CANCELLED', 'PENDING'];
          const next = order[(order.indexOf(task.status) + 1) % order.length];
          onStatus(next);
        }}
      >
        <StatusPill status={task.status} />
      </button>
    </div>
  </li>
);

type TaskDraft = {
  assignedTo: string;
  templateSource: string;
  category: ScheduleTaskCategory;
  description: string;
  setTime: string;
  reminder: string;
  repeat: string;
  starts: string;
  ends: string;
};

const EMPTY_DRAFT: TaskDraft = {
  assignedTo: '',
  templateSource: 'YC Library',
  category: 'Care',
  description: '',
  setTime: '',
  reminder: '',
  repeat: 'None',
  starts: '',
  ends: '',
};

const TaskForm = ({
  isParent,
  draft,
  onChange,
  onSave,
  onDiscard,
  editing,
}: {
  isParent: boolean;
  draft: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  onSave: () => void;
  onDiscard: () => void;
  editing: boolean;
}) => {
  const assignees = isParent ? PARENT_ASSIGNEES : EMPLOYEE_ASSIGNEES;
  const categories = isParent ? PARENT_CATEGORIES : EMPLOYEE_CATEGORIES;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CircleIconButton
          icon={<LuArrowLeft size={16} aria-hidden="true" />}
          label="Back to tasks"
          onClick={onDiscard}
        />
        <h3 className="text-body-2 font-bold text-text-primary">
          {editing ? 'Edit Task' : 'New Task'}
        </h3>
      </div>
      <LabelDropdown
        placeholder="Assigned to"
        options={assignees}
        defaultOption={draft.assignedTo}
        searchable={false}
        onSelect={(o) => onChange({ assignedTo: o.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <LabelDropdown
          placeholder="Template source"
          options={[
            { label: 'YC Library', value: 'YC Library' },
            { label: 'Custom', value: 'Custom' },
          ]}
          defaultOption={draft.templateSource}
          searchable={false}
          onSelect={(o) => onChange({ templateSource: o.value })}
        />
        <LabelDropdown
          placeholder="Category"
          options={categories}
          defaultOption={draft.category}
          searchable={false}
          onSelect={(o) => onChange({ category: o.value as ScheduleTaskCategory })}
        />
      </div>
      <textarea
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        aria-label="Task description"
        rows={3}
        placeholder="Describe the task"
        className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="time"
          value={draft.setTime}
          onChange={(e) => onChange({ setTime: e.target.value })}
          aria-label="Set time"
          className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
        />
        <input
          value={draft.reminder}
          onChange={(e) => onChange({ reminder: e.target.value })}
          aria-label="Reminder before"
          placeholder="Reminder before"
          className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
        />
      </div>
      <LabelDropdown
        placeholder="Repeat"
        options={REPEAT_OPTIONS}
        defaultOption={draft.repeat}
        searchable={false}
        onSelect={(o) => onChange({ repeat: o.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={draft.starts}
          onChange={(e) => onChange({ starts: e.target.value })}
          aria-label="Starts"
          className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
        />
        <input
          type="date"
          value={draft.ends}
          onChange={(e) => onChange({ ends: e.target.value })}
          aria-label="Ends"
          className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
        />
      </div>
      <div className="flex items-center gap-3">
        <Primary text="Save task" onClick={onSave} />
        <Secondary text="Discard" onClick={onDiscard} />
      </div>
    </div>
  );
};

/** Tasks panel: Employee (workspace schedule) + Parent task sub-tabs with a New/Edit form. */
const TasksPanel = ({ appointmentId }: TasksPanelProps) => {
  const [tab, setTab] = useState<TaskTab>('EMPLOYEE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);

  const encounter = useAppointmentWorkspaceStore((s) => s.encountersById[appointmentId]);
  const addScheduleTask = useAppointmentWorkspaceStore((s) => s.addScheduleTask);
  const updateScheduleTask = useAppointmentWorkspaceStore((s) => s.updateScheduleTask);
  const setScheduleTaskStatus = useAppointmentWorkspaceStore((s) => s.setScheduleTaskStatus);

  const [parentTasks, setParentTasks] = useState<ScheduleTask[]>([
    {
      id: 'parent-task-1',
      category: 'Care',
      description: 'Massage patient paws to relieve tension post SC injection',
      assignedToId: 'parent-yasmin',
      assignedToName: 'Yasmin Hadid',
      status: 'PENDING',
      startDate: '2026-04-24',
      autoGenerated: false,
    },
    {
      id: 'parent-task-2',
      category: 'Billing',
      description: 'Send invoice to client',
      assignedToId: 'usr-john',
      assignedToName: 'John Doe',
      status: 'CANCELLED',
      startDate: '2026-04-24',
      autoGenerated: false,
    },
  ]);

  if (!encounter) return null;

  const isParent = tab === 'PARENT';
  const employeeTasks = encounter.schedule;

  const handleAddParent = (task: ScheduleTask) => setParentTasks((prev) => [...prev, task]);
  const handleUpdateParent = (id: string, patch: Partial<ScheduleTask>) =>
    setParentTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const openNew = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (task: ScheduleTask) => {
    setDraft({
      assignedTo: task.assignedToId ?? '',
      templateSource: 'YC Library',
      category: task.category,
      description: task.description,
      setTime: '',
      reminder: '',
      repeat: 'None',
      starts: task.startDate ?? '',
      ends: task.endDate ?? '',
    });
    setEditingId(task.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const assigneeOptions = isParent ? PARENT_ASSIGNEES : EMPLOYEE_ASSIGNEES;

  const handleSave = () => {
    const assignee = assigneeOptions.find((a) => a.value === draft.assignedTo);
    const base: Omit<ScheduleTask, 'id'> = {
      description: draft.description,
      category: draft.category,
      assignedToId: draft.assignedTo || undefined,
      assignedToName: assignee?.label,
      status: 'UPCOMING',
      startDate: draft.starts || undefined,
      endDate: draft.ends || undefined,
      autoGenerated: false,
    };
    if (editingId) {
      if (isParent) handleUpdateParent(editingId, base);
      else updateScheduleTask(appointmentId, editingId, base);
    } else if (isParent) {
      handleAddParent({ ...base, id: `parent-task-${Date.now()}` });
    } else {
      addScheduleTask(appointmentId, base);
    }
    closeForm();
  };

  if (formOpen) {
    return (
      <TaskForm
        isParent={isParent}
        draft={draft}
        editing={editingId != null}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onSave={handleSave}
        onDiscard={closeForm}
      />
    );
  }

  const tasks = isParent ? parentTasks : employeeTasks;

  return (
    <div className="flex flex-col gap-4">
      <TabToggle
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => setTab(key as TaskTab)}
        panelId={(key) => `tasks-panel-${key}`}
      />
      {tasks.length === 0 ? (
        <p className="py-6 text-center text-body-4 text-text-secondary">No tasks yet.</p>
      ) : (
        <ul className="rounded-2xl border border-card-border px-4">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              assigneeOptions={assigneeOptions}
              onAssign={(option) =>
                isParent
                  ? handleUpdateParent(task.id, {
                      assignedToId: option.value,
                      assignedToName: option.label,
                    })
                  : updateScheduleTask(appointmentId, task.id, {
                      assignedToId: option.value,
                      assignedToName: option.label,
                    })
              }
              onStatus={(status) =>
                isParent
                  ? handleUpdateParent(task.id, { status })
                  : setScheduleTaskStatus(appointmentId, task.id, status)
              }
              onEdit={() => openEdit(task)}
              onReschedule={() =>
                isParent
                  ? handleUpdateParent(task.id, { startDate: '2026-04-25' })
                  : updateScheduleTask(appointmentId, task.id, { startDate: '2026-04-25' })
              }
            />
          ))}
        </ul>
      )}
      <div>
        <Primary text="New Task" icon={<LuPlus aria-hidden="true" />} onClick={openNew} />
      </div>
    </div>
  );
};

export default TasksPanel;
