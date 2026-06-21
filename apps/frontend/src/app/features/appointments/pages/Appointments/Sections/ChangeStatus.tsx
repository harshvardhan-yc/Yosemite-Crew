import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import {
  changeAppointmentStatus,
  getSlotsForServiceAndDateForPrimaryOrg,
} from '@/app/features/appointments/services/appointmentService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useLoadTeam, useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import {
  AppointmentStatus,
  AppointmentStatusOptions,
} from '@/app/features/appointments/types/appointments';
import {
  canTransitionAppointmentStatus,
  getAllowedAppointmentStatusTransitions,
  getInvalidAppointmentStatusTransitionMessage,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import ChangeStatusModal from '@/app/ui/overlays/Modal/ChangeStatusModal';

const normalizeId = (value?: string | null) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

const createNextLead = (
  existingLead: Appointment['lead'] | null | undefined,
  id: string,
  name: string
) => {
  const profileUrl = existingLead?.profileUrl;
  if (profileUrl) return { id, name, profileUrl };
  return { id, name };
};

type ChangeStatusProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeAppointment: Appointment;
  preferredStatus?: AppointmentStatus | null;
};

const ChangeStatus = ({
  showModal,
  setShowModal,
  activeAppointment,
  preferredStatus = null,
}: ChangeStatusProps) => {
  useLoadTeam();
  const teams = useTeamForPrimaryOrg();
  const currentStatus: AppointmentStatus =
    normalizeAppointmentStatus(activeAppointment.status) ?? 'REQUESTED';
  const leadOptions = React.useMemo(
    () =>
      teams
        .map((member) => {
          const value = normalizeId(member.practionerId);
          const label = member.name || value;
          if (!value || !label) return null;
          return { value, label };
        })
        .filter((item): item is { value: string; label: string } => item !== null),
    [teams]
  );

  // ── Slot-scoped lead availability ─────────────────────────────────────────────
  // When accepting a requested appointment we only offer leads that the bookable-slots
  // API reports as available for this service + slot. `null` = availability not yet
  // resolved (fall back to all leads); an array = the resolved set of available vet ids.
  const [availableVetIds, setAvailableVetIds] = React.useState<string[] | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = React.useState(false);
  const serviceId = normalizeId(activeAppointment.appointmentType?.id);

  React.useEffect(() => {
    if (!showModal || currentStatus !== 'REQUESTED' || !serviceId) {
      setAvailableVetIds(null);
      setIsLoadingAvailability(false);
      return;
    }
    let cancelled = false;
    const appointmentStart = new Date(activeAppointment.startTime).getTime();
    setIsLoadingAvailability(true);
    setAvailableVetIds(null);
    getSlotsForServiceAndDateForPrimaryOrg(serviceId, new Date(activeAppointment.startTime))
      .then((slots: Slot[]) => {
        if (cancelled) return;
        const matchingSlot = slots.find(
          (slot) => new Date(slot.startTime).getTime() === appointmentStart
        );
        const vetIds = (matchingSlot?.vetIds ?? [])
          .map((vetId) => normalizeId(vetId))
          .filter(Boolean);
        setAvailableVetIds(vetIds);
      })
      .catch(() => {
        // On failure leave availability unresolved so all leads remain selectable.
        if (!cancelled) setAvailableVetIds(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvailability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, currentStatus, serviceId, activeAppointment.startTime]);

  // Leads to actually offer: filtered to the available set once resolved, but the
  // currently-assigned lead is always kept so an existing assignment never disappears.
  const availableLeadOptions = React.useMemo(() => {
    if (availableVetIds === null) return leadOptions;
    const allowed = new Set(availableVetIds);
    const currentLeadId = normalizeId(activeAppointment.lead?.id);
    return leadOptions.filter(
      (option) => allowed.has(option.value) || option.value === currentLeadId
    );
  }, [availableVetIds, leadOptions, activeAppointment.lead?.id]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string>(() =>
    normalizeId(activeAppointment.lead?.id)
  );
  const [selectedSupportIds, setSelectedSupportIds] = React.useState<string[]>(() =>
    (activeAppointment.supportStaff ?? [])
      .map((staff) => normalizeId(staff?.id))
      .filter((id): id is string => Boolean(id))
  );

  React.useEffect(() => {
    if (!showModal) return;
    setSelectedSupportIds(
      (activeAppointment.supportStaff ?? [])
        .map((staff) => normalizeId(staff?.id))
        .filter((id): id is string => Boolean(id))
    );
    const activeLeadId = normalizeId(activeAppointment.lead?.id);
    if (activeLeadId) {
      setSelectedLeadId(activeLeadId);
      return;
    }
    if (leadOptions.length === 1) {
      setSelectedLeadId(leadOptions[0].value);
      return;
    }
    setSelectedLeadId('');
  }, [
    activeAppointment.id,
    activeAppointment.lead?.id,
    activeAppointment.supportStaff,
    leadOptions,
    showModal,
  ]);

  const supportOptions = React.useMemo(
    () => leadOptions.filter((option) => option.value !== normalizeId(selectedLeadId)),
    [leadOptions, selectedLeadId]
  );

  const availableStatusOptions = React.useMemo(() => {
    const transitions = getAllowedAppointmentStatusTransitions(currentStatus);
    const allowed = new Set<AppointmentStatus>(transitions);
    allowed.add(currentStatus);
    return AppointmentStatusOptions.filter((option) =>
      allowed.has(option.value as AppointmentStatus)
    ) as Array<{ value: AppointmentStatus; label: string }>;
  }, [currentStatus]);

  return (
    <ChangeStatusModal<AppointmentStatus>
      showModal={showModal}
      setShowModal={setShowModal}
      currentStatus={currentStatus}
      defaultStatus="REQUESTED"
      preferredStatus={preferredStatus}
      statusOptions={availableStatusOptions}
      placeholder="Appointment status"
      canTransition={canTransitionAppointmentStatus}
      getInvalidMessage={getInvalidAppointmentStatusTransitionMessage}
      validateBeforeSave={(newStatus) => {
        const needsLeadSelection = currentStatus === 'REQUESTED' && newStatus === 'UPCOMING';
        if (!needsLeadSelection) return null;
        if (isLoadingAvailability) return 'Checking lead availability for this slot…';
        if (availableVetIds !== null && availableLeadOptions.length === 0) {
          return 'No lead is available for this slot. Reschedule the appointment to accept it.';
        }
        const leadId = normalizeId(selectedLeadId);
        if (!leadId) return 'Select a lead before accepting this appointment.';
        if (!availableLeadOptions.some((option) => option.value === leadId)) {
          return 'Selected lead is not available for this slot.';
        }
        return null;
      }}
      renderExtraContent={({ selectedStatus, saving }) => {
        const showLeadPicker = currentStatus === 'REQUESTED' && selectedStatus === 'UPCOMING';
        if (!showLeadPicker) return null;
        const noLeadsAvailable = availableVetIds !== null && availableLeadOptions.length === 0;
        return (
          <div
            className={
              saving ? 'pointer-events-none opacity-60 flex flex-col gap-3' : 'flex flex-col gap-3'
            }
          >
            <LabelDropdown
              placeholder={isLoadingAvailability ? 'Checking availability…' : 'Select lead'}
              options={availableLeadOptions}
              defaultOption={selectedLeadId}
              onSelect={(option) => {
                setSelectedLeadId(option.value);
                setSelectedSupportIds((prev) => prev.filter((id) => id !== option.value));
              }}
              noOptionsMessage={noLeadsAvailable ? 'No lead is available for this slot' : undefined}
            />
            {noLeadsAvailable ? (
              <p className="px-4 text-caption-2 text-text-error">
                No lead is available for this slot. Reschedule the appointment to accept it.
              </p>
            ) : null}
            <MultiSelectDropdown
              placeholder="Select support staff (optional)"
              options={supportOptions}
              value={selectedSupportIds}
              onChange={setSelectedSupportIds}
            />
          </div>
        );
      }}
      onSave={async (newStatus) => {
        const selectedLeadName =
          leadOptions.find((option) => option.value === selectedLeadId)?.label ??
          activeAppointment.lead?.name ??
          'Assigned vet';
        const nextLead = createNextLead(activeAppointment.lead, selectedLeadId, selectedLeadName);
        const shouldSetLead = currentStatus === 'REQUESTED' && newStatus === 'UPCOMING';
        if (!shouldSetLead) {
          await changeAppointmentStatus(activeAppointment, newStatus);
          return;
        }
        const nextSupportStaff = selectedSupportIds.map((id) => ({
          id,
          name: leadOptions.find((option) => option.value === id)?.label ?? id,
        }));
        const nextAppointment = structuredClone(activeAppointment);
        nextAppointment.lead = nextLead;
        nextAppointment.supportStaff = nextSupportStaff;
        await changeAppointmentStatus(nextAppointment, newStatus);
      }}
    />
  );
};

export default ChangeStatus;
