'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import SpecialityAccordionRevamp from '@/app/features/organization/pages/Specialities/SpecialityAccordionRevamp';
import AddSpecialityModal from '@/app/features/organization/pages/Specialities/AddSpecialityModal';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSearchStore } from '@/app/stores/searchStore';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';

const MOCK_ORG_ID = 'mock-org-001';

const SpecialitiesRevamp = () => {
  const specialities = useRevampCatalogStore((s) => s.specialities);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const searchQuery = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const openId = searchParams.get('open');

  const filteredSpecialities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const scopedSpecialities = primaryOrgId
      ? specialities.filter((s) => s.organisationId === primaryOrgId)
      : [];
    const mockSpecialities = specialities.filter((s) => s.organisationId === MOCK_ORG_ID);
    const orgSpecialities =
      scopedSpecialities.length > 0 || mockSpecialities.length === 0
        ? scopedSpecialities
        : mockSpecialities;
    if (!q) return orgSpecialities;
    return orgSpecialities.filter((s) => s.name.toLowerCase().includes(q));
  }, [primaryOrgId, specialities, searchQuery]);

  const formOrgId = primaryOrgId ?? MOCK_ORG_ID;

  return (
    <div className="flex flex-col w-full gap-6 px-4 md:px-8 py-6 max-w-350 mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/organization"
            aria-label="Back to Organisation"
            className="flex items-center justify-center size-9 rounded-full border border-card-border hover:border-text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <IoChevronBack size={18} color="var(--color-neutral-900)" aria-hidden="true" />
          </Link>
          <h1 className="text-heading-2 text-text-primary">Specialities</h1>
        </div>

        <Primary
          href="#"
          icon={<span>+</span>}
          text="Add Speciality"
          onClick={(e) => {
            e.preventDefault();
            setAddModalOpen(true);
          }}
        />
      </div>

      <MobileSearchBar placeholder="Search specialities" />

      {/* Speciality Accordions */}
      <div className="flex flex-col gap-4">
        {filteredSpecialities.map((spec, i) => (
          <SpecialityAccordionRevamp
            key={spec.id}
            speciality={spec}
            defaultOpen={openId ? spec.id === openId : i === 0}
          />
        ))}
        {filteredSpecialities.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border border-card-border text-text-secondary">
            <p className="text-body-3">
              {searchQuery ? `No specialities match "${searchQuery}"` : 'No specialities yet.'}
            </p>
            {!searchQuery && (
              <Primary
                href="#"
                icon={<span>+</span>}
                text="Add Speciality"
                onClick={(e) => {
                  e.preventDefault();
                  setAddModalOpen(true);
                }}
              />
            )}
          </div>
        )}
      </div>

      <AddSpecialityModal
        showModal={addModalOpen}
        setShowModal={setAddModalOpen}
        organisationId={formOrgId}
      />
    </div>
  );
};

export default SpecialitiesRevamp;
