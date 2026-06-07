import React from 'react';
import { IoIosArrowBack } from 'react-icons/io';
import { LuPlus } from 'react-icons/lu';
import { HiBolt } from 'react-icons/hi2';
import type { Appointment } from '@yosemite-crew/types';
import { Secondary } from '@/app/ui/primitives/Buttons';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import EmergencyBadge from '@/app/features/appointments/components/EmergencyBadge';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';

type WorkspaceHeaderProps = {
  appointment: Appointment;
  companionName: string;
  alerts: CompanionAlert[];
  onBack: () => void;
  onQuickActions: () => void;
  onAddAlert?: () => void;
};

/**
 * Top header: back arrow, "<Companion>'s Appointment", alert pills, then the
 * shared status pill (single source of truth — also used in the calendar
 * popover) and Quick Actions on the right.
 */
const WorkspaceHeader = ({
  appointment,
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
      <AppointmentStatusPill appointment={appointment} />
      {appointment.isEmergency && <EmergencyBadge />}
      <div className="flex flex-wrap items-center gap-2">
        {alerts.map((alert) => (
          <AlertPill key={alert.id} label={alert.label} severity={alert.severity} />
        ))}
        {onAddAlert && (
          <button
            type="button"
            aria-label="Add alert"
            onClick={onAddAlert}
            className="flex size-6 items-center justify-center rounded-full border border-neutral-500 text-neutral-700 transition-colors duration-150 hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <LuPlus size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
    <Secondary text="Quick Actions" onClick={onQuickActions} icon={<HiBolt aria-hidden="true" />} />
  </div>
);

export default WorkspaceHeader;
