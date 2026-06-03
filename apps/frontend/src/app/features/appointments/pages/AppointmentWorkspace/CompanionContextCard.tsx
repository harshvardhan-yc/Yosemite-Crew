import React from 'react';
import { IoChevronDown } from 'react-icons/io5';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';

export type CompanionDetail = {
  label: string;
  value: string;
};

type CompanionContextCardProps = {
  name: string;
  photoUrl?: string;
  details: CompanionDetail[];
  onViewDetails?: () => void;
};

const DetailRow = ({ label, value }: CompanionDetail) => (
  <div className="flex items-start gap-3 leading-[120%]">
    <span className="w-24 shrink-0 text-[13px] font-normal text-neutral-600">{label}</span>
    <span className="flex-1 text-[13px] font-bold text-neutral-900">{value || '-'}</span>
  </div>
);

/**
 * White companion card shown on the in-progress band. Avatar (64×64) + a 3-column
 * grid of label/value rows (Name/Patient ID/Breed | Age/Sex/Weight |
 * Blood/Microchip/Allergies), with a "View Details" affordance in the top-right.
 */
const CompanionContextCard = ({
  name,
  photoUrl,
  details,
  onViewDetails,
}: CompanionContextCardProps) => (
  <div className="relative flex items-center gap-5 rounded-2xl bg-neutral-0 px-5 py-4 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
    <div className="shrink-0">
      <AppointmentAvatar name={name} photoUrl={photoUrl} size={64} />
    </div>
    <div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-2.5 pr-28 sm:grid-cols-2 lg:grid-cols-3">
      {details.map((detail) => (
        <DetailRow key={detail.label} label={detail.label} value={detail.value} />
      ))}
    </div>
    {onViewDetails && (
      <button
        type="button"
        onClick={onViewDetails}
        className="absolute right-4 top-4 flex items-center gap-1 rounded-2xl border border-neutral-300 px-3 py-1.5 text-body-4 font-medium text-text-primary transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        View Details
        <IoChevronDown aria-hidden="true" size={14} />
      </button>
    )}
  </div>
);

export default CompanionContextCard;
