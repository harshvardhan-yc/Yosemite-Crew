import type { Case } from './case';
import type { Encounter } from './encounter';
import type { ClinicalArtifactRecordLike } from './clinical-artifact';
import type { FormAssignmentLike } from './form-assignment';
import type { TaskCategory, TaskLike, TaskStatus } from './task';
import type { TemplateInstanceLike } from './template';
import type { TaskScheduleLike } from './task-schedule';

export interface WorkspaceSummaryItem {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceDocumentRow {
  documentId: string;
  sourceKind: string;
  sourceId: string;
  appointmentId: string | null;
  encounterId: string | null;
  companionId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  title: string;
  kind: string;
  status: string;
  signingStatus: string;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceLockState {
  appointment: boolean;
  encounter: boolean;
  episodeOfCare: boolean;
  templateInstances: boolean;
  clinicalArtifacts: boolean;
  prescriptions: boolean;
  documents: boolean;
}

export interface WorkspacePermissionSnapshot {
  permissions: string[];
  canViewAppointments: boolean;
  canViewTasks: boolean;
  canViewDocuments: boolean;
  canViewForms: boolean;
  canViewPrescriptions: boolean;
  canViewLabs: boolean;
}

export interface WorkspacePrimaryAction {
  kind: 'COMPLETE_FORMS' | 'REVIEW_TASKS' | 'CONTINUE_CHARTING' | 'VIEW_LABS' | 'VIEW_SUMMARY';
  label: string;
  detail: string;
}

export interface WorkspaceFormRow extends Omit<FormAssignmentLike, 'status'> {
  status: 'completed' | 'pending';
  assignmentStatus: FormAssignmentLike['status'];
  questionnaireResponse?: unknown;
  questionnaire?: unknown;
}

export interface WorkspaceLabSummary {
  orders: unknown[];
  results: unknown[];
  pendingCount: number;
}

export interface WorkspaceDiagnosticQueueItem {
  id: string;
  kind: 'LAB_ORDER' | 'LAB_RESULT';
  status: string | null;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceTreatmentItem {
  id: string;
  prescriptionId: string;
  name: string;
  medicationCount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceBootstrapResponse {
  organisationId: string;
  appointment: WorkspaceSummaryItem | null;
  encounter: Encounter | null;
  episodeOfCare: Case | null;
  companion: WorkspaceSummaryItem | null;
  client: WorkspaceSummaryItem | null;
  templateInstances: TemplateInstanceLike[];
  clinicalArtifacts: ClinicalArtifactRecordLike[];
  vitals: ClinicalArtifactRecordLike[];
  prescriptions: ClinicalArtifactRecordLike[];
  treatmentItems: WorkspaceTreatmentItem[];
  diagnosticQueue: WorkspaceDiagnosticQueueItem[];
  labSummary: WorkspaceLabSummary;
  tasks: TaskLike[];
  schedules: TaskScheduleLike[];
  forms: WorkspaceFormRow[];
  documents: WorkspaceDocumentRow[];
  locks: WorkspaceLockState;
  permissions: WorkspacePermissionSnapshot;
  primaryAction: WorkspacePrimaryAction;
}

export type WorkspaceBootstrapAggregate = WorkspaceBootstrapResponse;

export interface WorkspaceBootstrapInput {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
}
