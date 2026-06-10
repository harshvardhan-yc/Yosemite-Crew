import React, { useMemo, useState } from 'react';
import { LuCopy, LuEye, LuEyeOff, LuPlus, LuTrash2 } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { TitleAddIcon } from '@/app/features/appointments/pages/AppointmentWorkspace/components/TitleAddIcon';
import BilledBadge from '@/app/features/appointments/pages/AppointmentWorkspace/components/BilledBadge';
import type { LineItem, LineItemBreakdown } from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';

type ServicesPackagesEditorProps = {
  items: LineItem[];
  readOnly: boolean;
  deleteLocked?: boolean;
  onAddItem: (item: Omit<LineItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<LineItem>) => void;
  onRemoveItem: (id: string) => void;
};

/** Searchable catalog — results only surface as the user types (no chips up front). */
const CATALOG_ITEMS: Omit<LineItem, 'id'>[] = [
  {
    refId: 'svc-physical-exam',
    kind: 'SERVICE',
    name: 'Physical examination',
    qty: 1,
    instructions: 'Assess mobility and pain response',
    unitPriceCents: 8500,
    amountCents: 8500,
  },
  {
    refId: 'pkg-arthritis-care',
    kind: 'PACKAGE',
    name: 'Arthritis care package',
    qty: 1,
    instructions: 'Includes exam, injection and follow-up',
    unitPriceCents: 18500,
    amountCents: 18500,
    breakdown: [
      { id: 'pkg-bd-1', name: 'Mobility exam', qty: 1, instructions: '-', amountCents: 8500 },
      { id: 'pkg-bd-2', name: 'SC Injection', qty: 1, instructions: '-', amountCents: 7000 },
      { id: 'pkg-bd-3', name: 'Care instructions', qty: 1, instructions: '-', amountCents: 3000 },
    ],
  },
];

const formatCents = (cents: number): string => formatMoney(cents / 100, 'USD');

const copyValue = (value?: string) => {
  if (!value || !globalThis.navigator?.clipboard) return;
  globalThis.navigator.clipboard.writeText(value).catch(() => undefined);
};

const ItemTag = ({ kind }: { kind: LineItem['kind'] }) => (
  <span className="rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
    {kind === 'PACKAGE' ? 'Package' : 'Service'}
  </span>
);

/** Shared column template + header row so parent items and breakdowns line up. */
const ROW_GRID = 'grid gap-3 sm:grid-cols-[1.6fr_100px_1.4fr_110px_120px] sm:items-center';

const ColumnHeadings = () => (
  <div
    className={`${ROW_GRID} px-1 text-caption-2 font-medium tracking-wide text-text-secondary uppercase`}
  >
    <span>Name</span>
    <span>Qty.</span>
    <span className="hidden sm:block">Instructions</span>
    <span className="hidden sm:block">Amount</span>
    <span aria-hidden="true" className="hidden sm:block" />
  </div>
);

/**
 * Inline, nested package breakdown. Rows reuse the parent column template so they
 * line up under the same headings — the breakdown itself has no repeated headers.
 */
const PackageBreakdown = ({ rows }: { rows: LineItemBreakdown[] }) => (
  <div className="mt-3">
    <SectionContainer title="Breakdown" nested className="bg-neutral-0">
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`${ROW_GRID} py-2.5 text-body-4 text-text-primary first:border-t-0`}
          >
            <span>{row.name}</span>
            <span className="text-text-secondary">x{row.qty}</span>
            <span className="hidden text-text-secondary sm:block">{row.instructions ?? '-'}</span>
            <span className="pl-6 font-medium">{formatCents(row.amountCents)}</span>
            <span aria-hidden="true" className="hidden sm:block" />
          </li>
        ))}
      </ul>
    </SectionContainer>
  </div>
);

/** Editable quantity box (finance-style); re-derives amount from unit price. The
 * "Qty." label comes from the shared column heading, so the input itself is
 * label-free (aria-label kept for accessibility). */
const QtyInput = ({
  item,
  onUpdateItem,
}: {
  item: LineItem;
  onUpdateItem: (id: string, patch: Partial<LineItem>) => void;
}) => (
  <input
    type="number"
    min={1}
    value={item.qty}
    aria-label={`Quantity for ${item.name}`}
    onChange={(e) => {
      const qty = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
      onUpdateItem(item.id, { qty, amountCents: item.unitPriceCents * qty });
    }}
    className="h-9 w-20 rounded-xl border border-input-border-default bg-transparent px-3 text-body-4 text-text-primary focus-visible:border-input-border-active focus-visible:outline-none"
  />
);

const ServicesPackagesEditor = ({
  items,
  readOnly,
  deleteLocked = readOnly,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: ServicesPackagesEditorProps) => {
  const [search, setSearch] = useState('');
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return CATALOG_ITEMS.filter((item) => item.name.toLowerCase().includes(query));
  }, [search]);

  const handleTogglePackage = (id: string) => {
    setExpandedPackageId((current) => (current === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search row sits above the floating container (matches the other steps);
          results surface as a dropdown on type. Locking is now per-item (billed),
          so adding new items always stays available. */}
      <div className="relative flex justify-end">
        <div className="relative w-full sm:max-w-90">
          <Search
            value={search}
            setSearch={setSearch}
            placeholder="Search for services, packages..."
            label="Search for services and packages"
            className="w-full!"
          />
          {matches.length > 0 && (
            <ul className="absolute right-0 z-20 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
              {matches.map((item) => (
                <li key={item.refId}>
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
                    <ItemTag kind={item.kind} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SectionContainer
        titleClassName="text-yc-20-b-primary"
        title="Services & Packages"
        titleIcon={<TitleAddIcon />}
        className="flex flex-col gap-5"
      >
        {items.length === 0 ? (
          <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
            No services or packages added yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="hidden px-5 sm:block">
              <ColumnHeadings />
            </div>
            <ul className="flex flex-col gap-3">
              {items.map((item, index) => {
                const expanded = expandedPackageId === item.id;
                const breakdown = item.breakdown ?? [];
                // Billed/paid items are locked: no qty edits, no delete.
                const isBilled = Boolean(item.billed);
                const rowReadOnly = readOnly || isBilled;
                return (
                  <li key={item.id} className="rounded-2xl border border-card-border p-4">
                    <div className={`${ROW_GRID} text-body-4 text-text-primary`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {index + 1}. {item.name}
                        </span>
                        <ItemTag kind={item.kind} />
                        {isBilled && <BilledBadge />}
                      </div>
                      {rowReadOnly ? (
                        <span className="text-text-secondary">x{item.qty}</span>
                      ) : (
                        <QtyInput item={item} onUpdateItem={onUpdateItem} />
                      )}
                      <span className="flex items-center gap-2 text-text-secondary">
                        <span className="truncate">{item.instructions ?? '-'}</span>
                        <CircleIconButton
                          icon={<LuCopy aria-hidden="true" />}
                          label={`Copy instructions for ${item.name}`}
                          onClick={() => copyValue(item.instructions)}
                        />
                      </span>
                      <span className="font-medium">{formatCents(item.amountCents)}</span>
                      <div className="flex justify-end gap-2">
                        {item.kind === 'PACKAGE' && (
                          <CircleIconButton
                            icon={
                              expanded ? (
                                <LuEyeOff aria-hidden="true" />
                              ) : (
                                <LuEye aria-hidden="true" />
                              )
                            }
                            label={
                              expanded
                                ? `Hide ${item.name} breakdown`
                                : `View ${item.name} breakdown`
                            }
                            variant="dark"
                            onClick={() => handleTogglePackage(item.id)}
                          />
                        )}
                        {!isBilled && (
                          <CircleIconButton
                            icon={<LuTrash2 aria-hidden="true" />}
                            label={`Remove ${item.name}`}
                            variant="danger"
                            disabled={deleteLocked}
                            onClick={() => onRemoveItem(item.id)}
                          />
                        )}
                      </div>
                    </div>
                    {expanded && breakdown.length > 0 && <PackageBreakdown rows={breakdown} />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionContainer>
    </div>
  );
};

export default ServicesPackagesEditor;
