import React, { useCallback, useId, useState } from 'react';
import { MdOutlineArchive } from 'react-icons/md';
import { FiCheck } from 'react-icons/fi';
import { IoIosSearch } from 'react-icons/io';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Badge from '@/app/ui/Badge';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import {
  CatalogItemType,
  PackageBreakdownItem,
  PackageRevamp,
} from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { useNotify } from '@/app/hooks/useNotify';
import { computePackageTotals } from '@/app/features/organization/services/revampMockData';

const DURATION_OPTIONS = [
  { value: '15', label: '15 mins' },
  { value: '30', label: '30 mins' },
  { value: '45', label: '45 mins' },
  { value: '60', label: '60 mins' },
  { value: '90', label: '90 mins' },
  { value: '120', label: '120 mins' },
];

const LEAD_OPTIONS = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const STAFF_COUNT_OPTIONS = Array.from({ length: 6 }, (_, i) => ({
  value: String(i),
  label: String(i),
}));

const STATIC_CATALOG: Array<{
  id: string;
  name: string;
  type: CatalogItemType;
  unitPrice: number;
  defaultDiscount?: number;
  maxDiscount?: number;
}> = [
  {
    id: 'sc-1',
    name: 'Radiographic Consultation',
    type: 'CONSULTATION',
    unitPrice: 100,
    defaultDiscount: 0,
    maxDiscount: 15,
  },
  {
    id: 'sc-2',
    name: 'Amoxicillin Tablet',
    type: 'MEDICATION',
    unitPrice: 10,
    defaultDiscount: 0,
    maxDiscount: 10,
  },
  {
    id: 'sc-3',
    name: 'Syringe',
    type: 'INVENTORY',
    unitPrice: 10,
    defaultDiscount: 0,
    maxDiscount: 10,
  },
  {
    id: 'sc-4',
    name: 'MRI Procedure',
    type: 'PROCEDURE',
    unitPrice: 100,
    defaultDiscount: 0,
    maxDiscount: 5,
  },
  {
    id: 'sc-5',
    name: 'CBC - Canine',
    type: 'LAB',
    unitPrice: 1200,
    defaultDiscount: 2,
    maxDiscount: 10,
  },
  {
    id: 'sc-6',
    name: 'Blood Panel - Feline',
    type: 'LAB',
    unitPrice: 800,
    defaultDiscount: 0,
    maxDiscount: 10,
  },
  {
    id: 'sc-7',
    name: 'X-Ray Chest',
    type: 'PROCEDURE',
    unitPrice: 1200,
    defaultDiscount: 5,
    maxDiscount: 15,
  },
];

type PackageFormDraftProps = {
  specialityId: string;
  organisationId: string;
  editPackage?: PackageRevamp;
  onClose: () => void;
};

type FormErrors = Partial<Record<string, string>>;

type CatalogEntry = {
  id: string;
  name: string;
  type: CatalogItemType;
  unitPrice: number;
  defaultDiscount: number;
  maxDiscount: number;
  nestedBreakdown?: PackageBreakdownItem[];
};

const PackageFormDraft = ({
  specialityId,
  organisationId,
  editPackage,
  onClose,
}: PackageFormDraftProps) => {
  const isEditing = Boolean(editPackage);
  const addPackage = useRevampCatalogStore((s) => s.addPackage);
  const updatePackage = useRevampCatalogStore((s) => s.updatePackage);
  const archivePackage = useRevampCatalogStore((s) => s.archivePackage);

  // Pull all active packages from store for cross-package inclusion
  const allActivePackages = useRevampCatalogStore(
    useShallow((s) =>
      s.packages.filter((p) => p.status === 'ACTIVE' && (!editPackage || p.id !== editPackage.id))
    )
  );

  const { notify } = useNotify();

  const [name, setName] = useState(editPackage?.name ?? '');
  const [description, setDescription] = useState(editPackage?.description ?? '');
  const [duration, setDuration] = useState(String(editPackage?.durationMinutes ?? 30));
  const [leadCount, setLeadCount] = useState((editPackage?.leadCount ?? 1) >= 1 ? '1' : '0');
  const [supportCount, setSupportCount] = useState(String(editPackage?.supportCount ?? 0));
  const [isBookable, setIsBookable] = useState(editPackage?.isBookable ?? false);
  const [additionalDiscount, setAdditionalDiscount] = useState(
    String(editPackage?.additionalDiscount ?? 0)
  );
  const [breakdown, setBreakdown] = useState<PackageBreakdownItem[]>(editPackage?.breakdown ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Build combined catalog: static items + active packages from store
  const combinedCatalog: CatalogEntry[] = [
    ...STATIC_CATALOG.map((s) => ({
      ...s,
      defaultDiscount: s.defaultDiscount ?? 0,
      maxDiscount: s.maxDiscount ?? 100,
    })),
    ...allActivePackages.map((pkg) => {
      const { totalCost } = computePackageTotals(pkg);
      return {
        id: pkg.id,
        name: pkg.name,
        type: 'PACKAGE' as CatalogItemType,
        unitPrice: totalCost,
        defaultDiscount: 0,
        maxDiscount: 100,
        nestedBreakdown: pkg.breakdown,
      };
    }),
  ];

  const filteredSearch = searchQuery.trim()
    ? combinedCatalog.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const addBreakdownItem = useCallback(
    (catalog: CatalogEntry) => {
      const existing = breakdown.find((b) => b.name === catalog.name);
      if (existing) {
        setBreakdown((prev) =>
          prev.map((b) => (b.id === existing.id ? { ...b, quantity: b.quantity + 1 } : b))
        );
      } else {
        setBreakdown((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: catalog.type,
            name: catalog.name,
            unitPrice: catalog.unitPrice,
            quantity: 1,
            discount: catalog.defaultDiscount,
            maxDiscount: catalog.maxDiscount,
            nestedBreakdown: catalog.nestedBreakdown,
          },
        ]);
      }
      setSearchQuery('');
    },
    [breakdown]
  );

  const removeBreakdownItem = useCallback((id: string) => {
    setBreakdown((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handleChangeQty = useCallback((id: string, qty: number) => {
    setBreakdown((prev) => prev.map((b) => (b.id === id ? { ...b, quantity: qty } : b)));
  }, []);

  const handleChangeDiscount = useCallback((id: string, discount: number) => {
    setBreakdown((prev) => prev.map((b) => (b.id === id ? { ...b, discount } : b)));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Package name is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name]);

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      name: name.trim(),
      description: description.trim(),
      specialityId,
      organisationId,
      durationMinutes: parseInt(duration, 10),
      leadCount: parseInt(leadCount, 10),
      supportCount: parseInt(supportCount, 10),
      isBookable,
      additionalDiscount: parseFloat(additionalDiscount) || 0,
      breakdown,
      status: 'ACTIVE' as const,
    };
    if (isEditing && editPackage) {
      updatePackage(editPackage.id, payload);
      notify('success', { title: 'Package updated', text: `"${name}" has been saved.` });
    } else {
      addPackage(payload);
      notify('success', { title: 'Package added', text: `"${name}" has been created.` });
    }
    onClose();
  };

  const handleArchive = () => {
    if (!editPackage) return;
    archivePackage(editPackage.id);
    notify('success', {
      title: 'Package archived',
      text: `"${editPackage.name}" has been archived.`,
    });
    onClose();
  };

  const descId = useId();
  const draftTitle = `${isEditing ? name || 'Package' : 'New Package'} (draft)`;
  const draftTitleSlot = (
    <>
      {editPackage?.code && (
        <span className="text-caption-1 text-text-secondary border border-card-border rounded-2xl px-3 py-1">
          {editPackage.code}
        </span>
      )}
      {isBookable && <Badge tone="brand">✓ Bookable</Badge>}
    </>
  );

  const TYPE_LABELS: Record<string, string> = {
    CONSULTATION: 'Consultation',
    PROCEDURE: 'Procedure',
    LAB: 'Diagnostics',
    INVENTORY: 'Inventory',
    MEDICATION: 'Medication',
    PACKAGE: 'Package',
  };

  return (
    <SectionContainer title={draftTitle} titleSlot={draftTitleSlot} className="flex flex-col gap-5">
      {/* Two-column top section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
        {/* Left col: Name + Description */}
        <div className="flex flex-col gap-4">
          <FormInput
            intype="text"
            inlabel="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: undefined }));
            }}
            error={errors.name}
          />
          <div className="relative w-full">
            <textarea
              id={descId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=" "
              className="peer w-full rounded-2xl bg-transparent px-6 pt-4 pb-3 text-body-4 text-text-primary outline-none border border-input-border-default focus:border-input-border-active resize-none min-h-28"
            />
            <label
              htmlFor={descId}
              className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate text-body-4 text-input-text-placeholder transition-all duration-200 peer-focus:-top-2.5 peer-focus:left-4 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-input-text-placeholder-active peer-focus:bg-(--whitebg) peer-focus:px-1.5 peer-focus:max-w-none peer-not-placeholder-shown:px-1.5 peer-not-placeholder-shown:-top-2.5 peer-not-placeholder-shown:left-4 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:bg-(--whitebg) peer-not-placeholder-shown:max-w-none"
            >
              Description
            </label>
          </div>
        </div>

        {/* Right col: Duration / Lead+Support row / Bookable checkbox */}
        <div className="flex flex-col gap-4">
          <LabelDropdown
            placeholder="Duration"
            options={DURATION_OPTIONS}
            defaultOption={duration}
            onSelect={(o) => setDuration(o.value)}
            portal
          />
          <div className="grid grid-cols-2 gap-4">
            <LabelDropdown
              placeholder="Lead"
              options={LEAD_OPTIONS}
              defaultOption={leadCount}
              onSelect={(o) => setLeadCount(o.value)}
              portal
            />
            <LabelDropdown
              placeholder="Support"
              options={STAFF_COUNT_OPTIONS}
              defaultOption={supportCount}
              onSelect={(o) => setSupportCount(o.value)}
              portal
            />
          </div>
          <label className="flex items-center justify-end gap-2 cursor-pointer select-none text-body-4 text-text-secondary whitespace-nowrap">
            <input
              type="checkbox"
              checked={isBookable}
              onChange={(e) => setIsBookable(e.target.checked)}
              className="w-4 h-4 shrink-0 accent-(--color-input-border-active)"
            />
            Is this Package Bookable?
          </label>
        </div>
      </div>

      <SectionContainer title="Breakdown" nested titleColor="var(--color-neutral-900)">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="flex items-center gap-2 w-full border border-input-border-default rounded-2xl px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-white">
              <input
                type="text"
                placeholder="Search services, inventory, lab tests, packages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
                aria-label="Search catalog items"
              />
              <IoIosSearch
                size={20}
                color="var(--color-neutral-900)"
                aria-hidden="true"
                className="shrink-0"
              />
            </div>
            {filteredSearch.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-card-border rounded-2xl shadow-lg overflow-hidden">
                {filteredSearch.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addBreakdownItem(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-card-hover text-body-4 text-text-primary"
                  >
                    <span>{item.name}</span>
                    <span className="text-caption-1 text-text-secondary">
                      {TYPE_LABELS[item.type] ?? item.type} · $ {item.unitPrice.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim() && filteredSearch.length === 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-card-border rounded-2xl shadow-lg px-4 py-3 text-body-4 text-text-secondary">
                No items found.
              </div>
            )}
          </div>

          {breakdown.length > 0 ? (
            <PackageBreakdownTable
              items={breakdown}
              additionalDiscount={parseFloat(additionalDiscount) || 0}
              editable
              onRemoveItem={removeBreakdownItem}
              onChangeQty={handleChangeQty}
              onChangeDiscount={handleChangeDiscount}
            />
          ) : (
            <p className="text-body-4 text-text-secondary text-center py-4">
              Search above to add items to the package breakdown.
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <span className="text-caption-1 text-text-secondary">Additional Discount (%)</span>
            <div className="w-32">
              <FormInput
                intype="number"
                inlabel="Discount %"
                value={additionalDiscount}
                onChange={(e) => setAdditionalDiscount(e.target.value)}
              />
            </div>
          </div>
        </div>
      </SectionContainer>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        {isEditing ? (
          <Secondary
            href="#"
            text="Archive Package"
            icon={<MdOutlineArchive size={16} />}
            onClick={handleArchive}
            style={{ borderColor: 'var(--color-text-error)', color: 'var(--color-text-error)' }}
          />
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <Secondary href="#" text="Cancel" onClick={onClose} />
          <Primary href="#" text="Save Package" icon={<FiCheck size={16} />} onClick={handleSave} />
        </div>
      </div>
    </SectionContainer>
  );
};

export default PackageFormDraft;
