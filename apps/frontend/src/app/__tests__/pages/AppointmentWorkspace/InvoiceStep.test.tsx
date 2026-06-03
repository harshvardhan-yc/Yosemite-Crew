import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

expect.extend(toHaveNoViolations);

const APPT = 'appt-invoice';

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'INVOICE',
    activeSideAction: null,
  });

const seedAndGet = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, mode);
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

const renderInvoice = (encounter: AppointmentEncounter, onOpenSummary = jest.fn()) => {
  render(<InvoiceStep appointmentId={APPT} encounter={encounter} onOpenSummary={onOpenSummary} />);
  return { onOpenSummary };
};

describe('InvoiceStep', () => {
  beforeEach(reset);

  it('renders total bill rows, totals and past invoices', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    expect(screen.getByText('Total Bill')).toBeInTheDocument();
    expect(screen.getAllByText('Initial Consultation').length).toBeGreaterThan(0);
    expect(screen.getByText('Past Invoices')).toBeInTheDocument();
    expect(screen.getByText(/Estimated Total/)).toBeInTheDocument();
  });

  it('adds and removes invoice line items', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'bandage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bandage change' }));
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.invoiceLineItems.at(-1)?.name
    ).toBe('Bandage change');

    fireEvent.click(screen.getByRole('button', { name: /remove x-ray imaging/i }));
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)
        ?.invoiceLineItems.find((item) => item.name === 'X-Ray Imaging')
    ).toBeUndefined();
  });

  it('uses the dark add button with the current first search match', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'hospital' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add invoice item/i }));

    expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.invoiceLineItems.at(-1)?.name
    ).toBe('Hospitalization day charge');
  });

  it('toggles deposit withdrawal', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByLabelText(/withdraw deposit/i));

    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.withdrawDeposit).toBe(true);
  });

  it('selects outpatient payment actions', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /payment method/i }));
    fireEvent.click(screen.getByRole('button', { name: /pay online/i }));
    expect(screen.getByText('Online payment selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /payment method/i }));
    fireEvent.click(screen.getByRole('button', { name: /pay via cash/i }));
    expect(screen.getByText('Cash payment selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /payment method/i }));
    fireEvent.click(screen.getByRole('button', { name: /pay via card/i }));
    expect(screen.getByText('Card payment selected')).toBeInTheDocument();
  });

  it('renders inpatient payment actions', () => {
    const enc = seedAndGet('INPATIENT');
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /send to client/i }));
    expect(screen.getByText('Online payment selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /payment method/i }));
    fireEvent.click(screen.getByRole('button', { name: /collect deposit/i }));
    expect(screen.getByText('Deposit collection selected')).toBeInTheDocument();
  });

  it('toggles past invoice details and action icons', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    expect(screen.getByText('Invoice Paid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hide invoice 20560dth/i }));
    expect(screen.queryByText('Invoice Paid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view invoice 20560dth/i }));
    fireEvent.click(screen.getByRole('button', { name: /download invoice 20560dth/i }));
    fireEvent.click(screen.getByRole('button', { name: /share invoice 20560dth/i }));
    expect(screen.getByText('Invoice Paid')).toBeInTheDocument();
  });

  it('shows empty states and read-only disabled controls', () => {
    const enc = {
      ...seedAndGet(),
      viewOnly: true,
      invoiceLineItems: [],
      pastInvoices: [],
    };
    renderInvoice(enc);

    expect(screen.getByText('No invoice line items added yet.')).toBeInTheDocument();
    expect(screen.getByText('No past invoices recorded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add invoice item/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /summary/i })).toBeDisabled();
  });

  it('completes invoice and opens summary', () => {
    const enc = seedAndGet();
    const { onOpenSummary } = renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));

    expect(onOpenSummary).toHaveBeenCalled();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.stepStatus.INVOICE).toBe(
      'COMPLETED'
    );
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(
      <InvoiceStep appointmentId={APPT} encounter={enc} onOpenSummary={jest.fn()} />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
