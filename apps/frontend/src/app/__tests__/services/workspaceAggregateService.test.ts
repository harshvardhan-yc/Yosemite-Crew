import {
  createEncounterDocumentPacket,
  createEncounterTreatmentItem,
  deleteEncounterTreatmentItem,
  getAppointmentWorkspaceBootstrap,
  getEncounterWorkspaceBootstrap,
  getWorkspaceDocumentPacket,
  listAppointmentWorkspaceDocuments,
  listCompanionMedicalRecords,
  listCompanionWorkspaceDocuments,
  listEncounterTreatmentItems,
  listEncounterWorkspaceDocuments,
  signWorkspaceDocumentPacket,
  updateEncounterTreatmentItem,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  deleteData: jest.fn(),
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

describe('workspaceAggregateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getData as jest.Mock).mockResolvedValue({ data: [] });
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'created' } });
    (patchData as jest.Mock).mockResolvedValue({ data: { id: 'updated' } });
    (deleteData as jest.Mock).mockResolvedValue({ data: undefined });
  });

  it('wraps workspace bootstrap and document list endpoints', async () => {
    await getAppointmentWorkspaceBootstrap('org-1', 'appt-1');
    await getEncounterWorkspaceBootstrap('org-1', 'enc-1');
    await listAppointmentWorkspaceDocuments('org-1', 'appt-1');
    await listEncounterWorkspaceDocuments('org-1', 'enc-1');
    await listCompanionWorkspaceDocuments('org-1', 'comp-1');
    await listCompanionMedicalRecords('org-1', 'comp-1');

    expect(getData).toHaveBeenNthCalledWith(
      1,
      '/v1/workspace/organisations/org-1/appointments/appt-1'
    );
    expect(getData).toHaveBeenNthCalledWith(
      2,
      '/v1/workspace/organisations/org-1/encounters/enc-1'
    );
    expect(getData).toHaveBeenNthCalledWith(
      3,
      '/v1/workspace/organisations/org-1/appointments/appt-1/documents'
    );
    expect(getData).toHaveBeenNthCalledWith(
      4,
      '/v1/workspace/organisations/org-1/encounters/enc-1/documents'
    );
    expect(getData).toHaveBeenNthCalledWith(
      5,
      '/v1/workspace/organisations/org-1/companions/comp-1/documents'
    );
    expect(getData).toHaveBeenNthCalledWith(
      6,
      '/v1/workspace/organisations/org-1/companions/comp-1/medical-records'
    );
  });

  it('wraps document packet endpoints', async () => {
    await createEncounterDocumentPacket('org-1', 'enc-1', { include: ['SOAP'] });
    await getWorkspaceDocumentPacket('org-1', 'packet-1');
    await signWorkspaceDocumentPacket('org-1', 'packet-1', { signatureText: 'Dr A' });

    expect(postData).toHaveBeenNthCalledWith(
      1,
      '/v1/workspace/organisations/org-1/encounters/enc-1/document-packet',
      { include: ['SOAP'] }
    );
    expect(getData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/document-packets/packet-1'
    );
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/v1/workspace/organisations/org-1/document-packets/packet-1/sign',
      { signatureText: 'Dr A' }
    );
  });

  it('wraps encounter treatment item CRUD endpoints', async () => {
    await listEncounterTreatmentItems('org-1', 'enc-1');
    await createEncounterTreatmentItem('org-1', 'enc-1', { productId: 'svc-1' });
    await updateEncounterTreatmentItem('org-1', 'item-1', { quantity: 2 });
    await deleteEncounterTreatmentItem('org-1', 'item-1');

    expect(getData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/treatment-items'
    );
    expect(postData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/encounters/enc-1/treatment-items',
      { productId: 'svc-1' }
    );
    expect(patchData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/item-1',
      { quantity: 2 }
    );
    expect(deleteData).toHaveBeenCalledWith(
      '/v1/workspace/organisations/org-1/treatment-items/item-1'
    );
  });
});
