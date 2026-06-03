import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import TreatmentStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';

expect.extend(toHaveNoViolations);

const APPT = 'appt-treatment';

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'TREATMENT',
    activeSideAction: null,
  });

const seedAndGet = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, mode);
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

describe('TreatmentStep', () => {
  beforeEach(reset);

  it('filters service and medication add lists', () => {
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/search for services and packages/i), {
      target: { value: 'arthritis' },
    });
    expect(screen.queryByRole('button', { name: /physical examination/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arthritis care package/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search medicines/i), {
      target: { value: 'carprofen' },
    });
    expect(screen.queryByRole('button', { name: /gabapentin/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /carprofen/i })).toBeInTheDocument();
  });

  it('renders services, packages and prescription sections', () => {
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    expect(screen.getByText('Services & Packages')).toBeInTheDocument();
    expect(screen.getAllByText('Prescription').length).toBeGreaterThan(0);
    expect(screen.getByText('SC Injection - Cerenia 0.5ml')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
  });

  it('adds and removes services from the workspace store', () => {
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /physical examination/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.services.at(-1)?.name).toBe(
      'Physical examination'
    );

    fireEvent.click(screen.getByRole('button', { name: /remove acupuncture/i }));
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.services.find((item) => item.name === 'Acupuncture')
    ).toBeUndefined();
  });

  it('expands package breakdown using the dark view action', () => {
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /view sc injection - cerenia 0.5ml breakdown/i })
    );

    expect(screen.getByText('Syringe')).toBeInTheDocument();
    expect(screen.getByText('Cerenia (injectable medicine)')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /hide sc injection - cerenia 0.5ml breakdown/i })
    );
    expect(screen.queryByText('Syringe')).not.toBeInTheDocument();
  });

  it('copies service and prescription row values', () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /copy acupuncture/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy instructions for acupuncture/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy amoxicillin/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy instructions for amoxicillin/i }));

    expect(writeText).toHaveBeenCalledWith('Acupuncture');
    expect(writeText).toHaveBeenCalledWith('Amoxicillin');
    expect(writeText).toHaveBeenCalledWith('-');
    expect(writeText).toHaveBeenCalledWith('Finish the entire course');
  });

  it('adds prescriptions, updates fulfillment and removes medication', () => {
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /gabapentin/i }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription.at(-1)?.medicineName
    ).toBe('Gabapentin');

    fireEvent.click(screen.getAllByRole('button', { name: /prescription only/i })[0]);
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0].fulfillment
    ).toBe('PRESCRIPTION_ONLY');

    fireEvent.click(screen.getByRole('button', { name: /remove prednisone/i }));
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.prescription.find((item) => item.medicineName === 'Prednisone')
    ).toBeUndefined();
  });

  it('renders prescription fallback values for incomplete medication rows', () => {
    const enc = {
      ...seedAndGet(),
      prescription: [
        { id: 'rx-min', medicineName: 'Minimal med', fulfillment: 'IN_HOUSE' as const },
      ],
    };
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    expect(screen.getByText('Minimal med')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(5);
  });

  it('prints prescriptions and saves treatment to invoice', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const onOpenInvoice = jest.fn();
    const enc = seedAndGet();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={onOpenInvoice}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /prescription/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    expect(printSpy).toHaveBeenCalled();
    expect(onOpenInvoice).toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT).toBe(
      'COMPLETED'
    );
    printSpy.mockRestore();
  });

  it('renders inpatient schedule and adds a manual task', () => {
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    const before = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule.length;
    fireEvent.click(screen.getByRole('button', { name: /add schedule task/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule).toHaveLength(
      before + 1
    );
  });

  it('updates inpatient schedule rows', () => {
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /hide record observation for analgesic/i }));
    fireEvent.click(screen.getByRole('button', { name: /view record observation for analgesic/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /reschedule record observation for analgesic/i })
    );

    const task = useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0];
    expect(task?.time).toBe('5:40 PM');
  });

  it('uses inpatient schedule dropdowns and secondary controls', () => {
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /filter schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /schedule filters/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    fireEvent.click(screen.getAllByRole('button', { name: /status/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    const task = useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0];
    expect(task?.assignedToName).toBe('Dr. Tim Apple');
    expect(task?.status).toBe('PENDING');
  });

  it('filters inpatient schedule tasks to an empty state', () => {
    const enc = seedAndGet('INPATIENT');
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/search schedule tasks/i), {
      target: { value: 'not in schedule' },
    });

    expect(screen.getByText('No schedule tasks match this search.')).toBeInTheDocument();
  });

  it('skips to summary', () => {
    const enc = seedAndGet();
    const onSkipToSummary = jest.fn();
    render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={onSkipToSummary}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip to summary/i }));

    expect(onSkipToSummary).toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT).toBe(
      'COMPLETED'
    );
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(
      <TreatmentStep
        appointmentId={APPT}
        encounter={enc}
        onOpenInvoice={jest.fn()}
        onSkipToSummary={jest.fn()}
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
