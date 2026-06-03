import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import AppointmentWorkspace from '@/app/features/appointments/pages/AppointmentWorkspace';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';

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
  }: {
    appointmentReason: string;
    encounter: AppointmentEncounter;
    onRecordVitals: () => void;
  }) => (
    <div>
      SOAP read only: {String(encounter.viewOnly)}
      <span>SOAP reason: {appointmentReason}</span>
      <button type="button" onClick={onRecordVitals}>
        Mock record vitals
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
  default: ({
    onOpenInvoice,
    onSkipToSummary,
  }: {
    onOpenInvoice: () => void;
    onSkipToSummary: () => void;
  }) => (
    <div>
      <button type="button" onClick={onOpenInvoice}>
        Mock open invoice
      </button>
      <button type="button" onClick={onSkipToSummary}>
        Mock skip summary
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

const makeAppointment = (startTime: Date, inpatient = false): Appointment => ({
  id: 'appt-workspace',
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
  mockStepParam = null;
  (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([]);
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
    fireEvent.click(screen.getByRole('button', { name: /close quick actions/i }));
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
      { id: 'room-1', name: 'Ward A', unitCount: 2 },
      { id: 'room-2', name: 'Ward B', units: [{ id: 'unit-b', name: 'B', occupied: false }] },
    ]);
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /room: ward a/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ward B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unit' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.roomId).toBe('room-2');
    expect(encounter?.unitId).toBe('unit-b');
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
    fireEvent.click(screen.getByRole('button', { name: 'Mock skip summary' }));
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
