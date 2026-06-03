import React from 'react';
import { FaCheck } from 'react-icons/fa6';
import type { ReadyState } from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';

type ReadyToggleProps = {
  label: string;
  state: ReadyState;
  disabled?: boolean;
  onToggle: () => void;
};

/** Compose the design's "Today, 10:25 AM" stamp from the shared formatters. */
const formatStamp = (iso?: string): string => {
  const date = formatStampDate(iso);
  const time = formatStampTime(iso);
  if (!date || !time) return '';
  return `${date}, ${time}`;
};

/**
 * Ready-for-Billing / Ready-for-Discharge toggle. Unselected = neutral pill +
 * empty checkbox; selected = green pill + check, with the acting employee's
 * name and timestamp shown below.
 */
const ReadyToggle = ({ label, state, disabled = false, onToggle }: ReadyToggleProps) => {
  const checked = state.value;

  return (
    <div className="flex min-h-17 min-w-44 flex-col items-start gap-0.5">
      <button
        type="button"
        aria-pressed={checked}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-8 items-center gap-2 rounded-2xl px-3 leading-[120%] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? 'bg-pill-success-bg text-pill-success-text' : 'text-neutral-700'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-4 items-center justify-center rounded-sm border transition-colors duration-150 ${
            checked
              ? 'border-pill-success-text bg-pill-success-text text-neutral-0'
              : 'border-neutral-400'
          }`}
        >
          {checked && <FaCheck size={9} />}
        </span>
        <span className="text-body-4 font-medium">{label}</span>
      </button>
      <div className="min-h-8 leading-[120%]">
        {checked && state.byName && (
          <div className="flex flex-col items-start">
            <span className="text-[12px] font-bold text-neutral-900">By {state.byName}</span>
            {state.at && (
              <span className="text-[12px] font-medium text-text-brand">
                {formatStamp(state.at)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadyToggle;
