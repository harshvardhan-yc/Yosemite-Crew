import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { Appointment } from '@yosemite-crew/types';
import {
  LuCalendarDays,
  LuCheck,
  LuClock,
  LuExternalLink,
  LuEye,
  LuFlaskConical,
  LuPrinter,
  LuRefreshCw,
  LuTestTube,
  LuTrash2,
  LuUser,
} from 'react-icons/lu';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';
import Close from '@/app/ui/primitives/Icons/Close';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import {
  useLabTests,
  resolveOrderUiUrl,
  resolveOrderPdfUrl,
  formatTestPrice,
  getTestTurnaround,
  getTestSpecimen,
  toTitleCase,
  LabResultCategoryTable,
  type UseLabTestsReturn,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import type { IdexxTest } from '@/app/features/integrations/services/types';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';
import { formatDateTimeLocal } from '@/app/lib/date';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

type DiagnosticProvider = 'IDEXX' | 'RAD_ANALYZER';

type DiagnosticsStepProps = {
  appointment: Appointment;
  onOpenTreatment: () => void;
};

const PROVIDERS: { key: DiagnosticProvider; label: string }[] = [
  { key: 'IDEXX', label: 'IDEXX' },
  { key: 'RAD_ANALYZER', label: 'RadAnalyzer' },
];

const ProviderContent = ({
  provider,
}: {
  provider: { key: DiagnosticProvider; label: string };
}) => {
  if (provider.key === 'IDEXX') {
    return (
      <Image
        src={MEDIA_SOURCES.futureAssets.idexxLogoUrl}
        alt="IDEXX"
        width={94}
        height={40}
        className="h-4 w-auto object-contain"
      />
    );
  }
  return <span>{provider.label}</span>;
};

const IntegrationPills = ({
  selected,
  onSelect,
}: {
  selected: DiagnosticProvider;
  onSelect: (provider: DiagnosticProvider) => void;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    {PROVIDERS.map((provider) => {
      const active = selected === provider.key;
      return (
        <button
          key={provider.key}
          type="button"
          aria-pressed={active}
          onClick={() => onSelect(provider.key)}
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-body-4 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
            active
              ? 'border-text-brand bg-primary-100 text-text-brand'
              : 'border-neutral-300 text-text-primary hover:bg-neutral-100'
          }`}
        >
          <ProviderContent provider={provider} />
          {active && <LuExternalLink size={14} aria-hidden="true" />}
        </button>
      );
    })}
  </div>
);

const TestQueueCard = ({ test, onRemove }: { test: IdexxTest; onRemove: () => void }) => (
  <article className="flex min-h-52 flex-col gap-4 rounded-2xl border border-card-border bg-neutral-0 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <h4 className="text-body-3-emphasis text-text-primary">{test.display}</h4>
      <CircleIconButton
        icon={<LuTrash2 size={16} aria-hidden="true" />}
        label={`Remove ${test.display}`}
        variant="danger"
        onClick={onRemove}
      />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="rounded-sm bg-primary-100 px-2 py-1 text-heading-4 text-text-brand">
        {formatTestPrice(test)}
      </span>
      <span className="text-body-4 text-text-primary">Code: {test.code}</span>
    </div>
    <div className="mt-auto flex flex-col gap-2 text-caption-1 text-text-primary">
      <p className="flex gap-2">
        <LuClock className="mt-0.5 shrink-0 text-text-brand" aria-hidden="true" />
        <span>
          <strong>Turnaround time:</strong>
          <br />
          {getTestTurnaround(test)}
        </span>
      </p>
      <p className="flex gap-2">
        <LuTestTube className="mt-0.5 shrink-0 text-text-brand" aria-hidden="true" />
        <span>
          <strong>Specimen:</strong>
          <br />
          {getTestSpecimen(test)}
        </span>
      </p>
    </div>
  </article>
);

const ReferenceOrderBuilder = ({ s }: { s: UseLabTestsReturn }) => (
  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
    <div className="flex flex-col gap-4">
      <SearchDropdown
        placeholder="Search for Lab tests"
        options={s.tests.map((test) => ({
          value: test.code,
          label: `${test.display} (${test.code})`,
          meta: test,
        }))}
        onSelect={s.addTest}
        query={s.selectedTestLabel || s.query}
        setQuery={(value: string) => {
          s.setSelectedTestLabel(value);
          s.setQuery(value);
        }}
        minChars={0}
        onReachEnd={s.loadMoreTests}
        hasMore={s.testsHasMore}
        isLoadingMore={s.testsLoadingMore}
        optionClassName="w-full text-start rounded-2xl! border border-card-border bg-white px-3 py-2 mb-2 last:mb-0 hover:bg-white transition-colors"
        renderOption={(option) => {
          const test = option.meta as IdexxTest | undefined;
          if (!test) return option.label;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <span className="pr-2 text-body-4 text-text-primary">{test.display}</span>
                <span className="whitespace-nowrap rounded bg-primary-100 px-2 py-1 text-label-xsmall text-text-brand">
                  {formatTestPrice(test)}
                </span>
              </div>
              <span className="text-caption-1 text-text-secondary">Code: {test.code}</span>
            </div>
          );
        }}
      />
      <p className="max-w-2xl text-body-4 text-text-secondary">
        IDEXX test reference data does not explicitly flag tests as in-house vs device-specific in
        this contract. Use reference lab for external IDEXX ordering.
      </p>
      <FormInput
        intype="text"
        inname="lab-notes"
        inlabel="Notes"
        value={s.notes}
        onChange={(e) => s.setNotes(e.target.value)}
      />
    </div>
    <div className="flex flex-col gap-3">
      <FormInput
        intype="date"
        inname="lab-specimen-date"
        inlabel="Collection Date"
        value={s.specimenCollectionDate}
        onChange={(e) => s.setSpecimenCollectionDate(e.target.value)}
      />
      <LabelDropdown
        placeholder="Veterinarian"
        options={s.practitionerOptions}
        defaultOption={s.veterinarian}
        icon={<LuUser aria-hidden="true" />}
        onSelect={(option) => s.setVeterinarian(option.value)}
      />
      <LabelDropdown
        placeholder="Technician"
        options={s.practitionerOptions}
        defaultOption={s.technician}
        icon={<LuUser aria-hidden="true" />}
        onSelect={(option) => s.setTechnician(option.value)}
      />
    </div>
  </div>
);

const InhouseOrderBuilder = ({ s }: { s: UseLabTestsReturn }) => (
  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-body-4 text-text-secondary">
        In-house IDEXX workflow requires selecting an IVLS device, then adding the patient to census
        here. Complete ordering on the IDEXX machine after census is confirmed.
      </p>
      <output
        className={`block rounded-2xl border p-4 text-body-4 ${
          s.companionInCensus
            ? 'border-pill-success-border bg-pill-success-bg text-pill-success-text'
            : 'border-card-border text-text-secondary'
        }`}
      >
        <p>
          {s.companionInCensus
            ? 'Patient is present in IDEXX census for this appointment patient.'
            : 'Patient is not yet in the IDEXX census.'}
        </p>
        <p>
          IVLS confirmation:{' '}
          {s.selectedIvls
            ? s.inHouseCensusConfirmed
              ? 'Confirmed for selected device'
              : 'Pending for selected device'
            : 'Select an IVLS device to check confirmation state'}
        </p>
      </output>
    </div>
    <div className="flex flex-col gap-3">
      <LabelDropdown
        placeholder="Select Device"
        options={s.devices.map((device) => ({
          label: `${device.displayName || 'IVLS'} (${device.deviceSerialNumber})`,
          value: device.deviceSerialNumber,
        }))}
        defaultOption={s.selectedIvls}
        onSelect={(option) => s.setSelectedIvls(option.value)}
      />
    </div>
  </div>
);

const OrderBuilderSection = ({ s }: { s: UseLabTestsReturn }) => {
  const isInHouse = s.modality === 'INHOUSE';
  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Order Builder"
      className="flex flex-col gap-5"
    >
      <div className="flex justify-end">
        <div className="w-full sm:w-72">
          <LabelDropdown
            placeholder="Test Type"
            options={s.modalityOptions}
            defaultOption={s.modality}
            searchable={false}
            onSelect={(option) => s.setModality(option.value as 'REFERENCE_LAB' | 'INHOUSE')}
          />
        </div>
      </div>
      {isInHouse ? <InhouseOrderBuilder s={s} /> : <ReferenceOrderBuilder s={s} />}
      {isInHouse && (
        <div className="flex flex-wrap justify-end gap-3">
          <Secondary
            text={s.companionInCensus ? 'Added to Census' : 'Add to Census'}
            icon={<LuCheck aria-hidden="true" />}
            onClick={s.handleAddToCensus}
            isDisabled={s.updatingCensus || !s.selectedIvls || s.companionInCensus}
          />
          <Primary
            text={s.updatingCensus ? 'Refreshing…' : 'Refresh Census'}
            icon={<LuRefreshCw aria-hidden="true" />}
            onClick={() => void s.refreshCensus()}
            isDisabled={s.updatingCensus}
          />
        </div>
      )}
    </SectionContainer>
  );
};

const TestQueueSection = ({ s }: { s: UseLabTestsReturn }) => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="Test Queue"
    className="flex flex-col gap-5"
  >
    {s.selectedTests.length === 0 ? (
      <p className="rounded-2xl bg-neutral-100 p-5 text-body-4 text-text-secondary">
        No tests selected yet. Search and add tests from the Order Builder.
      </p>
    ) : (
      <div className="grid gap-4 lg:grid-cols-2">
        {s.selectedTests.map((test) => (
          <TestQueueCard key={test.code} test={test} onRemove={() => s.removeTest(test.code)} />
        ))}
      </div>
    )}
    <div className="flex justify-end">
      <Primary
        text={s.creatingOrder ? 'Creating Lab Order…' : 'Create Lab Order'}
        icon={<LuFlaskConical aria-hidden="true" />}
        onClick={s.handleCreateOrder}
        isDisabled={s.creatingOrder || s.loading || s.selectedTests.length === 0 || !s.companionId}
      />
    </div>
  </SectionContainer>
);

const OrderStatusSection = ({
  s,
  orderButtonText,
}: {
  s: UseLabTestsReturn;
  orderButtonText: string;
}) => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="Order Status"
    className="flex flex-col gap-4"
  >
    {s.appointmentOrders.length === 0 ? (
      <p className="text-body-4 text-text-secondary">
        {s.ordersLoading
          ? 'Loading appointment lab orders…'
          : 'No lab orders for this appointment yet.'}
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {s.appointmentOrders.map((order, index) => {
          const isComplete = s.getOrderDisplayStatus(order) === 'Complete';
          return (
            <li
              key={order._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-body-4 font-medium text-text-primary">
                  {index + 1}. Order {order.idexxOrderId}
                </span>
                <span className="text-caption-1 text-text-secondary">
                  {formatDateTimeLocal(order.updatedAt ?? order.createdAt, '-')}
                </span>
              </div>
              <span className="text-body-4 text-text-primary">
                {s.getOrderDisplayStatus(order)}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Secondary
                  text={isComplete ? 'Result PDF' : orderButtonText}
                  icon={!isComplete ? <LuExternalLink aria-hidden="true" /> : undefined}
                  ariaLabel={`${isComplete ? 'Open result PDF' : orderButtonText} for order ${order.idexxOrderId}`}
                  onClick={() => {
                    s.setActiveOrderForActions(order);
                    if (isComplete) {
                      void s.openResultPdfForOrder(order);
                      return;
                    }
                    s.openOrderIframe(s.canOpenFollowUpInCurrentOrder ? 'followup' : 'order');
                  }}
                  isDisabled={!isComplete && !resolveOrderUiUrl(order)}
                />
                <Secondary
                  text="Acknowledgement"
                  icon={<LuEye aria-hidden="true" />}
                  ariaLabel={`View acknowledgement for order ${order.idexxOrderId}`}
                  onClick={() => s.openOrderAcknowledgement(order)}
                  isDisabled={!resolveOrderPdfUrl(order)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    )}
    <div className="flex justify-end">
      <Primary
        text={s.ordersLoading ? 'Refreshing…' : 'Refresh Orders'}
        icon={<LuRefreshCw aria-hidden="true" />}
        onClick={() => void s.refreshAppointmentOrders()}
        isDisabled={s.ordersLoading}
      />
    </div>
  </SectionContainer>
);

const ResultsSection = ({ s }: { s: UseLabTestsReturn }) => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="Results"
    className="flex flex-col gap-4"
  >
    {s.results.length === 0 ? (
      <p className="text-body-4 text-text-secondary">
        {s.refreshingResults ? 'Refreshing results…' : 'No results available yet.'}
      </p>
    ) : (
      s.results.map((result, index) => (
        <div
          key={result.resultId}
          className="flex flex-col gap-2 rounded-2xl border border-card-border p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-body-3 text-text-primary">Result {index + 1}</span>
              <span className="text-caption-1 text-text-secondary">
                ID: {result.resultId} | Status: {toTitleCase(result.status)} | Order:{' '}
                {result.orderId ?? '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CircleIconButton
                icon={<LuEye size={16} aria-hidden="true" />}
                label={`View results PDF for result ${result.resultId}`}
                variant="dark"
                onClick={() => void s.openResultPdfPreview(result.resultId)}
                disabled={s.pdfPreviewLoadingId === result.resultId}
              />
            </div>
          </div>
          {(result.rawPayload?.categories ?? []).map((category) => (
            <LabResultCategoryTable
              key={`${result.resultId}-${category.name}`}
              category={category}
              resultId={result.resultId}
            />
          ))}
        </div>
      ))
    )}
  </SectionContainer>
);

const OrderIframeOverlay = ({ s }: { s: UseLabTestsReturn }) => {
  const url = s.iframeOrderUiUrl || resolveOrderUiUrl(s.latestOrder);
  const safeUrl = getSafeIdexxIframeUrl(url);
  if (!s.showOrderIframe || !safeUrl || typeof document === 'undefined') return null;
  const title = s.iframeOpenSource === 'followup' ? 'IDEXX follow-up ordering' : 'IDEXX ordering';
  return createPortal(
    <div
      className="fixed inset-0 z-5000 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      data-signing-overlay="true"
    >
      <div className="relative flex size-full max-h-[95vh] max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-2">
          <span className="text-body-2 text-text-primary">{title}</span>
          <button
            type="button"
            onClick={s.closeOrderIframeManually}
            className="cursor-pointer rounded-full p-2 transition-colors hover:bg-black/5"
            aria-label="Close IDEXX order frame"
          >
            <Close iconOnly />
          </button>
        </div>
        <iframe
          src={safeUrl}
          title="IDEXX order UI"
          className="w-full flex-1 border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>,
    document.body
  );
};

const RadAnalyzerComingSoon = () => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="RadAnalyzer"
    className="flex flex-col gap-3"
  >
    <p className="text-body-4 text-text-secondary">
      RadAnalyzer diagnostics are coming soon for the appointment workspace.
    </p>
    <p className="text-caption-1 text-text-secondary">
      Use IDEXX for live diagnostic orders, IVLS census, results, and acknowledgements.
    </p>
  </SectionContainer>
);

const IdexxNotEnabled = () => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="IDEXX Diagnostics"
    className="flex flex-col gap-3"
  >
    <p className="text-body-3 text-text-primary">
      IDEXX integration is not enabled for this organization.
    </p>
    <Secondary href="/integrations" text="Enable IDEXX in Integrations" />
  </SectionContainer>
);

/**
 * Diagnostics step — the new workspace UI (pills, Order Builder, Test Queue,
 * Order Status, Results) rendered directly on the live IDEXX backend via the
 * shared `useLabTests` hook (no logic duplication; same API as the legacy drawer).
 */
const DiagnosticsStep = ({ appointment, onOpenTreatment }: DiagnosticsStepProps) => {
  const s = useLabTests(appointment);
  const [selectedProvider, setSelectedProvider] = useState<DiagnosticProvider>('IDEXX');

  let orderButtonText = 'Open IDEXX';
  if (s.needsInitialOrderPlacement) orderButtonText = 'Resume order placement';
  else if (s.canOpenFollowUpInCurrentOrder) orderButtonText = 'Follow up';

  const renderIdexx = () => {
    if (s.loading) {
      return <p className="text-body-4 text-text-secondary">Loading IDEXX integration…</p>;
    }
    if (!s.integrationEnabled) return <IdexxNotEnabled />;
    return (
      <>
        {s.error ? <p className="text-body-4 text-text-error">{s.error}</p> : null}
        <OrderBuilderSection s={s} />
        <TestQueueSection s={s} />
        <OrderStatusSection s={s} orderButtonText={orderButtonText} />
        <ResultsSection s={s} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Secondary
            text="Print all Results"
            icon={<LuPrinter aria-hidden="true" />}
            onClick={() => globalThis.window.print()}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Secondary
              href="/appointments/idexx-workspace"
              text="Open Labs"
              ariaLabel="Open labs workspace"
              icon={<LuExternalLink aria-hidden="true" />}
            />
            <Primary
              text="Treatment Plan"
              icon={<LuCalendarDays aria-hidden="true" />}
              onClick={onOpenTreatment}
            />
          </div>
        </div>
        <OrderIframeOverlay s={s} />
        <PdfPreviewOverlay
          open={s.showPdfPreview}
          pdfUrl={s.pdfPreviewUrl}
          title={s.pdfPreviewTitle}
          closeLabel="Close IDEXX PDF preview"
          onClose={s.closePdfPreview}
        />
      </>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <IntegrationPills selected={selectedProvider} onSelect={setSelectedProvider} />
      {selectedProvider === 'RAD_ANALYZER' ? <RadAnalyzerComingSoon /> : renderIdexx()}
    </div>
  );
};

export default DiagnosticsStep;
