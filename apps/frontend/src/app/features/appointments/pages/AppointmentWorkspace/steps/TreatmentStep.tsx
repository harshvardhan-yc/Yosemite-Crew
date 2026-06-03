import React from 'react';
import { LuArrowRight, LuPrinter, LuSave } from 'react-icons/lu';
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
  onSkipToSummary: () => void;
};

/**
 * Treatment step: services/packages, prescription, and inpatient schedule.
 * Mock-backed mutations mirror the backend contracts already represented in
 * the workspace store; real service/inventory APIs can replace the add sources
 * without changing the screen structure.
 */
const TreatmentStep = ({
  appointmentId,
  encounter,
  onOpenInvoice,
  onSkipToSummary,
}: TreatmentStepProps) => {
  const addLineItem = useAppointmentWorkspaceStore((s) => s.addLineItem);
  const removeLineItem = useAppointmentWorkspaceStore((s) => s.removeLineItem);
  const addPrescription = useAppointmentWorkspaceStore((s) => s.addPrescription);
  const updatePrescription = useAppointmentWorkspaceStore((s) => s.updatePrescription);
  const removePrescription = useAppointmentWorkspaceStore((s) => s.removePrescription);
  const addScheduleTask = useAppointmentWorkspaceStore((s) => s.addScheduleTask);
  const updateScheduleTask = useAppointmentWorkspaceStore((s) => s.updateScheduleTask);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const readOnly = encounter.viewOnly;
  const isInpatient = encounter.mode === 'INPATIENT';

  const handleSaveTreatment = () => {
    setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
    onOpenInvoice();
  };

  const handlePrint = () => {
    globalThis.window.print();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Secondary
          text="Skip to Summary"
          icon={<LuArrowRight aria-hidden="true" />}
          iconPosition="right"
          onClick={() => {
            setStepStatus(appointmentId, 'TREATMENT', 'COMPLETED');
            onSkipToSummary();
          }}
        />
      </div>

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
        onAddItem={(item) => addLineItem(appointmentId, item)}
        onRemoveItem={(id) => removeLineItem(appointmentId, id)}
      />

      <PrescriptionEditor
        items={encounter.prescription}
        readOnly={readOnly}
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
