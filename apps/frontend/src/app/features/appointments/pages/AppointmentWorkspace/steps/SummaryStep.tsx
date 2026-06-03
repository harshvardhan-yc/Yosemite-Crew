import React, { useMemo, useState } from 'react';
import type { Appointment } from '@yosemite-crew/types';
import { LuDownload, LuEye, LuFileSignature, LuPencil, LuPrinter, LuSearch } from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import Search from '@/app/ui/inputs/Search';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import AddAppointmentCentralModal from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import type { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import type {
  AppointmentEncounter,
  WorkspaceDocument,
} from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';

type SummaryStepProps = {
  appointmentId: string;
  appointment?: Appointment;
  encounter: AppointmentEncounter;
};

const DISCHARGE_TEMPLATES = [
  {
    id: 'tpl-post-op',
    name: 'Post-operative discharge',
    html: '<p>Keep the patient rested for 7 days. Monitor appetite, incision site, and medication tolerance.</p>',
  },
  {
    id: 'tpl-medication',
    name: 'Medication discharge',
    html: '<p>Continue prescribed medication as directed. Contact the clinic if vomiting, diarrhea, or lethargy develops.</p>',
  },
];

const formatDateTime = (iso: string): string => {
  const date = formatStampDate(iso);
  const time = formatStampTime(iso);
  return [date, time].filter(Boolean).join(', ');
};

const buildFollowUpPrefill = (followUpAt?: string): AppointmentDraftPrefill | null => {
  if (!followUpAt) return null;
  const date = new Date(followUpAt);
  if (Number.isNaN(date.getTime())) return null;
  return { date, minuteOfDay: 9 * 60 };
};

const DocumentCategoryPill = ({ category }: { category: WorkspaceDocument['category'] }) => (
  <span className="inline-flex rounded-2xl border border-card-border bg-neutral-0 px-3 py-1 text-caption-1 text-text-primary">
    {category}
  </span>
);

const AllDocumentsTable = ({
  documents,
  readOnly,
}: {
  documents: WorkspaceDocument[];
  readOnly: boolean;
}) => (
  <SectionContainer title="All Documents" className="flex flex-col gap-4">
    {documents.length === 0 ? (
      <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
        No documents recorded yet.
      </p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-body-4 text-text-primary">
          <thead className="text-caption-1 text-text-secondary">
            <tr>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Signed by</th>
              <th className="p-3 text-left">Last modified</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="border-t border-card-border">
                <td className="p-3 whitespace-nowrap">{formatDateTime(document.createdAt)}</td>
                <td className="p-3">
                  <DocumentCategoryPill category={document.category} />
                </td>
                <td className="p-3">{document.description}</td>
                <td className="p-3">{document.signedByName ?? '-'}</td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(document.lastModifiedAt)}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <CircleIconButton
                      icon={<LuEye aria-hidden="true" />}
                      label={`View ${document.description}`}
                      variant="dark"
                      onClick={() => undefined}
                    />
                    <CircleIconButton
                      icon={<LuDownload aria-hidden="true" />}
                      label={`Download ${document.description}`}
                      onClick={() => undefined}
                    />
                    <CircleIconButton
                      icon={<LuPencil aria-hidden="true" />}
                      label={`Edit ${document.description}`}
                      disabled={readOnly}
                      onClick={() => undefined}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </SectionContainer>
);

const SummaryStep = ({ appointmentId, appointment, encounter }: SummaryStepProps) => {
  const setDischargeSummary = useAppointmentWorkspaceStore((s) => s.setDischargeSummary);
  const setFollowUp = useAppointmentWorkspaceStore((s) => s.setFollowUp);
  const addDocument = useAppointmentWorkspaceStore((s) => s.addDocument);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const openSigningOverlay = useSigningOverlayStore((s) => s.openOverlay);
  const [templateQuery, setTemplateQuery] = useState('');
  const [bookingRequested, setBookingRequested] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const readOnly = encounter.viewOnly;

  const templateMatches = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return DISCHARGE_TEMPLATES.filter((template) => template.name.toLowerCase().includes(q));
  }, [templateQuery]);

  const handleTemplateSelect = (html: string) => {
    setDischargeSummary(appointmentId, html);
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

  const followUpPrefill = buildFollowUpPrefill(encounter.followUpAt);

  const handleBookFollowUp = () => {
    setBookingRequested(true);
    setShowFollowUpModal(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <SigningOverlay />
      <AddAppointmentCentralModal
        showModal={showFollowUpModal}
        setShowModal={setShowFollowUpModal}
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
        prefill={followUpPrefill}
        initialCompanionId={appointment?.companion.id ?? null}
      />
      <span className="sr-only" aria-hidden="true">
        {activeFilter}
        {activeStatus}
      </span>
      <SectionContainer
        title="Discharge Summary"
        className="flex flex-col gap-5"
        disableFocusBorder
      >
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative w-full sm:max-w-90">
            <Search
              value={templateQuery}
              setSearch={setTemplateQuery}
              placeholder="Search discharge templates"
              label="Search discharge templates"
              className="w-full!"
            />
            {templateMatches.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]">
                {templateMatches.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => handleTemplateSelect(template.html)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100"
                    >
                      <LuSearch aria-hidden="true" />
                      <span>{template.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {encounter.followUpAt && (
            <span className="rounded-2xl bg-primary-100 px-4 py-2 text-body-4-emphasis text-text-brand">
              Follow-up: {formatDateTime(encounter.followUpAt)}
            </span>
          )}
        </div>

        <RichTextEditor
          ariaLabel="Discharge summary"
          value={encounter.dischargeSummary}
          readOnly={readOnly}
          toolbarPlacement="inline"
          onChange={(html) => setDischargeSummary(appointmentId, html)}
          placeholder="Discharge instructions and follow-up care"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              aria-label="Follow-up date"
              value={encounter.followUpAt?.slice(0, 10) ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const value = e.target.value;
                setFollowUp(appointmentId, value ? `${value}T12:00:00Z` : undefined);
              }}
              className="h-10 rounded-2xl border border-input-border-default bg-transparent px-4 text-body-4 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
            />
            <Secondary text="Book follow up" onClick={handleBookFollowUp} isDisabled={readOnly} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Secondary
              text="Print All"
              icon={<LuPrinter aria-hidden="true" />}
              onClick={() => globalThis.window.print()}
            />
            <Primary
              text="Sign & Save"
              icon={<LuFileSignature aria-hidden="true" />}
              onClick={handleSign}
              isDisabled={readOnly}
            />
          </div>
        </div>
        {bookingRequested && (
          <p role="status" className="rounded-2xl bg-primary-100 p-3 text-body-4 text-text-brand">
            Follow-up booking requested.
          </p>
        )}
      </SectionContainer>

      <AllDocumentsTable documents={encounter.documents} readOnly={readOnly} />
    </div>
  );
};

export default SummaryStep;
