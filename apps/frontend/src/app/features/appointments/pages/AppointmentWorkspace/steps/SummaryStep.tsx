import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchResultsDropdown from '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown';
import type { Appointment, TemplateLike, TemplateSchemaSnapshot } from '@yosemite-crew/types';
import {
  LuDownload,
  LuEye,
  LuFileSignature,
  LuPencil,
  LuPrinter,
  LuSave,
  LuSearch,
} from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import Datepicker from '@/app/ui/inputs/Datepicker';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import { isRichTextEmpty, sanitizeRichText } from '@/app/lib/richText';
import type {
  AppointmentEncounter,
  WorkspaceDocument,
} from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import {
  getRenderedDocument,
  saveDischargeSummaryArtifact,
} from '@/app/features/appointments/services/workspaceClinicalService';
import { listDischargeSummaryTemplates } from '@/app/features/appointments/services/workspaceTemplateService';

type SummaryStepProps = {
  appointmentId: string;
  appointment?: Appointment;
  encounter: AppointmentEncounter;
};

const formatDateTime = (iso: string): string => {
  const date = formatStampDate(iso);
  const time = formatStampTime(iso);
  return [date, time].filter(Boolean).join(', ');
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const hasTemplateSchemaSnapshot = (value: unknown): value is TemplateSchemaSnapshot =>
  Boolean(
    value && typeof value === 'object' && Array.isArray((value as { sections?: unknown }).sections)
  );

const getTemplateSchemaSnapshot = (template: TemplateLike): TemplateSchemaSnapshot | undefined => {
  const rootSnapshot = (template as TemplateLike & { schemaSnapshot?: unknown }).schemaSnapshot;
  if (hasTemplateSchemaSnapshot(rootSnapshot)) return rootSnapshot;
  const version = template.versions?.find(
    (item) => item.version === template.publishedVersion || item.version === template.latestVersion
  );
  return hasTemplateSchemaSnapshot(version?.schemaSnapshot) ? version.schemaSnapshot : undefined;
};

const templateToDischargeHtml = (template: TemplateLike): string => {
  const sections = getTemplateSchemaSnapshot(template)?.sections ?? [];
  if (sections.length === 0) return '';
  return sections
    .map((section) => {
      const fields = section.fields
        .map((field) => `<p><strong>${escapeHtml(field.label || field.key)}</strong>: </p>`)
        .join('');
      return `<h3>${escapeHtml(section.title)}</h3>${fields}`;
    })
    .join('');
};

/** ISO follow-up timestamp ⇄ the Datepicker's `Date | null` value. */
const toFollowUpDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DocumentCategoryPill = ({ category }: { category: WorkspaceDocument['category'] }) => (
  <span className="inline-flex rounded-2xl border border-[#D6D1CD] bg-[#FAF8F6] px-3 py-1 text-caption-1 text-text-primary">
    {category}
  </span>
);

/** Shared column template (mirrors the Invoice table) so the heading and row
 *  grids resolve to identical track widths. The Actions track is fixed. */
const DOCUMENT_COLS =
  'sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_92px]';
const DOCUMENT_ROW_GRID = `grid gap-3 ${DOCUMENT_COLS} sm:items-center`;

const downloadDocumentUrl = (url: string) => {
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener noreferrer';
  globalThis.document.body.append(link);
  link.click();
  link.remove();
};

/**
 * Build the "All Documents" rows from the encounter's clinical artifacts so the
 * list stays in sync with every save (SOAP, prescription, discharge summary)
 * without a dedicated documents fetch. Any explicitly added/signed documents
 * (e.g. the signed discharge summary) are merged in and win on id collisions.
 */
const deriveWorkspaceDocuments = (encounter: AppointmentEncounter): WorkspaceDocument[] => {
  const derived: WorkspaceDocument[] = [];

  encounter.soap.forEach((note, index) => {
    const hasContent =
      !isRichTextEmpty(note.subjective) ||
      !isRichTextEmpty(note.objective) ||
      !isRichTextEmpty(note.assessment) ||
      !isRichTextEmpty(note.plan) ||
      !isRichTextEmpty(note.chiefComplaint);
    if (!hasContent) return;
    derived.push({
      id: note.id,
      category: 'SOAP',
      description: encounter.soap.length > 1 ? `SOAP note ${index + 1}` : 'SOAP note',
      createdAt: note.createdAt,
      lastModifiedAt: note.signedAt ?? note.createdAt,
      signedByName: note.signedByName,
      signatureRequired: note.status !== 'COMPLETED',
    });
  });

  if (encounter.prescription.length > 0) {
    const names = encounter.prescription
      .map((item) => item.medicineName)
      .filter(Boolean)
      .join(', ');
    derived.push({
      id: 'prescription',
      category: 'Treatment',
      description: names ? `Prescription — ${names}` : 'Prescription',
      createdAt: encounter.dischargeSavedAt ?? new Date().toISOString(),
      lastModifiedAt: encounter.dischargeSavedAt ?? new Date().toISOString(),
    });
  }

  if (encounter.dischargeSavedAt && !isRichTextEmpty(encounter.dischargeSummary)) {
    derived.push({
      id: encounter.dischargeSummaryId ?? 'discharge-summary',
      category: 'Discharge',
      description: 'Discharge summary',
      createdAt: encounter.dischargeSavedAt,
      lastModifiedAt: encounter.dischargeSavedAt,
      signedByName: encounter.dischargeSavedByName,
      signatureRequired: false,
    });
  }

  const explicitIds = new Set(encounter.documents.map((document) => document.id));
  return [
    ...encounter.documents,
    ...derived.filter((document) => !explicitIds.has(document.id)),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const AllDocumentsTable = ({
  documents,
  organisationId,
}: {
  documents: WorkspaceDocument[];
  organisationId?: string;
}) => {
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  const resolveDocumentUrl = async (document: WorkspaceDocument) => {
    if (document.pdfUrl) return document.pdfUrl;
    if (!organisationId) throw new Error('Organisation missing for document lookup.');
    const rendered = await getRenderedDocument(organisationId, document.id);
    const pdfUrl = (rendered as { pdfUrl?: unknown }).pdfUrl;
    if (typeof pdfUrl === 'string' && pdfUrl.trim()) return pdfUrl.trim();
    throw new Error('Document PDF is not available yet.');
  };

  const handleDocumentAction = async (document: WorkspaceDocument, download: boolean) => {
    setDocumentError(null);
    try {
      const url = await resolveDocumentUrl(document);
      if (download) {
        downloadDocumentUrl(url);
        return;
      }
      setPreview({ title: document.description, url });
    } catch (error) {
      console.error('Unable to open workspace document:', error);
      setDocumentError(error instanceof Error ? error.message : 'Unable to open document.');
    }
  };

  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="All Documents"
      className="flex flex-col gap-4"
    >
      {documents.length === 0 ? (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No documents recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className={`${DOCUMENT_ROW_GRID} hidden border border-transparent px-4 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate sm:grid`}
          >
            <span>Created</span>
            <span>Category</span>
            <span>Description</span>
            <span>Signed by</span>
            <span>Last modified</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="flex flex-col gap-3">
            {documents.map((document) => (
              <li
                key={document.id}
                className={`${DOCUMENT_ROW_GRID} rounded-2xl border border-card-border p-4`}
              >
                <span className="truncate text-body-4 text-text-secondary">
                  {formatDateTime(document.createdAt)}
                </span>
                <span>
                  <DocumentCategoryPill category={document.category} />
                </span>
                <span className="truncate font-medium text-text-primary">
                  {document.description}
                </span>
                <span className="truncate text-body-4 text-text-primary">
                  {document.signedByName ?? '-'}
                </span>
                <span className="truncate text-body-4 text-text-secondary">
                  {formatDateTime(document.lastModifiedAt)}
                </span>
                <div className="flex justify-end gap-2">
                  <CircleIconButton
                    icon={<LuEye aria-hidden="true" />}
                    label={`View ${document.description}`}
                    variant="dark"
                    onClick={() => void handleDocumentAction(document, false)}
                  />
                  <CircleIconButton
                    icon={<LuDownload aria-hidden="true" />}
                    label={`Download ${document.description}`}
                    onClick={() => void handleDocumentAction(document, true)}
                  />
                </div>
              </li>
            ))}
          </ul>
          {documentError && (
            <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-danger-700">
              {documentError}
            </p>
          )}
        </div>
      )}
      <PdfPreviewOverlay
        open={Boolean(preview)}
        title={preview?.title ?? 'Document'}
        pdfUrl={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />
    </SectionContainer>
  );
};

const SummaryStep = ({ appointmentId, appointment, encounter }: SummaryStepProps) => {
  const setDischargeSummary = useAppointmentWorkspaceStore((s) => s.setDischargeSummary);
  const saveDischargeSummary = useAppointmentWorkspaceStore((s) => s.saveDischargeSummary);
  const reopenDischargeSummary = useAppointmentWorkspaceStore((s) => s.reopenDischargeSummary);
  const setFollowUp = useAppointmentWorkspaceStore((s) => s.setFollowUp);
  const addDocument = useAppointmentWorkspaceStore((s) => s.addDocument);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const openSigningOverlay = useSigningOverlayStore((s) => s.openOverlay);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateState, setTemplateState] = useState<{
    templates: TemplateLike[];
    error: string | null;
  }>({ templates: [], error: null });
  const [isSaving, setIsSaving] = useState(false);
  // The discharge summary becomes read-only once saved (or when the encounter
  // itself is view-only).
  const dischargeSaved = Boolean(encounter.dischargeSavedAt);
  const readOnly = encounter.viewOnly || dischargeSaved;
  const derivedDocuments = useMemo(() => deriveWorkspaceDocuments(encounter), [encounter]);

  const templateSearchRef = useRef<HTMLDivElement>(null);
  const templateMatches = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return templateState.templates.filter((template) => template.name.toLowerCase().includes(q));
  }, [templateQuery, templateState.templates]);

  useEffect(() => {
    if (!appointment?.organisationId) return;
    listDischargeSummaryTemplates(appointment.organisationId)
      .then((items) => {
        setTemplateState({ templates: items, error: null });
      })
      .catch((error) => {
        console.error('Unable to load discharge templates:', error);
        setTemplateState({ templates: [], error: 'Unable to load discharge templates.' });
      });
  }, [appointment?.organisationId]);

  const handleTemplateSelect = (template: TemplateLike) => {
    setDischargeSummary(appointmentId, templateToDischargeHtml(template));
    setTemplateQuery('');
  };

  const handleSign = () => {
    const now = new Date().toISOString();
    addDocument(appointmentId, {
      createdAt: now,
      category: 'Discharge',
      description: 'Signed discharge summary',
      signedByName: encounter.leadName ?? 'Clinician',
      lastModifiedAt: now,
      signatureRequired: true,
    });
    setStepStatus(appointmentId, 'SUMMARY', 'COMPLETED');
    openSigningOverlay(`workspace-summary-${appointmentId}`);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    let persistedId: string | undefined;
    try {
      if (appointment?.organisationId) {
        const saved = await saveDischargeSummaryArtifact(
          {
            organisationId: appointment.organisationId,
            appointmentId,
            encounterId: appointment.encounterId,
            dischargeSummaryId: encounter.dischargeSummaryId,
          },
          encounter.dischargeSummary,
          encounter.followUpAt
        );
        persistedId = (saved as { id?: string } | undefined)?.id;
      }
    } catch (error) {
      console.error('Unable to persist discharge summary:', error);
    } finally {
      saveDischargeSummary(appointmentId, encounter.leadName ?? 'Clinician', persistedId);
      setIsSaving(false);
    }
  };

  const handleFollowUpChange = (next: Date | null) => {
    setFollowUp(appointmentId, next ? next.toISOString() : undefined);
  };

  const followUpDate = toFollowUpDate(encounter.followUpAt);

  return (
    <div className="flex flex-col gap-5">
      <SigningOverlay />

      {/* Discharge-template search sits above the container (like the SOAP step's
          template search) — selecting a template fills the editor. */}
      <div className="relative flex justify-end">
        <div ref={templateSearchRef} className="relative w-full sm:max-w-90">
          <Search
            value={templateQuery}
            setSearch={setTemplateQuery}
            placeholder="Search discharge templates"
            label="Search discharge templates"
            className="w-full!"
          />
          <SearchResultsDropdown
            anchorRef={templateSearchRef}
            open={Boolean(templateQuery.trim()) && !templateState.error}
            onClose={() => setTemplateQuery('')}
          >
            {templateMatches.length > 0 ? (
              <ul>
                {templateMatches.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
                    >
                      <LuSearch aria-hidden="true" />
                      <span>{template.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-body-4 text-text-secondary">
                No discharge templates match this search.
              </p>
            )}
          </SearchResultsDropdown>
          {templateState.error && (
            <p className="mt-2 text-caption-1 text-danger-600">{templateState.error}</p>
          )}
        </div>
      </div>

      {/* Mirrors the SOAP step sections: title + inset rich-text editor only.
          Once saved, the editor is replaced by a read-only render of the summary
          with a fixed follow-up date and a "Saved on … by …" stamp. */}
      <SectionContainer titleClassName="text-yc-20-b-primary" title="Discharge Summary" compactTop>
        {dischargeSaved ? (
          <div className="relative">
            {/* Editable until the encounter is locked (window closed / completed /
                discharged). Absolutely positioned so it overlays the top-right
                without pushing the summary down a row. */}
            {!encounter.viewOnly && (
              <div className="absolute top-0 right-0 z-10">
                <CircleIconButton
                  icon={<LuPencil aria-hidden="true" />}
                  label="Edit discharge summary"
                  variant="dark"
                  onClick={() => reopenDischargeSummary(appointmentId)}
                />
              </div>
            )}
            <div
              className="text-body-4 leading-[150%] text-text-primary [&_li]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 sm:pr-12"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichText(encounter.dischargeSummary ?? '') || '-',
              }}
            />
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              {/* Same Datepicker container as edit mode, rendered non-interactive. */}
              <div
                className="pointer-events-none w-full select-none sm:max-w-72"
                aria-disabled="true"
              >
                <Datepicker
                  type="input"
                  currentDate={followUpDate}
                  setCurrentDate={() => undefined}
                  placeholder="Follow up date"
                />
              </div>
              <div className="flex flex-col items-end leading-[120%]">
                <span className="text-[12px] font-bold text-neutral-900">
                  Saved by {encounter.dischargeSavedByName}
                </span>
                <span className="text-[12px] font-medium text-text-brand">
                  {formatDateTime(encounter.dischargeSavedAt ?? '')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <RichTextEditor
              ariaLabel="Discharge summary"
              value={encounter.dischargeSummary}
              readOnly={readOnly}
              toolbarPlacement="inset"
              onChange={(html) => setDischargeSummary(appointmentId, html)}
              placeholder="Discharge instructions and follow-up care"
            />
            <div className="mt-3 flex justify-end">
              <div
                className={`w-full sm:max-w-72 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}
                aria-disabled={readOnly}
              >
                <Datepicker
                  type="input"
                  currentDate={followUpDate}
                  setCurrentDate={
                    handleFollowUpChange as React.Dispatch<React.SetStateAction<Date | null>>
                  }
                  placeholder="Follow up date"
                />
              </div>
            </div>
          </>
        )}
      </SectionContainer>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Secondary
          text="Print"
          icon={<LuPrinter aria-hidden="true" />}
          onClick={() => globalThis.window.print()}
        />
        {!dischargeSaved && (
          <Secondary
            text="Save"
            icon={<LuSave aria-hidden="true" />}
            onClick={handleSave}
            isDisabled={encounter.viewOnly || isSaving}
          />
        )}
        <Secondary
          text="Sign"
          icon={<LuFileSignature aria-hidden="true" />}
          onClick={handleSign}
          isDisabled={encounter.viewOnly}
        />
      </div>

      <AllDocumentsTable
        documents={derivedDocuments}
        organisationId={appointment?.organisationId}
      />
    </div>
  );
};

export default SummaryStep;
