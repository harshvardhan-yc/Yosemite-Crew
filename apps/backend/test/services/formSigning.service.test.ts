import { FormSigningService } from "../../src/services/formSigning.service";
import { FormModel, FormSubmissionModel } from "../../src/models/form";
import { ParentModel } from "../../src/models/parent";
import UserModel from "../../src/models/user";
import {
  createRenderedDocumentRecord,
  signPersistedRenderedDocument,
} from "../../src/services/rendered-document.service";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => false),
}));

jest.mock("../../src/models/form", () => ({
  FormModel: {
    findById: jest.fn(),
  },
  FormSubmissionModel: {
    findById: jest.fn(),
  },
  FormVersionModel: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/parent", () => ({
  ParentModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/rendered-document.service", () => ({
  createRenderedDocumentRecord: jest.fn(),
  signPersistedRenderedDocument: jest.fn(),
}));

const mockedFormSubmissionModel = FormSubmissionModel as unknown as {
  findById: jest.Mock;
};
const mockedFormModel = FormModel as unknown as {
  findById: jest.Mock;
};
const mockedParentModel = ParentModel as unknown as {
  findById: jest.Mock;
};
const mockedUserModel = UserModel as unknown as {
  findOne: jest.Mock;
};
const mockedCreateRenderedDocumentRecord =
  createRenderedDocumentRecord as jest.Mock;
const mockedSignPersistedRenderedDocument =
  signPersistedRenderedDocument as jest.Mock;

describe("FormSigningService.startSigning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOCUMENSO_URL = "https://documenso.example";
  });

  it("rejects parent signing when submission does not belong to the parent", async () => {
    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      parentId: "parent-owner",
    });

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-1",
        initiatedBy: "different-parent",
      }),
    ).rejects.toThrow("Unauthorized to sign this submission");

    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
    expect(mockedSignPersistedRenderedDocument).not.toHaveBeenCalled();
  });

  it("allows parent signing when submission belongs to the parent", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-1" },
      parentId: "parent-owner",
      formId: "form-1",
      formVersion: 1,
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
      save,
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Intake",
        orgId: "org-1",
        requiredSigner: "CLIENT",
      }),
    });

    mockedParentModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "parent@example.com",
        firstName: "Parent",
        lastName: "One",
      }),
    });

    mockedCreateRenderedDocumentRecord.mockResolvedValueOnce({
      id: "rendered-doc-1",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "rendered-doc-1",
      signing: {
        documentId: "123",
        signingUrl: "https://documenso.example/sign/recipient-token",
      },
    });

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-1",
        initiatedBy: "parent-owner",
      }),
    ).resolves.toEqual({
      documentId: "123",
      signingUrl: "https://documenso.example/sign/recipient-token",
    });

    expect(mockedCreateRenderedDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake",
        source: expect.objectContaining({
          sourceKind: "FORM_SUBMISSION",
          sourceId: "submission-1",
          organisationId: "org-1",
          templateKind: "FORM",
          templateId: "form-1",
          templateVersion: 1,
        }),
      }),
    );
    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        renderedDocumentId: "rendered-doc-1",
        organisationId: "org-1",
        signerType: "PARENT",
        signerEmail: "parent@example.com",
        signerName: "Parent One",
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("uses submission.submittedBy instead of initiatedBy for non-parent signing", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-2" },
      formId: "form-2",
      formVersion: 1,
      submittedBy: "submission-owner",
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
      save,
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Clinical Form",
        orgId: "org-2",
        requiredSigner: "VET",
      }),
    });

    mockedUserModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
      }),
    });

    mockedCreateRenderedDocumentRecord.mockResolvedValueOnce({
      id: "rendered-doc-2",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "rendered-doc-2",
      signing: {
        documentId: "456",
        signingUrl: "https://documenso.example/sign/vet-token",
      },
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-2",
        initiatedBy: "attacker-user",
      }),
    ).resolves.toEqual({
      documentId: "456",
      signingUrl: "https://documenso.example/sign/vet-token",
    });

    expect(mockedUserModel.findOne).toHaveBeenCalledWith({
      userId: "submission-owner",
    });
    expect(mockedCreateRenderedDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Clinical Form",
        source: expect.objectContaining({
          sourceKind: "FORM_SUBMISSION",
          sourceId: "submission-2",
          organisationId: "org-2",
          templateKind: "FORM",
          templateId: "form-2",
          templateVersion: 1,
        }),
      }),
    );
    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        renderedDocumentId: "rendered-doc-2",
        organisationId: "org-2",
        signerType: "PMS_USER",
        signerEmail: "owner@example.com",
        signerName: "Owner User",
      }),
    );
  });
});
