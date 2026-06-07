import React from 'react';
import { IoArrowForward } from 'react-icons/io5';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import ReadyToggle from '@/app/features/appointments/pages/AppointmentWorkspace/components/ReadyToggle';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';
import {
  WORKSPACE_STEP_LABELS,
  type AppointmentEncounter,
  type EncounterMode,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import { getNextStep } from '@/app/lib/appointmentWorkspace';
import type { DropdownOption } from '@/app/hooks/useDropdown';

type DropdownItem = { label: string; value: string };

const ENCOUNTER_MODE_OPTIONS: { label: string; value: EncounterMode }[] = [
  { label: 'Outpatient', value: 'OUTPATIENT' },
  { label: 'Inpatient', value: 'INPATIENT' },
];

type WorkspaceMetaBarProps = {
  encounter: AppointmentEncounter;
  activeStep: WorkspaceStep;
  roomOptions: DropdownItem[];
  unitOptions: DropdownItem[];
  onSelectRoom: (option: DropdownOption) => void;
  onSelectUnit: (option: DropdownOption) => void;
  onSelectEncounterMode: (mode: EncounterMode) => void;
  onSaveAndNext: () => void;
  onToggleReadyForBilling: () => void;
  onToggleReadyForDischarge: () => void;
  /**
   * Hard lock for the Ready toggles (time-window/persisted view-only). The
   * Ready-for-Discharge checkbox itself must stay interactive even though it
   * makes the step content read-only, so a mistaken check can be undone.
   */
  togglesLocked: boolean;
  /** Treatment step shows a "Skip to Summary" CTA instead of Save & Next. */
  primaryCta?: { label: string; onClick: () => void };
};

const WorkspaceMetaBar = ({
  encounter,
  activeStep,
  roomOptions,
  unitOptions,
  onSelectRoom,
  onSelectUnit,
  onSelectEncounterMode,
  onSaveAndNext,
  onToggleReadyForBilling,
  onToggleReadyForDischarge,
  togglesLocked,
  primaryCta,
}: WorkspaceMetaBarProps) => {
  const isInpatient = encounter.mode === 'INPATIENT';
  // Room is shown for inpatient always, and for outpatient when the encounter
  // has a room assigned (a selected room id or room options to choose from).
  const showRoom = isInpatient || Boolean(encounter.roomId) || roomOptions.length > 0;
  const nextStep = getNextStep(activeStep);
  const saveLabel = nextStep ? `${WORKSPACE_STEP_LABELS[nextStep]}` : 'Save & Next';
  const locked = encounter.viewOnly;

  const staffFields = (
    <>
      <div className="w-52">
        <StaffField label="Assigned Lead" name={encounter.leadName} />
      </div>
      <div className="w-52">
        <StaffField label="Support Staff" name={encounter.nurseName} />
      </div>
      <div className="w-52">
        <LabelDropdown
          key={encounter.mode}
          placeholder="Consultation type"
          options={ENCOUNTER_MODE_OPTIONS}
          defaultOption={encounter.mode}
          searchable={false}
          onSelect={(option) => onSelectEncounterMode(option.value as EncounterMode)}
        />
      </div>
      {/* Room shows whenever the encounter has one (outpatient or inpatient);
          Unit is inpatient-only. */}
      {showRoom && (
        <div className="w-40">
          <LabelDropdown
            placeholder="Room"
            options={roomOptions}
            defaultOption={encounter.roomId}
            onSelect={onSelectRoom}
          />
        </div>
      )}
      {isInpatient && (
        <div className="w-32">
          <LabelDropdown
            placeholder="Unit"
            options={unitOptions}
            defaultOption={encounter.unitId}
            onSelect={onSelectUnit}
          />
        </div>
      )}
    </>
  );

  const readyToggles = (
    <>
      <ReadyToggle
        label="Ready for Billing"
        state={encounter.readyForBilling}
        disabled={togglesLocked}
        onToggle={onToggleReadyForBilling}
      />
      <ReadyToggle
        label="Ready for Discharge"
        state={encounter.readyForDischarge}
        disabled={togglesLocked}
        onToggle={onToggleReadyForDischarge}
      />
    </>
  );

  const saveButton = primaryCta ? (
    <Primary
      text={primaryCta.label}
      onClick={primaryCta.onClick}
      icon={<IoArrowForward />}
      iconPosition="right"
    />
  ) : (
    <Primary
      text={saveLabel}
      onClick={onSaveAndNext}
      icon={<IoArrowForward />}
      iconPosition="right"
      isDisabled={!nextStep || locked}
    />
  );

  // Two responsive columns. The left column holds the staff / consultation /
  // room / unit fields and lets them wrap across rows to use the available
  // width. The right column keeps the Ready toggles + Save button together
  // (toggles first, then the button), vertically centred with each other, and
  // wraps below the fields on narrow screens.
  return (
    <div className="flex flex-col gap-x-6 gap-y-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-5">{staffFields}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-5 lg:justify-end">
        {readyToggles}
        {saveButton}
      </div>
    </div>
  );
};

export default WorkspaceMetaBar;
