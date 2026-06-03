'use client';
import React, { useState } from 'react';
import { LuArrowRight, LuEye, LuEyeOff } from 'react-icons/lu';
import { Primary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { OBSERVATION_TOOLS } from '@/app/features/appointments/services/workspaceMockData';
import type { ObservationRecord } from '@/app/features/appointments/types/workspace';
import { formatStampDate } from '@/app/lib/appointmentWorkspace';

type ObservationToolFormProps = {
  appointmentId: string;
  observations: ObservationRecord[];
};

const ObservationRow = ({ entry }: { entry: ObservationRecord }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 border-b border-card-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col leading-[120%]">
          <span className="text-[12px] font-medium text-pill-success-text">
            {formatStampDate(entry.recordedAt)}
          </span>
          <span className="text-body-4 font-medium text-text-primary">{entry.toolName}</span>
          <span className="text-[12px] text-text-secondary">{entry.code}</span>
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
        <div className="rounded-2xl border border-card-border p-3 text-body-4 text-text-primary">
          {entry.total != null && <p className="font-medium">Total score: {entry.total}</p>}
          {Object.entries(entry.scores).map(([key, value]) => (
            <p key={key} className="flex justify-between gap-3">
              <span className="text-text-secondary">{key}</span>
              <span>{value}</span>
            </p>
          ))}
        </div>
      )}
    </li>
  );
};

/**
 * Observation Tool tab: choose a scoring tool (FGS / CSU-CAP), read its intro,
 * Start to score (mock auto-score), and review recorded observations.
 */
const ObservationToolForm = ({ appointmentId, observations }: ObservationToolFormProps) => {
  const addObservation = useAppointmentWorkspaceStore((s) => s.addObservation);
  const [activeToolKey, setActiveToolKey] = useState(OBSERVATION_TOOLS[0]?.key ?? 'FGS');

  const activeTool =
    OBSERVATION_TOOLS.find((tool) => tool.key === activeToolKey) ?? OBSERVATION_TOOLS[0];

  const handleStart = () => {
    if (!activeTool) return;
    // Mock scoring — a real run opens the scoring wizard; here we record a stub.
    addObservation(appointmentId, {
      toolKey: activeTool.key,
      toolName: activeTool.name,
      scores: { 'Pain expression': 1, Posture: 1, Activity: 0 },
      total: 2,
      recordedByName: 'Sarah Mitchell',
      recordedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {OBSERVATION_TOOLS.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {OBSERVATION_TOOLS.map((tool) => (
            <button
              key={tool.key}
              type="button"
              aria-pressed={tool.key === activeToolKey}
              onClick={() => setActiveToolKey(tool.key)}
              className={`rounded-2xl border px-3 py-1.5 text-body-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand ${
                tool.key === activeToolKey
                  ? 'border-text-brand bg-primary-100 text-text-brand'
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {tool.name}
            </button>
          ))}
        </div>
      )}

      {activeTool && (
        <div className="flex flex-col gap-3">
          <h3 className="text-body-2 font-bold text-text-primary">{activeTool.name}</h3>
          <p className="text-body-4 leading-[150%] text-text-secondary">{activeTool.intro}</p>
          <div>
            <Primary
              text="Start"
              icon={<LuArrowRight aria-hidden="true" />}
              iconPosition="right"
              onClick={handleStart}
            />
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <ul className="rounded-2xl border border-card-border px-4">
          {observations.map((entry) => (
            <ObservationRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default ObservationToolForm;
