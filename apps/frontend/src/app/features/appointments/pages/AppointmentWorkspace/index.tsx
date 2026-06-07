'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Appointment } from '@yosemite-crew/types';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useAuthStore } from '@/app/stores/authStore';
import {
  buildWorkspaceHref,
  isPastLockWindow,
  resolveEncounterMode,
  resolveLandingStep,
} from '@/app/lib/appointmentWorkspace';
import {
  type RoomUnit,
  WORKSPACE_STEPS,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import { resolveLockHours } from '@/app/lib/appointmentLockWindow';
import { useAppointmentLockWindow } from '@/app/hooks/useAppointmentLockWindow';
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useLoadCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useCompanionStore } from '@/app/stores/companionStore';
import { buildCompanionDetails } from '@/app/lib/companionWorkspaceDetails';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import WorkspaceHeader from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceHeader';
import AddAlertModal from '@/app/features/appointments/pages/AppointmentWorkspace/components/AddAlertModal';
import CompanionContextCard from '@/app/features/appointments/pages/AppointmentWorkspace/CompanionContextCard';
import WorkspaceStepper from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceStepper';
import WorkspaceMetaBar from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceMetaBar';
import SoapStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SoapStep';
import DiagnosticsStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/DiagnosticsStep';
import TreatmentStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep';
import InvoiceStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import QuickActionsModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/QuickActionsModal';
import { getNextStep } from '@/app/lib/appointmentWorkspace';

type AppointmentWorkspaceProps = {
  appointment: Appointment;
};

type WorkspaceRoom = {
  id: string;
  name: string;
  unitCount?: number;
  units?: RoomUnit[];
};

const buildGeneratedUnits = (count: number): RoomUnit[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `unit-${index + 1}`,
    name: `${index + 1}`,
    occupied: false,
  }));

const getRoomUnits = (room?: WorkspaceRoom): RoomUnit[] => {
  if (!room) return [];
  if (room.units?.length) return room.units;
  return buildGeneratedUnits(room.unitCount ?? 0);
};

const isValidStep = (value: string | null): value is WorkspaceStep =>
  value != null && (WORKSPACE_STEPS as string[]).includes(value);

const resolveAppointmentReason = (appointment: Appointment): string =>
  appointment.concern?.trim() || 'No appointment reason recorded.';

/**
 * Full-page clinical workspace shell. Hosts the header, companion card, stepper,
 * meta bar, and the active step. Step bodies are layered in per phase.
 */
const AppointmentWorkspace = ({ appointment }: AppointmentWorkspaceProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attributes = useAuthStore((s) => s.attributes);
  useLoadRoomsForPrimaryOrg();
  useLoadCompanionsForPrimaryOrg();
  const rooms = useRoomsForPrimaryOrg() as WorkspaceRoom[];
  const companionRecord = useCompanionStore((s) => s.companionsById[appointment.companion.id]);

  const appointmentId = appointment.id ?? '';
  const initialMode = useMemo(() => resolveEncounterMode(appointment), [appointment]);
  const appointmentReason = useMemo(() => resolveAppointmentReason(appointment), [appointment]);

  const initEncounter = useAppointmentWorkspaceStore((s) => s.initEncounter);
  const encounter = useAppointmentWorkspaceStore((s) => s.encountersById[appointmentId]);
  const activeStep = useAppointmentWorkspaceStore((s) => s.activeStep);
  const setActiveStep = useAppointmentWorkspaceStore((s) => s.setActiveStep);
  const activeSideAction = useAppointmentWorkspaceStore((s) => s.activeSideAction);
  const setActiveSideAction = useAppointmentWorkspaceStore((s) => s.setActiveSideAction);
  const setEncounterMode = useAppointmentWorkspaceStore((s) => s.setEncounterMode);
  const setRoomUnit = useAppointmentWorkspaceStore((s) => s.setRoomUnit);
  const toggleReadyForBilling = useAppointmentWorkspaceStore((s) => s.toggleReadyForBilling);
  const toggleReadyForDischarge = useAppointmentWorkspaceStore((s) => s.toggleReadyForDischarge);
  const addAlert = useAppointmentWorkspaceStore((s) => s.addAlert);
  const [isAddAlertOpen, setIsAddAlertOpen] = useState(false);

  useEffect(() => {
    if (appointmentId) initEncounter(appointmentId, initialMode);
  }, [appointmentId, initialMode, initEncounter]);

  const encounterMode = encounter?.mode ?? initialMode;
  const lockWindow = useAppointmentLockWindow();

  const lockedByWindow = useMemo(
    () =>
      isPastLockWindow(
        appointment.startTime,
        encounterMode,
        Date.now(),
        resolveLockHours(encounterMode, lockWindow)
      ),
    [appointment.startTime, encounterMode, lockWindow]
  );

  // Land on the step from the URL, else the status-driven landing step — once
  // per appointment. A ref guards against re-running when the encounter mutates.
  const landedForRef = useRef<string | null>(null);
  const stepParam = searchParams.get('step');
  useEffect(() => {
    if (!encounter || landedForRef.current === encounter.appointmentId) return;
    landedForRef.current = encounter.appointmentId;
    const landingEncounter = {
      ...encounter,
      viewOnly: encounter.viewOnly || encounter.readyForDischarge.value || lockedByWindow,
    };
    setActiveStep(isValidStep(stepParam) ? stepParam : resolveLandingStep(landingEncounter));
  }, [encounter, lockedByWindow, stepParam, setActiveStep]);

  const companionDetails = useMemo(
    () =>
      buildCompanionDetails(
        {
          id: appointment.companion.id,
          name: appointment.companion.name,
          species: appointment.companion.species,
          breed: appointment.companion.breed,
        },
        companionRecord
      ),
    [appointment.companion, companionRecord]
  );
  const effectiveEncounter = useMemo(
    () =>
      encounter
        ? {
            ...encounter,
            viewOnly: encounter.viewOnly || encounter.readyForDischarge.value || lockedByWindow,
          }
        : undefined,
    [encounter, lockedByWindow]
  );

  const actor = useMemo(() => {
    const first = attributes?.given_name ?? '';
    const last = attributes?.family_name ?? '';
    const name = `${first} ${last}`.trim();
    return { id: attributes?.sub, name: name || 'You' };
  }, [attributes]);
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === effectiveEncounter?.roomId),
    [effectiveEncounter?.roomId, rooms]
  );
  const roomOptions = useMemo(() => {
    if (rooms.length) return rooms.map((room) => ({ label: room.name, value: room.id }));
    return effectiveEncounter?.roomId
      ? [{ label: 'Room 1', value: effectiveEncounter.roomId }]
      : [];
  }, [effectiveEncounter?.roomId, rooms]);
  const unitOptions = useMemo(() => {
    const units = getRoomUnits(selectedRoom);
    if (units.length) return units.map((unit) => ({ label: unit.name, value: unit.id }));
    return effectiveEncounter?.unitId ? [{ label: '24', value: effectiveEncounter.unitId }] : [];
  }, [effectiveEncounter?.unitId, selectedRoom]);

  const handleStepChange = useCallback(
    (step: WorkspaceStep) => {
      setActiveStep(step);
      router.replace(buildWorkspaceHref(appointmentId, step), { scroll: false });
    },
    [appointmentId, router, setActiveStep]
  );

  const handleSaveAndNext = useCallback(() => {
    const next = getNextStep(activeStep);
    if (next) handleStepChange(next);
  }, [activeStep, handleStepChange]);

  const treatmentPrimaryCta = useMemo(
    () =>
      activeStep === 'TREATMENT'
        ? { label: 'Skip to Summary', onClick: () => handleStepChange('SUMMARY') }
        : undefined,
    [activeStep, handleStepChange]
  );

  if (!effectiveEncounter) return null;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="-mx-4 -mt-5 flex flex-col gap-5 bg-(--status-in-progress-bg) px-4 pt-5 pb-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <WorkspaceHeader
          appointment={appointment}
          companionName={appointment.companion.name}
          alerts={effectiveEncounter.alerts}
          onBack={() => router.push('/appointments')}
          onQuickActions={() => setActiveSideAction('RECORD')}
          onAddAlert={() => setIsAddAlertOpen(true)}
        />

        <CompanionContextCard
          name={appointment.companion.name}
          photoUrl={companionRecord?.photoUrl}
          speciesType={companionRecord?.type ?? appointment.companion.species}
          details={companionDetails}
          mode={encounterMode}
          onViewDetails={() =>
            router.push(
              buildAppointmentCompanionHistoryHref(appointmentId, appointment.companion.id)
            )
          }
        />

        <WorkspaceStepper
          activeStep={activeStep}
          stepStatus={effectiveEncounter.stepStatus}
          onStepChange={handleStepChange}
        />
      </div>

      <WorkspaceMetaBar
        encounter={effectiveEncounter}
        activeStep={activeStep}
        roomOptions={roomOptions}
        unitOptions={unitOptions}
        onSelectRoom={(o) => {
          const nextRoom = rooms.find((room) => room.id === o.value);
          const nextUnit = getRoomUnits(nextRoom)[0]?.id;
          setRoomUnit(appointmentId, o.value, nextUnit);
        }}
        onSelectUnit={(o) => setRoomUnit(appointmentId, effectiveEncounter.roomId, o.value)}
        onSelectEncounterMode={(nextMode) => setEncounterMode(appointmentId, nextMode)}
        onSaveAndNext={handleSaveAndNext}
        onToggleReadyForBilling={() => toggleReadyForBilling(appointmentId, actor)}
        onToggleReadyForDischarge={() => toggleReadyForDischarge(appointmentId, actor)}
        togglesLocked={(encounter?.viewOnly ?? false) || lockedByWindow}
        primaryCta={treatmentPrimaryCta}
      />

      <section aria-label="Workspace step content" className="min-h-50">
        {activeStep === 'SOAP' && (
          <SoapStep
            appointmentId={appointmentId}
            appointmentReason={appointmentReason}
            encounter={effectiveEncounter}
            onRecordVitals={() => setActiveSideAction('RECORD')}
            onSaveAndNext={handleSaveAndNext}
          />
        )}
        {activeStep === 'DIAGNOSTICS' && (
          <DiagnosticsStep
            appointment={appointment}
            onOpenTreatment={() => handleStepChange('TREATMENT')}
          />
        )}
        {activeStep === 'TREATMENT' && (
          <TreatmentStep
            appointmentId={appointmentId}
            encounter={effectiveEncounter}
            onOpenInvoice={() => handleStepChange('INVOICE')}
          />
        )}
        {activeStep === 'INVOICE' && (
          <InvoiceStep
            appointmentId={appointmentId}
            encounter={effectiveEncounter}
            onOpenSummary={() => handleStepChange('SUMMARY')}
          />
        )}
        {activeStep === 'SUMMARY' && (
          <SummaryStep
            appointmentId={appointmentId}
            appointment={appointment}
            encounter={effectiveEncounter}
          />
        )}
      </section>

      <QuickActionsModal
        appointment={appointment}
        appointmentId={appointmentId}
        activeAction={activeSideAction}
        onChangeAction={setActiveSideAction}
        onClose={() => setActiveSideAction(null)}
      />

      <AddAlertModal
        open={isAddAlertOpen}
        companionName={appointment.companion.name}
        onClose={() => setIsAddAlertOpen(false)}
        onAdd={(alert) => addAlert(appointmentId, alert)}
      />
    </div>
  );
};

export default AppointmentWorkspace;
