import React, { useMemo, useRef, useState } from 'react';
import { LuChevronDown, LuCopy, LuPlus, LuPrinter, LuTrash2 } from 'react-icons/lu';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { RxBadge } from '@/app/features/appointments/pages/AppointmentWorkspace/components/RxBadge';
import { StockHealthPill } from '@/app/features/appointments/pages/AppointmentWorkspace/components/StockHealthPill';
import { TitleAddIcon } from '@/app/features/appointments/pages/AppointmentWorkspace/components/TitleAddIcon';
import BilledBadge from '@/app/features/appointments/pages/AppointmentWorkspace/components/BilledBadge';
import { formatMoney } from '@/app/lib/money';
import type {
  PrescriptionFulfillment,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';

type PrescriptionEditorProps = {
  items: PrescriptionItem[];
  catalogItems?: Omit<PrescriptionItem, 'id'>[];
  readOnly: boolean;
  deleteLocked?: boolean;
  onAddItem: (item: Omit<PrescriptionItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<PrescriptionItem>) => void;
  onRemoveItem: (id: string) => void;
  onPrint: () => void;
};

const FULFILLMENT_LABELS: Record<PrescriptionFulfillment, string> = {
  IN_HOUSE: 'In-house fulfilled',
  PRESCRIPTION_ONLY: 'Prescription only',
};

const FULFILLMENT_OPTIONS = Object.keys(FULFILLMENT_LABELS) as PrescriptionFulfillment[];

/** Compact editable fields (shared floating input) — Dose / Route / Freq. / Duration / Refill. */
const EDITABLE_FIELDS: { key: keyof PrescriptionItem; label: string; width: string }[] = [
  { key: 'dosage', label: 'Dose', width: 'w-full sm:w-28' },
  { key: 'route', label: 'Route', width: 'w-full sm:w-28' },
  { key: 'frequency', label: 'Freq.', width: 'w-full sm:w-24' },
  { key: 'durationDays', label: 'Duration', width: 'w-full sm:w-28' },
  { key: 'refill', label: 'Refill', width: 'w-full sm:w-24' },
];

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const copyValue = (value?: string) => {
  if (!value || !globalThis.navigator?.clipboard) return;
  globalThis.navigator.clipboard.writeText(value).catch(() => undefined);
};

/**
 * Compact fulfillment pill dropdown (In-house fulfilled / Prescription only),
 * styled like the workspace status pills with a small caret.
 */
const FulfillmentDropdown = ({
  value,
  disabled,
  onChange,
}: {
  value: PrescriptionFulfillment;
  disabled: boolean;
  onChange: (value: PrescriptionFulfillment) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Fulfillment"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="flex items-center gap-1 rounded-2xl border border-neutral-500 bg-neutral-0 py-1.5 pr-3.5 pl-4 text-[14px] leading-[120%] font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {FULFILLMENT_LABELS[value]}
        <LuChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-1 min-w-44 overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]"
        >
          {FULFILLMENT_OPTIONS.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(option);
                  setOpen(false);
                }}
                className="flex w-full items-center px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
              >
                {FULFILLMENT_LABELS[option]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Editable cell using the shared floating-label input (FormInput) — the same
 * style used across the app. Editable and view-only both keep the floating label
 * + bordered box; view-only just renders the field read-only.
 */
const EditableCell = ({
  label,
  value,
  width,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  width: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) => (
  <div className={width}>
    <FormInput
      intype="text"
      inlabel={label}
      value={value}
      readonly={readOnly}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

/** Instructions field: floating input with a copy icon docked inside the box. */
const InstructionsField = ({
  value,
  readOnly,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="relative w-full flex-1 sm:min-w-64">
    <FormInput
      intype="text"
      inlabel="Instructions"
      value={value}
      readonly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="pr-11!"
    />
    <button
      type="button"
      aria-label="Copy instructions"
      onClick={() => copyValue(value)}
      className="absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary hover:text-text-brand focus-visible:outline-none"
    >
      <LuCopy size={16} aria-hidden="true" />
    </button>
  </div>
);

const PrescriptionRow = ({
  item,
  index,
  readOnly,
  deleteLocked,
  onUpdateItem,
  onRemoveItem,
}: {
  item: PrescriptionItem;
  index: number;
  readOnly: boolean;
  deleteLocked: boolean;
  onUpdateItem: (id: string, patch: Partial<PrescriptionItem>) => void;
  onRemoveItem: (id: string) => void;
}) => {
  // Billed/paid items are locked: fields render read-only and there is no delete.
  const isBilled = Boolean(item.billed);
  const rowReadOnly = readOnly || isBilled;
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-card-border p-4">
      {/* Header: number + name + Rx badge on the left; stock health, fulfillment
        dropdown and the remove button on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">
            {index + 1}. {item.medicineName}
          </span>
          <RxBadge />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {item.stockQty != null && (
            <StockHealthPill qty={item.stockQty} low={item.lowStock ?? false} />
          )}
          {isBilled && <BilledBadge />}
          <FulfillmentDropdown
            value={item.fulfillment}
            disabled={rowReadOnly}
            onChange={(fulfillment) => onUpdateItem(item.id, { fulfillment })}
          />
          {!isBilled && (
            <CircleIconButton
              icon={<LuTrash2 aria-hidden="true" />}
              label={`Remove ${item.medicineName}`}
              variant="danger"
              disabled={deleteLocked}
              onClick={() => onRemoveItem(item.id)}
            />
          )}
        </div>
      </div>

      {/* Fields row: compact floating inputs, the instructions field, then the
        line price pinned to the right end. */}
      <div className="flex flex-wrap items-center gap-3">
        {EDITABLE_FIELDS.map((field) => (
          <EditableCell
            key={field.key}
            label={field.label}
            width={field.width}
            value={String(item[field.key] ?? '')}
            readOnly={rowReadOnly}
            onChange={(value) => onUpdateItem(item.id, { [field.key]: value })}
          />
        ))}
        <InstructionsField
          value={item.instructions ?? ''}
          readOnly={rowReadOnly}
          onChange={(value) => onUpdateItem(item.id, { instructions: value })}
        />
        <span className="ml-auto shrink-0 text-body-3-emphasis font-bold text-text-primary">
          {item.priceCents != null ? formatCents(item.priceCents) : '-'}
        </span>
      </div>
    </li>
  );
};

const PrescriptionEditor = ({
  items,
  catalogItems = [],
  readOnly,
  deleteLocked = readOnly,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onPrint,
}: PrescriptionEditorProps) => {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return catalogItems.filter((item) => item.medicineName.toLowerCase().includes(query));
  }, [catalogItems, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search + print row sits above the floating container (matches the other
          steps); results surface as a dropdown on type. */}
      <div className="relative z-50 flex items-center justify-end gap-3">
        <CircleIconButton
          icon={<LuPrinter aria-hidden="true" />}
          label="Print prescription"
          onClick={onPrint}
        />
        <div ref={searchRef} className="relative w-full sm:max-w-90">
          <Search
            value={search}
            setSearch={setSearch}
            placeholder="Search by medicine name, composition..."
            label="Search medicines"
            className="w-full!"
          />
          <SearchResultsDropdown
            anchorRef={searchRef}
            open={matches.length > 0}
            onClose={() => setSearch('')}
          >
            <ul>
              {matches.map((item) => (
                <li key={item.medicineName}>
                  <button
                    type="button"
                    onClick={() => {
                      onAddItem(item);
                      setSearch('');
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
                  >
                    <LuPlus aria-hidden="true" />
                    <span className="flex-1">{item.medicineName}</span>
                    <span className="rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
                      Medication
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SearchResultsDropdown>
        </div>
      </div>

      <SectionContainer
        titleClassName="text-yc-20-b-primary"
        title="Prescription"
        titleIcon={<TitleAddIcon />}
        className="flex flex-col gap-5"
      >
        {items.length === 0 ? (
          <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
            No prescription items added yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <PrescriptionRow
                key={item.id}
                item={item}
                index={index}
                readOnly={readOnly}
                deleteLocked={deleteLocked}
                onUpdateItem={onUpdateItem}
                onRemoveItem={onRemoveItem}
              />
            ))}
          </ul>
        )}
      </SectionContainer>
    </div>
  );
};

export default PrescriptionEditor;
