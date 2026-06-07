import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import QuickActionsModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/QuickActionsModal';
import RecordPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/RecordPanel';
import TasksPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/TasksPanel';
import DocumentsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/DocumentsPanel';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { SideAction } from '@/app/features/appointments/types/workspace';

// Heavy leaf components are exercised by their own suites; here we stub them so
// the wrapper panels (Chat / Activity / MSD / Records) stay fast and focused.
jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat',
  () => ({ __esModule: true, default: () => <div>ChatStub</div> })
);
jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit',
  () => ({ __esModule: true, default: () => <div>AuditStub</div> })
);
jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch',
  () => ({ __esModule: true, default: () => <div>MerckStub</div> })
);
jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: ({ companionId }: { companionId: string }) => <div>Records for {companionId}</div>,
}));

const APPT = 'appt-quick';

const appointment: Appointment = {
  id: APPT,
  companion: {
    id: 'comp-9',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  organisationId: 'org-1',
  appointmentDate: new Date(),
  startTime: new Date(),
  timeSlot: '09:00',
  durationMinutes: 30,
  endTime: new Date(),
  status: 'IN_PROGRESS',
};

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const seed = () => useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');

// Inpatient encounters seed a populated employee schedule (outpatient starts empty).
const seedInpatient = () =>
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'INPATIENT');

const renderModal = (
  activeAction: SideAction | null,
  overrides: Partial<React.ComponentProps<typeof QuickActionsModal>> = {}
) => {
  const onChangeAction = jest.fn();
  const onClose = jest.fn();
  render(
    <QuickActionsModal
      appointment={appointment}
      appointmentId={APPT}
      activeAction={activeAction}
      onChangeAction={onChangeAction}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onChangeAction, onClose };
};

describe('QuickActionsModal shell', () => {
  beforeEach(() => {
    reset();
    seed();
  });

  it('renders all six nav items and routes between panels', () => {
    const { onChangeAction } = renderModal('RECORD');
    ['Record', 'Tasks', 'Documents', 'Chat', 'Activity', 'MSD'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    const msdNav = screen.getByText('MSD').closest('button');
    expect(msdNav?.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('MSDLogo.png')
    );
    fireEvent.click(screen.getByText('Tasks'));
    expect(onChangeAction).toHaveBeenCalledWith('TASKS');
    fireEvent.click(screen.getByText('MSD'));
    expect(onChangeAction).toHaveBeenCalledWith('MSD');
  });

  it('marks the active nav item as pressed', () => {
    renderModal('TASKS');
    const tasksNav = screen.getByText('Tasks').closest('button');
    expect(tasksNav).toHaveAttribute('aria-pressed', 'true');
    const recordNav = screen.getByText('Record').closest('button');
    expect(recordNav).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes from the close button', () => {
    const { onClose } = renderModal('RECORD');
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('routes each action to its panel', () => {
    const { rerender } = render(
      <QuickActionsModal
        appointment={appointment}
        appointmentId={APPT}
        activeAction="CHAT"
        onChangeAction={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('ChatStub')).toBeInTheDocument();

    rerender(
      <QuickActionsModal
        appointment={appointment}
        appointmentId={APPT}
        activeAction="ACTIVITY"
        onChangeAction={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('AuditStub')).toBeInTheDocument();

    rerender(
      <QuickActionsModal
        appointment={appointment}
        appointmentId={APPT}
        activeAction="MSD"
        onChangeAction={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('MerckStub')).toBeInTheDocument();
  });
});

describe('RecordPanel', () => {
  beforeEach(() => {
    reset();
    seed();
  });

  it('returns null without an encounter', () => {
    const { container } = render(<RecordPanel appointmentId="missing" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('records a new vital and lists it', () => {
    render(<RecordPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText('Heart Rate'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    const vitals = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.vitals;
    expect(vitals[0].heartRateBpm).toBe(88);
    // Non-numeric weight parses to undefined.
    expect(vitals[0].weightLbs).toBeUndefined();
    expect(screen.getByText('VT-001')).toBeInTheDocument();
  });

  it('discards a draft vital without recording', () => {
    render(<RecordPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(screen.getByText(/no vitals recorded yet/i)).toBeInTheDocument();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.vitals).toHaveLength(0);
  });

  it('expands a recorded vital to show details', () => {
    render(<RecordPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    fireEvent.click(screen.getByRole('button', { name: /view vt-001/i }));
    expect(screen.getByText(/Temp: 101 °F/)).toBeInTheDocument();
    // Collapsing hides the detail grid again.
    fireEvent.click(screen.getByRole('button', { name: /hide vt-001/i }));
    expect(screen.queryByText(/Temp: 101 °F/)).not.toBeInTheDocument();
  });

  it('runs an observation tool and records a result', () => {
    render(<RecordPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('tab', { name: /observation tool/i }));
    // Switch scoring tool then start.
    fireEvent.click(screen.getByRole('button', { name: 'Canine acute pain scale' }));
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    const obs = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.observations;
    expect(obs).toHaveLength(1);
    expect(obs[0].toolKey).toBe('CSU_CAP');
    fireEvent.click(screen.getByRole('button', { name: /view ot-001/i }));
    expect(screen.getByText(/Total score: 2/)).toBeInTheDocument();
  });
});

describe('TasksPanel', () => {
  beforeEach(() => {
    reset();
    seed();
  });

  it('renders the employee schedule and toggles a task status', () => {
    reset();
    seedInpatient();
    render(<TasksPanel appointmentId={APPT} />);
    const before = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule;
    expect(before.length).toBeGreaterThan(0);
    const statusBtn = screen.getAllByRole('button', { name: /change status for/i })[0];
    fireEvent.click(statusBtn);
    const after = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule[0];
    expect(after.status).not.toBe(before[0].status);
  });

  it('creates a new employee task from the form', () => {
    render(<TasksPanel appointmentId={APPT} />);
    const countBefore = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule.length;
    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    fireEvent.change(screen.getByLabelText(/task description/i), {
      target: { value: 'Recheck incision' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save task/i }));
    const schedule = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule;
    expect(schedule.length).toBe(countBefore + 1);
    expect(schedule.some((t) => t.description === 'Recheck incision')).toBe(true);
  });

  it('switches to the parent tab and creates a parent task locally', () => {
    render(<TasksPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('tab', { name: /parent task/i }));
    expect(screen.getByText(/Send invoice to client/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    fireEvent.change(screen.getByLabelText(/task description/i), {
      target: { value: 'Give meds at 8pm' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save task/i }));
    expect(screen.getByText('Give meds at 8pm')).toBeInTheDocument();
    // Parent tasks are local-only — they never touch the encounter schedule.
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)!
        .schedule.some((t) => t.description === 'Give meds at 8pm')
    ).toBe(false);
  });

  it('edits an existing employee task', () => {
    reset();
    seedInpatient();
    render(<TasksPanel appointmentId={APPT} />);
    const target = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule[0];
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`edit ${target.description}`, 'i') })
    );
    const desc = screen.getByLabelText(/task description/i);
    fireEvent.change(desc, { target: { value: 'Edited task body' } });
    fireEvent.click(screen.getByRole('button', { name: /save task/i }));
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule;
    expect(updated.some((t) => t.description === 'Edited task body')).toBe(true);
  });

  it('reschedules and reassigns an employee task', () => {
    reset();
    seedInpatient();
    render(<TasksPanel appointmentId={APPT} />);
    const target = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule[0];

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`reschedule ${target.description}`, 'i') })
    );
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule[0].startDate).toBe(
      '2026-04-25'
    );

    // Pick a different assignee from the row dropdown.
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule[0].assignedToId
    ).toBe('usr-tim');
  });

  it('updates a parent task status and reschedule locally', () => {
    render(<TasksPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('tab', { name: /parent task/i }));
    // The first parent task starts PENDING; cycling moves it forward.
    const statusBtn = screen.getAllByRole('button', { name: /change status for/i })[0];
    fireEvent.click(statusBtn);
    fireEvent.click(screen.getAllByRole('button', { name: /reschedule/i })[0]);
    // Reassign a parent task via its row dropdown (parent-branch handler).
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Co-parent' }));
    // Local parent edits never touch the encounter schedule.
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule).toHaveLength(0);
    expect(screen.getByText(/Massage patient paws/)).toBeInTheDocument();
  });

  it('returns null without an encounter', () => {
    const { container } = render(<TasksPanel appointmentId="nope" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DocumentsPanel', () => {
  beforeEach(reset);

  it('lists mock forms and filters by search', () => {
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    expect(screen.getAllByText('Medication Admin - ID 67890').length).toBe(3);
    expect(screen.getByText('Authorized by Client')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgement pending')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search forms to add/i), {
      target: { value: 'no-such-form' },
    });
    expect(screen.getByText(/no forms match this search/i)).toBeInTheDocument();
  });

  it('shows companion records on the Records tab', () => {
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    fireEvent.click(screen.getByRole('tab', { name: /records/i }));
    expect(screen.getByText('Records for comp-9')).toBeInTheDocument();
  });

  it('falls back when there is no companion id', () => {
    render(<DocumentsPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('tab', { name: /records/i }));
    expect(screen.getByText(/no companion records available/i)).toBeInTheDocument();
  });

  it('prints a form via the print control', () => {
    const printSpy = jest.fn();
    Object.defineProperty(globalThis.window, 'print', { value: printSpy, configurable: true });
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    const firstRow = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(firstRow).getByRole('button', { name: /print/i }));
    expect(printSpy).toHaveBeenCalled();
  });
});
