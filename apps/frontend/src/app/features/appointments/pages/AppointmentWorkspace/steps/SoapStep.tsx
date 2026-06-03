import React, { useMemo, useState } from 'react';
import { LuClipboardList } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import PastItemsList, {
  type PastItem,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/PastItemsList';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  SoapNoteEntry,
} from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import { sanitizeRichText } from '@/app/lib/richText';

type SoapStepProps = {
  appointmentId: string;
  appointmentReason: string;
  encounter: AppointmentEncounter;
  onRecordVitals: () => void;
};

const EMPTY_SOAP: SoapNoteEntry = {
  id: 'draft',
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  status: 'EMPTY',
  createdAt: '',
};

const SoapSignActions = ({
  signed,
  signedByName,
  signedAt,
  signedOffline,
  disabled,
  onSign,
  onPrintToSign,
  onUploadSigned,
}: {
  signed: boolean;
  signedByName?: string;
  signedAt?: string;
  signedOffline?: boolean;
  disabled: boolean;
  onSign: () => void;
  onPrintToSign: () => void;
  onUploadSigned: () => void;
}) => {
  if (signed) {
    return (
      <div className="flex flex-col items-end leading-[120%]">
        <span className="text-[12px] font-bold text-neutral-900">
          {signedOffline ? 'Signed Offline' : `Signed by ${signedByName ?? ''}`}
        </span>
        {signedAt && (
          <span className="text-[12px] font-medium text-text-brand">
            {formatStampDate(signedAt)}, {formatStampTime(signedAt)}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Secondary text="Print to Sign" onClick={onPrintToSign} isDisabled={disabled} />
      <Secondary text="Signed SOAP" onClick={onUploadSigned} isDisabled={disabled} />
      <Primary text="Sign & Save" onClick={onSign} isDisabled={disabled} />
    </div>
  );
};

/**
 * SOAP step: appointment reason, template search, and four rich-text sections
 * (Subjective / Objective / Assessment / Plan). Record Vitals lives in the
 * workspace header next to Quick Actions so it stays available across steps.
 * The completed note appears in the read-only "All SOAP notes" list.
 */
const SoapStep = ({
  appointmentId,
  appointmentReason,
  encounter,
  onRecordVitals,
}: SoapStepProps) => {
  const upsertSoap = useAppointmentWorkspaceStore((s) => s.upsertSoap);
  const applySoapTemplate = useAppointmentWorkspaceStore((s) => s.applySoapTemplate);
  const signSoap = useAppointmentWorkspaceStore((s) => s.signSoap);
  const [templateQuery, setTemplateQuery] = useState('');

  const note = encounter.soap[0] ?? EMPTY_SOAP;
  const readOnly = encounter.viewOnly;
  const signed = note.status === 'COMPLETED';

  const templateMatches = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return encounter.soapTemplates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templateQuery, encounter.soapTemplates]);

  const pastNotes: PastItem[] = useMemo(
    () =>
      encounter.soap
        .filter((entry) => entry.status === 'COMPLETED')
        .map((entry) => ({
          id: entry.id,
          title: `By ${entry.signedByName ?? 'Unknown'}`,
          date: entry.signedAt ? formatStampDate(entry.signedAt) : undefined,
          time: entry.signedAt ? formatStampTime(entry.signedAt) : undefined,
          detail: (
            <div className="flex flex-col gap-2">
              <SoapReadTextField label="Chief complaint" text={appointmentReason} />
              <SoapReadField label="Subjective (History)" html={entry.subjective} />
              <SoapReadField label="Objective (Examination)" html={entry.objective} />
              <SoapReadField label="Assessment (Differential)" html={entry.assessment} />
              <SoapReadField label="Plan" html={entry.plan} />
            </div>
          ),
        })),
    [appointmentReason, encounter.soap]
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionContainer title="Chief Complaint" disableFocusBorder>
        <div className="rounded-2xl border border-card-border bg-neutral-0 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-bold uppercase tracking-normal text-text-secondary">
            Appointment reason
          </span>
          <p className="mt-1 text-body-4 font-medium leading-[140%] text-text-primary">
            {appointmentReason}
          </p>
        </div>
      </SectionContainer>

      <div className="relative flex justify-end">
        <div className="w-full sm:w-[30%]">
          <Search
            value={templateQuery}
            setSearch={setTemplateQuery}
            placeholder="Search for SOAP Template"
            label="Search for SOAP template"
            className="w-full!"
          />
          {templateMatches.length > 0 && (
            <ul className="absolute right-0 z-10 mt-1 w-full sm:w-[30%] overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
              {templateMatches.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => {
                      applySoapTemplate(appointmentId, tpl);
                      setTemplateQuery('');
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
                  >
                    {tpl.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SectionContainer title="Subjective (History)" disableFocusBorder>
        <RichTextEditor
          ariaLabel="Subjective history"
          value={note.subjective}
          readOnly={readOnly || signed}
          onChange={(html) => upsertSoap(appointmentId, { subjective: html })}
          placeholder="Patient history and owner-reported information"
        />
      </SectionContainer>

      <SectionContainer title="Objective (Examination)" disableFocusBorder>
        <RichTextEditor
          ariaLabel="Objective examination"
          value={note.objective}
          readOnly={readOnly || signed}
          onChange={(html) => upsertSoap(appointmentId, { objective: html })}
          placeholder="Examination findings and recorded vitals"
        />
        {!readOnly && !signed && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onRecordVitals}
              className="flex items-center gap-2 rounded-2xl border border-neutral-300 bg-neutral-0 px-4 py-2 text-body-4 font-medium text-text-primary transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
            >
              <LuClipboardList size={16} aria-hidden="true" />
              Record Vitals
            </button>
          </div>
        )}
      </SectionContainer>

      <SectionContainer title="Assessment (Differential)" disableFocusBorder>
        <RichTextEditor
          ariaLabel="Assessment differential"
          value={note.assessment}
          readOnly={readOnly || signed}
          onChange={(html) => upsertSoap(appointmentId, { assessment: html })}
          placeholder="Diagnosis and differentials"
        />
      </SectionContainer>

      <SectionContainer title="Plan" disableFocusBorder>
        <RichTextEditor
          ariaLabel="Plan"
          value={note.plan}
          readOnly={readOnly || signed}
          onChange={(html) => upsertSoap(appointmentId, { plan: html })}
          placeholder="Treatment plan and next steps"
        />
      </SectionContainer>

      <div className="flex justify-end">
        <SoapSignActions
          signed={signed}
          signedByName={note.signedByName}
          signedAt={note.signedAt}
          signedOffline={note.signedOffline}
          disabled={readOnly}
          onSign={() => signSoap(appointmentId, encounter.leadName ?? 'Clinician', false)}
          onPrintToSign={() => window.print()}
          onUploadSigned={() => signSoap(appointmentId, encounter.leadName ?? 'Clinician', true)}
        />
      </div>

      {pastNotes.length > 0 && <PastItemsList title="All SOAP notes" items={pastNotes} />}
    </div>
  );
};

const SoapReadField = ({ label, html }: { label: string; html: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[12px] font-bold text-text-brand">{label}</span>
    <div
      className="text-body-4 leading-[150%] text-text-primary"
      // Re-sanitized at render as defence-in-depth (also sanitized on write).
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) || '-' }}
    />
  </div>
);

const SoapReadTextField = ({ label, text }: { label: string; text: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[12px] font-bold text-text-brand">{label}</span>
    <p className="text-body-4 leading-[150%] text-text-primary">{text}</p>
  </div>
);

export default SoapStep;
