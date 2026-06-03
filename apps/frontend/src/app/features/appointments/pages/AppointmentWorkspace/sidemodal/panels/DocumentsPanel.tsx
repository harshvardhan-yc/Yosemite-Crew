'use client';
import React, { useState } from 'react';
import { LuAlertCircle, LuCheckCircle, LuDownload, LuEye, LuPrinter } from 'react-icons/lu';
import TabToggle from '@/app/ui/primitives/TabToggle/TabToggle';
import Search from '@/app/ui/inputs/Search';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';

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

const MOCK_FORMS: SubmittedForm[] = [
  {
    id: 'frm-1',
    title: 'Medication Admin - ID 67890',
    auth: 'AUTHORIZED_CLIENT',
    date: 'Apr 21, 2026',
    time: '09:45 AM',
  },
  {
    id: 'frm-2',
    title: 'Medication Admin - ID 67890',
    auth: 'PENDING',
    date: 'Apr 21, 2026',
    time: '09:45 AM',
  },
  {
    id: 'frm-3',
    title: 'Medication Admin - ID 67890',
    auth: 'AUTHORIZED_PROVIDER',
    date: 'Apr 21, 2026',
    time: '09:45 AM',
  },
];

const FormRow = ({ form }: { form: SubmittedForm }) => {
  const meta = AUTH_META[form.auth];
  const isPending = form.auth === 'PENDING';
  return (
    <li className="flex items-center justify-between gap-3 border-b border-card-border py-3 last:border-0">
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
          label={isPending ? `View ${form.title}` : `Download ${form.title}`}
          variant="dark"
          onClick={() => undefined}
        />
        <CircleIconButton
          icon={<LuPrinter size={16} aria-hidden="true" />}
          label={`Print ${form.title}`}
          onClick={() => globalThis.window.print()}
        />
      </div>
    </li>
  );
};

/** Documents panel: Forms (submitted forms + auth states) and Records (companion records). */
const DocumentsPanel = ({ companionId }: DocumentsPanelProps) => {
  const [tab, setTab] = useState<DocsTab>('FORMS');
  const [query, setQuery] = useState('');

  const forms = MOCK_FORMS.filter((f) =>
    f.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <TabToggle
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => setTab(key as DocsTab)}
        panelId={(key) => `docs-panel-${key}`}
      />
      {tab === 'FORMS' ? (
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
          {forms.length === 0 ? (
            <p className="py-6 text-center text-body-4 text-text-secondary">
              No forms match this search.
            </p>
          ) : (
            <ul className="rounded-2xl border border-card-border px-4">
              {forms.map((form) => (
                <FormRow key={form.id} form={form} />
              ))}
            </ul>
          )}
        </div>
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
