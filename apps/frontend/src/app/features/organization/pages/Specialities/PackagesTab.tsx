import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { RiEdit2Line } from 'react-icons/ri';
import { MdDeleteForever } from 'react-icons/md';
import { IoChevronDown } from 'react-icons/io5';
import { AiOutlineInfoCircle, AiOutlinePlus } from 'react-icons/ai';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { PackageRevamp } from '@/app/features/organization/types/revamp';
import PackageFormDraft from '@/app/features/organization/pages/Specialities/PackageFormDraft';
import PackageBreakdownTable from '@/app/features/organization/pages/Specialities/PackageBreakdownTable';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import Badge from '@/app/ui/Badge';
import { useNotify } from '@/app/hooks/useNotify';
import { computePackageTotals } from '@/app/features/organization/services/revampMockData';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';

export type PackagesTabHandle = { openAdd: () => void };

type PackagesTabProps = {
  specialityId: string;
  organisationId: string;
};

type ActionMode = null | 'edit' | 'delete';

const PackageCard = ({
  pkg,
  index,
  onEdit,
  onDelete,
}: {
  pkg: PackageRevamp;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const [showBreakdown, setShowBreakdown] = useState(index === 0);
  const { totalCost } = computePackageTotals(pkg);

  return (
    <div className="flex items-start gap-3">
      <span className="text-body-4 font-semibold text-text-secondary shrink-0 w-6 text-right leading-none -mt-1.5">
        {index + 1}.
      </span>
      <SectionContainer
        title={pkg.name}
        titleColor="var(--color-neutral-900)"
        titleSlot={pkg.isBookable ? <Badge tone="brand">✓ Bookable</Badge> : undefined}
        className="flex-1 min-w-0"
      >
        {/* Action buttons on mobile */}
        <div className="flex sm:hidden items-center justify-end gap-2 mb-3">
          <button
            type="button"
            aria-label={`View breakdown of ${pkg.name}`}
            onClick={() => setShowBreakdown((p) => !p)}
            className="flex items-center justify-center w-10 h-10 rounded-full border-[1.5px] border-neutral-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
          >
            <IoChevronDown
              size={20}
              aria-hidden="true"
              style={{
                transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
            />
          </button>
          <button
            type="button"
            aria-label={`Edit ${pkg.name}`}
            onClick={onEdit}
            className="flex items-center justify-center w-10 h-10 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
          >
            <RiEdit2Line size={20} color="var(--color-neutral-900)" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${pkg.name}`}
            onClick={onDelete}
            className="flex items-center justify-center w-10 h-10 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors"
          >
            <MdDeleteForever size={20} color="var(--color-danger-600)" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Mobile: 2-column grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden">
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                <span className="text-body-4 text-text-primary break-all">{pkg.code}</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Duration</span>
                <span className="text-body-4 text-text-primary">{pkg.durationMinutes} mins</span>
              </div>
              <div className="col-span-2">
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Description
                </span>
                <span className="text-body-4 text-text-primary">{pkg.description || '—'}</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Max discount
                </span>
                <span className="text-body-4 text-text-primary">{pkg.additionalDiscount}%</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Total Amount
                </span>
                <span className="text-body-4-emphasis text-text-primary">
                  $ {totalCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Desktop: single-row grid */}
            <div
              className="hidden sm:grid gap-x-6 gap-y-1 items-start"
              style={{ gridTemplateColumns: 'auto minmax(0,220px) auto auto auto' }}
            >
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">{pkg.code}</span>
              </div>
              <div className="min-w-0">
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Description
                </span>
                <span className="text-body-4 text-text-primary line-clamp-2">
                  {pkg.description || '—'}
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Duration</span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  {pkg.durationMinutes} mins
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Max discount
                </span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  {pkg.additionalDiscount}%
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Total Amount
                </span>
                <span className="text-body-4-emphasis text-text-primary whitespace-nowrap">
                  $ {totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons — hidden on mobile (shown above) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={`View breakdown of ${pkg.name}`}
              onClick={() => setShowBreakdown((p) => !p)}
              className="flex items-center justify-center w-12 h-12 rounded-full border-[1.5px] border-neutral-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
            >
              <IoChevronDown
                size={24}
                aria-hidden="true"
                style={{
                  transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 150ms ease',
                }}
              />
            </button>
            <button
              type="button"
              aria-label={`Edit ${pkg.name}`}
              onClick={onEdit}
              className="flex items-center justify-center w-12 h-12 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
            >
              <RiEdit2Line size={24} color="var(--color-neutral-900)" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${pkg.name}`}
              onClick={onDelete}
              className="flex items-center justify-center w-12 h-12 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors"
            >
              <MdDeleteForever size={24} color="var(--color-danger-600)" aria-hidden="true" />
            </button>
          </div>
        </div>

        {showBreakdown && pkg.breakdown.length > 0 && (
          <SectionContainer
            title="Breakdown"
            nested
            titleColor="var(--color-neutral-900)"
            className="mt-4"
          >
            <PackageBreakdownTable
              items={pkg.breakdown}
              additionalDiscount={pkg.additionalDiscount}
              editable={false}
            />
          </SectionContainer>
        )}
      </SectionContainer>
    </div>
  );
};

const PackagesTab = forwardRef<PackagesTabHandle, PackagesTabProps>(function PackagesTab(
  { specialityId, organisationId },
  ref
) {
  const packages = useRevampCatalogStore(
    useShallow((s) =>
      s.packages.filter((pkg) => pkg.specialityId === specialityId && pkg.status === 'ACTIVE')
    )
  );
  const deletePackage = useRevampCatalogStore((s) => s.deletePackage);
  const { notify } = useNotify();

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftAtTop, setDraftAtTop] = useState(false);
  const [activePackage, setActivePackage] = useState<PackageRevamp | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setActivePackage(null);
      setDraftAtTop(true);
      setDraftOpen(true);
    },
  }));

  const handleEdit = (pkg: PackageRevamp) => {
    setActivePackage(pkg);
    setActionMode('edit');
    setDraftOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!activePackage) return;
    deletePackage(activePackage.id);
    notify('success', {
      title: 'Package deleted',
      text: `"${activePackage.name}" has been removed.`,
    });
    setActionMode(null);
    setActivePackage(null);
  };

  const handleCloseForm = () => {
    setDraftOpen(false);
    setDraftAtTop(false);
    setActivePackage(null);
    setActionMode(null);
  };

  return (
    <div className="flex flex-col gap-7 py-5">
      {draftOpen && !activePackage && draftAtTop && (
        <PackageFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {packages.length === 0 && !draftOpen && (
        <div className="flex items-center justify-center gap-2 py-8 text-body-4 text-text-secondary">
          <AiOutlineInfoCircle size={16} aria-hidden="true" />
          You haven&apos;t added any packages yet.
        </div>
      )}

      {packages.map((pkg, i) =>
        draftOpen && activePackage?.id === pkg.id && actionMode === 'edit' ? (
          <PackageFormDraft
            key={pkg.id}
            specialityId={specialityId}
            organisationId={organisationId}
            editPackage={pkg}
            onClose={handleCloseForm}
          />
        ) : (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            index={i}
            onEdit={() => handleEdit(pkg)}
            onDelete={() => {
              setActivePackage(pkg);
              setActionMode('delete');
            }}
          />
        )
      )}

      {draftOpen && !activePackage && !draftAtTop && (
        <PackageFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {!draftOpen && (
        <button
          type="button"
          onClick={() => {
            setActivePackage(null);
            setDraftAtTop(false);
            setDraftOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-input-border-active text-body-4 text-text-brand hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <AiOutlinePlus size={16} aria-hidden="true" />
          Click to add package
        </button>
      )}

      {actionMode === 'delete' && activePackage && (
        <CenterModal
          showModal
          setShowModal={() => {
            setActionMode(null);
            setActivePackage(null);
          }}
        >
          <ModalHeader
            title="Delete package"
            onClose={() => {
              setActionMode(null);
              setActivePackage(null);
            }}
          />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to delete <strong>{activePackage.name}</strong>? This action
            cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text="Cancel"
              onClick={() => {
                setActionMode(null);
                setActivePackage(null);
              }}
            />
            <Delete href="#" text="Delete" onClick={handleDeleteConfirm} />
          </div>
        </CenterModal>
      )}
    </div>
  );
});

export default PackagesTab;
