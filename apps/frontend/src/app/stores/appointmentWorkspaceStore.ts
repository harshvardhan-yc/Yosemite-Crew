import { create } from 'zustand';
import type {
  AppointmentEncounter,
  DiagnosticOrder,
  EncounterMode,
  LineItem,
  ObservationRecord,
  PrescriptionItem,
  ScheduleTask,
  ScheduleTaskStatus,
  SideAction,
  SoapNoteEntry,
  SoapTemplate,
  Vitals,
  WorkspaceStep,
  InvoiceLineItem,
  WorkspaceDocument,
} from '@/app/features/appointments/types/workspace';
import { buildMockEncounter } from '@/app/features/appointments/services/workspaceMockData';

let idCounter = 0;
const nextId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

const nowIso = (): string => new Date().toISOString();

type ReadyActor = { id?: string; name?: string };

type AppointmentWorkspaceState = {
  encountersById: Record<string, AppointmentEncounter>;
  activeStep: WorkspaceStep;
  activeSideAction: SideAction | null;

  initEncounter: (appointmentId: string, mode: EncounterMode) => void;
  getEncounter: (appointmentId: string) => AppointmentEncounter | undefined;
  setEncounterMode: (appointmentId: string, mode: EncounterMode) => void;

  setActiveStep: (step: WorkspaceStep) => void;
  setActiveSideAction: (action: SideAction | null) => void;
  setStepStatus: (
    appointmentId: string,
    step: WorkspaceStep,
    status: AppointmentEncounter['stepStatus'][WorkspaceStep]
  ) => void;

  setLead: (appointmentId: string, id: string, name: string) => void;
  setNurse: (appointmentId: string, id: string, name: string) => void;
  setRoomUnit: (appointmentId: string, roomId?: string, unitId?: string) => void;

  upsertSoap: (appointmentId: string, patch: Partial<SoapNoteEntry>) => void;
  applySoapTemplate: (appointmentId: string, template: SoapTemplate) => void;
  signSoap: (appointmentId: string, signedByName: string, offline: boolean) => void;

  addVitals: (appointmentId: string, vitals: Omit<Vitals, 'id' | 'code'>) => void;
  addObservation: (appointmentId: string, record: Omit<ObservationRecord, 'id' | 'code'>) => void;

  removeDiagnosticTest: (appointmentId: string, id: string) => void;
  addDiagnosticOrder: (appointmentId: string, order?: Partial<DiagnosticOrder>) => void;

  addLineItem: (appointmentId: string, item: Omit<LineItem, 'id'>) => void;
  updateLineItem: (appointmentId: string, id: string, patch: Partial<LineItem>) => void;
  removeLineItem: (appointmentId: string, id: string) => void;

  addPrescription: (appointmentId: string, item: Omit<PrescriptionItem, 'id'>) => void;
  updatePrescription: (appointmentId: string, id: string, patch: Partial<PrescriptionItem>) => void;
  removePrescription: (appointmentId: string, id: string) => void;

  addScheduleTask: (appointmentId: string, task: Omit<ScheduleTask, 'id'>) => void;
  updateScheduleTask: (appointmentId: string, id: string, patch: Partial<ScheduleTask>) => void;
  setScheduleTaskStatus: (appointmentId: string, id: string, status: ScheduleTaskStatus) => void;

  setDischargeSummary: (appointmentId: string, html: string) => void;
  setFollowUp: (appointmentId: string, at: string | undefined) => void;
  addDocument: (appointmentId: string, document: Omit<WorkspaceDocument, 'id'>) => void;
  setWithdrawDeposit: (appointmentId: string, value: boolean) => void;
  addInvoiceLineItem: (appointmentId: string, item: Omit<InvoiceLineItem, 'id'>) => void;
  removeInvoiceLineItem: (appointmentId: string, id: string) => void;

  toggleReadyForBilling: (appointmentId: string, actor: ReadyActor) => void;
  toggleReadyForDischarge: (appointmentId: string, actor: ReadyActor) => void;
};

/** Update a single encounter immutably; no-op if it does not exist. */
const patchEncounter = (
  state: AppointmentWorkspaceState,
  appointmentId: string,
  updater: (encounter: AppointmentEncounter) => AppointmentEncounter
): Partial<AppointmentWorkspaceState> => {
  const current = state.encountersById[appointmentId];
  if (!current) return {};
  return {
    encountersById: { ...state.encountersById, [appointmentId]: updater(current) },
  };
};

export const useAppointmentWorkspaceStore = create<AppointmentWorkspaceState>((set, get) => ({
  encountersById: {},
  activeStep: 'SOAP',
  activeSideAction: null,

  initEncounter: (appointmentId, mode) =>
    set((state) => {
      if (state.encountersById[appointmentId]) return {};
      return {
        encountersById: {
          ...state.encountersById,
          [appointmentId]: buildMockEncounter(appointmentId, mode),
        },
      };
    }),

  getEncounter: (appointmentId) => get().encountersById[appointmentId],

  setEncounterMode: (appointmentId, mode) =>
    set((state) => {
      const current = state.encountersById[appointmentId];
      const modeDefaults = buildMockEncounter(appointmentId, mode);
      if (!current) {
        return {
          encountersById: {
            ...state.encountersById,
            [appointmentId]: modeDefaults,
          },
        };
      }

      const inpatientPatch = {
        schedule: current.schedule.length > 0 ? current.schedule : modeDefaults.schedule,
        roomId: current.roomId ?? modeDefaults.roomId,
        unitId: current.unitId ?? modeDefaults.unitId,
      };
      const outpatientPatch = {
        schedule: [],
        roomId: undefined,
        unitId: undefined,
      };

      return {
        encountersById: {
          ...state.encountersById,
          [appointmentId]: {
            ...current,
            mode,
            consultationType: modeDefaults.consultationType,
            ...(mode === 'INPATIENT' ? inpatientPatch : outpatientPatch),
          },
        },
      };
    }),

  setActiveStep: (step) => set({ activeStep: step }),
  setActiveSideAction: (action) => set({ activeSideAction: action }),

  setStepStatus: (appointmentId, step, status) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        stepStatus: { ...enc.stepStatus, [step]: status },
      }))
    ),

  setLead: (appointmentId, id, name) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({ ...enc, leadId: id, leadName: name }))
    ),

  setNurse: (appointmentId, id, name) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({ ...enc, nurseId: id, nurseName: name }))
    ),

  setRoomUnit: (appointmentId, roomId, unitId) =>
    set((state) => patchEncounter(state, appointmentId, (enc) => ({ ...enc, roomId, unitId }))),

  upsertSoap: (appointmentId, patch) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const existing = enc.soap[0];
        if (existing) {
          const updated = { ...existing, ...patch };
          return { ...enc, soap: [updated, ...enc.soap.slice(1)] };
        }
        const created: SoapNoteEntry = {
          id: nextId('soap'),
          chiefComplaint: '',
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          status: 'IN_PROGRESS',
          createdAt: nowIso(),
          ...patch,
        };
        return { ...enc, soap: [created] };
      })
    ),

  applySoapTemplate: (appointmentId, template) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const existing = enc.soap[0];
        const base: SoapNoteEntry = existing ?? {
          id: nextId('soap'),
          chiefComplaint: '',
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          status: 'IN_PROGRESS',
          createdAt: nowIso(),
        };
        const withTemplate = { ...base, templateId: template.id };
        return { ...enc, soap: [withTemplate, ...enc.soap.slice(existing ? 1 : 0)] };
      })
    ),

  signSoap: (appointmentId, signedByName, offline) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const existing = enc.soap[0];
        if (!existing) return enc;
        const signed: SoapNoteEntry = {
          ...existing,
          signedByName,
          signedOffline: offline,
          signedAt: nowIso(),
          status: 'COMPLETED',
        };
        return {
          ...enc,
          soap: [signed, ...enc.soap.slice(1)],
          stepStatus: { ...enc.stepStatus, SOAP: 'COMPLETED' },
        };
      })
    ),

  addVitals: (appointmentId, vitals) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        vitals: [
          {
            ...vitals,
            id: nextId('vt'),
            code: `VT-${String(enc.vitals.length + 1).padStart(3, '0')}`,
          },
          ...enc.vitals,
        ],
      }))
    ),

  addObservation: (appointmentId, record) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        observations: [
          {
            ...record,
            id: nextId('ot'),
            code: `OT-${String(enc.observations.length + 1).padStart(3, '0')}`,
          },
          ...enc.observations,
        ],
      }))
    ),

  removeDiagnosticTest: (appointmentId, id) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        diagnosticTests: enc.diagnosticTests.filter((test) => test.id !== id),
      }))
    ),

  addDiagnosticOrder: (appointmentId, order) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        diagnosticOrders: [
          {
            id: nextId('dx-order'),
            orderCode: order?.orderCode ?? '100355709',
            createdAt: order?.createdAt ?? nowIso(),
            status: order?.status ?? 'CREATED',
            results: order?.results,
          },
          ...enc.diagnosticOrders,
        ],
        stepStatus: { ...enc.stepStatus, DIAGNOSTICS: 'IN_PROGRESS' },
      }))
    ),

  addLineItem: (appointmentId, item) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const lineItem = { ...item, id: nextId('li') };
        const generatedTask: ScheduleTask = {
          id: nextId('sch'),
          description: `${item.kind === 'PACKAGE' ? 'Complete package' : 'Complete service'}: ${item.name}`,
          category: item.kind === 'PACKAGE' ? 'Treatment' : 'Consultation (billable)',
          status: 'UPCOMING',
          autoGenerated: true,
          sourceRefId: lineItem.id,
        };
        return {
          ...enc,
          services: [...enc.services, lineItem],
          schedule: enc.mode === 'INPATIENT' ? [...enc.schedule, generatedTask] : enc.schedule,
        };
      })
    ),

  updateLineItem: (appointmentId, id, patch) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        services: enc.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }))
    ),

  removeLineItem: (appointmentId, id) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        services: enc.services.filter((s) => s.id !== id),
      }))
    ),

  addPrescription: (appointmentId, item) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const prescription = { ...item, id: nextId('rx') };
        const generatedTask: ScheduleTask = {
          id: nextId('sch'),
          description: `Administer ${item.medicineName}`,
          category: 'Medication',
          status: 'UPCOMING',
          autoGenerated: true,
          sourceRefId: prescription.id,
        };
        return {
          ...enc,
          prescription: [...enc.prescription, prescription],
          schedule: enc.mode === 'INPATIENT' ? [...enc.schedule, generatedTask] : enc.schedule,
        };
      })
    ),

  updatePrescription: (appointmentId, id, patch) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        prescription: enc.prescription.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    ),

  removePrescription: (appointmentId, id) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        prescription: enc.prescription.filter((p) => p.id !== id),
      }))
    ),

  addScheduleTask: (appointmentId, task) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        schedule: [...enc.schedule, { ...task, id: nextId('sch') }],
      }))
    ),

  updateScheduleTask: (appointmentId, id, patch) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        schedule: enc.schedule.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }))
    ),

  setScheduleTaskStatus: (appointmentId, id, status) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        schedule: enc.schedule.map((t) => (t.id === id ? { ...t, status } : t)),
      }))
    ),

  setDischargeSummary: (appointmentId, html) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({ ...enc, dischargeSummary: html }))
    ),

  setFollowUp: (appointmentId, at) =>
    set((state) => patchEncounter(state, appointmentId, (enc) => ({ ...enc, followUpAt: at }))),

  addDocument: (appointmentId, document) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        documents: [{ ...document, id: nextId('doc') }, ...enc.documents],
      }))
    ),

  setWithdrawDeposit: (appointmentId, value) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({ ...enc, withdrawDeposit: value }))
    ),

  addInvoiceLineItem: (appointmentId, item) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        invoiceLineItems: [...enc.invoiceLineItems, { ...item, id: nextId('inv') }],
      }))
    ),

  removeInvoiceLineItem: (appointmentId, id) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        invoiceLineItems: enc.invoiceLineItems.filter((item) => item.id !== id),
      }))
    ),

  toggleReadyForBilling: (appointmentId, actor) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const value = !enc.readyForBilling.value;
        return {
          ...enc,
          readyForBilling: value
            ? { value: true, byUserId: actor.id, byName: actor.name, at: nowIso() }
            : { value: false },
        };
      })
    ),

  toggleReadyForDischarge: (appointmentId, actor) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const value = !enc.readyForDischarge.value;
        return {
          ...enc,
          readyForDischarge: value
            ? { value: true, byUserId: actor.id, byName: actor.name, at: nowIso() }
            : { value: false },
        };
      })
    ),
}));
