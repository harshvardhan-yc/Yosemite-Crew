import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const getEnc = () => useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;

const renderInvoice = (encounter: AppointmentEncounter, onOpenSummary = jest.fn()) => {
  render(<InvoiceStep appointmentId={APPT} encounter={encounter} onOpenSummary={onOpenSummary} />);
  return { onOpenSummary };
};

describe('InvoiceStep', () => {
  beforeEach(reset);

  it('renders the bill rows, totals and invoices section', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    expect(screen.getByText('Total Bill')).toBeInTheDocument();
    expect(screen.getAllByText('Initial Consultation').length).toBeGreaterThan(0);
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText(/Estimated Total/)).toBeInTheDocument();
  });

  it('adds and removes invoice line items via search', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'bandage' },
    });
    fireEvent.click(screen.getByRole('button', { name: /bandage change/i }));
    expect(getEnc().invoiceLineItems.at(-1)?.name).toBe('Bandage change');

    fireEvent.click(screen.getByRole('button', { name: /remove x-ray imaging/i }));
    expect(getEnc().invoiceLineItems.find((item) => item.name === 'X-Ray Imaging')).toBeUndefined();
  });

  it('uses the dark add button with the current first search match', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'hospital' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add invoice item/i }));

    expect(getEnc().invoiceLineItems.at(-1)?.name).toBe('Hospitalization day charge');
  });

  it('does nothing when the dark add button has no current match', () => {
    const enc = seedAndGet();
    const before = getEnc().invoiceLineItems.length;
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /add invoice item/i }));
    expect(getEnc().invoiceLineItems.length).toBe(before);
  });

  it('edits a line quantity and re-derives gross/amount', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const item = enc.invoiceLineItems.find((i) => i.name === 'X-Ray Imaging')!;
    fireEvent.change(screen.getByLabelText(`Quantity for ${item.name}`), {
      target: { value: '3' },
    });

    const updated = getEnc().invoiceLineItems.find((i) => i.id === item.id)!;
    expect(updated.qty).toBe(3);
    expect(updated.grossCents).toBe(item.unitPriceCents * 3);
    expect(updated.amountCents).toBe(updated.grossCents - updated.discountCents);
  });

  it('clamps an invalid quantity to at least one', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const item = enc.invoiceLineItems[0];
    fireEvent.change(screen.getByLabelText(`Quantity for ${item.name}`), {
      target: { value: '0' },
    });
    expect(getEnc().invoiceLineItems[0].qty).toBe(1);
  });

  it('edits a line discount (in dollars) and re-derives the amount', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const item = enc.invoiceLineItems[0];
    fireEvent.change(screen.getByLabelText(`Discount for ${item.name}`), {
      target: { value: '7.5' },
    });

    const updated = getEnc().invoiceLineItems.find((i) => i.id === item.id)!;
    expect(updated.discountCents).toBe(750);
    expect(updated.amountCents).toBe(updated.grossCents - 750);
  });

  it('edits the overall discount percent', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/overall discount percent/i), {
      target: { value: '12' },
    });
    expect(getEnc().overallDiscountPercent).toBe(12);
  });

  it('toggles deposit withdrawal', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByLabelText(/withdraw from deposit/i));
    expect(getEnc().withdrawDeposit).toBe(true);
  });

  it('records a cash payment as a finalized invoice and clears the bill', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    expect(screen.getByText(/paid via cash recorded/i)).toBeInTheDocument();
    expect(getEnc().invoiceLineItems).toHaveLength(0);
    const newest = getEnc().pastInvoices[0];
    expect(newest.paymentMethod).toBe('CASH');
    expect(newest.status).toBe('PAID_FULL');
    expect(newest.paidByName).toBe('Dr. Tim Apple');
  });

  it('records an online payment', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /pay online/i }));
    expect(getEnc().pastInvoices[0].paymentMethod).toBe('ONLINE');
  });

  it('collects a deposit payment and reduces the remaining deposit', () => {
    const enc = seedAndGet();
    const startDeposit = enc.depositCents;
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect deposit/i }));

    const after = getEnc();
    expect(after.pastInvoices[0].paymentMethod).toBe('DEPOSIT');
    expect(after.pastInvoices[0].paidFromDeposit).toBe(true);
    expect(after.depositCents).toBeLessThan(startDeposit);
  });

  it('does not record a payment when there are no line items', () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    const before = getEnc().pastInvoices.length;
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));
    expect(getEnc().pastInvoices.length).toBe(before);
  });

  it('renders the inpatient send-to-client action', () => {
    const enc = seedAndGet('INPATIENT');
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /send to client/i }));
    expect(screen.getByText(/invoice sent to client/i)).toBeInTheDocument();
  });

  it('omits send-to-client for outpatient encounters', () => {
    const enc = seedAndGet('OUTPATIENT');
    renderInvoice(enc);
    expect(screen.queryByRole('button', { name: /send to client/i })).not.toBeInTheDocument();
  });

  it('expands an invoice to show its breakdown and settled badge', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    // The first invoice is expanded by default.
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Withdrawn from Deposit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide invoice 20560dth/i }));
    expect(screen.queryByText('Breakdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view invoice 20560dth/i }));
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
  });

  it('shows the finalized payment stamp for a paid invoice', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    expect(screen.getByText('By Rachel Sanders')).toBeInTheDocument();
    expect(screen.getByText('Paid via Cash')).toBeInTheDocument();
  });

  it('exposes download and share actions while editable', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /download invoice 20560dth/i }));
    fireEvent.click(screen.getByRole('button', { name: /share invoice 20560dth/i }));
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('shows an "Invoice Paid" badge when the invoice was not from deposit', () => {
    const base = seedAndGet();
    const enc = {
      ...base,
      pastInvoices: [{ ...base.pastInvoices[0], paidFromDeposit: false }],
    };
    renderInvoice(enc);
    expect(screen.getByText('Invoice Paid')).toBeInTheDocument();
  });

  describe('completed / read-only encounter', () => {
    it('hides the bill builder and payment controls', () => {
      const enc = { ...seedAndGet(), viewOnly: true };
      renderInvoice(enc);

      expect(screen.queryByText('Total Bill')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /collect cash/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });

    it('hides the share action but keeps view/download', () => {
      const enc = { ...seedAndGet(), viewOnly: true };
      renderInvoice(enc);

      expect(
        screen.queryByRole('button', { name: /share invoice 20560dth/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /download invoice 20560dth/i })
      ).toBeInTheDocument();
    });

    it('shows the empty invoices state when there are none', () => {
      const enc = { ...seedAndGet(), viewOnly: true, pastInvoices: [] };
      renderInvoice(enc);
      expect(screen.getByText('No invoices recorded yet.')).toBeInTheDocument();
    });
  });

  it('shows the empty bill state when no line items are present', () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    renderInvoice(enc);
    expect(screen.getByText('No invoice line items added yet.')).toBeInTheDocument();
  });

  it('completes the invoice and opens the summary', () => {
    const enc = seedAndGet();
    const { onOpenSummary } = renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));

    expect(onOpenSummary).toHaveBeenCalled();
    expect(getEnc().stepStatus.INVOICE).toBe('COMPLETED');
  });

  it('renders the breakdown column headings', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const breakdown = screen.getByText('Breakdown').closest('div')!;
    expect(within(breakdown).getAllByText('Gross Amt.').length).toBeGreaterThan(0);
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(
      <InvoiceStep appointmentId={APPT} encounter={enc} onOpenSummary={jest.fn()} />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
