import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import { IoArrowForward } from 'react-icons/io5';
import { LuClipboardList, LuPrinter } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import SoapNotesList, {
  type SoapNoteListItem,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapNotesList';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  SoapNoteEntry,
} from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import { isRichTextEmpty } from '@/app/lib/richText';
import {
  getRenderedDocument,
  saveSoapNote,
} from '@/app/features/appointments/services/workspaceClinicalService';

type SoapStepProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  authorName?: string;
  appointmentReason: string;
  appointmentService?: string;
  appointmentSpeciality?: string;
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

const isPersistedSoapId = (value?: string) =>
  Boolean(value && value !== 'draft' && !value.startsWith('local-'));

const hasSoapContent = (note: SoapNoteEntry) =>
  [note.chiefComplaint, note.subjective, note.objective, note.assessment, note.plan].some(
    (value) => !isRichTextEmpty(value)
  );

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

const SoapContextField = ({ label, value }: { label: string; value?: string }) => (
  <div className="relative w-full">
    <div className="relative flex min-h-12 w-full items-center rounded-2xl border border-input-border-default bg-(--whitebg) px-5 py-2">
      <span
        className={`min-w-0 flex-1 truncate text-left text-body-4 ${value?.trim() ? 'text-text-primary' : 'text-input-text-placeholder'}`}
      >
        {value?.trim() || '-'}
      </span>
    </div>
    <span className="pointer-events-none absolute -top-2 left-5 z-10 bg-(--whitebg) px-1 text-caption-2 text-text-secondary">
      {label}
    </span>
  </div>
);

const ChiefComplaintField = ({ value }: { value: string }) => (
  <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-input-border-default px-5 py-4">
    <span className="shrink-0 text-yc-16-r-neutral font-bold">Chief Complaint</span>
    <span className="min-w-0 overflow-x-auto whitespace-nowrap text-right text-yc-16-r-neutral">
      {value}
    </span>
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
  authorName,
  appointmentReason,
  appointmentService,
  appointmentSpeciality,
  encounter,
  onRecordVitals,
  onSaveAndNext,
}: SoapStepProps) => {
  const upsertSoap = useAppointmentWorkspaceStore((s) => s.upsertSoap);
  const applySoapTemplate = useAppointmentWorkspaceStore((s) => s.applySoapTemplate);
  const signSoap = useAppointmentWorkspaceStore((s) => s.signSoap);
  const [templateQuery, setTemplateQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('SOAP note');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [persistedDraftId, setPersistedDraftId] = useState<string | undefined>(undefined);

  // Work on the active draft (first not-yet-signed note); once a note is signed
  // it moves to "All SOAP notes" history and the form clears for a new entry.
  const note = encounter.soap.find((entry) => entry.status !== 'COMPLETED') ?? EMPTY_SOAP;
  const readOnly = encounter.viewOnly;

  useEffect(() => {
    setPersistedDraftId(isPersistedSoapId(note.id) ? note.id : undefined);
  }, [note.id]);

  const templateSearchRef = useRef<HTMLDivElement>(null);
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
                signedByName: entry.signedByName ?? encounter.leadName ?? 'Clinician',
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
    [appointmentReason, encounter.leadName, encounter.soap]
  );

  const handleSaveAndNext = async () => {
    if (isSaving) return;
    setIsSaving(true);
    let persistedId: string | undefined;
    try {
      if (organisationId) {
        const noteForSave =
          persistedDraftId && !isPersistedSoapId(note.id)
            ? { ...note, id: persistedDraftId }
            : note;
        const saved = await saveSoapNote(
          {
            organisationId,
            appointmentId,
            encounterId,
            authorId,
            authorName,
            templateId: note.templateId,
          },
          noteForSave
        );
        persistedId = (saved as { id?: string } | undefined)?.id;
      }
    } catch (error) {
      console.error('Unable to persist SOAP note:', error);
    } finally {
      signSoap(appointmentId, encounter.leadName ?? 'Clinician', false, persistedId);
      setIsSaving(false);
      onSaveAndNext();
    }
  };

  const resolveSoapPdfUrl = async (soapNoteId: string) => {
    if (!organisationId) throw new Error('Organisation missing for SOAP document lookup.');
    const rendered = await getRenderedDocument(organisationId, soapNoteId);
    const pdfUrl = rendered.pdfUrl?.trim();
    if (pdfUrl) return pdfUrl;
    throw new Error('SOAP note PDF is not available yet.');
  };

  const openSoapPdfPreview = async (soapNoteId: string, title: string) => {
    setPdfError(null);
    setIsPreparingPdf(true);
    try {
      const pdfUrl = await resolveSoapPdfUrl(soapNoteId);
      setPdfPreviewTitle(title);
      setPdfPreviewUrl(pdfUrl);
    } catch (error) {
      console.error('Unable to open SOAP PDF:', error);
      setPdfError(
        error instanceof Error
          ? `${error.message} Using browser print.`
          : 'Unable to open SOAP PDF.'
      );
      globalThis.window.print();
    } finally {
      setIsPreparingPdf(false);
    }
  };

  const handlePrintToSign = async () => {
    if (isSaving || isPreparingPdf) return;
    let soapNoteId = isPersistedSoapId(note.id) ? note.id : undefined;
    if (!soapNoteId && persistedDraftId) {
      soapNoteId = persistedDraftId;
    }
    if (!soapNoteId && organisationId && hasSoapContent(note)) {
      setIsPreparingPdf(true);
      try {
        const saved = await saveSoapNote(
          {
            organisationId,
            appointmentId,
            encounterId,
            authorId,
            authorName,
            templateId: note.templateId,
          },
          note
        );
        soapNoteId = (saved as { id?: string } | undefined)?.id;
        if (soapNoteId) {
          setPersistedDraftId(soapNoteId);
          upsertSoap(appointmentId, { id: soapNoteId });
        }
      } catch (error) {
        console.error('Unable to persist SOAP note before printing:', error);
      } finally {
        setIsPreparingPdf(false);
      }
    }

    if (soapNoteId) {
      await openSoapPdfPreview(soapNoteId, 'SOAP note - print to sign');
      return;
    }

    setPdfError('SOAP note PDF is not available yet. Using browser print.');
    globalThis.window.print();
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="w-full lg:max-w-125 lg:flex-1">
          <ChiefComplaintField value={appointmentReason} />
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center lg:w-auto lg:shrink-0 lg:justify-end lg:gap-3">
          <div className="w-full sm:w-52">
            <SoapContextField label="Speciality" value={appointmentSpeciality} />
          </div>
          <div className="w-full sm:w-52">
            <SoapContextField label="Service" value={appointmentService} />
          </div>
        </div>
      </div>

      {!readOnly && (
        <>
          <div className="relative flex justify-end">
            <div ref={templateSearchRef} className="relative w-full sm:max-w-90">
              <Search
                value={templateQuery}
                setSearch={setTemplateQuery}
                placeholder="Search for SOAP Template"
                label="Search for SOAP template"
                className="w-full!"
              />
              <SearchResultsDropdown
                anchorRef={templateSearchRef}
                open={templateMatches.length > 0}
                onClose={() => setTemplateQuery('')}
              >
                <ul>
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
              </SearchResultsDropdown>
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
              disabled={isSaving || isPreparingPdf}
              onPrintToSign={() => void handlePrintToSign()}
              onSaveAndNext={handleSaveAndNext}
            />
          </div>
        </>
      )}

      <SoapNotesList items={pastNotes} />
      {pdfError && (
        <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-danger-700">
          {pdfError}
        </p>
      )}
      <PdfPreviewOverlay
        open={Boolean(pdfPreviewUrl)}
        title={pdfPreviewTitle}
        pdfUrl={pdfPreviewUrl}
        onClose={() => setPdfPreviewUrl(null)}
      />
    </div>
  );
};

export default SoapStep;
