import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';
import SpecialitiesTable from '@/app/ui/tables/SpecialitiesTable';
import SpecialitiesTableRevamp from '@/app/ui/tables/SpecialitiesTableRevamp';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AddSpeciality from '@/app/features/organization/pages/Organization/Sections/Specialities/AddSpeciality';
import SpecialityInfo from '@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityInfo';
import { useSpecialitiesWithServiceNamesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isAppointmentRevampEnabled } from '@/app/lib/featureFlags';

const Specialities = () => {
  const specialities = useSpecialitiesWithServiceNamesForPrimaryOrg();
  const { can } = usePermissions();
  const canEditSpecialities = can(PERMISSIONS.SPECIALITIES_EDIT_ANY);
  const router = useRouter();
  const revampEnabled = isAppointmentRevampEnabled();

  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeSpeciality, setActiveSpeciality] = useState<SpecialityWeb | null>(
    specialities[0] ?? null
  );

  useEffect(() => {
    setActiveSpeciality((prev) => {
      if (specialities.length === 0) return null;
      if (prev?._id) {
        const updated = specialities.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return specialities[0];
    });
  }, [specialities]);

  if (revampEnabled) {
    return (
      <PermissionGate allOf={[PERMISSIONS.SPECIALITIES_VIEW_ANY]}>
        <AccordionButton
          title="Specialties, services & packages"
          buttonTitle="Manage"
          buttonClick={() => router.push('/organization/specialities')}
          showButton={canEditSpecialities}
        >
          <SpecialitiesTableRevamp
            filteredList={specialities}
            onManageTeam={(s) => {
              setActiveSpeciality(s);
              setViewPopup(true);
            }}
          />
        </AccordionButton>
        {activeSpeciality && (
          <SpecialityInfo
            showModal={viewPopup}
            setShowModal={setViewPopup}
            activeSpeciality={activeSpeciality}
            canEditSpecialities={canEditSpecialities}
          />
        )}
      </PermissionGate>
    );
  }

  return (
    <PermissionGate allOf={[PERMISSIONS.SPECIALITIES_VIEW_ANY]}>
      <AccordionButton
        title="Specialties, services & packages"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditSpecialities}
      >
        <SpecialitiesTable
          filteredList={specialities}
          setActive={setActiveSpeciality}
          setView={setViewPopup}
        />
      </AccordionButton>
      <AddSpeciality showModal={addPopup} setShowModal={setAddPopup} specialities={specialities} />
      {activeSpeciality && (
        <SpecialityInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeSpeciality={activeSpeciality}
          canEditSpecialities={canEditSpecialities}
        />
      )}
    </PermissionGate>
  );
};

export default Specialities;
