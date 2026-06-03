import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Modal from '@/app/ui/overlays/Modal';
import React, { useMemo, useState } from 'react';
import { RoomsTypes } from '@/app/features/organization/pages/Organization/types';
import { Primary } from '@/app/ui/primitives/Buttons';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import { OrganisationRoom } from '@yosemite-crew/types';
import type { RoomUnit } from '@/app/features/appointments/types/workspace';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { createRoom } from '@/app/features/organization/services/roomService';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import Close from '@/app/ui/primitives/Icons/Close';
import { useNotify } from '@/app/hooks/useNotify';

type AddRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

type RoomWithUnits = OrganisationRoom & {
  unitCount?: number;
  units?: RoomUnit[];
};

const buildRoomUnits = (count: number): RoomUnit[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `unit-${index + 1}`,
    name: `${index + 1}`,
    occupied: false,
  }));

const INITIAL_FORM_DATA: RoomWithUnits = {
  id: '',
  organisationId: '',
  name: '',
  type: 'CONSULTATION',
  assignedSpecialiteis: [],
  assignedStaffs: [],
  unitCount: 0,
  units: [],
};

const AddRoom = ({ showModal, setShowModal }: AddRoomProps) => {
  const teams = useTeamForPrimaryOrg();
  const { notify } = useNotify();
  const specialities = useSpecialitiesForPrimaryOrg();
  const [formData, setFormData] = useState<RoomWithUnits>(INITIAL_FORM_DATA);
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
  }>({});

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      })),
    [teams]
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })),
    [specialities]
  );

  const handleSave = async () => {
    const errors: { name?: string } = {};
    if (!formData.name) errors.name = 'Name is required';
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const unitCount = Number(formData.unitCount ?? 0);
      const roomPayload: RoomWithUnits = {
        ...formData,
        unitCount,
        units: buildRoomUnits(unitCount),
      };
      await createRoom(roomPayload);
      notify('success', {
        title: 'Room created',
        text: 'Room has been created successfully.',
      });
      setShowModal(false);
      setFormData(INITIAL_FORM_DATA);
      setFormDataErrors({});
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to create room',
        text: 'Failed to create room. Please try again.',
      });
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add room</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between scrollbar-hidden">
          <Accordion title="Add room" defaultOpen showEditIcon={false} isEditing={true}>
            <div className="flex flex-col gap-3">
              <FormInput
                intype="text"
                inname="name"
                value={formData.name}
                inlabel="Name"
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formDataErrors.name}
              />
              <LabelDropdown
                placeholder="Type"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    type: option.value as OrganisationRoom['type'],
                  })
                }
                defaultOption={formData.type}
                options={RoomsTypes}
              />
              <FormInput
                intype="number"
                inname="unitCount"
                value={String(formData.unitCount ?? 0)}
                inlabel="Unit / pod count"
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setFormData({
                    ...formData,
                    unitCount: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                  });
                }}
              />
              <MultiSelectDropdown
                placeholder="Assigned specialities"
                value={formData.assignedSpecialiteis || []}
                onChange={(e) => setFormData({ ...formData, assignedSpecialiteis: e })}
                options={SpecialitiesOptions}
              />
              <MultiSelectDropdown
                placeholder="Assigned staff"
                value={formData.assignedStaffs || []}
                onChange={(e) => setFormData({ ...formData, assignedStaffs: e })}
                options={TeamOptions}
              />
            </div>
          </Accordion>
          <Primary href="#" text="Save" onClick={handleSave} />
        </div>
      </div>
    </Modal>
  );
};

export default AddRoom;
