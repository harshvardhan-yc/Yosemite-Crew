import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Request, Response } from "express";
import { DocumensoWebhookController } from "../../../src/controllers/web/documenso.controller";
import { prisma } from "../../../src/config/prisma";
import { FormAssignmentService } from "../../../src/services/form-assignment.service";
import { DocumensoService } from "../../../src/services/documenso.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/utils/logger");
jest.mock("../../../src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    markSignedFromSubmission: jest.fn(),
  },
}));
jest.mock("../../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));
jest.mock("../../../src/config/prisma", () => ({
  prisma: {
    formSubmission: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    form: {
      findUnique: jest.fn(),
    },
    renderedDocument: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("../../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => true),
}));

const mockedLogger = jest.mocked(logger);

describe("DocumensoWebhookController", () => {
  const originalSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let endMock: jest.Mock;

  beforeAll(() => {
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.DOCUMENSO_WEBHOOK_SECRET;
      return;
    }

    process.env.DOCUMENSO_WEBHOOK_SECRET = originalSecret;
  });

  beforeEach(() => {
    jsonMock = jest.fn();
    endMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, end: endMock });

    req = {
      body: Buffer.from(
        JSON.stringify({
          event: undefined,
          payload: { id: 'doc-123"}\n{"level":"error"' },
        }),
      ),
      headers: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      end: endMock,
    } as unknown as Response;

    jest.clearAllMocks();
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  });

  it("logs a static message for invalid payloads without including request data", async () => {
    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "[DocumensoWebhook] Invalid payload",
    );
    expect(mockedLogger.error).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid payload" });
  });

  it("syncs signed form assignments when a document completes", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-123" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;

    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-1",
      formId: "form-1",
      formVersion: 2,
      appointmentId: "appt-1",
      patientId: "comp-1",
      parentId: "parent-1",
      signing: {
        status: "IN_PROGRESS",
        documentId: "doc-123",
      },
    });
    mockedPrisma.formSubmission.update.mockResolvedValue(undefined);
    mockedPrisma.form.findUnique.mockResolvedValue({
      orgId: "org-1",
      name: "Intake",
    });

    const mockedDocumensoService = DocumensoService as unknown as {
      resolveOrganisationApiKey: jest.Mock;
      downloadSignedDocument: jest.Mock;
    };
    (mockedDocumensoService.resolveOrganisationApiKey as any).mockResolvedValue(
      "documenso-key",
    );
    (mockedDocumensoService.downloadSignedDocument as any).mockResolvedValue({
      downloadUrl: "https://files.example/signed.pdf",
    });

    const mockedAssignmentService = FormAssignmentService as unknown as {
      markSignedFromSubmission: jest.Mock;
    };
    (
      mockedAssignmentService.markSignedFromSubmission as any
    ).mockResolvedValueOnce(null);

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(
      mockedAssignmentService.markSignedFromSubmission,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        templateId: "form-1",
        templateVersion: 2,
        appointmentId: "appt-1",
        companionId: "comp-1",
        parentId: "parent-1",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });
});
