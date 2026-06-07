import React, { useState } from 'react';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import { LuClipboardList, LuPrinter } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { sanitizeRichText } from '@/app/lib/richText';

export type SoapNoteReadField = {
  label: string;
  /** Sanitized rich-text HTML. */
  html?: string;
  /** Plain-text value (e.g. chief complaint pulled from the appointment reason). */
  text?: string;
};

export type SoapNoteListItem = {
  id: string;
  signedByName: string;
  date?: string;
  time?: string;
  /** True when the note was signed offline — shows a distinct status chip. */
  signedOffline?: boolean;
  fields: SoapNoteReadField[];
};

type SoapNotesListProps = {
  items: SoapNoteListItem[];
  /** Prints a single past note. */
  onPrint: (item: SoapNoteListItem) => void;
};

/** Status chip distinguishing online vs offline-signed notes. */
const SignStatusChip = ({ offline }: { offline: boolean }) =>
  offline ? (
    <span className="rounded-2xl border border-pill-warning-border px-2.5 py-0.5 text-caption-2 text-pill-warning-text">
      Signed offline
    </span>
  ) : (
    <span className="rounded-2xl border border-pill-success-border px-2.5 py-0.5 text-caption-2 text-pill-success-text">
      Signed
    </span>
  );

/** One label/value row in the expanded read-out — bold label left, value right. */
const ReadRow = ({ field }: { field: SoapNoteReadField }) => (
  <div className="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-start sm:gap-6">
    <span className="w-full shrink-0 pt-px text-yc-12-b-neutral sm:w-44">{field.label}</span>
    {field.text != null ? (
      <p className="flex-1 text-body-4 leading-[140%] text-text-primary">{field.text || '-'}</p>
    ) : (
      <div
        className="flex-1 text-body-4 leading-[140%] text-text-primary [&_li]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:pl-5"
        // Re-sanitized at render as defence-in-depth (also sanitized on write).
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(field.html ?? '') || '-' }}
      />
    )}
  </div>
);

const SoapNoteRow = ({
  item,
  onPrint,
}: {
  item: SoapNoteListItem;
  onPrint: (item: SoapNoteListItem) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-card-border last:border-0">
      <div className="flex items-center gap-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center text-text-brand">
          <LuClipboardList size={20} aria-hidden="true" />
        </span>
        <span className="w-28 shrink-0 text-body-4 font-medium text-text-primary">SOAP Note</span>
        <span className="hidden shrink-0 sm:block">
          <SignStatusChip offline={Boolean(item.signedOffline)} />
        </span>
        <span className="hidden flex-1 text-body-4 text-text-secondary sm:block">
          By {item.signedByName}
        </span>
        <span className="hidden w-28 text-body-4 text-pill-success-text sm:block">{item.date}</span>
        <span className="hidden w-24 text-body-4 text-pill-success-text sm:block">{item.time}</span>
        <CircleIconButton
          icon={<LuPrinter size={16} aria-hidden="true" />}
          label={`Print SOAP note by ${item.signedByName}`}
          onClick={() => onPrint(item)}
        />
        <CircleIconButton
          icon={
            open ? (
              <IoEyeOffOutline size={16} aria-hidden="true" />
            ) : (
              <IoEyeOutline size={16} aria-hidden="true" />
            )
          }
          label={
            open
              ? `Hide SOAP note by ${item.signedByName}`
              : `View SOAP note by ${item.signedByName}`
          }
          variant="dark"
          onClick={() => setOpen((v) => !v)}
        />
      </div>
      {open && (
        <div className="mb-3 rounded-2xl border border-card-border bg-neutral-0 px-5 py-3">
          {item.fields.map((field) => (
            <ReadRow key={field.label} field={field} />
          ))}
        </div>
      )}
    </li>
  );
};

/**
 * Read-only "All SOAP notes" list. A floating-label SectionContainer wraps one
 * row per signed note (clipboard icon · "SOAP Note" · By <name> · date · time ·
 * dark eye), expanding into a nested bordered label/value read-out.
 */
const SoapNotesList = ({ items, onPrint }: SoapNotesListProps) => {
  if (items.length === 0) return null;
  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="All SOAP notes"
      disableFocusBorder
    >
      <ul className="flex flex-col">
        {items.map((item) => (
          <SoapNoteRow key={item.id} item={item} onPrint={onPrint} />
        ))}
      </ul>
    </SectionContainer>
  );
};

export default SoapNotesList;
