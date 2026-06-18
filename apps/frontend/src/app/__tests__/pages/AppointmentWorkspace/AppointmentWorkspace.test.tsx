import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import AppointmentWorkspace from '@/app/features/appointments/pages/AppointmentWorkspace';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import {
  markEncounterReadyForDischarge,
  undoEncounterReadyForDischarge,
} from '@/app/features/appointments/services/appointmentService';
import { loadWorkspaceClinicalArtifacts } from '@/app/features/appointments/services/workspaceClinicalService';
import { listSoapTemplatesForWorkspace } from '@/app/features/appointments/services/workspaceTemplateService';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockStepParam: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({ get: () => mockStepParam }),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/SoapStep', () => ({
  __esModule: true,
  default: ({
    appointmentReason,
    encounter,
    onRecordVitals,
    onSaveAndNext,
  }: {
    appointmentReason: string;
    encounter: AppointmentEncounter;
    onRecordVitals: () => void;
    onSaveAndNext: () => void;
  }) => (
    <div>
      SOAP read only: {String(encounter.viewOnly)}
      <span>SOAP reason: {appointmentReason}</span>
      <button type="button" onClick={onRecordVitals}>
        Mock record vitals
      </button>
      <button type="button" onClick={onSaveAndNext}>
        Mock soap save next
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/DiagnosticsStep', () => ({
  __esModule: true,
  default: ({ onOpenTreatment }: { onOpenTreatment: () => void }) => (
    <button type="button" onClick={onOpenTreatment}>
      Mock open treatment
    </button>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep', () => ({
  __esModule: true,
  default: ({ onOpenInvoice }: { onOpenInvoice: () => void }) => (
    <div>
      <button type="button" onClick={onOpenInvoice}>
        Mock open invoice
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep', () => ({
  __esModule: true,
  default: ({ onOpenSummary }: { onOpenSummary: () => void }) => (
    <button type="button" onClick={onOpenSummary}>
      Mock open summary
    </button>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep', () => ({
  __esModule: true,
  default: ({ encounter }: { encounter: AppointmentEncounter }) => (
    <div>Summary read only: {String(encounter.viewOnly)}</div>
  ),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  assignEncounterUnit: jest.fn().mockResolvedValue(undefined),
  markEncounterReadyForDischarge: jest.fn().mockResolvedValue(undefined),
  undoEncounterReadyForDischarge: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  loadWorkspaceClinicalArtifacts: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listSoapTemplatesForWorkspace: jest.fn().mockResolvedValue([]),
}));

const makeAppointment = (startTime: Date, inpatient = false): Appointment => ({
  id: 'appt-workspace',
  patient: {
    id: 'comp-1',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  companion: {
    id: 'comp-1',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  organisationId: 'org-1',
  appointmentDate: startTime,
  startTime,
  timeSlot: '09:00',
  durationMinutes: 30,
  endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
  status: 'IN_PROGRESS',
  concern: 'Annual limping review',
  room: inpatient ? { id: 'room-1', name: 'Room 1' } : undefined,
});

const resetStore = () => {
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });
  mockReplace.mockClear();
  mockPush.mockClear();
  (markEncounterReadyForDischarge as jest.Mock).mockClear();
  (undoEncounterReadyForDischarge as jest.Mock).mockClear();
  mockStepParam = null;
  (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([]);
  (markEncounterReadyForDischarge as jest.Mock).mockResolvedValue(undefined);
  (undoEncounterReadyForDischarge as jest.Mock).mockResolvedValue(undefined);
  (loadWorkspaceClinicalArtifacts as jest.Mock).mockResolvedValue({});
  (listSoapTemplatesForWorkspace as jest.Mock).mockResolvedValue([]);
  useOrganisationRoomStore.setState({
    roomUnitsById: {},
    roomUnitIdsByRoomId: {},
    roomUnitIdsByGroupId: {},
    roomUnitGroupsById: {},
    roomUnitGroupIdsByRoomId: {},
  });
};

describe('AppointmentWorkspace container', () => {
  beforeEach(resetStore);

  it('renders the SOAP landing step and opens the quick actions side modal from the header', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(screen.getByText('SOAP reason: Annual limping review')).toBeInTheDocument();
    // The header button opens the modal; the modal's own close control also
    // matches /quick actions/, so target the header trigger explicitly.
    fireEvent.click(screen.getByRole('button', { name: 'Quick Actions' }));

    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('RECORD');
  });

  it('hydrates clinical artifacts from the backend adapter', async () => {
    (loadWorkspaceClinicalArtifacts as jest.Mock).mockResolvedValue({
      soap: [
        {
          id: 'soap-backend',
          chiefComplaint: '',
          subjective: '<p>backend subjective</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'COMPLETED',
          createdAt: '2026-04-20T09:00:00.000Z',
        },
      ],
    });

    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.soap[0].id
      ).toBe('soap-backend')
    );
    expect(loadWorkspaceClinicalArtifacts).toHaveBeenCalledWith({
      organisationId: 'org-1',
      appointmentId: 'appt-workspace',
      encounterId: undefined,
    });
  });

  it('wires header, meta bar and side-modal callbacks into the workspace store/router', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockPush).toHaveBeenCalledWith('/appointments');

    fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock record vitals' }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('RECORD');

    fireEvent.click(screen.getByRole('button', { name: 'Quick Actions' }));
    // Close the Quick actions modal via the Close button inside its panel (the
    // modal header sits next to the "Quick actions" nav landmark).
    const quickActionsPanel = screen
      .getByRole('navigation', { name: 'Quick actions' })
      .closest('div')!;
    fireEvent.click(within(quickActionsPanel).getByRole('button', { name: /^close$/i }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Diagnostics' })[0]);
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=DIAGNOSTICS',
      {
        scroll: false,
      }
    );
  });

  it('uses loaded room units for inpatient room and unit selection', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Ward A' },
      { id: 'room-2', name: 'Ward B' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-2': ['unit-b'],
      },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /room: ward a/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ward B' }));
    // Selecting a room auto-selects that room's first unit, so the Unit dropdown
    // now reflects "B" (unit-b) rather than the placeholder.
    expect(screen.getByRole('button', { name: 'Unit: B' })).toBeInTheDocument();

    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.roomId).toBe('room-2');
    expect(encounter?.unitId).toBe('unit-b');
  });

  it('persists ready-for-discharge toggle and undo for encounters', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(markEncounterReadyForDischarge).toHaveBeenCalledWith('enc-1');
    });
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(undoEncounterReadyForDischarge).toHaveBeenCalledWith('enc-1');
    });
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(false);
  });

  it('wires active step callbacks from Diagnostics through Invoice', async () => {
    mockStepParam = 'DIAGNOSTICS';
    const { rerender } = render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mock open treatment' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=TREATMENT',
      {
        scroll: false,
      }
    );

    mockStepParam = 'TREATMENT';
    act(() => {
      useAppointmentWorkspaceStore.getState().setActiveStep('TREATMENT');
    });
    rerender(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mock open invoice' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=INVOICE',
      {
        scroll: false,
      }
    );

    act(() => {
      useAppointmentWorkspaceStore.getState().setActiveStep('TREATMENT');
    });
    rerender(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    // "Skip to Summary" now lives in the meta bar (treatment primary CTA).
    fireEvent.click(screen.getByRole('button', { name: /skip to summary/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=SUMMARY',
      {
        scroll: false,
      }
    );

    mockStepParam = 'INVOICE';
    act(() => {
      useAppointmentWorkspaceStore.getState().setActiveStep('INVOICE');
    });
    rerender(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mock open summary' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=SUMMARY',
      {
        scroll: false,
      }
    );
  });

  it('lands on read-only Summary when the appointment is past the lock window', async () => {
    render(
      <AppointmentWorkspace appointment={makeAppointment(new Date('2026-04-20T09:00:00Z'))} />
    );

    await waitFor(() => expect(useAppointmentWorkspaceStore.getState().activeStep).toBe('SUMMARY'));
    expect(screen.getByText('Summary read only: true')).toBeInTheDocument();
  });
});
