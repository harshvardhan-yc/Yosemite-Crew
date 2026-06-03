import React, { useMemo, useState } from 'react';
import { LuCopy, LuEye, LuEyeOff, LuPlus, LuTrash2 } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import type { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import type { LineItem, LineItemBreakdown } from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';

type ServicesPackagesEditorProps = {
  items: LineItem[];
  readOnly: boolean;
  onAddItem: (item: Omit<LineItem, 'id'>) => void;
  onRemoveItem: (id: string) => void;
};

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

const toPackageBreakdownItem = (item: LineItemBreakdown): PackageBreakdownItem => ({
  id: item.id,
  type: 'PROCEDURE',
  name: item.name,
  unitPrice: item.amountCents / 100,
  quantity: item.qty,
  discount: 0,
});

const copyValue = (value?: string) => {
  if (!value || !globalThis.navigator?.clipboard) return;
  globalThis.navigator.clipboard.writeText(value).catch(() => undefined);
};

const ItemTag = ({ kind }: { kind: LineItem['kind'] }) => (
  <span className="rounded-2xl bg-primary-100 px-2 py-0.5 text-caption-2 font-medium text-text-brand">
    {kind === 'PACKAGE' ? 'Package' : 'Service'}
  </span>
);

const ServicesPackagesEditor = ({
  items,
  readOnly,
  onAddItem,
  onRemoveItem,
}: ServicesPackagesEditorProps) => {
  const [search, setSearch] = useState('');
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CATALOG_ITEMS;
    return CATALOG_ITEMS.filter((item) => item.name.toLowerCase().includes(query));
  }, [search]);

  const handleTogglePackage = (id: string) => {
    setExpandedPackageId((current) => (current === id ? null : id));
  };

  return (
    <SectionContainer title="Services & Packages" className="flex flex-col gap-5">
      <Search
        value={search}
        setSearch={setSearch}
        placeholder="Search for services, packages..."
        label="Search for services and packages"
        className="w-full! xl:w-full!"
      />

      {!readOnly && (
        <div className="rounded-2xl border border-dashed border-input-border-default p-3">
          <p className="mb-3 text-body-4 text-text-secondary">+ Click to search and add service</p>
          <div className="flex flex-wrap gap-2">
            {matches.map((item) => (
              <button
                type="button"
                key={item.refId}
                className="flex items-center gap-2 rounded-2xl border border-card-border px-3 py-2 text-body-4 text-text-primary hover:border-input-border-active"
                onClick={() => onAddItem(item)}
              >
                <LuPlus aria-hidden="true" />
                <span>{item.name}</span>
                <ItemTag kind={item.kind} />
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <SectionContainer title="Breakdown" nested className="bg-neutral-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-body-4 text-text-primary border-separate border-spacing-0">
              <thead className="text-caption-1 text-text-secondary">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Qnt.</th>
                  <th className="p-3 text-left">Instructions</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const expanded = expandedPackageId === item.id;
                  const breakdown = item.breakdown?.map(toPackageBreakdownItem) ?? [];
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="border-t border-card-border">
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            <ItemTag kind={item.kind} />
                            <CircleIconButton
                              icon={<LuCopy aria-hidden="true" />}
                              label={`Copy ${item.name}`}
                              onClick={() => copyValue(item.name)}
                            />
                          </div>
                        </td>
                        <td className="p-3">x{item.qty}</td>
                        <td className="p-3">
                          <span className="mr-2">{item.instructions ?? '-'}</span>
                          <CircleIconButton
                            icon={<LuCopy aria-hidden="true" />}
                            label={`Copy instructions for ${item.name}`}
                            onClick={() => copyValue(item.instructions)}
                          />
                        </td>
                        <td className="p-3 text-right">{formatCents(item.amountCents)}</td>
                        <td className="p-3">
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
                            <CircleIconButton
                              icon={<LuTrash2 aria-hidden="true" />}
                              label={`Remove ${item.name}`}
                              variant="danger"
                              disabled={readOnly}
                              onClick={() => onRemoveItem(item.id)}
                            />
                          </div>
                        </td>
                      </tr>
                      {expanded && breakdown.length > 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="border-t border-card-border bg-primary-100/30 p-4"
                          >
                            <PackageBreakdownTable
                              items={breakdown}
                              additionalDiscount={0}
                              editable={false}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionContainer>
      )}

      {items.length === 0 && (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No services or packages added yet.
        </p>
      )}
    </SectionContainer>
  );
};

export default ServicesPackagesEditor;
