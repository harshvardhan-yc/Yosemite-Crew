import type {
  TemplateInstanceLike,
  TemplateInstanceUpsertInput,
  TemplateKind,
  TemplateLike,
  TemplateResolveResponse,
} from '@yosemite-crew/types';
import type { Task as FhirTask } from '@yosemite-crew/fhir';
import { getData, patchData, postData } from '@/app/services/axios';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

type TemplateListParams = {
  kind?: TemplateKind;
  status?: string;
  scope?: string;
};

const listTemplates = async (url: string, params: TemplateListParams = {}) => {
  const res = await getData<TemplateLike[]>(url, params);
  return Array.isArray(res.data) ? res.data : [];
};

const dedupeTemplates = (templates: TemplateLike[]) => {
  const byId = new Map<string, TemplateLike>();
  for (const template of templates) {
    if (!template?.id) continue;
    byId.set(template.id, template);
  }
  return [...byId.values()];
};

export const listWorkspaceTemplates = async (
  organisationId: string,
  params: TemplateListParams = {}
) => {
  const [libraryResult, organisationResult, userResult] = await Promise.allSettled([
    listTemplates('/v1/templates/pms/templates/library', params),
    listTemplates(`/v1/templates/pms/templates/organisation/${organisationId}`, params),
    listTemplates(`/v1/templates/pms/templates/organisation/${organisationId}/users/me`, params),
  ]);

  return dedupeTemplates(
    [libraryResult, organisationResult, userResult].flatMap((result) =>
      result.status === 'fulfilled' ? result.value : []
    )
  );
};

export const templateToSoapTemplate = (template: TemplateLike): SoapTemplate => ({
  id: template.id,
  name: template.name,
  serviceId: template.catalogItemIds?.[0],
  isDefault: template.ownership === 'YC_LIBRARY',
});

export const listSoapTemplatesForWorkspace = async (
  organisationId: string
): Promise<SoapTemplate[]> => {
  const templates = await listWorkspaceTemplates(organisationId, {
    kind: 'SOAP_NOTE',
    status: 'PUBLISHED',
  });
  return templates.map(templateToSoapTemplate);
};

export const listInpatientScheduleTemplates = async (organisationId: string) =>
  listWorkspaceTemplates(organisationId, {
    kind: 'INPATIENT_SCHEDULE',
    status: 'PUBLISHED',
  });

export const listVitalsTemplates = async (organisationId: string) =>
  listWorkspaceTemplates(organisationId, {
    kind: 'VITAL_RECORD',
    status: 'PUBLISHED',
  });

export const listDischargeSummaryTemplates = async (organisationId: string) =>
  listWorkspaceTemplates(organisationId, {
    kind: 'DISCHARGE_SUMMARY',
    status: 'PUBLISHED',
  });

export type TemplateResolveContext = {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
  species?: string;
  serviceId?: string;
  packageId?: string;
  mode?: 'OUTPATIENT' | 'INPATIENT';
};

/**
 * Resolve the discharge-summary template that best matches the encounter context
 * (service / package / species / mode) via the shared `GET /pms/resolve` endpoint.
 * Returns the resolved template (content snapshot + `templateId`/`templateVersion`)
 * or `null` when no template is configured — the backend answers 404 in that case,
 * which we treat as "no default template" so callers fall back to a blank editor.
 */
export const resolveDischargeTemplate = async (
  context: TemplateResolveContext
): Promise<TemplateResolveResponse | null> => {
  const params: Record<string, string> = {
    organisationId: context.organisationId,
    kind: 'DISCHARGE_SUMMARY',
  };
  if (context.appointmentId) params.appointmentId = context.appointmentId;
  if (context.encounterId) params.encounterId = context.encounterId;
  if (context.companionId) params.companionId = context.companionId;
  if (context.species) params.species = context.species;
  if (context.serviceId) params.serviceId = context.serviceId;
  if (context.packageId) params.packageId = context.packageId;
  if (context.mode) params.mode = context.mode;

  try {
    const res = await getData<TemplateResolveResponse>('/v1/templates/pms/resolve', params);
    return res.data ?? null;
  } catch {
    // 404 (no template configured for this context) and any transient resolve
    // failure fall back to a blank discharge editor rather than blocking the step.
    return null;
  }
};

export const getWorkspaceTemplateById = async (organisationId: string, templateId: string) => {
  const res = await getData<TemplateLike>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}`
  );
  return res.data;
};

export const updateWorkspaceTemplateCatalogLinks = async (
  organisationId: string,
  templateId: string,
  catalogItemIds: string[]
) => {
  const res = await patchData<TemplateLike, { catalogItemIds: string[] }>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}/catalog-links`,
    { catalogItemIds }
  );
  return res.data;
};

export const createWorkspaceTemplateInstance = async (
  organisationId: string,
  templateId: string,
  input: Omit<TemplateInstanceUpsertInput, 'organisationId'>
) => {
  const res = await postData<TemplateInstanceLike>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}/instances`,
    { ...input, organisationId }
  );
  return res.data;
};

export const updateWorkspaceTemplateInstance = async (
  organisationId: string,
  instanceId: string,
  input: Partial<TemplateInstanceUpsertInput>
) => {
  const res = await patchData<TemplateInstanceLike, Partial<TemplateInstanceUpsertInput>>(
    `/v1/templates/pms/template-instances/organisation/${organisationId}/${instanceId}`,
    input
  );
  return res.data;
};

export const submitWorkspaceTemplateInstance = async (
  organisationId: string,
  instanceId: string
) => {
  const res = await postData<TemplateInstanceLike>(
    `/v1/templates/pms/template-instances/organisation/${organisationId}/${instanceId}/submit`
  );
  return res.data;
};

const parametersBody = (options: { force?: boolean; notify?: boolean; deferUntil?: string }) => ({
  resourceType: 'Parameters',
  parameter: [
    ...(options.force === undefined ? [] : [{ name: 'force', valueBoolean: options.force }]),
    ...(options.notify === undefined ? [] : [{ name: 'notify', valueBoolean: options.notify }]),
    ...(options.deferUntil === undefined
      ? []
      : [{ name: 'deferUntil', valueDateTime: options.deferUntil }]),
  ],
});

export const applyInpatientScheduleTemplate = async (
  organisationId: string,
  instanceId: string,
  options: { force?: boolean; notify?: boolean; deferUntil?: string } = {}
) => {
  const res = await postData<FhirTask>(
    `/fhir/v1/task-schedule/organisation/${organisationId}/template-instance/${instanceId}/$apply`,
    parametersBody(options)
  );
  return res.data;
};

export const getInpatientScheduleForEncounter = async (
  organisationId: string,
  encounterId: string
) => {
  const res = await getData<FhirTask>(
    `/fhir/v1/task-schedule/organisation/${organisationId}/encounter/${encounterId}`
  );
  return res.data;
};

const taskScheduleAction = async (
  organisationId: string,
  instanceId: string,
  action: '$pause' | '$resume' | '$cancel' | '$regenerate',
  options: { notify?: boolean; deferUntil?: string } = {}
) => {
  const res = await postData<FhirTask>(
    `/fhir/v1/task-schedule/organisation/${organisationId}/template-instance/${instanceId}/${action}`,
    parametersBody(options)
  );
  return res.data;
};

export const pauseInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$pause', options);

export const resumeInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$resume', options);

export const cancelInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$cancel', options);

export const regenerateInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$regenerate', options);
