import React from 'react';
import { IoArrowForward } from 'react-icons/io5';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import ReadyToggle from '@/app/features/appointments/pages/AppointmentWorkspace/components/ReadyToggle';
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
  leadOptions: DropdownItem[];
  nurseOptions: DropdownItem[];
  roomOptions: DropdownItem[];
  unitOptions: DropdownItem[];
  onSelectLead: (option: DropdownOption) => void;
  onSelectNurse: (option: DropdownOption) => void;
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
  leadOptions,
  nurseOptions,
  roomOptions,
  unitOptions,
  onSelectLead,
  onSelectNurse,
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
  const nextStep = getNextStep(activeStep);
  const saveLabel = nextStep ? `${WORKSPACE_STEP_LABELS[nextStep]}` : 'Save & Next';
  const locked = encounter.viewOnly;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <LabelDropdown
            placeholder="Assigned Lead"
            options={leadOptions}
            defaultOption={encounter.leadId}
            onSelect={onSelectLead}
          />
        </div>
        <div className="w-52">
          <LabelDropdown
            placeholder="Assigned Nurse"
            options={nurseOptions}
            defaultOption={encounter.nurseId}
            onSelect={onSelectNurse}
          />
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
        {isInpatient ? (
          <>
            <div className="w-40">
              <LabelDropdown
                placeholder="Room"
                options={roomOptions}
                defaultOption={encounter.roomId}
                onSelect={onSelectRoom}
              />
            </div>
            <div className="w-32">
              <LabelDropdown
                placeholder="Unit"
                options={unitOptions}
                defaultOption={encounter.unitId}
                onSelect={onSelectUnit}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-3">
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
        {primaryCta ? (
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
        )}
      </div>
    </div>
  );
};

export default WorkspaceMetaBar;
