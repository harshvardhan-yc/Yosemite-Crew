import React, { useMemo, useState } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import type { InvoiceLineItem } from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';

type TotalBillContainerProps = {
  items: InvoiceLineItem[];
  billableItems: Omit<InvoiceLineItem, 'id'>[];
  depositCents: number;
  withdrawDeposit: boolean;
  taxPercent: number;
  overallDiscountPercent: number;
  onToggleWithdrawDeposit: (value: boolean) => void;
  onChangeOverallDiscount: (percent: number) => void;
  onAddItem: (item: Omit<InvoiceLineItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onRemoveItem: (id: string) => void;
};

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
    overallDiscountCents,
    taxCents,
    estimatedTotalCents,
    remainingDepositCents,
  };
};

/**
 * Shared column template for the heading row and every line row. The headings
 * and the rows live in separate grids, so the template must resolve to identical
 * track widths in both — that means NO content-driven `auto` track (the delete
 * column is a fixed 36px, the width of the circle button) and the flexible first
 * column is the only fr track. Every other column is a fixed px width.
 */
const ROW_GRID =
  'grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_110px_72px_110px_110px_120px_36px] sm:items-center';

/**
 * Each heading's text starts exactly where its value-box text starts: the value
 * boxes have an inner px-3, so the headings carry the same px-3 inset. The label
 * therefore sits at the start of its column, directly above the value below it.
 */
const ColumnHeadings = () => (
  <div
    className={`${ROW_GRID} text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:px-3`}
  >
    <span>Item Name</span>
    <span>Unit Price</span>
    <span>Qnt.</span>
    <span>Gross Amt.</span>
    <span>Discount</span>
    <span>Amount</span>
    <span aria-hidden="true" className="px-0!" />
  </div>
);

/** Plain (non-editable) text cell for line values that the user cannot change. */
const TextCell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`flex h-10 items-center px-3 text-body-4 text-text-primary ${className ?? ''}`}>
    {children}
  </span>
);

/** Shared editable box style for the qty + discount inputs (with a leading prefix). */
const EDITABLE_BOX =
  'h-10 w-full rounded-xl border border-input-border-default bg-transparent pl-7 pr-3 text-body-4 text-text-primary focus-visible:border-input-border-active focus-visible:outline-none';

/** Editable quantity box with a permanent leading "×"; re-derives gross/amount. */
const QtyInput = ({
  item,
  onUpdateItem,
}: {
  item: InvoiceLineItem;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
}) => (
  <div className="relative">
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-4 text-text-secondary"
    >
      ×
    </span>
    <input
      type="number"
      min={1}
      value={item.qty}
      aria-label={`Quantity for ${item.name}`}
      onChange={(e) => {
        const qty = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
        onUpdateItem(item.id, { qty });
      }}
      className={EDITABLE_BOX}
    />
  </div>
);

/** Editable per-line discount box (dollars) with leading "− $"; re-derives amount. */
const DiscountInput = ({
  item,
  onUpdateItem,
}: {
  item: InvoiceLineItem;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
}) => (
  <div className="relative">
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-4 text-pill-success-text"
    >
      − $
    </span>
    <input
      type="number"
      min={0}
      step={0.01}
      value={item.discountCents / 100}
      aria-label={`Discount for ${item.name}`}
      onChange={(e) => {
        const dollars = Math.max(0, Number.parseFloat(e.target.value) || 0);
        onUpdateItem(item.id, { discountCents: Math.round(dollars * 100) });
      }}
      className={`${EDITABLE_BOX} pl-12 text-pill-success-text`}
    />
  </div>
);

const BillRow = ({
  item,
  onUpdateItem,
  onRemoveItem,
}: {
  item: InvoiceLineItem;
  onUpdateItem: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onRemoveItem: (id: string) => void;
}) => (
  <li className={`${ROW_GRID} text-body-4 text-text-primary`}>
    <TextCell className="min-w-0">
      <span className="truncate">{item.name}</span>
    </TextCell>
    <TextCell>{formatCents(item.unitPriceCents)}</TextCell>
    <QtyInput item={item} onUpdateItem={onUpdateItem} />
    <TextCell>{formatCents(item.grossCents)}</TextCell>
    <DiscountInput item={item} onUpdateItem={onUpdateItem} />
    <TextCell className="font-medium">{formatCents(item.amountCents)}</TextCell>
    <CircleIconButton
      icon={<LuTrash2 aria-hidden="true" />}
      label={`Remove ${item.name}`}
      variant="danger"
      onClick={() => onRemoveItem(item.id)}
    />
  </li>
);

const FOOTER_AMOUNT_ROW = 'grid min-h-8 grid-cols-[minmax(0,1fr)_max-content] items-center gap-4';
const FOOTER_BREAKDOWN_ROW =
  'grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)_7rem] items-center gap-3';
const FOOTER_FONT = '"Satoshi Variable", var(--font-satoshi), sans-serif';
const NEUTRAL_TEXT = 'var(--color-neutral-900, #302F2E)';
const PRIMARY_TEXT = 'var(--color-primary-600, #006AE0)';
const DISCOUNT_TEXT = 'var(--color-semantics-success-700, #15803D)';

const FOOTER_HELPER_TEXT_STYLE: React.CSSProperties = {
  color: NEUTRAL_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: 500,
  lineHeight: '120%',
};

const FOOTER_LABEL_STYLE: React.CSSProperties = {
  color: NEUTRAL_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 16,
  fontStyle: 'normal',
  fontWeight: 400,
  lineHeight: '120%',
};

const FOOTER_VALUE_STYLE: React.CSSProperties = {
  color: NEUTRAL_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 16,
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: '120%',
};

const FOOTER_TOTAL_VALUE_STYLE: React.CSSProperties = {
  color: PRIMARY_TEXT,
  fontFamily: FOOTER_FONT,
  fontSize: 40,
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: '120%',
  textAlign: 'right',
};

const FOOTER_DISCOUNT_VALUE_STYLE: React.CSSProperties = {
  ...FOOTER_VALUE_STYLE,
  color: DISCOUNT_TEXT,
};

const FooterAmountRow = ({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) => (
  <div className={FOOTER_AMOUNT_ROW}>
    <span className="min-w-0" style={FOOTER_LABEL_STYLE}>
      {label}
    </span>
    <span className="text-right" style={{ ...FOOTER_VALUE_STYLE, ...(valueStyle ?? {}) }}>
      {value}
    </span>
  </div>
);

const FooterBreakdownRow = ({
  label,
  value,
  valueStyle,
  leftSlot,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
  leftSlot?: React.ReactNode;
}) => (
  <div className={FOOTER_BREAKDOWN_ROW}>
    <span className="flex items-center">{leftSlot}</span>
    <span className="min-w-0" style={FOOTER_LABEL_STYLE}>
      {label}
    </span>
    <span className="text-right" style={{ ...FOOTER_VALUE_STYLE, ...(valueStyle ?? {}) }}>
      {value}
    </span>
  </div>
);

const TotalsFooter = ({
  totals,
  depositCents,
  taxPercent,
  overallDiscountPercent,
  withdrawDeposit,
  onToggleWithdrawDeposit,
  onChangeOverallDiscount,
}: {
  totals: ReturnType<typeof buildTotals>;
  depositCents: number;
  taxPercent: number;
  overallDiscountPercent: number;
  withdrawDeposit: boolean;
  onToggleWithdrawDeposit: (value: boolean) => void;
  onChangeOverallDiscount: (percent: number) => void;
}) => (
  <div className="-mx-5 -mb-5 grid gap-5 rounded-b-2xl border-t border-neutral-300 bg-pill-success-bg px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.8fr)_minmax(0,1fr)] lg:items-stretch">
    <div className="flex h-full flex-col justify-center gap-2">
      <label className="flex min-h-8 items-center gap-2">
        <input
          type="checkbox"
          checked={withdrawDeposit}
          onChange={(e) => onToggleWithdrawDeposit(e.target.checked)}
          className="size-4 accent-pill-success-text"
        />
        <span style={FOOTER_HELPER_TEXT_STYLE}>Withdraw from deposit</span>
      </label>
      <FooterAmountRow label="Total Deposit" value={formatCents(depositCents)} />
      <FooterAmountRow
        label="Invoice Amount"
        value={formatCents(totals.estimatedTotalCents)}
        valueStyle={{ color: PRIMARY_TEXT }}
      />
      <FooterAmountRow
        label="Remaining Deposit"
        value={formatCents(totals.remainingDepositCents)}
      />
    </div>

    <div className="flex h-full items-center justify-center py-1 lg:py-0">
      <div className="text-center">
        <p style={FOOTER_LABEL_STYLE}>Total Amount</p>
        <p className="text-right" style={FOOTER_TOTAL_VALUE_STYLE}>
          {formatCents(totals.estimatedTotalCents)}
        </p>
      </div>
    </div>

    <div className="flex h-full flex-col justify-center gap-2">
      <FooterBreakdownRow label="Subtotal:" value={formatCents(totals.subtotalCents)} />
      <FooterBreakdownRow
        label="Overall Discount:"
        value={`− ${formatCents(totals.overallDiscountCents)}`}
        valueStyle={FOOTER_DISCOUNT_VALUE_STYLE}
        leftSlot={
          <span className="relative inline-flex h-8 w-20 items-center">
            <input
              type="number"
              min={0}
              max={100}
              value={overallDiscountPercent}
              aria-label="Overall discount percent"
              onChange={(e) =>
                onChangeOverallDiscount(Math.max(0, Number.parseFloat(e.target.value) || 0))
              }
              className="h-full w-full rounded-xl border bg-transparent pr-6 pl-2 text-right focus-visible:outline-none"
              style={{ ...FOOTER_DISCOUNT_VALUE_STYLE, borderColor: DISCOUNT_TEXT }}
            />
            <span
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
              style={FOOTER_DISCOUNT_VALUE_STYLE}
            >
              %
            </span>
          </span>
        }
      />
      <FooterBreakdownRow label={`Tax (${taxPercent}%):`} value={formatCents(totals.taxCents)} />
      <FooterBreakdownRow
        label="Estimated Total:"
        value={formatCents(totals.estimatedTotalCents)}
      />
    </div>
  </div>
);

const TotalBillContainer = ({
  items,
  billableItems,
  depositCents,
  withdrawDeposit,
  taxPercent,
  overallDiscountPercent,
  onToggleWithdrawDeposit,
  onChangeOverallDiscount,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: TotalBillContainerProps) => {
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return billableItems.filter((item) => item.name.toLowerCase().includes(query));
  }, [billableItems, search]);

  const totals = buildTotals(
    items,
    taxPercent,
    overallDiscountPercent,
    depositCents,
    withdrawDeposit
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search row sits above the floating container, right-aligned and sized to
          match the other steps' search bars (SOAP / Services / Prescription). */}
      <div className="relative flex items-center justify-end gap-3">
        <CircleIconButton
          icon={<LuPlus aria-hidden="true" />}
          label="Add invoice item"
          variant="dark"
          onClick={() => {
            if (matches[0]) onAddItem(matches[0]);
          }}
        />
        <div className="relative w-full sm:max-w-90">
          <Search
            value={search}
            setSearch={setSearch}
            placeholder="Search for Services, medicines..."
            label="Search invoice items"
            className="w-full!"
          />
          {matches.length > 0 && (
            <ul className="absolute right-0 z-20 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
              {matches.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => {
                      onAddItem(item);
                      setSearch('');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
                  >
                    <LuPlus aria-hidden="true" />
                    <span className="flex-1">{item.name}</span>
                    <span className="text-text-secondary">{formatCents(item.amountCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SectionContainer
        titleClassName="text-yc-20-b-primary"
        title="Total Bill"
        className="flex flex-col gap-5"
      >
        {items.length === 0 ? (
          <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
            No invoice line items added yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="hidden sm:block">
              <ColumnHeadings />
            </div>
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <BillRow
                  key={item.id}
                  item={item}
                  onUpdateItem={onUpdateItem}
                  onRemoveItem={onRemoveItem}
                />
              ))}
            </ul>
          </div>
        )}

        <TotalsFooter
          totals={totals}
          depositCents={depositCents}
          taxPercent={taxPercent}
          overallDiscountPercent={overallDiscountPercent}
          withdrawDeposit={withdrawDeposit}
          onToggleWithdrawDeposit={onToggleWithdrawDeposit}
          onChangeOverallDiscount={onChangeOverallDiscount}
        />
      </SectionContainer>
    </div>
  );
};

export default TotalBillContainer;
