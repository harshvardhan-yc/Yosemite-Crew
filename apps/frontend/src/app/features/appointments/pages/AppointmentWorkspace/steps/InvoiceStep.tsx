import React, { useMemo, useState } from 'react';
import { LuArrowRight, LuDownload, LuEye, LuEyeOff, LuShare, LuUpload } from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PaymentMethodMenu from '@/app/features/appointments/pages/AppointmentWorkspace/components/PaymentMethodMenu';
import TotalBillContainer from '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  InvoiceStatus,
  PastInvoice,
  PaymentMethod,
} from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';

type InvoiceStepProps = {
  appointmentId: string;
  encounter: AppointmentEncounter;
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

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const formatInvoiceDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

const StatusPill = ({ status }: { status: InvoiceStatus }) => (
  <span
    className={`inline-flex rounded-2xl border px-3 py-1 text-caption-1 ${STATUS_CLASSES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

const InvoiceBreakdown = ({ invoice }: { invoice: PastInvoice }) => (
  <div className="rounded-2xl border border-card-border p-4">
    <table className="min-w-full text-body-4 text-text-primary">
      <thead className="text-caption-1 text-text-secondary">
        <tr>
          <th className="p-2 text-left">Item</th>
          <th className="p-2 text-right">Unit Price</th>
          <th className="p-2 text-center">Qnt.</th>
          <th className="p-2 text-right">Gross Amt.</th>
          <th className="p-2 text-right">Discount</th>
          <th className="p-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((item) => (
          <tr key={item.id} className="border-t border-card-border">
            <td className="p-2">{item.name}</td>
            <td className="p-2 text-right">{formatCents(item.unitPriceCents)}</td>
            <td className="p-2 text-center">x{item.qty}</td>
            <td className="p-2 text-right">{formatCents(item.grossCents)}</td>
            <td className="p-2 text-right text-pill-success-text">
              - {formatCents(item.discountCents)}
            </td>
            <td className="p-2 text-right">{formatCents(item.amountCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={invoice.status} />
        {invoice.status === 'PAID_FULL' && (
          <span className="rounded-2xl bg-pill-success-bg px-3 py-1 text-caption-1 text-pill-success-text">
            Invoice Paid
          </span>
        )}
      </div>
      <span className="text-caption-1 text-text-secondary">
        By {invoice.byName ?? 'Front desk'}
      </span>
    </div>
  </div>
);

const PastInvoices = ({ invoices }: { invoices: PastInvoice[] }) => {
  const [expandedId, setExpandedId] = useState<string | null>(invoices[0]?.id ?? null);

  const handleToggleExpanded = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="past-invoices-title">
      <h2 id="past-invoices-title" className="text-[20px] font-bold text-text-brand">
        Past Invoices
      </h2>
      {invoices.length === 0 ? (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No past invoices recorded.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-card-border">
          <table className="min-w-full text-body-4 text-text-primary">
            <thead className="bg-neutral-100 text-caption-1 text-text-secondary">
              <tr>
                <th className="p-3 text-left">Time/Date</th>
                <th className="p-3 text-right">Total Amt.</th>
                <th className="p-3 text-right">Outstanding amt.</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const expanded = expandedId === invoice.id;
                return (
                  <React.Fragment key={invoice.id}>
                    <tr className="border-t border-card-border">
                      <td className="p-3">{formatInvoiceDate(invoice.createdAt)}</td>
                      <td className="p-3 text-right">{formatCents(invoice.totalCents)}</td>
                      <td className="p-3 text-right">{formatCents(invoice.outstandingCents)}</td>
                      <td className="p-3">
                        <StatusPill status={invoice.status} />
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <CircleIconButton
                            icon={
                              expanded ? (
                                <LuEyeOff aria-hidden="true" />
                              ) : (
                                <LuEye aria-hidden="true" />
                              )
                            }
                            label={
                              expanded ? `Hide invoice ${invoice.id}` : `View invoice ${invoice.id}`
                            }
                            variant="dark"
                            onClick={() => handleToggleExpanded(invoice.id)}
                          />
                          <CircleIconButton
                            icon={<LuDownload aria-hidden="true" />}
                            label={`Download invoice ${invoice.id}`}
                            onClick={() => undefined}
                          />
                          <CircleIconButton
                            icon={<LuShare aria-hidden="true" />}
                            label={`Share invoice ${invoice.id}`}
                            onClick={() => undefined}
                          />
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={5} className="border-t border-card-border p-4">
                          <InvoiceBreakdown invoice={invoice} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const InvoiceStep = ({ appointmentId, encounter, onOpenSummary }: InvoiceStepProps) => {
  const setWithdrawDeposit = useAppointmentWorkspaceStore((s) => s.setWithdrawDeposit);
  const addInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.addInvoiceLineItem);
  const removeInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.removeInvoiceLineItem);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const readOnly = encounter.viewOnly;
  const isInpatient = encounter.mode === 'INPATIENT';

  const actionLabel = useMemo(() => {
    if (!selectedPayment) return undefined;
    const labels: Record<PaymentMethod, string> = {
      ONLINE: 'Online payment selected',
      CASH: 'Cash payment selected',
      CARD: 'Card payment selected',
      DEPOSIT: 'Deposit collection selected',
    };
    return labels[selectedPayment];
  }, [selectedPayment]);

  const handlePaymentSelect = (method: PaymentMethod) => {
    setSelectedPayment(method);
  };

  const handleSendToClient = () => {
    setSelectedPayment('ONLINE');
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
      <TotalBillContainer
        items={encounter.invoiceLineItems}
        depositCents={encounter.depositCents}
        withdrawDeposit={encounter.withdrawDeposit}
        taxPercent={encounter.taxPercent}
        overallDiscountPercent={encounter.overallDiscountPercent}
        readOnly={readOnly}
        onToggleWithdrawDeposit={(value) => setWithdrawDeposit(appointmentId, value)}
        onAddItem={handleAddItem}
        onRemoveItem={(id) => removeInvoiceLineItem(appointmentId, id)}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        {isInpatient ? (
          <Secondary
            text="Send to Client"
            icon={<LuUpload aria-hidden="true" />}
            onClick={handleSendToClient}
            isDisabled={readOnly}
          />
        ) : null}
        <PaymentMethodMenu
          label="Payment Method"
          disabled={readOnly}
          onSelect={handlePaymentSelect}
        />
        <Primary
          text="Summary"
          icon={<LuArrowRight aria-hidden="true" />}
          iconPosition="right"
          onClick={handleFinishInvoice}
          isDisabled={readOnly}
        />
      </div>

      {actionLabel && (
        <p role="status" className="rounded-2xl bg-primary-100 p-3 text-body-4 text-text-brand">
          {actionLabel}
        </p>
      )}

      <PastInvoices invoices={encounter.pastInvoices} />
    </div>
  );
};

export default InvoiceStep;
