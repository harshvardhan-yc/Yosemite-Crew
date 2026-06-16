import React, { useMemo, useState } from 'react';
import { IoArrowForward } from 'react-icons/io5';
import { LuClipboardList, LuPrinter } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import SoapNotesList, {
  type SoapNoteListItem,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapNotesList';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  SoapNoteEntry,
} from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import { saveSoapNote } from '@/app/features/appointments/services/workspaceClinicalService';

type SoapStepProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  appointmentReason: string;
  encounter: AppointmentEncounter;
  onRecordVitals: () => void;
  onSaveAndNext: () => void;
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
  disabled,
  onPrintToSign,
  onSaveAndNext,
}: {
  disabled: boolean;
  onPrintToSign: () => void;
  onSaveAndNext: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-end gap-3">
    <Secondary
      text="Print to Sign"
      onClick={onPrintToSign}
      isDisabled={disabled}
      icon={<LuPrinter aria-hidden="true" />}
      iconPosition="right"
    />
    <Primary
      text="Save & Next"
      onClick={onSaveAndNext}
      isDisabled={disabled}
      icon={<IoArrowForward aria-hidden="true" />}
      iconPosition="right"
    />
  </div>
);

/**
 * SOAP step: appointment reason, template search, and four rich-text sections
 * (Subjective / Objective / Assessment / Plan). Record Vitals lives in the
 * workspace header next to Quick Actions so it stays available across steps.
 * The completed note appears in the read-only "All SOAP notes" list.
 */
const SoapStep = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  appointmentReason,
  encounter,
  onRecordVitals,
  onSaveAndNext,
}: SoapStepProps) => {
  const upsertSoap = useAppointmentWorkspaceStore((s) => s.upsertSoap);
  const applySoapTemplate = useAppointmentWorkspaceStore((s) => s.applySoapTemplate);
  const signSoap = useAppointmentWorkspaceStore((s) => s.signSoap);
  const [templateQuery, setTemplateQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Work on the active draft (first not-yet-signed note); once a note is signed
  // it moves to "All SOAP notes" history and the form clears for a new entry.
  const note = encounter.soap.find((entry) => entry.status !== 'COMPLETED') ?? EMPTY_SOAP;
  const readOnly = encounter.viewOnly;

  const templateMatches = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return encounter.soapTemplates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templateQuery, encounter.soapTemplates]);

  const pastNotes: SoapNoteListItem[] = useMemo(
    () =>
      encounter.soap.flatMap((entry) =>
        entry.status === 'COMPLETED'
          ? [
              {
                id: entry.id,
                signedByName: entry.signedByName ?? 'Unknown',
                signedOffline: entry.signedOffline,
                date: entry.signedAt ? formatStampDate(entry.signedAt) : undefined,
                time: entry.signedAt ? formatStampTime(entry.signedAt) : undefined,
                fields: [
                  { label: 'Chief complaint', text: appointmentReason },
                  { label: 'Subjective (History)', html: entry.subjective },
                  { label: 'Objective (Examination)', html: entry.objective },
                  { label: 'Assessment (Differential)', html: entry.assessment },
                  { label: 'Plan', html: entry.plan },
                ],
              },
            ]
          : []
      ),
    [appointmentReason, encounter.soap]
  );

  const handleSaveAndNext = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (organisationId) {
        await saveSoapNote(
          { organisationId, appointmentId, encounterId, authorId, templateId: note.templateId },
          note
        );
      }
    } catch (error) {
      console.error('Unable to persist SOAP note:', error);
    } finally {
      signSoap(appointmentId, encounter.leadName ?? 'Clinician', false);
      setIsSaving(false);
      onSaveAndNext();
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-input-border-default px-5 py-4">
        <span className="shrink-0 text-yc-16-r-neutral font-bold">Chief Complaint</span>
        <span className="text-right text-yc-16-r-neutral">{appointmentReason}</span>
      </div>

      {!readOnly && (
        <>
          <div className="relative flex justify-end">
            <div className="relative w-full sm:max-w-90">
              <Search
                value={templateQuery}
                setSearch={setTemplateQuery}
                placeholder="Search for SOAP Template"
                label="Search for SOAP template"
                className="w-full!"
              />
              {templateMatches.length > 0 && (
                <ul className="absolute right-0 z-10 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
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

          <SectionContainer
            titleClassName="text-yc-20-b-primary"
            title="Subjective (History)"
            compactTop
          >
            <RichTextEditor
              ariaLabel="Subjective history"
              value={note.subjective}
              readOnly={false}
              toolbarPlacement="inset"
              onChange={(html) => upsertSoap(appointmentId, { subjective: html })}
              placeholder="Patient history and owner-reported information"
            />
          </SectionContainer>

          <SectionContainer
            titleClassName="text-yc-20-b-primary"
            title="Objective (Examination)"
            compactTop
          >
            <RichTextEditor
              ariaLabel="Objective examination"
              value={note.objective}
              readOnly={false}
              toolbarPlacement="inset"
              onChange={(html) => upsertSoap(appointmentId, { objective: html })}
              placeholder="Examination findings and recorded vitals"
            />
            <div className="mt-3 flex justify-end">
              <Secondary
                text="Record Vitals"
                onClick={onRecordVitals}
                icon={<LuClipboardList aria-hidden="true" />}
              />
            </div>
          </SectionContainer>

          <SectionContainer
            titleClassName="text-yc-20-b-primary"
            title="Assessment (Differential)"
            compactTop
          >
            <RichTextEditor
              ariaLabel="Assessment differential"
              value={note.assessment}
              readOnly={false}
              toolbarPlacement="inset"
              onChange={(html) => upsertSoap(appointmentId, { assessment: html })}
              placeholder="Diagnosis and differentials"
            />
          </SectionContainer>

          <SectionContainer titleClassName="text-yc-20-b-primary" title="Plan" compactTop>
            <RichTextEditor
              ariaLabel="Plan"
              value={note.plan}
              readOnly={false}
              toolbarPlacement="inset"
              onChange={(html) => upsertSoap(appointmentId, { plan: html })}
              placeholder="Treatment plan and next steps"
            />
          </SectionContainer>

          <div className="flex justify-end">
            <SoapSignActions
              disabled={isSaving}
              onPrintToSign={() => window.print()}
              onSaveAndNext={handleSaveAndNext}
            />
          </div>
        </>
      )}

      <SoapNotesList items={pastNotes} onPrint={() => window.print()} />
    </div>
  );
};

export default SoapStep;
