import React from 'react';
import { IoIosArrowBack } from 'react-icons/io';
import { IoAdd } from 'react-icons/io5';
import { LuZap } from 'react-icons/lu';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';

type WorkspaceHeaderProps = {
  companionName: string;
  alerts: CompanionAlert[];
  onBack: () => void;
  onQuickActions: () => void;
  onAddAlert?: () => void;
};

/** Top header: back arrow, "<Companion>'s Appointment", alert pills, Quick Actions. */
const WorkspaceHeader = ({
  companionName,
  alerts,
  onBack,
  onQuickActions,
  onAddAlert,
}: WorkspaceHeaderProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-label="Go back"
        onClick={onBack}
        className="flex size-9 items-center justify-center rounded-full text-neutral-900 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <IoIosArrowBack size={22} aria-hidden="true" />
      </button>
      <h1 className="font-satoshi text-[24px] font-medium leading-[120%] tracking-[-0.48px] text-neutral-900">
        {companionName.split(' ')[0]}&rsquo;s Appointment
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {alerts.map((alert) => (
          <AlertPill key={alert.id} label={alert.label} severity={alert.severity} />
        ))}
        {onAddAlert && (
          <button
            type="button"
            aria-label="Add alert"
            onClick={onAddAlert}
            className="flex size-5 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <IoAdd size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onQuickActions}
        className="flex items-center gap-2 rounded-2xl border border-neutral-300 bg-neutral-0 px-4 py-2 text-body-4 font-medium text-text-primary transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <LuZap size={16} aria-hidden="true" />
        Quick Actions
      </button>
    </div>
  </div>
);

export default WorkspaceHeader;
