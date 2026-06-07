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
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

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
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('Services & Packages')).toBeInTheDocument();
    expect(screen.getAllByText('Prescription').length).toBeGreaterThan(0);
    expect(screen.getByText(/SC Injection - Cerenia 0\.5ml/)).toBeInTheDocument();
    expect(screen.getByText(/Amoxicillin - 625/)).toBeInTheDocument();
  });

  it('renders Rx badges, stock-health pills and numbered medication rows', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Each prescription row has a numbered name + an Rx badge.
    expect(screen.getByText(/^1\. Amoxicillin - 625$/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Prescription').length).toBeGreaterThan(0);
    // Stock health pills: Amoxicillin (14) in stock, Prednisone (3) low stock.
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    // Each row shows the line price at the right end and a Refill field.
    expect(screen.getByText('$165')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Refill').length).toBeGreaterThan(0);
    // Fulfillment is a pill dropdown (not checkboxes), defaulting to the value.
    expect(screen.getAllByRole('button', { name: /fulfillment/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('In-house fulfilled').length).toBeGreaterThan(0);
    // The old "Medication" tag no longer appears on the cards.
    expect(screen.queryByText('Medication')).not.toBeInTheDocument();
  });

  it('adds and removes services from the workspace store', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Adding is search-driven: type to surface the result, then click it.
    fireEvent.change(screen.getByLabelText(/search for services and packages/i), {
      target: { value: 'physical' },
    });
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

  it('edits a service quantity and re-derives the amount', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    const first = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.services[0];
    const qtyInput = screen.getByLabelText(`Quantity for ${first.name}`);
    fireEvent.change(qtyInput, { target: { value: '3' } });
    const updated = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.services[0];
    expect(updated.qty).toBe(3);
    expect(updated.amountCents).toBe(first.unitPriceCents * 3);
  });

  it('adds items purely from the search results (no click-to-add box)', () => {
    const enc = { ...seedAndGet(), services: [], prescription: [] };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The dashed "click to search and add" boxes are gone — adding is search-only.
    expect(screen.queryByText(/click to search and add/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search for services and packages/i), {
      target: { value: 'physical' },
    });
    fireEvent.click(screen.getByRole('button', { name: /physical examination/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.services.at(-1)?.name).toBe(
      'Physical examination'
    );
  });

  it('expands package breakdown using the dark view action', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

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
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /copy acupuncture/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy instructions for acupuncture/i }));
    // The medication instructions field has its own inline copy button ("Copy
    // instructions", with no "for <name>" suffix).
    fireEvent.click(screen.getAllByRole('button', { name: /^copy instructions$/i })[0]);

    // Service name + instructions are copy-able; the medication instructions copy
    // icon copies the first prescription's instruction text.
    expect(writeText).toHaveBeenCalledWith('Acupuncture');
    expect(writeText).toHaveBeenCalledWith('Do not skip dosage');
  });

  it('adds prescriptions, updates fulfillment and removes medication', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Adding is search-driven: type to surface the medication, then click it.
    fireEvent.change(screen.getByLabelText(/search medicines/i), {
      target: { value: 'gabapentin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gabapentin/i }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription.at(-1)?.medicineName
    ).toBe('Gabapentin');

    // Fulfillment is a compact pill dropdown: open it, then pick the option.
    fireEvent.click(screen.getAllByRole('button', { name: /fulfillment/i })[0]);
    fireEvent.mouseDown(screen.getByRole('option', { name: /prescription only/i }));
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

  it('renders empty editable inputs for incomplete medication rows', () => {
    const enc = {
      ...seedAndGet(),
      prescription: [
        { id: 'rx-min', medicineName: 'Minimal med', fulfillment: 'IN_HOUSE' as const },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText(/Minimal med/)).toBeInTheDocument();
    // The editable cells (dose/route/freq/duration/refill/instructions) render as
    // empty floating-label input boxes for a row that has no values yet.
    expect((screen.getByLabelText('Dose') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Duration') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Instructions') as HTMLInputElement).value).toBe('');
  });

  it('edits a prescription field through the floating-label input', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    const dosageInputs = screen.getAllByLabelText('Dose');
    fireEvent.change(dosageInputs[0], { target: { value: '250mg' } });
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.prescription[0].dosage).toBe(
      '250mg'
    );
  });

  it('prints prescriptions and saves treatment to invoice', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const onOpenInvoice = jest.fn();
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={onOpenInvoice} />);

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
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    const before = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule.length;
    fireEvent.click(screen.getByRole('button', { name: /add schedule task/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule).toHaveLength(
      before + 1
    );
  });

  it('updates inpatient schedule rows', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /hide record observation for analgesic/i }));
    fireEvent.click(screen.getByRole('button', { name: /view record observation for analgesic/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /reschedule record observation for analgesic/i })
    );

    const task = useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0];
    expect(task?.time).toBe('5:40 PM');
  });

  it('uses inpatient schedule dropdowns, day controls and status pill', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Header day navigation + filter are present and clickable.
    fireEvent.click(screen.getByRole('button', { name: /filter schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }));
    fireEvent.click(screen.getByRole('button', { name: /next day/i }));
    // The first row is expanded by default, exposing the breakdown Record button.
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    // Assign the first task via its Assigned-to dropdown.
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0].assignedToName
    ).toBe('Dr. Tim Apple');

    // The status pill only renders for changeable (non-completed) tasks. Change
    // the first such task to Pending.
    const before = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule;
    const changeableIndex = before.findIndex((t) => t.status !== 'COMPLETED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' })[0]);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Pending' }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[changeableIndex].status
    ).toBe('PENDING');
  });

  it('locks the status of completed schedule tasks (no caret, not changeable)', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The mock schedule has a COMPLETED task; its status renders as a static pill
    // (a "Completed" label that is not a Status dropdown button).
    expect(screen.getByText('Completed')).toBeInTheDocument();
    const statusButtons = screen.getAllByRole('button', { name: 'Status' });
    const completedCount = enc.schedule.filter((t) => t.status === 'COMPLETED').length;
    const changeableCount = enc.schedule.filter((t) => t.status !== 'COMPLETED').length;
    expect(completedCount).toBeGreaterThan(0);
    expect(statusButtons).toHaveLength(changeableCount);
  });

  it('updates the task start date and time through the shared pickers', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // Open the Starts datepicker and pick a day -> updates the task's startDate.
    fireEvent.click(screen.getByRole('button', { name: /^Starts, toggle calendar$/i }));
    const dayCells = document.querySelectorAll(
      '.react-datepicker__day:not(.react-datepicker__day--outside-month)'
    );
    fireEvent.click(dayCells[10]);
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0].startDate
    ).toMatch(/\d{4}/);

    // Open the Set Time picker and pick a time -> updates the task's time (12h).
    fireEvent.click(screen.getByRole('button', { name: /Set Time/i }));
    const timeCells = document.querySelectorAll('.react-datepicker__time-list-item');
    fireEvent.click(timeCells[3]);
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.schedule[0].time).toMatch(
      /(AM|PM)/
    );
  });

  it('reuses the shared date and time pickers in the task breakdown', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The first row is expanded by default; the breakdown reuses the shared
    // Datepicker (Starts/Ends) and Timepicker (Set Time). The first task's time
    // (10:00 AM) is shown in 24-hour form by the Timepicker.
    expect(screen.getByRole('button', { name: /^Starts, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ends, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set Time: 10:00/i })).toBeInTheDocument();
  });

  it('filters inpatient schedule tasks to an empty state', () => {
    const enc = seedAndGet('INPATIENT');
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/search schedule tasks/i), {
      target: { value: 'not in schedule' },
    });

    expect(screen.getByText('No schedule tasks match this search.')).toBeInTheDocument();
  });

  it('renders empty date/time pickers for a task with no time or dates', () => {
    const enc = {
      ...seedAndGet('INPATIENT'),
      schedule: [
        {
          id: 'sch-min',
          description: 'Bare task',
          category: 'Care' as const,
          status: 'UPCOMING' as const,
          autoGenerated: false,
        },
      ],
    };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The row is expanded by default; the pickers render empty (label-only) with
    // no pre-filled value.
    expect(screen.getByRole('button', { name: /^Starts, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ends, toggle calendar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Time' })).toBeInTheDocument();
  });

  it('shows empty states when there are no services or prescriptions', () => {
    const enc = { ...seedAndGet(), services: [], prescription: [] };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    expect(screen.getByText('No services or packages added yet.')).toBeInTheDocument();
    expect(screen.getByText('No prescription items added yet.')).toBeInTheDocument();
  });

  it('prints from the prescription print icon', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The prescription print icon (top of the section) triggers print.
    fireEvent.click(screen.getByRole('button', { name: 'Print prescription' }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('renders read-only treatment sections without editing affordances', () => {
    const enc = { ...seedAndGet('INPATIENT'), viewOnly: true };
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);

    // The "click to search and add" dashed containers are hidden in view-only mode.
    expect(screen.queryByText(/click to search and add service/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click to search and add medication/i)).not.toBeInTheDocument();
    // Prescription fields keep the floating-label input style but are read-only.
    const dosage = screen.getAllByLabelText('Dose')[0] as HTMLInputElement;
    expect(dosage).toHaveAttribute('readonly');
    expect(dosage.value).toBe('1 tab');
    // Schedule Add control and the breakdown Record button are disabled.
    expect(screen.getByRole('button', { name: /add schedule task/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Record$/i })).toBeDisabled();
  });

  it('does not render an in-step Skip to Summary button (it lives in the meta bar)', () => {
    const enc = seedAndGet();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /skip to summary/i })).not.toBeInTheDocument();
  });

  it('saves the treatment, completing the step and opening the invoice', () => {
    const enc = seedAndGet();
    const onOpenInvoice = jest.fn();
    render(<TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={onOpenInvoice} />);

    fireEvent.click(screen.getByRole('button', { name: /save treatment/i }));

    expect(onOpenInvoice).toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.TREATMENT).toBe(
      'COMPLETED'
    );
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(
      <TreatmentStep appointmentId={APPT} encounter={enc} onOpenInvoice={jest.fn()} />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
