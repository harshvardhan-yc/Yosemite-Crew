import { useImperativeHandle, useState, type Dispatch, type SetStateAction, type Ref } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import {
  AvailabilityState,
  convertAvailability,
  hasAtLeastOneAvailability,
  SetAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import { upsertAvailability } from '@/app/features/organization/services/availabilityService';
import type { StepHandle } from './PersonalStep';

type AvailabilityStepProps = Readonly<{
  prevStep: () => void;
  orgIdFromQuery: string | null;
  availability: AvailabilityState;
  setAvailability: SetAvailability;
  isSaving: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setIsRedirecting: Dispatch<SetStateAction<boolean>>;
  ref?: Ref<StepHandle>;
}>;

function AvailabilityStep({
  prevStep,
  orgIdFromQuery,
  availability,
  setAvailability,
  isSaving,
  setIsSaving,
  setIsRedirecting,
  ref,
}: AvailabilityStepProps) {
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        setAvailabilityError('Please enable at least one day with a valid time slot');
        return false;
      }
      setAvailabilityError(null);
      return true;
    },
  }));

  const handleSaveAvailability = async () => {
    if (isSaving) return;

    const converted = convertAvailability(availability);
    if (!hasAtLeastOneAvailability(converted)) {
      setAvailabilityError('Please enable at least one day with a valid time slot');
      return;
    }
    setAvailabilityError(null);

    try {
      setIsSaving(true);
      await upsertAvailability(converted, orgIdFromQuery);
      setIsRedirecting(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="team-container">
      <div className="team-title">Availability</div>

      <Availability availability={availability} setAvailability={setAvailability} />

      {availabilityError && <div className="step-inline-error">{availabilityError}</div>}

      <div className="team-buttons">
        <Secondary href="#" text="Back" onClick={prevStep} />
        <Primary
          href="#"
          text={isSaving ? 'Saving...' : 'Finish'}
          onClick={handleSaveAvailability}
          isDisabled={isSaving}
        />
      </div>
    </div>
  );
}

export default AvailabilityStep;
