import { Types } from "mongoose";
import { FormService, FormServiceError } from "../../src/services/form.service";
import { prisma } from "src/config/prisma";
import { DocumensoService } from "../../src/services/documenso.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { TemplateService } from "../../src/services/template.service";
import { FormAssignmentService } from "../../src/services/form-assignment.service";
import { templateMapper } from "../../src/services/fhir-template.mapper";
import {
  buildPdfViewModel,
  renderPdf,
} from "../../src/services/formPDF.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    form: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    formField: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    formVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    formSubmission: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    templateInstance: {
      findMany: jest.fn(),
    },
    appointment: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/services/template.service", () => ({
  TemplateService: {
    getById: jest.fn(),
  },
}));

jest.mock("../../src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    listForAppointment: jest.fn(),
  },
}));

jest.mock("../../src/services/fhir-template.mapper", () => ({
  templateMapper: {
    templateToQuestionnaire: jest.fn(),
    templateInstanceToQuestionnaireResponse: jest.fn(),
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  buildPdfViewModel: jest.fn(),
  renderPdf: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromFormRequestDTO: jest.fn((value) => value),
  toFormResponseDTO: jest.fn((value) => value),
  fromFormSubmissionRequestDTO: jest.fn((value) => value),
  toFHIRQuestionnaireResponse: jest.fn((value) => value),
  toFHIRQuestionnaire: jest.fn((value) => value),
}));

const mockedPrisma = prisma as any;

const resetMocks = () => {
  Object.values(mockedPrisma).forEach((group: any) => {
    if (group && typeof group === "object") {
      Object.values(group).forEach((fn) => {
        if (typeof fn === "function" && "mockReset" in fn) {
          (fn as jest.Mock).mockReset();
        }
      });
    }
  });

  (DocumensoService.downloadSignedDocument as jest.Mock).mockReset();
  (DocumensoService.resolveOrganisationApiKey as jest.Mock).mockReset();
  (AuditTrailService.recordSafely as jest.Mock).mockReset();
  (TemplateService.getById as jest.Mock).mockReset();
  (FormAssignmentService.listForAppointment as jest.Mock).mockReset();
  (templateMapper.templateToQuestionnaire as jest.Mock).mockReset();
  (
    templateMapper.templateInstanceToQuestionnaireResponse as jest.Mock
  ).mockReset();
  (buildPdfViewModel as jest.Mock).mockReset();
  (renderPdf as jest.Mock).mockReset();
  jest.clearAllMocks();
};

const makeId = () => new Types.ObjectId().toHexString();

const formRequest = (overrides: Record<string, unknown> = {}): any => ({
  name: "Annual Check-in",
  category: "Consent",
  description: "Form description",
  visibilityType: "External",
  serviceId: ["svc-1"],
  speciesFilter: ["dog"],
  requiredSigner: "PARENT",
  schema: [
    {
      id: "field-1",
      type: "text",
      label: "Question",
      required: true,
      order: 1,
    },
  ],
  ...overrides,
});

const formRecord = (overrides: Record<string, unknown> = {}) => ({
  id: makeId(),
  orgId: makeId(),
  businessType: null,
  name: "Annual Check-in",
  category: "Consent",
  description: "Form description",
  visibilityType: "External",
  serviceId: ["svc-1"],
  speciesFilter: ["dog"],
  requiredSigner: "PARENT",
  status: "draft",
  schema: [
    {
      id: "field-1",
      type: "text",
      label: "Question",
      required: true,
      order: 1,
    },
  ],
  createdBy: "creator-1",
  updatedBy: "updater-1",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  ...overrides,
});

const versionRecord = (overrides: Record<string, unknown> = {}) => ({
  id: makeId(),
  formId: makeId(),
  version: 1,
  schemaSnapshot: [
    {
      id: "field-1",
      type: "text",
      label: "Question",
      required: true,
      order: 1,
    },
  ],
  publishedAt: new Date("2024-01-03T00:00:00.000Z"),
  ...overrides,
});

const submissionRecord = (overrides: Record<string, unknown> = {}) => ({
  id: makeId(),
  formId: makeId(),
  formVersion: 1,
  appointmentId: undefined,
  patientId: undefined,
  parentId: undefined,
  submittedBy: "parent-1",
  answers: { answer: "yes" },
  submittedAt: new Date("2024-01-04T00:00:00.000Z"),
  signing: undefined,
  ...overrides,
});

describe("FormService", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("detects signature fields in nested groups", () => {
    expect(
      FormService.hasSignatureField([
        {
          id: "group-1",
          type: "group",
          label: "Group",
          fields: [
            {
              id: "sig-1",
              type: "signature",
              label: "Signature",
            },
          ],
        } as any,
      ]),
    ).toBe(true);
  });

  it("throws FormServiceError with the provided status code", () => {
    const error = new FormServiceError("Nope", 409);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("FormServiceError");
    expect(error.message).toBe("Nope");
    expect(error.statusCode).toBe(409);
  });

  it("creates a form and synchronises form fields", async () => {
    const orgId = makeId();
    const userId = "user-1";
    const created = formRecord({ orgId, createdBy: userId, updatedBy: userId });

    (mockedPrisma.form.create as jest.Mock).mockResolvedValue(created);
    (mockedPrisma.formField.deleteMany as jest.Mock).mockResolvedValue({});
    (mockedPrisma.formField.createMany as jest.Mock).mockResolvedValue({});
    (mockedPrisma.user.findMany as jest.Mock).mockResolvedValue([
      { userId, firstName: "Ada", lastName: "Lovelace" },
    ]);

    const result: any = await FormService.create(orgId, formRequest(), userId);

    expect(mockedPrisma.form.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId,
          createdBy: userId,
          updatedBy: userId,
          status: "draft",
        }),
      }),
    );
    expect(mockedPrisma.formField.deleteMany).toHaveBeenCalledWith({
      where: { formId: created.id },
    });
    expect(mockedPrisma.formField.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          formId: created.id,
          fieldId: "field-1",
          label: "Question",
        }),
      ]),
    });
    expect(result.createdBy).toBe("Ada Lovelace");
    expect(result.updatedBy).toBe("Ada Lovelace");
  });

  it("rejects create when orgId is invalid", async () => {
    await expect(
      FormService.create("invalid-org", formRequest(), "user-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("gets a form for admin and maps creator names", async () => {
    const orgId = makeId();
    const formId = makeId();
    const doc = formRecord({ id: formId, orgId });
    (mockedPrisma.form.findFirst as jest.Mock).mockResolvedValue(doc);
    (mockedPrisma.user.findMany as jest.Mock).mockResolvedValue([
      { userId: "creator-1", firstName: "Grace", lastName: "Hopper" },
      { userId: "updater-1", firstName: "Grace", lastName: "Hopper" },
    ]);

    const result: any = await FormService.getFormForAdmin(orgId, formId);

    expect(mockedPrisma.form.findFirst).toHaveBeenCalledWith({
      where: { id: formId, orgId },
    });
    expect(result.createdBy).toBe("Grace Hopper");
    expect(result.updatedBy).toBe("Grace Hopper");
  });

  it("throws when the form for admin does not exist", async () => {
    (mockedPrisma.form.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      FormService.getFormForAdmin(makeId(), makeId()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("gets the latest published form for user access", async () => {
    const formId = makeId();
    const version = versionRecord({ formId, version: 4 });
    const form = formRecord({ id: formId, status: "published" });
    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue(
      version,
    );
    (mockedPrisma.form.findUnique as jest.Mock).mockResolvedValue(form);

    const result: any = await FormService.getFormForUser(formId);

    expect(mockedPrisma.formVersion.findFirst).toHaveBeenCalledWith({
      where: { formId },
      orderBy: { version: "desc" },
    });
    expect(result._id).toBe(formId);
    expect(result.schema).toEqual(version.schemaSnapshot);
  });

  it("fails when there is no published version for user access", async () => {
    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(FormService.getFormForUser(makeId())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("updates a form and rewrites fields", async () => {
    const orgId = makeId();
    const formId = makeId();
    const userId = "user-2";
    const existing = formRecord({ id: formId, orgId, createdBy: userId });
    const updated = { ...existing, updatedBy: userId };

    (mockedPrisma.form.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockedPrisma.form.update as jest.Mock).mockResolvedValue(updated);
    (mockedPrisma.formField.deleteMany as jest.Mock).mockResolvedValue({});
    (mockedPrisma.formField.createMany as jest.Mock).mockResolvedValue({});
    (mockedPrisma.user.findMany as jest.Mock).mockResolvedValue([
      { userId, firstName: "Marie", lastName: "Curie" },
    ]);

    const result: any = await FormService.update(
      formId,
      formRequest({ name: "Updated Form" }),
      userId,
      orgId,
    );

    expect(mockedPrisma.form.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: formId },
        data: expect.objectContaining({
          name: "Updated Form",
          updatedBy: userId,
          status: "draft",
        }),
      }),
    );
    expect(result.updatedBy).toBe("Marie Curie");
  });

  it("rejects updates when the form belongs to another organisation", async () => {
    (mockedPrisma.form.findUnique as jest.Mock).mockResolvedValue(
      formRecord({ orgId: makeId() }),
    );

    await expect(
      FormService.update(makeId(), formRequest(), "user-1", makeId()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("publishes, unpublishes and archives a form", async () => {
    const formId = makeId();
    (mockedPrisma.form.findUnique as jest.Mock).mockResolvedValue(
      formRecord({ id: formId, status: "draft" }),
    );
    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue({
      version: 2,
    });
    (mockedPrisma.formVersion.create as jest.Mock).mockResolvedValue({});
    (mockedPrisma.form.update as jest.Mock).mockResolvedValue({
      ...formRecord({ id: formId, status: "published" }),
      updatedBy: "user-3",
    });

    const publishResult = await FormService.publish(formId, "user-3");
    expect(publishResult).toEqual({ formId, version: 3 });

    (mockedPrisma.form.update as jest.Mock).mockResolvedValue(
      formRecord({ id: formId, status: "draft", updatedBy: "user-3" }),
    );
    const unpublished = await FormService.unpublish(formId, "user-3");
    expect(unpublished.status).toBe("draft");

    (mockedPrisma.form.update as jest.Mock).mockResolvedValue(
      formRecord({ id: formId, status: "archived", updatedBy: "user-3" }),
    );
    const archived = await FormService.archive(formId, "user-3");
    expect(archived.status).toBe("archived");
  });

  it("submits FHIR data, updates the appointment and records an audit trail", async () => {
    const formId = makeId();
    const appointmentId = makeId();
    const patientId = makeId();
    const parentId = makeId();
    const submissionId = makeId();
    const formName = "Consent Form";

    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue({
      schemaSnapshot: [
        {
          id: "field-1",
          type: "text",
          label: "Question",
          required: true,
        },
      ],
    });
    (mockedPrisma.formSubmission.create as jest.Mock).mockResolvedValue({
      id: submissionId,
    });
    (mockedPrisma.form.findUnique as jest.Mock).mockResolvedValue({
      orgId: makeId(),
      name: formName,
    });
    (mockedPrisma.appointment.updateMany as jest.Mock).mockResolvedValue({});

    const result: any = await FormService.submitFHIR({
      formId,
      formVersion: 1,
      appointmentId,
      patientId,
      parentId,
      submittedBy: "parent-1",
      answers: { consent: true },
      submittedAt: new Date("2024-01-05T00:00:00.000Z"),
    } as any);

    expect(mockedPrisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formId,
          appointmentId,
          patientId,
        }),
      }),
    );
    expect(mockedPrisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: appointmentId },
      data: { formIds: { push: formId } },
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledTimes(1);
    expect(
      (AuditTrailService.recordSafely as jest.Mock).mock.calls[0]?.[0],
    ).toMatchObject({
      organisationId: expect.any(String),
      patientId,
      entityId: formId,
      actorType: "PARENT",
      actorId: parentId,
      metadata: {
        submissionId,
        appointmentId,
        formName,
      },
    });
    expect(result._id).toBe(submissionId);
  });

  it("gets a submission with the latest schema and signed PDF URL", async () => {
    const submissionId = makeId();
    const formId = makeId();
    (mockedPrisma.formSubmission.findUnique as jest.Mock).mockResolvedValue(
      submissionRecord({
        id: submissionId,
        formId,
        signing: {
          documentId: "123",
          required: true,
          status: "SIGNED",
          provider: "DOCUMENSO",
        },
      }),
    );
    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue({
      schemaSnapshot: [{ id: "field-1", type: "text", label: "Question" }],
    });

    const result: any = await FormService.getSubmission(submissionId);

    expect(mockedPrisma.formVersion.findFirst).toHaveBeenCalledWith({
      where: { formId, version: 1 },
    });
    expect(result.formId).toBe(formId);
  });

  it("lists submissions for a form", async () => {
    const formId = makeId();
    const rows = [submissionRecord({ formId })];
    (mockedPrisma.formSubmission.findMany as jest.Mock).mockResolvedValue(rows);

    await expect(FormService.listSubmissions(formId)).resolves.toEqual(rows);
  });

  it("filters companion submissions by organisation ownership", async () => {
    const organisationId = makeId();
    const patientId = makeId();
    const appointmentId = makeId();
    const formId = makeId();
    const otherFormId = makeId();

    (mockedPrisma.formSubmission.findMany as jest.Mock).mockResolvedValue([
      submissionRecord({
        id: makeId(),
        formId,
        appointmentId,
        patientId,
        submittedBy: "parent-1",
      }),
      submissionRecord({
        id: makeId(),
        formId: otherFormId,
        patientId,
        submittedBy: "parent-2",
      }),
    ]);
    (mockedPrisma.form.findMany as jest.Mock).mockResolvedValue([
      {
        id: formId,
        name: "SOAP Plan",
        category: "SOAP-Plan",
        orgId: organisationId,
      },
      { id: otherFormId, name: "Other", category: "Consent", orgId: makeId() },
    ]);
    (mockedPrisma.appointment.findMany as jest.Mock).mockResolvedValue([
      { id: appointmentId, organisationId },
    ]);

    const result = await FormService.listSubmissionsForCompanionInOrganisation({
      organisationId,
      patientId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.formName).toBe("SOAP Plan");
    expect(result[0]?.formCategory).toBe("SOAP-Plan");
  });

  it("returns auto-send forms and list forms for organisation", async () => {
    const orgId = makeId();
    (mockedPrisma.form.findMany as jest.Mock).mockResolvedValue([
      formRecord({ orgId, status: "published" }),
    ]);
    (mockedPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const autoSend = await FormService.getAutoSendForms(orgId, "svc-1");
    expect(autoSend).toHaveLength(1);

    const listed = await FormService.listFormsForOrganisation(orgId);
    expect(listed).toHaveLength(1);
  });

  it("returns the first published external consent form and its latest version", async () => {
    const orgId = makeId();
    const formId = makeId();
    (mockedPrisma.form.findFirst as jest.Mock).mockResolvedValue(
      formRecord({
        id: formId,
        orgId,
        category: "Consent",
        visibilityType: "External",
        status: "published",
      }),
    );
    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue({
      schemaSnapshot: [{ id: "field-1", type: "text", label: "Question" }],
    });

    const result: any = await FormService.getConsentFormForParent(orgId, {
      serviceId: "svc-1",
      species: "dog",
    });

    expect(result._id).toBe(formId);
    expect(result.schema).toEqual([
      { id: "field-1", type: "text", label: "Question" },
    ]);
  });

  it("renders a PDF for a submission", async () => {
    const submissionId = makeId();
    const formId = makeId();
    (mockedPrisma.formSubmission.findUnique as jest.Mock).mockResolvedValue(
      submissionRecord({ id: submissionId, formId }),
    );
    (mockedPrisma.formVersion.findFirst as jest.Mock).mockResolvedValue({
      schemaSnapshot: [{ id: "field-1", type: "text", label: "Question" }],
    });
    (buildPdfViewModel as jest.Mock).mockReturnValue({ title: "vm" });
    (renderPdf as jest.Mock).mockResolvedValue(Buffer.from("pdf"));

    await expect(
      FormService.generatePDFForSubmission(submissionId),
    ).resolves.toEqual(Buffer.from("pdf"));
    expect(buildPdfViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        title: `Form Submission - ${formId}`,
      }),
    );
  });

  it("returns questionnaire and questionnaire responses for appointment forms", async () => {
    const appointmentId = makeId();
    const orgId = makeId();
    const formId = makeId();
    const templateId = makeId();

    (mockedPrisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId: orgId,
      formIds: [formId],
      patient: { parent: { id: makeId() } },
    });
    (mockedPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      type: "HOSPITAL",
    });
    (mockedPrisma.form.findMany as jest.Mock).mockResolvedValue([
      {
        id: formId,
        orgId,
        businessType: null,
        name: "SOAP Plan",
        category: "SOAP-Plan",
        description: null,
        visibilityType: "Internal",
        serviceId: [],
        speciesFilter: [],
        requiredSigner: null,
        status: "published",
        schema: [{ id: "field-1", type: "text", label: "Question" }],
        createdBy: "creator",
        updatedBy: "updater",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      },
    ]);
    (mockedPrisma.formVersion.findMany as jest.Mock).mockResolvedValue([
      {
        id: makeId(),
        formId,
        version: 1,
        schemaSnapshot: [{ id: "field-1", type: "text", label: "Question" }],
      },
    ]);
    (mockedPrisma.formSubmission.findMany as jest.Mock).mockResolvedValue([
      submissionRecord({ formId }),
    ]);
    (FormAssignmentService.listForAppointment as jest.Mock).mockResolvedValue([
      { templateId, templateVersion: 1 },
    ]);
    (TemplateService.getById as jest.Mock).mockResolvedValue({
      id: templateId,
    });
    (mockedPrisma.templateInstance.findMany as jest.Mock).mockResolvedValue([
      { templateId, templateVersion: 1 },
    ]);
    (templateMapper.templateToQuestionnaire as jest.Mock).mockReturnValue({
      resourceType: "Questionnaire",
    });
    (
      templateMapper.templateInstanceToQuestionnaireResponse as jest.Mock
    ).mockReturnValue({ resourceType: "QuestionnaireResponse" });

    const result: any = await FormService.getFormsForAppointment({
      appointmentId,
      isPMS: false,
    });

    expect(result.appointmentId).toBe(appointmentId);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        questionnaire: { resourceType: "Questionnaire" },
        questionnaireResponse: { resourceType: "QuestionnaireResponse" },
      }),
    );
  });

  it("returns SOAP notes for a hospital appointment", async () => {
    const appointmentId = makeId();
    const orgId = makeId();
    const formId = makeId();

    (mockedPrisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId: orgId,
      patient: { parent: { id: makeId() } },
    });
    (mockedPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      type: "HOSPITAL",
    });
    (mockedPrisma.formSubmission.findMany as jest.Mock)
      .mockResolvedValueOnce([submissionRecord({ formId, appointmentId })])
      .mockResolvedValueOnce([submissionRecord({ formId, appointmentId })]);
    (mockedPrisma.form.findMany as jest.Mock).mockResolvedValue([
      { id: formId, category: "SOAP-Plan" },
    ]);

    const result: any = await FormService.getSOAPNotesByAppointment(
      appointmentId,
      {
        requesterOrgId: orgId,
      },
    );

    expect(result.appointmentId).toBe(appointmentId);
    expect(result.soapNotes.Plan).toHaveLength(1);
  });
});
