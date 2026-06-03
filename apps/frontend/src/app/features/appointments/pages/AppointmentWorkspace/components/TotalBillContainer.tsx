import React, { useMemo, useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import type { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';

type TotalBillContainerProps = {
  items: InvoiceLineItem[];
  depositCents: number;
  withdrawDeposit: boolean;
  taxPercent: number;
  overallDiscountPercent: number;
  readOnly: boolean;
  onToggleWithdrawDeposit: (value: boolean) => void;
  onAddItem: (item: Omit<InvoiceLineItem, 'id'>) => void;
  onRemoveItem: (id: string) => void;
};

const BILLABLE_ITEMS: Omit<InvoiceLineItem, 'id'>[] = [
  {
    name: 'Bandage change',
    unitPriceCents: 6500,
    qty: 1,
    grossCents: 6500,
    discountCents: 500,
    amountCents: 6000,
  },
  {
    name: 'Hospitalization day charge',
    unitPriceCents: 12000,
    qty: 1,
    grossCents: 12000,
    discountCents: 0,
    amountCents: 12000,
  },
];

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const buildTotals = (
  items: InvoiceLineItem[],
  taxPercent: number,
  discountPercent: number,
  depositCents: number,
  withdrawDeposit: boolean
) => {
  const subtotalCents = items.reduce((sum, item) => sum + item.grossCents, 0);
  const lineDiscountCents = items.reduce((sum, item) => sum + item.discountCents, 0);
  const overallDiscountCents = Math.round((subtotalCents * discountPercent) / 100);
  const discountedCents = Math.max(0, subtotalCents - lineDiscountCents - overallDiscountCents);
  const taxCents = Math.round((discountedCents * taxPercent) / 100);
  const estimatedTotalCents = discountedCents + taxCents;
  const remainingDepositCents = withdrawDeposit
    ? Math.max(0, depositCents - estimatedTotalCents)
    : depositCents;
  return {
    subtotalCents,
    lineDiscountCents,
    overallDiscountCents,
    taxCents,
    estimatedTotalCents,
    remainingDepositCents,
  };
};

const toPackageBreakdownItem = (item: InvoiceLineItem): PackageBreakdownItem => ({
  id: item.id,
  type: 'PROCEDURE',
  name: item.name,
  unitPrice: item.unitPriceCents / 100,
  quantity: item.qty,
  discount: item.grossCents === 0 ? 0 : Math.round((item.discountCents / item.grossCents) * 100),
});

const TotalBillContainer = ({
  items,
  depositCents,
  withdrawDeposit,
  taxPercent,
  overallDiscountPercent,
  readOnly,
  onToggleWithdrawDeposit,
  onAddItem,
  onRemoveItem,
}: TotalBillContainerProps) => {
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return BILLABLE_ITEMS;
    return BILLABLE_ITEMS.filter((item) => item.name.toLowerCase().includes(query));
  }, [search]);

  const totals = buildTotals(
    items,
    taxPercent,
    overallDiscountPercent,
    depositCents,
    withdrawDeposit
  );

  return (
    <SectionContainer title="Total Bill" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <CircleIconButton
          icon={<LuPlus aria-hidden="true" />}
          label="Add invoice item"
          variant="dark"
          disabled={readOnly}
          onClick={() => {
            if (matches[0]) onAddItem(matches[0]);
          }}
        />
        <Search
          value={search}
          setSearch={setSearch}
          placeholder="Search for Services, medicines..."
          label="Search invoice items"
          className="flex-1! w-full! xl:w-full!"
        />
      </div>

      {!readOnly && search.trim() && (
        <div className="flex flex-wrap gap-2">
          {matches.map((item) => (
            <button
              key={item.name}
              type="button"
              className="rounded-2xl border border-card-border px-3 py-2 text-body-4 text-text-primary hover:border-input-border-active"
              onClick={() => onAddItem(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <SectionContainer title="Breakdown" nested className="bg-neutral-0">
          <PackageBreakdownTable
            items={items.map(toPackageBreakdownItem)}
            additionalDiscount={0}
            editable={!readOnly}
            onRemoveItem={onRemoveItem}
          />
        </SectionContainer>
      )}

      {items.length === 0 && (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No invoice line items added yet.
        </p>
      )}

      <div className="grid gap-5 rounded-2xl bg-neutral-100 p-5 text-body-4 text-text-primary lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={withdrawDeposit}
              disabled={readOnly}
              onChange={(e) => onToggleWithdrawDeposit(e.target.checked)}
              className="size-4 accent-pill-success-text"
            />
            <span>Withdraw deposit</span>
          </label>
          <span>Total Deposit: {formatCents(depositCents)}</span>
          <span className="text-text-brand">
            Invoice Amount: {formatCents(totals.estimatedTotalCents)}
          </span>
          <span>Remaining: {formatCents(totals.remainingDepositCents)}</span>
        </div>
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-caption-1 text-text-secondary">Total Amount</p>
            <p className="text-heading-2 text-text-brand">
              {formatCents(totals.estimatedTotalCents)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-right">
          <span>Subtotal: {formatCents(totals.subtotalCents)}</span>
          <span className="text-pill-success-text">
            Overall Discount: {formatCents(totals.overallDiscountCents)} [-{overallDiscountPercent}
            %]
          </span>
          <span>
            Tax ({taxPercent}%): {formatCents(totals.taxCents)}
          </span>
          <span className="font-bold">
            Estimated Total: {formatCents(totals.estimatedTotalCents)}
          </span>
        </div>
      </div>
    </SectionContainer>
  );
};

export default TotalBillContainer;
