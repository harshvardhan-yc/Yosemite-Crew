import React, { useMemo, useState } from 'react';
import {
  LuArrowRight,
  LuBanknote,
  LuCheck,
  LuCreditCard,
  LuDownload,
  LuEye,
  LuEyeOff,
  LuShare,
  LuUpload,
} from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import TotalBillContainer from '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  InvoiceStatus,
  PastInvoice,
  PaymentMethod,
} from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import {
  addLineItemsToAppointments,
  createFinanceInvoice,
  finalizeFinanceInvoice,
  getPaymentLink,
  recordManualInvoicePayment,
  seedAppointmentInvoice,
} from '@/app/features/billing/services/invoiceService';

type InvoiceStepProps = {
  appointmentId: string;
  organisationId?: string;
  patientId?: string;
  parentId?: string;
  encounter: AppointmentEncounter;
  hideBillBuilder?: boolean;
  onOpenSummary: () => void;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PAID_FULL: 'Paid full',
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
};

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  PAID_FULL: 'border-pill-success-border bg-pill-success-bg text-pill-success-text',
  UNPAID: 'border-pill-warning-border bg-pill-warning-bg text-pill-warning-text',
  PARTIAL: 'border-pill-info-border bg-pill-info-bg text-pill-info-text',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  ONLINE: 'Paid Online',
  CASH: 'Paid via Cash',
  CARD: 'Paid via Card',
  DEPOSIT: 'Paid from Deposit',
};

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const toFinanceLineItems = (items: InvoiceLineItem[]) =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.name,
    quantity: item.qty,
    unitPrice: item.unitPriceCents,
    total: item.amountCents,
  }));

const toInvoiceCandidate = (name: string, amountCents: number): Omit<InvoiceLineItem, 'id'> => ({
  name,
  unitPriceCents: amountCents,
  qty: 1,
  grossCents: amountCents,
  discountCents: 0,
  amountCents,
});

const buildBillableItems = (encounter: AppointmentEncounter): Omit<InvoiceLineItem, 'id'>[] => {
  const existingNames = new Set(
    encounter.invoiceLineItems.map((item) => item.name.trim().toLowerCase())
  );
  const serviceItems = encounter.services
    .filter((item) => !item.billed && item.amountCents > 0)
    .filter((item) => !existingNames.has(item.name.trim().toLowerCase()))
    .map((item) => toInvoiceCandidate(item.name, item.amountCents));
  const prescriptionItems = encounter.prescription
    .filter(
      (item) =>
        !item.billed &&
        item.fulfillment === 'IN_HOUSE' &&
        typeof item.priceCents === 'number' &&
        item.priceCents > 0
    )
    .filter((item) => !existingNames.has(item.medicineName.trim().toLowerCase()))
    .map((item) => toInvoiceCandidate(item.medicineName, item.priceCents ?? 0));
  return [...serviceItems, ...prescriptionItems];
};

const computeInvoiceTotalCents = (encounter: AppointmentEncounter): number => {
  const subtotalCents = encounter.invoiceLineItems.reduce((sum, item) => sum + item.grossCents, 0);
  const lineDiscountCents = encounter.invoiceLineItems.reduce(
    (sum, item) => sum + item.discountCents,
    0
  );
  const overallDiscountCents = Math.round((subtotalCents * encounter.overallDiscountPercent) / 100);
  const discountedCents = Math.max(0, subtotalCents - lineDiscountCents - overallDiscountCents);
  return discountedCents + Math.round((discountedCents * encounter.taxPercent) / 100);
};

const invoiceDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatInvoiceDate = (iso: string): string => invoiceDateFormatter.format(new Date(iso));

const StatusPill = ({ status }: { status: InvoiceStatus }) => (
  <span
    className={`inline-flex rounded-2xl border px-3 py-1 text-caption-1 ${STATUS_CLASSES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

/** Green confirmation badge in the breakdown footer; copy reflects the scenario. */
const SettledBadge = ({ invoice }: { invoice: PastInvoice }) => {
  const label = invoice.paidFromDeposit ? 'Withdrawn from Deposit' : 'Invoice Paid';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-3xl bg-[#15803D] px-3 py-1 text-caption-1 font-medium text-neutral-0">
      {label}
      <LuCheck aria-hidden="true" />
    </span>
  );
};

const ROW_GRID =
  'grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))] sm:items-center';

const InvoiceBreakdown = ({ invoice }: { invoice: PastInvoice }) => (
  <SectionContainer title="Breakdown" nested className="bg-neutral-0">
    <div className="flex flex-col gap-2">
      <div
        className={`${ROW_GRID} px-1 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate`}
      >
        <span>Item Name</span>
        <span>Unit Price</span>
        <span>Qnt.</span>
        <span>Gross Amt.</span>
        <span>Discount</span>
        <span className="text-right">Amount</span>
      </div>
      <ul className="flex flex-col">
        {invoice.items.map((item) => (
          <li key={item.id} className={`${ROW_GRID} px-1 py-2.5 text-body-4 text-text-primary`}>
            <span className="truncate font-medium">{item.name}</span>
            <span>{formatCents(item.unitPriceCents)}</span>
            <span className="text-text-secondary">x{item.qty}</span>
            <span>{formatCents(item.grossCents)}</span>
            <span className="text-pill-success-text">- {formatCents(item.discountCents)}</span>
            <span className="text-right font-medium">{formatCents(item.amountCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-card-border pt-3">
        <span className="text-text-secondary">Total</span>
        <span className="text-yc-20-b-primary">{formatCents(invoice.totalCents)}</span>
        <SettledBadge invoice={invoice} />
      </div>
    </div>
  </SectionContainer>
);

/**
 * Shared column template so the (separate) heading grid and each row grid resolve
 * to identical track widths. Every fr track is wrapped in minmax(0,…) so it can
 * never grow to fit its content — otherwise the heading ("Invoice ID") and the
 * row ("1. ID - …") would size their first track differently and shift every
 * column. The Actions track is a fixed 132px (fits the 3 circle buttons), so
 * there is no content-driven `auto` anywhere.
 */
const INVOICE_COLS =
  'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_132px]';
const INVOICE_ROW_GRID = `grid gap-3 ${INVOICE_COLS} sm:items-center`;

const InvoiceHeadings = () => (
  <div
    // Match the row's p-4 + 1px border so the column origins line up exactly.
    className={`${INVOICE_ROW_GRID} hidden border border-transparent px-4 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate sm:grid`}
  >
    <span>Invoice ID</span>
    <span>Time / Date</span>
    <span>Total Amt.</span>
    <span>Outstanding amt.</span>
    <span>Status</span>
    <span className="text-right">Actions</span>
  </div>
);

const InvoiceRow = ({
  invoice,
  index,
  expanded,
  readOnly,
  onToggle,
}: {
  invoice: PastInvoice;
  index: number;
  expanded: boolean;
  readOnly: boolean;
  onToggle: (id: string) => void;
}) => (
  <li className="flex flex-col gap-4 rounded-2xl border border-card-border p-4">
    <div className={INVOICE_ROW_GRID}>
      <span className="truncate font-medium text-text-primary">
        {index + 1}. ID - {invoice.id}
      </span>
      <span className="truncate text-body-4 text-text-secondary">
        {formatInvoiceDate(invoice.createdAt)}
      </span>
      <span className="text-body-4 text-text-primary">{formatCents(invoice.totalCents)}</span>
      <span className="text-body-4 text-text-primary">{formatCents(invoice.outstandingCents)}</span>
      <div className="flex">
        <StatusPill status={invoice.status} />
      </div>
      <div className="flex justify-end gap-2">
        <CircleIconButton
          icon={expanded ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
          label={expanded ? `Hide invoice ${invoice.id}` : `View invoice ${invoice.id}`}
          variant="dark"
          onClick={() => onToggle(invoice.id)}
        />
        <CircleIconButton
          icon={<LuDownload aria-hidden="true" />}
          label={`Download invoice ${invoice.id}`}
          onClick={() => undefined}
        />
        {!readOnly && (
          <CircleIconButton
            icon={<LuShare aria-hidden="true" />}
            label={`Share invoice ${invoice.id}`}
            onClick={() => undefined}
          />
        )}
      </div>
    </div>

    {expanded && <InvoiceBreakdown invoice={invoice} />}

    {invoice.paidByName && (
      <div className="flex flex-wrap items-center justify-end gap-3 text-right">
        <span className="flex flex-col text-caption-1">
          <span className="font-medium text-text-primary">By {invoice.paidByName}</span>
          {invoice.paidAt && (
            <span className="text-pill-success-text">
              {formatStampDate(invoice.paidAt)}, {formatStampTime(invoice.paidAt)}
            </span>
          )}
        </span>
        {invoice.paymentMethod && (
          <span className="inline-flex items-center gap-2 rounded-3xl bg-[#15803D] px-4 py-2 text-body-4 font-medium text-neutral-0">
            {PAYMENT_LABELS[invoice.paymentMethod]}
            <LuCheck aria-hidden="true" />
          </span>
        )}
      </div>
    )}
  </li>
);

const InvoicesSection = ({
  invoices,
  readOnly,
}: {
  invoices: PastInvoice[];
  readOnly: boolean;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(invoices[0]?.id ?? null);

  const handleToggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Invoices"
      className="flex flex-col gap-5"
    >
      {invoices.length === 0 ? (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No invoices recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <InvoiceHeadings />
          <ul className="flex flex-col gap-3">
            {invoices.map((invoice, index) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                index={index}
                expanded={expandedId === invoice.id}
                readOnly={readOnly}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        </div>
      )}
    </SectionContainer>
  );
};

/** Payment actions below the Total Bill (Collect Deposit / Collect Cash / Pay Online). */
const PaymentActions = ({
  isInpatient,
  depositDisabled,
  paymentDisabled,
  onCollect,
  onSendToClient,
}: {
  isInpatient: boolean;
  depositDisabled: boolean;
  paymentDisabled: boolean;
  onCollect: (method: PaymentMethod) => void;
  onSendToClient: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <Secondary
      text="Collect Deposit"
      icon={<LuCreditCard aria-hidden="true" />}
      iconPosition="right"
      onClick={() => onCollect('DEPOSIT')}
      isDisabled={depositDisabled}
    />
    <div className="flex flex-wrap items-center gap-3">
      {isInpatient && (
        <Secondary
          text="Send to Client"
          icon={<LuUpload aria-hidden="true" />}
          iconPosition="right"
          onClick={onSendToClient}
          isDisabled={paymentDisabled}
        />
      )}
      <Secondary
        text="Collect Cash"
        icon={<LuBanknote aria-hidden="true" />}
        iconPosition="right"
        onClick={() => onCollect('CASH')}
        isDisabled={paymentDisabled}
      />
      <Primary
        text="Pay Online"
        icon={<LuBanknote aria-hidden="true" />}
        iconPosition="right"
        onClick={() => onCollect('ONLINE')}
        isDisabled={paymentDisabled}
      />
    </div>
  </div>
);

const DepositModal = ({
  open,
  saving,
  generatedLink,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  generatedLink: string | null;
  onClose: () => void;
  onSubmit: (input: {
    amount: number;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => void;
}) => {
  const [amount, setAmount] = useState('100');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const amountNumber = Math.max(0, Number.parseFloat(amount) || 0);

  return (
    <CenterModal
      showModal={open}
      setShowModal={(next) => !next && onClose()}
      onClose={onClose}
      containerClassName="sm:w-[560px]"
    >
      <ModalHeader title="Collect deposit" onClose={onClose} />
      <div className="flex flex-col gap-4 px-2 pb-2">
        <p className="text-body-4 text-text-secondary">
          Record an upfront visit deposit. Cash and card-present deposits are marked collected now;
          online deposits generate a payment link.
        </p>
        <label className="flex flex-col gap-1 text-body-4 text-text-primary">
          <span>Amount</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 rounded-2xl border border-input-border-default px-4 focus-visible:border-input-border-active focus-visible:outline-none"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['CASH', 'CARD', 'ONLINE'] as PaymentMethod[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMethod(option)}
              className={`rounded-2xl border px-4 py-3 text-body-4 ${
                method === option
                  ? 'border-primary-500 bg-primary-100 text-text-brand'
                  : 'border-card-border text-text-primary'
              }`}
            >
              {option === 'CARD' ? 'Card present' : option === 'ONLINE' ? 'Online link' : 'Cash'}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-body-4 text-text-primary">
          <span>Reference</span>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="h-12 rounded-2xl border border-input-border-default px-4 focus-visible:border-input-border-active focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-body-4 text-text-primary">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 rounded-2xl border border-input-border-default px-4 py-3 focus-visible:border-input-border-active focus-visible:outline-none"
          />
        </label>
        {generatedLink && (
          <p role="status" className="rounded-2xl bg-primary-100 p-3 text-body-4 text-text-brand">
            Payment link generated: {generatedLink}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Secondary text="Cancel" onClick={onClose} />
          <Primary
            text={saving ? 'Saving...' : method === 'ONLINE' ? 'Generate link' : 'Collect deposit'}
            isDisabled={saving || amountNumber <= 0}
            onClick={() => onSubmit({ amount: amountNumber, method, reference, notes })}
          />
        </div>
      </div>
    </CenterModal>
  );
};

const InvoiceStep = ({
  appointmentId,
  organisationId,
  patientId,
  parentId,
  encounter,
  hideBillBuilder = false,
  onOpenSummary,
}: InvoiceStepProps) => {
  const setWithdrawDeposit = useAppointmentWorkspaceStore((s) => s.setWithdrawDeposit);
  const setOverallDiscountPercent = useAppointmentWorkspaceStore(
    (s) => s.setOverallDiscountPercent
  );
  const addInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.addInvoiceLineItem);
  const updateInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.updateInvoiceLineItem);
  const removeInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.removeInvoiceLineItem);
  const recordInvoicePayment = useAppointmentWorkspaceStore((s) => s.recordInvoicePayment);
  const recordDepositCollection = useAppointmentWorkspaceStore((s) => s.recordDepositCollection);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositPaymentLink, setDepositPaymentLink] = useState<string | null>(null);
  const readOnly = encounter.viewOnly;
  const isInpatient = encounter.mode === 'INPATIENT';
  const hasItems = encounter.invoiceLineItems.length > 0;
  const canBuildBill = !readOnly && !hideBillBuilder;
  const billableItems = useMemo(() => buildBillableItems(encounter), [encounter]);

  const persistCurrentInvoice = async () => {
    if (!organisationId) return undefined;
    const invoice = await seedAppointmentInvoice(appointmentId);
    await addLineItemsToAppointments(
      toFinanceLineItems(encounter.invoiceLineItems),
      appointmentId,
      'USD'
    );
    if (invoice.id) {
      await finalizeFinanceInvoice(invoice.id);
    }
    return invoice;
  };

  const handleCollect = async (method: PaymentMethod) => {
    if (method === 'DEPOSIT') {
      setDepositPaymentLink(null);
      setIsDepositModalOpen(true);
      return;
    }
    if (!hasItems) return;
    setErrorMessage(null);
    setIsProcessingPayment(true);
    try {
      const invoice = await persistCurrentInvoice();
      if (method === 'ONLINE') {
        if (!invoice?.id) {
          setConfirmation('Invoice prepared for online payment');
        } else {
          const url = await getPaymentLink(invoice.id);
          setConfirmation(url ? `Payment link generated: ${url}` : 'Payment link generated');
        }
        return;
      }
      if (invoice?.id) {
        await recordManualInvoicePayment(invoice.id, {
          provider: 'MANUAL',
          settlementChannel: method === 'CARD' ? 'CARD_PRESENT' : 'CASH',
          amount: computeInvoiceTotalCents(encounter),
          currency: 'usd',
          receivedAt: new Date().toISOString(),
        });
      }
      recordInvoicePayment(appointmentId, {
        method,
        byName: encounter.leadName ?? 'Front desk',
      });
      setConfirmation(`${PAYMENT_LABELS[method]} recorded`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to process payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDepositSubmit = async (input: {
    amount: number;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => {
    const amountCents = Math.round(input.amount * 100);
    setErrorMessage(null);
    setIsProcessingPayment(true);
    try {
      let checkoutUrl: string | undefined;
      if (organisationId) {
        const invoice = await createFinanceInvoice({
          appointmentId,
          parentId,
          patientId,
          organisationId,
          paymentCollectionMethod: input.method === 'ONLINE' ? 'PAYMENT_LINK' : 'PAYMENT_AT_CLINIC',
          items: [
            {
              name: 'Visit deposit',
              description: 'Upfront visit deposit',
              quantity: 1,
              unitPrice: amountCents,
              total: amountCents,
            },
          ],
          notes: input.notes || 'Visit deposit',
        });
        if (invoice.id && input.method === 'ONLINE') {
          checkoutUrl = await getPaymentLink(invoice.id);
        } else if (invoice.id) {
          await recordManualInvoicePayment(invoice.id, {
            provider: 'MANUAL',
            settlementChannel: input.method === 'CARD' ? 'CARD_PRESENT' : 'CASH',
            amount: amountCents,
            currency: 'usd',
            reference: input.reference || undefined,
            receivedAt: new Date().toISOString(),
            notes: input.notes || undefined,
          });
        }
      }
      if (input.method === 'ONLINE') {
        setDepositPaymentLink(checkoutUrl ?? null);
        setConfirmation(
          checkoutUrl
            ? `Deposit payment link generated: ${checkoutUrl}`
            : 'Deposit payment link generated'
        );
        return;
      }
      recordDepositCollection(appointmentId, {
        amountCents,
        method: input.method,
        byName: encounter.leadName ?? 'Front desk',
      });
      setConfirmation(`${PAYMENT_LABELS[input.method]} deposit recorded`);
      setIsDepositModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to collect deposit.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSendToClient = async () => {
    await handleCollect('ONLINE');
  };

  const handleFinishInvoice = () => {
    setStepStatus(appointmentId, 'INVOICE', 'COMPLETED');
    onOpenSummary();
  };

  const handleAddItem = (item: Omit<InvoiceLineItem, 'id'>) => {
    addInvoiceLineItem(appointmentId, item);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* The bill builder + payment controls only show while the encounter is
          editable. A completed appointment shows finalized invoices only. */}
      {canBuildBill && (
        <>
          <TotalBillContainer
            items={encounter.invoiceLineItems}
            billableItems={billableItems}
            depositCents={encounter.depositCents}
            withdrawDeposit={encounter.withdrawDeposit}
            taxPercent={encounter.taxPercent}
            overallDiscountPercent={encounter.overallDiscountPercent}
            onToggleWithdrawDeposit={(value) => setWithdrawDeposit(appointmentId, value)}
            onChangeOverallDiscount={(percent) => setOverallDiscountPercent(appointmentId, percent)}
            onAddItem={handleAddItem}
            onUpdateItem={(id, patch) => updateInvoiceLineItem(appointmentId, id, patch)}
            onRemoveItem={(id) => removeInvoiceLineItem(appointmentId, id)}
          />

          <PaymentActions
            isInpatient={isInpatient}
            depositDisabled={isProcessingPayment}
            paymentDisabled={isProcessingPayment || !hasItems}
            onCollect={handleCollect}
            onSendToClient={handleSendToClient}
          />

          {errorMessage && (
            <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-danger-700">
              {errorMessage}
            </p>
          )}

          {confirmation && (
            <p role="status" className="rounded-2xl bg-primary-100 p-3 text-body-4 text-text-brand">
              {confirmation}
            </p>
          )}
        </>
      )}

      <DepositModal
        open={isDepositModalOpen}
        saving={isProcessingPayment}
        generatedLink={depositPaymentLink}
        onClose={() => setIsDepositModalOpen(false)}
        onSubmit={handleDepositSubmit}
      />

      <InvoicesSection invoices={encounter.pastInvoices} readOnly={readOnly} />

      {!readOnly && (
        <div className="flex justify-end">
          <Primary
            text="Summary"
            icon={<LuArrowRight aria-hidden="true" />}
            iconPosition="right"
            onClick={handleFinishInvoice}
          />
        </div>
      )}
    </div>
  );
};

export default InvoiceStep;
