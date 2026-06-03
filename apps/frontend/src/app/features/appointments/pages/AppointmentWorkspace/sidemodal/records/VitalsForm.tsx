'use client';
import React, { useState } from 'react';
import { LuCheck, LuEye, LuEyeOff } from 'react-icons/lu';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { Vitals } from '@/app/features/appointments/types/workspace';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';

type VitalsFormProps = {
  appointmentId: string;
  vitals: Vitals[];
};

const RECORDER_OPTIONS = [
  { label: 'Sarah Mitchell', value: 'usr-sarah' },
  { label: 'Dr. Tim Apple', value: 'usr-tim' },
];

type Field = {
  key: keyof DraftVitals;
  label: string;
  unit: string;
};

type DraftVitals = {
  weightLbs: string;
  tempF: string;
  heartRateBpm: string;
  respRateBpm: string;
  crtSec: string;
  mucousMembrane: string;
  painScore: string;
  bcs: string;
};

const EMPTY_DRAFT: DraftVitals = {
  weightLbs: '',
  tempF: '',
  heartRateBpm: '',
  respRateBpm: '',
  crtSec: '',
  mucousMembrane: '',
  painScore: '',
  bcs: '',
};

const FIELDS: Field[] = [
  { key: 'weightLbs', label: 'Weight', unit: 'lbs' },
  { key: 'tempF', label: 'Temperature', unit: '°F' },
  { key: 'heartRateBpm', label: 'Heart Rate', unit: 'bpm' },
  { key: 'respRateBpm', label: 'Respiratory rate', unit: 'bpm' },
  { key: 'crtSec', label: 'CRT', unit: 'sec' },
  { key: 'mucousMembrane', label: 'Mucous membrane', unit: 'mm' },
  { key: 'painScore', label: 'Pain score', unit: '/ 10' },
  { key: 'bcs', label: 'BCS', unit: '/ 9' },
];

const VitalsField = ({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[12px] font-medium text-neutral-700">{field.label}</span>
    <span className="flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-body-4 text-text-primary outline-none"
      />
      <span className="flex items-center bg-neutral-100 px-3 text-body-4 text-neutral-700">
        {field.unit}
      </span>
    </span>
  </label>
);

const parseNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const VitalRow = ({ entry }: { entry: Vitals }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 border-b border-card-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col leading-[120%]">
          <span className="text-[12px] font-medium text-pill-success-text">
            {formatStampDate(entry.recordedAt)}
          </span>
          <span className="text-body-4 font-medium text-text-primary">{entry.code}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-neutral-100 px-3 py-1 text-body-4 text-text-primary">
            {entry.recordedByName}
          </span>
          <CircleIconButton
            icon={
              open ? (
                <LuEyeOff size={16} aria-hidden="true" />
              ) : (
                <LuEye size={16} aria-hidden="true" />
              )
            }
            label={open ? `Hide ${entry.code}` : `View ${entry.code}`}
            variant="dark"
            onClick={() => setOpen((v) => !v)}
          />
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-2xl border border-card-border p-3 text-body-4 text-text-primary">
          <span>Weight: {entry.weightLbs ?? '-'} lbs</span>
          <span>Temp: {entry.tempF ?? '-'} °F</span>
          <span>Heart rate: {entry.heartRateBpm ?? '-'} bpm</span>
          <span>Resp. rate: {entry.respRateBpm ?? '-'} bpm</span>
          <span>CRT: {entry.crtSec ?? '-'}</span>
          <span>MM: {entry.mucousMembrane ?? '-'}</span>
          <span>Pain: {entry.painScore ?? '-'} / 10</span>
          <span>BCS: {entry.bcs ?? '-'} / 9</span>
        </div>
      )}
    </li>
  );
};

/** Vitals tab: a "New vitals" form plus the recorded-vitals list. */
const VitalsForm = ({ appointmentId, vitals }: VitalsFormProps) => {
  const addVitals = useAppointmentWorkspaceStore((s) => s.addVitals);
  const [draft, setDraft] = useState<DraftVitals>(EMPTY_DRAFT);
  const [notes, setNotes] = useState('');
  const [recorder, setRecorder] = useState(RECORDER_OPTIONS[0]);
  const [creating, setCreating] = useState(false);

  const updateField = (key: keyof DraftVitals, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    addVitals(appointmentId, {
      weightLbs: parseNumber(draft.weightLbs),
      tempF: parseNumber(draft.tempF),
      heartRateBpm: parseNumber(draft.heartRateBpm),
      respRateBpm: parseNumber(draft.respRateBpm),
      crtSec: draft.crtSec || undefined,
      mucousMembrane: draft.mucousMembrane || undefined,
      painScore: parseNumber(draft.painScore),
      bcs: parseNumber(draft.bcs),
      notes: notes || undefined,
      recordedByName: recorder.label,
      recordedAt: new Date().toISOString(),
    });
    setDraft(EMPTY_DRAFT);
    setNotes('');
    setCreating(false);
  };

  const handleDiscard = () => {
    setDraft(EMPTY_DRAFT);
    setNotes('');
    setCreating(false);
  };

  if (!creating) {
    return (
      <div className="flex flex-col gap-3">
        {vitals.length === 0 ? (
          <p className="py-6 text-center text-body-4 text-text-secondary">
            No vitals recorded yet.
          </p>
        ) : (
          <ul className="rounded-2xl border border-card-border px-4">
            {vitals.map((entry) => (
              <VitalRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
        <div>
          <Primary
            text="New Vital"
            icon={<span aria-hidden="true">+</span>}
            onClick={() => setCreating(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-body-2 font-bold text-text-primary">New vitals</h3>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <VitalsField
            key={field.key}
            field={field}
            value={draft[field.key]}
            onChange={(value) => updateField(field.key, value)}
          />
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-neutral-700">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Vitals notes"
          rows={3}
          className="rounded-2xl border border-input-border-default px-4 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
        />
      </label>
      <div className="w-full sm:max-w-60">
        <LabelDropdown
          placeholder="Recorded by"
          options={RECORDER_OPTIONS}
          defaultOption={recorder.value}
          searchable={false}
          onSelect={(option) => setRecorder({ label: option.label, value: option.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Primary text="Save vitals" icon={<LuCheck aria-hidden="true" />} onClick={handleSave} />
        <Secondary text="Discard" onClick={handleDiscard} />
      </div>
    </div>
  );
};

export default VitalsForm;
