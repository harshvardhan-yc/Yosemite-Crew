import { TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  buildPrescriptionLabelPdfInput,
  renderCombinedClinicalPacketPdf,
  renderPrescriptionLabelPdf,
  renderRenderedDocumentPdf,
} from "../../src/services/rendered-document-renderer.service";
import { renderPdf } from "../../src/services/formPDF.service";
import {
  generateClinicalPdf,
  generateClinicalPdfWithMetadata,
  generateCombinedClinicalPdfWithMetadata,
  generateResolvedTemplatePdfWithMetadata,
} from "@yosemite-crew/lib";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
    },
    roomUnit: {
      findUnique: jest.fn(),
    },
    organisationRoom: {
      findUnique: jest.fn(),
    },
    roomUnitAssignment: {
      findFirst: jest.fn(),
    },
    formSubmission: {
      findUnique: jest.fn(),
    },
    form: {
      findUnique: jest.fn(),
    },
    formVersion: {
      findUnique: jest.fn(),
    },
    templateInstance: {
      findUnique: jest.fn(),
    },
    templateVersion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    soapNote: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    prescription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    dischargeSummary: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    vitalRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  renderPdf: jest.fn(),
}));

jest.mock("@yosemite-crew/lib", () => ({
  generateClinicalPdf: jest.fn(),
  generateClinicalPdfWithMetadata: jest.fn(),
  generateCombinedClinicalPdfWithMetadata: jest.fn(),
  generateResolvedTemplatePdfWithMetadata: jest.fn(),
}));

describe("rendered-document-renderer service", () => {
  const mockedPrisma = prisma as unknown as {
    organization: { findUnique: jest.Mock };
    appointment: { findUnique: jest.Mock };
    admission: { findUnique: jest.Mock };
    roomUnit: { findUnique: jest.Mock };
    organisationRoom: { findUnique: jest.Mock };
    roomUnitAssignment: { findFirst: jest.Mock };
    formSubmission: { findUnique: jest.Mock };
    form: { findUnique: jest.Mock };
    formVersion: { findUnique: jest.Mock };
    templateInstance: { findUnique: jest.Mock };
    templateVersion: { findUnique: jest.Mock; findFirst: jest.Mock };
    soapNote: { findUnique: jest.Mock; findFirst: jest.Mock };
    prescription: { findUnique: jest.Mock; findFirst: jest.Mock };
    dischargeSummary: { findUnique: jest.Mock; findFirst: jest.Mock };
    vitalRecord: { findUnique: jest.Mock; findFirst: jest.Mock };
    inventoryItem: { findMany: jest.Mock };
    user: { findFirst: jest.Mock };
  };
  const mockedRenderPdf = renderPdf as jest.Mock;
  const mockedGenerateClinicalPdf = generateClinicalPdf as jest.Mock;
  const mockedGenerateClinicalPdfWithMetadata =
    generateClinicalPdfWithMetadata as jest.Mock;
  const mockedGenerateCombinedClinicalPdfWithMetadata =
    generateCombinedClinicalPdfWithMetadata as jest.Mock;
  const mockedGenerateResolvedTemplatePdfWithMetadata =
    generateResolvedTemplatePdfWithMetadata as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRenderPdf.mockResolvedValue(Buffer.from("pdf"));
    mockedGenerateClinicalPdf.mockResolvedValue(Buffer.from("label-pdf"));
    mockedPrisma.appointment.findUnique.mockResolvedValue(null);
    mockedPrisma.admission.findUnique.mockResolvedValue(null);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue(null);
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue(null);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null);
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([]);
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedGenerateClinicalPdfWithMetadata.mockResolvedValue({
      pdf: Buffer.from("pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedGenerateCombinedClinicalPdfWithMetadata.mockResolvedValue({
      pdf: Buffer.from("combined-pdf"),
      pageCount: 2,
      signaturePlacement: {
        pageNumber: 2,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedGenerateResolvedTemplatePdfWithMetadata.mockResolvedValue({
      pdf: Buffer.from("pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
  });

  it("renders a template instance document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: "https://cdn.example/logo.png",
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 3,
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      authorId: "author-1",
      status: "COMPLETED",
      data: {
        patient: { name: "Milo" },
        consent: true,
        weight: 5.2,
      },
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      template: {
        name: "Intake Consent",
        kind: TemplateKind.FORM,
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-1",
      version: 3,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Intake Consent",
      source: {
        sourceKind: "TEMPLATE_INSTANCE",
        sourceId: "instance-1",
        organisationId: "org-1",
        templateKind: TemplateKind.FORM,
        templateId: "template-1",
        templateVersion: 3,
      },
    });

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake Consent",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "123 Clinic Road",
          logoUrl: "https://cdn.example/logo.png",
        }),
        template: expect.objectContaining({
          name: "Intake Consent",
          source: "TEMPLATE_INSTANCE",
          schemaSnapshot: expect.objectContaining({
            sections: [],
          }),
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
      }),
    );
  });

  it("renders a form submission document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: "https://cdn.example/logo.png",
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-1",
      formId: "form-1",
      formVersion: 1,
      appointmentId: "appt-1",
      companionId: null,
      parentId: "parent-1",
      submittedBy: "user-1",
      answers: {
        patientName: "Milo",
        consent: true,
      },
      submittedAt: new Date("2026-06-14T00:00:00.000Z"),
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Intake Consent",
      category: "CONSENT",
      orgId: "org-1",
      schema: {},
    });
    mockedPrisma.formVersion.findUnique.mockResolvedValueOnce({
      schemaSnapshot: [],
    });

    await renderRenderedDocumentPdf({
      title: "Intake Consent",
      source: {
        sourceKind: "FORM_SUBMISSION",
        sourceId: "submission-1",
        organisationId: "org-1",
        templateKind: "FORM",
        templateId: "form-1",
        templateVersion: 1,
      },
    });

    expect(mockedRenderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake Consent",
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Document Details" }),
          expect.objectContaining({ title: "Captured Data" }),
        ]),
      }),
      expect.objectContaining({
        templateKind: "FORM",
      }),
    );
  });

  it("renders a SOAP note document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: "https://cdn.example/logo.png",
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: "soap-1",
      subjective: { history: "shortness of breath" },
      objective: { temp: 39.1 },
      assessment: { impression: "bronchitis" },
      plan: { treatment: "rest" },
      diagnoses: [{ code: "J20" }],
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "SIGNED",
        templateId: "template-1",
        templateVersion: 2,
        templateVersionId: "template-version-1",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "SOAP summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-1",
      version: 2,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "SOAP Note",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "soap-1",
        organisationId: "org-1",
        templateKind: "SOAP_NOTE",
        templateId: "template-1",
        templateVersion: 2,
      },
    });

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "SOAP Note",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "123 Clinic Road",
          logoUrl: "https://cdn.example/logo.png",
        }),
        template: expect.objectContaining({
          source: "CLINICAL_ARTIFACT",
          name: "SOAP Note",
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
      }),
    );
  });

  it("renders a prescription document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      patient: {
        name: "Bella Hadid",
        species: "Canine",
        breed: "Bulldog",
        parent: {
          id: "CL-1001",
          name: "Yasmin Hadid",
          phoneNumber: "(512) 555 0111",
        },
      },
      lead: {
        name: "Dr. Tim Apple",
      },
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
      id: "rx-1",
      appointmentId: "appt-1",
      items: [],
      medications: [{ name: "Carprofen" }],
      instructions: ["Once daily"],
      notes: { note: "with food" },
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "template-2",
        templateVersion: 1,
        templateVersionId: "template-version-2",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-2",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Prescription",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "rx-1",
        organisationId: "org-1",
        templateKind: "PRESCRIPTION",
        templateVersion: 1,
      },
    });

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Prescription",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "MediCare Hospital",
          logoUrl: null,
        }),
        data: expect.objectContaining({
          leadName: "Dr. Tim Apple",
          patientName: "Bella Hadid",
          clientName: "Yasmin Hadid",
          clientContact: "(512) 555 0111",
        }),
        template: expect.objectContaining({
          source: "CLINICAL_ARTIFACT",
          name: "Prescription",
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
      }),
    );
  });

  it("renders a vital record document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
      id: "vital-1",
      measuredAt: new Date("2026-06-14T00:00:00.000Z"),
      recordedBy: "tech-1",
      vitals: { heartRate: 88 },
      notes: null,
      metadata: { source: "device" },
      artifact: {
        id: "artifact-3",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "VITAL_RECORD",
        status: "SIGNED",
        templateId: "template-3",
        templateVersion: 1,
        templateVersionId: "template-version-3",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Vital summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-3",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Vital Record",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "vital-1",
        organisationId: "org-1",
        templateKind: "VITAL_RECORD",
        templateVersion: 1,
      },
    });

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Vital Record",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "123 Clinic Road",
          logoUrl: null,
        }),
        template: expect.objectContaining({
          source: "CLINICAL_ARTIFACT",
          name: "Vital Record",
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
      }),
    );
  });

  it("renders a vital record document without template metadata through the fallback path", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
      id: "vital-plain-1",
      measuredAt: new Date("2026-06-14T00:00:00.000Z"),
      recordedBy: null,
      vitals: [
        { label: "Heart rate", value: 88, unit: "bpm" },
        { label: "Temperature", value: 38.7, unit: "C" },
      ],
      notes: "Patient stable",
      metadata: { author: "vet-1", ward: "ICU" },
      artifact: {
        id: "artifact-plain-3",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "VITAL_RECORD",
        status: "DRAFT",
        templateId: "template-3",
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Vital summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findFirst.mockResolvedValueOnce(null);

    await renderRenderedDocumentPdf({
      title: "Vital Record",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "vital-plain-1",
        organisationId: "org-1",
        templateKind: "VITAL_RECORD",
      },
    });

    expect(mockedPrisma.templateVersion.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.templateVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "template-3" },
        orderBy: { version: "desc" },
      }),
    );
    expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "VITAL_RECORD",
        data: expect.objectContaining({
          title: "Vital Record",
          recordedBy: "author-1",
          measurements: [
            {
              label: "Heart rate",
              value: "88",
              unit: "bpm",
            },
            {
              label: "Temperature",
              value: "38.7",
              unit: "C",
            },
          ],
          notes: "Patient stable",
          metadata: { author: "vet-1", ward: "ICU" },
          signature: expect.objectContaining({
            status: "PENDING",
          }),
        }),
      }),
    );
  });

  it("renders a clinical artifact without loading template metadata when templateId is missing", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: "soap-plain-1",
      subjective: { history: "vomiting" },
      objective: { temp: 38.9 },
      assessment: { impression: "gastritis" },
      plan: { treatment: "fluid therapy" },
      diagnoses: [],
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-plain-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "SOAP summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    await renderRenderedDocumentPdf({
      title: "SOAP Note",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "soap-plain-1",
        organisationId: "org-1",
        templateKind: "SOAP_NOTE",
      },
    });

    expect(mockedPrisma.templateVersion.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.templateVersion.findFirst).not.toHaveBeenCalled();
    expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "SOAP_NOTE",
        data: expect.objectContaining({
          title: "SOAP Note",
          subjective: { history: "vomiting" },
          objective: { temp: 38.9 },
          assessment: { impression: "gastritis" },
          plan: { treatment: "fluid therapy" },
          signature: expect.objectContaining({
            status: "PENDING",
          }),
        }),
      }),
    );
  });

  it("rejects unsupported source kinds", async () => {
    await expect(
      renderRenderedDocumentPdf({
        title: "Unsupported",
        source: {
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: "missing",
          organisationId: "org-1",
          templateKind: "INPATIENT_SCHEDULE",
        },
      }),
    ).rejects.toThrow("Template instance not found");
  });

  it("rejects template instances outside the organisation", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-2",
      templateId: "template-1",
      templateVersion: 3,
      appointmentId: null,
      caseId: null,
      encounterId: null,
      authorId: null,
      status: "COMPLETED",
      data: {},
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      template: {
        name: "Intake Consent",
        kind: TemplateKind.FORM,
      },
    });

    await expect(
      renderRenderedDocumentPdf({
        title: "Intake Consent",
        source: {
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: "instance-1",
          organisationId: "org-1",
          templateKind: TemplateKind.FORM,
          templateId: "template-1",
          templateVersion: 3,
        },
      }),
    ).rejects.toThrow("Template instance does not belong to organisation");
  });

  it("rejects missing clinical artifact records", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.soapNote.findFirst.mockResolvedValueOnce(null);

    await expect(
      renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-missing",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
          templateVersion: 2,
        },
      }),
    ).rejects.toThrow("SOAP note not found");
  });

  it("falls back to artifactId when rendering a persisted clinical artifact", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      items: [],
      medications: [{ name: "Carprofen" }],
      instructions: ["Once daily"],
      notes: { note: "with food" },
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: null,
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "template-2",
        templateVersion: 1,
        templateVersionId: "template-version-2",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-2",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Prescription",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-2",
        organisationId: "org-1",
        templateKind: "PRESCRIPTION",
        templateVersion: 1,
      },
    });

    expect(mockedPrisma.prescription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "artifact-2" } }),
    );
    expect(mockedPrisma.prescription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { artifactId: "artifact-2" },
      }),
    );
    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalled();
  });

  it("uses the latest template version when the artifact version is missing", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      items: [],
      medications: [{ name: "Carprofen" }],
      instructions: ["Once daily"],
      notes: { note: "with food" },
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: null,
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "template-2",
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findFirst.mockResolvedValueOnce({
      id: "template-version-latest",
      version: 9,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Prescription",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-2",
        organisationId: "org-1",
        templateKind: "PRESCRIPTION",
        templateVersion: 1,
      },
    });

    expect(mockedPrisma.templateVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "template-2" },
        orderBy: { version: "desc" },
      }),
    );
    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          templateVersion: 9,
          templateVersionId: "template-version-latest",
        }),
      }),
    );
  });

  describe("prescription label PDF", () => {
    const labelOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    };

    const buildLabelPrescription = (
      overrides: {
        items?: unknown[];
        medications?: unknown;
      } = {},
    ) => ({
      id: "rx-1",
      items: overrides.items ?? [
        {
          medication: "Carprofen",
          strength: "25mg",
          dosage: "1 tablet",
          route: "PO",
          frequency: "BID",
          duration: "7 days",
          quantity: "14",
          instructions: "Give with food.",
          sortOrder: 0,
        },
      ],
      medications: overrides.medications ?? [
        { inventoryItemId: "inv-controlled" },
      ],
      instructions: null,
      notes: null,
      metadata: { clientName: "Yasmin Hadid" },
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "template-2",
        templateVersion: 1,
        templateVersionId: "template-version-2",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    it("maps prescription fields and marks controlled items", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
        patient: {
          name: "Bella Hadid",
          parent: { id: "CL-1001", name: "Yasmin Hadid" },
        },
        lead: { name: "Dr. Tim Apple" },
      });
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription(),
      );
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        { id: "inv-controlled", controlledItem: true },
      ]);

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1", id: { in: ["inv-controlled"] } },
        }),
      );
      expect(input.documentType).toBe("PRESCRIPTION_LABEL");
      expect(input.organization.name).toBe("MediCare Hospital");
      expect(input.data).toEqual(
        expect.objectContaining({
          patientName: "Bella Hadid",
          clientName: "Yasmin Hadid",
          prescriberName: "Dr. Tim Apple",
          organisationName: "MediCare Hospital",
          prescriptionId: "rx-1",
        }),
      );
      expect(input.data.items[0]).toEqual(
        expect.objectContaining({
          medication: "Carprofen",
          strength: "25mg",
          dosage: "1 tablet",
          route: "PO",
          frequency: "BID",
          duration: "7 days",
          quantity: "14",
          instructions: "Give with food.",
          controlled: true,
        }),
      );
    });

    it("treats items as not controlled when the inventory item is not controlled", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription(),
      );
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        { id: "inv-controlled", controlledItem: false },
      ]);

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(input.data.items[0].controlled).toBe(false);
    });

    it("treats items with no inventory link as not controlled", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription({ medications: [] }),
      );

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
      expect(input.data.items[0].controlled).toBe(false);
    });

    it("renders label PDF bytes via the clinical PDF engine", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription({ medications: [] }),
      );

      const pdf = await renderPrescriptionLabelPdf({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(mockedGenerateClinicalPdf).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: "PRESCRIPTION_LABEL" }),
      );
      expect(pdf).toEqual(Buffer.from("label-pdf"));
    });

    it("throws when the prescription label record is missing", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(null);

      await expect(
        renderPrescriptionLabelPdf({
          organisationId: "org-1",
          prescriptionId: "rx-missing",
        }),
      ).rejects.toThrow("Prescription not found");
    });
  });

  describe("template-free clinical artifact signature", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const signedSoapNote = () => ({
      id: "soap-signed-1",
      subjective: { history: "cough" },
      objective: { temp: 38.5 },
      assessment: { impression: "kennel cough" },
      plan: { treatment: "rest" },
      diagnoses: [],
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-signed-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "signer-user-id",
        signedAt: new Date("2026-06-20T00:00:00.000Z"),
        summary: "SOAP summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    it("renders a SIGNED signature with resolved signer name/email and authMethod", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(signedSoapNote());
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Tim",
        lastName: "Apple",
        email: "tim.apple@example.com",
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-1",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "signer-user-id" },
        }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            signature: {
              status: "SIGNED",
              label: "Signature",
              signerName: "Tim Apple",
              signerEmail: "tim.apple@example.com",
              authMethod: "Email",
              signedAt: new Date("2026-06-20T00:00:00.000Z"),
            },
          }),
        }),
      );
    });

    it("still renders SIGNED with authMethod when the signer user cannot be resolved", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(signedSoapNote());
      mockedPrisma.user.findFirst.mockResolvedValueOnce(null);

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-1",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            signature: expect.objectContaining({
              status: "SIGNED",
              authMethod: "Email",
              signerName: undefined,
              signerEmail: undefined,
              signedAt: new Date("2026-06-20T00:00:00.000Z"),
            }),
          }),
        }),
      );
    });
  });

  describe("combined clinical packet header", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const unsignedArtifact = (overrides: Record<string, unknown>) => ({
      id: "artifact-x",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      kind: "SOAP_NOTE",
      status: "DRAFT",
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "summary",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      ...overrides,
    });

    it("merges appointment room/unit and client contact into the shared header even when SOAP is first", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // Appointment is read by each section builder AND once for the shared
      // header — keep the same record for every call.
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        patient: {
          name: "Bella Hadid",
          species: "Canine",
          breed: "Bulldog",
          parent: {
            id: "CL-1001",
            name: "Yasmin Hadid",
            phoneNumber: "(512) 555 0111",
          },
        },
        lead: { name: "Dr. Tim Apple" },
        room: {
          id: "room-1",
          name: "Exam Room 3",
          unit: { displayName: "Unit B" },
        },
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-combined-1",
        subjective: { history: "cough" },
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({ id: "art-soap", kind: "SOAP_NOTE" }),
      });
      mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
        id: "rx-combined-1",
        items: [],
        medications: [{ name: "Carprofen" }],
        instructions: [],
        notes: {},
        metadata: {},
        artifact: unsignedArtifact({ id: "art-rx", kind: "PRESCRIPTION" }),
      });

      const result = await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap",
            sourceId: "soap-combined-1",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
          {
            documentId: "doc-rx",
            sourceId: "rx-combined-1",
            kind: "PRESCRIPTION",
            title: "Prescription",
          },
        ],
      });

      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            patientName: "Bella Hadid",
            clientName: "Yasmin Hadid",
            clientId: "CL-1001",
            speciesBreed: "Canine / Bulldog",
            doctorName: "Dr. Tim Apple",
            clientContact: "(512) 555 0111",
            roomName: "Exam Room 3",
            unitName: "Unit B",
          }),
          signature: expect.objectContaining({ status: "PENDING" }),
        }),
      );
      expect(result.pdf).toEqual(Buffer.from("combined-pdf"));
    });

    it("leaves unitName undefined when the appointment room has no unit", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        patient: { name: "Milo", parent: { id: "CL-2", name: "Owner" } },
        lead: { name: "Dr. Vet" },
        room: { id: "room-2", name: "Ward A" },
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-combined-2",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({ id: "art-soap-2", kind: "SOAP_NOTE" }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-2",
            sourceId: "soap-combined-2",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            roomName: "Ward A",
            unitName: undefined,
          }),
        }),
      );
    });

    it("populates inpatient room/unit/admission details from admission, unit, room and assignment", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // First call (per-section header) returns the patient/lead; the shared
      // location lookup re-reads with the inpatient kind + encounter id.
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: "enc-inpatient",
        patient: {
          name: "Bella Hadid",
          parent: { id: "CL-1001", name: "Yasmin Hadid" },
        },
        lead: { name: "Dr. Tim Apple" },
        room: { id: "room-appt", name: "Reception" },
      });
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-inpatient",
        unitId: "unit-1",
        admittedAt: new Date("2026-06-20T09:30:00.000Z"),
        dischargedAt: null,
      });
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValueOnce({
        id: "assign-1",
        encounterId: "enc-inpatient",
        unitId: "unit-1",
        assignedAt: new Date("2026-06-20T09:30:00.000Z"),
        releasedAt: null,
        assignedBy: "admitting-user-id",
      });
      mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
        id: "unit-1",
        roomId: "room-ward",
        code: "U-1",
        displayName: "ICU Bed 4",
      });
      mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
        id: "room-ward",
        name: "Intensive Care Ward",
        code: "ICU",
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Nina",
        lastName: "Patel",
        email: "nina.patel@example.com",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-inpatient",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-inpatient",
          kind: "SOAP_NOTE",
          encounterId: "enc-inpatient",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-inpatient",
            sourceId: "soap-inpatient",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.admission.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounterId: "enc-inpatient" },
        }),
      );
      expect(mockedPrisma.roomUnitAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounterId: "enc-inpatient", releasedAt: null },
          orderBy: { assignedAt: "desc" },
        }),
      );
      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "admitting-user-id" },
        }),
      );
      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            roomName: "Intensive Care Ward",
            unitName: "ICU Bed 4",
            admittedAt: "2026-06-20 09:30",
            admittedBy: "Nina Patel",
          }),
        }),
      );
    });

    it("uses the appointment room and leaves admission details undefined for outpatient encounters", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "OUTPATIENT",
        encounterId: null,
        patient: { name: "Milo", parent: { id: "CL-2", name: "Owner" } },
        lead: { name: "Dr. Vet" },
        room: { id: "room-2", name: "Exam Room 7" },
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-outpatient",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-outpatient",
          kind: "SOAP_NOTE",
          encounterId: null,
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-outpatient",
            sourceId: "soap-outpatient",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.admission.findUnique).not.toHaveBeenCalled();
      expect(mockedPrisma.roomUnit.findUnique).not.toHaveBeenCalled();
      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            roomName: "Exam Room 7",
            unitName: undefined,
            admittedAt: undefined,
            admittedBy: undefined,
          }),
        }),
      );
    });
  });

  describe("vital record recorder and timestamp", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    it("resolves the VitalRecord.recordedBy user and formats measuredAt", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-recorder-1",
        measuredAt: new Date("2026-06-21T14:05:00.000Z"),
        recordedBy: "tech-user-id",
        vitals: { heartRate: 92 },
        notes: null,
        metadata: { author: "vet-1" },
        artifact: {
          id: "artifact-vital-recorder",
          organisationId: "org-1",
          appointmentId: "appt-1",
          caseId: null,
          encounterId: null,
          kind: "VITAL_RECORD",
          status: "DRAFT",
          templateId: null,
          templateVersion: null,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "Vital summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Ravi",
        lastName: "Kumar",
        email: "ravi.kumar@example.com",
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "vital-recorder-1",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "tech-user-id" },
        }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: "VITAL_RECORD",
          data: expect.objectContaining({
            recordedBy: "Ravi Kumar",
            recordedAt: "2026-06-21 14:05",
          }),
        }),
      );
    });
  });
});
