import React, { useMemo, useState } from 'react';
import { LuCopy, LuPlus, LuPrinter, LuTrash2 } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import { Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import type {
  PrescriptionFulfillment,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';

type PrescriptionEditorProps = {
  items: PrescriptionItem[];
  readOnly: boolean;
  onAddItem: (item: Omit<PrescriptionItem, 'id'>) => void;
  onUpdateItem: (id: string, patch: Partial<PrescriptionItem>) => void;
  onRemoveItem: (id: string) => void;
  onPrint: () => void;
};

const MEDICATIONS: Omit<PrescriptionItem, 'id'>[] = [
  {
    medicineName: 'Gabapentin',
    dosage: '100mg',
    route: 'Oral',
    frequency: 'BID',
    durationDays: '7 days',
    instructions: 'Give with food',
    fulfillment: 'IN_HOUSE',
  },
  {
    medicineName: 'Carprofen',
    dosage: '25mg',
    route: 'Oral',
    frequency: 'SID',
    durationDays: '5 days',
    instructions: 'Monitor appetite',
    fulfillment: 'PRESCRIPTION_ONLY',
  },
];

const FULFILLMENT_LABELS: Record<PrescriptionFulfillment, string> = {
  IN_HOUSE: 'In-house fulfilled',
  PRESCRIPTION_ONLY: 'Prescription only',
};

const copyValue = (value?: string) => {
  if (!value || !globalThis.navigator?.clipboard) return;
  globalThis.navigator.clipboard.writeText(value).catch(() => undefined);
};

const FulfillmentToggle = ({
  value,
  disabled,
  onChange,
}: {
  value: PrescriptionFulfillment;
  disabled: boolean;
  onChange: (value: PrescriptionFulfillment) => void;
}) => (
  <div className="flex flex-wrap gap-2" aria-label="Prescription fulfillment">
    {(Object.keys(FULFILLMENT_LABELS) as PrescriptionFulfillment[]).map((option) => {
      const selected = option === value;
      return (
        <button
          key={option}
          type="button"
          disabled={disabled}
          aria-pressed={selected}
          className={`rounded-2xl border px-3 py-1.5 text-caption-1 transition-colors ${
            selected
              ? 'border-pill-success-border bg-pill-success-bg text-pill-success-text'
              : 'border-input-border-default text-text-secondary hover:border-input-border-active'
          }`}
          onClick={() => onChange(option)}
        >
          {FULFILLMENT_LABELS[option]}
        </button>
      );
    })}
  </div>
);

const PrescriptionEditor = ({
  items,
  readOnly,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onPrint,
}: PrescriptionEditorProps) => {
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return MEDICATIONS;
    return MEDICATIONS.filter((item) => item.medicineName.toLowerCase().includes(query));
  }, [search]);

  return (
    <SectionContainer title="Prescription" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <CircleIconButton
          icon={<LuPrinter aria-hidden="true" />}
          label="Print prescription"
          onClick={onPrint}
        />
        <Search
          value={search}
          setSearch={setSearch}
          placeholder="Search by medicine name, composition..."
          label="Search medicines"
          className="flex-1! w-full! xl:w-full!"
        />
      </div>

      {!readOnly && (
        <div className="rounded-2xl border border-dashed border-input-border-default p-3">
          <p className="mb-3 text-body-4 text-text-secondary">
            + Click to search and add medication
          </p>
          <div className="flex flex-wrap gap-2">
            {matches.map((item) => (
              <button
                type="button"
                key={item.medicineName}
                className="flex items-center gap-2 rounded-2xl border border-card-border px-3 py-2 text-body-4 text-text-primary hover:border-input-border-active"
                onClick={() => onAddItem(item)}
              >
                <LuPlus aria-hidden="true" />
                <span>{item.medicineName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-card-border">
        <table className="min-w-full text-body-4 text-text-primary">
          <thead className="bg-neutral-100 text-caption-1 text-text-secondary">
            <tr>
              <th className="p-3 text-left">Medicine</th>
              <th className="p-3 text-left">Dosage</th>
              <th className="p-3 text-left">Route</th>
              <th className="p-3 text-left">Freq.</th>
              <th className="p-3 text-left">Duration</th>
              <th className="p-3 text-left">Instructions</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-card-border">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.medicineName}</span>
                    <CircleIconButton
                      icon={<LuCopy aria-hidden="true" />}
                      label={`Copy ${item.medicineName}`}
                      onClick={() => copyValue(item.medicineName)}
                    />
                  </div>
                </td>
                <td className="p-3">{item.dosage ?? '-'}</td>
                <td className="p-3">{item.route ?? '-'}</td>
                <td className="p-3">{item.frequency ?? '-'}</td>
                <td className="p-3">{item.durationDays ?? '-'}</td>
                <td className="p-3">
                  <span className="mr-2">{item.instructions ?? '-'}</span>
                  <CircleIconButton
                    icon={<LuCopy aria-hidden="true" />}
                    label={`Copy instructions for ${item.medicineName}`}
                    onClick={() => copyValue(item.instructions)}
                  />
                  <div className="mt-2">
                    <FulfillmentToggle
                      value={item.fulfillment}
                      disabled={readOnly}
                      onChange={(fulfillment) => onUpdateItem(item.id, { fulfillment })}
                    />
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <CircleIconButton
                      icon={<LuTrash2 aria-hidden="true" />}
                      label={`Remove ${item.medicineName}`}
                      variant="danger"
                      disabled={readOnly}
                      onClick={() => onRemoveItem(item.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No prescription items added yet.
        </p>
      )}

      <div className="flex justify-start">
        <Secondary
          text="Print prescription"
          icon={<LuPrinter aria-hidden="true" />}
          onClick={onPrint}
        />
      </div>
    </SectionContainer>
  );
};

export default PrescriptionEditor;
