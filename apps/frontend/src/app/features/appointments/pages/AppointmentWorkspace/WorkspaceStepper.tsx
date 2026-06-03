import React from 'react';
import { FaCheck } from 'react-icons/fa6';
import {
  WORKSPACE_STEPS,
  WORKSPACE_STEP_LABELS,
  type StepStatus,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

type WorkspaceStepperProps = {
  activeStep: WorkspaceStep;
  stepStatus: Record<WorkspaceStep, StepStatus>;
  onStepChange: (step: WorkspaceStep) => void;
};

/**
 * Marker = outer circular ring + a solid centre dot. Completed swaps the dot for
 * a check; active uses the brand colour; idle is neutral.
 */
const StepMarker = ({ isActive, status }: { isActive: boolean; status: StepStatus }) => {
  const isCompleted = status === 'COMPLETED';
  const ringColor = isCompleted || isActive ? 'border-text-brand' : 'border-neutral-300';
  const dotColor = isCompleted || isActive ? 'bg-text-brand' : 'bg-neutral-300';

  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-neutral-0 transition-colors duration-150 ${ringColor}`}
    >
      {isCompleted ? (
        <span className="flex size-3 items-center justify-center rounded-full bg-text-brand text-neutral-0">
          <FaCheck size={7} />
        </span>
      ) : (
        <span className={`size-2 rounded-full transition-colors duration-150 ${dotColor}`} />
      )}
    </span>
  );
};

/** Horizontal 5-step progress line. Every step is freely clickable. */
const WorkspaceStepper = ({ activeStep, stepStatus, onStepChange }: WorkspaceStepperProps) => (
  <ol className="flex w-full items-start">
    {WORKSPACE_STEPS.map((step, index) => {
      const isActive = step === activeStep;
      const status = stepStatus[step];
      const isLast = index === WORKSPACE_STEPS.length - 1;
      return (
        <li key={step} className="flex flex-1 items-start last:flex-none">
          <button
            type="button"
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onStepChange(step)}
            className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <StepMarker isActive={isActive} status={status} />
            <span
              className={`text-[14px] leading-[120%] ${isActive ? 'font-bold text-text-brand' : 'font-medium text-neutral-900'}`}
            >
              {WORKSPACE_STEP_LABELS[step]}
            </span>
          </button>
          {!isLast && (
            <span
              aria-hidden="true"
              className="mt-2.5 h-0 flex-1 border-t-2 border-dashed border-neutral-300"
            />
          )}
        </li>
      );
    })}
  </ol>
);

export default WorkspaceStepper;
