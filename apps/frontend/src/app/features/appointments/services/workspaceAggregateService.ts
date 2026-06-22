import api, { deleteData, getData, patchData, postData } from '@/app/services/axios';
import type { WorkspaceDocumentRow } from '@yosemite-crew/types';
import type {
  AppointmentEncounter,
  DiagnosticOrder,
  EncounterMode,
  LineItem,
  PrescriptionItem,
  ReadyState,
  WorkspaceDocument,
  WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

export type WorkspaceBootstrapDTO = Record<string, unknown>;
export type WorkspaceDocumentDTO = Record<string, unknown>;
export type TreatmentItemDTO = Record<string, unknown>;

export interface WorkspaceDocumentPacketSigningDTO {
  status?: string;
  signingUrl?: string | null;
  pdf?: { url?: string | null };
}

export interface WorkspaceDocumentPacketDTO {
  packetId?: string;
  status?: string;
  signing?: WorkspaceDocumentPacketSigningDTO | null;
  [key: string]: unknown;
}

const STEP_STATUS_BY_AGGREGATE_KEY: Partial<Record<string, WorkspaceStep>> = {
  clinicalArtifacts: 'SOAP',
  vitals: 'SOAP',
  prescriptions: 'TREATMENT',
  treatmentItems: 'TREATMENT',
  diagnosticQueue: 'DIAGNOSTICS',
  documents: 'SUMMARY',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};

const asIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const asOptionalIso = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
};

const readFirstString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return undefined;
};

const readFirstIso = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = asOptionalIso(source[key]);
    if (value) return value;
  }
  return undefined;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const buildReadyState = (
  source: Record<string, unknown>,
  fallbackSource: Record<string, unknown>,
  timestampKeys: string[],
  nameKeys: string[],
  idKeys: string[]
): ReadyState => ({
  value: true,
  at:
    readFirstIso(source, timestampKeys) ??
    readFirstIso(fallbackSource, timestampKeys) ??
    readFirstIso(fallbackSource, ['updatedAt', 'modifiedAt', 'createdAt']),
  byName: readFirstString(source, nameKeys) ?? readFirstString(fallbackSource, nameKeys),
  byUserId: readFirstString(source, idKeys) ?? readFirstString(fallbackSource, idKeys),
});

const resolveAggregateMode = (bootstrap: WorkspaceBootstrapDTO): EncounterMode | undefined => {
  const encounter = isRecord(bootstrap.encounter) ? bootstrap.encounter : undefined;
  const appointment = isRecord(bootstrap.appointment) ? bootstrap.appointment : undefined;
  const kind = asString(encounter?.appointmentKind) ?? asString(appointment?.kind);
  const encounterClass = asString(encounter?.encounterClass);
  if (kind === 'INPATIENT' || encounterClass === 'IMP') return 'INPATIENT';
  if (kind === 'OUTPATIENT' || encounterClass === 'AMB') return 'OUTPATIENT';
  return undefined;
};

const diagnosticStatus = (status: string | undefined): DiagnosticOrder['status'] => {
  const normalized = status?.toUpperCase();
  if (normalized === 'RESULTED' || normalized === 'COMPLETE' || normalized === 'FINAL') {
    return 'COMPLETED';
  }
  if (normalized === 'SUBMITTED' || normalized === 'AT_THE_LAB' || normalized === 'RUNNING') {
    return 'SUBMITTED';
  }
  return 'CREATED';
};

const diagnosticQueueKind = (value: string | undefined): DiagnosticOrder['kind'] => {
  if (value === 'LAB_ORDER' || value === 'LAB_RESULT' || value === 'PROVIDER_TEST') return value;
  return undefined;
};

const normalizeDiagnosticQueue = (items: Record<string, unknown>[]): DiagnosticOrder[] =>
  items.map((item, index) => ({
    id: asString(item.id) ?? `diagnostic-${index + 1}`,
    orderCode:
      asString(item.providerTestCode) ??
      asString(item.sourceId) ??
      asString(item.id) ??
      `DX-${index + 1}`,
    createdAt: asIso(item.createdAt),
    status: diagnosticStatus(asString(item.status)),
    kind: diagnosticQueueKind(asString(item.kind)),
    provider: asString(item.provider),
    name: asString(item.label),
    sourceKind: asString(item.sourceKind),
  }));

const normalizeDocuments = (items: Record<string, unknown>[]): WorkspaceDocument[] =>
  items.map((item, index) => ({
    id: asString(item.documentId) ?? asString(item.id) ?? `document-${index + 1}`,
    sourceKind: asString(item.sourceKind),
    sourceId: asString(item.sourceId),
    status: asString(item.status),
    signingStatus: asString(item.signingStatus),
    pdfUrl: asString(item.pdfUrl) ?? null,
    createdAt: asIso(item.createdAt),
    category: asString(item.kind) === 'DISCHARGE_SUMMARY' ? 'Discharge' : 'Consent',
    description: asString(item.title) ?? 'Workspace document',
    lastModifiedAt: asIso(item.updatedAt),
    signatureRequired: asString(item.signingStatus) !== 'SIGNED',
  }));

// Treatment items whose kind is a medicine belong in the prescription section, not the
// Services & Packages section. The backend uses `MEDICATION` (catalog kind) for expanded
// package components and the legacy `PRESCRIPTION` value for stored prescriptions — treat
// both the same.
const MEDICATION_TREATMENT_KINDS = new Set(['MEDICATION', 'PRESCRIPTION']);

const isMedicationTreatmentItem = (item: Record<string, unknown>): boolean =>
  MEDICATION_TREATMENT_KINDS.has(asString(item.servicePackageKind) ?? '');

const normalizeTreatmentItems = (items: Record<string, unknown>[]): LineItem[] =>
  items
    .filter((item) => !isMedicationTreatmentItem(item))
    .map((item, index) => {
      const productSnapshot = isRecord(item.productSnapshot) ? item.productSnapshot : {};
      const priceSnapshot = isRecord(item.priceSnapshot) ? item.priceSnapshot : {};
      const qty = asNumber(item.quantity) ?? 1;
      const unitPriceCents = Math.round((asNumber(priceSnapshot.unitPrice) ?? 0) * 100);
      return {
        id: asString(item.id) ?? `treatment-${index + 1}`,
        refId: asString(item.productId) ?? asString(item.id) ?? `product-${index + 1}`,
        kind: asString(item.servicePackageKind) === 'PACKAGE' ? 'PACKAGE' : 'SERVICE',
        name: asString(item.name) ?? asString(productSnapshot.name) ?? 'Treatment item',
        qty,
        unitPriceCents,
        amountCents: unitPriceCents * qty,
        billed: asString(item.billingStatus) === 'BILLED',
      };
    });

const medicationTreatmentItemToPrescription = (
  item: Record<string, unknown>,
  index: number
): PrescriptionItem => {
  const productSnapshot = isRecord(item.productSnapshot) ? item.productSnapshot : {};
  const priceSnapshot = isRecord(item.priceSnapshot) ? item.priceSnapshot : {};
  const priceCents = Math.round((asNumber(priceSnapshot.unitPrice) ?? 0) * 100);
  return {
    id: asString(item.id) ?? `prescription-${index + 1}`,
    medicineName: asString(item.name) ?? asString(productSnapshot.name) ?? 'Medication',
    instructions: asString(productSnapshot.instructions),
    // Package-expanded medications are dispensed in-house by default.
    fulfillment: 'IN_HOUSE',
    priceCents,
    inventoryItemId: asString(item.productId) ?? asString(productSnapshot.inventoryItemId),
    billed: asString(item.billingStatus) === 'BILLED',
  };
};

// Prescriptions come from two server sources: explicitly stored prescription artifacts
// (`bootstrap.prescriptions`) and medication-kind treatment items the backend expands from
// a booked package. Merge both, de-duplicating by id.
const normalizePrescriptions = (
  prescriptions: Record<string, unknown>[],
  treatmentItems: Record<string, unknown>[]
): PrescriptionItem[] => {
  const byId = new Map<string, PrescriptionItem>();
  prescriptions.forEach((item, index) => {
    const productSnapshot = isRecord(item.productSnapshot) ? item.productSnapshot : {};
    const priceSnapshot = isRecord(item.priceSnapshot) ? item.priceSnapshot : {};
    const prescription: PrescriptionItem = {
      id: asString(item.id) ?? `prescription-artifact-${index + 1}`,
      medicineName:
        asString(item.medicineName) ??
        asString(item.name) ??
        asString(productSnapshot.name) ??
        'Medication',
      dosage: asString(item.dosage),
      route: asString(item.route),
      frequency: asString(item.frequency),
      durationDays: asString(item.durationDays),
      refill: asString(item.refill),
      instructions: asString(item.instructions) ?? asString(productSnapshot.instructions),
      fulfillment:
        asString(item.fulfillment) === 'PRESCRIPTION_ONLY' ? 'PRESCRIPTION_ONLY' : 'IN_HOUSE',
      priceCents:
        asNumber(item.priceCents) ?? Math.round((asNumber(priceSnapshot.unitPrice) ?? 0) * 100),
      inventoryItemId: asString(item.inventoryItemId) ?? asString(item.productId),
    };
    byId.set(prescription.id, prescription);
  });
  treatmentItems.filter(isMedicationTreatmentItem).forEach((item, index) => {
    const prescription = medicationTreatmentItemToPrescription(item, index);
    if (!byId.has(prescription.id)) byId.set(prescription.id, prescription);
  });
  return Array.from(byId.values());
};

const latestDischargeSummary = (artifacts: Record<string, unknown>[]) =>
  artifacts
    .filter((item) => {
      const artifact = isRecord(item.artifact) ? item.artifact : {};
      return asString(artifact.kind) === 'DISCHARGE_SUMMARY';
    })
    .sort((left, right) => {
      const leftArtifact = isRecord(left.artifact) ? left.artifact : {};
      const rightArtifact = isRecord(right.artifact) ? right.artifact : {};
      return (
        new Date(asIso(rightArtifact.updatedAt)).getTime() -
        new Date(asIso(leftArtifact.updatedAt)).getTime()
      );
    })[0];

const applyEncounterReadiness = (
  patch: Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
    stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
  },
  bootstrap: WorkspaceBootstrapDTO,
  encounter: Record<string, unknown>,
  invoice: Record<string, unknown>
) => {
  const readyForDischargeFlag =
    asString(encounter.status) === 'onleave' ||
    encounter.readyForDischarge === true ||
    (isRecord(encounter.readyForDischarge) &&
      asBoolean(encounter.readyForDischarge.value) === true);
  if (readyForDischargeFlag) {
    patch.readyForDischarge = buildReadyState(
      encounter,
      encounter,
      ['readyForDischargeAt', 'readyForDischargeOn', 'dischargeReadyAt', 'updatedAt'],
      ['readyForDischargeByName', 'dischargeReadyByName', 'updatedByName', 'updatedBy'],
      ['readyForDischargeByUserId', 'dischargeReadyByUserId', 'updatedById']
    );
  }

  const billingFallback = { ...encounter, ...invoice };
  let readyForBilling = billingFallback;
  if (isRecord(bootstrap.readyForBilling)) {
    readyForBilling = bootstrap.readyForBilling;
  } else if (isRecord(encounter.readyForBilling)) {
    readyForBilling = encounter.readyForBilling;
  }
  const billingStage =
    asString(bootstrap.visitBillingStage) ??
    asString(invoice.visitBillingStage) ??
    asString(encounter.visitBillingStage);
  const readyForBillingFlag =
    billingStage === 'READY_FOR_BILLING' ||
    billingStage === 'SETTLED' ||
    bootstrap.readyForBilling === true ||
    encounter.readyForBilling === true ||
    (isRecord(bootstrap.readyForBilling) && asBoolean(bootstrap.readyForBilling.value) === true) ||
    (isRecord(encounter.readyForBilling) && asBoolean(encounter.readyForBilling.value) === true);
  if (readyForBillingFlag) {
    patch.readyForBilling = buildReadyState(
      readyForBilling,
      billingFallback,
      ['readyForBillingAt', 'billingReadyAt', 'updatedAt', 'createdAt'],
      ['readyForBillingByName', 'billingReadyByName', 'updatedByName', 'updatedBy'],
      ['readyForBillingByUserId', 'billingReadyByUserId', 'updatedById']
    );
  }
};

const applyBootstrapCollections = (
  patch: Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
    stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
  },
  bootstrap: WorkspaceBootstrapDTO
) => {
  const diagnosticQueue = normalizeDiagnosticQueue(asArray(bootstrap.diagnosticQueue));
  if (diagnosticQueue.length) patch.diagnosticOrders = diagnosticQueue;

  const documents = normalizeDocuments(asArray(bootstrap.documents));
  if (documents.length) patch.documents = documents;

  const treatmentItems = normalizeTreatmentItems(asArray(bootstrap.treatmentItems));
  if (treatmentItems.length) patch.services = treatmentItems;

  const prescriptions = normalizePrescriptions(
    asArray(bootstrap.prescriptions),
    asArray(bootstrap.treatmentItems)
  );
  if (prescriptions.length) patch.prescription = prescriptions;

  const discharge = latestDischargeSummary(asArray(bootstrap.clinicalArtifacts));
  if (discharge) {
    const artifact = isRecord(discharge.artifact) ? discharge.artifact : {};
    const summary = isRecord(discharge.dischargeSummary) ? discharge.dischargeSummary : {};
    patch.dischargeSummary = toText(summary.summary);
    patch.followUpAt = asString(summary.followUp);
    patch.dischargeSavedAt = asIso(artifact.updatedAt ?? summary.updatedAt);
    patch.dischargeSavedByName = asString(artifact.signedBy) ?? asString(artifact.authorId);
    patch.dischargeSummaryId = asString(artifact.id);
  }
};

export const normalizeWorkspaceBootstrapForEncounter = (
  bootstrap: WorkspaceBootstrapDTO
): Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
  stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
} => {
  const patch: Omit<Partial<AppointmentEncounter>, 'stepStatus'> & {
    stepStatus?: Partial<Record<WorkspaceStep, 'COMPLETED'>>;
  } = {};

  const mode = resolveAggregateMode(bootstrap);
  if (mode) patch.mode = mode;

  const encounter = isRecord(bootstrap.encounter) ? bootstrap.encounter : {};
  if (isRecord(encounter.admission)) {
    patch.unitId = asString(encounter.admission.unitId);
    patch.admittedAt =
      asOptionalIso(encounter.admission.admittedAt) ??
      asOptionalIso(encounter.admission.createdAt) ??
      asOptionalIso(encounter.updatedAt);
    patch.dischargedAt = asOptionalIso(encounter.admission.dischargedAt);
  }
  const invoice = isRecord(bootstrap.invoice) ? bootstrap.invoice : {};
  applyEncounterReadiness(patch, bootstrap, encounter, invoice);
  applyBootstrapCollections(patch, bootstrap);

  const stepStatus = Object.entries(STEP_STATUS_BY_AGGREGATE_KEY).reduce<
    Partial<Record<WorkspaceStep, 'COMPLETED'>>
  >((acc, [key, step]) => {
    if (step && asArray(bootstrap[key]).length > 0) acc[step] = 'COMPLETED';
    return acc;
  }, {});
  if (Object.keys(stepStatus).length > 0) patch.stepStatus = stepStatus;

  return patch;
};

export const getAppointmentWorkspaceBootstrap = async (
  organisationId: string,
  appointmentId: string
) => {
  const res = await getData<WorkspaceBootstrapDTO>(
    `/v1/workspace/organisations/${organisationId}/appointments/${appointmentId}`
  );
  return res.data;
};

export const getEncounterWorkspaceBootstrap = async (
  organisationId: string,
  encounterId: string
) => {
  const res = await getData<WorkspaceBootstrapDTO>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}`
  );
  return res.data;
};

export const listAppointmentWorkspaceDocuments = async (
  organisationId: string,
  appointmentId: string
) => {
  const res = await getData<WorkspaceDocumentDTO[]>(
    `/v1/workspace/organisations/${organisationId}/appointments/${appointmentId}/documents`
  );
  return res.data ?? [];
};

export const listEncounterWorkspaceDocuments = async (
  organisationId: string,
  encounterId: string
): Promise<WorkspaceDocumentRow[]> => {
  const res = await getData<WorkspaceDocumentRow[]>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/documents`
  );
  return res.data ?? [];
};

export const listCompanionWorkspaceDocuments = async (
  organisationId: string,
  companionId: string
) => {
  const res = await getData<WorkspaceDocumentDTO[]>(
    `/v1/workspace/organisations/${organisationId}/companions/${companionId}/documents`
  );
  return res.data ?? [];
};

export const listCompanionMedicalRecords = async (organisationId: string, companionId: string) => {
  const res = await getData<WorkspaceDocumentDTO[]>(
    `/v1/workspace/organisations/${organisationId}/companions/${companionId}/medical-records`
  );
  return res.data ?? [];
};

export const createEncounterDocumentPacket = async (
  organisationId: string,
  encounterId: string,
  body: Record<string, unknown> = {}
) => {
  const res = await postData<WorkspaceDocumentPacketDTO>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/document-packet`,
    body
  );
  return res.data;
};

export const getWorkspaceDocumentPacket = async (organisationId: string, packetId: string) => {
  const res = await getData<WorkspaceDocumentPacketDTO>(
    `/v1/workspace/organisations/${organisationId}/document-packets/${packetId}`
  );
  return res.data;
};

export const signWorkspaceDocumentPacket = async (
  organisationId: string,
  packetId: string,
  body: Record<string, unknown> = {}
) => {
  const res = await postData<WorkspaceDocumentPacketDTO>(
    `/v1/workspace/organisations/${organisationId}/document-packets/${packetId}/sign`,
    body
  );
  return res.data;
};

/**
 * Fetch the merged clinical packet (SOAP + Prescription + Discharge, …) as a
 * single PDF and return a blob URL for preview/print. Caller is responsible for
 * revoking the URL when done.
 */
export const getEncounterDocumentPacketPdfUrl = async (
  organisationId: string,
  encounterId: string
): Promise<string> => {
  const res = await api.get<Blob>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/document-packet/pdf`,
    { responseType: 'blob' }
  );
  return URL.createObjectURL(res.data);
};

export const listEncounterTreatmentItems = async (organisationId: string, encounterId: string) => {
  const res = await getData<TreatmentItemDTO[]>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/treatment-items`
  );
  return res.data ?? [];
};

export const createEncounterTreatmentItem = async (
  organisationId: string,
  encounterId: string,
  item: TreatmentItemDTO
) => {
  const res = await postData<TreatmentItemDTO>(
    `/v1/workspace/organisations/${organisationId}/encounters/${encounterId}/treatment-items`,
    item
  );
  return res.data;
};

export const updateEncounterTreatmentItem = async (
  organisationId: string,
  itemId: string,
  patch: Partial<TreatmentItemDTO>
) => {
  const res = await patchData<TreatmentItemDTO>(
    `/v1/workspace/organisations/${organisationId}/treatment-items/${itemId}`,
    patch
  );
  return res.data;
};

export const deleteEncounterTreatmentItem = async (organisationId: string, itemId: string) => {
  await deleteData(`/v1/workspace/organisations/${organisationId}/treatment-items/${itemId}`);
};
