import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { RiEdit2Line } from 'react-icons/ri';
import { MdDeleteForever } from 'react-icons/md';
import { AiOutlineInfoCircle, AiOutlinePlus } from 'react-icons/ai';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { ServiceRevamp } from '@/app/features/organization/types/revamp';
import ServiceFormDraft from '@/app/features/organization/pages/Specialities/ServiceFormDraft';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';
import { useNotify } from '@/app/hooks/useNotify';
import { computeServiceTotal } from '@/app/features/organization/services/revampMockData';
import Badge from '@/app/ui/Badge';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';

export type ServicesTabHandle = { openAdd: () => void };

type ServicesTabProps = {
  specialityId: string;
  organisationId: string;
};

type ActionMode = null | 'edit' | 'delete' | 'view';

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  LAB: 'Lab / Diagnostics',
  INVENTORY: 'Inventory',
  MEDICATION: 'Medication',
};

const ServiceRow = ({
  service,
  index,
  onEdit,
  onDelete,
}: {
  service: ServiceRevamp;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { total } = computeServiceTotal(service);
  return (
    <div className="flex items-start gap-3">
      <span className="text-body-4 font-semibold text-text-secondary shrink-0 w-6 text-right leading-none -mt-1.5">
        {index + 1}.
      </span>
      <SectionContainer
        title={service.name}
        titleColor="var(--color-neutral-900)"
        titleSlot={service.isBookable ? <Badge tone="brand">✓ Bookable</Badge> : undefined}
        className="flex-1 min-w-0"
      >
        {/* Action buttons row on mobile, inline on desktop */}
        <div className="flex sm:hidden items-center justify-end gap-2 mb-3">
          <button
            type="button"
            aria-label={`Edit ${service.name}`}
            onClick={onEdit}
            className="flex items-center justify-center w-10 h-10 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
          >
            <RiEdit2Line size={20} color="var(--color-neutral-900)" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${service.name}`}
            onClick={onDelete}
            className="flex items-center justify-center w-10 h-10 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors"
          >
            <MdDeleteForever size={20} color="var(--color-danger-600)" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-start gap-4">
          {/* Data grid: 2-col on mobile, full 8-col on large */}
          <div className="flex-1 min-w-0">
            {/* Mobile: 2-column grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden">
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                <span className="text-body-4 text-text-primary break-all">{service.code}</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Type</span>
                <span className="text-body-4 text-text-primary">
                  {TYPE_LABELS[service.type] ?? service.type}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Description
                </span>
                <span className="text-body-4 text-text-primary">{service.description || '—'}</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Duration</span>
                <span className="text-body-4 text-text-primary">
                  {service.durationMinutes} mins
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Gross amt.
                </span>
                <span className="text-body-4 text-text-primary">
                  $ {service.grossAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Disc. (default)
                </span>
                <span className="text-body-4 text-text-primary">-{service.defaultDiscount}%</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Max disc.</span>
                <span className="text-body-4 text-text-primary">-{service.maxDiscount}%</span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Total</span>
                <span className="text-body-4-emphasis text-text-primary">$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Desktop: single-row grid */}
            <div
              className="hidden sm:grid gap-x-6 gap-y-1 items-start"
              style={{ gridTemplateColumns: 'auto auto minmax(0,220px) auto auto auto auto auto' }}
            >
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Code</span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  {service.code}
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Type</span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  {TYPE_LABELS[service.type] ?? service.type}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Description
                </span>
                <span className="text-body-4 text-text-primary line-clamp-2">
                  {service.description || '—'}
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Duration</span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  {service.durationMinutes} mins
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Gross amt.
                </span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  $ {service.grossAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">
                  Disc. (default)
                </span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  -{service.defaultDiscount}%
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Max disc.</span>
                <span className="text-body-4 text-text-primary whitespace-nowrap">
                  -{service.maxDiscount}%
                </span>
              </div>
              <div>
                <span className="text-caption-2 font-bold text-text-tertiary block">Total</span>
                <span className="text-body-4-emphasis text-text-primary whitespace-nowrap">
                  $ {total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons — hidden on mobile (shown above), visible on sm+ */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={`Edit ${service.name}`}
              onClick={onEdit}
              className="flex items-center justify-center w-12 h-12 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors"
            >
              <RiEdit2Line size={24} color="var(--color-neutral-900)" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${service.name}`}
              onClick={onDelete}
              className="flex items-center justify-center w-12 h-12 rounded-full border-[1.5px] border-neutral-300 bg-white hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors"
            >
              <MdDeleteForever size={24} color="var(--color-danger-600)" aria-hidden="true" />
            </button>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};

const ServicesTab = forwardRef<ServicesTabHandle, ServicesTabProps>(function ServicesTab(
  { specialityId, organisationId },
  ref
) {
  const services = useRevampCatalogStore(
    useShallow((s) =>
      s.services.filter((svc) => svc.specialityId === specialityId && svc.status === 'ACTIVE')
    )
  );
  const deleteService = useRevampCatalogStore((s) => s.deleteService);
  const { notify } = useNotify();

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftAtTop, setDraftAtTop] = useState(false);
  const [activeService, setActiveService] = useState<ServiceRevamp | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);

  useImperativeHandle(ref, () => ({
    openAdd: () => {
      setActiveService(null);
      setDraftAtTop(true);
      setDraftOpen(true);
    },
  }));

  const handleAddClick = () => {
    setActiveService(null);
    setDraftAtTop(false);
    setDraftOpen(true);
  };

  const handleEdit = (svc: ServiceRevamp) => {
    setActiveService(svc);
    setActionMode('edit');
    setDraftOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!activeService) return;
    deleteService(activeService.id);
    notify('success', {
      title: 'Service deleted',
      text: `"${activeService.name}" has been removed.`,
    });
    setActionMode(null);
    setActiveService(null);
  };

  const handleCloseForm = () => {
    setDraftOpen(false);
    setDraftAtTop(false);
    setActiveService(null);
    setActionMode(null);
  };

  return (
    <div className="flex flex-col gap-7 py-5">
      {draftOpen && !activeService && draftAtTop && (
        <ServiceFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {services.length === 0 && !draftOpen && (
        <div className="flex items-center justify-center gap-2 py-8 text-body-4 text-text-secondary">
          <AiOutlineInfoCircle size={16} aria-hidden="true" />
          You haven&apos;t added any services yet.
        </div>
      )}

      {services.map((svc, i) =>
        draftOpen && activeService?.id === svc.id && actionMode === 'edit' ? (
          <ServiceFormDraft
            key={svc.id}
            specialityId={specialityId}
            organisationId={organisationId}
            editService={svc}
            onClose={handleCloseForm}
          />
        ) : (
          <ServiceRow
            key={svc.id}
            service={svc}
            index={i}
            onEdit={() => handleEdit(svc)}
            onDelete={() => {
              setActiveService(svc);
              setActionMode('delete');
            }}
          />
        )
      )}

      {draftOpen && !activeService && !draftAtTop && (
        <ServiceFormDraft
          specialityId={specialityId}
          organisationId={organisationId}
          onClose={handleCloseForm}
        />
      )}

      {!draftOpen && (
        <button
          type="button"
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-input-border-active text-body-4 text-text-brand hover:bg-blue-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          <AiOutlinePlus size={16} aria-hidden="true" />
          Click to add service
        </button>
      )}

      {actionMode === 'delete' && activeService && (
        <CenterModal
          showModal
          setShowModal={() => {
            setActionMode(null);
            setActiveService(null);
          }}
        >
          <ModalHeader
            title="Delete service"
            onClose={() => {
              setActionMode(null);
              setActiveService(null);
            }}
          />
          <p className="text-body-4 text-text-primary">
            Are you sure you want to delete <strong>{activeService.name}</strong>? This action
            cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Secondary
              href="#"
              text="Cancel"
              onClick={() => {
                setActionMode(null);
                setActiveService(null);
              }}
            />
            <Delete href="#" text="Delete" onClick={handleDeleteConfirm} />
          </div>
        </CenterModal>
      )}
    </div>
  );
});

export default ServicesTab;
