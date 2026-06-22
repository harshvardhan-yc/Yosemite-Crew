'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { LuAlertCircle, LuCheckCircle, LuDownload, LuEye, LuPrinter } from 'react-icons/lu';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';
import { fetchAppointmentForms } from '@/app/features/forms/services/appointmentFormsService';
import { downloadSubmissionPdf } from '@/app/features/forms/services/formSigningService';
import { isAuthRedirectError } from '@/app/services/axios';

type DocumentsPanelProps = {
  appointmentId: string;
  companionId?: string;
};

type DocsTab = 'FORMS' | 'RECORDS';

const TABS = [
  { key: 'FORMS', label: 'Forms' },
  { key: 'RECORDS', label: 'Records' },
];

type FormAuthState = 'AUTHORIZED_CLIENT' | 'PENDING' | 'AUTHORIZED_PROVIDER';

type SubmittedForm = {
  id: string;
  title: string;
  auth: FormAuthState;
  date: string;
  time: string;
  /** Backend submission id, present once the parent has submitted — enables PDF download. */
  submissionId?: string;
};

const AUTH_META: Record<FormAuthState, { label: string; tone: string; icon: React.ReactNode }> = {
  AUTHORIZED_CLIENT: {
    label: 'Authorized by Client',
    tone: 'text-success-600',
    icon: <LuCheckCircle size={14} aria-hidden="true" />,
  },
  PENDING: {
    label: 'Acknowledgement pending',
    tone: 'text-danger-600',
    icon: <LuAlertCircle size={14} aria-hidden="true" />,
  },
  AUTHORIZED_PROVIDER: {
    label: 'Authorized by Service Provider',
    tone: 'text-success-600',
    icon: <LuCheckCircle size={14} aria-hidden="true" />,
  },
};

const formatDate = (value: Date | string | undefined) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value: Date | string | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const renderFormsPanelContent = (
  status: 'loading' | 'loaded' | 'error',
  filteredForms: SubmittedForm[]
) => {
  if (status === 'loading') {
    return <p className="py-6 text-center text-body-4 text-text-secondary">Loading forms...</p>;
  }
  if (status === 'error') {
    return (
      <p className="py-6 text-center text-body-4 text-danger-600">
        Unable to load forms. Try again later.
      </p>
    );
  }
  if (filteredForms.length === 0) {
    return (
      <p className="py-6 text-center text-body-4 text-text-secondary">
        No forms match this search.
      </p>
    );
  }
  return (
    <ul className="rounded-2xl border border-card-border px-4">
      {filteredForms.map((form) => (
        <FormRow key={form.id} form={form} />
      ))}
    </ul>
  );
};

const FormRow = ({ form }: { form: SubmittedForm }) => {
  const meta = AUTH_META[form.auth];
  const isPending = form.auth === 'PENDING';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A completed submission has a backend submission id we can render to PDF.
  // Pending forms have nothing to download yet, so the action is disabled.
  const canDownload = !isPending && Boolean(form.submissionId);

  const handleDownload = async () => {
    if (!form.submissionId || busy) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await downloadSubmissionPdf(form.submissionId);
      const url = URL.createObjectURL(blob);
      globalThis.window.open(url, '_blank', 'noopener');
      // Revoke shortly after so the new tab has time to load the blob.
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (downloadError) {
      console.error('Unable to download the signed form:', downloadError);
      setError('Unable to download this form. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-1 border-b border-card-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 leading-[130%]">
          <span className="text-body-4 font-medium text-text-primary">{form.title}</span>
          <span className={`flex items-center gap-1 text-[12px] ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-[120%] text-[12px] text-pill-success-text">
            <span>{form.date}</span>
            <span>{form.time}</span>
          </div>
          <CircleIconButton
            icon={
              isPending ? (
                <LuEye size={16} aria-hidden="true" />
              ) : (
                <LuDownload size={16} aria-hidden="true" />
              )
            }
            label={
              isPending ? `Awaiting parent submission for ${form.title}` : `Download ${form.title}`
            }
            variant="dark"
            disabled={!canDownload || busy}
            onClick={() => void handleDownload()}
          />
          <CircleIconButton
            icon={<LuPrinter size={16} aria-hidden="true" />}
            label={`Print ${form.title}`}
            disabled={!canDownload || busy}
            onClick={() => void handleDownload()}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-danger-600">
          {error}
        </p>
      )}
    </li>
  );
};

const AppointmentFormsPanel = ({ appointmentId }: { appointmentId: string }) => {
  const initialAppointmentId = React.useRef(appointmentId);
  const [query, setQuery] = useState('');
  const [forms, setForms] = useState<SubmittedForm[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchAppointmentForms(initialAppointmentId.current).then(
      (response) => {
        if (cancelled) return;
        setForms(
          response.forms.map(({ form, submission, status: formStatus }) => {
            const updatedAt = form.updatedAt ?? form.createdAt;
            return {
              id: submission?._id ?? form._id ?? form.name,
              title: form.name,
              auth: formStatus === 'completed' ? 'AUTHORIZED_CLIENT' : 'PENDING',
              date: formatDate(updatedAt),
              time: formatTime(updatedAt),
              submissionId: submission?._id,
            };
          })
        );
        setStatus('loaded');
      },
      (error) => {
        if (cancelled) return;
        if (!isAuthRedirectError(error)) {
          console.error('Unable to load appointment forms:', error);
        }
        setStatus('error');
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredForms = useMemo(
    () => forms.filter((f) => f.title.toLowerCase().includes(query.trim().toLowerCase())),
    [forms, query]
  );

  return (
    <div
      id="docs-panel-FORMS"
      role="tabpanel"
      aria-labelledby="tab-FORMS"
      className="flex flex-col gap-3"
    >
      <Search
        value={query}
        setSearch={setQuery}
        placeholder="Search forms to add"
        label="Search forms to add"
        className="w-full!"
      />
      {renderFormsPanelContent(status, filteredForms)}
    </div>
  );
};

/** Documents panel: Forms (submitted forms + auth states) and Records (companion records). */
const DocumentsPanel = ({ appointmentId, companionId }: DocumentsPanelProps) => {
  const [tab, setTab] = useState<DocsTab>('FORMS');

  return (
    <div className="flex flex-col gap-4">
      <TabToggle
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => setTab(key as DocsTab)}
        panelId={(key) => `docs-panel-${key}`}
      />
      {tab === 'FORMS' ? (
        <AppointmentFormsPanel key={appointmentId} appointmentId={appointmentId} />
      ) : (
        <div id="docs-panel-RECORDS" role="tabpanel" aria-labelledby="tab-RECORDS">
          {companionId ? (
            <CompanionDocumentsSection companionId={companionId} />
          ) : (
            <p className="py-6 text-center text-body-4 text-text-secondary">
              No companion records available.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;
