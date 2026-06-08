import { create } from 'zustand';
import type {
  AppointmentEncounter,
  CompanionAlert,
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
  PastInvoice,
  PaymentMethod,
  WorkspaceDocument,
} from '@/app/features/appointments/types/workspace';
import { buildMockEncounter } from '@/app/features/appointments/services/workspaceMockData';

let idCounter = 0;
const nextId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

const nowIso = (): string => new Date().toISOString();

/**
 * Re-derive a line item's gross/amount after qty or discount changes so the
 * bill always stays internally consistent. Per-line discount is preserved as a
 * flat cent value (clamped to the gross).
 */
const recalcInvoiceLine = (item: InvoiceLineItem): InvoiceLineItem => {
  const grossCents = item.unitPriceCents * item.qty;
  const discountCents = Math.min(Math.max(0, item.discountCents), grossCents);
  return { ...item, grossCents, discountCents, amountCents: grossCents - discountCents };
};

/** Bill totals shared by the Total Bill view and the payment-recording action. */
const computeInvoiceTotals = (
  enc: Pick<AppointmentEncounter, 'invoiceLineItems' | 'taxPercent' | 'overallDiscountPercent'>
) => {
  const subtotalCents = enc.invoiceLineItems.reduce((sum, item) => sum + item.grossCents, 0);
  const lineDiscountCents = enc.invoiceLineItems.reduce((sum, item) => sum + item.discountCents, 0);
  const overallDiscountCents = Math.round((subtotalCents * enc.overallDiscountPercent) / 100);
  const discountedCents = Math.max(0, subtotalCents - lineDiscountCents - overallDiscountCents);
  const taxCents = Math.round((discountedCents * enc.taxPercent) / 100);
  return {
    subtotalCents,
    overallDiscountCents,
    taxCents,
    estimatedTotalCents: discountedCents + taxCents,
  };
};

type ReadyActor = { id?: string; name?: string };

type AppointmentWorkspaceState = {
  encountersById: Record<string, AppointmentEncounter>;
  activeStep: WorkspaceStep;
  activeSideAction: SideAction | null;

  initEncounter: (
    appointmentId: string,
    mode: EncounterMode,
    staff?: { leadId?: string; leadName?: string; nurseId?: string; nurseName?: string }
  ) => void;
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
  saveDischargeSummary: (appointmentId: string, byName: string) => void;
  reopenDischargeSummary: (appointmentId: string) => void;
  setFollowUp: (appointmentId: string, at: string | undefined) => void;
  addDocument: (appointmentId: string, document: Omit<WorkspaceDocument, 'id'>) => void;
  setWithdrawDeposit: (appointmentId: string, value: boolean) => void;
  setOverallDiscountPercent: (appointmentId: string, percent: number) => void;
  addInvoiceLineItem: (appointmentId: string, item: Omit<InvoiceLineItem, 'id'>) => void;
  updateInvoiceLineItem: (
    appointmentId: string,
    id: string,
    patch: Partial<InvoiceLineItem>
  ) => void;
  removeInvoiceLineItem: (appointmentId: string, id: string) => void;
  recordInvoicePayment: (
    appointmentId: string,
    payment: { method: PaymentMethod; byName?: string }
  ) => void;

  toggleReadyForBilling: (appointmentId: string, actor: ReadyActor) => void;
  toggleReadyForDischarge: (appointmentId: string, actor: ReadyActor) => void;

  addAlert: (appointmentId: string, alert: Omit<CompanionAlert, 'id'>) => void;
  removeAlert: (appointmentId: string, id: string) => void;
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

  initEncounter: (appointmentId, mode, staff) =>
    set((state) => {
      if (state.encountersById[appointmentId]) return {};
      const base = buildMockEncounter(appointmentId, mode);
      return {
        encountersById: {
          ...state.encountersById,
          [appointmentId]: {
            ...base,
            leadId: staff?.leadId ?? base.leadId,
            leadName: staff?.leadName || base.leadName,
            nurseId: staff?.nurseId ?? base.nurseId,
            nurseName: staff?.nurseName || base.nurseName,
          },
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
        // Edit the active draft (the first not-yet-signed note); never touch a
        // signed note so a new SOAP can be started after Save & Next.
        const draftIndex = enc.soap.findIndex((entry) => entry.status !== 'COMPLETED');
        if (draftIndex >= 0) {
          const updated = { ...enc.soap[draftIndex], ...patch };
          const soap = [...enc.soap];
          soap[draftIndex] = updated;
          return { ...enc, soap };
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
        return { ...enc, soap: [created, ...enc.soap] };
      })
    ),

  applySoapTemplate: (appointmentId, template) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const draftIndex = enc.soap.findIndex((entry) => entry.status !== 'COMPLETED');
        if (draftIndex >= 0) {
          const soap = [...enc.soap];
          soap[draftIndex] = { ...soap[draftIndex], templateId: template.id };
          return { ...enc, soap };
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
          templateId: template.id,
        };
        return { ...enc, soap: [created, ...enc.soap] };
      })
    ),

  signSoap: (appointmentId, signedByName, offline) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        // Sign the active draft and keep it in history; the next upsert starts a
        // fresh draft, so the SOAP form clears and is editable again.
        const draftIndex = enc.soap.findIndex((entry) => entry.status !== 'COMPLETED');
        if (draftIndex < 0) return enc;
        const signed: SoapNoteEntry = {
          ...enc.soap[draftIndex],
          signedByName,
          signedOffline: offline,
          signedAt: nowIso(),
          status: 'COMPLETED',
        };
        const soap = [...enc.soap];
        soap[draftIndex] = signed;
        return {
          ...enc,
          soap,
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

  saveDischargeSummary: (appointmentId, byName) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        dischargeSavedAt: new Date().toISOString(),
        dischargeSavedByName: byName,
      }))
    ),

  reopenDischargeSummary: (appointmentId) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        dischargeSavedAt: undefined,
        dischargeSavedByName: undefined,
      }))
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

  setOverallDiscountPercent: (appointmentId, percent) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        overallDiscountPercent: Math.min(100, Math.max(0, percent)),
      }))
    ),

  addInvoiceLineItem: (appointmentId, item) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        invoiceLineItems: [...enc.invoiceLineItems, { ...item, id: nextId('inv') }],
      }))
    ),

  updateInvoiceLineItem: (appointmentId, id, patch) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        invoiceLineItems: enc.invoiceLineItems.map((item) =>
          item.id === id ? recalcInvoiceLine({ ...item, ...patch }) : item
        ),
      }))
    ),

  removeInvoiceLineItem: (appointmentId, id) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        invoiceLineItems: enc.invoiceLineItems.filter((item) => item.id !== id),
      }))
    ),

  recordInvoicePayment: (appointmentId, payment) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        if (enc.invoiceLineItems.length === 0) return enc;
        const totals = computeInvoiceTotals(enc);
        const paidFromDeposit = payment.method === 'DEPOSIT' || enc.withdrawDeposit;
        const invoice: PastInvoice = {
          id: nextId('inv-paid'),
          createdAt: nowIso(),
          totalCents: totals.estimatedTotalCents,
          outstandingCents: 0,
          status: 'PAID_FULL',
          byName: payment.byName,
          paidByName: payment.byName,
          paidAt: nowIso(),
          paymentMethod: payment.method,
          paidFromDeposit,
          items: enc.invoiceLineItems.map((item) => ({ ...item })),
        };
        return {
          ...enc,
          pastInvoices: [invoice, ...enc.pastInvoices],
          invoiceLineItems: [],
          depositCents: paidFromDeposit
            ? Math.max(0, enc.depositCents - totals.estimatedTotalCents)
            : enc.depositCents,
        };
      })
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

  addAlert: (appointmentId, alert) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        alerts: [...enc.alerts, { ...alert, id: nextId('al') }],
      }))
    ),

  removeAlert: (appointmentId, id) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        alerts: enc.alerts.filter((alert) => alert.id !== id),
      }))
    ),
}));
