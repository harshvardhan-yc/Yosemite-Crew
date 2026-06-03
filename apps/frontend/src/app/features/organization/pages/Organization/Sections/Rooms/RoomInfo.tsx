import EditableAccordion, { FieldConfig } from '@/app/ui/primitives/Accordion/EditableAccordion';
import Modal from '@/app/ui/overlays/Modal';
import { OrganisationRoom } from '@yosemite-crew/types';
import React, { useMemo } from 'react';
import type { RoomUnit } from '@/app/features/appointments/types/workspace';
import { RoomsTypes } from '@/app/features/organization/pages/Organization/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { deleteRoom, updateRoom } from '@/app/features/organization/services/roomService';
import Close from '@/app/ui/primitives/Icons/Close';
import { useNotify } from '@/app/hooks/useNotify';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: string;
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    return maybeError.response?.data?.message ?? maybeError.message ?? fallback;
  }

  return fallback;
};

type RoomInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: OrganisationRoom;
  canEditRoom: boolean;
};

type RoomWithUnits = OrganisationRoom & {
  unitCount?: number;
  units?: RoomUnit[];
};

const buildRoomUnits = (count: number, existingUnits: RoomUnit[] = []): RoomUnit[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => {
    const existing = existingUnits[index];
    return (
      existing ?? {
        id: `unit-${index + 1}`,
        name: `${index + 1}`,
        occupied: false,
      }
    );
  });

const getFields = ({
  TeamOptions,
  SpecialitiesOptions,
}: {
  TeamOptions: { label: string; value: string }[];
  SpecialitiesOptions: { label: string; value: string }[];
}) =>
  [
    { label: 'Name', key: 'name', type: 'text', required: true },
    { label: 'Type', key: 'type', type: 'dropdown', options: RoomsTypes },
    {
      label: 'Assigned speciality',
      key: 'assignedSpecialiteis',
      type: 'multiSelect',
      options: SpecialitiesOptions,
    },
    {
      label: 'Assigned staff',
      key: 'assignedStaffs',
      type: 'multiSelect',
      options: TeamOptions,
    },
    {
      label: 'Unit / pod count',
      key: 'unitCount',
      type: 'number',
    },
  ] satisfies FieldConfig[];

const RoomInfo = ({ showModal, setShowModal, activeRoom, canEditRoom }: RoomInfoProps) => {
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();

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

  const fields = useMemo(
    () => getFields({ TeamOptions, SpecialitiesOptions }),
    [TeamOptions, SpecialitiesOptions]
  );

  const roomInfoData = useMemo(
    () => ({
      name: activeRoom?.name ?? '',
      type: activeRoom?.type ?? '',
      assignedSpecialiteis: activeRoom?.assignedSpecialiteis ?? '',
      assignedStaffs: activeRoom?.assignedStaffs ?? '',
      unitCount:
        (activeRoom as RoomWithUnits | undefined)?.unitCount ??
        (activeRoom as RoomWithUnits | undefined)?.units?.length ??
        0,
    }),
    [activeRoom]
  );

  const handleUpdate = async (values: Record<string, unknown>) => {
    try {
      const unitCountValue = Number(values.unitCount ?? 0);
      const unitCount = Number.isNaN(unitCountValue) ? 0 : Math.max(0, unitCountValue);
      const formData: RoomWithUnits = {
        id: activeRoom.id,
        organisationId: activeRoom.organisationId,
        name: String(values.name ?? activeRoom.name),
        type: values.type as OrganisationRoom['type'],
        assignedSpecialiteis:
          values.assignedSpecialiteis as OrganisationRoom['assignedSpecialiteis'],
        assignedStaffs: values.assignedStaffs as OrganisationRoom['assignedStaffs'],
        unitCount,
        units: buildRoomUnits(unitCount, (activeRoom as RoomWithUnits).units),
      };
      await updateRoom(formData);
      notify('success', {
        title: 'Room updated',
        text: 'Room details have been updated successfully.',
      });
      setShowModal(false);
    } catch (error) {
      notify('error', {
        title: 'Unable to update room',
        text: getErrorMessage(error, 'Failed to update room. Please try again.'),
      });
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRoom(activeRoom);
      notify('success', {
        title: 'Room deleted',
        text: 'Room has been deleted successfully.',
      });
      setShowModal(false);
    } catch (error) {
      notify('error', {
        title: 'Unable to delete room',
        text: getErrorMessage(error, 'Failed to delete room. Please try again.'),
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
            <div className="text-body-1 text-text-primary">View room</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <EditableAccordion
          title="Room details"
          fields={fields}
          data={roomInfoData}
          defaultOpen={true}
          showEditIcon={canEditRoom}
          onSave={handleUpdate}
          showDeleteIcon={canEditRoom}
          onDelete={handleDelete}
        />
      </div>
    </Modal>
  );
};

export default RoomInfo;
