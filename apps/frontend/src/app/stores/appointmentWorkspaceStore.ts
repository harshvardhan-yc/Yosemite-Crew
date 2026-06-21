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
  StepStatus,
  Vitals,
  WorkspaceStep,
  InvoiceLineItem,
  PastInvoice,
  PaymentMethod,
  WorkspaceDocument,
} from '@/app/features/appointments/types/workspace';
import { buildEmptyEncounter } from '@/app/features/appointments/services/workspaceInitialData';

let idCounter = 0;
const nextId = (prefix: string): string => {
  idCounter += 1;
  // Prefix with `local-` so persistence checks (isPersistedArtifactId) can tell
  // client-generated ids apart from backend-issued ids and POST (not PATCH) them.
  return `local-${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

const nowIso = (): string => new Date().toISOString();

/**
 * Re-derive a line item's gross/amount after qty or discount changes so the
 * bill always stays internally consistent. Per-line discount is preserved as a
 * flat cent value (clamped to the gross).
 */
const recalcInvoiceLine = (item: InvoiceLineItem): InvoiceLineItem => {
  const grossCents = item.unitPriceCents * item.qty;
  // Discount is bounded by the gross and, when the catalog sets one, the per-line
  // max-discount ceiling — so a manual edit can never exceed the allowed discount.
  const ceiling =
    item.maxDiscountCents != null ? Math.min(item.maxDiscountCents, grossCents) : grossCents;
  const discountCents = Math.min(Math.max(0, item.discountCents), ceiling);
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

const consultationTypeForMode = (mode: EncounterMode): string =>
  mode === 'INPATIENT' ? 'Inpatient' : 'Outpatient';

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
  mergeEncounterData: (
    appointmentId: string,
    patch: Partial<
      Pick<
        AppointmentEncounter,
        | 'soap'
        | 'vitals'
        | 'observations'
        | 'diagnosticOrders'
        | 'services'
        | 'prescription'
        | 'dischargeSummary'
        | 'followUpAt'
        | 'dischargeSavedAt'
        | 'dischargeSavedByName'
        | 'dischargeSummaryId'
        | 'documents'
        | 'soapTemplates'
        | 'readyForBilling'
        | 'readyForDischarge'
        | 'roomId'
        | 'unitId'
        | 'admittedAt'
        | 'dischargedAt'
        | 'mode'
      >
    > & { stepStatus?: Partial<Record<WorkspaceStep, StepStatus>> }
  ) => void;
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
  signSoap: (
    appointmentId: string,
    signedByName: string,
    offline: boolean,
    persistedId?: string
  ) => void;

  addVitals: (
    appointmentId: string,
    vitals: Omit<Vitals, 'id' | 'code'>,
    persistedId?: string
  ) => void;
  addObservation: (appointmentId: string, record: Omit<ObservationRecord, 'id' | 'code'>) => void;

  removeDiagnosticTest: (appointmentId: string, id: string) => void;
  addDiagnosticOrder: (appointmentId: string, order?: Partial<DiagnosticOrder>) => void;

  addLineItem: (appointmentId: string, item: Omit<LineItem, 'id'>) => void;
  updateLineItem: (appointmentId: string, id: string, patch: Partial<LineItem>) => void;
  removeLineItem: (appointmentId: string, id: string) => void;

  addPrescription: (
    appointmentId: string,
    item: Omit<PrescriptionItem, 'id'>,
    persistedId?: string
  ) => void;
  updatePrescription: (appointmentId: string, id: string, patch: Partial<PrescriptionItem>) => void;
  removePrescription: (appointmentId: string, id: string) => void;

  addScheduleTask: (appointmentId: string, task: Omit<ScheduleTask, 'id'>) => void;
  updateScheduleTask: (appointmentId: string, id: string, patch: Partial<ScheduleTask>) => void;
  setScheduleTaskStatus: (appointmentId: string, id: string, status: ScheduleTaskStatus) => void;

  setDischargeSummary: (appointmentId: string, html: string) => void;
  saveDischargeSummary: (appointmentId: string, byName: string, persistedId?: string) => void;
  reopenDischargeSummary: (appointmentId: string) => void;
  markDischarged: (appointmentId: string, dischargedAt: string) => void;
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
  recordDepositCollection: (
    appointmentId: string,
    deposit: { amountCents: number; method: PaymentMethod; byName?: string }
  ) => void;
  /** Seed the Invoices section + deposit balance + currency from the finance service on load. */
  hydrateInvoiceBilling: (
    appointmentId: string,
    billing: { pastInvoices: PastInvoice[]; depositCents: number; currency?: string }
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
      const base = buildEmptyEncounter(appointmentId, mode);
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

  mergeEncounterData: (appointmentId, patch) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        soap: patch.soap && patch.soap.length > 0 ? patch.soap : enc.soap,
        vitals: patch.vitals && patch.vitals.length > 0 ? patch.vitals : enc.vitals,
        observations:
          patch.observations && patch.observations.length > 0
            ? patch.observations
            : enc.observations,
        diagnosticOrders:
          patch.diagnosticOrders && patch.diagnosticOrders.length > 0
            ? patch.diagnosticOrders
            : enc.diagnosticOrders,
        services: patch.services && patch.services.length > 0 ? patch.services : enc.services,
        prescription:
          patch.prescription && patch.prescription.length > 0
            ? patch.prescription
            : enc.prescription,
        dischargeSummary:
          patch.dischargeSummary !== undefined ? patch.dischargeSummary : enc.dischargeSummary,
        followUpAt: patch.followUpAt !== undefined ? patch.followUpAt : enc.followUpAt,
        dischargeSavedAt:
          patch.dischargeSavedAt !== undefined ? patch.dischargeSavedAt : enc.dischargeSavedAt,
        dischargeSavedByName:
          patch.dischargeSavedByName !== undefined
            ? patch.dischargeSavedByName
            : enc.dischargeSavedByName,
        dischargeSummaryId:
          patch.dischargeSummaryId !== undefined
            ? patch.dischargeSummaryId
            : enc.dischargeSummaryId,
        documents: patch.documents && patch.documents.length > 0 ? patch.documents : enc.documents,
        soapTemplates:
          patch.soapTemplates && patch.soapTemplates.length > 0
            ? patch.soapTemplates
            : enc.soapTemplates,
        readyForBilling:
          patch.readyForBilling !== undefined ? patch.readyForBilling : enc.readyForBilling,
        readyForDischarge:
          patch.readyForDischarge !== undefined ? patch.readyForDischarge : enc.readyForDischarge,
        roomId: patch.roomId !== undefined ? patch.roomId : enc.roomId,
        unitId: patch.unitId !== undefined ? patch.unitId : enc.unitId,
        admittedAt: patch.admittedAt !== undefined ? patch.admittedAt : enc.admittedAt,
        dischargedAt: patch.dischargedAt !== undefined ? patch.dischargedAt : enc.dischargedAt,
        mode: patch.mode !== undefined ? patch.mode : enc.mode,
        consultationType:
          patch.mode !== undefined ? consultationTypeForMode(patch.mode) : enc.consultationType,
        stepStatus: patch.stepStatus ? { ...enc.stepStatus, ...patch.stepStatus } : enc.stepStatus,
      }))
    ),

  setEncounterMode: (appointmentId, mode) =>
    set((state) => {
      const current = state.encountersById[appointmentId];
      const modeDefaults = buildEmptyEncounter(appointmentId, mode);
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

  signSoap: (appointmentId, signedByName, offline, persistedId) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        // Sign the active draft and keep it in history; the next upsert starts a
        // fresh draft, so the SOAP form clears and is editable again.
        const draftIndex = enc.soap.findIndex((entry) => entry.status !== 'COMPLETED');
        if (draftIndex < 0) return enc;
        const signed: SoapNoteEntry = {
          ...enc.soap[draftIndex],
          // Stamp the backend-issued id so a later edit PATCHes instead of POSTing a duplicate.
          id: persistedId ?? enc.soap[draftIndex].id,
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

  addVitals: (appointmentId, vitals, persistedId) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        vitals: [
          {
            ...vitals,
            id: persistedId ?? nextId('vt'),
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

  addPrescription: (appointmentId, item, persistedId) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const prescription = { ...item, id: persistedId ?? nextId('rx') };
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

  saveDischargeSummary: (appointmentId, byName, persistedId) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        dischargeSavedAt: new Date().toISOString(),
        dischargeSavedByName: byName,
        // Keep the backend id so re-saving the summary PATCHes instead of POSTing a duplicate.
        dischargeSummaryId: persistedId ?? enc.dischargeSummaryId,
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

  markDischarged: (appointmentId, dischargedAt) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => ({
        ...enc,
        dischargedAt,
        viewOnly: true,
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

  recordDepositCollection: (appointmentId, deposit) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        const amountCents = Math.max(0, Math.round(deposit.amountCents));
        if (amountCents <= 0) return enc;
        const lineItem: InvoiceLineItem = {
          id: nextId('deposit-line'),
          name: 'Visit deposit',
          unitPriceCents: amountCents,
          qty: 1,
          grossCents: amountCents,
          discountCents: 0,
          amountCents,
        };
        const invoice: PastInvoice = {
          id: nextId('deposit'),
          createdAt: nowIso(),
          totalCents: amountCents,
          outstandingCents: 0,
          status: 'PAID_FULL',
          byName: deposit.byName,
          paidByName: deposit.byName,
          paidAt: nowIso(),
          paymentMethod: deposit.method,
          items: [lineItem],
        };
        return {
          ...enc,
          depositCents: enc.depositCents + amountCents,
          pastInvoices: [invoice, ...enc.pastInvoices],
        };
      })
    ),

  hydrateInvoiceBilling: (appointmentId, billing) =>
    set((state) =>
      patchEncounter(state, appointmentId, (enc) => {
        // Locally recorded payments/deposits (ids prefixed inv-paid/deposit) are
        // session-only and not yet refetched from finance — keep them, and prefer
        // server invoices by id so a refetch doesn't duplicate rows.
        const serverIds = new Set(billing.pastInvoices.map((invoice) => invoice.id));
        const localOnly = enc.pastInvoices.filter((invoice) => !serverIds.has(invoice.id));
        return {
          ...enc,
          pastInvoices: [...billing.pastInvoices, ...localOnly],
          // The collected deposit is authoritative from finance; fall back to the
          // existing local value when the server reports none.
          depositCents: billing.depositCents > 0 ? billing.depositCents : enc.depositCents,
          currency: billing.currency ?? enc.currency,
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
