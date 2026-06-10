import React from 'react';
import { LuPrinter, LuSave } from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import ServicesPackagesEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/ServicesPackagesEditor';
import PrescriptionEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/PrescriptionEditor';
import InpatientSchedule from '@/app/features/appointments/pages/AppointmentWorkspace/components/InpatientSchedule';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

type TreatmentStepProps = {
  appointmentId: string;
  encounter: AppointmentEncounter;
  onOpenInvoice: () => void;
};

const handlePrint = () => {
  globalThis.window.print();
};

/**
 * Treatment step: services/packages, prescription, and inpatient schedule.
 * Mock-backed mutations mirror the backend contracts already represented in
 * the workspace store; real service/inventory APIs can replace the add sources
 * without changing the screen structure. "Skip to Summary" lives in the meta bar.
 */
const TreatmentStep = ({ appointmentId, encounter, onOpenInvoice }: TreatmentStepProps) => {
  const addLineItem = useAppointmentWorkspaceStore((s) => s.addLineItem);
  const updateLineItem = useAppointmentWorkspaceStore((s) => s.updateLineItem);
  const removeLineItem = useAppointmentWorkspaceStore((s) => s.removeLineItem);
  const addPrescription = useAppointmentWorkspaceStore((s) => s.addPrescription);
  const updatePrescription = useAppointmentWorkspaceStore((s) => s.updatePrescription);
  const removePrescription = useAppointmentWorkspaceStore((s) => s.removePrescription);
  const addScheduleTask = useAppointmentWorkspaceStore((s) => s.addScheduleTask);
  const updateScheduleTask = useAppointmentWorkspaceStore((s) => s.updateScheduleTask);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const readOnly = encounter.viewOnly;
  // Once the encounter is ready for billing, destructive removal of un-billed
  // items is locked. Already-billed items lock per-row inside each editor (read
  // -only + "Billed" badge + no delete); adding new items always stays allowed.
  const billedTreatmentLocked = readOnly || encounter.readyForBilling.value;
  const isInpatient = encounter.mode === 'INPATIENT';

  const handleSaveTreatment = () => {
    setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
    onOpenInvoice();
  };

  return (
    <div className="flex flex-col gap-5">
      {isInpatient && (
        <InpatientSchedule
          tasks={encounter.schedule}
          readOnly={readOnly}
          onAddTask={(task) => addScheduleTask(appointmentId, task)}
          onUpdateTask={(id, patch) => updateScheduleTask(appointmentId, id, patch)}
        />
      )}

      <ServicesPackagesEditor
        items={encounter.services}
        readOnly={readOnly}
        deleteLocked={billedTreatmentLocked}
        onAddItem={(item) => addLineItem(appointmentId, item)}
        onUpdateItem={(id, patch) => updateLineItem(appointmentId, id, patch)}
        onRemoveItem={(id) => removeLineItem(appointmentId, id)}
      />

      <PrescriptionEditor
        items={encounter.prescription}
        readOnly={readOnly}
        deleteLocked={billedTreatmentLocked}
        onAddItem={(item) => addPrescription(appointmentId, item)}
        onUpdateItem={(id, patch) => updatePrescription(appointmentId, id, patch)}
        onRemoveItem={(id) => removePrescription(appointmentId, id)}
        onPrint={handlePrint}
      />

      <div className="flex flex-wrap justify-between gap-3">
        <Secondary
          text="Prescription"
          icon={<LuPrinter aria-hidden="true" />}
          onClick={handlePrint}
        />
        <Primary
          text="Save treatment"
          icon={<LuSave aria-hidden="true" />}
          onClick={handleSaveTreatment}
          isDisabled={readOnly}
        />
      </div>
    </div>
  );
};

export default TreatmentStep;
