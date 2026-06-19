import type { TemplateLike } from '@yosemite-crew/types';
import {
  applyInpatientScheduleTemplate,
  cancelInpatientScheduleTemplate,
  createWorkspaceTemplateInstance,
  getWorkspaceTemplateById,
  getInpatientScheduleForEncounter,
  listDischargeSummaryTemplates,
  listSoapTemplatesForWorkspace,
  listVitalsTemplates,
  listWorkspaceTemplates,
  pauseInpatientScheduleTemplate,
  regenerateInpatientScheduleTemplate,
  resumeInpatientScheduleTemplate,
  submitWorkspaceTemplateInstance,
  templateToSoapTemplate,
  updateWorkspaceTemplateCatalogLinks,
  updateWorkspaceTemplateInstance,
} from '@/app/features/appointments/services/workspaceTemplateService';

const getDataMock = jest.fn();
const patchDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  getData: (...args: unknown[]) => getDataMock(...args),
  patchData: (...args: unknown[]) => patchDataMock(...args),
  postData: (...args: unknown[]) => postDataMock(...args),
}));

const template = (id: string, name = id): TemplateLike => ({
  id,
  organisationId: 'org-1',
  ownerUserId: null,
  ownership: 'ORG_TEMPLATE',
  kind: 'SOAP_NOTE',
  name,
  description: null,
  status: 'PUBLISHED',
  scope: 'ORGANISATION',
  rules: {},
  latestVersion: 1,
  publishedVersion: 1,
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date('2026-04-20T09:00:00.000Z'),
  updatedAt: new Date('2026-04-20T09:00:00.000Z'),
  catalogItemIds: ['svc-1'],
});

describe('workspaceTemplateService', () => {
  beforeEach(() => {
    getDataMock.mockReset();
    patchDataMock.mockReset();
    postDataMock.mockReset();
  });

  it('loads library, organisation, and user templates and deduplicates by id', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [template('tpl-1', 'YC SOAP')] })
      .mockResolvedValueOnce({
        data: [template('tpl-1', 'YC SOAP'), template('tpl-2', 'Org SOAP')],
      })
      .mockResolvedValueOnce({ data: [template('tpl-3', 'My SOAP')] });

    const templates = await listWorkspaceTemplates('org-1', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });
    expect(getDataMock).toHaveBeenNthCalledWith(
      2,
      '/v1/templates/pms/templates/organisation/org-1',
      { kind: 'SOAP_NOTE', status: 'PUBLISHED' }
    );
    expect(getDataMock).toHaveBeenNthCalledWith(
      3,
      '/v1/templates/pms/templates/organisation/org-1/users/me',
      { kind: 'SOAP_NOTE', status: 'PUBLISHED' }
    );
    expect(templates.map((item) => item.id)).toEqual(['tpl-1', 'tpl-2', 'tpl-3']);
  });

  it('returns available templates when one source fails', async () => {
    getDataMock
      .mockRejectedValueOnce(new Error('library down'))
      .mockResolvedValueOnce({ data: [template('tpl-2', 'Org SOAP')] })
      .mockResolvedValueOnce({ data: [] });

    await expect(listSoapTemplatesForWorkspace('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'tpl-2', name: 'Org SOAP' }),
    ]);
  });

  it('loads published vitals templates for workspace record flows', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ ...template('tpl-vitals', 'Vitals'), kind: 'VITAL_RECORD' }],
      })
      .mockResolvedValueOnce({ data: [] });

    await expect(listVitalsTemplates('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'tpl-vitals', kind: 'VITAL_RECORD' }),
    ]);

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'VITAL_RECORD',
      status: 'PUBLISHED',
    });
  });

  it('loads published discharge summary templates for workspace summary flows', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ ...template('tpl-discharge', 'Discharge'), kind: 'DISCHARGE_SUMMARY' }],
      })
      .mockResolvedValueOnce({ data: [] });

    await expect(listDischargeSummaryTemplates('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'tpl-discharge', kind: 'DISCHARGE_SUMMARY' }),
    ]);

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'DISCHARGE_SUMMARY',
      status: 'PUBLISHED',
    });
  });

  it('maps backend templates to SOAP template options', () => {
    expect(templateToSoapTemplate({ ...template('tpl-yc'), ownership: 'YC_LIBRARY' })).toEqual({
      id: 'tpl-yc',
      name: 'tpl-yc',
      serviceId: 'svc-1',
      isDefault: true,
    });
  });

  it('loads a single workspace template by id', async () => {
    getDataMock.mockResolvedValueOnce({ data: template('tpl-1', 'SOAP') });

    await expect(getWorkspaceTemplateById('org-1', 'tpl-1')).resolves.toEqual(
      expect.objectContaining({ id: 'tpl-1' })
    );

    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1'
    );
  });

  it('updates catalog links for a workspace template', async () => {
    patchDataMock.mockResolvedValueOnce({
      data: { ...template('tpl-1'), catalogItemIds: ['svc-2'] },
    });

    await updateWorkspaceTemplateCatalogLinks('org-1', 'tpl-1', ['svc-2']);

    expect(patchDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1/catalog-links',
      { catalogItemIds: ['svc-2'] }
    );
  });

  it('creates a template instance for workspace schedule application', async () => {
    postDataMock.mockResolvedValueOnce({
      data: { id: 'instance-1', templateId: 'tpl-1', organisationId: 'org-1' },
    });

    const instance = await createWorkspaceTemplateInstance('org-1', 'tpl-1', {
      appointmentId: 'appt-1',
      encounterId: 'enc-1',
      authorId: 'user-1',
      data: {},
      status: 'DRAFT',
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1/instances',
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
        data: {},
        status: 'DRAFT',
      }
    );
    expect(instance.id).toBe('instance-1');
  });

  it('updates and submits a workspace template instance', async () => {
    patchDataMock.mockResolvedValueOnce({
      data: { id: 'instance-1', templateId: 'tpl-1', status: 'IN_PROGRESS' },
    });
    postDataMock.mockResolvedValueOnce({
      data: { id: 'instance-1', templateId: 'tpl-1', status: 'SUBMITTED' },
    });

    await updateWorkspaceTemplateInstance('org-1', 'instance-1', {
      data: { subjective: { chiefComplaint: 'Vomiting' } },
      status: 'IN_PROGRESS',
    });
    await submitWorkspaceTemplateInstance('org-1', 'instance-1');

    expect(patchDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/template-instances/organisation/org-1/instance-1',
      {
        data: { subjective: { chiefComplaint: 'Vomiting' } },
        status: 'IN_PROGRESS',
      }
    );
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/template-instances/organisation/org-1/instance-1/submit'
    );
  });

  it('applies an inpatient schedule template instance through FHIR Parameters', async () => {
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'Task', id: 'schedule-1' } });

    await applyInpatientScheduleTemplate('org-1', 'instance-1', {
      force: true,
      notify: false,
      deferUntil: '2026-04-25T09:00:00.000Z',
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$apply',
      {
        resourceType: 'Parameters',
        parameter: [
          { name: 'force', valueBoolean: true },
          { name: 'notify', valueBoolean: false },
          { name: 'deferUntil', valueDateTime: '2026-04-25T09:00:00.000Z' },
        ],
      }
    );
  });

  it('calls schedule lifecycle operations through FHIR task-schedule endpoints', async () => {
    postDataMock.mockResolvedValue({ data: { resourceType: 'Task', id: 'schedule-1' } });

    await pauseInpatientScheduleTemplate('org-1', 'instance-1');
    await resumeInpatientScheduleTemplate('org-1', 'instance-1', { notify: true });
    await cancelInpatientScheduleTemplate('org-1', 'instance-1');
    await regenerateInpatientScheduleTemplate('org-1', 'instance-1', {
      deferUntil: '2026-04-25T09:00:00.000Z',
    });

    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$pause',
      { resourceType: 'Parameters', parameter: [] }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$resume',
      { resourceType: 'Parameters', parameter: [{ name: 'notify', valueBoolean: true }] }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      3,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$cancel',
      { resourceType: 'Parameters', parameter: [] }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      4,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$regenerate',
      {
        resourceType: 'Parameters',
        parameter: [{ name: 'deferUntil', valueDateTime: '2026-04-25T09:00:00.000Z' }],
      }
    );
  });

  it('calls encounter schedule read endpoint', async () => {
    getDataMock.mockResolvedValueOnce({ data: { resourceType: 'Task', id: 'schedule-1' } });

    await getInpatientScheduleForEncounter('org-1', 'enc-1');

    expect(getDataMock).toHaveBeenCalledWith(
      '/fhir/v1/task-schedule/organisation/org-1/encounter/enc-1'
    );
    expect(postDataMock).not.toHaveBeenCalled();
  });
});
