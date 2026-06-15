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
import { WORKSPACE_STEPS, type WorkspaceStep } from '@/app/features/appointments/types/workspace';
import { resolveLockHours } from '@/app/lib/appointmentLockWindow';
import { normalizeAppointmentStatus } from '@/app/lib/appointments';
import { useAppointmentLockWindow } from '@/app/hooks/useAppointmentLockWindow';
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useLoadCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
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
import HospitalizationModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/HospitalizationModal';
import { getNextStep } from '@/app/lib/appointmentWorkspace';
import {
  assignEncounterUnit,
  markEncounterReadyForDischarge,
  undoEncounterReadyForDischarge,
} from '@/app/features/appointments/services/appointmentService';

type AppointmentWorkspaceProps = {
  appointment: Appointment;
};

type WorkspaceRoom = {
  id: string;
  name: string;
};

const getRoomUnits = (
  roomId: string | undefined,
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'],
  roomUnitIdsByRoomId: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitIdsByRoomId']
) => {
  if (!roomId) return [];
  return (roomUnitIdsByRoomId[roomId] ?? [])
    .map((unitId) => roomUnitsById[unitId])
    .filter((unit) => unit?.isActive !== false);
};

const isValidStep = (value: string | null): value is WorkspaceStep =>
  value != null && (WORKSPACE_STEPS as string[]).includes(value);

/** Selectable add-on packages for the hospitalization flow (mock-backed, mirrors
 *  the service/package catalogue the backend will supply). */
const HOSPITALIZATION_SERVICE_PACKAGES = [
  { id: 'pkg-cardio', name: 'Cardio assessment package', cost: 150, maxDiscount: 25 },
  { id: 'pkg-ortho', name: 'Orthopedic care package', cost: 220, maxDiscount: 30 },
  { id: 'pkg-observation', name: '24h observation package', cost: 90, maxDiscount: 10 },
];

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
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((s) => s.roomUnitIdsByRoomId);
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
  const [isHospitalizeOpen, setIsHospitalizeOpen] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    const leadName = (appointment.lead?.name ?? '').trim();
    const supportMember = (appointment.supportStaff ?? []).find(
      (staff) => (staff.name ?? '').trim() && staff.name?.trim() !== leadName
    );
    initEncounter(appointmentId, initialMode, {
      leadId: appointment.lead?.id,
      leadName,
      nurseId: supportMember?.id,
      nurseName: supportMember?.name?.trim(),
    });
  }, [appointmentId, initialMode, initEncounter, appointment.lead, appointment.supportStaff]);

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
  // Clinical encounter — the time-based "Appointment lock window" freezes the
  // legal record (SOAP + Discharge/Summary). This is what the lock exists for.
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
  // Operational encounter — billing (Invoice, Services & Packages) and lab
  // orders (Diagnostics) are NOT frozen by the clinical time window. Industry
  // standard gates these on their own state (invoice finalized/paid,
  // readyForBilling, order/result status), not on a wall-clock timer.
  const operationalEncounter = useMemo(
    () =>
      encounter
        ? {
            ...encounter,
            viewOnly: encounter.viewOnly || encounter.readyForDischarge.value,
          }
        : undefined,
    [encounter]
  );
  const isCompletedAppointment = normalizeAppointmentStatus(appointment.status) === 'COMPLETED';

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
  const selectedRoomUnits = useMemo(
    () => getRoomUnits(selectedRoom?.id, roomUnitsById, roomUnitIdsByRoomId),
    [roomUnitIdsByRoomId, roomUnitsById, selectedRoom?.id]
  );
  const roomOptions = useMemo(() => {
    if (rooms.length) return rooms.map((room) => ({ label: room.name, value: room.id }));
    return effectiveEncounter?.roomId
      ? [{ label: 'Room 1', value: effectiveEncounter.roomId }]
      : [];
  }, [effectiveEncounter?.roomId, rooms]);
  const unitOptions = useMemo(() => {
    if (selectedRoomUnits.length) {
      return selectedRoomUnits.map((unit) => ({
        label: unit.displayName || unit.code,
        value: unit.id,
      }));
    }
    return effectiveEncounter?.unitId
      ? [{ label: effectiveEncounter.unitId, value: effectiveEncounter.unitId }]
      : [];
  }, [effectiveEncounter?.unitId, selectedRoomUnits]);
  const supportOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    const add = (name?: string) => {
      const trimmed = (name ?? '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ label: trimmed, value: trimmed });
    };
    add(appointment.lead?.name);
    (appointment.supportStaff ?? []).forEach((staff) => add(staff.name));
    return options;
  }, [appointment.lead?.name, appointment.supportStaff]);

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

  const persistUnitAssignment = useCallback(
    async (unitId?: string) => {
      if (!appointment.encounterId || !unitId) return;
      try {
        await assignEncounterUnit({
          encounterId: appointment.encounterId,
          unitId,
          assignedBy: actor.name,
          reason: 'Workspace room assignment',
        });
      } catch (error) {
        console.error('Unable to persist encounter unit assignment:', error);
      }
    },
    [actor.name, appointment.encounterId]
  );

  const handleRoomSelect = useCallback(
    async (option: { value: string }) => {
      const nextUnit = getRoomUnits(option.value, roomUnitsById, roomUnitIdsByRoomId)[0]?.id;
      setRoomUnit(appointmentId, option.value, nextUnit);
      await persistUnitAssignment(nextUnit);
    },
    [appointmentId, persistUnitAssignment, roomUnitIdsByRoomId, roomUnitsById, setRoomUnit]
  );

  const handleUnitSelect = useCallback(
    async (option: { value: string }) => {
      setRoomUnit(appointmentId, effectiveEncounter?.roomId, option.value);
      await persistUnitAssignment(option.value);
    },
    [appointmentId, effectiveEncounter?.roomId, persistUnitAssignment, setRoomUnit]
  );

  const handleReadyForDischargeToggle = useCallback(async () => {
    const nextReady = !(encounter?.readyForDischarge.value ?? false);
    if (appointment.encounterId) {
      if (nextReady) {
        await markEncounterReadyForDischarge(appointment.encounterId);
      } else {
        await undoEncounterReadyForDischarge(appointment.encounterId);
      }
    }
    toggleReadyForDischarge(appointmentId, actor);
  }, [
    actor,
    appointment.encounterId,
    appointmentId,
    encounter?.readyForDischarge.value,
    toggleReadyForDischarge,
  ]);

  useEffect(() => {
    if (!appointmentId || !encounter || encounter.roomId || !appointment.room?.id) return;
    const firstUnit = getRoomUnits(appointment.room.id, roomUnitsById, roomUnitIdsByRoomId)[0]?.id;
    setRoomUnit(appointmentId, appointment.room.id, firstUnit);
  }, [
    appointment.room?.id,
    appointmentId,
    encounter,
    roomUnitIdsByRoomId,
    roomUnitsById,
    setRoomUnit,
  ]);

  useEffect(() => {
    // Reset to the very top of the page on appointment/step change. The colored
    // header band uses a negative top margin, so scrollIntoView on the wrapper
    // lands a little below the true start — scroll the actual containers to 0.
    const mainContent = document.getElementById('main-content');
    mainContent?.scrollTo({ top: 0, behavior: 'auto' });
    globalThis.window?.scrollTo({ top: 0, behavior: 'auto' });
  }, [appointmentId, activeStep]);

  const treatmentPrimaryCta = useMemo(
    () =>
      activeStep === 'TREATMENT'
        ? { label: 'Skip to Summary', onClick: () => handleStepChange('SUMMARY') }
        : undefined,
    [activeStep, handleStepChange]
  );

  if (!effectiveEncounter || !operationalEncounter) return null;

  return (
    <div className="flex flex-col gap-5 pb-12">
      <div className="-mx-4 -mt-5 flex flex-col gap-5 bg-(--status-in-progress-bg) px-4 pt-5 pb-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <WorkspaceHeader
          appointment={appointment}
          companionName={appointment.companion.name}
          alerts={effectiveEncounter.alerts}
          onBack={() => router.push('/appointments')}
          onQuickActions={() => setActiveSideAction('RECORD')}
          onHospitalize={() => setIsHospitalizeOpen(true)}
          canHospitalize={encounterMode !== 'INPATIENT'}
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
        onSelectRoom={handleRoomSelect}
        onSelectUnit={handleUnitSelect}
        onSaveAndNext={handleSaveAndNext}
        onToggleReadyForBilling={() => toggleReadyForBilling(appointmentId, actor)}
        onToggleReadyForDischarge={handleReadyForDischargeToggle}
        billingTogglesLocked={encounter?.viewOnly ?? false}
        dischargeTogglesLocked={(encounter?.viewOnly ?? false) || lockedByWindow}
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
            readOnly={operationalEncounter.viewOnly}
            onOpenTreatment={() => handleStepChange('TREATMENT')}
          />
        )}
        {activeStep === 'TREATMENT' && (
          <TreatmentStep
            appointmentId={appointmentId}
            encounter={operationalEncounter}
            onOpenInvoice={() => handleStepChange('INVOICE')}
          />
        )}
        {activeStep === 'INVOICE' && (
          <InvoiceStep
            appointmentId={appointmentId}
            encounter={operationalEncounter}
            hideBillBuilder={isCompletedAppointment}
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

      <HospitalizationModal
        showModal={isHospitalizeOpen}
        setShowModal={setIsHospitalizeOpen}
        leadName={effectiveEncounter.leadName}
        supportName={effectiveEncounter.nurseName}
        supportOptions={supportOptions}
        roomOptions={roomOptions}
        unitOptions={unitOptions}
        servicePackages={HOSPITALIZATION_SERVICE_PACKAGES}
        defaultRoomId={effectiveEncounter.roomId}
        defaultUnitId={effectiveEncounter.unitId}
        onConvert={(payload) => {
          setEncounterMode(appointmentId, 'INPATIENT');
          if (payload.roomId) {
            setRoomUnit(appointmentId, payload.roomId, payload.unitId);
            return persistUnitAssignment(payload.unitId);
          }
          return undefined;
        }}
      />
    </div>
  );
};

export default AppointmentWorkspace;
