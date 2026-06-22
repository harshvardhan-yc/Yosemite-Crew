import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import {
  loadAppointmentBilling,
  seedAppointmentInvoice,
} from '@/app/features/billing/services/invoiceService';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  __esModule: true,
  loadAppointmentBilling: jest.fn(),
  seedAppointmentInvoice: jest.fn(),
  addLineItemsToAppointments: jest.fn(),
  finalizeFinanceInvoice: jest.fn(),
  getPaymentLink: jest.fn(),
  recordManualInvoicePayment: jest.fn(),
  createFinanceInvoice: jest.fn(),
}));

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  __esModule: true,
  fetchInventoryItems: jest.fn(),
}));

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  __esModule: true,
  mapApiItemToInventoryItem: (item: unknown) => item,
}));

const mockLoadAppointmentBilling = loadAppointmentBilling as jest.Mock;
const mockSeedAppointmentInvoice = seedAppointmentInvoice as jest.Mock;
const mockFetchInventoryItems = fetchInventoryItems as jest.Mock;

expect.extend(toHaveNoViolations);

const APPT = 'appt-invoice';

const reset = () => {
  jest.clearAllMocks();
  mockLoadAppointmentBilling.mockResolvedValue({
    pastInvoices: [],
    depositCents: 0,
    invoicedItemNames: [],
  });
  mockFetchInventoryItems.mockResolvedValue([]);
  mockSeedAppointmentInvoice.mockResolvedValue({ id: 'inv-seed' });
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'INVOICE',
    activeSideAction: null,
  });
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
    status: 'idle',
    error: undefined,
    loadedSpecialityIds: [],
  });
};

const seedAndGet = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, mode);
  useAppointmentWorkspaceStore.setState((state) => ({
    encountersById: {
      ...state.encountersById,
      [APPT]: {
        ...state.encountersById[APPT],
        depositCents: 120000,
        taxPercent: 7,
        overallDiscountPercent: 5,
        services: [
          {
            id: 'svc-line-bandage',
            refId: 'svc-bandage',
            kind: 'SERVICE',
            name: 'Bandage change',
            qty: 1,
            instructions: 'Change dressing',
            unitPriceCents: 6000,
            amountCents: 6000,
          },
          {
            id: 'svc-line-hospital',
            refId: 'svc-hospital-day',
            kind: 'SERVICE',
            name: 'Hospitalization day charge',
            qty: 1,
            instructions: 'Daily inpatient care',
            unitPriceCents: 12000,
            amountCents: 12000,
          },
        ],
        invoiceLineItems: [
          {
            id: 'inv-1',
            name: 'Initial Consultation',
            unitPriceCents: 10000,
            qty: 1,
            grossCents: 10000,
            discountCents: 1000,
            amountCents: 9000,
          },
          {
            id: 'inv-3',
            name: 'X-Ray Imaging',
            unitPriceCents: 20000,
            qty: 1,
            grossCents: 20000,
            discountCents: 2000,
            amountCents: 18000,
          },
        ],
        pastInvoices: [
          {
            id: '20560DTH',
            createdAt: '2026-04-20T12:00:00Z',
            totalCents: 41500,
            outstandingCents: 0,
            status: 'PAID_FULL',
            byName: 'Rachel Sanders',
            paidByName: 'Rachel Sanders',
            paidAt: '2026-04-20T13:15:00Z',
            paymentMethod: 'CASH',
            paidFromDeposit: true,
            items: [
              {
                id: 'pi-1',
                name: 'Initial Consultation',
                unitPriceCents: 10000,
                qty: 1,
                grossCents: 10000,
                discountCents: 1000,
                amountCents: 9000,
              },
            ],
          },
        ],
      },
    },
  }));
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

const getEnc = () => useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;

const renderInvoice = (
  encounter: AppointmentEncounter,
  onOpenSummary = jest.fn(),
  hideBillBuilder = false,
  organisationId?: string
) => {
  render(
    <InvoiceStep
      appointmentId={APPT}
      encounter={encounter}
      organisationId={organisationId}
      hideBillBuilder={hideBillBuilder}
      onOpenSummary={onOpenSummary}
    />
  );
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

  it('searches active catalog services when treatment has no billable items', async () => {
    useRevampCatalogStore.setState({
      services: [
        {
          id: 'svc-catalog-ultrasound',
          code: 'PR-0001',
          name: 'Ultrasound scan',
          description: 'Abdominal ultrasound',
          type: 'PROCEDURE',
          specialityId: 'spec-1',
          organisationId: 'org-1',
          grossAmount: 85,
          currency: 'USD',
          defaultDiscount: 0,
          maxDiscount: 10,
          durationMinutes: 30,
          isBookable: true,
          isInpatientPreferred: false,
          status: 'ACTIVE',
          createdAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
    const enc = { ...seedAndGet(), services: [], prescription: [] };
    renderInvoice(enc, jest.fn(), false, 'org-1');

    // The org-scoped load effects fire on mount; let them settle before asserting.
    await waitFor(() => expect(mockLoadAppointmentBilling).toHaveBeenCalledWith('org-1', APPT));
    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'ultrasound' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ultrasound scan/i }));

    expect(getEnc().invoiceLineItems.at(-1)?.name).toBe('Ultrasound scan');
  });

  it('lists in-house medications and inventory items with a type pill in search', async () => {
    mockFetchInventoryItems.mockResolvedValue([
      {
        id: 'inv-amoxi',
        status: 'ACTIVE',
        basicInfo: { name: 'Amoxicillin 250mg' },
        pricing: { selling: '12' },
      },
    ]);
    const enc = {
      ...seedAndGet(),
      services: [],
      invoiceLineItems: [],
      prescription: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          fulfillment: 'IN_HOUSE' as const,
          priceCents: 1500,
        },
      ],
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');

    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'carprofen' },
    });
    const medRow = screen.getByRole('button', { name: /carprofen/i });
    expect(within(medRow).getByText('In-house prescription')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'amoxicillin' },
    });
    const invRow = await screen.findByRole('button', { name: /amoxicillin/i });
    expect(within(invRow).getByText('Stock item')).toBeInTheDocument();
  });

  it('hydrates existing invoices and deposit from finance on mount', async () => {
    mockLoadAppointmentBilling.mockResolvedValue({
      pastInvoices: [
        {
          id: 'finance-inv-99',
          createdAt: '2026-05-02T09:00:00Z',
          totalCents: 7500,
          outstandingCents: 7500,
          status: 'UNPAID',
          items: [],
        },
      ],
      depositCents: 20000,
      invoicedItemNames: [],
    });
    const enc = { ...seedAndGet(), pastInvoices: [] } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');

    await waitFor(() => expect(mockLoadAppointmentBilling).toHaveBeenCalledWith('org-1', APPT));
    await waitFor(() =>
      expect(getEnc().pastInvoices.some((invoice) => invoice.id === 'finance-inv-99')).toBe(true)
    );
    expect(getEnc().depositCents).toBe(20000);
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

  it('records a cash payment as a finalized invoice and clears the bill', async () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    expect(await screen.findByText(/paid via cash recorded/i)).toBeInTheDocument();
    await waitFor(() => expect(getEnc().invoiceLineItems).toHaveLength(0));
    const newest = getEnc().pastInvoices[0];
    expect(newest.paymentMethod).toBe('CASH');
    expect(newest.status).toBe('PAID_FULL');
    expect(newest.paidByName).toBe('Front desk');
  });

  it('prepares an online payment without marking it paid locally', async () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /pay online/i }));
    expect(await screen.findByText(/invoice prepared for online payment/i)).toBeInTheDocument();
    expect(getEnc().pastInvoices[0].paymentMethod).not.toBe('ONLINE');
  });

  it('collects a deposit payment and reduces the remaining deposit', () => {
    const enc = seedAndGet();
    const startDeposit = enc.depositCents;
    renderInvoice(enc);

    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i }).at(-1)!);

    const after = getEnc();
    expect(after.pastInvoices[0].paymentMethod).toBe('CASH');
    expect(after.depositCents).toBeGreaterThan(startDeposit);
  });

  it('does not record an invoice payment when there are no line items', () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    const before = getEnc().pastInvoices.length;
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));
    expect(getEnc().pastInvoices.length).toBe(before);
  });

  it('allows deposit collection when there are no invoice line items', () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    const beforeDeposit = getEnc().depositCents;
    renderInvoice(enc);

    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i })[0]);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25' } });
    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i }).at(-1)!);

    expect(getEnc().depositCents).toBe(beforeDeposit + 2500);
    expect(getEnc().pastInvoices[0].paymentMethod).toBe('CASH');
  });

  it('renders the inpatient send-to-client action', async () => {
    const enc = seedAndGet('INPATIENT');
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /send to client/i }));
    expect(await screen.findByText(/invoice prepared for online payment/i)).toBeInTheDocument();
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

  it('hides the bill builder while keeping past invoices visible for completed appointments', () => {
    const enc = seedAndGet();
    renderInvoice(enc, jest.fn(), true);

    expect(screen.queryByText('Total Bill')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay online/i })).not.toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText(/ID - 20560DTH/i)).toBeInTheDocument();
  });

  it('completes the invoice and opens the summary', () => {
    const enc = seedAndGet();
    const { onOpenSummary } = renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));

    expect(onOpenSummary).toHaveBeenCalled();
    expect(getEnc().stepStatus.INVOICE).toBe('COMPLETED');
  });

  it('blocks finalize and flags the row when a billed in-house medication is missing details', () => {
    const enc = {
      ...seedAndGet(),
      invoiceLineItems: [
        {
          id: 'inv-rx',
          name: 'Carprofen',
          unitPriceCents: 1500,
          qty: 1,
          grossCents: 1500,
          discountCents: 0,
          amountCents: 1500,
        },
      ],
      prescription: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          fulfillment: 'IN_HOUSE' as const,
          priceCents: 1500,
        },
      ],
    } as AppointmentEncounter;
    const { onOpenSummary } = renderInvoice(enc);

    // Row carries the "fill information" hint, and finalize is blocked.
    expect(screen.getByLabelText('Fill information in previous step')).toBeInTheDocument();
    expect(
      screen.getByText(/fill prescription details in the treatment step/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));
    expect(onOpenSummary).not.toHaveBeenCalled();
    expect(getEnc().stepStatus.INVOICE).not.toBe('COMPLETED');
  });

  it('allows finalize once the billed medication has full prescription details', () => {
    const enc = {
      ...seedAndGet(),
      invoiceLineItems: [
        {
          id: 'inv-rx',
          name: 'Carprofen',
          unitPriceCents: 1500,
          qty: 1,
          grossCents: 1500,
          discountCents: 0,
          amountCents: 1500,
        },
      ],
      prescription: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          fulfillment: 'IN_HOUSE' as const,
          priceCents: 1500,
          dosage: '50mg',
          route: 'Oral',
          frequency: 'BID',
          durationDays: '5',
        },
      ],
    } as AppointmentEncounter;
    const { onOpenSummary } = renderInvoice(enc);

    expect(screen.queryByLabelText('Fill information in previous step')).not.toBeInTheDocument();

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
